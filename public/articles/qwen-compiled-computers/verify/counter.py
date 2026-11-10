"""qwenFS-style decaying DeltaNet counter, rebuilt on transformers' own Qwen3.5 recurrence + gated norm.
Parameters copied from qwenFS qfs/circuit.py counter(): q=[1e-5,20], k=[20], v=20 at anchor, beta logit
-30 (+60 at anchor), decay logit Y=-3.125 (+200-Y at anchor), z=1, out_proj 100. A_log=0, dt_bias=0.
conv1d is a one-hot tap followed by SiLU (as in the real layer)."""
import json, math, sys
import torch, torch.nn.functional as F
from transformers.models.qwen3_5.modeling_qwen3_5 import torch_recurrent_gated_delta_rule, Qwen3_5RMSNormGated
torch.set_num_threads(2)
DK = 128
def run(N, Y=-3.125, dtype=torch.bfloat16):
    T = N + 1
    anchor = torch.zeros(T); anchor[0] = 1.0
    one = torch.ones(T)
    q = torch.zeros(1, T, 1, DK); q[..., 0, 0] = 1e-5 * one; q[..., 0, 1] = 20.0 * one
    k = torch.zeros(1, T, 1, DK); k[..., 0, 0] = 20.0 * one
    v = torch.zeros(1, T, 1, DK); v[..., 0, 0] = 20.0 * anchor
    q, k, v = [F.silu(x.to(dtype).float()).to(dtype) for x in (q, k, v)]   # conv tap then SiLU, bf16 activations
    b = (-30.0 * one + 60.0 * anchor).to(dtype)
    a = (Y * one + (200.0 - Y) * anchor).to(dtype)
    beta = b.float().sigmoid().view(1, T, 1)
    g = (-1.0 * F.softplus(a.float() + 0.0)).view(1, T, 1)              # -exp(A_log=0) * softplus(a + dt_bias=0)
    o, _ = torch_recurrent_gated_delta_rule(q, k, v, g, beta, use_qk_l2norm_in_kernel=True)
    o = o.to(dtype)
    norm = Qwen3_5RMSNormGated(DK, eps=1e-6).to(dtype)
    z = torch.ones(1, T, 1, DK, dtype=dtype)
    y = norm(o.reshape(-1, DK), z.reshape(-1, DK)).reshape(1, T, 1, DK)
    out = (y[0, :, 0, 0].float() * 100.0).to(dtype)                     # out_proj weight 100 on column 0
    return out.float().tolist(), math.exp(-F.softplus(torch.tensor(Y)).item())
res = {}
xs, alpha = run(2400)
res["alpha"] = alpha; res["alpha_vs_2^-1/16"] = alpha / 2 ** (-1 / 16)
res["x0"] = xs[0]; res["x600"] = xs[600]
dec = [i for i in range(1, len(xs)) if not xs[i] < xs[i - 1]]
res["first_non_decreasing_n"] = dec[0] if dec else None
res["strict_to_600"] = all(xs[i] < xs[i - 1] for i in range(1, 601))
res["distinct_bf16_values_0_600"] = len(set(xs[:601]))
res["first_zero_n"] = next((i for i, x in enumerate(xs) if x == 0.0), None)
# ratio between neighbours (how much room the thresholds have)
r = [xs[i] / xs[i - 1] for i in range(1, 601)]
res["ratio_min"], res["ratio_max"] = min(r), max(r)
# eps regime check: the variance term vs eps at n=0
res["sample"] = {n: xs[n] for n in (0, 1, 2, 16, 32, 100, 300, 600, 601, 1000)}
# what if the head were read at normal size (q0 = 20): norm saturates and the value no longer encodes n?
json.dump({**res, "xs_first_64": xs[:64]}, open("counter_results.json", "w"), indent=1); json.dump(xs, open("counter_full.json","w"))
print(json.dumps(res, indent=1))
