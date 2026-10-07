from gen_tcs_common import *

# ---------------------------------------------------------------- 102
write('102', 'proof', 'The Unique Games Conjecture',
  'The Unique Games Conjecture',
  'Claim: telling 99%-satisfiable from 1%-satisfiable Unique Games apart is NP-hard',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'numberline', 'until': 4.9, 'min': 0.85, 'max': 1.0, 'ticks': [0.85, 0.9, 0.95, 1],
     'axisLabel': 'Max-Cut: the approximation ratio $\\alpha$',
     'markers': [
       {'v': 0.87856, 'label': 'Goemans–Williamson', 'note': 'SDP algorithm', 'tone': 'soft', 'at': 0.5},
       {'v': 0.9411764706, 'label': 'hardness $16/17$', 'note': '2001', 'at': 0.9, 'derived': '16/17'}],
     'slide': {'from': 0.9411764706, 'to': 0.87856, 'at': 2.2, 'dur': 1.4, 'label': 'claimed hardness', 'note': 'beyond $0.878$', 'derived': '16/17 to alpha_GW'}},
    {'primitive': 'numberline', 'from': 4.9, 'min': 1.3, 'max': 2.1, 'ticks': [1.4, 1.6, 1.8, 2],
     'axisLabel': 'Vertex Cover: the approximation factor',
     'markers': [
       {'v': 2, 'label': '2-approximation', 'note': 'the simple algorithm', 'tone': 'soft', 'at': 0.4, 'side': 'below'},
       {'v': 1.41421356, 'label': '2-to-2 Games', 'note': '2018, $\\sqrt2$', 'at': 0.8, 'derived': 'sqrt 2'}],
     'slide': {'from': 1.41421356, 'to': 2, 'at': 1.2, 'dur': 1.3, 'label': 'claimed hardness', 'note': 'any factor below $2$', 'derived': 'sqrt 2 to 2'}}],
   'beats': [
     {'at': 0.2, 'text': 'Max-Cut: the SDP algorithm gets 0.878; proven hardness stopped at 16/17'},
     {'at': 2.7, 'text': 'Claimed: beating 0.878 is NP-hard, so Goemans–Williamson is optimal'},
     {'at': 5.0, 'text': 'Vertex Cover: hardness rises from $\\sqrt2$ to $2$, matching the simple algorithm'}]},
  {'form': 'status', 'label': "Khot's Unique Games Conjecture (2002)",
   'statement': ['\\text{NP-hard: } \\mathrm{val} \\ge 1-\\varepsilon \\ \\text{ or } \\ \\mathrm{val} \\le \\delta'],
   'context': 'Before: hardness only with completeness about $1/2$ (Khot–Minzer–Safra 2-to-2 Games, 2018)',
   'stamp': 'proved',
   'note': "The reduction's polynomial degree grows as $\\varepsilon, \\delta$ shrink"},
  {'lean': 'main', 'detail': 'The UG reduction and the Max-Cut, Vertex Cover, Min-UnCut and DFVS papers; not Section 8',
   'ourCheck': CHECK_LEAN},
  [src('review 102, explainer', 'telling 99%-satisfiable from 1%-satisfiable instances is NP-hard'),
   src('review 102, explainer', 'Goemans-Williamson for Max-Cut at 0.878'),
   src('review 102, claim', 'Max-Cut hardness beyond alpha_GW~0.87856 on unweighted graphs'),
   src('review 102, known_before', 'Unconditional Max-Cut hardness was 16/17 (Hastad 2001 + Trevisan-Sorkin-Sudan-Williamson)'),
   src('review 102, known_before', 'Khot-Minzer-Safra 2-to-2 Games Theorem (FOCS 2018'),
   src('review 102, known_before', 'Vertex Cover hardness sqrt(2)-eps'),
   src('review 102, explainer', 'the 2-approximation for Vertex Cover'),
   src('review 102, known_before', "Posed by Khot (STOC 2002, 'On the power of unique 2-prover 1-round games')"),
   src('review 102, known_before', 'UG hardness with completeness ~1/2'),
   src('review 102, caveats', "the reduction's polynomial degree grows as eps, delta shrink"),
   src('review 102, lean', 'Section 8 consequences that import other authors\' reductions (Raghavendra, CKKRS, GHMRC) are not formalized')])

# ---------------------------------------------------------------- 103
write('103', 'proof', '$\\mathsf L = \\mathsf{RL} = \\mathsf{BPL}$',
  'Exact derandomization of logarithmic space',
  'Claim: $\\mathsf L = \\mathsf{RL} = \\mathsf{BPL}$, coin flips never help log-space machines with bounded error',
  {'dur': 8.4, 'primitive': 'numberline', 'min': 0.8, 'max': 2.2, 'ticks': [1, 1.5, 2],
   'axisLabel': 'deterministic space for $\\mathsf{BPL}$: $O(\\log^{e} n)$',
   'markers': [
     {'v': 2, 'label': 'Nisan', 'note': '$\\log^2 n$, poly time', 'at': 0.5},
     {'v': 1.5, 'label': 'Saks–Zhou', 'note': '1999', 'at': 1.0, 'derived': '3/2'}],
   'slide': {'from': 1.5, 'to': 1, 'at': 3.4, 'dur': 1.5, 'label': 'claimed $\\mathsf L$', 'note': '$O(\\log n)$ space', 'derived': '3/2 to 1'},
   'beats': [
     {'at': 0.2, 'text': 'A machine with $O(\\log n)$ memory that may flip coins: how much space to remove them?'},
     {'at': 2.9, 'text': 'Since Saks–Zhou in 1999 the answer sat at $\\log^{3/2} n$, with Hoza shaving a bit in 2021'},
     {'at': 5.7, 'text': 'The claim: plain $\\log n$ suffices, the space twin of P = BPP'}]},
  {'form': 'status', 'label': 'Aleliunas–Karp–Lipton–Lovász–Rackoff (1979)',
   'statement': ['\\mathsf L = \\mathsf{RL} = \\mathsf{BPL}'],
   'context': 'Before: $\\mathsf{BPL} \\subseteq \\mathrm{DSPACE}(\\log^{3/2} n)$ (Saks–Zhou, 1999)',
   'stamp': 'proved',
   'note': 'Polynomial time, with unspecified and likely astronomically large exponents'},
  {'lean': 'none', 'detail': 'No Lean: the Logspace folder holds 585 lines of machine definitions, no main theorem',
   'ourCheck': 'We did not referee the 108-page proof; nothing is machine-checked'},
  [src('review 103, known_before', 'Question asked by Aleliunas-Karp-Lipton-Lovasz-Rackoff (1979)'),
   src('review 103, known_before', 'Best prior: Saks-Zhou BPL in DSPACE(log^{3/2} n) (JCSS 1999); Hoza (RANDOM 2021) shaved a sub-logarithmic factor'),
   src('article, L = BPL', 'Nisan\'s generator gives polynomial time with $O(\\log^2 n)$ space'),
   src('review 103, explainer', 'the space analogue of P=BPP'),
   src('review 103, caveats', 'The polynomial time bound has unspecified (likely astronomically large) exponents.'),
   src('review 103, lean', 'machine definitions and basic run lemmas, 585 lines, no main theorem'),
   src('review 103, caveats', 'Single 108-page manuscript with no formalization')])

# ---------------------------------------------------------------- 104
write('104', 'improved-bound', 'Mean-payoff games in quasipolynomial time',
  'Quasipolynomial algorithms for mean-payoff games',
  'Claim: mean-payoff, stochastic and parity games solved deterministically in $2^{O((\\log L)^2)}$ bit operations',
  {'dur': 8.4, 'primitive': 'plot', 'x': [1, 30], 'y': [0, 900],
   'xlabel': '$\\log_2$ of the input size', 'ylabel': '$\\log_2$ of the running time, schematic',
   'curves': [
     {'f': 'sqrt(pow(2, x) * x)', 'to': 15.6, 'label': 'before: $2^{\\sqrt{n \\log n}}$', 'tone': 'old', 'at': 0.6, 'dur': 1.6},
     {'f': 'x * x', 'label': 'claimed: $2^{(\\log L)^2}$', 'tone': 'claim', 'at': 2.8, 'dur': 1.8},
     {'f': '3 * x', 'label': 'polynomial: open', 'tone': 'faint', 'dash': True, 'at': 5.2, 'dur': 1.2}],
   'beats': [
     {'at': 0.2, 'text': 'Two players push a token round a weighted graph and fight over the long-run average'},
     {'at': 2.8, 'text': 'Schematically: binary weights had only subexponential randomized algorithms'},
     {'at': 5.4, 'text': 'Claimed: quasipolynomial, where parity games landed in 2017. P is still open'}]},
  {'form': 'bound',
   'before': {'label': 'Best known, binary weights', 'tex': '2^{O(\\sqrt{n \\log n})}', 'note': 'randomized strategy improvement (Björklund–Vorobyov)'},
   'after': {'label': 'Claimed, Sep 2026', 'tex': '2^{O((\\log(L+2))^2)}', 'note': 'deterministic; $L$ is the full binary input length'},
   'note': 'Quasipolynomial, not polynomial: whether these games are in P stays open'},
  {'lean': 'part', 'detail': 'In Lean: the randomized algorithm (success $7/8$) and a counterexample; not the deterministic one',
   'ourCheck': CHECK_LEAN},
  [src('review 104, known_before', 'best binary-weight bounds were subexponential randomized strategy improvement 2^{O(sqrt(n log n))} (Bjorklund-Vorobyov)'),
   src('review 104, known_before', 'Parity games: quasipolynomial (Calude-Jain-Khoussainov-Li-Stephan, STOC 2017)'),
   src('review 104, claim', 'Deterministic 2^{O((log(L+2))^2)}-bit-operation algorithms (L = full binary input length)'),
   src('article, Mean-payoff games', 'Deterministic-quasipolynomial-time-mean-payoff-games-September-25-2026/paper.pdf'),
   src('review 104, caveats', 'Quasipolynomial, not polynomial; P membership remains open.'),
   src('review 104, lean', 'partial formalization: RandomizedMeanPayoff.lean (randomized quasipolynomial algorithm, success 7/8) and TruffetCounterexample.lean; the deterministic, stochastic and parity-extension papers are not formalized')])

# ---------------------------------------------------------------- 105
L5 = [('l%d' % i, 0.28, 0.08 + 0.168 * (i - 1), str(i)) for i in range(1, 7)]
R5 = [('r%d' % i, 0.72, 0.08 + 0.168 * (2 * i - 1.5), str(i)) for i in range(1, 4)]
write('105', 'proof', 'Perfect completeness for 2-to-1 games',
  'Perfect completeness for 2-to-1 games',
  "Claim: Khot's 2-to-1 Games Conjecture holds with perfect completeness, for every fixed soundness $\\delta$",
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'graph', 'until': 4.6, 'r': 16,
     'nodes': [{'id': a, 'x': x, 'y': y, 'label': l, 'tone': 'soft'} for a, x, y, l in L5] + [{'id': a, 'x': x, 'y': y, 'label': l, 'tone': 'accent'} for a, x, y, l in R5],
     'edges': [['l1', 'r1', {'tone': 'accent'}], ['l2', 'r1', {'tone': 'accent'}], ['l3', 'r2', {'tone': 'accent'}], ['l4', 'r2', {'tone': 'accent'}], ['l5', 'r3', {'tone': 'accent'}], ['l6', 'r3', {'tone': 'accent'}]],
     'edgeAt': 0.6, 'edgeDur': 2.4},
    {'primitive': 'numberline', 'from': 4.6, 'min': 0, 'max': 1.05, 'ticks': [0, 0.25, 0.5, 0.75, 1],
     'axisLabel': 'soundness $\\delta$, with completeness exactly $1$',
     'markers': [{'v': 0.9583333, 'label': 'Austrin et al.', 'note': '$23/24 + \\varepsilon$', 'at': 0.4, 'derived': '23/24'}],
     'slide': {'from': 0.9583333, 'to': 0, 'at': 1.0, 'dur': 1.6, 'label': 'claimed', 'note': 'any fixed $\\delta > 0$', 'derived': '23/24 to any delta'}}],
   'beats': [
     {'at': 0.2, 'text': 'One constraint with $q = 3$: left labels map to right labels, exactly two to one'},
     {'at': 4.7, 'text': 'With every constraint satisfiable, soundness was stuck at $23/24$'},
     {'at': 7.2, 'text': 'Claimed: any $\\delta$, the form colouring reductions need'}]},
  {'form': 'status', 'label': "Khot's 2-to-1 Games Conjecture (2002), perfect completeness",
   'statement': ['\\text{NP-hard: } \\mathrm{val} = 1 \\ \\text{ or } \\ \\mathrm{val} \\le \\delta'],
   'context': 'Before: soundness $23/24 + \\varepsilon$; the 4-to-1 version by Fei–Minzer–Wang on 14 Sep 2026',
   'stamp': 'proved',
   'note': 'Extends a human 4-to-1 result posted nine days earlier'},
  {'lean': 'main', 'detail': 'PerfectCompleteness.lean, about 137k lines, standard axioms only',
   'ourCheck': CHECK_LEAN},
  [src('review 105, known_before', "Khot's 2-to-1 Games Conjecture (STOC 2002)"),
   src('review 105, known_before', 'Austrin-O\'Donnell-Tan-Wright got perfect-completeness 2-to-1 Label Cover with soundness 23/24+eps'),
   src('review 105, known_before', 'Fei-Minzer-Wang proved the 4-to-1 conjecture with perfect completeness on 14 Sep 2026 (ECCC TR26-179), nine days before this manuscript'),
   src('review 105, lean', 'PerfectCompleteness.lean (OAI.PerfectCompleteness.Theorem11.exists_reduction), ~137k lines, standard axioms only'),
   src('review 105, claim', 'every right label has exactly two preimages under every constraint')])

# ---------------------------------------------------------------- 106
ph = [0.02, 0.13, 0.25, 0.37, 0.47, 0.58, 0.70, 0.81, 0.92]
tones = lambda p: 'accent' if p < 1/3 else ('ok' if p < 2/3 else 'warn')
nodes6 = [{'id': 'v%d' % i, 'x': round(0.5 + 0.2 * math.sin(2 * math.pi * p), 4), 'y': round(0.5 - 0.44 * math.cos(2 * math.pi * p), 4), 'fill': tones(p), 'tone': tones(p)} for i, p in enumerate(ph)]
cd = lambda a, b: min(abs(a - b), 1 - abs(a - b))
edges6 = [['v%d' % i, 'v%d' % j] for i, j in itertools.combinations(range(9), 2) if cd(ph[i], ph[j]) >= 0.42]
for i, j in itertools.combinations(range(9), 2):
    if cd(ph[i], ph[j]) >= 0.42: assert tones(ph[i]) != tones(ph[j])
write('106', 'proof', 'Colouring three-colourable graphs',
  'Hardness of colouring three-colourable graphs',
  'Claim: NP-hard to tell 3-colourable graphs from graphs with no independent set of $\\delta n$ vertices',
  {'dur': 8.4, 'primitive': 'graph', 'nodes': nodes6, 'edges': edges6, 'edgeAt': 1.0, 'edgeDur': 3.4, 'r': 15,
   'beats': [
     {'at': 0.2, 'text': 'Honest case: every vertex gets a phase on a circle; edges join phases at least $3/8$ apart'},
     {'at': 2.9, 'text': 'Colour by which third of the circle a phase lands in: no edge stays inside a third'},
     {'at': 5.6, 'text': 'Unsatisfiable formulas instead give graphs with no independent set of $\\delta n$ vertices'}]},
  {'form': 'status', 'label': 'Hardness for colouring with a 3-colourable promise',
   'statement': ['\\chi(G) = 3 \\quad \\text{or} \\quad \\alpha(G) < \\delta n'],
   'context': 'Fei–Minzer–Wang proved any-constant colouring on 14 Sep 2026; new here: full 3-colourability',
   'stamp': 'proved',
   'note': "The summary's headline corollary was first proved by Fei–Minzer–Wang"},
  {'lean': 'main', 'detail': 'IndependentSets.lean, about 94k lines, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('article, 2-to-1 games and colouring', 'Edges join a point to the half-shift of another, so in the honest case adjacent vertices sit at circle distance at least $3/8$, more than the $1/3$ length of an arc'),
   src('review 106, known_before', 'Fei-Minzer-Wang (ECCC TR26-179, 14 Sep 2026) proved 4-to-1 with perfect completeness and derived NP-hardness of c-coloring 3-colorable graphs for every constant c'),
   src('review 106, caveats', 'What is new is three-colorability of the whole graph combined with arbitrarily small independence ratio'),
   src('review 106, lean', 'IndependentSets.lean (OAI.LargeIndependentSets.mainTheoremReal), ~94k lines in OAI/Combinatorics/IndependentSets, standard axioms')])

# ---------------------------------------------------------------- 108
write('108', 'improved-bound', 'A cubic permanent–determinant bound',
  'A cubic permanent–determinant lower bound',
  'Claim: writing the $m \\times m$ permanent as a determinant, even in the limit, needs size $\\Omega(m^3)$',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'equation', 'until': 3.9, 'lines': [
      {'tex': '\\det X = \\textstyle\\sum_{\\sigma} \\term{s}{\\mathrm{sgn}(\\sigma)} \\prod_i x_{i,\\sigma(i)}', 'note': 'polynomial time', 'at': 0.3,
       'terms': {'s': {'label': 'signs $\\pm 1$', 'tone': 'warn', 'at': 0.6, 'mark': 'box', 'side': 'above'}}},
      {'tex': '\\mathrm{perm}\\, X = \\textstyle\\sum_{\\sigma} \\prod_i x_{i,\\sigma(i)}', 'note': '#P-hard', 'tone': 'accent', 'at': 1.2}]},
    {'primitive': 'numberline', 'from': 3.9, 'min': 1.5, 'max': 3.6, 'ticks': [2, 3],
     'axisLabel': 'exponent $e$ in the lower bound $\\overline{\\mathrm{dc}}(\\mathrm{perm}_m) \\ge c\\, m^{e}$',
     'markers': [{'v': 2, 'label': 'Mignon–Ressayre', 'note': '2004, $m^2/2$', 'at': 0.4}],
     'slide': {'from': 2, 'to': 3, 'at': 1.2, 'dur': 1.5, 'label': 'claimed', 'note': '$m^3/(5529600e)$'}}],
   'beats': [
     {'at': 0.2, 'text': 'The permanent is the determinant with every sign set to plus'},
     {'at': 4.0, 'text': 'How big must a determinant be to equal it? Quadratic was the best lower bound since 2004'},
     {'at': 6.6, 'text': 'Claimed: cubic. VP versus VNP needs superpolynomial'}]},
  {'form': 'bound',
   'before': {'label': 'Best known since 2004', 'tex': '\\overline{\\mathrm{dc}}(\\mathrm{perm}_m) \\ge m^2/2', 'note': 'Mignon–Ressayre; border version Landsberg–Manivel–Ressayre 2013'},
   'after': {'label': 'Claimed, 24 Sep 2026', 'tex': '\\overline{\\mathrm{dc}} \\ge m^3/(5529600\\,e)', 'note': 'for $m \\ge 1408$, over $\\mathbb{C}$'},
   'note': 'Beats $m^2/2$ only once $m$ is in the millions'},
  {'lean': 'main', 'detail': 'Border and exact bounds, about 21k lines; the branching-program corollary is not formalized',
   'ourCheck': CHECK_LEAN},
  [src('review 108, known_before', 'Mignon-Ressayre (IMRN 2004) dc(perm_m) >= m^2/2'),
   src('review 108, known_before', 'Landsberg-Manivel-Ressayre (2013) border bound m^2/2'),
   src('review 108, claim', 'The border determinantal complexity of the m x m permanent over C is at least m^3/(5529600e) for m>=1408'),
   src('catalogue, family 108 manuscript path', 'A-cubic-lower-bound-for-border-determinantal-complexity-of-the-permanent-September-24-2026'),
   src('article, A cubic lower bound for the permanent', 'beats $m^2/2$ only once $m$ is in the millions'),
   src('review 108, lean', 'proved in OAI/Algebra/Determinantal/Main.lean:384 (~21k lines)'),
   src('review 108, lean', 'ABP consequences not formalized')])

# ---------------------------------------------------------------- 109
write('109', 'disproof', 'Integer multiplication below $n \\log n$',
  'Integer multiplication below $n \\log n$',
  'Claim: one multitape Turing machine multiplies $n$-bit integers in $O(n(\\log n)^{1-\\kappa})$, $\\kappa = 2^{-182}$',
  {'dur': 8.6, 'primitive': 'equation', 'mode': 'replace', 'lines': [
     {'tex': 'O(n \\log n \\log\\log n)', 'note': 'Schönhage–Strassen, 1971', 'tone': 'soft', 'at': 0.3},
     {'tex': 'n \\log n \\cdot 2^{O(\\log^* n)}', 'note': 'Fürer, 2007', 'tone': 'soft', 'at': 2.3},
     {'tex': 'O(n \\term{l}{\\log n})', 'note': 'Harvey–van der Hoeven, 2021', 'tone': 'ink', 'at': 4.0, 'y': 0.3,
      'terms': {'l': {'label': 'one pass per level', 'tone': 'cool', 'at': 0.5,
        'visual': {'kind': 'curve', 'f': 'Math.log(x)', 'x': [1, 60], 'y': [0, 4.2], 'w': 170, 'h': 70}}}},
     {'tex': 'O\\big(n\\, \\term{l}{(\\log n)^{1-\\kappa}}\\big),\\ \\term{k}{\\kappa = 2^{-182}}', 'note': 'claimed, 23 Sep 2026', 'tone': 'accent', 'at': 5.9, 'y': 0.3,
      'terms': {'l': {'label': 'a hair below $\\log n$', 'at': 0.4},
                'k': {'label': 'the saving: tiny', 'tone': 'hot', 'mark': 'box', 'at': 0.9}}}],
   'beats': [
     {'at': 0.2, 'text': 'In 1971 Schönhage and Strassen conjectured that $n \\log n$ is optimal'},
     {'at': 3.0, 'text': 'Harvey and van der Hoeven reached $O(n \\log n)$ exactly, thought to be the end'},
     {'at': 5.9, 'text': 'The claimed saving, $(\\log n)^{2^{-182}}$, is indistinguishable from 1 at any real size'}]},
  {'form': 'bound',
   'before': {'label': 'Best known since 2021', 'tex': 'O(n \\log n)', 'note': 'Harvey–van der Hoeven, Annals of Mathematics'},
   'after': {'label': 'Claimed, 23 Sep 2026', 'tex': 'O\\big(n(\\log n)^{1-\\kappa}\\big)', 'note': '$\\kappa = 2^{-182}$, multitape Turing machine'},
   'note': 'Refutes the $n \\log n$ conjecture in its own model. GMP is safe'},
  {'lean': 'none', 'detail': 'No Lean statement; the DFT family 130 reuses its phase network',
   'ourCheck': 'We did not referee the 73-page proof; nothing is machine-checked'},
  [src('review 109, known_before', 'Schonhage-Strassen (1971) O(n log n log log n) and their conjecture that n log n is optimal'),
   src('review 109, known_before', 'Furer (2007/2009) n log n 2^{O(log* n)}'),
   src('review 109, known_before', 'Harvey-van der Hoeven (Annals of Math 2021) O(n log n)'),
   src('review 109, claim', 'multiplies two n-bit integers exactly in O(n (lg n)^{1-kappa}) worst-case time with kappa = 2^{-182}'),
   src('catalogue, family 109 manuscript path', 'Integer-multiplication-below-n-log-n-September-23-2026/paper.pdf'),
   src('article, Integer multiplication below n log n', '$(\\lg n)^{2^{-182}}$ is indistinguishable from 1 for any number that fits in the universe. GMP is safe.'),
   src('review 109, caveats', 'the DFT family 130 reuses its phase network'),
   src('article, Integer multiplication below n log n', '(family 109, 73 pages)')])

# ---------------------------------------------------------------- 110
write('110', 'proof', 'Randomized $k$-server at $O(\\log^2 k)$',
  'Optimal-order randomized $k$-server on every metric',
  'Claim: a randomized online policy is $O(\\log^2(k+1))$-competitive on every metric space, finite or not',
  {'dur': 8.4, 'primitive': 'plot', 'x': [1, 100], 'y': [0, 10],
   'xlabel': 'number of points $n$ in the metric', 'ylabel': 'competitive ratio at fixed $k$, schematic',
   'curves': [
     {'f': '2.6 + 1.25 * log(x)', 'label': 'before: $\\log^2 k \\cdot \\log n$', 'tone': 'old', 'at': 0.6, 'dur': 1.6},
     {'f': '3.4', 'label': 'claimed: $\\log^2(k+1)$', 'tone': 'claim', 'at': 3.2, 'dur': 1.4},
     {'f': '2.2', 'label': 'needed on some metrics', 'tone': 'faint', 'dash': True, 'at': 5.0, 'dur': 1.0}],
   'beats': [
     {'at': 0.2, 'text': '$k$ servers, requests arriving online: pay for every move, compare with hindsight'},
     {'at': 3.0, 'text': 'Schematically: the old bound also grew with the number of points $n$'},
     {'at': 5.6, 'text': 'Claimed: no dependence on $n$, matching the $\\Omega(\\log^2 k)$ lower bound of 2023'}]},
  {'form': 'status', 'label': 'Randomized k-server after the 2023 lower bound',
   'statement': ['\\mathbb{E}[\\mathrm{cost}] \\le C \\log^2(k+1)\\, \\mathrm{OPT} + B'],
   'context': 'Before: $O(\\log^2 k \\log n)$ on $n$-point metrics; $\\Omega(\\log^2 k)$ needed on some (Bubeck–Coester–Rabani)',
   'stamp': 'proved',
   'note': "Existence only; the efficient version's additive constant 'may be enormous'"},
  {'lean': 'main', 'detail': 'KServer.lean and UniformKServer.lean, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 110, known_before', 'refuted by Bubeck-Coester-Rabani (STOC 2023, arXiv 2211.05753) with an Omega(log^2 k) lower bound'),
   src('review 110, known_before', 'Bubeck-Cohen-Lee-Lee-Madry O(log^2 k) on HSTs, giving O(log^2 k log n) on n-point metrics'),
   src('review 110, claim', "a single randomized online policy has expected cost <= C (log(k+1))^2 OPT + B against oblivious adversaries"),
   src('review 110, caveats', "an additive constant that 'may be enormous'"),
   src('review 110, lean', 'main theorem formalized: KServer.lean and UniformKServer.lean, standard axioms')])

# ---------------------------------------------------------------- 111
N11 = {'a': (0.2, 0.25), 'b': (0.42, 0.12), 'c': (0.66, 0.2), 'd': (0.84, 0.45), 'e': (0.6, 0.62), 'f': (0.32, 0.7), 'g': (0.5, 0.95)}
E11 = [('a', 'b', 'accent'), ('b', 'c', 'faint'), ('a', 'f', 'accent'), ('c', 'd', 'accent'), ('b', 'f', 'faint'), ('c', 'e', 'accent'), ('d', 'e', 'faint'), ('e', 'f', 'faint'), ('f', 'g', 'accent'), ('e', 'g', 'faint')]
# accepted edges must form a forest
par = {k: k for k in N11}
def find(x):
    while par[x] != x: x = par[x]
    return x
for a, b, t in E11:
    if t == 'accent':
        ra, rb = find(a), find(b); assert ra != rb; par[ra] = rb
write('111', 'proof', 'One-sample matroid prophet inequalities',
  'One-sample matroid prophet inequalities',
  'Claim: one past sample per element earns a constant fraction of the optimum on every matroid',
  {'dur': 8.4, 'primitive': 'graph', 'r': 14,
   'nodes': [{'id': k, 'x': x, 'y': y} for k, (x, y) in N11.items()],
   'edges': [[a, b, {'tone': t, 'w': 3 if t == 'accent' else 1.8}] for a, b, t in E11],
   'edgeAt': 0.6, 'edgeDur': 5.0,
   'beats': [
     {'at': 0.2, 'text': 'A small instance: edges arrive one at a time; keep any set with no cycle'},
     {'at': 2.9, 'text': 'The rule has seen one past sample per edge, and must accept or reject on the spot'},
     {'at': 5.8, 'text': "Claimed: a constant share of the prophet's optimum, even against an almighty adversary"}]},
  {'form': 'status', 'label': 'Does one sample per element give a constant on every matroid?',
   'statement': ['\\mathbb{E}[\\text{reward}] \\ge 2^{-310}\\, \\mathbb{E}[\\mathrm{OPT}]'],
   'context': 'Before: $1/2$ with known distributions (Kleinberg–Weinberg, 2012); one sample lost $O(\\log\\log \\text{rank})$',
   'stamp': 'proved',
   'note': 'The constant $2^{-310}$ is existential; no efficient implementation is claimed'},
  {'lean': 'main', 'detail': 'MatroidProphet.lean and MatroidSecretary.lean, standard axioms',
   'ourCheck': CHECK_LEAN},
  [src('review 111, claim', 'achieves expected reward >= 2^{-310} E[OPT] on every finite matroid'),
   src('review 111, known_before', 'Kleinberg-Weinberg (2012) 1/2 for matroids with known distributions'),
   src('review 111, known_before', 'order-oblivious matroid secretary with O(log log rank) loss giving one-sample guarantees with that loss'),
   src('review 111, caveats', 'Constant 2^{-310} is purely existential; no polynomial-time or oracle-efficient implementation is asserted.'),
   src('review 111, lean', 'main theorem formalized: MatroidProphet.lean and MatroidSecretary.lean, standard axioms')])

# ---------------------------------------------------------------- 112
NC = [('o', 0.5, 0.06, '$\\vee$')] + [('a%d' % i, x, 0.36, '$\\wedge$') for i, x in enumerate([0.25, 0.5, 0.75])] + \
     [('b%d' % i, x, 0.64, '$\\vee$') for i, x in enumerate([0.2, 0.4, 0.6, 0.8])] + \
     [('x%d' % i, x, 0.93, '$x_%d$' % (i + 1)) for i, x in enumerate([0.15, 0.325, 0.5, 0.675, 0.85])]
EC = [('o', 'a0'), ('o', 'a1'), ('o', 'a2'), ('a0', 'b0'), ('a0', 'b1'), ('a1', 'b1'), ('a1', 'b2'), ('a2', 'b2'), ('a2', 'b3'),
      ('b0', 'x0'), ('b0', 'x1'), ('b1', 'x1'), ('b1', 'x2'), ('b2', 'x2'), ('b2', 'x3'), ('b3', 'x3'), ('b3', 'x4')]
write('112', 'improved-bound', 'Depth-three circuits beyond $2^{c\\sqrt n}$',
  'Beyond the square-root exponent for depth-three circuits',
  'Claim: a polynomial-time language whose $n$-bit slice needs $2^{\\omega(\\sqrt n)}$ gates in OR–AND–OR circuits',
  {'dur': 8.6, 'layout': 'sequence', 'panels': [
    {'primitive': 'graph', 'until': 3.9, 'r': 17,
     'nodes': [{'id': a, 'x': x, 'y': y, 'label': l, 'tone': 'accent' if a[0] != 'x' else 'soft'} for a, x, y, l in NC],
     'edges': [[a, b] for a, b in EC], 'edgeAt': 0.4, 'edgeDur': 2.2},
    {'primitive': 'numberline', 'from': 3.9, 'min': 0, 'max': 4, 'ticks': [0, 1, 2, 3, 4],
     'axisLabel': 'the constant $A$ in a size bound $2^{A\\sqrt n}$',
     'markers': [
       {'v': 1, 'label': 'parity', 'note': 'Paturi–Pudlák–Zane', 'at': 0.4},
       {'v': 1.2825498, 'label': 'best explicit', 'note': '$\\pi/\\sqrt6$', 'at': 0.8, 'derived': 'pi/sqrt 6'}],
     'slide': {'from': 1.2825498, 'to': 4, 'at': 1.5, 'dur': 1.5, 'label': 'claimed: every $A$', 'note': '$2^{\\omega(\\sqrt n)}$', 'derived': 'pi/sqrt 6 to unbounded'}}],
   'beats': [
     {'at': 0.2, 'text': 'A depth-three circuit: an OR of ANDs of ORs of the input bits, unbounded fan-in'},
     {'at': 4.0, 'text': 'Since Håstad, explicit lower bounds were $2^{A\\sqrt n}$, only the constant $A$ improving'},
     {'at': 6.6, 'text': 'Claimed: for every constant $A$. Not yet $2^{n^{1/2+\\varepsilon}}$'}]},
  {'form': 'bound',
   'before': {'label': 'Best explicit, before', 'tex': '2^{(\\pi/\\sqrt6)\\sqrt n}', 'note': 'Paturi–Pudlák–Saks–Zane, code membership'},
   'after': {'label': 'Claimed, 23 Sep 2026', 'tex': '2^{\\omega(\\sqrt n)}', 'note': 'one language in P, every large $n$'},
   'note': 'Not $2^{n^{1/2+\\varepsilon}}$, the bound people actually want'},
  {'lean': 'main', 'detail': 'DepthThree.lean, standard axioms; a 20-page paper',
   'ourCheck': CHECK_LEAN},
  [src('review 112, known_before', 'Paturi-Pudlak-Zane (1997) tight Omega(n^{1/4}2^{sqrt n}) for parity'),
   src('review 112, known_before', 'Paturi-Pudlak-Saks-Zane code-membership bound with leading exponent (pi/sqrt 6) sqrt n'),
   src('review 112, claim', 'requires more than 2^{A sqrt(n)} gates in unbounded fan-in OR-AND-OR circuits, for every constant A'),
   src('catalogue, family 112 manuscript path', 'Beyond-the-Square-Root-Exponent-for-Depth-Three-Boolean-Circuits-September-23-2026/main.pdf'),
   src('article, Depth-3 circuits', 'It does not reach $2^{n^{1/2+\\varepsilon}}$, the bound people actually want.'),
   src('review 112, caveats', '20 pages and Lean-checked'),
   src('review 112, lean', 'main theorem formalized: DepthThree.lean (exists_polynomial_time_language_depth_three_lower_bound), standard axioms')])
print('a done')
