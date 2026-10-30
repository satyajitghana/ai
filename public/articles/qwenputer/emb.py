import json,struct,requests,random
import numpy as np
REPO="divagr1925/Qwen3.5-4B-Qwenputer"; base=f"https://huggingface.co/{REPO}/resolve/main/"
ix=requests.get(base+"model.safetensors.index.json",timeout=60).json()["weight_map"]; name="model.embed_tokens.weight"; s=ix[name]
u=base+s; n=struct.unpack("<Q",requests.get(u,headers={"Range":"bytes=0-7"},timeout=60).content)[0]
h=json.loads(requests.get(u,headers={"Range":f"bytes=8-{8+n-1}"},timeout=120).content); info=h[name]; R,C=info["shape"]; a=info["data_offsets"][0]; off=8+n
rng=random.Random(3)
def row(r):
    b=requests.get(u,headers={"Range":f"bytes={off+a+r*C*2}-{off+a+(r+1)*C*2-1}"},timeout=120).content
    x=np.frombuffer(b,dtype=np.uint16).astype(np.uint32)<<16; return x.view(np.float32)
out={}
for label,lo,hi in [("qwen rows",0,248320),("chip rows",248320,R)]:
    rs=sorted(rng.sample(range(lo,hi),64)); M=np.stack([row(r) for r in rs]); nz=M!=0
    cols=np.where(nz.any(0))[0]
    out[label]=dict(rows_sampled=64,nonzero_frac=float(nz.mean()),mean_nonzero_per_row=float(nz.sum(1).mean()),max_nonzero_col=int(cols.max()),rows_all_zero=int((~nz.any(1)).sum()),absmax=float(np.abs(M).max()))
    print(label,out[label],flush=True)
json.dump(out,open('emb.json','w'),indent=1)
