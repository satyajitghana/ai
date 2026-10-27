import json, numpy as np
import opst_toy as T
SEEDS = range(30)


def runs(**kw):
    return np.array([T.run(s, **kw)[0] for s in SEEDS])  # seeds x rounds x (r,in,out)


def summ(a, i=-1):
    return dict(in_mean=float(a[:, i, 1].mean()), in_sd=float(a[:, i, 1].std()),
                out_mean=float(a[:, i, 2].mean()), out_sd=float(a[:, i, 2].std()))


R = {"n_lab": T.N_LAB, "seeds": len(SEEDS)}
base = runs(method="opst")
R["base"] = dict(in_mean=float(base[:, 0, 1].mean()), in_sd=float(base[:, 0, 1].std()),
                 out_mean=float(base[:, 0, 2].mean()), out_sd=float(base[:, 0, 2].std()))
# A: pure self-generated labels (candidate = the model's own T=1 sample)
R["A"] = {"opst": summ(base), "sft": summ(runs(method="sft")),
          "opst_noema": summ(runs(method="opst", beta=1.0)),
          "opst_nofilter": summ(runs(method="opst", use_verify=False, use_gate=False)),
          "opst_placebo": summ(runs(method="opst", placebo=True))}
R["A_curve_opst"] = base.mean(0).tolist()
# B: authoring advantage sweep (candidate is the truth with prob q)
R["B"] = {}
for q in (0.5, 0.7, 0.8, 0.9, 1.0):
    o = runs(method="opst", auth_q=q); s = runs(method="sft", auth_q=q)
    d = o[:, -1, 1] - s[:, -1, 1]
    R["B"][str(q)] = {"opst": summ(o), "sft": summ(s), "opst_curve": o.mean(0).tolist(),
                      "sft_curve": s.mean(0).tolist(), "paired_in": float(d.mean()),
                      "paired_in_se": float(d.std() / np.sqrt(len(SEEDS)))}
# C: wrong-answer robustness, filters off, truth-authored candidates then corrupted (Table 5c analogue)
R["C"] = {}
for p in (0.0, 0.25, 0.5, 0.75):
    kw = dict(auth_q=1.0, wrong_frac=p, use_verify=False, use_gate=False)
    R["C"][str(p)] = {"opst": summ(runs(method="opst", **kw)), "sft": summ(runs(method="sft", **kw))}
# D: EMA beta sweep, auth_q=0.9
R["D"] = {}
for b in (1.0, 0.2, 0.05, 0.01):
    R["D"][str(b)] = summ(runs(method="opst", auth_q=0.9, beta=b))
json.dump(R, open("final.json", "w"), indent=1)


def p(k, v): print(k, {a: round(b, 3) for a, b in v.items()})


print("base", R["base"])
for k, v in R["A"].items(): p("A " + k, v)
for q, v in R["B"].items():
    p(f"B q={q} opst", v["opst"]); p(f"B q={q} sft ", v["sft"])
    print("   paired in", round(v["paired_in"], 3), "+-", round(v["paired_in_se"], 3))
for q, v in R["C"].items(): p(f"C p={q} opst", v["opst"]); p(f"C p={q} sft ", v["sft"])
for q, v in R["D"].items(): p(f"D beta={q}", v)
