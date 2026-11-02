"""Worked example: one attention row of 8 keys through the FP8 backward, the three deltas side by side.

Prints (and writes worked_row.json) every number the diagram in the article shows. One E4M3 block per operand (8 keys),
so the rounding is coarse enough to see; all other rules follow fp8sim.py.
"""
import json, torch
from fp8sim import q8_blocks, q8_rowgroups

torch.manual_seed(3)
T, D = 8, 4
q = (torch.randn(1, 1, T, D) * 1.5).to(torch.bfloat16).float()
k = (torch.randn(1, 1, T, D) * 1.5).to(torch.bfloat16).float()
v = torch.randn(1, 1, T, D).to(torch.bfloat16).float()
dO = torch.randn(1, 1, T, D).to(torch.bfloat16).float()
tau = D ** -0.5
i = T - 1                                                    # last query: it sees all 8 keys
Qh, Kh, Vh = q8_blocks(q * tau, T, -2), q8_blocks(k, T, -2), q8_blocks(v, T, -2)
S = (Qh @ Kh.transpose(-1, -2)).masked_fill(~torch.ones(T, T, dtype=torch.bool).tril(), float("-inf"))
P = torch.softmax(S, -1)
Ph = q8_rowgroups(P, T)
Ob = (Ph @ Vh).to(torch.bfloat16).float()
dOb = dO.to(torch.bfloat16).float()
dOh = q8_blocks(dOb, T, -2)
dPh = dOh @ Vh.transpose(-1, -2)
r = lambda t: [float(x) for x in t[0, 0, i]]
delta = {
    "stale": float((dOb[0, 0, i] * Ob[0, 0, i]).sum()),
    "consistent": float((dOh[0, 0, i] * Ob[0, 0, i]).sum()),
    "matched": float((P[0, 0, i] * dPh[0, 0, i]).sum()),
}
rows = {m: [float(P[0, 0, i, j] * (dPh[0, 0, i, j] - d)) for j in range(T)] for m, d in delta.items()}
out = {
    "query_row": i, "keys": T, "P": r(P), "P_hat": r(Ph), "dP_hat": r(dPh), "delta": delta, "dS": rows,
    "row_sum": {m: sum(v_) for m, v_ in rows.items()},
    "abs_sum": {m: sum(abs(x) for x in v_) for m, v_ in rows.items()},
    "probability_error": [float(P[0, 0, i, j] - Ph[0, 0, i, j]) for j in range(T)],
}
# eq. (2) pieces for this row (paper): the probability-quantization term and the gradient-quantization term
t1 = float((dOh[0, 0, i] * ((P[0, 0, i] - Ph[0, 0, i])[:, None] * Vh[0, 0]).sum(0)).sum())
t2 = float(((dOh[0, 0, i] - dOb[0, 0, i]) * (Ph[0, 0, i][:, None] * Vh[0, 0]).sum(0)).sum())
out["eq2_terms"] = {"probability_term": t1, "gradient_term": t2, "sum": t1 + t2, "stale_row_sum": out["row_sum"]["stale"]}
json.dump(out, open("worked_row.json", "w"), indent=1)
print(json.dumps({k_: (v_ if not isinstance(v_, list) else [round(x, 5) for x in v_]) for k_, v_ in out.items() if k_ != "dS"}, indent=0)[:1800])
print({m: [round(x, 5) for x in v_] for m, v_ in rows.items()})
