import json,struct,requests,numpy as np,sys,re
s=requests.Session()
def rng(u,a,b):
    r=s.get(u,headers={"Range":f"bytes={a}-{b}"},timeout=300); r.raise_for_status(); return r.content
def hdr(u):
    n=struct.unpack('<Q',rng(u,0,7))[0]; h=json.loads(rng(u,8,8+n-1)); h.pop('__metadata__',None); return h,8+n
REPOS={'qwen':('Qwen/Qwen3.8-27B','1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0'),'d3':('vllm-sr/d3','main'),'d3t':('vllm-sr/d3-turbo','main'),'drex':('nace-ai/drex-max-v1','main')}
cache={}
def load_index(name):
    repo,rev=REPOS[name]; base=f"https://huggingface.co/{repo}/resolve/{rev}/"
    try: idx=json.loads(rng(base+'model.safetensors.index.json',0,50_000_000).decode())['weight_map']
    except Exception as e: idx=None
    return base,idx
IDX={n:load_index(n) for n in REPOS}
def norm(k): 
    k=re.sub(r'^model\.','',k); return k
def locate(name,key):
    base,idx=IDX[name]
    cands=[key,'model.'+key,key.replace('language_model.','model.language_model.')]
    for c in cands:
        if idx and c in idx: return base+idx[c],c
    # try normalised match
    for k,f in (idx or {}).items():
        if norm(k)==norm(key): return base+f,k
    raise KeyError((name,key))
def bf16(b): 
    a=np.frombuffer(b,dtype=np.uint16).astype(np.uint32)<<16; return a.view(np.float32)
def sample(name,key,nbytes=8*1024*1024):
    url,real=locate(name,key)
    if url not in cache: cache[url]=hdr(url)
    h,off=cache[url]; t=h[real]; a,b=t['data_offsets']; n=min(b-a,nbytes); n-=n%2
    raw=rng(url,off+a,off+a+n-1)
    return (bf16(raw) if t['dtype']=='BF16' else np.frombuffer(raw,dtype=np.float32)), t['shape'], t['dtype']
KEYS=['language_model.layers.0.mlp.up_proj.weight','language_model.layers.3.self_attn.q_proj.weight','language_model.layers.31.self_attn.q_proj.weight','language_model.layers.31.mlp.down_proj.weight','language_model.layers.63.self_attn.k_proj.weight','language_model.layers.0.linear_attn.in_proj_qkv.weight','visual.blocks.0.attn.qkv.weight','language_model.embed_tokens.weight']
res={}
for k in KEYS:
    S={}
    for n in REPOS:
        try: S[n]=sample(n,k)[0]
        except Exception as e: print('skip',n,k,repr(e)[:80]); 
    m=min(len(v) for v in S.values())
    def rel(a,b): return float(np.linalg.norm(S[a][:m]-S[b][:m])/np.linalg.norm(S[b][:m]))*100
    row={}
    for a,b in [('d3','qwen'),('d3t','qwen'),('drex','qwen'),('drex','d3'),('drex','d3t'),('d3t','d3')]:
        if a in S and b in S: row[f'{a}-{b}']=round(rel(a,b),3)
    res[k]=row; print(k.split('language_model.')[-1].replace('visual.','visual.'), 'n=%d'%m, row, flush=True)
json.dump(res,open('weight_distance.json','w'),indent=1)
