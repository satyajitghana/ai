"""Turn $NL_SCRATCH/disc/<axis>.json into public/neuron-lab/<slug>/discoveries.json and <slug>-findings.json.
discoveries.json = accepted items only (single neurons and pairs).  findings.json = every axis, misses included."""
import glob
from data_common import *
import data_axes as AX

meta = load_meta()
DOSES = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5]
lens_cache = {}
def lens(L, n):
    if L not in lens_cache:
        lens_cache[L] = json.load(open(os.path.join(OUT, "layers", f"L{L:02d}.json")))
    return lens_cache[L]["up"][n][:3], lens_cache[L]["down"][n][:3]

def rep_pct(samples, key="steered"):
    """Mean % of repeated word trigrams in the sample texts (data_axes 'repeat' scorer): a high value means the text loops."""
    v = [AX.score("repeat", x[key]) for x in samples]
    return round(sum(v) / max(1, len(v)), 1)

REP_WARN = 30.0
disc, finds = [], []
for f in sorted(glob.glob(os.path.join(SCRATCH, "disc", "*.json"))):
    d = json.load(open(f)); axis = d["axis"]; ppl0 = d["baseline"]["ppl"]; ML = d["minLift"]
    cand = {(c["layer"], c["neuron"]): c for c in d["candidates"]}
    s2 = {(c["layer"], c["neuron"]): c for c in d["stage2"]}
    ctrl_max = {k: max(c["byDose"][k]["lift"] for c in d["controlsStage2"]) for k in map(str, DOSES)}
    ctrl_ppl = {k: [c["byDose"][k]["ppl"] for c in d["controlsStage2"]] for k in map(str, DOSES)}
    for s in d["singles"]:
        k = (s["layer"], s["neuron"]); c = cand[k]; sg = s["sign"]; row = s2[k]["byDose"]
        bad = [x for x in DOSES if row[str(x)]["ppl"] > 3 * ppl0]
        up, dn = lens(*k)
        note = (f"Pushed toward the '{d['label']}' side with a {'positive' if sg > 0 else 'negative'} dose. Lexical lift {s['lift']:.1f} (needs >= {ML}) at dose {s['dose']}, "
                f"against a best random-neuron lift of {ctrl_max[str(s['dose'])]:.1f} at the same dose; held-out perplexity {s['ppl']:.1f} vs {ppl0:.1f} unsteered. "
                f"Visible on {s.get('promptsHit', 0)} of {d.get("nPrompts", len(AX.PROMPTS))} neutral prompts. "
                + (f"Perplexity passes 3x baseline from dose {min(bad)}." if bad else "Perplexity stays under 3x baseline up to dose 0.5.")
                + f" Works at doses {s['okDoses']}. Its column promotes {up}.")
        rp, brp = rep_pct(s["samples"]), rep_pct(s["samples"], "baseline")
        if rp >= REP_WARN and rp - brp >= 10 and axis != "repeat":
            note += f" Caution: the steered samples repeat themselves ({rp}% repeated trigrams against {brp}% unsteered), so part of the lexical lift may come from looping on words in the prompt rather than from the axis."
        disc.append(dict(id=f"{axis}-L{k[0]}N{k[1]}", label=f"{d['label']} - L{k[0]} N{k[1]}", axis=axis, kind="single",
                         neurons=[dict(layer=k[0], neuron=k[1], dose=round(sg * s["dose"], 3))],
                         evidence=dict(repetitionPct=rp, baselineRepetitionPct=brp, contrastScore=round(c["d"], 2), dEven=round(c["d_even"], 2), dOdd=round(c["d_odd"], 2),
                                       lift=round(s["lift"], 2), minLift=ML, perplexity=round(s["ppl"], 2), baselinePerplexity=round(ppl0, 2),
                                       controlScores=dict(bestRandomLiftAtDose=round(ctrl_max[str(s["dose"])], 2), randomPerplexityRange=[round(min(ctrl_ppl[str(s["dose"])]), 1), round(max(ctrl_ppl[str(s["dose"])]), 1)],
                                                          stage1BestRandomLifts=d["controlsStage1"]["top"])),
                         samples=s["samples"], coherenceNote=note))
    for i, p in enumerate(d["pairs"]):
        if not p.get("works"):
            continue
        ns = p["neurons"]
        disc.append(dict(id=f"{axis}-pair-" + "-".join(f"L{x['layer']}N{x['neuron']}" for x in ns), label=f"{d['label']} - pair", axis=axis, kind="pair",
                         neurons=ns, evidence=dict(repetitionPct=rep_pct(p["samples"]), baselineRepetitionPct=rep_pct(p["samples"], "baseline"), lift=round(p["lift"], 2), minLift=ML, perplexity=round(p["ppl"], 2), baselinePerplexity=round(ppl0, 2),
                                                   controlScores=dict(stage1BestRandomLifts=d["controlsStage1"]["top"])),
                         samples=p["samples"],
                         coherenceNote=f"Two working neurons together, each at 0.6x its best single dose. Lexical lift {p['lift']:.1f} (needs >= {ML}), held-out perplexity {p['ppl']:.1f} vs {ppl0:.1f} unsteered."))
    verdict = "works" if d["singles"] else "miss"
    best = d["stage2"][0] if d["stage2"] else None
    finds.append(dict(axis=axis, label=d["label"], kind=d["kind"], verdict=verdict,
                      contrast=dict(setA=d["stat0"]["nA"], setB=d["stat0"]["nB"], topAbsD=round(d["stat0"]["max_abs_d"], 2), randomMeanAbsD=round(d["stat0"]["random_mean_abs_d"], 2),
                                    randomP99AbsD=round(d["stat0"]["random_p99_abs_d"], 2), splitHalfReplicated_top40=d["stat0"]["replicated_top40"]),
                      screened=len(d["candidates"]), controlsStage1=d["controlsStage1"],
                      neurons=[dict(layer=s["layer"], neuron=s["neuron"], dose=round(s["sign"] * s["dose"], 3), lift=round(s["lift"], 2), perplexity=round(s["ppl"], 2)) for s in d["singles"]],
                      topCandidates=[dict(layer=c["layer"], neuron=c["neuron"], d=round(c["d"], 2), dEven=round(c["d_even"], 2), dOdd=round(c["d_odd"], 2), stage1Lift=round(c["stage1Best"], 2)) for c in d["candidates"][:6]],
                      scores=dict(minLift=ML, baselineScore=round(d["baseline"]["score40"], 2), baselinePerplexity=round(ppl0, 2),
                                  bestRandomLiftByDose={k: round(v, 2) for k, v in ctrl_max.items()},
                                  pairsTried=len(d["pairs"]), pairsWorking=sum(1 for p in d["pairs"] if p.get("works"))),
                      samples=(d["singles"][0]["samples"] if d["singles"] else
                               ([dict(prompt=AX.PROMPTS[0], baseline=d["baseline"]["texts"][0], steered=best["byDose"]["0.3"]["sample"], note=f"miss: best screened candidate L{best['layer']} N{best['neuron']} at dose 0.3")] if best else []))))

disc.sort(key=lambda x: (-(x["evidence"]["lift"] / x["evidence"]["minLift"])))
if len(disc) > 80:
    disc = disc[:80]
json.dump(dict(model=MODEL, generated=meta["generated"], decoding="greedy, 40 new tokens, raw text prompts (no chat template)",
               note=f"Tunes found on {MODEL}. 'dose' is signed and already points toward the axis. Every item passed: lexical lift >= minLift, lift above the best of 6 random same-range neurons, held-out perplexity <= 3x baseline.",
               items=disc), open(os.path.join(OUT, "discoveries.json"), "w"), ensure_ascii=False, indent=1)
json.dump(dict(model=MODEL, generated=meta["generated"],
               pipeline="scripts/neuron-lab/data_discover.py: token-level d' contrast over hand-written sets, top-32 (top-16 on the lighter 0.8B screen, see each axis' screened/nPrompts) screened by steering at doses 0.15/0.3 against 32 random controls, top-6 validated at 6 doses with 6 fresh controls and held-out perplexity.",
               axes=finds), open(FINDINGS, "w"), ensure_ascii=False, indent=1)
print(len(disc), "discoveries;", {f["axis"]: f["verdict"] for f in finds})
