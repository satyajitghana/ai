"""qwenLab-style weight bank: a 128x128 weight block written into one Gated DeltaNet head with 128 one-hot
writes, then read with the activation as the query (a GEMV). Run on transformers' own reference recurrence,
once with Qwen3.5's stock q/k l2norm and once without it (qwenLab's modification)."""
import json
import torch
from transformers.models.qwen3_5.modeling_qwen3_5 import torch_recurrent_gated_delta_rule as rec
torch.set_num_threads(2)
D = 128
gen = torch.Generator().manual_seed(0)
res = {}
for trial in range(5):
    W = torch.randn(D, D, generator=gen, dtype=torch.float64) * 0.05     # a learner weight block, out x in
    x = torch.randn(D, generator=gen, dtype=torch.float64) * 3.0         # an activation
    ref = W @ x
    T = D + 1                                                             # 128 write ticks, then one read
    k = torch.zeros(1, T, 1, D); v = torch.zeros(1, T, 1, D); q = torch.zeros(1, T, 1, D)
    for i in range(D):
        k[0, i, 0, i] = 1.0                 # one-hot key: row i of the state
        v[0, i, 0] = W[:, i].float()        # column i of W goes into row i of S (S = W^T)
    q[0, D, 0] = x.float()
    beta = torch.ones(1, T, 1); beta[0, D, 0] = 0.0       # write strength 1 on writes, 0 on the read
    g = torch.zeros(1, T, 1)                               # gate open: alpha = exp(0) = 1
    for norm in (True, False):
        o, S = rec(q, k, v, g, beta, use_qk_l2norm_in_kernel=norm, output_final_state=True)
        y = o[0, D, 0].double()
        state_exact = bool((S[0, 0].double() == W.T.float().double()).all())
        if norm:
            y_fix = y * (D ** 0.5) * x.norm()                   # what the stock layer loses: |x| sqrt(D)
            rel = ((y_fix - ref).norm() / ref.norm()).item()
            raw = ((y - ref).norm() / ref.norm()).item()
            res.setdefault("stock_l2norm", []).append(dict(raw_rel_err=raw, rescaled_rel_err=rel,
                                                          lost_scale=(x.norm() * D ** 0.5).item(), state_exact=state_exact))
        else:
            y_fix = y * (D ** 0.5)                              # a constant, folds into out_proj
            rel = ((y_fix - ref).norm() / ref.norm()).item()
            f32 = (W.float() @ x.float()).double()
            res.setdefault("no_norm", []).append(dict(rel_err=rel, fp32_matmul_rel_err=((f32 - ref).norm() / ref.norm()).item(),
                                                      state_exact=state_exact))
# backward: a transposed copy (S = W) read with the output gradient gives W^T dy
dy = torch.randn(D, generator=gen, dtype=torch.float64)
T = D + 1
k = torch.zeros(1, T, 1, D); v = torch.zeros(1, T, 1, D); q = torch.zeros(1, T, 1, D)
for i in range(D):
    k[0, i, 0, i] = 1.0; v[0, i, 0] = W[i, :].float()
q[0, D, 0] = dy.float()
beta = torch.ones(1, T, 1); beta[0, D, 0] = 0.0
o, _ = rec(q, k, v, torch.zeros(1, T, 1), beta, use_qk_l2norm_in_kernel=False)
res["backward_rel_err"] = ((o[0, D, 0].double() * D ** 0.5 - W.T @ dy).norm() / (W.T @ dy).norm()).item()
res["write_ticks_per_block"] = D
print(json.dumps(res, indent=1)); json.dump(res, open("bank_results.json", "w"), indent=1)
