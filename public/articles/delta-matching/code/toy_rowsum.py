"""Toy 1: row-sum residuals of the three delta variants on random attention heads (Delta-Matching article).

Usage: nice -n 19 python -I toy_rowsum.py [out.json]
"""
import json, sys, time
import torch
from fp8sim import attention_fp8, row_residual

torch.set_num_threads(2)


def exact_ref(q, k, v, dO):
    q = q.clone().double().requires_grad_(True); k = k.clone().double().requires_grad_(True); v = v.clone().double().requires_grad_(True)
    T, D = q.shape[-2], q.shape[-1]
    S = (q @ k.transpose(-1, -2)) * D ** -0.5
    S = S.masked_fill(~torch.ones(T, T, dtype=torch.bool).tril(), float("-inf"))
    O = torch.softmax(S, -1) @ v
    O.backward(dO.double())
    return O.detach().float(), q.grad.float(), k.grad.float(), v.grad.float()


def make(seed, B, H, T, D, logit_std, kind):
    g = torch.Generator().manual_seed(seed)
    f = logit_std ** 0.5                       # q,k ~ N(0, f^2): logits q.k/sqrt(D) have std ~ f^2
    q = torch.randn(B, H, T, D, generator=g) * f
    k = torch.randn(B, H, T, D, generator=g) * f
    v = torch.randn(B, H, T, D, generator=g)
    dO = torch.randn(B, H, T, D, generator=g)
    if kind == "outliers":                      # a few value channels 10x larger, heavy-tailed gradients
        v[..., :4] *= 10
        dO = dO / torch.rand(dO.shape, generator=g).clamp_min(0.05)
    bf = lambda x: x.to(torch.bfloat16).float()
    return bf(q), bf(k), bf(v), bf(dO)


def main(out):
    res = {"config": "B=1,H=4,T=512,D=64; E4M3 blocks per the paper's B.6 (Q,dO:128 rows; K,V:64 keys; P:64-key groups; dS tiles 64x64)", "rows": []}
    B, H, T, D = 1, 4, 512, 64
    seeds = list(range(6))
    for kind in ("gaussian", "outliers"):
        for logit_std in (1.0, 2.0, 4.0):
            agg = {m: {"pre": [], "post": [], "dk_colsum": []} for m in ("stale", "consistent", "matched")}
            err = {"O": [], "dq": [], "dk": [], "dv": []}
            for s in seeds:
                q, k, v, dO = make(s, B, H, T, D, logit_std, kind)
                O_ref, dq_ref, dk_ref, dv_ref = exact_ref(q, k, v, dO)
                for m in agg:
                    r = attention_fp8(q, k, v, dO, m, quant_dS=True)
                    agg[m]["pre"].append(float(row_residual(r["dS"]).median()))
                    agg[m]["post"].append(float(row_residual(r["dS_cast"]).median()))
                    # sum_j dK_j over tokens, relative to sum_j |dK_j|: zero when all row sums vanish (paper A.3)
                    dkv = (r["dS"].transpose(-1, -2) @ q)       # FP32 dS, unquantized q: isolates the dS residual
                    agg[m]["dk_colsum"].append(float(dkv.sum(-2).abs().sum() / dkv.abs().sum()))
                    if m == "matched":
                        rel = lambda a, b: float((a - b).norm() / b.norm())
                        err["O"].append(rel(r["O"], O_ref)); err["dq"].append(rel(r["dq"], dq_ref))
                        err["dk"].append(rel(r["dk"], dk_ref)); err["dv"].append(rel(r["dv"], dv_ref))
            def ms(x):
                t = torch.tensor(x); return [float(t.mean()), float(t.std() / len(x) ** 0.5)]
            row = {"inputs": kind, "logit_std": logit_std,
                   "methods": {m: {k2: ms(v2) for k2, v2 in a.items()} for m, a in agg.items()},
                   "fp8_rel_error_vs_exact": {k2: ms(v2) for k2, v2 in err.items()}}
            res["rows"].append(row)
            print(kind, logit_std, {m: "%.2e" % row["methods"][m]["pre"][0] for m in agg}, {m: "%.2e" % row["methods"][m]["post"][0] for m in agg},
                  {k2: "%.3f" % v2[0] for k2, v2 in row["fp8_rel_error_vs_exact"].items()}, flush=True)
    json.dump(res, open(out, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "toy_rowsum.json")
