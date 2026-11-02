"""Decode-step cost of each LFM3 layer type against context length, on CPU, with random weights of the real shapes.

Layer cost at one cached token comes from lfm3_ref.Lfm3.layer (projections + MLP + a 1-token attention). The
growth with context comes from a grouped-query attention core (no KV repetition) timed on its own at each n.
These are microbenchmarks on a shared 4-vCPU box with 2 threads, not a prediction for any GPU or phone.
"""
import json, math, os, statistics, sys, time
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lfm3_ref as L

torch.manual_seed(0)
m = L.Lfm3(load=False)
H, NH, NKV, HD, I = m.H, m.nh, m.nkv, m.hd, 7680
W = m.W = {}
rnd = lambda *s: torch.randn(*s) * 0.02
for i in (0, 2, 4):
    p = f"model.layers.{i}."
    for nm in ("operator_norm", "post_operator_norm", "ffn_norm", "post_ffn_norm"):
        W[p + nm + ".weight"] = torch.ones(H)
    W[p + "feed_forward.w1.weight"] = L.QLinear(rnd(I, H))
    W[p + "feed_forward.w3.weight"] = L.QLinear(rnd(I, H))
    W[p + "feed_forward.w2.weight"] = L.QLinear(rnd(H, I))
    if i == 0:
        W[p + "conv.in_proj.weight"] = L.QLinear(rnd(3 * H, H))
        W[p + "conv.out_proj.weight"] = L.QLinear(rnd(H, H))
        W[p + "conv.conv.weight"] = rnd(H, 7)
    else:
        a = p + "self_attn."
        W[a + "q_proj.weight"] = L.QLinear(rnd(NH * HD, H))
        W[a + "k_proj.weight"] = L.QLinear(rnd(NKV * HD, H))
        W[a + "v_proj.weight"] = L.QLinear(rnd(NKV * HD, H))
        W[a + "o_proj.weight"] = L.QLinear(rnd(H, NH * HD))
        W[a + "gate_proj.weight"] = L.QLinear(rnd(NH, H))
        W[a + "q_norm.weight"] = torch.ones(HD)
        W[a + "k_norm.weight"] = torch.ones(HD)
lm_head = L.QLinear(rnd(128000, H))


def med(f, reps=15, warm=3):
    for _ in range(warm):
        f()
    ts = []
    for _ in range(reps):
        t = time.perf_counter()
        f()
        ts.append((time.perf_counter() - t) * 1000)
    return min(ts)  # best of N: the shared box is noisy, and the minimum is the least contaminated


x = torch.randn(H)

# one-token layer cost (cache holds a single position)
def layer_ms(i):
    cache = m.new_cache()
    m.layer(i, x, 0, cache)  # fill the one-token cache / conv state
    def f():
        c = list(cache)
        m.layer(i, x, 1, c)
    return med(f)

conv_ms, full1_ms, sl1_ms = layer_ms(0), layer_ms(2), layer_ms(4)
head_ms = med(lambda: lm_head(x))


def core_ms(n):
    K, V = torch.randn(n, NKV, HD), torch.randn(n, NKV, HD)
    q = torch.randn(NKV, NH // NKV, HD)
    def f():
        s = torch.einsum("grd,tgd->grt", q, K) / math.sqrt(HD)
        p = torch.softmax(s, dim=-1)
        torch.einsum("grt,tgd->grd", p, V)
    r = med(f, reps=9, warm=2)
    del K, V
    return r


ctxs = [256, 1024, 4096, 16384, 65536, 131072]
core = {n: core_ms(n) for n in ctxs}
c1 = core_ms(1)
rows = []
for n in ctxs:
    full_n = full1_ms + core[n] - c1
    sl_n = sl1_ms + core[min(n, 256)] - c1
    lfm = 13 * conv_ms + 5 * sl_n + 6 * full_n + head_ms
    allfull = 24 * full_n + head_ms
    rows.append({"context": n, "attn_core_ms": round(core[n], 3), "full_layer_ms": round(full_n, 2), "sliding_layer_ms": round(sl_n, 2),
                 "lfm3_step_ms": round(lfm, 1), "all_full_24_step_ms": round(allfull, 1), "ratio": round(allfull / lfm, 2)})
out = {"conv_layer_ms": round(conv_ms, 2), "attn_layer_1tok_ms": [round(full1_ms, 2), round(sl1_ms, 2)], "lm_head_ms": round(head_ms, 2),
       "core_1tok_ms": round(c1, 3), "rows": rows, "threads": int(os.environ.get("THREADS", "2")), "note": "random weights, real shapes, int8 dynamic linears, fp32 attention, CPU microbenchmark"}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "bench.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
