from lib import *

BRADAC = '$\\textsf{Brada\\v{c}}$'
ERDOS = '$\\textsf{Erd\\H{o}s}$'

# ---------------------------------------------------------------- 169 --
xs = [0.2, 0.35, 0.5, 0.65, 0.8]
ys = [0.62, 0.3, 0.62, 0.3, 0.62]
write({
    'id': '169', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Shareshian–Wachs $e$-positivity',
    'title': {'title': 'Chromatic quasisymmetric functions are $e$-positive',
              'subtitle': 'Claim: for every natural unit interval graph, each elementary coefficient lies in $\\mathbb N[q]$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'r': 17, 'edgeAt': 0.5, 'edgeDur': 2.0, 'until': 3.8,
             'nodes': [{'id': str(i + 1), 'x': xs[i], 'y': ys[i], 'label': str(i + 1)} for i in range(5)],
             'edges': [['1', '2'], ['1', '3'], ['2', '3'], ['3', '4'], ['3', '5'], ['4', '5']]},
            {'primitive': 'equation', 'from': 3.8, 'lines': [
                {'tex': 'X_G(x;q) = \\sum_{\\lambda} c_\\lambda(q)\\, e_\\lambda', 'at': 0.3},
                {'tex': 'c_\\lambda(q) \\in \\mathbb N[q]', 'tone': 'claim', 'note': 'claimed, every such $G$', 'at': 1.8}]}],
        'beats': [
            {'at': 0.2, 'text': 'A natural unit interval graph on $1, \\dots, 5$: each vertex sees an interval of others'},
            {'at': 3.9, 'text': 'Its chromatic quasisymmetric function counts proper colourings, graded by $q$'},
            {'at': 6.2, 'text': 'The claim: every $e$-coefficient is a polynomial in $q$ with nonnegative integer coefficients'}]},
    'achievement': {
        'form': 'status', 'label': 'Shareshian–Wachs conjecture (2016), the positivity half',
        'statement': ['c_\\lambda(q) \\in \\mathbb N[q] \\ \\text{ for every } \\lambda'],
        'context': 'The $q = 1$ case, Stanley–Stembridge, was proved by Hikita in 2024',
        'stamp': 'proved',
        'note': '$e$-unimodality, the other half of the conjecture, is untouched'},
    'verify': {'lean': 'main',
               'detail': 'The full identity, stated as a witness structure, so no theorem name is listed',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('169', 'known_before', 'Shareshian–Wachs (Adv. Math. 2016'),
        R('169', 'caveats', 'The q=1 case (Stanley–Stembridge) was already proved by Hikita in 2024'),
        R('169', 'caveats', 'e-unimodality (other half of Shareshian–Wachs) untouched'),
        R('169', 'lean', "which is why the lean table lists no theorem_names"),
    ]})

# ---------------------------------------------------------------- 170 --
pent = [(math.cos(math.pi / 2 + 2 * math.pi * k / 5), math.sin(math.pi / 2 + 2 * math.pi * k / 5)) for k in range(5)]
pf = place(pent, scale=180, cy=360)
write({
    'id': '170', 'discipline': 'Combinatorics', 'kind': 'improved-bound',
    'short': 'The log exponent of $r(s,t)$',
    'title': {'title': 'Sharp log exponents for off-diagonal Ramsey numbers',
              'subtitle': 'Claim: $r(s,t) = t^{s-1}/(\\log t)^{s-2+o(1)}$ for every fixed $s \\ge 5$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'r': 15, 'edgeAt': 0.4, 'edgeDur': 1.8, 'until': 3.7,
             'nodes': [{'id': f'p{k}', 'x': pf[k][0], 'y': pf[k][1]} for k in range(5)],
             'edges': [[f'p{k}', f'p{(k + 1) % 5}', {'tone': 'accent', 'w': 3}] for k in range(5)]},
            {'primitive': 'numberline', 'from': 3.7, 'min': 0.5, 'max': 7, 'ticks': [3, 4, 5, 6],
             'axisLabel': 'the log exponent $e$',
             'markers': [
                 {'v': 6, 'label': BRADAC, 'note': 'May 2026', 'at': 0.5},
                 {'v': 3, 'label': 'upper bound', 'note': 'since 1980', 'style': 'ring', 'tone': 'mute', 'side': 'below', 'at': 0.8}],
             'slide': {'from': 6, 'to': 3, 'at': 1.6, 'dur': 1.5, 'label': 'claimed $3 + o(1)$', 'note': 'meets the upper bound'}}],
        'beats': [
            {'at': 0.2, 'text': 'The 5-cycle has no triangle and no 3 independent vertices, so $r(3,3) > 5$'},
            {'at': 3.8, 'text': 'For $s = 5$ the best construction lost $(\\log t)^{6}$; the upper bound loses $(\\log t)^{3}$'},
            {'at': 6.3, 'text': 'The claim closes the log gap for every $s \\ge 5$: exponent $s - 2 + o(1)$'}]},
    'achievement': {
        'form': 'bound',
        'before': {'label': 'Best lower bound, May 2026', 'tex': 'r(5,t) \\ge c\\,\\frac{t^4}{(\\log t)^{6}}', 'note': BRADAC + ', $(\\log t)^{2s-4}$ in general'},
        'after': {'label': 'Claimed, Sep 2026', 'tex': 'r(5,t) = \\frac{t^4}{(\\log t)^{3+o(1)}}', 'note': 'and $s - 2 + o(1)$ for every $s \\ge 5$'},
        'note': '$r(4,t)$ is untouched; the right power of $t$ was already ' + BRADAC + "'s"},
    'verify': {'lean': 'main',
               'detail': 'Both papers: two-sided bounds for $s = 5$, and the sharp exponent for $s \\ge 6$',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('170', 'known_before', 'Bradač (arXiv:2605.28793, May–June 2026) proved r(s,t) >= c_s t^{s-1}/(log t)^{2s-4} for all s>=3'),
        R('170', 'known_before', 'Upper bound O(t^{s-1}/(log t)^{s-2}) by Ajtai–Komlós–Szemerédi (1980)'),
        R('170', 'claim', 'The case s=4 is NOT covered'),
        R('170', 'lean', 'OAI.SharpRamseyFive.main'),
    ]})

# ---------------------------------------------------------------- 171 --
cube = {'000': (-1.1, -0.9), '100': (0.6, -0.9), '110': (0.6, 0.6), '010': (-1.1, 0.6)}
cube.update({k[:2] + '1': (x + 0.55, y + 0.4) for k, (x, y) in list(cube.items())})
cube = {(k[0] + k[1] + k[2]): v for k, v in cube.items()}
names = list(cube)
cf = dict(zip(names, place([cube[k] for k in names], scale=150, cx=640, cy=360)))
ce = [[a, b] for i, a in enumerate(names) for b in names[i + 1:] if sum(x != y for x, y in zip(a, b)) == 1]
assert len(ce) == 12
write({
    'id': '171', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Hypercube Ramsey numbers are linear',
    'title': {'title': 'The Ramsey number of the cube $Q_n$ is $O(2^n)$',
              'subtitle': 'Claim: $R(Q_n) \\le C\\,2^n$ for an absolute constant $C$, so $R(Q_n) = \\Theta(2^n)$'},
    'object': {
        'dur': 8.4, 'layout': 'sequence',
        'panels': [
            {'primitive': 'graph', 'r': 13, 'edgeAt': 0.4, 'edgeDur': 2.0, 'until': 3.7,
             'nodes': [{'id': k, 'x': cf[k][0], 'y': cf[k][1], } for k in names],
             'edges': ce},
            {'primitive': 'numberline', 'from': 3.7, 'min': 0, 'max': 2.4, 'ticks': [1, 2],
             'axisLabel': 'exponent $e$ in $R(Q_n) \\le 2^{e n}$',
             'markers': [
                 {'v': 2, 'label': 'Lee 2017', 'note': '$2^{2n} + n^2 2^n$', 'at': 0.5},
                 {'v': 1, 'label': 'lower bound', 'note': '$3 \\cdot 2^{n-1} - 1$', 'style': 'ring', 'tone': 'mute', 'side': 'below', 'at': 0.8}],
             'slide': {'from': 2, 'to': 1, 'at': 1.6, 'dur': 1.5, 'label': 'claimed $C\\,2^n$', 'note': 'linear'}}],
        'beats': [
            {'at': 0.2, 'text': 'The cube $Q_3$. $Q_n$ has $2^n$ vertices but degree $n$, so bounded-degree theorems fail'},
            {'at': 3.8, 'text': 'The best bound was $2^{(2-c)n}$ (Tikhomirov, 2022); the lower bound is about $2^n$'},
            {'at': 6.3, 'text': 'The claim: linear, $R(Q_n) \\le C\\,2^n$, as Burr and ' + ERDOS + ' asked in 1975'}]},
    'achievement': {
        'form': 'status', 'label': 'The hypercube Ramsey conjecture (1975)',
        'statement': ['R(Q_n) = \\Theta(2^n)'],
        'context': 'Before: $2^{(2-c)n+1} + 2$ (Tikhomirov, 2022); the lower bound is $3 \\cdot 2^{n-1} - 1$',
        'stamp': 'proved',
        'note': 'One 172-page argument by contradiction; $C$ is not computed'},
    'verify': {'lean': 'none',
               'detail': 'No formal statement: a single unformalized 172-page manuscript',
               'ourCheck': NONE_CHECK},
    'sources': [
        R('171', 'known_before', 'Burr–Erdős 1975'),
        R('171', 'known_before', 'Lee (Ann. Math. 2017, which also proved the bounded-degeneracy Burr–Erdős conjecture) 2^{2n}+n^2 2^n'),
        R('171', 'known_before', 'Tikhomirov (Eur. J. Combin. 120 (2024), arXiv:2208.14568) 2^{(2-c)n+1}+2'),
        R('171', 'caveats', 'a jump from exponent 2-c (Tikhomirov 2022) straight to linear'),
        R('171', 'claim', 'With the classical lower bound R(Q_n) >= 3·2^{n-1} - 1 this gives R(Q_n) = Θ(2^n). C is not computed'),
        R('171', 'caveats', 'Unformalized single 172-page manuscript'),
    ]})

# ---------------------------------------------------------------- 172 --
deg = lambda d: (round(math.cos(math.radians(d)), 4), round(math.sin(math.radians(d)), 4))
five = [deg(d) for d in (90, 165, 220, 300, 15)]
kite = [deg(d) for d in (90, 200, 270, 340)]
write({
    'id': '172', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Euclidean Ramsey sets, classified',
    'title': {'title': 'A classification of Euclidean Ramsey configurations',
              'subtitle': 'Claim: a finite point set is Ramsey exactly when a tensor condition over its coordinate field holds'},
    'object': {
        'dur': 8.4, 'primitive': 'shape',
        'shapes': [
            {'kind': 'circle', 'r': 1, 'tone': 'faint', 'fill': False, 'w': 1.6, 'at': 0.2, 'dur': 1.0},
            {'kind': 'polygon', 'points': five, 'tone': 'accent', 'at': 1.0, 'dur': 1.4,
             'morph': {'kind': 'polygon', 'points': kite, 'at': 5.0, 'dur': 1.6}}],
        'beats': [
            {'at': 0.2, 'text': 'Which point sets show up in one colour, at their own scale, in every finite colouring?'},
            {'at': 2.8, 'text': 'The claimed criterion implies any five points on a circle do'},
            {'at': 5.2, 'text': 'So does this kite, though it sits in no symmetric set: a 2012 conjecture falls'}]},
    'achievement': {
        'form': 'status', 'label': 'Euclidean Ramsey theory: which finite sets are Ramsey?',
        'statement': ['A \\text{ Ramsey} \\iff \\text{a tensor condition over } F \\otimes_{\\mathbb Q} F'],
        'context': "Refutes the Leader–Russell–Walters characterisation; Graham's spherical conjecture fell days earlier",
        'stamp': 'proved',
        'note': 'The criterion is algebraic, not a procedure from numerical coordinates'},
    'verify': {'lean': 'main',
               'detail': 'The classification, five concyclic points, and a 12-point, 50-colour example',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('172', 'claim', 'every subtransitive set and every set of at most five concyclic points is Ramsey'),
        R('172', 'claim', 'the non-subtransitive cyclic kites of Leader–Russell–Walters are Ramsey'),
        R('172', 'known_before', "Leader–Russell–Walters (JCTA 2012, 'Transitive sets in Euclidean Ramsey theory') conjectured Ramsey iff subtransitive"),
        A('Euclidean Ramsey sets, classified', "Graham's spherical conjecture had been refuted on September 20, about two weeks before the release went public"),
        R('172', 'caveats', 'deciding it for a given configuration is not obviously algorithmic (paper says it is not a procedure from numerical coordinates)'),
        R('172', 'lean', 'explicit 12-point unit-circle set with a 50-colour avoiding colouring in every dimension'),
    ]})

# ---------------------------------------------------------------- 173 --
sn = [
    {'id': 'v', 'x': 0.14, 'y': 0.5, 'label': '$v$', 'fill': 'accent'},
    {'id': 'a', 'x': 0.46, 'y': 0.25, 'tone': 'accent'}, {'id': 'b', 'x': 0.46, 'y': 0.75, 'tone': 'accent'},
    {'id': 'c', 'x': 0.82, 'y': 0.1, 'tone': 'cool', 'fill': 'cool'}, {'id': 'd', 'x': 0.82, 'y': 0.5, 'tone': 'cool', 'fill': 'cool'},
    {'id': 'e', 'x': 0.82, 'y': 0.9, 'tone': 'cool', 'fill': 'cool'}]
write({
    'id': '173', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': "Seymour's second-neighbourhood conjecture",
    'title': {'title': "Seymour's second-neighbourhood conjecture",
              'subtitle': 'Claim: every oriented graph has a vertex with at least as many vertices at distance two as at distance one'},
    'object': {
        'dur': 8.4, 'primitive': 'graph', 'r': 18, 'edgeAt': 0.6, 'edgeDur': 2.6,
        'heading': 'Arcs point left to right; no loops, no 2-cycles',
        'nodes': sn,
        'edges': [['v', 'a', {'tone': 'accent', 'w': 3}], ['v', 'b', {'tone': 'accent', 'w': 3}],
                  ['a', 'c', {'tone': 'cool'}], ['a', 'd', {'tone': 'cool'}], ['b', 'd', {'tone': 'cool'}], ['b', 'e', {'tone': 'cool'}]],
        'beats': [
            {'at': 0.2, 'text': 'One-way friendships: $v$ follows 2 vertices, and reaches 3 more in two steps'},
            {'at': 3.6, 'text': 'Seymour, 1990: in every such graph some vertex has at least as many at distance two'},
            {'at': 6.0, 'text': 'Known for tournaments since 1996. The claim covers every oriented graph'}]},
    'achievement': {
        'form': 'status', 'label': "Seymour's second-neighbourhood conjecture (1990)",
        'statement': ['\\exists\\, v:\\ |N^{++}(v)| \\ge |N^{+}(v)|'],
        'context': 'Known for tournaments (Fisher, 1996); the best general ratio was about 0.7155',
        'stamp': 'proved',
        'note': 'Fifteen pages, elementary: easy for an expert to check'},
    'verify': {'lean': 'main',
               'detail': 'Twelve lines of definitions and one theorem; distance two is exactly the conjecture\'s',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        A("Seymour's second-neighbourhood conjecture", 'In 1990 Seymour conjectured that every oriented graph'),
        A("Seymour's second-neighbourhood conjecture", 'Fisher proved it for tournaments in 1996'),
        A("Seymour's second-neighbourhood conjecture", 'raised to roughly 0.7155 more recently'),
        A("Seymour's second-neighbourhood conjecture", 'is twelve lines of definitions and one theorem'),
        R('173', 'caveats', 'Short (15 pp) for a 36-year-old problem, which cuts both ways: easy for experts to check'),
    ]})

# ---------------------------------------------------------------- 174 --
k6 = [(math.cos(math.pi / 2 - 2 * math.pi * k / 6), math.sin(math.pi / 2 - 2 * math.pi * k / 6)) for k in range(6)]
kf = place(k6, scale=190, cy=352)
tree = {(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)}
edges = [[f'k{i}', f'k{j}', {'tone': 'faint', 'w': 1.8, 'a': 0.7}] for i in range(6) for j in range(i + 1, 6) if (i, j) not in tree]
edges += [[f'k{i}', f'k{j}', {'tone': 'accent', 'w': 4}] for (i, j) in sorted(tree)]
write({
    'id': '174', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'Strong thin spanning trees',
    'title': {'title': 'Strong thin trees, built in polynomial time',
              'subtitle': 'Claim: every $k$-edge-connected multigraph has a spanning tree using at most a $C/k$ share of every cut'},
    'object': {
        'dur': 8.4, 'primitive': 'graph', 'r': 15, 'edgeAt': 0.4, 'edgeDur': 4.0,
        'nodes': [{'id': f'k{i}', 'x': kf[i][0], 'y': kf[i][1]} for i in range(6)],
        'edges': edges,
        'beats': [
            {'at': 0.2, 'text': '$K_6$ is 5-edge-connected: every cut has at least 5 edges'},
            {'at': 3.2, 'text': 'A thin spanning tree must use only a small share of every cut at once'},
            {'at': 5.8, 'text': 'The claim: a $C/k$ share always suffices, found deterministically in polynomial time'}]},
    'achievement': {
        'form': 'status', 'label': 'Strong thin tree conjecture (Anari–Oveis Gharan, 2015)',
        'statement': ['|\\delta_T(S)| \\le \\tfrac{C}{k}\\,|\\delta_G(S)| \\ \\text{ for every cut } S'],
        'context': 'Before: thinness $\\mathrm{poly}(\\log\\log n)/k$ (Anari–Oveis Gharan, 2015)',
        'stamp': 'proved',
        'note': 'Constant-factor ATSP was already known (2018); $C$ is not explicit'},
    'verify': {'lean': 'main',
               'detail': 'Both the existence theorem and the polynomial-time algorithm are stated in Lean',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('174', 'known_before', 'the strong C/k form is Conjecture 1.3 in Anari and Oveis Gharan (FOCS 2015, arXiv 1411.4613), who proved thinness poly(log log n)/k'),
        R('174', 'known_before', 'Constant-factor ATSP was already obtained by Svensson–Tarnawski–Végh (2018)'),
        R('174', 'caveats', 'the constant C is not made explicit'),
        R('174', 'lean', 'OAI.StrongThinTree.strongThinTree (ComparatorChallenges/StrongThinTree.lean:38) and OAI.AlgorithmicThinTrees.algorithmic_strong_thin_trees'),
    ]})

# ---------------------------------------------------------------- 175 --
write({
    'id': '175', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': "Talagrand's threshold conjectures",
    'title': {'title': "Talagrand's expectation-threshold conjectures",
              'subtitle': 'Claim: fractional and integral expectation thresholds differ by at most a universal factor'},
    'object': {
        'dur': 8.4, 'primitive': 'equation', 'mode': 'stack',
        'lines': [
            {'tex': 'q(\\mathcal F) \\le q_f(\\mathcal F)', 'note': 'always', 'tone': 'mute', 'at': 0.4},
            {'tex': 'q_f(\\mathcal F) \\le 25 \\cdot 512^4 \\; q(\\mathcal F)', 'note': 'claimed', 'tone': 'claim', 'at': 2.8},
            {'tex': '\\mu_p(\\mathcal D) \\ge 1 - 1/k \\text{ with } k = 2^{75}', 'note': 'discrete convexity', 'at': 5.4}],
        'beats': [
            {'at': 0.2, 'text': 'Expectation thresholds: cheap certificates that a random structure is unlikely'},
            {'at': 2.7, 'text': 'Claimed: fractional certificates round to integral ones, losing a fixed factor'},
            {'at': 5.3, 'text': 'And unions of $2^{75}$ members of a likely family cover all but a cheap set'}]},
    'achievement': {
        'form': 'status', 'label': "Talagrand's conjectures (2010) and a decomposition conjecture (2026)",
        'statement': ['q_f(\\mathcal F) \\le 25 \\cdot 512^4 \\; q(\\mathcal F)'],
        'context': 'The constants are absurd but universal, which is all the conjectures ask',
        'stamp': 'proved',
        'note': 'The October graph-decomposition paper has no Lean statement'},
    'verify': {'lean': 'main',
               'detail': 'Both Talagrand theorems, with these exact constants. Not the decomposition paper',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('175', 'claim', 'the fractional expectation threshold is at most 25·512^4 times the integral one'),
        R('175', 'claim', "Talagrand's discrete-convexity conjecture with k = 2^75"),
        R('175', 'known_before', "Talagrand, 'Are many small sets explicitly small?' (STOC 2010)"),
        R('175', 'known_before', 'Ascoli, He, Park, Talagrand (arXiv 2608.11183, Aug 2026)'),
        A("Talagrand's threshold conjectures", 'The constants are absurd and irrelevant; the conjectures only ask for universal ones'),
        R('175', 'lean', 'the October graph-decomposition paper has no Lean statement'),
    ]})

# ---------------------------------------------------------------- 176 --
write({
    'id': '176', 'discipline': 'Combinatorics', 'kind': 'proof',
    'short': 'The second Kahn–Kalai conjecture',
    'title': {'title': 'The second Kahn–Kalai conjecture',
              'subtitle': 'Claim: $G(n,p)$ contains $H$ once $p \\ge C\\,p_E(n,H)(1 + \\log_2 h)$, with $h$ the edges of $H$'},
    'object': {
        'dur': 8.4, 'primitive': 'plot', 'x': [0, 10], 'y': [0, 1.08], 'labelRoom': 230,
        'xlabel': 'edge density $p$, schematic', 'ylabel': '$\\Pr[\\,G(n,p) \\supseteq H\\,]$',
        'yticks': [0, 1],
        'curves': [{'f': '1/(1+exp(-1.7*(x-6.3)))', 'label': 'contains $H$', 'tone': 'accent', 'at': 0.5, 'dur': 2.0}],
        'asymptotes': [{'x': 2.2, 'at': 2.8}],
        'points': [{'x': 2.2, 'y': 0.02, 'label': '$p_E$', 'tone': 'cool', 'at': 3.0},
                   {'x': 6.3, 'y': 0.5, 'label': '$p_c$', 'at': 3.4}],
        'beats': [
            {'at': 0.2, 'text': 'Schematic: the chance $G(n,p)$ contains a copy of $H$, as $p$ grows'},
            {'at': 3.0, 'text': '$p_E$: where every subgraph of $H$ is expected at least half a time'},
            {'at': 5.7, 'text': 'The claim: $p_c$ is at most $C\\,p_E\\,(1 + \\log_2 h)$, a single log factor'}]},
    'achievement': {
        'form': 'status', 'label': 'The second Kahn–Kalai conjecture (2007)',
        'statement': ['p_c(H) \\le C\\, p_E(n,H)\\,(1+\\log_2 h)'],
        'context': 'Before: $p_c = O(p_E \\log^3 n)$ (Dubroff–Kahn–Park, 2025)',
        'stamp': 'proved',
        'note': '$C = 2048\\,e^{50}$: enormous, but universal'},
    'verify': {'lean': 'main',
               'detail': 'The bound with the explicit constant $2048\\,e^{50}$; listed in the main results',
               'ourCheck': LEAN_MAIN_CHECK},
    'sources': [
        R('176', 'known_before', 'Kahn and Kalai (Combin. Probab. Comput. 2007)'),
        R('176', 'known_before', 'Dubroff–Kahn–Park (arXiv 2508.14269, 2025) got p_c = O(p_E log^3 n)'),
        R('176', 'claim', 'is at most 2048·e^50·p_E(n,H)·(1 + log2 h), where p_E is the least p at which every subgraph of H has expected count >= 1/2'),
        R('176', 'caveats', 'Constant 2048·e^50 is enormous but universal'),
        R('176', 'lean', 'listed in formalization.yaml'),
    ]})
print('ok b3')
