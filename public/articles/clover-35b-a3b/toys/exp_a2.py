import json, torch, collections
from transformers import AutoTokenizer, AutoModelForMaskedLM
torch.set_num_threads(2)
tok=AutoTokenizer.from_pretrained("distilroberta-base"); m=AutoModelForMaskedLM.from_pretrained("distilroberta-base").eval()
paras=json.load(open('paras.json')); MASK=tok.mask_token_id; P=48; B=16; tau=0.95
out=[]
for i,p in enumerate(paras[:24]):
    ids=tok(p,return_tensors='pt').input_ids[0][:-1]
    if len(ids)<P+B+2: continue
    pre,truth=ids[:P],ids[P:P+B]
    block=torch.full((B,),MASK); pending=torch.ones(B,dtype=torch.bool); rounds=[]
    while pending.any():
        x=torch.cat([pre,block,torch.tensor([tok.sep_token_id])])[None]
        with torch.no_grad(): lg=m(x).logits[0,len(pre):len(pre)+B].float()
        lg[:,MASK]=-1e9; pr=lg.softmax(-1); conf,pred=pr.max(-1); conf=conf.masked_fill(~pending,-1.0)
        tr=(conf>tau)&pending
        if not tr.any(): tr[conf.argmax()]=True
        idx=tr.nonzero().flatten().tolist(); rounds.append([[j,tok.decode([int(pred[j])]),round(float(conf[j]),3)] for j in idx])
        block[tr]=pred[tr]; pending&=~tr
    cnt=collections.Counter(block.tolist()).most_common(1)[0][1]
    out.append(dict(i=i,steps=len(rounds),top_token_share=cnt/B,final=tok.decode(block),truth=tok.decode(truth),rounds=rounds,prefix=tok.decode(pre)))
    print(i,len(rounds),round(cnt/B,2),repr(tok.decode(block))[:90],flush=True)
json.dump(out,open('exp_a2.json','w'),ensure_ascii=False)
print('share of blocks where one token fills >= half the slots:', sum(o['top_token_share']>=0.5 for o in out),'of',len(out))
