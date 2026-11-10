"""Decode the counter with qwenFS's thermometer (qfs/circuit.py mlp1.thermo): for each j, a unit pair
silu(127 - kk x) - silu(126 - kk x), kk = 126 / sqrt(xs[j-1] xs[j]); in bf16."""
import json, sys
import torch, torch.nn.functional as F
sys.path.insert(0, ".")
xs = json.load(open("counter_full.json"))
NMAX = 600
bf = torch.bfloat16
x = torch.tensor(xs[:NMAX + 1], dtype=torch.float32)
tau = torch.tensor([ (xs[j-1]*xs[j])**0.5 for j in range(1, NMAX+1)])
kk = (126.0 / tau)
# MLP in bf16: gate = W x with bf16 weights and bf16 activations
X = x.to(bf).float()
g1 = (127.0 - kk.to(bf).float()[None, :] * X[:, None]).to(bf).float()
g0 = (126.0 - kk.to(bf).float()[None, :] * X[:, None]).to(bf).float()
U = (F.silu(g1.to(bf)).float() - F.silu(g0.to(bf)).float())       # U[n, j-1] ~ [n >= j]
ideal = (torch.arange(NMAX+1)[:, None] >= torch.arange(1, NMAX+1)[None, :]).float()
on, off = U[ideal == 1], U[ideal == 0]
dec = (U > 0.5).sum(1)
res = dict(on_min=on.min().item(), on_max=on.max().item(), off_min=off.min().item(), off_max=off.max().item(),
           decode_exact=int((dec == torch.arange(NMAX+1)).all().item()),
           sum_U_minus_n_maxabs=(U.sum(1) - torch.arange(NMAX+1)).abs().max().item(),
           units=2*NMAX)
print(json.dumps(res, indent=1)); json.dump(res, open("thermo_results.json", "w"), indent=1)
