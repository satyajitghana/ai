import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, math, os
import sys as _sys, os as _os; _sys.path.insert(0, _o.path.join(GEN, 'gen-gt')); from enrich_gt import enrich  # plain, proof, voice, visualised equations
OUT = _OUT
D = 'Differential geometry'
S = '../../brand-crew/skills/math-reels/schema.json'

def spec(id, kind, short, title, sub, obj, ach, ver, src):
    s = {"$schema": S, "id": id, "discipline": D, "kind": kind, "short": short,
         "title": {"title": title, "subtitle": sub}, "object": obj, "achievement": ach,
         "verify": ver, "sources": [{"ref": r, "quote": q} for r, q in src]}
    with open(os.path.join(OUT, id + '.json'), 'w') as f:
        json.dump(enrich(s), f, indent=2, ensure_ascii=False); f.write('\n')

def R(id, field): return f'review {id}, {field}'
A = 'article, Geometry and topology'

# ---------------------------------------------------------------- 348
spec('348', 'proof', 'Positively curved Einstein 4-manifolds',
  'Positively curved Einstein 4-manifolds are the three models',
  "Claim: a closed Einstein 4-manifold with $\\sec > 0$ is round $S^4$, round $\\mathbb{RP}^4$ or Fubini–Study $\\mathbb{CP}^2$",
  {"dur": 8.4, "heading": "How the classification is assembled",
   "primitive": "tree", "at": 0.4,
   "nodes": [
     {"id": "r", "label": "$\\sec>0$ Einstein: $S^4$, $\\mathbb{RP}^4$ or $\\mathbb{CP}^2$", "status": "lean"},
     {"id": "p", "label": "curvature parallel, so a symmetric model", "parent": "r", "status": "lean"},
     {"id": "w", "label": "one Weyl block vanishes", "parent": "p", "status": "lean"},
     {"id": "m", "label": "equal second moments", "parent": "w", "status": "lean"},
     {"id": "c", "label": "exact sign certificates", "parent": "w", "status": "lean"}],
   "beats": [
     {"at": 0.2, "text": "A volume argument forces the two Weyl blocks to have equal second moments"},
     {"at": 3.2, "text": "Exact polynomial certificates then force one block to vanish"},
     {"at": 5.9, "text": "Then the curvature is parallel, and the manifold is one of the models"}]},
  {"form": "status", "label": "Conjecture of D. Yang (2000)",
   "statement": ["\\sec > 0,\\ \\mathrm{Ric} = \\lambda g \\;\\Rightarrow\\; M \\cong S^4,\\ \\mathbb{RP}^4,\\ \\mathbb{CP}^2"],
   "context": "Before: every result needed extra pinching or topology (Gursky–LeBrun, Cao–Tran, Gursky–Malchiodi)",
   "stamp": "proved",
   "note": "The $\\sec \\ge 0$ extension and the $L^2$ gap theorem are paper-only"},
  {"lean": "part", "detail": "Lean: the $\\sec > 0$ classification, about 209,000 lines. Not the extension or the gap",
   "ourCheck": "We read the Comparator statement; we did not build the Lean"},
  [(R('348', 'claim'), "Closed Einstein 4-manifolds with positive sectional curvature are, up to scaling, round S^4, round RP^4 or Fubini-Study CP^2 (Yang's conjecture)"),
   (R('348', 'known_before'), "D. Yang (Invent. 2000) Conjecture 1"),
   ('article, Positively curved Einstein 4-manifolds', "Every earlier result needed extra pinching or topology (Gursky–LeBrun, Cao–Tran, Gursky–Malchiodi)"),
   ('article, Positively curved Einstein 4-manifolds', "a volume argument forces their second moments to be equal"),
   ('article, Positively curved Einstein 4-manifolds', "moment balance and exact polynomial sign certificates force one Weyl block to vanish, then the curvature is parallel and the manifold is a model"),
   ('article, Positively curved Einstein 4-manifolds', "The positive-curvature classification is in Lean (`OAI/Geometry/EinsteinFour`, about 209,000 lines, the largest formalization in this group)"),
   ('article, Positively curved Einstein 4-manifolds', "which openly takes that classification as a stated assumption, are paper-only"),
   (R('348', 'caveats'), "I did not build the Lean library (no compilation allowed), so 'formalized' means the release ships a sorry-free, axiom-free (propext/Quot.sound/Classical.choice only) proof whose Comparator statement I read")])

# ---------------------------------------------------------------- 349
spec('349', 'proof', 'Solomon–Yau least volume',
  'The Solomon–Yau least-volume conjecture',
  'Claim: after the equator, the least-volume minimal hypersurface of a round sphere is a Clifford product',
  {"dur": 8.4, "layout": "sequence", "panels": [
     {"primitive": "shape", "until": 4.2, "shapes": [
        {"kind": "circle", "r": 1, "tone": "soft", "fill": False, "label": "$S^{m+1}$", "labelAt": [0.98, 0.9], "at": 0.2},
        {"kind": "ellipse", "rx": 1, "ry": 0.26, "tone": "mute", "dash": True, "label": "equator", "labelAt": [0, -0.42], "at": 0.9},
        {"kind": "ellipse", "rx": 0.62, "ry": 0.16, "c": [0, 0.5], "tone": "accent", "label": "", "at": 2.0},
        {"kind": "ellipse", "rx": 0.62, "ry": 0.16, "c": [0, -0.5], "tone": "accent", "label": "", "at": 2.0}]},
     {"primitive": "equation", "from": 4.2, "lines": [
        {"tex": "a_m = \\min_k \\mathrm{vol}\\Big(S^k\\big(\\sqrt{k/m}\\big) \\times S^{m-k}\\big(\\sqrt{(m-k)/m}\\big)\\Big)", "tone": "ink", "at": 0.3, "size": 40}]}],
   "beats": [
     {"at": 0.2, "text": "Schematically: the equator is the smallest minimal hypersurface of a round sphere"},
     {"at": 2.6, "text": "The candidates for second place are the Clifford products of two round spheres"},
     {"at": 4.6, "text": "The claim: every other minimal hypersurface has volume at least the smallest one, $a_m$"}]},
  {"form": "status", "label": "Solomon–Yau conjecture (Yau's problem list)",
   "statement": ["\\mathrm{vol}(\\Sigma^m) \\ge a_m \\text{ unless } \\Sigma \\text{ is an equator}"],
   "context": "Before: only $m = 2$, from Marques–Neves's proof of the Willmore conjecture",
   "stamp": "proved",
   "note": "Min-max regularity in high dimensions is the delicate part"},
  {"lean": "none", "detail": "No Lean: a 32-page manuscript",
   "ourCheck": "We read the paper's strategy; we did not check the min-max argument"},
  [(R('349', 'claim'), "every closed connected minimal immersion into S^{m+1} with non-totally-geodesic image has volume (with multiplicity) at least a_m = min_k vol(Clifford product C_{k,m-k})"),
   ('article, The Solomon–Yau least-volume conjecture', "The equator is the smallest minimal hypersurface of a round sphere"),
   ('article, The Solomon–Yau least-volume conjecture', "The conjecture names the smallest minimal Clifford product $S^k(\\sqrt{k/m}) \\times S^{m-k}(\\sqrt{(m-k)/m})$"),
   ('article, The Solomon–Yau least-volume conjecture', "Marques and Neves settled $m = 2$ through the Willmore conjecture"),
   ('article, The Solomon–Yau least-volume conjecture', "Min-max regularity in high dimensions is the delicate part. 32 pages, no Lean.")])

# ---------------------------------------------------------------- 350
spec('350', 'disproof', "Yau's nodal conjecture, both ways",
  "Yau's nodal upper bound: true on surfaces, false above",
  'Claim: nodal length is at most $C\\sqrt\\lambda$ on every smooth surface; smooth metrics beat it in dimensions 3 and up',
  {"dur": 8.4, "primitive": "plot",
   "x": [0, 100], "y": [0, 36], "xlabel": "eigenvalue $\\lambda$", "ylabel": "nodal measure", "labelRoom": 230,
   "curves": [
     {"f": "pow(x,0.75)", "label": "$\\lambda^{3/4}$: old surface bound", "tone": "mute", "dash": True, "at": 0.5},
     {"f": "sqrt(x)", "label": "$C\\sqrt\\lambda$: Yau", "tone": "accent", "at": 1.4},
     {"f": "pow(x,0.62)", "label": "$\\lambda^{1/2+\\varepsilon_0}$", "tone": "hot", "at": 5.6}],
   "regions": [{"f": "pow(x,0.75)", "f2": "sqrt(x)", "at": 3.0, "tone": "accent"}],
   "beats": [
     {"at": 0.2, "text": "Yau: the zero set of $-\\Delta u = \\lambda u$ has measure about $\\sqrt\\lambda$ (curves schematic)"},
     {"at": 3.0, "text": "On every smooth surface the release closes the gap down to $C\\sqrt\\lambda$"},
     {"at": 5.6, "text": "On $S^3$ and $S^2 \\times T^2$ it fails; on $S^4 \\times S^1$ by a fixed power"}]},
  {"form": "status", "label": "Yau's nodal conjecture (1982), for smooth metrics",
   "statement": ["n = 2:\\quad \\mathcal H^1(\\{u = 0\\}) \\le C(M,g)\\sqrt\\lambda",
                 "n \\ge 3:\\quad \\mathcal H^{n-1}(\\{u = 0\\})/\\sqrt\\lambda \\to \\infty \\text{ is possible}"],
   "context": "Before: analytic metrics only (Donnelly–Fefferman, 1988); smooth surfaces had $\\lambda^{3/4-\\beta}$",
   "stamp": "disproved",
   "note": "Analytic metrics and the lower bound are untouched"},
  {"lean": "main", "detail": "All three directions are Comparator challenges with sorry-free solutions",
   "ourCheck": "We read the Comparator statements; we did not build the Lean"},
  [(R('350', 'known_before'), "Yau's problem section (1982). Donnelly-Fefferman (Invent. 1988): both bounds for real-analytic metrics"),
   (R('350', 'known_before'), "surfaces upper bound C lambda^{3/4} (Donnelly-Fefferman, Dong), improved to lambda^{3/4 - beta} by Logunov-Malinnikova"),
   (R('350', 'claim'), "(i) on every smooth closed surface, H^1(zero set) <= C(M,g) sqrt(lambda)"),
   (R('350', 'claim'), "(ii) fixed smooth metrics on S^3 (arbitrarily C-infinity close to round) and on S^2 x T^2 with eigenfunctions whose nodal measure / sqrt(lambda) -> infinity; (iii) a fixed smooth metric on S^4 x S^1 with nodal measure >> lambda^{1/2 + eps_0}"),
   (R('350', 'caveats'), "Counterexamples are for smooth (non-analytic) metrics only; Donnelly-Fefferman remains for analytic metrics. Lower bound untouched (Logunov)."),
   (A, "All three directions are Comparator challenges with sorry-free solutions"),
   (R('350', 'caveats'), "I did not build the Lean library (no compilation allowed)")])

# ---------------------------------------------------------------- 351
spec('351', 'proof', 'Bounded scalar curvature and Ricci flow',
  'Does bounded scalar curvature keep Ricci flow alive?',
  'Claim: yes in dimension 4, where the flow extends; no in high dimensions, where it can still blow up',
  {"dur": 8.4, "primitive": "plot",
   "x": [0, 1], "y": [0, 10], "xlabel": "time $t$", "ylabel": "curvature", "labelRoom": 200,
   "xticks": [{"v": 0, "label": "0"}, {"v": 1, "label": "$T$"}],
   "asymptotes": [{"x": 1, "at": 0.4}],
   "curves": [
     {"f": "1.6+0.25*sin(9*x)", "label": "scalar $R$", "tone": "accent", "at": 0.6, "dur": 1.8},
     {"f": "0.35/(1.003-x)", "label": "$|\\mathrm{Rm}|$", "tone": "hot", "at": 2.8, "dur": 1.8}],
   "beats": [
     {"at": 0.2, "text": "Schematically: watch the scalar curvature $R$ as the flow runs toward time $T$"},
     {"at": 2.8, "text": "A flow can only stop when the full curvature $|\\mathrm{Rm}|$ blows up"},
     {"at": 5.4, "text": "Claim: in dimension 4 bounded $R$ rules that out; in high dimensions it does not"}]},
  {"form": "status", "label": "The scalar-curvature extension question",
   "statement": ["\\dim 4:\\ \\sup |R| < \\infty \\;\\Rightarrow\\; \\text{the flow extends past } T",
                 "\\text{high dim}:\\ \\sup |R| < \\infty \\text{ but } |\\mathrm{Rm}| \\to \\infty"],
   "context": "Before: bounded Ricci curvature suffices (Sesum, 2005)",
   "stamp": "proved",
   "note": "Dimension 4 rests on a companion inequality on Ricci-flat trees"},
  {"lean": "none", "detail": "No Lean: 118 pages across three papers",
   "ourCheck": "We read the papers' strategy; we did not check the proofs"},
  [(R('351', 'claim'), "(i) A smooth Ricci flow on a closed 4-manifold with uniformly bounded scalar curvature on [0,T) extends smoothly past T. (ii) In some dimension (q >= 10 parameter), a closed Ricci flow has bounded scalar curvature but unbounded full curvature at a finite singular time"),
   (R('351', 'known_before'), "Sesum (2005, Ricci bound suffices)"),
   (R('351', 'explainer'), "Ricci flow can only stop when curvature blows up; is it enough to watch the scalar curvature?"),
   (R('351', 'caveats'), "118 pages across three papers; the 4d theorem relies on the companion tree inequality"),
   ('article, Bounded scalar curvature and Ricci flow', "Bamler and Zhang developed the theory under scalar bounds")])

# ---------------------------------------------------------------- 352
spec('352', 'counterexample', 'A finite-time singularity of Calabi flow',
  'Calabi flow can blow up in finite time',
  'Claim: a $U(10)$-invariant metric on $\\mathbb{CP}^{10}$ whose Calabi flow develops a point singularity',
  {"dur": 8.4, "primitive": "plot",
   "x": [0, 1], "y": [0, 10], "xlabel": "time $t$", "ylabel": "scalar curvature at a point", "labelRoom": 230,
   "xticks": [{"v": 0, "label": "0"}, {"v": 1, "label": "$T_*$"}],
   "asymptotes": [{"x": 1, "at": 2.6}],
   "curves": [
     {"f": "1/sqrt(1.0001-x)", "label": "$a\\,(T_*-t)^{-1/2}$", "tone": "hot", "at": 3.0, "dur": 2.0}],
   "beats": [
     {"at": 0.2, "text": "Calabi flow, fourth order, should carry any Kähler metric toward a canonical one"},
     {"at": 2.6, "text": "Chen conjectured it exists for all time. Here it stops at a finite time $T_*$"},
     {"at": 5.4, "text": "Scalar curvature grows like $(T_*-t)^{-1/2}$, though the class holds Fubini–Study"}]},
  {"form": "status", "label": "Chen's long-time existence conjecture for Calabi flow",
   "statement": ["\\exists\\, g_0 \\text{ on } \\mathbb{CP}^{10}:\\ T_* < \\infty,\\ R \\sim a\\,(T_* - t)^{-1/2}"],
   "context": "Products give examples in every complex dimension from 10 up, in classes with Kähler–Einstein metrics",
   "stamp": "counterexample",
   "note": "Only in complex dimension 10 and up; 54 pages, no Lean"},
  {"lean": "none", "detail": "No Lean: a 54-page manuscript, reduced by symmetry to one radial variable",
   "ourCheck": "We read the paper's strategy; we did not check the proof"},
  [(R('352', 'claim'), "There is a smooth U(10)-invariant Kaehler metric on CP^10 in the Fubini-Study class whose Calabi flow has a finite maximal existence time T* with scalar curvature at a point ~ a (T* - t)^{-1/2}; products give examples in every complex dimension >= 10 in classes with Kaehler-Einstein metrics."),
   ('article, A finite-time singularity of Calabi flow', "Chen conjectured that the Calabi flow, a fourth-order flow toward constant scalar curvature, exists for all time from any smooth Kähler metric"),
   ('article, A finite-time singularity of Calabi flow', "Symmetry reduces the problem to one radial variable; products give examples in every complex dimension from 10 up. 54 pages, no Lean.")])

# ---------------------------------------------------------------- 353
spec('353', 'proof', 'Affine Bernstein through dimension 9',
  'Affine Bernstein: rigid through dimension 9, not in 10',
  'Claim: entire affine-maximal graphs are quadratic for $3 \\le n \\le 9$, and a smooth nonquadratic one exists for $n = 10$',
  {"dur": 8.4, "primitive": "numberline",
   "min": 1, "max": 11, "y": 0.6, "ticks": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
   "axisLabel": "the dimension $n$ of the graph's domain",
   "markers": [
     {"v": 2, "label": "Trudinger–Wang", "note": "2000, rigid", "at": 0.6},
     {"v": 10, "label": "singular example", "note": "Trudinger–Wang", "at": 1.4, "side": "below", "style": "ring"},
     {"v": 10, "label": "smooth example", "note": "claimed, $n = 10$", "tone": "hot", "at": 5.4}],
   "ranges": [{"from": 3, "to": 9, "label": "claimed: quadratic", "note": "$3 \\le n \\le 9$", "tone": "claim", "at": 3.0}],
   "beats": [
     {"at": 0.2, "text": "Chern asked: must an entire convex affine-maximal graph be quadratic?"},
     {"at": 3.0, "text": "The claim: yes in every dimension from 3 to 9, under Euclidean completeness"},
     {"at": 5.4, "text": "And a smooth nonquadratic graph in 10, so the answer flips exactly there"}]},
  {"form": "status", "label": "Chern's affine Bernstein problem (1977)",
   "statement": ["3 \\le n \\le 9:\\ \\text{entire affine-maximal graph} \\Rightarrow \\text{quadratic}",
                 "n = 10:\\ \\text{a smooth nonquadratic example}"],
   "context": "Before: dimension 2 (Calabi; Trudinger–Wang, 2000) and a singular example in dimension 10",
   "stamp": "proved",
   "note": "Much as the classical Bernstein problem flips at 8"},
  {"lean": "main", "detail": "Lean: dimensions 3 to 9, about 41,000 lines. Not the dimension-10 example",
   "ourCheck": "We read the Comparator statement; we did not build the Lean"},
  [(R('353', 'known_before'), "Chern's affine Bernstein problem (1977); Calabi (dim 2 with both completenesses); Trudinger-Wang (Invent. 2000): Euclidean-complete dim 2, reduction in all dims to a uniform strict-convexity modulus, and the singular dim-10 example"),
   (R('353', 'claim'), "3 <= n <= 9, complete for the induced Euclidean metric, is an elliptic paraboloid (entire, quadratic)"),
   (R('353', 'claim'), "Sharp: a smooth entire nonquadratic affine-maximal graph exists in R^10."),
   ('article, Affine Bernstein in dimensions 3 to 9', "so the answer flips exactly at 10, much as the classical Bernstein problem flips at 8"),
   ('article, Affine Bernstein in dimensions 3 to 9', "The dimensions 3 to 9 theorem is in Lean (about 41,000 lines); the dimension-10 example is a 30-page ODE argument that is not."),
   (R('353', 'caveats'), "I did not build the Lean library (no compilation allowed)")])

# ---------------------------------------------------------------- 354
c = (36 * math.pi) ** (1 / 3)
ball = "pow(36*PI,1/3)*pow(x,2/3)"; tube = "2*sqrt(PI*x)"
prof = f"min({ball},{tube},2)"
v1, v2 = 4 * math.pi / 81, 1 / math.pi
spec('354', 'proof', 'Isoperimetry in the cubic three-torus',
  'Ball, tube, slab: the isoperimetric profile of the cubic 3-torus',
  'Claim: least-area regions in $\\mathbb R^3/\\mathbb Z^3$ are balls, then round tubes, then slabs, as the volume grows',
  {"dur": 8.6, "primitive": "plot",
   "x": [0, 0.5], "y": [0, 2.6], "xlabel": "enclosed volume $v$", "ylabel": "least area", "labelRoom": 170,
   "xticks": [{"v": 0, "label": "0"}, {"v": v1, "label": "$4\\pi/81$"}, {"v": v2, "label": "$1/\\pi$"}, {"v": 0.5, "label": "$1/2$"}],
   "yticks": [{"v": 2, "label": "2"}],
   "curves": [
     {"f": ball, "label": "", "tone": "mute", "dash": True, "at": 0.5, "to": 0.165, "dur": 1.0},
     {"f": tube, "label": "", "tone": "mute", "dash": True, "at": 1.1, "from": 0.12, "to": 0.335, "dur": 1.0},
     {"f": "2", "label": "", "tone": "mute", "dash": True, "at": 1.7, "from": 0.27, "dur": 1.0},
     {"f": prof, "label": "slab", "tone": "accent", "at": 3.0, "dur": 2.2}],
   "points": [
     {"x": v1, "y": c * v1 ** (2 / 3), "label": "ball, then tube", "at": 4.0, "tone": "hot"},
     {"x": v2, "y": 2, "label": "tube, then slab", "at": 4.8, "tone": "hot"}],
   "beats": [
     {"at": 0.2, "text": "Three shapes compete: a ball, a tube around a shortest loop, a slab between two faces"},
     {"at": 3.0, "text": "The profile is the lowest of the three: $\\min\\{(36\\pi)^{1/3}v^{2/3},\\ 2\\sqrt{\\pi v},\\ 2\\}$"},
     {"at": 5.8, "text": "The switches happen at $4\\pi/81$ and $1/\\pi$, where both shapes minimize"}]},
  {"form": "status", "label": "Ball–tube–slab conjecture (Hauswirth–Pérez–Romon–Ros, 2004)",
   "statement": ["I(V) = \\min\\{(36\\pi)^{1/3}v^{2/3},\\ 2\\sqrt{\\pi v},\\ 2\\}",
                 "v = \\min(V,\\,1-V)"],
   "context": "Before: small volumes (Morgan–Johnson) and near half volume (Acerbi–Fusco–Morini) only",
   "stamp": "proved",
   "note": "Higher-genus competitors are excluded by reflection symmetry"},
  {"lean": "main", "detail": "Lean: the full classification, equality cases included, about 141,000 lines",
   "ourCheck": "We read the Comparator statement; we did not build the Lean"},
  [(R('354', 'claim'), "In the unit cubic flat torus R^3/Z^3 the isoperimetric profile is min{(36 pi)^{1/3} v^{2/3}, 2 sqrt(pi v), 2} with v = min(V,1-V); minimizers are exactly balls (V <= 4 pi/81), round tubes about shortest geodesics (4 pi/81 <= V <= 1/pi), slabs (1/pi <= V <= 1/2) and complements, with both types at the transitions."),
   (R('354', 'known_before'), "Ball-cylinder-slab conjecture stated by Hauswirth-Perez-Romon-Ros (2004) and Ros"),
   (R('354', 'known_before'), "Morgan-Johnson (small volumes); Acerbi-Fusco-Morini (near half volume)"),
   (A, "Higher-genus competitors are excluded with reflection symmetry and curvature-area estimates. The full classification, equality cases included, is in Lean (`OAI/Geometry/CubicTorus`, about 141,000 lines)"),
   (R('354', 'caveats'), "I did not build the Lean library (no compilation allowed)")])

# ---------------------------------------------------------------- 355
def dumbbell(neck, N=60):
    top = []
    for i in range(N + 1):
        x = -1.12 + 2.24 * i / N
        a = abs(x)
        if a <= 0.62:
            y = neck + (0.5 - neck) * (1 - math.cos(math.pi * a / 0.62)) / 2
        else:
            y = 0.5 * math.sqrt(max(0.0, 1 - ((a - 0.62) / 0.5) ** 2))
        top.append([round(x, 4), round(max(y, 0.004), 4)])
    bot = [[q[0], -q[1]] for q in reversed(top)]
    return top + bot
spec('355', 'partial', 'Unique tangent flows for surface MCF',
  'Unique tangent flows at the first surface singularity',
  'Claim: zooming in on a first singularity of mean curvature flow in $\\mathbb R^3$ gives one limit, whatever the model',
  {"dur": 8.4, "layout": "sequence", "panels": [
     {"primitive": "shape", "until": 4.6, "scale": 1.05, "shapes": [
        {"kind": "polygon", "points": dumbbell(0.2), "tone": "accent", "at": 0.2, "dur": 1.2,
         "morph": {"kind": "polygon", "points": dumbbell(0.012), "at": 1.8, "dur": 2.0}}],
      "points": [{"p": [0, 0], "label": "singular point", "at": 3.6, "tone": "hot"}]},
     {"primitive": "shape", "from": 4.6, "shapes": [
        {"kind": "polygon", "points": [[-1.1, 0.34], [1.1, 0.34], [1.1, -0.34], [-1.1, -0.34]], "tone": "accent", "label": "one self-shrinker", "labelAt": [0, 0], "at": 0.2, "dur": 1.0}]}],
   "beats": [
     {"at": 0.2, "text": "Schematically: a closed surface shrinks by mean curvature and pinches at a point"},
     {"at": 3.0, "text": "Zoom in at the singular point; different zoom sequences could give different limits"},
     {"at": 5.4, "text": "The claim: they converge to one self-shrinker, even one with mixed ends"}]},
  {"form": "status", "label": "Uniqueness of tangent flows for surfaces in space",
   "statement": ["\\text{the tangent flow at } (x_0, T) \\text{ is unique}"],
   "context": "Before: compact, cylindrical (Colding–Minicozzi, 2015) and conical (Chodosh–Schulze, 2021) models, separately",
   "stamp": "partial",
   "note": "Only at the first singular time and a fixed centre"},
  {"lean": "none", "detail": "No Lean: 100 pages of Lojasiewicz-type analysis, hard to check",
   "ourCheck": "We read the paper's strategy; we did not check the proof"},
  [(R('355', 'claim'), "at every singular point at the first singular time the fixed-centre rescalings converge smoothly with multiplicity one to a unique self-shrinker S"),
   (R('355', 'known_before'), "Colding-Minicozzi (Annals 2015: cylinders); Chodosh-Schulze (Duke 2021: asymptotically conical)"),
   (R('355', 'caveats'), "Restricted to the first singular time and fixed centre; uniqueness for general shrinkers with mixed ends (cylindrical + conical) is what is new. 100 pages of Lojasiewicz-type analysis"),
   ('article, Unique tangent flows at the first surface singularity', "Zooming in on a singularity of mean curvature flow gives a tangent flow, but different zoom sequences could a priori give different limits")])

# ---------------------------------------------------------------- 356
spec('356', 'proof', "Gigli's characterization of Alexandrov",
  "Gigli's characterization of Alexandrov curvature",
  "Claim: an $n$-dimensional space is Alexandrov with curvature $\\ge \\kappa$ iff it is RCD with Gigli's curvature $\\ge \\kappa$",
  {"dur": 8.4, "primitive": "venn",
   "sets": [{"label": "$\\mathrm{RCD}((n-1)\\kappa, n)$", "tone": "cool", "at": 0.3},
            {"label": "Gigli's $\\mathrm{Sec} \\ge \\kappa$", "tone": "warn", "at": 1.0}],
   "regions": [{"set": "A&B", "label": "Alexandrov", "at": 4.4}],
   "beats": [
     {"at": 0.2, "text": "Schematically: spaces with a synthetic Ricci lower bound, and with Gigli's curvature bound"},
     {"at": 4.0, "text": "The claim: the overlap is exactly the Alexandrov spaces with curvature $\\ge \\kappa$"}]},
  {"form": "status", "label": "Gigli's conjecture (2018 memoir)",
   "statement": ["\\mathrm{Alex}^n(\\kappa) \\iff \\mathrm{RCD}((n-1)\\kappa, n)", "\\text{with } \\mathcal H^n \\text{ and } \\mathrm{Sec}_{\\mathrm{Gigli}} \\ge \\kappa"],
   "context": "Before: Alexandrov spaces are RCD (Petrunin); the converse was Gigli's conjecture",
   "stamp": "proved",
   "note": "For integer $n \\ge 2$"},
  {"lean": "part", "detail": "Lean: only the lemma that weak Hessian bounds hold along every geodesic",
   "ourCheck": "We read the Comparator statement; we did not build the Lean"},
  [(R('356', 'claim'), "(M,d) is an n-dimensional Alexandrov space with curvature >= kappa iff it is RCD((n-1)kappa, n) with reference measure H^n, full support, and Gigli's distributional sectional curvature >= kappa"),
   (R('356', 'known_before'), "Gigli's nonsmooth differential geometry (2018 memoir) and his conjecture; Petrunin (Alexandrov spaces are RCD)"),
   ('article, Technical results', "the lemma that weak Hessian bounds hold along every geodesic is in Lean"),
   (R('356', 'caveats'), "I did not build the Lean library (no compilation allowed)")])

# ---------------------------------------------------------------- 357
blob = [[math.cos(t) * (0.82 + 0.16 * math.sin(3 * t) + 0.08 * math.cos(5 * t)), math.sin(t) * (0.82 + 0.16 * math.sin(3 * t) + 0.08 * math.cos(5 * t))]
        for t in [2 * math.pi * i / 60 for i in range(60)]]
blob = [[round(a, 4), round(b, 4)] for a, b in blob]
spec('357', 'proof', 'Bi-Lipschitz charts at regular RCD points',
  'Bi-Lipschitz coordinates at every regular RCD point',
  'Claim: each regular point of a noncollapsed $\\mathrm{RCD}(K,n)$ space has an $L_n$-bi-Lipschitz chart into $\\mathbb R^n$',
  {"dur": 8.4, "primitive": "shape", "shapes": [
      {"kind": "polygon", "points": blob, "tone": "accent", "at": 0.3, "dur": 1.4, "label": "neighbourhood $U$", "labelAt": [0, 0.15],
       "morph": {"kind": "circle", "r": 0.82, "at": 3.4, "dur": 2.0}}],
   "points": [{"p": [0, -0.2], "label": "regular point $x$", "at": 1.6, "tone": "hot"}],
   "beats": [
     {"at": 0.2, "text": "Schematically: near a regular point, every zoom of the space looks like $\\mathbb R^n$"},
     {"at": 3.2, "text": "The claim: a whole neighbourhood maps to $\\mathbb R^n$ with distances distorted at most $L_n$"},
     {"at": 6.0, "text": "The constant $L_n$ depends only on the dimension"}]},
  {"form": "status", "label": "Question of Cheeger–Colding (Remark 5.15)",
   "statement": ["x \\text{ regular} \\;\\Rightarrow\\; \\text{some } U \\ni x", "\\text{is } L_n\\text{-bi-Lipschitz to an open } V \\subset \\mathbb R^n"],
   "context": "Before: bi-Hölder manifold neighbourhoods (Cheeger–Colding)",
   "stamp": "proved",
   "note": "Hence a full-measure open manifold region with a bi-Lipschitz atlas"},
  {"lean": "none", "detail": "No catalogued Lean result; an in-progress development of about 2,900 files",
   "ourCheck": "We read the paper's strategy; we did not check the proof"},
  [(R('357', 'claim'), "Every n-regular point (all tangents Euclidean) of a noncollapsed RCD(K,n) space with reference measure H^n has a neighbourhood L_n-bi-Lipschitz to an open subset of R^n, with L_n depending only on n; hence a full-measure open manifold region with a bi-Lipschitz atlas."),
   (R('357', 'known_before'), "Cheeger-Colding (bi-Hoelder manifold neighbourhoods; Remark 5.15 asks for bi-Lipschitz)"),
   ('article, Technical results', "A large in-progress Lean development (about 2,900 files) exists without a catalogued result.")])

# ---------------------------------------------------------------- 358
spec('358', 'counterexample', 'No conjugate points, no $\\sec \\le 0$',
  'A 3-manifold without conjugate points or nonpositive curvature',
  'Claim: a closed 3-manifold has a metric whose geodesics never refocus, but no metric with $\\sec \\le 0$',
  {"dur": 8.4, "primitive": "venn",
   "sets": [{"label": "no conjugate points", "tone": "accent", "at": 0.3},
            {"label": "$\\sec \\le 0$", "tone": "cool", "at": 1.0}],
   "regions": [{"set": "A&!B", "label": "", "at": 4.2}],
   "members": [{"x": 0.31, "y": 0.5, "label": "Leeb's manifold", "at": 4.6, "tone": "hot"}],
   "beats": [
     {"at": 0.2, "text": "Closed 3-manifolds, schematically. Nonpositive curvature implies no conjugate points"},
     {"at": 3.0, "text": "Asked: does every manifold on the left also admit nonpositive curvature?"},
     {"at": 5.4, "text": "No: Leeb's graph manifold carries a metric whose geodesics never refocus"}]},
  {"form": "status", "label": "Question of Ivanov–Kapovitch (2014) and Burns–Matveev",
   "statement": ["\\exists\\, M^3 \\text{ closed, with no conjugate points,}", "\\text{but no metric with } \\sec \\le 0"],
   "context": "Leeb (1995) ruled out $\\sec \\le 0$; the new part is the metric without conjugate points",
   "stamp": "counterexample",
   "note": "It also has no metric without focal points"},
  {"lean": "main", "detail": "Lean: the main theorem, about 25,000 lines",
   "ourCheck": "We read the Comparator statement; we did not build the Lean"},
  [(R('358', 'known_before'), "Ivanov-Kapovitch (J. Differential Geom. 2014) Questions 1.1/8.1"),
   (R('358', 'known_before'), "Leeb (Invent. 1995) obstruction for graph manifolds"),
   (R('358', 'claim'), "with a smooth metric without conjugate points but no metric of nonpositive sectional curvature"),
   (R('358', 'claim'), "and no metric without focal points"),
   (A, "The manifold is a two-piece graph manifold that Leeb already showed cannot be nonpositively curved; the new work is a metric on it whose geodesics never refocus. In Lean (about 25,000 lines)."),
   (R('358', 'caveats'), "I did not build the Lean library (no compilation allowed)")])

# ---------------------------------------------------------------- 359
spec('359', 'counterexample', 'Negative Kähler curvature, no bounded chart',
  'Negative Kähler curvature, no bounded holomorphic coordinates',
  'Claim: a contractible domain in $\\mathbb C^3$ with pinched negative Kähler curvature that is not a bounded domain',
  {"dur": 8.4, "primitive": "venn",
   "sets": [{"label": "pinched negative", "tone": "accent", "at": 0.3},
            {"label": "bounded domains", "tone": "cool", "at": 1.0}],
   "regions": [{"set": "A&!B", "label": "", "at": 4.4}],
   "members": [{"x": 0.31, "y": 0.5, "label": "$M \\subset \\mathbb C^3$", "at": 4.8, "tone": "hot"}],
   "beats": [
     {"at": 0.2, "text": "In one complex dimension such curvature forces the disc"},
     {"at": 2.8, "text": "Wu and Yau conjectured: contractible and pinched negative means a bounded domain"},
     {"at": 5.4, "text": "The claim: this domain has no bounded holomorphic coordinate system"}]},
  {"form": "status", "label": "Wu–Yau conjecture (H. Wu's uniformization question)",
   "statement": ["-B \\le \\sec \\le -A < 0 \\;\\not\\Rightarrow\\; M \\cong \\text{a bounded domain}"],
   "context": "Before: compact negatively curved examples not covered by the ball (Mostow–Siu, Deraux)",
   "stamp": "counterexample",
   "note": "The example still has two bounded coordinates; it lacks a full system"},
  {"lean": "main", "detail": "Lean: the pinched threefold, about 18,800 lines. Not the higher-dimensional companion",
   "ourCheck": "We read the Comparator statement; we did not build the Lean"},
  [(R('359', 'claim'), "There is a contractible Stein domain M in C^3 with a complete Kaehler metric with -B <= sec <= -A < 0, but no bounded holomorphic map M -> C^3 with nonvanishing Jacobian"),
   (R('359', 'known_before'), "Mostow-Siu and Deraux (compact negatively curved surfaces/threefolds not covered by the ball)"),
   (R('359', 'caveats'), "The example still has two bounded coordinates; the obstruction is to a full bounded coordinate system."),
   ('article, Negative Kähler curvature without bounded coordinates', "The pinched example is in Lean (`OAI/Geometry/Kahler`, about 18,800 lines)."),
   (R('359', 'caveats'), "I did not build the Lean library (no compilation allowed)")])

# ---------------------------------------------------------------- 360
convex = [[round(math.cos(t) * 0.95 + 0.06 * math.cos(2 * t), 4), round(math.sin(t) * 0.7, 4)] for t in [2 * math.pi * i / 72 for i in range(72)]]
spec('360', 'proof', 'Weak MTW: convex injectivity domains',
  'Weak MTW curvature makes injectivity domains convex',
  "Claim: under weak MTW every tangent injectivity domain is convex, and optimal transport maps are bi-Hölder",
  {"dur": 8.4, "primitive": "shape", "axes": True, "shapes": [
      {"kind": "polygon", "points": convex, "tone": "accent", "at": 0.4, "dur": 1.6, "label": "$I(x) \\subset T_xM$", "labelAt": [0.05, -0.45]},
      {"kind": "polygon", "points": [[-0.62, -0.38], [0.7, 0.42]], "tone": "hot", "fill": False, "at": 4.0, "dur": 1.0}],
   "points": [{"p": [-0.62, -0.38], "label": "", "at": 3.6, "tone": "hot"},
              {"p": [0.7, 0.42], "label": "", "at": 3.8, "tone": "hot"},
              {"p": [0, 0], "label": "$0$", "at": 1.2, "tone": "ink"}],
   "beats": [
     {"at": 0.2, "text": "Schematically: in $T_xM$, the directions along which geodesics from $x$ still minimize"},
     {"at": 3.4, "text": "The claim: under weak MTW this domain is always convex, conjugate cut points included"},
     {"at": 6.0, "text": "So transport maps are homeomorphisms, Hölder both ways"}]},
  {"form": "status", "label": "Villani's conjecture",
   "statement": ["\\mathfrak S(\\xi,\\eta) \\ge 0 \\text{ for } \\xi \\perp \\eta \\;\\Rightarrow\\; I(x) \\text{ convex for every } x"],
   "context": "Before: proved when cut points come before conjugate points (Figalli–Gallouët–Rifford, 2015)",
   "stamp": "proved",
   "note": "Transport between densities bounded above and below"},
  {"lean": "main", "detail": "Both main theorems in Lean; one local-injectivity claim only for finite target families",
   "ourCheck": "We read the Comparator statements; we did not build the Lean"},
  [(R('360', 'claim'), "satisfying weak MTW (S(xi,eta) >= 0 for orthogonal pairs), every tangent injectivity domain is convex (Villani's conjecture, no nonfocality assumption)"),
   (R('360', 'known_before'), "Figalli-Gallouet-Rifford (2015: convexity under nonfocality)"),
   ('article, Weak MTW and optimal transport', "Figalli, Gallouët and Rifford proved it when cut points come before conjugate points"),
   ('article, Weak MTW and optimal transport', "Both main theorems are in Lean, except an arbitrary-potential local-injectivity claim that the formal version covers only for finite target families."),
   (R('360', 'caveats'), "I did not build the Lean library (no compilation allowed)")])

# ---------------------------------------------------------------- 361
spec('361', 'counterexample', 'Harmonic functions of integer growth',
  'Nonnegative Ricci curvature can add harmonic functions',
  'Claim: metrics on $\\mathbb R^3$ with $\\mathrm{Ric} \\ge 0$ carry more harmonic functions of growth $\\le k$ than flat space',
  {"dur": 8.4, "primitive": "plot",
   "x": [0, 10], "y": [0, 200], "xlabel": "growth degree $k$", "ylabel": "dimension $h_k$", "labelRoom": 220,
   "xticks": [0, 2, 4, 6, 8, 10],
   "curves": [
     {"f": "(x+1)*(x+1)", "label": "flat: $(k+1)^2$", "tone": "soft", "at": 0.6, "dur": 1.6},
     {"f": "1.5*(x+1)*(x+1)", "label": "$c\\,(k+1)^2$, $c > 1$", "tone": "accent", "at": 3.4, "dur": 1.6}],
   "regions": [{"f": "1.5*(x+1)*(x+1)", "f2": "(x+1)*(x+1)", "at": 5.2, "tone": "accent"}],
   "beats": [
     {"at": 0.2, "text": "Flat $\\mathbb R^3$ has $(k+1)^2$ harmonic functions of growth at most $k$"},
     {"at": 3.2, "text": "Yau asked whether $\\mathrm{Ric} \\ge 0$ can only lower that count (curves schematic)"},
     {"at": 5.6, "text": "The claim: for large $k$, a metric $g_k$ reaches $c\\,(k+1)^2$ for any $c < 9v/4$"}]},
  {"form": "status", "label": "Yau's harmonic dimension comparison",
   "statement": ["h_k(\\mathbb R^3, g_k) \\ge c\\,(k+1)^2 > (k+1)^2 = h_k(\\mathbb R^3)"],
   "context": "For every $v \\in (4/9, 1)$, $c \\in (1, 9v/4)$ and large $k$; $\\mathrm{Ric} \\ge 0$, Euclidean near 0",
   "stamp": "counterexample",
   "note": "The metric depends on $k$: no single manifold fails for every $k$"},
  {"lean": "part", "detail": "Lean: an earlier 16-dimensional example with degree 50000, not the 3-dimensional theorem",
   "ourCheck": "We read the Comparator statement; we did not build the Lean"},
  [(R('361', 'claim'), "for every v in (4/9,1), c in (1, 9v/4) and all large integers k, a complete metric g_k on R^3 (Euclidean near 0, Ric >= 0, AVR = v) has h_k >= c (k+1)^2 > (k+1)^2"),
   (R('361', 'caveats'), "The metric depends on k (no single manifold violates it for all k)."),
   ('article, Harmonic functions of integer growth', "Lean covers only an earlier 16-dimensional example with degree 50000."),
   (R('361', 'caveats'), "I did not build the Lean library (no compilation allowed)")])
print('ok')
