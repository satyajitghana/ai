from gen_tcs_common import *

# ---------------------------------------------------------------- 113
hexpos = {i: (round(0.5 + 0.17 * math.cos(-math.pi / 2 + i * math.pi / 3), 4), round(0.5 + 0.42 * math.sin(-math.pi / 2 + i * math.pi / 3), 4)) for i in range(6)}
E13 = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 0), (0, 2), (3, 5), (1, 4)]
PMs = [c for c in itertools.combinations(E13, 3) if len({v for e in c for v in e}) == 6]
assert len(PMs) == 4
def pmpanel(m, extra):
    rest = [e for e in E13 if e not in m]
    p = {'primitive': 'graph', 'r': 15,
         'nodes': [{'id': str(i), 'x': x, 'y': y} for i, (x, y) in hexpos.items()],
         'edges': [[str(a), str(b), {'tone': 'faint', 'w': 1.8}] for a, b in rest] + [[str(a), str(b), {'tone': 'accent', 'w': 5}] for a, b in m]}
    p.update(extra); return p
write('113', 'proof', 'Counting perfect matchings in any graph',
  'Approximate counting of perfect matchings',
  'Claim: a polynomial-time randomized scheme counts the perfect matchings of any graph within $1 \\pm \\varepsilon$',
  {'dur': 8.4, 'layout': 'sequence', 'panels': [
    pmpanel(PMs[0], {'until': 2.9, 'edgeAt': 0.3, 'edgeDur': 1.6}),
    pmpanel(PMs[3], {'from': 2.9, 'until': 5.6, 'edgeAt': 0.1, 'edgeDur': 0.9}),
    pmpanel(PMs[1], {'from': 5.6, 'edgeAt': 0.1, 'edgeDur': 0.9})],
   'beats': [
     {'at': 0.2, 'text': 'A small graph with odd cycles; a perfect matching pairs every vertex exactly once'},
     {'at': 3.0, 'text': 'This one has 4 perfect matchings. Counting them exactly is #P-hard in general'},
     {'at': 5.7, 'text': 'Claimed: approximate the count in polynomial time for every graph, not just bipartite'}]},
  {'form': 'status', 'label': "Jerrum–Sinclair's general case (1989)",
   'statement': ['\\hat N \\in (1 \\pm \\varepsilon)\\, \\#\\mathrm{PM}(G) \\ \\text{ w.p. } 1-\\delta'],
   'context': 'Before: bipartite graphs only, the permanent (Jerrum–Sinclair–Vigoda, 2004), plus dense special cases',
   'stamp': 'proved',
   'note': 'Polynomial, but the degree is unspecified and surely large'},
  {'lean': 'main', 'detail': 'MatchingFPRAS.lean writes out the whole FPRAS definition; the face-dimension bound is not formalized',
   'ourCheck': CHECK_LEAN},
  [src('review 113, known_before', 'Jerrum-Sinclair (1989) FPRAS for all matchings and for perfect matchings when near-perfect/perfect ratio is polynomial, posing the general case'),
   src('review 113, known_before', 'Jerrum-Sinclair-Vigoda (JACM 2004) FPRAS for the permanent (bipartite)'),
   src('review 113, known_before', 'Valiant (1979) #P-completeness'),
   src('article, Counting perfect matchings in any graph', 'The polynomial is unspecified and surely large'),
   src('review 113, lean', 'The sharp global face-dimension bound is not part of the formalized statements.')])

# ---------------------------------------------------------------- 114
write('114', 'proof', 'Counting common bases of two matroids',
  'Approximate counting of common matroid bases',
  'Claim: a polynomial-time randomized scheme counts the common bases of two matroids given by oracles',
  {'dur': 8.2, 'primitive': 'venn',
   'sets': [{'label': 'bases of $M_1$', 'tone': 'cool'}, {'label': 'bases of $M_2$', 'tone': 'warn'}],
   'regions': [{'set': 'A&B', 'label': 'common bases', 'at': 2.6}],
   'members': [{'x': 0.47, 'y': 0.36}, {'x': 0.53, 'y': 0.47}, {'x': 0.48, 'y': 0.6}, {'x': 0.52, 'y': 0.7},
               {'x': 0.27, 'y': 0.45, 'tone': 'mute'}, {'x': 0.3, 'y': 0.6, 'tone': 'mute'}, {'x': 0.72, 'y': 0.42, 'tone': 'mute'}, {'x': 0.7, 'y': 0.62, 'tone': 'mute'}],
   'beats': [
     {'at': 0.2, 'text': 'Schematically: each matroid has its family of bases; count the ones they share'},
     {'at': 2.9, 'text': 'Bipartite perfect matchings are the common bases of two partition matroids'},
     {'at': 5.5, 'text': 'Claimed: approximate that count in polynomial time, with independence oracles'}]},
  {'form': 'status', 'label': 'Counting common bases of two matroids (open)',
   'statement': ['\\text{FPRAS for } |\\mathcal{B}(M_1) \\cap \\mathcal{B}(M_2)|'],
   'context': 'Before: one matroid (Anari–Liu–Oveis Gharan–Vinzant, 2019) and bipartite matchings (Jerrum–Sinclair–Vigoda)',
   'stamp': 'proved',
   'note': 'Oracle model; the polynomial degrees are unspecified'},
  {'lean': 'part', 'detail': 'In Lean: the two-matroid FPRAS. The polymatroid extension is not formalized',
   'ourCheck': CHECK_LEAN},
  [src('review 114, known_before', 'Anari-Liu-Oveis Gharan-Vinzant (STOC 2019) all matroids via log-concave polynomials'),
   src('review 114, known_before', 'Counting common bases of two matroids generalizes bipartite perfect matchings (JSV) and was a well-known open problem.'),
   src('review 114, caveats', 'Oracle model; polynomial degrees unspecified.'),
   src('review 114, lean', 'partial formalization: CommonBasesFPRAS.lean covers the two-matroid result; the polymatroid paper is not formalized')])

# ---------------------------------------------------------------- 115
T1 = [[2, 0, 1, 3], [1, 4, 0, 2], [0, 1, 3, 1]]
T2 = [[1, 2, 1, 2], [2, 1, 2, 2], [0, 2, 1, 2]]
def ctab(T):
    rs = [sum(r) for r in T]; cs = [sum(c) for c in zip(*T)]
    vals = [r + [s] for r, s in zip(T, rs)] + [cs + [sum(rs)]]
    return vals, rs, cs
v1, r1, c1 = ctab(T1); v2, r2, c2 = ctab(T2)
assert r1 == r2 and c1 == c2
margin = [[r, 4, 'faint'] for r in range(3)] + [[3, c, 'faint'] for c in range(5)]
def tpanel(v, extra):
    p = {'primitive': 'grid', 'rows': 4, 'cols': 5, 'values': v, 'cells': margin,
         'blocks': [{'r': 0, 'c': 0, 'h': 3, 'w': 4, 'label': 'the table', 'at': 1.0}, {'r': 0, 'c': 4, 'h': 4, 'w': 1, 'label': 'sums', 'tone': 'soft', 'at': 1.3}]}
    p.update(extra); return p
write('115', 'proof', 'Contingency tables with arbitrary margins',
  'Sampling and counting contingency tables',
  'Claim: exact uniform sampling of integer tables with any row and column sums, in expected polynomial time',
  {'dur': 8.4, 'layout': 'sequence', 'panels': [
    tpanel(v1, {'until': 4.2}),
    tpanel(v2, {'from': 4.2})],
   'beats': [
     {'at': 0.2, 'text': 'A contingency table: nonnegative integers with fixed row and column sums'},
     {'at': 4.3, 'text': 'Same margins, another table. The task is to draw one uniformly at random'},
     {'at': 6.6, 'text': 'Claimed: exactly uniform, in expected polynomial time, for any margins'}]},
  {'form': 'status', 'label': 'Uniform tables with both dimensions growing (open)',
   'statement': ['\\text{exact uniform sample in expected } \\mathrm{poly}(\\text{input bits})'],
   'context': 'Before: two rows (Dyer–Greenhill), a fixed number of rows (Cryan–Dyer), or dense margins',
   'stamp': 'proved',
   'note': "Exponents 'deliberately large'; exact sampling is polynomial only in expectation"},
  {'lean': 'main', 'detail': 'ContingencyTables.lean covers both papers: the samplers and the cell-bounded FPRAS',
   'ourCheck': CHECK_LEAN},
  [src('review 115, known_before', 'Dyer-Greenhill two rows; Cryan-Dyer and Cryan-Dyer-Goldberg-Jerrum-Martin fixed number of rows; Dyer-Kannan-Mount and Morris for dense/large margins'),
   src('review 115, known_before', 'A polynomial algorithm jointly in both dimensions for arbitrary margins was open.'),
   src('review 115, caveats', "Exponents are 'deliberately large'; exact sampler polynomial only in expectation."),
   src('review 115, lean', 'main theorem formalized: ContingencyTables.lean covers both papers (exact/bounded-time sampling and cell-bounded FPRAS); standard axioms')])

# ---------------------------------------------------------------- 116
write('116', 'proof', 'Black-box noncommutative identity testing',
  'Uniform black-box noncommutative identity testing',
  'Claim: one explicit matrix tuple of dimension at most $2ns^2$ catches every nonzero size-$s$ formula',
  {'dur': 8.4, 'primitive': 'equation', 'lines': [
     {'tex': 'f = \\term{a}{xy} - \\term{b}{yx}', 'note': 'nonzero as a formula', 'at': 0.3, 'y': 0.1,
      'terms': {'a': {'label': '$x$ then $y$', 'at': 0.4}, 'b': {'label': '$y$ then $x$', 'tone': 'cool', 'at': 0.8}}},
     {'tex': 'f(a,b) = ab - ba = 0 \\ \\text{for all numbers}', 'note': 'numbers miss it', 'tone': 'soft', 'at': 1.7, 'y': 0.38},
     {'tex': 'f(A,B) = AB - BA = \\term{m}{\\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}} \\ne 0', 'note': 'tiny matrices catch it', 'tone': 'accent', 'at': 3.1, 'y': 0.58,
      'terms': {'m': {'label': 'not zero', 'tone': 'accent', 'mark': 'box', 'at': 0.6}}}],
   'beats': [
     {'at': 0.2, 'text': 'In noncommuting variables, $xy - yx$ is a nonzero formula'},
     {'at': 2.9, 'text': 'Plug in numbers and it vanishes; plug in matrices and it need not'},
     {'at': 5.6, 'text': 'Claimed: one explicit tuple, dimension at most $2ns^2$, catches every nonzero size-$s$ formula'}]},
  {'form': 'status', 'label': 'Polynomial-size black-box hitting sets (open)',
   'statement': ['f \\ne 0 \\ \\Rightarrow \\ f(A_1, \\dots, A_n) \\ne 0, \\quad \\dim \\le 2ns^2'],
   'context': 'Before: quasipolynomial hitting sets for noncommutative ABPs (Forbes–Shpilka, 2013)',
   'stamp': 'proved',
   'note': 'Entries have bit length $O(n s^2 \\log n)$: polynomial, but heavy'},
  {'lean': 'part', 'detail': 'In Lean: the universal hitting property only, not the bit-time or dimension bounds',
   'ourCheck': CHECK_LEAN},
  [src('review 116, claim', 'one rational matrix tuple of dimension <= 2ns^2 on which every nonzero size-s noncommutative formula in n variables over any characteristic-zero field is nonzero'),
   src('review 116, known_before', 'Forbes-Shpilka (FOCS 2013) quasipolynomial black-box hitting sets for noncommutative ABPs'),
   src('review 116, caveats', 'Matrix entries have bit length O(n s^2 log n), so a single test is polynomial but heavy.'),
   src('review 116, lean', 'FormulaHitting.lean (universal hitting property only; bit-time and dimension bounds not asserted)')])

# ---------------------------------------------------------------- 117
CL = {'p0': (0.12, 0.22), 'p1': (0.34, 0.14), 'p2': (0.14, 0.82), 'p3': (0.36, 0.74),
      'q0': (0.66, 0.14), 'q1': (0.88, 0.22), 'q2': (0.64, 0.74), 'q3': (0.86, 0.82)}
EK4 = lambda p: [[p + str(a), p + str(b)] for a, b in itertools.combinations(range(4), 2)]
write('117', 'proof', 'Uniform Sparsest Cut: no constant factor',
  'Uniform sparsest cut: hardness and SDP gaps',
  'Claim: approximating Uniform Sparsest Cut within any fixed constant factor is NP-hard',
  {'dur': 8.4, 'primitive': 'graph', 'r': 14,
   'nodes': [{'id': k, 'x': x, 'y': y, 'tone': 'cool' if k[0] == 'p' else 'warn', 'fill': 'cool' if k[0] == 'p' else 'warn'} for k, (x, y) in CL.items()],
   'edges': EK4('p') + EK4('q') + [['p1', 'q0', {'tone': 'hot', 'w': 3.2}], ['p3', 'q2', {'tone': 'hot', 'w': 3.2}]],
   'edgeAt': 0.5, 'edgeDur': 3.0,
   'beats': [
     {'at': 0.2, 'text': 'Sparsest cut: split the graph where few edges cross per pair of vertices separated'},
     {'at': 2.9, 'text': 'Arora–Rao–Vazirani approximate it within $O(\\sqrt{\\log n})$; no constant-factor hardness was known'},
     {'at': 5.7, 'text': 'Claimed: no constant factor unless P = NP, and an SDP gap of nearly $\\sqrt{\\log n}$'}]},
  {'form': 'status', 'label': 'Unconditional hardness for Uniform Sparsest Cut (open)',
   'statement': ['\\text{NP-hard within any fixed } C > 1'],
   'context': 'Before: constant-factor hardness only under Small-Set Expansion; SDP gaps $\\exp(\\Omega(\\sqrt{\\log\\log n}))$',
   'stamp': 'proved',
   'note': 'Only the SDP gap is in Lean; the NP-hardness is paper only'},
  {'lean': 'part', 'detail': 'In Lean: the integrality-gap sequence only. The NP-hardness paper is not formalized',
   'ourCheck': CHECK_LEAN},
  [src('review 117, known_before', 'Arora-Rao-Vazirani O(sqrt log n) (JACM 2009)'),
   src('review 117, known_before', 'constant-factor hardness only under Small-Set Expansion (Raghavendra-Steurer-Tulsiani)'),
   src('review 117, known_before', 'later improved (per the paper) to exp(Omega(sqrt(log log n))) by Kane-Meka'),
   src('review 117, claim', 'For every fixed C>1, approximating Uniform Sparsest Cut (unit demand on every pair, nonnegative rational capacities) within factor C is NP-hard'),
   src('review 117, lean', 'partial formalization: UniformSparsestCut.lean covers only the integrality-gap sequence; the NP-hardness paper is not formalized')])

# ---------------------------------------------------------------- 118
def rect(x0, y0, w, h): return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]
H = 1.7; Y0 = -0.85; W8 = 0.5
bins = [-1.2, -0.25, 0.7]
items = [[0.45, 0.3, 0.2], [0.35, 0.35, 0.25], [0.5, 0.3]]
shapes = []
for k, (bx, its) in enumerate(zip(bins, items)):
    shapes.append({'kind': 'polygon', 'points': rect(bx, Y0, W8, H), 'tone': 'soft', 'fill': False, 'at': 0.2 + 0.2 * k, 'dur': 0.8})
for k, (bx, its) in enumerate(zip(bins, items)):
    y = Y0
    for j, sz in enumerate(its):
        assert sz > 1 / 6
        shapes.append({'kind': 'polygon', 'points': rect(bx + 0.04, y + 0.03, W8 - 0.08, sz * H - 0.06), 'tone': 'accent', 'fillA': 0.35, 'at': 1.0 + 0.25 * (3 * k + j), 'dur': 0.5})
        y += sz * H
write('118', 'disproof', 'Bin packing: unbounded configuration-LP gaps',
  'Bin packing and unbounded configuration-LP gaps',
  'Claim: the optimum can exceed the configuration LP by any constant number of bins',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'shape', 'until': 4.0, 'shapes': shapes},
    {'primitive': 'numberline', 'from': 4.0, 'min': 0, 'max': 5, 'ticks': [0, 1, 2, 3, 4, 5],
     'axisLabel': 'bins beyond the rounded-up LP value',
     'ranges': [{'from': 0, 'to': 1, 'label': 'conjectured', 'note': 'at most one bin', 'at': 0.4}],
     'slide': {'from': 1, 'to': 5, 'at': 1.3, 'dur': 1.6, 'label': 'claimed: unbounded', 'note': 'any constant $c$'}}],
   'beats': [
     {'at': 0.2, 'text': 'Pack items into unit bins; here a small packing, every item larger than $1/6$'},
     {'at': 4.1, 'text': 'The configuration LP was conjectured never to be off by more than one bin'},
     {'at': 6.6, 'text': 'Claimed: off by any constant, and NP-hard to get within $c$ bins'}]},
  {'form': 'status', 'label': 'Modified Integer Round-Up Conjecture (Scheithauer–Terno)',
   'statement': ['\\mathrm{OPT} \\le \\lceil \\mathrm{LP} \\rceil + 1'],
   'context': 'Counterexamples: for every $c$, LP value $B$ but optimum above $B + c$, all items larger than $1/6$',
   'stamp': 'disproved',
   'note': 'Also NP-hard to stay within any fixed number of bins of optimal'},
  {'lean': 'main', 'detail': 'BinPackingGap.lean, about 159k lines, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 118, known_before', 'Scheithauer-Terno Modified Integer Round-Up Conjecture OPT <= ceil(LP)+1'),
   src('review 118, claim', 'For every c>=0 there is a rational bin-packing instance with all items > 1/6 whose configuration LP (both size-type and individual-copy versions) has value B while the optimum exceeds B+c'),
   src('review 118, claim', 'for every fixed c it is NP-hard to distinguish packings in B bins from instances needing more than B+c bins'),
   src('review 118, lean', 'BinPackingGap.lean (OAI.BinPackingGap.main_results), ~159k lines, standard axioms')])

# ---------------------------------------------------------------- 119
write('119', 'proof', 'The Courtade–Kumar conjecture',
  'The Courtade–Kumar and Hellinger conjectures',
  'Claim: among Boolean functions of noisy bits, a single coordinate keeps the most information',
  {'dur': 8.4, 'primitive': 'plot', 'x': [0, 0.5], 'y': [0, 1.08],
   'xticks': [{'v': 0, 'label': '$0$'}, {'v': 0.5, 'label': '$1/2$'}],
   'yticks': [{'v': 0, 'label': '$0$'}, {'v': 1, 'label': '$1$'}],
   'xlabel': 'flip probability $\\varepsilon$', 'ylabel': 'bits $f(X)$ tells about $Y$',
   'curves': [{'f': '1 + x * log2(x) + (1 - x) * log2(1 - x)', 'from': 0.0005, 'label': '$1 - h_2(\\varepsilon)$', 'tone': 'claim', 'at': 0.8, 'dur': 2.0}],
   'regions': [{'f': '1 + x * log2(x) + (1 - x) * log2(1 - x)', 'from': 0.0005, 'to': 0.5, 'at': 3.4}],
   'beats': [
     {'at': 0.2, 'text': 'Flip each of $n$ fair bits with probability $\\varepsilon$; summarise the originals by one Boolean $f$'},
     {'at': 2.9, 'text': 'The curve is what a single coordinate keeps: $1 - h_2(\\varepsilon)$ bits'},
     {'at': 5.6, 'text': 'Claimed: no Boolean $f$ rises above it, at any noise level and any $n$'}]},
  {'form': 'status', 'label': 'Courtade–Kumar conjecture (2013)',
   'statement': ['I(f(X); Y) \\le 1 - h_2(\\varepsilon)'],
   'context': 'Before: high-noise ranges only (Samorodnitsky, 2016); balanced case to $\\rho \\le 0.914$ with computer help (Yu)',
   'stamp': 'proved',
   'note': 'The companion also proves the Hellinger conjecture; that paper is not in Lean'},
  {'lean': 'part', 'detail': 'In Lean: the sharp contraction and Courtade–Kumar with attainment; not the Hellinger paper',
   'ourCheck': CHECK_LEAN},
  [src('review 119, claim', 'For X uniform on {-1,1}^n, Y its image through independent BSC(eps) noise, and any Boolean f, I(f(X);Y) <= 1 - h_2(eps) bits, attained by a coordinate (Courtade-Kumar)'),
   src('article, The Courtade–Kumar conjecture', 'Courtade and Kumar conjectured in 2013 (IEEE Transactions on Information Theory, 2014)'),
   src('article, The Courtade–Kumar conjecture', 'Samorodnitsky (2016) proved it in a high-noise range, Yu pushed the balanced case to correlation $0.914$ with computer assistance'),
   src('review 119, lean', 'the separate Hellinger paper is not formalized (the Courtade-Kumar bound itself is)')])

# ---------------------------------------------------------------- 120
BL = {'b0': (0.42, 0.18), 'b1': (0.62, 0.12), 'b2': (0.72, 0.48), 'b3': (0.58, 0.8), 'b4': (0.4, 0.62), 's1': (0.22, 0.32), 's2': (0.08, 0.6)}
write('120', 'improved-bound', 'Maximum matching in almost-linear time',
  'Almost-linear-time maximum matching in general graphs',
  'Claim: a maximum matching in any graph in $(n+m)^{1+o(1)}$ time, with success probability at least $2/3$',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'graph', 'until': 4.2, 'r': 15,
     'nodes': [{'id': k, 'x': x, 'y': y, 'tone': 'accent' if k[0] == 'b' else 'soft'} for k, (x, y) in BL.items()],
     'edges': [['b0', 'b1', {'tone': 'soft'}], ['b1', 'b2', {'tone': 'accent', 'w': 5}], ['b2', 'b3', {'tone': 'soft'}], ['b3', 'b4', {'tone': 'accent', 'w': 5}], ['b4', 'b0', {'tone': 'soft'}],
               ['s1', 'b0', {'tone': 'accent', 'w': 5}], ['s2', 's1', {'tone': 'soft'}]],
     'edgeAt': 0.4, 'edgeDur': 2.4},
    {'primitive': 'numberline', 'from': 4.2, 'min': 0.8, 'max': 1.7, 'ticks': [1, 1.25, 1.5],
     'axisLabel': 'exponent $e$ in time $n^{e}$ on sparse graphs, $m \\approx n$',
     'markers': [{'v': 1.5, 'label': 'Micali–Vazirani', 'note': '1980, $m\\sqrt n$', 'at': 0.4, 'derived': 'm sqrt n with m = n'}],
     'slide': {'from': 1.5, 'to': 1, 'at': 1.2, 'dur': 1.5, 'label': 'claimed', 'note': '$(n+m)^{1+o(1)}$', 'derived': '3/2 to 1'}}],
   'beats': [
     {'at': 0.2, 'text': 'A blossom: an odd cycle, the structure that makes general matching hard'},
     {'at': 4.3, 'text': 'General graphs sat at $O(m\\sqrt n)$ since 1980; bipartite went almost-linear in 2022'},
     {'at': 6.8, 'text': 'Claimed: almost-linear for every graph, Monte Carlo'}]},
  {'form': 'bound',
   'before': {'label': 'Best known since 1980', 'tex': 'O(m\\sqrt n)', 'note': 'Micali–Vazirani'},
   'after': {'label': 'Claimed, 24 Sep 2026', 'tex': '(n+m)^{1+o(1)}', 'note': 'randomized, success at least $2/3$'},
   'note': 'The $o(1)$ is unquantified and likely galactic'},
  {'lean': 'none', 'detail': 'No Lean statement; the 86-page manuscript is the only evidence',
   'ourCheck': CHECK_NONE},
  [src('review 120, known_before', 'Micali-Vazirani O(m sqrt n) (FOCS 1980)'),
   src('review 120, known_before', 'Bipartite matching is m^{1+o(1)} via almost-linear max flow (Chen-Kyng-Liu-Peng-Probst Gutenberg-Sachdeva, FOCS 2022)'),
   src('review 120, claim', 'finds a maximum-cardinality matching in any simple graph with n vertices and m edges in (n+m)^{1+o(1)} time on every computation path, correct with probability >= 2/3'),
   src('catalogue, family 120 manuscript path', 'Almost-Linear-Time-Maximum-Cardinality-Matching-in-Sparse-General-Graphs-September-24-2026/main.pdf'),
   src('review 120, caveats', 'o(1) exponent loss unquantified and likely galactic'),
   src('article, Maximum matching in almost-linear time', 'This 86-page paper')])

# ---------------------------------------------------------------- 121
s, t = 'kitten', 'sitting'
D = [[0] * (len(t) + 1) for _ in range(len(s) + 1)]
for i in range(len(s) + 1):
    for j in range(len(t) + 1):
        D[i][j] = j if i == 0 else i if j == 0 else min(D[i-1][j] + 1, D[i][j-1] + 1, D[i-1][j-1] + (s[i-1] != t[j-1]))
assert D[-1][-1] == 3
path = [(len(s), len(t))]; i, j = len(s), len(t)
while i or j:
    if i and j and D[i][j] == D[i-1][j-1] + (s[i-1] != t[j-1]): i, j = i - 1, j - 1
    elif i and D[i][j] == D[i-1][j] + 1: i -= 1
    else: j -= 1
    path.append((i, j))
vals = [['', ''] + list(t)] + [[('' if i == 0 else s[i-1])] + D[i] for i in range(len(s) + 1)]
write('121', 'improved-bound', '$(1+\\varepsilon)$ edit distance, almost linear',
  'Almost-linear approximation of edit distance',
  'Claim: edit distance within any fixed factor $1+\\varepsilon$ in $N^{1+o(1)}$ expected time',
  {'dur': 8.4, 'primitive': 'grid', 'rows': len(s) + 2, 'cols': len(t) + 2, 'values': vals, 'stagger': 0.05,
   'cells': [[i + 1, j + 1, 'accent'] for i, j in path],
   'beats': [
     {'at': 0.2, 'text': 'Exact edit distance fills a quadratic table: kitten to sitting costs 3'},
     {'at': 2.9, 'text': 'Truly subquadratic exact algorithms would refute SETH (Backurs–Indyk, 2015)'},
     {'at': 5.6, 'text': 'Claimed: any fixed accuracy $1+\\varepsilon$ in almost-linear time'}]},
  {'form': 'bound',
   'before': {'label': 'Best near-linear, FOCS 2020', 'tex': 'O(1)\\text{-approx}', 'note': 'Andoni–Nosatzki, in time $n^{1+\\xi}$'},
   'after': {'label': 'Claimed, 24 Sep 2026', 'tex': '(1+\\varepsilon)\\text{-approx}', 'note': 'in $N^{1+o(1)}$ expected time, success at least $2/3$'},
   'note': "Exact DP still runs below a length threshold the paper calls 'very large'"},
  {'lean': 'main', 'detail': 'EditApproximation.lean, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 121, known_before', 'Backurs-Indyk (STOC 2015): truly subquadratic exact algorithm refutes SETH'),
   src('review 121, known_before', 'Andoni-Nosatzki (FOCS 2020) constant factor (depending on xi) in n^{1+xi}'),
   src('review 121, claim', 'returns D with ED <= D <= (1+eps)ED with probability >= 2/3, in worst-case expected time N^{1+o(1)}'),
   src('catalogue, family 121 manuscript path', 'An-Almost-Linear-Approximation-Scheme-for-Edit-Distance-September-24-2026/paper.pdf'),
   src('review 121, caveats', "the algorithm runs exact DP below an accuracy-dependent length threshold the paper calls 'very large'"),
   src('review 121, lean', 'main theorem formalized: EditApproximation.lean, standard axioms')])

# ---------------------------------------------------------------- 122
bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0]
dele = [1, 4, 8]
trace = [b for k, b in enumerate(bits) if k not in dele]
write('122', 'improved-bound', 'Trace reconstruction: superpolynomial',
  'Quantitative trace-reconstruction bounds',
  'Claim: recovering an arbitrary $n$-bit string from random-deletion traces needs $n^{\\Omega(\\log\\log n)}$ traces',
  {'dur': 8.4, 'layout': 'sequence', 'panels': [
    {'primitive': 'sequence', 'until': 4.3, 'items': bits, 'perRow': len(bits), 'stagger': 0.08,
     'marks': {str(k): {'tone': 'bad', 'at': 1.8 + 0.3 * n} for n, k in enumerate(dele)},
     'caption': 'the hidden string; each bit is deleted independently'},
    {'primitive': 'sequence', 'from': 4.3, 'items': trace, 'perRow': len(bits), 'stagger': 0.08,
     'caption': 'one trace: only the survivors, positions unknown'}],
   'beats': [
     {'at': 0.2, 'text': 'Each bit is deleted with a fixed probability; you see only what survives'},
     {'at': 4.4, 'text': 'From many such traces, recover the whole string exactly'},
     {'at': 6.7, 'text': 'Claimed: the worst case needs $n^{\\Omega(\\log\\log n)}$ traces'}]},
  {'form': 'bound',
   'before': {'label': 'Best lower bound before', 'tex': '\\tilde\\Omega(n^{3/2})', 'note': 'Chase, arXiv 1905.03031'},
   'after': {'label': 'Claimed, 24 Sep 2026', 'tex': 'n^{\\Omega(\\log\\log n)}', 'note': 'at every fixed deletion probability'},
   'note': 'Also claimed: quasipolynomial upper bounds, down from $\\exp(\\tilde O(n^{1/5}))$'},
  {'lean': 'part', 'detail': 'In Lean: the lower bounds only. Both quasipolynomial upper-bound papers are not',
   'ourCheck': CHECK_LEAN},
  [src('review 122, known_before', "lower bound Omega~(n^{3/2}) by Chase ('New lower bounds for trace reconstruction', arXiv 1905.03031)"),
   src('review 122, claim', 'For every fixed deletion probability q in (0,1), exact worst-case reconstruction of an n-bit string from i.i.d. deletion traces needs n^{Omega(log log n)} traces'),
   src('article, Trace reconstruction', 'quantitative-lower-bounds-for-trace-reconstruction-September-24-2026/paper.pdf'),
   src('article, Trace reconstruction', '$\\exp(\\tilde O(n^{1/5}))$ above (Chase, 2021)'),
   src('review 122, lean', 'partial formalization: TraceReconstruction.lean covers the lower bounds only; both quasipolynomial upper-bound papers are unformalized')])

# ---------------------------------------------------------------- 124
J = {'a': (0.1, 0.12), 'b': (0.1, 0.5), 'c': (0.1, 0.88), 'd': (0.36, 0.2), 'e': (0.36, 0.55), 'f': (0.36, 0.9), 'g': (0.62, 0.25), 'h': (0.62, 0.65), 'i': (0.88, 0.6)}
P = [('a', 'd'), ('b', 'd'), ('b', 'e'), ('c', 'f'), ('d', 'g'), ('e', 'g'), ('e', 'h'), ('f', 'i'), ('h', 'i')]
slots = [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', ''], ['i', '', '']]
when = {j: k for k, sl in enumerate(slots) for j in sl if j}
assert all(when[u] < when[v] for u, v in P) and len(when) == 9
gvals = [[slots[c][m] for c in range(4)] for m in range(3)]
write('124', 'proof', 'Three machines, unit jobs: in P',
  'Polynomial-time scheduling on three identical machines',
  'Claim: unit jobs with any precedence constraints are scheduled optimally on three machines in polynomial time',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'graph', 'until': 4.0, 'r': 18,
     'nodes': [{'id': k, 'x': x, 'y': y, 'label': k} for k, (x, y) in J.items()],
     'edges': [[u, v] for u, v in P], 'edgeAt': 0.5, 'edgeDur': 2.4},
    {'primitive': 'grid', 'from': 4.0, 'rows': 3, 'cols': 4, 'values': gvals,
     'cells': [[m, c, 'accent'] for m in range(3) for c in range(4) if gvals[m][c]],
     'caption': 'rows: three machines; columns: time steps. Makespan $4$, forced by the chain $b, e, h, i$'}],
   'beats': [
     {'at': 0.2, 'text': 'A small instance: unit-time jobs, each edge says the left job must finish first'},
     {'at': 4.1, 'text': 'An optimal schedule on three identical machines'},
     {'at': 6.6, 'text': 'Claimed: always found in polynomial time, settling OPEN8 from 1979'}]},
  {'form': 'status', 'label': 'Garey–Johnson OPEN8 (1979)',
   'statement': ['P3 \\mid \\mathrm{prec}, p_j = 1 \\mid C_{\\max} \\ \\in \\ \\mathsf{P}'],
   'context': 'Before: two machines in P (Coffman–Graham, 1972); unboundedly many NP-complete (Ullman, 1975)',
   'stamp': 'proved',
   'note': 'Time $O((L+2)^{150020})$: a classification, not an algorithm to run'},
  {'lean': 'main', 'detail': 'ThreeMachine.lean fixes the exponent 150020 in the statement; about 18.6k lines',
   'ourCheck': CHECK_LEAN},
  [src('review 124, known_before', 'Three machines is OPEN8 in Garey-Johnson (1979)'),
   src('review 124, known_before', 'Two machines polynomial (Fujii-Kasami-Ninomiya 1969; Coffman-Graham 1972); NP-complete with m in the input (Ullman 1975)'),
   src('review 124, claim', 'in O((L+2)^150020) multitape-TM steps'),
   src('review 124, lean', 'solution OAI/Computability/Scheduling (53 files, ~18.6k lines)'),
   src('article, Three machines', '(C * ((encodeInput G deadline).length + 2) ^ 150020)')])
print('b done')
