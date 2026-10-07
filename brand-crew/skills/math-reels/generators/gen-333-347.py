import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, math, os
import sys as _sys, os as _os; _sys.path.insert(0, _o.path.join(GEN, 'gen-gt')); from enrich_gt import enrich  # plain, proof, voice, visualised equations
OUT = _OUT
os.makedirs(OUT, exist_ok=True)
D = 'Differential geometry'
R = lambda x: round(x, 4)

def curve(fn, n=120):
    return [[R(a), R(b)] for a, b in (fn(2 * math.pi * i / n) for i in range(n))]

def rot_ellipse(rx, ry, ang, c=(0, 0)):
    ca, sa = math.cos(ang), math.sin(ang)
    return curve(lambda t: (c[0] + rx * math.cos(t) * ca - ry * math.sin(t) * sa, c[1] + rx * math.cos(t) * sa + ry * math.sin(t) * ca))

def spec(id, kind, short, title, subtitle, obj, ach, verify, sources):
    s = {"$schema": "../../brand-crew/skills/math-reels/schema.json", "id": id, "discipline": D, "kind": kind, "short": short,
         "title": {"title": title, "subtitle": subtitle}, "object": obj, "achievement": ach, "verify": verify, "sources": sources}
    json.dump(enrich(s), open(f'{OUT}/{id}.json', 'w'), indent=2, ensure_ascii=False)

def src(ref, q): return {"ref": ref, "quote": q}
NOBUILD = src("article, What the Lean library checks", "I did not build it")

# ---------------------------------------------------------------- 333
spec("333", "proof", "Smooth isometric immersions into $\\mathbb{R}^4$",
     "Every closed surface fits isometrically in $\\mathbb{R}^4$",
     "Claim: every closed smooth Riemannian surface has a $C^\\infty$ isometric immersion into $\\mathbb{R}^4$",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 4.2, "shapes": [
             {"kind": "circle", "r": 0.95, "tone": "faint", "fill": False, "dash": True, "at": 0.2, "label": "a small round $S^3$", "labelAt": [0, 1.12]},
             {"kind": "circle", "r": 0.62, "tone": "soft", "at": 0.6, "fillA": 0.05,
              "morph": {"kind": "polygon", "points": curve(lambda t: ((0.62 + 0.09 * math.sin(14 * t)) * math.cos(t), (0.62 + 0.09 * math.sin(14 * t)) * math.sin(t)), 168), "at": 1.9, "dur": 1.6}}]},
         {"primitive": "numberline", "from": 4.2, "min": 2, "max": 18, "ticks": [3, 4, 5, 17],
          "axisLabel": "dimension $N$ of the target $\\mathbb{R}^N$",
          "markers": [
              {"v": 17, "label": "Nash", "note": "1956, embedding", "at": 0.5},
              {"v": 5, "label": "Gromov", "note": "closed surfaces", "at": 0.9},
              {"v": 3, "label": "Nash–Kuiper", "note": "$C^1$ only", "tone": "mute", "style": "ring", "at": 1.3}],
          "slide": {"from": 5, "to": 4, "at": 2.0, "dur": 1.4, "label": "claimed $\\mathbb{R}^4$", "note": "smooth, any surface"}}],
      "beats": [
          {"at": 0.2, "text": "Schematically: start short, inside a small round sphere in $\\mathbb{R}^4$"},
          {"at": 2.2, "text": "Oscillating corrections add the missing length, keeping a normal direction free"},
          {"at": 4.6, "text": "Nash needed $\\mathbb{R}^{17}$; Gromov reached $\\mathbb{R}^5$. The question Chern asked was $\\mathbb{R}^4$"}]},
     {"form": "status", "label": "Question attributed to Chern, recorded by Gromov",
      "statement": ["(\\Sigma^2, g) \\text{ closed, smooth}", "\\Rightarrow\\ \\exists\\, f: \\Sigma \\to \\mathbb{R}^4,\\ \\ f^*\\langle\\cdot,\\cdot\\rangle = g"],
      "context": "Before: immersions into $\\mathbb{R}^5$ (Gromov), embeddings into $\\mathbb{R}^{17}$ (Nash)",
      "stamp": "proved", "note": "An immersion, not an embedding: the surface may cross itself"},
     {"lean": "main", "detail": "Main theorem in Lean: 2,050 files, about 175,000 lines, no sorry",
      "ourCheck": "We read the Comparator statement; we did not build the Lean"},
     [src("review 333, known_before", "Nash (1956) embedding: R^17 for surfaces"),
      src("review 333, known_before", "Gromov's Partial Differential Relations: smooth isometric immersions of closed surfaces into R^5"),
      src("review 333, known_before", "Gromov recorded the R^4 question (attributing it to Chern)"),
      src("review 333, known_before", "Nash-Kuiper C^1 in R^3"),
      src("review 333, explainer", "The paper starts with any immersion into a small round 3-sphere in R^4 (so the starting map is 'short'), then adds oscillatory rank-one corrections to make up the missing metric, keeping a usable normal direction"),
      src("review 333, caveats", "Immersion, not embedding."),
      src("article, Smooth isometric immersions", "The main theorem is in Lean (`OAI/Geometry/SurfaceImmersion`, 2,050 files, about 175,000 lines)."),
      src("review 333, caveats", "no sorry"),
      src("review 333, caveats", "whose Comparator statement I read"), NOBUILD])

# ---------------------------------------------------------------- 334
patches = []
for k in range(6):
    r0 = 0.42 * 0.55 ** k
    cx = 2.1 * 0.55 ** k
    patches.append({"kind": "circle", "r": R(r0), "c": [R(cx - 1.05), 0], "tone": "accent" if k % 2 == 0 else "cool", "at": R(0.5 + 0.35 * k), "dur": 0.6, "fillA": 0.3})
patches[0]["label"] = "$K > 0$"; patches[0]["labelAt"] = [1.05, 0.6]
patches[1]["label"] = "$K < 0$"; patches[1]["labelAt"] = [0.105, -0.42]
spec("334", "counterexample", "A smooth metric with no local immersion in $\\mathbb{R}^3$",
     "A smooth surface metric that no piece of $\\mathbb{R}^3$ realizes",
     "Claim: a $C^\\infty$ metric on $(-1,1)^2$ with no smooth isometric immersion of any neighbourhood of 0 into $\\mathbb{R}^3$",
     {"dur": 8.4, "heading": "Schematically: sign-changing curvature patches, shrinking to the origin",
      "primitive": "shape",
      "shapes": [{"kind": "polygon", "points": [[-1.6, -0.85], [1.6, -0.85], [1.6, 0.85], [-1.6, 0.85]], "tone": "faint", "fill": False, "at": 0.1, "dur": 0.6}] + patches,
      "points": [{"p": [-1.05, 0], "label": "$0$", "tone": "hot", "at": 2.8}],
      "beats": [
          {"at": 0.2, "text": "Analytic metrics always embed locally (Janet–Cartan). Smooth ones were open"},
          {"at": 3.2, "text": "On each patch, a would-be height function must solve the Darboux equation"},
          {"at": 5.8, "text": "A boundary-saddle argument rules it out on one patch, so no immersion exists"}]},
     {"form": "status", "label": "Local isometric embedding of smooth surface metrics",
      "statement": ["\\exists\\, g \\in C^\\infty \\text{ on } (-1,1)^2:", "\\text{no neighbourhood of } 0 \\text{ immerses isometrically in } \\mathbb{R}^3"],
      "context": "Before: Pogorelov's $C^{2,1}$ metric with no $C^2$ realization; smooth ones open",
      "stamp": "counterexample", "note": "Uses both signs of curvature: the $K \\ge 0$ and $K \\le 0$ cases stay open"},
     {"lean": "main", "detail": "Main theorem in Lean: about 57,500 lines under OAI/Geometry/IsometricImmersion",
      "ourCheck": "We read the Comparator statement; we did not build the Lean"},
     [src("review 334, claim", "There is a C-infinity positive-definite metric g on (-1,1)^2, agreeing with the Euclidean metric to infinite order at the origin, such that no neighbourhood of the origin admits a C-infinity isometric immersion into R^3."),
      src("review 334, known_before", "Janet-Cartan: analytic metrics embed locally."),
      src("review 334, known_before", "Pogorelov: C^{2,1} metric with no C^2 realization"),
      src("review 334, explainer", "The paper glues infinitely many shrinking patches where the curvature changes sign and shows any immersion would give a height function obeying the Darboux equation that a boundary-saddle argument rules out on one of the patches."),
      src("article, A smooth metric with no local immersion", "In Lean (`OAI/Geometry/IsometricImmersion`, about 57,500 lines). The metric needs both curvature signs, so the $K \\ge 0$ and $K \\le 0$ versions remain open."),
      src("review 334, caveats", "whose Comparator statement I read"), NOBUILD])

# ---------------------------------------------------------------- 335
spec("335", "proof", "Gromov–Lawson in every dimension",
     "Positive scalar curvature forces rational inessentiality",
     "Claim: no closed aspherical manifold of any dimension carries positive scalar curvature, spin or not",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 3.4, "scale": 1.0, "shapes": [
             {"kind": "circle", "r": 0.9, "tone": "soft", "dash": True, "fill": False, "at": 0.2, "label": "Euclidean ball", "labelAt": [0, 1.06]},
             {"kind": "circle", "r": 0.9, "tone": "accent", "at": 0.6, "morph": {"kind": "circle", "r": 0.74, "at": 1.3, "dur": 1.2}, "label": "$\\mathrm{Scal} > 0$", "labelAt": [0, 0]}]},
         {"primitive": "numberline", "from": 3.4, "min": 1.5, "max": 11.5, "ticks": [2, 3, 4, 5, 6, 7, 8, 9, 10],
          "axisLabel": "dimension $n$ of the aspherical manifold",
          "markers": [{"v": 3, "label": "Schoen–Yau, Gromov–Lawson", "note": "dimension 3", "at": 0.5}],
          "ranges": [
              {"from": 4, "to": 5, "label": "Chodosh–Li, Gromov", "note": "2020 and 2024", "at": 1.0},
              {"from": 6, "to": 11, "label": "claimed: every $n$", "note": "no spin hypothesis", "tone": "claim", "at": 2.2}]}],
      "beats": [
          {"at": 0.2, "text": "Schematically: positive scalar curvature makes small balls a little smaller"},
          {"at": 3.5, "text": "Minimal surfaces and $\\mu$-bubbles reached dimension 5; Dirac operators need spin"},
          {"at": 5.8, "text": "The claim reshapes the metric one warped circle at a time, at a logarithmic cost"}]},
     {"form": "status", "label": "Gromov–Lawson aspherical conjecture; Gromov's 1986 integral bound",
      "statement": ["\\mathrm{Scal}_g > 0 \\;\\Rightarrow\\; c_*[M] = 0 \\in H_n(B\\pi_1 M; \\mathbb{Q})", "\\textstyle\\int_M (\\mathrm{Scal}^-_g)^{n/2} \\ge a_n \\lVert M \\rVert"],
      "context": "Before: dimensions 3, 4 and 5, or spin manifolds whose groups satisfy Novikov-type conjectures",
      "stamp": "proved", "note": "The logarithmic cost estimate is where one wrong inequality would sink it"},
     {"lean": "none", "detail": "No Lean: 121 pages across two manuscripts",
      "ourCheck": "We read the strategy; we did not check the analysis"},
     [src("review 335, known_before", "Chodosh-Li (Annals 2024) and Gromov (2020) proved dims 4 and 5"),
      src("review 335, known_before", "Gromov-Lawson (1983) and Schoen-Yau proved the aspherical case in dim 3"),
      src("review 335, claim", "(b) For n >= 3 there is a_n > 0 with integral of (Scal^-)^{n/2} >= a_n ||M|| for every closed oriented M^n and metric (Gromov's 1986 conjecture)."),
      src("article, The Gromov–Lawson aspherical conjecture", "A metric of positive scalar curvature (PSC) makes small balls a little smaller than Euclidean ones."),
      src("article, The Gromov–Lawson aspherical conjecture", "where minimal-surface and $\\mu$-bubble methods stop"),
      src("article, The Gromov–Lawson aspherical conjecture", "No Lean, 121 pages across the two papers. The logarithmic cost estimate is the place where a single wrong inequality would sink the whole thing"),
      src("review 335, caveats", "graph deformations with one warped circle per coordinate and a telescoping trace bound")])

# ---------------------------------------------------------------- 336
spec("336", "proof", "Codimension-2 width under $\\mathrm{Scal} \\ge 1$",
     "Positive scalar curvature makes a manifold thin in two ways",
     "Claim: for $n \\ge 4$, every complete $n$-manifold with $\\mathrm{Scal} \\ge 1$ maps to an $(n-2)$-complex with fibres of diameter $\\le C_n$",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 4.2, "shapes": [
             {"kind": "superellipse", "p": 3, "r": 1, "tone": "accent", "at": 0.2,
              "morph": {"kind": "ellipse", "rx": 1.15, "ry": 0.06, "at": 1.6, "dur": 1.6}},
             {"kind": "polygon", "points": [[-1.15, 0], [1.15, 0]], "tone": "ink", "fill": False, "at": 3.0, "dur": 0.6, "w": 3, "label": "a lower-dimensional skeleton", "labelAt": [0, -0.35]}]},
         {"primitive": "plot", "from": 4.2, "x": [0.2, 10], "y": [0, 1200], "xticks": [1, 4, 9], "yticks": [0, 500, 1000],
          "xlabel": "$\\lambda$", "ylabel": "fibre diameter bound, dimension 3",
          "curves": [{"f": "500/sqrt(x)", "label": "$500/\\sqrt{\\lambda}$", "tone": "claim", "at": 0.5, "dur": 1.6}],
          "regions": [{"f": "500/sqrt(x)", "at": 1.6}]}],
      "beats": [
          {"at": 0.2, "text": "Schematically: squash the manifold onto a complex two dimensions lower"},
          {"at": 2.6, "text": "Every fibre of the map has diameter at most $C_n$, in every dimension $n \\ge 4$"},
          {"at": 4.6, "text": "Spectral version in dimension 3: maps to graphs, fibres at most $500/\\sqrt{\\lambda}$"}]},
     {"form": "status", "label": "Gromov's codimension-2 Urysohn width conjecture",
      "statement": ["\\mathrm{Scal} \\ge 1 \\;\\Rightarrow\\; M^n \\to K^{n-2},\\ \\ \\operatorname{diam}(\\text{fibres}) \\le C_n"],
      "context": "Corollaries: a filling-radius bound, macroscopic dimension $\\le n-2$, and again no PSC on aspherical manifolds",
      "stamp": "proved", "note": "The macroscopic-dimension corollary is the continuous version, not Lipschitz"},
     {"lean": "none", "detail": "No Lean: 147 pages over three manuscripts",
      "ourCheck": "We read the claims; we did not check the proofs"},
     [src("review 336, claim", "For n >= 4 there is C_n such that every complete connected n-manifold with Scal >= 1 maps continuously to a simplicial complex of dimension <= n-2 with all fibres of diameter <= C_n (Gromov's quantitative codimension-2 Urysohn width conjecture)"),
      src("review 336, claim", "in dim 3, maps to graphs with fibres <= 500/sqrt(lambda)"),
      src("article, Gromov's codimension-2 width conjecture", "with an explicit fibre bound of $500/\\sqrt\\lambda$ in dimension 3"),
      src("review 336, caveats", "147 pages over three papers"),
      src("review 336, caveats", "The macroscopic-dimension corollary is the 'continuous' version (distinct from the Lipschitz/uniform version, as the paper notes)."),
      src("article, Gromov's codimension-2 width conjecture", "Positive scalar curvature makes a manifold thin in two directions.")])

# ---------------------------------------------------------------- 337
blob = curve(lambda t: ((0.78 + 0.16 * math.sin(3 * t) + 0.08 * math.cos(5 * t)) * math.cos(t), (0.78 + 0.16 * math.sin(3 * t) + 0.08 * math.cos(5 * t)) * math.sin(t)), 160)
spec("337", "proof", "Cartan–Hadamard isoperimetry, all dimensions",
     "The Cartan–Hadamard conjecture in every dimension",
     "Claim: under $\\sec \\le \\kappa \\le 0$, no region beats the equal-volume ball of the model space",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 4.0, "shapes": [
             {"kind": "polygon", "points": blob, "tone": "soft", "at": 0.2,
              "morph": {"kind": "circle", "r": 0.8, "at": 1.7, "dur": 1.4}, "label": "same volume", "labelAt": [0, 0]}]},
         {"primitive": "numberline", "from": 4.0, "min": 1, "max": 10.5, "ticks": [2, 3, 4, 5, 6, 7, 8, 9, 10],
          "axisLabel": "dimension of the manifold",
          "markers": [
              {"v": 2, "label": "Weil", "note": "1926", "at": 0.4},
              {"v": 3, "label": "Kleiner", "note": "1992", "at": 0.7},
              {"v": 4, "label": "Croke", "note": "1984", "at": 1.0, "side": "below"}],
          "ranges": [{"from": 5, "to": 10, "label": "claimed: every dimension", "note": "and $\\kappa < 0$", "tone": "claim", "at": 2.0}]}],
      "beats": [
          {"at": 0.2, "text": "Schematically: of all regions with this volume, the round ball has the least boundary"},
          {"at": 4.1, "text": "In nonpositive curvature this was known only in dimensions 2, 3 and 4"},
          {"at": 6.6, "text": "A second paper proves a sharp filling bound in any CAT(0) space"}]},
     {"form": "status", "label": "Cartan–Hadamard conjecture (Aubin, Gromov, Burago–Zalgaller)",
      "statement": ["\\sec \\le \\kappa \\le 0:\\ \\ \\mathrm{Per}(\\Omega) \\ge \\mathrm{Per}(B^{\\kappa}),\\ \\ |B^{\\kappa}| = |\\Omega|", "\\text{CAT}(0):\\ \\ M(S) \\le c_n\\, M(T)^{(n+1)/n}"],
      "context": "Before: dimensions 2 (Weil, 1926), 3 (Kleiner, 1992) and 4 (Croke, 1984)",
      "stamp": "proved", "note": "Equality only for Euclidean balls when $\\kappa = 0$ (paper only)"},
     {"lean": "part", "detail": "Lean: the CAT(0) filling theorem, about 50,500 lines. Not $\\kappa < 0$, not rigidity",
      "ourCheck": "We read the Comparator file; we did not build the Lean"},
     [src("article, The Cartan–Hadamard conjecture", "It was known in dimension 2 (Weil, 1926), 3 (Kleiner, 1992) and 4 (Croke, 1984)"),
      src("article, The Cartan–Hadamard conjecture", "every compactly supported integral $n$-cycle ($n \\ge 2$) bounds an integral current of mass at most $c_n M(T)^{(n+1)/n}$, the Euclidean constant"),
      src("article, The Cartan–Hadamard conjecture", "The CAT(0) filling theorem is in Lean (`OAI/Geometry/CAT0Fillings`, 330 files, about 50,500 lines)"),
      src("article, The Cartan–Hadamard conjecture", "The $\\kappa < 0$ theorem and the rigidity statement are paper-only."),
      src("article, The Cartan–Hadamard conjecture", "I read the Comparator file."),
      src("review 337, known_before", "Aubin/Gromov/Burago-Zalgaller conjecture."), NOBUILD])

# ---------------------------------------------------------------- 338
spec("338", "proof", "Yau's uniformization conjecture",
     "Positive bisectional curvature forces $\\mathbb{C}^n$",
     "Claim: a complete noncompact Kähler manifold with positive bisectional curvature is biholomorphic to $\\mathbb{C}^n$",
     {"dur": 8.4, "heading": "Complete noncompact Kähler manifolds with bisectional curvature $> 0$",
      "primitive": "venn",
      "sets": [{"label": "all of them", "tone": "accent", "at": 0.2}, {"label": "maximal volume growth", "tone": "cool", "at": 0.7}],
      "regions": [
          {"set": "A&B", "label": "known: $\\cong \\mathbb{C}^n$", "at": 1.6, "tone": "cool", "x": 0.6, "y": 0.5},
          {"set": "A&!B", "label": "claimed", "at": 4.4, "tone": "accent", "x": 0.33, "y": 0.5}],
      "beats": [
          {"at": 0.2, "text": "Yau asked in 1982: is every such manifold just $\\mathbb{C}^n$?"},
          {"at": 2.0, "text": "Every earlier proof needed maximal volume growth (Chau–Tam, Gang Liu, Lee–Tam)"},
          {"at": 4.6, "text": "The claim needs no curvature bound, no volume growth and no topology"}]},
     {"form": "status", "label": "Yau's uniformization conjecture (1982)",
      "statement": ["(M^n, \\omega) \\text{ complete, noncompact},\\ \\ \\mathrm{BK} > 0", "\\Longrightarrow\\ \\ M \\cong \\mathbb{C}^n \\text{ biholomorphically}"],
      "context": "Before: every proof needed maximal volume growth (Chau–Tam, Gang Liu, Lee–Tam)",
      "stamp": "proved", "note": "Earlier partial results also credit ChatGPT models, per the paper's footnote"},
     {"lean": "none", "detail": "No Lean: one 77-page manuscript",
      "ourCheck": "We read the strategy; we did not check the estimates"},
     [src("review 338, known_before", "Yau (1982 problem section)."),
      src("article, Yau's uniformization conjecture", "Every earlier result needed maximal volume growth: Chau–Tam with bounded curvature, [Gang Liu](https://arxiv.org/abs/1606.08958) and then Lee–Tam without it."),
      src("article, Yau's uniformization conjecture", "assumes only pointwise strict positivity: no curvature bound, no volume growth, no topology"),
      src("article, Yau's uniformization conjecture", "the paper notes in a footnote that those authors credit ChatGPT models for parts of their arguments"),
      src("article, Yau's uniformization conjecture", "77 pages, no Lean.")])

# ---------------------------------------------------------------- 339
spec("339", "proof", "Katok's entropy rigidity conjecture",
     "Katok's entropy rigidity in every dimension",
     "Claim: in negative curvature, Liouville measure has maximal entropy only for locally symmetric metrics, all $n \\ge 3$",
     {"dur": 8.8, "layout": "sequence", "panels": [
         {"primitive": "numberline", "until": 3.8, "min": 0, "max": 10, "ticks": [], "arrow": True,
          "axisLabel": "entropy of the geodesic flow (schematic)",
          "markers": [
              {"v": 8, "label": "$h_{\\mathrm{top}}$", "note": "maximal entropy", "tone": "ink", "at": 0.4},
              {"v": 5, "label": "$h_{\\mu_L}$", "note": "Liouville (volume)", "at": 0.8, "side": "below"}],
          "slide": {"from": 5, "to": 8, "at": 1.6, "dur": 1.4, "label": "equal", "note": "only if locally symmetric", "side": "below"}},
         {"primitive": "tree", "from": 3.8, "at": 0.3, "nodes": [
             {"id": "r", "label": "locally symmetric"},
             {"id": "s", "label": "smooth stable and unstable foliations", "parent": "r", "status": "paper"},
             {"id": "b", "label": "Benoist–Foulon–Labourie", "parent": "r", "status": "prior"},
             {"id": "j", "label": "$J = h + XF$", "parent": "s", "status": "paper"},
             {"id": "f", "label": "formal-symmetry classification", "parent": "s", "status": "paper"}]}],
      "beats": [
          {"at": 0.2, "text": "Two ways to pick a random geodesic: by volume, or by maximal complexity"},
          {"at": 2.8, "text": "Katok proved they coincide only on symmetric surfaces, and conjectured it in all dimensions"},
          {"at": 5.6, "text": "The proof: equality makes the foliations smooth, then a classical theorem finishes"}]},
     {"form": "status", "label": "Katok's entropy rigidity conjecture (1982)",
      "statement": ["\\sec < 0,\\ \\ \\dim \\ge 3:", "h_{\\mu_L} = h_{\\mathrm{top}} \\iff g \\text{ locally symmetric}"],
      "context": "Before: surfaces (Katok) and perturbative results near hyperbolic metrics (Flaminio, Humbert)",
      "stamp": "proved", "note": "The novelty is the formal-symmetry classification, the step to audit"},
     {"lean": "none", "detail": "No Lean: one 66-page manuscript",
      "ourCheck": "We could not evaluate the formal-symmetry step"},
     [src("review 339, known_before", "Katok (Ergodic Theory Dynam. Systems 1982) posed it and proved surfaces"),
      src("article, Katok's entropy rigidity conjecture", "Entropy equality, through thermodynamic formalism and Livšic theory, gives $J = h + XF$ for the unstable Jacobian"),
      src("article, Katok's entropy rigidity conjecture", "In higher dimensions only perturbative results were known (Flaminio; Humbert near hyperbolic metrics)"),
      src("article, Katok's entropy rigidity conjecture", "66 pages, no Lean. The strategy is the classical one (\"prove the foliations are smooth\"); the novelty is in the formal-symmetry classification, which I could not evaluate."),
      src("review 339, explainer", "two natural ways to pick a 'random geodesic' (by volume, and by maximal complexity)")])

# ---------------------------------------------------------------- 340
spec("340", "disproof", "The nearby Lagrangian conjecture fails",
     "A counterexample to the nearby Lagrangian conjecture",
     "Claim: an exact Lagrangian in $T^*(S^9 \\times S^{N-1})$, diffeomorphic to the base, not Hamiltonian isotopic to it",
     {"dur": 8.6, "heading": "What an exact Lagrangian $L \\subset T^*Q$ was known to share with $Q$",
      "primitive": "equation", "mode": "stack",
      "lines": [
          {"tex": "L \\simeq Q", "note": "homotopy equivalent (Abouzaid, Kragh)", "at": 0.4, "size": 36},
          {"tex": "L \\simeq_s Q", "note": "simple homotopy (Abouzaid–Kragh)", "at": 1.4, "size": 36},
          {"tex": "L \\cong Q", "note": "diffeomorphic, in the claim", "tone": "accent", "at": 3.4, "size": 36},
          {"tex": "L \\not\\sim_{\\mathrm{Ham}} 0_Q", "note": "yet not the zero section", "tone": "hot", "at": 5.0, "size": 36}],
      "beats": [
          {"at": 0.2, "text": "Arnold: every such $L$ is the zero section, moved by a Hamiltonian flow"},
          {"at": 3.0, "text": "True for $S^1$, $S^2$ and $T^2$. Fifteen years of Floer theory narrowed what $L$ can be"},
          {"at": 5.6, "text": "The claimed $L$ carries a 'tube' class, tied to Waldhausen K-theory, that $Q$ lacks"}]},
     {"form": "status", "label": "Arnold's nearby Lagrangian conjecture",
      "statement": ["L \\subset T^*Q \\text{ exact},\\ \\ Q = S^9 \\times S^{N-1}", "L \\cong Q \\text{ but } L \\not\\sim_{\\mathrm{Ham}} 0_Q"],
      "context": "Before: true for $S^1$, $S^2$, $T^2$; any such $L$ is simple homotopy equivalent to $Q$",
      "stamp": "disproved", "note": "$N$ is some large even number, not explicit; 28 pages for a central conjecture"},
     {"lean": "none", "detail": "No catalogued Lean result; 93 in-progress files under OAI/Geometry/NearbyLagrangian",
      "ourCheck": "We trust this landmark least of the group; we checked nothing"},
     [src("review 340, claim", "For some sufficiently large even N, Q = S^9 x S^{N-1} has a closed exact embedded Lagrangian L in T*Q, diffeomorphic to Q, that is not Hamiltonian isotopic to the zero section"),
      src("article, The nearby Lagrangian conjecture fails", "It is known for $S^1$, $S^2$ and $T^2$."),
      src("article, The nearby Lagrangian conjecture fails", "Fifteen years of Floer theory showed such a Lagrangian is homotopy equivalent to $Q$ (Abouzaid, Kragh)"),
      src("article, The nearby Lagrangian conjecture fails", "This is the claim I trust least among the landmarks, for a simple reason: 28 pages to overturn a central conjecture of symplectic topology, with a non-explicit dimension. There are in-progress Lean files under `OAI/Geometry/NearbyLagrangian` (93 files) but no catalogued result."),
      src("article, The nearby Lagrangian conjecture fails", "connected to Waldhausen's algebraic K-theory of spaces")])

# ---------------------------------------------------------------- 341
spec("341", "proof", "Donaldson's hypersymplectic conjecture",
     "Hypersymplectic 4-manifolds deform to hyperkähler",
     "Claim: a normalized hypersymplectic triple deforms to a hyperkähler one, so the 4-manifold is K3 or $T^4$",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "grid", "until": 4.0, "rows": 3, "cols": 3, "stagger": 0.08,
          "values": [["$1$", "$0$", "$0$"], ["$0$", "$1$", "$0$"], ["$0$", "$0$", "$1$"]],
          "cells": [[0, 0, "accent"], [1, 1, "accent"], [2, 2, "accent"]],
          "caption": "$\\int \\omega_i \\wedge \\omega_j = \\delta_{ij}$ for three closed 2-forms $\\omega_1, \\omega_2, \\omega_3$"},
         {"primitive": "equation", "from": 4.0, "mode": "replace", "lines": [
             {"tex": "(\\omega_1, \\omega_2, \\omega_3)\\ \\text{hypersymplectic}", "at": 0.3, "size": 42, "note": "span positive definite at every point"},
             {"tex": "\\leadsto\\ \\text{hyperkähler triple}", "at": 1.7, "size": 42, "tone": "accent", "note": "same three cohomology classes"},
             {"tex": "M \\cong_{\\mathrm{diff}} K3\\ \\text{or}\\ T^4", "at": 3.1, "size": 46, "tone": "accent", "note": "the corollary experts will test first"}]}],
      "beats": [
          {"at": 0.2, "text": "Three symplectic forms that look like a hyperkähler triple, but need not be parallel"},
          {"at": 4.2, "text": "Donaldson conjectured in 2006 that they can always be deformed to the real thing"},
          {"at": 7.0, "text": "Compact hyperkähler 4-manifolds are K3 or tori, which pins down the topology"}]},
     {"form": "status", "label": "Donaldson's hypersymplectic deformation conjecture (2006)",
      "statement": ["\\textstyle\\int \\omega_i \\wedge \\omega_j = \\delta_{ij}", "\\Rightarrow\\ \\text{deforms, classes fixed, to hyperkähler}"],
      "context": "Corollary: a closed 4-manifold with a hypersymplectic structure is diffeomorphic to K3 or $T^4$",
      "stamp": "proved", "note": "Reuses the Lean-checked estimates of family 342; the deformation is paper-only"},
     {"lean": "none", "detail": "No Lean: one 72-page manuscript",
      "ourCheck": "We read the claim; we did not check the deformation argument"},
     [src("review 341, known_before", "Donaldson ('Two-forms on four-manifolds and elliptic equations', 2006) conjectured the deformation"),
      src("review 341, claim", "every hypersymplectic triple normalized by integral omega_i ^ omega_j = delta_ij deforms through hypersymplectic triples, fixing all three cohomology classes, to a hyperkaehler triple"),
      src("article, Donaldson's hypersymplectic conjecture", "A hypersymplectic structure is a triple of closed 2-forms whose span is positive definite at every point, like a hyperkähler triple without parallelism."),
      src("article, Donaldson's hypersymplectic conjecture", "a closed 4-manifold with a hypersymplectic structure is diffeomorphic to K3 or $T^4$. That corollary is where I would expect experts to push first."),
      src("review 341, caveats", "72 pages; builds on the current estimates of family 342 (which is formalized) but the prescribed-class deformation arguments are not formalized.")])

# ---------------------------------------------------------------- 342
spec("342", "proof", "Donaldson's tamed-to-compatible question",
     "Taming implies compatibility on four-manifolds",
     "Claim: on a closed 4-manifold, if a symplectic form tames $J$, some symplectic form is compatible with $J$",
     {"dur": 8.6, "primitive": "equation", "mode": "stack",
      "lines": [
          {"tex": "\\omega(v, Jv) > 0", "note": "$\\omega$ tames $J$", "at": 0.4, "size": 40},
          {"tex": "\\omega(Ju, Jv) = \\omega(u, v)", "note": "compatible: also $J$-invariant", "at": 2.4, "size": 40},
          {"tex": "r^{-3} \\cdot O(r^2) \\cdot o(r) = o(1)", "note": "the one boundary term", "tone": "accent", "at": 5.4, "size": 40}],
      "beats": [
          {"at": 0.2, "text": "Compatible implies tamed. Donaldson asked in 2006 whether tamed implies compatible"},
          {"at": 2.8, "text": "Averaging $\\omega$ makes it invariant but destroys closedness"},
          {"at": 5.4, "text": "If no compatible form existed, a positive current would; one estimate rules it out"}]},
     {"form": "status", "label": "Donaldson's tamed-to-compatible question (2006)",
      "statement": ["\\exists\\,\\omega \\text{ taming } J \\;\\Rightarrow\\; \\exists\\,\\eta \\text{ compatible with } J"],
      "context": "Before: integrable $J$ (Li–Zhang), generic tamed $J$ when $b^+ = 1$ (Taubes), a few rational surfaces",
      "stamp": "proved", "note": "$J$ is fixed; the compatible form's class may differ from the taming one"},
     {"lean": "main", "detail": "Main theorem in Lean: 582 files, about 83,600 lines, no sorry, standard axioms",
      "ourCheck": "We read the Comparator statement; we did not build the Lean"},
     [src("article, Donaldson's tamed-to-compatible question", "[Donaldson asked in 2006](https://arxiv.org/abs/math/0607083) whether, on a closed 4-manifold, the existence of a taming symplectic form forces the existence of a compatible one."),
      src("article, Donaldson's tamed-to-compatible question", "That comes down to one boundary term in a cutoff argument, of size $r^{-3} \\cdot O(r^2) \\cdot o(r) = o(1)$"),
      src("article, Donaldson's tamed-to-compatible question", "The naive fix, averaging $\\omega$ with $\\omega(J\\cdot, J\\cdot)$, makes the form invariant and destroys closedness."),
      src("article, Donaldson's tamed-to-compatible question", "The solution lives in `OAI/Geometry/TamingCompatibility` (582 files, about 83,600 lines, no `sorry`)"),
      src("review 342, caveats", "no sorry, standard axioms"),
      src("review 342, claim", "J is fixed, the class may change"),
      src("review 342, caveats", "I read the Comparator statement"), NOBUILD])

# ---------------------------------------------------------------- 343
spec("343", "proof", "Symplectic ball packing, dimension 6 and up",
     "Packing symplectic balls: only two obstructions",
     "Claim: in dimension $2n \\ge 6$, balls pack into a ball iff $\\sum R_i^n < R^n$ and $R_i + R_j < R$",
     {"dur": 8.8, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 3.8, "shapes": [
             {"kind": "circle", "r": 1, "tone": "soft", "fill": False, "at": 0.2, "label": "$B(R)$", "labelAt": [0.82, 0.82]},
             {"kind": "circle", "r": 0.42, "c": [-0.4, 0.3], "tone": "accent", "at": 0.8, "dur": 0.7, "label": "$R_1$", "labelAt": [-0.4, 0.3]},
             {"kind": "circle", "r": 0.36, "c": [0.42, 0.25], "tone": "accent", "at": 1.2, "dur": 0.7, "label": "$R_2$", "labelAt": [0.42, 0.25]},
             {"kind": "circle", "r": 0.3, "c": [0.02, -0.55], "tone": "accent", "at": 1.6, "dur": 0.7, "label": "$R_3$", "labelAt": [0.02, -0.55]}]},
         {"primitive": "plot", "from": 3.8, "x": [1, 30], "y": [0, 1.05], "labelRoom": 230,
          "xticks": [1, 8, 16, 24], "yticks": [0, {"v": 0.5, "label": "$1/2$"}, 1],
          "xlabel": "$k$ equal balls, $n = 3$", "ylabel": "largest capacity $r$ into $B(1)$",
          "curves": [
              {"f": "pow(x,-1/3)", "label": "volume: $k r^3 < 1$", "tone": "soft", "dash": True, "at": 0.4, "dur": 1.2},
              {"f": "0.5", "label": "two balls: $2r < 1$", "tone": "cool", "dash": True, "at": 1.0, "dur": 1.0},
              {"f": "min(pow(x,-1/3),0.5)", "label": "", "tone": "claim", "at": 2.0, "dur": 1.2}],
          "regions": [{"f": "min(pow(x,-1/3),0.5)", "at": 2.6}]}],
      "beats": [
          {"at": 0.2, "text": "Schematically: disjoint balls of capacities $R_i$ inside a ball of capacity $R$"},
          {"at": 3.9, "text": "Siegel and Yao conjectured only volume and Gromov's two-ball bound matter"},
          {"at": 6.6, "text": "For equal balls the packable region is the lower envelope of the two"}]},
     {"form": "status", "label": "Siegel–Yao Conjecture A",
      "statement": ["\\textstyle\\bigsqcup_i B(R_i) \\hookrightarrow B(R)", "\\iff\\ \\textstyle\\sum_i R_i^n < R^n \\text{ and } R_i + R_j < R"],
      "context": "In dimension 4 further obstructions exist; from dimension 6 on, only these two",
      "stamp": "proved", "note": "For $n \\ge 3$ only: it fails in dimension 4, as stated"},
     {"lean": "main", "detail": "The full equivalence is in Lean: about 107,000 lines under OAI/Geometry/BallPacking",
      "ourCheck": "We read the Comparator definition; we did not build the Lean"},
     [src("review 343, claim", "For n >= 3 (real dimension >= 6), closed balls of capacities R_1..R_k embed symplectically and disjointly into the open ball of capacity R iff sum R_i^n < R^n and R_i + R_j < R for all i != j (Siegel-Yao Conjecture A)."),
      src("article, Symplectic ball packing", "In dimension 4, packing balls symplectically into a ball is governed by intricate algebraic-geometry obstructions. Siegel and Yao conjectured that from dimension 6 on, only two obstructions matter"),
      src("article, Symplectic ball packing", "the full equivalence is in Lean (`OAI/Geometry/BallPacking`, about 107,000 lines)"),
      src("article, Symplectic ball packing", "The Comparator statement defines a symplectic embedding as a smooth embedding of a neighbourhood whose derivative preserves the standard form, which is the right definition."),
      src("review 343, caveats", "Fails in dim 4 (more obstructions), as stated."), NOBUILD])

# ---------------------------------------------------------------- 344
mer = [rot_ellipse(rx, 1, 0) for rx in (0.62, 0.28)]
spec("344", "proof", "The metric Blaschke conjecture",
     "Blaschke manifolds are the round spheres and projective spaces",
     "Claim: a closed manifold with injectivity radius equal to diameter is a compact rank-one symmetric space",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 4.2, "shapes": [
             {"kind": "circle", "r": 1, "tone": "soft", "at": 0.2, "fillA": 0.05},
             {"kind": "polygon", "points": mer[0], "tone": "accent", "fill": False, "at": 0.9, "dur": 1.2},
             {"kind": "polygon", "points": mer[1], "tone": "accent", "fill": False, "at": 1.3, "dur": 1.2},
             {"kind": "ellipse", "rx": 1, "ry": 0.3, "tone": "faint", "fill": False, "dash": True, "at": 0.5}],
          "points": [{"p": [0, 1], "label": "$p$", "tone": "ink", "at": 0.7}, {"p": [0, -1], "label": "$-p$", "tone": "hot", "at": 2.4}]},
         {"primitive": "sequence", "from": 4.2, "at": 0.3, "stagger": 0.3,
          "items": ["$S^n$", "$\\mathbb{RP}^n$", "$\\mathbb{CP}^n$", "$\\mathbb{HP}^n$", "$\\mathbb{O}P^2$"],
          "marks": {"0": {"tone": "mute", "at": 1.6}, "1": {"tone": "mute", "at": 1.6}, "2": {"tone": "accent", "at": 2.4}, "3": {"tone": "accent", "at": 2.4}, "4": {"tone": "accent", "at": 2.4}},
          "caption": "Settled by 1980: $S^n$ and $\\mathbb{RP}^n$. Claimed: the other three"}],
      "beats": [
          {"at": 0.2, "text": "On a round sphere, every geodesic from $p$ minimizes until it reaches the antipode"},
          {"at": 2.8, "text": "That is $\\mathrm{inj} = \\mathrm{diam}$, the defining property of a Blaschke manifold"},
          {"at": 4.4, "text": "The conjecture: up to scaling, only these five families have it"}]},
     {"form": "status", "label": "Metric Blaschke conjecture",
      "statement": ["\\mathrm{inj}(M, g) = \\mathrm{diam}(M, g)", "\\Rightarrow\\ M \\text{ is a round } S^n,\\ \\mathbb{RP}^n,\\ \\mathbb{CP}^n,\\ \\mathbb{HP}^n \\text{ or } \\mathbb{O}P^2"],
      "context": "Before: surfaces (Green, 1963); spheres and $\\mathbb{RP}^n$ by 1980 (Berger, Kazdan, Weinstein, Yang)",
      "stamp": "proved", "note": "Cited topological inputs have hypotheses 'verified at their uses': audit those"},
     {"lean": "none", "detail": "No Lean: one 41-page manuscript",
      "ourCheck": "We flagged the cited topological inputs; we checked no step"},
     [src("article, The metric Blaschke conjecture", "Green settled surfaces in 1963; Berger, Kazdan, Weinstein and Yang settled spheres and $\\mathbb{RP}^n$ by 1980"),
      src("article, The metric Blaschke conjecture", "A Blaschke manifold has injectivity radius equal to its diameter: every geodesic minimizes until it reaches the \"antipode\"."),
      src("article, The metric Blaschke conjecture", "41 pages, no Lean. The topological inputs for the projective planes (Kramer–Stolz, a result attributed to Reznikov) are cited with hypotheses \"verified at their uses\", which is the step I would audit."),
      src("review 344, claim", "is, up to scaling, isometric to a round sphere, standard RP^n, CP^n, HP^n or the Cayley plane")])

# ---------------------------------------------------------------- 345
geos = [rot_ellipse(0.9, 0.32, 0.35), rot_ellipse(0.85, 0.22, -0.9), rot_ellipse(0.55, 0.5, 0.0, (0.1, 0.05))]
spec("345", "proof", "Infinitely many closed geodesics on $S^n$",
     "Infinitely many closed geodesics on every Riemannian sphere",
     "Claim: every metric on $S^n$, and on every closed 3-manifold, has infinitely many distinct closed geodesics",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 4.0, "shapes": [
             {"kind": "superellipse", "p": 2.6, "r": 1.05, "tone": "soft", "at": 0.2, "fillA": 0.05},
             {"kind": "polygon", "points": geos[0], "tone": "accent", "fill": False, "at": 0.9, "dur": 1.0},
             {"kind": "polygon", "points": geos[1], "tone": "cool", "fill": False, "at": 1.5, "dur": 1.0},
             {"kind": "polygon", "points": geos[2], "tone": "accent", "fill": False, "at": 2.1, "dur": 1.0, "dash": True}]},
         {"primitive": "numberline", "from": 4.0, "min": 1, "max": 9.5, "ticks": [2, 3, 4, 5, 6, 7, 8, 9],
          "axisLabel": "dimension $n$ of the sphere $S^n$",
          "markers": [{"v": 2, "label": "every metric", "note": "early 1990s", "at": 0.4}],
          "ranges": [
              {"from": 3, "to": 9, "label": "generic metrics only", "note": "Rademacher", "at": 0.9, "side": "below"},
              {"from": 3, "to": 9, "label": "claimed: every metric", "note": "degenerate ones too", "tone": "claim", "at": 2.2}]}],
      "beats": [
          {"at": 0.2, "text": "Schematically: distinct closed geodesics on a lumpy sphere"},
          {"at": 2.6, "text": "The hard part: telling a new geodesic from an old one traversed again"},
          {"at": 4.4, "text": "Known for every metric on $S^2$; in higher dimensions only for generic metrics"}]},
     {"form": "status", "label": "Closed geodesics on spheres, degenerate metrics included",
      "statement": ["\\forall\\, g \\text{ on } S^n:", "\\#\\{\\text{prime closed geodesic images}\\} = \\infty"],
      "context": "Before: every metric on $S^2$ (early 1990s); only generic metrics on $S^n$",
      "stamp": "proved", "note": "The paper disputes Klingenberg's proof and a recent claim by Charles"},
     {"lean": "none", "detail": "No Lean: one 50-page manuscript",
      "ourCheck": "A machine paper disputing human ones: both need adjudication"},
     [src("article, Infinitely many closed geodesics on spheres", "Every metric on $S^2$ has infinitely many geometrically distinct closed geodesics (Bangert with Franks or Hingston, early 1990s). On $S^n$ for $n \\ge 3$ this was known only for generic metrics (Rademacher)."),
      src("article, Infinitely many closed geodesics on spheres", "The difficulty with degenerate metrics is telling new geodesics from iterates of old ones"),
      src("article, Infinitely many closed geodesics on spheres", "It also says Klingenberg's old proof is erroneous (following Asselle–Mazzucchelli) and points to two unsupported steps in a recent general claim by Charles. When a machine-written paper disputes a human one, both need adjudication. 50 pages, no Lean."),
      src("review 345, claim", "Every smooth Riemannian metric on S^n (n >= 2) has infinitely many prime closed geodesics with pairwise distinct images")])

# ---------------------------------------------------------------- 346
spec("346", "proof", "Regularity of stationary integral varifolds",
     "Stationary varifolds are regular almost everywhere",
     "Claim: every stationary integral $m$-varifold has $\\mathcal{H}^m(\\mathrm{Sing}\\,V) = 0$, and in fact $\\dim_H \\mathrm{Sing}\\,V \\le m-1$",
     {"dur": 8.6, "layout": "sequence", "panels": [
         {"primitive": "shape", "until": 3.8, "shapes": [
             {"kind": "polygon", "points": [[-1.2, -0.6], [1.2, 0.6]], "tone": "accent", "fill": False, "w": 3.2, "at": 0.3, "label": "plane 1", "labelAt": [1.05, 0.78]},
             {"kind": "polygon", "points": [[-1.2, 0.6], [1.2, -0.6]], "tone": "cool", "fill": False, "w": 3.2, "at": 0.8, "label": "plane 2", "labelAt": [1.05, -0.78]}],
          "points": [{"p": [0, 0], "label": "$\\mathrm{Sing}\\,V$", "tone": "hot", "at": 1.8}]},
         {"primitive": "numberline", "from": 3.8, "min": 0, "max": 5,
          "ticks": [{"v": 0, "label": "0"}, {"v": 3, "label": "$m-1$"}, {"v": 4, "label": "$m$"}],
          "axisLabel": "Hausdorff dimension of $\\mathrm{Sing}\\,V$",
          "markers": [{"v": 4, "label": "open since 1972", "note": "positive area?", "at": 0.5}],
          "slide": {"from": 4, "to": 3, "at": 1.6, "dur": 1.4, "label": "claimed $\\le m - 1$", "note": "sharp", "side": "below"}}],
      "beats": [
          {"at": 0.2, "text": "Two crossing planes are stationary, singular along a set one dimension lower"},
          {"at": 3.9, "text": "Allard showed in 1972 the regular set is dense; multiplicity broke the rest"},
          {"at": 6.4, "text": "The claim: the singular set never has positive area, and the crossing is the worst case"}]},
     {"form": "status", "label": "Almost-everywhere regularity of stationary integral varifolds",
      "statement": ["\\mathcal{H}^m(\\mathrm{Sing}\\,V) = 0", "\\dim_H \\mathrm{Sing}\\,V \\le m - 1"],
      "context": "Before: Allard (1972), regularity at density-one points; the regular set is dense",
      "stamp": "proved", "note": "A central open problem of geometric measure theory, in 112 pages"},
     {"lean": "none", "detail": "No Lean beyond a one-file stub; no main result is formalized",
      "ourCheck": "We read the route; we did not check the blow-up analysis"},
     [src("article, Almost-everywhere regularity of stationary varifolds", "Allard showed in 1972 that their regular set is dense, but whether the singular set can have positive area has stayed open, because multiplicity above one breaks his theorem."),
      src("article, Almost-everywhere regularity of stationary varifolds", "which two crossing planes show is optimal"),
      src("review 346, known_before", "Allard (Annals 1972) regularity at density-one points"),
      src("article, Almost-everywhere regularity of stationary varifolds", "This is a central open problem of geometric measure theory and 112 pages with no Lean; a one-file stub under `OAI/Geometry/Varifold` is all that exists."),
      src("review 346, known_before", "Brena-Decio-De Lellis Conjectures 1.1-1.2")])

# ---------------------------------------------------------------- 347
spec("347", "counterexample", "Strong Arnold fixed-point bounds fail",
     "Fewer fixed points than the strong Arnold bounds allow",
     "Claim: a Hamiltonian map of $Q^3$ with 3 fixed points, though every function on $Q^3$ has at least 4 critical points",
     {"dur": 8.8, "layout": "sequence", "panels": [
         {"primitive": "numberline", "until": 4.4, "min": 0, "max": 6, "ticks": [0, 1, 2, 3, 4, 5],
          "axisLabel": "count on the quadric threefold $Q^3$",
          "markers": [
              {"v": 4, "label": "every function", "note": "$\\ge 4$ critical points", "tone": "ink", "at": 0.5},
              {"v": 3, "label": "this map", "note": "exactly 3 fixed points", "tone": "claim", "at": 1.6, "side": "below"}]},
         {"primitive": "equation", "from": 4.4, "mode": "stack", "lines": [
             {"tex": "\\mathrm{SM}(M_m) = 80 + 1968m", "note": "stable Morse number", "at": 0.3, "size": 38},
             {"tex": "\\#\\mathrm{Fix} = 80 + 1952m", "note": "fixed points", "tone": "accent", "at": 1.1, "size": 38}]}],
      "beats": [
          {"at": 0.2, "text": "Arnold: a Hamiltonian map should have as many fixed points as a function has critical points"},
          {"at": 2.7, "text": "A degenerate counterexample: one fewer fixed point than the critical number"},
          {"at": 4.6, "text": "And nondegenerate ones on simply connected Kähler 22-manifolds, short by a fixed fraction"}]},
     {"form": "status", "label": "Strong Arnold conjectures: critical number, cup-length, stable Morse",
      "statement": ["\\#\\mathrm{Fix}(\\phi) = 3 < 4 = \\mathrm{Crit}(Q^3)"],
      "context": "The homological Arnold conjecture, a theorem of Floer theory, is untouched",
      "stamp": "counterexample", "note": "Refutes the strong variants only"},
     {"lean": "part", "detail": "Lean: only the degenerate quadric example, about 5,900 lines",
      "ourCheck": "We read the claims; we did not build the Lean"},
     [src("article, Arnold's fixed-point bounds", "The release gives [a Hamiltonian diffeomorphism of the complex quadric threefold](https://github.com/openai/math/blob/main/preprints/A-degenerate-counterexample-to-the-critical-number-Arnold-bound-September-23-2026/paper.pdf) with exactly 3 fixed points, while every smooth function on that manifold has at least 4 critical points, and families of simply connected Kähler 22-manifolds where the nondegenerate fixed-point count falls below the stable Morse number by a fixed fraction (stable Morse number $80 + 1968m$, fixed points $80 + 1952m$). Only the quadric example is in Lean (about 5,900 lines). These refute the strong variants and leave the homological conjecture untouched."),
      src("review 347, claim", "A Hamiltonian diffeomorphism of the complex quadric threefold Q^3 with exactly 3 fixed points < 4 = Crit(Q^3) = rational cup-length"),
      src("article, Arnold's fixed-point bounds", "The homological Arnold conjecture is a theorem of Floer theory"), NOBUILD])
print('ok')
