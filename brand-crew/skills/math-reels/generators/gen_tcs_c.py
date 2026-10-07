from gen_tcs_common import *

# ---------------------------------------------------------------- 125
write('125', 'proof', 'k-median at exactly $1 + 2/e$',
  'The metric k-median approximation threshold',
  'Claim: a deterministic $(1 + 2/e + \\varepsilon)$-approximation for metric k-median, matching the known hardness',
  {'dur': 8.6, 'primitive': 'numberline', 'min': 1, 'max': 3, 'ticks': [1, 1.5, 2, 2.5, 3],
   'axisLabel': 'approximation factor',
   'markers': [
     {'v': 2.7320508, 'label': 'Li–Svensson', 'note': '$1 + \\sqrt3$', 'at': 0.5, 'derived': '1 + sqrt 3'},
     {'v': 2, 'label': '$2 + \\varepsilon$', 'note': 'arXiv 2503.10972', 'at': 1.3},
     {'v': 1.7357589, 'label': 'hardness', 'note': 'Jain–Mahdian–Saberi', 'style': 'ring', 'tone': 'mute', 'at': 2.0, 'derived': '1 + 2/e', 'side': 'below'}],
   'slide': {'from': 2, 'to': 1.7357589, 'at': 3.6, 'dur': 1.5, 'label': 'claimed', 'note': '$1 + 2/e + \\varepsilon$', 'derived': '2 to 1 + 2/e'},
   'beats': [
     {'at': 0.2, 'text': 'Open $k$ facilities to minimise total client distance; algorithms crept down for a decade'},
     {'at': 2.9, 'text': 'Since 2002 nothing below $1 + 2/e \\approx 1.736$ has been possible unless P = NP'},
     {'at': 5.6, 'text': 'Claimed: an algorithm reaching it, so the threshold is exactly $1 + 2/e$'}]},
  {'form': 'bound',
   'before': {'label': 'Best known', 'tex': '2 + \\varepsilon', 'note': 'Cohen-Addad, Grandoni, Lee, Schwiegelshohn, Svensson'},
   'after': {'label': 'Claimed, 24 Sep 2026', 'tex': '1 + 2/e + \\varepsilon', 'note': 'deterministic, polynomial time'},
   'note': 'With specified candidate facilities; the polynomial depends on $\\varepsilon$'},
  {'lean': 'main', 'detail': 'MetricKMedian, KMedianThreshold and two recovery files, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 125, known_before', 'Li-Svensson 1+sqrt3+eps (2013)'),
   src('review 125, known_before', 'Gowda-Pensyl-Srinivasan-Trinh 2.613 (SODA 2023)'),
   src('review 125, known_before', 'Cohen-Addad, Grandoni, Lee, Schwiegelshohn and Svensson 2+eps (arXiv 2503.10972'),
   src('article, k-median', "Jain, Mahdian and Saberi showed in 2002 that k-median can't be approximated better than $1 + 2/e \\approx 1.736$"),
   src('article, k-median', 'The-Approximation-Threshold-for-Metric-k-Median-September-24-2026/main.pdf'),
   src('review 125, caveats', 'Tightness is for the model with specified candidate facilities'),
   src('review 125, caveats', 'Polynomial depends on eps.'),
   src('review 125, lean', 'MetricKMedian.lean, KMedianThreshold.lean, KMedianRecovery.lean, KMedianRefinedRecovery.lean; standard axioms')])

# ---------------------------------------------------------------- 126
def pms(rest):
    if not rest: yield []; return
    a = rest[0]
    for b in rest[1:]:
        for m in pms([x for x in rest if x not in (a, b)]): yield [(a, b)] + m
M6 = list(pms(list(range(6)))); assert len(M6) == 15
Us = [(0, 1, 2), (0, 1, 3), (0, 2, 4), (0, 3, 5), (1, 2, 5)]
cut = lambda U, M: sum((a in U) != (b in U) for a, b in M)
vals6 = [['$2{+}\\rho$' if cut(U, M) == 3 else '$\\rho$' for M in M6] for U in Us]
for U in Us:
    for M in M6: assert cut(U, M) in (1, 3)
write('126', 'proof', 'No small SDP for perfect matching',
  'Exponential semidefinite complexity of perfect matching',
  'Claim: every exact semidefinite lift of the perfect matching polytope has size $2^{\\Omega(n)}$',
  {'dur': 8.4, 'primitive': 'grid', 'rows': len(Us), 'cols': 15, 'values': vals6, 'stagger': 0.03,
   'cells': [[r, c, 'accent'] for r in range(len(Us)) for c in range(15) if vals6[r][c] != '$\\rho$'],
   'caption': 'Part of the shifted slack matrix of $K_6$: rows odd sets $U$, columns perfect matchings $M$',
   'beats': [
     {'at': 0.2, 'text': 'Each entry is $|M \\cap \\delta(U)| - 1 + \\rho$, for a fixed shift $0 < \\rho < 1$'},
     {'at': 2.9, 'text': 'Its PSD rank bounds the smallest exact SDP describing the matching polytope'},
     {'at': 5.6, 'text': 'Claimed: PSD rank $2^{\\Omega(n)}$, so no small SDP describes perfect matching'}]},
  {'form': 'status', 'label': "Rothvoss's question on semidefinite lifts (2014)",
   'statement': ['\\mathrm{rank}_{\\mathrm{psd}} \\ge 2^{\\Omega(n)}'],
   'context': 'Before: no small LP lift (Rothvoss, 2014); exponential PSD bounds for cut, TSP and correlation polytopes',
   'stamp': 'proved',
   'note': 'The Lean statement is weaker: superpolynomial, $> n^C$ for every $C$'},
  {'lean': 'part', 'detail': 'MatchingPSD.lean states superpolynomial lower bounds, not the exponential $2^{cn}$',
   'ourCheck': CHECK_LEAN},
  [src('review 126, claim', 'the odd-cut-vs-perfect-matching slack matrix shifted by rho, entries |M cap delta(U)|-1+rho, has real PSD rank 2^{Omega(n)}'),
   src('review 126, known_before', 'Rothvoss (STOC 2014 / JACM 2017) exponential linear extension complexity of the matching polytope, and asked about semidefinite lifts'),
   src('review 126, known_before', 'Lee-Raghavendra-Steurer (STOC 2015) exponential PSD lower bounds for cut, TSP and correlation polytopes'),
   src('review 126, lean', 'MatchingPSD.lean and MatchingAffineLift.lean state only superpolynomial lower bounds (> n^C for every C), not the exponential 2^{cn}')])

# ---------------------------------------------------------------- 127
cube = list(itertools.product([1, -1], repeat=3))
fv = lambda x: 1 if x[0] * x[1] + x[2] >= 0 else -1
pos = lambda x: (round(0.5 + 0.17 * x[0] + 0.09 * x[1], 4), round(0.5 - 0.36 * x[2] - 0.1 * x[1], 4))
nm = lambda x: ''.join('p' if v > 0 else 'm' for v in x)
ce = [(a, b) for a, b in itertools.combinations(cube, 2) if sum(p != q for p, q in zip(a, b)) == 1]
sens = [(a, b) for a, b in ce if fv(a) != fv(b)]
assert len(sens) * 2 == len(ce)
write('127', 'proof', 'The Gotsman–Linial bound',
  'Average sensitivity of polynomial threshold functions',
  'Claim: a degree-$d$ threshold function on $n$ bits has average sensitivity at most $8d\\sqrt n$',
  {'dur': 8.4, 'primitive': 'graph', 'r': 15,
   'nodes': [{'id': nm(x), 'x': pos(x)[0], 'y': pos(x)[1], 'tone': 'accent' if fv(x) > 0 else 'ok', 'fill': 'accent' if fv(x) > 0 else 'ok'} for x in cube],
   'edges': [[nm(a), nm(b), {'tone': 'faint', 'w': 1.8}] for a, b in ce if (a, b) not in sens] + [[nm(a), nm(b), {'tone': 'hot', 'w': 3.4}] for a, b in sens],
   'edgeAt': 0.6, 'edgeDur': 3.2,
   'beats': [
     {'at': 0.2, 'text': 'On the 3-cube, $f = \\mathrm{sgn}(x_1 x_2 + x_3)$: a degree-2 threshold function'},
     {'at': 2.9, 'text': 'Yellow edges flip $f$. Average sensitivity counts them: here, half of all edges'},
     {'at': 5.6, 'text': 'Claimed: never more than $8d\\sqrt n$ per input, for every $d \\le n$'}]},
  {'form': 'status', 'label': 'Gotsman–Linial conjecture (1994), asymptotic form',
   'statement': ['\\mathrm{AS}(\\mathrm{sgn}\\, p) \\le 8d\\sqrt n \\quad (\\deg p \\le d)'],
   'context': "Before: $\\sqrt n\\,(\\log n)^{O(d \\log d)}\\, 2^{O(d^2 \\log d)}$ (Kane, 2013)",
   'stamp': 'proved',
   'note': 'The exact-extremizer form is false, and is not claimed'},
  {'lean': 'main', 'detail': 'GotsmanLinial.lean, standard axioms: a short paper plus a Lean proof',
   'ourCheck': CHECK_LEAN},
  [src('review 127, claim', 'Every degree-<=d polynomial threshold function on {-1,1}^n (sgn(0)=1) has average sensitivity (total influence) at most 8 d sqrt(n), uniformly for 1<=d<=n'),
   src('review 127, known_before', 'Gotsman-Linial (1994) conjectured the exact extremizer'),
   src('review 127, known_before', "Kane ('The correct exponent for the Gotsman-Linial conjecture', CCC 2013) sqrt(n) (log n)^{O(d log d)} 2^{O(d^2 log d)}"),
   src('review 127, caveats', 'Proves the asymptotic O(d sqrt n) form, not the exact extremizer statement (which is false).'),
   src('review 127, lean', 'main theorem formalized: GotsmanLinial.lean, standard axioms')])

# ---------------------------------------------------------------- 128
sup = 'GCATGC'
for w in ['GCAT', 'CATG', 'ATGC']: assert w in sup
write('128', 'improved-bound', 'Shortest common superstring within 2',
  'A factor-two approximation for shortest common superstring',
  'Claim: a polynomial-time algorithm always finds a common superstring at most twice the optimal length',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'sequence', 'until': 3.6, 'items': list(sup), 'stagger': 0.15,
     'marks': {'0': {'tone': 'accent', 'at': 1.6}, '1': {'tone': 'accent', 'at': 1.6}, '2': {'tone': 'accent', 'at': 1.6}, '3': {'tone': 'accent', 'at': 1.6}},
     'caption': '$\\texttt{GCAT}$, $\\texttt{CATG}$ and $\\texttt{ATGC}$ all sit inside, overlapping'},
    {'primitive': 'numberline', 'from': 3.6, 'min': 1.8, 'max': 3.2, 'ticks': [2, 2.5, 3],
     'axisLabel': 'guaranteed length, as a multiple of the optimum',
     'markers': [
       {'v': 3, 'label': 'Blum et al.', 'note': '1994', 'at': 0.4},
       {'v': 2.466, 'label': 'Englert et al.', 'note': 'STOC 2022', 'at': 0.9}],
     'slide': {'from': 2.466, 'to': 2, 'at': 1.8, 'dur': 1.5, 'label': 'claimed $2$', 'note': 'not Greedy'}}],
   'beats': [
     {'at': 0.2, 'text': 'Find the shortest string containing every input; here one of length 6'},
     {'at': 3.7, 'text': 'Factor 2 was the folklore target, the one Greedy was conjectured to hit'},
     {'at': 6.3, 'text': 'Claimed: a new algorithm reaches it, via Euler tours'}]},
  {'form': 'bound',
   'before': {'label': 'Best known, STOC 2022', 'tex': '2.466 \\cdot \\mathrm{OPT}', 'note': 'Englert–Matsakis–Veselý'},
   'after': {'label': 'Claimed, 24 Sep 2026', 'tex': '2 \\cdot \\mathrm{OPT}', 'note': 'deterministic, polynomial time; a new algorithm'},
   'note': 'Does not settle the Greedy conjecture; factor 2 is not known to be optimal'},
  {'lean': 'main', 'detail': 'Superstring.lean, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 128, known_before', 'Blum-Jiang-Li-Tromp-Yannakakis (JACM 1994) 3-approximation'),
   src('review 128, known_before', 'Englert-Matsakis-Vesely 2.466 (STOC 2022)'),
   src('review 128, claim', 'It is a new algorithm (Euler tours in a hierarchical substring graph with forced-occurrence lower bounds), not the Greedy algorithm.'),
   src('catalogue, family 128 manuscript path', 'A-Polynomial-Time-2-Approximation-for-Shortest-Common-Superstring-September-24-2026/paper.pdf'),
   src('review 128, caveats', 'Does not resolve the Greedy conjecture'),
   src('review 128, lean', 'main theorem formalized: Superstring.lean (OAI.Superstring.main), standard axioms')])

# ---------------------------------------------------------------- 129
write('129', 'proof', 'Sakoda–Sipser: exponential state costs',
  'Exponential state costs for two-way automata',
  'Claim: two-way deterministic automata need exponentially many states to simulate one-way nondeterministic ones',
  {'dur': 8.6, 'primitive': 'plot', 'x': [0, 1000], 'y': [0, 2000],
   'xticks': [0, 500, 1000], 'yticks': [0, 1000, 2000],
   'xlabel': 'points $h$ in the liveness language', 'ylabel': 'states needed', 'labelRoom': 230,
   'curves': [
     {'f': 'x + 3', 'label': 'one-way NFA: $h + 3$', 'tone': 'soft', 'at': 0.6, 'dur': 1.6},
     {'f': 'pow(2, floor((x - 2) / 31) / 2) / 2 - 2', 'from': 2, 'to': 743, 'label': 'two-way DFA, at least', 'tone': 'claim', 'at': 3.0, 'dur': 2.4}],
   'beats': [
     {'at': 0.2, 'text': "Sakoda–Sipser's liveness language on $h$ points: a one-way NFA needs $h + 3$ states"},
     {'at': 2.9, 'text': 'Claimed: any $s$-state two-way DFA for it has $4(s+2)^2 \\ge 2^{\\lfloor (h-2)/31 \\rfloor}$'},
     {'at': 5.9, 'text': "Exponential overtakes linear; with the paper's constant 31 it takes a while"}]},
  {'form': 'status', 'label': 'Sakoda–Sipser question (1978), growing alphabets',
   'statement': ['\\text{1NFA} \\to \\text{2DFA}: \\ 2^{\\Omega(h)} \\text{ states}'],
   'context': 'Before: only quadratic lower bounds for unrestricted two-way DFAs',
   'stamp': 'proved',
   'note': 'Hard inputs are long, so no L/poly versus NL separation is claimed'},
  {'lean': 'main', 'detail': 'Complementation, determinization and liveness: all three statements in Lean',
   'ourCheck': CHECK_LEAN},
  [src('review 129, claim', 'One-way liveness on h points has an (h+3)-state one-way NFA but every equivalent s-state 2DFA has 4(s+2)^2 >= 2^{floor((h-2)/31)}'),
   src('review 129, known_before', 'Sakoda-Sipser (STOC 1978) asked whether 2NFA/1NFA -> 2DFA needs exponentially many states'),
   src('article, Sakoda–Sipser', 'and for unrestricted ones only quadratic bounds'),
   src('review 129, caveats', 'this cannot be such a bound, and no complexity-class consequence is claimed'),
   src('review 129, lean', 'main theorem formalized: TwoWayComplementation.lean, TwoWayDeterminization.lean, OneWayLiveness.lean; standard axioms')])

# ---------------------------------------------------------------- 131
SW = {'0': (0.4, 0.3), '1': (0.6, 0.3), '2': (0.4, 0.72), '3': (0.6, 0.72), '4': (0.16, 0.12), '5': (0.84, 0.12), '6': (0.16, 0.9), '7': (0.84, 0.9)}
base = [('0', '4'), ('1', '5'), ('2', '6'), ('3', '7'), ('4', '5'), ('6', '7'), ('4', '6')]
E1 = base + [('0', '1'), ('2', '3')]
E2 = base + [('0', '2'), ('1', '3')]
deg = lambda E: {v: sum(v in e for e in E) for v in SW}
assert deg(E1) == deg(E2) and not set(E2) - set(E1) & {('0', '1'), ('2', '3')}
dg = deg(E1)
def swpanel(hot, tone, extra):
    p = {'primitive': 'graph', 'r': 17,
         'nodes': [{'id': k, 'x': x, 'y': y, 'label': dg[k], 'tone': 'accent' if k in '0123' else 'soft'} for k, (x, y) in SW.items()],
         'edges': [[a, b, {'tone': 'soft'}] for a, b in base] + [[a, b, {'tone': tone, 'w': 4}] for a, b in hot]}
    p.update(extra); return p
write('131', 'proof', 'Switch chain: rapid mixing, every sequence',
  'Rapid mixing of graph switches for every degree sequence',
  'Claim: the edge-switch chain mixes within $2n^8$ steps for every graphical degree sequence',
  {'dur': 8.4, 'layout': 'sequence', 'panels': [
    swpanel(E1[-2:], 'hot', {'until': 4.0, 'edgeAt': 0.4, 'edgeDur': 2.2}),
    swpanel(E2[-2:], 'accent', {'from': 4.0, 'edgeAt': 0.1, 'edgeDur': 1.2})],
   'beats': [
     {'at': 0.2, 'text': 'A switch: pick four vertices and swap the two edges among them for the other pairing'},
     {'at': 4.1, 'text': 'Every degree, the number on each vertex, stays the same'},
     {'at': 6.2, 'text': 'Claimed: random switches reach a uniform graph in polynomial time'}]},
  {'form': 'status', 'label': 'Kannan–Tetali–Vempala conjecture (1999), simple graphs',
   'statement': ['t_{\\mathrm{mix}} \\le 2n^8 \\ \\text{ for every graphical degree sequence}'],
   'context': 'Before: regular graphs (Cooper–Dyer–Greenhill, 2007), half-regular bipartite and P-stable classes',
   'stamp': 'proved',
   'note': '$n^8$ is worst case, far too loose to set your step count'},
  {'lean': 'main', 'detail': 'SwitchChain.lean: mixing time, connectivity, spectral gap; not the exact sampler',
   'ourCheck': CHECK_LEAN},
  [src('review 131, claim', 'the lazy switch chain (pick 4 vertices, swap a perfect matching) on simple graphs mixes in at most 2n^8 steps (TV 1/4)'),
   src('review 131, known_before', 'Kannan-Tetali-Vempala (Random Structures & Algorithms 1999) conjectured polynomial mixing for every degree sequence'),
   src('review 131, known_before', 'Proved for regular graphs (Cooper-Dyer-Greenhill 2007), half-regular bipartite, and P-stable classes'),
   src('review 131, caveats', 'n^8 is a worst-case bound'),
   src('review 131, lean', 'main theorem formalized: SwitchChain.lean (mixing time, connectivity, spectral gap); the exact sampler is not formalized')])

# ---------------------------------------------------------------- 132
write('132', 'disproof', 'Block sensitivity beats sensitivity squared',
  'A superquadratic separation of sensitivity and block sensitivity',
  'Claim: Boolean functions with $\\mathrm{bs}(f) \\ge s(f)^\\alpha$ for a fixed $\\alpha > 2$',
  {'dur': 8.4, 'primitive': 'numberline', 'min': 1, 'max': 4.6, 'ticks': [1, 2, 3, 4],
   'axisLabel': 'the exponent $\\alpha$ relating $\\mathrm{bs}(f)$ to $s(f)^\\alpha$',
   'markers': [
     {'v': 2, 'label': 'best separation', 'note': 'quadratic, 1995', 'at': 0.6},
     {'v': 4, 'label': 'Huang', 'note': '2019, $\\mathrm{bs} \\le s^4$', 'tone': 'soft', 'at': 1.4}],
   'ranges': [{'from': 2, 'to': 4, 'label': 'claimed: some $\\alpha > 2$', 'note': 'the exact value is open', 'tone': 'claim', 'side': 'below', 'at': 4.4}],
   'beats': [
     {'at': 0.2, 'text': 'Sensitivity flips one bit at a time; block sensitivity flips disjoint blocks'},
     {'at': 2.9, 'text': 'Huang (2019) bounded block sensitivity by $s^4$; every example stayed quadratic'},
     {'at': 5.6, 'text': 'Claimed: functions beating quadratic by a fixed power'}]},
  {'form': 'status', 'label': 'Quadratic Sensitivity Conjecture (Nisan–Szegedy, 1994)',
   'statement': ['\\mathrm{bs}(f) \\le C\\, s(f)^2'],
   'context': 'Counterexamples: $\\mathrm{bs}/s^2 \\ge 2^d/(4(d+2)^2)$ for every $d$',
   'stamp': 'disproved',
   'note': "$\\alpha$ is unspecified; the gap up to Huang's $s^4$ remains"},
  {'lean': 'main', 'detail': 'SensitivitySeparation.lean, about 4.4k lines: the easiest claim here to audit',
   'ourCheck': CHECK_LEAN},
  [src('review 132, known_before', 'Nisan-Szegedy (1994) asked whether bs <= s^2; Rubinstein (1995) quadratic separation'),
   src('review 132, known_before', 'Huang (Annals 2019, arXiv 1907.00847) proved the Sensitivity Conjecture, giving bs <= s^4'),
   src('review 132, known_before', 'Best separation stayed quadratic.'),
   src('review 132, claim', 'explicitly bs/s^2 >= 2^d/(4(d+2)^2) for every d'),
   src('review 132, caveats', 'alpha is some fixed constant >2, not specified as large'),
   src('review 132, lean', 'SensitivitySeparation.lean (OAI.Paper320.quantitative_separation), ~4.4k lines, standard axioms')])

# ---------------------------------------------------------------- 133
WL = {'a1': (0.12, 0.25), 'a': (0.32, 0.25), 'c': (0.5, 0.55), 'b': (0.68, 0.25), 'b1': (0.88, 0.25), 'd': (0.5, 0.92)}
WE = [('a1', 'a'), ('a', 'c'), ('c', 'b'), ('b', 'b1'), ('c', 'd')]
nb = {v: [u for e in WE for u in e if v in e and u != v] for v in WL}
col0 = {v: 0 for v in WL}
def refine(col):
    sig = {v: (col[v], tuple(sorted(col[u] for u in nb[v]))) for v in WL}
    keys = sorted(set(sig.values())); return {v: keys.index(sig[v]) for v in WL}
col1 = refine(col0); col2 = refine(col1); col3 = refine(col2)
assert len(set(col1.values())) == 3 and len(set(col2.values())) == 4 and col3 == col2
TN = ['accent', 'ok', 'warn', 'bad']
def wlpanel(col, extra):
    p = {'primitive': 'graph', 'r': 18,
         'nodes': [{'id': k, 'x': x, 'y': y, 'tone': 'soft' if col is None else TN[col[k]], 'fill': 'soft' if col is None else TN[col[k]]} for k, (x, y) in WL.items()],
         'edges': [[a, b] for a, b in WE]}
    p.update(extra); return p
write('133', 'proof', 'The complexity of Weisfeiler–Leman',
  'The computational complexity of Weisfeiler–Leman refinement',
  'Claim: deciding $k$-WL equivalence needs $n^{\\Omega(k)}$ time unconditionally, and is EXPTIME-complete with $k$ as input',
  {'dur': 8.4, 'layout': 'sequence', 'panels': [
    wlpanel(None, {'until': 2.6, 'edgeAt': 0.3, 'edgeDur': 1.2}),
    wlpanel(col1, {'from': 2.6, 'until': 5.3, 'edgeAt': 0, 'edgeDur': 0.3}),
    wlpanel(col2, {'from': 5.3, 'edgeAt': 0, 'edgeDur': 0.3})],
   'beats': [
     {'at': 0.2, 'text': 'Colour refinement: start with one colour everywhere'},
     {'at': 2.7, 'text': "Recolour each vertex by its neighbours' colours, and repeat until stable"},
     {'at': 5.4, 'text': '$k$-WL refines $k$-tuples instead. Claimed: its $n^{\\Omega(k)}$ cost is unavoidable'}]},
  {'form': 'status', 'label': 'Lower bounds for deciding k-WL equivalence (open)',
   'statement': ['k\\text{-WL equivalence needs } n^{\\Omega(k)} \\text{ time}'],
   'context': 'Before: $n^{O(k)}$ algorithms and lower bounds on refinement rounds, not on any algorithm',
   'stamp': 'proved',
   'note': 'Unconditional, of the time-hierarchy kind; deterministic sequential models only'},
  {'lean': 'main', 'detail': 'All four papers: ParityLifts, WLIdentification, WeisfeilerLeman, VariableWL',
   'ourCheck': CHECK_LEAN},
  [src('review 133, claim', 'deciding k-WL equivalence of two n-vertex graphs needs n^{ck} deterministic time (multitape TM or log-word RAM) unconditionally'),
   src('review 133, claim', 'with k given in binary, joint-update k-WL equivalence is EXPTIME-complete even on subcubic graphs'),
   src('review 133, known_before', 'Unconditional lower bounds for deciding k-WL equivalence by any algorithm, and EXPTIME-completeness with k in the input, were open.'),
   src('review 133, caveats', "it is real but of the 'diagonalization' flavor; it applies to deterministic sequential models only"),
   src('review 133, lean', 'main theorem formalized: ParityLifts.lean, WLIdentification.lean, WeisfeilerLeman.lean, VariableWL.lean (all four papers); standard axioms')])

# ---------------------------------------------------------------- 134
write('134', 'improved-bound', 'Generalized star height at most three',
  'Generalized star height at most three',
  'Claim: every regular language has a generalized regular expression with at most three nested stars',
  {'dur': 8.4, 'primitive': 'numberline', 'min': 0, 'max': 14, 'ticks': [0, 1, 2, 3, 4, 13],
   'axisLabel': 'a uniform bound on generalized star height',
   'markers': [
     {'v': 13, 'label': 'first paper', 'note': 'bound 13', 'at': 0.6},
     {'v': 4, 'label': 'second paper', 'note': 'bound 4', 'at': 1.6},
     {'v': 1, 'label': 'open', 'note': 'is 1 always enough?', 'style': 'ring', 'tone': 'mute', 'at': 5.2}],
   'slide': {'from': 4, 'to': 3, 'at': 2.8, 'dur': 1.4, 'label': 'claimed $3$', 'note': 'for every language'},
   'beats': [
     {'at': 0.2, 'text': 'With complement allowed, no uniform bound on nested stars was known at all'},
     {'at': 2.8, 'text': 'This family brings it to 13, then 4, then 3'},
     {'at': 5.3, 'text': 'Whether one star always suffices is still the open problem'}]},
  {'form': 'bound',
   'before': {'label': 'Before this family', 'tex': '\\text{no fixed bound}', 'note': 'ordinary star height is unbounded (Eggan 1963)'},
   'after': {'label': 'Claimed, 25 Sep 2026', 'tex': '\\mathrm{gsh}(L) \\le 3', 'note': 'for every regular language $L$'},
   'note': 'Expression size is unbounded; whether height 1 suffices is still open'},
  {'lean': 'main', 'detail': 'GeneralizedStarHeight.lean for the bound 3, which subsumes 13 and 4',
   'ourCheck': CHECK_LEAN},
  [src('review 134, claim', 'Earlier papers in the family give bounds 13 and 4.'),
   src('review 134, known_before', 'Ordinary star height is unbounded (Eggan 1963;'),
   src('review 134, known_before', 'No uniform bound of any size was known.'),
   src('catalogue, family 134 manuscript path', 'Finite-Monoid-Computations-and-a-Uniform-Generalized-Star-Height-Bound-September-25-2026'),
   src('review 134, caveats', 'Does not decide whether height 1 suffices'),
   src('review 134, caveats', 'Expression size unbounded.'),
   src('review 134, lean', 'GeneralizedStarHeight.lean (OAI.GeneralizedStarHeight.main) for the bound 3, which subsumes the 13 and 4 papers')])

# ---------------------------------------------------------------- 135
write('135', 'improved-bound', 'Homogeneous depth-five circuits for IMM',
  'Homogeneous depth-five lower bounds for matrix products',
  'Claim: iterated matrix multiplication needs $n^{\\Theta(\\sqrt n)}$ gates in homogeneous depth-five circuits',
  {'dur': 8.4, 'primitive': 'equation', 'lines': [
     {'tex': '\\mathrm{IMM}_{n,n} = (\\term{x}{X_1 X_2 \\cdots X_n})_{\\term{e}{1,1}}', 'note': '$n$ generic $n \\times n$ matrices', 'at': 0.3, 'y': 0.13,
      'terms': {'x': {'label': 'a product of $n$ grids', 'at': 0.4, 'side': 'above'}, 'e': {'label': 'top-left entry', 'tone': 'cool', 'at': 0.8, 'mark': 'arrow'}}},
     {'tex': '\\text{size} \\ge \\term{lo}{n^{\\sqrt n/400}}', 'note': 'claimed lower bound', 'tone': 'accent', 'at': 2.7,
      'terms': {'lo': {'label': 'grows like $n^{\\sqrt n}$', 'at': 0.4, 'mark': 'box'}}},
     {'tex': '\\text{size} \\le \\term{hi}{n^{\\sqrt n + 4}}', 'note': 'matching upper bound', 'tone': 'soft', 'at': 4.2,
      'terms': {'hi': {'label': 'same growth', 'tone': 'cool', 'at': 0.4, 'mark': 'box'}}}],
   'beats': [
     {'at': 0.2, 'text': 'The polynomial: the top-left entry of a product of $n$ matrices of variables'},
     {'at': 2.8, 'text': 'Sums of products, five layers deep, every gate homogeneous'},
     {'at': 5.4, 'text': 'Claimed: lower and upper bounds meet at $n^{\\Theta(\\sqrt n)}$, over characteristic zero'}]},
  {'form': 'bound',
   'before': {'label': 'Homogeneous depth four, c. 2014', 'tex': 'n^{\\Omega(\\sqrt n)}', 'note': 'Kayal–Limaye–Saha–Srinivasan; Kumar–Saraf'},
   'after': {'label': 'Claimed, 25 Sep 2026', 'tex': 'n^{\\Theta(\\sqrt n)}', 'note': 'homogeneous depth five, any bottom linear forms'},
   'note': 'Syntactic homogeneity is essential; general depth five is not covered'},
  {'lean': 'main', 'detail': 'DepthFive.lean, lower and upper bounds, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 135, claim', 'has at least n^{sqrt(n)/400} gates for large n, with arbitrary bottom linear forms; a matching n^{sqrt(n)+4} upper bound holds over every field'),
   src('review 135, known_before', 'Homogeneous depth-4 lower bounds n^{Omega(sqrt n)} for IMM (Kayal-Limaye-Saha-Srinivasan; Kumar-Saraf, ~2014)'),
   src('catalogue, family 135 manuscript path', 'Homogeneous-depth-five-lower-bounds-for-iterated-matrix-multiplication-September-25-2026'),
   src('review 135, caveats', 'Homogeneity is syntactic and essential; general (non-homogeneous) depth-5 is not covered.'),
   src('review 135, lean', 'main theorem formalized: DepthFive.lean (lower and upper bounds), standard axioms')])

# ---------------------------------------------------------------- 136
EOL = {'s': (0.08, 0.5), 'p1': (0.2, 0.3), 'p2': (0.34, 0.45), 'p3': (0.46, 0.24), 'p4': (0.6, 0.4), 'p5': (0.72, 0.2), 't': (0.86, 0.38),
       'c1': (0.3, 0.8), 'c2': (0.46, 0.92), 'c3': (0.52, 0.7), 'u1': (0.7, 0.75), 'u2': (0.88, 0.88)}
tone136 = {'s': 'cool', 't': 'hot', 'u1': 'hot', 'u2': 'hot'}
write('136', 'proof', 'A quasilinear PCP theorem for PPAD',
  'A quasilinear PCP theorem for PPAD',
  'Claim: End-of-Line reduces, with $N(\\log N)^{O(1)}$ blow-up, to circuits that survive a fraction of bad gates',
  {'dur': 8.4, 'primitive': 'graph', 'r': 14,
   'nodes': [{'id': k, 'x': x, 'y': y, 'tone': tone136.get(k, 'soft'), 'fill': tone136.get(k)} for k, (x, y) in EOL.items()],
   'edges': [['s', 'p1'], ['p1', 'p2'], ['p2', 'p3'], ['p3', 'p4'], ['p4', 'p5'], ['p5', 't'], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'c1'], ['u1', 'u2']],
   'edgeAt': 0.5, 'edgeDur': 3.0,
   'beats': [
     {'at': 0.2, 'text': 'End-of-Line, schematically: from a known source, paths and cycles; find any other end'},
     {'at': 2.9, 'text': 'It is the canonical PPAD problem, behind Nash equilibria and fixed points'},
     {'at': 5.6, 'text': 'Claimed: robust numerical circuits encode it with only polylogarithmic blow-up'}]},
  {'form': 'status', 'label': 'PCP-for-PPAD conjecture (Babichenko–Papadimitriou–Rubinstein, 2016)',
   'statement': ['\\text{End-of-Line}_N \\to \\text{circuits of size } N(\\log N)^{O(1)}'],
   'context': 'Before: constant-error hardness only with every gate satisfied (Rubinstein, 2016/2018)',
   'stamp': 'proved',
   'note': 'Consequences for approximate Nash stay conditional'},
  {'lean': 'none', 'detail': 'No Lean statement; at 147 pages, the longest TCS manuscript in the release',
   'ourCheck': CHECK_NONE},
  [src('review 136, known_before', 'The quasilinear PCP-for-PPAD conjecture was posed by Babichenko-Papadimitriou-Rubinstein (ITCS 2016)'),
   src('review 136, known_before', 'constant-error hardness with every gate satisfied (Rubinstein 2016/2018)'),
   src('review 136, claim', 'a deterministic polynomial-time reduction from End-of-Line instances of length N to generalized circuits of total length N (log N)^{O(1)}'),
   src('review 136, caveats', 'Under ETH for PPAD it implies stronger lower bounds for approximate Nash, but those consequences stay conditional.'),
   src('review 136, caveats', 'Longest TCS manuscript in the release (147 pages), unformalized.')])

# ---------------------------------------------------------------- 137
tape = ['1', '0', '0', '1', '1', '0', '1', '$\\sqcup$', '$\\sqcup$', '$\\sqcup$']
write('137', 'improved-bound', 'One-tape time in $T^{2/5}$ space',
  'One-tape time simulation in two-fifths-power space',
  'Claim: $T$ steps of a one-tape machine can be simulated in $O(T^{2/5}\\,\\mathrm{polylog}\\, T)$ space',
  {'dur': 8.4, 'layout': 'sequence', 'panels': [
    {'primitive': 'sequence', 'until': 3.4, 'items': tape, 'stagger': 0.1,
     'marks': {'4': {'tone': 'accent', 'at': 1.4}},
     'caption': 'one writable tape, one head moving a cell at a time'},
    {'primitive': 'numberline', 'from': 3.4, 'min': 0.3, 'max': 0.6,
     'ticks': [{'v': 0.4, 'label': '$2/5$'}, {'v': 0.5, 'label': '$1/2$'}],
     'axisLabel': 'exponent $e$ in space $T^{e}$ to simulate $T$ steps',
     'markers': [{'v': 0.5, 'label': 'classical', 'note': '$\\sqrt T$ space', 'at': 0.4, 'derived': '1/2'}],
     'slide': {'from': 0.5, 'to': 0.4, 'at': 1.4, 'dur': 1.5, 'label': 'claimed', 'note': '$T^{2/5}$, one tape', 'derived': '1/2 to 2/5'}}],
   'beats': [
     {'at': 0.2, 'text': 'A machine with one writable tape, run for $T$ steps'},
     {'at': 3.5, 'text': 'The classic simulation uses about $\\sqrt T$ space; Williams asked in 2025 to beat it'},
     {'at': 6.0, 'text': 'Claimed: $T^{2/5}$ space, for this model only'}]},
  {'form': 'bound',
   'before': {'label': 'Classical, one tape', 'tex': 'O(\\sqrt T)', 'note': 'question from Williams, STOC 2025'},
   'after': {'label': 'Claimed, 25 Sep 2026', 'tex': 'O(T^{2/5} \\log^C T)', 'note': 'space; running time unrestricted'},
   'note': 'One writable tape and a supplied time cap only'},
  {'lean': 'none', 'detail': 'No Lean statement; a model-specific manuscript',
   'ourCheck': CHECK_NONE},
  [src('review 137, known_before', 'Classical O(sqrt t) space simulation for one-tape machines'),
   src('review 137, known_before', "Williams (STOC 2025, 'Simulating time with square-root space')"),
   src('review 137, claim', 'can be simulated up to a supplied time cap T in O(T^{2/5} polylog T) work space'),
   src('catalogue, family 137 manuscript path', 'Simulating-One-Tape-Time-in-Two-Fifths-Power-Space-September-25-2026/article.pdf'),
   src('review 137, caveats', 'Model-specific (one writable tape, supplied cap, accessor condition)')])

# ---------------------------------------------------------------- 138
write('138', 'improved-bound', 'Subset Sum in $O(2^{0.49n})$',
  'Subset Sum in $O(2^{0.49n})$ time',
  'Claim: worst-case Subset Sum on $n$ integers in $O(2^{0.49n})$ randomized time, below meet-in-the-middle',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'sequence', 'until': 3.4, 'items': [7, 3, 9, 2, 8, 5], 'stagger': 0.15,
     'marks': {'0': {'tone': 'accent', 'at': 1.6}, '4': {'tone': 'accent', 'at': 1.6}},
     'caption': 'pick numbers that hit a target exactly, here $7 + 8$'},
    {'primitive': 'numberline', 'from': 3.4, 'min': 0.25, 'max': 0.55, 'ticks': [0.3, 0.4, 0.5],
     'axisLabel': 'exponent $c$ in time $2^{cn}$',
     'markers': [
       {'v': 0.5, 'label': 'meet in the middle', 'note': '1974, worst case', 'at': 0.4, 'derived': 'n/2, exponent 1/2'},
       {'v': 0.291, 'label': 'random inputs', 'note': 'only, not worst case', 'style': 'ring', 'tone': 'mute', 'at': 0.9}],
     'slide': {'derived': 'n/2 to 0.49n', 'from': 0.5, 'to': 0.49, 'at': 1.8, 'dur': 1.5, 'label': 'claimed', 'note': '$0.49$', 'side': 'below'}}],
   'beats': [
     {'at': 0.2, 'text': 'Subset Sum: is there a subset of $n$ integers with exactly the target sum?'},
     {'at': 3.5, 'text': 'Worst case: $2^{n/2}$ since Horowitz and Sahni in 1974'},
     {'at': 6.0, 'text': 'Claimed: $2^{0.49n}$. Small, but the first exponential dent in 50 years'}]},
  {'form': 'bound',
   'before': {'label': 'Best known since 1974', 'tex': '2^{n/2}', 'note': 'Horowitz–Sahni; up to polynomial factors'},
   'after': {'label': 'Claimed, 4 Oct 2026', 'tex': 'O(2^{0.49n})', 'note': 'randomized, success at least $2/3$, word RAM'},
   'note': 'The saving is $2^{0.01n}$: a factor of two at $n = 100$'},
  {'lean': 'none', 'detail': 'No Lean statement; manuscript only',
   'ourCheck': CHECK_NONE},
  [src('review 138, known_before', 'Horowitz-Sahni (1974) meet-in-the-middle 2^{n/2}'),
   src('article, Subset Sum below 2^{n/2}', 'about $2^{0.291n}$'),
   src('review 138, claim', 'A uniform randomized algorithm solves worst-case Subset Sum on n polynomial-bit integers in O(2^{0.49n}) word-RAM time on every execution (intermediate bound 2^{0.489995n} poly), success >= 2/3.'),
   src('catalogue, family 138 manuscript path', 'Subset-Sum-in-Time-2-power-0-49n-October-4-2026/subset-sum.pdf'),
   src('article, Subset Sum below 2^{n/2}', 'The saving is $2^{0.01n}$, so at $n = 100$ it is a factor of two'),
   src('review 138, explainer', 'A worst-case 2^{0.49n} would break a 50-year barrier')])

# ---------------------------------------------------------------- 139
write('139', 'improved-bound', 'Log-concave sampling in $d^\\varepsilon$ queries',
  'Subpolynomial query complexity for log-concave sampling',
  'Claim: $C_\\varepsilon d^\\varepsilon$ gradient queries suffice to sample a well-conditioned log-concave density',
  {'dur': 8.4, 'primitive': 'numberline', 'min': 0, 'max': 0.3, 'ticks': [0, 0.1, 0.2, 0.3],
   'axisLabel': 'exponent $e$ in a query bound $d^{e}$, condition number 2',
   'markers': [
     {'v': 0.25, 'label': 'high accuracy', 'note': '$d^{1/4}$', 'at': 0.5, 'derived': '1/4'},
     {'v': 0.2, 'label': 'Chen et al.', 'note': 'about $d^{1/5}$', 'at': 1.0, 'derived': '1/5'}],
   'slide': {'from': 0.2, 'to': 0, 'at': 3.0, 'dur': 1.6, 'label': 'claimed', 'note': 'any $\\varepsilon > 0$', 'derived': '1/5 to any epsilon'},
   'beats': [
     {'at': 0.2, 'text': 'Sample from $e^{-V}$ in $d$ dimensions, using value-and-gradient queries of $V$'},
     {'at': 2.9, 'text': 'Standard samplers need a small power of $d$'},
     {'at': 5.4, 'text': 'Claimed: $d^{\\varepsilon}$ for every $\\varepsilon$, and $\\log d$ is necessary'}]},
  {'form': 'bound',
   'before': {'label': 'Best upper bounds', 'tex': 'd^{1/4} \\text{ to } d^{1/5}', 'note': 'MALA/HMC-type samplers and a recent preprint'},
   'after': {'label': 'Claimed, 26 Sep 2026', 'tex': 'C_\\varepsilon\\, d^{\\varepsilon}', 'note': 'for every $\\varepsilon > 0$; $c \\log d$ queries are needed'},
   'note': 'Queries only: computation between them is unbounded, so no sampler gets faster'},
  {'lean': 'main', 'detail': 'LogConcaveQuery.lean, upper and lower bounds, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 139, known_before', 'the paper cites best high-accuracy bounds with a d^{1/4} term and a September 30, 2026 preprint by Chen et al. at about d^{1/5}'),
   src('review 139, claim', 'sampling within TV 1/10 needs at most C_eps d^eps exact value-and-gradient queries'),
   src('review 139, claim', 'and at least c log d queries; so the optimal dimension exponent is 0'),
   src('review 139, caveats', 'Condition number fixed at 2.'),
   src('catalogue, family 139 manuscript path', 'Subpolynomial-query-complexity-for-well-conditioned-log-concave-sampling-September-26-2026/article.pdf'),
   src('review 139, caveats', 'Query complexity only: computation between queries is unbounded'),
   src('review 139, lean', 'main theorem formalized: LogConcaveQuery.lean (upper C_eps d^eps and lower c log d), standard axioms')])

# ---------------------------------------------------------------- 140
write('140', 'improved-bound', 'Memory–sample bounds for Gaussian regression',
  'Memory–sample lower bounds for noiseless regression',
  'Claim: a streaming learner with $A d^2$ bits needs $\\Omega_A(d \\log(1/\\varepsilon))$ exact Gaussian measurements',
  {'dur': 8.4, 'primitive': 'plot', 'x': [0, 10], 'y': [0, 12], 'labelRoom': 250,
   'xlabel': 'target accuracy, $\\log(1/\\varepsilon)$', 'ylabel': 'measurements, in units of $d$ (schematic)',
   'curves': [
     {'f': '1', 'label': 'big memory: about $d$', 'tone': 'soft', 'at': 0.6, 'dur': 1.4},
     {'f': '1 + x', 'label': '$A d^2$ bits: $d\\log(1/\\varepsilon)$', 'tone': 'claim', 'at': 3.0, 'dur': 1.8}],
   'regions': [{'f': '1 + x', 'f2': '1', 'at': 5.0}],
   'beats': [
     {'at': 0.2, 'text': 'Recover a unit vector from exact measurements $y = \\langle x, s \\rangle$, one pass'},
     {'at': 2.9, 'text': 'With room for the normal equations, about $d$ measurements suffice'},
     {'at': 5.4, 'text': 'Claimed: with only $A d^2$ bits you pay the extra $\\log(1/\\varepsilon)$, and that is tight'}]},
  {'form': 'bound',
   'before': {'label': 'Sharan–Sidford–Valiant, STOC 2019', 'tex': '\\Omega(d \\log\\log(1/\\varepsilon))', 'note': 'noisy model, at most $d^2/4$ bits'},
   'after': {'label': 'Claimed, 27 Sep 2026', 'tex': '\\Omega_A(d \\log(1/\\varepsilon))', 'note': 'noiseless, $A d^2$ bits; matches the upper bound'},
   'note': 'A narrow model: noiseless Gaussian design, uniform prior, finite-state learner'},
  {'lean': 'main', 'detail': 'Eight Lean files across six overlapping papers; a few variant statements left out',
   'ourCheck': CHECK_LEAN},
  [src('review 140, claim', 'a streaming learner retaining at most A d^2 bits between exact Gaussian linear measurements y=<x,s> needs Omega_A(d log(1/eps)) measurements'),
   src('review 140, known_before', "Sharan-Sidford-Valiant (STOC 2019) 'Memory-sample tradeoffs for linear regression with small error': with <= d^2/4 bits"),
   src('article, Notable results, briefly', "sharpening Sharan, Sidford and Valiant's $\\Omega(d\\log\\log(1/\\varepsilon))$-type bound"),
   src('catalogue, family 140 manuscript path', 'Memory-and-precision-in-noiseless-Gaussian-regression-September-27-2026/paper.pdf'),
   src('review 140, caveats', "the summary's claim is narrow (noiseless, Gaussian design, uniform prior, finite-state learner)"),
   src('review 140, caveats', 'Matches the natural O(d log 1/eps)-sample low-memory upper bound'),
   src('review 140, explainer', 'With d^2 bits you can store the normal equations and solve regression from d samples')])

# ---------------------------------------------------------------- 141
write('141', 'proof', '$\\exists\\mathbb{R}$ in the counting hierarchy',
  'Existential real sentences in the counting hierarchy',
  'Claim: the existential theory of the reals lies in $\\mathsf C_{26}\\mathsf P$, a fixed level of the counting hierarchy',
  {'dur': 8.4, 'primitive': 'shape', 'scale': 1.0, 'shapes': [
     {'kind': 'ellipse', 'rx': 2.45, 'ry': 1.08, 'tone': 'soft', 'label': '$\\mathsf{PSPACE}$', 'labelAt': [1.85, 0.72], 'at': 0.2, 'fillA': 0.05},
     {'kind': 'ellipse', 'c': [-0.65, 0], 'rx': 1.3, 'ry': 0.86, 'tone': 'cool', 'label': '$\\mathsf{CH}$', 'labelAt': [-1.55, 0.55], 'at': 0.6, 'fillA': 0.08},
     {'kind': 'ellipse', 'c': [0.75, 0], 'rx': 0.9, 'ry': 0.6, 'tone': 'accent', 'label': '$\\exists\\mathbb{R}$', 'labelAt': [0.25, 0.36], 'at': 1.0,
      'morph': {'kind': 'ellipse', 'c': [-0.3, 0], 'rx': 0.85, 'ry': 0.55, 'at': 3.6, 'dur': 1.6}},
     {'kind': 'circle', 'c': [0.15, 0], 'r': 0.24, 'tone': 'ink', 'label': '$\\mathsf{NP}$', 'labelAt': [0.15, 0], 'at': 1.6, 'fillA': 0.1}],
   'beats': [
     {'at': 0.2, 'text': 'Schematically: $\\exists\\mathbb{R}$ was known to sit inside PSPACE (Canny, 1988)'},
     {'at': 2.9, 'text': 'Graph drawing, 3-player Nash and training feasibility are $\\exists\\mathbb{R}$-complete'},
     {'at': 5.6, 'text': 'Claimed: all of it fits inside the counting hierarchy, at level 26'}]},
  {'form': 'status', 'label': 'Is the existential theory of the reals in CH? (open)',
   'statement': ['\\exists\\mathbb{R} \\subseteq \\mathsf{C}_{26}\\mathsf{P} \\subseteq \\mathsf{CH}'],
   'context': 'Before: $\\exists\\mathbb{R} \\subseteq$ PSPACE (Canny, 1988); PosSLP in CH (Allender et al., 2009)',
   'stamp': 'proved',
   'note': 'Structural, not an algorithm'},
  {'lean': 'none', 'detail': 'No Lean statement; manuscript only',
   'ourCheck': CHECK_NONE},
  [src('review 141, claim', 'in particular ETR (and all of exists-R) lies in C_26 P'),
   src('review 141, known_before', 'Canny (STOC 1988) ETR in PSPACE'),
   src('review 141, known_before', 'Allender-Burgisser-Kjeldgaard-Pedersen-Miltersen (2009) PosSLP in CH'),
   src('review 141, known_before', 'Whether exists-R lies in CH (or below PSPACE) was a known open question'),
   src('review 141, explainer', 'graph drawing, Nash with 3 players, neural net training feasibility'),
   src('review 141, caveats', 'Level 26 of the counting hierarchy is a structural result, not an algorithm; unformalized.')])

# ---------------------------------------------------------------- 142
write('142', 'conditional', 'Deterministic factoring over $\\mathbb{F}_p$',
  'Deterministic polynomial factorization over prime fields',
  'Claim: deterministic polynomial-time factoring over $\\mathbb{F}_p$ without GRH, resting on a companion family',
  {'dur': 8.4, 'primitive': 'tree', 'nodes': [
     {'id': 'root', 'label': 'Factor any $f \\in \\mathbb{F}_p[x]$ deterministically'},
     {'id': 'alg', 'label': 'Theorem 1.2: factor, given primes $\\ell$', 'parent': 'root', 'status': 'paper'},
     {'id': 'small', 'label': 'small $\\ell \\equiv 1 \\pmod{12q}$ exist', 'parent': 'root', 'status': 'paper'},
     {'id': 'hecke', 'label': 'Hecke zero-free region, family 029', 'parent': 'small', 'status': 'paper'},
     {'id': 'geo', 'label': 'geometry over curves', 'parent': 'alg', 'status': 'paper'}],
   'beats': [
     {'at': 0.2, 'text': 'Randomized factoring has worked since 1970; the question is doing it without coins'},
     {'at': 2.9, 'text': 'Theorem 1.2 factors deterministically once auxiliary primes $\\ell$ are supplied'},
     {'at': 5.6, 'text': "That such $\\ell$ are small comes from family 029, a separate unformalized claim"}]},
  {'form': 'status', 'label': 'Deterministic polynomial-time factoring over prime fields',
   'statement': ['O\\big(((n+1)\\lceil \\log_2 p \\rceil)^{10^{12}}\\big) \\text{ bit operations}'],
   'context': 'Before: deterministic polynomial time only under GRH, in many cases; randomized since Berlekamp',
   'stamp': 'conditional',
   'note': "Condition: family 029's unformalized Hecke L-function theorem"},
  {'lean': 'none', 'detail': 'No Lean here or in family 029',
   'ourCheck': CHECK_NONE},
  [src('review 142, known_before', 'Berlekamp (1967/1970) deterministic for small p, randomized polynomial (Berlekamp 1970; Cantor-Zassenhaus 1981)'),
   src('review 142, known_before', 'deterministic polynomial time known under GRH for many cases'),
   src('article, Deterministic factoring', 'Theorem 1.2 is purely algebraic: given, for each prime $q \\le n$, an auxiliary prime $\\ell \\equiv 1 \\pmod{12q}$'),
   src('review 142, claim', "proved in the companion 'Primitive roots for every admissible integer base' (family 029, number theory)"),
   src('review 142, claim', 'in O(((n+1) ceil(log2 p))^{10^{12}}) bit operations'),
   src('article, Deterministic factoring', 'using geometry over curves to separate factors'),
   src('review 142, lean', 'none (and the companion family 029, an Artin-primitive-root infinitude result, has no lean/docs page either)')])
print('c done')
