from common import *
from math import gcd, log, hypot

# ---------------------------------------------------------------- 021
ints = list(range(1, 31))
write({
  "id": "021", "discipline": NT, "kind": "improved-bound",
  "short": "Jacobsthal's function, quadratic bound",
  "title": {"title": "A quadratic bound for Jacobsthal's function",
            "subtitle": "Claim: $h(k) \\le C k^2/(\\log\\log 3k)^2$ for an absolute constant $C$"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 4.6, "at": 0.3, "stagger": 0.05, "perRow": 15,
       "items": [str(n) for n in ints],
       "marks": {str(i): {"tone": "claim", "at": 2.0} for i, n in enumerate(ints) if gcd(n, 30) == 1},
       "caption": "marked: integers coprime to $2 \\cdot 3 \\cdot 5$. No run without one is longer than $2, \\ldots, 6$"},
      {"primitive": "equation", "from": 4.6, "mode": "stack",
       "lines": [
         {"tex": "h(k) \\ll k^2 \\log^2 k", "at": 0.3, "size": 40, "tone": "mute", "note": "Iwaniec 1978"},
         {"tex": "h(k) \\le C\\, \\frac{k^2}{(\\log\\log 3k)^2}", "at": 1.5, "size": 44, "tone": "claim", "note": "claimed"}]}
    ],
    "beats": [
      beat(0.2, "$h(k)$: the longest run of integers, none coprime to a product of $k$ given primes"),
      beat(2.6, "With the $k = 3$ primes $2, 3, 5$, every 6 consecutive integers include a marked one"),
      beat(4.8, "Jacobsthal asked whether $h(k)$ is at most of order $k^2$; the claim says yes")]
  },
  "achievement": {
    "form": "bound",
    "before": {"label": "Best known, Iwaniec 1978", "tex": "h(k) \\ll k^2 \\log^2 k", "note": "arbitrary sets of primes"},
    "after": {"label": "Claimed, 25 Sep 2026", "tex": "h(k) \\ll \\frac{k^2}{(\\log\\log 3k)^2}", "note": "absolute constant $C$"},
    "stamp": "improved",
    "note": "The true order is still unknown; lower bounds sit near $k \\log k$"},
  "verify": {"lean": "main", "detail": "In Lean: the quadratic bound and the iterated-log saving",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("021", "claim", "h(k) <= C k^2/(log log 3k)^2 for an absolute C"),
    rv("021", "claim", "This answers Jacobsthal's question whether h(k) << k^2"),
    rv("021", "known_before", "Iwaniec (1978) h(k) << k^2 log^2 k (arbitrary primes)"),
    rv("021", "caveats", "Optimal order still unknown (gap between ~k log k and k^2/(loglog k)^2)."),
    rv("021", "lean", "main theorem formalized (Jacobsthal: quadratic bound; JacobsthalImproved: the iterated-log saving)."),
    cat("021", "A-quadratic-bound-for-Jacobsthals-function-September-25-2026/paper.pdf"),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 022
write({
  "id": "022", "discipline": NT, "kind": "proof",
  "short": "Duffin–Schaeffer with a shift",
  "title": {"title": "The weak inhomogeneous Duffin–Schaeffer conjecture",
            "subtitle": "Claim: the Duffin–Schaeffer law holds with any fixed shift $\\gamma$, for almost every $x$"},
  "object": {
    "dur": 8.6,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "\\sum_{q} \\frac{\\varphi(q)\\,\\psi(q)}{q} = \\infty \\;\\Rightarrow", "at": 0.4, "size": 40, "tone": "soft", "y": 0.1},
      {"tex": "\\|q x\\| < \\psi(q) \\text{ infinitely often, for a.e. } x", "at": 2.6, "size": 38, "tone": "mute", "y": 0.44},
      {"tex": "\\|q x - \\term{g}{\\gamma}\\| < \\term{p}{\\psi(q)} \\text{ infinitely often, for a.e. } x", "at": 5.0, "size": 38, "tone": "claim", "y": 0.64,
       "terms": {"g": {"label": "the shift", "tone": "hot", "at": 0.7},
                 "p": {"label": "allowed error", "tone": "claim", "at": 1.2}}}],
    "beats": [
      beat(0.2, "If this weighted series diverges, approximations at rate $\\psi$ should exist for almost every $x$"),
      beat(2.6, "Koukoulopoulos and Maynard proved that in 2019"),
      beat(5.0, "The claim: the same with any fixed shift $\\gamma$, numerators unrestricted")]
  },
  "achievement": {
    "form": "status", "label": "Inhomogeneous Duffin–Schaeffer conjecture, weak form",
    "statement": ["\\sum_q \\tfrac{\\varphi(q)\\psi(q)}{q} = \\infty \\;\\Rightarrow\\; \\|qx - \\gamma\\| < \\psi(q) \\text{ i.o., a.e. } x"],
    "context": "Before: the unshifted conjecture (Koukoulopoulos–Maynard 2019); without the $\\varphi$ weights it fails (Ramírez)",
    "stamp": "proved",
    "note": "Weak form: numerators unrestricted, not the coprime version"},
  "verify": {"lean": "none", "detail": "No Lean; 87 pages",
             "ourCheck": OC_NONE},
  "sources": [
    art("Duffin–Schaeffer with a shift (family 022)", "Koukoulopoulos and Maynard proved the Duffin–Schaeffer conjecture in 2019."),
    art("Duffin–Schaeffer with a shift (family 022)", "Ramírez had shown the unweighted version fails. 87 pages, no Lean."),
    rv("022", "claim", "For every real shift gamma and every psi: N -> [0, inf) with sum phi(q) psi(q)/q = infinity, almost every x satisfies ||q x - gamma|| < psi(q) for infinitely many q (numerators unrestricted)."),
    rv("022", "caveats", "'Weak' version (unrestricted numerators, totient-weighted divergence), not the coprime-numerator form."),
    S_HOW]
})

# ---------------------------------------------------------------- 023
write({
  "id": "023", "discipline": NT, "kind": "proof",
  "short": "Patterson's bias for cubic Gauss sums",
  "title": {"title": "Patterson's bias for cubic Gauss sums, unconditionally",
            "subtitle": "Claim: summed over primes, normalized cubic Gauss sums grow like $\\tfrac{6}{5} c_* X^{5/6}/\\log X$, with no GRH"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "plot", "until": 4.4, "x": [2, 1000], "y": [0, 160], "labelRoom": 230,
       "xlabel": "$X$", "ylabel": "size, constants dropped",
       "curves": [
         {"f": "x/log(x)", "label": "$X/\\log X$: trivial", "tone": "old", "at": 0.5, "dur": 1.4},
         {"f": "pow(x, 5/6)/log(x)", "label": "$X^{5/6}/\\log X$: the bias", "tone": "claim", "at": 1.9, "dur": 1.4}]},
      {"primitive": "equation", "from": 4.4, "mode": "stack",
       "lines": [
         {"tex": "\\sum_{N\\pi \\le X} \\tilde g(\\pi) = \\tfrac{6}{5}\\, c_*\\, \\frac{X^{5/6}}{\\log X} + o\\Big(\\frac{X^{5/6}}{\\log X}\\Big)", "at": 0.3, "size": 40, "tone": "claim"},
         {"tex": "c_* = \\frac{(2\\pi)^{2/3}}{3\\,\\Gamma(2/3)}", "at": 1.5, "size": 34, "tone": "soft"}]}
    ],
    "beats": [
      beat(0.2, "Each normalized Gauss sum has size 1; with random signs their sum would stay small"),
      beat(2.4, "Schematic, constants dropped: the bias is a power $X^{1/6}$ below the trivial size"),
      beat(4.6, "Patterson conjectured it in 1978; it was known only assuming GRH")]
  },
  "achievement": {
    "form": "status", "label": "Patterson's conjecture (1978)",
    "statement": ["\\sum_{N\\pi \\le X} \\tilde g(\\pi) \\sim \\tfrac{6}{5}\\, c_*\\, X^{5/6}/\\log X"],
    "context": "Before: proved assuming GRH (Dunn and Radziwill, 2021)",
    "stamp": "proved",
    "note": "Same cubic-theta machinery as family 003"},
  "verify": {"lean": "main", "detail": "In Lean: the first moment, angular comparison and angular cancellation",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("023", "claim", "sum over primary Eisenstein primes pi with N(pi) <= X of the normalized cubic Gauss sum G(pi) equals (6/5) c_* X^{5/6}/log X + o(X^{5/6}/log X), with c_* = (2 pi)^{2/3}/(3 Gamma(2/3))"),
    rv("023", "known_before", "Patterson (1978) conjectured the X^{5/6} bias. Dunn-Radziwill (2021, arXiv:2109.07463) proved Patterson's conjecture assuming GRH."),
    rv("023", "caveats", "Uses the same cubic-theta machinery as the quasi-RH family (003)"),
    rv("023", "lean", "main theorem formalized (PattersonFirstMoment: first moment, angular comparison, angular cancellation)."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 024
def phi(n):
    r, m, p = n, n, 2
    while p * p <= m:
        if m % p == 0:
            while m % p == 0: m //= p
            r -= r // p
        p += 1
    if m > 1: r -= r // m
    return r
tot = {phi(n) for n in range(1, 2000)}
write({
  "id": "024", "discipline": NT, "kind": "proof",
  "short": "How many totients are there?",
  "title": {"title": "An asymptotic formula for the number of totients",
            "subtitle": "Claim: an explicit asymptotic for $V(x)$, the number of values of $\\varphi$ up to $x$, and $V(cx)/V(x) \\to c$"},
  "object": {
    "dur": 8.6, "layout": "sequence",
    "panels": [
      {"primitive": "sequence", "until": 4.6, "at": 0.3, "stagger": 0.05, "perRow": 15,
       "items": [str(n) for n in ints],
       "marks": {str(i): {"tone": "claim", "at": 2.2} for i, n in enumerate(ints) if n in tot},
       "caption": "marked: values of Euler's $\\varphi$. $V(x)$ counts the marked numbers up to $x$"},
      {"primitive": "equation", "from": 4.6, "mode": "stack",
       "lines": [
         {"tex": "V(x) \\sim (\\text{explicit scale}) \\cdot x \\cdot C(x)", "at": 0.3, "size": 40, "tone": "claim"},
         {"tex": "V(cx)/V(x) \\to c \\quad (c > 0 \\text{ fixed})", "at": 1.5, "size": 36, "tone": "soft"}]}
    ],
    "beats": [
      beat(0.2, "Which numbers are values of $\\varphi(n)$? No odd number above 1 is"),
      beat(2.6, "Ford (1998) found the order of magnitude of $V(x)$, not an asymptotic"),
      beat(4.8, "The claim: an asymptotic, up to a bounded oscillating factor $C(x)$")]
  },
  "achievement": {
    "form": "status", "label": "Counting totients: is V(x) regularly varying?",
    "statement": ["V(cx)/V(x) \\to c \\quad \\text{for every fixed } c > 0"],
    "context": "Before: the order of magnitude of $V(x)$ (Ford 1998)",
    "stamp": "proved",
    "note": "$C(x)$ oscillates and is defined as a limit, not a closed-form constant"},
  "verify": {"lean": "main", "detail": "In Lean: the asymptotic and the companion count",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("024", "claim", "Gives an explicit asymptotic equivalent V(x) ~ (explicit scale) x C(x) for the number of distinct totient values up to x, with a positive bounded phase-dependent factor"),
    rv("024", "claim", "in particular V(cx)/V(x) -> c for every fixed c > 0 (Erdos-Hall regular variation question)"),
    rv("024", "known_before", "Ford (Annals 1998) determined the order of magnitude"),
    rv("024", "caveats", "The 'asymptotic formula' has an oscillating (phase-dependent) bounded factor defined by a limit, not a closed-form constant."),
    rv("024", "lean", "main theorem formalized (TotientAsymptotic; TotientCompanionZero)."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 025
write({
  "id": "025", "discipline": NT, "kind": "proof",
  "short": "Short Egyptian fractions",
  "title": {"title": "Every $a/b$ is a short sum of unit fractions",
            "subtitle": "Claim: every $a/b$ is a sum of $O(\\log\\log b)$ distinct unit fractions, and that is best possible"},
  "object": {
    "dur": 8.6,
    "primitive": "plot", "x": [1, 100], "y": [0, 24], "labelRoom": 210,
    "xlabel": "$\\log b$", "ylabel": "unit fractions needed, constants dropped",
    "curves": [
      {"f": "x/log(x)", "from": 3, "label": "1950: $\\log b/\\log\\log b$", "tone": "faint", "at": 0.6, "dur": 1.3},
      {"f": "sqrt(x)", "label": "Vose 1985: $\\sqrt{\\log b}$", "tone": "old", "at": 2.4, "dur": 1.3},
      {"f": "log(x)", "label": "claimed: $\\log\\log b$", "tone": "claim", "at": 4.6, "dur": 1.4}],
    "regions": [{"f": "sqrt(x)", "f2": "log(x)", "from": 1, "to": 100, "tone": "claim", "at": 6.0}],
    "beats": [
      beat(0.2, "$N(b)$: the most distinct unit fractions some $a/b$ needs. Schematic, constants dropped"),
      beat(2.4, "Vose's $\\sqrt{\\log b}$ had stood since 1985"),
      beat(4.6, "The claim: $\\log\\log b$, which matches the known lower bound")]
  },
  "achievement": {
    "form": "bound",
    "before": {"label": "Best known, Vose 1985", "tex": "N(b) \\ll \\sqrt{\\log b}"},
    "after": {"label": "Claimed, 25 Sep 2026", "tex": "N(b) \\asymp \\log\\log b", "note": "matches the lower bound"},
    "stamp": "improved",
    "note": "Denominators may be arbitrarily large"},
  "verify": {"lean": "main", "detail": "In Lean, with explicit constants such as $257/\\log 2$",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("025", "known_before", "Erdos (1950) proved N(b) << log b/log log b and the lower bound order log log b"),
    rv("025", "known_before", "Vose (1985) N(b) << sqrt(log b)."),
    rv("025", "claim", "There are absolute c1, c2 with c1 log log b <= N(b) <= c2 log log b for b large"),
    rv("025", "caveats", "33 pages; denominators are unrestricted in size. Lean includes explicit constants like 257/log 2"),
    art("Short Egyptian fractions (025)", "Vose's $\\sqrt{\\log b}$ had stood since 1985"),
    cat("025", "Short-Egyptian-fractions-September-25-2026/Short-Egyptian-fractions-September-25-2026.pdf"),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 026
def primes_upto(n):
    return [p for p in range(2, n + 1) if all(p % d for d in range(2, int(p**0.5) + 1))]
ps = primes_upto(97)
gaps = [ps[i + 1] - ps[i] for i in range(len(ps) - 1)]
write({
  "id": "026", "discipline": NT, "kind": "proof",
  "short": "A positive share of large prime gaps",
  "title": {"title": "A positive proportion of large prime gaps",
            "subtitle": "Claim: for every $C > 0$, a positive proportion of gaps $p_{n+1} - p_n$ exceed $C \\log p_n$"},
  "object": {
    "dur": 8.6,
    "primitive": "sequence", "at": 0.3, "stagger": 0.07, "perRow": 12,
    "items": [str(g) for g in gaps],
    "marks": {str(i): {"tone": "claim", "at": 3.0} for i, g in enumerate(gaps) if g > log(ps[i])},
    "index": "$n = #$", "index0": 1,
    "caption": "$p_{n+1} - p_n$ for the first primes; marked: gaps larger than $\\log p_n$ (the case $C = 1$)",
    "beats": [
      beat(0.2, "Gaps between consecutive primes: near $p$ the average gap is about $\\log p$"),
      beat(3.0, "Marked: gaps above $\\log p_n$. Does a fixed share exceed $C \\log p_n$ for every $C$?"),
      beat(5.8, "The claim: yes, for every $C$, though the share $c(C)$ is tiny")]
  },
  "achievement": {
    "form": "status", "label": "Large prime gaps for every C, and the p_n/n question",
    "statement": ["\\#\\{n \\le N : p_{n+1} - p_n > C \\log p_n\\} \\ge c(C)\\, N"],
    "context": "Before: gaps beyond any multiple of $\\log p_n$ occur (Westzynthius 1931), but not a positive share",
    "stamp": "proved",
    "note": "The constants $c(C)$ are not explicit, and certainly tiny for large $C$"},
  "verify": {"lean": "part", "detail": "In Lean: the corollary on $p_n/n$, not the full gap theorem",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("026", "claim", "For every fixed C > 0 there is c(C) > 0 with #{n <= N : p_{n+1} - p_n > C log p_n} >= c(C) N for all large N."),
    rv("026", "known_before", "Westzynthius (1931) d_n/log p_n unbounded"),
    rv("026", "known_before", "Positive proportion of gaps larger than C times average for every C was open"),
    rv("026", "caveats", "19 pages, constants c(C) not explicit and certainly tiny for large C."),
    rv("026", "lean", "the Lean doc presents it as a supplement rather than the full gap theorem"),
    art("Large prime gaps (026)", "Only the corollary is in Lean, and the proof is 19 pages."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 027
write({
  "id": "027", "discipline": NT, "kind": "proof",
  "short": "Integral points on character varieties",
  "title": {"title": "Dense integral points on character varieties of curves",
            "subtitle": "Claim: integral points become Zariski dense on every $\\mathrm{SL}_r$ character variety of a curve"},
  "object": {
    "dur": 8.4,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "X \\text{ a smooth complex curve},\\quad r \\ge 1", "at": 0.4, "size": 36, "tone": "soft", "y": 0.08},
      {"tex": "M_{\\mathrm{SL}_r}(X) = \\{\\rho: \\term{p}{\\pi_1(X)} \\to \\term{s}{\\mathrm{SL}_r}\\}/\\!\\sim", "at": 1.6, "size": 38, "tone": "soft", "y": 0.3,
       "terms": {"p": {"label": "loops on $X$", "tone": "cool", "at": 0.8},
                 "s": {"label": "$r \\times r$ matrices", "tone": "soft", "at": 1.4}}},
      {"tex": "M_{\\mathrm{SL}_r}(X)(\\term{o}{\\mathcal{O}_K}) \\text{ is Zariski dense}", "at": 4.6, "size": 42, "tone": "claim", "y": 0.68,
       "terms": {"o": {"label": "integers of one number field $K$", "tone": "claim", "at": 0.8}}}],
    "beats": [
      beat(0.2, "Character varieties: the space of $\\mathrm{SL}_r$ representations of a curve's fundamental group"),
      beat(2.8, "Litt asked whether integral points are dense after a finite extension"),
      beat(4.8, "The claim: yes, on every component, over the ring of integers of one number field")]
  },
  "achievement": {
    "form": "status", "label": "A question of Daniel Litt, determinant-one curve case",
    "statement": ["M_{\\mathrm{SL}_r}(X)(\\mathcal{O}_K) \\text{ Zariski dense on every component}"],
    "context": "Before: integral points on $\\mathrm{SL}_2$ character varieties of surfaces (Whang 2020)",
    "stamp": "proved",
    "note": "With prescribed quasi-unipotent boundary conjugacy classes"},
  "verify": {"lean": "none", "detail": "No Lean; 27 pages",
             "ourCheck": OC_NONE},
  "sources": [
    rv("027", "claim", "For every smooth connected complex algebraic curve X and every r >= 1, integral points become Zariski dense, over the full ring of integers of one number field, on every component of the SL_r character variety (with prescribed quasi-unipotent boundary conjugacy classes, including nonsemisimple ones). This settles the determinant-one curve case of a question of Litt."),
    rv("027", "known_before", "Whang (2020) studied integral points on SL_2 character varieties of surfaces (Markoff-type)"),
    rv("027", "caveats", "Not formalized; 27 pages."),
    S_HOW]
})

# ---------------------------------------------------------------- 028
def isprime(n):
    return n > 1 and all(n % d for d in range(2, int(n**0.5) + 1))
def gprime(a, b):
    if b == 0: return isprime(a) and a % 4 == 3
    if a == 0: return isprime(b) and b % 4 == 3
    return isprime(a * a + b * b)
A, B, D = 20, 8, 2.0
pts = [(a, b) for a in range(A + 1) for b in range(B + 1) if gprime(a, b)]
edges = [(i, j) for i in range(len(pts)) for j in range(i + 1, len(pts)) if hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) <= D + 1e-9]
# components
par = list(range(len(pts)))
def find(x):
    while par[x] != x:
        par[x] = par[par[x]]; x = par[x]
    return x
for i, j in edges: par[find(i)] = find(j)
comp = {}
for i in range(len(pts)): comp.setdefault(find(i), []).append(i)
big = max(comp.values(), key=len)
nodes28 = [{"id": f"g{i}", "x": round(0.03 + 0.94 * a / A, 4), "y": round(0.94 - 0.88 * b / B, 4),
            "tone": "accent" if i in big else "soft", **({"fill": "accent"} if i in big else {})}
           for i, (a, b) in enumerate(pts)]
edges28 = [[f"g{i}", f"g{j}", {"tone": "accent" if i in big else "soft", "w": 2}] for i, j in edges]
write({
  "id": "028", "discipline": NT, "kind": "proof",
  "short": "The Gaussian moat",
  "title": {"title": "No walk to infinity on the Gaussian primes",
            "subtitle": "Claim: with steps of length at most $D$, every connected cluster of Gaussian primes has at most $B_D$ points"},
  "object": {
    "dur": 8.6,
    "heading": "Gaussian primes $a + bi$ in a small window, joined when at distance at most $2$",
    "primitive": "graph", "r": 7, "edgeAt": 1.0, "edgeDur": 3.6,
    "nodes": nodes28, "edges": edges28,
    "beats": [
      beat(0.2, "Can you walk to infinity on Gaussian primes with steps of bounded length?"),
      beat(3.2, "Gordon asked in 1962. Highlighted: the largest cluster in this window"),
      beat(5.8, "The claim: for every step bound $D$, every cluster has at most $B_D$ primes")]
  },
  "achievement": {
    "form": "status", "label": "The Gaussian moat problem (Gordon, 1962)",
    "statement": ["\\forall D\\ \\exists B_D:\\ \\text{every component of } G_D \\text{ has} \\le B_D \\text{ vertices}"],
    "context": "Before: moats around particular regions (Gethner–Wagon–Wick 1998) and computations",
    "stamp": "proved",
    "note": "$B_D$ is ineffective; the proof is a sieve argument on residues"},
  "verify": {"lean": "main", "detail": "In Lean: the uniform component bound for every real $D$, axis primes included",
             "ourCheck": OC_DOCS},
  "sources": [
    rv("028", "known_before", "Posed by Basil Gordon (1962 ICM; Erdos credited Gordon and Motzkin)."),
    rv("028", "known_before", "Gethner-Wagon-Wick (Amer. Math. Monthly 1998) constructed moats around particular regions and proved isolation results"),
    rv("028", "claim", "For every real D there is a finite B_D such that every connected component of the graph on Gaussian primes joining primes at distance <= D has at most B_D vertices"),
    rv("028", "claim", "B_D is ineffective."),
    rv("028", "caveats", "the proof is a finite periodic sieve obstruction proved with geometric sampling and entropy estimates"),
    rv("028", "lean", "main theorem formalized (GaussianMoat.fullMain: uniform component bound for every real D, axis primes and associates included)."),
    S_AXIOMS, S_NOBUILD]
})

# ---------------------------------------------------------------- 029
def is_primroot(a, p):
    x, seen = 1, set()
    for _ in range(p - 1):
        x = x * a % p; seen.add(x)
    return len(seen) == p - 1
ops = [p for p in primes_upto(89) if p > 2]
write({
  "id": "029", "discipline": NT, "kind": "partial",
  "short": "Artin's primitive roots, every base",
  "title": {"title": "Every admissible base is a primitive root infinitely often",
            "subtitle": "Claim: if $a \\ne -1$ is not a square, at least $c_a x/(\\log x)^2$ primes in $(x, 2x)$ have $a$ as primitive root"},
  "object": {
    "dur": 8.6,
    "primitive": "sequence", "at": 0.3, "stagger": 0.07, "perRow": 12,
    "items": [str(p) for p in ops],
    "marks": {str(i): {"tone": "claim", "at": 2.8} for i, p in enumerate(ops) if is_primroot(2, p)},
    "caption": "odd primes $p$; marked: the powers of $2$ run through every nonzero residue mod $p$",
    "beats": [
      beat(0.2, "Is $a$ a primitive root mod $p$, so that its powers hit every nonzero residue?"),
      beat(2.8, "Artin (1927): yes for infinitely many $p$, unless $a = -1$ or $a$ is a square"),
      beat(5.4, "Claimed: infinitely many for every admissible $a$, though not Artin's predicted density")]
  },
  "achievement": {
    "form": "status", "label": "Artin's primitive root conjecture (1927)",
    "statement": ["\\#\\{x < p < 2x : \\mathrm{ord}_p(a) = p - 1\\} \\ge c_a\\, x/(\\log x)^2"],
    "context": "Before: on GRH (Hooley 1967); unconditionally one of $2, 3, 5$ works, but not which",
    "stamp": "partial",
    "note": "Artin predicts $A(a)\\, x/\\log x$; the density form stays open"},
  "verify": {"lean": "none", "detail": "No Lean, and its zero-free input for cyclotomic $L$-functions is itself huge",
             "ourCheck": OC_NONE},
  "sources": [
    rv("029", "claim", "For every integer a that is not -1 and not a perfect square, at least c_a x/(log x)^2 primes in (x, 2x) have a as a primitive root, for all large x"),
    rv("029", "known_before", "Artin (1927). Hooley (1967) proved the full density conjecture under GRH for Kummer fields."),
    rv("029", "known_before", "at most two prime bases fail, so one of 2, 3, 5 works, but no specific base was known."),
    rv("029", "caveats", "Proves infinitude with x/(log x)^2, not Artin's predicted density A(a) x/log x, so Artin's conjecture in its quantitative form remains open."),
    rv("029", "caveats", "The analytic input (Theorem 1.2) is itself an enormous claim"),
    S_HOW]
})

# ---------------------------------------------------------------- 030
write({
  "id": "030", "discipline": NT, "kind": "proof",
  "short": "Modularity over imaginary quadratic fields",
  "title": {"title": "Elliptic curves over imaginary quadratic fields are modular",
            "subtitle": "Claim: each $E/K$ matches an automorphic representation of $\\mathrm{GL}_2$ over $K$, at every place"},
  "object": {
    "dur": 8.6,
    "heading": "Prime switching: congruences down to a curve already known to be modular",
    "primitive": "tree", "at": 0.4, "legend": False,
    "nodes": [
      {"id": "e", "label": "$E/K$ is modular", "status": "paper"},
      {"id": "a", "label": "congruence mod $p$", "parent": "e", "status": "paper"},
      {"id": "b", "label": "congruence mod $3$", "parent": "a", "status": "paper"},
      {"id": "c", "label": "congruence mod $p$", "parent": "b", "status": "paper"},
      {"id": "k", "label": "a curve known to be modular", "parent": "c", "status": "prior"}],
    "beats": [
      beat(0.2, "Each link is a Jacobian of a cyclic cover, chosen so existing lifting theorems apply"),
      beat(3.4, "Modularity passes up the chain, as in Wiles's 3–5 switch"),
      beat(5.8, "One unmet hypothesis, at 2, 3 or $p$, would break the chain")]
  },
  "achievement": {
    "form": "status", "label": "Modularity over imaginary quadratic fields",
    "statement": ["L(E/K, s) = L(\\pi_E, s - \\tfrac{1}{2})\\ \\text{ for every } E/K"],
    "context": "Before: all curves over $\\mathbb{Q}(i)$ and a few small fields (Caraiani–Newton 2023), a positive proportion elsewhere",
    "stamp": "proved",
    "note": "Only 30 pages, with the big lifting theorems used as black boxes"},
  "verify": {"lean": "none", "detail": "No Lean",
             "ourCheck": OC_NONE},
  "sources": [
    rv("030", "claim", "Every elliptic curve E over every imaginary quadratic field K is modular"),
    rv("030", "claim", "so L(E/K, s) = L(pi_E, s - 1/2)"),
    rv("030", "known_before", "Caraiani-Newton (2023, arXiv:2301.10509) modularity of all elliptic curves over many imaginary quadratic fields, including Q(i) and a few other small fields, and a positive proportion of curves more generally"),
    rv("030", "caveats", "Only 30 pages for a statement whose previous partial cases needed the ten-author potential automorphy machinery; it relies on those modularity lifting theorems (Calegari-Geraghty patching, ACC+ results, Caraiani-Newton) as black boxes"),
    rv("030", "caveats", "every hypothesis of those theorems (residual image, local conditions at 2, 3, p) must be met, which is exactly where such arguments fail"),
    art("Modularity over imaginary quadratic fields (family 030)", "It is a prime-switching argument in the spirit of Wiles's 3–5 switch: Jacobians of cyclic covers whose cohomology links $E$ through congruences mod $p$, mod 3, mod $p$ to a curve already known to be modular"),
    S_HOW]
})

# ---------------------------------------------------------------- 031
write({
  "id": "031", "discipline": NT, "kind": "proof",
  "short": "Uchida's conjecture",
  "title": {"title": "Uchida's conjecture on homomorphisms of Galois groups",
            "subtitle": "Claim: every continuous open map between these Galois groups comes from a unique field embedding"},
  "object": {
    "dur": 8.4,
    "primitive": "equation", "mode": "stack",
    "lines": [
      {"tex": "\\mathrm{Gal}(E_1/F_1) \\xrightarrow{\\ \\sim\\ } \\mathrm{Gal}(E_2/F_2) \\;\\Rightarrow\\; E_1 \\cong E_2", "at": 0.4, "size": 36, "tone": "mute", "note": "Neukirch–Uchida", "y": 0.08},
      {"tex": "\\term{a}{\\alpha}: \\mathrm{Gal}(E_1/F_1) \\to \\mathrm{Gal}(E_2/F_2) \\text{ open}", "at": 3.0, "size": 36, "tone": "soft", "y": 0.32,
       "terms": {"a": {"label": "any open map", "tone": "cool", "at": 0.6}}},
      {"tex": "\\Rightarrow\\ \\alpha \\text{ comes from a unique } \\term{j}{j: E_2 \\hookrightarrow E_1}", "at": 4.4, "size": 38, "tone": "claim", "y": 0.64,
       "terms": {"j": {"label": "a field embedding", "tone": "claim", "mark": "box", "at": 0.8}}}],
    "beats": [
      beat(0.2, "For number fields, isomorphic Galois groups come from isomorphic fields"),
      beat(2.9, "Uchida (1981) conjectured the same for open homomorphisms, not only isomorphisms"),
      beat(5.4, "The claim: yes, for solvably closed extensions, with no restriction on the kernel")]
  },
  "achievement": {
    "form": "status", "label": "Uchida's conjecture (1981)",
    "statement": ["\\alpha: \\mathrm{Gal}(E_1/F_1) \\to \\mathrm{Gal}(E_2/F_2) \\text{ open} \\Rightarrow \\alpha = j^*"],
    "context": "Before: the case $F_1 = \\mathbb{Q}$, uniqueness in general, and existence under a local condition",
    "stamp": "proved"},
  "verify": {"lean": "none", "detail": "No Lean; 23 pages",
             "ourCheck": OC_NONE},
  "sources": [
    rv("031", "known_before", "Neukirch-Uchida theorem (isomorphisms). Uchida (1981, 'Homomorphisms of Galois groups of solvably closed Galois extensions', J. Math. Soc. Japan) conjectured the homomorphism version and proved it when F1 = Q, uniqueness in general, and existence under a local condition."),
    rv("031", "claim", "every continuous open homomorphism Gal(E1/F1) -> Gal(E2/F2) is induced by a unique field embedding E2 -> E1; no restriction on the kernel."),
    rv("031", "caveats", "Not formalized; 23 pages."),
    S_HOW]
})
print('c ok')
