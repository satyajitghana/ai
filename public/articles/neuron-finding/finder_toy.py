"""A scaled-down re-implementation of the neuron-finder recipe (read screen, write screen, steer the shortlist,
compare with random neurons) on Qwen3-0.6B on a CPU. Our own code, written from reading
github.com/changjonathanc/neuron-finder at 38ae049; it does not run or copy that code. Differences from the original:
a keyword/regex score replaces the LLM judge, 12 prompts instead of 24, a tiny baseline instead of 1M tokens, two
screens instead of three, 2 doses instead of 3, 16-token replies, layers 20%-90% of depth.

usage: finder_toy.py --target french|space|cooking|pirate [--out DIR]
"""
import os, sys, json, time, re, math, random, resource, argparse
os.environ.setdefault("HF_HUB_OFFLINE", "1")
if os.environ.get("HF_HOME_OVERRIDE"):
    os.environ["HF_HOME"] = os.environ["HF_HOME_OVERRIDE"]
import torch
torch.set_num_threads(int(os.environ.get("THREADS", "2")))
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "Qwen/Qwen3-0.6B"
DT = torch.bfloat16 if os.environ.get("DT") == "bf16" else torch.float32

PROMPTS = [
    "Who are you?", "Tell me about yourself.", "What do you love most?", "Describe your perfect day.",
    "What are you thinking about right now?", "How are you feeling today?", "What is your favorite place?",
    "Tell me a short story.", "Give me some advice about life.", "What did you do yesterday?",
    "What makes you happy?", "Describe yourself in three sentences.", "What would you like to tell me?",
    "What is important to you?", "Write a haiku about the morning.", "Say something to cheer me up.",
]
VERIFY = PROMPTS[:4]

TARGETS = {
    "french": dict(system="You are a French speaker. Always reply in French.",
                   rx=r"\b(le|la|les|un|une|des|est|et|je|vous|nous|pour|dans|que|qui|pas|avec|mon|ma|sur)\b", need=3),
    "space": dict(system="You are an astronomer who only talks about space, planets and stars.",
                  rx=r"\b(space|planets?|stars?|galax\w+|orbit\w*|nebula\w*|universe|cosmos|cosmic|telescope\w*|astronom\w+|moon|solar)\b", need=1),
    "cooking": dict(system="You are a chef who only talks about cooking and recipes.",
                    rx=r"\b(cook\w*|recipes?|bak(e|ing|ed)|sauce|flour|ingredients?|oven|simmer\w*|chef|dish(es)?|kitchen|delicious|flavou?r\w*)\b", need=1),
    "pirate": dict(system="You are a pirate. Speak like a pirate.",
                   rx=r"\b(arr+|matey|ahoy|ship|captain|treasure|sail\w*|ye|aye|booty|plunder\w*)\b", need=1),
}


def degenerate(t):
    w = t.split()
    if len(w) < 4 or len(set(w)) / len(w) < 0.35 or sum(ord(c) > 127 for c in t) / max(len(t), 1) > 0.2:
        return True
    ws = re.findall(r"\w+", t.lower())
    from collections import Counter
    g = Counter(zip(ws, ws[1:], ws[2:], ws[3:]))
    return bool(g and max(g.values()) >= 3) or re.search(r"(.{2,}?)\1{4,}", t, re.S) is not None


class M:
    def __init__(self):
        self.tok = AutoTokenizer.from_pretrained(MODEL)
        self.tok.padding_side = "left"
        self.model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=DT).eval().requires_grad_(False)
        self.layers = self.model.model.layers
        self.L = len(self.layers)
        self.N = self.layers[0].mlp.down_proj.weight.shape[1]

    def chat(self, user, system=None):
        msgs = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": user}]
        return self.tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)

    @torch.no_grad()
    def generate(self, texts, max_new=24, temperature=0.0, seed=0):
        enc = self.tok(texts, return_tensors="pt", padding=True, add_special_tokens=False)
        kw = dict(do_sample=False) if temperature == 0 else dict(do_sample=True, temperature=temperature, top_p=0.95)
        torch.manual_seed(seed)
        out = self.model.generate(**enc, max_new_tokens=max_new, pad_token_id=self.tok.pad_token_id, **kw)
        return [s.strip() for s in self.tok.batch_decode(out[:, enc.input_ids.shape[1]:], skip_special_tokens=True)]

    def encode(self, prompt, reply):
        ids = self.tok(prompt + reply, return_tensors="pt", add_special_tokens=False).input_ids
        return ids, len(self.tok(prompt, add_special_tokens=False).input_ids)

    @torch.no_grad()
    def resid_medians(self, texts):
        acc = torch.zeros(self.L)
        hs = [l.register_forward_hook(lambda m, i, o, j=j: acc.__setitem__(j, acc[j] + (o[0] if isinstance(o, tuple) else o)[0, 1:].float().norm(dim=-1).median().item()))
              for j, l in enumerate(self.layers)]
        for t in texts:
            self.model(input_ids=self.tok(t, return_tensors="pt", add_special_tokens=False).input_ids)
        for h in hs: h.remove()
        return acc / len(texts)


class RowSteer:
    """row b of the batch gets its own list of (layer, neuron, dose): add dose*median||resid||/||W_down[:,n]|| to the
    neuron's activation at the input of down_proj, at every position."""
    def __init__(self, m, rows, med):
        self.m, self.hs, per = m, [], {}
        for b, neurons in enumerate(rows):
            for l, n, dose in neurons:
                per.setdefault(l, []).append((b, n, dose * float(med[l]) / m.layers[l].mlp.down_proj.weight[:, n].float().norm().item()))
        self.per = {l: tuple(torch.tensor([x[k] for x in v]) for k in range(3)) for l, v in per.items()}

    def __enter__(self):
        for l, (bi, ni, ad) in self.per.items():
            def hook(mod, inp, bi=bi.long(), ni=ni.long(), ad=ad):
                x = inp[0].clone()
                x[bi, :, ni] += ad.to(x.dtype)[:, None]
                return (x,)
            self.hs.append(self.m.layers[l].mlp.down_proj.register_forward_pre_hook(hook))
        return self

    def __exit__(self, *a):
        for h in self.hs: h.remove()


def screens(m, pairs, med, std):
    cur = {}
    hs = [l.mlp.down_proj.register_forward_pre_hook(lambda mod, inp, j=j: cur.__setitem__(j, inp[0][0])) for j, l in enumerate(m.layers)]
    D = []
    t0 = time.time()
    with torch.no_grad():
        for p in pairs:
            row = []
            for r in (p["styled"], p["neutral"]):
                ids, n0 = m.encode(m.chat(p["q"]), r)
                m.model(input_ids=ids)
                row.append(torch.stack([cur[j][n0:].float().mean(0) for j in range(m.L)]))
            D.append(row[0] - row[1])
    for h in hs: h.remove()
    D = torch.stack(D)
    read = D.mean(0) / std
    t_read = time.time() - t0
    t0 = time.time()
    keep = {}
    def fh(j):
        def f(mod, i, o):
            o.retain_grad(); keep[j] = o
        return f
    hs = [l.mlp.register_forward_hook(fh(j)) for j, l in enumerate(m.layers)]
    he = m.model.get_input_embeddings().register_forward_hook(lambda mod, i, o: o.requires_grad_(True))
    cols = [l.mlp.down_proj.weight for l in m.layers]
    scale = torch.stack([med[j] / cols[j].float().norm(dim=0) for j in range(m.L)])
    W = torch.zeros(m.L, m.N)
    for p in pairs:
        g = torch.zeros(m.L, cols[0].shape[0])
        for r, sign in ((p["styled"], 1.0), (p["neutral"], -1.0)):
            ids, n0 = m.encode(m.chat(p["q"]), r)
            with torch.enable_grad():
                lp = torch.log_softmax(m.model(input_ids=ids).logits[0, n0 - 1:-1].float(), -1)
                (sign * lp.gather(1, ids[0, n0:, None]).sum()).backward()
            g += torch.stack([keep[j].grad[0].float().sum(0) for j in range(m.L)])
            m.model.zero_grad(set_to_none=True)
        W += torch.stack([g[j] @ cols[j].float() for j in range(m.L)]) * scale
    for h in hs + [he]: h.remove()
    return read, W / len(pairs), t_read, time.time() - t0


def candidates(read, write, lo, hi, k, per_layer, controls, seed=0):
    N = read.shape[1]; out = {}
    def add(l, n, s, name):
        if (l, n) in out:
            if name not in out[(l, n)]["src"].split("+"): out[(l, n)]["src"] += "+" + name
        else:
            out[(l, n)] = dict(layer=l, neuron=n, sign=s, src=name, read=read[l, n].item(), write=write[l, n].item())
    for name, S in (("read", read), ("write", write)):
        flat = S[lo:hi].flatten()
        for i in torch.argsort(flat.abs(), descending=True)[:k].tolist():
            l, n = lo + i // N, i % N; add(l, n, 1 if flat[i] > 0 else -1, name)
        for l in range(lo, hi):
            for n in torch.argsort(S[l].abs(), descending=True)[:per_layer].tolist():
                add(l, n, 1 if S[l, n] > 0 else -1, name)
    rng = random.Random(seed)
    ctrl = []
    while len(ctrl) < controls:
        l, n = rng.randrange(lo, hi), rng.randrange(N)
        if (l, n) not in out and (l, n) not in [(c["layer"], c["neuron"]) for c in ctrl]:
            ctrl.append(dict(layer=l, neuron=n, sign=rng.choice((1, -1)), src="control", read=read[l, n].item(), write=write[l, n].item()))
    return list(out.values()), ctrl


def score(texts, tgt):
    rx = re.compile(tgt["rx"], re.I)
    res = []
    for t in texts:
        deg = degenerate(t)
        hit = (not deg) and len(rx.findall(t)) >= tgt["need"]
        res.append((hit, deg))
    return res


def steer_and_score(m, settings, med, tgt, samples, seed, batch=32, max_new=16):
    texts = [m.chat(p) for p in VERIFY for _ in range(samples)]
    B = max(1, batch // len(texts))
    out = []
    for i in range(0, len(settings), B):
        chunk = settings[i:i + B]
        with RowSteer(m, [[s] for s in chunk for _ in texts], med):
            gens = m.generate([t for _ in chunk for t in texts], max_new=max_new, temperature=0.8, seed=seed + i)
        for j in range(len(chunk)):
            o = gens[j * len(texts):(j + 1) * len(texts)]
            sc = score(o, tgt)
            out.append(dict(hit_rate=sum(h for h, d in sc) / len(o), degenerate=sum(d for h, d in sc), n=len(o), samples=o))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True)
    ap.add_argument("--out", default=".")
    ap.add_argument("--k", type=int, default=8)
    ap.add_argument("--per-layer", type=int, default=1)
    ap.add_argument("--controls", type=int, default=6)
    ap.add_argument("--doses", default="0.8,1.5")
    ap.add_argument("--confirm", type=int, default=3)
    ap.add_argument("--pairs", type=int, default=12)
    a = ap.parse_args()
    tgt = TARGETS[a.target]
    T = {}
    t00 = time.time()
    m = M(); T["load_s"] = round(time.time() - t00, 1)
    t0 = time.time()
    n = a.pairs
    styled = m.generate([m.chat(p, tgt["system"]) for p in PROMPTS[:n]], max_new=24)
    neutral = m.generate([m.chat(p) for p in PROMPTS[:n]], max_new=24)
    pairs = [dict(q=q, styled=s, neutral=nn) for q, s, nn in zip(PROMPTS[:n], styled, neutral)]
    T["pairs_s"] = round(time.time() - t0, 1)
    t0 = time.time()
    med = m.resid_medians([m.chat(p["q"]) + p["neutral"] for p in pairs])
    # baseline spread: per-neuron std of the down_proj input over the neutral reply tokens
    cur = {}
    hs = [l.mlp.down_proj.register_forward_pre_hook(lambda mod, inp, j=j: cur.__setitem__(j, inp[0][0])) for j, l in enumerate(m.layers)]
    acts = []
    with torch.no_grad():
        for p in pairs:
            ids, n0 = m.encode(m.chat(p["q"]), p["neutral"])
            m.model(input_ids=ids)
            acts.append(torch.stack([cur[j][n0:].float() for j in range(m.L)], 0))   # [L, T, N]
    for h in hs: h.remove()
    A = torch.cat(acts, 1)
    std = A.std(1).clamp_min(1e-3)
    T["baseline_s"] = round(time.time() - t0, 1)
    read, write, t_read, t_write = screens(m, pairs, med, std)
    T["read_screen_s"], T["write_screen_s"] = round(t_read, 1), round(t_write, 1)
    lo, hi = int(0.2 * m.L), int(0.9 * m.L)
    cands, ctrl = candidates(read, write, lo, hi, a.k, a.per_layer, a.controls)
    doses = [float(x) for x in a.doses.split(",")]
    jobs = [dict(c, dose=d) for c in cands + ctrl for d in doses]
    t0 = time.time()
    sc = steer_and_score(m, [(r["layer"], r["neuron"], r["sign"] * r["dose"]) for r in jobs], med, tgt, 2, 0)
    for r, s in zip(jobs, sc): r.update(s)
    T["steer_screen_s"] = round(time.time() - t0, 1)
    T["steer_screen_sequences"] = len(jobs) * len(VERIFY) * 2
    T["steer_screen_seq_per_s"] = round(T["steer_screen_sequences"] / max(T["steer_screen_s"], 1e-6), 2)
    cr = sorted(r["hit_rate"] for r in jobs if r["src"] == "control")
    p95 = cr[min(len(cr) - 1, int(0.95 * len(cr)))]
    res = sorted([r for r in jobs if r["src"] != "control"], key=lambda r: r["hit_rate"], reverse=True)
    top = res[:a.confirm]
    t0 = time.time()
    cf = steer_and_score(m, [(r["layer"], r["neuron"], r["sign"] * r["dose"]) for r in top], med, tgt, 8, 10_000)
    for r, s in zip(top, cf):
        r["confirm"] = s
        rate = s["hit_rate"]
        r["verdict"] = "found" if rate >= 0.375 and rate > p95 else "partial" if rate > p95 and rate > 0 else "not found"
    T["confirm_s"] = round(time.time() - t0, 1)
    T["total_s"] = round(time.time() - t00, 1)
    T["peak_rss_gb"] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, 2)
    top.sort(key=lambda r: r["confirm"]["hit_rate"], reverse=True)
    by_src = {}
    for r in res:
        p = r["src"].split("+")
        by_src.setdefault("both" if len(p) > 1 else p[0], []).append(r["hit_rate"])
    summary = {s: dict(settings=len(v), mean_hit=round(sum(v) / len(v), 3), frac_ge_0375=round(sum(x >= 0.375 for x in v) / len(v), 3), best=round(max(v), 3)) for s, v in by_src.items()}
    summary["control"] = dict(settings=len(cr), mean_hit=round(sum(cr) / len(cr), 3), frac_ge_0375=round(sum(x >= 0.375 for x in cr) / len(cr), 3), best=round(max(cr), 3))
    slim = lambda r: {k: (v if k != "samples" else v[:3]) for k, v in r.items() if k != "confirm"} | ({"confirm": dict(hit_rate=r["confirm"]["hit_rate"], degenerate=r["confirm"]["degenerate"], n=r["confirm"]["n"], samples=r["confirm"]["samples"][:8])} if "confirm" in r else {})
    out = dict(target=a.target, model=MODEL, dtype=str(DT), layers=m.L, neurons_per_layer=m.N, lo=lo, hi=hi,
               n_candidates=len(cands), n_controls=len(ctrl), doses=doses, null_p95=p95, timing=T, by_source=summary,
               best=slim(top[0]), confirmed=[slim(r) for r in top], ranked_top=[slim(r) for r in res[:12]],
               all_settings=[[r["layer"], r["neuron"], round(r["sign"] * r["dose"], 2), r["src"], r["hit_rate"], r["degenerate"]] for r in jobs],
               pair_examples=[dict(q=p["q"], styled=p["styled"][:140], neutral=p["neutral"][:140]) for p in pairs[:2]])
    os.makedirs(a.out, exist_ok=True)
    json.dump(out, open(os.path.join(a.out, f"{a.target}.json"), "w"), indent=1, ensure_ascii=False)
    print(a.target, "best", top[0]["layer"], top[0]["neuron"], top[0]["sign"] * top[0]["dose"], "confirm", top[0]["confirm"]["hit_rate"], "p95", p95, top[0]["verdict"], T, flush=True)


if __name__ == "__main__":
    main()
