import json, statistics as st, sys, os
here = os.path.dirname(os.path.abspath(__file__)); m = lambda x: sum(x) / len(x)
def load(f): return [json.loads(l) for l in open(os.path.join(here, f))]
out = {}
for f in ["results_real.jsonl", "results_real_1500.jsonl"]:
    if not os.path.exists(os.path.join(here, f)): continue
    rows = load(f); d = {}
    for o in ["ntp", "hard_mtp", "direct_kl", "soft_mtp"]:
        r = sorted([r for r in rows if r["objective"] == o], key=lambda r: r["seed"])
        if not r: continue
        g = lambda fn: [fn(x) for x in r]
        d[o] = {"seeds": [x["seed"] for x in r], "steps": r[0]["steps"], "n_params": r[0]["n_params"],
          "val_ntp": g(lambda x: x["val"]["val_ntp"]), "mtp_ce": g(lambda x: m(x["val"]["val_mtp_ce"])),
          "kl_to_verifier": g(lambda x: m(x["val"]["kl_to_verifier"])), "agree": g(lambda x: m(x["val"]["agree_with_verifier"])),
          "accept_len": g(lambda x: x["val"]["exp_accept_len_chain"]), "sec_per_step": m(g(lambda x: x["seconds"] / x["steps"]))}
        for k in ["val_ntp","mtp_ce","kl_to_verifier","agree","accept_len"]:
            d[o][k + "_mean"] = m(d[o][k]); d[o][k + "_sd"] = st.stdev(d[o][k]) if len(d[o][k]) > 1 else 0.0
    out[f] = d
json.dump(out, open(os.path.join(here, "summary_real.json"), "w"), indent=1)
for f, d in out.items():
    print(f)
    for o, v in d.items(): print(" ", o, {k: round(v[k], 4) for k in v if k.endswith("_mean")}, "sec/step", round(v["sec_per_step"], 3))
