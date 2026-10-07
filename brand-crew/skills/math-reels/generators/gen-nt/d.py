from common import *

# ---------------------------------------------------------------- 240
write({
  "id": "240", "discipline": LOGIC, "kind": "proof",
  "short": "Shelah's eventual categoricity",
  "title": {"title": "Shelah's eventual categoricity conjecture, in ZFC",
            "subtitle": "Claim: an AEC categorical in one large enough cardinal is categorical in every larger one"},
  "object": {
    "dur": 8.6,
    "primitive": "numberline", "min": 0, "max": 10, "y": 0.6, "ticks": [],
    "axisLabel": "cardinals $\\kappa$, schematic",
    "markers": [
      {"v": 1, "label": "$\\mathrm{LS}(K) \\le \\lambda$", "at": 0.6, "tone": "mute"},
      {"v": 4, "label": "$\\mu(\\lambda)$", "note": "threshold", "at": 2.6, "tone": "claim"},
      {"v": 7, "label": "categorical here", "at": 3.6, "tone": "hot", "style": "ring"}],
    "ranges": [{"from": 4, "to": 10, "label": "categorical in every $\\kappa \\ge \\mu(\\lambda)$", "tone": "claim", "at": 5.4, "side": "below"}],
    "beats": [
      beat(0.2, "Schematic: an abstract elementary class $K$, and cardinals $\\kappa$ along a line"),
      beat(2.8, "Shelah: categorical in one large enough $\\kappa$ means categorical in all larger ones"),
      beat(5.4, "Claimed in ZFC, with no amalgamation, tameness or large cardinals")]
  },
  "achievement": {
    "form": "status", "label": "Shelah's eventual categoricity conjecture",
    "statement": ["K \\text{ categorical in some } \\kappa \\ge \\mu(\\lambda) \\;\\Rightarrow\\; \\text{in every } \\kappa' \\ge \\mu(\\lambda)"],
    "context": "Before: only with amalgamation plus large cardinals or tameness (Shelah–Vasey, Vasey, Boney)",
    "stamp": "proved",
    "note": "121 pages of AEC theory, a field with long correction cycles"},
  "verify": {"lean": "part", "detail": "Only the CH obstruction is in Lean. The ZFC theorem, the 121-page paper, is not",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("240", "claim", "every abstract elementary class K with LS(K) <= lambda that is categorical in some cardinal >= mu(lambda) is categorical in every cardinal >= mu(lambda) (Shelah's eventual categoricity conjecture), with no amalgamation, joint embedding, tameness or no-maximal-models hypothesis"),
    rv("240", "known_before", "Shelah-Vasey and Vasey (2017-2018) under amalgamation and large cardinals or tameness; Boney (2014) from strongly compact cardinals"),
    rv("240", "caveats", "121 pages of AEC theory, a field where several announced proofs have needed long correction cycles."),
    rv("240", "lean", "only the CH obstruction (b) is formalized (CHObstruction.main). The ZFC eventual-categoricity theorem (a), the 121-page main paper, is NOT formalized."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 241
write({
  "id": "241", "discipline": LOGIC, "kind": "proof",
  "short": "Rigidity of the Turing degrees",
  "title": {"title": "The Turing degrees have no nontrivial symmetry",
            "subtitle": "Claim: every automorphism of the Turing degrees, ordered by $\\le_T$, is the identity"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "graph", "until": 5.0, "r": 24, "edgeAt": 0.6, "edgeDur": 2.0,
       "nodes": [
         {"id": "z", "x": 0.5, "y": 0.94, "label": "$\\mathbf{0}$"},
         {"id": "a", "x": 0.36, "y": 0.72, "label": "$\\mathbf{a}$"},
         {"id": "b", "x": 0.64, "y": 0.72, "label": "$\\mathbf{b}$"},
         {"id": "j", "x": 0.5, "y": 0.5, "label": "$\\mathbf{0}'$"},
         {"id": "k", "x": 0.5, "y": 0.28, "label": "$\\mathbf{0}''$", "tone": "accent", "fill": "accent"},
         {"id": "c", "x": 0.38, "y": 0.06, "label": "$\\mathbf{c}$", "tone": "accent", "fill": "accent"},
         {"id": "d", "x": 0.62, "y": 0.06, "label": "$\\mathbf{d}$", "tone": "accent", "fill": "accent"}],
       "edges": [["z", "a"], ["z", "b"], ["a", "j"], ["b", "j"], ["j", "k"], ["k", "c", {"tone": "accent"}], ["k", "d", {"tone": "accent"}]]},
      {"primitive": "equation", "from": 5.0, "mode": "stack",
       "lines": [{"tex": "\\pi \\in \\mathrm{Aut}(\\mathcal{D}_T, \\le_T) \\;\\Rightarrow\\; \\pi = \\mathrm{id}", "at": 0.3, "size": 48, "tone": "claim"}]}
    ],
    "beats": [
      beat(0.2, "Schematic: Turing degrees, ordered by 'computable from'; $\\mathbf{a}$ and $\\mathbf{b}$ are incomparable"),
      beat(2.7, "Slaman–Woodin: an automorphism fixes every degree above $\\mathbf{0}''$ (filled)"),
      beat(5.2, "The claim: it fixes every degree, so the identity is the only one")]
  },
  "achievement": {
    "form": "status", "label": "Rigidity of the Turing degrees",
    "statement": ["\\pi \\in \\mathrm{Aut}(\\mathcal{D}_T, \\le_T) \\;\\Rightarrow\\; \\pi = \\mathrm{id}"],
    "context": "Before: automorphisms fix everything above $\\mathbf{0}''$, and there are countably many (Slaman–Woodin)",
    "stamp": "proved",
    "note": "The 10-page paper cites an unpublished 2005 Slaman–Woodin manuscript"},
  "verify": {"lean": "main", "detail": "Uses Mathlib's TuringReducible; about 84,000 lines, apparently formalizing that input too",
             "ourCheck": OC_TARGET},
  "sources": [
    rv("241", "claim", "Every order automorphism of the partial order of all Turing degrees (degrees of subsets of N under Turing reducibility) is the identity, in ZFC"),
    rv("241", "known_before", "Slaman-Woodin: every automorphism is the identity above 0'' and Aut(D) is countable"),
    rv("241", "caveats", "The paper itself is only 10 pages because it takes as an external input the Slaman-Woodin theorem that every automorphism is induced by an arithmetic (Borel) function on reals, cited from an unpublished 2005 manuscript."),
    rv("241", "lean", "it appears to formalize the Slaman-Woodin representation input rather than assume it"),
    art("Rigidity of the Turing degrees (family 241)", "the statement uses Mathlib's `TuringReducible` and asks that every order isomorphism of the degrees be the identity, and the solution directory (about 84,000 lines)"),
    S_TARGETS, S_NOBUILD]
})

# ---------------------------------------------------------------- 242
write({
  "id": "242", "discipline": LOGIC, "kind": "proof",
  "short": "Single-fold Diophantine representations",
  "title": {"title": "Diophantine sets with exactly one witness",
            "subtitle": "Claim: every computably enumerable set has a polynomial representation with exactly one witness per member"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "a \\in S \\iff \\term{e}{\\exists\\, w}:\\ P(a, w) = 0", "at": 0.4, "size": 42, "tone": "mute", "note": "Matiyasevich 1970", "y": 0.08,
       "terms": {"e": {"label": "some witnesses", "tone": "cool", "at": 0.9,
                       "visual": {"kind": "dots", "n": 5, "mark": [0, 2, 3], "tone": "hot", "dx": -170, "w": 130, "h": 40}}}},
      {"tex": "a \\in S \\iff \\term{u}{\\exists!\\, w}:\\ P(a, w) = 0", "at": 4.4, "size": 42, "tone": "claim", "note": "claimed: single-fold", "y": 0.58,
       "terms": {"u": {"label": "exactly one witness", "tone": "claim", "at": 0.9,
                       "visual": {"kind": "dots", "n": 5, "mark": [2], "tone": "hot", "dx": -170, "w": 130, "h": 40}}}}],
    "beats": [
      beat(0.2, "Every computably enumerable set is where a polynomial has an integer witness $w$"),
      beat(2.7, "Matiyasevich asked in 1974 for exactly one witness per member"),
      beat(5.1, "The claim: yes, with points $nP$ on a rank-one elliptic curve in place of Pell equations")]
  },
  "achievement": {
    "form": "status", "label": "Matiyasevich's single-fold question (1974)",
    "statement": ["\\#\\{w : P(a, w) = 0\\} = 1 \\text{ if } a \\in S,\\ 0 \\text{ otherwise}"],
    "context": "Before: single-fold exponential Diophantine representations (Matiyasevich 1974)",
    "stamp": "proved",
    "note": "So Hilbert's tenth stays undecidable even with at most one solution promised"},
  "verify": {"lean": "main", "detail": "In Lean: the single-fold representation; the promise corollary is not separate",
             "ourCheck": OC_DOCS},
  "sources": [
    art("Hilbert's tenth problem over Q (family 004)", "Matiyasevich showed in 1970 that no algorithm decides whether an integer polynomial has an integer root."),
    rv("242", "known_before", "Matiyasevich (1974) proved single-fold exponential Diophantine representations and posed the polynomial single-fold (and finite-fold) problem"),
    rv("242", "claim", "an integer polynomial P(a, w) such that for a in S there is exactly one witness tuple w in N^m with P(a, w) = 0 and for a not in S there is none"),
    rv("242", "claim", "Diophantine solvability over N stays undecidable under the promise of at most one solution"),
    rv("242", "caveats", "Uses a rank-one elliptic curve and Neron-Tate height to get a single-fold growth relation replacing Pell-equation exponentiation."),
    rv("242", "lean", "main theorem formalized (SingleFold.main); the promise-undecidability consequence not separately formalized."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 243
write({
  "id": "243", "discipline": LOGIC, "kind": "proof",
  "short": "Choiceless polynomial time is not P",
  "title": {"title": "Choiceless polynomial time does not capture P",
            "subtitle": "Claim: a polynomial-time query on finite structures that choiceless polynomial time with counting can't define"},
  "object": {
    "dur": 8.6,
    "primitive": "shape",
    "shapes": [
      {"kind": "ellipse", "rx": 1.25, "ry": 0.95, "label": "PTIME", "labelAt": [0.85, 0.72], "tone": "soft", "at": 0.4},
      {"kind": "ellipse", "rx": 0.62, "ry": 0.55, "c": [-0.42, -0.08], "label": "CPT", "labelAt": [-0.42, -0.08], "tone": "accent", "at": 2.4}],
    "points": [{"p": [0.2, -0.55], "label": "the $\\mathbb{F}_3$ query", "tone": "hot", "at": 5.2}],
    "beats": [
      beat(0.2, "Schematic: properties of unordered finite structures decidable in polynomial time"),
      beat(2.6, "Choiceless polynomial time with counting (CPT) was the leading candidate to capture them"),
      beat(5.2, "The claim: solving linear systems over $\\mathbb{F}_3$ is in PTIME but not in CPT")]
  },
  "achievement": {
    "form": "status", "label": "Blass–Gurevich–Shelah conjecture (1999)",
    "statement": ["\\mathrm{CPT} \\subsetneq \\mathrm{PTIME} \\text{ on finite structures}"],
    "context": "Before: separations only for restricted variants of CPT (Pakusa, Grädel, Schalthöfer, Lichter)",
    "stamp": "proved",
    "note": "Not P vs NP, and not whether some other logic captures PTIME"},
  "verify": {"lean": "main", "detail": "Both separations are in Lean, which has to encode CPT itself",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("243", "known_before", "Blass-Gurevich-Shelah (1999) introduced CPT and conjectured it does not capture PTIME."),
    rv("243", "known_before", "Pakusa, Gradel, Schalthofer, Lichter (2021-2023) separated CPT variants"),
    rv("243", "claim", "an explicit isomorphism-invariant query on finite structures in an 8-relation vocabulary (consistency of a linear system over F_3) is decidable in polynomial time but not CPT-definable"),
    rv("243", "caveats", "The separation is unconditional and does not separate P from NP or settle whether some other logic captures PTIME (Gurevich's question). The formal statement defines CPT inside Lean"),
    rv("243", "lean", "main theorem formalized (ChoicelessPolynomialTime: CPTSeparation.main; WitnessedChoice.main)."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 244
write({
  "id": "244", "discipline": LOGIC, "kind": "proof",
  "short": "The Partition Principle without Choice",
  "title": {"title": "The Partition Principle does not imply Choice",
            "subtitle": "Claim: if ZF is consistent, so is ZF with the Partition Principle and the failure of Choice"},
  "object": {
    "dur": 8.6,
    "primitive": "shape",
    "shapes": [
      {"kind": "ellipse", "rx": 1.4, "ry": 0.98, "label": "models of ZF", "labelAt": [-1.2, 1.05], "tone": "faint", "at": 0.4},
      {"kind": "ellipse", "rx": 0.95, "ry": 0.72, "c": [0.15, -0.08], "label": "PP", "labelAt": [0.85, 0.5], "tone": "soft", "at": 1.4},
      {"kind": "ellipse", "rx": 0.42, "ry": 0.38, "c": [-0.3, -0.12], "label": "AC", "labelAt": [-0.3, -0.12], "tone": "accent", "at": 2.6}],
    "points": [{"p": [0.35, -0.35], "label": "new model", "tone": "hot", "at": 5.4}],
    "beats": [
      beat(0.2, "PP: every surjection $X \\to Y$ has an injection back $Y \\to X$. Choice implies it"),
      beat(2.8, "Schematic: does PP imply Choice? Open since Beppo Levi in 1902"),
      beat(5.4, "The claim: a model of ZF where PP holds and Choice fails")]
  },
  "achievement": {
    "form": "status", "label": "Partition Principle vs Choice (Levi, 1902)",
    "statement": ["\\mathrm{Con}(\\mathrm{ZF}) \\Rightarrow \\mathrm{Con}(\\mathrm{ZF} + \\mathrm{PP} + \\mathrm{AC}_{\\mathrm{WO}} + \\neg\\mathrm{AC})"],
    "context": "Often called the oldest open problem in set theory; several earlier constructions were withdrawn",
    "stamp": "proved",
    "note": "A symmetric forcing model"},
  "verify": {"lean": "main", "detail": "In Lean, which had to define ZF syntax and symmetric extensions itself",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("244", "claim", "If ZF is consistent then so is ZF + PP + AC_WO + not-AC, where PP says every surjection X -> Y admits an injection Y -> X."),
    rv("244", "known_before", "PP traced to Beppo Levi (1902); whether PP implies AC is often called the oldest open problem in set theory"),
    rv("244", "known_before", "Several earlier claimed constructions were withdrawn"),
    art("The Partition Principle does not imply Choice (family 244)", "The claim builds a symmetric forcing model of ZF plus the Partition Principle plus choice for well-orderable families in which choice fails."),
    art("The Partition Principle does not imply Choice (family 244)", "which means Lean had to formalize ZF syntax and symmetric extensions"),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 245
write({
  "id": "245", "discipline": LOGIC, "kind": "proof",
  "short": "Weak implies strong normalization",
  "title": {"title": "Weak normalization implies strong normalization",
            "subtitle": "Claim: in every pure type system, if every legal term has a normal form, every reduction terminates"},
  "object": {
    "dur": 8.6,
    "primitive": "graph", "r": 26, "edgeAt": 0.6, "edgeDur": 3.6,
    "nodes": [
      {"id": "m", "x": 0.06, "y": 0.5, "label": "$M$"},
      {"id": "a", "x": 0.3, "y": 0.18, "label": "$M_1$"},
      {"id": "b", "x": 0.58, "y": 0.18, "label": "$M_2$"},
      {"id": "c", "x": 0.26, "y": 0.82, "label": "$M_3$"},
      {"id": "d", "x": 0.48, "y": 0.82, "label": "$M_4$"},
      {"id": "e", "x": 0.7, "y": 0.82, "label": "$M_5$"},
      {"id": "n", "x": 0.94, "y": 0.5, "label": "nf", "tone": "accent", "fill": "accent"}],
    "edges": [["m", "a", {"tone": "accent"}], ["a", "b", {"tone": "accent"}], ["b", "n", {"tone": "accent"}],
              ["m", "c"], ["c", "d"], ["d", "e"], ["e", "n"], ["a", "d"]],
    "beats": [
      beat(0.2, "Schematic: the reduction steps out of a legal term $M$"),
      beat(2.8, "Weak normalization: some path ends in a normal form (highlighted)"),
      beat(5.4, "The claim: then every path does, in every pure type system")]
  },
  "achievement": {
    "form": "status", "label": "Barendregt–Geuvers–Klop conjecture (early 1990s)",
    "statement": ["\\mathrm{WN} \\;\\Rightarrow\\; \\mathrm{SN} \\text{ for every pure type system}"],
    "context": "Before: known for many systems, including those in the $\\lambda$-cube (Sørensen 1997)",
    "stamp": "proved",
    "note": "Arbitrary sorts, non-functional rules and open contexts"},
  "verify": {"lean": "main", "detail": "In Lean, with pure type system syntax defined inside Lean",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("245", "known_before", "Barendregt-Geuvers-Klop conjecture (stated by Barendregt, Geuvers and Klop in the early 1990s"),
    rv("245", "known_before", "Sorensen 1997 for PTS in the lambda-cube"),
    rv("245", "claim", "For every pure type system (arbitrary sorts, nonfunctional axioms and rules, open contexts, full beta reduction including inside annotations): if every legal term has a beta-normal form then every beta-reduction sequence from a legal term terminates"),
    rv("245", "caveats", "Formal statement defines PTS syntax inside Lean"),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 246
write({
  "id": "246", "discipline": GROUP, "kind": "proof",
  "short": "Cannon's conjecture",
  "title": {"title": "Cannon's conjecture",
            "subtitle": "Claim: a hyperbolic group whose boundary is the 2-sphere acts geometrically on hyperbolic 3-space"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "G \\text{ hyperbolic},\\quad \\term{b}{\\partial G} \\cong \\term{s}{S^2}", "at": 0.4, "size": 44, "tone": "soft", "y": 0.16,
       "terms": {"b": {"label": "boundary at infinity", "tone": "cool", "side": "above", "at": 0.8},
                 "s": {"label": "the 2-sphere", "tone": "soft", "at": 1.4}}},
      {"tex": "\\Downarrow", "at": 3.2, "size": 40, "tone": "mute", "y": 0.5},
      {"tex": "G \\curvearrowright \\term{h}{\\mathbb{H}^3} \\text{ properly, cocompactly, finite kernel}", "at": 3.6, "size": 40, "tone": "claim", "y": 0.66,
       "terms": {"h": {"label": "hyperbolic 3-space", "tone": "claim", "at": 0.8}}}],
    "beats": [
      beat(0.2, "A closed hyperbolic 3-manifold's group has the 2-sphere as its boundary at infinity"),
      beat(2.8, "Cannon conjectured the converse in the early 1990s"),
      beat(5.4, "The 31-page proof bounds combinatorial moduli, then straightens the action into $\\mathbb{H}^3$")]
  },
  "achievement": {
    "form": "status", "label": "Cannon's conjecture (early 1990s)",
    "statement": ["\\partial G \\cong S^2 \\;\\Rightarrow\\; G \\curvearrowright \\mathbb{H}^3 \\text{ geometrically}"],
    "context": "Before: when the conformal dimension is attained (Bonk–Kleiner), and other special cases",
    "stamp": "proved",
    "note": "Torsion-free such groups are closed hyperbolic 3-manifold groups"},
  "verify": {"lean": "main", "detail": "Hyperbolicity, boundary and $\\mathbb{H}^3$ are defined from scratch; the statement is faithful",
             "ourCheck": OC_TARGET},
  "sources": [
    art("Cannon's conjecture (family 246)", "Cannon conjectured in the early 1990s that the converse holds"),
    rv("246", "claim", "Every word-hyperbolic group G whose Gromov boundary is homeomorphic to S^2 admits a homomorphism to Isom(H^3) with finite kernel whose action on H^3 is proper and cocompact. If G is torsion-free it is the fundamental group of a closed hyperbolic 3-manifold."),
    rv("246", "known_before", "Bonk-Kleiner (Inventiones 2002/ Geom. Topol. 2005) proved it when the Ahlfors-regular conformal dimension is attained"),
    rv("246", "caveats", "31-page analytic proof: reduces via Bourdon-Kleiner's modulus criterion to a uniform bound on combinatorial 2-modulus"),
    rv("246", "lean", "This is a faithful statement."),
    S_TARGETS, S_NOBUILD]
})

# ---------------------------------------------------------------- 247
write({
  "id": "247", "discipline": GROUP, "kind": "counterexample",
  "short": "A finitely presented infinite periodic group",
  "title": {"title": "An infinite, finitely presented periodic group",
            "subtitle": "Claim: a finitely presented infinite group in which every element has finite order"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "\\term{s}{\\mathrm{St}_{12}(R)}:\\ \\text{infinite, finitely presented, } \\term{p}{\\text{periodic}}", "at": 0.4, "size": 38, "tone": "claim", "y": 0.08,
       "terms": {"s": {"label": "a Steinberg group", "tone": "soft", "at": 0.8},
                 "p": {"label": "every element: finite order", "tone": "claim", "at": 1.4,
                       "visual": {"kind": "shape", "shape": "regular", "n": 6, "dx": 60, "w": 110, "h": 80}}}},
      {"tex": "R:\\ \\text{a unital } \\mathbb{F}_2\\text{-algebra}", "at": 2.8, "size": 32, "tone": "soft", "y": 0.56},
      {"tex": "\\ker\\big(\\mathrm{St}_{12}(R) \\to \\mathrm{St}_{12}(\\mathbb{F}_2)\\big):\\ \\text{residually finite 2-group}", "at": 5.0, "size": 32, "tone": "warn", "y": 0.74}],
    "beats": [
      beat(0.2, "Burnside (1902): must a finitely generated group of finite-order elements be finite?"),
      beat(2.7, "Golod said no in 1964, but every example needed infinitely many relations"),
      beat(5.2, "Lean covers the periodic group; the residually finite 2-group is paper only")]
  },
  "achievement": {
    "form": "status", "label": "Burnside problem, finitely presented version",
    "statement": ["\\mathrm{St}_{12}(R) \\text{ infinite, finitely presented, periodic}"],
    "context": "Before: infinite periodic groups existed (Golod 1964), but none finitely presented",
    "stamp": "counterexample",
    "note": "Element orders are unbounded; the group also has property (T)"},
  "verify": {"lean": "part", "detail": "In Lean: the periodic group. The residually finite 2-group and nil algebra are not",
             "ourCheck": OC_DOCS},
  "sources": [
    art("A finitely presented infinite periodic group (family 247)", "Burnside asked in 1902 whether a finitely generated group in which every element has finite order must be finite. Golod said no in 1964, but every known counterexample needs infinitely many relations."),
    rv("247", "claim", "(a) There is an infinite, ordinarily finitely presented periodic group: St_12(R) for a suitable unital F_2-algebra R; it also has property (T). (b) Its finite-index subgroup G = ker(St_12(R) -> St_12(F_2)) is infinite, finitely presented, residually finite, and every element has finite 2-power order (unbounded)."),
    rv("247", "caveats", "Element orders are unbounded (no common exponent), as expected."),
    rv("247", "lean", "residual finiteness / the 2-group statement in the family headline and the nil-algebra conclusions are NOT formalized."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 248
D = 6
write({
  "id": "248", "discipline": GROUP, "kind": "proof",
  "short": "Thompson's group $F$ is not amenable",
  "title": {"title": "Thompson's group $F$ is not amenable",
            "subtitle": "Claim: $F$ admits no left-invariant mean on bounded functions"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "plot", "until": 4.4, "x": [0, 1], "y": [0, 1],
       "xticks": [{"v": 0, "label": "0"}, {"v": 0.5, "label": "$1/2$"}, {"v": 0.75, "label": "$3/4$"}, {"v": 1, "label": "1"}],
       "yticks": [{"v": 0.25, "label": "$1/4$"}, {"v": 0.5, "label": "$1/2$"}, {"v": 1, "label": "1"}],
       "curves": [
         {"f": "x", "tone": "faint", "dash": True, "at": 0.4, "dur": 0.8},
         {"f": "x < 0.5 ? x/2 : (x < 0.75 ? x - 0.25 : 2*x - 1)", "label": "$x_0 \\in F$", "tone": "claim", "at": 0.9, "dur": 1.6}]},
      {"primitive": "grid", "from": 4.4, "rows": D, "cols": D,
       "cells": [[r, 2, "accent"] for r in range(D)],
       "blocks": [{"r": 0, "c": 2, "h": D, "w": 1, "label": "nested pairs", "at": 1.2}]}
    ],
    "beats": [
      beat(0.2, "$F$: piecewise-linear maps of $[0, 1]$ with dyadic breaks and slopes $2^k$, like $x_0$"),
      beat(2.7, "Geoghegan asked in 1979 whether $F$ is amenable; claims both ways were withdrawn"),
      beat(5.2, "The 13-page proof turns on one count: nested pairs are only a $1/D$ fraction")]
  },
  "achievement": {
    "form": "status", "label": "Amenability of Thompson's group F (Geoghegan, 1979)",
    "statement": ["F \\text{ has no left-invariant mean on } \\ell^{\\infty}(F)"],
    "context": "Before: no free subgroups (Brin–Squier) and not elementary amenable; claimed proofs both ways withdrawn",
    "stamp": "proved",
    "note": "With family 251: non-unitarizable representations of $F$"},
  "verify": {"lean": "main", "detail": "Faithful target: dyadic PL maps, composition as product; about 9,500 lines",
             "ourCheck": OC_TARGET},
  "sources": [
    art("Thompson's group F is not amenable (family 248)", "Thompson's group $F$ is the group of piecewise-linear homeomorphisms of $[0,1]$ with dyadic breakpoints and slopes that are powers of 2. Whether it is amenable has been open since Geoghegan asked in 1979."),
    art("Thompson's group F is not amenable (family 248)", "the solution is about 9,500 lines"),
    art("Thompson's group F is not amenable (family 248)", "Corollaries in the paper: non-unitarizable representations of $F$ (via family 251)"),
    art("Thompson's group F is not amenable (family 248)", "only one column in D pairs a child with its own parent, so those terms are a 1/D fraction"),
    rv("248", "known_before", "F has no free subgroups (Brin-Squier 1985) and is not elementary amenable."),
    rv("248", "known_before", "Claimed resolutions in both directions have been withdrawn or disputed (Akhmedov, Shavgulidze, Moore), as the paper itself records."),
    rv("248", "caveats", "13 pages, astonishingly short for a 60-year-old problem"),
    S_TARGETS, S_NOBUILD]
})

# ---------------------------------------------------------------- 249
write({
  "id": "249", "discipline": GROUP, "kind": "counterexample",
  "short": "Eilenberg–Ganea fails",
  "title": {"title": "A counterexample to the Eilenberg–Ganea conjecture",
            "subtitle": "Claim: a finitely generated group of cohomological dimension 2 with no 2-dimensional classifying space"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "equation", "until": 3.6, "mode": "stack",
       "lines": [
         {"tex": "\\langle\\, x, y \\mid x^2 = y^5,\\ x^2 = (x y^{-1})^3 \\,\\rangle", "at": 0.4, "size": 46},
         {"tex": "\\text{a spine of the Poincaré homology sphere}", "at": 1.4, "size": 30, "tone": "soft"}]},
      {"primitive": "numberline", "from": 3.6, "min": 0, "max": 4, "y": 0.6, "ticks": [0, 1, 2, 3, 4],
       "axisLabel": "dimension of the kernel $G$",
       "markers": [
         {"v": 2, "label": "$\\mathrm{cd}_{\\mathbb{Z}}\\, G$", "note": "algebra", "tone": "claim", "at": 1.0},
         {"v": 3, "label": "$\\mathrm{gd}\\, G$", "note": "geometry", "tone": "hot", "at": 2.2}]}
    ],
    "beats": [
      beat(0.2, "Bestvina–Brady built groups from this complex: Eilenberg–Ganea or Whitehead must fail"),
      beat(3.7, "The two dimensions agree for every group, except possibly when one is 2"),
      beat(6.2, "The claim: here they differ, so Eilenberg–Ganea is the one that fails")]
  },
  "achievement": {
    "form": "status", "label": "Eilenberg–Ganea conjecture (1957)",
    "statement": ["\\mathrm{cd}_{\\mathbb{Z}}\\, G = 2,\\qquad \\mathrm{gd}\\, G = 3"],
    "context": "Bestvina–Brady (1997): Eilenberg–Ganea or Whitehead fails for such kernels; this says Eilenberg–Ganea",
    "stamp": "counterexample",
    "note": "Finitely generated, not finitely presented; Whitehead's conjecture stays open"},
  "verify": {"lean": "main", "detail": "The main theorem is in Lean",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("249", "claim", "There is a finitely generated, residually finite group G with cd_Z G = 2 and gd G = 3: the Bestvina-Brady kernel of the right-angled Artin group on a finite acyclic flag triangulation of the presentation complex <x, y | x^2 = y^5, x^2 = (x y^{-1})^3> (a spine of the Poincare homology sphere)."),
    rv("249", "known_before", "Eilenberg-Ganea (1957) proved cd = gd for cd >= 3; the dimension-2 case is the Eilenberg-Ganea conjecture. Bestvina-Brady (1997) proved that either Eilenberg-Ganea or the Whitehead asphericity conjecture is false"),
    rv("249", "caveats", "it does not settle the Whitehead conjecture. The group is finitely generated but not finitely presented"),
    rv("249", "lean", "main theorem formalized (EilenbergGanea.source_main)."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 250
write({
  "id": "250", "discipline": GROUP, "kind": "proof",
  "short": "The Boone–Higman conjecture",
  "title": {"title": "The Boone–Higman conjecture",
            "subtitle": "Claim: a finitely generated group has solvable word problem iff it embeds in a finitely presented simple group"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "G \\hookrightarrow S \\text{ f.p. simple} \\;\\Rightarrow\\; \\text{word problem solvable}", "at": 0.4, "size": 34, "tone": "mute", "y": 0.08},
      {"tex": "G \\text{ hyperbolic} \\;\\Rightarrow\\; G \\hookrightarrow S", "at": 2.8, "size": 34, "tone": "soft", "y": 0.3},
      {"tex": "\\term{w}{\\text{word problem solvable}} \\;\\Rightarrow\\; G \\hookrightarrow \\term{s}{S}", "at": 5.0, "size": 38, "tone": "claim", "y": 0.6,
       "terms": {"w": {"label": "a program decides if a word is trivial", "tone": "cool", "at": 0.6},
                 "s": {"label": "finitely presented, simple", "tone": "claim", "at": 1.1}}}],
    "beats": [
      beat(0.2, "Embedding in a finitely presented simple group $S$ forces a solvable word problem (1974)"),
      beat(2.7, "Boone and Higman conjectured the converse; hyperbolic groups were done in 2023"),
      beat(5.2, "The claim: always, even with $S$ of type $F_{\\infty}$")]
  },
  "achievement": {
    "form": "status", "label": "Boone–Higman conjecture (1974)",
    "statement": ["\\text{word problem solvable} \\iff G \\hookrightarrow S,\\ S \\text{ f.p. simple}"],
    "context": "Before: hyperbolic groups (Belk–Bleak–Matucci–Zaremsky 2023) and many other classes",
    "stamp": "proved",
    "note": "Also: one $F_{\\infty}$ group that contains every finitely presented group"},
  "verify": {"lean": "main", "detail": "All three main results in Lean; the converse in part (c) is not",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("250", "claim", "(a) A finitely generated group has solvable word problem iff it embeds in a finitely presented simple group (Boone-Higman conjecture). (b) Every finitely generated group with solvable word problem embeds in a simple group of type F_infinity. (c) There is one group of type F_infinity containing every finitely presented group"),
    rv("250", "known_before", "Boone-Higman (1974) proved the 'if' direction and conjectured the converse."),
    rv("250", "known_before", "Belk-Bleak-Matucci-Zaremsky (2023, arXiv:2309.06224) proved it for hyperbolic groups"),
    rv("250", "lean", "main theorem formalized (BooneHigman: full equivalence; SimpleOvergroups; UniversalFInfinity). The converse about recursively presented subgroups in (c) is not formalized."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 251
write({
  "id": "251", "discipline": GROUP, "kind": "proof",
  "short": "Dixmier's unitarizability problem",
  "title": {"title": "Unitarizable groups are exactly the amenable ones",
            "subtitle": "Claim: a discrete group is amenable iff every uniformly bounded representation is similar to a unitary one"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "G \\text{ amenable} \\;\\Rightarrow\\; \\text{unitarizable}", "at": 0.4, "size": 38, "tone": "mute", "note": "Dixmier, Day", "y": 0.08},
      {"tex": "G \\supseteq F_2 \\;\\Rightarrow\\; \\text{not unitarizable}", "at": 2.6, "size": 38, "tone": "soft", "note": "known", "y": 0.3},
      {"tex": "G\\ \\term{n}{\\text{nonamenable}} \\;\\Rightarrow\\; \\term{u}{\\text{not unitarizable}}", "at": 4.8, "size": 38, "tone": "claim", "note": "claimed", "y": 0.58,
       "terms": {"n": {"label": "no invariant mean", "tone": "cool", "at": 0.6},
                 "u": {"label": "a bounded rep. not similar to a unitary", "tone": "claim", "at": 1.1}}}],
    "beats": [
      beat(0.2, "Unitarizable: every uniformly bounded representation is similar to a unitary one"),
      beat(2.6, "Dixmier asked in 1950 whether that characterizes amenability; free subgroups break it"),
      beat(5.0, "The claim: every nonamenable group fails, with witnesses of norm at most $1 + \\varepsilon$")]
  },
  "achievement": {
    "form": "status", "label": "Dixmier's unitarizability problem (1950)",
    "statement": ["G \\text{ amenable} \\iff \\text{every uniformly bounded rep. is unitarizable}"],
    "context": "Before: groups with free subgroups and free Burnside groups (Monod–Ozawa); the rest was open",
    "stamp": "proved",
    "note": "With family 248: non-unitarizable representations of Thompson's $F$"},
  "verify": {"lean": "main", "detail": "Dixmier is in Lean; the strong Ulam stability companion is not",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("251", "claim", "Dixmier's problem: a discrete group is amenable iff every uniformly bounded representation on a Hilbert space is similar to a unitary one; for every nonamenable group and eps > 0 there is a nonunitarizable representation with uniform bound <= 1 + eps."),
    rv("251", "known_before", "Dixmier (1950) asked; amenable => unitarizable (Dixmier, Day, Nakamura-Takeda). Groups containing F_2 are not unitarizable"),
    rv("251", "known_before", "Monod-Ozawa 2010 handled free Burnside groups and some others"),
    rv("251", "caveats", "Note the interaction with 248: if F is nonamenable, Dixmier gives non-unitarizable representations of F."),
    rv("251", "lean", "Strong Ulam stability (b) not formalized."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 252
write({
  "id": "252", "discipline": GROUP, "kind": "counterexample",
  "short": "A hyperbolic group, not residually finite",
  "title": {"title": "A hyperbolic group that is not residually finite",
            "subtitle": "Claim: a torsion-free hyperbolic group that is neither residually finite nor linear over any field"},
  "object": {
    "dur": 8.6,
    "primitive": "venn",
    "sets": [{"label": "hyperbolic", "at": 0.3}, {"label": "residually finite", "at": 0.8}],
    "regions": [{"set": "A&!B", "at": 5.0, "tone": "accent"}],
    "members": [
      {"x": 0.5, "y": 0.42, "label": "$F_2$", "at": 2.4},
      {"x": 0.69, "y": 0.42, "label": "$\\mathbb{Z}^2$", "at": 2.8},
      {"x": 0.29, "y": 0.42, "label": "new $G$", "tone": "hot", "at": 5.2}],
    "beats": [
      beat(0.2, "Schematic: the hyperbolic groups people use, like free groups, are residually finite"),
      beat(2.6, "Gromov asked whether every hyperbolic group is"),
      beat(5.2, "The claim: one is not, so by Malcev it is not linear over any field either")]
  },
  "achievement": {
    "form": "status", "label": "Gromov's question: is every hyperbolic group residually finite?",
    "statement": ["\\exists\\, G \\text{ torsion-free hyperbolic, not residually finite}"],
    "context": "Before: cubulated hyperbolic groups are residually finite (Agol, Wise); the general question was open",
    "stamp": "counterexample",
    "note": "Existential: some element of a finite family dies in every finite quotient"},
  "verify": {"lean": "main", "detail": "Non-residual-finiteness is in Lean; nonlinearity follows by Malcev, not formalized",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("252", "claim", "There is a torsion-free word-hyperbolic group (fundamental group of a finite Euclidean triangle complex) that is not residually finite"),
    rv("252", "known_before", "Gromov's question whether every hyperbolic group is residually finite"),
    rv("252", "known_before", "Wise, Agol: cubulated hyperbolic groups are RF. Open."),
    rv("252", "caveats", "existential: proves one member of a finite family is in the finite residual without saying which."),
    rv("252", "lean", "Nonlinearity follows by Malcev's theorem but is not separately formalized."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 253
write({
  "id": "253", "discipline": GROUP, "kind": "proof",
  "short": "A finitely presented simple amenable group",
  "title": {"title": "An infinite finitely presented simple amenable group",
            "subtitle": "Claim: one infinite group that is finitely presented, simple and amenable at once"},
  "object": {
    "dur": 8.6,
    "primitive": "venn",
    "sets": [{"label": "finitely presented", "at": 0.3}, {"label": "simple", "at": 0.7}, {"label": "amenable", "at": 1.1}],
    "regions": [{"set": "A&B&C", "at": 5.2, "tone": "accent"}],
    "members": [
      {"x": 0.422, "y": 0.6, "label": "$\\mathbb{Z}$", "at": 2.4},
      {"x": 0.49, "y": 0.2, "label": "$T$", "at": 2.7},
      {"x": 0.57, "y": 0.6, "label": "J–M", "at": 3.0},
      {"x": 0.49, "y": 0.43, "label": "new", "tone": "hot", "at": 5.4}],
    "beats": [
      beat(0.2, "Schematic: three properties an infinite group can have, with examples"),
      beat(2.6, "Thompson's $T$ is not amenable; Juschenko–Monod groups can never be finitely presented"),
      beat(5.2, "The claim: a group with all three, inside polygon exchange transformations")]
  },
  "achievement": {
    "form": "status", "label": "Finitely presented, simple and amenable: does one exist?",
    "statement": ["\\exists\\, G \\text{ infinite, finitely presented, simple, amenable}"],
    "context": "Before: infinite finitely generated simple amenable groups (Juschenko–Monod 2013), never finitely presented",
    "stamp": "proved",
    "note": "Existence only; no explicit size"},
  "verify": {"lean": "main", "detail": "In Lean, amenability via the Følner condition; about 85k lines",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("253", "claim", "There is a group that is infinite, finitely presented, simple and amenable: an alternating subgroup of a polygon exchange group"),
    rv("253", "known_before", "Juschenko-Monod (Annals 2013) gave infinite finitely generated simple amenable groups"),
    art("A finitely presented simple amenable group (family 253)", "but those topological full groups can never be finitely presented"),
    rv("253", "caveats", "58 pages; existence only, no explicit size. Lean development ~85k lines."),
    rv("253", "lean", "main theorem formalized (SimpleAmenable.main, amenability via Følner condition)."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 254
write({
  "id": "254", "discipline": GROUP, "kind": "proof",
  "short": "The $K(\\pi,1)$ conjecture for Artin groups",
  "title": {"title": "The $K(\\pi,1)$ conjecture for every Artin group",
            "subtitle": "Claim: for every finite Coxeter matrix, the Salvetti complex is a classifying space for its Artin group"},
  "object": {
    "dur": 8.6,
    "heading": "The paper's dependency map for the $K(\\pi,1)$ proof",
    "primitive": "tree", "at": 0.4, "legend": False,
    "nodes": [
      {"id": "r", "label": "$X(W,S)$ is a $K(A,1)$", "status": "paper"},
      {"id": "c", "label": "Salvetti cover contractible", "parent": "r", "status": "lean"},
      {"id": "s", "label": "Salvetti comparison", "parent": "r", "status": "prior"},
      {"id": "h", "label": "spherical-residue sublevels", "parent": "c", "status": "paper"},
      {"id": "t", "label": "two-point estimate", "parent": "h", "status": "paper"},
      {"id": "o", "label": "isolated-layer obstruction", "parent": "h", "status": "paper"}],
    "beats": [
      beat(0.2, "New: a poset model of the cover, peeled layer by layer by harmonic heights"),
      beat(2.8, "Highlighted: the Lean target, contractibility of the Salvetti cover"),
      beat(5.4, "Grey: the classical comparison, a standard model the statement trusts")]
  },
  "achievement": {
    "form": "status", "label": "K(pi,1) conjecture (Arnold, Brieskorn, Pham, Thom)",
    "statement": ["\\widetilde{X}(W,S) \\text{ contractible for every Coxeter matrix on a finite set}"],
    "context": "Before: spherical type (Deligne 1972), FC type and dimension 2, affine type (Paolini–Salvetti 2021)",
    "stamp": "proved",
    "note": "Companions: parabolic intersections; a 116-generator Artin group, not CAT(0)"},
  "verify": {"lean": "main", "detail": "In Lean, with the cover modeled as a poset nerve: standard, but trusted, not proved",
             "ourCheck": OC_TARGET},
  "sources": [
    rv("254", "claim", "(a) The K(pi,1) conjecture: for every Coxeter matrix on a finite set S (any labels including infinity, any diagram), the universal cover of the Salvetti complex is contractible"),
    rv("254", "claim", "(c) An explicit Artin group on 116 generators with labels in {2,3,infinity} has no proper cocompact isometric action on any proper CAT(0) space."),
    rv("254", "known_before", "K(pi,1) conjecture (Arnold, Brieskorn, Pham, Thom, 1970s). Deligne (1972) spherical type; Charney-Davis (1995) FC type and dimension <= 2; Paolini-Salvetti (Inventiones 2021) affine type"),
    rv("254", "lean", "That identification is standard (Salvetti; Paolini's account) but it is a modeling choice inside the trusted statement rather than something the Lean proves."),
    art("Artin groups (family 254)", "framed category and twists, layer calculus and caps feed a two-point estimate and an isolated-layer obstruction, which give spherical-residue sublevels, then contractibility of the poset realization, which with the Salvetti comparison lemma proves X(W,S) is a K(A,1)"),
    S_TARGETS, S_NOBUILD]
})

# ---------------------------------------------------------------- 255
write({
  "id": "255", "discipline": GROUP, "kind": "proof",
  "short": "QI rigidity of polycyclic groups",
  "title": {"title": "Polycyclic groups are recognized by their large-scale shape",
            "subtitle": "Claim: a group quasi-isometric to a virtually polycyclic group is itself virtually polycyclic"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "H \\sim_{\\mathrm{QI}} \\text{virtually nilpotent} \\;\\Rightarrow\\; H \\text{ virtually nilpotent}", "at": 0.4, "size": 34, "tone": "mute", "y": 0.08},
      {"tex": "\\text{Sol, lamplighters}", "at": 2.8, "size": 34, "tone": "soft", "y": 0.3},
      {"tex": "H \\term{q}{\\sim_{\\mathrm{QI}}} \\text{virtually polycyclic} \\;\\Rightarrow\\; \\term{v}{H \\text{ virtually polycyclic}}", "at": 4.8, "size": 36, "tone": "claim", "y": 0.58,
       "terms": {"q": {"label": "same large-scale shape", "tone": "cool", "at": 0.6},
                 "v": {"label": "the algebra follows", "tone": "claim", "mark": "box", "at": 1.2}}}],
    "beats": [
      beat(0.2, "Gromov (1981): looking nilpotent at large scale makes a group virtually nilpotent"),
      beat(2.7, "Eskin, Fisher and Whyte did Sol and lamplighters, and conjectured the solvable analogue"),
      beat(5.2, "The claim: every virtually polycyclic group is recognized this way")]
  },
  "achievement": {
    "form": "status", "label": "Eskin–Fisher–Whyte conjecture",
    "statement": ["H \\sim_{\\mathrm{QI}} P \\text{ virtually polycyclic} \\;\\Rightarrow\\; H \\text{ virtually polycyclic}"],
    "context": "Before: polynomial growth (Gromov 1981), Sol and lamplighters (Eskin–Fisher–Whyte), abelian-by-abelian (Peng)",
    "stamp": "proved"},
  "verify": {"lean": "main", "detail": "In Lean, one of the largest developments in the group: about 262k lines",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("255", "claim", "Every finitely generated group quasi-isometric to a finitely generated virtually polycyclic group is virtually polycyclic"),
    rv("255", "known_before", "Gromov (1981) polynomial growth (virtually nilpotent case). Eskin-Fisher-Whyte (Annals 2012-2013) Sol and lamplighters via coarse differentiation; Peng (2011) for split abelian-by-abelian"),
    rv("255", "lean", "Lean ~262k lines."),
    art("Quasi-isometric rigidity of polycyclic groups (family 255)", "Eskin, Fisher and Whyte conjectured the solvable analogue and proved it for Sol and lamplighters."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 256
write({
  "id": "256", "discipline": GROUP, "kind": "proof",
  "short": "Kervaire's conjecture, and Howie's",
  "title": {"title": "Kervaire's conjecture, and equations over groups",
            "subtitle": "Claim: adding one generator and one relation never kills a nontrivial group"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "\\term{a}{A \\ne 1} \\;\\Rightarrow\\; (A * \\term{t}{\\langle t \\rangle})/\\term{w}{\\langle\\!\\langle w \\rangle\\!\\rangle} \\ne 1", "at": 0.4, "size": 44, "tone": "claim", "y": 0.18,
       "terms": {"a": {"label": "a nontrivial group", "tone": "soft", "at": 0.8},
                 "t": {"label": "one new generator", "tone": "cool", "at": 1.4},
                 "w": {"label": "one new relation", "tone": "hot", "side": "above", "at": 2.0}}},
      {"tex": "\\text{exponent sum of } t \\text{ in } w = \\pm 1 \\;\\Rightarrow\\; A \\hookrightarrow (A * \\langle t \\rangle)/\\langle\\!\\langle w \\rangle\\!\\rangle", "at": 3.2, "size": 30, "tone": "soft", "y": 0.66}],
    "beats": [
      beat(0.2, "Can one new generator $t$ and one relation $w$ kill a nontrivial group $A$?"),
      beat(2.7, "Kervaire (1965) said no; finite and torsion-free groups were known"),
      beat(5.2, "The claim, in 13 pages: never. Howie's multi-equation version is paper only")]
  },
  "achievement": {
    "form": "status", "label": "Kervaire's conjecture (1965)",
    "statement": ["A \\ne 1 \\;\\Rightarrow\\; (A * \\langle t \\rangle)/\\langle\\!\\langle w \\rangle\\!\\rangle \\ne 1"],
    "context": "Before: finite groups (Gerstenhaber–Rothaus 1962), torsion-free groups (Klyachko 1993)",
    "stamp": "proved",
    "note": "Howie's conjecture, the family's headline, is not formalized"},
  "verify": {"lean": "part", "detail": "In Lean: the unimodular injectivity behind Kervaire. Howie's theorem is not",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("256", "claim", "(a) Kervaire conjecture: for every nontrivial group A and every w in A * <t>, the quotient (A * <t>)/<<w>> is nontrivial; proved via coefficient injectivity when the exponent sum of t in w is +-1 (13 pages)."),
    rv("256", "known_before", "Kervaire (1965), Kervaire-Laudenbach. Gerstenhaber-Rothaus (1962) for finite (hence residually finite) groups; Klyachko (1993) torsion-free groups"),
    rv("256", "caveats", "Kervaire itself is formalized in its standard equivalent strengthening; the headline 'Howie's conjecture' is not."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 257
write({
  "id": "257", "discipline": GROUP, "kind": "counterexample",
  "short": "A hyperbolic group that is not CAT(0)",
  "title": {"title": "A hyperbolic group with no geometric CAT(0) action",
            "subtitle": "Claim: a hyperbolic group that acts geometrically on no proper CAT(0) space, in any dimension"},
  "object": {
    "dur": 8.6,
    "primitive": "venn",
    "sets": [{"label": "hyperbolic", "at": 0.3}, {"label": "CAT(0)", "at": 0.8}],
    "regions": [{"set": "A&!B", "at": 5.0, "tone": "accent"}],
    "members": [
      {"x": 0.47, "y": 0.42, "label": "$F_2$", "at": 2.4},
      {"x": 0.69, "y": 0.42, "label": "$\\mathbb{Z}^2$", "at": 2.8},
      {"x": 0.29, "y": 0.42, "label": "new $G$", "tone": "hot", "at": 5.2}],
    "beats": [
      beat(0.2, "Schematic: free, surface and cubulated hyperbolic groups all act on CAT(0) spaces"),
      beat(2.6, "Gromov asked whether every hyperbolic group acts geometrically on one"),
      beat(5.2, "The claim: one does not, and it has a finite 2-dimensional classifying space")]
  },
  "achievement": {
    "form": "status", "label": "Gromov's question: is every hyperbolic group CAT(0)?",
    "statement": ["\\exists\\, G \\text{ hyperbolic with no geometric CAT(0) action}"],
    "context": "Before: CAT(0) known for free, surface, cubulated and low-density random groups",
    "stamp": "counterexample",
    "note": "Consistent with family 252: both point to a non-cubulated world"},
  "verify": {"lean": "main", "detail": "Main theorem in Lean; the witness's 2-dimensionality and metric exclusion are not",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("257", "claim", "There is a finite connected 2-dimensional aspherical simplicial complex K with a linear isoperimetric inequality (so pi_1 K is hyperbolic) such that pi_1 K admits no proper cocompact isometric action on any proper complete CAT(0) space, in any dimension"),
    rv("257", "known_before", "Gromov's question whether every hyperbolic group is CAT(0) (or CAT(-1))"),
    rv("257", "known_before", "Known CAT(0) for many classes (free, surface, cubulated, random groups at low density via Ollivier-Wise)."),
    rv("257", "caveats", "Combined with 252 (a non-residually-finite hyperbolic group) it is consistent"),
    rv("257", "lean", "but the 2-dimensionality of the witness and the locally-CAT(0) metric exclusion are not included per the Lean doc."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 258
write({
  "id": "258", "discipline": GROUP, "kind": "proof",
  "short": "Gersten's conjecture for one-relator groups",
  "title": {"title": "Gersten's conjecture for one-relator groups",
            "subtitle": "Claim: a one-relator group with no Baumslag–Solitar subgroup is hyperbolic"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "\\mathrm{BS}(m,n) = \\langle\\, a, t \\mid \\term{r}{t a^m t^{-1} = a^n} \\,\\rangle", "at": 0.4, "size": 40, "tone": "soft", "y": 0.1,
       "terms": {"r": {"label": "the obstruction pattern", "tone": "bad", "at": 0.8}}},
      {"tex": "G = \\langle X \\mid \\term{o}{r} \\rangle,\\ \\ \\mathrm{BS}(m,n) \\not\\le G \\;\\Rightarrow\\; \\term{h}{G \\text{ hyperbolic}}", "at": 3.0, "size": 40, "tone": "claim", "y": 0.56,
       "terms": {"o": {"label": "one relation", "tone": "soft", "at": 0.6},
                 "h": {"label": "negatively curved", "tone": "claim", "mark": "box", "at": 1.2}}}],
    "beats": [
      beat(0.2, "Baumslag–Solitar groups are the standard obstruction to hyperbolicity"),
      beat(2.8, "Gersten (1992): for one-relator groups they are the only one"),
      beat(5.4, "Claimed, with a companion: such groups are also virtually compact special")]
  },
  "achievement": {
    "form": "status", "label": "Gersten's conjecture (1992)",
    "statement": ["G = \\langle X \\mid r \\rangle,\\ \\mathrm{BS}(m,n) \\not\\le G \\;\\Rightarrow\\; G \\text{ hyperbolic}"],
    "context": "Before: the torsion case (Newman 1968) and negative immersions (Louder–Wilton, Linton)",
    "stamp": "proved",
    "note": "The two papers, 53 and 145 pages, each use the other"},
  "verify": {"lean": "none", "detail": "No Lean; 198 pages in all",
             "ourCheck": OC_NONE},
  "sources": [
    rv("258", "claim", "(a) Every finitely generated one-relator group with no Baumslag-Solitar subgroup BS(m,n) (m,n nonzero) is word-hyperbolic (Gersten's conjecture). (b) Every hyperbolic one-relator group is virtually compact special"),
    rv("258", "known_before", "Gersten (1992). Newman (1968) torsion case. Louder-Wilton (negative immersions), Linton"),
    rv("258", "caveats", "Not formalized; 53 + 145 pages. Each paper uses the other"),
    art("Gersten's conjecture for one-relator groups (family 258)", "198 pages, the two papers cite each other, no Lean."),
    S_HOW]
})

# ---------------------------------------------------------------- 259
write({
  "id": "259", "discipline": GROUP, "kind": "counterexample",
  "short": "A group without fixed price",
  "title": {"title": "A group whose actions have different costs",
            "subtitle": "Claim: a finitely generated group with two free measure-preserving actions of different cost"},
  "object": {
    "dur": 8.6,
    "primitive": "numberline", "min": 0.8, "max": 2.2, "y": 0.62, "ticks": [1, 2],
    "axisLabel": "cost of a free measure-preserving action of $\\Gamma$, schematic",
        "ranges": [{"from": 1.06, "to": 2.2, "label": "Bernoulli shift: $\\ge 1 + \\eta$", "note": "$\\eta$ tiny", "tone": "claim", "at": 2.4,
                "derived": "1 + eta, with eta tiny: schematic position"}],
    "slide": {"from": 2, "to": 1.02, "at": 4.8, "dur": 1.8, "tone": "cool",
              "label": "extensions $Y_M$: $\\le 1 + 99/M$", "note": "$\\to 1$ as $M$ grows",
              "derived": "1 + 99/M from M = 99 to large M: schematic"},
    "beats": [
      beat(0.2, "Cost: the cheapest way to generate an action's orbits. Schematic, not to scale"),
      beat(2.6, "Gaboriau asked whether all free actions of one group have the same cost"),
      beat(5.0, "The claim: one group's Bernoulli shift costs more than its other actions")]
  },
  "achievement": {
    "form": "status", "label": "Gaboriau's fixed price question",
    "statement": ["\\mathrm{Cost}(\\Gamma \\curvearrowright X) \\ge 1 + \\eta,\\quad \\mathrm{Cost}(\\Gamma \\curvearrowright Y_M) \\le 1 + 99/M"],
    "context": "Before: fixed price for free groups, amenable groups and many others (Gaboriau 2000)",
    "stamp": "counterexample",
    "note": "An amalgam built from a rank-100 relation word; $\\eta$ explicit but tiny"},
  "verify": {"lean": "none", "detail": "No Lean; 27 pages",
             "ourCheck": OC_NONE},
  "sources": [
    rv("259", "claim", "There is a finitely generated group Gamma = A *_J (J x <t>) (an amalgam built from a rank-100 relation word) with two essentially free p.m.p. actions of different cost: its Bernoulli action has cost >= 1 + eta for an explicit tiny eta, while finite height extensions have cost <= 1 + 99/M -> 1."),
    rv("259", "known_before", "Gaboriau (2000) fixed price for free groups, amenable groups and many others"),
    rv("259", "caveats", "Not formalized; 27 pages."),
    S_HOW]
})
print('d ok')
