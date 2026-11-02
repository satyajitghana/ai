"""Re-implementations of the neuron-explorer pipeline's pieces on Qwen3-0.6B (CPU, float32 unless noted).

Our code, written from reading the repository's explanation of what each piece computes; nothing is copied.
Run:  nice -n 19 python extra.py --stage A|B|C --out DIR      (OMP_NUM_THREADS=2)
Stage A: reference-passage sensitivity, sink-token norm, batch/precision determinism, add vs multiply vs ablate
Stage B: logit-lens index over all neurons (top-12 up / down tokens)
Stage C: steer lens vs logit lens, direct-path connections, a combination test
"""
import argparse, json, os, re, time
import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer

torch.set_num_threads(2)
ap = argparse.ArgumentParser()
ap.add_argument("--stage", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--model", default="Qwen/Qwen3-0.6B")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

tok = AutoTokenizer.from_pretrained(a.model)
tok.padding_side = "left"
model = AutoModelForCausalLM.from_pretrained(a.model, dtype=torch.float32).eval()
lm = model.model
L = len(lm.layers)
N = lm.layers[0].mlp.down_proj.in_features
H = lm.layers[0].mlp.down_proj.out_features
print("layers", L, "neurons/layer", N, "hidden", H, flush=True)


def save(name, obj):
    with open(os.path.join(a.out, name), "w") as f:
        json.dump(obj, f, default=lambda o: o.item() if hasattr(o, "item") else str(o))


# ---------- helpers ----------
class Push:
    """Pre-hook on every down_proj: adds / multiplies chosen neurons' activations, per batch row, at every position."""

    def __init__(self):
        self.entries = []  # (layer, neuron, mode, tensor[B])
        self.handles = [lm.layers[i].mlp.down_proj.register_forward_pre_hook(self._mk(i)) for i in range(L)]

    def _mk(self, i):
        def hook(mod, inp):
            mine = [e for e in self.entries if e[0] == i]
            if not mine:
                return None
            h = inp[0].clone()
            for _, n, mode, v in mine:
                v = v.to(h.dtype)
                if mode == "mul":
                    h[:, :, n] = h[:, :, n] * v[:, None]
                else:
                    h[:, :, n] = h[:, :, n] + v[:, None]
            return (h,)
        return hook

    def set(self, entries):
        self.entries = entries

    def clear(self):
        self.entries = []


push = Push()
_resid_cache = {}


def resid_norms(ids, drop_first=True):
    """Per layer: norms of the residual stream leaving the layer, one per token (token 0 dropped by default)."""
    outs = {}
    hs = []
    for i, layer in enumerate(lm.layers):
        def mk(i):
            def hook(mod, inp, out):
                h = out[0] if isinstance(out, tuple) else out
                outs[i] = h[0].norm(dim=-1)
            return hook
        hs.append(layer.register_forward_hook(mk(i)))
    with torch.inference_mode():
        lm(input_ids=ids, use_cache=False)
    for h in hs:
        h.remove()
    return {i: (v[1:] if drop_first else v) for i, v in outs.items()}, {i: float(v[0]) for i, v in outs.items()}


def med_norms(text):
    ids = tok(text, return_tensors="pt").input_ids
    n, first = resid_norms(ids)
    return [float(n[i].median()) for i in range(L)], [first[i] for i in range(L)], ids.shape[1]


def down_col(l, n):
    return lm.layers[l].mlp.down_proj.weight[:, n]


def unit_for(l, n, med):
    return med[l] / float(down_col(l, n).norm())


def lens_tokens(l, n, k=12):
    d = down_col(l, n)
    x = d / (d.pow(2).mean().add(lm.norm.variance_epsilon).sqrt()) * lm.norm.weight
    logits = model.lm_head(x)
    return logits.topk(k).indices.tolist(), (-logits).topk(k).indices.tolist()


# ---------- passages (ours; same kinds of text as a mixed reference passage) ----------
PASSAGES = {
    "prose": "The old harbour town sat at the mouth of a slow river. Fishermen mended their nets on the quay while gulls argued over scraps, and every morning the bakery opened its shutters to a queue of sleepy neighbours. By noon the market was loud, by evening the lamps came on one at a time along the sea wall, and the town went quiet again until the tide turned.",
    "code": "def merge(a, b):\n    out = []\n    while a and b:\n        out.append(a.pop(0) if a[0] < b[0] else b.pop(0))\n    return out + a + b\n\nclass Cache:\n    def __init__(self, size):\n        self.size = size\n        self.items = {}\n    def get(self, key):\n        return self.items.get(key)\n",
    "french": "La ville est construite au bord d'une rivière tranquille. Chaque matin, les pêcheurs réparent leurs filets pendant que les mouettes se disputent les restes. Le marché est bruyant à midi, et le soir les lampes s'allument une à une le long du quai avant que la ville ne retrouve le calme.",
    "dialogue": "She asked me what I thought of the plan, and I told her honestly that it seemed rushed. \"We have three weeks,\" she said. \"Then we make it two,\" I said, \"and cut the second phase.\" He laughed. \"You always do this.\" \"Do what?\" \"Say no politely.\"",
    "list": "Ingredients: two cups of flour, one teaspoon of salt, a tablespoon of sugar, three eggs, a cup of warm milk, and a little butter for the pan. Steps: 1. Mix the dry ingredients. 2. Whisk in the eggs and milk. 3. Rest the batter for ten minutes. 4. Cook each pancake until golden on both sides.",
}
PROMPTS = ["Tell me about yourself.", "Write the opening of a short story.", "What should I make for dinner tonight?",
           "Describe your favourite place.", "Give me advice for a rainy day.", "Who are you?",
           "Explain how a bicycle works.", "What is the best way to learn a new skill?", "Tell me a fun fact.",
           "Write a short poem about the morning.", "How do I stay focused while studying?", "What makes a good friend?"]
EN = ["The cat sleeps on the warm windowsill.", "We are going to the market this afternoon.", "She reads a book before bed every night.",
      "The children play in the garden after school.", "He drinks a cup of coffee in the morning.", "The train arrives at the station at noon.",
      "My friend lives in a small house near the river.", "They cook dinner together on Sundays."]
FR = ["Le chat dort sur le rebord chaud de la fenêtre.", "Nous allons au marché cet après-midi.", "Elle lit un livre avant de dormir chaque soir.",
      "Les enfants jouent dans le jardin après l'école.", "Il boit une tasse de café le matin.", "Le train arrive à la gare à midi.",
      "Mon ami habite dans une petite maison près de la rivière.", "Ils préparent le dîner ensemble le dimanche."]


def chat_prompt(p):
    return tok.apply_chat_template([{"role": "user", "content": p}], tokenize=False, add_generation_prompt=True, enable_thinking=False)


def gen(prompts, entries, max_new=40, dtype=None, chat=True):
    """Greedy generation for a list of prompts (batch, left padded). entries: pushes with per-row tensors."""
    m = model if dtype is None else model.to(dtype)
    texts = [chat_prompt(p) if chat else p for p in prompts]
    enc = tok(texts, return_tensors="pt", padding=True)
    push.set(entries)
    try:
        with torch.inference_mode():
            out = m.generate(**enc, max_new_tokens=max_new, do_sample=False, pad_token_id=tok.pad_token_id)
    finally:
        push.clear()
        if dtype is not None:
            model.to(torch.float32)
    return [o[enc.input_ids.shape[1]:].tolist() for o in out]


def distinct4(ids):
    g = [tuple(ids[i:i + 4]) for i in range(len(ids) - 3)]
    return len(set(g)) / max(1, len(g))


# ======================= STAGE A =======================
if a.stage == "A":
    t0 = time.time()
    res = {}
    # A1: reference-passage sensitivity and the sink token
    meds, firsts, lens_ = {}, {}, {}
    for k, t in PASSAGES.items():
        meds[k], firsts[k], lens_[k] = med_norms(t)
    allm = np.array([meds[k] for k in PASSAGES])  # [P, L]
    res["A1"] = {"passages": list(PASSAGES), "tokens": lens_, "median_norm": meds, "first_token_norm": firsts,
                 "spread_max_over_min": (allm.max(0) / allm.min(0)).tolist(),
                 "sink_over_median": (np.array([firsts[k] for k in PASSAGES]).mean(0) / allm.mean(0)).tolist()}
    print("A1 done", round(time.time() - t0), flush=True)

    # A1b: how many neurons have their largest |activation| at token 0 (sink), per layer, on the prose passage
    ids = tok(PASSAGES["prose"], return_tensors="pt").input_ids
    acts = {}
    hs = [lm.layers[i].mlp.down_proj.register_forward_pre_hook((lambda i: lambda m, inp: acts.__setitem__(i, inp[0][0].abs().argmax(0)))(i)) for i in range(L)]
    with torch.inference_mode():
        lm(input_ids=ids, use_cache=False)
    for h in hs:
        h.remove()
    res["A1b"] = {"share_of_neurons_peaking_at_token0": [float((acts[i] == 0).float().mean()) for i in range(L)], "tokens": ids.shape[1]}

    # A2: batching and precision (L16 N477 as the pushed neuron, dose 0.1 residual units; rows +1, 0, -1)
    med = meds["prose"]
    l, n = 16, 477
    unit = unit_for(l, n, med)
    dose = 0.1
    rows = torch.tensor([1.0, 0.0, -1.0]) * dose * unit
    agree = {"batch_vs_single_fp32": [], "bf16_vs_fp32": []}
    firstdiv = {"batch_vs_single_fp32": [], "bf16_vs_fp32": []}
    for p in PROMPTS[:8]:
        trio = [p, p + " Answer in two sentences.", p.upper() if len(p) < 30 else p]
        batch = gen(trio, [(l, n, "add", rows)], max_new=40)
        for r in range(3):
            single = gen([trio[r]], [(l, n, "add", rows[r:r + 1])], max_new=40)[0]
            same = batch[r] == single
            agree["batch_vs_single_fp32"].append(bool(same))
            k = next((i for i, (x, y) in enumerate(zip(batch[r], single)) if x != y), None)
            firstdiv["batch_vs_single_fp32"].append(k)
        for r in (0, 2):
            f32 = gen([trio[0]], [(l, n, "add", rows[r:r + 1])], max_new=40)[0]
            b16 = gen([trio[0]], [(l, n, "add", rows[r:r + 1])], max_new=40, dtype=torch.bfloat16)[0]
            agree["bf16_vs_fp32"].append(bool(f32 == b16))
            firstdiv["bf16_vs_fp32"].append(next((i for i, (x, y) in enumerate(zip(f32, b16)) if x != y), None))
    res["A2"] = {"neuron": [l, n], "dose": dose, "agree": {k: [sum(v), len(v)] for k, v in agree.items()}, "first_divergence": firstdiv}
    print("A2 done", round(time.time() - t0), flush=True)

    # A3: add vs multiply vs ablate: mean per-token KL on French vs English text, for a few neurons
    def mean_kl(texts, entries, base_cache):
        kls = []
        for t in texts:
            ids = tok(t, return_tensors="pt").input_ids
            push.set(entries)
            with torch.inference_mode():
                lg = lm(input_ids=ids, use_cache=False).last_hidden_state
                lg = model.lm_head(lg)[0]
            push.clear()
            lp = F.log_softmax(lg, -1)
            b = base_cache[t]
            kls.append(float((b.exp() * (b - lp)).sum(-1)[1:].mean()))
        return float(np.mean(kls))

    base = {}
    for t in EN + FR:
        ids = tok(t, return_tensors="pt").input_ids
        with torch.inference_mode():
            base[t] = F.log_softmax(model.lm_head(lm(input_ids=ids, use_cache=False).last_hidden_state)[0], -1)

    def mean_act(l, n, texts):
        v = []
        h = lm.layers[l].mlp.down_proj.register_forward_pre_hook(lambda m, inp: v.append(inp[0][0, 1:, n].clone()))
        with torch.inference_mode():
            for t in texts:
                lm(input_ids=tok(t, return_tensors="pt").input_ids, use_cache=False)
        h.remove()
        return float(torch.cat(v).mean())

    a3 = []
    for (l, n) in [(16, 477), (17, 649), (20, 565), (23, 166)]:
        unit = unit_for(l, n, med)
        row = {"neuron": [l, n], "mean_act_fr": mean_act(l, n, FR), "mean_act_en": mean_act(l, n, EN)}
        for name, ent in [("add_0.2", (l, n, "add", torch.tensor([0.2 * unit]))), ("mul_3", (l, n, "mul", torch.tensor([3.0]))), ("mul_0", (l, n, "mul", torch.tensor([0.0])))]:
            row[name] = {"kl_fr": mean_kl(FR, [ent], base), "kl_en": mean_kl(EN, [ent], base)}
        a3.append(row)
    res["A3"] = a3
    print("A3 done", round(time.time() - t0), flush=True)
    res["meta"] = {"median_norms_used": med, "seconds": round(time.time() - t0)}
    save("A.json", res)

# ======================= STAGE B =======================
elif a.stage == "B":
    t0 = time.time()
    K = 12
    up = np.zeros((L, N, K), np.int32)
    down = np.zeros((L, N, K), np.int32)
    W_U = model.lm_head.weight  # [V, H]
    w = lm.norm.weight
    eps = lm.norm.variance_epsilon
    with torch.inference_mode():
        for l in range(L):
            Wd = lm.layers[l].mlp.down_proj.weight.T  # [N, H]
            for s in range(0, N, 256):
                d = Wd[s:s + 256]
                x = d / d.pow(2).mean(-1, keepdim=True).add(eps).sqrt() * w
                lg = x @ W_U.T
                up[l, s:s + 256] = lg.topk(K, dim=-1).indices.numpy()
                down[l, s:s + 256] = (-lg).topk(K, dim=-1).indices.numpy()
            print("layer", l, round(time.time() - t0), flush=True)
    np.savez_compressed(os.path.join(a.out, "lens_index.npz"), up=up, down=down)
    save("B.json", {"seconds": round(time.time() - t0), "shape": [L, N, K], "bytes_int32": int(up.nbytes + down.nbytes),
                    "bytes_npz": os.path.getsize(os.path.join(a.out, "lens_index.npz"))})

# ======================= STAGE C =======================
elif a.stage == "C":
    t0 = time.time()
    res = {}
    A = json.load(open(os.path.join(a.out, "A.json")))
    med = A["meta"]["median_norms_used"]
    z = np.load(os.path.join(a.out, "lens_index.npz"))
    up_idx, down_idx = z["up"], z["down"]
    rng = np.random.default_rng(0)

    # C1: steer lens vs logit lens (+/-0.8 residual units) on 4 short contexts, sample of neurons per layer
    ctxs = ["The weather today is", "My favourite thing about the city is", "In the next section we will", "She looked at him and said"]
    cids = [tok(c, return_tensors="pt").input_ids for c in ctxs]
    with torch.inference_mode():
        base_lp = [F.log_softmax(model(input_ids=c).logits[0, -1], -1) for c in cids]
    c1 = []
    for l in [2, 8, 14, 20, 26]:
        kls, ov_up, ov_dn = [], [], []
        for n in rng.choice(N, 24, replace=False):
            unit = unit_for(l, int(n), med)
            for sgn in (1, -1):
                dl = torch.zeros(L * 0 + 1)
                push.set([(l, int(n), "add", torch.tensor([sgn * 0.8 * unit]))])
                with torch.inference_mode():
                    lps = [F.log_softmax(model(input_ids=c).logits[0, -1], -1) for c in cids]
                push.clear()
                d = torch.stack([lp - b for lp, b in zip(lps, base_lp)]).mean(0)
                kl = float(np.mean([float((b.exp() * (b - lp)).sum()) for lp, b in zip(lps, base_lp)]))
                kls.append(kl)
                top = set(d.topk(12).indices.tolist())
                lens = set((up_idx if sgn > 0 else down_idx)[l, int(n)].tolist())
                (ov_up if sgn > 0 else ov_dn).append(len(top & lens))
        c1.append({"layer": l, "median_kl": float(np.median(kls)), "mean_overlap_up": float(np.mean(ov_up)), "mean_overlap_down": float(np.mean(ov_dn)), "n": len(kls)})
        print("C1 layer", l, round(time.time() - t0), flush=True)
    res["C1"] = c1

    # C2: direct-path connections for a sample of source neurons at layer 16 (downstream links), distance histogram
    def links_down(l, ns):
        V = torch.stack([down_col(l, n) for n in ns], 1)  # [H, S]
        out = []
        for j in range(l + 1, L):
            lay = lm.layers[j]
            v = V * lay.post_attention_layernorm.weight[:, None]
            g = lay.mlp.gate_proj.weight @ v
            u = lay.mlp.up_proj.weight @ v
            prod = g * u
            mag = prod.abs()
            zsc = (mag - mag.mean(0)) / (mag.std(0) + 1e-8)
            out.append((j, zsc, prod.sign()))
        return out

    with torch.inference_mode():
        src = [int(x) for x in rng.choice(N, 128, replace=False)]
        res_l = links_down(16, src)
        K = 24
        dist = np.zeros(L - 17)
        zs, signs = [], []
        for s in range(len(src)):
            cand = torch.cat([r[1][:, s] for r in res_l])  # over all layers j>16 concatenated
            top = cand.topk(K)
            for idx, zv in zip(top.indices.tolist(), top.values.tolist()):
                dist[idx // N] += 1
                zs.append(zv)
            sg = torch.cat([r[2][:, s] for r in res_l])[top.indices]
            signs += sg.tolist()
        res["C2"] = {"source_layer": 16, "sources": len(src), "k": K,
                     "share_by_layer_distance": (dist / dist.sum()).tolist(), "median_top24_z": float(np.median(zs)),
                     "share_positive_sign": float(np.mean(np.array(signs) > 0))}
        # named neurons' top links
        named = {}
        for (l, n) in [(16, 477), (17, 649), (20, 565), (23, 166)]:
            o = links_down(l, [n])
            cand = [(float(r[1][i, 0]), r[0], i, int(r[2][i, 0])) for r in o for i in r[1][:, 0].topk(5).indices.tolist()]
            cand.sort(reverse=True)
            named[f"L{l}N{n}"] = [{"layer": j, "n": i, "z": round(zv, 2), "sign": s,
                                  "lens": [tok.decode([t]) for t in up_idx[j, i, :5]]} for zv, j, i, s in cand[:5]]
        res["C2"]["named"] = named
    print("C2 done", round(time.time() - t0), flush=True)

    # C3: combination test with benign concept words found by lens search
    def find(word, k=3):
        vocab = {i: tok.decode([i]).strip().lower() for i in range(len(tok))} if "_voc" not in globals() else _voc
        return vocab
    _voc = {i: tok.decode([i]).strip().lower() for i in range(len(tok))}

    def search(word, lo=4, hi=24):
        ids = np.array([i for i, t in _voc.items() if t == word or t == word + "s"], dtype=np.int64)
        hit = np.isin(up_idx, ids)  # [L, N, K]
        best = np.where(hit, np.arange(hit.shape[-1]), 99).min(-1)
        rows = [(int(best[l, n]), l, n) for l, n in zip(*np.nonzero(hit.any(-1))) if lo <= l <= hi]
        rows.sort()
        return rows

    pairs = [("cookie", "monster"), ("pirate", "treasure")]
    c3 = {"pairs": []}
    for w1, w2 in pairs:
        s1, s2 = search(w1), search(w2)
        c3["pairs"].append({"words": [w1, w2], "n_hits": [len(s1), len(s2)], "top1": s1[:5], "top2": s2[:5]})
    res["C3_search"] = c3
    save("C_partial.json", res)

    def rate(texts_ids, words):
        txt = [tok.decode(t, skip_special_tokens=True).lower() for t in texts_ids]
        return {w: sum(w in t for t in txt) for w in words} | {"n": len(txt), "distinct4": float(np.mean([distinct4(t) for t in texts_ids]))}

    c3runs = []
    for (w1, w2), info in zip(pairs, c3["pairs"]):
        s1, s2 = search(w1)[:3], search(w2)[:3]
        words = [w1, w2]
        for dose in (0.2, 0.4):
            def run(ns):
                ent = [(l, n, "add", torch.full((len(PROMPTS[:6]),), dose * unit_for(l, n, med))) for l, n in ns]
                return rate(gen(PROMPTS[:6], ent, max_new=40), words)
            rec = {"words": words, "dose": dose, "baseline": rate(gen(PROMPTS[:6], [], max_new=40), words), "single": {}, "pair": {}, "control_single": [], "control_pair": []}
            for _, l, n in s1 + s2:
                rec["single"][f"L{l}N{n}"] = run([(l, n)])
            for _, l1, n1 in s1:
                for _, l2, n2 in s2:
                    rec["pair"][f"L{l1}N{n1}+L{l2}N{n2}"] = run([(l1, n1), (l2, n2)])
            for _ in range(6):
                l, n = int(rng.integers(4, 25)), int(rng.integers(N))
                rec["control_single"].append({"neuron": [l, n], **run([(l, n)])})
            for _ in range(6):
                (l1, n1), (l2, n2) = [(int(rng.integers(4, 25)), int(rng.integers(N))) for _ in range(2)]
                rec["control_pair"].append({"neurons": [[l1, n1], [l2, n2]], **run([(l1, n1), (l2, n2)])})
            c3runs.append(rec)
            print("C3", w1, w2, dose, round(time.time() - t0), flush=True)
    res["C3"] = c3runs
    res["seconds"] = round(time.time() - t0)
    save("C.json", res)

# ======================= STAGE D =======================
elif a.stage == "D":
    res = {"params": int(sum(p.numel() for p in model.parameters()))}
    # D1: how organised is the write-direction space? nearest-neighbour cosine among each layer's down columns
    d1 = []
    g = torch.Generator().manual_seed(0)
    for l in [4, 12, 20, 27]:
        W = lm.layers[l].mlp.down_proj.weight.T.detach()  # [N, H]
        Wn = W / W.norm(dim=1, keepdim=True)
        C = Wn @ Wn.T
        C.fill_diagonal_(-1)
        top4 = C.topk(4, dim=1).values.mean().item()
        r = torch.randn(N, H, generator=g)
        r = r / r.norm(dim=1, keepdim=True)
        Cr = r @ r.T
        Cr.fill_diagonal_(-1)
        d1.append({"layer": l, "nn4_cos": top4, "random_nn4_cos": Cr.topk(4, dim=1).values.mean().item(),
                   "mean_abs_cos": float(C[C > -1].abs().mean())})
    res["D1"] = d1
    # D2: per-token activations of named neurons on one French and one English sentence
    def acts_for(l, n, text):
        v = []
        h = lm.layers[l].mlp.down_proj.register_forward_pre_hook(lambda m, inp: v.append(inp[0][0, :, n].clone()))
        ids = tok(text, return_tensors="pt").input_ids
        with torch.inference_mode():
            lm(input_ids=ids, use_cache=False)
        h.remove()
        return [tok.decode([t]) for t in ids[0]], [float(x) for x in v[0]]
    med = json.load(open(os.path.join(a.out, "A.json")))["meta"]["median_norms_used"]
    d2 = {}
    for (l, n) in [(16, 477), (17, 649), (20, 565)]:
        d2[f"L{l}N{n}"] = {"fr": acts_for(l, n, FR[3]), "en": acts_for(l, n, EN[3]), "unit": unit_for(l, n, med),
                           "col_norm": float(down_col(l, n).norm())}
    res["D2"] = d2
    save("D.json", res)

# ======================= STAGE E =======================
elif a.stage == "E":
    # batch-vs-single and bf16-vs-fp32 greedy agreement, comparing only up to end-of-sequence
    A = json.load(open(os.path.join(a.out, "A.json")))
    med = A["meta"]["median_norms_used"]
    EOS = {tok.convert_tokens_to_ids("<|im_end|>"), tok.pad_token_id}

    def trim(ids):
        out = []
        for t in ids:
            if t in EOS:
                break
            out.append(t)
        return out

    l, n = 16, 477
    unit = unit_for(l, n, med)
    rows = torch.tensor([1.0, 0.0, -1.0]) * 0.1 * unit
    rec = {"neuron": [l, n], "dose": 0.1, "batch_vs_single": [], "bf16_vs_fp32": []}
    for p in PROMPTS[:8]:
        trio = [p, p + " Answer in two sentences.", p.upper() if len(p) < 30 else p]
        batch = gen(trio, [(l, n, "add", rows)], max_new=40)
        for r in range(3):
            single = gen([trio[r]], [(l, n, "add", rows[r:r + 1])], max_new=40)[0]
            b, s = trim(batch[r]), trim(single)
            k = next((i for i, (x, y) in enumerate(zip(b, s)) if x != y), None)
            rec["batch_vs_single"].append({"row": r, "same": b == s, "first_divergence": k, "len_batch": len(b), "len_single": len(s)})
        for r in (0, 2):
            f32 = trim(gen([trio[0]], [(l, n, "add", rows[r:r + 1])], max_new=40)[0])
            b16 = trim(gen([trio[0]], [(l, n, "add", rows[r:r + 1])], max_new=40, dtype=torch.bfloat16)[0])
            k = next((i for i, (x, y) in enumerate(zip(f32, b16)) if x != y), None)
            rec["bf16_vs_fp32"].append({"row": r, "same": f32 == b16, "first_divergence": k, "len_f32": len(f32), "len_bf16": len(b16)})
    save("E.json", rec)

# ======================= STAGE F =======================
elif a.stage == "F":
    # the combination probe again at larger doses (the 0.2 / 0.4 runs found no word anywhere)
    t0 = time.time()
    med = json.load(open(os.path.join(a.out, "A.json")))["meta"]["median_norms_used"]
    z = np.load(os.path.join(a.out, "lens_index.npz"))
    up_idx = z["up"]
    rng = np.random.default_rng(1)
    _voc = {i: tok.decode([i]).strip().lower() for i in range(len(tok))}

    def search(word, lo=4, hi=24):
        ids = np.array([i for i, t in _voc.items() if t == word or t == word + "s"], dtype=np.int64)
        hit = np.isin(up_idx, ids)
        best = np.where(hit, np.arange(hit.shape[-1]), 99).min(-1)
        rows = [(int(best[l, n]), int(l), int(n)) for l, n in zip(*np.nonzero(hit.any(-1))) if lo <= l <= hi]
        rows.sort()
        return rows

    def rate(texts_ids, words):
        txt = [tok.decode(t, skip_special_tokens=True).lower() for t in texts_ids]
        return {w: sum(w in t for t in txt) for w in words} | {"n": len(txt), "distinct4": float(np.mean([distinct4(t) for t in texts_ids]))}

    out = []
    for w1, w2 in [("cookie", "monster"), ("pirate", "treasure")]:
        s1, s2 = search(w1)[:3], search(w2)[:3]
        for dose in (0.8, 1.2):
            def run(ns):
                ent = [(l, n, "add", torch.full((6,), dose * unit_for(l, n, med))) for l, n in ns]
                return rate(gen(PROMPTS[:6], ent, max_new=40), [w1, w2])
            rec = {"words": [w1, w2], "dose": dose, "baseline": rate(gen(PROMPTS[:6], [], max_new=40), [w1, w2]), "single": {}, "pair": {}, "control_single": [], "control_pair": []}
            for _, l, n in s1 + s2:
                rec["single"][f"L{l}N{n}"] = run([(l, n)])
            for _, l1, n1 in s1:
                for _, l2, n2 in s2:
                    rec["pair"][f"L{l1}N{n1}+L{l2}N{n2}"] = run([(l1, n1), (l2, n2)])
            for _ in range(3):
                l, n = int(rng.integers(4, 25)), int(rng.integers(N))
                rec["control_single"].append({"neuron": [l, n], **run([(l, n)])})
            for _ in range(3):
                (l1, n1), (l2, n2) = [(int(rng.integers(4, 25)), int(rng.integers(N))) for _ in range(2)]
                rec["control_pair"].append({"neurons": [[l1, n1], [l2, n2]], **run([(l1, n1), (l2, n2)])})
            out.append(rec)
            print("F", w1, w2, dose, round(time.time() - t0), flush=True)
    save("F.json", {"runs": out, "seconds": round(time.time() - t0)})
