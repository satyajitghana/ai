"""Toy auditable detector: pythia-14m (numpy forward) -> ReLU/L1 SAE -> max-pool -> L1 logistic probe.

Usage: python sae_probe.py DATA_DIR MODEL_DIR OUT_JSON
DATA_DIR holds HC3 jsonl files (Hello-SimpleAI/HC3, CC BY-SA 4.0): reddit_eli5, finance (train),
open_qa, medicine, wiki_csai (held-out domains). MODEL_DIR holds EleutherAI/pythia-14m
(model.safetensors, tokenizer.json). Needs numpy, tokenizers, safetensors, scikit-learn.
Everything is seeded; one run takes a few minutes on 2 CPU threads.
"""
import json, sys, math, random, warnings
warnings.filterwarnings("ignore")
import numpy as np
from safetensors import safe_open
from tokenizers import Tokenizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

DATA, MODEL, OUT = sys.argv[1:4]
SEED, T, LAYER, DSAE, L1 = 0, 128, 3, 1024, 0.9
rng = np.random.default_rng(SEED); random.seed(SEED)

# ---------- pythia-14m forward in numpy (GPT-NeoX, parallel residual, rotary on 25% of head dim)
f = safe_open(f"{MODEL}/model.safetensors", "np")
W = {k: f.get_tensor(k).astype(np.float32) for k in f.keys()}
tok = Tokenizer.from_file(f"{MODEL}/tokenizer.json")
H, D, HD, ROT = 4, 128, 32, 8

def ln(x, w, b):
    m = x.mean(-1, keepdims=True); v = x.var(-1, keepdims=True)
    return (x - m) / np.sqrt(v + 1e-5) * w + b

def _erf(x):  # Abramowitz-Stegun 7.1.26, |err| < 1.5e-7
    s = np.sign(x); x = np.abs(x); t = 1 / (1 + 0.3275911 * x)
    y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * np.exp(-x * x)
    return s * y

def rope(x, pos):  # x [T,H,HD]
    inv = 1.0 / (10000 ** (np.arange(0, ROT, 2) / ROT))
    fr = np.outer(pos, inv); emb = np.concatenate([fr, fr], -1)
    cos, sin = np.cos(emb)[:, None], np.sin(emb)[:, None]
    r, p = x[..., :ROT], x[..., ROT:]
    rh = np.concatenate([-r[..., ROT // 2:], r[..., :ROT // 2]], -1)
    return np.concatenate([r * cos + rh * sin, p], -1)

def forward(ids, want_layer=None):
    n = len(ids); x = W["gpt_neox.embed_in.weight"][ids]; pos = np.arange(n)
    mask = np.triu(np.full((n, n), -1e9, np.float32), 1); cap = None
    for l in range(6):
        if l == want_layer: cap = x.copy()
        p = f"gpt_neox.layers.{l}."
        a = ln(x, W[p + "input_layernorm.weight"], W[p + "input_layernorm.bias"])
        qkv = (a @ W[p + "attention.query_key_value.weight"].T + W[p + "attention.query_key_value.bias"]).reshape(n, H, 3 * HD)
        q, k, v = qkv[..., :HD], qkv[..., HD:2 * HD], qkv[..., 2 * HD:]
        q, k = rope(q, pos), rope(k, pos)
        s = np.einsum("thd,shd->hts", q, k) / math.sqrt(HD) + mask
        s = np.exp(s - s.max(-1, keepdims=True)); s /= s.sum(-1, keepdims=True)
        o = np.einsum("hts,shd->thd", s, v).reshape(n, D)
        o = o @ W[p + "attention.dense.weight"].T + W[p + "attention.dense.bias"]
        m = ln(x, W[p + "post_attention_layernorm.weight"], W[p + "post_attention_layernorm.bias"])
        m = _erf_gelu(m @ W[p + "mlp.dense_h_to_4h.weight"].T + W[p + "mlp.dense_h_to_4h.bias"])
        m = m @ W[p + "mlp.dense_4h_to_h.weight"].T + W[p + "mlp.dense_4h_to_h.bias"]
        x = x + o + m
    if want_layer is not None: return cap, x
    return x

def _erf_gelu(x): return 0.5 * x * (1 + _erf(x / math.sqrt(2)))

def nll(ids):  # sanity: mean next-token NLL
    x = ln(forward(ids), W["gpt_neox.final_layer_norm.weight"], W["gpt_neox.final_layer_norm.bias"])
    lg = x[:-1] @ W["embed_out.weight"].T; lg -= lg.max(-1, keepdims=True)
    lp = lg - np.log(np.exp(lg).sum(-1, keepdims=True))
    return -lp[np.arange(len(ids) - 1), ids[1:]].mean()

# ---------- data
def load(name, n):
    out = []
    with open(f"{DATA}/{name}.jsonl") as fh:
        for line in fh:
            r = json.loads(line)
            h, c = r["human_answers"], r["chatgpt_answers"]
            if not h or not c: continue
            hs, cs = h[0].strip(), c[0].strip()
            if len(hs) < 80 or len(cs) < 80: continue
            out.append((hs, 0, name)); out.append((cs, 1, name))
            if len(out) >= 2 * n: break
    return out

TRAIN = ["reddit_eli5", "finance"]; TEST = ["open_qa", "medicine", "wiki_csai"]
docs = {d: load(d, 700 if d in TRAIN else 400) for d in TRAIN + TEST}

def extract(text):
    ids = tok.encode(text).ids[:T]
    if len(ids) < 8: return None
    cap, _ = forward(np.array(ids), LAYER)
    return ids, cap

cache = {}
for d, items in docs.items():
    cache[d] = []
    for text, y, _ in items:
        e = extract(text)
        if e: cache[d].append((e[0], e[1], y, text))
    print(d, len(cache[d]), flush=True)

sample_ids = cache["reddit_eli5"][0][0]
print("sanity NLL (nats/token) on one doc:", float(nll(np.array(sample_ids))), "uniform:", math.log(50304))

# ---------- SAE (ReLU + L1, unit-norm decoder), manual Adam
tr = [(ids, a, y, t) for d in TRAIN for (ids, a, y, t) in cache[d]]
idx = rng.permutation(len(tr)); nval = len(tr) // 5
val_i, fit_i = set(idx[:nval].tolist()), idx[nval:].tolist()
X = np.concatenate([tr[i][1] for i in fit_i]).astype(np.float32)
scale = math.sqrt(D) / np.linalg.norm(X, axis=1).mean(); X *= scale
print("SAE train tokens", X.shape, flush=True)
We = (rng.standard_normal((D, DSAE)) / math.sqrt(D)).astype(np.float32)
Wd = We.T.copy(); Wd /= np.linalg.norm(Wd, axis=1, keepdims=True); We = Wd.T.copy()
be = np.zeros(DSAE, np.float32); bd = X.mean(0)
params = [We, be, Wd, bd]; m = [np.zeros_like(p) for p in params]; v = [np.zeros_like(p) for p in params]
B, STEPS, lr = 1024, 7000, 1e-3
for step in range(1, STEPS + 1):
    xb = X[rng.integers(0, len(X), B)]
    pre = (xb - bd) @ We + be; z = np.maximum(pre, 0); xh = z @ Wd + bd
    dxh = 2 * (xh - xb) / B
    dWd = z.T @ dxh; dbd = dxh.sum(0)
    dz = dxh @ Wd.T + L1 / B; dpre = dz * (pre > 0)
    dWe = (xb - bd).T @ dpre; dbe = dpre.sum(0); dbd = dbd - (dpre @ We.T).sum(0)
    for i, (p, g) in enumerate(zip(params, [dWe, dbe, dWd, dbd])):
        m[i] = 0.9 * m[i] + 0.1 * g; v[i] = 0.999 * v[i] + 0.001 * g * g
        p -= lr * (m[i] / (1 - 0.9 ** step)) / (np.sqrt(v[i] / (1 - 0.999 ** step)) + 1e-8)
    n = np.linalg.norm(Wd, axis=1, keepdims=True); Wd /= n  # keep decoder unit norm
    if step % 1000 == 0:
        mse = ((xh - xb) ** 2).sum(1).mean(); var = ((xb - xb.mean(0)) ** 2).sum(1).mean()
        print(f"step {step} frac_var_unexplained {mse/var:.3f} L0 {(z>0).sum(1).mean():.1f}", flush=True)

def encode(a): return np.maximum((a * scale - bd) @ We + be, 0)
Xe = encode(X[:20000] / scale)
mse = ((Xe @ Wd + bd - X[:20000]) ** 2).sum(1).mean(); var = ((X[:20000] - X[:20000].mean(0)) ** 2).sum(1).mean()
sae_stats = dict(frac_var_unexplained=float(mse / var), l0=float((Xe > 0).sum(1).mean()),
                 dead=int(((encode(X[:20000] / scale) > 0).sum(0) == 0).sum()))
print(sae_stats, flush=True)

# ---------- pooled features per doc, per prefix length
PREFIX = [8, 16, 32, 64, 128]
def pooled(rec, k=T):
    ids, a, y, t = rec
    return encode(a[:k]).max(0)
def dense(rec, k=T): return rec[1][:k].max(0) * scale

def build(recs, k=T): return np.stack([pooled(r, k) for r in recs])
fit_recs = [tr[i] for i in fit_i]; val_recs = [tr[i] for i in sorted(val_i)]
Xf, Xv = build(fit_recs), build(val_recs)
yf = np.array([r[2] for r in fit_recs]); yv = np.array([r[2] for r in val_recs])
test = {d: cache[d] for d in TEST}
Xt = {d: build(r) for d, r in test.items()}; yt = {d: np.array([x[2] for x in r]) for d, r in test.items()}

# ---------- token-level auditing stats: concentration score on fit tokens
tokstr = lambda i: tok.decode([i])
acts_all = np.concatenate([encode(r[1]) for r in fit_recs]); ids_all = np.concatenate([np.array(r[0]) for r in fit_recs])
dtype_y = np.concatenate([np.full(len(r[0]), r[2]) for r in fit_recs])
conc = np.zeros(DSAE); ntok = np.zeros(DSAE, int); top = {}
for j in range(DSAE):
    col = acts_all[:, j]; mx = col.max()
    if mx <= 0: continue
    on = col > 0.1 * mx; ntok[j] = on.sum()
    if ntok[j] < 20: continue
    w = col[on]; ids = ids_all[on]
    u, inv = np.unique(ids, return_inverse=True); mass = np.bincount(inv, weights=w)
    conc[j] = mass.max() / mass.sum()
    order = np.argsort(-mass)[:4]; top[j] = [(tokstr(int(u[o])), float(mass[o] / mass.sum())) for o in order]
print("scored features:", int((ntok >= 20).sum()), "of", DSAE, flush=True)

def tpr_fpr_at(score, y, thr): return float((score[y == 1] > thr).mean()), float((score[y == 0] > thr).mean())

def fit_probe(cols, C):
    lr_ = LogisticRegression(penalty="l1", solver="liblinear", C=C, max_iter=500)
    lr_.fit(Xf[:, cols], yf); return lr_

results = dict(sae=sae_stats, n_fit=len(fit_recs), n_val=len(val_recs), sweep=[], domains={}, prefix=[])
best = {}
for tau in [0.0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]:
    cols = np.where(conc >= tau)[0] if tau > 0 else np.where(ntok >= 20)[0]
    bestC = max([0.03, 0.1, 0.3, 1.0], key=lambda C: roc_auc_score(yv, fit_probe(cols, C).decision_function(Xv[:, cols])))
    p = fit_probe(cols, bestC); sv = p.decision_function(Xv[:, cols])
    thr = float(np.quantile(sv[yv == 0], 0.95))
    row = dict(tau=tau, kept=int(len(cols)), nonzero=int((p.coef_ != 0).sum()), C=bestC, val_auc=float(roc_auc_score(yv, sv)), thr=thr, test={})
    for d in TEST:
        s = p.decision_function(Xt[d][:, cols]); tp, fp = tpr_fpr_at(s, yt[d], thr)
        row["test"][d] = dict(auc=float(roc_auc_score(yt[d], s)), tpr=tp, fpr=fp)
    results["sweep"].append(row); best[tau] = (cols, p, thr)
    print(row, flush=True)

# audit action: drop features whose top token is only whitespace / punctuation (format-only), retrain, re-measure
import re
fmt = np.array([j in top and re.fullmatch(r"[\W_]+", top[j][0][0]) is not None for j in range(DSAE)])
results["masked"] = {}
for name, cols_m in [("format_off", np.array([j for j in best[0.4][0] if not fmt[j]])),
                     ("only_684_off", np.array([j for j in best[0.4][0] if j != 684]))]:
    pm = fit_probe(cols_m, 0.1); sv = pm.decision_function(Xv[:, cols_m]); thr_m = float(np.quantile(sv[yv == 0], 0.95))
    row = dict(kept=int(len(cols_m)), nonzero=int((pm.coef_ != 0).sum()), val_auc=float(roc_auc_score(yv, sv)), test={})
    for d in TEST:
        s_ = pm.decision_function(Xt[d][:, cols_m]); tp, fp = tpr_fpr_at(s_, yt[d], thr_m)
        row["test"][d] = dict(auc=float(roc_auc_score(yt[d], s_)), tpr=tp, fpr=fp)
    results["masked"][name] = row; print(name, row, flush=True)
results["n_format_features_in_tau04"] = int(sum(fmt[j] for j in best[0.4][0]))

# dense baseline
Df = np.stack([dense(r) for r in fit_recs]); Dv = np.stack([dense(r) for r in val_recs])
dp = LogisticRegression(C=1.0, max_iter=2000).fit(Df, yf); dv = dp.decision_function(Dv); dthr = float(np.quantile(dv[yv == 0], 0.95))
results["dense"] = dict(val_auc=float(roc_auc_score(yv, dv)), test={})
for d in TEST:
    s = dp.decision_function(np.stack([dense(r) for r in test[d]])); tp, fp = tpr_fpr_at(s, yt[d], dthr)
    results["dense"]["test"][d] = dict(auc=float(roc_auc_score(yt[d], s)), tpr=tp, fpr=fp)
print("dense", results["dense"], flush=True)

# ---------- audit head: tau = 0.4
TAU = 0.4
cols, p, thr = best[TAU]; w = p.coef_[0]; b = float(p.intercept_[0])
Xv_c = Xv[:, cols]
feat = []
for ci in np.argsort(-np.abs(w))[:40]:
    if w[ci] == 0: continue
    j = int(cols[ci]); on = Xv_c[:, ci] > 0
    feat.append(dict(id=j, w=float(w[ci]), conc=float(conc[j]), ntok=int(ntok[j]), top=top[j],
                     human=int(on[yv == 0].sum()), ai=int(on[yv == 1].sum()), mean_act=float(Xv_c[on, ci].mean()) if on.any() else 0.0))
results["audit"] = dict(tau=TAU, bias=b, thr=thr, nonzero=int((w != 0).sum()), kept=int(len(cols)), features=feat[:16])

# ---------- per-doc explanations (test domains), incl. a false positive and a miss
def explain(rec, k=T):
    ids, a, y, t = rec
    e = encode(a[:k]); x = e.max(0)[cols]; contrib = w * x
    logit = float(contrib.sum() + b)
    order = np.argsort(-np.abs(contrib))[:6]
    fe = []
    for ci in order:
        if contrib[ci] == 0: continue
        j = int(cols[ci]); pos = int(e[:, j].argmax())
        lo = max(0, pos - 3); hi = min(len(ids), pos + 2)
        fe.append(dict(id=j, c=float(contrib[ci]), tok=tokstr(ids[pos]), ctx=tok.decode(ids[lo:hi]), top=top[j][:3]))
    return dict(logit=logit, y=int(y), n_tok=len(ids), feats=fe, text=t[:240])
exs = []
for d in TEST:
    scores = [explain(r)["logit"] for r in test[d]]
    results["domains"][d] = dict(n=len(scores), human_median=float(np.median([s for s, r in zip(scores, test[d]) if r[2] == 0])),
                                 ai_median=float(np.median([s for s, r in zip(scores, test[d]) if r[2] == 1])))
    hs = sorted([i for i, r in enumerate(test[d]) if r[2] == 0], key=lambda i: -scores[i])
    ai = sorted([i for i, r in enumerate(test[d]) if r[2] == 1], key=lambda i: -scores[i])
    results["domains"][d]["picks"] = dict(fp=hs[0], tp=ai[len(ai) // 8], tn=hs[-len(hs) // 8], fn=ai[-1])
    for kind, i in results["domains"][d]["picks"].items():
        ex = explain(test[d][i]); ex["kind"] = kind; ex["domain"] = d; exs.append(ex)
results["examples"] = exs

# ---------- short texts: prefix length vs AUC / TPR / FPR at the tau=0.4 threshold, pooled over test domains
allrecs = [r for d in TEST for r in test[d]]; ally = np.array([r[2] for r in allrecs])
for k in PREFIX:
    s = np.array([float((w * encode(r[1][:k]).max(0)[cols]).sum() + b) for r in allrecs])
    tp, fp = tpr_fpr_at(s, ally, thr)
    results["prefix"].append(dict(tokens=k, auc=float(roc_auc_score(ally, s)), tpr=tp, fpr=fp,
                                  human_mean_logit=float(s[ally == 0].mean()), ai_mean_logit=float(s[ally == 1].mean())))
    print(results["prefix"][-1], flush=True)
results["mean_tokens"] = float(np.mean([len(r[0]) for r in allrecs]))
json.dump(results, open(OUT, "w"), indent=1)
