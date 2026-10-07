# Enrichment pass for the TCS reels: plain line, proof scene, narration.
# Applied by gen_tcs_common.write(); proof ideas come from the reviews' explainers,
# the article (content/articles/openai-math.mdx) or each paper's own proof overview
# (extracts in scratch/tcs-proofs/<id>.json, each with a verbatim quote).
# Proof omitted for 120, 127, 137: no archetype states the idea honestly.

PROOF_OBJ_DUR = 6.0

V_MAIN = 'Lean checks the theorem.'
V_PART = 'Lean checks only part.'
V_NONE = 'Manuscript only, no Lean.'


def P(arch, steps, **data):
    # dur 5: the narration fitter lengthens the scene (up to 6 s) when its line needs it
    return {'archetype': arch, 'dur': 5, 'steps': steps, 'data': data}


def R(*boxes, arrow='becomes'):
    return {'boxes': list(boxes), 'arrow': arrow}


def V(*a):
    # V(title, object, proof, achievement, verify) or, without a proof scene, V(title, object, achievement, verify)
    title, obj, proof, ach, ver = a if len(a) == 5 else (a[0], a[1], None, a[2], a[3])
    out = [{'scene': 'title', 'text': title}, {'scene': 'object', 'text': obj}]
    if proof:
        out.append({'scene': 'proof', 'text': proof})
    out += [{'scene': 'achievement', 'text': ach}, {'scene': 'verify', 'text': ver}]
    return out


ENRICH = {
 '102': dict(
  plain='Label every dot so that linked pairs agree: is 99% possible, or under 1%? Telling which is as hard as it gets',
  proof=P('reduction', [
    'Start from a known hard puzzle: true-or-false formulas',
    'Turn it into a labelling test with hidden noise',
    'Honest labels shrug off the noise; cheaters still get caught',
    'So 99% versus 1% is as hard as the original puzzle'],
    **R('3SAT', 'parity game', 'latent noise test', 'Unique Games')),
  voice=V('Is the Unique Games Conjecture true?',
          'Simple rounding gets Max-Cut to point eight seven eight. Was that the limit?',
          'Formulas become a labelling test whose hidden noise honest answers survive.',
          'Claimed proved: those algorithms are optimal.', V_MAIN)),
 '103': dict(
  plain='Does a computer with tiny memory ever need to flip coins? The claim: no, coin tosses never help it',
  proof=P('probabilistic', [
    'Estimate the chance of acceptance level by level',
    'Most random seeds give an accurate estimate',
    'Seeds are short: try every one and take the middle answer'],
    samples=40, threshold=0.5, mean=0.75, thresholdLabel='half the seeds', label='accurate seeds'),
  voice=V('Coins never help small memory.',
          'Removing randomness used to cost extra memory. The best was log to the three halves.',
          'Most short random seeds work, so try them all and take the median.',
          'Claimed: plain log space suffices.', V_NONE)),
 '104': dict(
  plain='Two players shove a token round a map of gains and losses; the claim finds who wins far faster than before',
  proof=P('monotone', [
    'Give every spot a score; winning spots sit near the top',
    'Ask only which spots are forced high or low',
    'Recurse: halve the range, or reweight the spots',
    'A measure that cannot grow forever caps the recursion'],
    label='search range left', floorLabel='solved'),
  voice=V('Mean-payoff games, solved much faster.',
          'Two players fight over the long-run average. Big weights made this slow.',
          'Recursion halves the search range or grows a bounded measure, so it stops.',
          'Claimed: deterministic quasipolynomial time, for all three games.', V_PART)),
 '105': dict(
  plain='A labelling puzzle where each answer has exactly two partners: telling perfect from hopeless is hard',
  proof=P('reduction', [
    'Start from a known hard puzzle: true-or-false formulas',
    'Turn it into a game and repeat it to widen the gap',
    'Stack copies in a tree so every check is two-to-one',
    'A strong cheat would beat the original game: impossible'],
    **R('3-SAT', 'PCP + repetition', 'tree of copies', '2-to-1 game')),
  voice=V('Two-to-one games, perfect completeness.',
          'Each answer has exactly two partners. Hardness was stuck at twenty three over twenty four.',
          'Formulas become a repeated game, stacked so every check is two to one.',
          'Claimed: any soundness is hard.', V_MAIN)),
 '106': dict(
  plain="You're told a map needs only three colours; even then, colouring it with many more is hopelessly hard",
  proof=P('construction', [
    'Give every point a position on a circle',
    'Linked points sit nearly opposite each other',
    'Colour by which third of the circle: no link stays inside one'],
    pieces=[{'label': 'phases', 'role': 'a point on a circle'},
            {'label': 'edges', 'role': 'nearly half a turn apart'},
            {'label': 'three arcs', 'role': 'one colour each'}],
    result='a proper 3-colouring'),
  voice=V('Colouring three-colourable graphs.',
          'Each vertex gets a spot on a circle. Linked vertices sit far apart.',
          'Cut the circle in thirds: each third is one colour, and no link clashes.',
          'Claimed: even big independent sets are hard.', V_MAIN)),
 '108': dict(
  plain='The permanent is the determinant with no minus signs; disguising it as a determinant needs a far bigger table',
  proof=P('construction', [
    'Carve a smaller, smooth polynomial out of the permanent',
    'Smooth shapes force any determinant to be big',
    'Degree times number of variables: the size grows like a cube'],
    pieces=[{'label': 'a slice of the permanent', 'role': 'degree about $k$'},
            {'label': 'many variables', 'role': 'about $k^2$ of them'},
            {'label': 'smooth zero set', 'role': 'forces a big determinant'}],
    result='size at least cubic'),
  voice=V('A cubic permanent lower bound.',
          'The permanent drops every minus sign. Since two thousand four, the best bound was quadratic.',
          'A smooth slice of the permanent forces any determinant to be big.',
          'Claimed: the size must grow like a cube.', V_MAIN)),
 '109': dict(
  plain='Multiplying huge numbers: the best method was thought to be final. This claims to shave a hair off it',
  proof=P('amplify', [
    'Pass mixed combinations of the data, not the data itself',
    'One pass then costs a little less than before',
    'Nest that step inside itself: the saving compounds'],
    k=2, levels=3, unit='each block: a slightly cheaper pass', label='a saving that grows with every level'),
  voice=V('Multiplying below n log n.',
          'Since twenty twenty one, n log n steps was thought to be the end.',
          'Mixed combinations of data make each pass cheaper, and the saving compounds.',
          'Claimed: a hair below n log n.', V_NONE)),
 '110': dict(
  plain='Taxis wait around a city while calls arrive without warning: how much extra driving does not knowing cost?',
  proof=P('construction', [
    'Cut the space into nested regions at many scales',
    'Treat the regions as a tree and spread the servers down it',
    'Pin the spread to real points, then round to whole servers',
    'One log comes from cutting, one from spreading'],
    pieces=[{'label': 'nested regions', 'role': 'many scales'},
            {'label': 'tree spread', 'role': 'fractional servers'},
            {'label': 'rounding', 'role': 'whole servers'}],
    result='$O(\\log^2 k)$ on every space'),
  voice=V('Randomized k-server on every metric.',
          'Servers chase requests with no view of the future. How much extra movement is unavoidable?',
          'Nested regions at every scale, servers spread down the tree, then rounded.',
          'Claimed: log squared, on every space.', V_MAIN)),
 '111': dict(
  plain='Accept or reject offers as they arrive, having seen only one past example of each: you still win a fixed share',
  proof=P('construction', [
    'Treat the past samples as values the rule gives up',
    'Group the values by size, low to high',
    'Build nested sets and pick greedily, layer by layer',
    'Nesting keeps the picks allowed in any arrival order'],
    pieces=[{'label': 'samples', 'role': 'given up as a price'},
            {'label': 'size groups', 'role': 'low to high'},
            {'label': 'nested layers', 'role': 'greedy picks'}],
    result='a fixed share in any order'),
  voice=V('One sample is enough.',
          'Offers arrive one by one, in the worst order. You saw one past example of each.',
          'Values are grouped by size and picked greedily in nested layers.',
          'Claimed: a fixed share, though tiny.', V_MAIN)),
 '112': dict(
  plain='Circuits only three layers deep: here is a simple task they need astronomically many gates to do',
  proof=P('counting', [
    'Pick a function no simple formula can track well',
    'Random fixing shows wide formulas act like narrow ones',
    'So each middle gate can accept only a few inputs',
    'Too few gates cannot cover all the yes-inputs'],
    boxes=4, items=9, label='each gate covers few', boxLabel='gates'),
  voice=V('Depth-three circuits, beyond the square root.',
          'Three layers of gates. Lower bounds were stuck at two to the root n.',
          'Each middle gate covers few inputs, so few gates cannot cover them all.',
          'Claimed: more than that, for one task.', V_MAIN)),
 '113': dict(
  plain='Count the ways to pair everyone off at a party, for any web of friendships, quickly and almost exactly',
  proof=P('reduction', [
    'Start from a graph where everyone knows everyone: easy to count',
    "Fade out the links the real graph lacks, a bit at a time",
    'At each stage, random samples measure how the count shrank',
    'Multiply all those small ratios to get the final count'],
    **R('complete graph', 'fade missing edges', 'sample each ratio', 'multiply', arrow='then')),
  voice=V('Counting matchings in any graph.',
          'Exact counting is hopeless. Approximate counting worked only for two-sided graphs.',
          'Fade missing edges out of a complete graph, measuring each small shrink by sampling.',
          'Claimed: fast approximate counting, every graph.', V_MAIN)),
 '114': dict(
  plain='Count the choices that obey two separate rulebooks at once, quickly and almost exactly',
  proof=P('reduction', [
    'Recast shared choices as picking one from each pair',
    'Give imperfect picks a weight; start where totals are known',
    'Slowly lower that weight, random-walking at each stage',
    'A key inequality shows each walk settles fast'],
    **R('two rulebooks', 'paired picks', 'slow cooling walk', 'fast mixing', arrow='then')),
  voice=V('Counting choices that obey two rulebooks.',
          'Many objects are choices allowed by two rulebooks at once, like matchings and spanning trees.',
          'Imperfect picks are weighted, then the weight is lowered, sampling at each stage.',
          'Claimed: fast approximate counting.', V_PART)),
 '115': dict(
  plain='Fill a grid with whole numbers so each row and column hits its total, and pick one perfectly at random',
  proof=P('construction', [
    'Split the cells: ones near small totals, and one big block',
    'Pad the big block so filling it at random is easy',
    'Random-walk the small cells, fill the block, drop the pad',
    'Fix the last tiny error with a rare exhaustive draw'],
    pieces=[{'label': 'small cells', 'role': 'random walk'},
            {'label': 'big block', 'role': 'padded, filled at random'},
            {'label': 'correction', 'role': 'rare exact redraw'}],
    result='an exactly uniform table'),
  voice=V('Random tables with fixed totals.',
          'Statisticians need random tables whose rows and columns hit given totals.',
          'Walk the small cells, fill a padded big block, and correct the rare error.',
          'Claimed: exactly uniform, in polynomial time.', V_MAIN)),
 '116': dict(
  plain='Plug one fixed set of matrices into any small formula: if it is not secretly zero, the answer shows it',
  proof=P('correspondence', [
    'Encode each word as a nested integral in one variable',
    'Different words give independent results, so none cancel',
    'A small formula cannot vanish too deeply at zero',
    'So a short slice, written as matrices, still sees it'],
    leftTitle='words', rightTitle='integrals',
    left=['$xy$', '$yx$', '$xxy$', '$yxy$'], right=['$I_1$', '$I_2$', '$I_3$', '$I_4$'],
    pairs=[[0, 0], [1, 1], [2, 2], [3, 3]], label='different words, independent values'),
  voice=V('One test point for every formula.',
          'With numbers, x y minus y x vanishes. With matrices, it need not.',
          'Each word becomes its own integral, so no two can cancel.',
          'Claimed: one small matrix tuple suffices.', V_PART)),
 '117': dict(
  plain='Split a network in two while cutting as few links as possible: even a rough answer is hard to find',
  proof=P('reduction', [
    'Turn a formula into a proof that can be spot-checked',
    "Build a network out of the spot-check's scores",
    'A satisfying answer gives a cheap cut',
    'Any cheap cut can be decoded back into an answer'],
    **R('3SAT', 'spot-check test', 'network', 'sparse cut')),
  voice=V('Sparsest cut is hard.',
          'Split a network evenly while cutting few links. The best algorithm loses a root log factor.',
          'Formulas become networks whose cheap cuts decode back into answers.',
          'Claimed: no constant factor is possible.', V_PART)),
 '118': dict(
  plain='Packing items into bins: the standard estimate was thought off by at most one bin; it can be off by any number',
  proof=P('reduction', [
    'Encode a graph as items: each vertex becomes two trees',
    'A small vertex cover packs into the target bins',
    'Any packing with few extra bins reveals a small cover',
    'A half-and-half mix fits only on paper: a real gap'],
    **R('vertex cover', 'competing trees', 'bins', 'LP gap')),
  voice=V('Bin packing, unbounded gaps.',
          'The standard estimate was believed to be off by at most one bin.',
          'Graphs become items whose packings reveal vertex covers, with a built-in gap.',
          'Claimed: the gap can be any size.', V_MAIN)),
 '119': dict(
  plain='Squeeze many noisy bits into one bit: the best summary is simply to copy a single bit, as long conjectured',
  proof=P('induction', [
    'Measure how fast noise drains the information',
    'Split the cube in half along one coordinate',
    'Show joining the two halves still obeys the bound',
    'Climb one dimension at a time, then add up over time'],
    levels=4, labels=['$n=1$', '$n=2$', '$n=3$', '$n=4$'], base='one bit', step='add a coordinate'),
  voice=V('The Courtade Kumar conjecture, claimed proved.',
          'Squeeze noisy bits into one bit. Which summary keeps the most information?',
          'Split the cube, join the halves, and climb one dimension at a time.',
          'Claimed: copying one bit is best.', V_PART)),
 '120': dict(
  plain='Pair up as many people as possible in any network, in about the time it takes to read the network once',
  voice=V('Maximum matching, fast, in any graph.',
          'General matching, with odd cycles, stood at m root n for forty five years. Blossoms blocked it.',
          'Claimed: almost linear time in any graph, correct two times in three.',
          'Only a manuscript, no Lean.')),
 '121': dict(
  plain='How many typo fixes turn one text into another? Get as close as you like, almost as fast as reading them',
  proof=P('amplify', [
    'Split the first string into a tree of pieces',
    'Start from rough cost estimates for every piece',
    'Predict a narrow band where the best alignment runs',
    'Each pass sharpens the estimates; repeat'],
    k=2, levels=3, unit='each block: one refinement pass', label='sharper with every pass'),
  voice=V('Edit distance, almost linear.',
          'Exact edit distance seems to need quadratic time. Fast methods were only off by a constant.',
          'Rough estimates on a tree of pieces get sharper with every pass.',
          'Claimed: any accuracy, almost linear time.', V_MAIN)),
 '122': dict(
  plain='Recover a message from copies that each lost random letters: you need more copies than any power of its length',
  proof=P('amplify', [
    'Start with two words whose damaged copies nearly match',
    'Nest copies with randomly flipped runs around them',
    'Alternating sign patterns cancel what still differs',
    'Repeat scale after scale until the difference is tiny'],
    k=2, levels=3, unit='each block: one scale of nesting', label='harder to tell apart at every scale'),
  voice=V('How many damaged copies are needed?',
          'Each copy loses random bits. How many copies recover the original?',
          'Two strings nested scale after scale become nearly impossible to tell apart.',
          'Claimed: more copies than any polynomial allows.', V_PART)),
 '124': dict(
  plain='Three workers, equal-length tasks, some tasks must wait for others: finishing soonest is now solvable fast',
  proof=P('local-to-global', [
    'Cut a good schedule at a few chosen time slots',
    'The gaps between cuts can be rescheduled on their own',
    "Each gap's set of jobs has a short description",
    'A table over those few sets glues a full schedule'],
    cols=4, rows=1, patchLabel='time intervals', label='glued by one table'),
  voice=V('Three machines, unit jobs.',
          'Two machines are easy, many are hard. Three was open for forty seven years.',
          'Cut the schedule into intervals with short descriptions, then glue them by a table.',
          'Claimed: solvable in polynomial time.', V_MAIN)),
 '125': dict(
  plain='Place k warehouses to keep total travel short: this reaches the best accuracy any fast method can',
  proof=P('squeeze', [
    'Known hardness rules out doing any better',
    'Round a fractional plan over many rounds',
    'A running budget pays for each option erased',
    'A few extra warehouses are then removed cheaply'],
    min=0, max=1, lower={'from': 0.05, 'v': 0.55, 'label': 'known hardness', 'tone': 'cool'},
    upper={'from': 0.95, 'v': 0.55, 'label': 'new rounding'}, lowerStep=0, upperStep=1,
    target={'v': 0.55, 'label': '$1 + 2/e$'}),
  voice=V('Clustering with k medians, settled.',
          'Place k warehouses to cut total travel. Hardness and algorithms had a gap.',
          'Known hardness pushes from below, new rounding from above. They meet.',
          'Claimed: exactly one plus two over e.', V_MAIN)),
 '126': dict(
  plain='No compact optimisation recipe can describe all perfect pairings exactly; any exact one must be enormous',
  proof=P('reduction', [
    'Start from a parity puzzle that has no solution',
    'Plant the puzzle inside matchings, one gadget per vertex',
    'A small description would give a simple impossibility proof',
    'A witness shows no simple proof exists'],
    **R('odd parity puzzle', 'matching gadgets', 'sum of squares', 'no short proof')),
  voice=V('No small semidefinite program for matching.',
          'Linear programs for perfect matching were known to be huge. What about semidefinite ones?',
          'A small one would give a short proof for an impossible puzzle.',
          'Claimed: any exact one has exponential size.', V_PART)),
 '127': dict(
  plain='A yes/no rule made from a simple polynomial: flipping one random input bit rarely changes its answer',
  voice=V('The Gotsman Linial conjecture, claimed proved.',
          'A yes or no rule from a degree d polynomial. How often does one flipped bit change the answer?',
          'Claimed: at most eight d root n, as conjectured thirty years ago.',
          V_MAIN)),
 '128': dict(
  plain='Glue DNA fragments into the shortest string containing them all: now guaranteed at most twice the best',
  proof=P('construction', [
    'Count letters any answer is forced to contain',
    'That count is a lower bound on the shortest answer',
    'Turn the counts into loops that spell pieces of text',
    'Link the loops using a second budget of the same size'],
    pieces=[{'label': 'forced counts', 'role': 'a lower bound'},
            {'label': 'loops', 'role': 'spell the pieces'},
            {'label': 'links', 'role': 'a second equal budget'}],
    result='at most twice the best'),
  voice=V('Shortest superstring within two.',
          'Find the shortest string holding every fragment. The best was about two and a half.',
          'Loops paid by a lower bound, linked by a second equal budget.',
          'Claimed: at most twice optimal.', V_MAIN)),
 '129': dict(
  plain='A reading machine that can move back and forth needs vastly more memory states to replace guessing',
  proof=P('correspondence', [
    'Record how the machine enters and leaves each cell',
    'Those records pair up ports, like a matching',
    'Matchings with few ports cannot track all the guessing'],
    leftTitle='in', rightTitle='out', left=['1', '2', '3', '4'], right=['1', '2', '3', '4'],
    pairs=[[0, 2], [1, 0], [2, 3], [3, 1]], label='a matching of ports per cell'),
  voice=V('The Sakoda Sipser question.',
          'Can a machine reading back and forth replace guessing cheaply? Asked in nineteen seventy eight.',
          'Its visits to each cell form matchings, which cannot track all the guessing.',
          'Claimed: exponentially many states.', V_MAIN)),
 '131': dict(
  plain='Shuffle a network by swapping link endpoints: the claim is it becomes truly random after reasonably few swaps',
  proof=P('local-to-global', [
    'Reshuffle which of two points gets each shared neighbour',
    'Check the reshuffles behave well on every triple of points',
    'Show the clashes between separate pairs add up positive',
    'Glue the local checks into fast mixing for swaps'],
    cols=3, rows=2, patchLabel='small groups of points', label='fast mixing overall'),
  voice=V('Does edge swapping really randomize networks?',
          'Scientists randomize networks by swapping edge endpoints. Is that fast for every network?',
          'Check small groups of vertices, then glue the checks into fast mixing.',
          'Claimed: polynomial mixing for every degree sequence.', V_MAIN)),
 '132': dict(
  plain='Count single switches that flip a decision versus groups of switches: groups win by more than a square',
  proof=P('amplify', [
    'Start from a small function where groups beat single flips',
    'Plug copies of it into itself, level by level',
    'Each level widens the gap, past the square'],
    k=2, levels=3, unit='each block: the small function', label='the gap grows with every level'),
  voice=V('Block sensitivity beats sensitivity squared.',
          'Flip one bit or a group. Groups were thought to win by a square at most.',
          'Nest a small function inside itself, and the gap grows each level.',
          'Claimed: more than squared.', V_MAIN)),
 '133': dict(
  plain='Telling networks apart by repeated recolouring: the slow cost of the standard test is unavoidable',
  proof=P('reduction', [
    'Start from a problem proven to be slow',
    'Write its computations as a compact consistency puzzle',
    'Hide the puzzle inside two graphs for the recolouring test',
    'A fast test would then solve the slow problem'],
    **R('a slow problem', 'consistency puzzle', 'graph pair', 'the $k$-WL test')),
  voice=V('Weisfeiler Leman is slow.',
          'Higher-order recolouring tests power graph neural networks. Their cost grows like n to the k.',
          'A provably slow problem hides inside two graphs, so a fast test is impossible.',
          'Claimed: that cost is unavoidable.', V_MAIN)),
 '134': dict(
  plain="Search patterns with 'not' allowed never need more than three nested repeat-loops, for any regular pattern",
  proof=P('construction', [
    'Treat the pattern as a small machine reading a word',
    'Cut every word into uniquely marked pieces',
    'Pass the machine state across each cut with simple tests',
    'Two nested cuts on simple tests reach height three'],
    pieces=[{'label': 'machine', 'role': 'reads the word'},
            {'label': 'first cut', 'role': 'marked pieces'},
            {'label': 'second cut', 'role': 'nested inside'}],
    result='star height at most 3'),
  voice=V('Star height at most three.',
          'With complement allowed, nobody could prove any fixed bound on nested stars.',
          'Cut every word into marked pieces, twice, passing the state across each cut.',
          'Claimed: three nested stars always suffice.', V_MAIN)),
 '135': dict(
  plain='Multiply many grids of variables: shallow five-layer formulas for it need about $n^{\\sqrt n}$ steps, and that is enough',
  proof=P('squeeze', [
    'Score each polynomial by the rank of a matrix',
    'Small five-layer circuits only reach a low score',
    'Matrix products score high, so circuits must be huge',
    'A matching construction shows that size is enough'],
    min=0, max=1, lower={'from': 0.05, 'v': 0.55, 'label': 'rank lower bound', 'tone': 'cool'},
    upper={'from': 0.95, 'v': 0.55, 'label': 'construction'}, lowerStep=2, upperStep=3,
    target={'v': 0.55, 'label': '$n^{\\Theta(\\sqrt n)}$'}),
  voice=V('Depth five, matrix products.',
          'The top corner of a product of n matrices, five layers deep.',
          'A rank score is low for small circuits and high for matrix products.',
          'Claimed: n to the root n, both ways.', V_MAIN)),
 '136': dict(
  plain='Finding a balance point stays hard even if the answer may be wrong in a fixed fraction of places',
  proof=P('reduction', [
    'Draw each path of the line puzzle as a curve in a box',
    'Store each point with codes that survive many errors',
    'Build a circuit that nudges points along the curves',
    'Any near-solution, even with broken gates, is an end'],
    **R('End-of-Line', 'encoded paths', 'robust local tests', 'circuit')),
  voice=V('Fixed points, robustly hard.',
          'Finding equilibria is hard. Does it stay hard if some answers may be wrong?',
          'Paths become coded curves that survive errors, so near answers still find an end.',
          'Claimed: yes, with little blow-up.', V_NONE)),
 '137': dict(
  plain='A machine with one tape: replay any run of $T$ steps using only about $T^{2/5}$ cells of scratch memory',
  voice=V('Simulating one-tape time in less space.',
          'Last year, time t was shown to fit in root t space. One-tape machines had the same barrier.',
          'Claimed: t to the two fifths space, beating the square root barrier.',
          V_NONE)),
 '138': dict(
  plain='Pick numbers from a list that add up to a target: the half-century-old split-in-half method is beaten',
  proof=P('probabilistic', [
    'Random tie-breaks leave at most one exact solution',
    'If there are few distinct sums, split and match',
    'Otherwise, add random spins over near hits',
    "Subtract the false hits; what's left says yes or no"],
    samples=40, threshold=0.4, mean=0.7, thresholdLabel='zero', label='what is left'),
  voice=V('Subset Sum, beaten.',
          'Split the list in half and match: the record since nineteen seventy four.',
          'Random spins over near hits, minus the false ones, reveal a solution.',
          'Claimed: two to the point four nine n.', V_NONE)),
 '139': dict(
  plain='Drawing random samples from a smooth bell-shaped cloud in huge dimension needs almost no gradient queries',
  proof=P('reduction', [
    'Blur the target with a little random noise',
    'Each blurred piece is an almost bell-shaped problem',
    'Solve those by nesting cheap averages inside each other',
    'Then undo the blur, step by step'],
    **R('target', 'add noise', 'near-bell solver', 'remove noise', arrow='then')),
  voice=V('Sampling a bell curve, nearly free.',
          'Sampling a smooth bell-shaped cloud usually costs a power of the dimension.',
          'Blur the target, solve near-bell pieces by nesting averages, then unblur.',
          'Claimed: d to any epsilon queries suffice.', V_MAIN)),
 '140': dict(
  plain='Learning from exact measurements with limited memory: below a threshold, you pay for it with extra data',
  proof=P('monotone', [
    'At the end, success means the guess hits a tiny target',
    'Walk the learner backward, one block of samples at a time',
    'Each block widens the target by only a fixed factor',
    'So reaching a fair chance takes many blocks'],
    label='distance to a fair chance', floorLabel='fair chance'),
  voice=V('Memory versus samples.',
          'With d squared bits, d samples solve regression. With less memory, what does it cost?',
          'Walking back block by block, each block helps only a fixed amount.',
          'Claimed: an extra log factor is unavoidable.', V_MAIN)),
 '141': dict(
  plain='Deciding whether polynomial equations have a real solution is easier than known: it comes down to counting',
  proof=P('reduction', [
    'Turn the question into a polynomial hitting zero',
    'A good choice sits at roots of polynomials we can find',
    'Give each needed root a short label',
    'Guess the labels and check them by counting'],
    **R('real sentence', 'zero of a polynomial', 'short root labels', 'counting checks')),
  voice=V('Real equations, decided by counting.',
          'Graph drawing and network training reduce to real equations. The bound was polynomial space.',
          'Roots get short labels, which are guessed and checked by counting.',
          'Claimed: inside the counting hierarchy, level twenty six.', V_NONE)),
 '142': dict(
  plain='Split a polynomial into its prime pieces without coin flips, in polynomial time, resting on a companion paper',
  proof=P('reduction', [
    'Factoring reduces to finding small helper primes',
    'A companion paper claims such primes are small',
    'With them in hand, pure algebra splits the polynomial'],
    **R('factor $f$', 'small helper primes', 'algebra splits it')),
  voice=V('Factoring polynomials without coin flips.',
          'Randomized factoring is routine. Without coins it was open, even under the Riemann hypothesis.',
          'Small helper primes, from a companion paper, let algebra split the polynomial.',
          'Claimed, conditional on that companion.', V_NONE)),
}
