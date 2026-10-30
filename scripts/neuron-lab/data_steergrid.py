"""Dose sweep for up to 10 accepted single-neuron discoveries (one per axis, best lift first): held-out perplexity of
the steered neuron vs 6 random same-layer control neurons (random sign), plus the greedy continuation of one neutral
prompt at every dose.  Writes public/neuron-lab/qwen3-0.6b/steer-grid.json.  Needs data_discover.py outputs."""
import glob, random
from data_common import *
import data_axes as AX

meta = load_meta()
tok, model = load()
S = Steer(model, meta["resNormMedian"], meta["colNorm"])
DOSES = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1.0]
PROMPT = AX.PROMPTS[0]
ids = tok(AX.HELDOUT, return_tensors="pt").input_ids

@torch.no_grad()
def ppl_of(steers):
    S.set([steers]); lg = model(input_ids=ids).logits; S.clear()
    lp = torch.log_softmax(lg[0, :-1], -1).gather(1, ids[0, 1:, None]).squeeze(1)
    return float(torch.exp(-lp.mean()))

picks = []
for f in sorted(glob.glob(os.path.join(SCRATCH, "disc", "*.json"))):
    d = json.load(open(f))
    for s in d["singles"][:3]:   # up to 3 accepted neurons per axis, so a 5-axis run still gives a useful grid
        picks.append((s["lift"] / d["minLift"], d["axis"], d["label"], s))
picks.sort(key=lambda x: -x[0])
picks = picks[:10]
seen = set(); picks = [p for p in picks if not (p[3]["layer"], p[3]["neuron"]) in seen and not seen.add((p[3]["layer"], p[3]["neuron"]))]
rng = random.Random(7)
grid = []
for _, axis, label, s in picks:
    L, n, sg = s["layer"], s["neuron"], s["sign"]
    ctrls = []
    while len(ctrls) < 6:
        m = rng.randrange(NN)
        if m != n and m not in [c[0] for c in ctrls]:
            ctrls.append((m, rng.choice([-1.0, 1.0])))
    rows = []
    texts = generate_rows(tok, model, S, [PROMPT] * len(DOSES), [[(L, n, sg * d)] if d else [] for d in DOSES], 40)
    for d, t in zip(DOSES, texts):
        pp = ppl_of([(L, n, sg * d)] if d else [])
        cp = [ppl_of([(L, m, sc * d)]) if d else pp for m, sc in ctrls]
        rows.append(dict(dose=d, ppl=round(pp, 2), controlPplMin=round(min(cp), 2), controlPplMax=round(max(cp), 2),
                         controlPplMean=round(sum(cp) / len(cp), 2), axisScore=round(AX.score(axis, t), 2), text=t))
    grid.append(dict(axis=axis, label=label, layer=L, neuron=n, signedDoseUnit=sg, prompt=PROMPT,
                     controls=[dict(layer=L, neuron=m, sign=sc) for m, sc in ctrls], rows=rows))
    print(axis, L, n, [r["ppl"] for r in rows], flush=True)
json.dump(dict(model=MODEL, heldout="hand-written 4-sentence paragraph, %d tokens" % ids.shape[1], decoding="greedy, 40 new tokens", grid=grid),
          open(os.path.join(OUT, "steer-grid.json"), "w"), ensure_ascii=False, indent=1)
