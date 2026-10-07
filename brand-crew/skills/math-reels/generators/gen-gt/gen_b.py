import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, os, math
import sys as _sys, os as _os; _sys.path.insert(0, _o.path.join(GEN, 'gen-gt')); from enrich_gt import enrich  # plain, proof, voice, visualised equations
OUT = _OUT
S = {}
NOT_BUILT = "I did not build the Lean library (no compilation allowed), so 'formalized' means the release ships a sorry-free, axiom-free (propext/Quot.sound/Classical.choice only) proof whose Comparator statement I read."
MS_CHECK = "We read the proof outline; we did not check the proof"

def base(id, kind, short, title, subtitle):
    return {"$schema": "../../brand-crew/skills/math-reels/schema.json", "id": id, "discipline": "Topology", "kind": kind,
            "short": short, "title": {"title": title, "subtitle": subtitle}}

# ------------------------------------------------------------------ 310
nodes, edges = [], []
for k, cx in enumerate([0.1, 0.3, 0.5, 0.7, 0.9]):
    nodes.append({"id": f"v{k}", "x": cx, "y": 0.22, "label": "$V_4$", "tone": "accent"})
    for j, dx in enumerate([-0.06, 0, 0.06]):
        nodes.append({"id": f"v{k}{j}", "x": round(cx + dx, 3), "y": 0.74})
        edges.append([f"v{k}", f"v{k}{j}"])
s = base("310", "proof", "Quillen's conjecture, rationally",
         "Quillen's conjecture in rational homology",
         r"Claim: if $O_p(G) = 1$, the poset of elementary abelian $p$-subgroups has nonzero rational homology")
s["object"] = {"dur": 8.4, "primitive": "graph", "nodes": nodes, "edges": edges, "r": 18, "edgeAt": 1.0, "edgeDur": 2.4,
    "beats": [
        {"at": 0.2, "text": r"Quillen's poset $\mathcal A_p(G)$: nontrivial elementary abelian $p$-subgroups, by inclusion"},
        {"at": 3.0, "text": r"A small instance: $G = A_5$, $p = 2$. Each Klein four-group sits over its three involutions"},
        {"at": 5.8, "text": r"Five separate pieces, so not contractible, and $A_5$ has no normal 2-subgroup"}]}
s["achievement"] = {"form": "status", "label": "Quillen's conjecture (1978)",
    "statement": [r"O_p(G) = 1 \ \Rightarrow\ \tilde H_*\big(\mathcal A_p(G); \mathbb Q\big) \neq 0"],
    "context": r"Before: solvable groups (Quillen); $p > 5$ up to unitary cases (Aschbacher–Smith 1993); $p = 2$ was left",
    "stamp": "proved", "note": "Rests on the classification of finite simple groups and long human reductions"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 63 pages, closing the cases a long chain of reductions left open",
               "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 310, known_before", "quote": "Quillen (Adv. Math. 1978) posed it and proved solvable groups"},
    {"ref": "review 310, known_before", "quote": "Aschbacher-Smith (Annals 1993) for p > 5 modulo unitary conditions"},
    {"ref": "review 310, known_before", "quote": "At p = 2, Piterman-Smith and Piterman narrowed minimal counterexamples to classical components in characteristic >= 5."},
    {"ref": "review 310, caveats", "quote": "The genuinely new content is the p = 2 endgame plus a self-contained unitary dimension property; it rests on CFSG"},
    {"ref": "review 310, caveats", "quote": "63 pages. No Lean."}]
S["310"] = s

# ------------------------------------------------------------------ 311
s = base("311", "proof", "Hovey–Strickland and Chai",
         "The Hovey–Strickland and Chai conjectures",
         r"Claim: invariant primes of the Lubin–Tate ring form a chain, so $K(n)$-local thick ideals are classified")
s["object"] = {"dur": 8.4, "heading": r"Height $n = 3$, schematically: the invariant primes of $E_0$",
    "primitive": "graph", "r": 26, "edgeAt": 1.2, "edgeDur": 2.0,
    "nodes": [{"id": "a", "x": 0.12, "y": 0.42, "label": "$0$"}, {"id": "b", "x": 0.37, "y": 0.42, "label": "$I_1$"},
              {"id": "c", "x": 0.63, "y": 0.42, "label": "$I_2$"}, {"id": "d", "x": 0.88, "y": 0.42, "label": "$I_3$", "tone": "accent"}],
    "edges": [["a", "b", {"tone": "accent"}], ["b", "c", {"tone": "accent"}], ["c", "d", {"tone": "accent"}]],
    "beats": [
        {"at": 0.2, "text": r"The Lubin–Tate ring $E_0$: which primes are stable under an open $U$ in the stabilizer?"},
        {"at": 3.0, "text": r"Claimed: only the chain $0 \subset I_1 \subset \cdots \subset I_n$ (Chai's hope)"},
        {"at": 5.8, "text": r"So dualizable $K(n)$-local spectra have exactly $n + 2$ thick tensor ideals"}]}
s["achievement"] = {"form": "status", "label": "Hovey–Strickland conjecture (1999) and Chai's hope",
    "statement": [r"\{U\text{-invariant primes of } E_0\} = \{0, I_1, \ldots, I_n\}"],
    "context": r"Before: height 2 only (Barthel–Heard–Naumann 2022), who showed Chai's hope implies the conjecture",
    "stamp": "proved", "note": r"Every prime $p$, every height $n \ge 1$"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 34 pages, building on the Barthel–Heard–Naumann reduction",
               "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 311, claim", "quote": "the U-invariant prime ideals of the Lubin-Tate ring E_0 are exactly 0, I_1, ..., I_n (Chai's 'hope', finite-residue-field form); consequently the dualizable K(n)-local category has exactly n+2 thick tensor ideals"},
    {"ref": "review 311, known_before", "quote": "Hovey-Strickland (Memoirs AMS 1999, Section 12 and Problem 16.8); Barthel-Heard-Naumann (2022) showed Chai's hope implies Hovey-Strickland and proved the conjecture at height two"},
    {"ref": "review 311, caveats", "quote": "34 pages; relies on the Barthel-Heard-Naumann implication."}]
S["311"] = s

# ------------------------------------------------------------------ 312
s = base("312", "proof", "Grothendieck's homotopy hypothesis",
         "The Grothendieck homotopy hypothesis",
         r"Claim: weak globular $\infty$-groupoids have the homotopy theory of spaces, as Grothendieck guessed")
s["object"] = {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "graph", "until": 4.2, "r": 22, "edgeAt": 0.4, "edgeDur": 2.4,
     "nodes": [{"id": "a", "x": 0.15, "y": 0.5, "label": "$a$"}, {"id": "b", "x": 0.85, "y": 0.5, "label": "$b$"},
               {"id": "f", "x": 0.5, "y": 0.12, "label": "$f$"}, {"id": "g", "x": 0.5, "y": 0.88, "label": "$g$", "tone": "accent"},
               {"id": "t", "x": 0.5, "y": 0.5, "label": r"$\theta$", "tone": "accent"}],
     "edges": [["a", "f"], ["f", "b"], ["a", "g", {"tone": "accent"}], ["g", "b", {"tone": "accent"}],
               ["f", "t", {"tone": "accent"}], ["t", "g", {"tone": "accent"}]]},
    {"primitive": "equation", "from": 4.2, "mode": "stack", "lines": [
        {"tex": r"X \hookrightarrow X^{+} \ \text{ is a weak equivalence}", "at": 0.3, "size": 40},
        {"tex": r"\Rightarrow\ \text{weak } \infty\text{-groupoids} \ \simeq\ \text{spaces}", "at": 1.4, "size": 40, "tone": "accent"}]}],
    "beats": [
        {"at": 0.2, "text": r"Schematically, at $n = 1$: old cell $f$; adjoin a parallel $g$ and a cell $\theta$ from $f$ to $g$"},
        {"at": 4.3, "text": "Henry reduced the hypothesis to one step: this expansion changes no homotopy"},
        {"at": 6.8, "text": "The paper proves that step for every coherator in the Ara–Henry convention"}]}
s["achievement"] = {"form": "status", "label": "Grothendieck's homotopy hypothesis (Pursuing Stacks, 1983)",
    "statement": [r"\text{weak globular } \infty\text{-groupoids} \ \simeq\ \text{spaces}"],
    "context": r"Via Henry's pushout conjecture (2018); strict $\infty$-groupoids provably fail",
    "stamp": "proved", "note": "For coherators in the Ara–Henry convention, not every model"}
s["verify"] = {"lean": "part", "detail": "Lean: the elementary-expansion theorem, about 12,800 lines; not the model structure or comparison",
               "ourCheck": "We read the Comparator statement; we did not build the Lean"}
s["sources"] = [
    {"ref": "review 312, known_before", "quote": "Grothendieck, Pursuing Stacks (1983)"},
    {"ref": "review 312, known_before", "quote": "Henry (2018) isolated the pushout conjecture (his Conj. 5.3.3)"},
    {"ref": "review 312, claim", "quote": "Key step: Henry's pushout conjecture, that elementary expansions X -> X+ (adjoin a parallel n-cell and an (n+1)-cell) are weak equivalences."},
    {"ref": "article, The Grothendieck homotopy hypothesis", "quote": "The pushout theorem itself is in Lean (`OAI.Grothendieck.elementary_expansion`, about 12,800 lines); the semi-model structure and the comparison with spaces are not."},
    {"ref": "article, The Grothendieck homotopy hypothesis", "quote": "strict groupoids provably fail"},
    {"ref": "review 312, caveats", "quote": NOT_BUILT}]
S["312"] = s

# ------------------------------------------------------------------ 313
known = [(0, 0), (0, 1), (0, 2), (0, 3), (1, 2), (1, 3)]
cells = [[r, c, "soft" if (r, c) in known else "accent"] for r in range(4) for c in range(4)]
s = base("313", "proof", "Finite generation for the $K(n)$-local sphere",
         "Finite generation for the $K(n)$-local sphere",
         r"Claim: every $\pi_t L_{K(n)} S$ is a finitely generated $\mathbb Z_p$-module, at every prime and height")
s["object"] = {"dur": 8.4, "heading": r"Is $\pi_t L_{K(n)}S$ finitely generated over $\mathbb Z_p$? A window of the table",
    "primitive": "grid", "rows": 4, "cols": 4, "cells": cells, "stagger": 0.3,
    "caption": r"rows: height $n = 1$ to $4$ · columns: $p = 2, 3, 5, 7$ · grey: known before",
    "beats": [
        {"at": 0.2, "text": r"Each cell: one prime $p$ and one chromatic height $n$"},
        {"at": 3.0, "text": r"Known before: height 1, and height 2 for $p \ge 5$ (Shimomura's computations)"},
        {"at": 5.8, "text": "The claim fills the whole table, every prime and every height"}]}
s["achievement"] = {"form": "status", "label": "Hovey–Strickland Problem 16.2",
    "statement": [r"\pi_t L_{K(n)} S_p \ \text{is a finitely generated } \mathbb Z_p\text{-module}"],
    "context": r"With the known rational answer (Barthel–Schlank–Stapleton–Weinstein) this pins down the free ranks",
    "stamp": "proved", "note": "No uniform bound on the torsion"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 103 pages, via a descent spectral sequence with a vanishing line",
               "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 313, known_before", "quote": "Hovey-Strickland Problem 16.2 and Hovey's problem list Problem 1. Height 1 classical; height 2, p >= 5 via Shimomura's computations"},
    {"ref": "review 313, caveats", "quote": "103 pages; no uniform bound."},
    {"ref": "article, Finite generation for the K(n)-local sphere", "quote": "which together with the known rational computation of Barthel, Schlank, Stapleton and Weinstein pins down the free ranks"}]
S["313"] = s

# ------------------------------------------------------------------ 314
s = base("314", "proof", "Chromatic fixed-point loss",
         "Cyclic length and chromatic fixed-point loss",
         r"Claim: the chromatic height lost from $H$- to $G$-fixed points equals the shortest cyclic subnormal chain")
s["object"] = {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "graph", "until": 4.2, "r": 26, "edgeAt": 0.6, "edgeDur": 2.0,
     "nodes": [{"id": "h", "x": 0.12, "y": 0.42, "label": "$H$"}, {"id": "a", "x": 0.37, "y": 0.42, "label": "$H_1$"},
               {"id": "b", "x": 0.63, "y": 0.42, "label": "$H_2$"}, {"id": "g", "x": 0.88, "y": 0.42, "label": "$G$", "tone": "accent"}],
     "edges": [["h", "a", {"tone": "accent"}], ["a", "b", {"tone": "accent"}], ["b", "g", {"tone": "accent"}]]},
    {"primitive": "equation", "from": 4.2, "mode": "stack", "lines": [
        {"tex": r"r_n(G,H) \le \ell_{\mathrm{cyc}}(H,G)", "note": "known", "at": 0.3},
        {"tex": r"r_n(G,H) = \ell_{\mathrm{cyc}}(H,G)", "note": "claimed", "at": 1.4, "tone": "accent"}]}],
    "beats": [
        {"at": 0.2, "text": r"Schematically: $H \lhd H_1 \lhd H_2 \lhd G$, every quotient cyclic; $\ell_{\mathrm{cyc}}$ is the shortest length"},
        {"at": 4.3, "text": r"$r_n(G,H)$: the chromatic height lost passing from $H$- to $G$-fixed points"},
        {"at": 6.8, "text": "The chain length was an upper bound; the claim is that it is exact"}]}
s["achievement"] = {"form": "status", "label": "Kuhn–Lloyd's cautious hope (chromatic Smith theory)",
    "statement": [r"r_n(G,H) = \ell_{\mathrm{cyc}}(H,G) \ \text{ for every finite } p\text{-group } G"],
    "context": r"Before: abelian $G$, where the loss is the rank of $G/H$ (2019), and some central extensions (Kuhn–Lloyd)",
    "stamp": "proved", "note": r"Completes the Balmer-spectrum topology for finite $p$-groups, if correct"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 30 pages, a technical result", "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 314, claim", "quote": "equals the least length of a subnormal chain from H to G with cyclic quotients."},
    {"ref": "review 314, known_before", "quote": "(2019) solved abelian G (loss = rank of G/H); Kuhn-Lloyd proved equality for central extensions of elementary abelian by C_2 and expressed 'cautious hope'"},
    {"ref": "review 314, caveats", "quote": "30 pages; completes the Balmer spectrum topology for p-groups if correct."},
    {"ref": "review 314, explainer", "quote": "The upper bound by cyclic subnormal chains was known"}]
S["314"] = s

# ------------------------------------------------------------------ 315
s = base("315", "proof", "Singer conjecture in dimension 4",
         "The four-dimensional Singer conjecture",
         r"Claim: for closed aspherical 4-manifolds, the $L^2$-Betti numbers vanish outside the middle degree")
s["object"] = {"dur": 8.4, "primitive": "sequence",
    "items": [r"$b_0^{(2)}$", r"$b_1^{(2)}$", r"$b_2^{(2)}$", r"$b_3^{(2)}$", r"$b_4^{(2)}$"], "index": "degree #",
    "at": 0.4, "stagger": 0.2,
    "marks": {"1": {"tone": "accent", "at": 3.2}, "3": {"tone": "accent", "at": 3.6}, "0": {"tone": "accent", "at": 5.8},
              "4": {"tone": "accent", "at": 6.0}, "2": {"tone": "cool", "at": 6.4}},
    "caption": r"colour: claimed zero · blue: the middle degree, where it all sits",
    "beats": [
        {"at": 0.2, "text": r"$L^2$-Betti numbers of the universal cover of a closed aspherical 4-manifold"},
        {"at": 3.0, "text": r"By duality the question is one number: is $b_1^{(2)} = 0$?"},
        {"at": 5.8, "text": r"The claim: all of it sits in degree 2, so $\chi \ge 0$ and $\chi \ge |\sigma|$"}]}
s["achievement"] = {"form": "status", "label": "Singer conjecture (1970s), dimension 4",
    "statement": [r"b_k^{(2)}(\widetilde M) = 0 \ \text{ for } k \neq 2"],
    "context": r"Before: dimension at most 3, locally symmetric and Kähler hyperbolic manifolds (Gromov 1991)",
    "stamp": "proved", "note": r"Also for every finite aspherical 4-dimensional Poincaré complex"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 45 pages of combinatorial group theory, not analysis",
               "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 315, known_before", "quote": "Singer conjecture (1970s); known in dims <= 3 (via geometrization in dim 3, Lott-Lueck), for locally symmetric spaces, Kaehler hyperbolic manifolds (Gromov 1991)"},
    {"ref": "review 315, claim", "quote": "the L2-Betti numbers of the universal cover vanish outside degree 2"},
    {"ref": "review 315, caveats", "quote": "45 pages for a well-known open case; proof is combinatorial-group-theoretic"},
    {"ref": "article, The Singer conjecture in dimension 4", "quote": "In dimension 4 that reduces to $b_1^{(2)} = 0$."}]
S["315"] = s

# ------------------------------------------------------------------ 316
s = base("316", "proof", "Curtis's conjecture",
         "Curtis's conjecture on the stable Hurewicz image",
         r"Claim: only $\eta, \nu, \sigma$ and the Kervaire classes $\theta_j$ reach the mod-2 homology of $Q_0S^0$")
s["object"] = {"dur": 8.4, "heading": r"Degrees $d > 0$ where $\pi_d^S \to H_d(Q_0S^0; \mathbb F_2)$ can be nonzero",
    "primitive": "sequence", "items": ["1", "2", "3", "6", "7", "14", "30", "62", "126"], "perRow": 9, "at": 0.4, "stagger": 0.15,
    "marks": {"0": {"tone": "accent", "at": 3.0}, "2": {"tone": "accent", "at": 3.2}, "4": {"tone": "accent", "at": 3.4},
              "1": {"tone": "cool", "at": 3.8}, "3": {"tone": "cool", "at": 3.95}, "5": {"tone": "cool", "at": 4.1},
              "6": {"tone": "cool", "at": 4.25}, "7": {"tone": "cool", "at": 4.4}, "8": {"tone": "cool", "at": 4.55}},
    "caption": r"colour: $\eta, \nu, \sigma$ (Hopf invariant one) · blue: Kervaire classes $\theta_j$",
    "beats": [
        {"at": 0.2, "text": r"Which homology classes of $Q_0S^0$ come from actual maps of spheres?"},
        {"at": 3.0, "text": r"Curtis: only $\eta, \nu, \sigma$ and the Kervaire-invariant-one classes $\theta_j$"},
        {"at": 5.8, "text": "So the positive image vanishes outside these nine degrees"}]}
s["achievement"] = {"form": "status", "label": "Curtis's conjecture (1975)",
    "statement": [r"\mathrm{im}\big(\pi_*^S \to H_*(Q_0S^0;\mathbb F_2)\big) = \langle \eta, \nu, \sigma, \theta_j \rangle"],
    "context": r"Before: a proposed proof had a gap, found by Wellington. Eccles's conjecture for spheres follows",
    "stamp": "proved", "note": "The finite list of degrees relies on Hill–Hopkins–Ravenel"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 37 pages for a 50-year-old conjecture", "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 316, claim", "quote": "hence Eccles's conjecture for spheres, and the positive image vanishes outside degrees 1,2,3,6,7,14,30,62,126."},
    {"ref": "review 316, known_before", "quote": "Curtis (1975); May recorded a gap (found by Wellington) in a proposed proof."},
    {"ref": "review 316, caveats", "quote": "37 pages for a 50-year-old conjecture; depends on HHR for the finiteness corollary."},
    {"ref": "article, Curtis's conjecture", "quote": "the images of the Hopf-invariant-one classes $\\eta, \\nu, \\sigma$ and the Kervaire-invariant-one classes $\\theta_j$"}]
S["316"] = s

# ------------------------------------------------------------------ 317
s = base("317", "proof", "Thomason model structures, every $n$",
         "Thomason model structures in every strict dimension",
         r"Claim: strict $n$-categories, for every $n$ up to $\omega$, model all homotopy types, as categories do")
s["object"] = {"dur": 8.4, "primitive": "numberline", "min": 0.3, "max": 7.2, "ticks": [1, 2, 3, 4, 5, 6, 7],
    "axisLabel": r"dimension $n$ of strict $n$-categories",
    "markers": [{"v": 1, "label": "Thomason", "note": "1980", "at": 1.0},
                {"v": 2, "label": "Ara–Maltsiniotis", "note": "with Chiche", "at": 2.0}],
    "ranges": [{"from": 3, "to": 7, "label": "claimed", "note": r"every $n$, up to $\omega$", "tone": "claim", "at": 4.6}],
    "beats": [
        {"at": 0.2, "text": r"Do strict $n$-categories model all homotopy types, as small categories do?"},
        {"at": 3.0, "text": r"Known for $n = 1$ (Thomason) and $n = 2$ (Ara–Maltsiniotis)"},
        {"at": 5.6, "text": "Claimed for every dimension: the missing pushout condition, proved"}]}
s["achievement"] = {"form": "status", "label": "Ara–Maltsiniotis conjecture",
    "statement": [r"\mathrm{Str}\,n\text{-}\mathcal{C}at \ \simeq_{Q}\ s\mathcal{S}et \quad (1 \le n \le \omega)"],
    "context": r"Before: $n = 1$ (Thomason 1980) and $n = 2$; the pushout condition was the open part",
    "stamp": "proved", "note": "Machine-checked, if the Lean definitions match strict $\\omega$-categories"}
s["verify"] = {"lean": "main", "detail": "Model structure and Quillen equivalence in Lean, about 160,000 lines",
               "ourCheck": "We read the Comparator statement; we did not build the Lean"}
s["sources"] = [
    {"ref": "article, Thomason model structures in every dimension", "quote": "Thomason showed in 1980 that small categories model all homotopy types."},
    {"ref": "article, Thomason model structures in every dimension", "quote": "the model structure and Quillen equivalence are in Lean (`OAI/CategoryTheory/Thomason`, about 160,000 lines)"},
    {"ref": "review 317, known_before", "quote": "Ara-Maltsiniotis n = 2 (with Chiche)"},
    {"ref": "review 317, known_before", "quote": "The pushout condition was the open part"},
    {"ref": "review 317, caveats", "quote": "Impressive if the Comparator statement faithfully encodes strict omega-categories and orientals."},
    {"ref": "review 317, caveats", "quote": NOT_BUILT}]
S["317"] = s

for k, v in S.items():
    json.dump(enrich(v), open(os.path.join(OUT, k + ".json"), "w"), ensure_ascii=False, indent=2)
print('wrote', list(S))
