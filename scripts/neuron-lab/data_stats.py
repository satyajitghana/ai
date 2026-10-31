"""Pass 1 over the corpus: per layer median ||residual leaving layer L||, per neuron actMax/actMin/actMean, and the
top-5 distinct-chunk contexts per neuron (by |activation|).  Positions >= 1 only (position 0 is an attention sink with
huge norms/activations).  Resumable: state is checkpointed to $NL_SCRATCH/stats.pt every 8 batches.
usage: data_stats.py [max_batches_this_run]"""
import sys, time
from data_common import *

BS = 8
K = 5
corp = torch.load(os.path.join(SCRATCH, "corpus.pt"))
ids = corp["ids"]
N = ids.shape[0]
ck = os.path.join(SCRATCH, "stats.pt")
if os.path.exists(ck):
    st = torch.load(ck)
else:
    st = dict(done=0, mx=torch.full((NL, NN), -1e9), mn=torch.full((NL, NN), 1e9), sm=torch.zeros(NL, NN), cnt=0,
              tv=torch.zeros(NL, NN, K), tc=torch.full((NL, NN, K), -1, dtype=torch.long), tp=torch.zeros(NL, NN, K, dtype=torch.long),
              rn=[[] for _ in range(NL)])
tok, model = load()
cur = {}
hs = []
for L, layer in enumerate(model.model.layers):
    def pre(mod, args, L=L):
        cur[("a", L)] = args[0]
    def post(mod, args, out, L=L):
        o = out[0] if isinstance(out, tuple) else out
        cur[("r", L)] = o
    hs.append(layer.mlp.down_proj.register_forward_pre_hook(pre))
    hs.append(layer.register_forward_hook(post))

maxb = int(sys.argv[1]) if len(sys.argv) > 1 else 10**9
t0 = time.time(); nb = 0
with torch.no_grad():
    while st["done"] < N and nb < maxb:
        i = st["done"]
        x = ids[i:i + BS]
        model.model(input_ids=x)
        B = x.shape[0]
        for L in range(NL):
            a = cur[("a", L)][:, 1:, :].float()
            st["mx"][L] = torch.maximum(st["mx"][L], a.amax((0, 1)))
            st["mn"][L] = torch.minimum(st["mn"][L], a.amin((0, 1)))
            st["sm"][L] += a.sum((0, 1))
            r = cur[("r", L)][:, 1:, :].float().norm(dim=-1)  # [B,127]
            st["rn"][L].append(r.flatten().clone())
            idx = a.abs().argmax(1)                              # [B,3072] position of peak |act| in each chunk
            val = a.gather(1, idx[:, None, :]).squeeze(1)        # signed
            cv = torch.cat([st["tv"][L].abs(), val.abs().T], 1)  # [3072, K+B]
            allv = torch.cat([st["tv"][L], val.T], 1)
            allc = torch.cat([st["tc"][L], (torch.arange(B) + i)[None, :].expand(NN, B)], 1)
            allp = torch.cat([st["tp"][L], (idx + 1).T], 1)
            top = cv.topk(K, 1).indices
            st["tv"][L] = allv.gather(1, top); st["tc"][L] = allc.gather(1, top); st["tp"][L] = allp.gather(1, top)
        st["cnt"] += B * (ids.shape[1] - 1)
        st["done"] += B; nb += 1
        if nb % 8 == 0:
            torch.save(st, ck)
            print(f"{st['done']}/{N} chunks  {time.time()-t0:.0f}s", flush=True)
torch.save(st, ck)
print("done" if st["done"] >= N else "partial", st["done"], N, f"{time.time()-t0:.0f}s")
