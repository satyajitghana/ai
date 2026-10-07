# Reel enrichment for the analysis / PDE / convex / functional-analysis families:
# plain line, proof idea, narration, and object-scene timing. One source of truth:
#   - gen-cmg/common.py and gen-366-377.py call apply() inside write();
#   - apply_direct.py applies it in place to the other specs (071-086, 322-332, 362-365).
# apply() is idempotent: object timings are rescaled from the current object.dur.
import re

PROOF_OBJ_DUR = 6.0
VERIFY = {'main': 'Main theorem Lean-checked.', 'part': 'Lean checks part.', 'none': 'No Lean proof.'}

def P(arch, steps, **data):
    return {'archetype': arch, 'steps': steps, 'data': data}

def con(*pieces, result=None):
    d = {'pieces': [p if isinstance(p, dict) else {'label': p} for p in pieces]}
    if result: d['result'] = result
    return d

E = {}
def add(id, plain, proof, voice, obj=None, patch=None):
    E[id] = dict(plain=plain, proof=proof, voice=voice, obj=obj, patch=patch)

# ---------------------------------------------------------------- 071-086 analysis
add('071', "Can any region full of holes, even infinitely many, be bent without tearing so every hole turns round?",
    P('construction', ["Solve finitely many holes at a time, where Koebe's method works",
                       "Low-energy barriers squeeze the tiny holes down to points",
                       "A period argument stops the round holes bulging in the limit"],
      **con({'label': 'finitely many holes', 'role': "Koebe's case"}, {'label': 'energy barriers', 'role': 'tiny holes become points'},
            {'label': 'period argument', 'role': 'round holes stay round'}, result='a circle domain in the limit')),
    ["Can every hole be round?", "A region with wild holes. Bend it, and each hole becomes a disk or point.",
     "Solve finitely many holes, then let energy barriers shrink the rest to points.", "Claimed: every domain has a round model."])
add('072', "Squash a wild shape onto a disk without tearing: how violently can the squashing pile up near the edge?",
    P('contradiction', ["Suppose some map compresses area faster than the conjecture allows",
                        "Turn that growth rate into a random law over normalized maps",
                        "Its saddle points and peaks cannot pair up: contradiction"],
      assume='a map that grows too fast', smaller='a random law on maps', impossible='saddles and peaks cannot pair up'),
    ["Brennan's conjecture, from nineteen seventy-eight.", "How badly can a conformal map squeeze area? The range stalled near three point four.",
     "Assume a map squeezes too fast; its saddles and peaks cannot pair up.", "Claimed: the full range, up to four."])
add('073', "If a cloud of dust is more than 'half as thick' as space, must its distances fill a whole stretch of lengths?",
    P('induction', ["Bound how often pairs of points line up in each direction",
                    "Refine scale by scale, tracking how the mass spreads out",
                    "A potential pays for every step, so distances fill an interval"],
      levels=5, labels=['cap bounds', 'scale 2', 'scale 3', 'scale 4', '$\\cdots$'], step='each scale paid for by a potential'),
    ["Falconer's problem, every dimension.", "A fractal dust of points. Over half-dimensional? Then its distances should fill an interval.",
     "Scale by scale, a two-depth potential pays for every step of the recursion.", "Claimed: half the dimension suffices, everywhere."])
add('074', "Turn a needle to point every way inside one set: can that set stay thin, or must it fill the space?",
    P('contradiction', ["In 3D, suppose thin tubes overlap as badly as possible",
                        "That forces a rigid, unmoving stack of planes and plates",
                        "Entropy gains and projections break it: no such overlap"],
      assume='a worst-case tube overlap', smaller='a rigid stack of planes', impossible='it breaks'),
    ["The Kakeya needle problem.", "A needle in every direction, packed tight. Must the set fill all the space?",
     "A worst overlap of tubes would force a rigid stack, which breaks.", "Claimed: full dimension in four, maximal in three."])
add('075', "Rebuild a jagged signal from pure tones: for which signals does the rebuilding settle almost everywhere?",
    P('reduction', ["Reduce the sums to one estimate on a tree of dyadic intervals",
                    "Treat each frequency guess as a noisy observation of the input",
                    "An entropy budget caps the total cost, so the sums converge"],
      boxes=['partial Fourier sums', 'a dyadic tree estimate', 'an entropy budget']),
    ["Fourier series, almost everywhere.", "Square-integrable signals converge; merely integrable ones can fail. Where is the line?",
     "Reduce to a dyadic tree, then cap the total cost with an entropy budget.", "Claimed: L log L signals converge almost everywhere."])
add('076', "Pick a plus or minus sign for each term so the sum's size stays almost perfectly level around a circle",
    P('construction', ["Build a smooth curve of constant size from short wave pieces",
                       "Make its coefficients almost plus or minus the same size",
                       "Round them to exact signs without spoiling the flatness"],
      **con({'label': 'quadratic-phase waves', 'role': 'size near 1'}, {'label': 'fit the coefficients', 'role': 'each near $\\pm 1/\\sqrt N$'},
            {'label': 'round to signs', 'role': 'discrepancy theory'}, result='an ultraflat $\\pm 1$ polynomial')),
    ["Ultraflat sign polynomials exist.", "Plus and minus one coefficients. Their size averages root N; experts doubted it stays level.",
     "Build a flat curve from wave pieces, then round its coefficients to signs.", "Claimed: flat within any margin you like."])
add('077', "How concentrated can a wave launched from a curved surface stay, far away? The sharp answer in 3D",
    P('construction', ["Measure how wave packets can bunch up: an 'elliptic capacity'",
                       "Show that capacity spreads along lines instead of piling up",
                       "Add decoupling, and the Kakeya estimate for general surfaces"],
      **con({'label': 'elliptic capacity', 'role': 'tracks bunching'}, {'label': 'spreads along lines', 'role': 'Furstenberg, entropy'},
            {'label': 'decoupling', 'role': 'splits the waves'}, result='every $p > 3$')),
    ["Fourier restriction in three dimensions.", "Waves off a curved surface. The human record was twenty-two sevenths; the conjecture says three.",
     "Track how packets bunch up; that capacity spreads along lines.", "Claimed: every exponent above three, for curved surfaces."])
add('078', "Keep only the frequencies inside a ball, softening the edge a little: is the result always well behaved?",
    P('reduction', ["Bound how information about masses on lines grows across scales",
                    "Rule out the worst arrangements using flat projections",
                    "Transfer the bound to waves, with care where packets blur"],
      boxes=['masses moving on lines', 'oscillating wave packets', 'the multiplier bound']),
    ["Bochner–Riesz in three dimensions.", "A sharp cutoff fails; soften its edge. The known range had crept to twenty-two sevenths.",
     "First bound growth for masses moving on lines, then transfer it to waves.", "Claimed: any smoothing works at exponent three."])
add('079', "A wave blurs at any single instant; averaged over a short time window, does it win back its sharpness?",
    P('construction', ["Split the wave into packets, short beams along the light cone",
                       "Control them with square-function bounds from a dimension down",
                       "Bound how packets crowd across scales: only an epsilon is lost"],
      **con('wave packets', 'cone square function', {'label': 'crowding across scales'}, result='a loss of only $\\epsilon$')),
    ["Local smoothing for waves.", "Averaging a wave over time should recover smoothness. The best human result lost one twelfth.",
     "Split the wave into packets and bound how they crowd across scales.", "Claimed: the loss shrinks to any epsilon."])
add('080', "A quantum wave starts from a rough shape: how smooth must that shape be for the wave to return to it?",
    P('construction', ["Packets crossing at angles: a fixed saving, from projection theorems",
                       "Sparse packets and paired frames: bounds with no loss at all",
                       "Sum over frequencies in the right order: the endpoint holds"],
      **con({'label': 'crossing packets', 'role': 'a fixed saving'}, {'label': 'sparse packets', 'role': 'no loss'},
            {'label': 'paired frames', 'role': 'no loss'}, result='the endpoint, $s = 1/3$ in the plane')),
    ["Schrödinger waves, at the endpoint.", "How smooth must data be to return pointwise? Only the endpoint was open.",
     "Combine lossless estimates for crossing, sparse and paired packets, then sum frequencies.", "Claimed: the endpoint, one third in the plane."])
add('081', "If a certain averaging operation stays tame on a set, must the set be built from smooth, nearly flat pieces?",
    P('monotone', ["Measure how far the set strays from its best-fitting plane",
                   "Zoom in a scale: bounded Riesz pairings shrink that distance",
                   "Flatter at every scale, so the set is built from Lipschitz pieces"],
      ylabel='distance from a plane', floorLabel='flat enough'),
    ["Riesz transforms and flatness.", "A piece of a set against its best-fitting plane. Zoom in, and it gets flatter.",
     "At each smaller scale, bounded pairings shrink the distance from a plane.", "Claimed: bounded Riesz transforms mean rectifiable sets."])
add('082', "Three functions, each blind to one direction, tangled in a cycle: can their combined average blow up?",
    P('monotone', ["Write the form as a trace of products of operators",
                   "Attach a nonnegative matrix 'energy' to it",
                   "Heat flow lowers that energy at a rate that bounds the form"],
      ylabel='matrix energy', floorLabel='bounds the form'),
    ["The triangular Hilbert transform.", "Two functions on a triangle, entangled in a cycle. No bound at all was known.",
     "A matrix energy falls under heat flow, and its fall bounds the form.", "Claimed: a bound at the symmetric point."])
add('083', "Average a picture along tiny segments whose direction drifts smoothly from point to point: does it stay tame?",
    P('local-to-global', ["Split the function into frequency bands",
                          "Each band gets a slightly better bound, by a phase-gain iteration",
                          "A Lipschitz commutator glues the bands back together"],
      cols=3, rows=2, patchLabel='frequency bands', label='glued: bounded on $L^2$'),
    ["Stein's conjecture for Lipschitz fields.", "At each point a direction, turning smoothly. Integrate along the short segment at each point.",
     "Bound each frequency band, then glue the bands back with a commutator.", "Claimed: bounded, uniformly, at short scales."])
add('084', "Can a set filling almost all of [0,1] dodge every shifted, shrunken copy of a pattern like 1/2, 1/4, 1/8?",
    P('probabilistic', ["Carve small gaps at random, steered by a tree of coin-flip tables",
                        "Each copy needs only a few scales checked, so a union bound works",
                        "With positive probability, every copy lands a point in a gap"],
      thresholdLabel='a point lands in a gap', label='every copy caught', threshold=0.4, mean=0.72),
    ["Erdős's similarity question.", "Can a big set avoid every shifted copy of one half, one quarter, one eighth?",
     "Random gaps, steered by a tree of coin flips, catch every copy at once.", "Claimed, but for geometric sequences only."])
add('085', "Replace each value of a bumpy surface by its biggest nearby average: does the total steepness stay in check?",
    P('construction', ["At the best radius the average stops changing: a moment identity",
                       "Sweeping tangent disks shows the mass bunches near one point",
                       "So the maximal function's slope stays within $C$ times $f$'s"],
      **con({'label': 'best radius', 'role': 'the average is flat'}, {'label': 'tangent-disk sweep', 'role': 'mass near one point'},
            {'label': 'Poincaré subtraction', 'role': 'removes the rest'}, result='total slope at most $C$ times')),
    ["Maximal functions and total slope.", "Replace each value by the largest average around it. Does the total slope stay bounded?",
     "At the best radius the average is flat; a disk sweep does the rest.", "Claimed, for centered disks in the plane."])
add('086', "Multiply three signals read at evenly spaced points, then average: can the result blow up?",
    P('local-to-global', ["A quadratic inverse theorem finds the hidden curved structure",
                          "Work locally, in charts where that curvature is under control",
                          "Sum the charts over scales without losing a factor each time"],
      cols=3, rows=2, patchLabel='quadratic charts', label='summed over scales, no loss'),
    ["The trilinear Hilbert transform.", "Three functions read at evenly spaced points. Two were tamed in the nineties; three resisted.",
     "Find the curved structure, work chart by chart, and sum without loss.", "Claimed: a first bound, at one exponent."])

# ---------------------------------------------------------------- 087-101 convex & metric
add('087', "Pair a shape with its 'dual' and multiply their volumes: which shape makes that product smallest?",
    P('construction', ["Put the body in position space and its dual in momentum space",
                       "Fit a round symplectic ball of capacity close to four inside",
                       "Symplectic maps keep volume, so the product beats the ball's"],
      **con('$K$ as positions', '$K^\\circ$ as momenta', {'label': 'a round ball fits', 'role': 'capacity near 4'},
            result='so $|K|\\,|K^\\circ| \\ge 4^n/n!$')),
    ["Mahler's volume conjecture.", "A shape and its dual. Push the disk to a square; the volume product falls.",
     "Fit a round ball inside the body times its dual; volume does the rest.", "Claimed: no symmetric body goes lower."])
add('088', "Record the area of every shadow a solid casts: at fixed volume, which shape keeps those shadows smallest?",
    P('reduction', ["Turn the body into a measure on directions",
                    "Split that measure into spherical harmonics, degree by degree",
                    "A good position kills degree two; a sharp bound kills four and up"],
      boxes=['the body $K$', 'a measure on directions', 'harmonics by degree', 'ellipsoids win']),
    ["Petty's projection conjecture.", "Every shadow of a solid, recorded in one body. Petty guessed ellipsoids make it smallest.",
     "Split the body into harmonic pieces and kill each degree in turn.", "Claimed: ellipsoids win, from dimension four up."])
add('089', "Can road distances on any flat network be redrawn as simple cut-and-count distances, warped only a little?",
    P('local-to-global', ["Build random cuts, refining them from coarse scales to fine",
                          "Local formulas glue together exactly at each scale",
                          "So losses never pile up: bounded distortion overall"],
      cols=3, rows=2, patchLabel='scales, coarse to fine', label='losses never pile up'),
    ["Planar graphs into L one.", "A planar graph with edge lengths. Random cuts, mixed together, rebuild all its distances.",
     "Refine random cuts from coarse to fine, gluing exactly at each scale.", "Claimed: bounded distortion, by one universal constant."])
add('090', "Why do vortices, charges and packed disks settle into hexagons? Claim: the hexagonal grid has least energy",
    P('squeeze', ["The triangular lattice's own energy is the value to beat",
                  "A 'magic' function below each Gaussian gives every pattern a floor",
                  "The floor equals the lattice's energy, for every Gaussian at once"],
      min=0, max=1, upper={'from': 0.6, 'v': 0.6, 'label': "the lattice's energy", 'tone': 'soft'},
      lower={'from': 0.08, 'v': 0.6, 'label': 'magic-function floor'}, upperStep=0, lowerStep=1,
      target={'v': 0.6, 'label': 'they meet: optimal'}),
    ["The hexagonal lattice is optimal.", "Six neighbours per point. Is this the lowest energy for every completely monotone interaction?",
     "A magic function sets a floor that exactly meets the lattice's energy.", "Claimed: universally optimal in the plane."])
add('091', "Blend two shapes by a 'geometric' average of their widths: is the blend's area at least the average area?",
    P('reduction', ["Join the two bodies by a path of blended bodies",
                    "Volume along the path reduces to a variance inequality",
                    "Prove that inequality with moment coordinates and a tensor bound"],
      boxes=['volume of the blend', 'a path of bodies', 'a variance inequality']),
    ["The log Brunn–Minkowski inequality.", "Two symmetric boxes, blended geometrically. Its area never falls below their geometric mean.",
     "Follow a path of blended bodies; volume reduces to a variance inequality.", "Claimed: true for all origin-symmetric bodies, every dimension."])
add('092', "Cover space with copies of one shape, overlaps allowed: how much waste is unavoidable for the worst shape?",
    P('probabilistic', ["Carve a symmetric body with many random caps",
                        "Any periodic covering pattern misses many random targets",
                        "So this body needs density of order $n\\log n$, lattice or not"],
      thresholdLabel='a target is missed', label='misses are likely', threshold=0.4, mean=0.72),
    ["Covering space with convex bodies.", "Copies of a shape cover the plane; overlaps are waste. How much waste is unavoidable?",
     "A body carved by random caps defeats every periodic covering.", "Claimed: order n log n, both ways."])
E['092']['proof']['label'] = 'How the lower bound is proved'
add('093', "If a random cloud has thin tails in every direction, is it as tame as a bell curve, in any dimension?",
    P('contradiction', ["Suppose a sequence of such laws makes the constant blow up",
                        "Heat flow and Gaussian channel identities describe its fluctuations",
                        "The two descriptions disagree: no such sequence exists"],
      assume='a worst sequence of laws', smaller='two clashing descriptions', impossible='they cannot both hold'),
    ["A dimension-free log-Sobolev inequality.", "How fast can the constant grow with dimension? Known bounds grew with root n.",
     "Assume a worst case; heat flow describes it in two clashing ways.", "Claimed: one constant, the same in every dimension."])
add('094', "Squeeze many points into few coordinates without warping distances much, in geometries beyond the usual one",
    P('probabilistic', ["Find one well-chosen random law for one-dimensional projections",
                        "Sample coordinates from it independently (Maurey's method)",
                        "Far fewer than $n$ coordinates then keep the distortion fixed"],
      thresholdLabel='distortion $D$', label='random coordinates work', threshold=0.4, mean=0.72),
    ["Dimension reduction beyond Euclidean space.", "n points at fixed distortion. For p below two, the best was linear in n.",
     "Pick a clever random law for projections, then sample coordinates independently.", "Claimed: far fewer coordinates, a sub-polynomial number."])

def _patch_095(spec):
    o = spec['object']
    o['lines'] = [
        {'tex': '\\term{h}{\\Lambda_+(p)} \\;\\overset{?}{=}\\; \\term{s}{\\{\\,x : L(x) \\succeq 0\\,\\}}', 'at': 0.2, 'size': 46,
         'note': 'Generalized Lax: every hyperbolicity cone is a slice of a PSD cone',
         'terms': {'h': {'label': 'hyperbolicity cone', 'tone': 'cool', 'at': 0.4,
                         'visual': {'kind': 'shape', 'shape': 'superellipse', 'p': 3, 'w': 120, 'h': 70, 'tone': 'cool'}},
                   's': {'label': 'slice of a PSD cone', 'tone': 'accent', 'at': 0.9,
                         'visual': {'kind': 'shape', 'shape': 'circle', 'w': 120, 'h': 70}}}},
        {'tex': 'p(X,Z,y) = \\det\\!\\big(\\term{d}{(\\det X)\\,Z} - \\term{c}{\\Phi_y(\\operatorname{adj} X)}\\big)', 'at': 2.8, 'size': 42,
         'note': 'on $S^4 \\times S^4 \\times \\mathbb{R}^3$: 23 variables, degree 20',
         'terms': {'d': {'label': 'a scaled matrix', 'tone': 'cool', 'at': 0.5},
                   'c': {'label': 'the Choi–Lam map', 'tone': 'hot', 'at': 1.0}}}]
add('095', "Optimisation methods run on a big family of cones, long believed to be slices of one standard cone. Not so",
    P('contradiction', ["Suppose some matrix pencil described the cone exactly",
                        "Rescale it and push it to rank-one limits",
                        "That yields a square the Choi–Lam form forbids: contradiction"],
      assume='a PSD pencil for the cone', smaller='a square under Choi–Lam', impossible='Choi–Lam forbids it'),
    ["A counterexample to Lax's conjecture.", "Hyperbolicity cones generalize matrix cones. The counterexample is built from the Choi Lam form.",
     "Any matrix description would yield a square that Choi Lam forbids.", "Claimed: no linear slice of any size."],
    patch=_patch_095)
add('096', "Cut a cloud of random points into pieces and add up how off-centre each piece is: three blades win",
    P('reduction', ["Reduce any partition to finitely many linear scores",
                    "Up to four active pieces: handled by known methods",
                    "Five or more: a deletion estimate shows one piece can go"],
      boxes=['any partition', 'finitely many scores', 'at most four pieces', 'the propeller']),
    ["The Gaussian propeller.", "Split a Gaussian cloud; sum each piece's squared centre. Two halves give one over pi.",
     "Reduce to a few pieces; with five or more, one can be deleted.", "Claimed: three blades, nine over eight pi."])
add('097', "Add arrows one after another, flipping some: can you always keep the running total close to where you began?",
    P('induction', ["Track the walk inside a carefully filtered convex body",
                    "Choose each next sign so the walk stays inside it",
                    "Signs then turn into a good ordering of the vectors"],
      levels=5, labels=['first sign', 'sign 2', 'sign 3', 'sign 4', '$\\cdots$'], step='each sign keeps the walk inside'),
    ["Keeping a walk near home.", "Ten unit vectors. Added blindly they drift; chosen signs keep the walk near zero.",
     "Pick each sign to stay inside a body, then turn signs into an order.", "Claimed: within C root d, always."])
add('098', "A shape that looks finite-dimensional at every zoom level, yet fits faithfully into no finite space",
    P('construction', ["Start from a plane; lift points in new perpendicular directions",
                       "Coloured strips at sparse scales decide where each lift goes",
                       "Any map into $\\mathbb{R}^k$ would crowd too many points into a ball"],
      **con('a base plane', {'label': 'perpendicular lifts', 'role': 'at sparse scales'}, {'label': 'coloured strips', 'role': 'steer the lifts'},
            result='doubling, yet in no $\\mathbb{R}^k$')),
    ["Doubling, but no finite home.", "Doubling: every ball is covered by few half-size balls. Surely such sets fit somewhere finite?",
     "Stack perpendicular lifts on a plane; any embedding then crowds too many points.", "Claimed: no embedding, at any distortion."])
add('099', "How well can 'number of typing edits between two words' be mimicked by a simple sum of differences?",
    P('amplify', ["Build words in levels, with parts cycling at different prime periods",
                  "At each level, sums of cuts lag behind edit distance",
                  "The lag compounds across levels, matching the known embedding"],
      k=2, levels=3, unit='one level of nested words', label='the lag compounds level by level'),
    ["Edit distance, sharply pinned down.", "The best distortion, against string length. For twenty years, a gap between the bounds.",
     "Nest words level by level; the lag against cuts compounds each time.", "Claimed: the old embedding is essentially optimal."])
add('100', "Wrap a pyramid in straight tubes: must the tubes' total cross-section be at least half its smallest shadow?",
    P('construction', ["Start from the two cylinders that meet the bound exactly",
                       "Split them into many cylinders, tilted in nearby directions",
                       "Triangular cross-sections save a second-order sliver of area"],
      **con({'label': 'two cylinders', 'role': 'exactly half (Bang)'}, {'label': 'many directions', 'role': 'tilted slightly'},
            {'label': 'triangular sections'}, result='a second-order saving')),
    ["Covering a tetrahedron with cylinders.", "Two cylinders cover it at exactly half its smallest shadow. Zoom in below one half.",
     "Tilt many cylinders slightly apart; triangular sections save a sliver.", "Claimed: below one half, by a sliver."])
add('101', "Among solid shapes of equal volume, which is the most spread out? The claim: the simplex, a triangle in 2D",
    P('reduction', ["Restate the question as an entropy inequality for random laws",
                    "Transport a Gaussian onto the law, coordinate by coordinate",
                    "Higher-order chaos terms give a spectral gap that closes it"],
      boxes=['isotropic constant', 'an entropy inequality', 'Gaussian transport', 'a spectral gap']),
    ["The simplex is the extreme.", "A disk, a square, a triangle of equal area. Computed exactly, the triangle spreads most.",
     "Restate it as entropy, transport a Gaussian, and use a spectral gap.", "Claimed: the simplex, in every dimension."])

# ---------------------------------------------------------------- 322-332 functional analysis
add('322', "If a map keeps every distance on the surface of a ball, must it come from a rigid map of the whole space?",
    P('contradiction', ["Measure the worst distance error between different radii",
                        "If positive, push it to an invariant convex set by a fixed point",
                        "Convexity then forbids it: the error is zero"],
      assume='a largest distance defect', smaller='an invariant convex set', impossible='convexity forbids it'),
    ["Tingley's sphere problem.", "Two unit spheres, a map keeping their distances. Must it come from a linear map?",
     "A positive defect would be pushed to a set where convexity kills it.", "Claimed: always, in every Banach space."])
add('323', "Does every infinite space have a small, countable-sized shadow? The answer depends on the rules of set theory",
    P('construction', ["Under CH, build a space from a tree indexed by countable ordinals",
                       "Its path functionals leave no room for a small quotient",
                       "With a measurable continuum instead, every space has one"],
      **con({'label': 'a tree of countable ordinals', 'role': 'under CH'}, 'path functionals', 'a perturbed predual',
            result='no separable quotient')),
    ["Independent of set theory.", "Small subspaces always exist. Small quotients? Under one axiom, no; under another, always yes.",
     "Under the continuum hypothesis, a tree-built space has no small quotient at all.", "Claimed: independent, given a measurable cardinal."])
add('324', "Two spaces you can bend into each other with bounded stretching, yet no straight-line map matches them",
    P('construction', ["Build a near-isometric bending of Hilbert space",
                       "Linearize it on the Lipschitz-free space",
                       "Assemble two graph spaces: only one contains $c_0(\\ell_2)$"],
      **con({'label': 'a gentle bending', 'role': 'nearly isometric'}, {'label': 'linearize it', 'role': 'on the free space'},
            {'label': 'two graph spaces', 'role': 'one has $c_0(\\ell_2)$'}, result='equivalent, not isomorphic')),
    ["Same metric, different spaces.", "A bijection stretching every distance by a bounded factor. Must the spaces then match linearly?",
     "Bend Hilbert space slightly, linearize, and build two different graph spaces.", "Claimed: not necessarily, even for separable spaces."])
add('325', "A matrix's 'numerical range' controls its polynomials up to a factor 2, even with matrix coefficients",
    P('construction', ["Expand the Cauchy kernel in Faber polynomials",
                       "A positive kernel keeps each coefficient between weights 1 and 2",
                       "Compare two orderings, so matrix coefficients never commute"],
      **con({'label': 'Faber expansion', 'role': 'of the Cauchy kernel'}, {'label': 'a positive kernel', 'role': 'weights 1 to 2'},
            {'label': 'two diagonal functionals', 'role': 'no commuting needed'}, result='the constant 2')),
    ["Crouzeix's conjecture, in complete form.", "This matrix: one eigenvalue, zero, but a disk of numerical range. Two is sharp.",
     "Expand in Faber polynomials and bound the coefficients with a positive kernel.", "Claimed: constant two, even with matrix coefficients."])

def _patch_326(spec):
    o = spec['object']
    o['lines'] = [
        {'tex': 'X \\text{ K-convex} \\iff X \\not\\supseteq \\term{l}{\\ell_1^n} \\text{ uniformly}', 'tone': 'soft', 'at': 0.3, 'size': 36, 'y': 0.03,
         'terms': {'l': {'label': 'spiky $\\ell_1$ balls', 'tone': 'hot', 'at': 0.6, 'side': 'below', 'size': 17,
                         'visual': {'kind': 'shape', 'shape': 'regular', 'n': 4, 'w': 90, 'h': 62, 'dx': 290, 'dy': -96, 'tone': 'hot'}}}},
        {'tex': 'X \\text{ K-convex} \\;\\Rightarrow\\; \\mathrm{cotype}(X),\\ \\mathrm{cotype}(X^*) < \\infty', 'tone': 'soft', 'at': 1.9, 'size': 36, 'y': 0.33,
         'note': 'classical'},
        {'tex': '\\term{c}{\\mathrm{cotype}(X),\\ \\mathrm{cotype}(X^*) < \\infty} \\;\\term{a}{\\overset{\\text{AP}}{\\Longrightarrow}}\\; \\term{k}{X \\text{ K-convex}}',
         'tone': 'accent', 'at': 3.4, 'size': 36, 'y': 0.6,
         'terms': {'c': {'label': 'finite cotype, both sides', 'tone': 'cool', 'at': 0.4},
                   'a': {'label': 'with AP', 'tone': 'warn', 'mark': 'arrow', 'side': 'below', 'at': 0.9},
                   'k': {'label': 'no uniform copies', 'tone': 'accent', 'mark': 'box', 'at': 1.4}}}]
add('326', "When do a space and its mirror image both stay clear of 'spiky' shapes? Under a mild approximation rule",
    P('contradiction', ["Walsh transforms of finite-rank operators decay, whatever the rank",
                        "The approximation property carries that decay to the whole space",
                        "Uniform copies of $\\ell_1^n$ would stop the decay: contradiction"],
      assume='copies of $\\ell_1^n$ for all $n$', smaller='decay, free of rank', impossible='they cannot coexist'),
    ["The cotype–cotype conjecture.", "K-convex means no uniform copies of l one n. Does cotype on both sides suffice?",
     "A decay of Walsh transforms, free of rank, rules out the uniform copies.", "Claimed: yes, under the approximation property."],
    patch=_patch_326)
add('327', "If random walks inside a space never spread faster than ordinary diffusion, must the space be nicely round?",
    P('contradiction', ["Suppose the space is not superreflexive",
                        "Then build reversible walks that travel in a straight line",
                        "Straight-line travel breaks Markov type: contradiction"],
      assume='not superreflexive', smaller='a walk that travels linearly', impossible='Markov type fails'),
    ["Markov type and roundness.", "A random walk in a space. Markov type says it spreads no faster than diffusion.",
     "Without superreflexivity, random walks travel in straight lines, which breaks Markov type.", "Claimed: nontrivial Markov type forces superreflexivity."])
add('328', "Stir a bowl without ever pulling two points apart: must some point stay put? Here, in any reflexive space",
    P('contradiction', ["Take a smallest invariant set with no fixed point",
                        "Build a tree of averages of nearly fixed points",
                        "Along one branch a vector appears that weak compactness forbids"],
      assume='a smallest set, no fixed point', smaller='a tree of averages', impossible='weak compactness forbids it'),
    ["Kirk's fixed point problem.", "Rotating a disk moves no two points apart. Does reflexivity alone guarantee a fixed point?",
     "A smallest bad set yields a tree whose branch breaks compactness.", "Claimed: yes, in every reflexive Banach space."])
add('329', "Count the cubes needed to cover a shape, then do the same for the 'dual' shapes: the counts can differ wildly",
    P('construction', ["Build a matrix of nearly 0 and 1 entries from finite-field forms",
                       "Its rows sit far apart, so covering them takes many cubes",
                       "Yet its columns' hull has a short list: the dual count is small"],
      **con('a near 0-1 matrix', {'label': 'rows far apart', 'role': 'many cubes needed'},
            {'label': 'columns easy to list', 'role': 'dual count small'}, result='duality fails')),
    ["Entropy duality fails.", "Polarity swaps bodies; the cube's dual is the diamond. Pietsch guessed coverings survive it.",
     "Rows sit far apart, but the columns are easy to list: the counts split.", "Claimed: they differ by any factor."])
add('330', "Even when all points sit at least a step apart, approximating the space can need ever bigger tools",
    P('construction', ["Build blocks from big graphs with random-like colourings",
                       "Anchor points force any small operator to miss by a half",
                       "Wedge the blocks together: approximation works, but not boundedly"],
      **con({'label': 'block $M_p$', 'role': 'coloured graphs'}, {'label': 'anchor points', 'role': 'miss by a half'},
            {'label': 'wedge all blocks', 'role': 'at one base point'}, result='AP, but no bounded AP')),
    ["Approximation, but without any bounds.", "Blocks of points at least one apart, ever farther away. Each defeats small operators.",
     "Each block's anchors defeat small operators; wedged together, no bound survives.", "Claimed: approximation works, but never with a bound."])
add('331', "Keep splitting every link of a network into two paths: in this new space, those 'diamonds' can't lie flat",
    P('construction', ["Build the norm from square sums along segments of growing trees",
                       "Long root paths rule out any AUC renorming",
                       "A test at first exits gives the midpoint gain: diamonds distort"],
      **con('trees of growing height', {'label': 'square sums', 'role': 'James-style norm'},
            {'label': 'first-exit test', 'role': 'midpoint gain'}, result='diamonds distort')),
    ["Diamonds that won't flatten.", "A diamond: each edge becomes two paths, depth by depth. Here they need growing distortion.",
     "Square sums on growing trees block one norm and force the distortion.", "Claimed: a reflexive space where diamonds distort."])
add('332', "A stretch-limited map from part of a space into city-block distances can be extended to the whole space",
    P('construction', ["Write city-block points as weighted cuts: vectors of 0s and 1s",
                       "Average them along a randomly stopped walk",
                       "Round with a cubic that is flat at 0 and 1, then map back"],
      **con('points as weighted cuts', {'label': 'a stopped random walk', 'role': 'averages them'},
            {'label': 'the cubic $3r^2-2r^3$', 'role': 'flat at 0 and 1'}, result='Markov cotype 2')),
    ["Extending maps into L one.", "Ball reduced extending Lipschitz maps to two random walk inequalities. L one was open.",
     "Write points as cuts, average along a walk, round with a cubic.", "Claimed: L one has Markov cotype two."])

# ---------------------------------------------------------------- 362-377 PDE
add('362', "Charged particles steered by their own fields: can one be kicked to infinite momentum in finite time?",
    P('induction', ["Bound the kick a particle gets over a short time window",
                    "So each doubling of momentum takes at least time $c/n$",
                    "Those times add up to infinity: no finite-time blowup"],
      levels=5, labels=['$P$', '$2P$', '$4P$', '$8P$', '$\\cdots$'], step='each doubling takes time'),
    ["Plasma without blowup.", "A bound on each particle's kick. So each doubling of momentum takes real time.",
     "Each doubling takes longer than c over n; those times sum to infinity.", "Claimed: smooth for all time, any data."])
add('363', "Start a gas in one exact state, and the equations allow two different futures",
    P('construction', ["Build a gas of cold jets on a hot background, at shrinking scales",
                       "In one future a rare collision triggers a branching cascade",
                       "In the other it does not: two solutions from one start"],
      **con({'label': 'cold jets', 'role': 'on a hot background'}, 'ever smaller scales',
            {'label': 'a rare cap event', 'role': 'cascade, or not'}, result='two solutions, one start')),
    ["One gas, two futures.", "Boltzmann solutions exist forever. Are they fixed by their start? Cold jets say no.",
     "A rare collision cascade happens in one future and not the other.", "Claimed: two distinct global solutions, one start."])
add('364', "Many particles bumping like billiard balls: for how long does a smooth averaged equation describe them?",
    P('reduction', ["Follow particles in whole interacting clusters, not single collisions",
                    "Expand over those clusters, allowing brief attractions",
                    "The expansion holds while Boltzmann's solution stays regular"],
      boxes=["Newton's laws", 'clusters of particles', "Boltzmann's equation"]),
    ["From particles to Boltzmann's equation.", "How long do particles follow Boltzmann's equation? Hard spheres reached the regular lifespan.",
     "Expand over whole clusters of interacting particles, not over single binary collisions.", "Claimed: the same, for smooth stable potentials."])
add('365', "Measure voltages and currents on one small patch of a body's skin: can you tell what is inside?",
    P('local-to-global', ["Match harmonic coordinates near the measured patch",
                          "Extend the match outward, across one surface at a time",
                          "Shrinking-sphere estimates carry it through the whole body"],
      cols=3, rows=2, patchLabel='outward from the measured patch', label='the metric, everywhere'),
    ["Calderón's problem, one patch.", "Do boundary measurements determine the inside? Claimed: data on one patch fix a smooth metric.",
     "Match coordinates at the patch, then extend outward surface by surface.", "Claimed: one patch suffices, dimension three up."])
add('366', "Split a photo into smooth regions plus edges, as cheaply as possible: the edges come out tidy",
    P('contradiction', ["Everything reduces to one case: a floating island of edge",
                        "Its energy interaction is harmonic in position, hence constant",
                        "So the field vanishes, and deleting the island saves length"],
      assume='an island of edge', smaller='a constant interaction', impossible='deleting it saves length'),
    ["Mumford and Shah's conjecture.", "Segment an image into smooth parts and edges. Decades reduced the question to one island.",
     "The island's energy interaction is constant, so deleting it saves length.", "Claimed: smooth arcs, tips and triple junctions only."])
add('367', "A boundary that settles where energy is least, like a soap film: up to which dimension must it be smooth?",
    P('contradiction', ["Suppose a nonflat minimizing cone exists in dimension 5 or 6",
                        "Pair a Hessian test with a field whose divergence beats its energy",
                        "Exact certificates check the inequality: the cone must be flat"],
      assume='a nonflat cone, $d \\le 6$', smaller='a test that lowers its energy', impossible='it must be flat'),
    ["Critical dimension seven.", "Free boundaries can have singular points. The critical dimension was known: five, six or seven.",
     "A stability test, checked by exact certificates, flattens every cone below dimension seven.", "Claimed: the critical dimension is seven."])
add('368', "Bend a rubber block without tearing: can perfectly smooth bendings copy it just as accurately?",
    P('local-to-global', ["Count how image curves cross a triangulation of the target",
                          "Rebuild the derivative patch by patch, keeping it one-to-one",
                          "Smooth the piecewise-linear result into a diffeomorphism"],
      cols=3, rows=2, patchLabel='patches of the target', label='smooth and one-to-one'),
    ["Smoothing elastic deformations.", "A Sobolev homeomorphism deforms a body like rubber. Convolution smoothing destroys injectivity.",
     "Rebuild the map patch by patch against a triangulation, then smooth the whole result.", "Claimed: settled in three dimensions, the open case."])
add('369', "Heat an insulated plate and wait: do the hottest and coldest spots always end up on the edge?",
    P('contradiction', ["Map the plate conformally onto a disk",
                        "Eigenfunction gradients minimize a div–curl energy",
                        "An interior critical point forces too many of them: impossible"],
      assume='an interior critical point', smaller='too many independent gradients', impossible='impossible'),
    ["The hot spots conjecture.", "Heat an insulated plate and wait. The hottest and coldest points should reach the edge.",
     "An interior critical point would force too many independent eigenfunction gradients.", "Claimed: true for every smooth plate without holes."])
add('370', "Two quantities fuelling each other's growth: below a critical curve, no everywhere-positive balance exists",
    P('contradiction', ["Suppose a positive solution exists below the hyperbola",
                        "A localized virial identity gives a uniform energy bound",
                        "Dilating about the origin breaks that bound: contradiction"],
      assume='a positive solution', smaller='a uniform energy bound', impossible='dilation breaks it'),
    ["The Lane–Emden conjecture.", "The critical hyperbola. Below it, conjecturally, no positive solution exists in any dimension.",
     "Assume a solution; a virial identity bounds its energy, and dilating breaks the bound.", "Claimed: no positive solution, in every dimension."])
add('371', "A wave equation with a repelling force can still blow up, and not by fluke: nearby starts blow up too",
    P('construction', ["Take a large power: the blowup profile becomes a flat core",
                       "Certify its spectrum exactly, then move from all space to a torus",
                       "A degree argument turns one blowup into an open set of them"],
      **con({'label': 'large-power profile', 'role': 'flat core, free outside'}, {'label': 'exact spectrum', 'role': 'certified'},
            {'label': 'degree argument', 'role': 'one to an open set'}, result='blowup on an open set')),
    ["Stable blowup, despite repulsion.", "Defocusing waves in twelve dimensions. Earlier blowups needed a thin set of data.",
     "Take a large power, certify the spectrum exactly, then use a degree argument.", "Claimed: blowup on an open set of data."])
add('372', "Push on an elastic body's surface and feel what pushes back: does that reveal its stiffness inside?",
    P('reduction', ["Glue exact solutions across the boundary; build special waves",
                    "Compare the two bodies with a matrix that varies holomorphically",
                    "Such a matrix must be the identity, so the moduli agree"],
      boxes=['equal boundary data', 'special wave solutions', 'a holomorphic matrix', 'the identity']),
    ["Elastic bodies, seen from outside.", "Push on the boundary, measure what pushes back. Do these data fix both moduli inside?",
     "Special waves give a holomorphic comparison matrix, forced to be the identity.", "Claimed: yes, for any smooth moduli."])
add('373', "Three electrons in a smooth cloud: no rule fixing two of them from the first one is ever optimal",
    P('counting', ["Every optimal plan splits the centre between two families of triples",
                   "A map would send a third of the mass into a piece holding a sixth",
                   "It overflows: no map is optimal, though maps get arbitrarily close"],
      boxes=4, items=5, overflowInto=0, boxLabel='outer pieces', label='more than it can hold'),
    ["No co-motion for three electrons.", "A centre of mass one third, four outer pieces of one sixth. Plans split it.",
     "A map would push a third into a piece holding a sixth.", "Claimed: no optimal map exists."])
add('374', "Move one pile of sand to another as cheaply as possible: nudge the target, and how far does the plan move?",
    P('squeeze', ["Laguerre-cell moments: the map moves at most like a cube root",
                  "Tilting one of three pieces swaps a thin slab: no better exponent",
                  "Squeezed from both sides, the exponent is exactly one third"],
      min=0, max=0.6, lower={'from': 0.02, 'v': 0.3333, 'label': 'proved: at least $1/3$', 'tone': 'cool'},
      upper={'from': 0.5, 'v': 0.3333, 'label': 'tilting example: at most $1/3$'}, lowerStep=0, upperStep=1,
      target={'v': 0.3333, 'label': 'exponent $1/3$'}),
    ["One third, and no better.", "Three pieces sent to three atoms. Tilt the middle one and a thin slab swaps.",
     "An upper bound and a tilting example meet at one third.", "Claimed: one third, not one half."])
add('375', "A smooth boundary between two phases, always rising in one direction: must it be a flat wall, up to 8D?",
    P('reduction', ["Limits along the rising direction are stable, one dimension down",
                    "Every stable solution in seven dimensions is flat",
                    "A blow-down argument then flattens the original"],
      boxes=['monotone in $\\mathbb{R}^8$', 'stable in $\\mathbb{R}^7$', 'flat in $\\mathbb{R}^7$', 'a flat wall']),
    ["De Giorgi's conjecture, dimension eight.", "A solution rising in one direction should be a flat wall. Humans reached dimension four.",
     "Limits are stable one dimension down, where every stable solution is flat.", "Claimed: dimension eight, the last case."])
add('376', "Push a fluid with a cleverly designed force and it computes: a tagged drop arrives only if a program halts",
    P('reduction', ["Encode the machine's tape as numbers, using generalized shifts",
                    "Run each step with smooth shear flows that lose no information",
                    "Read the force off the chosen velocity: the fluid computes"],
      boxes=['a Turing machine', 'a shift on numbers', 'smooth shear flows', 'a force on the fluid']),
    ["A fluid that computes.", "A compiler turns a machine into a force. A tagged particle arrives when it halts.",
     "Encode the tape as numbers, run each step with shear flows.", "Claimed: reaching the region is undecidable, in general."])
add('377', "The 'stretch as little as possible' way to fill in a surface: is its slope continuous in 3 or more dimensions?",
    P('contradiction', ["Suppose the gradient fails to settle at a power rate",
                        "Rescaling then gives a non-affine solution on all of space",
                        "A new Liouville theorem says none exists: contradiction"],
      assume='no good affine fit', smaller='a non-affine entire solution', impossible='Liouville forbids it'),
    ["Infinity-harmonic gradients, continuous.", "Aronsson's example, sliced along one axis. Its gradient behaves like a cube root near zero.",
     "A failure would rescale into a solution that a Liouville theorem forbids.", "Claimed: Hölder gradients in every dimension, three up."])

# ---------------------------------------------------------------- application
TIME_KEYS = {'at', 'dur', 'edgeAt', 'edgeDur', 'cellAt', 'cellStagger', 'stagger', 'flowAt', 'labelAt', 'sweepAt', 'sweep'}

def _scale(v, f, panel_level=False):
    if isinstance(v, list):
        for x in v: _scale(x, f)
    elif isinstance(v, dict):
        for k, x in v.items():
            if isinstance(x, (int, float)) and not isinstance(x, bool) and (k in TIME_KEYS or (panel_level and k in ('from', 'until'))):
                v[k] = round(x * f, 2)
            elif isinstance(x, (dict, list)):
                _scale(x, f)

def rescale_object(obj, new):
    old = obj.get('dur', 8)
    if abs(old - new) < 1e-9: return
    f = new / old
    for b in obj.get('beats', []): b['at'] = round(b['at'] * f, 2)
    if 'panels' in obj:
        for p in obj['panels']: _scale(p, f, panel_level=True)
    else:
        for k, x in obj.items():
            if k in ('dur', 'beats'): continue
            if isinstance(x, (int, float)) and not isinstance(x, bool) and k in TIME_KEYS: obj[k] = round(x * f, 2)
            elif isinstance(x, (dict, list)): _scale(x, f)
    obj['dur'] = new

def apply(spec):
    import os
    if os.environ.get('NO_ENRICH'): return spec
    e = E.get(spec['id'])
    if not e: return spec
    spec['plain'] = e['plain']
    if e['proof']:
        spec['proof'] = e['proof']
        rescale_object(spec['object'], e['obj'] or PROOF_OBJ_DUR)
    if e['patch']: e['patch'](spec)  # after the rescale: patches are timed for the final object.dur
    t, o, p, a = e['voice']
    v = VERIFY[spec['verify']['lean']]
    spec['voice'] = [{'scene': 'title', 'text': t}, {'scene': 'object', 'text': o}] + \
        ([{'scene': 'proof', 'text': p}] if e['proof'] else []) + \
        [{'scene': 'achievement', 'text': a}, {'scene': 'verify', 'text': v}]
    # keep the key order readable: plain after title, proof after object, voice before sources
    order = ['$schema', 'id', 'discipline', 'kind', 'short', 'title', 'plain', 'object', 'proof', 'achievement', 'verify', 'voice', 'sources']
    out = {k: spec[k] for k in order if k in spec}
    out.update({k: v for k, v in spec.items() if k not in out})
    spec.clear(); spec.update(out)
    return spec

def lint():
    vis = lambda s: len(re.sub(r'\$[^$]+\$', 'x', s).replace('==', '').replace('**', ''))
    words = lambda s: len(s.split())
    BUD = {'title': 5, 'object': 15, 'proof': 14, 'achievement': 8}
    bad = []
    for id, e in E.items():
        if vis(e['plain']) > 110: bad.append(f"{id} plain {vis(e['plain'])}")
        for s in e['proof']['steps']:
            if vis(s) > 72: bad.append(f"{id} step {vis(s)}: {s}")
        for sc, t in zip(['title', 'object', 'proof', 'achievement'], e['voice']):
            if words(t) > BUD[sc]: bad.append(f"{id} voice {sc} {words(t)} words: {t}")
            if re.search(r'[$\\{}^_=<>≤≥∞→0-9]', t): bad.append(f"{id} voice symbol: {t}")
            if len(t) > 96: bad.append(f"{id} voice {sc} {len(t)} chars")
        n = sum(words(t) for t in e['voice']) + 3
        if not 40 <= n <= 55: bad.append(f"{id} voice total {n}")
    return bad

if __name__ == '__main__':
    print(len(E), 'entries'); print('\n'.join(lint()) or 'lint ok')
