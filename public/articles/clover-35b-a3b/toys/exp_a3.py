import json, torch
from transformers import AutoTokenizer, AutoModelForMaskedLM
torch.set_num_threads(2)
tok=AutoTokenizer.from_pretrained("distilroberta-base"); m=AutoModelForMaskedLM.from_pretrained("distilroberta-base").eval()
paras=json.load(open('paras.json')); MASK=tok.mask_token_id; P=48; B=16
p=paras[8]; ids=tok(p,return_tensors='pt').input_ids[0][:-1]; pre,truth=ids[:P],ids[P:P+B]
traces=[]
for tau in (1.01,0.95,0.8,0.4):
    block=torch.full((B,),MASK); pending=torch.ones(B,dtype=torch.bool); rounds=[]
    while pending.any():
        x=torch.cat([pre,block,torch.tensor([tok.sep_token_id])])[None]
        with torch.no_grad(): lg=m(x).logits[0,len(pre):len(pre)+B].float()
        lg[:,MASK]=-1e9; pr=lg.softmax(-1); conf,pred=pr.max(-1); conf=conf.masked_fill(~pending,-1.0)
        tr=(conf>tau)&pending
        if not tr.any(): tr[conf.argmax()]=True
        idx=tr.nonzero().flatten().tolist(); rounds.append([[j,tok.decode([int(pred[j])]),round(float(conf[j]),3)] for j in idx])
        block[tr]=pred[tr]; pending&=~tr
    traces.append({"tau":tau,"rounds":rounds,"final":tok.decode(block),"truth":tok.decode(truth)})
    print(tau,len(rounds),[len(r) for r in rounds],repr(tok.decode(block))[:100],flush=True)
json.dump({"prefix":tok.decode(pre),"traces":traces},open('trace2.json','w'),ensure_ascii=False,indent=1)
