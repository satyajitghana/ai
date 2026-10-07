from lib import *
import itertools

# ---------------------------------------------------------------- 177 --
hexv = [(round(math.cos(math.pi / 3 * k + math.pi / 6), 4), round(math.sin(math.pi / 3 * k + math.pi / 6), 4)) for k in range(6)]
tris = [{'kind': 'polygon', 'points': [[0, 0], list(hexv[k]), list(hexv[(k + 1) % 6])],
         'tone': ['accent', 'cool'][k % 2], 'fillA': 0.22, 'at': 0.3 + 0.35 * k, 'dur': 0.7} for k in range(6)]
write({
    'id': '177', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Coboundary expanders in every dimension',
    'title': {'title': 'Bounded-degree coboundary expanders in every dimension',
              'subtitle': 'Claim: for every $d \\ge 3$, large $d$-dimensional complexes with bounded degree and uniform $\\mathbb F_2$ coboundary expansion'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'shape', 'shapes': tris, 'scale': 0.95, 'until': 3.8},
            {'primitive': 'numberline', 'from': 3.8, 'min': 0.5, 'max': 6.6, 'ticks': [1, 2, 3, 4, 5, 6],
             'axisLabel': 'the dimension $d$ of the complex',
             'markers': [
                 {'v': 1, 'label': 'graphs', 'note': 'expanders, classical', 'tone': 'ok', 'at': 0.5},
                 {'v': 2, 'label': 'Chapman–Lubotzky', 'note': 'bounded degree', 'tone': 'ok', 'at': 0.8}],
             'ranges': [{'from': 3, 'to': 6, 'label': 'claimed: every $d \\ge 3$', 'tone': 'claim', 'at': 1.8}]}],
        'beats': [
            {'at': 0.2, 'text': 'A simplicial complex: vertices, edges and triangles glued along faces (a small piece)'},
            {'at': 3.9, 'text': 'Coboundary expansion is graph expansion in higher dimensions; degree must stay bounded'},
            {'at': 6.3, 'text': 'Graphs and dimension 2 were known. The claim covers every $d \\ge 3$'}]},
    'achievement': {
        'form': 'status', 'label': "Bounded-degree coboundary expanders (Gromov's question, 2010)",
        'statement': ['\\text{bounded degree} \\;+\\; \\mathbb F_2 \\text{ coboundary expansion below } d'],
        'context': 'Known for graphs and in dimension 2 (Chapman–Lubotzky); higher dimensions were open',
        'stamp': 'proved',
        'note': 'Built from congruence quotients of a coset complex over a polynomial ring'},
    'verify': {'lean': 'main',
               'detail': 'Every $d \\ge 3$, uniform expansion in each degree below $d$; not in the main-results list',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('177', 'known_before', 'Gromov (2010) asked for bounded-degree complexes with uniform filling inequalities'),
        R('177', 'known_before', 'Chapman–Lubotzky proved bounded-degree 2-dimensional F2 coboundary expanders'),
        R('177', 'known_before', 'Higher dimensions were open'),
        A('Coboundary expanders and Ramanujan graphs', 'The complexes are congruence quotients of a coset complex over a polynomial ring'),
        R('177', 'lean', 'not listed in formalization.yaml main_results'),
    ]})

# ---------------------------------------------------------------- 178 --
outer = [(math.cos(math.pi / 2 + 2 * math.pi * k / 5), math.sin(math.pi / 2 + 2 * math.pi * k / 5)) for k in range(5)]
inner = [(0.45 * x, 0.45 * y) for (x, y) in outer]
pf = place(outer + inner, scale=185, cy=352)
pn = [{'id': f'o{k}', 'x': pf[k][0], 'y': pf[k][1]} for k in range(5)] + [{'id': f'i{k}', 'x': pf[5 + k][0], 'y': pf[5 + k][1]} for k in range(5)]
pe = [[f'o{k}', f'o{(k + 1) % 5}'] for k in range(5)] + [[f'o{k}', f'i{k}'] for k in range(5)] + [[f'i{k}', f'i{(k + 2) % 5}'] for k in range(5)]
write({
    'id': '178', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Deterministic Ramanujan graphs, every degree',
    'title': {'title': 'Deterministic nonbipartite Ramanujan graphs in every degree',
              'subtitle': 'Claim: for each $d \\ge 3$, an algorithm builds a $d$-regular Ramanujan graph on every large even $n$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'nodes': pn, 'edges': pe, 'r': 13, 'edgeAt': 0.4, 'edgeDur': 2.2, 'until': 3.8},
            {'primitive': 'numberline', 'from': 3.8, 'min': -3.4, 'max': 3.4, 'ticks': [{'v': -2, 'label': '$-2$'}, 0, 2],
             'axisLabel': 'eigenvalues',
             'markers': [
                 {'v': 3, 'label': 'trivial', 'note': '$\\lambda = d$', 'tone': 'mute', 'at': 0.4},
                 {'v': 1, 'label': 'Petersen', 'note': '$\\lambda = 1$', 'side': 'below', 'tone': 'ink', 'at': 1.6},
                 {'v': -2, 'label': 'Petersen', 'note': '$\\lambda = -2$', 'side': 'below', 'tone': 'ink', 'at': 1.9}],
             'ranges': [{'from': -2.828427, 'to': 2.828427, 'derived': '-2 sqrt(2) to 2 sqrt(2)', 'label': 'Ramanujan window',
                         'note': '$\\pm 2\\sqrt{d-1}$', 'tone': 'claim', 'at': 0.9}]}],
        'beats': [
            {'at': 0.2, 'text': 'The Petersen graph: 3-regular, not bipartite, and Ramanujan'},
            {'at': 3.9, 'text': 'Ramanujan: every nontrivial eigenvalue lies strictly inside $\\pm 2\\sqrt{d-1}$'},
            {'at': 6.3, 'text': 'The claim: a deterministic algorithm, every $d \\ge 3$ and every large even $n$'}]},
    'achievement': {
        'form': 'status', 'label': 'Deterministic nonbipartite Ramanujan graphs, every degree',
        'statement': ['\\text{nonconstant eigenvalues in } (-2\\sqrt{d-1},\\ 2\\sqrt{d-1})'],
        'context': 'Existence was known: about 69% of random regular graphs are Ramanujan (Huang–McKenzie–Yau)',
        'stamp': 'proved',
        'note': "New is the derandomisation; the running time's exponent depends on $d$"},
    'verify': {'lean': 'none',
               'detail': 'No formal statement: 85 pages of resolvent and trace estimates',
               'ourCheck': NONE_CHECK},
    'sources': [
        A('Coboundary expanders and Ramanujan graphs', 'about 69% of random regular graphs are Ramanujan, arXiv 2412.20263'),
        A('Coboundary expanders and Ramanujan graphs', 'so the contribution is derandomisation'),
        R('178', 'caveats', 'the exponent may depend on d'),
        A('Coboundary expanders and Ramanujan graphs', 'It is 85 pages of resolvent estimates with no Lean'),
    ]})

# ---------------------------------------------------------------- 179 --
row = [-1, 1, 1, 1]
mat = [[row[(c - r) % 4] for c in range(4)] for r in range(4)]
for a in range(4):
    for b in range(4):
        assert sum(mat[a][k] * mat[b][k] for k in range(4)) == (4 if a == b else 0)
sym = lambda v: '+' if v > 0 else '−'
barker = [1, 1, 1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1]
for k in range(1, 13):
    assert abs(sum(barker[i] * barker[i + k] for i in range(13 - k))) <= 1
write({
    'id': '179', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Circulant Hadamard and Barker sequences',
    'title': {'title': 'Circulant Hadamard matrices exist only in orders 1 and 4',
              'subtitle': "Claim: Ryser's 1963 conjecture holds, so Barker sequences exist exactly at lengths 2, 3, 4, 5, 7, 11, 13"},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'grid', 'rows': 4, 'cols': 4, 'until': 3.8,
             'values': [[sym(v) for v in r] for r in mat],
             'cells': [[r, c, 'cool'] for r in range(4) for c in range(4) if mat[r][c] < 0],
             'caption': 'order 4: each row is the one above, shifted cyclically'},
            {'primitive': 'sequence', 'from': 3.8, 'items': [sym(v) for v in barker], 'perRow': 13, 'stagger': 0.08,
             'marks': {str(i): 'cool' for i, v in enumerate(barker) if v < 0},
             'caption': 'the Barker sequence of length 13'}],
        'beats': [
            {'at': 0.2, 'text': 'Four cyclic shifts of one $\\pm 1$ row, pairwise orthogonal: a circulant Hadamard matrix'},
            {'at': 3.9, 'text': 'Barker sequences: every off-peak autocorrelation is $0$ or $\\pm 1$'},
            {'at': 6.3, 'text': 'The claim settles both: no circulant order beyond 4, no Barker length beyond 13'}]},
    'achievement': {
        'form': 'status', 'label': "Ryser's circulant Hadamard conjecture (1963)",
        'statement': ['\\text{circulant Hadamard of order } n \\iff n \\in \\{1, 4\\}'],
        'context': 'Before: any other order is $4u^2$ with $u$ odd; 4,489 candidates were left below $4 \\cdot 10^{30}$',
        'stamp': 'proved',
        'note': 'Odd Barker lengths rest on Turyn–Storer, cited, not formalized'},
    'verify': {'lean': 'main',
               'detail': 'The circulant statement and the even-length Barker statement are both formal',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        A('Circulant Hadamard matrices and Barker sequences', 'Ryser conjectured in 1963 that only order 4 works (plus the trivial order 1)'),
        A('Circulant Hadamard matrices and Barker sequences', 'Turyn showed any other order is $4u^2$ with $u$ odd and not a prime power, and later work left 4,489 candidate orders below $4 \\cdot 10^{30}$'),
        A('Circulant Hadamard matrices and Barker sequences', 'The corollary is that Barker sequences exist exactly at lengths 2, 3, 4, 5, 7, 11 and 13'),
        C('179', 'A real circulant Hadamard matrix of order n >= 1 exists iff n in {1,4}'),
        A('Circulant Hadamard matrices and Barker sequences', 'The odd-length list rests on the classical Turyn–Storer theorem, which is cited rather than formalized'),
        A('Circulant Hadamard matrices and Barker sequences', 'and so is the even-length Barker statement'),
    ]})

# ---------------------------------------------------------------- 180 --
out6 = [(math.cos(math.pi / 2 + math.pi / 3 * k), math.sin(math.pi / 2 + math.pi / 3 * k)) for k in range(6)]
in6 = [(0.48 * x, 0.48 * y) for (x, y) in out6]
bf = place(out6 + in6, scale=190, cy=352)
bn = [{'id': f'o{k}', 'x': bf[k][0], 'y': bf[k][1], 'tone': ['ink', 'cool'][k % 2]} for k in range(6)] + \
     [{'id': f'i{k}', 'x': bf[6 + k][0], 'y': bf[6 + k][1], 'tone': ['cool', 'ink'][k % 2]} for k in range(6)]
cyc = [('o0', 'o1'), ('o1', 'o2'), ('o2', 'o3'), ('o3', 'o4'), ('o4', 'o5'), ('o5', 'i5'),
       ('i5', 'i4'), ('i4', 'i3'), ('i3', 'i2'), ('i2', 'i1'), ('i1', 'i0'), ('i0', 'o0')]
allE = [(f'o{k}', f'o{(k + 1) % 6}') for k in range(6)] + [(f'i{k}', f'i{(k + 1) % 6}') for k in range(6)] + [(f'o{k}', f'i{k}') for k in range(6)]
cs = {frozenset(e) for e in cyc}
assert len(cs) == 12 and all(frozenset(e) in {frozenset(x) for x in allE} for e in cyc)
rest = [e for e in allE if frozenset(e) not in cs]
write({
    'id': '180', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': "Barnette's Hamiltonian-cycle conjecture",
    'title': {'title': "Barnette's conjecture: a Hamiltonian cycle, always",
              'subtitle': 'Claim: every cubic bipartite planar 3-connected graph has a Hamiltonian cycle'},
    'object': {
        'dur': 8.4, 'primitive': 'graph', 'r': 13, 'edgeAt': 0.4, 'edgeDur': 5.4,
        'nodes': bn,
        'edges': [[a, b, {'tone': 'faint', 'w': 2}] for a, b in rest] + [[a, b, {'tone': 'accent', 'w': 4}] for a, b in cyc],
        'beats': [
            {'at': 0.2, 'text': 'The hexagonal prism: cubic, bipartite, planar and 3-connected'},
            {'at': 3.0, 'text': 'A Hamiltonian cycle visits every vertex exactly once'},
            {'at': 5.9, 'text': 'Here is one. The claim: every graph of this kind has one'}]},
    'achievement': {
        'form': 'status', 'label': "Barnette's conjecture (recorded by Grünbaum, 1969)",
        'statement': ['\\text{cubic, bipartite, planar, 3-connected} \\;\\Rightarrow\\; \\text{Hamiltonian}'],
        'context': 'Before: known when faces have size at most 8, and for small orders by computer',
        'stamp': 'proved',
        'note': 'Non-constructive: an exponential sum shows a cycle exists; no algorithm'},
    'verify': {'lean': 'main',
               'detail': 'Planarity defined topologically; one genuine Hamiltonian cycle. Not in main results',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        A("Barnette's conjecture", "Barnette's conjecture, recorded by Grünbaum in 1969, is the surviving piece"),
        A("Barnette's conjecture", 'Before this release it was known for graphs whose faces have size at most 8 (Schnieders, arXiv 2508.03531) and checked by computer for small orders'),
        A("Barnette's conjecture", 'It is non-constructive: there is no algorithm here'),
        A("Barnette's conjecture", 'so planarity is topological'),
        A("Barnette's conjecture", 'The family is not in the main-results list'),
    ]})

# ---------------------------------------------------------------- 181 --
k5 = [(math.cos(math.pi / 2 + 2 * math.pi * k / 5), math.sin(math.pi / 2 + 2 * math.pi * k / 5)) for k in range(5)]
kf = place(k5, scale=185, cy=360)
c1 = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 0)]
c2 = [(0, 2), (2, 4), (4, 1), (1, 3), (3, 0)]
assert len({frozenset(e) for e in c1 + c2}) == 10
write({
    'id': '181', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Linear cycle decompositions',
    'title': {'title': 'Every graph splits into $O(n)$ cycles and edges',
              'subtitle': 'Claim: the edges of any $n$-vertex graph partition into at most $Cn$ simple cycles and single edges'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'r': 15, 'edgeAt': 0.4, 'edgeDur': 2.4, 'until': 3.8,
             'nodes': [{'id': f'v{k}', 'x': kf[k][0], 'y': kf[k][1]} for k in range(5)],
             'edges': [[f'v{a}', f'v{b}', {'tone': 'accent', 'w': 3}] for a, b in c1] + [[f'v{a}', f'v{b}', {'tone': 'cool', 'w': 3}] for a, b in c2]},
            {'primitive': 'equation', 'from': 3.8, 'lines': [
                {'tex': 'O(n \\log n)', 'note': '1966', 'tone': 'mute', 'at': 0.3},
                {'tex': 'O(n \\log\\log n)', 'note': '2014', 'tone': 'mute', 'at': 0.8},
                {'tex': 'O(n \\log^* n)', 'note': '2022', 'tone': 'mute', 'at': 1.3},
                {'tex': 'O(n)', 'note': 'claimed', 'tone': 'claim', 'at': 2.3}]}],
        'beats': [
            {'at': 0.2, 'text': '$K_5$ splits into two 5-cycles'},
            {'at': 3.9, 'text': 'In general: how few cycles and leftover edges cover every edge exactly once?'},
            {'at': 6.3, 'text': 'The claim removes the last $\\log^* n$ factor: linearly many pieces'}]},
    'achievement': {
        'form': 'status', 'label': 'The cycle-decomposition conjecture (1960s), erdosproblems #184',
        'statement': ['E(G) = C_1 \\sqcup \\dots \\sqcup C_k,\\quad k \\le C n'],
        'context': 'Cycles and single edges. Before: $O(n \\log^* n)$ ($\\textsf{Buci\\\'{c}}$ and Montgomery, 2022)',
        'stamp': 'proved',
        'note': 'The constant $C$ is not explicit'},
    'verify': {'lean': 'main',
               'detail': 'At most $C n$ cycles and edges, for every graph on $n$ vertices; listed',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        A('The Erdős–Gallai cycle decomposition', 'Erdős, Goodman and Pósa recorded the problem with an $O(n \\log n)$ bound in 1966'),
        A('The Erdős–Gallai cycle decomposition', 'Conlon, Fox and Sudakov reached $O(n \\log \\log n)$ in 2014 and Bucić and Montgomery $O(n \\log^* n)$ in 2022'),
        A('The Erdős–Gallai cycle decomposition', 'Every graph on $n$ vertices should split into $O(n)$ edge-disjoint cycles and single edges (erdosproblems.com #184)'),
        A('The Erdős–Gallai cycle decomposition', 'is formalized and listed; the constant is not explicit'),
        R('181', 'known_before', 'Erdős and Gallai (1960s)'),
    ]})

# ---------------------------------------------------------------- 182 --
S = [1, 3, 6, 8]
assert all(int(math.isqrt(abs(a - b))) ** 2 != abs(a - b) for a, b in itertools.combinations(S, 2))
write({
    'id': '182', 'discipline': 'Combinatorics', 'kind': 'improved-bound',
    'short': 'Square-difference-free sets: a power saving',
    'title': {'title': 'A power saving for square-difference-free sets',
              'subtitle': 'Claim: a set in $\\{1, \\dots, N\\}$ with no square difference has at most $C N^{1-c}$ elements'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'sequence', 'items': [str(i) for i in range(1, 10)], 'until': 3.8, 'stagger': 0.1,
             'marks': {str(s - 1): {'tone': 'accent', 'at': 1.6 + 0.2 * k} for k, s in enumerate(S)},
             'caption': '$\\{1, 3, 6, 8\\}$: no two elements differ by a perfect square'},
            {'primitive': 'numberline', 'from': 3.8, 'min': 0.6, 'max': 1.1,
             'ticks': [{'v': 0.75, 'label': '$3/4$'}, 1],
             'axisLabel': 'exponent $e$ in $|A| \\approx N^{e}$',
             'markers': [
                 {'v': 0.7528, 'label': 'lower bound', 'note': 'Krachun, $N^{0.7528}$', 'at': 0.5},
                 {'v': 1, 'label': 'upper bounds', 'note': 'all $N^{1-o(1)}$ until now', 'at': 0.8}],
             'ranges': [{'from': 0.7528, 'to': 1, 'label': 'the truth', 'note': 'claim: strictly below 1', 'tone': 'claim', 'side': 'below', 'at': 1.8}]}],
        'beats': [
            {'at': 0.2, 'text': 'How large can a set in $\\{1, \\dots, N\\}$ be if no two elements differ by a square?'},
            {'at': 3.9, 'text': 'At least $N^{0.75}$; upper bounds only saved $e^{-c\\sqrt{\\log N}}$ (Green–Sawhney)'},
            {'at': 6.3, 'text': 'The claim: a fixed power saving, $|A| \\le C N^{1-c}$'}]},
    'achievement': {
        'form': 'bound',
        'before': {'label': 'Best known, 2024', 'tex': 'N e^{-c\\sqrt{\\log N}}', 'note': 'Green–Sawhney, who asked for a power saving'},
        'after': {'label': 'Claimed, Sep 2026', 'tex': 'C\\,N^{1-c}', 'note': 'also intersective $h$, and $h$ at primes'},
        'note': "Only the square case is in Lean; the prime case leans on the release's $7/8$ claim"},
    'verify': {'lean': 'part',
               'detail': 'In Lean: the square-difference power saving. Not the intersective or prime papers',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('182', 'known_before', 'Krachun >= 0.7528'),
        C('182', 'October-5-2026'),
        R('182', 'explainer', 'It is known to be o(N) and at least N^{0.75}'),
        R('182', 'known_before', 'Green–Sawhney (arXiv:2411.17448, 2024) N exp(-c sqrt(log N)), who posed the fixed-power-saving question'),
        A('Square-difference-free sets', 'Only the square case is formalized'),
        A('Square-difference-free sets', 'a zero-free half-plane $\\mathrm{Re}(s) > 7/8$ for all Dirichlet $L$-functions'),
    ]})

# ---------------------------------------------------------------- 183 --
HP = [(0.57, -0.77), (-0.84, 0.65), (0.46, 0.72), (1.19, -0.1), (1.27, 0.44), (-0.53, -0.25), (-1.37, -0.19), (1.46, -0.75)]
halving = []
for i, j in itertools.combinations(range(8), 2):
    p, q = HP[i], HP[j]
    side = sum(1 for k in range(8) if k not in (i, j) and (q[0] - p[0]) * (HP[k][1] - p[1]) - (q[1] - p[1]) * (HP[k][0] - p[0]) > 0)
    if side == 3:
        halving.append((i, j))
assert len(halving) == 4
hf = place(HP, scale=200, cy=352)
write({
    'id': '183', 'discipline': 'Combinatorics', 'kind': 'improved-bound',
    'short': 'Halving lines: a power saving',
    'title': {'title': 'A power saving for planar halving lines',
              'subtitle': 'Claim: $n$ points with no three collinear have at most $C n^{4/3-\\varepsilon}$ halving lines'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'r': 11, 'edgeAt': 0.8, 'edgeDur': 2.0, 'until': 3.8,
             'nodes': [{'id': f'p{k}', 'x': hf[k][0], 'y': hf[k][1], 'fill': 'ink'} for k in range(8)],
             'edges': [[f'p{i}', f'p{j}', {'tone': 'accent', 'w': 3}] for i, j in halving]},
            {'primitive': 'numberline', 'from': 3.8, 'min': 0.9, 'max': 1.45,
             'ticks': [1, {'v': 1.333333, 'label': '$4/3$'}],
             'axisLabel': 'exponent $e$ in (number of halving lines) $\\approx n^{e}$',
             'markers': [
                 {'v': 1.333333, 'derived': '4/3', 'label': 'Dey', 'note': '1998, above', 'at': 0.5},
                 {'v': 1, 'label': 'constructions', 'note': '$n\\,e^{\\Omega(\\sqrt{\\log n})}$', 'style': 'ring', 'tone': 'mute', 'at': 0.8},
                 {'v': 1.333333, 'derived': '4/3', 'label': 'claimed $4/3 - \\varepsilon$', 'note': 'ineffective', 'tone': 'claim', 'side': 'below', 'at': 2.2}]}],
        'beats': [
            {'at': 0.2, 'text': 'Eight points, no three collinear: each drawn line splits the other six 3 and 3'},
            {'at': 3.9, 'text': "Dey's $O(n^{4/3})$ from 1998 had not been improved by a power"},
            {'at': 6.3, 'text': 'The claim: $C n^{4/3-\\varepsilon}$, with $\\varepsilon$ and $C$ not explicit'}]},
    'achievement': {
        'form': 'bound',
        'before': {'label': 'Best known since 1998', 'tex': 'O(n^{4/3})', 'note': 'Dey, via the crossing lemma'},
        'after': {'label': 'Claimed, Sep 2026', 'tex': 'O(n^{4/3-\\varepsilon})', 'note': 'no three collinear; $\\varepsilon$ ineffective'},
        'note': 'The $k$-set corollary the summary leads with is not in Lean'},
    'verify': {'lean': 'main',
               'detail': 'Theorems 1.1 and 1.2: halving pairs, and the all-rank switch bound',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        A('Halving lines', "Dey's 1998 bound of $O(n^{4/3})$ halving lines had not been improved by a power in 28 years"),
        R('183', 'known_before', 'Best lower bound n e^{Omega(sqrt(log n))}'),
        A('Halving lines', 'Theorems 1.1 and 1.2 are formalized. The $k$-set corollary the summary leads with is not.'),
        R('183', 'caveats', 'Exponent saving eps and constants are completely ineffective'),
        C('183', 'September-25-2026'),
    ]})

# ---------------------------------------------------------------- 184 --
write({
    'id': '184', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Clique-free graphs: AEKS and AKS',
    'title': {'title': 'Clique-free graphs behave like triangle-free ones',
              'subtitle': 'Claim: $K_r$-free graphs have independent sets of size $c_r\\,n \\log d / d$, and need $O(\\Delta/\\log\\Delta)$ colours'},
    'object': {
        'dur': 8.4, 'primitive': 'equation', 'mode': 'stack',
        'lines': [
            {'tex': '\\alpha(G) \\ge c\\,\\tfrac{n \\log\\log d}{d}', 'note': 'AEKS, 1981', 'tone': 'mute', 'at': 0.4},
            {'tex': '\\alpha(G) \\ge c\\,\\tfrac{n \\log d}{d \\log\\log d}', 'note': 'Shearer, 1995', 'tone': 'mute', 'at': 1.6},
            {'tex': '\\alpha(G) \\ge c_r\\,\\tfrac{n \\log d}{d}', 'note': 'claimed', 'tone': 'claim', 'at': 4.4}],
        'beats': [
            {'at': 0.2, 'text': 'Graphs with no $K_r$, $r \\ge 4$, and average degree $d$: how big an independent set?'},
            {'at': 2.9, 'text': 'For 45 years every argument for $r \\ge 4$ lost a $\\log\\log$ factor'},
            {'at': 5.5, 'text': 'The claim removes it, and colours such graphs with $O(\\Delta/\\log\\Delta)$ colours'}]},
    'achievement': {
        'form': 'status', 'label': 'AEKS (1981) and Alon–Krivelevich–Sudakov (1999) conjectures',
        'statement': ['\\alpha(G) \\ge c_r\\, n \\log d / d', '\\chi_{DP}(G) \\le C_r\\, \\Delta / \\log \\Delta'],
        'context': 'Both for $K_r$-free graphs with $r \\ge 4$; the triangle-free case was classical',
        'stamp': 'proved',
        'note': 'Only the independence bound is in Lean; the colouring paper is unformalized'},
    'verify': {'lean': 'part',
               'detail': 'In Lean: the independence bound for $K_r$-free graphs. Not the colouring theorem',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('184', 'known_before', 'Combinatorica 1 (1981) 313–317'),
        R('184', 'known_before', 'Shearer, RSA 7 (1995) 269–271 gave Omega_r(n log d/(d log log d))'),
        R('184', 'known_before', "AEKS proved Omega_r(n log log d/d)"),
        R('184', 'known_before', "(a) is the Alon–Krivelevich–Sudakov conjecture ('Coloring graphs with sparse neighborhoods', JCTB 77 (1999))"),
        A('Clique-free graphs: AEKS and Alon–Krivelevich–Sudakov', 'For 45 years every argument lost a $\\log \\log d$ factor'),
        R('184', 'lean', 'The coloring theorem (a), i.e. the AKS conjecture and the DP strengthening, is not formalized.'),
    ]})
print('ok b4')
