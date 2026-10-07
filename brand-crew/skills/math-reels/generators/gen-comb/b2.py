from lib import *

# ---------------------------------------------------------------- 161 --
write({
    'id': '161', 'discipline': 'Combinatorics', 'kind': 'disproof',
    'short': "Sidorenko's conjecture is false",
    'title': {'title': "A counterexample to Sidorenko's conjecture",
              'subtitle': 'Claim: a bipartite pattern with 35 vertices and 66 edges is rarer in some graph than in a random one'},
    'object': {
        'dur': 8.4, 'primitive': 'equation', 'mode': 'stack',
        'lines': [
            {'tex': 't(H,G) \\ge p(G)^{e(H)}', 'note': 'conjectured, every bipartite $H$', 'at': 0.3},
            {'tex': 'H:\\ 22 \\text{ triples on } 13 \\text{ points}', 'note': '35 vertices, 66 edges', 'at': 2.9},
            {'tex': 't(H,G) < p(G)^{66}', 'note': 'claimed, for some $G$', 'tone': 'claim', 'at': 5.4}],
        'beats': [
            {'at': 0.2, 'text': 'Sidorenko: at edge density $p$, random graphs minimise copies of every bipartite $H$'},
            {'at': 2.8, 'text': 'The pattern: a triple system where every covered pair of points lies in exactly two triples'},
            {'at': 5.3, 'text': 'The claim: some host graph has fewer copies than random. The host is not explicit'}]},
    'achievement': {
        'form': 'status', 'label': "Sidorenko's conjecture (1993) and the forcing conjecture",
        'statement': ['t(H,G) \\ge p(G)^{e(H)} \\text{ for every bipartite } H'],
        'context': 'Proved for trees, even cycles, hypercubes and more; computer searches in 2025 found nothing',
        'stamp': 'disproved',
        'note': 'The host $G$ is sampled, not explicit; the forcing part is not in Lean'},
    'verify': {'lean': 'main',
               'detail': 'Strict $t(H,G) < p^{66}$ with the 22 triples hard-coded. The forcing part is out of scope',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        C('161', '22 triples on 13 points, every one of the 33 covered point pairs in exactly two triples'),
        R('161', 'claim', 'H is connected and bipartite with 35 vertices and 66 edges'),
        R('161', 'claim', 't(H,G) < p(G)^66'),
        R('161', 'known_before', 'Conjectured by Sidorenko (1991/1993, Graphs and Combinatorics 9'),
        A("Sidorenko's conjecture is false", 'Computer searches in 2025 found nothing'),
        A("Sidorenko's conjecture is false", 'The Lean statement hard-codes the 22 triples and asserts strict inequality against `edgeDensity ^ 66`'),
        R('161', 'lean', 'The forcing-conjecture consequence is explicitly out of scope per lean/docs/161.md'),
        R('161', 'claim', 'G is not explicit'),
    ]})

# ---------------------------------------------------------------- 162 --
write({
    'id': '162', 'discipline': 'Combinatorics', 'kind': 'counterexample',
    'short': "Ryser's conjecture fails",
    'title': {'title': "Counterexamples to Ryser's covering conjecture",
              'subtitle': 'Claim: intersecting $(q+1)$-partite hypergraphs with covering number $q+1$, for every large prime $q$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'equation', 'until': 4.4, 'lines': [
                {'tex': '\\tau \\le (r-1)\\,\\nu', 'note': '$r$-partite hypergraphs', 'at': 0.3},
                {'tex': '\\nu = 1 \\;\\Rightarrow\\; \\tau \\le r - 1', 'note': 'intersecting case', 'at': 1.4},
                {'tex': '\\tau = q + 1 = r', 'note': 'claimed, large prime $q$', 'tone': 'claim', 'at': 2.6}]},
            {'primitive': 'numberline', 'from': 4.4, 'min': 1.4, 'max': 12, 'ticks': [2, 3, 4, 5],
             'axisLabel': 'rank $r$',
             'markers': [
                 {'v': 2, 'label': 'König', 'note': 'classical', 'tone': 'ok', 'at': 0.4},
                 {'v': 3, 'label': 'Aharoni', 'note': '2001', 'tone': 'ok', 'at': 0.7}],
             'ranges': [
                 {'from': 2, 'to': 5, 'label': 'proved', 'note': 'up to $r = 5$', 'side': 'below', 'tone': 'ok', 'at': 1.1},
                 {'from': 6, 'to': 11, 'label': 'first failure: unknown', 'note': 'thresholds not explicit', 'tone': 'warn', 'at': 1.9}]}],
        'beats': [
            {'at': 0.2, 'text': 'Ryser: $r$-partite hypergraphs have covering number at most $r - 1$ times the matching number'},
            {'at': 4.5, 'text': 'The intersecting case was known for $r \\le 5$; Aharoni proved $r = 3$ in 2001'},
            {'at': 6.6, 'text': 'The claim fails it at rank $q+1$, but nobody knows the smallest failing rank'}]},
    'achievement': {
        'form': 'status', 'label': "Ryser's conjecture (Henderson 1971) and Gyárfás's tree cover",
        'statement': ['\\nu = 1 \\;\\Rightarrow\\; \\tau \\le r - 1', '\\text{claimed: } \\tau = q + 1 = r'],
        'context': 'Built by perturbing the affine plane over $\\mathbb F_q$; small ranks are untouched',
        'stamp': 'counterexample'},
    'verify': {'lean': 'main',
               'detail': 'Both main theorems: rank $q+1$ with balanced parts, and rank $s^n + 1$',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('162', 'known_before', "equivalent form in Henderson's 1971 thesis"),
        R('162', 'known_before', 'r=3 proved by Aharoni (Combinatorica 2001)'),
        R('162', 'known_before', 'Intersecting case known for r<=5'),
        R('162', 'caveats', 'the smallest counterexample rank is unknown'),
        A("Ryser's conjecture fails", 'The thresholds are not explicit, so nobody knows the smallest rank at which Ryser actually fails. Small ranks are untouched.'),
        R('162', 'lean', 'BalancedRyser.lean (OAI.Balanced.main_result, line 39; MainResult def line 36) matches paper 1 incl. balanced parts'),
    ]})

# ---------------------------------------------------------------- 164 --
write({
    'id': '164', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': "Hindman's sums and products",
    'title': {'title': "Hindman's finite sums and products conjecture",
              'subtitle': 'Claim: every finite colouring of $\\mathbb N$ has $m$-element sets whose subset sums and products all share one colour'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'sequence', 'items': ['$x$', '$y$', '$x+y$', '$xy$'], 'until': 4.0, 'stagger': 0.3,
             'marks': {'0': {'tone': 'accent', 'at': 1.8}, '1': {'tone': 'accent', 'at': 1.9}, '2': {'tone': 'accent', 'at': 2.0}, '3': {'tone': 'accent', 'at': 2.1}},
             'caption': 'the case $m = 2$: four numbers, one colour'},
            {'primitive': 'equation', 'from': 4.0, 'lines': [
                {'tex': 'A = \\{a_1 < \\dots < a_m\\}', 'at': 0.3},
                {'tex': '\\text{all } 2^m - 1 \\text{ subset sums}', 'note': 'one colour', 'at': 1.2},
                {'tex': '\\text{all subset products}', 'note': 'the same colour', 'tone': 'claim', 'at': 2.1}]}],
        'beats': [
            {'at': 0.2, 'text': 'Colour the positive integers with finitely many colours. Can sums and products share one?'},
            {'at': 2.9, 'text': 'Even $\\{x, y, x+y, xy\\}$ was open over $\\mathbb N$; Alweiss had done the rationals'},
            {'at': 5.6, 'text': 'The claim: sets of every finite size $m$, with no bound on how large they are'}]},
    'achievement': {
        'form': 'status', 'label': "Hindman's finite sums and products conjecture (1979)",
        'statement': ['\\forall\\, r\\text{-colouring of } \\mathbb N,\\ \\forall m:\\ FS(A) \\cup FP(A) \\text{ in one colour}'],
        'context': 'Moreira (2017) had $\\{x, x+y, xy\\}$; Bowen–Sabok and Alweiss worked over $\\mathbb Q$',
        'stamp': 'proved',
        'note': 'Finite sets only: the infinite version is false (Hindman 1980)'},
    'verify': {'lean': 'none',
               'detail': 'No formal statement: 70 pages leaning on corrected versions of deep inputs',
               'ourCheck': NONE_CHECK},
    'sources': [
        A("Hindman's finite sums and products", "Hindman's 1979 conjecture says you can find"),
        A("Hindman's finite sums and products", 'Even $m = 2$, a monochromatic $\\{x, y, x+y, xy\\}$, was open for general colourings'),
        R('164', 'known_before', '{x, x+y, xy} for all finite colourings (Moreira, Ann. Math. 2017)'),
        R('164', 'known_before', 'Alweiss (arXiv:2307.08901, accepted Duke) proved the full finite sums-and-products theorem over Q'),
        R('164', 'claim', 'Finite sets only — no infinite version (which is false by Hindman 1980)'),
        R('164', 'claim', 'Purely qualitative: no bound on the size of the configuration.'),
        A("Hindman's finite sums and products", 'Family 164 claims the integer case in 70 pages with no Lean at all'),
        A("Hindman's finite sums and products", 'It leans on corrected or revised versions of deep inputs'),
    ]})

# ---------------------------------------------------------------- 166 --
write({
    'id': '166', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Distinct distances in every dimension',
    'title': {'title': 'Distinct distances in every dimension $d \\ge 3$',
              'subtitle': 'Claim: $n$ points in $\\mathbb R^d$ determine at least $c_d\\,n^{2/d}$ distinct distances, sharp up to the constant'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'grid', 'preset': 'tensor', 'dims': [3, 3, 3], 'until': 3.7, 'cellAt': 0.4, 'cellStagger': 0.05,
             'cells': [[i, j, k, 'accent'] for i in range(3) for j in range(3) for k in range(3)]},
            {'primitive': 'numberline', 'from': 3.7, 'min': 0.45, 'max': 0.72,
             'ticks': [{'v': 0.5, 'label': '$1/2$'}, {'v': 0.6, 'label': '$3/5$'}, {'v': 0.666667, 'label': '$2/3$'}],
             'axisLabel': 'exponent $e$ in $n^{e}$ distances, for points in $\\mathbb R^3$',
             'markers': [
                 {'v': 0.5, 'derived': '1/2', 'label': 'Clarkson et al.', 'note': '1990', 'at': 0.5},
                 {'v': 0.6, 'derived': '3/5', 'label': 'Solymosi–Vu', 'note': 'with Guth–Katz', 'at': 0.8},
                 {'v': 0.666667, 'derived': '2/3', 'label': 'Tidor–Yu–Zakharov', 'note': 'Aug 2026, $n^{2/3-o(1)}$', 'at': 1.2},
                 {'v': 0.666667, 'derived': '2/3', 'label': 'claimed $c\\,n^{2/3}$', 'note': 'and $c_d\\,n^{2/d}$', 'tone': 'claim', 'side': 'below', 'at': 2.4}]}],
        'beats': [
            {'at': 0.2, 'text': 'A grid of $n$ points in $\\mathbb R^3$ spans only about $n^{2/3}$ distinct distances'},
            {'at': 3.8, 'text': 'In $\\mathbb R^3$ the lower bound reached $n^{2/3-o(1)}$ in August 2026'},
            {'at': 6.1, 'text': 'The claim drops the $o(1)$, in every dimension $d \\ge 3$'}]},
    'achievement': {
        'form': 'bound',
        'before': {'label': 'Best known (d = 3), Aug 2026', 'tex': 'n^{2/3 - o(1)}', 'note': 'Tidor–Yu–Zakharov, 147 pages'},
        'after': {'label': 'Claimed, Sep 2026', 'tex': 'c_d\\, n^{2/d}', 'note': 'every $d \\ge 3$, sharp up to the constant'},
        'note': 'Unformalized, and it claims more than the $\\mathbb R^3$ result six weeks earlier'},
    'verify': {'lean': 'none',
               'detail': 'No formal statement: 103 pages of real and complex algebraic geometry',
               'ourCheck': NONE_CHECK},
    'sources': [
        R('166', 'explainer', 'in d dimensions the grid gives about n^{2/d}'),
        R('166', 'known_before', 'Clarkson et al. 1990 (~n^{1/2} in R^3)'),
        R('166', 'known_before', 'Guth–Katz + Solymosi–Vu n^{3/5}/log in R^3'),
        R('166', 'known_before', "Tidor–Yu–Zakharov, 'The Erdős distinct distances problem in R^3' (arXiv 2608.14454, Aug 14 2026, 147 pp): n^{2/3 − o(1)} in R^3"),
        A('Distinct distances in every dimension', 'It appeared six weeks after Tidor, Yu and Zakharov'),
        R('166', 'caveats', 'Unformalized, 103 pp of heavy real/complex algebraic geometry'),
        C('166', 'September-23-2026'),
    ]})

# ---------------------------------------------------------------- 167 --
hexp = [(0, 0)] + [(math.cos(math.pi / 3 * k), math.sin(math.pi / 3 * k)) for k in range(6)]
hf = place(hexp, scale=190)
hn = [{'id': f'h{k}', 'x': hf[k][0], 'y': hf[k][1], 'fill': 'accent' if k == 0 else None} for k in range(7)]
for nd in hn:
    if nd['fill'] is None:
        del nd['fill']
he = []
for i in range(7):
    for j in range(i + 1, 7):
        if abs(math.dist(hexp[i], hexp[j]) - 1) < 1e-9:
            he.append([f'h{i}', f'h{j}'])
write({
    'id': '167', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Unit and pinned distances in the plane',
    'title': {'title': 'Unit distances below $n^{4/3}$, and pinned distances',
              'subtitle': 'Claim: $n$ planar points have $O(n^{\\beta})$ unit-distance pairs for some $\\beta < 4/3$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'nodes': hn, 'edges': he, 'r': 14, 'edgeAt': 0.4, 'edgeDur': 2.2, 'until': 3.7},
            {'primitive': 'numberline', 'from': 3.7, 'min': 0.92, 'max': 1.42,
             'ticks': [1, {'v': 1.333333, 'label': '$4/3$'}],
             'axisLabel': 'exponent $e$ in $u(n) \\approx n^{e}$, unit-distance pairs',
             'markers': [
                 {'v': 1.014, 'label': 'Sawin', 'note': 'May 2026, below', 'at': 0.5},
                 {'v': 1.333333, 'derived': '4/3', 'label': 'Spencer–Szemerédi–Trotter', 'note': '1984, above', 'at': 0.8},
                 {'v': 1.333333, 'derived': '4/3', 'label': 'claimed $\\beta < 4/3$', 'note': 'not explicit', 'tone': 'claim', 'side': 'below', 'at': 2.4}],
             'ranges': [{'from': 1.014, 'to': 1.333333, 'derived': '1.014 to 4/3', 'label': 'the truth', 'tone': 'mute', 'at': 1.3}]}],
        'beats': [
            {'at': 0.2, 'text': 'How many pairs of $n$ points can be exactly 1 apart? A hexagon and its centre'},
            {'at': 3.8, 'text': 'Upper bound $n^{4/3}$ since 1984; lower bound $n^{1.014}$ since May 2026'},
            {'at': 6.3, 'text': 'The claim: a power saving below $4/3$, from the product formula in number fields'}]},
    'achievement': {
        'form': 'bound',
        'before': {'label': 'Best known since 1984', 'tex': 'u(n) = O(n^{4/3})', 'note': 'Spencer–Szemerédi–Trotter'},
        'after': {'label': 'Claimed, Sep 2026', 'tex': 'O(n^{\\beta}),\\ \\beta < 4/3', 'note': 'and all but $o(n)$ points see $n^{1-\\varepsilon}$ distances'},
        'note': 'Both results are ineffective: no explicit exponent or rate'},
    'verify': {'lean': 'main',
               'detail': 'Both theorems: the weak pinned bound, and $u(n) \\le C n^{\\beta}$ with $\\beta < 4/3$',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('167', 'known_before', 'Upper bound O(n^{4/3}) by Spencer–Szemerédi–Trotter 1984'),
        A('Unit and pinned distances in the plane', 'In May 2026 an OpenAI model disproved'),
        A('Unit and pinned distances in the plane', 'Sawin pushed the construction to $u(n) \\ge n^{1.014}$'),
        R('167', 'claim', 'Both ineffective (no explicit exponent or rate).'),
        R('167', 'explainer', 'use the product formula'),
        R('167', 'lean', 'OAI.PlanarUnitDistances.main, statement at ComparatorChallenges/PlanarUnitDistances.lean line 19 (∃ C > 0, 1 ≤ β < 4/3, ∀ n, u(n) ≤ C n^β)'),
        C('167', 'September-23-2026'),
    ]})

# ---------------------------------------------------------------- 168 --
bn = [
    {'id': 'e', 'x': 0.5, 'y': 0.93, 'label': '$e$', 'lx': 30, 'lax': 0},
    {'id': 's', 'x': 0.4, 'y': 0.65, 'label': '$s$', 'lx': -30, 'lax': 1},
    {'id': 't', 'x': 0.6, 'y': 0.65, 'label': '$t$', 'lx': 30, 'lax': 0},
    {'id': 'st', 'x': 0.4, 'y': 0.36, 'label': '$st$', 'lx': -30, 'lax': 1},
    {'id': 'ts', 'x': 0.6, 'y': 0.36, 'label': '$ts$', 'lx': 30, 'lax': 0},
    {'id': 'w', 'x': 0.5, 'y': 0.08, 'label': '$sts$', 'lx': 30, 'lax': 0, 'fill': 'accent'}]
write({
    'id': '168', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Kazhdan–Lusztig combinatorial invariance',
    'title': {'title': 'The poset determines the Kazhdan–Lusztig polynomial',
              'subtitle': 'Claim: isomorphic Bruhat intervals, in any Coxeter systems, have equal Kazhdan–Lusztig polynomials'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'nodes': bn, 'r': 12, 'edgeAt': 0.5, 'edgeDur': 2.2, 'until': 3.8,
             'edges': [['e', 's'], ['e', 't'], ['s', 'st'], ['s', 'ts'], ['t', 'st'], ['t', 'ts'], ['st', 'w'], ['ts', 'w']]},
            {'primitive': 'equation', 'from': 3.8, 'lines': [
                {'tex': '[u,v] \\cong [u\',v\'] \\;\\Rightarrow\\; P_{u,v}(q) = P_{u\',v\'}(q)', 'size': 44, 'tone': 'claim', 'at': 0.4}]}],
        'beats': [
            {'at': 0.2, 'text': 'A Bruhat interval: here all of $S_3$, as an abstract partial order'},
            {'at': 3.9, 'text': 'The polynomials are defined from the group, which the bare poset forgets'},
            {'at': 6.2, 'text': 'The claim: the poset alone fixes the polynomial, across all Coxeter systems'}]},
    'achievement': {
        'form': 'status', 'label': 'Combinatorial invariance conjecture (Lusztig and Dyer, 1980s)',
        'statement': ['[u,v] \\cong [u\',v\'] \\;\\Rightarrow\\; P_{u,v} = P_{u\',v\'}'],
        'context': 'Known for lower and short intervals, and length at most 6 (Barkley–Gaetz–Lam, Jan 2026)',
        'stamp': 'proved',
        'note': "The Lean proof cannot follow the paper's route as written"},
    'verify': {'lean': 'main',
               'detail': 'Arbitrary Coxeter systems, polynomials built from scratch. Not in the main-results list',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('168', 'known_before', 'Combinatorial invariance conjecture attributed to Lusztig and Dyer (1980s'),
        R('168', 'known_before', 'full invariance for interval length <= 6 (Barkley–Gaetz–Lam, arXiv:2601.07793, Jan 2026)'),
        A('Combinatorial invariance of Kazhdan–Lusztig polynomials', "So the formal proof cannot be following the paper's route as written"),
        R('168', 'lean', 'NOT listed in formalization.yaml main_results'),
    ]})
print('ok b2')
