import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, os, math
import sys as _sys, os as _os; _sys.path.insert(0, _o.path.join(GEN, 'gen-gt')); from enrich_gt import enrich  # plain, proof, voice, visualised equations
OUT = _OUT
S = {}
MS_CHECK = "We read the proof outline; we did not check the proof"

def base(id, kind, short, title, subtitle):
    return {"$schema": "../../brand-crew/skills/math-reels/schema.json", "id": id, "discipline": "Topology", "kind": kind,
            "short": short, "title": {"title": title, "subtitle": subtitle}}

# ------------------------------------------------------------------ 318
ok = [(0, 1), (0, 2), (0, 3), (1, 1), (1, 2), (1, 3)]
cells = [[r, c, "ok"] for r, c in ok] + [[1, 0, "bad"], [2, 2, "hot"], [2, 3, "hot"]]
values = [["", "$\\checkmark$", "$\\checkmark$", "$\\checkmark$"], ["×", "$\\checkmark$", "$\\checkmark$", "$\\checkmark$"], ["", "", "×", "×"]]
s = base("318", "disproof", "Chromatic splitting fails at height 3",
         "Chromatic splitting fails at height three",
         r"Claim: for $p \ge 5$ Hopkins's strong chromatic splitting fails at height 3, seen by a nonzero map on $\pi_{-3}$")
s["object"] = {"dur": 8.4, "heading": "Strong chromatic splitting, by height and prime (schematically)",
    "primitive": "grid", "rows": 3, "cols": 4, "cells": cells, "values": values, "stagger": 0.3,
    "blocks": [{"r": 2, "c": 2, "h": 1, "w": 2, "tone": "hot", "at": 4.6}],
    "caption": r"rows: height $n = 1, 2, 3$ · columns: $p = 2, 3, 5, 7$ · blank: not covered here",
    "beats": [
        {"at": 0.2, "text": "The prediction: adjacent chromatic layers of the sphere overlap in a simple wedge"},
        {"at": 3.0, "text": r"True at heights 1 and 2 for $p > 2$; Beaudry broke the strong form at $n = p = 2$"},
        {"at": 5.8, "text": r"Claimed: it fails at height 3 for every $p \ge 5$"}]}
s["achievement"] = {"form": "status", "label": "Hopkins's chromatic splitting conjecture, strong form",
    "statement": [r"L_0 L_{K(3)}S \to L_0 L_{K(2)} L_{K(3)}S \ \neq 0 \ \text{on } \pi_{-3}"],
    "context": r"So it fails even as an equivalence of $E(2)$-local spectra. Before: Beaudry (2017) at $n = p = 2$",
    "stamp": "disproved", "note": r"Positive side: a $2^n$-stage filtration holds for $p > n + 1$"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: five papers, 372 pages, mixed positive and negative results",
               "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 318, claim", "quote": "(i) For p >= 5 the canonical map L_0 L_{K(3)}S -> L_0 L_{K(2)} L_{K(3)}S is nonzero on pi_{-3}, so Hopkins's strong chromatic splitting fails at height 3 even as an equivalence of E(2)-local spectra."},
    {"ref": "review 318, known_before", "quote": "known true at heights 1 and 2 for p > 2 (Shimomura-Yabe, Hopkins); Beaudry (Geom. Topol. 2017) disproved the strong form at n = p = 2."},
    {"ref": "review 318, claim", "quote": "(iii) Positive: for n >= 1, p > n+1, L_{n-1}L_{K(n)}S_p admits a 2^n-stage filtration with the predicted cofibers"},
    {"ref": "review 318, caveats", "quote": "Five papers, 372 pages; mixed positive and negative results."}]
S["318"] = s

# ------------------------------------------------------------------ 319
s = base("319", "counterexample", "Hahn–Wilson fails at height 2",
         "Counterexamples to finite generation at chromatic height two",
         r"Claim: for large primes, a spectrum of fp-type 2 is not finitely built from $\mathrm{BP}\langle 2\rangle$")
s["object"] = {"dur": 8.4, "primitive": "venn",
    "sets": [{"label": r"fp-type $2$"}, {"label": r"built from $\mathrm{BP}\langle 2\rangle$"}],
    "regions": [{"set": "A&!B", "label": "predicted empty", "tone": "hot", "x": 0.34, "y": 0.68, "at": 3.2}],
    "members": [{"x": 0.33, "y": 0.42, "label": "$X$", "tone": "hot", "at": 5.8}],
    "beats": [
        {"at": 0.2, "text": r"fp-type 2: mod-$p$ cohomology finitely presented over the Steenrod algebra"},
        {"at": 3.0, "text": r"Hahn–Wilson predicted every such spectrum is finitely built from $\mathrm{BP}\langle 2\rangle$"},
        {"at": 5.6, "text": r"Claimed: a spectrum $X$ outside, for every large prime (schematically)"}]}
s["achievement"] = {"form": "status", "label": "Hahn–Wilson conjecture at height 2",
    "statement": [r"X \text{ of fp-type } 2, \quad X \notin \mathrm{thick}\big(\mathrm{BP}\langle 2\rangle\big)"],
    "context": r"Yet $L_2^f X = L_2 X$ and $L_{T(2)} X = L_{K(2)} X$: both telescope comparisons hold",
    "stamp": "counterexample", "note": r"Only for sufficiently large $p$, against a specified form of $\mathrm{BP}\langle 2\rangle$"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 79 pages, a technical result", "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 319, claim", "quote": "For every sufficiently large prime p there is a connective p-complete spectrum X of exact fp-type 2 not in the thick subcategory generated by (a specified standard form of) BP<2>^_p, although L_2^f X = L_2 X and L_{T(2)}X = L_{K(2)}X; refuting the Hahn-Wilson conjecture at height 2."},
    {"ref": "review 319, caveats", "quote": "Only 'sufficiently large p'; depends on 'the specified standard form' of BP<2>. 79 pages."},
    {"ref": "review 319, explainer", "quote": "fp-type spectra are those whose mod-p cohomology is finitely presented over the Steenrod algebra"}]
S["319"] = s

# ------------------------------------------------------------------ 320
def cyc(n, fills, hot=None):
    nodes, edges = [], []
    for k in range(n):
        a = -math.pi / 2 + 2 * math.pi * k / n
        nodes.append({"id": f"n{k}", "x": round(0.5 + 0.3 * math.cos(a), 3), "y": round(0.47 + 0.36 * math.sin(a), 3), "fill": fills[k]})
    for k in range(n):
        j = (k + 1) % n
        e = [f"n{k}", f"n{j}"]
        if hot is not None and k == hot: e.append({"tone": "hot", "w": 3.4})
        edges.append(e)
    return nodes, edges
n6, e6 = cyc(6, ["bad", "cool"] * 3)
n5, e5 = cyc(5, ["bad", "cool", "bad", "cool", "bad"], hot=4)
s = base("320", "counterexample", "Borel fails in dimension 4",
         "Nonhomeomorphic closed aspherical four-manifolds",
         r"Claim: two closed aspherical 4-manifolds are homotopy equivalent but not homeomorphic")
s["object"] = {"dur": 8.4, "layout": "split", "heading": "Two-colour a cycle: even length works, odd length cannot",
    "panels": [{"primitive": "graph", "nodes": n6, "edges": e6, "r": 16, "edgeAt": 0.5, "edgeDur": 2.0},
               {"primitive": "graph", "nodes": n5, "edges": e5, "r": 16, "edgeAt": 2.8, "edgeDur": 2.0}],
    "beats": [
        {"at": 0.2, "text": r"The combinatorial core, schematically: 2-colour a cycle red and blue"},
        {"at": 2.8, "text": "An odd cycle always leaves two neighbours with the same colour"},
        {"at": 5.6, "text": r"Marked fillings exist only for even $d$, so the two manifolds cannot be homeomorphic"}]}
s["achievement"] = {"form": "status", "label": "Borel conjecture (1953), dimension 4",
    "statement": [r"M \simeq N, \ \ \pi_1 \text{ word-hyperbolic}, \ \ M \not\cong N"],
    "context": r"Before: true in dimension at most 3, and for hyperbolic groups in dimension 5 and up (Bartels–Lück 2012)",
    "stamp": "counterexample", "note": "Imports the invariant of family 305 as a black box; only as solid as 305"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 60 pages; the odd-cycle colouring core is checkable",
               "ourCheck": MS_CHECK}
s["sources"] = [
    {"ref": "review 320, known_before", "quote": "Borel (1953 letter to Serre). True in dims <= 3 (geometrization), and for large classes of groups in dims >= 5 (Farrell-Jones; Bartels-Lueck 2012 for hyperbolic and CAT(0) groups)."},
    {"ref": "review 320, claim", "quote": "There exist closed connected aspherical topological 4-manifolds M, N with common word-hyperbolic fundamental group that are homotopy equivalent but not homeomorphic"},
    {"ref": "review 320, caveats", "quote": "Imports the marked tensor obstruction (family 305)"},
    {"ref": "review 320, caveats", "quote": "so it is only as solid as 305. The combinatorial core (odd-cycle colouring argument) is checkable. 60 pages."},
    {"ref": "article, Disc embedding, Wall's PD4 question and the Borel conjecture", "quote": "a chamber whose $d$-fold cyclic covers have marked fillings exactly when $d$ is even, decided by trying to 2-colour an odd cycle."}]
S["320"] = s

# ------------------------------------------------------------------ 321
s = base("321", "counterexample", "Wall's D(2) problem: a counterexample",
         "A counterexample to Wall's D(2) problem",
         r"Claim: a finite 3-complex that passes every D(2) test is not homotopy equivalent to any 2-complex")
s["object"] = {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 4.4, "mode": "stack", "lines": [
        {"tex": r"x_1 a_1 x_1^{-1} = a_1^4,\ \ x_2 a_2 x_2^{-1} = a_2^3", "at": 0.3, "size": 36},
        {"tex": r"x_1 = a_2^{13},\ \ s x_2 s^{-1} = a_1^5", "at": 0.9, "size": 36},
        {"tex": r"G = P \,/\, \langle\langle x_1^2,\ x_2^3 \rangle\rangle", "at": 1.8, "size": 36, "tone": "soft"}]},
    {"primitive": "equation", "from": 4.4, "mode": "replace", "lines": [
        {"tex": r"\rho:\ x_1 \mapsto -1,\ a_1 \mapsto \zeta,\ x_2 \mapsto \zeta^2,\ a_2 \mapsto -1,\ s \mapsto 1", "note": "respects every relation", "size": 36, "at": 0.3},
        {"tex": r"\text{minor} = -4(1 - \zeta^2) \neq 0", "note": "the twisted boundary matrix is injective", "at": 1.5},
        {"tex": r"x_1 \text{ has order } 2, \quad \rho(x_1) = -1", "note": "no 2-complex allows both", "tone": "accent", "at": 2.7}]}],
    "beats": [
        {"at": 0.2, "text": r"Five generators, four relators; then kill $x_1^2$ and $x_2^3$"},
        {"at": 4.5, "text": r"A character $\rho$, with $\zeta = e^{2\pi i/3}$, kills the twisted second homology"},
        {"at": 7.0, "text": r"But $x_1$ has order 2 and $\rho(x_1) = -1$"}]}
s["achievement"] = {"form": "status", "label": "Wall's D(2) problem (1965; Problem D3, 1979)",
    "statement": [r"X \text{ is D(2)}, \quad X \not\simeq \text{any finite 2-complex}"],
    "context": r"Before: true stably (Cohen; Hambleton), and for some finite groups, e.g. quaternion of order 24, 28, 32",
    "stamp": "counterexample", "note": r"$\pi_1 X$ is infinite: the finite-group version stays open"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 9 pages, elementary enough to check by hand",
               "ourCheck": "We recomputed the relators and the minor in Python; no gap found"}
s["sources"] = [
    {"ref": "article, Wall's D(2) problem", "quote": "Wall's D(2) problem (1965; Problem D3 in his 1979 list)"},
    {"ref": "article, Wall's D(2) problem", "quote": "P = \\langle x_1, a_1, x_2, a_2, s \\mid x_1 a_1 x_1^{-1} = a_1^4,\\ x_2 a_2 x_2^{-1} = a_2^3,\\ x_1 = a_2^{13},\\ s x_2 s^{-1} = a_1^5 \\rangle"},
    {"ref": "article, Wall's D(2) problem", "quote": "and kill $t_1 = x_1^2$ and $t_2 = x_2^3$"},
    {"ref": "article, Wall's D(2) problem", "quote": "(with $\\zeta = e^{2\\pi i/3}$) respects every relation, kills $t_1, t_2$, and makes the twisted boundary matrix injective. But $x_1$ has order exactly 2 in $G$ and $\\rho(x_1) = -1$."},
    {"ref": "article, Wall's D(2) problem", "quote": "most recently Hofmann and Nicholson for quaternion groups of order 24, 28 and 32"},
    {"ref": "article, Wall's D(2) problem", "quote": "I did the same check independently in Python"},
    {"ref": "article, Wall's D(2) problem", "quote": "the minor on columns $x_1, a_1, x_2, s$ is $-4(1 - \\zeta^2) \\neq 0$"},
    {"ref": "article, Wall's D(2) problem", "quote": "I did not find a gap"},
    {"ref": "review 321, caveats", "quote": "Only 9 pages of mathematics and fully elementary."},
    {"ref": "review 321, caveats", "quote": "the most-studied form of the D(2) problem is for finite fundamental groups, which remains open; this counterexample has infinite pi_1."}]
S["321"] = s

for k, v in S.items():
    json.dump(enrich(v), open(os.path.join(OUT, k + ".json"), "w"), ensure_ascii=False, indent=2)
print('wrote', list(S))
