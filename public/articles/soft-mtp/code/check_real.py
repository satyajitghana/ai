import torch, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import train_toy as T
torch.set_num_threads(2)
data=T.load_tokens(); print('tokens',data.numel())
torch.manual_seed(0)
m=T.LM(); x=data[:64*4].view(4,64); y=torch.stack([data[i*64+1:i*64+65] for i in range(4)])
def grads(obj):
    m.zero_grad(set_to_none=True)
    hs=m.hiddens(x); loss,_=T.objective_loss(m,hs,y,obj); loss.backward()
    return {n:(p.grad.clone() if p.grad is not None else None) for n,p in m.named_parameters()}, float(loss)
gs,ls=grads('soft'); gk,lk=grads('kl'); gm,lm=grads('mtp')
def rel(a,b): return float((a-b).norm()/(b.norm()+1e-30))
trunk=[n for n,_ in m.named_parameters() if n.startswith(('emb','pos','blocks'))]
heads=[n for n,_ in m.named_parameters() if n.startswith(('mtp_blocks','proj','hn_'))]
print('loss values soft/mtp/kl:',ls,lm,lk)
print('trunk soft-vs-kl max rel', max(rel(gs[n],gk[n]) for n in trunk if gs[n] is not None))
print('heads soft-vs-kl max rel', max(rel(gs[n],gk[n]) for n in heads if gs[n] is not None))
print('trunk soft-vs-mtp max rel', max(rel(gs[n],gm[n]) for n in trunk if gs[n] is not None))
print('W soft-vs-mtp rel', rel(gs['head.weight'],gm['head.weight']), ' W soft-vs-kl rel', rel(gs['head.weight'],gk['head.weight']))
