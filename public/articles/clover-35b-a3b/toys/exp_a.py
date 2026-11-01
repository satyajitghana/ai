# Toy: LowConfidence block denoising (Clover's rule) on a real masked LM (distilroberta-base). Not Clover; no right context.
import json, torch, time, collections
from transformers import AutoTokenizer, AutoModelForMaskedLM
torch.set_num_threads(2); torch.manual_seed(0)
tok=AutoTokenizer.from_pretrained("distilroberta-base"); m=AutoModelForMaskedLM.from_pretrained("distilroberta-base").eval()
paras=json.load(open('paras.json'))
MASK=tok.mask_token_id
P=48
def run(ids_prefix, truth, B, tau):
    block=torch.full((B,),MASK); pending=torch.ones(B,dtype=torch.bool); order=[]; steps=0
    while pending.any():
        x=torch.cat([ids_prefix,block,torch.tensor([tok.sep_token_id])])[None]
        with torch.no_grad(): lg=m(x).logits[0,len(ids_prefix):len(ids_prefix)+B].float()
        lg[:,MASK]=-1e9
        pr=lg.softmax(-1); conf,pred=pr.max(-1); conf=conf.masked_fill(~pending,-1.0)
        tr=(conf>tau)&pending
        if not tr.any(): tr[conf.argmax()]=True
        block[tr]=pred[tr]; pending&=~tr; order.append(int(tr.sum())); steps+=1
    acc=(block==truth).float().mean().item()
    dup=(block[1:]==block[:-1]).float().mean().item()
    return steps, order, acc, dup, block
res=[]
CFG=[(16,t) for t in (1.01,0.95,0.9,0.8,0.6,0.4)]+[(32,0.95)]
for B,tau in CFG:
    if True:
        S=[];A=[];D=[];first=[]
        for p in paras[:24]:
            ids=tok(p,add_special_tokens=True,return_tensors='pt').input_ids[0][:-1]
            if len(ids)<P+B+2: continue
            pre,truth=ids[:P],ids[P:P+B]
            s,o,a,d,_=run(pre,truth,B,tau); S.append(s);A.append(a);D.append(d);first.append(o[0])
        n=len(S)
        res.append(dict(B=B,tau=tau,n=n,steps_mean=sum(S)/n,tokens_per_step=B/(sum(S)/n),token_agreement=sum(A)/n,adjacent_dup_rate=sum(D)/n,first_step_tokens=sum(first)/n))
        print(res[-1],flush=True)
json.dump(res,open('exp_a.json','w'),indent=1)
# traces for the widget: one paragraph, B=16, each tau, store the commit order
p=paras[3]; ids=tok(p,return_tensors='pt').input_ids[0][:-1]; pre,truth=ids[:P],ids[P:P+16]
traces=[]
for tau in (1.01,0.95,0.8,0.4):
    block=torch.full((16,),MASK); pending=torch.ones(16,dtype=torch.bool); rounds=[]
    while pending.any():
        x=torch.cat([pre,block,torch.tensor([tok.sep_token_id])])[None]
        with torch.no_grad(): lg=m(x).logits[0,len(pre):len(pre)+16].float()
        lg[:,MASK]=-1e9; pr=lg.softmax(-1); conf,pred=pr.max(-1); conf=conf.masked_fill(~pending,-1.0)
        tr=(conf>tau)&pending
        if not tr.any(): tr[conf.argmax()]=True
        idx=tr.nonzero().flatten().tolist(); rounds.append([[i,tok.decode([int(pred[i])]),round(float(conf[i]),3)] for i in idx])
        block[tr]=pred[tr]; pending&=~tr
    traces.append({"tau":tau,"rounds":rounds,"final":tok.decode(block),"truth":tok.decode(truth)})
json.dump({"prefix":tok.decode(pre),"traces":traces},open('trace.json','w'),indent=1,ensure_ascii=False)
print('done')
