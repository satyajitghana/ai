from common import *

# ---------------------------------------------------------------- 001
write({
  "id": "001", "discipline": NT, "kind": "proof",
  "short": "Milne's rationality conjecture",
  "title": {"title": "Milne's rationality conjecture for abelian varieties",
            "subtitle": "Claim: after good reduction, a Hodge class pairs to one rational number in every cohomology theory"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "heading": "One Hodge class $\\gamma$, paired with divisors $D_1 \\cdots D_{d-r}$ on the reduction",
    "panels": [
      {"primitive": "graph", "until": 4.4, "r": 34, "edgeAt": 0.6, "edgeDur": 2.2,
       "nodes": [
         {"id": "q", "x": 0.5, "y": 0.5, "label": "$q$", "tone": "accent", "fill": "accent"},
         {"id": "a", "x": 0.2, "y": 0.2, "label": "$H_{\\ell_1}$"},
         {"id": "b", "x": 0.8, "y": 0.2, "label": "$H_{\\ell_2}$"},
         {"id": "c", "x": 0.2, "y": 0.82, "label": "$H_{\\ell_3}$"},
         {"id": "d", "x": 0.8, "y": 0.82, "label": "$H_{\\mathrm{crys}}$"}],
       "edges": [["a", "q", {"tone": "accent"}], ["b", "q", {"tone": "accent"}], ["c", "q", {"tone": "accent"}], ["d", "q", {"tone": "accent"}]]},
      {"primitive": "tree", "from": 4.4, "at": 0.3, "legend": False,
       "nodes": [
         {"id": "r", "label": "Cor. 6.4: one cycle", "status": "paper"},
         {"id": "t", "label": "Thm 1.1: pairing", "parent": "r", "status": "paper"},
         {"id": "h", "label": "family 032", "parent": "r", "status": "paper"},
         {"id": "d", "label": "Deligne (1982)", "parent": "t", "status": "prior"}]}
    ],
    "beats": [
      beat(0.2, "Each theory, $\\ell$-adic for $\\ell \\ne p$ or crystalline, computes the pairing on its own"),
      beat(2.8, "The claim: all of them give the same rational number $q$, even when $p = 2$"),
      beat(4.6, "The cycle corollary leans on family 032, unrefereed and without Lean")]
  },
  "achievement": {
    "form": "status", "label": "Conjecture of J. S. Milne (2009 form)",
    "statement": ["\\langle \\gamma, D_1 \\cdots D_{d-r} \\rangle_{\\ell} = \\langle \\gamma, D_1 \\cdots D_{d-r} \\rangle_{\\mathrm{crys}} = q \\in \\mathbb{Q}"],
    "context": "Before: known for CM abelian varieties with simple ordinary reduction, where every divisor lifts",
    "stamp": "proved",
    "note": "Theorem 1.1 stands alone; the cycle corollary needs family 032"},
  "verify": {"lean": "none", "detail": "No Lean for this family; the 36-page paper is the evidence",
             "ourCheck": OC_NONE},
  "sources": [
    rv("001", "known_before", "'Rational Tate classes', Moscow Math J. 2009, Conj. 4.1"),
    rv("001", "known_before", "Known before: CM abelian varieties with simple ordinary reduction and their powers, where every divisor on the reduction lifts (Milne 2009, Ex. 4.2)"),
    rv("001", "known_before", "Deligne's absolute-Hodge theorem (1982)"),
    rv("001", "claim", "for every residue characteristic including p = 2"),
    rv("001", "claim", "uses the release's own Hodge theorem for CM abelian varieties (family 032)"),
    rv("001", "caveats", "Theorem 1.1 itself is independent of other release results, but the headline 'represented by a single rational algebraic cycle' (Corollary 6.4) depends on the release's Hodge-conjecture-for-CM-abelian-varieties manuscript (family 032)"),
    rv("001", "caveats", "36 pages; not refereed."),
    S_HOW]
})

# ---------------------------------------------------------------- 002
write({
  "id": "002", "discipline": NT, "kind": "proof",
  "short": "The full BSD formula in rank $\\le 1$",
  "title": {"title": "The full Birch–Swinnerton-Dyer formula in analytic rank $\\le 1$",
            "subtitle": "Claim: if some $q$-power Selmer group of $E/\\mathbb{Q}$ has corank 0 or 1, the exact BSD formula holds"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "equation", "until": 4.3, "mode": "stack",
       "lines": [
         {"tex": "\\frac{L^{(r)}(E,1)}{r!} = \\frac{\\Omega_E\\, \\mathrm{Reg}_E\\, \\#\\text{Sha} \\prod_{\\ell} c_{\\ell}}{\\#E(\\mathbb{Q})_{\\mathrm{tors}}^{2}}", "at": 0.4, "size": 44},
         {"tex": "r = \\mathrm{rank}\\, E(\\mathbb{Q}) = \\text{Selmer corank} \\in \\{0, 1\\}", "at": 1.8, "size": 32, "tone": "soft"}]},
      {"primitive": "tree", "from": 4.3, "at": 0.3, "legend": False,
       "nodes": [
         {"id": "r", "label": "exact BSD, rank $\\le 1$", "status": "paper"},
         {"id": "s", "label": "Selmer converse", "parent": "r", "status": "paper"},
         {"id": "g", "label": "Gross–Zagier, Kolyvagin", "parent": "r", "status": "prior"},
         {"id": "t", "label": "2-primary BSD", "parent": "r", "status": "paper"},
         {"id": "f", "label": "family 006", "parent": "s", "status": "paper"}]}
    ],
    "beats": [
      beat(0.2, "BSD predicts the leading coefficient of $L(E, s)$ at $s = 1$ exactly, prime by prime"),
      beat(4.5, "The proof is a chain of release manuscripts; none is refereed or in Lean")]
  },
  "achievement": {
    "form": "status", "label": "Birch and Swinnerton-Dyer (1965), in Tate's 1974 form",
    "statement": ["\\mathrm{ord}_{s=1} L(E, s) \\le 1 \\;\\Rightarrow\\; \\text{the full BSD formula holds}"],
    "context": "Before: the rank part (Gross–Zagier, Kolyvagin); the exact formula only for some primes or single curves",
    "stamp": "proved",
    "note": "Nothing is claimed for rank $\\ge 2$"},
  "verify": {"lean": "none", "detail": "Not formalized: three manuscripts totalling about 340 pages",
             "ourCheck": OC_NONE},
  "sources": [
    rv("002", "known_before", "BSD conjecture (Birch and Swinnerton-Dyer 1965; Tate 1974 formulation)"),
    rv("002", "known_before", "Rank part for analytic rank <= 1 known since Gross-Zagier (1986) and Kolyvagin (1988-90)"),
    rv("002", "known_before", "The exact formula's p-parts were known for many primes under hypotheses (e.g. Jetchev-Skinner-Wan 2017 in rank one for p >= 5), and the full formula only for specific curves checked individually."),
    rv("002", "claim", "the full Birch-Swinnerton-Dyer leading-term formula L^(r)(E,1)/r! = Omega_E Reg_E #Sha prod c_l / #E(Q)_tors^2 holds exactly, at every prime"),
    rv("002", "caveats", "Three manuscripts totalling ~340 pages."),
    rv("002", "caveats", "the Selmer-converse paper in turn uses the release's Goldfeld/2-converse manuscript (family 006)"),
    rv("002", "caveats", "'Full BSD' is only the corank-<=1 case; nothing is claimed for rank >= 2."),
    S_HOW]
})

# ---------------------------------------------------------------- 003
write({
  "id": "003", "discipline": NT, "kind": "proof",
  "short": "The quasi-Riemann hypothesis, $\\mathrm{Re}\\, s > 7/8$",
  "title": {"title": "No zeta zeros with real part above $7/8$",
            "subtitle": "Claim: zeta and every Dirichlet $L$-function are zero-free in the half-plane $\\mathrm{Re}\\, s > 7/8$"},
  "object": {
    "dur": 8.6,
    "heading": "Width of the known zero-free region next to the line $\\mathrm{Re}\\, s = 1$",
    "primitive": "plot", "x": [0, 40], "y": [0, 0.2],
    "xlabel": "height, $\\log t$", "ylabel": "zero-free width $1 - \\sigma$",
    "yticks": [{"v": 0.125, "label": "$1/8$"}],
    "curves": [
      {"f": "1/(5.558691*x)", "from": 0.6, "label": "classical", "tone": "old", "at": 0.6, "dur": 1.8},
      {"f": "0.125", "label": "claimed $1/8$", "tone": "claim", "at": 3.2, "dur": 1.4}],
    "regions": [{"f": "0.125", "f2": "1/(5.558691*x)", "from": 1.44, "to": 40, "tone": "claim", "at": 4.8}],
    "beats": [
      beat(0.2, "The best explicit region, $1/(5.558691 \\log t)$ wide, thins to nothing as $t$ grows"),
      beat(3.1, "The claim: no zero with real part above $7/8$, at any height"),
      beat(5.9, "Not the Riemann hypothesis, which asks for $1/2$")]
  },
  "achievement": {
    "form": "bound",
    "before": {"label": "Best explicit zero-free region", "tex": "\\sigma \\ge 1 - \\tfrac{1}{5.558691 \\log t}",
               "note": "Mossinghoff–Trudgian–Yang; its width shrinks to 0"},
    "after": {"label": "Claimed, 30 Sep 2026", "tex": "\\mathrm{Re}\\, s > 7/8",
              "note": "zeta, all Dirichlet $L$, Hecke over $\\mathbb{Q}(\\sqrt{-3})$"},
    "stamp": "proved",
    "note": "The line $\\mathrm{Re}\\, s = 7/8$ itself is not covered; the bar is extraordinary"},
  "verify": {"lean": "main", "detail": "Stated with Mathlib's own riemannZeta; later applications are not formalized",
             "ourCheck": "We read the nine-line Lean target; we did not build it"},
  "sources": [
    art("A fixed gap next to the line Re s = 1", "The best explicit version of the classical region, from Mossinghoff, Trudgian and Yang, says there is no zero with $\\sigma \\ge 1 - 1/(5.558691 \\log t)$"),
    art("A fixed gap next to the line Re s = 1", "Both widths go to zero."),
    art("A fixed gap next to the line Re s = 1", "the claim is a flat line at $1/8$"),
    rv("003", "claim", "There is no zero of the Riemann zeta function, of any Dirichlet L-function (any modulus, any character, uniformly) or of any finite-order Hecke L-function over Q(sqrt(-3)) in the half-plane Re(s) > 7/8"),
    rv("003", "caveats", "Not a proof of RH (1/2). The 7/8 boundary is not included."),
    rv("003", "caveats", "If correct this is among the largest results in analytic number theory in a century, so the bar is extraordinary."),
    rv("003", "lean", "the zeta target is stated with Mathlib's own riemannZeta, so the statement is faithful. Later applications in the papers are not formalized."),
    art("A fixed gap next to the line Re s = 1", "I quoted the whole nine-line file"),
    art("A fixed gap next to the line Re s = 1", "What I cannot tell you is whether it compiles."),
    cat("003", "The-Quasi-Riemann-Hypothesis-September-30-2026/paper.pdf")]
})

# ---------------------------------------------------------------- 004
write({
  "id": "004", "discipline": NT, "kind": "proof",
  "short": "Hilbert's tenth problem over $\\mathbb{Q}$",
  "title": {"title": "Hilbert's tenth problem over the rationals",
            "subtitle": "Claim: no algorithm decides whether an integer polynomial has a rational zero"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 3.9, "at": 0.4, "stagger": 0.18, "ellipsis": True,
       "items": ["$P$", "$2P$", "$3P$", "$4P$", "$5P$", "$6P$", "$7P$", "$8P$"],
       "marks": {"0": "accent"},
       "caption": "points $nP$ on a rank-one elliptic curve, one for each integer $n$"},
      {"primitive": "tree", "from": 3.9, "at": 0.3, "legend": False,
       "nodes": [
         {"id": "r", "label": "undecidable over $\\mathbb{Q}$", "status": "paper"},
         {"id": "m", "label": "Matiyasevich 1970", "parent": "r", "status": "prior"},
         {"id": "a", "label": "2-converse, 2-torsion", "parent": "r", "status": "paper"},
         {"id": "b", "label": "family 010 (F–M at 2)", "parent": "r", "status": "paper"},
         {"id": "c", "label": "family 006", "parent": "r", "status": "paper"}]}
    ],
    "beats": [
      beat(0.2, "No need to define $\\mathbb{Z}$ inside $\\mathbb{Q}$: multiples $nP$ stand in for the integers $n$"),
      beat(4.1, "The proof cites three other unrefereed release manuscripts as theorems")]
  },
  "achievement": {
    "form": "status", "label": "Hilbert's tenth problem over the rationals",
    "statement": ["\\text{no algorithm decides } \\exists\\, x \\in \\mathbb{Q}^n : f(x) = 0"],
    "context": "Before: undecidable over $\\mathbb{Z}$ (Matiyasevich 1970) and every ring of integers (2024–25); $\\mathbb{Q}$ was open",
    "stamp": "proved",
    "note": "Rests on about 300 more pages of unrefereed arithmetic geometry"},
  "verify": {"lean": "none", "detail": "No Lean, and none for the three manuscripts it relies on",
             "ourCheck": OC_NONE},
  "sources": [
    rv("004", "known_before", "Open since the integer case was settled by Matiyasevich (1970, building on Davis-Putnam-Robinson 1961)."),
    art("Hilbert's tenth problem over Q", "settled every ring of integers of a number field in 2024–25"),
    art("Hilbert's tenth problem over Q", "Multiples $nP$ of a point on a rank-one elliptic curve stand in for the integers $n$."),
    rv("004", "caveats", "the pointwise 2-converse for curves with rational 2-torsion (Theorem 1.1, this family), Fontaine-Mazur modularity at 2 (family 010), and the Goldfeld/2-converse paper (family 006)"),
    rv("004", "caveats", "(~300 more pages of unrefereed arithmetic geometry)"),
    rv("004", "caveats", "Not formalized."),
    S_HOW]
})

# ---------------------------------------------------------------- 005
write({
  "id": "005", "discipline": NT, "kind": "proof",
  "short": "Catalan's constant is irrational",
  "title": {"title": "Catalan's constant is irrational",
            "subtitle": "Claim: $G = \\sum_{j \\ge 0} (-1)^j/(2j+1)^2 = L(2, \\chi_{-4})$ is not a fraction"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 3.5, "at": 0.4, "stagger": 0.3, "ellipsis": True,
       "items": ["$+1$", "$-\\tfrac{1}{9}$", "$+\\tfrac{1}{25}$", "$-\\tfrac{1}{49}$"],
       "caption": "$G = 1 - 1/9 + 1/25 - 1/49 + \\cdots$, the odd squares with alternating signs"},
      {"primitive": "equation", "from": 3.5, "mode": "stack",
       "lines": [
         {"tex": "\\det\\big(\\text{size } 48N\\big),\\ \\text{entries in } \\mathbb{Q} + \\mathbb{Q}\\,G + \\mathbb{Q}\\,\\zeta(2)", "at": 0.3, "size": 34},
         {"tex": "\\zeta(2)\\ \\text{cancels in every entry}", "at": 1.5, "size": 34, "tone": "soft"},
         {"tex": "G \\in \\mathbb{Q} \\;\\Rightarrow\\; \\text{lower bound} > \\text{upper bound}", "at": 2.7, "size": 34, "tone": "claim"}]}
    ],
    "beats": [
      beat(0.2, "Catalan's constant $G$: easy to write down, never proved irrational"),
      beat(3.6, "The proof builds determinants of size $48N$ in which the $\\zeta(2)$ part cancels"),
      beat(6.2, "If $G$ were rational, the two bounds on those determinants would cross")]
  },
  "achievement": {
    "form": "status", "label": "Open since the 19th century",
    "statement": ["G = 1 - \\tfrac{1}{9} + \\tfrac{1}{25} - \\tfrac{1}{49} + \\cdots \\notin \\mathbb{Q}"],
    "context": "Before: one of $\\beta(2), \\ldots, \\beta(10)$ is irrational, without knowing which",
    "stamp": "proved",
    "note": "No irrationality measure is claimed"},
  "verify": {"lean": "main", "detail": "The Lean target is the bare irrationality of the explicit series",
             "ourCheck": OC_TARGET},
  "sources": [
    art("Catalan's constant is irrational", "$G = 1 - 1/9 + 1/25 - 1/49 + \\cdots$ is $L(2, \\chi_{-4})$, and nobody knew it was irrational."),
    art("Catalan's constant is irrational", "The 44-page proof builds determinants of size $48N$ whose entries are rational combinations of $1$, $G$ and $\\zeta(2)$"),
    art("Catalan's constant is irrational", "later cut to $\\beta(2)$ through $\\beta(10)$"),
    rv("005", "known_before", "Open since the 19th century."),
    rv("005", "claim", "Catalan's constant G = sum_{j>=0} (-1)^j/(2j+1)^2 = L(2, chi_-4) is irrational."),
    rv("005", "caveats", "No irrationality measure is claimed."),
    rv("005", "caveats", "Lean statement is the bare irrationality of the explicit series, so faithful."),
    S_TARGETS, S_NOBUILD]
})

# ---------------------------------------------------------------- 006
write({
  "id": "006", "discipline": NT, "kind": "proof",
  "short": "Goldfeld's conjecture, mean rank $1/2$",
  "title": {"title": "Goldfeld's conjecture: half the twists have rank 0",
            "subtitle": "Claim: among quadratic twists of any $E/\\mathbb{Q}$, analytic ranks 0 and 1 each have density $1/2$"},
  "object": {
    "dur": 8.6,
    "primitive": "numberline", "min": 0, "max": 2, "y": 0.6,
    "ticks": [0, {"v": 0.5, "label": "$1/2$"}, 1, {"v": 1.5, "label": "$3/2$"}, 2],
    "axisLabel": "average analytic rank of the twists $E^{(d)}$",
    "markers": [
      {"v": 1.5, "label": "Heath-Brown, on GRH", "note": "upper bound, 2004", "at": 3.0, "derived": "3/2"}],
    "slide": {"from": 1.5, "to": 0.5, "at": 5.4, "dur": 1.5, "label": "claimed $1/2$", "note": "exact, no GRH", "derived": "3/2 to 1/2"},
    "beats": [
      beat(0.2, "Twist a curve $E$ by $d$: Goldfeld (1979) predicted average analytic rank exactly $1/2$"),
      beat(2.9, "Before: only upper bounds, and only assuming GRH"),
      beat(5.4, "The claim: rank 0 for half the twists, rank 1 for the other half")]
  },
  "achievement": {
    "form": "status", "label": "Goldfeld's conjecture (1979)",
    "statement": ["\\Pr\\big[r_{\\mathrm{an}}(E^{(d)}) = 0\\big] = \\Pr\\big[r_{\\mathrm{an}}(E^{(d)}) = 1\\big] = \\tfrac{1}{2}"],
    "context": "Before: Smith (2022) gave Selmer coranks 0 and 1 half the time each; the analytic side was missing",
    "stamp": "proved",
    "note": "Twists by signed squarefree $d$ ordered by $|d|$, not fundamental discriminants"},
  "verify": {"lean": "none", "detail": "Not formalized; about 171 pages, and the BSD and H10 claims build on it",
             "ourCheck": OC_NONE},
  "sources": [
    rv("006", "known_before", "Goldfeld (1979) conjectured mean rank 1/2 in quadratic twist families."),
    rv("006", "known_before", "Under GRH: Heath-Brown (2004) upper bound 3/2"),
    rv("006", "known_before", "Smith (arXiv:2207.05674, 2022) proved the 2-infinity Selmer corank is 0 or 1 with density 1/2 each for every E/Q"),
    rv("006", "claim", "analytic rank 0 and analytic rank 1 each have density 1/2"),
    rv("006", "caveats", "Counts signed squarefree d ordered by |d|, slightly different from Goldfeld's fundamental discriminants"),
    rv("006", "caveats", "Not formalized; ~171 pages; feeds the BSD and H10 families"),
    S_HOW]
})

# ---------------------------------------------------------------- 007
def liouville(n):
    c, m, p = 0, n, 2
    while p * p <= m:
        while m % p == 0:
            m //= p; c += 1
        p += 1
    if m > 1: c += 1
    return -1 if c % 2 else 1

lam = [liouville(n) for n in range(1, 25)]
write({
  "id": "007", "discipline": NT, "kind": "proof",
  "short": "Two-point Chowla, plain averages",
  "title": {"title": "Two-point Chowla with ordinary averages",
            "subtitle": "Claim: $\\sum_{n \\le X} \\lambda(n)\\lambda(n+h) = O\\big(X/(\\log X)^c\\big)$, with no logarithmic weights"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 4.0, "at": 0.3, "stagger": 0.06, "perRow": 12,
       "items": ["$+1$" if v > 0 else "$-1$" for v in lam],
       "marks": {str(i): "cool" for i, v in enumerate(lam) if v < 0},
       "index": "$n = #$", "index0": 1,
       "caption": "$\\lambda(n) = (-1)^{\\Omega(n)}$, the parity of the number of prime factors of $n$"},
      {"primitive": "equation", "from": 4.0, "mode": "stack",
       "lines": [
         {"tex": "\\frac{1}{X}\\sum_{n \\le X} \\lambda(n)\\,\\lambda(n+h) \\to 0", "at": 0.3, "size": 40},
         {"tex": "\\Big|\\sum_{n \\le X} \\lambda(a_1 n + b_1)\\,\\lambda(a_2 n + b_2)\\Big| \\le \\frac{C X}{(\\log X)^{c}}", "at": 1.6, "size": 36, "tone": "claim"}]}
    ],
    "beats": [
      beat(0.2, "$\\lambda(n)$ is $+1$ or $-1$ by the parity of the prime factors of $n$"),
      beat(4.1, "Chowla: the sign of $n$ says nothing about the sign of $n + h$"),
      beat(6.6, "Tao (2016) had it with logarithmic averages; the claim uses plain ones")]
  },
  "achievement": {
    "form": "status", "label": "Chowla's conjecture (1965), two-point case",
    "statement": ["\\textstyle\\sum_{n \\le X} \\lambda(n)\\lambda(n+h) = O\\big(X/(\\log X)^{c}\\big)"],
    "context": "Before: only the logarithmically averaged version (Tao 2016)",
    "stamp": "proved",
    "note": "Two-point only; $k$-point Chowla stays open. Constants ineffective"},
  "verify": {"lean": "main", "detail": "In Lean: the log-power saving and the binary corrected Elliott statements",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("007", "known_before", "Chowla (1965) conjecture"),
    rv("007", "known_before", "Tao (Forum Math Pi 2016) proved the logarithmically averaged two-point case"),
    rv("007", "claim", "sum_{n<=X} lambda(a1 n+b1) lambda(a2 n+b2) = O(X/(log X)^c) with an absolute c > 0 (ordinary, not logarithmic, averaging)"),
    rv("007", "caveats", "Two-point only (k-point Chowla still open). Constants ineffective"),
    rv("007", "lean", "main theorem formalized (OrdinaryTwoPointCorrelations: liouville_log_saving, binary and affine corrected Elliott; OrdinaryElliott)"),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 008
weights = list(range(3, 34, 2))
write({
  "id": "008", "discipline": NT, "kind": "proof",
  "short": "The Deligne–Drinfeld conjecture",
  "title": {"title": "The Deligne–Drinfeld conjecture",
            "subtitle": "Claim: $\\mathfrak{grt}_1$ is free on one generator in each odd weight $3, 5, 7, \\ldots$, with nothing extra"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 5.4, "at": 0.4, "stagger": 0.12, "perRow": 8,
       "items": [f"$\\sigma_{{{w}}}$" for w in weights],
       "marks": {**{str(i): {"tone": "cool", "at": 2.8} for i, w in enumerate(weights) if w <= 29},
                 **{str(i): {"tone": "claim", "at": 4.0} for i, w in enumerate(weights) if w > 29}},
       "caption": "one free generator $\\sigma_w$ per odd weight $w$: checked by computer through weight 29"},
      {"primitive": "equation", "from": 5.4, "mode": "stack",
       "lines": [{"tex": "\\mathfrak{grt}_1 \\;\\cong\\; \\mathrm{Lie}(\\sigma_3, \\sigma_5, \\sigma_7, \\ldots)", "at": 0.3, "size": 52, "tone": "claim"}]}
    ],
    "beats": [
      beat(0.2, "$\\mathfrak{grt}_1$ encodes the symmetries of braided associativity"),
      beat(2.8, "Brown (2012) gave the generators; computation matched through weight 29"),
      beat(5.5, "The claim: an all-weight dimension bound, so there are no extra solutions")]
  },
  "achievement": {
    "form": "status", "label": "Deligne–Drinfeld conjecture (Drinfeld 1990)",
    "statement": ["\\mathfrak{grt}_1 \\cong \\mathrm{Lie}(\\sigma_3, \\sigma_5, \\sigma_7, \\ldots)"],
    "context": "Before: a free subalgebra (Brown 2012) and freeness results (Willwacher); no extra solutions was open",
    "stamp": "proved"},
  "verify": {"lean": "main", "detail": "In Lean: the main isomorphism. The graph-complex consequences are outside it",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("008", "known_before", "Conjectured by Deligne and Drinfeld (Drinfeld 1990)."),
    rv("008", "known_before", "Brown (Annals 2012, mixed Tate motives over Z) gives a free Lie subalgebra"),
    rv("008", "known_before", "Naef-Willwacher computations confirm equality through weight 29. Surjectivity (no extra solutions) was open."),
    rv("008", "claim", "is the free Lie algebra on one generator in each odd weight 3, 5, 7, ...: there are no extra relations and no extra solutions"),
    rv("008", "lean", "main theorem formalized (DeligneDrinfeld.main); regularized-transport proposition and graph-complex consequences not included."),
    art("Deligne–Drinfeld (family 008)", "computations confirmed equality through weight 29"),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 009
write({
  "id": "009", "discipline": NT, "kind": "proof",
  "short": "Function fields from Milnor K-theory",
  "title": {"title": "Rebuilding a function field from its Milnor K-theory",
            "subtitle": "Claim: a function field of dimension $\\ge 2$ is recovered from its mod-$\\ell$ Milnor K-groups $K_1$, $K_2$"},
  "object": {
    "dur": 8.4,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "\\term{f}{\\mathrm{Isom}(K, L)} \\longrightarrow \\term{d}{\\mathrm{Isom}\\big(K^M_{1,2}(K)/\\ell,\\; K^M_{1,2}(L)/\\ell\\big)}", "at": 0.4, "size": 38, "y": 0.14,
       "terms": {"f": {"label": "field maps", "tone": "cool", "at": 0.8},
                 "d": {"label": "maps of the degree 1 and 2 data", "tone": "accent", "at": 1.4}}},
      {"tex": "\\text{injective}", "at": 3.0, "size": 36, "tone": "ok", "note": "uniqueness: in Lean", "y": 0.54},
      {"tex": "\\text{surjective}", "at": 5.2, "size": 36, "tone": "claim", "note": "reconstruction: paper only", "y": 0.74}],
    "beats": [
      beat(0.2, "Recover a field $K$ over an algebraically closed field from mod-$\\ell$ data in degrees 1 and 2"),
      beat(2.9, "That the data pin down at most one field map is formalized"),
      beat(5.2, "That every compatible map of the data comes from a field map is not")]
  },
  "achievement": {
    "form": "status", "label": "Bogomolov's program (1991)",
    "statement": ["\\mathrm{Isom}^{i}_{F}(K, L) \\;\\xrightarrow{\\;\\sim\\;}\\; \\mathrm{Isom}^{M}(V_K, V_L)/\\Lambda^{\\times}"],
    "context": "Before: known over algebraic closures of finite fields (Bogomolov–Tschinkel, Pop); open over e.g. $\\mathbb{C}$",
    "stamp": "proved",
    "note": "Up to perfect closure and Frobenius twists; transcendence degree $\\ge 2$"},
  "verify": {"lean": "part", "detail": "In Lean: injectivity only. The reconstruction itself is not formalized",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("009", "known_before", "Bogomolov's program (1991)."),
    rv("009", "known_before", "Bogomolov-Tschinkel proved reconstruction for function fields over algebraic closures of finite fields"),
    rv("009", "known_before", "Over general algebraically closed constants (e.g. C) the full conjecture was open."),
    rv("009", "claim", "A function field K of transcendence degree >= 2 over an algebraically closed field (characteristic != l) is recovered, up to perfect closure and Frobenius twists, from K_1^M/l, K_2^M/l and the Milnor product alone"),
    rv("009", "key_theorem", "Isom^i_F(K,L) -> Isom^M(V_K,V_L)/Lambda^x is bijective"),
    rv("009", "caveats", "The Lean covers the easy direction (injectivity). The headline Milnor K reconstruction (existence/surjectivity) is not formalized."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 010
write({
  "id": "010", "discipline": NT, "kind": "proof",
  "short": "Fontaine–Mazur at the prime 2",
  "title": {"title": "Fontaine–Mazur at the prime 2, with no residual hypothesis",
            "subtitle": "Claim: every odd, de Rham, 2-dimensional 2-adic Galois representation of $\\mathbb{Q}$ is modular"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "p \\text{ odd}", "at": 0.4, "size": 34, "tone": "mute", "note": "essentially done: Kisin, Emerton, Pan", "y": 0.1},
      {"tex": "p = 2,\\ \\term{r}{\\bar r} \\text{ (non)solvable}", "at": 2.0, "size": 34, "tone": "soft", "note": "Allen 2016, Tung 2021", "y": 0.32,
       "terms": {"r": {"label": "the residual image", "tone": "cool", "at": 0.8}}},
      {"tex": "p = 2,\\ \\term{s}{\\bar r \\text{ scalar or reducible}}", "at": 3.8, "size": 34, "tone": "claim", "note": "claimed, new", "y": 0.62,
       "terms": {"s": {"label": "the cases left open", "tone": "claim", "mark": "box", "at": 0.9}}}],
    "beats": [
      beat(0.2, "Fontaine–Mazur: a geometric 2-dimensional Galois representation comes from a modular form"),
      beat(3.6, "At $p = 2$, scalar and reducible residual images $\\bar r$ were the open cases"),
      beat(6.2, "It is also the modularity input to the Hilbert's tenth claim, family 004")]
  },
  "achievement": {
    "form": "status", "label": "Fontaine–Mazur conjecture (1995), odd regular case over Q",
    "statement": ["r: G_{\\mathbb{Q}} \\to \\mathrm{GL}_2(\\overline{\\mathbb{Q}}_2) \\text{ odd, de Rham} \\Rightarrow r \\text{ modular}"],
    "context": "Before at $p = 2$: solvable (Allen 2016) and nonsolvable (Tung 2021) residual images only",
    "stamp": "proved",
    "note": "With distinct Hodge–Tate weights: a Tate twist of a classical eigenform"},
  "verify": {"lean": "none", "detail": "No Lean; 113 pages over three papers, and family 004 inherits the risk",
             "ourCheck": OC_NONE},
  "sources": [
    rv("010", "known_before", "Fontaine-Mazur (1995)."),
    rv("010", "known_before", "At p = 2: Allen (2016) solvable residual image nearly ordinary; Tung (2021) nonsolvable residual image. Globally scalar or reducible residual image at 2 remained open."),
    rv("010", "known_before", "At odd p: Kisin (2009) and Emerton (2011) under residual hypotheses"),
    art("The elliptic-curve stack", "At odd primes this was essentially done (Kisin, Emerton, Pan, and a last case at 3)"),
    rv("010", "claim", "if moreover r is de Rham at 2 with distinct Hodge-Tate weights it is a Tate twist of the 2-adic representation of a classical cuspidal eigenform"),
    rv("010", "caveats", "Not formalized; 113 pages over three papers. The Fontaine-Mazur paper says it supplies the weight-two modularity input for the Hilbert-tenth-over-Q proof (family 004), so H10 inherits its risk."),
    S_HOW]
})
print('a ok')
