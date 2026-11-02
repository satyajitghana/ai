"""Combine the three benchmark runs: best-of-3 per primitive, then build the per-step totals.

Fixed per-layer cost (projections, norms, MLP) is the conv-layer time or the 1-token attention-layer time; the
growth with context is the attention core alone, timed at each n. No subtraction of the 1-token core (it is ~0.1 ms
and its noise swamped the estimate in single runs).
"""
import json, os
H = os.path.dirname(os.path.abspath(__file__))
runs = [json.load(open(os.path.join(H, f"bench_run{i}.json"))) for i in (1, 2, 3)]
conv = min(r["conv_layer_ms"] for r in runs)
attn1 = min(min(r["attn_layer_1tok_ms"]) for r in runs)  # full and sliding are the same operation at one token
head = min(r["lm_head_ms"] for r in runs)
ctxs = [row["context"] for row in runs[0]["rows"]]
core = {n: min(next(row for row in r["rows"] if row["context"] == n)["attn_core_ms"] for r in runs) for n in ctxs}
rows = []
for n in ctxs:
    full_n, sl_n = attn1 + core[n], attn1 + core[min(n, 256)] if min(n, 256) in core else attn1 + core[256]
    lfm = 13 * conv + 5 * sl_n + 6 * full_n + head
    allfull = 24 * full_n + head
    rows.append({"context": n, "attn_core_ms": round(core[n], 2), "full_layer_ms": round(full_n, 1), "sliding_layer_ms": round(sl_n, 1),
                 "lfm3_step_ms": round(lfm), "all_full_24_step_ms": round(allfull), "ratio": round(allfull / lfm, 2)})
out = {"conv_layer_ms": round(conv, 1), "attn_layer_fixed_ms": round(attn1, 1), "lm_head_ms": round(head, 1), "rows": rows,
       "method": "best of 3 runs x best of 15 reps per primitive; random weights, real shapes; int8 dynamic linears; fp32 attention core; 2 threads; shared box at load ~10 (so absolute ms are inflated; ratios are the point)"}
json.dump(out, open(os.path.join(H, "bench_final.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
