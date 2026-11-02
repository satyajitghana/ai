# Toy: the block coreset selector of Clover (coreset_torch in modeling_clover_moe.py, same algorithm) on SYNTHETIC router logits.
# Routing correlation is a knob we set; the real model's routing is not measured here (needs the weights and a GPU).
import numpy as np, json
rng=np.random.default_rng(5)
E,K,T=256,8,32
def softmax(x): x=x-x.max(-1,keepdims=True); e=np.exp(x); return e/e.sum(-1,keepdims=True)
def coreset(logits, top_p):
    ids=np.argsort(-logits,axis=-1,kind='stable')[:,:K]
    pr=softmax(logits); sc=np.take_along_axis(pr,ids,-1)
    tot=np.zeros(E); np.add.at(tot,ids.reshape(-1),sc.reshape(-1))
    p=tot/max(tot.sum(),1e-9); order=np.argsort(-p,kind='stable'); sp=p[order]
    keep=(np.cumsum(sp)-sp)<top_p; keep[0]=True
    allowed=np.zeros(E,bool); allowed[order[keep]]=True
    return allowed
def union_topk(logits): return len(set(np.argsort(-logits,axis=-1)[:,:K].reshape(-1)))
rows=[]
for corr in (0.0,1.0,2.0,3.0):   # weight of a block-wide shared preference added to per-token router logits
    U0=[];res={p:[] for p in (0.5,0.7,0.9,0.95,1.0)}; moved=[]
    for trial in range(200):
        shared=rng.normal(size=E)
        logits=corr*shared[None,:]+rng.normal(size=(T,E))
        U0.append(union_topk(logits))
        for p in res:
            al=coreset(logits,p); res[p].append(al.sum())
            if p==0.9:
                masked=np.where(al[None,:],logits,-1e9); 
                a=np.argsort(-logits,axis=-1)[:,:K]; b=np.argsort(-masked,axis=-1)[:,:K]
                moved.append(np.mean([len(set(x)-set(y)) for x,y in zip(a,b)]))
    rows.append(dict(correlation=corr, union_without_coreset=float(np.mean(U0)), kept={str(p):float(np.mean(v)) for p,v in res.items()}, slots_rerouted_at_0_9=float(np.mean(moved))))
    print(rows[-1])
json.dump(rows,open('exp_c.json','w'),indent=1)
