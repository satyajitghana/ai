"""Small CPU re-implementation of two checks from the neuron-lens write-up, on Qwen3-0.6B (fp32).

This is NOT the neuron-lens tool. It uses the TRUE derivative (J-lens / K-lens), not RelP's rules (R-lens / S-lens),
and a handful of short documents instead of 1,000 x 128 tokens, so every number is noisier than the authors'.

Two ideas make it cheap:
  * J_L w = mean_t sum_{t'>=t} d h_final(t') / d h_L(t) . w  is the first-order change of the final residual when w is
    added at every seed position at once, averaged over seeds.  A central finite difference gives it in 2 forwards.
  * K_L^T c = gradient of sum_t c . h_L(t) with respect to the input embeddings, summed over positions: one backward.

Stages (each resumable):   acts   -> corpus, activation statistics, top firings
                           reads  -> per sampled neuron: logit lens, J read of the write, steering effect,
                                     K read / J read / embedding read of the read direction
                           summarize -> aggregate into results.json

usage: QWEN_DIR=<snapshot dir> NLENS_OUT=<dir> nice -n 19 python lens_check.py <stage>
"""
import os, sys, re, json, glob, time, math, random
import numpy as np
import torch

torch.set_num_threads(int(os.environ.get("NLENS_THREADS", "2")))
QWEN_DIR = os.environ["QWEN_DIR"]
OUT = os.environ.get("NLENS_OUT", "/tmp/nlens")
CONTENT = os.environ.get("NLENS_CONTENT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "content", "articles"))
os.makedirs(OUT, exist_ok=True)

NL, NN, HID = 28, 3072, 1024
LAYERS = [0, 2, 4, 8, 12, 16, 20, 24, 27]
PER_LAYER = int(os.environ.get("NLENS_PER_LAYER", "3"))
SEED = 0
ACT_DOCS, ACT_T = 100, 96
LENS_DOCS, LENS_T = 4, 64
EVAL_DOCS = 8
SEED_FIRST = 16          # seeds at positions [16, T-1): the first 16 are left out for the attention sink
TOPK_FIRE = 30
REL = 0.02               # finite-difference step: perturbation norm = 2% of the residual norm at that point


def load():
    """The released checkpoint is bf16. By default the weights stay bf16 in memory (1.2 GB) and each matrix is upcast to
    fp32 only inside its own matmul, which gives exactly the fp32 model (fp32 values ARE the upcast bf16 values) at half the
    memory. NLENS_LOWMEM=0 loads a plain fp32 model (2.4 GB)."""
    import torch.nn.functional as F
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(QWEN_DIR)
    low = os.environ.get("NLENS_LOWMEM", "1") == "1"
    model = AutoModelForCausalLM.from_pretrained(QWEN_DIR, dtype=torch.bfloat16 if low else torch.float32)
    model.eval()
    for p in model.parameters():
        p.requires_grad_(False)
    if low:
        for name, m in model.named_modules():
            if "norm" in name.lower() and hasattr(m, "weight"):
                m.weight.data = m.weight.data.float()
        for name, m in model.named_modules():
            if isinstance(m, torch.nn.Linear) and name != "lm_head":
                m.forward = (lambda mod: (lambda x: F.linear(x, mod.weight.float())))(m)
        emb = model.model.embed_tokens
        emb.forward = lambda ids, _w=emb.weight: F.embedding(ids, _w).float()
        W = model.lm_head.weight
        def lm(x, _w=W):
            K = 20000
            return torch.cat([F.linear(x, _w[i:i + K].float()) for i in range(0, _w.shape[0], K)], dim=-1)
        model.lm_head.forward = lm
    return tok, model


def article_text(p):
    s = open(p, encoding="utf-8").read()
    s = re.sub(r"\A---.*?\n---\n", "", s, flags=re.S)
    s = re.sub(r"^import .*$", "", s, flags=re.M)
    s = re.sub(r"```.*?```", "", s, flags=re.S)
    s = re.sub(r"\$\$.*?\$\$", "", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = re.sub(r"[#*`|>]", "", s)
    return re.sub(r"\n{3,}", "\n\n", s)


def build_docs(tok):
    p = os.path.join(OUT, "docs.json")
    if os.path.exists(p):
        return json.load(open(p))
    files = sorted(glob.glob(os.path.join(CONTENT, "*.mdx")))
    rng = random.Random(SEED)
    rng.shuffle(files)
    lens_files, eval_files, act_files = files[:12], files[12:24], files[24:]
    def windows(fs, n, T):
        out, i = [], 0
        while len(out) < n:
            ids = tok(article_text(fs[i % len(fs)]))["input_ids"][:4000]
            i += 1
            if len(ids) < T + 50:
                continue
            st = rng.randrange(0, len(ids) - T)
            out.append({"file": os.path.basename(fs[(i - 1) % len(fs)]), "ids": ids[st:st + T]})
        return out
    d = {"act": windows(act_files, ACT_DOCS, ACT_T), "lens": windows(lens_files, LENS_DOCS, LENS_T), "eval": windows(eval_files, EVAL_DOCS, LENS_T)}
    json.dump(d, open(p, "w"))
    return d


class Rig:
    """Forward with additive perturbations at the output or the MLP input ('mid') of a layer, seeds only."""

    def __init__(self, model):
        self.m = model
        self.kept_ids = None
        self.pert = {}            # ('out'|'mid', layer) -> tensor [B,T,HID]
        self.cap = {}
        self.stop_at = None
        self.hooks = []
        for L, layer in enumerate(model.model.layers):
            self.hooks.append(layer.register_forward_hook(self._out(L)))
            self.hooks.append(layer.self_attn.register_forward_hook(self._mid_add(L)))
            self.hooks.append(layer.post_attention_layernorm.register_forward_pre_hook(self._mid_cap(L)))
        self.hooks.append(model.model.norm.register_forward_pre_hook(self._fin))

    class Stop(Exception):
        pass

    def _out(self, L):
        def f(mod, args, out):
            d = self.pert.get(("out", L))
            return out + d if d is not None else None
        return f

    def _mid_add(self, L):
        def f(mod, args, out):
            d = self.pert.get(("mid", L))
            if d is None:
                return None
            return (out[0] + d,) + tuple(out[1:])
        return f

    def _mid_cap(self, L):
        def f(mod, args):
            self.cap[("mid", L)] = args[0]
            if self.stop_at == L:
                raise Rig.Stop()
        return f

    def _fin(self, mod, args):
        self.cap["fin"] = args[0]

    @torch.no_grad()
    def final(self, ids, pert=None, logits_from=None):
        self.pert = pert or {}
        self.stop_at = None
        out = self.m.model(input_ids=ids)
        fin = self.cap["fin"]
        self.pert = {}
        if logits_from is None:
            return fin, None
        h = self.m.model.norm(fin[:, logits_from:, :])
        outs = [torch.log_softmax(self.m.lm_head(h[b]), dim=-1)[:, self.kept_ids] for b in range(h.shape[0])]
        return fin, torch.stack(outs)

    def mid_resid_norm(self, ids, L):
        with torch.no_grad():
            self.pert = {}
            self.stop_at = L
            try:
                self.m.model(input_ids=ids)
            except Rig.Stop:
                pass
            self.stop_at = None
            return self.cap[("mid", L)].norm(dim=-1).median().item()

    def out_resid_norm(self, ids, L):
        with torch.no_grad():
            hs = self.m.model(input_ids=ids, output_hidden_states=True).hidden_states
            return hs[L + 1].norm(dim=-1).median().item()

    def kgrad(self, ids, L, c):
        """Sum over docs/positions of d( sum_{t in seeds} c . h_mid_L(t) ) / d embeddings, summed over positions."""
        self.pert = {}
        emb = self.m.model.embed_tokens(ids).detach().requires_grad_(True)
        self.stop_at = L
        with torch.enable_grad():
            try:
                self.m.model(inputs_embeds=emb)
            except Rig.Stop:
                pass
            h = self.cap[("mid", L)]
            f = (h[:, SEED_FIRST:-1, :] @ c).sum()
            (g,) = torch.autograd.grad(f, emb)
        self.stop_at = None
        return g.sum(dim=(0, 1))


def pos_mask(B, T):
    m = torch.zeros(B, T, 1)
    m[:, SEED_FIRST:T - 1, :] = 1.0
    return m


def stage_acts():
    tok, model = load()
    docs = build_docs(tok)
    act = docs["act"]
    ids_all = torch.tensor([d["ids"] for d in act])
    N, T = ids_all.shape
    top_v = torch.full((NL, 2, NN, TOPK_FIRE), -1e9)
    top_i = torch.zeros((NL, 2, NN, TOPK_FIRE), dtype=torch.long)
    cur = {}
    hooks = []
    def mk(L):
        def f(mod, args):
            cur[L] = args[0].detach()
        return f
    for L, layer in enumerate(model.model.layers):
        hooks.append(layer.mlp.down_proj.register_forward_pre_hook(mk(L)))
    B = 10
    t0 = time.time()
    for b0 in range(0, N, B):
        ids = ids_all[b0:b0 + B]
        with torch.no_grad():
            model.model(input_ids=ids)
        gidx = (torch.arange(b0, b0 + ids.shape[0])[:, None] * T + torch.arange(T)[None, :])  # global token index
        keep = torch.arange(T) >= 4                                    # leave out the first 4 positions (sink)
        for L in range(NL):
            x = cur[L][:, keep, :].reshape(-1, NN)                       # [n, NN]
            gi = gidx[:, keep].reshape(-1)
            for si, s in enumerate((1.0, -1.0)):
                v, ix = (s * x).T.topk(TOPK_FIRE, dim=1)                 # [NN, K]
                allv = torch.cat([top_v[L, si], v], 1)
                alli = torch.cat([top_i[L, si], gi[ix]], 1)
                tv, ti = allv.topk(TOPK_FIRE, dim=1)
                top_v[L, si] = tv
                top_i[L, si] = alli.gather(1, ti)
        print(f"acts batch {b0 // B + 1}/{N // B}  {time.time() - t0:.0f}s", flush=True)
    for h in hooks:
        h.remove()
    flat = ids_all.reshape(-1)
    counts = torch.bincount(flat, minlength=model.config.vocab_size)
    torch.save({"top_v": top_v, "top_i": top_i, "tokens": flat, "counts": counts, "T": T}, os.path.join(OUT, "acts.pt"))
    print("tokens seen in the activation corpus:", int((counts > 0).sum()), flush=True)


def vocab_kept(tok, V):
    """Tokens seen >= 3 times in the text of every article on this site (the analogue of the authors' 'kept' mask)."""
    p = os.path.join(OUT, "vocab_counts.pt")
    if os.path.exists(p):
        vc = torch.load(p)
    else:
        vc = torch.zeros(V, dtype=torch.long)
        for f in sorted(glob.glob(os.path.join(CONTENT, "*.mdx"))):
            ids = tok(open(f, encoding="utf-8").read())["input_ids"]
            vc += torch.bincount(torch.tensor(ids), minlength=V)[:V]
        torch.save(vc, p)
    return (vc >= 3) & (torch.arange(V) < 151643)


def tokstr(tok, i):
    return tok.decode([int(i)]).replace("\n", "\\n")


def stage_reads():
    tok, model = load()
    docs = build_docs(tok)
    A = torch.load(os.path.join(OUT, "acts.pt"))
    counts, flat = A["counts"], A["tokens"]
    V = model.config.vocab_size
    kept = vocab_kept(tok, V)
    kept_ids = torch.nonzero(kept).squeeze(1)
    print("kept vocabulary", len(kept_ids), flush=True)
    E = model.model.embed_tokens.weight                           # tied with lm_head
    Ek = E[kept_ids].float()
    Ec = Ek - Ek.mean(0, keepdim=True)                            # W_E[v] - mean
    ids = torch.tensor([d["ids"] for d in docs["lens"]])            # lens documents: J / K reads are taken here
    eids = torch.tensor([d["ids"] for d in docs["eval"]])           # held-out documents: steering is measured here
    B, T = ids.shape
    rig = Rig(model)
    rig.kept_ids = kept_ids
    seed_mask = pos_mask(B, T)
    eseed_mask = pos_mask(eids.shape[0], T)

    rng = random.Random(SEED + 1)
    per = {L: rng.sample(range(NN), PER_LAYER) for L in LAYERS}
    sample = [(L, per[L][k]) for k in range(PER_LAYER) for L in LAYERS]      # every pass covers every layer
    done_p = os.path.join(OUT, "reads.jsonl")
    done = set()
    if os.path.exists(done_p):
        for line in open(done_p):
            r = json.loads(line)
            done.add((r["L"], r["n"]))
    _, lp0 = rig.final(eids, logits_from=SEED_FIRST)
    base_lp = lp0                                                 # [EB, T-16, K]

    def lens_logits(vec):                                         # vec [HID] -> log-softmax over kept tokens
        h = model.model.norm(vec[None, :])
        lg = torch.log_softmax(model.lm_head(h), dim=-1)[0]
        return lg[kept_ids]

    def pearson(a, b):
        a = a - a.mean(); b = b - b.mean()
        return float((a * b).sum() / (a.norm() * b.norm() + 1e-12))

    def spearman(a, b):
        ra = a.argsort().argsort().float(); rb = b.argsort().argsort().float()
        return pearson(ra, rb)

    def fd(point, L, v, scale, per_doc=False):
        """Central finite difference of the final residual for adding eps*v at seeds: returns J v (mean over seeds)."""
        eps = scale
        d = (eps * v)[None, None, :] * seed_mask
        fp, _ = rig.final(ids, pert={(point, L): d})
        fm, _ = rig.final(ids, pert={(point, L): -d})
        diff = (fp - fm) / (2 * eps)                              # [B,T,HID]
        per = diff[:, SEED_FIRST:, :].sum(1) / (T - 1 - SEED_FIRST)   # mean over seeds of the summed later effect, per doc
        return per if per_doc else per.mean(0)

    def top_tokens(score, k=8):
        return [tokstr(tok, kept_ids[j]) for j in score.topk(k).indices.tolist()]

    def fire_tokens(L, si, n):
        gi = A["top_i"][L, si, n][:20]
        return [int(flat[j]) for j in gi if bool(kept[int(flat[j])])]

    def hit(read_score, fire_ids, k):
        top = set(kept_ids[read_score.topk(k).indices].tolist())
        return sum(1 for t in fire_ids if t in top) / len(fire_ids)

    t0 = time.time()
    with open(done_p, "a") as fh:
        for (L, n) in sample:
            if (L, n) in done:
                continue
            layer = model.model.layers[L]
            w = layer.mlp.down_proj.weight[:, n].detach().float().clone()   # write direction (+ pole)
            gam = layer.post_attention_layernorm.weight.detach()
            a = gam * layer.mlp.gate_proj.weight[n].detach().float()
            b = gam * layer.mlp.up_proj.weight[n].detach().float()
            ah, bh = a / a.norm(), b / b.norm()
            rec = {"L": L, "n": n, "w_norm": float(w.norm()), "cos_ab": float(ah @ bh)}
            # ---- write side: logit lens, J read, steering effect
            out_norm = rig.out_resid_norm(ids, L)
            eps = REL * out_norm / float(w.norm())
            Jw_docs = fd("out", L, w, eps, per_doc=True)                    # [B,HID]
            Jw = Jw_docs.mean(0)
            ll = lens_logits(w)
            jl = lens_logits(Jw)
            jl_h1, jl_h2 = lens_logits(Jw_docs[:2].mean(0)), lens_logits(Jw_docs[2:].mean(0))
            rec["J_halves_top1"] = int(jl_h1.argmax() == jl_h2.argmax())
            rec["J_halves_top10"] = len(set(jl_h1.topk(10).indices.tolist()) & set(jl_h2.topk(10).indices.tolist())) / 10
            rec["logit_vs_J_top10"] = len(set(ll.topk(10).indices.tolist()) & set(jl.topk(10).indices.tolist())) / 10
            rec["top_write_logit"] = top_tokens(ll)
            rec["top_write_J"] = top_tokens(jl)
            for si, s in enumerate((1.0, -1.0)):
                act_top = float(A["top_v"][L, si, n].median())                # typical high activation of this pole
                key = "p" if si == 0 else "m"
                rec[key + "_act_top"] = act_top
                if act_top <= 0:
                    continue
                d = (act_top * s * w)[None, None, :] * eseed_mask
                _, lp = rig.final(eids, pert={("out", L): d}, logits_from=SEED_FIRST)
                delta = (lp - base_lp).mean(dim=(0, 1))                       # mean change in log-prob over docs, positions
                rec[key + "_steer_rel"] = float((act_top * w.norm()) / out_norm)
                rec[key + "_r_logit"] = pearson(delta, lens_logits(s * w))
                rec[key + "_r_J"] = pearson(delta, lens_logits(s * Jw))
                rec[key + "_rho_logit"] = spearman(delta, lens_logits(s * w))
                rec[key + "_rho_J"] = spearman(delta, lens_logits(s * Jw))
                rec[key + "_delta_top"] = top_tokens(delta)
                rec[key + "_delta_vec_norm"] = float(delta.norm())
                # keep the vectors for the mismatched-pair control
                torch.save({"delta": delta, "ll": lens_logits(s * w), "jl": lens_logits(s * Jw)}, os.path.join(OUT, f"vec_{L}_{n}_{key}.pt"))
            # ---- read side: the pole's read direction c = unit(a_hat + s b_hat)
            mid_norm = rig.mid_resid_norm(ids, L)
            for si, s in enumerate((1.0, -1.0)):
                key = "p" if si == 0 else "m"
                c = ah + s * bh
                c = c / c.norm()
                fire = fire_tokens(L, si, n)
                rec[key + "_fire_ids"] = fire
                rec[key + "_fire_tokens"] = [tokstr(tok, t) for t in fire[:8]]
                if not fire:
                    continue
                naive = Ec @ c                                                  # input-embedding shortcut
                G = rig.kgrad(ids, L, c)
                kscore = Ec @ G
                Jc = fd("mid", L, c, REL * mid_norm)
                jscore = lens_logits(Jc)
                torch.save({"naive": naive, "k": kscore, "j": jscore}, os.path.join(OUT, f"read_{L}_{n}_{key}.pt"))
                for name, sc in (("naive", naive), ("K", kscore), ("Jread", jscore)):
                    rec[f"{key}_{name}_hit10"] = hit(sc, fire, 10)
                    rec[f"{key}_{name}_hit50"] = hit(sc, fire, 50)
                    rec[f"{key}_{name}_top"] = top_tokens(sc)
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            fh.flush()
            print(f"L{L} n{n} done  {time.time() - t0:.0f}s", flush=True)


def stage_summarize():
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(QWEN_DIR)
    kept = vocab_kept(tok, 151936)
    kept_ids = torch.nonzero(kept).squeeze(1)
    recs = [json.loads(l) for l in open(os.path.join(OUT, "reads.jsonl"))]
    dpath = os.path.join(OUT, "dose.jsonl")
    drecs = {(d["L"], d["n"]): d for d in map(json.loads, open(dpath))} if os.path.exists(dpath) else {}

    def clean(xs):
        return [x for x in xs if x is not None and not (isinstance(x, float) and math.isnan(x))]

    def med(xs):
        xs = clean(xs)
        return float(np.median(xs)) if xs else None

    def mean(xs):
        xs = clean(xs)
        return float(np.mean(xs)) if xs else None

    def pearson(a, b):
        a = a - a.mean(); b = b - b.mean()
        return float((a * b).sum() / (a.norm() * b.norm() + 1e-12))

    def vec(L, n, key):
        p = os.path.join(OUT, f"vec_{L}_{n}_{key}.pt")
        return torch.load(p) if os.path.exists(p) else None

    def agg(name, rs):
        row = {"name": name, "neurons": len(rs), "poles": len(clean([r.get(k + "_r_J") for r in rs for k in ("p", "m")]))}
        P = ("p", "m")
        row["r_logit"] = med([r.get(k + "_r_logit") for r in rs for k in P])
        row["r_J"] = med([r.get(k + "_r_J") for r in rs for k in P])
        row["rho_logit"] = med([r.get(k + "_rho_logit") for r in rs for k in P])
        row["rho_J"] = med([r.get(k + "_rho_J") for r in rs for k in P])
        ctrl = []
        for r in rs:
            same = [o for o in rs if o["L"] == r["L"] and o["n"] != r["n"]]
            if not same:
                continue
            o = same[0]
            for k in P:
                a, b = vec(r["L"], r["n"], k), vec(o["L"], o["n"], k)
                if a is not None and b is not None:
                    ctrl.append(pearson(a["delta"], b["jl"]))
        row["r_J_mismatched"] = med(ctrl)
        row["steer_rel"] = med([r.get(k + "_steer_rel") for r in rs for k in P])
        row["logit_vs_J_top10"] = mean([r["logit_vs_J_top10"] for r in rs])
        row["J_halves_top1"] = mean([r["J_halves_top1"] for r in rs])
        row["J_halves_top10"] = mean([r["J_halves_top10"] for r in rs])
        for nm in ("naive", "K", "Jread"):
            for k in (10, 50):
                row[f"{nm}_hit{k}"] = mean([r.get(f"{key}_{nm}_hit{k}") for r in rs for key in P])
        for nm, field in (("naive", "naive"), ("K", "k")):
            for k in (10, 50):
                vals = []
                for r in rs:
                    same = [o for o in rs if o["L"] == r["L"] and o["n"] != r["n"]]
                    if not same:
                        continue
                    o = same[0]
                    for key in P:
                        fire = r.get(key + "_fire_ids") or []
                        pth = os.path.join(OUT, f"read_{o['L']}_{o['n']}_{key}.pt")
                        if not fire or not os.path.exists(pth):
                            continue
                        sc = torch.load(pth)[field]
                        top = set(kept_ids[sc.topk(k).indices].tolist())
                        vals.append(sum(1 for t in fire if t in top) / len(fire))
                row[f"ctrl_{nm}_hit{k}"] = mean(vals)
        for m in (4, 16):
            for nm in ("r_logit", "r_J", "rel"):
                row[f"x{m}_{nm}"] = med([drecs[(r["L"], r["n"])].get(f"{key}_x{m}_{nm}") for r in rs if (r["L"], r["n"]) in drecs for key in P])
        return row

    buckets = [("L0-L2", 0, 2), ("L4-L8", 4, 8), ("L10-L16", 10, 16), ("L19-L25", 19, 25), ("L27", 27, 27)]
    res = {"n_neurons": len(recs), "layers": LAYERS, "per_layer_neurons": PER_LAYER, "kept_vocab": int(len(kept_ids)),
           "per_layer": [agg(f"L{L}", [r for r in recs if r["L"] == L]) | {"layer": L} for L in LAYERS],
           "buckets": [agg(n, [r for r in recs if lo <= r["L"] <= hi]) for n, lo, hi in buckets]}
    json.dump(res, open(os.path.join(OUT, "results.json"), "w"), indent=1)
    print(json.dumps(res["buckets"], indent=1))


def stage_dose():
    """Re-measure the steering effect of the sampled poles at larger doses and correlate with the saved lens reads."""
    tok, model = load()
    docs = build_docs(tok)
    V = model.config.vocab_size
    kept = vocab_kept(tok, V)
    kept_ids = torch.nonzero(kept).squeeze(1)
    ids = torch.tensor([d["ids"] for d in docs["lens"]])
    eids = torch.tensor([d["ids"] for d in docs["eval"]])
    B, T = ids.shape
    rig = Rig(model)
    rig.kept_ids = kept_ids
    seed_mask = pos_mask(eids.shape[0], T)
    _, lp0 = rig.final(eids, logits_from=SEED_FIRST)
    base_lp = lp0
    mults = [4.0, 16.0]
    def pearson(a, b):
        a = a - a.mean(); b = b - b.mean()
        return float((a * b).sum() / (a.norm() * b.norm() + 1e-12))
    def lens_logits(vec):
        h = model.model.norm(vec[None, :])
        return torch.log_softmax(model.lm_head(h), dim=-1)[0][kept_ids]
    done_p = os.path.join(OUT, "dose.jsonl")
    done = set()
    if os.path.exists(done_p):
        for line in open(done_p):
            r = json.loads(line); done.add((r["L"], r["n"]))
    recs = [json.loads(l) for l in open(os.path.join(OUT, "reads.jsonl"))]
    t0 = time.time()
    with open(done_p, "a") as fh:
        for r in recs:
            L, n = r["L"], r["n"]
            if (L, n) in done:
                continue
            layer = model.model.layers[L]
            w = layer.mlp.down_proj.weight[:, n].detach().float().clone()
            out_norm = rig.out_resid_norm(ids, L)
            row = {"L": L, "n": n}
            for si, s_ in enumerate((1.0, -1.0)):
                key = "p" if si == 0 else "m"
                v = torch.load(os.path.join(OUT, f"vec_{L}_{n}_{key}.pt")) if os.path.exists(os.path.join(OUT, f"vec_{L}_{n}_{key}.pt")) else None
                act_top = r.get(key + "_act_top", 0)
                if v is None or act_top <= 0:
                    continue
                for m in mults:
                    d = (m * act_top * s_ * w)[None, None, :] * seed_mask
                    _, lp = rig.final(eids, pert={("out", L): d}, logits_from=SEED_FIRST)
                    delta = (lp - base_lp).mean(dim=(0, 1))
                    row[f"{key}_x{int(m)}_rel"] = float(m * act_top * w.norm() / out_norm)
                    row[f"{key}_x{int(m)}_r_logit"] = pearson(delta, v["ll"])
                    row[f"{key}_x{int(m)}_r_J"] = pearson(delta, v["jl"])
            fh.write(json.dumps(row) + "\n")
            fh.flush()
            print(f"dose L{L} n{n} {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    {"acts": stage_acts, "reads": stage_reads, "dose": stage_dose, "summarize": stage_summarize}[sys.argv[1]]()
