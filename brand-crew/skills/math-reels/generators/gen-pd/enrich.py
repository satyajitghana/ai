# Reel enrichment for the probability / dynamics families: the plain-words
# line, the proof scene (archetype + 2-4 plain steps) and the narration.
# common.spec() merges ENRICH[fid] into each spec; with a proof scene the
# object scene is rescaled to OBJ_WITH_PROOF seconds so the reel stays <= 21 s.
#
# Proof ideas come only from the review's explainer/claim, the article's
# section, or the manuscript's own abstract/overview. Families whose proof
# idea could not be stated honestly in plain steps carry no `proof`:
#   149 (no method stated beyond the absorbing set itself), 217, 218, 219,
#   225, 226, 227, 230, 231, 232, 233, 234.

OBJ_WITH_PROOF = 6.2

V_MAIN = 'Checked in Lean.'
V_PART = 'Lean covers part.'
V_NONE = 'Not machine checked.'


def _lines(scene, text):
    # a voice line is at most 96 characters: split a longer one at sentence ends
    import re
    if len(text) <= 96:
        return [{'scene': scene, 'text': text}]
    parts = re.split(r'(?<=[.?!])\s+', text)
    for x in parts:
        if len(x) > 96:
            print('VOICE LINE TOO LONG:', x)
    return [{'scene': scene, 'text': x} for x in parts]


def v(title, obj, proof, ach, verify):
    out = _lines('title', title) + _lines('object', obj)
    if proof:
        out += _lines('proof', proof)
    out += _lines('achievement', ach) + _lines('verify', verify)
    return out


def red(boxes, steps, arrow=None):
    d = {'boxes': boxes}
    if arrow:
        d['arrow'] = arrow
    return {'archetype': 'reduction', 'steps': steps, 'data': d}


ENRICH = {
    # ------------------------------------------------------------ dynamics --
    '143': {
        'plain': 'Some flows swirl into closed loops; Hilbert asked whether the degree of the formula caps how many',
        # explainer: return map as a chain of local passages; each auxiliary system has finitely many
        # isolated solutions even with coefficients free; compactness of coefficient space -> one bound per degree
        'proof': {'archetype': 'local-to-global', 'steps': [
            'Follow a path once around a loop, as a chain of short local passages',
            'Each local piece has finitely many solutions, even as the formula varies',
            'Compactness glues the pieces into one bound for each degree'],
            'data': {'cols': 4, 'rows': 2, 'patchLabel': 'local passages near singular points',
                     'label': 'one bound $B(d)$ per degree'}},
        'voice': v("Hilbert's sixteenth problem.",
                   'How many loops can a polynomial flow have? Lean checks the quintic case: two at most.',
                   'Split each loop into local passages, bound each piece, then glue by compactness.',
                   'Claimed: a bound for every degree.', V_PART)},
    '144': {
        'plain': 'Stir a box smoothly: can one pattern, stirred again and again, spell out every other pattern exactly once?',
        # explainer: limit of smooth conjugated twists whose Fourier signals are transported so that
        # one observable's orbit becomes orthonormal and complete
        'proof': {'archetype': 'construction', 'steps': [
            'Start from simple smooth twists of the three-dimensional torus',
            "Conjugate each new twist so the signal's pieces line up",
            'In the limit, one orbit is a complete set of perpendicular directions'],
            'data': {'pieces': [{'label': 'twist', 'role': 'smooth'}, {'label': 'twist', 'role': 'conjugated'},
                                {'label': 'twist', 'role': 'conjugated'}, {'label': '$\\cdots$', 'role': 'in the limit'}],
                     'result': 'one orbit $f \\circ T^n$: an orthonormal basis'}},
        'voice': v("Banach's question, answered.",
                   'Shift one pattern over and over: the copies are perpendicular, and they fill everything.',
                   'Built as a limit of smooth twists, each nudged so the copies line up.',
                   "Claimed: Banach's simple spectrum, realized smoothly.", V_MAIN)},
    '145': {
        'plain': 'Stir cream into coffee: two far-apart moments look independent. Does that make three moments independent too?',
        # explainer + article: least failing order k, reduce to a zero-entropy process whose proper
        # marginals are independent, show such a joining must be product: contradiction
        'proof': {'archetype': 'contradiction', 'steps': [
            'Suppose some order of mixing fails, and take the smallest one',
            'Boil it down to a simple process whose smaller groups already decouple',
            'Show such a process must decouple fully: a contradiction'],
            'data': {'assume': 'smallest failing order $k$', 'smaller': 'a zero-entropy process',
                     'impossible': 'it must be a product'}},
        'voice': v("Rokhlin's multiple mixing problem.",
                   'Mixing makes two distant events independent. Rokhlin asked whether three or more must follow.',
                   'Take the smallest failing order, simplify it, and show it cannot fail at all.',
                   'Claimed: yes, for every order.', V_MAIN)},
    '146': {
        'plain': 'Kick a spinning rotor harder and harder: is its chaos real on a sizable region, or confined to thin cracks?',
        # explainer: Pesin's formula -> entropy = integral of positive Lyapunov exponent -> derivative
        # growth on a positive-area set, controlling losses near the lines where cos 2 pi x vanishes
        'proof': red(['positive entropy', 'stretching on a positive area', 'control losses near the critical lines'], [
            "Pesin's formula turns entropy into a rate of stretching",
            'So show nearby points pull apart on a region of positive area',
            'Control the stretching lost near the lines where it stalls']),
        'voice': v('Chaos in the standard map.',
                   'Kick a rotor harder and harder. Pictures show a chaotic sea, but islands kept blocking proofs.',
                   'Entropy equals the stretching rate, so prove stretching on a sizable region.',
                   'Claimed: positive entropy for every large kick.', V_MAIN)},
    '147': {
        'plain': 'On a curved pool table, if paths near the rim all hug neat nested loops, the table must be an ellipse',
        # abstracts of the two papers: continuous foliation -> analytic boundary and analytic caustic
        # collar (twist inequalities, then stationary polygonal chains) -> companion rigidity -> ellipse
        'proof': red(['continuous collar of invariant curves', 'analytic boundary and collar of caustics', 'an ellipse'], [
            'Twist inequalities force the invariant curves to be neat graphs',
            'Bouncing chains then force the boundary to be analytic',
            'A companion paper shows the table must be an ellipse']),
        'voice': v('A billiard rigidity theorem.',
                   'Bouncing paths in an ellipse keep touching nested curves, a whole collar near the edge.',
                   'First the curves become graphs, then the edge becomes analytic, then an ellipse.',
                   'Claimed: only the ellipse has such a collar.', V_NONE)},
    '148': {
        'plain': 'Pick shrinking maps at random, over and over: how thick is the dust you land on, even when choices overlap?',
        # explainer + article: compare a finite law's exact entropy with its entropy at a grid scale;
        # hidden information is witnessed by fair two-point laws at finer scales; condition on block counts
        'proof': red(['dimension drop', 'hidden entropy at a grid scale', 'fair two-point laws at finer scales'], [
            'Compare the randomness seen at a coarse grid with its exact value',
            'Any hidden loss must show up as fair coin flips at finer scales',
            "Fix each block's shrink rate, and the formula follows"]),
        'voice': v('Dimension of self-similar measures.',
                   'Apply random shrinking maps forever. Exact overlaps waste randomness; the claim is nothing else does.',
                   'Lost randomness must show up as fair coin flips at finer scales.',
                   'Claimed: dimension is entropy over contraction.', V_MAIN)},
    '149': {
        'plain': 'In a chemical soup where every reaction can be undone, no ingredient runs out or piles up without limit',
        'voice': v('Chemical networks never run dry.',
                   'Imagine a chemical soup. If every reaction can be undone, no species dies out or explodes. Every path enters one safe region.',
                   None,
                   'Claimed: both conjectures proved, for fixed rate constants.', 'Lean covers only part of it.')},
    '150': {
        'plain': 'A ball bouncing forever in a triangle: does it end up visiting every spot, in every direction, equally?',
        # explainer + article: unfolding reflections gives straight lines on a flat surface with cone
        # points; the low-regularity issue is handled by the Forni-Moll analytic framework
        'proof': red(['billiard in a triangle', 'unfold the reflections', 'straight lines on a flat surface with cone points'], [
            'Unfold each bounce by reflecting the table instead of the ball',
            'The path becomes a straight line on a flat surface with corners',
            'An analytic framework for such surfaces gives even spreading']),
        'voice': v('Billiards in a triangle.',
                   'A ball bounces in a triangle. With an irrational angle, does it fill the table evenly?',
                   'Unfold the bounces into straight lines on a flat surface with corners.',
                   'Claimed: yes, in every such triangle.', V_PART)},
    '151': {
        'plain': 'A map that doubles a hidden count every step, yet whose points never spread apart: growth without chaos',
        # explainer + article: one sphere coordinate usually squares (factor 2 on H_2), a circle clock
        # slows near one reading, auxiliary sphere registers store small signals that cancel the winding
        'proof': {'archetype': 'construction', 'steps': [
            'One sphere mostly squares, doubling a count in homology',
            'A circle clock slows almost to a stop near one reading',
            'Extra spheres store small signals that hide the growth'],
            'data': {'pieces': [{'label': 'squaring sphere', 'role': 'eigenvalue 2 on $H_2$'},
                                {'label': 'circle clock', 'role': 'can stall'},
                                {'label': 'register spheres', 'role': 'store small signals'}],
                     'result': 'zero entropy, yet homology doubles'}},
        'voice': v("A counterexample to Shub's conjecture.",
                   'Shub predicted topological growth forces chaos. Here a sphere doubles, yet nothing spreads.',
                   'A squaring sphere, a stalling clock and small stored signals hide the growth.',
                   'Claimed: a C one counterexample, noninvertible.', V_MAIN)},
    '152': {
        'plain': 'Some abstract shuffles can be played by a smooth machine; here is a calm one that no smooth machine can play',
        # paper 1: the proof isolates a property of smooth positive volume that survives an arbitrary
        # measurable change of coordinates, and constructs a zero-entropy system without it
        'proof': {'archetype': 'counterexample', 'steps': [
            'Find a test every smooth volume-preserving map passes, in any disguise',
            'Build a zero-entropy system, stage by stage, that fails it',
            'So it has no smooth model, on any compact manifold'],
            'data': {'items': 6, 'breakAt': 5, 'label': 'no smooth model',
                     'caption': 'systems with a smooth volume model pass the test'}},
        'voice': v('Zero entropy, no smooth model.',
                   'Infinite entropy was the only known obstacle. This system has zero entropy, yet no smooth model.',
                   'A test every smooth model passes, in any disguise; this system fails it.',
                   'Claimed: a counterexample, on every compact manifold.', V_PART)},
    '153': {
        'plain': 'Flip a coin forever, adding or subtracting ever smaller steps: when does the landing spot pile up on dust?',
        # explainer: link singularity to approximation by special algebraic units; verify that
        # approximation for quartic Salem numbers
        'proof': red(['singular law', 'approximation by special algebraic units', 'verified at quartic Salem numbers'], [
            'Link singularity to how well $\\lambda$ is approximated by special units',
            'For quartic Salem numbers, check that the approximation holds',
            'So the law is singular there too, beyond the Pisot numbers']),
        'voice': v('Singular Bernoulli convolutions beyond Pisot.',
                   'Add or subtract powers of lambda at random. Erdős: Pisot numbers make the law singular.',
                   'Singularity becomes an approximation question, which they check for quartic Salem numbers.',
                   'Claimed: singular at every quartic Salem number.', V_NONE)},
    '154': {
        'plain': 'Take readings at evenly spaced times, multiply and average them: does that average always settle down?',
        # explainer: mixing identifies the limit (via Rokhlin multiple mixing); convergence from an
        # oscillation estimate for the trilinear Hilbert transform transferred to the system
        'proof': red(['the multiple averages', 'limit: product of integrals', 'convergence: an oscillation bound'], [
            "Rokhlin's multiple mixing pins down what the limit must be",
            'A harmonic-analysis bound, moved into the system, forces convergence']),
        'voice': v('Pointwise multiple ergodic averages.',
                   'Average readings at times k, two k, three k. Does that settle at almost every start?',
                   "Rokhlin's mixing theorem names the limit; a harmonic analysis bound forces convergence.",
                   'Claimed: yes, for every mixing system.', V_NONE)},

    # --------------------------------------------------------- probability --
    '211': {
        'plain': 'Glue random triangles into a crumpled ball: what shape does it take as the pieces become tiny?',
        # explainer: the whole picture for spherical FK maps, including the hardest piece (graph
        # distances), and then random walk on them becomes Liouville Brownian motion
        'proof': red(['map with loops $\\to$ LQG sphere with CLE', 'graph distances converge', 'random walk $\\to$ Liouville Brownian motion'], [
            'Show the decorated map converges to a random fractal surface',
            'Then show its graph distances converge too, the hardest piece',
            'Finally, random walk on it becomes Liouville Brownian motion']),
        'voice': v('Random planar maps.',
                   'Random triangles glued with loops. Below q equals four: Liouville gravity; above, a tree.',
                   'First the surface converges, then its distances, and finally random walks on it.',
                   'Claimed: the whole picture that physicists predicted.', V_PART)},
    '212': {
        'plain': 'Random travel times on a city grid: can a single fastest route run forever in both directions?',
        # explainer: Busemann functions along rays, rays confined in sectors, a label budget on
        # horizontal lines and finite perturbations: any bigeodesic yields a contradiction
        'proof': {'archetype': 'contradiction', 'steps': [
            'Suppose a fastest route runs forever in both directions',
            'Busemann functions trap its two ends inside narrow sectors',
            'A budget of labels on each horizontal line runs out: impossible'],
            'data': {'assume': 'a bigeodesic', 'smaller': 'its ends trapped in sectors',
                     'impossible': 'the label budget runs out'}},
        'voice': v('No bigeodesics in the plane.',
                   'Give every street a random travel time. Could one fastest route run forever in both directions?',
                   'Assume one exists; trap its ends, and a label budget runs out.',
                   'Claimed: none exist, almost surely.', V_PART)},
    '213': {
        'plain': 'Open each pipe in a huge grid by a coin flip: right at the tipping point, can water flow forever?',
        # explainer + article: infinite cluster at p_c -> finitely many crossing estimates persist at some
        # q < p_c -> gluing + adaptive exploration builds an infinite cluster below p_c: contradiction
        'proof': {'archetype': 'contradiction', 'steps': [
            'Suppose an infinite cluster exists exactly at the threshold',
            'Finitely many crossing estimates then survive slightly below it',
            'Relay gluing builds an infinite cluster below threshold: impossible'],
            'data': {'assume': 'an infinite cluster at $p_c$', 'smaller': 'the same at some $q < p_c$',
                     'impossible': 'impossible below $p_c$'}},
        'voice': v('No percolation at criticality.',
                   'Keep each edge with probability p. Exactly at the threshold, can an infinite cluster exist?',
                   'If it could, it would also exist slightly below the threshold, which is impossible.',
                   'Claimed: never, on every such graph.', V_MAIN)},
    '214': {
        'plain': 'On a branching, tree-like network, can many endless clusters live side by side before merging into one?',
        # explainer + article: bound the critical two-point operator on l2 (weighted trace averaging
        # the root), show the l2 threshold is strictly above p_c, which gives non-uniqueness
        'proof': red(['bounded operator at $p_c$', '$p_c < p_{2\\to 2}$', '$p_c < p_u$'], [
            'Bound the critical connection operator directly, averaging the root',
            'Show its own threshold sits strictly above $p_c$',
            'Known arguments then give many infinite clusters at once']),
        'voice': v('Two thresholds, not one.',
                   'On a tree-like graph, raise p. Many infinite clusters should appear before they merge into one.',
                   'Bound one operator at the threshold, then push its threshold strictly higher.',
                   'Claimed: the window exists on every such graph.', V_MAIN)},
    '215': {
        'plain': 'Tiny arrows on a grid that like to align: do they lose track of each other with distance, however cold?',
        # explainer + article: rotation (Ward) identities on an annulus with a twist; a fourth derivative
        # gives a nonnegative square controlling the twist; only a sign-cluster crossing probability is left
        'proof': red(['twist a square annulus', 'a nonnegative square controls the twist', 'only a sign-cluster crossing is left'], [
            'Twist the spins between an inner and an outer ring by an angle',
            'Rotation identities turn the response into a nonnegative square',
            'Only a crossing probability is left, and it is small']),
        'voice': v("Polyakov's mass gap.",
                   'Arrows that like to align. With three or more components, correlations should die off fast.',
                   'Twist a ring of spins; rotation identities turn the response into a square.',
                   'Claimed: exponential decay at every temperature.', V_PART)},
    '216': {
        'plain': 'Little compass needles on a grid melt into disorder through swirling vortices; how exactly does it happen?',
        # explainer: proves the fine details via the dual integer-height model and its Gaussian scaling limit
        'proof': red(['XY spins', 'dual integer heights', 'Gaussian free field limit'], [
            'Trade the spins for a dual model of integer heights',
            'Show those heights look like a Gaussian free field at large scales',
            'Read the fine corrections off that Gaussian limit']),
        'voice': v("The X Y model, exactly.",
                   'Compass needles on a grid. At criticality, correlations fade as a power, with a slow log.',
                   'Swap spins for integer heights, which look Gaussian at large scales.',
                   'Claimed: the predicted fine structure.', V_NONE)},
    '217': {
        'plain': 'Two random batches of the same magnetic alloy differ slightly in energy; how big is that wobble as they grow?',
        'voice': v('Spin glass free energy fluctuations.',
                   'Draw the random couplings again and the free energy shifts a little. Physicists predicted the spread grows like n to the one sixth.',
                   None,
                   'Claimed: variance grows like n to the one third.', V_NONE)},
    '218': {
        'plain': 'Shake the bonds of a grid magnet slightly at random: does its critical boundary still trace the same curve?',
        'voice': v('Ising universality with weak disorder.',
                   'Make each bond of a grid magnet slightly random. The exact methods need the clean model, yet the interfaces should not care.',
                   None,
                   'Claimed: the same random curves survive weak random bonds.', 'Lean covers only one lemma.')},
    '219': {
        'plain': 'In a network where every node has three links, do vibration frequencies space out like a fully random system?',
        'voice': v('The eigenvalues of random regular graphs.',
                   'Each node has three neighbours, so locally it looks like a tree. Yet its eigenvalues should repel like a dense random matrix.',
                   None,
                   'Claimed: true for every fixed degree, three or more.', V_NONE)},
    '220': {
        'plain': 'A walker on a grid of randomly tilted floor tiles: if it drifts away, must it drift at a steady speed?',
        # explainer + article: regeneration times (moments after which the walk never returns below a
        # height record); show their durations have finite mean
        'proof': {'archetype': 'local-to-global', 'steps': [
            'Cut the path at moments it never drops back below a new record',
            'Show each piece lasts a finite time on average',
            'Stitched together, the pieces give a steady positive speed'],
            'data': {'cols': 4, 'rows': 1, 'patchLabel': 'regeneration pieces of the path',
                     'label': 'positive speed'}},
        'voice': v('Escape implies speed.',
                   'In one dimension traps let a walker escape at zero speed. Not in two or more?',
                   'Cut the path at record moments; each piece has finite average length.',
                   'Claimed: escaping forces a positive speed.', V_MAIN)},
    '221': {
        'plain': 'A magnet of randomly linked tiny spins: physicists guessed its energy long ago; this proves the guess',
        # article: upper bound by interpolation known (Panchenko-Talagrand 2004); the lower bound comes
        # from delaying each replica split by one level
        'proof': {'archetype': 'squeeze', 'steps': [
            "The physicists' formula was already known to be an upper limit",
            'The new proof pushes up a matching lower limit',
            'Upper meets lower: the formula is exact'],
            'data': {'lower': {'from': 0.1, 'v': 0.55, 'label': 'new lower bound'},
                     'upper': {'v': 0.55, 'label': 'known upper bound (interpolation)', 'tone': 'soft'},
                     'upperStep': 0, 'lowerStep': 1,
                     'target': {'v': 0.55, 'label': 'the Mézard–Parisi value'}}},
        'voice': v('The Mézard Parisi formula.',
                   'Spins on a sparse random graph. The formula was long known as an upper bound.',
                   'Delay each replica split by one level to prove the matching lower bound.',
                   'Claimed: the formula is exact.', V_MAIN)},
    '222': {
        'plain': 'Pack a simple neural network to capacity and it jams like sand; physics predicted the exact jamming exponents',
        # article: the paper certifies the exponent intervals with a finite numerical computation
        # and error bounds
        'proof': {'archetype': 'squeeze', 'steps': [
            'Physics predicted the exponents; the paper proves the laws they govern',
            'A finite computation with error bounds caps the exponent from below',
            'and from above, pinning it inside a tiny certified interval'],
            'data': {'lower': {'from': 0.08, 'v': 0.5, 'label': 'certified lower bound'},
                     'upper': {'from': 0.92, 'v': 0.56, 'label': 'certified upper bound'},
                     'lowerStep': 1, 'upperStep': 2,
                     'target': {'v': 0.53, 'label': '$\\gamma$, in a tiny interval'}}},
        'voice': v('Perceptron jamming exponents.',
                   'Pack a simple neural network to capacity and it jams like sand, with predicted exponents.',
                   'A certified computation with error bounds pins each exponent inside a tiny interval.',
                   'Claimed: the predicted exponents, to seven digits.', V_PART)},
    '223': {
        'plain': 'Colour the bonds of a grid at random; the border between colours traces a random curve of a famous shape',
        # explainer + abstract: finite connection comparisons and a boundary observable that determines
        # the Loewner driving function
        'proof': red(['finite connection comparisons', 'a boundary observable', 'Loewner driver $\\to \\mathrm{SLE}_\\kappa$'], [
            'Compare connection probabilities on finite pieces of the lattice',
            'Build a boundary observable that pins down how the curve grows',
            'That growth rule is the one for SLE, so the interface converges']),
        'voice': v('Cardy on the square lattice.',
                   'The square grid has no exact formula, yet its boundaries should become conformal random curves.',
                   "Compare finite connections, then read the curve's growth rule from a boundary observable.",
                   'Claimed: every q up to four.', V_NONE)},
    '224': {
        'plain': 'Scatter random seeds and colour each cell by a coin flip: does a path cross with the odds of a perfect grid?',
        # article + abstracts: annealed Cardy first; the other two papers take Cardy as input
        # (pivotal count, then near-critical universality matching the triangular lattice)
        'proof': red(["Cardy's formula, averaged", 'count pivotal cells', 'near-critical laws match the triangular lattice'], [
            "First prove Cardy's crossing formula, averaged over random tilings",
            'Use it to count the cells where one flip changes a crossing',
            'Then match the near-critical laws to the triangular lattice']),
        'voice': v('Voronoi percolation obeys Cardy.',
                   'Random cells, each coloured by a coin flip. No lattice, yet crossings should follow Cardy.',
                   'Prove Cardy on average, then count pivotal cells, then match the triangular lattice.',
                   "Claimed: Cardy's formula, averaged over tilings.", V_NONE)},
    '225': {
        'plain': 'Square ice: arrows on a grid define a random landscape; zoomed out, it should look like smooth Gaussian noise',
        'voice': v('Six-vertex heights become Gaussian noise.',
                   'Ice rules on a square grid define a random height landscape. Zoomed out, physics says it looks like a Gaussian free field.',
                   None,
                   'Claimed: the whole range, with the variance physics predicted.', 'No Lean; a single manuscript.')},
    '226': {
        'plain': 'Stack two random domino tilings: the overlap draws loops. What do those loops look like from far away?',
        'voice': v('Double dimers and random loops.',
                   'Overlay two random domino tilings and you get loops. Zoomed out, physicists expect them to become C L E four.',
                   None,
                   'Claimed: the loops converge curve by curve, in the half plane.', 'No Lean; one short manuscript.')},
    '227': {
        'plain': 'A computer flips one tiny magnet at a time to sample a spin glass: how fast does it forget where it started?',
        'voice': v('Spin glass dynamics at the transition.',
                   'The standard sampler flips one spin at a time. Fast mixing was known only for beta below one quarter.',
                   None,
                   'Claimed: fast mixing for every beta below one, and slowdowns beyond.', 'Lean covers only part.')},
    '228': {
        'plain': 'Can a gas of particles that only push and pull in pairs be proved to change phase, the way water freezes?',
        # explainer: designs a radial pair potential where a packing structure forces a kink in the
        # free energy at one temperature; an existence proof, not natural potentials
        'proof': {'archetype': 'construction', 'steps': [
            'Design a pair force: a hard core plus a narrow attractive band',
            'A packing structure built into it forces a sudden switch',
            'That switch puts a kink in the free energy at one temperature'],
            'data': {'pieces': [{'label': 'repulsive core', 'role': 'no collapse'},
                                {'label': 'attractive band', 'role': 'favours a packing'},
                                {'label': 'weak tail', 'role': 'decays fast'}],
                     'result': 'a kink at one $\\beta_c$'}},
        'voice': v('A continuum phase transition.',
                   'Lattices have proven phase transitions; particles moving freely in space had none proved.',
                   'Engineer a pair force whose built-in packing structure forces a kink at one temperature.',
                   'Claimed: a kink, for designed potentials.', V_MAIN)},
    '229': {
        'plain': 'Whisper a colour down a family tree with errors at each step: can the far leaves still reveal the root?',
        # review/article: above Kesten-Stigum reconstruction always works (the classical half, the one
        # Lean covers); the new part is non-reconstruction at and below the bound
        'proof': {'archetype': 'squeeze', 'steps': [
            'Above the Kesten–Stigum bound, guessing the root was known to work',
            'New: at or below it, the leaves carry no usable signal',
            'So the bound is exactly the threshold, for 3 and 4 colours'],
            'data': {'upper': {'from': 0.92, 'v': 0.55, 'label': 'possible above (known)', 'tone': 'soft'},
                     'lower': {'from': 0.08, 'v': 0.55, 'label': 'impossible at and below (new)'},
                     'upperStep': 0, 'lowerStep': 1,
                     'target': {'v': 0.55, 'label': '$d\\lambda^2 = 1$ is exact'}}},
        'voice': v('Exact thresholds on trees.',
                   'Pass a colour down a noisy tree. Can the far leaves reveal the root?',
                   'Above the bound it works; the new part shows it fails at and below.',
                   'Claimed: exact for three and four colours.', V_PART)},
    '230': {
        'plain': 'A random fractal curve is too wiggly for ordinary length; which exact ruler gives it a finite, nonzero size?',
        'voice': v('Measuring random fractal curves exactly.',
                   'These random curves are fractals, too wiggly for ordinary length. Schramm asked which exact measuring rule gives them a true length.',
                   None,
                   'Claimed: a power with an iterated log correction.', 'Lean covers only the positive half.')},
    '231': {
        'plain': 'Can one local recipe, run everywhere at once from independent coin flips, build a random spanning forest?',
        'voice': v('Spanning forests built from coin flips.',
                   'A uniform spanning forest connects a network without loops. Lyons asked whether one local rule can build it from independent coin flips.',
                   None,
                   'Claimed: yes, on every such graph, with no root.', V_MAIN)},
    '232': {
        'plain': 'Random terrain where neighbouring heights differ by at most one step: zoomed out, is it Gaussian noise?',
        'voice': v('Lipschitz heights become a Gaussian field.',
                   'Random heights on a triangular grid, with neighbours at most a step apart. Zoomed out, do they look like a Gaussian free field?',
                   None,
                   'Claimed: yes, for three versions of the model.', 'No Lean; three manuscripts.')},
    '233': {
        'plain': 'Two linked magnets on one grid; at the critical point their joint pattern should match one random landscape',
        'voice': v('The critical Ashkin Teller model.',
                   'Two Ising magnets coupled on one square grid. On its critical line the model is described by a Gaussian free field.',
                   None,
                   'Claimed: heights and both cluster families converge together, at every depth.', V_NONE)},
    '234': {
        'plain': 'A magnet whose links are a random rotation of any fixed pattern: what is its energy, at any temperature?',
        'voice': v('Spin glasses with rotation invariant couplings.',
                   'Pick any spectrum, then rotate it by a random orthogonal matrix. The couplings stop being independent, which broke all the usual tools.',
                   None,
                   'Claimed: an explicit free energy formula at every temperature.', V_MAIN)},
    '235': {
        'plain': 'Random logic puzzles flip from solvable to unsolvable at a critical density; can that point be computed?',
        # explainer: computability comes from certificates on both sides that a fair search can enumerate
        'proof': {'archetype': 'squeeze', 'steps': [
            'Certificates of solvable formulas push a lower bound up',
            'Certificates of unsolvable ones push an upper bound down',
            'A fair search lists both, so the threshold can be computed'],
            'data': {'lower': {'from': 0.08, 'v': 0.55, 'label': 'lower certificates'},
                     'upper': {'from': 0.92, 'v': 0.55, 'label': 'upper certificates'},
                     'lowerStep': 0, 'upperStep': 1,
                     'target': {'v': 0.55, 'label': '$\\alpha_3$ is computable'}}},
        'voice': v('Random sat thresholds, computable.',
                   'Add random constraints and puzzles suddenly become unsolvable. Gaia Carenini proved this sharp threshold first.',
                   'Certificates from both sides close in, so the threshold is computable.',
                   'Claimed: linear variance, and a computable threshold.', V_MAIN)},
    '236': {
        'plain': 'Can magnetic spins on an endless branching tree be generated by one local rule from independent coin flips?',
        # review + paper: the strict converse (beyond the reconstruction threshold) is known (Sly, Lyons);
        # the construction proves the positive direction, including equality
        'proof': {'archetype': 'squeeze', 'steps': [
            'Past the threshold, no recipe from coin flips can work (known)',
            'The new proof builds one at every temperature up to the line',
            'Including exactly on it, so the threshold is exact'],
            'data': {'upper': {'from': 0.92, 'v': 0.55, 'label': 'impossible beyond (known)', 'tone': 'soft'},
                     'lower': {'from': 0.08, 'v': 0.55, 'label': 'a rule up to the line (new)'},
                     'upperStep': 0, 'lowerStep': 1,
                     'target': {'v': 0.55, 'label': '$\\tanh\\beta = 1/\\sqrt{d-1}$'}}},
        'voice': v('Ising trees from coin flips.',
                   'Each child spin copies its parent, with bias. Can one rule build them from coin flips?',
                   'Known impossible beyond the line; the new proof builds a rule up to it.',
                   'Claimed: possible exactly up to the line.', V_MAIN)},
    '237': {
        'plain': 'A path that never crosses itself, like a snake in a maze: how far does an n-step one reach?',
        # explainer + article: sharp strip and cylinder partition-function exponents, then a renewal
        # argument from all-length critical measures to fixed-length walks
        'proof': red(['strip crossings', 'cylinder partition functions', 'fixed-length walks'], [
            'Measure walks crossing strips and wrapping cylinders, by exponents',
            'A renewal argument moves from all lengths to one fixed length',
            'So an $n$-step walk spreads to about $n^{3/4}$']),
        'voice': v('The three quarters exponent.',
                   'A walk that never crosses itself should spread like n to the three quarters.',
                   'Exponents for strips and cylinders transfer, by renewal, to fixed-length walks.',
                   'Claimed: three quarters, on the honeycomb lattice only.', V_PART)},
    '238': {
        'plain': 'Shuffle by pairing cards and flipping a coin for each pair: how many rounds until the order is truly random?',
        # article: two-stage transfer - most labels' joint positions near uniform, then partial
        # information controls the Fourier transform of the full law
        'proof': red(['most cards placed at random', 'Fourier bounds on the full law', 'the whole deck uniform'], [
            "After enough rounds, most cards' joint positions look random",
            "That partial information controls the deck's Fourier transform",
            'So the whole deck mixes in a number of rounds proportional to $d$']),
        'voice': v('The Thorp shuffle mixes fast.',
                   'Cut the deck, then flip a coin for each pair. Older proofs needed d cubed rounds.',
                   'Most cards randomize first; Fourier analysis then lifts that to the whole deck.',
                   'Claimed: order d shuffles suffice.', V_MAIN)},
    '239': {
        'plain': 'Fill a mirror-symmetric grid with random plus and minus ones: how likely is it to collapse flat?',
        # explainer: two equal rows give about 2^-n; paper: reduce singularity probability to the
        # expected size of a set of possible new columns, controlled by a potential
        'proof': {'archetype': 'squeeze', 'steps': [
            'Two equal rows already make it singular: about half to the n',
            'Reveal it column by column, bounding the bad new columns',
            'Both bounds meet: nothing else matters at exponential scale'],
            'data': {'lower': {'from': 0.08, 'v': 0.55, 'label': 'two equal rows'},
                     'upper': {'from': 0.92, 'v': 0.55, 'label': 'column-by-column bound'},
                     'lowerStep': 0, 'upperStep': 1,
                     'target': {'v': 0.55, 'label': '$(1/2 + o(1))^n$'}}},
        'voice': v('Singular random sign matrices.',
                   'A symmetric grid of random plus and minus signs. Two equal rows make it singular.',
                   'Reveal it column by column, and show other failures are rarer still.',
                   'Claimed: one half to the n, nothing more.', V_NONE)},
}

TIME_KEYS = {'at', 'dur', 'edgeAt', 'edgeDur', 'sweepAt', 'sweep', 'stagger'}


def _scale(o, f, panel=False):
    if isinstance(o, list):
        return [_scale(x, f) for x in o]
    if not isinstance(o, dict):
        return o
    out = {}
    for k, v in o.items():
        if isinstance(v, (int, float)) and not isinstance(v, bool) and (k in TIME_KEYS or (panel and k in ('from', 'until'))):
            out[k] = round(v * f, 2)
        elif k == 'panels':
            out[k] = [_scale(p, f, panel=True) for p in v]
        elif k == 'terms':  # equation terms: names map to dicts
            out[k] = {n: _scale(t, f) for n, t in v.items()}
        else:
            out[k] = _scale(v, f)
    return out


def apply(s):
    e = ENRICH.get(s['id'])
    if not e:
        return s
    s['plain'] = e['plain']
    if 'proof' in e:
        s['proof'] = e['proof']
        obj = s['object']
        if obj['dur'] != OBJ_WITH_PROOF:
            f = OBJ_WITH_PROOF / obj['dur']
            obj = _scale(obj, f)
            obj['dur'] = OBJ_WITH_PROOF
            s['object'] = obj
    s['voice'] = e['voice']
    return s


# ---- narration budget, mirroring voice.mjs (estimate = words/3 + 0.25) -----
DUR_PROOF = {'title': 2.5, 'proof': 5.5, 'achievement': 3.5, 'verify': 2, 'end': 1.2}
DUR = {'title': 2.6, 'achievement': 4.4, 'verify': 2.6, 'end': 1.6}
DMAX = {'title': 3, 'object': 9, 'proof': 6, 'achievement': 5, 'verify': 3}


def budget(spec):
    P = 'proof' in spec
    durs = dict(DUR_PROOF if P else DUR)
    durs['object'] = spec['object']['dur']
    if P:
        durs['proof'] = spec['proof'].get('dur', 5.5)
    need = {}
    for l in spec.get('voice', []):
        w = len(l['text'].split())
        s = l['scene']
        need[s] = need.get(s, 0.3 - 0.15) + 0.15 + w / 3 + 0.25
    msgs = []
    for s, r in need.items():
        r += 0.25
        if r > durs[s] + 1e-9:
            import math
            nd = math.ceil(r * 10 - 1e-6) / 10
            msgs.append(f'{s} {durs[s]}->{nd}')
            durs[s] = nd
    total = sum(durs.values())
    words = sum(len(l['text'].split()) for l in spec.get('voice', []))
    return words, round(total, 2), msgs
