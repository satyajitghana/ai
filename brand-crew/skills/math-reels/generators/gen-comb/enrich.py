# Enrichment pass for the combinatorics reels: plain line, proof idea,
# narration, and (for equation-only reels) the equation visualiser.
# lib.write() merges ENRICH[id] into the spec the batch script builds, so the
# batch scripts stay the single source of the object/achievement/verify/sources.
#
# Every proof idea is taken from the family's review `explainer` (reviews/
# combinatorics.jsonl); where it cannot be said honestly in plain steps, the
# family has no `proof` (175).

V_MAIN = 'Main theorem in Lean.'
V_PART = 'Lean covers only part.'
V_NONE = 'Manuscript only, no Lean.'


def P(arch, steps, **data):
    return {'archetype': arch, 'steps': steps, 'data': data}


def voice(title, obj, proof, ach, ver):
    out = [('title', title)] + [('object', o) for o in ((obj,) if isinstance(obj, str) else obj)]
    if proof:
        out.append(('proof', proof))
    out += [('achievement', ach), ('verify', ver)]
    return out


ENRICH = {
    # ------------------------------------------------------------------ 155
    '155': dict(
        plain='Bathroom tiles repeat; this one tile fills 3D space, yet no tiling with it ever repeats',
        proof=P('reduction', [
            'Design a Sudoku-like puzzle that has solutions, none of them periodic',
            'Rewrite its rules as equations about tiles',
            'Merge them into a single tile in three dimensions'],
            boxes=['a puzzle that never repeats', 'tiling equations', 'one tile in $\\mathbb Z^3$'], arrow='becomes'),
        voice=voice('A tile that never repeats.',
                    'In two dimensions, every tile can repeat. Greenfeld and Tao broke this in huge dimension.',
                    'A puzzle with no repeating solution is turned into one three dimensional tile.',
                    'Claimed: it already fails in three dimensions.', V_MAIN)),
    # ------------------------------------------------------------------ 156
    '156': dict(
        plain='Can every shape be cut into a few pieces, each narrower than the whole? This 9D one needs more than 10',
        proof=P('reduction', [
            'Suppose 10 narrower pieces were enough',
            'Then perpendicular lines would always get different labels',
            'A parity count forces those labels into one rigid pattern',
            'A finite, Lean-checked search finds no such pattern'],
            boxes=['10 narrower pieces', 'a labelling of lines', 'a rigid pattern', 'none exists']),
        voice=voice("Borsuk fails in dimension nine.",
                    'The lowest known failure was dimension sixty three. Now: lines through the origin of four-space.',
                    'Ten smaller pieces would force a labelling pattern, and a checked search finds none.',
                    'Claimed: Borsuk fails from dimension nine.', V_MAIN)),
    # ------------------------------------------------------------------ 157
    '157': dict(
        plain="A 1943 guess: any network needing many colours hides a big tangle of linked clusters. These don't",
        proof=P('probabilistic', [
            'No three vertices are all apart, so colouring needs $m/2$ colours',
            'Choose the missing edges at random, by an algebraic rule',
            'Then no big connected matching exists, so clique minors stay small'],
            samples=70, threshold=0.62, mean=0.74, thresholdLabel='a large clique minor', label='random picks avoid it'),
        voice=voice("Hadwiger's conjecture, disproved on paper.",
                    'These graphs need many colours, yet contain no tangle as large as Hadwiger promised.',
                    'Random edges, chosen by an algebraic rule, keep every such tangle small.',
                    'Claimed: the conjecture fails, even fractionally.', V_PART)),
    # ------------------------------------------------------------------ 158
    '158': dict(
        plain='Colour every point of a flat sheet so points exactly 1 apart always differ: five colours are not enough',
        proof=P('reduction', [
            'Average any five-colouring into a well-behaved, measurable one',
            'Near a point, colours meet two at a time along borders',
            'Around a point they form a ring of three, four or five colours',
            'Each ring fails, the last by fitting in a Moser spindle'],
            boxes=['any 5-colouring', 'a measurable one', 'a ring of colours', 'no ring works']),
        voice=voice('The plane needs six colours.',
                    'Points one apart must differ. Since twenty eighteen the answer was five, six or seven.',
                    'The proof smooths any five-colouring, then shows every smooth one must break.',
                    'Claimed: five colours never suffice.', V_MAIN)),
    # ------------------------------------------------------------------ 159
    '159': dict(
        plain='Take whole numbers, not too sparse (like the primes): you always find evenly spaced runs, as long as you like',
        proof=P('induction', [
            'Suppose a dense set has no long progression',
            'Then it is denser on some structured piece: zoom in there',
            'Repeat; density cannot grow forever, so a progression appears',
            'Adding up over scales gives the reciprocal-sum statement'],
            levels=5, base='dense set', labels=['dense set', 'denser', 'denser', 'denser', '$\\cdots$'],
            step='no progression? a denser piece'),
        voice=voice("Erdős's progressions problem.",
                    "If reciprocals sum to infinity, must a set hold evenly spaced runs of every length?",
                    'No run means a denser piece. Zoom in and repeat until one must appear.',
                    'Claimed: yes, for every length.', V_PART)),
    # ------------------------------------------------------------------ 160
    '160': dict(
        plain='Colour numbers red or blue, avoiding evenly spaced one-colour runs: you can go far further than believed',
        proof=P('construction', [
            'Wrap the numbers around a torus with many dimensions',
            'Colour by coarse cells, so most progressions see both colours',
            'Flip colours at random in bands to break the rest'],
            pieces=[{'label': 'wrap onto a torus', 'role': 'many coordinates'},
                    {'label': 'colour by cells', 'role': 'most runs balance'},
                    {'label': 'random flips', 'role': 'break the rest', 'tone': 'accent'}],
            result='no one-colour progression'),
        voice=voice('Van der Waerden numbers explode.',
                    'With two colours, how long can a row go before an evenly spaced run matches?',
                    'Wrap the numbers around a torus, colour by cells, then flip colours at random.',
                    'Claimed: faster than any exponential.', V_MAIN)),
    # ------------------------------------------------------------------ 161
    '161': dict(
        plain='Sidorenko: for two-sided patterns, a random network has the fewest copies. A 66-edge pattern says otherwise',
        proof=P('construction', [
            'Pick a pattern where every covered pair of points lies in two triples',
            'Build a host from matrices over a finite field: copies dip',
            'Sample a finite graph that keeps the dip'],
            pieces=[{'label': 'a 35-vertex pattern', 'role': 'pairs in two triples'},
                    {'label': 'a finite-field host', 'role': 'a negative correction'},
                    {'label': 'sample a graph', 'role': 'keeps the deficit', 'tone': 'accent'}],
            result='fewer copies than random'),
        object={
            'lines': [
                {'tex': '\\term{t}{t(H,G)} \\ge \\term{p}{p(G)^{e(H)}}', 'at': 0.3, 'size': 40, 'y': 0.06,
                 'note': 'conjectured, every bipartite $H$',
                 'terms': {'t': {'label': 'copies of $H$ in $G$', 'tone': 'cool', 'at': 0.6},
                           'p': {'label': 'copies if $G$ were random', 'tone': 'soft', 'at': 1.1}}},
                {'tex': 't(H,G) < p(G)^{66}', 'at': 2.4, 'size': 44, 'y': 0.46, 'tone': 'claim',
                 'note': 'claimed, for some host $G$',
                 'relation': {'kind': 'lt', 'at': 0.6,
                              'left': {'from': 1.0, 'v': 0.62, 'label': '$t(H,G)$'},
                              'right': {'v': 0.82, 'label': '$p^{66}$'}}}],
            'beats': [
                {'at': 0.2, 'text': 'Sidorenko: at edge density $p$, random graphs minimise copies of every bipartite $H$'},
                {'at': 2.5, 'text': 'The claim: this 66-edge pattern is rarer in some host than in a random graph'}]},
        voice=voice("Sidorenko's conjecture, disproved.",
                    'Sidorenko said random graphs hold the fewest copies of any two-sided pattern.',
                    'A finite-field construction makes this pattern rarer, and a sampled graph keeps it rare.',
                    'Claimed: a host with fewer copies than random.', V_MAIN)),
    # ------------------------------------------------------------------ 162
    '162': dict(
        plain='Every two teams share a member: how many people must you pick to touch every team? More than Ryser bet',
        proof=P('construction', [
            'Start from a finite plane, one part per direction of lines',
            'Randomly split and merge a few lines; edges still meet',
            'A stability theorem rules out any cover of size $q$'],
            pieces=[{'label': 'affine plane', 'role': 'one part per direction'},
                    {'label': 'split a few lines', 'role': 'at random'},
                    {'label': 'stability theorem', 'role': 'no cover of size $q$', 'tone': 'accent'}],
            result='covering number $q+1$'),
        voice=voice("Ryser's conjecture fails.",
                    'When every two edges meet, Ryser bet one fewer than the parts would cover them.',
                    'Split a few lines of a finite plane at random; no small cover survives.',
                    'Claimed: counterexamples for every large prime.', V_MAIN)),
    # ------------------------------------------------------------------ 164
    '164': dict(
        plain='Paint every whole number one of a few colours: some sets have all their sums and products in one colour',
        proof=P('construction', [
            'Build numbers from far-apart blocks, so products share a colour',
            'Model each colour class so its pattern can be predicted',
            'Tune the scales so all the sums land in that colour too'],
            pieces=[{'label': 'far-apart blocks', 'role': 'products, one colour'},
                    {'label': 'predict each colour', 'role': 'a structured model'},
                    {'label': 'align the scales', 'role': 'sums keep the colour', 'tone': 'accent'}],
            result='sums and products, one colour'),
        voice=voice('Sums and products, one colour.',
                    "Colour the whole numbers. Can a set's sums and its products all share one colour?",
                    'Products are tamed first; then a model of each colour steers the sums in.',
                    'Claimed: yes, for sets of every finite size.', V_NONE)),
    # ------------------------------------------------------------------ 166
    '166': dict(
        plain='Scatter points in space: how few different distances can they make? A neat grid is essentially the best',
        proof=P('reduction', [
            'Each pair of equal distances becomes a rigid motion',
            'Those motions become flats crossing in a bigger space',
            "Polynomial counting shows the crossings can't pile up"],
            boxes=['equal distances', 'rigid motions', 'polynomial counting']),
        voice=voice('Distinct distances, every dimension.',
                    'A grid of points repeats its distances a lot. Can any arrangement repeat them more?',
                    'Equal distances become crossing flats, and polynomials limit how many can cross.',
                    'Claimed: grids are best, up to a constant.', V_NONE)),
    # ------------------------------------------------------------------ 167
    '167': dict(
        plain='Among a crowd of dots, how many pairs can be exactly one step apart? Fewer than the 1984 bound allows',
        proof=P('reduction', [
            'Move the points into a number field',
            'Write each squared distance as a product of two numbers',
            'The product formula: sizes across all places balance out',
            'Too many equal distances would break that balance'],
            boxes=['points in the plane', 'a number field', 'the product formula', 'too many repeats clash']),
        voice=voice('Fewer unit distances.',
                    'How many pairs sit exactly one apart? A bound from nineteen eighty four had stood.',
                    'Moved into a number field, too many equal distances break a balance law.',
                    'Claimed: a power below four thirds.', V_MAIN)),
    # ------------------------------------------------------------------ 168
    '168': dict(
        plain="Like knowing a building from its floor plan alone: an ordering's shape fixes its special polynomial",
        proof=P('squeeze', [
            "Schedule one interval's edges using the other's reflection order",
            'Bound how much each step can grow: the bounds multiply out',
            'Run it both ways, so each side bounds the other',
            'Every bound is then exact, and the polynomials agree'],
            min=0, max=1, upper={'from': 0.95, 'v': 0.6, 'label': 'step-by-step bounds'},
            lower={'from': 0.05, 'v': 0.6, 'label': 'the other direction', 'tone': 'cool'},
            upperStep=1, lowerStep=2, target={'v': 0.6, 'label': 'equal polynomials'}),
        voice=voice('Shape decides the polynomial.',
                    'Kazhdan-Lusztig polynomials come from a group. The conjecture: the bare ordering decides them.',
                    'Bounds built step by step, run in both directions, are forced to be exact.',
                    'Claimed: true for every Coxeter system.', V_MAIN)),
    # ------------------------------------------------------------------ 169
    '169': dict(
        plain='Count ways to colour a network so linked dots differ: the tally always splits into non-negative pieces',
        proof=P('correspondence', [
            'Match each coefficient with the counting series of an algebra',
            'A count is never negative, so each coefficient is positive',
            'Bijections then give each allowed ordering its own partition'],
            leftTitle='allowed orderings', rightTitle='partitions',
            left=['$\\sigma_1$', '$\\sigma_2$', '$\\sigma_3$', '$\\sigma_4$'],
            right=['$\\lambda_1$', '$\\lambda_2$', '$\\lambda_3$', '$\\lambda_4$'],
            pairs=[[0, 1], [1, 0], [2, 3], [3, 2]]),
        voice=voice('Shareshian and Wachs, half proved.',
                    'Colour the vertices so neighbours differ. This function counts every way, graded by q.',
                    'Each coefficient is matched to a count, and counts are never negative.',
                    'Claimed: every coefficient is a positive polynomial.', V_MAIN)),
    # ------------------------------------------------------------------ 170
    '170': dict(
        plain='The party puzzle: how many guests force $s$ mutual friends or $t$ mutual strangers? Now pinned down sharply',
        proof=P('probabilistic', [
            'Build a random graph from points and planes of a finite geometry',
            'Its geometry rules out any $s$ vertices all linked',
            'A long unlinked run would have a too-short description',
            'So large unlinked sets are unlikely: the sharp exponent'],
            samples=70, threshold=0.6, mean=0.74, thresholdLabel='needed', label='random graph works'),
        voice=voice('Sharp Ramsey numbers.',
                    'How many guests force five mutual friends or t strangers? A log factor stayed open.',
                    'A random geometric graph, with an entropy count, keeps groups of strangers small.',
                    'Claimed: the sharp exponent, from five up.', V_MAIN)),
    # ------------------------------------------------------------------ 171
    '171': dict(
        plain='Colour every link of a big network red or blue: a one-colour cube appears once there are $C\\,2^n$ points',
        proof=P('contradiction', [
            'Suppose a two-colouring has no one-colour cube',
            'Any bias would let a cube in, so each colour looks random',
            'But in random-looking colours a cube fits too: impossible'],
            assume='no one-colour cube', smaller='each colour looks random', impossible='a cube fits anyway'),
        voice=voice("The cube's Ramsey number.",
                    'Burr and Erdős asked: do cubes need only a constant times two to the n?',
                    'Avoiding cubes forces each colour to look random, and then a cube fits anyway.',
                    'Claimed: linear in two to the n.', V_NONE)),
    # ------------------------------------------------------------------ 172
    '172': dict(
        plain='Colour space with a few colours: which shapes always show up in one colour? An algebra test now decides',
        proof=P('reduction', [
            "Rewrite the points' sphere equation in a tensor square of numbers",
            'No solution there? Then a colouring avoids the shape',
            'A solution? Then Hales–Jewett forces a one-colour copy'],
            boxes=['which shapes are Ramsey?', 'one algebra equation', 'solvable or not']),
        voice=voice("Which shapes can't be dodged?",
                    'Colour space with finitely many colours. Which point sets always appear in a single colour?',
                    'Ramsey or not comes down to whether one algebra equation has a solution.',
                    'Claimed: a complete classification.', V_MAIN)),
    # ------------------------------------------------------------------ 173
    '173': dict(
        plain='One-way friendships: someone always has at least as many friends-of-friends as friends',
        proof=P('contradiction', [
            'Take a smallest network where nobody has enough friends-of-friends',
            'Trimming links gives every group a strict inequality',
            'A counting argument breaks that inequality: impossible'],
            assume='a smallest counterexample', smaller='a strict inequality', impossible='impossible'),
        voice=voice("Seymour's conjecture, proved.",
                    'Follows go one way. Does someone always have as many friends of friends as friends?',
                    'A smallest counterexample would obey an inequality that a counting argument breaks.',
                    'Claimed: true for every oriented graph.', V_MAIN)),
    # ------------------------------------------------------------------ 174
    '174': dict(
        plain='Pick a skeleton of a well-connected network that uses only a small share of every bottleneck',
        proof=P('monotone', [
            'Many disjoint trees share the load across every cut',
            'Keep half the edges so every cut roughly halves too',
            'Repeat; the small losses multiply to a fixed constant',
            'What remains is one tree, thin on every cut'],
            floor=0.16, ylabel='edges kept, halved each round', floorLabel='one tree'),
        voice=voice('Thin trees, found fast.',
                    'Every cut here has many edges. Can one spanning tree use few of each?',
                    'Halve the edges repeatedly, every cut halving too, until one thin tree is left.',
                    'Claimed: always, in polynomial time.', V_MAIN)),
    # ------------------------------------------------------------------ 175
    '175': dict(
        plain='Cheap proofs that a random structure is unlikely: the rough kind is never much better than the exact kind',
        object={
            'lines': [
                {'tex': '\\term{a}{q(\\mathcal F)} \\le \\term{b}{q_f(\\mathcal F)}', 'at': 0.4, 'size': 40, 'y': 0.04,
                 'tone': 'mute', 'note': 'always',
                 'terms': {'a': {'label': 'integral certificates', 'tone': 'cool', 'at': 0.6},
                           'b': {'label': 'fractional ones', 'tone': 'soft', 'at': 1.1}}},
                {'tex': 'q_f(\\mathcal F) \\le \\term{c}{25 \\cdot 512^4} \\; q(\\mathcal F)', 'at': 2.8, 'size': 42,
                 'y': 0.38, 'tone': 'claim', 'note': 'claimed',
                 'terms': {'c': {'label': 'one fixed factor', 'tone': 'hot', 'mark': 'box', 'at': 0.6,
                                 'visual': {'kind': 'line', 'min': 0, 'max': 1, 'w': 220, 'h': 54, 'dx': 0,
                                            'marks': [{'v': 0.12, 'label': '$q$', 'tone': 'cool'},
                                                      {'v': 0.4, 'label': '$q_f$', 'tone': 'soft'},
                                                      {'v': 0.92, 'label': '$C\\,q$', 'tone': 'hot'}]}}}},
                {'tex': '\\mu_p(\\mathcal D) \\ge 1 - 1/k \\text{ with } \\term{k}{k = 2^{75}}', 'at': 5.4, 'size': 36,
                 'y': 0.93, 'note': 'discrete convexity',
                 'terms': {'k': {'tone': 'accent', 'mark': 'box', 'at': 0.5}}}]},
        voice=voice("Talagrand's threshold conjectures, claimed proved.",
                    ('Expectation thresholds are cheap certificates that a random structure is unlikely.', 'Can fractional certificates always be rounded to whole ones?'),
                    None,
                    'Claimed: the loss is one fixed factor, and both conjectures hold.', V_MAIN)),
    # ------------------------------------------------------------------ 176
    '176': dict(
        plain='When does a random network first hold a given shape? Once its rarest piece shows up, give or take a log',
        proof=P('construction', [
            "Nest the pattern's subgraphs, densest first",
            'Track every way of extending them in one tree',
            'Resample with one shared random graph: the log is paid once'],
            pieces=[{'label': 'nested subgraphs', 'role': 'densest first'},
                    {'label': 'a tree of histories', 'role': 'every way to extend'},
                    {'label': 'one shared random graph', 'role': 'log cost paid once', 'tone': 'accent'}],
            result='threshold within one log'),
        voice=voice('The second Kahn-Kalai conjecture.',
                    'When does a random graph first contain H? The culprit: a rare piece of H.',
                    'Nested pieces share one random graph, so the log cost is paid only once.',
                    'Claimed: right up to a log factor.', V_MAIN)),
    # ------------------------------------------------------------------ 177
    '177': dict(
        plain='Expanders are sparse networks that are very hard to cut apart; these are their higher-dimensional cousins',
        proof=P('construction', [
            'Build a complex from a group of polynomial matrices',
            'Cut it down by congruence quotients: same local shape, bigger size',
            'A building argument shows no holes, so it expands'],
            pieces=[{'label': 'polynomial matrices', 'role': 'over a finite field'},
                    {'label': 'coset complex', 'role': 'bounded degree'},
                    {'label': 'quotients mod $t^m$', 'role': 'size grows', 'tone': 'accent'}],
            result='expanders in every dimension'),
        voice=voice('Expanders in every dimension.',
                    'Big shapes glued from triangles and beyond, each corner touching few, yet hard to cut.',
                    'Built from polynomial matrices, shrunk by quotients, with no holes left.',
                    'Claimed: for every dimension from three up.', V_MAIN)),
    # ------------------------------------------------------------------ 178
    '178': dict(
        plain='The best-connected sparse networks, built by a recipe with no coin flips, for every degree',
        proof=P('construction', [
            'Add edges by pairing vertices, one careful step at a time',
            "Choose each step to keep the spectrum's statistics on track",
            'A final local repair pushes the last eigenvalues inside'],
            pieces=[{'label': 'pair up vertices', 'role': 'step by step'},
                    {'label': 'steer the statistics', 'role': 'no coin flips'},
                    {'label': 'spectral repair', 'role': 'the last eigenvalues', 'tone': 'accent'}],
            result='a Ramanujan graph'),
        voice=voice('Ramanujan graphs, without luck.',
                    'Ramanujan graphs are optimal sparse networks. Random ones exist; a recipe did not.',
                    'Pair edges step by step, steering the spectrum, then repair the last eigenvalues.',
                    'Claimed: a deterministic algorithm, every degree.', V_NONE)),
    # ------------------------------------------------------------------ 179
    '179': dict(
        plain='Can a row of pluses and minuses, shifted around, stay perfectly out of step with itself? Only in tiny cases',
        proof=P('reduction', [
            'Classical arithmetic forces the order to be $4u^2$, $u$ odd',
            'Character values then multiply to a root of unity',
            'A 2-adic computation shows that fails unless $u = 1$'],
            boxes=['order $4u^2$', 'a root of unity', 'only $u = 1$']),
        voice=voice('Circulant Hadamard matrices, settled.',
                    'Every shift of this plus-minus row is orthogonal. Ryser bet only order four works.',
                    'Arithmetic forces a special order, then a two-adic check rules it out.',
                    'Claimed: only orders one and four.', V_MAIN)),
    # ------------------------------------------------------------------ 180
    '180': dict(
        plain='A tidy class of networks always has a round trip through every junction exactly once',
        proof=P('reduction', [
            'Flip to the dual: a cycle means splitting corners into two trees',
            'Add up signed weights over pairs of choices',
            'Bad pairs cancel; the sum is not zero, so a good pair exists'],
            boxes=['a Hamiltonian cycle', 'two trees', 'a signed sum $\\ne 0$']),
        voice=voice("Barnette's conjecture, claimed proved.",
                    'A Hamiltonian cycle visits every vertex once. Barnette said these graphs always have one.',
                    'In a signed sum, bad choices cancel, and what remains is not zero.',
                    'Claimed: every such graph has one.', V_MAIN)),
    # ------------------------------------------------------------------ 181
    '181': dict(
        plain='Split every link of any network into loops, plus a few spare links, using a fixed multiple of its size',
        proof=P('induction', [
            'Pick a scale where the graph has large, well-connected pieces',
            'Merge pairs of low-degree vertices: a smaller graph',
            'Solve that one by induction, then lift its cycles back'],
            levels=5, base='small graph', step='shrink, solve, lift back'),
        voice=voice('Every graph, cut into cycles.',
                    'Here two five-cycles use every edge. Can any graph split into few cycles?',
                    'Shrink the graph, solve the smaller one, then lift each cycle back.',
                    'Claimed: a constant times n pieces, always.', V_MAIN)),
    # ------------------------------------------------------------------ 182
    '182': dict(
        plain='Pick numbers up to N with no two differing by a perfect square: you must leave out almost all of them',
        proof=P('monotone', [
            "Keep only the set's simplest rhythms, its rational frequencies",
            'Build a positive score that controls the density',
            'Each pass to shorter square steps shrinks it by a power of $N$'],
            floor=0.14, ylabel='the score', floorLabel='density bound', label='shrinks every pass'),
        voice=voice('No square differences.',
                    'How big can a set of numbers be if no two differ by a square?',
                    'A positive score shrinks by a power each time the steps get shorter.',
                    'Claimed: a genuine power saving.', V_PART)),
    # ------------------------------------------------------------------ 183
    '183': dict(
        plain='Draw lines through two dots that split the rest exactly in half: how many can there be? Fewer than thought',
        proof=P('contradiction', [
            'Suppose the old crossing bound were nearly tight',
            'Zoom out: the points would form a rigid limiting shape',
            "It can't exist; repeating the small gain gives a power saving"],
            assume='the old bound is tight', smaller='a rigid limit shape', impossible='impossible'),
        voice=voice('Fewer halving lines.',
                    "Each line splits the other points in half. Dey's bound stood since nineteen ninety eight.",
                    'If the old bound were tight, the points would form an impossible rigid shape.',
                    'Claimed: a power below four thirds.', V_MAIN)),
    # ------------------------------------------------------------------ 184
    '184': dict(
        plain='Forbid any tight-knit group of $r$ mutual friends, and a network must hold a large group of strangers',
        proof=P('reduction', [
            'Give vertices weights that maximise an entropy-like score',
            'Splitting vertices along random walks shows triangles stay rare',
            'With few triangles, a large independent set falls out'],
            boxes=['no $K_r$', 'few triangles', 'a big independent set']),
        object={
            'lines': [
                {'tex': '\\alpha(G) \\ge c\\,\\tfrac{n}{d} \\cdot \\term{g}{\\tfrac{\\log d}{\\log\\log d}}', 'at': 0.3,
                 'size': 38, 'y': 0.04, 'tone': 'mute', 'note': 'Shearer, 1995',
                 'terms': {'g': {'label': 'loses a $\\log\\log$', 'tone': 'bad', 'at': 0.6}}},
                {'tex': '\\alpha(G) \\ge c_r\\,\\tfrac{n}{d} \\cdot \\term{h}{\\log d}', 'at': 2.3,
                 'size': 42, 'y': 0.4, 'tone': 'claim', 'note': 'claimed',
                 'terms': {'h': {'label': 'the full $\\log d$', 'tone': 'claim', 'mark': 'box', 'at': 0.5}}},
                {'tex': '\\chi_{DP}(G) \\le C_r\\, \\term{x}{\\Delta / \\log \\Delta}', 'at': 4.0, 'size': 36, 'y': 0.76,
                 'note': 'and the colouring bound',
                 'terms': {'x': {'label': 'far fewer than $\\Delta$', 'tone': 'claim', 'at': 0.4}}}],
            'beats': [
                {'at': 0.2, 'text': 'Graphs with no $K_r$, $r \\ge 4$, and average degree $d$: how big an independent set?'},
                {'at': 2.3, 'text': 'For 45 years every argument for $r \\ge 4$ lost a $\\log\\log$ factor'},
                {'at': 4.2, 'text': 'The claim removes it, and colours such graphs with $O(\\Delta/\\log\\Delta)$ colours'}]},
        voice=voice('Clique-free graphs, finally tamed.',
                    'Forbid a clique. How big must the largest group of strangers be?',
                    'An entropy score keeps triangles rare, then a large stranger set falls out.',
                    'Claimed: the log log loss is gone.', V_PART)),
    # ------------------------------------------------------------------ 185
    '185': dict(
        plain="Matroids capture what 'independent' means; for infinite ones, a classic matching theorem breaks",
        proof=P('contradiction', [
            'Build a self-dual matroid from an ultrafilter rank',
            'Chain copies along a path: any cover makes the rank drop',
            "Ranks can't drop forever, so no cover exists"],
            assume='a cover by two sets', smaller='a smaller ordinal rank', impossible='no endless descent'),
        voice=voice('Infinite matroids break.',
                    "Edmonds' theorem holds for finite matroids. Does it survive the jump to infinite ones?",
                    'Any cover would force an ordinal rank to drop forever, and that cannot happen.',
                    'Claimed: both infinite conjectures fail.', V_MAIN)),
    # ------------------------------------------------------------------ 186
    '186': dict(
        plain="Add random links one by one: a property like 'connected' flips from rare to near-certain in a sudden jump",
        proof=P('reduction', [
            'Freeze every edge outside a random block of about $\\sqrt n$ vertices',
            "Symmetry inside the block caps each edge's influence",
            'That bounds the variance, so the jump happens in a narrow window'],
            boxes=['a random block', 'small influences', 'a narrow window']),
        voice=voice('Sharper thresholds, as conjectured.',
                    'Add random edges and properties flip from unlikely to likely. How narrow is the switch?',
                    'Freeze everything outside a random block; symmetry inside it caps every influence.',
                    'Claimed: width one over log n squared.', V_PART)),
    # ------------------------------------------------------------------ 187
    '187': dict(
        plain='Two players take turns claiming squares: can one always build a six-square zigzag? Yes, in 21 moves',
        proof=P('induction', [
            'Start from positions where Maker completes Snaky at once',
            "Combine claims so one Breaker reply can't spoil every option",
            'Hundreds of combined claims build up to the empty board'],
            levels=5, base='1 move', labels=['1 move', '2 moves', '3 moves', '$\\cdots$', '21 moves'],
            step='combine winning claims'),
        voice=voice('Maker builds Snaky.',
                    'Players take turns claiming cells. Maker wants a copy of Snaky; Breaker blocks.',
                    'Winning positions are combined, step by step, until the empty board is one.',
                    'Claimed: Maker wins within twenty one moves.', V_MAIN)),
    # ------------------------------------------------------------------ 188
    '188': dict(
        plain='Keep deleting random triangles from a fully linked network until none remain: how many links survive?',
        proof=P('reduction', [
            'Run the process until few triangles are left, then pause',
            "Model each edge's survival as a branching tree of tests",
            'Compare with an exact branching model; collisions are rare'],
            boxes=['random removal', 'a branching model', 'exact survival odds']),
        voice=voice('What triangle removal leaves.',
                    'Start from every edge, then delete random triangles until none are left. How many survive?',
                    "Compare each edge's fate with a branching model whose survival odds are exact.",
                    'Claimed: the leading constant, exactly.', V_MAIN)),
    # ------------------------------------------------------------------ 189
    '189': dict(
        plain="Colour links red or blue: you're forced to see a red loop or a big blue cluster, at an exact size",
        proof=P('contradiction', [
            'Take a smallest counterexample: no long cycle, few strangers',
            'It must hold a big clique; paths around it find many strangers',
            'A computer search kills the small cases: impossible'],
            assume='a smallest counterexample', smaller='too many strangers', impossible='impossible'),
        voice=voice('Every cycle-clique Ramsey number.',
                    'Two red triangles, blue between, avoid both. One more vertex should always force one.',
                    'A smallest counterexample breaks down, with a computer checking the small cases.',
                    'Claimed: the formula holds for every pair.', V_MAIN)),
    # ------------------------------------------------------------------ 190
    '190': dict(
        plain='Hunt a pattern in a grid of 0s and 1s: a grid can be far from clean, yet hold very few copies',
        proof=P('construction', [
            'Index rows and columns by the leaves of a binary tree',
            'An anchor block forces any copy into fixed roles',
            'A small core pushes a 1 and a 0 down until they collide'],
            pieces=[{'label': 'a binary tree', 'role': 'indexes rows and columns'},
                    {'label': 'an anchor block', 'role': 'pins the roles'},
                    {'label': 'a $2 \\times 2$ core', 'role': 'a 1 and a 0 collide', 'tone': 'accent'}],
            result='far from free, yet few copies'),
        voice=voice('Removal is not polynomial.',
                    'A grid of zeros and ones, far from pattern free. Must it hold many copies?',
                    'Rows and columns form a tree; a one and a zero collide at leaves.',
                    'Claimed: copies can be extremely rare.', V_MAIN)),
    # ------------------------------------------------------------------ 191
    '191': dict(
        plain='Scatter dots in a square so the smallest triangle any three of them make is as big as possible',
        proof=P('construction', [
            'Pick points from integer columns labelled by a parabola',
            "Encode the labels in digits so areas can't be tiny",
            'Add a condition against three in a line; drop rare bad triples'],
            pieces=[{'label': 'integer columns', 'role': 'labels on a parabola'},
                    {'label': 'digit encoding', 'role': 'no tiny areas'},
                    {'label': 'a second condition', 'role': 'no three in a line', 'tone': 'accent'}],
            result='every triangle stays large'),
        voice=voice("Heilbronn's triangle problem, improved.",
                    'Keep every triangle among n points large. Since nineteen eighty two, only a log gained.',
                    'Points on a finite-field parabola, encoded in digits, keep areas from shrinking.',
                    'Claimed: a genuine power gain.', V_PART)),
    # ------------------------------------------------------------------ 192
    '192': dict(
        plain="A yes/no rule's pull toward its inputs was thought capped by its complexity; some rules blow past any cap",
        proof=P('amplify', [
            'Combine independent signs into cells of low degree',
            'Each step raises the kept variance against the degree cost',
            'Repeat enough times and the ratio beats any constant'],
            k=2, levels=3, unit='each block: one amplification step', label='the ratio grows every level'),
        voice=voice('Boolean functions beat root d.',
                    'Majority on d bits correlates with its inputs about root d. Was that the limit?',
                    'A gain is compounded, step by step, until it beats any constant.',
                    'Claimed: no constant times root d suffices.', V_MAIN)),
}
