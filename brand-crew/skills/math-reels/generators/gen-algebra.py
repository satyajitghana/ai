import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, os
import sys as _sys; _sys.path.insert(0, GEN); from enrich_ag import enrich
OUT = _OUT
S = {}

def spec(id, kind, short, title, subtitle, obj, ach, lean, detail, ourCheck, sources):
    S[id] = {
        "$schema": "../../brand-crew/skills/math-reels/schema.json",
        "id": id, "discipline": "Algebra", "kind": kind, "short": short,
        "title": {"title": title, "subtitle": subtitle},
        "object": obj, "achievement": ach,
        "verify": {"lean": lean, "detail": detail, "ourCheck": ourCheck},
        "sources": [{"ref": r, "quote": q} for r, q in sources],
    }

A = 'article, Algebraic geometry and algebra'
PAPER_ONLY = "We read the claim and the review; we did not check the proof"

# ---------------------------------------------------------------- 193 Serre
spec('193', 'proof', "Serre's intersection multiplicity, $\\chi > 0$",
  "Serre's intersection multiplicities are always positive",
  "Claim: $\\chi(M,N) > 0$ over every regular local ring, including ramified mixed characteristic",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.9, "mode": "stack", "lines": [
      {"tex": r"\chi(M,N) = \sum_i (-1)^i\, \ell\big(\mathrm{Tor}_i(M,N)\big)", "tone": "accent", "at": 0.3, "size": 44},
      {"tex": r"\dim M + \dim N = \dim R", "tone": "soft", "at": 1.2, "size": 32}]},
    {"primitive": "numberline", "from": 3.9, "min": 1958, "max": 2032, "ticks": [1960, 1980, 2000, 2020],
     "axisLabel": "the conjecture, piece by piece",
     "markers": [
       {"v": 1965, "label": "Serre", "note": "equal char, unramified", "at": 0.4},
       {"v": 1985, "label": "vanishing", "note": "Roberts; Gillet–Soulé", "at": 0.8},
       {"v": 1995, "label": "nonnegativity", "note": "Gabber", "at": 1.2},
       {"v": 2026, "label": "claimed", "note": "positivity, ramified", "tone": "claim", "at": 2.2}]}],
   "beats": [
     {"at": 0.2, "text": "Serre's multiplicity: an alternating sum of Tor lengths, for supports that meet properly"},
     {"at": 4.0, "text": "Serre proved positivity with a field or unramified; Gabber got $\\ge 0$ everywhere"},
     {"at": 6.6, "text": "The claim closes the last case: ramified mixed characteristic"}]},
  {"form": "status", "label": "Serre's positivity conjecture (1965)",
   "statement": [r"\chi^R(M,N) > 0 \quad \text{when } \dim M + \dim N = \dim R"],
   "context": "Before: equal characteristic and unramified (Serre), nonnegativity (Gabber, 1995); ramified case open",
   "stamp": "proved",
   "note": "The paper itself notes an earlier AI-assisted claim, posted in December 2025"},
  'none', "No Lean: a Multiplicity folder exists, but no main result for Serre's conjecture",
  "We read the claim and the review; we did not check the 31 pages",
  [('review 193, known_before', "Serre (Algèbre locale, Multiplicités, 1965) proved it for equicharacteristic and unramified regular rings"),
   ('review 193, known_before', "Vanishing: Roberts (1985), Gillet–Soulé (1985/87)"),
   ('review 193, known_before', "Nonnegativity: Gabber (1995, via de Jong alterations"),
   ('article, Serre', "a public post in December 2025 credited to \"Editan\", Copilot and Gemini already claimed the prime-quotient form"),
   ('article, Serre', "31 pages, no Lean."),
   ('review 193, caveats', "The Lean dir OAI/RingTheory/Multiplicity exists but no main_results entry for Serre; treat as unformalized."),
   ('catalogue, family 193 date', "2026")])

# ---------------------------------------------------------------- 194 Lech
spec('194', 'proof', "Lech's conjecture, $e(R) \\le e(S)$",
  "Lech's conjecture: multiplicity never drops along a flat map",
  "Claim: for every flat local map $R \\to S$ of Noetherian local rings, $e(R) \\le e(S)$",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.9, "mode": "stack", "lines": [
      {"tex": r"(R,\mathfrak m) \longrightarrow (S,\mathfrak n) \quad \text{flat, local}", "tone": "soft", "at": 0.3, "size": 38},
      {"tex": r"e(R) \;\le\; e(S)", "tone": "accent", "at": 1.2, "size": 54}]},
    {"primitive": "numberline", "from": 3.9, "min": 0, "max": 8, "ticks": [1, 2, 3, 4, 5, 6, 7],
     "axisLabel": "the dimension of $R$",
     "ranges": [{"from": 1, "to": 2, "label": "Lech, 1960", "note": "dimension $\\le 2$", "at": 0.4},
                {"from": 4, "to": 7, "label": "claimed", "note": "every dimension", "tone": "claim", "at": 2.0}],
     "markers": [{"v": 3, "label": "Ma, 2017", "note": "equal char only", "at": 1.0, "side": "below"}]}],
   "beats": [
     {"at": 0.2, "text": "Hilbert–Samuel multiplicity measures how singular a local ring is"},
     {"at": 4.0, "text": "Lech proved dimension at most 2; Ma did dimension 3 in equal characteristic"},
     {"at": 6.6, "text": "The claim: every dimension and characteristic"}]},
  {"form": "status", "label": "Lech's conjecture (1960)",
   "statement": [r"R \to S \text{ flat local} \;\Longrightarrow\; e(R) \le e(S)"],
   "context": "Before: dimension at most 2 (Lech, 1960) and dimension 3 in equal characteristic (Ma, 2017)",
   "stamp": "proved",
   "note": "No restriction on residue fields; the paper is 41 pages"},
  'part', "Lean has only a char-$p$ lemma comparing Dutta and Hilbert–Samuel multiplicities, not the theorem",
  PAPER_ONLY,
  [('article, Lech', "Lech conjectured in 1960 that Hilbert–Samuel multiplicity cannot drop along a flat local map: $e(R)\\le e(S)$. He proved it in dimension at most 2."),
   ('review 194, known_before', "Ma (Adv. Math. 2017) dim 3 equicharacteristic"),
   ('article, Lech', "Family 194 claims every dimension and characteristic, with no restriction on residue fields."),
   ('article, Lech', "Lean covers only a supporting characteristic-$p$ lemma comparing Dutta and Hilbert–Samuel multiplicities over a complete domain"),
   ('review 194, caveats', "not the theorem. 41 pp.")])

# ---------------------------------------------------------------- 195 small CM
spec('195', 'counterexample', "No small Cohen–Macaulay module",
  "A domain with no small Cohen–Macaulay module",
  "Claim: a 3-dimensional complete normal local domain over $\\mathbb{C}$ with no f.g. module of full depth",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.6, "mode": "stack", "lines": [
      {"tex": r"\exists\, M \ne 0 \text{ finitely generated}, \;\; \operatorname{depth} M = \dim R \;?", "tone": "accent", "at": 0.3, "size": 40},
      {"tex": r"\text{Hochster's small Cohen--Macaulay question}", "tone": "soft", "at": 1.1, "size": 30}]},
    {"primitive": "numberline", "from": 3.6, "min": 0, "max": 5, "ticks": [1, 2, 3, 4],
     "axisLabel": "the dimension of the complete local domain $R$",
     "ranges": [{"from": 1, "to": 2, "label": "always exists", "note": "normalization", "tone": "ok", "at": 0.4}],
     "markers": [{"v": 3, "label": "counterexample", "note": "over $\\mathbb{C}$", "tone": "bad", "at": 1.6}]}],
   "beats": [
     {"at": 0.2, "text": "A small Cohen–Macaulay module would settle several homological conjectures at once"},
     {"at": 3.7, "text": "In dimension at most 2 one always exists"},
     {"at": 5.9, "text": "The claim: in dimension 3 over $\\mathbb{C}$, none does"}]},
  {"form": "status", "label": "Hochster's small Cohen–Macaulay conjecture (1970s)",
   "statement": [r"R \text{ complete local domain}", r"\Longrightarrow\; \exists\, M \ne 0 \text{ f.g.},\ \operatorname{depth} M = \dim R"],
   "context": "Counterexample: a branched cover of a blown-up plane, obstructed by a Chern-character inequality",
   "stamp": "counterexample",
   "note": "Characteristic $p$ and mixed characteristic are not addressed"},
  'none', "No Lean; a 17-page manuscript", PAPER_ONLY,
  [('review 195, known_before', "Hochster (1970s, CBMS 1975"),
   ('review 195, claim', "There is a 3-dimensional complete Noetherian normal local domain containing C, residue field C, with no nonzero finitely generated maximal Cohen–Macaulay module (depth 3)"),
   ('article, No small Cohen–Macaulay module', "It is true in dimension at most 2"),
   ('review 195, caveats', "The char-p and mixed-char versions are not addressed. No Lean."),
   ('article, No small Cohen–Macaulay module', "Characteristic $p$ is not addressed. It is 17 pages.")])

# ---------------------------------------------------------------- 196 Kaplansky zero divisors
tones8 = ['accent', 'cool', 'warn', 'ok', 'hot', 'bad', 'soft', '#E39BF0']
pairs = [((0,0),(1,1)), ((0,1),(2,3)), ((0,2),(3,0)), ((0,3),(1,2)), ((1,0),(2,2)), ((1,3),(3,2)), ((2,0),(3,3)), ((2,1),(3,1))]
cells = []
for k, (a, b) in enumerate(pairs):
    cells.append([a[0], a[1], tones8[k]]); cells.append([b[0], b[1], tones8[k]])
spec('196', 'counterexample', "Kaplansky's zero-divisor conjecture fails",
  "Kaplansky's zero-divisor conjecture fails",
  "Claim: a torsion-free group $G$ and nonzero $\\alpha, \\beta \\in \\mathbb{F}_2[G]$ with $\\alpha\\beta = 0$",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "grid", "until": 4.8, "rows": 4, "cols": 4, "cells": cells, "stagger": 0.05,
     "values": [[r"$g_1h_1$", r"$g_1h_2$", r"$g_1h_3$", r"$g_1h_4$"], [r"$g_2h_1$", r"$g_2h_2$", r"$g_2h_3$", r"$g_2h_4$"],
                [r"$g_3h_1$", r"$g_3h_2$", r"$g_3h_3$", r"$g_3h_4$"], [r"$g_4h_1$", r"$g_4h_2$", r"$g_4h_3$", r"$g_4h_4$"]],
     "caption": "schematic: equal colours are equal group elements, so they cancel mod 2"},
    {"primitive": "equation", "from": 4.8, "mode": "stack", "lines": [
      {"tex": r"\alpha \ne 0,\quad \beta \ne 0,\quad \alpha\beta = 0 \;\text{ in } \mathbb{F}_2[G]", "tone": "accent", "at": 0.3, "size": 44},
      {"tex": r"G \text{ torsion-free, finitely presented, finite 2-dim } K(G,1)", "tone": "soft", "at": 1.0, "size": 28}]}],
   "beats": [
     {"at": 0.2, "text": "Multiply $\\alpha = \\sum g_i$ by $\\beta = \\sum h_j$: every product term, schematically"},
     {"at": 2.6, "text": "The construction makes every coefficient of $\\alpha\\beta$ an even count of products"},
     {"at": 5.2, "text": "Over $\\mathbb{F}_2$ they all cancel: a zero divisor in a torsion-free group algebra"}]},
  {"form": "status", "label": "Kaplansky's zero-divisor conjecture (1950s)",
   "statement": [r"G \text{ torsion-free} \;\Longrightarrow\; K[G] \text{ has no zero divisors}"],
   "context": "Before: true for orderable, unique-product, elementary amenable groups; the unit conjecture fell in 2021",
   "stamp": "counterexample",
   "note": "Over $\\mathbb{F}_2$ only; characteristic zero is untouched"},
  'main', "The Comparator statement includes torsion-free, finitely presented, finite 2-dim $K(G,1)$ and $\\alpha\\beta = 0$",
  "We read the Comparator statement; we did not run the checker",
  [('article, Kaplansky zero-divisor', "Kaplansky asked in the 1950s whether the group algebra $K[G]$ of a torsion-free group over a field can have zero divisors."),
   ('article, Kaplansky zero-divisor', "Giles Gardam disproved the neighbouring unit conjecture in 2021"),
   ('article, Kaplansky zero-divisor', "arranges that every coefficient of $\\alpha\\beta$ comes from an even number of products"),
   ('article, Kaplansky zero-divisor', "This is over $\\mathbb F_2$ only. Characteristic zero, where the conjecture connects to the Atiyah conjecture, is untouched."),
   ('review 196, caveats', "Standard axioms; review 'unchecked'; I did not run the checker.")])

# ---------------------------------------------------------------- 197 direct finiteness
spec('197', 'counterexample', "Kaplansky's direct finiteness fails",
  "A group algebra where $ab = 1$ but $ba \\ne 1$",
  "Claim: a torsion-free group $G$ and $a, b \\in \\mathbb{F}_2[G]$ with $ab = 1 \\ne ba$, so $G$ is not sofic",
  {"dur": 8.4, "primitive": "equation", "mode": "stack", "lines": [
      {"tex": r"ab = 1 \;\overset{?}{\Longrightarrow}\; ba = 1", "tone": "soft", "at": 0.3, "size": 40, "y": 0.05},
      {"tex": r"G \text{ sofic} \;\Longrightarrow\; \text{yes} \qquad \text{(Elek–Szab\'o)}", "tone": "soft", "at": 2.6, "size": 32, "y": 0.26},
      {"tex": r"\term{a}{ab = 1},\;\; \term{b}{ba \ne 1} \;\text{ in } \mathbb{F}_2[G]", "tone": "accent", "at": 4.2, "size": 44, "y": 0.5, "terms": {"a": {"label": "a right inverse", "tone": "ok", "at": 0.5}, "b": {"label": "not a left one", "tone": "bad", "at": 1.0}}},
      {"tex": r"\Longrightarrow\; G \text{ is not sofic}", "tone": "hot", "at": 6.0, "size": 38, "y": 0.84}],
   "beats": [
     {"at": 0.2, "text": "Kaplansky: a one-sided inverse in a group algebra is two-sided. True in characteristic 0"},
     {"at": 2.7, "text": "In characteristic $p$ it holds for every sofic group, and no non-sofic group was known"},
     {"at": 5.2, "text": "So a counterexample also proves a non-sofic group exists"}]},
  {"form": "status", "label": "Kaplansky's direct-finiteness conjecture",
   "statement": [r"ab = 1 \Longrightarrow ba = 1 \quad \text{in every group algebra } K[G]"],
   "context": "Before: char 0 for all groups (Kaplansky); sofic groups in char $p$ (Elek–Szabó, 2004)",
   "stamp": "counterexample",
   "note": "Also refutes Gottschalk's surjunctivity and the Determinant Conjecture"},
  'part', "Lean has the torsion versions; the torsion-free headline and non-soficity are not in Lean",
  "We read the Lean scope notes; we did not run the checker",
  [('article, Kaplansky direct finiteness', "In characteristic $p$ it is known for sofic groups (Elek and Szabó, 2004), and no non-sofic group is known."),
   ('article, Kaplansky direct finiteness', "The headline, a torsion-free group over $\\mathbb F_2$ (manuscript of October 4), is not in Lean."),
   ('article, Kaplansky direct finiteness', "Non-soficity is not stated in Lean"),
   ('article, Kaplansky direct finiteness', "It also refutes Gottschalk's surjunctivity conjecture"),
   ('review 197, claim', "a finitely presented torsion-free (non-sofic) group G with finite 2-dim K(G,1) and a, b ∈ F2[G] with ab = 1 ≠ ba")])

# ---------------------------------------------------------------- 198 finitistic dimension
spec('198', 'counterexample', "The finitistic dimension can be infinite",
  "The finitistic dimension conjecture fails",
  "Claim: a finite-dimensional algebra over $\\mathbb{C}$ with modules of finite but unbounded projective dimension",
  {"dur": 8.4, "primitive": "plot", "x": [0, 7.4], "y": [0, 14], "xticks": [1, 2, 3, 4, 5, 6], "yticks": [0, 4, 8, 12],
   "xlabel": "$m$", "ylabel": "$\\operatorname{pd} N_m$",
   "curves": [{"f": "2*x-2", "label": "$2m-2$", "tone": "accent", "at": 0.6, "from": 1, "to": 7.4}],
   "regions": [{"f": "2*x-2", "f2": "14", "from": 1, "to": 7.4}],
   "points": [{"x": 1, "y": 0, "label": "$N_1$", "at": 2.4}, {"x": 2, "y": 2, "at": 2.7}, {"x": 3, "y": 4, "at": 3.0},
              {"x": 4, "y": 6, "at": 3.3}, {"x": 5, "y": 8, "at": 3.6}, {"x": 6, "y": 10, "label": "$N_6$", "at": 3.9}],
   "beats": [
     {"at": 0.2, "text": "One fixed algebra $A$, and for every $m$ a module $N_m$"},
     {"at": 2.8, "text": "Each $N_m$ has finite projective dimension, at least $2m-2$"},
     {"at": 5.4, "text": "No finite bound fits them all: the finitistic dimension of $A$ is $\\infty$"}]},
  {"form": "status", "label": "Bass's finitistic dimension conjecture (1960)",
   "statement": [r"\operatorname{fin.dim} A < \infty", r"\text{for every finite-dimensional algebra } A"],
   "context": "Before: monomial and radical-cube-zero algebras, representation dimension at most 3 (Igusa–Todorov)",
   "stamp": "counterexample",
   "note": "Also an algebra with finitistic dimension infinite on the left, 0 on the right"},
  'main', "Lean defines the little finitistic dimension with Mathlib's projectiveDimension and asks for this",
  "We read the Lean statement; we did not run the checker",
  [('article, The finitistic dimension conjecture fails', "Bass conjectured in 1960 that it is finite."),
   ('article, The finitistic dimension conjecture fails', "Family 198 claims a finite-dimensional complex algebra $A$ and, for every $m\\ge1$, a finite-dimensional module $N_m$ with $2m-2\\le\\operatorname{pd}N_m<\\infty$."),
   ('article, The finitistic dimension conjecture fails', "The Lean statement defines the little finitistic dimension with Mathlib's `projectiveDimension` and asks for exactly that"),
   ('article, The finitistic dimension conjecture fails', "infinite on the left and 0 on the right"),
   ('review 198, caveats', "Review 'unchecked'. Consistent with family 199")])

# ---------------------------------------------------------------- 199 Auslander-Reiten
spec('199', 'counterexample', "Auslander–Reiten, Tachikawa, Nakayama fail",
  "Auslander–Reiten, Tachikawa and Nakayama conjectures fail",
  "Claim: over $k = \\mathbb{F}_2(q,H_1,H_2)$, rigid non-projective modules break a whole family of conjectures",
  {"dur": 8.4, "primitive": "tree", "at": 0.4, "nodes": [
      {"id": "root", "label": "Nakayama, Auslander–Gorenstein, Wakamatsu fail", "status": "paper"},
      {"id": "gam", "label": "$\\Gamma_K = \\mathrm{End}(A \\oplus M)$", "parent": "root", "status": "paper"},
      {"id": "tach", "label": "Tachikawa: $A$, $M$", "parent": "gam", "status": "lean"},
      {"id": "ar", "label": "Auslander–Reiten: $\\Lambda$, $Z$", "parent": "root", "status": "lean"}],
   "beats": [
     {"at": 0.2, "text": "All these conjectures say a module with no self-extensions is projective"},
     {"at": 2.8, "text": "Two base counterexamples, both in Lean: a non-projective module with all Ext groups zero"},
     {"at": 5.6, "text": "The step from them to Nakayama and the rest is on paper only"}]},
  {"form": "status", "label": "Auslander–Reiten (1975), Tachikawa (1973), Nakayama (1958)",
   "statement": [r"\mathrm{Ext}^i(M, M \oplus A) = 0 \;\; \forall i > 0 \;\Longrightarrow\; M \text{ projective}"],
   "context": "Counterexample: finite-dimensional algebras over $\\mathbb{F}_2(q,H_1,H_2)$, stable under field extension",
   "stamp": "counterexample",
   "note": "Characteristic 2 only"},
  'main', "Both base counterexamples are in Lean; the step to Nakayama and the rest is paper-only",
  "We read the Lean scope notes; we did not run the checker",
  [('article, Auslander–Reiten', "Auslander–Reiten (1975): a module $M$ with $\\operatorname{Ext}^i(M,M\\oplus A)=0$ for all $i>0$ is projective."),
   ('article, Auslander–Reiten', "Tachikawa (1973)"),
   ('article, Auslander–Reiten', "Nakayama (1958)"),
   ('article, Auslander–Reiten', "Both base counterexamples are in Lean"),
   ('article, Auslander–Reiten', "The step to Nakayama and the rest is paper-only, and so is everything outside characteristic 2."),
   ('review 199, claim', "all persist under every field extension")])

# ---------------------------------------------------------------- 200 EGH
# monomials x^c y^r, rows r = 0..4 (y power), cols c = 0..4 (x power); J = (x^3, y^3, x^2 y) schematic
cells200 = []
vals = []
for r in range(5):
    row = []
    for c in range(5):
        inJ = c >= 3 or r >= 3 or (c >= 2 and r >= 1)
        if inJ:
            gen = (c, r) in [(3, 0), (0, 3), (2, 1)]
            cells200.append([4 - r, c, 'hot' if gen else 'accent'])
        mon = ('' if c == 0 else ('x' if c == 1 else f'x^{c}')) + ('' if r == 0 else ('y' if r == 1 else f'y^{r}'))
        row.append(f'${mon or "1"}$')
    vals.append(row)
vals = vals[::-1]
spec('200', 'proof', "Eisenbud–Green–Harris and lex-plus-powers",
  "Eisenbud–Green–Harris and lex-plus-powers, in characteristic 0",
  "Claim: the lex-plus-powers ideal has every Hilbert function, with the largest graded Betti numbers",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "grid", "until": 4.6, "rows": 5, "cols": 5, "cells": cells200, "values": vals, "stagger": 0.05,
     "caption": "schematic: monomials of $J = (x^3, y^3) + (x^2y)$, generators in yellow"},
    {"primitive": "equation", "from": 4.6, "mode": "stack", "lines": [
      {"tex": r"\mathrm{HF}(S/I) = \mathrm{HF}(S/J)", "tone": "accent", "at": 0.3, "size": 44},
      {"tex": r"\beta_{p,j}(S/I) \;\le\; \beta_{p,j}(S/J)", "tone": "accent", "at": 1.1, "size": 44}]}],
   "beats": [
     {"at": 0.2, "text": "Pure powers plus a lex segment: the lex-plus-powers ideal $J$, drawn in two variables"},
     {"at": 2.8, "text": "$I$ contains a regular sequence of degrees $a_1 \\le \\dots \\le a_n$"},
     {"at": 5.0, "text": "The claim: $J$ matches $I$'s Hilbert function and has the largest Betti numbers"}]},
  {"form": "status", "label": "Eisenbud–Green–Harris (1993) and the lex-plus-powers conjecture",
   "statement": [r"\beta_{p,j}(S/I) \le \beta_{p,j}(S/J) \quad \text{for all } p, j"],
   "context": "Before: pure powers (Clements–Lindström), fast-growing degrees, ideals containing squares",
   "stamp": "proved",
   "note": "Characteristic 0 only, all degrees $a_i \\ge 2$; two independent proofs"},
  'none', "No Lean; two papers, two proofs", PAPER_ONLY,
  [('review 200, known_before', "EGH conjecture (Eisenbud–Green–Harris 1993/1996, Cayley–Bacharach)"),
   ('review 200, claim', "for any homogeneous ideal I ⊂ S containing a regular sequence of degrees 2 ≤ a1 ≤ … ≤ an, the lex-plus-powers ideal J (lex segment plus pure powers x_i^{a_i}) exists with the same Hilbert function, and β_{p,j}(S/I) ≤ β_{p,j}(S/J) for all p, j"),
   ('article, Eisenbud–Green–Harris', "The family claims both in characteristic 0 for all degree sequences with $a_i\\ge2$, with two independent proofs.")])

# ---------------------------------------------------------------- 201 Kurosh
spec('201', 'counterexample', "Kurosh's problem for division rings",
  "Kurosh's problem fails for division rings",
  "Claim: a division ring algebraic over its centre, generated by two elements, yet infinite-dimensional",
  {"dur": 8.4, "primitive": "equation", "mode": "stack", "lines": [
      {"tex": r"D \text{ a division ring}, \;\; F = Z(D)", "tone": "soft", "at": 0.3, "size": 36, "y": 0.04},
      {"tex": r"\text{every } x \in D \text{ is algebraic over } F", "tone": "soft", "at": 1.4, "size": 36, "y": 0.22},
      {"tex": r"D = F\langle \term{g}{a, b} \rangle", "tone": "accent", "at": 3.2, "size": 42, "y": 0.44, "terms": {"g": {"label": "two generators", "tone": "accent", "at": 0.5}}},
      {"tex": r"[D : F] = \term{i}{\infty}", "tone": "hot", "at": 5.2, "size": 46, "y": 0.72, "terms": {"i": {"label": "infinite dimension", "tone": "hot", "at": 0.5}}}],
   "beats": [
     {"at": 0.2, "text": "Kurosh asked in 1941: if every element is algebraic, is the ring locally finite?"},
     {"at": 3.0, "text": "Golod and Shafarevich said no for algebras in 1964; division rings stayed open"},
     {"at": 5.6, "text": "The claim: two generators, every element algebraic, infinite dimension"}]},
  {"form": "status", "label": "Kurosh's problem for division rings (1941)",
   "statement": [r"D \text{ algebraic over } Z(D) \;\Longrightarrow\; D \text{ locally finite}"],
   "context": "Known in many cases, such as PI division rings and uncountable centres",
   "stamp": "counterexample",
   "note": "Countable, characteristic 0; built by solving free-series equations step by step"},
  'none', "A Lean folder named Kurosh exists, but no Comparator entry: treated as unformalized", PAPER_ONLY,
  [('article, Kurosh', "Kurosh asked in 1941 whether an algebra that is algebraic over its centre is locally finite. Golod and Shafarevich answered no for algebras in 1964, but the division-ring case stayed open."),
   ('review 201, known_before', "locally finite in many cases (e.g. PI division rings, uncountable centres)"),
   ('article, Kurosh', "The paper claims a countable division ring of characteristic 0 that is algebraic over its centre and generated by two elements, yet infinite-dimensional."),
   ('article, Kurosh', "A Lean directory named `Kurosh` exists, but there is no Comparator entry or scope note for this family, so I treat it as unformalized.")])

# ---------------------------------------------------------------- 202 Alperin
spec('202', 'proof', "Alperin's weight conjecture, every block",
  "Alperin's weight conjecture for every block of every group",
  "Claim: $l(B)$ equals the number of $B$-weights, for every $p$-block, without the classification",
  {"dur": 8.6, "primitive": "tree", "at": 0.3, "nodes": [
      {"id": "root", "label": "$l(B) = |\\mathcal{W}_p(B)|$", "status": "paper"},
      {"id": "t31", "label": "Theorem 3.1: tuple counts divisible by $p$-powers", "parent": "root", "status": "paper"},
      {"id": "s7", "label": "finite presentation, connectedness", "parent": "t31", "status": "paper"},
      {"id": "s4", "label": "genus-one curves", "parent": "s7", "status": "paper"},
      {"id": "s5", "label": "inseparable genus bound", "parent": "s7", "status": "paper"},
      {"id": "s6", "label": "lift and descent", "parent": "s7", "status": "paper"}],
   "beats": [
     {"at": 0.2, "text": "The proof's chain, after the paper's own dependency figure"},
     {"at": 3.0, "text": "Both sides become counts of tuples with $[x,y]u_1 \\cdots u_n = 1$"},
     {"at": 5.8, "text": "No classification of finite simple groups: Theorem 3.1 carries the weight"}]},
  {"form": "status", "label": "Alperin's weight conjecture (1986)",
   "statement": [r"l(B) = \big|\{B\text{-weights}\}/G\big|"],
   "context": "Before: $p$-solvable, symmetric groups, $\\mathrm{GL}_n$, many Lie-type groups; reduced to simple groups",
   "stamp": "proved",
   "note": "Classification-free; Theorem 3.1 is the step an expert should check"},
  'none', "No Lean: an AlperinWeights folder exists, but no main result for this family", PAPER_ONLY,
  [('article, Alperin', "Alperin's 1986 conjecture counts the simple modular representations in a $p$-block of a finite group locally"),
   ('article, Alperin', "then needs a uniform $p$-power divisibility of those counts (its Theorem 3.1)"),
   ('article, Alperin', "Theorem 3.1 is the step I would ask an expert to check"),
   ('review 202, caveats', "Lean dir OAI/RepresentationTheory/AlperinWeights exists but no main_results entry for this family. 59 pp.")])

# ---------------------------------------------------------------- 203 Donovan
spec('203', 'proof', "Donovan's conjecture",
  "Donovan's conjecture: finitely many Morita classes of blocks",
  "Claim: blocks with defect groups of bounded order fall into finitely many Morita classes, for every $p$",
  {"dur": 8.4, "primitive": "grid", "rows": 3, "cols": 12, "stagger": 0.03,
   "cells": [[r, c, ['accent', 'cool', 'warn', 'ok'][[0, 0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3][c]]] for r in range(3) for c in range(12)],
   "blocks": [{"r": 0, "c": 0, "h": 3, "w": 3, "label": "class 1", "tone": "accent", "at": 3.0},
              {"r": 0, "c": 3, "h": 3, "w": 2, "label": "class 2", "tone": "cool", "at": 3.4},
              {"r": 0, "c": 5, "h": 3, "w": 4, "label": "class 3", "tone": "warn", "at": 3.8},
              {"r": 0, "c": 9, "h": 3, "w": 3, "label": "class 4", "tone": "ok", "at": 4.2}],
   "caption": "schematic: each square is a block with defect group of order at most $M$",
   "beats": [
     {"at": 0.2, "text": "Blocks of group algebras, all with defect groups of order at most $M$"},
     {"at": 3.0, "text": "Donovan: up to Morita equivalence there are only finitely many of them"},
     {"at": 5.6, "text": "Claimed for every algebraically closed field of characteristic $p$, including $p = 2$"}]},
  {"form": "status", "label": "Donovan's conjecture (1970s)",
   "statement": [r"|D| \le M \;\Longrightarrow", r"\text{finitely many Morita classes of blocks}"],
   "context": "Before: cyclic and Klein-four defect, abelian 2-groups, $p$-solvable and symmetric groups",
   "stamp": "proved",
   "note": "Integral forms over complete DVRs too; unlike Alperin, uses the classification"},
  'none', "No Lean; 116 pages across two papers", PAPER_ONLY,
  [('review 203, known_before', "Donovan (Conjecture M in Alperin's problem list, 1970s)"),
   ('article, Donovan', "It was known for cyclic and Klein-four defect groups, abelian 2-groups (Eaton–Livesey), $p$-solvable groups and symmetric groups."),
   ('article, Donovan', "Unlike Alperin, this proof uses the classification."),
   ('review 203, caveats', "116 pp across two papers.")])

# ---------------------------------------------------------------- 204 Spin saturation
spec('204', 'proof', "Saturation for $\\mathrm{Spin}(2n)$",
  "Tensor saturation for the even spin groups",
  "Claim: for $\\mathrm{Spin}(2n)$, an invariant that appears after scaling weights by $N$ already appears unscaled",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.8, "mode": "stack", "lines": [
      {"tex": r"\big(V(N\lambda)\otimes V(N\mu)\otimes V(N\nu)\big)^G \ne 0", "tone": "soft", "at": 0.3, "size": 38},
      {"tex": r"\Longrightarrow\; \big(V(\lambda)\otimes V(\mu)\otimes V(\nu)\big)^G \ne 0", "tone": "accent", "at": 1.2, "size": 38}]},
    {"primitive": "numberline", "from": 3.8, "min": 1, "max": 10, "ticks": [2, 3, 4, 5, 6, 7, 8, 9],
     "axisLabel": "$n$ in $\\mathrm{Spin}(2n)$",
     "markers": [{"v": 4, "label": "$\\mathrm{Spin}(8)$", "note": "2009", "at": 0.4},
                 {"v": 5, "label": "$\\mathrm{Spin}(10)$", "note": "Kiers", "at": 0.7},
                 {"v": 6, "label": "$\\mathrm{Spin}(12)$", "note": "Kiers, 2021", "at": 1.0}],
     "ranges": [{"from": 2, "to": 9, "label": "claimed", "note": "every $n \\ge 2$", "tone": "claim", "at": 2.2, "side": "below"}]}],
   "beats": [
     {"at": 0.2, "text": "Saturation: if an invariant appears after scaling every weight by $N$, it appears unscaled"},
     {"at": 3.9, "text": "Knutson–Tao proved type A in 1999; in type D only Spin(8) to Spin(12) were done"},
     {"at": 6.4, "text": "The claim: every even spin group"}]},
  {"form": "status", "label": "Kapovich–Millson saturation conjecture, type D",
   "statement": [r"\text{saturation factor } 1 \text{ for } \mathrm{Spin}(2n), \; n \ge 2"],
   "context": "Before: type A (Knutson–Tao, 1999); type D only for $\\mathrm{Spin}(8)$, $\\mathrm{Spin}(10)$, $\\mathrm{Spin}(12)$",
   "stamp": "proved",
   "note": "Type D only; types E remain"},
  'none', "No Lean; a Tensor folder exists, but no main result for this family", PAPER_ONLY,
  [('review 204, known_before', "Knutson–Tao (JAMS 1999) type A"),
   ('review 204, known_before', "Spin(8) by Kapovich–Kumar–Millson (2009), Spin(10), Spin(12) by Kiers (2021)"),
   ('article, Saturation', "Saturation factor 1 in type D, extending Knutson–Tao's type A theorem and the $\\mathrm{Spin}(8)$ to $\\mathrm{Spin}(12)$ cases. Types E remain."),
   ('review 204, caveats', "No Lean (despite a RepresentationTheory/Tensor dir; no main result).")])

# ---------------------------------------------------------------- 205 Saxl
spec('205', 'proof', "Saxl's conjecture",
  "Saxl's conjecture: the staircase tensor square has everything",
  "Claim: the tensor square of the staircase representation of $S_n$ contains every irreducible",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "grid", "until": 4.2, "rows": 4, "cols": 4, "stagger": 0.08,
     "cells": [[r, c, 'accent'] for r in range(4) for c in range(4) if c < 4 - r],
     "caption": "the staircase $\\rho_4 = (4,3,2,1)$, row lengths $m, m-1, \\dots, 1$"},
    {"primitive": "equation", "from": 4.2, "mode": "stack", "lines": [
      {"tex": r"S^{\rho_m} \otimes S^{\rho_m} \;\supseteq\; S^{\mu}", "tone": "accent", "at": 0.3, "size": 46},
      {"tex": r"\text{for every partition } \mu \text{ of } n = m(m+1)/2", "tone": "soft", "at": 1.1, "size": 30}]}],
   "beats": [
     {"at": 0.2, "text": "The staircase shape, drawn for $m = 4$"},
     {"at": 2.6, "text": "Its Specht module $S^{\\rho_m}$ is one irreducible representation of $S_n$"},
     {"at": 4.8, "text": "Saxl: its tensor square contains every irreducible, so every Kronecker coefficient is positive"}]},
  {"form": "status", "label": "Saxl's conjecture (2012)",
   "statement": [r"g(\rho_m, \rho_m, \mu) > 0 \quad \text{for every } \mu \vdash m(m+1)/2"],
   "context": "Before: hooks and two-row shapes (Pak–Panova–Vallejo), shapes comparable with $\\rho_m$ (Ikenmeyer)",
   "stamp": "proved",
   "note": "Companion: every $n$ outside $\\{2,4,9\\}$ has a universal tensor square"},
  'main', "Saxl and the tensor square conjecture are in Lean; the single-cyclic-vector form is not",
  "We grepped one axiom line in the folder; we did not trace the imports",
  [('article, Saxl', "Saxl conjectured in 2012 that the tensor square of the staircase representation of $S_n$, for $n=m(m+1)/2$ and shape $(m,m-1,\\dots,1)$, contains every irreducible representation"),
   ('article, Saxl', "Pak, Panova and Vallejo proved hooks and two-row shapes for large $m$, and Ikenmeyer proved shapes comparable with $\\rho_m$ in dominance order."),
   ('article, Saxl', "for every $n$ outside $\\{2,4,9\\}$, some irreducible of $S_n$ has a universal tensor square"),
   ('article, Saxl', "The stronger single-cyclic-vector statement is not."),
   ('article, Saxl', "My grep found one `axiom` declaration somewhere under `OAI/RepresentationTheory`"),
   ('article, Saxl', "I did not trace the imports.")])

# ---------------------------------------------------------------- 206 lattices
spec('206', 'counterexample', "Finite lattice representation fails",
  "A finite lattice that is no finite algebra's congruence lattice",
  "Claim: some finite lattice is not $\\mathrm{Con}(A)$ for any finite algebra $A$; representability is undecidable",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "graph", "until": 4.4, "edgeAt": 0.6, "edgeDur": 2.0,
     "nodes": [{"id": "0", "x": 0.5, "y": 0.92, "label": "$0$"}, {"id": "a", "x": 0.28, "y": 0.5}, {"id": "b", "x": 0.5, "y": 0.5},
               {"id": "c", "x": 0.72, "y": 0.5}, {"id": "1", "x": 0.5, "y": 0.08, "label": "$1$"}],
     "edges": [["0", "a"], ["0", "b"], ["0", "c"], ["a", "1"], ["b", "1"], ["c", "1"]]},
    {"primitive": "equation", "from": 4.4, "mode": "stack", "lines": [
      {"tex": r"L \cong \mathrm{Con}(A), \;\; A \text{ finite} \;?", "tone": "soft", "at": 0.3, "size": 40},
      {"tex": r"\Longleftrightarrow\; L \cong [H, G] \subseteq \mathrm{Sub}(G), \;\; G \text{ finite}", "tone": "accent", "at": 1.1, "size": 38}]}],
   "beats": [
     {"at": 0.2, "text": "A finite lattice, drawn small and schematically; the paper's obstruction is much larger"},
     {"at": 2.8, "text": "Every algebraic lattice is a congruence lattice, if infinite algebras are allowed"},
     {"at": 4.8, "text": "With finite algebras, the claim is no, and recognizing which lattices work is undecidable"}]},
  {"form": "status", "label": "Finite lattice representation problem (after 1963)",
   "statement": [r"\exists\, L \text{ finite}: \; L \not\cong \mathrm{Con}(A) \text{ for every finite } A"],
   "context": "Equivalently (Pálfy–Pudlák, 1980): a finite lattice that is no interval in a finite group's subgroup lattice",
   "stamp": "counterexample",
   "note": "Plus a coloured-graph characterization; 267 pages over two papers"},
  'part', "Lean has the coloured-graph characterization only, not the negative answer or undecidability",
  PAPER_ONLY,
  [('article, Finite lattice representation', "Grätzer and Schmidt proved in 1963 that every algebraic lattice is the congruence lattice of some algebra."),
   ('article, Finite lattice representation', "Pálfy and Pudlák showed in 1980 that it is equivalent to every finite lattice being an interval in the subgroup lattice of a finite group."),
   ('article, Finite lattice representation', "The two papers come to 267 pages."),
   ('review 206, caveats', "only the coloured-graph characterization equivalence (FiniteCongruenceGraph.lean) — the negative answer and undecidability are NOT formalized")])

# ---------------------------------------------------------------- 207 Bass
spec('207', 'proof', "The Bass trace conjecture, every group",
  "The Bass trace conjecture for every discrete group",
  "Claim: traces of idempotents over $\\ell^1(G)$ see only finite-order elements; for torsion-free $G$, only 0 and 1",
  {"dur": 8.4, "primitive": "equation", "mode": "stack", "lines": [
      {"tex": r"\term{e}{e = e^2} \in M_n(\ell^1 G)", "tone": "soft", "at": 0.3, "size": 38, "y": 0.06, "terms": {"e": {"label": "an idempotent", "tone": "cool", "at": 0.6}}},
      {"tex": r"\mathrm{HS}(e) \text{ lives on conjugacy classes of finite-order elements}", "tone": "accent", "at": 1.9, "size": 30, "y": 0.38},
      {"tex": r"\term{t}{G \text{ torsion-free}}: \;\; e = e^2 \in RG \;\Rightarrow\; \term{r}{e \in \{0, 1\}}", "tone": "hot", "at": 4.4, "size": 36, "y": 0.64, "terms": {"t": {"label": "no finite-order elements", "tone": "cool", "at": 0.6}, "r": {"label": "only the trivial ones", "tone": "hot", "at": 1.4}}}],
   "beats": [
     {"at": 0.2, "text": "Take an idempotent matrix over the group algebra"},
     {"at": 2.6, "text": "Bass: its Hattori–Stallings trace sees only elements of finite order"},
     {"at": 5.0, "text": "For a torsion-free group that leaves only 0 and 1: Kaplansky's idempotent conjecture"}]},
  {"form": "status", "label": "Bass trace conjecture (1976) and Kaplansky's idempotents",
   "statement": [r"G \text{ torsion-free},\ \mathrm{char}\, R = 0", r"\Longrightarrow\; \text{idempotents of } RG \text{ are } 0, 1"],
   "context": "Before: under Baum–Connes-type hypotheses (Berrick, Chatterji and Mislin for $\\ell^1$-Bass)",
   "stamp": "proved",
   "note": "The group ring, not $C^*_r(G)$: Kadison–Kaplansky is untouched"},
  'main', "Lean has the algebraic companion; the $\\ell^1$ headline is analytic and not formalized",
  "We did not review the Lean definition of the Hattori–Stallings trace",
  [('article, Bass trace', "Bass conjectured in 1976 that the Hattori–Stallings trace of a projective module over a group ring sees only elements of finite order."),
   ('article, Bass trace', "Over $\\mathbb C$ both were known for groups satisfying Baum–Connes-type hypotheses (Berrick, Chatterji and Mislin for $\\ell^1$-Bass)."),
   ('article, Bass trace', "The family headline is the $\\ell^1$-Bass conjecture for every discrete group, which is analytic and not formalized."),
   ('article, Bass trace', "for torsion-free $G$ that the only idempotents of $RG$ are 0 and 1, for every commutative domain $R$ of characteristic 0"),
   ('article, Bass trace', "I'd want to see the Lean definition of the Hattori–Stallings trace reviewed by someone who knows the subject.")])

# ---------------------------------------------------------------- 208 Verlinde
spec('208', 'proof', "Symmetric tensor categories in char $p$",
  "Finite symmetric tensor categories fibre over Verlinde ones",
  "Claim: in characteristic $p$, each finite symmetric tensor category has a fibre functor to some $\\mathrm{Ver}_{p^n}$",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "sequence", "until": 4.4, "items": ["$\\mathrm{Vec}$", "$\\mathrm{Ver}_{p}$", "$\\mathrm{Ver}_{p^2}$", "$\\mathrm{Ver}_{p^3}$", "$\\mathrm{Ver}_{p^4}$"],
     "ellipsis": True, "stagger": 0.3, "marks": {"1": {"tone": "accent", "at": 2.4}, "2": {"tone": "accent", "at": 2.6}, "3": {"tone": "accent", "at": 2.8}, "4": {"tone": "accent", "at": 3.0}},
     "caption": "the higher Verlinde tower, each one inside the next"},
    {"primitive": "equation", "from": 4.4, "mode": "stack", "lines": [
      {"tex": r"\mathcal{C} \;\xrightarrow{\;F\;}\; \mathrm{Ver}_{p^n}(k)", "tone": "accent", "at": 0.3, "size": 50},
      {"tex": r"F \text{ exact, faithful, symmetric monoidal}", "tone": "soft", "at": 1.1, "size": 30}]}],
   "beats": [
     {"at": 0.2, "text": "In characteristic 0, Deligne: vector spaces and super vector spaces suffice"},
     {"at": 2.4, "text": "In characteristic $p$ new targets appear: the Verlinde categories $\\mathrm{Ver}_{p^n}$"},
     {"at": 4.8, "text": "The claim: every finite symmetric tensor category maps into one of them"}]},
  {"form": "status", "label": "Benson–Etingof–Ostrik conjecture, finite case",
   "statement": [r"\exists\, n,\ F: \mathcal{C} \to \mathrm{Ver}_{p^n}(k) \text{ a fibre functor}"],
   "context": "Before: char 0 (Deligne, 2002); Frobenius-exact categories over $\\mathrm{Ver}_p$ (Coulembier–Etingof–Ostrik)",
   "stamp": "proved",
   "note": "Finite categories only, including $p = 2$; moderate growth is not claimed"},
  'none', "No Lean link established for this family; a 26-page paper", PAPER_ONLY,
  [('review 208, known_before', "Deligne (2002) char 0 (super Tannakian)"),
   ('review 208, known_before', "Coulembier–Etingof–Ostrik (Annals 2023, 'On Frobenius exact symmetric tensor categories') proved fibre functors to Ver_p for Frobenius-exact categories"),
   ('review 208, claim', "Every finite symmetric tensor category over an algebraically closed field of characteristic p > 0 (including p = 2) admits a fibre functor"),
   ('review 208, caveats', "Finite case only (moderate-growth general case not claimed). 26 pp.")])

# ---------------------------------------------------------------- 209 Gersten
spec('209', 'counterexample', "Gersten's conjecture fails integrally",
  "Gersten's conjecture fails for ramified regular local rings",
  "Claim: explicit regular local rings $A$ of mixed characteristic $(0,5)$ where $K_3(A) \\to K_3(\\mathrm{Frac}\\,A)$ has a kernel",
  {"dur": 8.4, "primitive": "equation", "mode": "stack", "lines": [
      {"tex": r"\term{p}{(X - Z)^5 - XY^4 + Y^5 + \zeta Z^5} = 0", "tone": "accent", "at": 0.3, "size": 40, "y": 0.06, "terms": {"p": {"label": "one explicit equation", "tone": "accent", "at": 0.7}}},
      {"tex": r"A = \text{its local ring at a point of the special fibre},\ \ \pi \in \mathfrak m^2", "tone": "soft", "at": 1.6, "size": 26, "y": 0.36},
      {"tex": r"\ker\big(\term{k}{K_3(A)} \to \term{f}{K_3(\mathrm{Frac}\,A)}\big) \term{z}{\ne 0}", "tone": "hot", "at": 4.0, "size": 40, "y": 0.7, "terms": {"k": {"label": "K-theory of $A$", "tone": "cool", "at": 0.5, "side": "above"}, "f": {"label": "of its fractions", "tone": "soft", "at": 1.0}, "z": {"label": "a class dies", "tone": "bad", "at": 1.6, "side": "above"}}}],
   "beats": [
     {"at": 0.2, "text": "One explicit hypersurface, in mixed characteristic $(0,5)$"},
     {"at": 2.6, "text": "Its local ring is regular, two-dimensional and ramified"},
     {"at": 4.8, "text": "A $K_3$ class (and a $K_5$ class) dies over the fraction field: injectivity fails"}]},
  {"form": "status", "label": "Gersten's conjecture (1973)",
   "statement": [r"K_n(A) \hookrightarrow K_n(\mathrm{Frac}\,A) \quad \text{for regular local } A"],
   "context": "Before: true when $A$ contains a field (Quillen, Panin) and for rings smooth over a DVR (Gillet–Levine)",
   "stamp": "counterexample",
   "note": "Ramified rings, integral coefficients only; the unramified case is untouched"},
  'none', "No Lean; a 35-page paper", PAPER_ONLY,
  [('review 209, claim', "(local rings of explicit hypersurfaces such as (X−Z)^5 − XY^4 + Y^5 + ζZ^5 = 0 at a point of the special fibre, with π ∈ m²) such that K_3(A) → K_3(Frac A) and K_5(A) → K_5(Frac A) have nonzero kernel"),
   ('review 209, claim', "explicit two-dimensional ramified regular local rings A of mixed characteristic (0,5)"),
   ('review 209, known_before', "Gersten (1973 problem); Quillen (1973) proved it for regular local rings essentially of finite type over a field; Panin (2003) full equicharacteristic; Gillet–Levine (1987) smooth over a DVR"),
   ('review 209, caveats', "Ramified only (π ∈ m²) and integral coefficients; the unramified mixed-characteristic case and finite-coefficient forms are untouched."),
   ('review 209, caveats', "35 pp. No Lean.")])

# ---------------------------------------------------------------- 210 Foulkes
spec('210', 'partial', "Foulkes' conjecture for sixth powers",
  "Foulkes' conjecture for $a = 6$, and quadratic stabilization",
  "Claim: $\\mathrm{Sym}^6(\\mathrm{Sym}^b V)$ embeds in $\\mathrm{Sym}^b(\\mathrm{Sym}^6 V)$ for every $b \\ge 6$",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.6, "mode": "stack", "lines": [
      {"tex": r"\mathrm{Sym}^a(\mathrm{Sym}^b V) \;\hookrightarrow\; \mathrm{Sym}^b(\mathrm{Sym}^a V)", "tone": "accent", "at": 0.3, "size": 44},
      {"tex": r"a \le b, \;\; GL(V)\text{-equivariantly}", "tone": "soft", "at": 1.1, "size": 30}]},
    {"primitive": "numberline", "from": 3.6, "min": 1, "max": 7, "ticks": [2, 3, 4, 5, 6],
     "axisLabel": "the case $a$ of Foulkes' conjecture",
     "markers": [{"v": 2, "label": "Thrall", "note": "$a \\le 2$", "at": 0.3},
                 {"v": 3, "label": "Dent–Siemons", "note": "2000", "at": 0.6},
                 {"v": 4, "label": "McKay", "note": "2008", "at": 0.9},
                 {"v": 5, "label": "Cheung et al.", "note": "2017", "at": 1.2}],
     "slide": {"from": 5, "to": 6, "at": 2.0, "dur": 1.4, "label": "claimed", "note": "$a = 6$, every $b \\ge 6$"}}],
   "beats": [
     {"at": 0.2, "text": "Foulkes: one plethysm should embed in the other with $a$ and $b$ swapped"},
     {"at": 3.7, "text": "Proved one $a$ at a time, up to $a = 5$"},
     {"at": 6.2, "text": "The claim adds $a = 6$; Foulkes–Howe is surjective once $b \\ge a(a-1)$"}]},
  {"form": "status", "label": "Foulkes' conjecture (1950)",
   "statement": [r"\mathrm{Sym}^a(\mathrm{Sym}^b V) \hookrightarrow \mathrm{Sym}^b(\mathrm{Sym}^a V) \quad (a \le b)"],
   "context": "Claimed: the case $a = 6$, and the Foulkes–Howe map is surjective for all $b \\ge a(a-1)$",
   "stamp": "partial",
   "note": "The full conjecture, every $a$, is still open"},
  'part', "Lean has the stabilization, and the case $a = 6$ only for $b \\ge 30$", PAPER_ONLY,
  [('review 210, known_before', "Foulkes (1950); known a ≤ 2 (Thrall), a = 3 (Dent–Siemons 2000), a = 4 (McKay 2008 + Müller–Neunhöffer 2005 computation), a = 5 (Cheung–Ikenmeyer–Mkrtchyan 2017)"),
   ('article, Four narrower results', "but the sixth-power case is formalized only for $b\\ge30$"),
   ('review 210, caveats', "Only a = 6 for Foulkes (not the full conjecture).")])

for id, s in S.items():
    s = enrich(s)
    with open(os.path.join(OUT, id + '.json'), 'w') as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
print(len(S), 'written')
