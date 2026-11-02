# Rows 'exact' and 'threshold delta 0.6' came from an earlier identical run (killed by a container restart) and were seeded into rows_b.jsonl; the other two were produced by this script.
# Toy: Clover-style threshold acceptance (min(ratio, delta*exp(-H)) on the verifier's probability) vs exact match,
# with pythia-70m as a stand-in drafter and pythia-160m as verifier. Not Clover's drafter (its own preview pass).
import json, math, torch
from transformers import AutoTokenizer, AutoModelForCausalLM
torch.set_num_threads(2)
tok=AutoTokenizer.from_pretrained("EleutherAI/pythia-160m")
V=AutoModelForCausalLM.from_pretrained("EleutherAI/pythia-160m").eval()
D=AutoModelForCausalLM.from_pretrained("EleutherAI/pythia-70m").eval()
paras=json.load(open('paras.json'))
P,GEN,B=48,32,8
def greedy(model,ids,n):
    with torch.no_grad(): o=model.generate(ids[None],max_new_tokens=n,do_sample=False,pad_token_id=tok.eos_token_id)
    return o[0,len(ids):]
def accept_count(cands, vlogits, rule, ratio, delta):
    # cands: B draft tokens following the pending token position; vlogits[j] = verifier dist for position of cands[j]
    pr=vlogits.softmax(-1)
    if rule=='exact': ok=(vlogits.argmax(-1)==cands)
    else:
        H=-(pr*pr.clamp_min(1e-12).log()).sum(-1)
        th=torch.minimum(torch.full_like(H,ratio),delta*torch.exp(-H))
        p=pr.gather(-1,cands[:,None]).squeeze(-1); ok=(p>=th)&(p>0)
    return int(ok.int().cumprod(0).sum())
def decode(ids0, rule, ratio, delta):
    ids=ids0.clone(); gen=[]; rounds=0
    while len(gen)<GEN:
        cands=greedy(D,ids,B)
        x=torch.cat([ids,cands])[None]
        with torch.no_grad(): lg=V(x).logits[0].float()
        L=len(ids)
        vl=lg[L-1:L-1+B]            # distribution for each candidate position
        r=accept_count(cands,vl,rule,ratio,delta)
        bonus=lg[L-1+r].argmax()    # verifier's own token at the boundary
        new=torch.cat([cands[:r],bonus[None]]); gen+=new.tolist(); ids=torch.cat([ids,new]); rounds+=1
    return torch.tensor(gen[:GEN]), rounds, len(gen)
rows=[]
settings=[('exact',0,0),('threshold',0.9,0.6),('threshold',0.9,3.0),('threshold',0.9,10.0)]
import os
REF='ref_b.pt'; ROWS='rows_b.jsonl'
done={}
if os.path.exists(ROWS):
    for l in open(ROWS): r=json.loads(l); done[(r['rule'],r['delta'])]=r
ref=[]; prefs=[]
for p in paras[:8]:
    ids=tok(p,return_tensors='pt').input_ids[0]
    if len(ids)<P+GEN: continue
    pre=ids[:P]; prefs.append(pre)
if os.path.exists(REF): ref=torch.load(REF)
else:
    ref=[greedy(V,pre,GEN) for pre in prefs]; torch.save(ref,REF)
for rule,ratio,delta in settings:
    if (rule,delta) in done: rows.append(done[(rule,delta)]); continue
    tot_rounds=0; tot_tokens=0; match=0; n=0
    for pre,rg in zip(prefs,ref):
        g,r,ng=decode(pre,rule,ratio,delta); tot_rounds+=r; tot_tokens+=ng; match+=(g==rg).float().mean().item(); n+=1
    rows.append(dict(rule=rule,ratio=ratio,delta=delta,prompts=n,tokens_per_round=tot_tokens/tot_rounds,agreement_with_verifier_greedy=match/n))
    print(rows[-1],flush=True); open(ROWS,'a').write(json.dumps(rows[-1])+'\n')
json.dump(rows,open('exp_b3.json','w'),indent=1)
