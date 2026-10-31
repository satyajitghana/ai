import json,math,collections
r=json.load(open('exp_mask_results.json'))['rows']
by=collections.defaultdict(dict)
for x in r: by[x['i']][x['mode']]=x
items=[i for i in sorted(by) if len(by[i])==2]
def H(p): return -sum(q*math.log(q) for q in p if q>0)
out={'n_items':len(items),'types':collections.Counter(by[i]['causal']['type'] for i in items)}
res={}
for t in ['choice','noul','score','all']:
    its=[i for i in items if t=='all' or by[i]['causal']['type']==t]
    if not its: continue
    rowt={}
    for m in ('causal','noncausal'):
        acc=sum(by[i][m]['pred']==by[i][m]['label'] for i in its)/len(its)
        pmax=sum(max(by[i][m]['p']) for i in its)/len(its)
        pl=sum(by[i][m]['p'][by[i][m]['label']] for i in its)/len(its)
        ent=sum(H(by[i][m]['p']) for i in its)/len(its)
        rowt[m]={'acc':round(acc,3),'mean_p_label':round(pl,3),'mean_pmax':round(pmax,3),'mean_entropy':round(ent,3)}
    tv=sum(0.5*sum(abs(a-b) for a,b in zip(by[i]['causal']['p'],by[i]['noncausal']['p'])) for i in its)/len(its)
    flips=sum(by[i]['causal']['pred']!=by[i]['noncausal']['pred'] for i in its)
    rowt['mean_total_variation']=round(tv,3); rowt['pred_flips']=flips; rowt['n']=len(its)
    res[t]=rowt
out['results']=res
out['sec_per_row_median']=sorted(x['sec'] for x in r)[len(r)//2]
print(json.dumps(out,indent=1,default=dict))
json.dump(out,open('exp_mask_summary.json','w'),indent=1,default=dict)
