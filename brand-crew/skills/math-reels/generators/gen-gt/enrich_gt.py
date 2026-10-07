# Enrichment pass for the geometry-topology reels (families 304-321, 333-361):
# plain line, proof scene, narration, visualised equations. Imported by
# gen-gt/gen_a.py, gen_b.py, gen_c.py, ../gen-333-347.py and ../gen-348-361.py
# just before each spec is written, so generator and spec stay in sync.
#
# Proof ideas come only from the review `explainer` fields (reviews/
# geometry-topology.jsonl), the article, or the paper's own overview. Where
# none states a mechanism that fits an archetype honestly, `proof` is omitted
# (336, 337, 345, 353, 357, 360).
import copy, re

OBJ_PROOF = 6.0          # object.dur with a proof scene: 2.5+6+5.5+3.5+2+1.2 = 20.7 s
TK = {'at', 'edgeAt', 'edgeDur', 'sweepAt', 'sweep', 'flowAt', 'cellAt', 'cellStagger', 'stagger'}


def _scale(v, f, depth=0, panel=False):
    """Scale every time inside the object scene by f. Values that share a key
    name with a time (numberline ranges/slide `from`, relation `left.from`) are
    left alone: `from`/`until` are times only on a panel itself."""
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            num = isinstance(x, (int, float)) and not isinstance(x, bool)
            if num and (k in TK or (k == 'dur' and depth > 0) or (panel and k in ('from', 'until'))):
                out[k] = round(x * f, 2)
            elif k == 'panels' and isinstance(x, list):
                out[k] = [_scale(p, f, depth + 2, True) for p in x]
            else:
                out[k] = _scale(x, f, depth + 1)
        return out
    if isinstance(v, list):
        return [_scale(x, f, depth + 1) for x in v]
    return v


def _vis(s):
    return len(re.sub(r'\$[^$]*\$', 'X', s).replace('==', '').replace('**', ''))


def _words(s):
    return len(s.split())


def ctr(items, brk, label, labels=None, caption=None):
    d = {"items": items, "breakAt": brk, "label": label}
    if labels: d["labels"] = labels
    if caption: d["caption"] = caption
    return d


E = {}

# ----------------------------------------------------------------- topology
E["304"] = dict(
    plain="Any group that moves a space around continuously and faithfully is a smooth one, like the rotations of a ball",
    proof=dict(archetype="contradiction", steps=[
        "Every bad case boils down to one kind of infinitely fine symmetry",
        "That symmetry would split one fixed quantity into $p^k$ equal whole parts",
        "Too many equal parts cannot fit the lattice: the action cannot exist"],
        data={"assume": r"a faithful $\mathbb Z_p$-action", "smaller": "$p^k$ equal parts", "impossible": "impossible"}),
    voice=[("title", "Hilbert Smith, in every dimension."),
           ("object", "Known up to dimension three. Everything reduces to the p-adic integers acting faithfully."),
           ("proof", "Such an action would split one quantity into too many equal parts."),
           ("achievement", "Claimed: every such group is a Lie group."),
           ("verify", "Not in Lean.")])

E["305"] = dict(
    plain="Can you always pull discs apart in 4D when the algebra says you can? Here the algebra says yes, wrongly",
    proof=dict(archetype="counterexample", steps=[
        "Build a 4-manifold where every algebraic test for embedding passes",
        "A new invariant records how slices of any filling would have to fit",
        "They cannot fit: no disjoint discs, so $F_2$ is not good"],
        data=ctr(5, 4, "no disjoint discs", ["intersections", "self-int.", "dual spheres", "framings", "discs"],
                 "the usual tests, then the discs")),
    voice=[("title", "Four dimensional disc embedding fails."),
           ("object", "Every algebraic test for disjoint discs passes here, yet no disjoint discs exist at all."),
           ("proof", "A new invariant shows the pieces of any filling cannot fit together."),
           ("achievement", "Claimed: the free group is not good."),
           ("verify", "Not in Lean.")])

E["306"] = dict(
    plain="Cut a knot out of space and glue the tube back with a twist: different twists always give different spaces",
    proof=dict(archetype="contradiction", steps=[
        "Earlier work left one suspect: slopes $+2$ and $-2$ on a genus-two knot",
        "Suppose both gave the same space, and count instantons along the way",
        "One count is nonzero, the other must vanish: impossible"],
        data={"assume": r"slopes $\pm 2$ give the same space", "smaller": "one count: nonzero and zero", "impossible": "impossible"}),
    voice=[("title", "Cosmetic surgery, ruled out."),
           ("object", "Cut out a knot, reglue it with a twist. Earlier work left one suspect pair."),
           ("proof", "Assume they match; one count comes out both nonzero and zero."),
           ("achievement", "Claimed: different twists always give different spaces."),
           ("verify", "Not in Lean.")])

E["307"] = dict(
    plain="A map meant to lose no information about a space's large-scale shape turns out to lose some",
    proof=dict(archetype="construction", steps=[
        "Take finite graphs of bounded degree, short cycles allowed",
        "Add an older trick: a Bott class with a Kazhdan projection",
        "The result has infinite order, yet its index is zero"],
        data={"pieces": [{"label": "finite graphs", "role": "short cycles allowed"},
                         {"label": "Bott class", "role": "borrowed trick", "tone": "soft"},
                         {"label": "Kazhdan projection", "role": "borrowed trick"}],
              "result": "an infinite-order class with index zero"}),
    voice=[("title", "The coarse Novikov conjecture fails."),
           ("object", "Finite graphs of bounded degree, glued into one space. The index map should lose nothing."),
           ("proof", "Graphs plus an older trick give a class whose index vanishes."),
           ("achievement", "Claimed: the index map loses information."),
           ("verify", "Lean: one version.")])

E["308"] = dict(
    plain="Stable shapes are built from basic 'atoms' in layers; atoms in layer four and above were not known to exist",
    proof=dict(archetype="reduction", steps=[
        "Look at all primes at once, in a so-called ultraproduct",
        "There the obstructions become pure algebra, and the tower is built",
        "Only finitely many maps are needed, so they come down to one big prime"],
        data={"boxes": ["$V(n)$ at one prime", "all primes at once", "pure algebra: build it", "one large prime"]}),
    voice=[("title", "Smith Toda complexes, every height."),
           ("object", "Each complex kills one more layer. Whether V four exists anywhere was open."),
           ("proof", "Work across all primes at once, then come down to one large prime."),
           ("achievement", "Claimed: every height, at some prime."),
           ("verify", "Not in Lean.")])

E["309"] = dict(
    plain="Which dimensions allow certain exotic twisted shapes? At the prime three, exactly three candidates survive",
    proof=dict(archetype="contradiction", steps=[
        "Send each class to a detector built from a symmetry of order nine",
        "There, built-in 'deadlines' force classes past index 3 to die",
        "So only indices 0, 2 and 3 survive; index 3 is built by hand"],
        data={"assume": r"$b_j$ survives, $j \ge 4$", "smaller": "a deadline in the detector", "impossible": "it must die"}),
    voice=[("title", "Kervaire at the prime three."),
           ("object", "Candidates b zero and b two survive. The claim settles all of the rest."),
           ("proof", "A detector sets deadlines: later classes must die, b three survives."),
           ("achievement", "Claimed: only zero, two and three survive."),
           ("verify", "Not in Lean.")])

E["310"] = dict(
    plain="If a group has no special normal piece, the web of its small subgroups always encloses a hole",
    proof=dict(archetype="reduction", steps=[
        "Decades of work cut every group down to a few leftover cases at 2",
        "In each leftover case, write down an explicit nonzero cycle",
        "A nonzero cycle is a hole: the poset is not contractible"],
        data={"boxes": ["any finite group", "a few cases at $p = 2$", "explicit nonzero cycles"]}),
    voice=[("title", "Quillen's conjecture, in rational homology."),
           ("object", "Arrange a group's small subgroups by inclusion. For A five, five separate pieces."),
           ("proof", "Old work left a few cases; each one gets an explicit cycle."),
           ("achievement", "Claimed: the shape always has a hole."),
           ("verify", "Not in Lean.")])

E["311"] = dict(
    plain="How many self-contained families can this world of shapes be split into? Exactly $n+2$, as predicted",
    proof=dict(archetype="reduction", steps=[
        "An earlier reduction turned the question into ideals of one ring",
        "Which ideals survive the symmetry group? Track its orbits",
        "Only a chain survives, so the count is exactly $n+2$"],
        data={"boxes": ["thick tensor ideals", "invariant ideals of $E_0$", "stabilizer orbits"]}),
    voice=[("title", "Hovey Strickland and Chai, proved."),
           ("object", "Which ideals of the Lubin Tate ring survive the symmetry? Only a chain."),
           ("proof", "An old reduction turns it into ring ideals; orbits do the rest."),
           ("achievement", "Claimed: exactly n plus two thick ideals."),
           ("verify", "Not in Lean.")])

E["312"] = dict(
    plain="Grothendieck guessed that shapes, up to stretching, are the same as a purely algebraic gadget; this proves it",
    proof=dict(archetype="reduction", steps=[
        "Henry: one step is enough. Adding a cell and a witness changes nothing",
        "The paper tracks every composite this creates, using tree-shaped data",
        "So the step holds, and with it Grothendieck's hypothesis"],
        data={"boxes": ["homotopy hypothesis", "one expansion step", "every composite, via trees"]}),
    voice=[("title", "Grothendieck's homotopy hypothesis, proved."),
           ("object", "Add a cell and a witness linking it to an old one. Nothing should change."),
           ("proof", "Every composite this creates is tracked using tree shaped data, so nothing changes."),
           ("achievement", "Claimed: algebra recovers all spaces."),
           ("verify", "Lean: one step.")])

E["313"] = dict(
    plain="The field's central object has endlessly complex layers; each one is still built from finitely many pieces",
    proof=dict(archetype="reduction", steps=[
        "Compute each group with a descent spectral sequence",
        "Past a fixed line, everything vanishes at a finite stage",
        "So each degree has only finitely many generators"],
        data={"boxes": ["one homotopy group", "descent spectral sequence", "vanishing line", "finitely generated"]}),
    voice=[("title", "Finite generation, finally proved."),
           ("object", "Each cell is a prime and a height. Before, only a corner was known."),
           ("proof", "A descent spectral sequence dies past a fixed line, so finitely many pieces."),
           ("achievement", "Claimed: every group is finitely generated."),
           ("verify", "Not in Lean.")])

E["314"] = dict(
    plain="Climbing up through a group loses some 'resolution'; the loss is exactly the number of simple steps you climb",
    proof=dict(archetype="squeeze", steps=[
        "Chains of cyclic steps already gave an upper bound on the loss",
        "New finite spectra show that much loss really happens",
        "Lower meets upper: the loss equals the chain length"],
        data={"lower": {"from": 0.1, "v": 0.55, "label": "new examples"},
              "upper": {"v": 0.55, "label": "known: chain length", "tone": "soft"},
              "upperStep": 0, "lowerStep": 1, "target": {"v": 0.55, "label": r"$r_n = \ell_{\mathrm{cyc}}$"}}),
    voice=[("title", "Cyclic length is the loss."),
           ("object", "Climb from H to G by cyclic steps. How much height is lost?"),
           ("proof", "The chain bounds the loss; new examples show the bound is reached."),
           ("achievement", "Claimed: the loss equals the shortest chain."),
           ("verify", "Not in Lean.")])

E["315"] = dict(
    plain="Measure the holes of an endlessly unrolled shape, per copy: in four dimensions they all sit in the middle",
    proof=dict(archetype="reduction", steps=[
        "By duality, only one number matters: the first $L^2$-Betti number",
        "Combinatorial group theory shows it is zero for every such group",
        "So everything sits in the middle degree"],
        data={"boxes": ["all $L^2$-Betti numbers", r"$b_1^{(2)} = 0$?", "group theory"]}),
    voice=[("title", "Singer's conjecture in dimension four."),
           ("object", "Measure holes per copy of the unrolled space. By duality, one number matters."),
           ("proof", "Combinatorial group theory shows that first number is zero for every such group."),
           ("achievement", "Claimed: everything sits in degree two."),
           ("verify", "Not in Lean.")])

E["316"] = dict(
    plain="Which patterns can come from wrapping spheres around spheres? Only a famous handful, as Curtis guessed",
    proof=dict(archetype="contradiction", steps=[
        "Suppose some other class came from a map of spheres",
        "Follow it through a chain of related maps, one level at a time",
        "It would force a pattern the algebra forbids: impossible"],
        data={"assume": "another spherical class", "smaller": "a forbidden pattern", "impossible": "impossible"}),
    voice=[("title", "Curtis's conjecture on spheres, proved."),
           ("object", "Which homology classes come from real maps of spheres? Curtis named a short list."),
           ("proof", "Any other class would eventually force a pattern the algebra forbids."),
           ("achievement", "Claimed: only the famous classes reach homology."),
           ("verify", "Not in Lean.")])

E["317"] = dict(
    plain="Can rigid algebraic gadgets, built from arrows between arrows, model every shape? Yes, in every dimension",
    proof=dict(archetype="reduction", steps=[
        "The model structure needs one thing: certain pushouts behave well",
        "The paper proves those pushouts match pushouts of nerves",
        "In every dimension at once, and the result is checked in Lean"],
        data={"boxes": ["model structure", "one pushout condition", "every dimension"]}),
    voice=[("title", "Thomason model structures, every dimension."),
           ("object", "Small categories model every shape. Do strict higher categories, in any dimension, too?"),
           ("proof", "The one missing piece, a pushout condition, is proved in every dimension."),
           ("achievement", "Claimed: yes, for every n, up to omega."),
           ("verify", "Checked in Lean.")])

E["318"] = dict(
    plain="The sphere's layers were predicted to overlap in a simple way; at the third layer, they don't",
    proof=dict(archetype="counterexample", steps=[
        "The prediction holds at heights 1 and 2",
        "At height 3, a natural map would have to vanish on the predicted pieces",
        "It does not vanish on the real sphere, so the prediction fails"],
        data=ctr(3, 2, "the map is nonzero", ["height 1", "height 2", "height 3"], "the strong splitting prediction")),
    voice=[("title", "Chromatic splitting fails."),
           ("object", "Layers of the sphere should overlap simply. True at heights one and two."),
           ("proof", "At height three, a map that should vanish on the prediction does not."),
           ("achievement", "Claimed: it fails for every prime from five."),
           ("verify", "Not in Lean.")])

E["319"] = dict(
    plain="A shape that passes every finiteness test, yet can't be built from the standard bricks in finitely many steps",
    proof=dict(archetype="construction", steps=[
        "Glue standard pieces along an operator with many independent defects",
        "Show no finite run of sums, shifts and cones can produce the result"],
        data={"pieces": [{"label": "standard pieces", "tone": "soft"},
                         {"label": "an operator", "role": "many independent defects", "tone": "soft"},
                         {"label": "$X$", "role": "not finitely built", "tone": "hot"}]}),
    voice=[("title", "Hahn Wilson, disproved."),
           ("object", "Every spectrum of this type was predicted to be finitely built from the standard bricks."),
           ("proof", "Glue bricks along an operator with many defects; no finite build reaches it."),
           ("achievement", "Claimed: true for every large prime."),
           ("verify", "Not in Lean.")])

E["320"] = dict(
    plain="Two four-dimensional spaces that match in every loose, stretchy sense, but can't be matched point for point",
    proof=dict(archetype="contradiction", steps=[
        "A homeomorphism would give a marked filling for an odd cover",
        "Fillings colour plumbing caps red and blue, in alternation",
        "An odd cycle can't be coloured that way: no homeomorphism"],
        data={"assume": "a homeomorphism", "smaller": "an odd cycle, 2-coloured", "impossible": "impossible"}),
    voice=[("title", "Borel fails in dimension four."),
           ("object", "Colour a cycle red and blue, neighbours different. An odd cycle always clashes."),
           ("proof", "A homeomorphism would force a clean colouring of an odd cycle. Impossible."),
           ("achievement", "Claimed: same homotopy type, yet not homeomorphic."),
           ("verify", "Not in Lean.")])

E["321"] = dict(
    plain="A 3D shape that passes every test for being secretly flat, yet can never be flattened",
    proof=dict(archetype="contradiction", steps=[
        "On a 2-complex, if a twisted homology vanishes, the twist fixes torsion",
        "Here it vanishes, yet an element of order 2 is twisted to $-1$",
        "So no 2-complex has this shape: Wall's question fails"],
        data={"assume": "a 2-dimensional model", "smaller": r"$\rho(x_1) = 1$ forced", "impossible": r"but $\rho(x_1) = -1$"}),
    voice=[("title", "Wall's D two problem fails."),
           ("object", "Five generators and four relations. Then a twist kills the twisted second homology."),
           ("proof", "A flat model would force the twist to fix the order two element."),
           ("achievement", "Claimed: no two dimensional model exists."),
           ("verify", "Not in Lean.")])

# ----------------------------------------------------------------- differential geometry
E["333"] = dict(
    plain="Can any curved surface be laid into 4D space with every distance kept exactly? Yes, if it may cross itself",
    proof=dict(archetype="monotone", steps=[
        "Start short: shrink the surface into a tiny sphere in 4D",
        "Add wiggles, each making up some of the missing length",
        "Repeat and smooth: the missing length goes to zero"],
        data={"floor": 0.06, "ylabel": "missing length", "floorLabel": "exact"}),
    voice=[("title", "Surfaces fit in four dimensions."),
           ("object", "Start small, inside a tiny sphere, then add wiggles to make up the missing length."),
           ("proof", "Each round of wiggles shrinks what is missing, until nothing is."),
           ("achievement", "Claimed: every closed surface, exactly isometric."),
           ("verify", "Checked in Lean.")])

E["334"] = dict(
    plain="A smooth rule for distances on a tiny patch that no piece of ordinary 3D surface can follow",
    proof=dict(archetype="counterexample", steps=[
        "Glue infinitely many shrinking patches where the curvature flips sign",
        "Any immersion would give a height function solving one equation",
        "On one patch a saddle argument says it can't: no immersion"],
        data=ctr(6, 4, "no height function", None, "shrinking patches toward the origin")),
    voice=[("title", "No surface in 3D fits."),
           ("object", "Analytic rules always fit near a point. For smooth ones, it was open."),
           ("proof", "Shrinking patches flip curvature; on one, a saddle argument breaks any fit."),
           ("achievement", "Claimed: no neighbourhood fits in three dimensions."),
           ("verify", "Checked in Lean.")])

E["335"] = dict(
    plain="Big, endlessly unrolling shapes like a torus can never curve like a ball everywhere, in any dimension",
    proof=dict(archetype="contradiction", steps=[
        "Suppose such a space had positive curvature; get a map to a sphere",
        "Add warped circles one at a time, shrinking the map at a small cost",
        "Eventually a known obstruction is broken: impossible"],
        data={"assume": "positive scalar curvature", "smaller": "warped circles, a smaller map", "impossible": "impossible"}),
    voice=[("title", "Positive curvature, ruled out."),
           ("object", "Positive scalar curvature makes small balls smaller. Aspherical spaces should never allow it."),
           ("proof", "Reshape the metric circle by circle, until a known obstruction finally breaks."),
           ("achievement", "Claimed: true in every dimension, spin or not."),
           ("verify", "Not in Lean.")])

E["336"] = dict(  # no proof: no mechanism stated in the review; the papers' route is too technical to say honestly
    plain="Curving positively everywhere makes a space thin: it squashes two dimensions down, every squashed piece small",
    voice=[("title", "Positive curvature makes a space thin."),
           ("object", "Squash the manifold onto a skeleton two dimensions lower. Every piece that lands on one point stays uniformly small."),
           ("achievement", "Claimed: true in every dimension, even under the spectral condition."),
           ("verify", "Manuscript only, no Lean yet.")])

E["337"] = dict(  # no proof: the review names the result, not the route
    plain="In a space that curves outward like a saddle, the round ball is still the cheapest way to wrap a volume",
    voice=[("title", "The Cartan Hadamard conjecture, every dimension."),
           ("object", "Of all regions with this volume, the round ball has the least boundary. Known only up to dimension four."),
           ("achievement", "Claimed: saddle shaped spaces never beat flat space, in any dimension."),
           ("verify", "Lean checks the filling part.")])

E["338"] = dict(
    plain="If an endless complex space curves positively in every complex direction, it is plain flat space in disguise",
    proof=dict(archetype="local-to-global", steps=[
        "Run the Kähler–Ricci flow, which evens the curvature out",
        "A new Harnack inequality keeps control, with no curvature bound",
        r"A 'volume clock' builds charts that glue into all of $\mathbb C^n$"],
        data={"cols": 4, "rows": 3, "patchLabel": "chart", "label": r"glued: $\mathbb C^n$"}),
    voice=[("title", "Yau's uniformization conjecture, proved."),
           ("object", "Positive curvature in every complex direction. Every earlier proof needed extra volume growth."),
           ("proof", "A flow and a volume clock build charts that glue into flat space."),
           ("achievement", "Claimed: it is always complex Euclidean space."),
           ("verify", "Not in Lean.")])

E["339"] = dict(
    plain="On a negatively curved space, two natural ways to pick a random path agree only on the most symmetric shapes",
    proof=dict(archetype="reduction", steps=[
        "Suppose the two ways of picking a random geodesic agree",
        "Then the flow's stable and unstable directions must be smooth",
        "A classical theorem then says the metric is locally symmetric"],
        data={"boxes": ["the entropies agree", "smooth foliations", "locally symmetric"]}),
    voice=[("title", "Katok's entropy rigidity, proved."),
           ("object", "Two ways to pick a random geodesic: by volume, or by maximal complexity."),
           ("proof", "If they agree, the flow's directions are smooth, and the metric is symmetric."),
           ("achievement", "Claimed: they agree only on symmetric spaces."),
           ("verify", "Not in Lean.")])

E["340"] = dict(
    plain="A sheet floating in a space of positions and momenta looks exactly like the floor, yet can't be slid onto it",
    proof=dict(archetype="counterexample", steps=[
        "Floer theory showed $L$ matches the base: homotopy, then simple homotopy",
        "The new $L$ matches it even as a smooth shape: it is diffeomorphic",
        "But a finer 'tube' invariant tells $L$ from the zero section"],
        data=ctr(4, 3, "the tube class differs", ["homotopy", "simple homotopy", "diffeomorphic", "tube class"],
                 "what $L$ shares with the base $Q$")),
    voice=[("title", "Nearby Lagrangian conjecture, disproved."),
           ("object", "Arnold expected every such sheet to slide back onto the zero section by a flow."),
           ("proof", "Everything known matches the base, but a finer tube invariant tells them apart."),
           ("achievement", "Claimed: diffeomorphic, yet not slidable back."),
           ("verify", "Not in Lean.")])

E["341"] = dict(
    plain="Three interlocking structures that almost fit perfectly can always be bent until they fit exactly",
    proof=dict(archetype="reduction", steps=[
        "Deform the three forms step by step, keeping their classes fixed",
        "Current estimates from the taming proof keep the path under control",
        "The path ends at a true hyperkähler triple"],
        data={"boxes": ["hypersymplectic triple", "deform, classes fixed", "hyperkähler triple"], "arrow": "deform"}),
    voice=[("title", "Donaldson's hypersymplectic conjecture, proved."),
           ("object", "Three symplectic forms that look hyperkähler, but need not be parallel at all."),
           ("proof", "Deform them with classes fixed; estimates from the taming proof keep it under control."),
           ("achievement", "Claimed: it always reaches a hyperkähler triple."),
           ("verify", "Not in Lean.")])

E["342"] = dict(
    plain="If a twisting rule is roughly respected by some way of measuring area, one that respects it exactly exists",
    proof=dict(archetype="contradiction", steps=[
        "If no compatible form existed, a positive current would block it",
        "An elliptic correction makes that current closed where it is dense",
        "Then it must vanish, contradicting the taming form: impossible"],
        data={"assume": "no compatible form", "smaller": "a blocking positive current", "impossible": "impossible"}),
    voice=[("title", "Donaldson's question: taming implies compatibility."),
           ("object", "Averaging makes the form invariant but breaks closedness. One boundary term decides everything."),
           ("proof", "No compatible form would mean a blocking current, and one estimate rules it out."),
           ("achievement", "Claimed: a compatible form always exists."),
           ("verify", "Checked in Lean.")])

E["343"] = dict(
    plain="Packing balls that may bend but must keep a hidden area: only total volume and a two-ball rule limit you",
    proof=dict(archetype="squeeze", steps=[
        "Volume and Gromov's two-ball rule were known to block some packings",
        "Explicit folded packings fill everything those rules allow",
        "The two meet: nothing else stands in the way"],
        data={"lower": {"from": 0.1, "v": 0.6, "label": "explicit packings"},
              "upper": {"v": 0.6, "label": "volume + two-ball rule", "tone": "soft"},
              "upperStep": 0, "lowerStep": 1, "target": {"v": 0.6, "label": "only two obstructions"}}),
    voice=[("title", "Symplectic ball packing, higher dimensions."),
           ("object", "Balls fit disjointly in a bigger one. Siegel and Yao said two rules matter."),
           ("proof", "Explicit folded packings reach every configuration those two rules allow."),
           ("achievement", "Claimed: only volume and the two ball rule."),
           ("verify", "Checked in Lean.")])

E["344"] = dict(
    plain="On a round globe, every straight path from you stays shortest until the far pole; only a few shapes do this",
    proof=dict(archetype="reduction", steps=[
        "Spheres and real projective spaces were done long ago, by volume",
        "Extend that comparison: the volume must equal the model's",
        "Then equal volume is upgraded to an exact match"],
        data={"boxes": [r"$\mathrm{inj} = \mathrm{diam}$", "volume of the model", "isometric to the model"]}),
    voice=[("title", "The metric Blaschke conjecture."),
           ("object", "On a sphere, every geodesic stays shortest until the antipode. Which spaces share this?"),
           ("proof", "Volume comparison forces the model's volume, and equal volume forces an exact match."),
           ("achievement", "Claimed: only the five symmetric families."),
           ("verify", "Not in Lean.")])

E["345"] = dict(  # no proof: the 'native cut' and degree-interval route has no honest plain-words picture
    plain="On any lumpy sphere, a frictionless marble has infinitely many different closed loops it could follow forever",
    voice=[("title", "Infinitely many closed geodesics, everywhere."),
           ("object", "Closed geodesics on a lumpy sphere. The hard part: telling a new one from an old one traversed again and again."),
           ("achievement", "Claimed: on every sphere and every closed three manifold, infinitely many."),
           ("verify", "Not in Lean.")])

E["346"] = dict(
    plain="Soap films may have creases where sheets meet, but the creases never take up any area",
    proof=dict(archetype="local-to-global", steps=[
        "Zoom in at each point, keeping height and slope information",
        "A unique-continuation step shows the zoomed picture is regular",
        "So singular points are negligible: one dimension lower at most"],
        data={"cols": 4, "rows": 2, "patchLabel": "blow-up", "label": "the singular set is negligible"}),
    voice=[("title", "Varifolds, regular almost everywhere."),
           ("object", "Two crossing planes meet along a line. Can the bad set ever have area?"),
           ("proof", "Zoom in at each point, keeping height and slope, and the picture is regular."),
           ("achievement", "Claimed: never; one dimension lower at most."),
           ("verify", "Not in Lean.")])

E["347"] = dict(
    plain="Arnold said stirring a space fixes as many points as a landscape has peaks and pits; not in the strong form",
    proof=dict(archetype="counterexample", steps=[
        "The homological form of Arnold's bound is a theorem, via Floer theory",
        "The stronger form asks for as many fixed points as critical points",
        "On the quadric threefold: 3 fixed points, but every function needs 4"],
        data=ctr(2, 1, "3 fixed points, 4 needed", ["weak form", "strong form"], "lower bounds for fixed points")),
    voice=[("title", "Arnold's strong bounds fail."),
           ("object", "Arnold: a Hamiltonian map fixes as many points as a function has critical points."),
           ("proof", "Floer theory proves the weak version; here the strong count breaks."),
           ("achievement", "Claimed: three fixed points where functions need four."),
           ("verify", "Lean: one example.")])

E["348"] = dict(
    plain="Four-dimensional spaces curved positively and evenly in every direction are only the three textbook shapes",
    proof=dict(archetype="reduction", steps=[
        "Balance the two halves of the curvature: equal second moments",
        "An exact polynomial inequality then forces one half to vanish",
        "So the curvature is parallel and the space is a standard model"],
        data={"boxes": ["Einstein, $\\sec > 0$", "one Weyl block is zero", "a symmetric model"]}),
    voice=[("title", "Positively curved Einstein four manifolds."),
           ("object", "A volume argument balances the two halves of the Weyl curvature exactly."),
           ("proof", "A polynomial inequality forces one half to vanish, leaving the symmetric models."),
           ("achievement", "Claimed: round sphere, projective space, or Fubini Study."),
           ("verify", "Lean checks part.")])

E["349"] = dict(
    plain="After the equator, which soap-film surface inside a round sphere has the least area? A product of two spheres",
    proof=dict(archetype="induction", steps=[
        "Sweep the sphere with families of surfaces and track the largest",
        "Marques and Neves did this for surfaces; extend it to all dimensions",
        "Climb dimension by dimension, ruling out bad limits"],
        data={"levels": 5, "base": "$m = 2$", "var": "m", "step": "rule out singular limits"}),
    voice=[("title", "The Solomon Yau conjecture."),
           ("object", "The equator is the smallest minimal hypersurface of a round sphere. What comes second?"),
           ("proof", "Sweep with families, then climb dimension by dimension, ruling out bad limits."),
           ("achievement", "Claimed: a Clifford product of two spheres."),
           ("verify", "Not in Lean.")])

E["350"] = dict(
    plain="How long are the still lines on a vibrating drum? On surfaces, as predicted; in higher dimensions, far longer",
    proof=dict(archetype="construction", steps=[
        "On surfaces the bound holds, at the predicted rate",
        "Above that, build wild metrics that trap vibrations in small regions",
        "Glue those into exact modes whose zero sets are far too large"],
        data={"pieces": [{"label": "surfaces", "role": "bound holds", "tone": "ok"},
                         {"label": "trapped vibrations", "role": "localized quasimodes", "tone": "soft"},
                         {"label": "huge nodal sets", "role": "exact eigenfunctions", "tone": "hot"}]}),
    voice=[("title", "Yau's nodal bound, both ways."),
           ("object", "Still lines of a vibrating surface should grow like the square root of the frequency."),
           ("proof", "In higher dimensions, trapped vibrations glue into modes with huge zero sets."),
           ("achievement", "Claimed: true on surfaces, false above."),
           ("verify", "Checked in Lean.")])

E["351"] = dict(
    plain="In 4D, one simple number tells you if a shape-smoothing flow will break; in higher dimensions it can lie",
    proof=dict(archetype="contradiction", steps=[
        "Suppose the flow stops while the scalar curvature stays bounded",
        "Zooming in would show a Ricci-flat 'bubble' carrying the blow-up",
        "In dimension 4 no such bubble exists: the flow goes on"],
        data={"assume": "a stop with bounded $R$", "smaller": "a Ricci-flat bubble", "impossible": "impossible in 4D"}),
    voice=[("title", "Ricci flow and scalar curvature."),
           ("object", "The flow stops only when curvature blows up. Is the scalar part enough to watch?"),
           ("proof", "A blow-up with bounded scalar curvature needs a bubble; four dimensions forbids it."),
           ("achievement", "Claimed: yes in four, no in high dimensions."),
           ("verify", "Not in Lean.")])

E["352"] = dict(
    plain="A flow meant to smooth a shape toward its ideal form can tear in finite time, even when a perfect form exists",
    proof=dict(archetype="reduction", steps=[
        "Start from a very symmetric metric on complex projective space",
        "Symmetry turns the flow into an equation in one variable",
        "Its solution pinches to a point in finite time"],
        data={"boxes": [r"Calabi flow on $\mathbb{CP}^{10}$", "one radial variable", "a point singularity"]}),
    voice=[("title", "Calabi flow can blow up."),
           ("object", "Calabi flow should carry any metric toward a canonical one. Chen said forever."),
           ("proof", "Symmetry reduces it to one variable, which pinches to a point."),
           ("achievement", "Claimed: a finite time singularity, in ten dimensions."),
           ("verify", "Not in Lean.")])

E["353"] = dict(  # no proof: the review gives the result, not the route
    plain="Must a certain endless, perfectly balanced surface be a simple bowl? Yes up to dimension nine, not in ten",
    voice=[("title", "Affine Bernstein: rigid through dimension nine."),
           ("object", "Must an endless convex affine maximal graph be a simple quadratic bowl? The answer flips at dimension ten."),
           ("achievement", "Claimed: yes from three to nine, and no in ten."),
           ("verify", "Lean checks dimensions three to nine.")])

E["354"] = dict(
    plain="In a cube world that wraps around like a video game, the cheapest wrap is a ball, then a tube, then a slab",
    proof=dict(archetype="reduction", steps=[
        "Any least-area region is a smooth surface of some genus",
        "Reflection symmetry and curvature-area estimates rule out handles",
        "Only ball, tube and slab remain: the lowest one wins"],
        data={"boxes": ["any minimizer", "no handles", "ball, tube or slab"]}),
    voice=[("title", "Ball, tube, slab: proved."),
           ("object", "In a cube whose faces wrap around, three shapes compete to enclose a volume cheaply."),
           ("proof", "Reflection symmetry and curvature area estimates rule out every shape with handles."),
           ("achievement", "Claimed: ball, then tube, then slab."),
           ("verify", "Checked in Lean.")])

E["355"] = dict(
    plain="Zoom in on the moment a shrinking bubble first pinches: you always see one and the same picture",
    proof=dict(archetype="monotone", steps=[
        "Gaussian area only goes down as the flow runs",
        "A new inequality ties how fast it drops to how far the shape moves",
        "So the shape settles on one limit, whatever its ends look like"],
        data={"floor": 0.22, "ylabel": "Gaussian area", "floorLabel": "limit"}),
    voice=[("title", "Unique tangent flows, proved."),
           ("object", "A surface shrinks and pinches. Zoom in; different zooms might show different pictures."),
           ("proof", "Gaussian area only drops, and a new inequality pins down where it settles."),
           ("achievement", "Claimed: one limit, at the first singularity."),
           ("verify", "Not in Lean.")])

E["356"] = dict(
    plain="On rough spaces with no smooth structure, two meanings of 'curved at least this much' turn out to agree",
    proof=dict(archetype="reduction", steps=[
        "Start from Gigli's curvature bound on a rough space",
        "Key step: Hessian bounds hold along every geodesic, not almost every",
        "That gives triangle comparison: an Alexandrov space"],
        data={"boxes": [r"Gigli: $\ge \kappa$", "Hessian bounds on every geodesic", r"Alexandrov $\ge \kappa$"]}),
    voice=[("title", "Gigli's curvature conjecture, now proved."),
           ("object", "Two ways to bound curvature from below on rough spaces. Do they agree?"),
           ("proof", "The key step: Hessian bounds hold along every geodesic, giving triangle comparison."),
           ("achievement", "Claimed: the two notions always coincide exactly."),
           ("verify", "Lean: one lemma.")])

E["357"] = dict(  # no proof: the review states no mechanism
    plain="Rough spaces that look flat when you zoom in at a point can be given honest map coordinates around it",
    voice=[("title", "Bi Lipschitz coordinates at regular points."),
           ("object", "Near a regular point, every zoom looks flat. Can a whole open neighbourhood be mapped with bounded distortion?"),
           ("achievement", "Claimed: yes, with a distortion that depends only on the dimension."),
           ("verify", "Manuscript only; Lean in progress.")])

E["358"] = dict(
    plain="A space where straight paths never meet again, though it can't be curved like a saddle everywhere",
    proof=dict(archetype="construction", steps=[
        "Take a graph manifold that Leeb showed has no nonpositive curvature",
        "Put a carefully built metric on it",
        "Its geodesics never refocus anyway: no conjugate points"],
        data={"pieces": [{"label": "Leeb's graph manifold", "role": r"no metric with $\sec \le 0$", "tone": "soft"},
                         {"label": "a careful metric", "role": "built by hand", "tone": "soft"},
                         {"label": "no conjugate points"}]}),
    voice=[("title", "Geodesics that never refocus again."),
           ("object", "Nonpositive curvature stops geodesics refocusing. Is the converse true for closed manifolds?"),
           ("proof", "Leeb's graph manifold gets a careful metric whose geodesics never refocus at all."),
           ("achievement", "Claimed: no, the converse fails in dimension three."),
           ("verify", "Checked in Lean.")])

E["359"] = dict(
    plain="In one complex dimension, negative curvature forces a disc; in three, a negatively curved space can escape",
    proof=dict(archetype="construction", steps=[
        "Build a Hartogs-type tube domain in three complex dimensions",
        "Tune its Kähler potential so the curvature stays pinched negative",
        "Yet every bounded holomorphic map degenerates somewhere"],
        data={"pieces": [{"label": r"tube domain in $\mathbb C^3$", "tone": "soft"},
                         {"label": "Kähler potential", "role": "pinched negative", "tone": "soft"},
                         {"label": "no bounded coordinates", "tone": "hot"}]}),
    voice=[("title", "The Wu Yau conjecture, disproved."),
           ("object", "In one complex dimension, pinched negative curvature forces the disc. What about higher?"),
           ("proof", "A tube domain with a tuned potential stays negative, yet escapes every bound."),
           ("achievement", "Claimed: contractible, negatively curved, yet not bounded."),
           ("verify", "Checked in Lean.")])

E["360"] = dict(  # no proof: 'handles conjugate cut points directly' is not a statable idea
    plain="A curvature rule that keeps optimal sand-moving maps tidy also makes the set of shortest directions convex",
    voice=[("title", "Weak MTW gives convexity."),
           ("object", "From a point, mark every direction whose geodesic still minimizes. Villani asked: is that region always convex, even with conjugate cut points?"),
           ("achievement", "Claimed: yes, and optimal transport maps are Hölder both ways."),
           ("verify", "Both main theorems checked in Lean.")])

E["361"] = dict(
    plain="Flat space has a fixed number of slow-growing 'balanced' functions; some gently curved spaces have more",
    proof=dict(archetype="construction", steps=[
        "Start flat near the centre, then let the metric oscillate far away",
        "The space then looks different at every large scale",
        "That leaves room for more slow-growing harmonic functions"],
        data={"pieces": [{"label": "flat near the origin", "tone": "soft"},
                         {"label": "oscillation at infinity", "role": "many tangent cones", "tone": "soft"},
                         {"label": "extra harmonic functions"}]}),
    voice=[("title", "Curvature can add harmonic functions."),
           ("object", "Flat space fixes the count of slow growing harmonic functions. Can curvature only lower it?"),
           ("proof", "Keep it flat near the centre, oscillate far away, and extra harmonic functions appear."),
           ("achievement", "Claimed: some curved metrics have more."),
           ("verify", "Lean checks part.")])


# ----------------------------------------------------------------- visualised equations
def _obj_342(o):
    # the demo's visualised object (data/math-reels demo 342): every term of the boundary estimate tagged
    return {
        "dur": o["dur"], "primitive": "equation", "mode": "stack",
        "lines": [
            {"tex": r"\term{w}{\omega(v, Jv)} > \term{z}{0}", "note": r"$\omega$ tames $J$", "at": 0.4, "size": 40, "y": 0.07,
             "relation": {"kind": "gt", "at": 0.7, "left": {"from": 0, "v": 1, "label": r"$\omega(v,Jv)$"},
                          "right": {"v": 0.02, "label": "$0$"}, "dy": 18}},
            {"tex": r"\omega(Ju, Jv) = \omega(u, v)", "note": "compatible: also $J$-invariant", "at": 2.2, "size": 40, "y": 0.39},
            {"tex": r"\term{a}{r^{-3}} \cdot \term{b}{O(r^2)} \cdot \term{c}{o(r)} = \term{d}{o(1)}", "tone": "accent", "at": 3.6, "size": 40, "y": 0.56,
             "terms": {
                 "a": {"label": "blows up", "tone": "bad", "at": 0.7,
                       "visual": {"kind": "curve", "f": "1/(x*x*x)", "x": [0.25, 1], "y": [0, 40], "dx": -200, "w": 150, "h": 70}},
                 "b": {"label": "at most $r^2$", "tone": "cool", "at": 1.3,
                       "visual": {"kind": "curve", "f": "x*x", "x": [0, 1], "y": [0, 1], "dx": -60, "w": 150, "h": 70}},
                 "c": {"label": "faster than $r$", "tone": "warn", "at": 1.9,
                       "visual": {"kind": "curve", "f": "x*x*x", "x": [0, 1], "y": [0, 1], "dx": 70, "w": 150, "h": 70}},
                 "d": {"label": "tends to zero", "tone": "accent", "at": 2.5, "mark": "box",
                       "visual": {"kind": "curve", "f": "x*x", "x": [0, 1], "y": [0, 1], "dx": 180, "w": 150, "h": 70}}}}],
        "beats": o["beats"]}


def _obj_340(o):
    o = copy.deepcopy(o)
    L = o["lines"]
    assert L[0]["tex"] == r"L \simeq Q"
    o.pop("heading", None)   # the plain line takes the heading's place
    # merge the two homotopy lines into one, and tag the claim's two sides
    o["lines"] = [
        {"tex": r"L \simeq Q, \quad L \simeq_s Q", "note": "homotopy, simple homotopy", "at": 0.4, "size": 34, "y": 0.02},
        {"tex": r"\term{l}{L} \qquad\cong\qquad \term{q}{Q}", "tone": "accent", "at": 2.4, "size": 40, "y": 0.2,
         "note": "diffeomorphic, in the claim",
         "terms": {"l": {"label": "the new $L$", "tone": "accent", "at": 0.5,
                         "visual": {"kind": "shape", "shape": "superellipse", "dx": -70, "w": 110, "h": 64}},
                   "q": {"label": "the base $Q$", "tone": "soft", "at": 1.0,
                         "visual": {"kind": "shape", "shape": "circle", "dx": 70, "w": 110, "h": 64}}}},
        {"tex": r"L \not\sim_{\mathrm{Ham}} \term{z}{0_Q}", "tone": "hot", "at": 4.6, "size": 40, "y": 0.72,
         "note": "yet not the zero section, moved by a flow",
         "terms": {"z": {"label": "zero section", "tone": "soft", "at": 0.5, "mark": "box"}}}]
    return o


def _obj_321(o):
    o = copy.deepcopy(o)
    o["panels"][0]["until"] = 3.8
    p = o["panels"][1]
    p["from"] = 3.8
    p["mode"] = "stack"
    p["lines"] = [
        {"tex": r"\rho:\ x_1 \mapsto -1,\ a_1 \mapsto \zeta,\ x_2 \mapsto \zeta^2,\ a_2 \mapsto -1,\ s \mapsto 1",
         "note": "respects every relation", "size": 32, "at": 0.2, "y": 0.02},
        {"tex": r"\text{minor} = -4(1 - \zeta^2) \neq 0", "note": "the twisted boundary matrix is injective", "size": 34, "at": 0.7, "y": 0.2},
        {"tex": r"\term{a}{x_1 \text{ has order } 2}, \qquad \term{b}{\rho(x_1) = -1}", "tone": "accent", "at": 1.2, "size": 38, "y": 0.44,
         "terms": {"a": {"label": "torsion", "tone": "cool", "at": 0.4,
                         "visual": {"kind": "dots", "n": 2, "mark": [1], "w": 120, "h": 50}},
                   "b": {"label": "twisted, not fixed", "tone": "bad", "at": 0.9,
                         "visual": {"kind": "line", "min": -1, "max": 1,
                                    "marks": [{"v": -1, "tone": "bad", "label": "$-1$"}, {"v": 1, "label": "$1$"}],
                                    "w": 170, "h": 50}}}}]
    for bt, t in zip(o["beats"], (0.2, 3.9, 6.4)):
        bt["at"] = t
    return o


PATCH = {"342": _obj_342, "340": _obj_340, "321": _obj_321}
ORDER = ["$schema", "id", "discipline", "kind", "short", "title", "plain", "object", "proof", "achievement", "verify", "voice", "sources"]


def enrich(s):
    s = copy.deepcopy(s)
    e = E.get(s["id"])
    if not e:
        return s
    if s["id"] in PATCH:
        s["object"] = PATCH[s["id"]](s["object"])
    assert _vis(e["plain"]) <= 110, (s["id"], "plain", _vis(e["plain"]))
    s["plain"] = e["plain"]
    if e.get("proof"):
        p = e["proof"]
        for st in p["steps"]:
            assert _vis(st) <= 72, (s["id"], st, _vis(st))
        o = s["object"]
        f = OBJ_PROOF / o["dur"]
        o2 = _scale({k: v for k, v in o.items() if k != "dur"}, f)
        s["object"] = {"dur": OBJ_PROOF, **o2}
        s["proof"] = {"archetype": p["archetype"], "steps": p["steps"], "data": p.get("data", {})}
        for k in ("title", "achievement", "verify"):
            if isinstance(s.get(k), dict):
                s[k].pop("dur", None)
    v = []
    for sc, t in e["voice"]:
        # a caption line holds 96 characters: split a longer line at a sentence end
        if len(t) > 96:
            i = max(t.rfind(". ", 0, 96), t.rfind("? ", 0, 96), t.rfind(": ", 0, 96))
            assert i > 0, (s["id"], t)
            v += [{"scene": sc, "text": t[:i + 1]}, {"scene": sc, "text": t[i + 2:]}]
        else:
            v.append({"scene": sc, "text": t})
    n = sum(_words(x["text"]) for x in v)
    assert 40 <= n <= 55, (s["id"], "voice words", n)
    s["voice"] = v
    return {k: s[k] for k in ORDER if k in s} | {k: s[k] for k in s if k not in ORDER}
