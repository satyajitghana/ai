from common import *
from prob1 import regular_tree
import numpy as np

TONES3 = ['accent', 'cool', 'warn']

# ---------------------------------------------------------------- 226 ----
R_, C_ = 6, 10
rng = random.Random(226)
def horiz():
    m = {}
    for r in range(R_):
        for c in range(0, C_, 2): m[(r, c)] = (r, c + 1); m[(r, c + 1)] = (r, c)
    return m
def mix(m, steps, rng):
    for _ in range(steps):
        r, c = rng.randrange(R_ - 1), rng.randrange(C_ - 1)
        a, b, cc, d = (r, c), (r, c + 1), (r + 1, c), (r + 1, c + 1)
        if m.get(a) == b and m.get(cc) == d:
            m[a] = cc; m[cc] = a; m[b] = d; m[d] = b
        elif m.get(a) == cc and m.get(b) == d:
            m[a] = b; m[b] = a; m[cc] = d; m[d] = cc
    return m
t1 = mix(horiz(), 6000, random.Random(2261))
t2 = mix(horiz(), 6000, random.Random(2262))
sx, sy = 1088 / (C_ + 1), 448 / (R_ + 0.4)
dn = [node(f'{r}_{c}', sx * (c + 1), sy * (r + 0.7), tone='soft') for r in range(R_) for c in range(C_)]
def pairs(m):
    out = []
    for k, v in m.items():
        if k < v: out.append((k, v))
    return sorted(out)
de = [[f'{a[0]}_{a[1]}', f'{b[0]}_{b[1]}', {'tone': 'accent', 'w': 5, 'a': 0.85}] for a, b in pairs(t1)]
de += [[f'{a[0]}_{a[1]}', f'{b[0]}_{b[1]}', {'tone': 'cool', 'w': 3, 'a': 0.95}] for a, b in pairs(t2)]
spec('226', 'proof',
     'Double dimers become $\\mathrm{CLE}_4$',
     'The double-dimer loop ensemble converges to $\\mathrm{CLE}_4$',
     'Claim: overlaying two random domino tilings gives loops that converge, as curves, to nested $\\mathrm{CLE}_4$',
     {'dur': 8.4, 'primitive': 'graph', 'r': 6, 'edgeAt': 0.3, 'edgeDur': 4.6, 'nodes': dn, 'edges': de,
      'beats': [
         {'at': 0.2, 'text': 'Two independent domino tilings of the same region, one per colour (a small instance)'},
         {'at': 3.2, 'text': 'Overlaid, they form loops and doubled edges'},
         {'at': 5.8, 'text': 'Claim: in the scaling limit the loops become nested $\\mathrm{CLE}_4$, curve by curve'}]},
     {'form': 'status', 'label': 'Double-dimer loops and $\\mathrm{CLE}_4$ (after Kenyon; Basok–Chelkak)',
      'statement': [r'\text{double-dimer loops} \to \text{nested } \mathrm{CLE}_4\ \text{ as curves}'],
      'context': 'Before: which punctures the loops surround, a topological convergence (Basok–Chelkak 2021)',
      'stamp': 'proved',
      'note': 'Temperleyan square lattice in the upper half-plane only'},
     'No Lean statement; a 33-page paper',
     OUR_NONE,
     [R('226', 'known_before', 'Basok & Chelkak (JEMS 2021) tau-functions and cylindrical events for double dimers and CLE_4 (topological convergence)'),
      R('226', 'caveats', 'Half-plane Temperleyan geometry only'),
      R('226', 'caveats', '33 pages. No Lean.'),
      CP('226'), READ_ALL])

# ---------------------------------------------------------------- 227 ----
spec('227', 'proof',
     'SK Glauber dynamics across $\\beta = 1$',
     'Critical SK dynamics across the temperature transition',
     'Claim: Glauber dynamics for the SK spin glass has a dimension-free spectral gap for every $\\beta < 1$',
     {'dur': 8.6, 'primitive': 'numberline', 'min': 0, 'max': 2, 'y': 0.56,
      'ticks': [0, {'v': 0.25, 'label': '1/4'}, {'v': 0.5, 'label': '1/2'}, 1, 2], 'axisLabel': 'inverse temperature $\\beta$',
      'markers': [{'v': 0.25, 'derived': '1/4', 'label': 'best known', 'note': 'gap for $\\beta < 1/4$', 'at': 0.6},
                  {'v': 1, 'label': 'critical', 'note': '$n^{2/3+o(1)}$', 'tone': 'hot', 'at': 4.4, 'side': 'below'}],
      'ranges': [{'from': 1, 'to': 2, 'label': 'slow', 'note': '$\\exp(n^{1/10000})$', 'tone': 'old', 'at': 5.0, 'side': 'below'}],
      'slide': {'from': 0.25, 'to': 1, 'derived': '1/4', 'at': 2.4, 'dur': 1.6, 'label': 'claimed gap', 'note': 'every $\\beta < 1$'},
      'beats': [
         {'at': 0.2, 'text': 'Glauber dynamics: the sampler everyone uses, and SK is where it should break down'},
         {'at': 2.6, 'text': 'Fast mixing was proved only for $\\beta < 1/4$. Claim: the whole high-temperature phase'},
         {'at': 5.4, 'text': 'At $\\beta = 1$ mixing slows to $n^{2/3+o(1)}$; past it, stretched-exponential traps'}]},
     {'form': 'bound',
      'before': {'label': 'Spectral gap, best known (2021)', 'tex': r'\beta < 1/4', 'note': 'Eldan, Koehler and Zeitouni; spectral independence'},
      'after': {'label': 'Claimed, 5 Oct 2026', 'tex': r'\beta < 1', 'note': 'dimension-free gap, with cutoff'},
      'note': 'Lean covers less in places: cutoff only for $\\beta < 1/2$, a weaker critical bound'},
     'Lean: the $\\beta < 1$ gap, cutoff for $\\beta < 1/2$, a weaker critical bound; not the aging limits',
     OUR_LEAN,
     [R('227', 'known_before', 'Eldan, Koehler & Zeitouni (PTRF 2021) spectral gap for β<1/4'),
      R('227', 'claim', 'at β=1 worst-start mixing time n^{2/3+o(1)}'),
      R('227', 'claim', 'for β>1 a stretched-exponential obstruction at time exp(n^{1/10000})'),
      R('227', 'caveats', 'Lean (docs/227.md) covers: the β<1 Poincaré inequality; ratio cutoff only for β<1/2'),
      R('227', 'caveats', 'The universal autocorrelation limits are unformalized.'),
      CP('227'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 228 ----
spec('228', 'proof',
     'Phase transition for a radial potential',
     'Continuum phase transitions for radial pair potentials',
     'Claim: radial pair potentials in $\\mathbb R^3$ whose free energy has a kink at one $\\beta_c$, over a range of densities',
     {'dur': 8.4, 'primitive': 'plot', 'x': [0, 2], 'y': [0, 2], 'xticks': [{'v': 1, 'label': '$\\beta_c$'}], 'yticks': [], 'labelRoom': 120,
      'xlabel': 'inverse temperature $\\beta$', 'ylabel': '$\\partial_\\beta F$, schematically',
      'curves': [{'f': '1.6-0.3*x', 'from': 0, 'to': 1, 'tone': 'accent', 'at': 0.5, 'dur': 1.4},
                 {'f': '0.95-0.3*x', 'from': 1, 'to': 2, 'tone': 'accent', 'at': 2.0, 'dur': 1.4}],
      'asymptotes': [{'x': 1, 'at': 1.8}],
      'points': [{'x': 1, 'y': 1.3, 'label': 'a strict downward jump', 'at': 2.2, 'tone': 'hot'}],
      'beats': [
         {'at': 0.2, 'text': 'Lattice models have phase transitions; no realistic continuum gas was ever proved to'},
         {'at': 2.9, 'text': "Here the free energy's $\\beta$-derivative jumps at one $\\beta_c$, for a range of densities"},
         {'at': 5.6, 'text': 'The potentials are engineered for the proof, not Lennard-Jones'}]},
     {'form': 'status', 'label': "Simon's problem (1984): a transition for a continuum pair potential",
      'statement': [r'\text{radial } \phi \text{ on } \mathbb R^3:\ \ \partial_\beta F \text{ jumps at one } \beta_c',
                    r'\text{bounded version: } |\phi(r)| \le C\, r^{-3-1/32}'],
      'context': 'Before: two-species Widom–Rowlinson (Ruelle 1971); Kac-type four-body interactions (1999)',
      'stamp': 'proved',
      'note': 'A temperature kink at fixed density, not liquid–gas coexistence'},
     "Both theorems are in the release's main formal results, standard axioms",
     OUR_LEAN,
     [R('228', 'known_before', "Simon's problems in mathematical physics (1984)"),
      R('228', 'known_before', 'Widom–Rowlinson two-species (Ruelle 1971); Lebowitz–Mazel–Presutti (1999) Kac-type four-body interactions'),
      R('228', 'caveats', 'Both theorems formalized (ContinuumTransition, RadialTransition in yaml main_results; RadialDensityInterval), standard axioms.'),
      R('228', 'caveats', 'the transition is a temperature singularity at fixed density in the canonical ensemble, not liquid–gas coexistence'),
      A('Four smaller results', 'one with a hard core and one bounded with $|\\phi(r)| \\le C r^{-3-1/32}$'),
      CP('228'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 229 ----
rng = random.Random(2290)
depth = 3
bn, be, col = [], [], {}
def bx(d, i): return 60 + (i + 0.5) * (968 / 2 ** d)
col[(0, 0)] = 0
for d in range(1, depth + 1):
    for i in range(2 ** d):
        p = col[(d - 1, i // 2)]
        col[(d, i)] = p if rng.random() < 0.62 else rng.choice([c for c in range(3) if c != p])
for d in range(depth + 1):
    for i in range(2 ** d):
        t = TONES3[col[(d, i)]]
        bn.append(node(f'{d}_{i}', bx(d, i), 40 + d * 125, tone=t, fill=t))
for d in range(1, depth + 1):
    for i in range(2 ** d):
        be.append([f'{d - 1}_{i // 2}', f'{d}_{i}', {'tone': 'soft', 'w': 1.8}])
spec('229', 'proof',
     'Exact reconstruction thresholds on trees',
     'Exact three- and four-state reconstruction thresholds on trees',
     'Claim: for three colours, and for ferromagnetic four-state Potts, the Kesten–Stigum bound $d\\lambda^2 > 1$ is exact',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'graph', 'until': 4.0, 'r': 12, 'edgeAt': 0.3, 'edgeDur': 2.4, 'nodes': bn, 'edges': be},
         {'primitive': 'equation', 'from': 4.0, 'mode': 'stack', 'lines': [
             {'tex': r'd\,\lambda^2 > 1', 'note': 'Kesten–Stigum: reconstruction possible', 'at': 0.3, 'tone': 'accent'},
             {'tex': r'(a-b)^2 > 3(a+2b)', 'note': 'three-community block model', 'at': 1.4, 'tone': 'ink'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Broadcast a colour down a tree, copying it with noise (three colours, a sample)'},
         {'at': 4.1, 'text': 'From the far leaves, can you guess the root? Above Kesten–Stigum, yes'},
         {'at': 6.5, 'text': 'Claim: for 3 and 4 colours, that bound is exactly the threshold'}]},
     {'form': 'status', 'label': 'Kesten–Stigum tightness for 3 and 4 states (Mézard–Montanari conjecture)',
      'statement': [r'\text{reconstruction} \iff d\lambda^2 > 1', r'\text{block model, 3 communities: } (a-b)^2 > 3(a+2b)'],
      'context': 'Before: tight for three states at large degree (Sly); it fails for five or more states',
      'stamp': 'proved',
      'note': 'The four-state proof uses exact-arithmetic polynomial verification'},
     'Lean covers only reconstruction above the bound, the classical direction',
     OUR_LEAN,
     [R('229', 'claim', 'Exact Kesten–Stigum reconstruction threshold dλ^2>1'),
      R('229', 'claim', 'exact weak-recovery threshold (a-b)^2>3(a+2b) for the symmetric 3-community sparse SBM'),
      R('229', 'known_before', 'Sly (Ann. Probab. 2009/CMP 2011) KS tight for 3-state Potts at large degree and non-tight for q≥5'),
      R('229', 'caveats', "The 4-state proof uses 'reproducible exact-arithmetic verification of polynomial inequalities' (computer-assisted)."),
      R('229', 'caveats', 'Lean formalizes only the supercritical direction (reconstruction above KS), which is the classical easy direction'),
      CP('229'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 230 ----
spec('230', 'proof',
     'The exact Hausdorff gauge of SLE',
     'Exact Hausdorff gauges for SLE',
     'Claim: $r^d(\\log\\log 1/r)^{(2-d)/2}$ is the exact Hausdorff gauge of $\\mathrm{SLE}_\\kappa$, $d = 1 + \\kappa/8$',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'plot', 'until': 3.8, 'x': [0, 8], 'y': [0.8, 2.1], 'xticks': [0, 2, 4, 6, 8], 'yticks': [1, 2], 'labelRoom': 170,
          'xlabel': '$\\kappa$', 'ylabel': 'dimension $d$',
          'curves': [{'f': '1+x/8', 'label': '$d = 1 + \\kappa/8$', 'tone': 'accent', 'at': 0.5, 'dur': 1.4}]},
         {'primitive': 'equation', 'from': 3.8, 'mode': 'replace', 'lines': [
             {'tex': r'h(r) = r^{d}\,\bigl(\log\log \tfrac1r\bigr)^{(2-d)/2}', 'note': 'positive and finite measure on every curve segment', 'at': 0.3, 'tone': 'accent'}]}],
      'beats': [
         {'at': 0.2, 'text': '$\\mathrm{SLE}_\\kappa$ curves are fractal, of dimension $1 + \\kappa/8$ (Beffara, 2008)'},
         {'at': 3.9, 'text': 'Schramm asked which gauge makes their Hausdorff measure a true length'},
         {'at': 6.4, 'text': 'Claim: this one, with an iterated-log correction'}]},
     {'form': 'status', 'label': "Schramm's problem (2006 list, Problem 7.1)",
      'statement': [r'\mathcal H^{h}(\mathrm{SLE}_\kappa[s,t]) \in (0,\infty),\ \ 0 < \kappa < 8'],
      'context': 'Before: the dimension (Beffara 2008); Minkowski content (Lawler and Rezaei, 2015)',
      'stamp': 'proved',
      'note': 'Not the exponent-one iterated-log gauge Schramm suggested'},
     'Lean proves only the positivity half; finiteness is not formalized',
     OUR_LEAN,
     [R('230', 'claim', 'For 0<κ<8, d=1+κ/8, the gauge h(r)=r^d (log log 1/r)^{(2-d)/2}'),
      R('230', 'known_before', "Schramm's problem (2006 problem list, Problem 7.1) on Hausdorff measure of SLE; Beffara (2008) dimension 1+κ/8"),
      R('230', 'known_before', 'Lawler & Rezaei (Ann. Probab. 2015) Minkowski content'),
      R('230', 'claim', "Schramm's suggested exponent-one iterated-log gauge is not σ-finite"),
      R('230', 'caveats', 'Lean (SLELowerPositivity) only proves the positivity half; finiteness not formalized.'),
      CP('230'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 231 ----
rng = random.Random(231)
C_, R_ = 10, 5
V = [(r, c) for r in range(R_) for c in range(C_)]
nb = lambda v: [(v[0] + a, v[1] + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= v[0] + a < R_ and 0 <= v[1] + b < C_]
intree = {V[0]}; nxt = {}
for v in V:
    u = v
    while u not in intree:
        nxt[u] = rng.choice(nb(u)); u = nxt[u]
    u = v
    while u not in intree:
        intree.add(u); u = nxt[u]
tree = {tuple(sorted((u, nxt[u]))) for u in nxt}
alle = set()
for v in V:
    for w in nb(v): alle.add(tuple(sorted((v, w))))
sx, sy = 1088 / (C_ + 1), 448 / (R_ + 0.4)
un = [node(f'{r}_{c}', sx * (c + 1), sy * (r + 0.7), tone='ink') for r, c in V]
ue = [[f'{a[0]}_{a[1]}', f'{b[0]}_{b[1]}', {'tone': 'faint', 'w': 1.4, 'a': 0.7}] for a, b in sorted(alle - tree)]
ue += [[f'{a[0]}_{a[1]}', f'{b[0]}_{b[1]}', {'tone': 'accent', 'w': 3.2}] for a, b in sorted(tree)]
spec('231', 'proof',
     'The free spanning forest is a factor of IID',
     'The free uniform spanning forest is a factor of IID',
     'Claim: on every infinite, connected, locally finite graph, one rule builds the free forest from iid labels',
     {'dur': 8.6, 'primitive': 'graph', 'r': 7, 'edgeAt': 0.3, 'edgeDur': 4.4, 'nodes': un, 'edges': ue,
      'beats': [
         {'at': 0.2, 'text': 'A uniform spanning tree of a small grid, sampled exactly (a finite instance)'},
         {'at': 3.0, 'text': 'Lyons asked: can a local, equivariant rule build the free forest from coin flips?'},
         {'at': 5.8, 'text': 'Claim: yes, on every such graph, with no root and no amenability'}]},
     {'form': 'status', 'label': "Lyons's question (2013 Oberwolfach report)",
      'statement': [r'\mathrm{FUSF} \text{ is a factor of IID on every such graph}', r'\text{so is every invariant strongly Rayleigh process}'],
      'context': 'Before: the amenable determinantal case (Lyons and Thom, 2016)',
      'stamp': 'proved',
      'note': 'A factor of IID, not a finitary one; 19 pages'},
     'Comparator challenges cover both claims; not in the main-results list',
     OUR_LEAN,
     [R('231', 'known_before', 'Lyons (2013 Oberwolfach report) asked the FUSF factor question'),
      R('231', 'known_before', 'Lyons & Thom (2016) Bernoulli isomorphism for determinantal measures on amenable groups'),
      R('231', 'caveats', 'covers both claims; not in yaml main_results. 19 pages. Factor of IID, not finitary.'),
      CP('231'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 232 ----
L = 74
pts = {}
rows = 6
for j in range(rows):
    for i in range(13):
        x = 60 + i * L + (j % 2) * L / 2
        y = 34 + j * L * math.sqrt(3) / 2
        if x <= 1040: pts[(i, j)] = (x, y)
keys = sorted(pts)
def adj(a, b):
    (x1, y1), (x2, y2) = pts[a], pts[b]
    return abs(math.hypot(x1 - x2, y1 - y2) - L) < 1
E = [(a, b) for k, a in enumerate(keys) for b in keys[k + 1:] if adj(a, b)]
deg = {k: 0 for k in keys}
for a, b in E: deg[a] += 1; deg[b] += 1
boundary = [k for k in keys if deg[k] < 6]
xs = [pts[k][0] for k in keys]; xm = (min(xs) + max(xs)) / 2
h = {}
for k in keys:
    if k in boundary: h[k] = 1 if pts[k][1] < 224 else -1
rng = random.Random(232)
interior = [k for k in keys if k not in boundary]
for k in interior: h[k] = 1 if pts[k][1] < 224 else -1
for k in sorted(interior, key=lambda k: rng.random()):
    for cand in (3, 1, -1, -3):
        if all(abs(cand - h[b if a == k else a]) <= 2 for a, b in E if k in (a, b)) and rng.random() < 0.5 and cand != h[k]:
            h[k] = cand; break
assert all(abs(h[a] - h[b]) <= 2 for a, b in E) and all(v % 2 for v in h.values())
lab = lambda v: str(v) if v < 0 else str(v)
tone_h = {3: 'hot', 1: 'accent', -1: 'cool', -3: 'hot'}
hn = [node(f'{i}_{j}', pts[(i, j)][0], pts[(i, j)][1], label=lab(h[(i, j)]).replace('-', '−'), tone=tone_h[h[(i, j)]]) for i, j in keys]
he = [[f'{a[0]}_{a[1]}', f'{b[0]}_{b[1]}', {'tone': 'faint', 'w': 1.4}] for a, b in E]
spec('232', 'proof',
     'Lipschitz heights on the triangular lattice',
     'Gaussian fields for triangular-lattice Lipschitz heights',
     'Claim: random Lipschitz heights on the triangular lattice converge to the Gaussian free field',
     {'dur': 8.4, 'primitive': 'graph', 'r': 17, 'edgeAt': 0.2, 'edgeDur': 1.6, 'nodes': hn, 'edges': he,
      'beats': [
         {'at': 0.2, 'text': 'Odd integer heights; neighbours differ by $0$ or $\\pm 2$; boundary $+1$ on top, $-1$ below'},
         {'at': 3.0, 'text': 'A valid configuration, drawn by hand; the claim is about uniform random ones'},
         {'at': 5.6, 'text': 'Claim: scaled, they converge to a universal multiple of the Dirichlet GFF'}]},
     {'form': 'status', 'label': "Schramm's 2006 problems: Problem 2.2 (field part) and Problem 2.3",
      'statement': [r'\text{uniform odd heights} \to c \cdot \text{Dirichlet GFF}', r'\text{real heights: zero interface} \to \mathrm{SLE}_4'],
      'context': 'Before: logarithmic delocalization of integer Lipschitz functions (Glazman–Manolescu 2021)',
      'stamp': 'proved',
      'note': 'The $\\mathrm{SLE}_4$ interface of the integer model is not claimed'},
     'No Lean statement',
     OUR_NONE,
     [R('232', 'claim', "uniform odd integer heights with increments 0,±2 and two-arc boundary ±1 converge to a universal multiple of the Dirichlet GFF (field part of Schramm's Problem 2.2)"),
      R('232', 'claim', "(Schramm's Problem 2.3)"),
      R('232', 'known_before', "Schramm's 2006 problem collection (Problems 2.2, 2.3); Glazman & Manolescu (2021) logarithmic delocalization of uniform integer Lipschitz functions"),
      R('232', 'caveats', 'Interface result for the integer model (the SLE_4 half of Problem 2.2) is not claimed'),
      CP('232'), READ_ALL])

# ---------------------------------------------------------------- 233 ----
rng = random.Random(233)
GR, GC = 7, 16
sig = [[rng.choice([-1, 1]) for _ in range(GC)] for _ in range(GR)]
tau = [[rng.choice([-1, 1]) for _ in range(GC)] for _ in range(GR)]
J, K = 0.42, 0.12
for _ in range(80):
    for r in range(GR):
        for c in range(GC):
            nbs = [(r + a, c + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= r + a < GR and 0 <= c + b < GC]
            best = None
            ws = []
            for s in (-1, 1):
                for t in (-1, 1):
                    e = sum(J * (s * sig[a][b] + t * tau[a][b]) + K * s * t * sig[a][b] * tau[a][b] for a, b in nbs)
                    ws.append((math.exp(e), s, t))
            z = sum(w for w, _, _ in ws); u = rng.random() * z
            for w, s, t in ws:
                u -= w
                if u <= 0: sig[r][c], tau[r][c] = s, t; break
tmap = {(1, 1): 'accent', (1, -1): 'cool', (-1, 1): 'warn', (-1, -1): 'faint'}
spec('233', 'proof',
     'The critical Ashkin–Teller limit',
     'The joint critical Ashkin–Teller current limit',
     'Claim: at Ashkin–Teller criticality, heights and current clusters converge jointly to GFF structures',
     {'dur': 8.4, 'primitive': 'grid', 'rows': GR, 'cols': GC, 'stagger': 0.03,
      'cells': [[r, c, tmap[(sig[r][c], tau[r][c])]] for r in range(GR) for c in range(GC)],
      'caption': 'colour = the pair of spins $(\\sigma, \\tau)$ at each site',
      'beats': [
         {'at': 0.2, 'text': 'Two Ising spins per site, coupled: four colours (a small sample, not critical)'},
         {'at': 3.0, 'text': 'On its critical line the model is described by a Gaussian free field'},
         {'at': 5.6, 'text': 'Claim: heights and both current-cluster families converge, jointly, at all depths'}]},
     {'form': 'status', 'label': 'Conjecture 1.2 of Alcalde López, Heeney and Lis',
      'statement': [r'\text{height function} \to \text{GFF}', r'\text{current clusters} \to \text{two-valued local sets}'],
      'context': 'Includes the four-state Potts endpoint; bounded Jordan domains, wired and free boundary',
      'stamp': 'proved',
      'note': 'A recent conjecture with a narrow audience; one 100-page paper'},
     'No Lean statement',
     OUR_NONE,
     [R('233', 'known_before', 'Conjecture 1.2 of Alcalde López, Heeney & Lis'),
      R('233', 'caveats', 'Single 100-page paper; recent conjecture with a narrow audience. No Lean.'),
      R('233', 'claim', 'including the four-state Potts endpoint'),
      CP('233'), READ_ALL])

# ---------------------------------------------------------------- 234 ----
n = 8
spec('234', 'proof',
     'Orthogonally invariant spin glasses',
     'Orthogonally invariant Ising spin glasses at every temperature',
     'Claim: an explicit formula for the free energy at every temperature, for couplings $O^{\\mathsf T} D O$ with Haar $O$',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'grid', 'until': 3.8, 'rows': n, 'cols': n, 'cells': [[i, i, 'accent'] for i in range(n)],
          'values': [[f'$d_{i + 1}$' if i == j else '' for j in range(n)] for i in range(n)],
          'caption': '$D$: any spectrum with a compact limit and no outliers'},
         {'primitive': 'equation', 'from': 3.8, 'mode': 'replace', 'lines': [
             {'tex': r'J_{ij}\ \ \text{independent Gaussians}', 'note': 'SK: the solved case', 'at': 0.3, 'tone': 'soft'},
             {'tex': r'J = O^{\mathsf T} D\, O,\ \ O\ \text{Haar orthogonal}', 'note': 'claimed: the pressure at every temperature', 'at': 2.0, 'tone': 'accent'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Pick any spectrum: a diagonal matrix $D$'},
         {'at': 3.9, 'text': 'Rotate it by a random orthogonal $O$: the couplings stop being independent'},
         {'at': 6.4, 'text': 'Claim: an explicit variational formula at every temperature'}]},
     {'form': 'status', 'label': 'Random orthogonal model (Marinari, Parisi and Ritort, 1994)',
      'statement': [r'\lim \tfrac1N \log Z_N = \text{explicit variational formula}', r'\text{every temperature, a.s. and in expectation}'],
      'context': 'Before: high temperature only (Bhattacharya and Sen; Fan and Wu, 2021)',
      'stamp': 'proved',
      'note': 'Also external fields, and the ground-state energy as $T \\to 0$'},
     'Comparator InvariantIsing, a 495-line statement file; not in the main-results list',
     'We did not check the formula against physics, or build the Lean',
     [R('234', 'known_before', 'Marinari, Parisi & Ritort (1994)'),
      R('234', 'known_before', 'Fan & Wu (2021) TAP/RS formula at high temperature'),
      R('234', 'caveats', 'Lean challenge InvariantIsing (Unconditional module, 495-line statement file) with docs/234.md; not in yaml main_results.'),
      A('Orthogonally invariant spin glasses', 'I did not check the formula against the physics predictions.'),
      CP('234'), NOBUILD])

# ---------------------------------------------------------------- 235 ----
spec('235', 'proof',
     'Random $k$-SAT: variance and computability',
     'Limiting random SAT thresholds, sharp variance and computability',
     'Claim: the random $k$-SAT threshold index has variance of order $n$, and the 3-SAT threshold is a computable real',
     {'dur': 8.4, 'primitive': 'plot', 'x': [0, 2], 'y': [0, 1.1], 'xticks': [{'v': 1, 'label': '$\\alpha_k$'}], 'yticks': [0, 1], 'labelRoom': 140,
      'xlabel': 'clause density $\\alpha$', 'ylabel': 'P(satisfiable)',
      'curves': [{'f': '1/(1+exp(5*(x-1)))', 'label': 'smaller $n$', 'tone': 'soft', 'dash': True, 'at': 0.5, 'labelDy': -26},
                 {'f': '1/(1+exp(40*(x-1)))', 'label': 'larger $n$', 'tone': 'accent', 'at': 1.6, 'labelDy': 6}],
      'beats': [
         {'at': 0.2, 'text': 'As the clause density grows, random formulas stop being satisfiable (curves schematic)'},
         {'at': 3.0, 'text': 'A sharp limiting threshold for every $k \\ge 3$: Carenini first, this family second'},
         {'at': 5.6, 'text': 'New here: the variance of the threshold index, and computability of $\\alpha_3$'}]},
     {'form': 'status', 'label': 'Random $k$-SAT beyond the threshold conjecture (Chvátal–Reed 1992)',
      'statement': [r'\mathrm{Var}(H_n) = \Theta_k(n),\ \ k \ge 3', r'\alpha_3 \text{ is a computable real}'],
      'context': 'Threshold existence: Carenini, ECCC TR26-229 (5 Oct 2026), credited with priority',
      'stamp': 'proved',
      'note': 'No value of the 3-SAT threshold is computed'},
     'Comparator statements for existence, variance and computability; not in main results',
     OUR_LEAN,
     [R('235', 'known_before', 'Chvátal & Reed (1992) conjecture'),
      R('235', 'known_before', "Gaia Carenini, ECCC TR26-229 (5 Oct 2026)"),
      R('235', 'claim', 'the hitting time of the first unsatisfiable prefix has variance Θ_k(n) for k≥4 and Θ(n) for k=3; the 3-SAT threshold is a computable real'),
      R('235', 'caveats', 'No value of the 3-SAT threshold is computed.'),
      R('235', 'caveats', 'and computability (SATComputability) all have challenges; not in yaml main_results'),
      CP('235'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 236 ----
pos, edges, kids, lvl, root = regular_tree(3, 3, rx=420, ry=200)
rng = random.Random(236)
tb = 0.6
spin = {root: 1}
for a, b in edges:
    spin[b] = spin[a] if rng.random() < (1 + tb) / 2 else -spin[a]
nodes = [node(f't{i}', x, y, tone='accent' if spin[i] > 0 else 'cool', fill='accent' if spin[i] > 0 else 'cool') for i, (x, y) in pos.items()]
r2 = 1 / math.sqrt(2)
spec('236', 'proof',
     'Factor-of-IID Ising on trees, exactly',
     'The exact factor-of-IID threshold for free Ising spins on trees',
     'Claim: the free Ising state on the $d$-regular tree is a factor of IID exactly when $\\tanh\\beta \\le 1/\\sqrt{d-1}$',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'graph', 'until': 3.8, 'r': 9, 'edgeAt': 0.3, 'edgeDur': 2.2, 'nodes': nodes,
          'edges': [[f't{a}', f't{b}', {'tone': 'soft', 'w': 2}] for a, b in edges]},
         {'primitive': 'numberline', 'from': 3.8, 'min': 0, 'max': 1, 'ticks': [0, 1], 'axisLabel': '$\\tanh\\beta$ on the 3-regular tree',
          'ranges': [{'from': 0, 'to': round(r2, 10), 'derived': '1/sqrt(2)', 'label': 'a factor of IID', 'note': 'claimed, endpoint too', 'tone': 'claim', 'at': 1.0},
                     {'from': round(r2, 10), 'to': 1, 'derived': '1/sqrt(2)', 'label': 'not a factor', 'note': 'known (2022)', 'tone': 'old', 'at': 0.5}],
          'markers': [{'v': round(r2, 10), 'derived': '1/sqrt(2)', 'label': '$1/\\sqrt{d-1}$', 'note': 'at $d = 3$', 'tone': 'claim', 'at': 1.6, 'side': 'below'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Free Ising spins on the 3-regular tree: each child copies its parent with bias $\\tanh\\beta$'},
         {'at': 3.9, 'text': 'A factor of IID: the spins built by one rule from independent coin flips'},
         {'at': 6.4, 'text': 'Claim: possible exactly up to $\\tanh\\beta = 1/\\sqrt{d-1}$, equality included'}]},
     {'form': 'status', 'label': 'Nam–Sly–Zhang conjecture (after a question of Lyons)',
      'statement': [r'\text{factor of IID} \iff \tanh\beta \le 1/\sqrt{d-1}'],
      'context': 'Before: the converse, and factors up to a smaller threshold (Nam, Sly and Zhang, 2022)',
      'stamp': 'proved',
      'note': 'Ferromagnetic, zero field, $d \\ge 3$; finitary coding not covered'},
     "In the release's main formal results (FreeIsing), standard axioms",
     OUR_LEAN,
     [R('236', 'claim', 'is a factor of IID iff tanh β ≤ 1/√(d-1) (including equality)'),
      R('236', 'known_before', "Nam, Sly & Zhang ('Ising model on trees and factors of IID', 2022) proved the converse and FIID up to a smaller threshold, and conjectured the sharp threshold"),
      R('236', 'caveats', 'In yaml main_results (FreeIsing, OAI.Problem367.free_ising_factor_iff_threshold, standard axioms)'),
      R('236', 'caveats', 'Ferromagnetic case only. Finitary coding not covered.'),
      CP('236'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 237 ----
Lh = 30
hp = []
for j in range(-12, 14):
    for i in range(-14, 16):
        x = i * math.sqrt(3) * Lh + (j % 2) * math.sqrt(3) / 2 * Lh
        y = j * 1.5 * Lh
        hp.append((x, y)); hp.append((x, y + Lh))
cxp, cyp = 544, 224
hp = [(x + cxp, y + cyp) for x, y in hp if 14 <= x + cxp <= 1074 and 10 <= y + cyp <= 438]
hp = sorted(set((round(x, 3), round(y, 3)) for x, y in hp))
idx = {p: k for k, p in enumerate(hp)}
nbr = {k: [] for k in range(len(hp))}
for a in range(len(hp)):
    for b in range(a + 1, len(hp)):
        if abs(math.hypot(hp[a][0] - hp[b][0], hp[a][1] - hp[b][1]) - Lh) < 0.5:
            nbr[a].append(b); nbr[b].append(a)
start = min(range(len(hp)), key=lambda k: math.hypot(hp[k][0] - cxp, hp[k][1] - cyp))
rng = random.Random(237)
walk = None
for attempt in range(5000):
    w = [start]; seen = {start}
    while len(w) < 46:
        opts = [b for b in nbr[w[-1]] if b not in seen]
        if not opts: break
        b = rng.choice(opts); w.append(b); seen.add(b)
    if len(w) == 46: walk = w; break
assert walk
wset = set(walk)
near = [k for k in range(len(hp)) if k not in wset and min(math.hypot(hp[k][0] - hp[w][0], hp[k][1] - hp[w][1]) for w in walk) < 1.05 * Lh]
near.sort(key=lambda k: hp[k][0])
hn = [node(f'h{k}', hp[k][0], hp[k][1], tone='ink' if k == start else 'accent') for k in walk]
hn += [node(f'h{k}', hp[k][0], hp[k][1], tone='faint') for k in near]
hw = [[f'h{walk[i]}', f'h{walk[i + 1]}', {'tone': 'accent', 'w': 3}] for i in range(len(walk) - 1)]
print('237 nodes', len(hn))
spec('237', 'proof',
     'The 3/4 exponent for self-avoiding walk',
     'The three-quarter exponent for honeycomb self-avoiding walk',
     'Claim: a uniform $n$-step self-avoiding walk on the honeycomb lattice has diameter $n^{3/4+o(1)}$',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'graph', 'until': 4.4, 'r': 3, 'edgeAt': 0.0, 'edgeDur': 2.26, 'nodes': hn, 'edges': hw},
         {'primitive': 'numberline', 'from': 4.4, 'min': 0, 'max': 1.2, 'ticks': [0, 1], 'axisLabel': 'the exponent $\\nu$ in diameter $\\approx n^{\\nu}$',
          'markers': [{'v': 1, 'label': 'ballistic', 'note': '$o(n)$ proved, 2013', 'at': 0.4}],
          'slide': {'from': 1, 'to': 0.75, 'derived': '3/4', 'at': 1.2, 'dur': 1.5, 'label': 'claimed $3/4$', 'note': 'Flory predicted, 1949'}}],
      'beats': [
         {'at': 0.2, 'text': 'A self-avoiding walk on the honeycomb lattice never revisits a site (one sample)'},
         {'at': 4.5, 'text': 'Physics says its size grows like $n^{3/4}$; proofs had only sub-ballistic bounds'},
         {'at': 6.9, 'text': 'Claim: $n^{3/4+o(1)}$, in 1,067 pages'}]},
     {'form': 'status', 'label': 'Flory (1949) and Nienhuis (1982): $\\nu = 3/4$ in the plane',
      'statement': [r'\text{diameter of an } n\text{-step walk} = n^{3/4 + o(1)}'],
      'context': 'Before: only sub-ballisticity (Duminil-Copin–Hammond 2013); the honeycomb constant (2012)',
      'stamp': 'proved',
      'note': 'Honeycomb lattice only; an $o(1)$ exponent, not a scaling limit'},
     'Lean: strip-crossing mass, free energy, bridge sums; not the $3/4$ law',
     OUR_LEAN,
     [R('237', 'known_before', 'Flory (1949) and Nienhuis (PRL 1982) predicted ν=3/4 in 2D'),
      R('237', 'known_before', "Duminil-Copin–Hammond's sub-ballisticity (2013)"),
      R('237', 'known_before', 'Duminil-Copin & Smirnov (Annals 2012) connective constant'),
      R('237', 'caveats', '1067 pages in 13 papers'),
      R('237', 'caveats', 'Lean formalizes only supporting summability statements, the free energy, and the strip-crossing mass ≍ N^{-1/4}; the 3/4 law itself is not formalized.'),
      CP('237'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 238 ----
spec('238', 'proof',
     'The Thorp shuffle mixes in $\\Theta(\\log N)$',
     'Optimal logarithmic mixing of the Thorp shuffle',
     'Claim: the Thorp shuffle on $N = 2^d$ cards mixes in $\\Theta(d)$ shuffles, from any starting order',
     {'dur': 8.8, 'layout': 'sequence', 'panels': [
         {'primitive': 'plot', 'until': 4.6, 'x': [0, 5], 'y': [0, 1.15], 'xticks': [0, 1, 2, 3, 4, 5], 'yticks': [0, {'v': 0.25, 'label': '1/4'}, 1],
          'labelRoom': 230, 'xlabel': 'shuffles, 8 cards', 'ylabel': 'distance from uniform',
          'curves': [{'f': 'max(0, 1 - pow(2, 4*x)/40320)', 'label': 'floor $1 - 2^{tn/2}/n!$', 'tone': 'soft', 'dash': True, 'at': 0.4, 'dur': 1.4}],
          'asymptotes': [{'y': 0.25, 'at': 2.6}],
          'points': [{'x': 0, 'y': 1, 'label': '1.0000', 'at': 1.2, 'tone': 'accent'}, {'x': 1, 'y': 0.9996, 'label': '0.9996', 'at': 1.4, 'tone': 'accent'},
                     {'x': 2, 'y': 0.9937, 'label': '0.9937', 'at': 1.6, 'tone': 'accent'}, {'x': 3, 'y': 0.8984, 'label': '0.8984', 'at': 1.8, 'tone': 'accent'}]},
         {'primitive': 'numberline', 'from': 4.6, 'min': 0, 'max': 46, 'ticks': [0, 10, 20, 30, 40], 'axisLabel': 'the exponent $e$ in a bound $O(d^{e})$ on shuffles',
          'markers': [{'v': 44, 'label': 'Morris', 'note': '2008', 'at': 0.3}, {'v': 29, 'label': 'Montenegro–Tetali', 'at': 0.6},
                      {'v': 3, 'label': 'Morris', 'note': '2013', 'at': 0.9}],
          'slide': {'from': 3, 'to': 1, 'at': 1.6, 'dur': 1.4, 'label': 'claimed', 'note': '$\\Theta(d)$'}}],
      'beats': [
         {'at': 0.2, 'text': 'Exact distances on 8 cards: each sits on the coin-count floor until it drops to zero'},
         {'at': 4.7, 'text': 'For $N = 2^d$ cards the best bound fell from $O(d^{44})$ to $O(d^3)$'},
         {'at': 6.6, 'text': 'Claim: $\\Theta(d)$ suffices; $1600d$ shuffles, with a lower bound near $2d$'}]},
     {'form': 'bound',
      'before': {'label': 'Best known, 2013', 'tex': r'O(d^3)', 'note': 'Morris; conjectured: $O(d)$'},
      'after': {'label': 'Claimed, 26 Sep 2026', 'tex': r'\Theta(d)', 'note': '$= \\Theta(\\log N)$; after $1600d$ shuffles'},
      'note': "Power-of-two decks only; Lean's route needs 16,040,400$\\,d$ steps"},
     'Thirteen Comparator statements; one states the $\\Theta(\\log N)$ order directly',
     'We recomputed the 8-card distances; we did not build the Lean',
     [R('238', 'known_before', 'Morris (2008, SIAM J. Comput.) O(d^44); Montenegro & Tetali O(d^29)'),
      R('238', 'known_before', 'Morris (2013) O(d^3)'),
      R('238', 'claim', 'after 1600d shuffles the full permutation law tends to uniform as d→∞; support counting gives a 2d-O(1) lower bound'),
      R('238', 'caveats', 'the formalized full-deck bound uses 16,040,400·d steps, not 1600d'),
      R('238', 'caveats', 'Power-of-two decks only.'),
      A('The Thorp shuffle mixes in Θ(log n) steps', 'On 8 cards the distance is 1.0000, 0.9996, 0.9937 and 0.8984 after 0 to 3 shuffles, exactly the coin-count floor each time'),
      A('The Thorp shuffle mixes in Θ(log n) steps', 'by pushing all $8! = 40{,}320$ orderings through every coin pattern'),
      A('The Thorp shuffle mixes in Θ(log n) steps', 'Thirteen Comparator statements cover this family'),
      A('How I checked', 'the Thorp shuffle distances over all $8!$ orderings'),
      CP('238'), NOBUILD])

# ---------------------------------------------------------------- 239 ----
rng = random.Random(239)
n = 6
while True:
    M = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i, n):
            M[i][j] = M[j][i] = rng.choice([-1, 1])
    i0, j0 = 1, 4
    a = M[i0][j0]
    M[i0][i0] = M[j0][j0] = a
    for k in range(n):
        if k not in (i0, j0):
            M[j0][k] = M[k][j0] = M[i0][k]
    A_ = np.array(M, dtype=float)
    if (A_ == A_.T).all() and abs(np.linalg.det(A_)) < 1e-9 and list(A_[i0]) == list(A_[j0]):
        # other rows should not repeat, so the picture has one reason
        if len({tuple(r) for r in M}) == n - 1: break
vals = [['1' if v > 0 else '−1' for v in row] for row in M]
spec('239', 'proof',
     'Symmetric sign matrices: singular at rate $(1/2)^n$',
     'Sharp singularity rates for symmetric random sign matrices',
     'Claim: a random symmetric $\\pm 1$ matrix is singular with probability $(1/2 + o(1))^n$',
     {'dur': 8.4, 'primitive': 'grid', 'rows': n, 'cols': n, 'values': vals,
      'cells': [[i0, k, 'accent'] for k in range(n)] + [[j0, k, 'accent'] for k in range(n)],
      'blocks': [{'r': i0, 'c': 0, 'h': 1, 'w': n, 'label': 'row 2', 'at': 1.4}, {'r': j0, 'c': 0, 'h': 1, 'w': n, 'label': 'row 5, the same', 'at': 2.0}],
      'caption': 'a symmetric sign matrix with two equal rows: $\\det A = 0$',
      'beats': [
         {'at': 0.2, 'text': 'Independent $\\pm 1$ entries on and above the diagonal, mirrored below'},
         {'at': 2.8, 'text': 'Two equal rows already make it singular, with probability about $2^{-n}$'},
         {'at': 5.5, 'text': 'Claim: nothing else matters at exponential scale'}]},
     {'form': 'bound',
      'before': {'label': 'Best known (2021)', 'tex': r'e^{-cn}', 'note': 'Campos, Jenssen, Michelen and Sahasrabudhe'},
      'after': {'label': 'Claimed, 3 Oct 2026', 'tex': r'(\tfrac{1}{2} + o(1))^n', 'note': 'matches two equal rows'},
      'note': 'For bias $p \\ne 1/2$: $(p^2 + (1-p)^2 + o(1))^n$, again from two equal rows'},
     'No Lean statement; a 101-page manuscript',
     OUR_NONE,
     [R('239', 'claim', 'P(det A_n=0)=(1/2+o(1))^n for unbiased signs, and (p^2+(1-p)^2+o(1))^n for bias p≠1/2, the latter attained by two equal rows'),
      R('239', 'known_before', 'Campos, Jenssen, Michelen & Sahasrabudhe (arXiv 2021) exp(-cn)'),
      R('239', 'caveats', 'the unbiased constant 1/2 matches the natural lower bound from two equal rows/columns (probability ~2^{-n})'),
      A('Symmetric sign matrices are singular at rate (1/2)^n', '101 pages, no Lean.'),
      CP('239'), READ_ALL])
print('prob2 ok')
