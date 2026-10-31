"""Toy 2: memory-bound effect of fusing a chain of 8 elementwise ops, on CPU, one thread. Not a GPU prediction."""
import numpy as np, time, json, sys, os
os.environ.setdefault("OMP_NUM_THREADS","1")
import torch
torch.set_num_threads(1)
N=1<<24; a,b,c,d=1.7,-0.3,0.9,1.1
rng=np.random.default_rng(0); x=rng.standard_normal(N).astype(np.float32)
def chain_np(x):
    t1=x*a; t2=t1+b; t3=np.maximum(t2,0); t4=t3*t3; t5=t4+x; t6=t5*c; t7=t6-t3; return t7*d
def chain_np_inplace(x,bufs):
    t1,t2=bufs
    np.multiply(x,a,out=t1); np.add(t1,b,out=t1); np.maximum(t1,0,out=t1)      # t1 = t3
    np.multiply(t1,t1,out=t2); np.add(t2,x,out=t2); np.multiply(t2,c,out=t2); np.subtract(t2,t1,out=t2); np.multiply(t2,d,out=t2)
    return t2
def chain_chunked(x,out,chunk,bufs):
    t1,t2=bufs
    for s in range(0,N,chunk):
        xs=x[s:s+chunk]; u1=t1[:xs.size]; u2=t2[:xs.size]
        np.multiply(xs,a,out=u1); np.add(u1,b,out=u1); np.maximum(u1,0,out=u1)
        np.multiply(u1,u1,out=u2); np.add(u2,xs,out=u2); np.multiply(u2,c,out=u2); np.subtract(u2,u1,out=u2); np.multiply(u2,d,out=out[s:s+chunk])
    return out
def best(f,reps=7):
    ts=[]
    for _ in range(reps):
        t=time.perf_counter(); f(); ts.append(time.perf_counter()-t)
    return min(ts), float(np.median(ts))
ref=chain_np(x); res={"N":N,"threads":1}
res["numpy_unfused_alloc"]=best(lambda:chain_np(x))
bufs=(np.empty(N,np.float32),np.empty(N,np.float32))
assert np.allclose(chain_np_inplace(x,bufs),ref,rtol=1e-5,atol=1e-5)
res["numpy_unfused_inplace"]=best(lambda:chain_np_inplace(x,bufs))
out=np.empty(N,np.float32)
res["chunked"]={}
for lg in (8,10,12,14,16,18,20,22,24):
    ch=1<<lg; cb=(np.empty(ch,np.float32),np.empty(ch,np.float32))
    chain_chunked(x,out,ch,cb); assert np.allclose(out,ref,rtol=1e-5,atol=1e-5)
    res["chunked"][str(ch)]=best(lambda:chain_chunked(x,out,ch,cb))
xt=torch.from_numpy(x)
def chain_t(x):
    t1=x*a; t2=t1+b; t3=torch.clamp(t2,min=0); t4=t3*t3; t5=t4+x; t6=t5*c; t7=t6-t3; return t7*d
assert torch.allclose(chain_t(xt),torch.from_numpy(ref),rtol=1e-4,atol=1e-4)
res["torch_eager"]=best(lambda:chain_t(xt))
try:
    t=time.perf_counter(); fc=torch.compile(chain_t); y=fc(xt); res["torch_compile_first_call_s"]=time.perf_counter()-t
    assert torch.allclose(y,torch.from_numpy(ref),rtol=1e-4,atol=1e-4)
    res["torch_compile"]=best(lambda:fc(xt))
except Exception as e:
    res["torch_compile_error"]=repr(e)[:300]
# bytes moved (ideal, counting every op's reads of distinct arrays and its write): unfused 10 reads + 8 writes of N floats; fused 1 read + 1 write
res["bytes_unfused_per_elem"]=18*4; res["bytes_fused_per_elem"]=2*4
json.dump(res,open("fusion_bench.json","w"),indent=1,default=float)
print(json.dumps(res,indent=1,default=float))
