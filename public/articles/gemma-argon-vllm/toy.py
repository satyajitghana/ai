import os,time,json,math
os.environ["OMP_NUM_THREADS"]="2"
import torch
torch.set_num_threads(2)
torch.manual_seed(0)
out={}
def bench(f,n=7,warm=2):
    for _ in range(warm): f()
    ts=[]
    for _ in range(n):
        t=time.perf_counter();f();ts.append(time.perf_counter()-t)
    ts.sort();return ts[len(ts)//2]

# ---------- Exp A: KV-sharing fast prefill (toy YOCO stack) ----------
# 35 layers, first 15 own KV, last 20 read donor KV. Hidden scaled 1536 -> 192 (1/8), MLP 6144 -> 768, shared 12288 -> 1536. 1 KV head, 8 q heads, head 32.
H,NQ,HD=192,8,32
NOWN,NSH=15,20
def mk(mlp):
    return dict(q=torch.randn(H,NQ*HD)/H**.5, o=torch.randn(NQ*HD,H)/(NQ*HD)**.5,
      g=torch.randn(H,mlp)/H**.5,u=torch.randn(H,mlp)/H**.5,d=torch.randn(mlp,H)/mlp**.5,
      k=torch.randn(H,HD)/H**.5,v=torch.randn(H,HD)/H**.5)
own=[mk(768) for _ in range(NOWN)]; sh=[mk(1536) for _ in range(NSH)]
donor=[NOWN-1-(i%1) for i in range(NSH)]  # simple: all shared layers read the last own layer's KV (as sliding/global map to last of same type; toy uses one)
def rms(x): return x*torch.rsqrt((x*x).mean(-1,keepdim=True)+1e-6)
def attn(q,K,V,qpos):
    # q: [n,NQ,HD], K,V: [T,HD]; causal by absolute query position
    s=torch.einsum('nhd,td->nht',q,K)/HD**.5
    T=K.shape[0]
    mask=torch.arange(T)[None,None,:]>qpos[:,None,None]
    s=s.masked_fill(mask,float('-inf'))
    return torch.einsum('nht,td->nhd',s.softmax(-1),V)
def mlp(w,x): return (torch.nn.functional.gelu(x@w['g'],approximate='tanh')*(x@w['u']))@w['d']
def run(x,fast):
    T=x.shape[0];pos=torch.arange(T)
    kv=None
    for w in own:
        h=rms(x);q=(h@w['q']).view(T,NQ,HD);K=h@w['k'];V=h@w['v']
        x=x+attn(q,K,V,pos).reshape(T,-1)@w['o'];x=x+mlp(w,rms(x));kv=(K,V)
    K,V=kv
    if fast:
        x=x[-1:];pos=pos[-1:]      # only the row that will be sampled
    for w in sh:
        h=rms(x);n=x.shape[0];q=(h@w['q']).view(n,NQ,HD)
        x=x+attn(q,K,V,pos).reshape(n,-1)@w['o'];x=x+mlp(w,rms(x))
    return x[-1]
res={}
for T in (128,512):
    x0=torch.randn(T,H)
    with torch.no_grad():
        a=run(x0,False);b=run(x0,True)
        tf=bench(lambda:run(x0,False));tq=bench(lambda:run(x0,True))
    res[T]=dict(full_ms=tf*1e3,fast_ms=tq*1e3,speedup=tf/tq,max_abs_diff=(a-b).abs().max().item(),bit_equal=bool(torch.equal(a,b)))
out['fast_prefill_toy']=res
# analytic weight-FLOPs with the REAL E2B shapes (matmul MACs/token; ignores attention-score FLOPs)
real_own=lambda g: 1536*(8*(512 if g else 256))*2+1536*(512 if g else 256)*2+3*1536*6144  # q,o + k,v + mlp
def real_layer(i,shared):
    g=((i+1)%5==0); hd=512 if g else 256
    mlp=3*1536*(12288 if shared else 6144)
    qo=2*1536*8*hd
    kv=0 if shared else 2*1536*hd
    return qo+kv+mlp
own_m=sum(real_layer(i,False) for i in range(15)); sh_m=sum(real_layer(i,True) for i in range(15,35))
out['real_shape_macs_per_token']=dict(own15=own_m,shared20=sh_m,shared_fraction=sh_m/(own_m+sh_m))
for N in (512,2048):
    out['real_shape_macs_per_token'][f'prefill_ratio_N{N}_1logit']=(own_m*N+sh_m*N)/(own_m*N+sh_m*1)

# ---------- Exp B: metadata construction (PR #5, single-logit arange) ----------
R=64
qsl=torch.cat([torch.zeros(1,dtype=torch.int32),torch.cumsum(torch.randint(100,4000,(R,),dtype=torch.int32),0).to(torch.int32)])
lg=(qsl[1:]-1).to(torch.int64)  # one logit index per request (last token)
def old():
    rid=torch.bucketize(lg,qsl[1:],right=True)
    n=torch.zeros(R,dtype=rid.dtype);n.scatter_add_(0,rid.to(n.dtype),torch.ones_like(rid))
    o=torch.empty(R+1,dtype=qsl.dtype);o[:1].fill_(0);o[1:]=torch.cumsum(n,0);return o
def new(): return torch.arange(0,R+1,dtype=qsl.dtype)
assert torch.equal(old(),new())
to,tn=bench(old,200,20),bench(new,200,20)
out['metadata_toy']=dict(equal=True,old_us=to*1e6,new_us=tn*1e6,speedup=to/tn,reqs=R)

# ---------- Exp C: fused vs unfused RMSNorm+RoPE (pure CPU memory-pass effect) ----------
M,NH,D=512,8,256
q=torch.randn(M,NH,D,dtype=torch.bfloat16);w=torch.randn(D,dtype=torch.bfloat16)
ang=torch.rand(M,D//2)*6.28;cos=ang.cos().to(torch.bfloat16)[:,None];sin=ang.sin().to(torch.bfloat16)[:,None]
def unfused():
    x=q.float();r=torch.rsqrt(x.pow(2).mean(-1,keepdim=True)+1e-6);y=(x*r).to(torch.bfloat16)*w
    x1,x2=y[...,:D//2].float(),y[...,D//2:].float()
    c,s=cos.float(),sin.float()
    return torch.cat([(x1*c-x2*s).to(torch.bfloat16),(x2*c+x1*s).to(torch.bfloat16)],-1)
fusedc=None
try:
    fusedc=torch.compile(unfused)
    fusedc()
except Exception as e:
    out['compile_error']=str(e)[:200];fusedc=None
r=dict(unfused_ms=bench(unfused,15)*1e3)
if fusedc:
    r['compiled_ms']=bench(fusedc,15)*1e3;r['speedup']=r['unfused_ms']/r['compiled_ms']
    a,b=unfused(),fusedc();r['max_abs_diff']=(a.float()-b.float()).abs().max().item();r['exact_pct']=(a==b).float().mean().item()*100
out['rmsnorm_rope_toy']=r

# ---------- Exp D: sparse gather-GEMV (MTP head) ----------
V,Hh,S=262144,256,4096   # toy: candidate set S of vocab V, hidden 256 (not the real assistant head width)
W=torch.randn(V,Hh,dtype=torch.bfloat16);h=torch.randn(4,Hh,dtype=torch.bfloat16);sel=torch.randint(0,V,(4,S))
def g1(): return torch.einsum('td,tsd->ts',h.float(),W[sel.reshape(-1)].view(4,S,Hh).float())
def g2():
    o=torch.empty(4,S)
    for t in range(4): o[t]=(W[sel[t]].float()@h[t].float())
    return o
a,b=g1(),g2()
out['gather_gemv_toy']=dict(einsum_ms=bench(g1,9)*1e3,rowwise_ms=bench(g2,9)*1e3,max_abs_diff=(a-b).abs().max().item(),
   materialized_MB_einsum=4*S*Hh*2/1e6, dense_head_MB_full_vocab=V*Hh*2/1e6)

# ---------- Exp E: token-parity logic ----------
# argmax flip probability under ULP-scale noise. Toy logits: Gaussian per-vocab (V=262144), temperature scale s; noise = bf16 rel error 2^-8 on the logit magnitude.
g=torch.Generator().manual_seed(1)
Vv=262144;trials=300;flips={}
for scale in (3.0,6.0):
    f=0;margins=[]
    for _ in range(trials):
        z=torch.randn(Vv,generator=g)*scale
        t2=z.topk(2).values;margins.append((t2[0]-t2[1]).item())
        zn=(z.to(torch.bfloat16).float()*(1+ (torch.rand(Vv,generator=g)-.5)*2*2**-8))
        f+= int(z.argmax()!=zn.argmax())
    margins.sort()
    flips[scale]=dict(flip_rate=f/trials,median_top2_margin=margins[len(margins)//2])
out['parity_toy']=flips
out['arith']=dict(ratio=108000/37900,pct=(108000/37900-1)*100,ratio_if_37900_to_108000_plus=None)
print(json.dumps(out,indent=1))
json.dump(out,open(os.path.dirname(os.path.abspath(__file__))+"/toy-results.json",'w'),indent=1)
