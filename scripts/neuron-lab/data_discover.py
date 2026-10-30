"""Contrast-search + steering validation for one benign axis on Qwen3-0.6B.   usage: data_discover.py <axis>

Stage 0  contrast: token-level d' = (mean_A - mean_B) / sqrt((s_A^2 + s_B^2)/2) for all 86,016 neurons
         (positions >= 1), ranked on all pairs; split-half check (rank on even pairs, test on odd).
Stage 1  screen: top-32 |d'| neurons in layers 8..26 (pushed toward side A) and 32 random control neurons of the
         same layers (random sign), doses 0.15 / 0.3, 5 neutral prompts, 24 greedy tokens.  lift = lexical score
         (steered) - (unsteered).
Stage 2  validate the 6 best candidates and 6 fresh random controls: doses 0.05..0.5, 40 greedy tokens, held-out
         perplexity; a neuron 'works' at a dose if lift >= MIN_LIFT, lift > the best random control at that dose and
         perplexity <= 3x baseline.
Stage 3  pairs of working neurons at 0.6x their best dose.
Output $NL_SCRATCH/disc/<axis>.json.   All generation is greedy (deterministic)."""
import sys, time, random, math
from data_common import *
import data_axes as AX

axis = sys.argv[1]
A = AX.AXES[axis]
meta = load_meta()
rn, cn = meta["resNormMedian"], meta["colNorm"]
tok, model = load()
S = Steer(model, rn, cn)
os.makedirs(os.path.join(SCRATCH, "disc"), exist_ok=True)
T0 = time.time()
rng = random.Random(1234 + sum(map(ord, axis)))

# ---------------- stage 0: contrast ----------------
cur = {}
for L, layer in enumerate(model.model.layers):
    layer.mlp.down_proj.register_forward_pre_hook(lambda m, a, L=L: cur.__setitem__(L, a[0][0, 1:, :].clone()))

@torch.no_grad()
def acts(text):
    ids = tok(text, return_tensors="pt").input_ids
    model.model(input_ids=ids)
    return torch.stack([cur[L] for L in range(NL)], 0)  # [28,T-1,3072]

def moments(texts):
    n = 0; s = torch.zeros(NL, NN); q = torch.zeros(NL, NN)
    for t in texts:
        a = acts(t); n += a.shape[1]; s += a.sum(1); q += (a * a).sum(1)
    return n, s, q

def dprime(mA, mB):
    (nA, sA, qA), (nB, sB, qB) = mA, mB
    ma, mb = sA / nA, sB / nB
    va, vb = (qA / nA - ma ** 2).clamp_min(1e-9), (qB / nB - mb ** 2).clamp_min(1e-9)
    return (ma - mb) / ((va + vb) / 2).sqrt(), ma, mb

Atx, Btx = A["A"], A["B"]
ev = lambda xs: xs[0::2]; od = lambda xs: xs[1::2]
mAe, mAo, mBe, mBo = moments(ev(Atx)), moments(od(Atx)), moments(ev(Btx)), moments(od(Btx))
add = lambda a, b: (a[0] + b[0], a[1] + b[1], a[2] + b[2])
d_all, ma_all, mb_all = dprime(add(mAe, mAo), add(mBe, mBo))
d_even, _, _ = dprime(mAe, mBe)
d_odd, _, _ = dprime(mAo, mBo)
# split-half replication of the top-40 (layers 8..26)
mask = torch.zeros(NL, NN, dtype=torch.bool); mask[8:27] = True
de = torch.where(mask, d_even.abs(), torch.zeros(()))
top40 = de.flatten().topk(40).indices
rep = sum(1 for f in top40.tolist() if d_odd.flatten()[f] * d_even.flatten()[f] > 0 and d_odd.flatten()[f].abs() > 1)
rand_abs = d_all[mask].abs()
stat0 = dict(replicated_top40=rep, random_mean_abs_d=float(rand_abs.mean()), random_p99_abs_d=float(rand_abs.quantile(0.99)),
             max_abs_d=float(rand_abs.max()), nA=len(Atx), nB=len(Btx))
print(axis, "stage0", stat0, f"{time.time()-T0:.0f}s", flush=True)

dm = torch.where(mask, d_all.abs(), torch.zeros(()))
cand = [(f // NN, f % NN) for f in dm.flatten().topk(32).indices.tolist()]
cinfo = {}
for (L, n) in cand:
    cinfo[(L, n)] = dict(d=float(d_all[L, n]), d_even=float(d_even[L, n]), d_odd=float(d_odd[L, n]), meanA=float(ma_all[L, n]), meanB=float(mb_all[L, n]),
                         sign=1.0 if d_all[L, n] > 0 else -1.0)
layers_used = [L for L, n in cand]

def rand_ctrl(k, avoid):
    out = []
    while len(out) < k:
        L = rng.choice(layers_used); n = rng.randrange(NN)
        if (L, n) in avoid or (L, n) in out:
            continue
        out.append((L, n))
    return out

# ---------------- generation helpers ----------------
P = AX.PROMPTS
def run(jobs, max_new, bs=96):
    """jobs: list of (prompt, steers).  returns list[str] in order."""
    outs = []
    for i in range(0, len(jobs), bs):
        ch = jobs[i:i + bs]
        outs += generate_rows(tok, model, S, [j[0] for j in ch], [j[1] for j in ch], max_new)
    return outs

def mean_score(texts):
    return sum(AX.score(axis, t) for t in texts) / len(texts)

base24 = run([(p, []) for p in P], 24)
base40 = run([(p, []) for p in P], 40)
b24, b40 = mean_score(base24), mean_score(base40)

def sweep(items, signs, doses, max_new, base):
    """items: list of neuron tuples -> {item: {dose: lift}}"""
    jobs = []; keys = []
    for it in items:
        for d in doses:
            for p in P:
                jobs.append((p, [(it[0], it[1], signs[it] * d)])); keys.append((it, d))
    outs = run(jobs, max_new)
    res = {}
    k = 0
    for it in items:
        for d in doses:
            ts = outs[k:k + len(P)]; k += len(P)
            res.setdefault(it, {})[d] = (mean_score(ts) - base, ts)
    return res

# ---------------- stage 1 ----------------
signs = {c: cinfo[c]["sign"] for c in cand}
ctrl1 = rand_ctrl(32, set(cand))
for c in ctrl1:
    signs[c] = rng.choice([-1.0, 1.0])
r1 = sweep(cand + ctrl1, signs, [0.15, 0.3], 24, b24)
best1 = {c: max(v[0] for v in r1[c].values()) for c in cand}
ctrl_best1 = sorted((max(v[0] for v in r1[c].values()) for c in ctrl1), reverse=True)
ranked = sorted(cand, key=lambda c: -best1[c])
print(axis, "stage1 best cand lifts", [round(best1[c], 1) for c in ranked[:6]], "ctrl top", [round(x, 1) for x in ctrl_best1[:4]], f"{time.time()-T0:.0f}s", flush=True)

# ---------------- stage 2 ----------------
DOSES = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5]
top6 = ranked[:6]
ctrl2 = rand_ctrl(6, set(cand) | set(ctrl1))
for c in ctrl2:
    signs[c] = rng.choice([-1.0, 1.0])
r2 = sweep(top6 + ctrl2, signs, DOSES, 40, b40)

@torch.no_grad()
def ppl_of(steers):
    ids = tok(AX.HELDOUT, return_tensors="pt").input_ids
    S.set([steers])
    lg = model(input_ids=ids).logits
    S.clear()
    lp = torch.log_softmax(lg[0, :-1], -1).gather(1, ids[0, 1:, None]).squeeze(1)
    return float(torch.exp(-lp.mean()))

ppl0 = ppl_of([])
res = {}
for c in top6 + ctrl2:
    res[c] = {d: dict(lift=r2[c][d][0], ppl=ppl_of([(c[0], c[1], signs[c] * d)]), texts=r2[c][d][1]) for d in DOSES}
ctrl_lift_max = {d: max(res[c][d]["lift"] for c in ctrl2) for d in DOSES}
ML = AX.MIN_LIFT[axis]

def works(r, d):
    return r[d]["lift"] >= ML and r[d]["lift"] > max(ctrl_lift_max[d], 0) and r[d]["ppl"] <= 3 * ppl0

single = []
for c in top6:
    ok = [d for d in DOSES if works(res[c], d)]
    if ok:
        bd = max(ok, key=lambda d: res[c][d]["lift"])
        single.append(dict(layer=c[0], neuron=c[1], sign=signs[c], dose=bd, lift=res[c][bd]["lift"], ppl=res[c][bd]["ppl"], okDoses=ok))
single.sort(key=lambda x: -x["lift"])
print(axis, "stage2 working:", [(s["layer"], s["neuron"], s["dose"], round(s["lift"], 1)) for s in single], f"{time.time()-T0:.0f}s", flush=True)

# ---------------- stage 3: pairs ----------------
pairs = []
for i in range(len(single)):
    for j in range(i + 1, len(single)):
        a, b = single[i], single[j]
        st = [(a["layer"], a["neuron"], a["sign"] * a["dose"] * 0.6), (b["layer"], b["neuron"], b["sign"] * b["dose"] * 0.6)]
        outs = run([(p, st) for p in P], 40)
        lift = mean_score(outs) - b40
        pp = ppl_of(st)
        pairs.append(dict(neurons=[dict(layer=x[0], neuron=x[1], dose=round(x[2], 4)) for x in st], lift=lift, ppl=pp,
                          works=bool(lift >= ML and pp <= 3 * ppl0 and lift > max(a["lift"], b["lift"]) * 0.8), texts=outs))

# ---------------- samples for accepted items ----------------
SP = [P[0], P[2]]
def samples(steers):
    outs = run([(p, []) for p in SP] + [(p, steers) for p in SP], 40)
    return [dict(prompt=SP[i], baseline=outs[i], steered=outs[2 + i]) for i in range(len(SP))]

for s in single:
    s["samples"] = samples([(s["layer"], s["neuron"], s["sign"] * s["dose"])])
    s["promptsHit"] = sum(1 for t in res[(s["layer"], s["neuron"])][s["dose"]]["texts"] if AX.score(axis, t) > AX.score(axis, base40[res[(s["layer"], s["neuron"])][s["dose"]]["texts"].index(t)]) + 0.5 * ML)
for p in pairs:
    if p["works"]:
        p["samples"] = samples([(x["layer"], x["neuron"], x["dose"]) for x in p["neurons"]])

out = dict(axis=axis, label=A["label"], kind=A["kind"], stat0=stat0, baseline=dict(score40=b40, ppl=ppl0, texts=base40),
           minLift=ML, controlsStage1=dict(n=len(ctrl1), top=[round(x, 2) for x in ctrl_best1[:5]],
                                            meanBestLift=sum(ctrl_best1) / len(ctrl_best1)),
           candidates=[dict(layer=c[0], neuron=c[1], **cinfo[c], stage1Best=best1[c]) for c in ranked],
           controlsStage2=[dict(layer=c[0], neuron=c[1], sign=signs[c], byDose={str(d): dict(lift=res[c][d]["lift"], ppl=res[c][d]["ppl"]) for d in DOSES}) for c in ctrl2],
           stage2=[dict(layer=c[0], neuron=c[1], sign=signs[c], d=cinfo[c]["d"], byDose={str(d): dict(lift=res[c][d]["lift"], ppl=res[c][d]["ppl"], sample=res[c][d]["texts"][0]) for d in DOSES}) for c in top6],
           singles=single, pairs=pairs, seconds=time.time() - T0)
json.dump(out, open(os.path.join(SCRATCH, "disc", f"{axis}.json"), "w"), ensure_ascii=False, indent=1)
print(axis, "done", f"{time.time()-T0:.0f}s", "singles", len(single), "pairs ok", sum(p["works"] for p in pairs), flush=True)
