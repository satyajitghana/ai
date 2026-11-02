import json,struct,requests,random
import numpy as np
def mk(repo):
    base=f"https://huggingface.co/{repo}/resolve/main/"
    ix=requests.get(base+"model.safetensors.index.json",timeout=60).json()["weight_map"]; hd={}
    def hdr(s):
        if s not in hd:
            u=base+s; n=struct.unpack("<Q",requests.get(u,headers={"Range":"bytes=0-7"},timeout=60).content)[0]
            h=json.loads(requests.get(u,headers={"Range":f"bytes=8-{8+n-1}"},timeout=120).content); h.pop("__metadata__",None); hd[s]=(h,8+n)
        return hd[s]
    def rows(name,rs,c0=0,c1=None):
        s=ix[name]; h,off=hdr(s); info=h[name]; R,C=info["shape"]; a=info["data_offsets"][0]; c1=C if c1 is None else c1; out=[]
        for r in rs:
            buf=requests.get(base+s,headers={"Range":f"bytes={off+a+(r*C+c0)*2}-{off+a+(r*C+c1)*2-1}"},timeout=120).content
            out.append(np.frombuffer(buf,dtype=np.uint16))
        return info["shape"],np.stack(out)
    return rows
P=mk("divagr1925/Qwen3.5-4B-Qwenputer"); B=mk("Qwen/Qwen3.5-4B")
rng=random.Random(5); res=[]
def cmp(pn,bn,nrows=24,cols=None):
    sp,_=P(pn,[0],0,1); sb,_=B(bn,[0],0,1)
    R=min(sp[0],sb[0]); rs=sorted(rng.sample(range(R),nrows)); C=min(sp[1],sb[1])
    _,a=P(pn,rs,0,C); _,b=B(bn,rs,0,C)
    eq=bool((a==b).all()); res.append(dict(p=pn,b=bn,p_shape=sp,b_shape=sb,rows=nrows,cols_compared=C,identical=eq,mismatching_elements=int((a!=b).sum())))
    print(pn,'<->',bn,sp,sb,'identical' if eq else f'DIFF {int((a!=b).sum())}',flush=True)
# mapping: qwenputer layer i+11 <-> base layer i
for i in [1,2,19,31]:
    cmp(f"model.layers.{i+11}.mlp.up_proj.weight",f"model.language_model.layers.{i}.mlp.up_proj.weight")
    cmp(f"model.layers.{i+11}.mlp.down_proj.weight",f"model.language_model.layers.{i}.mlp.down_proj.weight")
cmp("model.layers.12.linear_attn.in_proj_qkv.weight","model.language_model.layers.1.linear_attn.in_proj_qkv.weight")
cmp("model.layers.14.self_attn.q_proj.weight","model.language_model.layers.3.self_attn.q_proj.weight")
cmp("model.layers.14.self_attn.k_proj.weight","model.language_model.layers.3.self_attn.k_proj.weight")
cmp("model.embed_tokens.weight","model.language_model.embed_tokens.weight",nrows=48)
json.dump(res,open('exact.json','w'),indent=1)
