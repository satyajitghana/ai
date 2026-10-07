from common import *

# ---------------------------------------------------------------- 011
write({
  "id": "011", "discipline": NT, "kind": "proof",
  "short": "The prime factors of $p - 1$",
  "title": {"title": "The prime factors of $p - 1$ behave like a random integer's",
            "subtitle": "Claim: for every $\\delta > 0$, $x^{1-o(1)}$ primes in $(2x, 5x]$ have $p - 1$ free of primes above $x^{\\delta}$"},
  "object": {
    "dur": 8.6,
    "primitive": "numberline", "min": 0, "max": 0.36, "y": 0.62,
    "ticks": [0, 0.1, 0.2, 0.3],
    "axisLabel": "$\\delta$: every prime factor of $p - 1$ is at most $x^{\\delta}$",
    "markers": [
      {"v": 0.2961, "label": "Baker–Harman", "note": "$x^{0.2961}$", "at": 2.6, "side": "below"},
      {"v": 0.2844, "label": "Lichtman 2022", "note": "$x^{0.2844}$", "at": 3.1}],
    "slide": {"from": 0.2844, "to": 0, "at": 5.3, "dur": 1.6, "label": "claimed: every $\\delta > 0$", "note": "$x^{1-o(1)}$ such primes"},
    "beats": [
      beat(0.2, "How small can every prime factor of $p - 1$ be, for many primes $p$ up to $x$?"),
      beat(2.8, "Before: down to $x^{0.2844}$ (Lichtman 2022), with $x/(\\log x)^C$ such primes"),
      beat(5.4, "The claim: any power $x^{\\delta}$, and $p - 1$ factors like a random integer")]
  },
  "achievement": {
    "form": "bound",
    "before": {"label": "Best known, Lichtman 2022", "tex": "P^+(p-1) \\le x^{0.2844}", "note": "smooth shifted primes"},
    "after": {"label": "Claimed, 24 Sep 2026", "tex": "P^+(p-1) \\le x^{\\delta}", "note": "every $\\delta > 0$; $x^{1-o(1)}$ primes in $(2x, 5x]$"},
    "stamp": "proved",
    "note": "Also: the factors of $p - 1$ follow the Poisson–Dirichlet law"},
  "verify": {"lean": "none", "detail": "Not formalized; about 187 pages over three papers",
             "ourCheck": OC_NONE},
  "sources": [
    rv("011", "known_before", "Best prior smooth shifted primes: Baker-Harman (x^0.2961), Lichtman (2022, x^0.2844) with x/(log x)^C lower bounds."),
    rv("011", "claim", "(c) For every delta > 0 there are x^{1-o(1)} primes in (2x, 5x] whose predecessor is x^delta-smooth."),
    rv("011", "claim", "converge in all finite joint distributions to Poisson-Dirichlet PD(1), the same law as for a random integer"),
    rv("011", "caveats", "Not formalized; ~187 pages over three papers."),
    cat("011", "Weighted-Dilation-Graphs-Smooth-Shifted-Primes-and-Totient-Fibers-September-24-2026/paper.pdf"),
    S_HOW]
})

# ---------------------------------------------------------------- 012
write({
  "id": "012", "discipline": NT, "kind": "proof",
  "short": "Largest prime factors of $n$ and $n + 1$",
  "title": {"title": "The largest prime factors of $n$ and $n + 1$ are independent",
            "subtitle": "Claim: $P^+(n) < P^+(n+1)$ for exactly half of all $n$, in natural density"},
  "object": {
    "dur": 8.6,
    "primitive": "numberline", "min": 0, "max": 0.6, "y": 0.62,
    "ticks": [0, 0.1, 0.2, 0.3, 0.4, {"v": 0.5, "label": "$1/2$"}],
    "axisLabel": "proven lower density of $n$ with $P^+(n) < P^+(n+1)$",
    "markers": [
      {"v": 0.0099, "label": "1978", "note": "first bound", "at": 2.4},
      {"v": 0.2017, "label": "Lu–Wang", "at": 2.9},
      {"v": 0.280, "label": "Yang", "note": "preprint", "at": 3.4}],
    "slide": {"from": 0.280, "to": 0.5, "at": 5.4, "dur": 1.5, "label": "claimed $1/2$", "note": "natural density", "derived": "1/2"},
    "beats": [
      beat(0.2, "How often is the largest prime factor of $n$ smaller than that of $n + 1$?"),
      beat(2.6, "Proven lower densities crept up from 0.0099 (1978) to 0.280"),
      beat(5.4, "The claim: exactly half the time, because the two are independent")]
  },
  "achievement": {
    "form": "bound",
    "before": {"label": "Best known (Yang, preprint)", "tex": "\\ge 0.280", "note": "lower density of $P^+(n) < P^+(n+1)$"},
    "after": {"label": "Claimed, 24 Sep 2026", "tex": "= 1/2", "note": "joint law $\\rho(1/a)\\,\\rho(1/b)$"},
    "stamp": "proved",
    "note": "Teräväinen (2018) had the joint law only in logarithmic density"},
  "verify": {"lean": "main", "detail": "In Lean: the joint law and both ordering densities, in natural density",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("012", "known_before", "Erdos-Pomerance (1978) posed the independence and proved positive lower density 0.0099 for the ordering; improved to 0.05544 (de la Breteche-Pomerance-Tenenbaum), 0.1063/0.1356 (Wang), 0.2017 (Lu-Wang), 0.280 (Yang preprint)."),
    rv("012", "known_before", "Teravainen (2018) proved the joint law in logarithmic density"),
    rv("012", "claim", "the natural density of n with P+(n) <= n^a and P+(n+1) <= n^b is rho(1/a)rho(1/b)"),
    rv("012", "claim", "Corollary: P+(n) < P+(n+1) has natural density 1/2"),
    rv("012", "lean", "main theorem formalized (JointDickman: joint law and both ordering densities)."),
    cat("012", "The-joint-Dickman-law-for-consecutive-integers-September-24-2026/paper.pdf"),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 013
primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53]
write({
  "id": "013", "discipline": NT, "kind": "proof",
  "short": "Ostmann's inverse Goldbach problem",
  "title": {"title": "The primes are not a sumset",
            "subtitle": "Claim: no finite modification of the primes equals $A + B$ with $|A|, |B| \\ge 2$"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 4.6, "at": 0.3, "stagger": 0.1, "perRow": 8, "ellipsis": True,
       "items": [str(p) for p in primes],
       "caption": "the primes $\\mathcal{P}$: is some finite change of them a sumset $A + B$?"},
      {"primitive": "equation", "from": 4.6, "mode": "stack",
       "lines": [
         {"tex": "A + B = \\{\\, a + b : a \\in A,\\ b \\in B \\,\\}", "at": 0.3, "size": 38, "tone": "soft"},
         {"tex": "|A|, |B| \\ge 2 \\;\\Rightarrow\\; (A + B) \\,\\triangle\\, \\mathcal{P} \\text{ is infinite}", "at": 1.4, "size": 40, "tone": "claim"}]}
    ],
    "beats": [
      beat(0.2, "Ostmann (1956): are the primes, up to finitely many changes, a sumset $A + B$?"),
      beat(2.9, "Sieves forced any such $A$ and $B$ to have about $\\sqrt{x}$ elements below $x$"),
      beat(5.6, "The claim: no such pair exists")]
  },
  "achievement": {
    "form": "status", "label": "Ostmann's inverse Goldbach problem (1956)",
    "statement": ["|A|, |B| \\ge 2 \\;\\Rightarrow\\; (A + B) \\,\\triangle\\, \\mathcal{P} \\text{ is infinite}"],
    "context": "Before: Green–Harper (2014) showed an inverse large sieve conjecture would suffice",
    "stamp": "proved"},
  "verify": {"lean": "main", "detail": "The Lean statement is the full conjecture",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("013", "known_before", "Ostmann (1956)."),
    rv("013", "known_before", "Green-Harper (2014) showed an inverse large sieve conjecture would imply it"),
    art("Ostmann's inverse Goldbach problem (family 013)", "Sieve methods forced any such $A$ and $B$ to have about $\\sqrt x$ elements below $x$"),
    rv("013", "claim", "If A, B are sets of nonnegative integers each with at least two elements, then A+B differs from the set of primes in infinitely many elements"),
    rv("013", "caveats", "Lean statement is the full conjecture."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 014
write({
  "id": "014", "discipline": NT, "kind": "proof",
  "short": "Restricted geometric Langlands in char $p$",
  "title": {"title": "Restricted geometric Langlands in characteristic $p$",
            "subtitle": "Claim: the restricted geometric Langlands equivalence for curves in characteristic $p$, and its consequences"},
  "object": {
    "dur": 8.6,
    "heading": "Eight papers, one equivalence and what follows from it",
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "\\term{s}{\\mathrm{Shv}_{\\mathrm{Nilp}}(\\mathrm{Bun}_G)} \\;\\simeq\\; \\term{l}{\\mathrm{IndCoh}_{\\mathrm{Nilp}}(\\mathrm{LocSys}^{\\mathrm{restr}}_{\\check G})}", "at": 0.4, "size": 36, "tone": "claim", "y": 0.1,
       "terms": {"s": {"label": "sheaves on $G$-bundles", "tone": "cool", "at": 0.8},
                 "l": {"label": "restricted local systems, dual group", "tone": "claim", "at": 1.3}}},
      {"tex": "\\text{Ramanujan–Arthur decompositions}", "at": 3.4, "size": 30, "note": "function fields", "y": 0.6},
      {"tex": "\\text{generic temperedness, exceptional } G", "at": 4.4, "size": 30, "note": "every place", "y": 0.74},
      {"tex": "\\text{global Arthur enhancements}", "at": 5.4, "size": 30, "tone": "warn", "note": "conditional", "y": 0.88}],
    "beats": [
      beat(0.2, "The equivalence was proved over $\\mathbb{C}$ in 2024; this is the positive-characteristic version"),
      beat(3.2, "From it: Ramanujan-type statements for cusp forms over function fields"),
      beat(5.8, "One of the eight papers is explicitly conditional")]
  },
  "achievement": {
    "form": "status", "label": "Full-support conjecture of Gaitsgory and Raskin",
    "statement": ["\\overline{\\mathbb{Q}}_{\\ell}\\text{-linear restricted geometric Langlands in char } p"],
    "context": "Before: geometric Langlands over $\\mathbb{C}$ (Gaitsgory, Raskin and collaborators, 2024)",
    "stamp": "proved",
    "note": "Only under the stated conditions on $p$"},
  "verify": {"lean": "none", "detail": "No Lean; 348 pages over eight papers",
             "ourCheck": OC_NONE},
  "sources": [
    rv("014", "claim", "Eight papers."),
    rv("014", "claim", "(Gaitsgory-Raskin full-support conjecture in these regimes)"),
    rv("014", "claim", "Global Arthur enhancements of cuspidal excursion parameters, CONDITIONAL on the finite-level Ramanujan-Arthur decomposition"),
    rv("014", "known_before", "Geometric Langlands over C proved by Gaitsgory, Raskin and collaborators (2024, arXiv:2405.03599 and sequels)."),
    rv("014", "caveats", "Not formalized; 348 pages over eight papers"),
    rv("014", "caveats", "Characteristic hypotheses on p are essential and stated."),
    S_HOW]
})

# ---------------------------------------------------------------- 015
degs = list(range(2, 14))
def mk15(d):
    if d in (2, 3): return {"tone": "mute", "at": 2.6}
    if d in (5, 7, 11, 13): return {"tone": "claim", "at": 5.0}
    if d in (4, 6): return {"tone": "cool", "at": 5.6}
    return None
write({
  "id": "015", "discipline": NT, "kind": "proof",
  "short": "Torus packets in higher degree",
  "title": {"title": "Duke's theorem in prime, quartic and sextic degree",
            "subtitle": "Claim: torus-orbit packets from totally real fields equidistribute, with no escape of mass"},
  "object": {
    "dur": 8.6,
    "primitive": "sequence", "at": 0.3, "stagger": 0.1, "perRow": 12,
    "items": [str(d) for d in degs],
    "marks": {str(i): mk15(d) for i, d in enumerate(degs) if mk15(d)},
    "caption": "degree $n$ of the field: known for $2, 3$; claimed for primes $\\ge 5$ and primitive $4, 6$",
    "beats": [
      beat(0.2, "Periodic torus orbits in the space of lattices, one packet per totally real field"),
      beat(2.6, "Duke (1988) did degree 2; Einsiedler, Lindenstrauss, Michel and Venkatesh degree 3"),
      beat(5.0, "Claimed: every prime degree $\\ge 5$, plus primitive quartic and sextic fields")]
  },
  "achievement": {
    "form": "status", "label": "Higher-degree analogues of Duke's theorem",
    "statement": ["\\text{packet measures} \\;\\to\\; \\text{Haar measure},\\ \\text{no escape of mass}"],
    "context": "Before: degree 2 (Duke 1988) and cubic fields (Einsiedler–Lindenstrauss–Michel–Venkatesh 2011)",
    "stamp": "proved",
    "note": "Degrees 4 and 6 need primitive fields; measure rigidity is a black box"},
  "verify": {"lean": "part", "detail": "In Lean: the prime-degree theorem. The quartic and sextic results are not formalized",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("015", "known_before", "Duke (1988) for degree 2 (CM points and closed geodesics). Einsiedler-Lindenstrauss-Michel-Venkatesh (Annals 2011) proved the cubic-field analogue"),
    rv("015", "claim", "in every fixed prime degree >= 5 with arbitrary local homothety types; for arbitrary orders in primitive quartic fields; for maximal orders in primitive sextic fields"),
    rv("015", "claim", "equidistribute to Haar measure without escape of mass"),
    rv("015", "caveats", "Primitive (no intermediate field) restriction in degrees 4 and 6 matters"),
    rv("015", "caveats", "Measure rigidity (Einsiedler-Katok-Lindenstrauss) is a black-box input."),
    rv("015", "lean", "partial formalization: the prime-degree (>= 5) theorem is formalized (DukePrimeDegree, unconditional); quartic and sextic results are not."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 016
write({
  "id": "016", "discipline": NT, "kind": "proof",
  "short": "Zilber–Pink: abelian varieties, $\\mathcal{A}_2$",
  "title": {"title": "Zilber–Pink for abelian varieties and curves in $\\mathcal{A}_2$",
            "subtitle": "Claim: unlikely intersections are finite, for subvarieties of abelian varieties and curves in $\\mathcal{A}_2$"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "equation", "until": 4.0, "mode": "stack",
       "lines": [
         {"tex": "X \\subseteq A \\text{ abelian, over } \\overline{\\mathbb{Q}}", "at": 0.4, "size": 36, "tone": "soft"},
         {"tex": "\\#\\{\\text{maximal atypical } Y \\subseteq X\\} < \\infty", "at": 1.4, "size": 42, "tone": "claim"}]},
      {"primitive": "tree", "from": 4.0, "at": 0.3, "legend": False,
       "nodes": [
         {"id": "r", "label": "curves in $\\mathcal{A}_2$, Hodge-generic", "status": "paper"},
         {"id": "a", "label": "$E \\times$ CM points", "parent": "r", "status": "paper"},
         {"id": "b", "label": "quaternionic points", "parent": "r", "status": "paper"},
         {"id": "c", "label": "$E^2$ points", "parent": "r", "status": "paper"}]}
    ],
    "beats": [
      beat(0.2, "A subvariety should meet special subvarieties in too-small codimension only finitely often"),
      beat(4.1, "The curve case in $\\mathcal{A}_2$ comes in three components, one paper each"),
      beat(6.6, "Over $\\overline{\\mathbb{Q}}$ only, and nothing is effective")]
  },
  "achievement": {
    "form": "status", "label": "Zilber–Pink conjecture (Zilber 2002, Pink 2005)",
    "statement": ["\\#\\{\\text{maximal atypical } Y \\subseteq X\\} < \\infty"],
    "context": "Before: curves in abelian varieties (Habegger–Pila 2016); $\\mathcal{A}_2$ curves under boundary hypotheses",
    "stamp": "proved",
    "note": "Over $\\overline{\\mathbb{Q}}$, not $\\mathbb{C}$; the abelian theorem is non-effective"},
  "verify": {"lean": "none", "detail": "No Lean; about 170 pages over four papers",
             "ourCheck": OC_NONE},
  "sources": [
    rv("016", "known_before", "Zilber (2002), Pink (2005)"),
    rv("016", "known_before", "Habegger-Pila (2016) proved it for curves in abelian varieties"),
    rv("016", "known_before", "Daw-Orr (2016-2022) proved quaternionic and E^2 cases under hypotheses (e.g. curves intersecting the boundary)"),
    rv("016", "claim", "in three components: E x CM points, quaternionic division points, and E^2 (non-CM) points"),
    rv("016", "caveats", "Not formalized; ~170 pages over four papers. Over Q-bar only (not C). The abelian theorem is non-effective."),
    S_HOW]
})

# ---------------------------------------------------------------- 017
write({
  "id": "017", "discipline": NT, "kind": "proof",
  "short": "The irrationality exponent of $\\pi$ is 2",
  "title": {"title": "The irrationality exponent of $\\pi$ is 2",
            "subtitle": "Claim: for every $\\nu > 2$, $|\\pi - p/q| \\ge q^{-\\nu}$ once $q$ is large enough"},
  "object": {
    "dur": 8.6,
    "primitive": "numberline", "min": 0, "max": 45, "y": 0.6,
    "ticks": [0, 10, 20, 30, 40],
    "axisLabel": "proven upper bound on $\\mu(\\pi)$",
    "markers": [
      {"v": 42, "label": "Mahler", "note": "1953", "at": 2.3},
      {"v": 20, "label": "Mignotte", "note": "1974", "at": 2.8}],
    "ranges": [{"from": 7.103205334137, "to": 8.0161, "label": "1993 to 2020", "note": "Hata to Zeilberger–Zudilin", "at": 3.4, "side": "below"}],
    "slide": {"from": 7.103205334137, "to": 2, "at": 5.4, "dur": 1.5, "label": "claimed 2", "note": "24 Sep 2026"},
    "beats": [
      beat(0.2, "How well do fractions $p/q$ approximate $\\pi$? The exponent $\\mu(\\pi)$ measures it"),
      beat(2.5, "Upper bounds fell from 42 (Mahler 1953) to 7.103205334137 (2020)"),
      beat(5.4, "The claim jumps straight to 2, the least any irrational can have")]
  },
  "achievement": {
    "form": "bound",
    "before": {"label": "Best known, 2020", "tex": "\\mu(\\pi) \\le 7.1032", "note": "Zeilberger–Zudilin: 7.103205334137"},
    "after": {"label": "Claimed, 24 Sep 2026", "tex": "\\mu(\\pi) = 2", "note": "a Roth-style argument, not a better integral"},
    "stamp": "proved",
    "note": "The threshold $Q(\\nu)$ is ineffective, as in Roth's theorem"},
  "verify": {"lean": "main", "detail": "Stated with Mathlib's Real.pi; the Flint–Hills corollary is not in Lean",
             "ourCheck": OC_TARGET},
  "sources": [
    rv("017", "known_before", "Upper bounds: Mahler 1953 (42), Mignotte 1974 (20), Chudnovsky, Hata 1993 (8.0161), Salikhov 2008 (7.6063), Zeilberger-Zudilin 2020 (7.103205334137, arXiv:1912.06345)"),
    rv("017", "claim", "For every nu > 2 there is Q(nu) such that |pi - p/q| >= q^{-nu} for all integers p and all q >= Q(nu); hence the irrationality exponent mu(pi) = 2 (the threshold is ineffective)."),
    rv("017", "caveats", "The 23-page proof is not a better Hata/Salikhov integral: it is a Roth-style interpolation-determinant argument"),
    art("The irrationality exponent of π is 2 (family 017)", "The threshold $Q(\\nu)$ is ineffective, as in Roth's theorem."),
    art("The irrationality exponent of π is 2 (family 017)", "Every irrational $x$ has infinitely many $p/q$ with $|x - p/q| < 1/q^2$"),
    rv("017", "lean", "stated with Mathlib's Real.pi). The Flint-Hills corollary is not formalized."),
    cat("017", "The-irrationality-exponent-of-pi-is-2-September-24-2026/paper.pdf"),
    S_TARGETS, S_NOBUILD]
})

# ---------------------------------------------------------------- 018
write({
  "id": "018", "discipline": NT, "kind": "proof",
  "short": "Margulis–Platonov over global fields",
  "title": {"title": "The Margulis–Platonov conjecture over every global field",
            "subtitle": "Claim: normal subgroups of $G(k)$ come only from the places where $G$ is anisotropic"},
  "object": {
    "dur": 8.6,
    "heading": "The conjecture, case by case",
    "primitive": "tree", "at": 0.4, "legend": False,
    "nodes": [
      {"id": "r", "label": "every global field $k$", "status": "paper"},
      {"id": "a", "label": "isotropic groups", "parent": "r", "status": "prior"},
      {"id": "b", "label": "inner type $A$", "parent": "r", "status": "prior"},
      {"id": "c", "label": "outer $A$, triality $D_4$, $E_6$", "parent": "r", "status": "paper"},
      {"id": "d", "label": "function fields", "parent": "r", "status": "paper"}],
    "beats": [
      beat(0.2, "Normal subgroups of $G(k)$ should come only from places where $G$ is compact"),
      beat(2.8, "Isotropic groups and inner type $A$ were known (grey)"),
      beat(5.4, "Claimed (dashed): the last anisotropic types and all function fields, char 2 included")]
  },
  "achievement": {
    "form": "status", "label": "Margulis–Platonov conjecture (1970s–80s)",
    "statement": ["N \\trianglelefteq G(k)\\ \\text{noncentral} \\;\\Rightarrow\\; N = \\delta^{-1}(W),\\ W \\text{ open}"],
    "context": "Before: open for anisotropic outer forms of type $A$, trialitarian $D_4$ and certain $E_6$",
    "stamp": "proved",
    "note": "Uses the classification of finite simple groups in places"},
  "verify": {"lean": "none", "detail": "No Lean; about 159 pages",
             "ourCheck": OC_NONE},
  "sources": [
    rv("018", "known_before", "Margulis-Platonov conjecture (1970s-80s)."),
    rv("018", "known_before", "Remaining open: anisotropic outer forms of type A, trialitarian D4 and certain E6"),
    rv("018", "claim", "For every global field k (number fields and function fields, including characteristic 2)"),
    rv("018", "key_theorem", "there is an open normal W in H_A with N = delta_A^{-1}(W)"),
    rv("018", "caveats", "Not formalized; ~159 pages."),
    rv("018", "caveats", "it uses the classification of finite simple groups in places"),
    S_HOW]
})

# ---------------------------------------------------------------- 019
write({
  "id": "019", "discipline": NT, "kind": "proof",
  "short": "The local $p$-adic section conjecture",
  "title": {"title": "Grothendieck's section conjecture over $p$-adic fields",
            "subtitle": "Claim: for curves of genus $\\ge 2$ over $p$-adic fields, every section comes from a unique rational point"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "equation", "until": 4.0, "mode": "stack",
       "lines": [
         {"tex": "X(k) \\;\\xrightarrow{\\;\\sim\\;}\\; \\{\\text{sections of } \\pi_1(X) \\to G_k\\}/\\text{conj.}", "at": 0.4, "size": 40, "tone": "claim"},
         {"tex": "k/\\mathbb{Q}_p \\text{ finite},\\quad g(X) \\ge 2", "at": 1.6, "size": 32, "tone": "soft"}]},
      {"primitive": "tree", "from": 4.0, "at": 0.3, "legend": False,
       "nodes": [
         {"id": "r", "label": "local section conjecture", "status": "paper"},
         {"id": "l", "label": "lift to a birational section", "parent": "r", "status": "paper"},
         {"id": "c", "label": "cover, exterior sheet", "parent": "l", "status": "paper"},
         {"id": "k", "label": "Koenigsmann 2005", "parent": "r", "status": "prior"}]}
    ],
    "beats": [
      beat(0.2, "Rational points of $X$ should be exactly the splittings of its arithmetic fundamental group"),
      beat(4.1, "Route: build a special cover, lift the section, apply Koenigsmann's birational theorem"),
      beat(6.7, "Short for its fame: 24 pages plus a 7-page cover construction")]
  },
  "achievement": {
    "form": "status", "label": "Grothendieck's section conjecture (1983), local p-adic case",
    "statement": ["X(k) \\;\\xrightarrow{\\;\\sim\\;}\\; \\{\\text{sections of } \\pi_1(X) \\to G_k\\}/\\text{conj.}"],
    "context": "Before: the birational version (Koenigsmann 2005) and localization of sections (Pop–Stix 2017)",
    "stamp": "proved",
    "note": "The global corollary covers only curves like $X_0(N)$, $X_1(N)$"},
  "verify": {"lean": "none", "detail": "No Lean; 24 pages plus a 7-page companion",
             "ourCheck": OC_NONE},
  "sources": [
    rv("019", "known_before", "Grothendieck's section conjecture (letter to Faltings, 1983)."),
    rv("019", "known_before", "Koenigsmann (2005) proved the birational p-adic version"),
    rv("019", "known_before", "Pop-Stix (2017) localize every etale section at a p-adic valuation"),
    rv("019", "claim", "smooth proper geometrically connected curve X/k of genus >= 2, the map from X(k) to Delta_X-conjugacy classes of sections of pi_1(X) -> G_k is a bijection"),
    rv("019", "claim", "this includes X_0(N) and X_1(N) of genus >= 2 over Q"),
    rv("019", "caveats", "Remarkably short for its scope: 24 pages plus a 7-page cover-construction companion."),
    art("The local p-adic section conjecture (family 019)", "build a finite étale cover with a prescribed exterior sheet and degree divisible by $p$ over small disks, lift the section to a birational one, and apply Koenigsmann"),
    S_HOW]
})

# ---------------------------------------------------------------- 020
def squarefree(m):
    p = 2
    while p * p <= m:
        if m % (p * p) == 0: return False
        p += 1
    return True
vals = [n**4 + 2 for n in range(1, 10)]
write({
  "id": "020", "discipline": NT, "kind": "proof",
  "short": "Squarefree values of quartics",
  "title": {"title": "Squarefree values of quartic polynomials",
            "subtitle": "Claim: an irreducible quartic like $n^4 + 2$ is squarefree for a positive proportion of $n$, as predicted"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 4.4, "at": 0.3, "stagger": 0.14, "perRow": 9,
       "items": [str(v) for v in vals],
       "marks": {str(i): {"tone": "hot", "at": 2.4} for i, v in enumerate(vals) if not squarefree(v)},
       "index": "$n = #$", "index0": 1,
       "caption": "$n^4 + 2$; the marked values are divisible by a square"},
      {"primitive": "equation", "from": 4.4, "mode": "stack",
       "lines": [
         {"tex": "\\#\\{n \\le X : f(n) \\text{ is } (d-2)\\text{-free}\\} = c_{f}\\, X + o(X)", "at": 0.3, "size": 38, "tone": "claim"},
         {"tex": "4 \\le d \\le 8 \\text{ new},\\qquad d \\ge 9 \\text{ Browning}", "at": 1.5, "size": 32, "tone": "soft"}]}
    ],
    "beats": [
      beat(0.2, "Some values of $n^4 + 2$ are divisible by a square; most are not"),
      beat(2.6, "Asked in 1953; the method only reached degree 9 and up"),
      beat(4.6, "The claim: degrees 4 to 8, with the predicted Euler-product density")]
  },
  "achievement": {
    "form": "status", "label": "Squarefree values of quartics, asked in 1953",
    "statement": ["\\#\\{n \\le X : n^4 + 2 \\text{ squarefree}\\} \\sim c\\, X,\\quad c > 0"],
    "context": "Before: $k = d - 2$ only for degree $d \\ge 9$ (Browning 2011)",
    "stamp": "proved",
    "note": "With Browning, every degree $d \\ge 4$; the error term is not uniform in $f$"},
  "verify": {"lean": "main", "detail": "The Lean statement covers every $d \\ge 4$ with $k = d - 2$",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("020", "known_before", "Erdos (1953) singled out n^4 + 2."),
    rv("020", "known_before", "Browning (2011) k >= (3d+1)/4 (d >= 9)"),
    art("Squarefree values of quartics (family 020)", "Browning's determinant method reached $k = d - 2$ only for degree at least 9"),
    rv("020", "claim", "For f in Z[x] irreducible of degree d with 4 <= d <= 8 and k = d - 2"),
    rv("020", "claim", "For d = 4 this is the squarefree-values conjecture for quartics (e.g. n^4 + 2, n^4 + 1)"),
    rv("020", "caveats", "Lean statement covers all d >= 4"),
    rv("020", "caveats", "Error term not uniform in f."),
    S_AXIOMS, S_NOBUILD]
})
print('b ok')
