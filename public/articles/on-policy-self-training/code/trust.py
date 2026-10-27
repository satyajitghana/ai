import json, numpy as np
import opst_toy as T
def joint(net, x, hint):
    n=len(x); p1=T.softmax(net.logits(T.feats(x,hint,0,None)))
    out=np.zeros((n,4))
    for c in (0,1):
        p2=T.softmax(net.logits(T.feats(x,hint,1,np.full(n,c))))
        for f in (0,1): out[:,2*c+f]=p1[:,c]*p2[:,f]
    return out
bins=np.linspace(0.25,1.0,7); acc={ 'wrong':[[] for _ in range(6)], 'right':[[] for _ in range(6)]}
for s in range(30):
    rng=np.random.default_rng(s); net=T.pretrain(rng)
    x=np.stack([rng.uniform(-1,0,3000),rng.uniform(-1,1,3000)],1); y=T.true_class(x)
    ps=joint(net,x,np.full(len(x),4)); conf=ps.max(1); am=ps.argmax(1)
    # hint = a class that is NOT the student's argmax (wrong w.r.t. student), and the student's argmax itself
    h_other=(am+rng.integers(1,4,len(x)))%4
    pt_o=joint(net,x,h_other)[np.arange(len(x)),h_other]
    pt_a=joint(net,x,am)[np.arange(len(x)),am]
    b=np.clip(np.digitize(conf,bins)-1,0,5)
    for i in range(6):
        m=b==i
        if m.sum()>20: acc['wrong'][i].append(float(pt_o[m].mean())); acc['right'][i].append(float(pt_a[m].mean()))
res={"bins":bins.tolist(),"hint_other":[float(np.mean(v)) if v else None for v in acc['wrong']],"hint_own_argmax":[float(np.mean(v)) if v else None for v in acc['right']],"n_seeds":[len(v) for v in acc['wrong']]}
print(json.dumps(res,indent=1)); json.dump(res,open('trust.json','w'))
