import json,struct,requests,re,collections,sys
B="https://huggingface.co/nace-ai/drex-max-v1/resolve/main/"
s=requests.Session()
def rng(u,a,b):
    r=s.get(u,headers={"Range":f"bytes={a}-{b}"},timeout=120); r.raise_for_status(); return r.content
idx=json.load(open('files/model.safetensors.index.json'))
shards=sorted(set(idx['weight_map'].values())); shards.append('readout.safetensors')
tensors={}
for sh in shards:
    u=B+sh; n=struct.unpack('<Q',rng(u,0,7))[0]; h=json.loads(rng(u,8,8+n-1)); h.pop('__metadata__',None)
    for k,v in h.items(): tensors[k]=(v['dtype'],v['shape'],sh)
    print(sh,len(h),flush=True)
json.dump({k:[v[0],v[1],v[2]] for k,v in tensors.items()},open('tensors.json','w'))
