from lib import *
import itertools

# ---------------------------------------------------------------- 185 --
write({
    'id': '185', 'discipline': 'Combinatorics', 'kind': 'counterexample',
    'short': 'Infinite matroid intersection fails',
    'title': {'title': 'Infinite matroid intersection and packing/covering fail',
              'subtitle': 'Claim: two self-dual matroids on a countable set admit no packing/covering partition and no intersection'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'sequence', 'items': ['$\\cdots$', '$Q$', '$Q$', '$Q$', '$Q$', '$Q$', '$\\cdots$'], 'until': 3.8, 'stagger': 0.18,
             'marks': {str(i): 'accent' for i in range(1, 6)},
             'caption': 'copies of one self-dual uniform matroid $Q$, along a doubly infinite path'},
            {'primitive': 'equation', 'from': 3.8, 'lines': [
                {'tex': 'M_0 = M_0^{*},\\qquad M_1 = M_1^{*}', 'note': 'self-dual', 'at': 0.3},
                {'tex': '\\nexists\\ I_0 \\cup I_1 = E,\\ \\ I_j \\text{ independent in } M_j', 'tone': 'claim', 'at': 1.6}]}],
        'beats': [
            {'at': 0.2, 'text': 'One self-dual uniform matroid $Q$, built with an ultrafilter, copied along a path'},
            {'at': 3.9, 'text': 'Covering the ground set by two independent sets would make an ordinal descend forever'},
            {'at': 6.3, 'text': 'So infinite intersection and packing/covering fail, in ZFC'}]},
    'achievement': {
        'form': 'status', 'label': 'Infinite matroid intersection and packing/covering conjectures',
        'statement': ['\\text{every pair } M_0, M_1 \\text{ has a packing/covering partition}'],
        'context': 'Two self-dual partitional matroids on a countable set; neither finitary nor cofinitary',
        'stamp': 'counterexample',
        'note': "Nash-Williams' original finitary conjecture is untouched"},
    'verify': {'lean': 'main',
               'detail': "Countable $E$, two self-dual matroids, no covering and no partition; Mathlib's matroids",
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('185', 'claim', 'both self-dual and partitional (countable direct sums of one self-dual uniform matroid Q), such that no independent I0 of M0 and I1 of M1 cover E'),
        R('185', 'explainer', 'then places copies along a doubly infinite path so that any attempt to cover the ground set by two independent sets must \'descend\' forever in ordinal rank'),
        R('185', 'claim', 'Examples are neither finitary nor cofinitary.'),
        A('Five smaller results', "so Nash-Williams' original finitary conjecture is untouched"),
        A('Five smaller results', "It is formalized using Mathlib's infinite matroids"),
    ]})

# ---------------------------------------------------------------- 186 --
write({
    'id': '186', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Sharp thresholds for graph properties',
    'title': {'title': 'Graph properties jump within $(\\log n)^{-2}$',
              'subtitle': 'Claim: symmetric monotone graph properties go from $\\varepsilon$ to $1-\\varepsilon$ in an edge-density window $O((\\log n)^{-2})$'},
    'object': {
        'dur': 8.4, 'primitive': 'plot', 'x': [0, 1], 'y': [0, 1.08], 'labelRoom': 220, 'yticks': [0, 1],
        'xlabel': 'edge probability $p$, schematic', 'ylabel': '$\\Pr[\\text{property}]$',
        'curves': [
            {'f': '1/(1+exp(-(x-0.5)*9))', 'label': 'width $1/\\log n$', 'tone': 'soft', 'dash': True, 'at': 0.5, 'labelDy': 26},
            {'f': '1/(1+exp(-(x-0.5)*42))', 'label': 'width $(\\log n)^{-2}$', 'tone': 'accent', 'at': 4.4, 'labelDy': -14}],
        'beats': [
            {'at': 0.2, 'text': 'Schematic: a symmetric monotone graph property jumps from unlikely to likely'},
            {'at': 2.8, 'text': 'Friedgut–Kalai, 1996: the jump takes a window of width $O(1/\\log n)$'},
            {'at': 5.6, 'text': 'The claim: width $(\\log n)^{-2}$, the optimum they conjectured'}]},
    'achievement': {
        'form': 'status', 'label': 'Friedgut–Kalai threshold-width conjecture (1996)',
        'statement': ['p_{1-\\varepsilon} - p_{\\varepsilon} \\le 2^{19}\\, \\tfrac{\\log(1/2\\varepsilon)}{(\\log n)^2}'],
        'context': 'Bourgain–Kalai had $(\\log n)^{-2+\\eta}$ for every $\\eta > 0$; the gain is removing $\\eta$',
        'stamp': 'proved',
        'note': 'The hypergraph companion, width $(\\log n)^{-r/(r-1)}$, is not in Lean'},
    'verify': {'lean': 'part',
               'detail': 'In Lean: the graph case with the explicit constant $2^{19}$. Not the hypergraph theorem',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        A('Sharp thresholds for graph properties', 'Friedgut and Kalai proved in 1996 that symmetric monotone graph properties have threshold width $O(1/\\log n)$ and conjectured $(\\log n)^{-2}$'),
        A('Sharp thresholds for graph properties', 'Family 186 claims $2^{19} \\log(1/2\\epsilon)/(\\log n)^2$'),
        A('Sharp thresholds for graph properties', 'The gain over Bourgain–Kalai is removing $\\eta$, and the hypergraph companion is unformalized'),
        R('186', 'lean', 'The hypergraph influence theorem (r>=3, separate Oct 5 paper) is not formalized.'),
    ]})

# ---------------------------------------------------------------- 187 --
snaky = [(3, 2), (3, 3), (3, 4), (3, 5), (2, 5), (2, 6)]
write({
    'id': '187', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Snaky in 21 Maker moves',
    'title': {'title': 'Maker builds Snaky in 21 moves',
              'subtitle': 'Claim: on the empty infinite grid, Maker forces the Snaky hexomino within 21 of its own moves'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'grid', 'rows': 5, 'cols': 9, 'until': 3.8, 'stagger': 0.02,
             'cells': [[r, c, 'accent'] for (r, c) in snaky],
             'caption': 'Snaky: six cells; any translation, rotation or reflection counts'},
            {'primitive': 'numberline', 'from': 3.8, 'min': 17, 'max': 39, 'ticks': [],
             'axisLabel': 'Maker moves, by certificate in the paper',
             'markers': [
                 {'v': 35, 'label': '35 moves', 'note': 'certificate', 'at': 0.4},
                 {'v': 25, 'label': '25 moves', 'note': 'certificate', 'at': 0.8},
                 {'v': 21, 'label': '21 moves', 'note': 'the headline', 'tone': 'claim', 'at': 1.4}]}],
        'beats': [
            {'at': 0.2, 'text': 'Snaky: the one hexomino whose Maker–Breaker game on the grid was undecided'},
            {'at': 3.9, 'text': 'Players alternately claim cells; Maker wins by owning a copy of Snaky'},
            {'at': 6.3, 'text': 'The claim: Maker wins within 21 moves, staying inside a fixed 251-cell region'}]},
    'achievement': {
        'form': 'status', 'label': "Snaky in Harary's achievement game, open about 40 years",
        'statement': ['\\text{Maker builds Snaky within } 21 \\text{ moves}'],
        'context': 'Known before: a winner in 3 dimensions and with a handicap, a loser on $8 \\times 8$',
        'stamp': 'proved',
        'note': 'A certificate of 728 conditions; it also works on a $17 \\times 17$ board'},
    'verify': {'lean': 'main',
               'detail': 'An explicit Maker policy beats every legal Breaker sequence within 21 claims',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('187', 'claim', 'within 21 Maker moves against any Breaker play; the strategy confines Maker to a fixed 251-cell region and works on a 17x17 board'),
        R('187', 'claim', 'an explicit certificate of 728 conditions; alternative 25- and 35-move certificates are also given'),
        R('187', 'explainer', 'open for about 40 years'),
        R('187', 'known_before', 'winner in 41 dimensions (Sieben, Integers 4 (2004) G05), in 3 dimensions and with planar handicap 1, loser on 8x8'),
        R('187', 'lean', 'holds a Snaky after 21 Maker claims'),
        C('187', 'Snaky-in-21-Maker-moves'),
    ]})

# ---------------------------------------------------------------- 188 --
random.seed(11)
n = 7
E = {frozenset(e) for e in itertools.combinations(range(n), 2)}
removed = []
while True:
    tris = [t for t in itertools.combinations(range(n), 3) if all(frozenset(p) in E for p in itertools.combinations(t, 2))]
    if not tris:
        break
    t = random.choice(tris)
    for p in itertools.combinations(t, 2):
        E.discard(frozenset(p)); removed.append(tuple(sorted(p)))
leave = sorted(tuple(sorted(e)) for e in E)
assert len(removed) + len(leave) == 21
k7 = [(math.cos(math.pi / 2 + 2 * math.pi * k / 7), math.sin(math.pi / 2 + 2 * math.pi * k / 7)) for k in range(7)]
kf = place(k7, scale=190, cy=356)
write({
    'id': '188', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Random triangle removal: the constant',
    'title': {'title': 'The sharp terminal leave in random triangle removal',
              'subtitle': 'Claim: deleting random triangles from $K_n$ leaves about $n^{3/2}/(2\\sqrt 2)$ edges'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'r': 14, 'edgeAt': 0.4, 'edgeDur': 2.6, 'until': 3.8,
             'nodes': [{'id': f'v{k}', 'x': kf[k][0], 'y': kf[k][1]} for k in range(7)],
             'edges': [[f'v{a}', f'v{b}', {'tone': 'faint', 'w': 1.6, 'a': 0.6}] for a, b in removed] +
                      [[f'v{a}', f'v{b}', {'tone': 'accent', 'w': 4}] for a, b in leave]},
            {'primitive': 'numberline', 'from': 3.8, 'min': 1.0, 'max': 2.12,
             'ticks': [{'v': 1.5, 'label': '$3/2$'}, {'v': 1.75, 'label': '$7/4$'}, 2],
             'axisLabel': 'edges left $\\approx n^{e}$',
             'markers': [
                 {'v': 2, 'label': 'Spencer', 'note': '1995, $o(n^2)$', 'at': 0.4},
                 {'v': 1.75, 'derived': '7/4', 'label': 'BFL', 'note': '2010, up to logs', 'at': 0.8},
                 {'v': 1.5, 'derived': '3/2', 'label': 'BFL', 'note': '2015, $n^{3/2+o(1)}$', 'at': 1.2},
                 {'v': 1.5, 'derived': '3/2', 'label': 'claimed constant', 'note': '$1/(2\\sqrt 2)$', 'tone': 'claim', 'side': 'below', 'at': 2.2}]}],
        'beats': [
            {'at': 0.2, 'text': 'One run on $K_7$: delete random triangles until none is left; bright edges survive'},
            {'at': 3.9, 'text': 'From $K_n$, about $n^{3/2+o(1)}$ edges survive (Bohman–Frieze–Lubetzky, 2015)'},
            {'at': 6.3, 'text': 'The claim pins the constant: the leave over $n^{3/2}$ tends to $1/(2\\sqrt 2)$'}]},
    'achievement': {
        'form': 'status', 'label': 'Random triangle removal: the sharp constant (Joos–Kühn)',
        'statement': ['F_n / n^{3/2} \\to 1/(2\\sqrt 2) \\ \\text{ in } L^2'],
        'context': 'Before: $n^{3/2+o(1)}$ (Bohman–Frieze–Lubetzky, 2015); the constant was a Joos–Kühn prediction',
        'stamp': 'proved',
        'note': 'Triangles only, starting from $K_n$; no fluctuation law'},
    'verify': {'lean': 'main',
               'detail': 'The $L^2$ limit, in probability and in expectation, including the prefix input',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('188', 'known_before', 'Spencer (1995) and Rödl–Thoma (1996): o(n^2)'),
        R('188', 'known_before', 'Bohman–Frieze–Lubetzky: O(n^{7/4} log^{5/4} n) (2010)'),
        R('188', 'known_before', "F_n = n^{3/2+o(1)} whp ('Random triangle removal', Adv. Math. 2015"),
        R('188', 'claim', 'the final edge count F_n satisfies E[(F_n/n^{3/2} - 1/(2 sqrt 2))^2] -> 0'),
        R('188', 'claim', 'Only for starting graph K_n and triangles; no fluctuation law.'),
        A('Random triangle removal', 'including the Joos–Kühn prefix input rather than assuming it'),
    ]})

# ---------------------------------------------------------------- 189 --
L3 = [(-1.5, 0.75), (-2.1, -0.45), (-0.9, -0.45)]
R3 = [(1.5, 0.75), (0.9, -0.45), (2.1, -0.45)]
rf = place(L3 + R3, scale=150, cy=340)
nodes = [{'id': f'a{k}', 'x': rf[k][0], 'y': rf[k][1], 'tone': 'bad'} for k in range(3)] + \
        [{'id': f'b{k}', 'x': rf[3 + k][0], 'y': rf[3 + k][1], 'tone': 'bad'} for k in range(3)]
red = [[f'{s}{i}', f'{s}{j}', {'tone': 'bad', 'w': 4}] for s in 'ab' for i, j in [(0, 1), (1, 2), (0, 2)]]
blue = [[f'a{i}', f'b{j}', {'tone': 'cool', 'w': 1.6, 'a': 0.55}] for i in range(3) for j in range(3)]
write({
    'id': '189', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Cycle–clique Ramsey numbers',
    'title': {'title': 'Cycle–clique Ramsey numbers, all of them',
              'subtitle': 'Claim: $R(C_m, K_n) = (m-1)(n-1) + 1$ for every $m \\ge n \\ge 3$, except $R(C_3, K_3) = 6$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'r': 14, 'edgeAt': 0.4, 'edgeDur': 2.4, 'until': 3.9, 'nodes': nodes, 'edges': red + blue},
            {'primitive': 'equation', 'from': 3.9, 'lines': [
                {'tex': 'R(C_m, K_n) = (m-1)(n-1) + 1', 'tone': 'claim', 'note': '$m \\ge n \\ge 3$', 'at': 0.3},
                {'tex': 'R(C_3, K_3) = 6', 'note': 'the one exception', 'at': 1.4}]}],
        'beats': [
            {'at': 0.2, 'text': '$m = 4$, $n = 3$: two red triangles, blue between. No red 4-cycle, no blue triangle'},
            {'at': 4.0, 'text': 'So $(m-1)(n-1)$ vertices are not enough; the conjecture says one more always is'},
            {'at': 6.3, 'text': 'Claimed for every $m \\ge n \\ge 3$, closing the finitely many cases left open'}]},
    'achievement': {
        'form': 'status', 'label': 'Cycle–clique Ramsey conjecture (1978)',
        'statement': ['R(C_m, K_n) = (m-1)(n-1) + 1 \\quad (m \\ge n \\ge 3)'],
        'context': 'Keevash–Long–Skokan had left finitely many cases; 3,099 patterns are excluded by computer',
        'stamp': 'proved',
        'note': 'A completion of a nearly solved conjecture, with one exception at $(3,3)$'},
    'verify': {'lean': 'main',
               'detail': 'The full range, with about 214 MB of generated certificates',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('189', 'known_before', "'On cycle–complete graph Ramsey numbers', J. Graph Theory 2 (1978)"),
        A('Five smaller results', 'Keevash, Long and Skokan had already reduced it to finitely many cases; the residue is 3,099 computer-checked patterns, and the Lean development is about 214 MB of generated certificates'),
        R('189', 'claim', 'The lower bound is n-1 disjoint red K_{m-1}\'s'),
        R('189', 'caveats', 'this is a completion of a nearly-solved conjecture rather than a breakthrough'),
    ]})

# ---------------------------------------------------------------- 190 --
write({
    'id': '190', 'discipline': 'Combinatorics', 'kind': 'counterexample',
    'short': 'Ordered matrix removal is not polynomial',
    'title': {'title': 'Polynomial removal fails for ordered binary matrices',
              'subtitle': 'Claim: one fixed $66 \\times 66$ zero–one pattern has no polynomial ordered removal bound'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'grid', 'rows': 2, 'cols': 2, 'until': 3.8, 'values': [['1', '0'], ['1', '1']],
             'cells': [[0, 0, 'accent'], [1, 0, 'accent'], [1, 1, 'accent']],
             'caption': 'the $2 \\times 2$ core of the pattern; the full pattern is $66 \\times 66$'},
            {'primitive': 'equation', 'from': 3.8, 'lines': [
                {'tex': '\\varepsilon\\text{-far} \\;\\Rightarrow\\; N_H(A) \\ge c\\,\\varepsilon^{C} n^{132}', 'note': 'conjectured', 'tone': 'mute', 'at': 0.3},
                {'tex': '\\text{fails for one } 66 \\times 66 \\ H', 'note': 'claimed', 'tone': 'claim', 'at': 1.8}]}],
        'beats': [
            {'at': 0.2, 'text': 'Ordered copies keep the row and column order, and match zeros as well as ones'},
            {'at': 3.9, 'text': 'Conjecture: a matrix far from pattern-free holds polynomially many copies'},
            {'at': 6.3, 'text': 'The claim: avoidance runs a 1 and a 0 down a binary tree until they collide'}]},
    'achievement': {
        'form': 'status', 'label': 'Polynomial ordered matrix removal (Alon–Ben-Eliezer)',
        'statement': ['N_H(A) \\ge c\\,\\varepsilon^{C} n^{132} \\ \\text{ for all far } A'],
        'context': 'One explicit pattern; whether small patterns admit polynomial removal is open',
        'stamp': 'counterexample'},
    'verify': {'lean': 'main',
               'detail': 'An explicit $66 \\times 66$ pattern defeats every $c, C > 0$; listed',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('190', 'claim', 'There is an explicit 66x66 binary pattern H'),
        R('190', 'lean', 'copyCount < c eps^C n^132'),
        R('190', 'explainer', 'the 2x2 core [[1,0],[1,1]] makes avoidance propagate a 1 and a 0 down tree paths until they collide at the leaves'),
        R('190', 'caveats', 'whether small patterns admit polynomial removal is open'),
        R('190', 'lean', 'listed in formalization.yaml main_results'),
    ]})

# ---------------------------------------------------------------- 191 --
HB = [(0.76, -0.25), (0.66, 0.43), (-0.7, 0.66), (0.56, -0.76), (-0.83, 0.36), (0.25, 0.63), (-0.57, -0.58)]
area = lambda t: abs((HB[t[1]][0] - HB[t[0]][0]) * (HB[t[2]][1] - HB[t[0]][1]) - (HB[t[2]][0] - HB[t[0]][0]) * (HB[t[1]][1] - HB[t[0]][1])) / 2
tri = min(itertools.combinations(range(7), 3), key=area)
write({
    'id': '191', 'discipline': 'Combinatorics', 'kind': 'improved-bound',
    'short': 'Heilbronn triangles: a power gain',
    'title': {'title': 'A power improvement for the Heilbronn triangle problem',
              'subtitle': 'Claim: $n$ points in the unit square with every triangle of area at least $n^{-2+c}$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'shape', 'until': 3.8, 'scale': 1.0,
             'shapes': [{'kind': 'polygon', 'points': [[-1, -1], [1, -1], [1, 1], [-1, 1]], 'tone': 'faint', 'fill': False, 'w': 1.6, 'at': 0.1, 'dur': 0.8},
                        {'kind': 'polygon', 'points': [list(HB[k]) for k in tri], 'tone': 'hot', 'fillA': 0.35, 'at': 2.0, 'dur': 0.8}],
             'points': [{'p': list(p), 'tone': 'ink', 'at': 0.6 + 0.12 * k} for k, p in enumerate(HB)]},
            {'primitive': 'numberline', 'from': 3.8, 'min': -2.6, 'max': -1.0,
             'ticks': [{'v': -2, 'label': '$-2$'}, {'v': -1.166667, 'label': '$-7/6$'}],
             'axisLabel': 'smallest area $\\Delta(n) \\approx n^{e}$',
             'markers': [
                 {'v': -2, 'label': 'KPS 1982', 'note': '$\\log n / n^2$', 'at': 0.4},
                 {'v': -1.166667, 'derived': '-7/6', 'label': 'upper bound', 'note': '$n^{-7/6+o(1)}$', 'style': 'ring', 'tone': 'mute', 'at': 0.8},
                 {'v': -2, 'label': 'claimed $-2 + \\eta$', 'note': '$\\eta$ is tiny', 'tone': 'claim', 'side': 'below', 'at': 2.0}]}],
        'beats': [
            {'at': 0.2, 'text': 'Seven points in a square; the smallest triangle they form is highlighted'},
            {'at': 3.9, 'text': 'How large can the smallest triangle be forced to be? Since 1982: $\\log n / n^2$'},
            {'at': 6.3, 'text': 'The claim: $c\\,n^{-2+\\eta}$, a genuine power gain, though $\\eta$ is tiny'}]},
    'achievement': {
        'form': 'bound',
        'before': {'label': 'Best known since 1982', 'tex': '\\Delta(n) \\gtrsim \\frac{\\log n}{n^2}', 'note': 'Komlós–Pintz–Szemerédi'},
        'after': {'label': 'Claimed, Sep 2026', 'tex': '\\Delta(n) \\ge c\\, n^{-2+\\eta}', 'note': 'Lean uses $\\eta = 1/(10^5 K)$'},
        'note': 'Lean proves it along an unbounded sequence of $n$, not every large $n$'},
    'verify': {'lean': 'part',
               'detail': 'In Lean: an unbounded sequence of $n$, with explicit $\\eta$. Not every large $n$',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        A('The Heilbronn triangle problem', "Komlós, Pintz and Szemerédi's $\\log n / n^2$ lower bound has stood since 1982"),
        A('The Heilbronn triangle problem', 'consistent with the known upper bound $n^{-7/6+o(1)}$'),
        A('The Heilbronn triangle problem', 'Lean uses $\\eta = 1/(10^5 K)$'),
        A('The Heilbronn triangle problem', 'Lean proves it along an unbounded sequence of $n$, not every large $n$'),
        C('191', 'September-25-2026'),
    ]})

# ---------------------------------------------------------------- 192 --
write({
    'id': '192', 'discipline': 'Combinatorics', 'kind': 'disproof',
    'short': 'The square-root degree bound fails',
    'title': {'title': 'Boolean functions beat the square-root degree bound',
              'subtitle': 'Claim: for every $C > 0$ some Boolean $f$ has $\\sum_i \\hat f(\\{i\\}) > C\\sqrt{\\deg f}$'},
    'object': {
        'dur': 8.4, 'primitive': 'plot', 'x': [0, 25], 'y': [0, 10], 'labelRoom': 240,
        'xlabel': 'degree $d$, schematic', 'ylabel': '$\\sum_i \\hat f(\\{i\\})$',
        'curves': [
            {'f': 'x', 'to': 9.6, 'label': 'trivial: at most $d$', 'tone': 'mute', 'dash': True, 'at': 0.6},
            {'f': 'sqrt(x)', 'label': 'majority: about $\\sqrt d$', 'tone': 'soft', 'at': 1.6}],
        'regions': [{'f': 'Math.min(x, 10)', 'f2': 'sqrt(x)', 'from': 1, 'to': 25, 'at': 5.4}],
        'beats': [
            {'at': 0.2, 'text': 'Schematic: how much can a Boolean function of degree $d$ correlate with its inputs?'},
            {'at': 2.9, 'text': 'Gopalan–Servedio: never more than a constant times $\\sqrt d$, as majority gives'},
            {'at': 5.5, 'text': 'The claim: some functions beat $C\\sqrt{\\deg f}$ for every $C$; the true growth is open'}]},
    'achievement': {
        'form': 'status', 'label': 'Gopalan–Servedio conjecture (c. 2009)',
        'statement': ['\\textstyle\\sum_i \\hat f(\\{i\\}) \\le C\\sqrt{\\deg f}'],
        'context': 'Fails for every $C > 0$; no growth rate in $n$ or the degree is given',
        'stamp': 'disproved',
        'note': 'Between $\\sqrt d$ and $d$, the true growth is still open'},
    'verify': {'lean': 'main',
               'detail': 'Both the signed violation for every $C$ and the unbounded absolute ratio',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('192', 'known_before', 'Gopalan–Servedio conjecture (c. 2009)'),
        R('192', 'explainer', 'Majority on d bits gives about sqrt(d)'),
        R('192', 'known_before', 'Trivially <= deg f (via total influence)'),
        R('192', 'claim', 'No growth rates (n, degree) are given.'),
        R('192', 'caveats', 'the true growth of max sum fhat(i) versus degree (between sqrt d and d) remains open'),
        R('192', 'lean', 'both the signed violation for every C>0 and unboundedness of the absolute ratio'),
    ]})
print('ok b5')
