from common import *
import heapq
import numpy as np


def regular_tree(depth, deg=3, cx=544, cy=224, rx=250, ry=200, r0=None):
    """deg-regular tree from a root, laid out radially by leaves."""
    nodes, edges, kids = [], [], {}
    nid = [0]
    def mk(parent, d):
        i = nid[0]; nid[0] += 1
        kids[i] = []
        if parent is not None: kids[parent].append(i)
        if d < depth:
            for _ in range(deg if parent is None else deg - 1): mk(i, d + 1)
        return i
    root = mk(None, 0)
    leaves = []
    def collect(i):
        if not kids[i]: leaves.append(i)
        for k in kids[i]: collect(k)
    collect(root)
    ang, lvl = {}, {}
    for j, l in enumerate(leaves): ang[l] = 2 * math.pi * (j + 0.5) / len(leaves)
    def fill(i, d):
        lvl[i] = d
        for k in kids[i]: fill(k, d + 1)
        if kids[i]: ang[i] = sum(ang[k] for k in kids[i]) / len(kids[i])
    fill(root, 0)
    pos = {}
    for i in kids:
        rr = lvl[i] / depth
        pos[i] = (cx + rx * rr * math.cos(ang[i] - math.pi / 2), cy + ry * rr * math.sin(ang[i] - math.pi / 2))
    order = sorted(kids, key=lambda i: lvl[i])
    for i in order:
        for k in kids[i]: edges.append((i, k))
    edges.sort(key=lambda e: lvl[e[1]])
    return pos, edges, kids, lvl, root


# ---------------------------------------------------------------- 211 ----
spec('211', 'proof',
     'Random planar maps: surfaces and trees',
     'The geometric phase diagram of random planar maps',
     'Claim: FK planar maps converge to CLE-decorated Liouville quantum gravity for $q < 4$, and to a tree for $q > 4$',
     {'dur': 8.6, 'primitive': 'numberline', 'min': 0, 'max': 8, 'y': 0.56, 'ticks': [0, 2, 4, 6, 8],
      'axisLabel': 'the cluster weight $q$ of the FK model',
      'ranges': [{'from': 0, 'to': 4, 'label': 'LQG sphere + CLE', 'note': '$0 < q < 4$', 'tone': 'claim', 'at': 0.8, 'side': 'above'},
                 {'from': 4, 'to': 8, 'label': 'Brownian tree', 'note': 'the part in Lean', 'tone': 'cool', 'at': 2.6, 'side': 'above'}],
      'markers': [{'v': 4, 'label': 'critical LQG', 'note': 'with $\\mathrm{CLE}_4$', 'tone': 'claim', 'at': 4.2, 'side': 'below'},
                  {'v': 2, 'label': 'FK–Ising', 'note': 'walk $\\to$ LBM', 'tone': 'hot', 'at': 5.6, 'side': 'above'}],
      'beats': [
         {'at': 0.2, 'text': 'Random planar maps decorated by FK clusters: discrete random surfaces'},
         {'at': 2.8, 'text': 'Claim: for $q < 4$ they converge to Liouville quantum gravity; past $q = 4$, to a tree'},
         {'at': 5.6, 'text': 'At $q = 2$, random walk on the map becomes Liouville Brownian motion'}]},
     {'form': 'status', 'label': 'Gwynne–Miller conjecture, finite spherical cases',
      'statement': [r'\text{FK maps} \to \text{CLE-decorated LQG sphere},\ \ 0 < q < 4',
                    r'q > 4:\ \ \text{the Brownian continuum random tree}'],
      'context': 'Before: a peanosphere limit (Sheffield 2016); walk limits only on mated-CRT maps',
      'stamp': 'proved',
      'note': '762 pages in 7 papers; the spectral results rest on stated inputs'},
     'Lean covers only the $q > 4$ tree limit, the least novel regime',
     OUR_LEAN,
     [R('211', 'known_before', 'Sheffield (Ann. Probab. 2016) hamburger–cheeseburger bijection and peanosphere limit'),
      R('211', 'known_before', 'Random-walk convergence to LBM known only for mated-CRT maps'),
      R('211', 'caveats', "762 pages across 7 papers that cite each other"),
      R('211', 'caveats', "the spectral results are explicitly conditional on 'stated Brownian/LQG inputs'"),
      R('211', 'caveats', 'Lean (docs/211.md, FKCRT) covers only the q>4 CRT limit — the least novel regime.'),
      CP('211'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 212 ----
rng = random.Random(212)
R_, C_ = 6, 12
W_ = [[rng.randint(1, 9) for _ in range(C_)] for _ in range(R_)]
dist = {(r, 0): W_[r][0] for r in range(R_)}; prev = {}
pq = [(d, k) for k, d in dist.items()]; heapq.heapify(pq)
while pq:
    d, (r, c) = heapq.heappop(pq)
    if d > dist[(r, c)]: continue
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        rr, cc = r + dr, c + dc
        if 0 <= rr < R_ and 0 <= cc < C_:
            nd = d + W_[rr][cc]
            if nd < dist.get((rr, cc), 1e9): dist[(rr, cc)] = nd; prev[(rr, cc)] = (r, c); heapq.heappush(pq, (nd, (rr, cc)))
end = min(((r, C_ - 1) for r in range(R_)), key=lambda k: dist[k])
path = [end]
while path[-1] in prev: path.append(prev[path[-1]])
spec('212', 'proof',
     'No bigeodesics in planar first passage',
     'Planar first-passage percolation has no bigeodesics',
     'Claim: with iid random edge times on $\\mathbb Z^2$, no doubly infinite fastest route exists, almost surely',
     {'dur': 8.4, 'primitive': 'grid', 'rows': R_, 'cols': C_, 'values': W_, 'cells': [[r, c, 'accent'] for r, c in path],
      'caption': 'travel times on a small grid; the fastest route across, computed',
      'beats': [
         {'at': 0.2, 'text': 'Random travel times on a lattice; the fastest route across is lit (a small instance)'},
         {'at': 3.0, 'text': 'A bigeodesic is a fastest route that runs to infinity in both directions'},
         {'at': 5.7, 'text': 'Claim: on $\\mathbb Z^2$ there are none, almost surely'}]},
     {'form': 'status', 'label': 'Bigeodesic question (Furstenberg, via Kesten 1986)',
      'statement': [r'\text{no bi-infinite geodesic in planar FPP, almost surely}'],
      'context': 'Before: none in fixed directions, under curvature assumptions (Damron–Hanson 2017)',
      'stamp': 'proved',
      'note': 'Needs nonatomic weights whose minimum of four has a finite second moment'},
     'Lean: differentiability of the time constant for Gamma weights; not the no-bigeodesics claim',
     OUR_LEAN,
     [R('212', 'known_before', 'Bigeodesic question goes back to Furstenberg (via Kesten 1986)'),
      R('212', 'known_before', 'Damron–Hanson (CMP 2017) no bigeodesics in fixed directions under curvature assumptions'),
      R('212', 'claim', 'assuming the minimum of four independent weights has a finite second moment, has a.s. no bi-infinite geodesic'),
      R('212', 'caveats', 'formalizes the differentiability of the time constant for Gamma weights only; strict convexity and no-bigeodesics are not formalized'),
      CP('212'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 213 ----
spec('213', 'proof',
     '$\\theta(p_c) = 0$ on quasi-transitive graphs',
     'No percolation at criticality on every quasi-transitive graph',
     'Claim: at $p_c$ there is no infinite cluster, on $\\mathbb Z^3$ and on every quasi-transitive graph with $p_c < 1$',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'numberline', 'until': 4.4, 'min': 0, 'max': 10, 'ticks': [{'v': 0, 'label': '0'}, {'v': 10, 'label': '1'}],
          'axisLabel': 'edge probability $p$, schematically',
          'ranges': [{'from': 0, 'to': 5, 'label': 'all clusters finite', 'tone': 'cool', 'at': 0.6, 'side': 'above'},
                     {'from': 5, 'to': 10, 'label': 'an infinite cluster', 'at': 1.1, 'side': 'above'}],
          'markers': [{'v': 5, 'label': '$p = p_c$', 'note': 'claimed: none', 'tone': 'claim', 'at': 2.0, 'style': 'ring'}]},
         {'primitive': 'equation', 'from': 4.4, 'mode': 'stack', 'lines': [
             {'tex': r'\mathbb P(o \leftrightarrow A,\ o \leftrightarrow T) \;\ge\; \mathbb P(o \leftrightarrow A)\,\min_{a \in A} \mathbb P(a \leftrightarrow T)', 'at': 0.3, 'tone': 'ink', 'size': 36}]}],
      'beats': [
         {'at': 0.2, 'text': 'Keep each edge with probability $p$: below $p_c$ clusters are finite, above, one is infinite'},
         {'at': 2.8, 'text': 'The question that defines the field: what happens exactly at $p_c$?'},
         {'at': 4.5, 'text': 'The finite tool is a relay inequality: reach $A$, then go on from the worst point of $A$'}]},
     {'form': 'status', 'label': 'Benjamini–Schramm criticality conjecture (1996), bond form',
      'statement': [r'\theta(p_c) = 0\ \text{ on every quasi-transitive graph with } p_c < 1'],
      'context': 'Before: $\\mathbb Z^2$, $d \\ge 11$, exponential growth; $\\mathbb Z^3$ fell weeks earlier to other AI-assisted work',
      'stamp': 'proved',
      'note': 'Priority for the lattice case belongs elsewhere; the general theorem is new'},
     "Comparator statements for both; the cubic one is in the release's main results",
     'We read the cubic statement line by line; we did not build it',
     [R('213', 'known_before', 'Benjamini & Schramm (1996) Conjecture 4.'),
      R('213', 'known_before', 'd≥11 Fitzner–van der Hofstad 2017'),
      A('θ(p_c) = 0, and who got there first', 'Priority for the lattice case belongs elsewhere.'),
      A('θ(p_c) = 0, and who got there first', '\\mathbb P(o \\leftrightarrow A,\\ o \\leftrightarrow T) \\;\\ge\\; \\mathbb P(o \\leftrightarrow A)\\,\\min_{a \\in A} \\mathbb P(a \\leftrightarrow T)'),
      A('θ(p_c) = 0, and who got there first', 'Both theorems have Comparator statements, and the cubic one is listed among the release\'s main formal results. I read the statement line by line.'),
      CP('213'), NOBUILD])

# ---------------------------------------------------------------- 214 ----
pos, edges, kids, lvl, root = regular_tree(3, 3, rx=420, ry=200)
nodes = [node(f't{i}', x, y, tone='ink' if i == root else 'soft') for i, (x, y) in pos.items()]
spec('214', 'proof',
     '$p_c < p_u$ on nonamenable graphs',
     'The Benjamini–Schramm nonuniqueness conjecture',
     'Claim: on every nonamenable quasi-transitive graph, $p_c < p_u$: some $p$ has infinitely many infinite clusters',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'graph', 'until': 3.8, 'r': 8, 'edgeAt': 0.3, 'edgeDur': 2.2, 'nodes': nodes,
          'edges': [[f't{a}', f't{b}', {'tone': 'soft', 'w': 2}] for a, b in edges]},
         {'primitive': 'numberline', 'from': 3.8, 'min': 0, 'max': 10, 'ticks': [{'v': 0, 'label': '0'}, {'v': 10, 'label': '1'}],
          'axisLabel': 'edge probability $p$, schematically',
          'markers': [{'v': 3, 'label': '$p_c$', 'at': 0.5}, {'v': 5, 'label': '$p_{2\\to 2}$', 'tone': 'claim', 'at': 0.9}, {'v': 7, 'label': '$p_u$', 'at': 1.3}],
          'ranges': [{'from': 3, 'to': 7, 'label': 'infinitely many infinite clusters', 'tone': 'claim', 'at': 1.9, 'side': 'above'}]}],
      'beats': [
         {'at': 0.2, 'text': 'A tree-like graph: its boundary grows as fast as its volume'},
         {'at': 3.9, 'text': 'Between $p_c$ and $p_u$, infinitely many infinite clusters coexist'},
         {'at': 6.4, 'text': 'Claim: that window is nonempty on every such graph'}]},
     {'form': 'status', 'label': 'Benjamini–Schramm conjecture (1996)',
      'statement': [r'p_c < p_{2\to2} \le p_u', r'\text{on every nonamenable quasi-transitive graph}'],
      'context': 'Before: special classes, such as Gromov hyperbolic graphs (Hutchcroft, 2019)',
      'stamp': 'proved',
      'note': 'Every Cayley graph, any generators: earlier results chose the generators'},
     'Comparator BenjaminiSchramm.lean, standard axioms; not in the main-results list',
     OUR_FAITH,
     [R('214', 'known_before', 'Benjamini & Schramm (1996) Conjecture 6.'),
      R('214', 'known_before', 'Gromov hyperbolic and nonunimodular graphs (Hutchcroft 2019–20'),
      R('214', 'claim', 'p_c < p_{2→2} ≤ p_u'),
      R('214', 'caveats', 'Lean challenge BenjaminiSchramm/CayleyPercolation with docs/214.md (standard axioms) but not in yaml main_results.'),
      A('p_c < p_u on every nonamenable graph', 'which is the point: earlier group-theoretic results let you pick the generators'),
      CP('214'), READ_FAITHFUL, NOBUILD])

# ---------------------------------------------------------------- 215 ----
spec('215', 'proof',
     "Polyakov's mass gap for 2D $O(n)$ models",
     "Polyakov's mass gap and the $O(3)$ continuum limit",
     'Claim: 2D $O(n)$ spin correlations decay exponentially at every temperature, for every $n \\ge 3$',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'plot', 'until': 4.6, 'x': [0, 10], 'y': [0, 1.05], 'xticks': [], 'yticks': [], 'labelRoom': 210,
          'xlabel': 'distance $r$', 'ylabel': 'correlation',
          'curves': [{'f': 'pow(x+1,-0.25)', 'label': '$n = 2$: power law', 'tone': 'soft', 'dash': True, 'at': 0.5},
                     {'f': 'exp(-0.6*x)', 'label': '$n \\ge 3$: $A e^{-m r}$', 'tone': 'accent', 'at': 1.6}]},
         {'primitive': 'equation', 'from': 4.6, 'mode': 'replace', 'lines': [
             {'tex': r'm_{\mathrm{lat}}(\beta) \sim 32\, e^{\pi/4 - 1/2}\, \sqrt{\beta}\, e^{-\pi\beta}', 'note': 'also claimed: the exact square-lattice $O(4)$ gap', 'at': 0.3, 'tone': 'accent'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Schematically: for $n = 2$ correlations decay like a power, for $n \\ge 3$ exponentially'},
         {'at': 2.8, 'text': 'Polyakov, 1975: a mass gap from nothing, at every temperature however low'},
         {'at': 4.7, 'text': 'The form Hasenfratz, Maggiore and Niedermayer predicted from the Bethe ansatz'}]},
     {'form': 'status', 'label': "Polyakov's mass-generation conjecture (1975), spin-correlation form",
      'statement': [r'\langle s_x \cdot s_y \rangle \le A\, e^{-m\,|x-y|}', r'\text{every } n \ge 3,\ \text{every } \beta > 0'],
      'context': "Before: only high temperature or large $n$ (Kupiainen's $1/n$ expansion)",
      'stamp': 'proved',
      'note': 'The $O(3)$ continuum limit and $O(4)$ asymptotics are a larger, separate claim'},
     "The 20-page decay theorem is in Lean's main results; the continuum and $O(4)$ parts are not",
     OUR_FAITH,
     [R('215', 'known_before', 'Polyakov (1975) asymptotic freedom/mass generation; Kupiainen (1980) 1/n expansion'),
      R('215', 'caveats', 'The 20-page exponential-decay theorem is formalized (ClassicalON, in yaml main_results'),
      A("Polyakov's mass gap for the 2D O(n) models", 'm_{\\mathrm{lat}}(\\beta) \\sim 32\\, e^{\\pi/4 - 1/2}\\, \\sqrt{\\beta}\\, e^{-\\pi\\beta},'),
      A("Polyakov's mass gap for the 2D O(n) models", 'which is the form Hasenfratz, Maggiore and Niedermayer predicted in 1990 from the Bethe ansatz'),
      CP('215'), READ_FAITHFUL, NOBUILD])

# ---------------------------------------------------------------- 216 ----
spec('216', 'proof',
     'The XY model: BKT fine structure',
     'Critical and near-critical XY scaling and BKT universality',
     'Claim: critical XY correlations decay as $r^{-1/4}(\\log r)^{1/8}$, with the BKT essential singularity',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'plot', 'until': 4.6, 'x': [2, 60], 'y': [0, 1], 'xticks': [], 'yticks': [], 'labelRoom': 230,
          'xlabel': 'distance $r$', 'ylabel': 'critical correlation $C(r)$',
          'curves': [{'f': 'pow(x,-0.25)', 'label': '$r^{-1/4}$', 'tone': 'soft', 'dash': True, 'at': 0.5, 'labelDy': 14},
                     {'f': 'pow(x,-0.25)*pow(log(x),0.125)', 'label': '$r^{-1/4}(\\log r)^{1/8}$', 'tone': 'accent', 'at': 1.6, 'labelDy': -12}]},
         {'primitive': 'equation', 'from': 4.6, 'mode': 'replace', 'lines': [
             {'tex': r'\sqrt{\beta_c - \beta}\;\log\frac{1}{m(\beta)} \;\longrightarrow\; A > 0', 'note': 'the BKT essential singularity', 'at': 0.3, 'tone': 'accent'}]}],
      'beats': [
         {'at': 0.2, 'text': 'At the critical point the power law carries a slow logarithmic correction (curves schematic)'},
         {'at': 4.7, 'text': 'Near $\\beta_c$ the correlation length blows up like $\\exp(c/\\sqrt{\\beta_c - \\beta})$'},
         {'at': 7.0, 'text': 'Predicted by Kosterlitz in 1974'}]},
     {'form': 'status', 'label': 'BKT fine structure (Kosterlitz 1974)',
      'statement': [r'C(r) = B\, r^{-1/4}(\log r)^{1/8}\,(1 + o(1))', r'\sqrt{\beta_c - \beta}\,\log(1/m(\beta)) \to A > 0'],
      'context': 'Before: the BKT phase exists (Fröhlich–Spencer 1981); the fine structure was open',
      'stamp': 'proved',
      'note': 'Two of the six papers assume inputs from their companions'},
     'No Lean statement; 461 pages in six papers',
     OUR_NONE,
     [R('216', 'claim', 'critical correlation C(r)=B r^{-1/4}(log r)^{1/8}(1+o(1))'),
      R('216', 'known_before', 'Berezinskii (1971), Kosterlitz–Thouless (1973), Kosterlitz (1974) RG; Fröhlich & Spencer (CMP 1981) existence of the BKT phase'),
      R('216', 'caveats', '461 pages, 6 papers'),
      A("The XY model's fine structure", 'Two of the six papers (center magnetization and the critical spin field) say outright that they assume inputs from the companions.'),
      CP('216'), READ_ALL])

# ---------------------------------------------------------------- 217 ----
spec('217', 'proof',
     'Low-temperature SK fluctuations',
     'The low-temperature Sherrington–Kirkpatrick fluctuation law',
     'Claim: for every $\\beta > 1$, $\\mathrm{Var}\\log Z_n \\sim c_\\beta n^{1/3}$, with a nondegenerate limit law',
     {'dur': 8.4, 'primitive': 'numberline', 'min': 0, 'max': 1.2, 'ticks': [{'v': 0, 'label': '0'}, {'v': 1, 'label': '1'}],
      'axisLabel': 'the exponent $e$ in $\\mathrm{Var}\\log Z_n \\approx n^{e}$, at $\\beta > 1$',
      'markers': [{'v': 1, 'label': 'Chatterjee', 'note': 'proved: $o(n)$', 'at': 0.6},
                  {'v': 0.3333333333, 'derived': '1/3', 'label': 'physics', 'note': 'predicted $n^{1/3}$', 'style': 'ring', 'tone': 'mute', 'at': 1.2, 'side': 'above'}],
      'slide': {'from': 1, 'to': 0.3333333333, 'derived': '1/3', 'at': 3.0, 'dur': 1.6, 'label': 'claimed $1/3$', 'note': 'standard deviation $n^{1/6}$'},
      'beats': [
         {'at': 0.2, 'text': 'How much does the SK free energy $\\log Z_n$ fluctuate from sample to sample?'},
         {'at': 2.9, 'text': 'Physicists predicted variance $n^{1/3}$; superconcentration proved only $o(n)$'},
         {'at': 5.6, 'text': 'Claim: exactly $c_\\beta n^{1/3}$, with a limit law, not identified with a named one'}]},
     {'form': 'bound',
      'before': {'label': 'Best known (Chatterjee)', 'tex': r'\mathrm{Var}\log Z_n = o(n)', 'note': 'superconcentration'},
      'after': {'label': 'Claimed, 24 Sep 2026', 'tex': r'\sim c_\beta\, n^{1/3}', 'note': 'standard deviation $n^{1/6}$; every fixed $\\beta > 1$'},
      'note': 'Zero-field Gaussian SK only; the limit law is characterized but not explicit'},
     'No Lean statement; 206 pages',
     OUR_NONE,
     [R('217', 'claim', 'Var(log Z_n) ~ c_β n^{1/3} with c_β>0 (so standard deviation n^{1/6})'),
      R('217', 'known_before', 'Chatterjee (superconcentration, 2009/2014): o(n) variance bounds at low temperature'),
      R('217', 'known_before', 'Parisi & Rizzo (2008–2010) predicted n^{1/6}'),
      R('217', 'caveats', "No formalization; limiting law 'uniquely characterized' but not explicit (not identified with a known distribution). Zero-field Gaussian couplings only."),
      A('Low-temperature SK fluctuations', '206 pages, no Lean.'),
      CP('217'), READ_ALL])

# ---------------------------------------------------------------- 218 ----
rng = random.Random(218)
cols, rows = 10, 5
sx, sy = 1088 / (cols + 1), 448 / (rows + 0.6)
nodes, edges = [], []
for r in range(rows):
    for c in range(cols):
        nodes.append(node(f'{r}_{c}', sx * (c + 1), sy * (r + 0.8), tone='soft'))
for r in range(rows):
    for c in range(cols):
        for rr, cc in ((r, c + 1), (r + 1, c)):
            if rr < rows and cc < cols:
                strong = rng.random() < 0.5
                edges.append([f'{r}_{c}', f'{rr}_{cc}', {'tone': 'accent' if strong else 'cool', 'w': 3.2 if strong else 1.6, 'a': 0.9 if strong else 0.7}])
spec('218', 'proof',
     'Ising universality under weak disorder',
     'Conformal universality for weak and random-bond Ising models',
     'Claim: weakly perturbed and weakly disordered 2D Ising models keep conformally invariant critical limits',
     {'dur': 8.4, 'primitive': 'graph', 'r': 6, 'edgeAt': 0.3, 'edgeDur': 3.0, 'nodes': nodes, 'edges': edges,
      'beats': [
         {'at': 0.2, 'text': 'Square-lattice Ising with weak random bonds $J_e = 1 + \\varepsilon\\xi_e$ (a small instance)'},
         {'at': 3.2, 'text': "Smirnov's exact observable needs the clean nearest-neighbour model"},
         {'at': 5.7, 'text': 'Claim: weak disorder still gives $\\mathrm{SLE}_3$ interfaces, in probability over bonds'}]},
     {'form': 'status', 'label': 'Conformal universality beyond the exactly solvable Ising model',
      'statement': [r'\text{weak perturbations or weak bond disorder:}', r'\text{critical interfaces} \to \mathrm{SLE}_3'],
      'context': 'Before: nearest-neighbour Ising on isoradial graphs (Smirnov 2010; Chelkak–Smirnov 2012)',
      'stamp': 'proved',
      'note': 'Perturbative only: sufficiently weak interactions and disorder'},
     'Lean covers only a finite-graph comparison lemma',
     OUR_LEAN,
     [R('218', 'claim', 'with weak iid bond disorder J_e=1+εξ_e (any bounded nondegenerate mean-zero law) critical interfaces converge to SLE_3 in probability over environments'),
      R('218', 'known_before', 'Smirnov (Annals 2010) and Chelkak–Smirnov (Invent. 2012) for nearest-neighbor Ising on isoradial graphs'),
      R('218', 'caveats', 'Perturbative (sufficiently weak) only.'),
      R('218', 'caveats', 'Lean (BufferedIsing, docs/218.md) covers only a finite-graph comparison lemma.'),
      CP('218'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 219 ----
cx, cy = 544, 224
pet = []
for i in range(5):
    a = -math.pi / 2 + 2 * math.pi * i / 5
    pet.append(node(f'o{i}', cx + 205 * math.cos(a), cy + 195 * math.sin(a), tone='ink'))
for i in range(5):
    a = -math.pi / 2 + 2 * math.pi * i / 5
    pet.append(node(f'i{i}', cx + 95 * math.cos(a), cy + 90 * math.sin(a), tone='ink'))
pe = [[f'o{i}', f'o{(i + 1) % 5}', {'tone': 'accent'}] for i in range(5)] + [[f'o{i}', f'i{i}', {'tone': 'soft'}] for i in range(5)] + [[f'i{i}', f'i{(i + 2) % 5}', {'tone': 'cool'}] for i in range(5)]
spec('219', 'proof',
     'GOE statistics for random regular graphs',
     'GOE bulk universality for random regular graphs',
     'Claim: for every fixed degree $d \\ge 3$, eigenvalue spacings of a random $d$-regular graph follow the GOE',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'graph', 'until': 3.8, 'r': 11, 'edgeAt': 0.3, 'edgeDur': 2.2, 'nodes': pet, 'edges': pe},
         {'primitive': 'plot', 'from': 3.8, 'x': [0, 3], 'y': [0, 1.05], 'xticks': [0, 1, 2, 3], 'yticks': [], 'labelRoom': 200,
          'xlabel': 'normalized spacing $s$', 'ylabel': 'density',
          'curves': [{'f': 'exp(-x)', 'label': 'Poisson', 'tone': 'soft', 'dash': True, 'at': 0.4, 'labelDy': -18},
                     {'f': '(PI*x/2)*exp(-PI*x*x/4)', 'label': 'GOE (surmise)', 'tone': 'accent', 'at': 1.4, 'labelDy': 14}]}],
      'beats': [
         {'at': 0.2, 'text': 'A 3-regular graph looks locally like a tree (here, the Petersen graph)'},
         {'at': 3.9, 'text': "Yet its eigenvalues should repel like a dense Gaussian matrix's (Wigner surmise shown)"},
         {'at': 6.5, 'text': 'Claim: true for every fixed degree $d \\ge 3$'}]},
     {'form': 'status', 'label': 'Fixed-degree GOE conjecture (Bourgade–Huang)',
      'statement': [r'd \ge 3\ \text{fixed}:\ \ \text{bulk eigenvalues} \to \text{GOE}'],
      'context': 'Before: only growing degree, $(\\log n)^{24} \\ll d$ (Bourgade and Huang)',
      'stamp': 'proved',
      'note': 'Fixed-energy (Laplace functional) form; also with weak diagonal disorder'},
     'No Lean statement; a 104-page manuscript',
     OUR_NONE,
     [R('219', 'known_before', 'Bourgade & Huang: fixed-energy universality for (log n)^24 ≪ d ≤ n^{1/2}, conjecture 2.11 for fixed d'),
      R('219', 'caveats', 'Laplace-functional (fixed-energy) formulation'),
      R('219', 'claim', 'converges to the GOE bulk process'),
      A('GOE statistics for random regular graphs', '104 pages, no Lean.'),
      CP('219'), READ_ALL])

# ---------------------------------------------------------------- 220 ----
spec('220', 'proof',
     'Random walk in random environment: speed',
     'Random walk in random environment: escape implies speed',
     'Claim: in $d \\ge 2$, a walk in an iid uniformly elliptic environment that escapes in a direction has positive speed',
     {'dur': 8.4, 'primitive': 'plot', 'x': [0, 10], 'y': [0, 6.6], 'xticks': [], 'yticks': [], 'labelRoom': 250,
      'xlabel': 'time $n$', 'ylabel': 'progress $X_n \\cdot \\ell$',
      'curves': [{'f': '1.55*sqrt(x)', 'label': '$d = 1$: zero speed', 'tone': 'soft', 'dash': True, 'at': 0.6, 'labelDy': 10},
                 {'f': '0.62*x', 'label': '$d \\ge 2$: speed $v$', 'tone': 'accent', 'at': 2.6, 'labelDy': -10}],
      'beats': [
         {'at': 0.2, 'text': 'In one dimension, traps let a walk escape to infinity at zero speed (curves schematic)'},
         {'at': 3.0, 'text': 'Conjecture: in $d \\ge 2$, escaping in a direction $\\ell$ forces positive speed'},
         {'at': 5.7, 'text': 'Claim: proved for iid uniformly elliptic environments, every $d \\ge 2$'}]},
     {'form': 'status', 'label': 'Ballisticity conjecture (Fribergh–Kious, Conjecture 1.1)',
      'statement': [r'\mathbb P(X_n \cdot \ell \to \infty) = 1 \;\Rightarrow\; X_n/n \to v,\ \ v \cdot \ell > 0'],
      'context': 'Before: the 0–1 law in $d = 2$ (Zerner–Merkl 2001); it fails for some dependent environments',
      'stamp': 'proved',
      'note': 'Also: 0–1 laws in $d \\ge 3$, including finite-range dependence'},
     "Ballisticity is in the release's main formal results (DirectionalBallisticity.lean)",
     OUR_FAITH,
     [R('220', 'known_before', 'ballisticity conjecture formulated by Fribergh & Kious (Conjecture 1.1)'),
      R('220', 'known_before', 'Zerner & Merkl (Ann. Probab. 2001) 0–1 law for d=2'),
      R('220', 'caveats', 'Ballisticity is in formalization.yaml main_results (DirectionalBallisticity, standard axioms)'),
      CP('220'), READ_FAITHFUL, NOBUILD])

# ---------------------------------------------------------------- 221 ----
rn = [node('top', 544, 30, tone='soft'), node('e', 544, 160, tone='ink', label='depth $e$', lx=-30, lax=1),
      node('m', 450, 270, tone='accent', label='depth $e{+}1$', lx=-26, lax=1),
      node('an', 360, 400, tone='ink', label='anchor', lx=-24, lax=1), node('old', 728, 400, tone='ink', label='old leaf', lx=24, lax=0),
      node('new', 610, 400, tone='accent', label='new child', lx=0, ly=34, lax=0.5)]
re_ = [['top', 'e', {'tone': 'soft'}], ['e', 'old', {'tone': 'soft'}], ['e', 'm', {'tone': 'soft'}], ['m', 'an', {'tone': 'soft'}], ['m', 'new', {'tone': 'accent', 'w': 3}]]
spec('221', 'proof',
     'Mézard–Parisi for diluted spin glasses',
     'The Mézard–Parisi formula for diluted spin glasses',
     'Claim: for even-arity Poisson-diluted Ising models, the free energy is $\\inf_r \\Phi_r$, as conjectured in 2004',
     {'dur': 8.4, 'primitive': 'graph', 'r': 10, 'edgeAt': 0.4, 'edgeDur': 3.4, 'nodes': rn, 'edges': re_,
      'beats': [
         {'at': 0.2, 'text': 'Since 2004: for every depth $r$, the functional $\\Phi_r$ bounds the pressure from above'},
         {'at': 3.0, 'text': 'The new move: delay each replica split by one level'},
         {'at': 5.6, 'text': 'Each new branch carries a small coefficient, charged to its own small factor'}]},
     {'form': 'status', 'label': 'Panchenko–Talagrand conjecture (2004), Mézard–Parisi formula',
      'statement': [r'\lim_{N\to\infty} \tfrac1N\,\mathbb E\log Z_N \;=\; \inf_{r \ge 0}\, \Phi_r'],
      'context': 'Before: only the upper bound, for every finite depth $r$ (Panchenko and Talagrand, 2004)',
      'stamp': 'proved',
      'note': 'Only the Panchenko–Talagrand class: even arity, Poisson graphs, positivity'},
     'Comparator DilutedSpin.lean states the convergence; not in the main-results list',
     OUR_FAITH,
     [R('221', 'known_before', 'Panchenko & Talagrand (PTRF 2004) arbitrary finite-level upper bound and the equality conjecture after their Theorem 4'),
      R('221', 'caveats', 'Restricted to the PT class: even arity, Poisson (not fixed-degree/random regular) graphs, positivity condition'),
      R('221', 'caveats', 'Lean challenge DilutedSpin.lean (theorem mezard_parisi, standard axioms) with docs/221.md; not in yaml main_results.'),
      A('The Mézard–Parisi formula for diluted spin glasses', 'shift every internal branching depth of the target tree by one level.'),
      A('The Mézard–Parisi formula for diluted spin glasses', 'delaying a replica split by one level creates a new branching vertex with a small coefficient minus delta'),
      CP('221'), READ_FAITHFUL, NOBUILD])

# ---------------------------------------------------------------- 222 ----
spec('222', 'proof',
     'Perceptron jamming exponents',
     'Perceptron free energies and microscopic jamming exponents',
     'Claim: the full-RSB jamming exponents of the spherical perceptron, certified to seven digits',
     {'dur': 8.6, 'primitive': 'numberline', 'min': 0.4, 'max': 0.43, 'y': 0.6,
      'ticks': [0.4, 0.41, 0.42, 0.43],
      'axisLabel': 'the gap exponent $\\gamma$ and force exponent $\\theta$',
      'markers': [{'v': 0.41269, 'label': '$\\gamma$, physics', 'note': '$\\approx 0.41269$', 'style': 'ring', 'tone': 'mute', 'at': 0.6},
                  {'v': 0.42311, 'label': '$\\theta$, physics', 'note': '$\\approx 0.42311$', 'style': 'ring', 'tone': 'mute', 'at': 1.0}],
      'zoom': {'min': 0.4126927, 'max': 0.4126937, 'at': 2.6, 'dur': 2.0, 'counter': True,
               'ticks': [{'v': 0.412693, 'label': '0.4126930'}, {'v': 0.4126934, 'label': '0.4126934'}]},
      'ranges': [{'from': 0.412693, 'to': 0.4126934, 'label': 'certified $\\gamma$', 'tone': 'claim', 'at': 4.8, 'side': 'above'}],
      'beats': [
         {'at': 0.2, 'text': 'Full replica-symmetry-breaking physics predicts the jamming exponents $\\gamma$ and $\\theta$'},
         {'at': 2.8, 'text': 'Zoom in on $\\gamma$ until the certified interval fills the line'},
         {'at': 5.4, 'text': 'Claim: $\\gamma$ is pinned to this interval, with $\\gamma = 1/(2+\\theta)$'}]},
     {'form': 'status', 'label': 'Jamming exponents predicted by Franz, Parisi and collaborators',
      'statement': [r'0.4126930 < \gamma < 0.4126934', r'0.4231063 < \theta < 0.4231088'],
      'context': 'Spherical perceptron, margin $-1$, quadratic penalty; limits in size, then temperature, then density',
      'stamp': 'proved',
      'note': 'The intervals rest on a computer-assisted numerical certificate'},
     'Lean: the spherical pressure formula, and only finiteness for the Ising one',
     OUR_LEAN,
     [R('222', 'claim', '0.4126930<γ<0.4126934, 0.4231063<θ<0.4231088'),
      R('222', 'known_before', 'predicted γ≈0.41269, θ≈0.42311'),
      R('222', 'claim', 'γ=1/(2+θ)'),
      R('222', 'claim', 'for the spherical perceptron with margin -1 and quadratic penalty'),
      R('222', 'caveats', 'Lean: spherical perceptron pressure formula formalized; Ising part only finiteness of the variational value.'),
      R('222', 'caveats', 'Jamming result uses an order of limits and a computer-assisted numerical certificate'),
      CP('222'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 223 ----
spec('223', 'proof',
     'Cardy on $\\mathbb Z^2$ and FK interfaces',
     "Square-lattice FK interfaces and Cardy's formula",
     'Claim: critical square-lattice FK interfaces converge to $\\mathrm{SLE}_\\kappa$ for every $q \\le 4$',
     {'dur': 8.6, 'primitive': 'plot', 'x': [0, 4], 'y': [3, 8.6], 'labelRoom': 120,
      'xticks': [0, 1, 2, 3, 4], 'yticks': [4, 6, 8], 'xlabel': 'cluster weight $q$', 'ylabel': '$\\kappa(q)$',
      'curves': [{'f': '4*PI/acos(-sqrt(x)/2)', 'label': '$\\kappa(q)$', 'tone': 'accent', 'at': 0.5, 'dur': 1.8}],
      'regions': [{'f': '4*PI/acos(-sqrt(x)/2)', 'from': 1, 'to': 4, 'at': 2.6}],
      'points': [{'x': 1, 'y': 6, 'label': 'percolation: Cardy', 'at': 3.4, 'tone': 'hot'},
                 {'x': 2, 'y': 5.333333, 'label': 'FK–Ising, $\\kappa = 16/3$', 'at': 4.0, 'tone': 'ink'}],
      'beats': [
         {'at': 0.2, 'text': 'Critical FK interfaces should be $\\mathrm{SLE}_\\kappa$ with $\\kappa = 4\\pi/\\arccos(-\\sqrt q/2)$'},
         {'at': 3.0, 'text': 'Smirnov proved it only where an exact observable exists; $\\mathbb Z^2$ percolation was open'},
         {'at': 5.8, 'text': 'Claim: every $1 \\le q \\le 4$ (shaded), and $0 < q < 1$ in smooth domains'}]},
     {'form': 'status', 'label': 'Rohde–Schramm Conjecture 9.7 (2005); Cardy for $\\mathbb Z^2$ bond percolation',
      'statement': [r'\text{FK interfaces} \to \mathrm{SLE}_\kappa,\ \ \kappa = 4\pi/\arccos(-\sqrt q/2)'],
      'context': 'Before: special lattices with an exact observable (Smirnov 2001, 2010)',
      'stamp': 'proved',
      'note': '602 pages in six papers: the result here most in need of independent readers'},
     'No Lean statement for any of the six papers',
     OUR_NONE,
     [R('223', 'claim', 'converge to chordal SLE_κ with κ=4π/arccos(-√q/2)'),
      R('223', 'claim', 'quenched SLE_{16/3} for weakly disordered FK–Ising'),
      R('223', 'known_before', 'Rohde & Schramm (2005) Conjecture 9.7'),
      R('223', 'known_before', 'Smirnov (2001) Cardy for triangular site percolation; Smirnov (2010)'),
      R('223', 'caveats', '602 pages, unformalized.'),
      A("Cardy's formula on the square lattice, and FK interfaces for q ≤ 4", 'it is the result in this group I most want independent readers on'),
      CP('223'), READ_ALL])

# ---------------------------------------------------------------- 224 ----
from scipy.spatial import Voronoi
rng = np.random.default_rng(224)
seeds = np.column_stack([rng.uniform(20, 1068, 44), rng.uniform(12, 436, 44)])
X0, X1, Y0, Y1 = 4, 1084, 2, 446
mir = [seeds, np.column_stack([2 * X0 - seeds[:, 0], seeds[:, 1]]), np.column_stack([2 * X1 - seeds[:, 0], seeds[:, 1]]),
       np.column_stack([seeds[:, 0], 2 * Y0 - seeds[:, 1]]), np.column_stack([seeds[:, 0], 2 * Y1 - seeds[:, 1]])]
vor = Voronoi(np.vstack(mir))
N0 = len(seeds)
ve, used = [], set()
for (p, q), (a, b) in zip(vor.ridge_points, vor.ridge_vertices):
    if a < 0 or b < 0 or (p >= N0 and q >= N0): continue
    ve.append([f'v{a}', f'v{b}', {'tone': 'faint', 'w': 1.6, 'a': 0.9}]); used.update([a, b])
vx = lambda i: min(max(vor.vertices[i][0], 0), BW)
vy = lambda i: min(max(vor.vertices[i][1], 0), BH)
rs = random.Random(224)
vn = []
for i in sorted(range(N0), key=lambda i: seeds[i][0]):
    x, y = seeds[i]
    op = rs.random() < 0.5
    vn.append(node(f's{i}', x, y, tone='accent' if op else 'faint', **({'fill': 'accent'} if op else {})))
vn += [node(f'v{i}', vx(i), vy(i), tone='faint') for i in sorted(used, key=vx)]
ve.sort(key=lambda e: min(vx(int(e[0][1:])), vx(int(e[1][1:]))))
spec('224', 'proof',
     'Voronoi percolation obeys Cardy',
     'Critical universality for Poisson–Voronoi percolation',
     "Claim: Cardy's formula holds for critical planar Poisson–Voronoi percolation, averaged over the tessellation",
     {'dur': 8.4, 'primitive': 'graph', 'r': 5, 'edgeAt': 0.3, 'edgeDur': 3.2, 'nodes': vn, 'edges': ve,
      'beats': [
         {'at': 0.2, 'text': 'Random cells around random points; each cell is open with probability $1/2$ (a sample)'},
         {'at': 3.2, 'text': 'No lattice at all: the standard test of whether conformal invariance is an accident'},
         {'at': 5.8, 'text': "Claim: Cardy's crossing formula holds, averaged over the tessellation"}]},
     {'form': 'status', 'label': 'Benjamini–Schramm conjecture (1998) for Voronoi percolation',
      'statement': [r"\text{annealed Cardy formula, every Jordan quadrilateral}", r'\mathbb E[\#\,\text{pivotal cells}] \sim c\,\varepsilon^{-3/4}'],
      'context': 'Before: RSW theory (Tassion 2016) and quenched noise sensitivity (2016)',
      'stamp': 'proved',
      'note': 'Annealed: averaged over the tessellation, not for a fixed one'},
     'No Lean statement; two of the three papers take Cardy as an input',
     OUR_NONE,
     [R('224', 'known_before', 'Benjamini & Schramm (1998) conformal invariance of Voronoi percolation (conjecture)'),
      R('224', 'known_before', 'Tassion (2016) RSW for Voronoi; Ahlberg, Griffiths, Morris & Tassion (2016) quenched noise sensitivity'),
      R('224', 'claim', 'expected number of pivotal cells for a unit-square crossing ~ c ε^{-3/4}'),
      R('224', 'caveats', 'Annealed (averaged over the tessellation) Cardy, not quenched; two of three papers take Cardy as an input. No Lean.'),
      R('224', 'known_before', 'Bollobás–Riordan p_c=1/2 (2006)'),
      CP('224'), READ_ALL])

# ---------------------------------------------------------------- 225 ----
spec('225', 'proof',
     "The six-vertex model's Gaussian free field",
     'A Gaussian free field for the balanced six-vertex model',
     'Claim: six-vertex heights converge to a Gaussian free field with squared multiplier $1/\\arcsin(c/2)$, for $0 < c \\le 2$',
     {'dur': 8.6, 'primitive': 'plot', 'x': [0, 2], 'y': [0, 4.6], 'labelRoom': 170,
      'xticks': [0, 1, {'v': 1.41421356, 'label': '$\\sqrt 2$'}, 2], 'yticks': [1, 2, 3, 4],
      'xlabel': 'the weight $c$', 'ylabel': 'squared multiplier',
      'curves': [{'f': '1/asin(x/2)', 'from': 0.22, 'to': 2, 'label': '$1/\\arcsin(c/2)$', 'tone': 'accent', 'at': 0.5, 'dur': 1.8}],
      'points': [{'x': 1.41421356, 'y': 1.2732395, 'label': 'free fermion: Kenyon', 'at': 2.8, 'tone': 'hot'},
                 {'x': 2, 'y': 0.6366198, 'label': '$c = 2$ included', 'at': 3.4, 'tone': 'ink'}],
      'beats': [
         {'at': 0.2, 'text': 'Six-vertex (ice) heights should look like a Gaussian free field, its variance set by $c$'},
         {'at': 3.0, 'text': 'Proved only at or near the free-fermion point $c = \\sqrt 2$'},
         {'at': 5.6, 'text': 'Claim: the whole curve, for $0 < c \\le 2$'}]},
     {'form': 'status', 'label': 'Coulomb-gas prediction (Nienhuis; Di Francesco, Saleur and Zuber)',
      'statement': [r'h \to \text{GFF},\ \ \text{squared multiplier } 1/\arcsin(c/2)', r'a = b = 1,\ \ 0 < c \le 2'],
      'context': 'Before: near free fermions (Kenyon 2001; Giuliani–Mastropietro–Toninelli)',
      'stamp': 'proved',
      'note': 'Plane state from balanced tori, not arbitrary domains'},
     'No Lean statement; one 93-page paper',
     OUR_NONE,
     [R('225', 'claim', 'converges to a multiple of the GFF with squared multiplier 1/arcsin(c/2)'),
      R('225', 'known_before', 'Kenyon (2001) GFF for dimers (free-fermion c=√2)'),
      R('225', 'caveats', 'Single 93-page paper, plane state from balanced tori (not arbitrary domains/boundary conditions). No Lean.'),
      CP('225'), READ_ALL])
print('prob1 ok')
