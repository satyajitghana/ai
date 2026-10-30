import json, struct, requests, re, collections, sys
B="https://huggingface.co/Diffuspace/Clover-35B-A3B-Preview/resolve/main/"
idx=requests.get(B+"model.safetensors.index.json",timeout=60).json()
shards=sorted(set(idx["weight_map"].values()))
def get(url,a,b):
    r=requests.get(url,headers={"Range":f"bytes={a}-{b}"},timeout=120); r.raise_for_status(); return r.content
tensors={}
for s in shards+["bd_gdn_conv_right_weight.safetensors","bd_gdn_softmax_scalars.safetensors"]:
    n=struct.unpack("<Q",get(B+s,0,7))[0]
    h=json.loads(get(B+s,8,8+n-1)); h.pop("__metadata__",None)
    for k,v in h.items():
        sz=1
        for d in v["shape"]: sz*=d
        tensors[k]={"shape":v["shape"],"dtype":v["dtype"],"n":sz,"shard":s}
json.dump(tensors,open("tensors.json","w"))
print(len(tensors),"tensors", sum(t["n"] for t in tensors.values()))
