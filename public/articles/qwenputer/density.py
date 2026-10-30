import json,struct,requests,random,math,re
import numpy as np
REPO="divagr1925/Qwen3.5-4B-Qwenputer"
base=f"https://huggingface.co/{REPO}/resolve/main/"
ix=requests.get(base+"model.safetensors.index.json",timeout=60).json()["weight_map"]
hdrs={}
def hdr(shard):
    if shard in hdrs: return hdrs[shard]
    u=base+shard
    n=struct.unpack("<Q",requests.get(u,headers={"Range":"bytes=0-7"},timeout=60).content)[0]
    h=json.loads(requests.get(u,headers={"Range":f"bytes=8-{8+n-1}"},timeout=120).content); h.pop("__metadata__",None)
    hdrs[shard]=(h,8+n); return hdrs[shard]
def bf16(buf): 
    a=np.frombuffer(buf,dtype=np.uint16).astype(np.uint32)<<16
    return a.view(np.float32)
rng=random.Random(11)
def sample_rows(name,nrows=48):
    shard=ix[name]; h,off=hdr(shard); info=h[name]; shp=info["shape"]; a,b=info["data_offsets"]
    R,C=shp[0],shp[1]; rb=C*2; rows=sorted(rng.sample(range(R),min(nrows,R))); out=[]
    for r in rows:
        buf=requests.get(base+shard,headers={"Range":f"bytes={off+a+r*rb}-{off+a+(r+1)*rb-1}"},timeout=120).content
        out.append(bf16(buf))
    M=np.stack(out); return rows,M
res={}
for name in ["model.layers.0.mlp.down_proj.weight","model.layers.0.mlp.up_proj.weight","model.layers.0.linear_attn.in_proj_qkv.weight","model.layers.5.mlp.gate_proj.weight","model.layers.10.mlp.up_proj.weight",
             "model.layers.12.mlp.up_proj.weight","model.layers.12.mlp.down_proj.weight","model.layers.12.linear_attn.in_proj_qkv.weight","model.layers.30.mlp.gate_proj.weight","model.layers.14.self_attn.q_proj.weight"]:
    rows,M=sample_rows(name)
    nz=(M!=0); cols=np.where(nz.any(0))[0]
    res[name]=dict(shape=list(hdr(ix[name])[0][name]["shape"]),nonzero_frac=float(nz.mean()),nonzero_cols=int(len(cols)),max_nz_col=int(cols.max()) if len(cols) else -1,rows_with_nz=int(nz.any(1).sum()),nrows=len(rows),absmax=float(np.abs(M).max()))
    print(name,res[name],flush=True)
json.dump(res,open('density.json','w'),indent=1)
