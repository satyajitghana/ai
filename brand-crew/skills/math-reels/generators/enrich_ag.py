import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
# Enrichment pass for the algebraic-geometry + algebra reels (families 032-069, 193-210):
# a plain-words line, the proof idea (when the review/article/paper overview states one
# honestly), and narration. Imported by gen_ag1.py, fork52/gen.py and gen-algebra.py,
# which call enrich(spec) before writing; run directly to enrich 039 (no generator) in place.
#
# Proof ideas come from the review `explainer`/`claim`, the article section, or the paper's
# own proof overview (noted per entry). Where none can be stated honestly, `proof` is omitted.
import json, os, sys

OUT = _OUT
OBJ_WITH_PROOF = 6.0          # 2.5 + 6.0 + 5.5 + 3.5 + 2 + 1.2 = 20.7 s, 0.3 s left for the voice
TK = {'at', 'from', 'until', 'edgeAt', 'edgeDur', 'sweepAt', 'sweep', 'flowAt', 'cellAt', 'cellStagger', 'stagger'}

def scale(v, f, top=True):
    if isinstance(v, dict):
        # 'from'/'until' are times only on a panel; inside a slide, range or relation 'from' is a value
        timed = lambda k: k in TK and (k not in ('from', 'until') or 'primitive' in v)
        return {k: (round(x * f, 2) if (timed(k) or (k == 'dur' and not top)) and isinstance(x, (int, float)) else scale(x, f, False)) for k, x in v.items()}
    if isinstance(v, list): return [scale(x, f, False) for x in v]
    return v

def V(title, obj, ach, verify, proof=None):
    # obj may be a list of lines (one voice line holds at most 96 characters)
    out = [{"scene": "title", "text": title}] + [{"scene": "object", "text": o} for o in ([obj] if isinstance(obj, str) else obj)]
    if proof: out.append({"scene": "proof", "text": proof})
    out += [{"scene": "achievement", "text": ach}, {"scene": "verify", "text": verify}]
    return out

NOLEAN = "No Lean proof yet."
MS_ONLY = "Manuscript only, no Lean."
LEAN_MAIN = "Main theorem Lean-checked."
LEAN_PART = "Lean checks only part."

E = {}

# 032  proof: review explainer + article (four-factor reduction, one surface with a nonzero period)
E["032"] = dict(
  plain="Every 'shadow' that looks cast by a real curve or surface really is, on the most symmetric shapes",
  proof={"archetype": "reduction", "steps": [
    "Reduce every such class to one basic four-piece pattern",
    "Map a single surface into all four pieces at once",
    "A nonzero integral over it makes its image the needed cycle"],
    "data": {"boxes": ["any CM Hodge class", "one four-factor line", "a surface mapped to all four", "nonzero period: a cycle"]}})

# 033  proof: review explainer (projective proof: top Hodge line positivity through the canonical bundle formula)
E["033"] = dict(
  plain="Split a shape into fibres over a base: its richness is at least the fibre's plus the base's",
  proof={"archetype": "reduction", "steps": [
    "Rewrite the forms on the whole space as forms on the base",
    "A correction term records how the fibres vary",
    "Its top Hodge line is positive, which gives the inequality"],
    "data": {"boxes": ["the fibration $X \\to Z$", "canonical bundle formula", "top Hodge line positive", "$\\kappa(X) \\ge \\kappa(F)+\\kappa(Z)$"]}})

# 034  proof: review explainer + article (induction on dimension; signed boundary criterion)
E["034"] = dict(
  plain="If a shape's built-in curvature is never negative, some multiple of it maps the shape onto a simpler one",
  proof={"archetype": "induction", "steps": [
    "Known up to dimension three: surfaces and threefolds",
    "Prove nonvanishing and minimal models together, one dimension up",
    "A new signed boundary test makes every step work"],
    "data": {"levels": 5, "labels": ["$\\dim \\le 3$", "$4$", "$5$", "$6$", "$\\cdots$"], "step": "signed boundary criterion"}})

# 035  no proof: the review says only that a cycle/infinitesimal-neighbourhood argument is transplanted
E["035"] = dict(
  plain="One more case of abundance for 3D shapes, in number systems where adding $p$ ones gives zero")

# 036  no proof: the sources give only that it uses 034 and 056 as black boxes (already the object's tree)
E["036"] = dict(
  plain="Every shape can be simplified step by step until it is 'minimal' or splits off a simple piece")

# 037  proof: review explainer (induction on dimension from a separately proved fourfold case)
E["037"] = dict(
  plain="A smooth point is the 'biggest' kind; the claim is that the next biggest is always the simple cone $x_0^2+\\dots+x_n^2=0$",
  proof={"archetype": "induction", "steps": [
    "First prove the four-dimensional case on its own",
    "Then deduce each dimension from the one below",
    "So the gap holds in every dimension"],
    "data": {"levels": 5, "labels": ["$n = 4$", "$n = 5$", "$n = 6$", "$n = 7$", "$\\cdots$"], "step": "one dimension up"}})

# 038  proof: review explainer + article (singular divisor at the point, control the minimizing centre, lift by vanishing)
E["038"] = dict(
  plain="Add enough copies of a positive bundle and you can steer sections through any point you like",
  proof={"archetype": "reduction", "steps": [
    "To free a point, build a divisor that is singular right there",
    "Keep its singular centre under control without losing positivity",
    "A vanishing theorem then lifts a section through the point"],
    "data": {"boxes": ["a point to free", "a divisor singular there", "control the centre", "lift a section"]}})

# 039  proof: review explainer + article (specialize the points; count lattice rows under sheared polygons)
E["039"] = dict(
  plain="Ten or more random points: no curve can pass through them as many times as simple counting would allow",
  proof={"archetype": "counting", "steps": [
    "Slide the points into a tidy, structured pattern",
    "Count the conditions a curve must meet, row by row under a polygon",
    "Too many conditions for the curve's coefficients: it cannot exist"],
    "data": {"boxes": 4, "items": 5, "label": "too many conditions", "boxLabel": "coefficients of a degree-$d$ curve"}})

# 040  proof: article + review (virtual count gives 0 = c[Delta] + Gamma; c > 0 in two cases)
E["040"] = dict(
  plain="On a surface with no 2-forms, every point should be interchangeable with every other, up to equivalence",
  proof={"archetype": "reduction", "steps": [
    "A virtual count on the doubled surface gives one diagonal identity",
    "Show its key coefficient is positive, in two separate cases",
    "Then all points are equivalent: the zero-cycles collapse"],
    "data": {"boxes": ["virtual Quot count", "$0 = c[\\Delta] + \\Gamma$", "$c > 0$", "$\\mathrm{CH}_0(S) \\cong \\mathbb{Z}$"]}})

# 041  no proof: the review gives no method; the paper overview (stratum, finite covers) is too technical to say plainly
E["041"] = dict(
  plain="Certain perfectly balanced shapes always split into a family of donut-like tori over ordinary projective space")

# 042  proof: review explainer (Runge approximation glued through necks: the core-neck construction)
E["042"] = dict(
  plain="Maps into a K3 surface can be bent as freely as maps into flat space: you are never stuck",
  proof={"archetype": "local-to-global", "steps": [
    "Approximate maps on small compact pieces",
    "Glue the pieces together through thin necks",
    "The glued approximations make the whole surface flexible"],
    "data": {"cols": 3, "rows": 2, "patchLabel": "compact pieces (cores)", "label": "glued through necks: Oka"}})

# 043  no proof: no method stated in the review or article
E["043"] = dict(
  plain="Two very different ways to sort the same shape's holes, one by geometry and one by algebra, always agree")

# 044  no proof: the review names only a comparison of two fixed-point schemes
E["044"] = dict(
  plain="Two mirror-image spaces from physics: counting holes in one equals listing functions on the other")

# 046  proof: the demo spec (review explainer: a rational fibre lifts to a non-compact chain of spheres)
E["046"] = dict(
  plain="A conjecture said certain shapes always 'unroll' into a tidy space; here is a shape where that fails",
  proof={"archetype": "counterexample", "steps": [
    "Build a surface from a family of curves, pinching pairs of points",
    "Unroll it: one curve lifts to an endless chain of spheres",
    "That chain never closes up, so the cover cannot be convex"],
    "data": {"items": 7, "breakAt": 6, "label": "never closes up", "caption": "one curve, lifted to the cover"}})

# 047  proof: article (explicit H; adding a variable gives a polynomial ring; an LND/graded invariant shows A is not)
E["047"] = dict(
  plain="A shape that becomes ordinary flat space once you add one extra line, yet is not flat space itself",
  proof={"archetype": "construction", "steps": [
    "Write down one polynomial H in five variables",
    "Add one more variable: the result is ordinary flat space",
    "An invariant built from its symmetries shows A itself is not"],
    "data": {"pieces": [{"label": "one polynomial $H$", "role": "the hypersurface $A$"},
                        {"label": "$A[w] \\cong \\mathbb{C}^{[5]}$", "role": "add a line: flat", "tone": "ok"},
                        {"label": "$A \\not\\cong \\mathbb{C}^{[4]}$", "role": "an invariant says no", "tone": "bad"}],
             "result": "cancellation fails over $\\mathbb{C}$"}})

# 048  proof: review explainer (analytic isolated Gorenstein singularity with free tangent sheaf, then algebraized)
E["048"] = dict(
  plain="A surface whose 'directions of motion' look exactly like a smooth surface's, yet it has a sharp point",
  proof={"archetype": "construction", "steps": [
    "Build a singular point analytically, one isolated pinch",
    "Arrange that its vector fields still form a free module",
    "Then make it algebraic, keeping both properties"],
    "data": {"pieces": [{"label": "an isolated singular point", "role": "analytic, Gorenstein"},
                        {"label": "$\\mathrm{Der}_{\\mathbb{C}}(A) \\cong A^2$", "role": "free vector fields", "tone": "ok"},
                        {"label": "algebraize", "role": "a complex surface"}],
             "result": "free, yet not smooth"}})

# 049  proof: article (the zero set is A^3, the hard half; grad F = 0 at one point, but a coordinate's gradient never vanishes)
E["049"] = dict(
  plain="A slice of 4D space that is itself flat 3D space, yet can't be straightened into a coordinate slice",
  proof={"archetype": "counterexample", "steps": [
    "Its zero set is a copy of ordinary 3-space: the hard half",
    "But at one point all four slopes of F vanish; a coordinate's never do",
    "So no change of variables turns F into a variable"],
    "data": {"items": 7, "breakAt": 4, "label": "$\\nabla F = 0$ here", "caption": "a coordinate's gradient is never zero"}})

# 050  proof: review explainer (pull back by the m-th power map; ample for all m; curvature obstruction past m_0)
E["050"] = dict(
  plain="Two ways to say a bundle is 'positive', by algebra and by curvature, were believed equal; here they differ",
  proof={"archetype": "counterexample", "steps": [
    "Pull one bundle back by the m-th power map, for larger and larger m",
    "Every pullback stays ample",
    "But curvature piles up at a point: past some m, no positive metric"],
    "data": {"items": 6, "breakAt": 5, "label": "no positive metric", "labels": ["$m=1$", "$m=2$", "$m=3$", "$m=4$", "$\\cdots$", "$m \\ge m_0$"], "caption": "$E_m$ ample for every $m$"}})

# 051  proof: review explainer + article (Brody's derivative bounds fed into MMP/abundance results of the release)
E["051"] = dict(
  plain="A shape with no room for an infinite straight-line path must be curved 'outward' in a precise sense",
  proof={"archetype": "reduction", "steps": [
    "No entire curves means derivatives of maps are uniformly bounded",
    "Feed those bounds into the release's minimal-model results",
    "Out comes positivity: the canonical bundle is ample"],
    "data": {"boxes": ["no entire curves", "Brody's bounds", "MMP results", "$K_X$ ample"]}})

# 052  proof: review explainer (boxes of product charts extended by Hartogs-type arguments)
E["052"] = dict(
  plain="If every direction splits cleanly into two kinds, the whole space unrolls into a product, like a grid",
  proof={"archetype": "local-to-global", "steps": [
    "Locally, the two foliations give product boxes",
    "Grow the boxes, extending across their edges (Hartogs)",
    "The boxes stitch into one global product"],
    "data": {"cols": 3, "rows": 2, "patchLabel": "local product charts", "label": "a global product"}})

# 053  proof: review explainer (alternating product of corrected small diagonals; vanishes in Chow, outside Pixton's span)
E["053"] = dict(
  plain="A proposed complete rulebook for curve-counting classes misses a rule, found at a vast genus",
  proof={"archetype": "construction", "steps": [
    "Take corrected small diagonals on powers of the universal curve",
    "Multiply them with alternating signs: the class vanishes",
    "Yet it is not built from Pixton's relations"],
    "data": {"pieces": [{"label": "small diagonals", "role": "corrected"},
                        {"label": "alternating product", "role": "vanishes in Chow", "tone": "ok"},
                        {"label": "Pixton's span", "role": "not inside it", "tone": "bad"}],
             "result": "a relation Pixton's list misses"}})

# 054  proof: review explainer + article (an additive invariant counting K3-type divisors, evaluated two ways)
E["054"] = dict(
  plain="Some 4D cubic shapes pass the test for being 'unfoldable' into flat space, yet cannot be unfolded",
  proof={"archetype": "contradiction", "steps": [
    "Suppose such a cubic were rational",
    "Count K3-type pieces a birational map creates or destroys, two ways",
    "The counts disagree, so it cannot be rational"],
    "data": {"assume": "suppose $X$ rational", "smaller": "count K3 divisors two ways", "impossible": "counts disagree"}})

# 055  no proof: the route to the Gepner point itself is not stated in the review or article
E["055"] = dict(
  plain="Physicists predicted a perfectly symmetric way to sort the 'branes' on a quintic shape; it exists")

# 056  no proof: no method stated in the review or article
E["056"] = dict(
  plain="A step-by-step simplification of 4D shapes can never run forever: every chain of moves stops")

# 057  no proof: the review says only 'L2 Hodge theory on the universal cover'
E["057"] = dict(
  plain="Shapes with no hidden 'general type' pieces have loops that behave almost like a simple grid of directions")

# 058  no proof: the sources give its inputs (034, 057), not a proof idea for the classification
E["058"] = dict(
  plain="A shape's unrolled cover can be described by polynomial inequalities only if it is a few standard pieces")

# 059  proof: review explainer + article (embedded topology classified by the Seifert form; congruent forms, different orders)
E["059"] = dict(
  plain="Two equations whose solution sets have the same shape, even inside space, yet different lowest degrees",
  proof={"archetype": "reduction", "steps": [
    "In high dimensions, one algebraic table decides the topology",
    "Build two equations whose tables match",
    "But their lowest degrees differ: two versus three"],
    "data": {"boxes": ["same embedded topology", "same Seifert form", "two equations: orders 2 and 3"]}})

# 060  no proof: the paper's overview (cyclic covers, height functions, residue currents) cannot be said plainly
E["060"] = dict(
  plain="The last unclassified kind of complex surface turns out to be a Hopf surface with some points blown up")

# 062  no proof: no method stated in the review or article
E["062"] = dict(
  plain="A rare, very symmetric kind of curved space only comes in the textbook models, the Wolf spaces")

# 063  proof: review explainer (rho independent eigenvalues of quantum multiplication from lower bounds on point invariants)
E["063"] = dict(
  plain="Shapes whose curves are all 'heavy' have room for only a few independent directions",
  proof={"archetype": "reduction", "steps": [
    "Get lower bounds on counts of curves through a point",
    "Turn them into $\\rho$ independent eigenvalues of quantum multiplication",
    "Those eigenvalues force the bound"],
    "data": {"boxes": ["curve counts through a point", "$\\rho$ eigenvalues", "$\\rho(\\iota-1) \\le n$"]}})

# 064  no proof: the review says only 'builds the homeomorphisms directly, removing an angular seam'
E["064"] = dict(
  plain="Slide a pinch point through a family: if one number stays fixed, its shape never changes")

# 065  no proof: the review says only 'degeneration and transport arguments'
E["065"] = dict(
  plain="All curve counts on a shape obey one infinite family of equations, as physicists predicted")

# 066  no proof: no method stated in the review or article
E["066"] = dict(
  plain="A shape can always be 'completed' to a balanced one using a bounded amount of scaling")

# 067  proof: the paper's own overview ('1.1 The argument': characterization theorems leave few cases; minimal rational curves; intersection theory)
E["067"] = dict(
  plain="Six-dimensional shapes that bend 'outward' in every direction are the perfectly symmetric ones",
  proof={"archetype": "reduction", "steps": [
    "Known theorems leave only a few possible cases",
    "Follow the shortest rational curves through each case",
    "Intersection arithmetic rules out every non-homogeneous one"],
    "data": {"boxes": ["Fano sixfold, $T_X$ nef", "a few cases left", "rule each out", "rational homogeneous"]}})

# 068  proof: review explainer (splitting of the universal cover; torus actions on the RC factor via invariant Euler characteristics)
E["068"] = dict(
  plain="If a shape's anti-curvature is never negative, it has at least one 'anti-canonical' section somewhere",
  proof={"archetype": "reduction", "steps": [
    "Known theorems split the space into flat, Ricci-flat and rational parts",
    "The hard part carries a torus action",
    "Count invariant sections with an Euler characteristic: one exists"],
    "data": {"boxes": ["split the cover", "torus on the rational part", "invariant Euler characteristic", "$H^0(-mK_X) \\ne 0$"]}})

# 069  no proof: the review says only that a localization-Whittaker proof becomes feasible
E["069"] = dict(
  plain="A deep dictionary between two kinds of symmetry, stretched by a dial; claimed at every irrational setting")

# 193  proof: review explainer + article (perfectoid algebras; Galois-averaged Euler characteristics; each twist positive)
E["193"] = dict(
  plain="When two shapes meet in a point, an algebraic count of how they meet is always positive",
  proof={"archetype": "reduction", "steps": [
    "Move to huge 'perfectoid' rings where error terms vanish",
    "There, the count matches its average over Galois twists",
    "Each twist is positive, so the multiplicity is positive"],
    "data": {"boxes": ["$\\chi(M,N)$", "perfectoid algebras", "Galois average", "each twist $> 0$"]}})

# 194  proof: review explainer (characteristic p through Hilbert-Kunz and Dutta multiplicities and Cohen factorizations)
E["194"] = dict(
  plain="A measure of how 'pinched' a point is can never drop when you pass along a flat map",
  proof={"archetype": "reduction", "steps": [
    "Reduce from every characteristic to characteristic $p$",
    "There, compare through Frobenius-based multiplicities",
    "Cohen factorizations carry it back: $e(R) \\le e(S)$"],
    "data": {"boxes": ["any characteristic", "characteristic $p$", "Hilbert–Kunz, Dutta", "$e(R) \\le e(S)$"]}})

# 195  proof: review explainer + article (a Chern-character inequality on a resolution obstructs any such module)
E["195"] = dict(
  plain="A ring that cannot be made to look 'nice' by any finite module, though infinite ones exist",
  proof={"archetype": "contradiction", "steps": [
    "Suppose a finite module of full depth existed",
    "Follow its Chern character on a resolution of an explicit surface",
    "A numerical inequality rules it out"],
    "data": {"assume": "a small CM module $M$", "smaller": "its Chern character", "impossible": "inequality fails"}})

# 196  proof: review explainer + article (graphs immersed in a rose; every coefficient of alpha*beta comes from an even number of products)
E["196"] = dict(
  plain="In this group's arithmetic, two nonzero things can multiply to zero, which was thought impossible",
  proof={"archetype": "cancellation", "steps": [
    "Build a group from two finite graphs drawn in a rose",
    "Multiply: every group element appears an even number of times",
    "Over $\\mathbb{F}_2$, where $1 + 1 = 0$, the pairs cancel"],
    "data": {"tex": "\\alpha\\beta = \\term{a}{g} + \\term{b}{h} + \\term{c}{g} + \\term{d}{k} + \\term{e}{h} + \\term{f}{k}",
             "cancel": [["a", "c"], ["b", "e"], ["d", "f"]], "result": "\\alpha\\beta = 0", "label": "schematically: each element twice"}})

# 197  proof: paper overview (reuses the zero-divisor graph-and-cone construction and its parity mechanism)
E["197"] = dict(
  plain="In this group's arithmetic, a has a right inverse b, yet b times a is not one",
  proof={"archetype": "construction", "steps": [
    "Reuse the graph-and-cone machine from the zero-divisor result",
    "Arrange the products so unwanted terms cancel in pairs",
    "Cone surgeries keep the group torsion-free"],
    "data": {"pieces": [{"label": "graphs in a rose", "role": "the presentation"},
                        {"label": "parity cancellation", "role": "$ab = 1$", "tone": "ok"},
                        {"label": "cone surgeries", "role": "torsion-free"}],
             "result": "$ab = 1 \\ne ba$"}})

# 198  proof: the paper's own overview (F^{2m} N_m vanishes, F^{2m-2} N_m does not: finite but long resolutions)
E["198"] = dict(
  plain="One fixed algebra has modules whose 'unwinding' takes finitely many steps, but as many as you like",
  proof={"archetype": "induction", "steps": [
    "Apply one fixed operation F to the module, again and again",
    "It survives $2m-2$ rounds, so the resolution is at least that long",
    "It dies after $2m$ rounds, so the resolution is finite"],
    "data": {"levels": 5, "labels": ["$F^1 N_m$", "$F^2 N_m$", "$F^3 N_m$", "$\\cdots$", "$F^{2m} N_m \\simeq 0$"], "base": "$N_m$", "step": "apply $F$ again"}})

# 199  proof: review explainer + article figure (symmetric algebra with a rigid module; End(A+M) breaks Nakayama)
E["199"] = dict(
  plain="Several old rules said 'a module with no self-twists is trivial'; one example breaks them all",
  proof={"archetype": "reduction", "steps": [
    "Build a symmetric algebra with a rigid module that is not projective",
    "That already breaks Tachikawa and Auslander–Reiten",
    "Its endomorphism algebra then breaks Nakayama's conjecture"],
    "data": {"boxes": ["seed: $T \\otimes T$", "rigid, not projective", "$\\mathrm{End}(A \\oplus M)$", "Nakayama fails"]}})

# 200  no proof: no method stated in the review or article
E["200"] = dict(
  plain="Among all ways to build an ideal of a given size, one tidy 'dictionary order' choice is always the biggest")

# 201  proof: review explainer + article (free-series equations solved step by step in central division algebras)
E["201"] = dict(
  plain="A number system where every element solves some polynomial, yet two elements generate infinitely much",
  proof={"archetype": "induction", "steps": [
    "Start with two generators inside a division algebra",
    "Step by step, solve equations that make each new element algebraic",
    "In the limit: all algebraic, yet infinite-dimensional"],
    "data": {"levels": 5, "base": "two generators", "var": "\\text{stage}", "step": "solve the next equation"}})

# 202  proof: review explainer + article (weighted tuple counts; p-adic divisibility via covers of genus-one curves)
E["202"] = dict(
  plain="A way to count a finite group's building blocks by looking only near one prime, claimed always right",
  proof={"archetype": "reduction", "steps": [
    "Rewrite both sides as counts of solutions to one group equation",
    "Leftover terms must be divisible by high powers of p",
    "Curves in characteristic p prove that divisibility"],
    "data": {"boxes": ["$l(B)$ vs weights", "tuple counts", "divisible by $p$", "genus-one curves"]}})

# 203  proof: review explainer + article (Cartan invariants and Morita-Frobenius numbers; Lie type uniformly; extensions)
E["203"] = dict(
  plain="Once one size is fixed, the building blocks of group algebras come in only finitely many kinds",
  proof={"archetype": "reduction", "steps": [
    "Split finiteness into two bounds: Cartan and Frobenius numbers",
    "Bound Cartan numbers for Lie-type groups, whatever their size",
    "Handle extensions by comparing Frobenius twists"],
    "data": {"boxes": ["finitely many Morita classes", "bound Cartan invariants", "bound Frobenius numbers"]}})

# 204  no proof: the review says only 'a deformation of half relations on a graph of components'
E["204"] = dict(
  plain="If a symmetry pattern appears after scaling everything up, it already appeared at the original size")

# 205  proof: review explainer + article (an explicit vector in one cyclic polytabloid submodule for each target)
E["205"] = dict(
  plain="Squaring one staircase-shaped symmetry pattern produces every other pattern at least once",
  proof={"archetype": "correspondence", "steps": [
    "For each target shape, write down one explicit vector",
    "Each vector lies in one cyclic piece of the tensor square",
    "It generates a copy of its target: every one appears"],
    "data": {"left": ["$\\mu_1$", "$\\mu_2$", "$\\mu_3$", "$\\cdots$"], "right": ["$v_{\\mu_1}$", "$v_{\\mu_2}$", "$v_{\\mu_3}$", "$\\cdots$"],
             "pairs": [[0, 0], [1, 1], [2, 2], [3, 3]], "leftTitle": "every irreducible", "rightTitle": "an explicit vector"}})

# 206  proof: review explainer + article (a coloured-graph characterization; a lattice that fails it)
E["206"] = dict(
  plain="Some finite 'family tree' of groupings can never come from any finite algebra",
  proof={"archetype": "counterexample", "steps": [
    "Turn the question into a colouring test on graphs",
    "Run finite lattices through the test",
    "One lattice fails: no finite algebra has it"],
    "data": {"items": 6, "breakAt": 5, "label": "fails the test", "caption": "finite lattices through the colouring test"}})

# 207  no proof: the review says outright that the proof technique was not examined
E["207"] = dict(
  plain="In a torsion-free group's algebra, the only 'projections' are the trivial ones, 0 and 1")

# 208  proof: review explainer (higher Frobenius functor from restricted tilting modules; embedding chosen by rank support)
E["208"] = dict(
  plain="Every finite symmetric 'algebra of shapes' in characteristic $p$ maps faithfully into a known model",
  proof={"archetype": "construction", "steps": [
    "Build a 'higher Frobenius' functor from special tilting modules",
    "Choose the target by a rank test",
    "That gives a fibre functor to a Verlinde category"],
    "data": {"pieces": [{"label": "restricted tilting modules", "role": "building blocks"},
                        {"label": "higher Frobenius", "role": "the functor"},
                        {"label": "rank support", "role": "picks the target"}],
             "result": "a fibre functor to $\\mathrm{Ver}_{p^n}$"}})

# 209  no proof: the review gives the outcome (a class survives mod 5 on A[1/pi]), not a proof idea
E["209"] = dict(
  plain="A rule that a ring's K-theory never loses information when you allow fractions fails for some rings")

# 210  proof: review explainer (the Foulkes-Howe map is onto for b >= a(a-1): a = 6 for b >= 30, extra work below)
E["210"] = dict(
  plain="Two ways to stack symmetric patterns, one fits inside the other, now proved for size six",
  proof={"archetype": "construction", "steps": [
    "Transposing an array of symbols gives a natural map",
    "Once b is large enough, that map hits everything",
    "Smaller cases are done separately: all of $a = 6$"],
    "data": {"pieces": [{"label": "$b \\ge 30$", "role": "the map is onto"}, {"label": "$6 \\le b < 30$", "role": "extra work"}],
             "result": "$a = 6$, every $b \\ge 6$"}})


# ---------------------------------------------------------------- narration
# Budgets (estimate: 3 words/s + 0.25 s per line, 0.3 s lead, 0.15 s between lines, 0.25 s tail):
#   with a proof (object 6.0 s): title <= 5 words, object <= 15 (one line), proof <= 14, achievement <= 8,
#   verify <= 4 (the 0.3 s of slack); without: title 5, object about 22 over two lines, achievement 10, verify 5.
NOTLEAN = "Manuscript only, not in Lean."
VOICE = {
 "032": V("The Hodge conjecture, CM case.",
          "On these symmetric shapes, every class that looks algebraic comes from real cycles.",
          "Claimed: Hodge holds for every CM abelian variety.", NOLEAN,
          "Reduce everything to one four-piece pattern, then build it from a single surface."),
 "033": V("Iitaka's conjecture on fibrations.",
          "Cut a space into fibres over a base; its Kodaira dimension beats fibre plus base.",
          "Claimed: proved in characteristic zero, every dimension.", LEAN_PART,
          "Rewrite the space's forms on the base; a positive Hodge line gives the inequality."),
 "034": V("Abundance, in every dimension.",
          "If the canonical class is nef, abundance says it is semiample: it defines a map.",
          "Claimed: log abundance in characteristic zero.", NOLEAN,
          "Climb one dimension at a time, using a new signed boundary test."),
 "035": V("Threefold abundance in characteristic p.",
          ["Over the complex numbers, Miyaoka's proof used Hodge theory.",
           "In characteristic p that fails; this settles numerical dimension one, p above three."],
          "Claimed: semiample, one open case of threefold abundance.", NOTLEAN),
 "036": V("Minimal models for every pair.",
          ["The minimal model program simplifies each variety to a minimal model or a fibre space.",
           "Before, only log general type was known."],
          "Claimed: minimal models exist, and generalised abundance holds.", NOTLEAN),
 "037": V("A volume gap for singularities.",
          "Smooth points have the largest normalized volume; singular points sit below a gap.",
          "Claimed: the Spotti-Sun conjecture, in every dimension.", NOLEAN,
          "Prove dimension four on its own, then deduce each dimension from the one below."),
 "038": V("Fujita's freeness conjecture, every dimension.",
          "K plus m L should be globally generated once m reaches n plus one.",
          "Claimed: the sharp bound, in every dimension.", NOLEAN,
          "Build a divisor singular at the point, control its centre, then lift a section."),
 "039": V("Nagata's conjecture from nineteen fifty-nine.",
          "Through ten or more general points, multiplicities must total less than d root r.",
          "Claimed: proved for every r from ten.", LEAN_MAIN,
          "Move the points into a pattern, then count lattice rows under a polygon."),
 "040": V("Bloch's conjecture for surfaces.",
          "On a surface without two-forms, Bloch predicted all points are rationally equivalent.",
          "Claimed: true for every such surface, integrally.", NOLEAN,
          "A virtual count splits the diagonal; its coefficient is positive in both cases."),
 "042": V("Every K3 surface is Oka.",
          "Oka means maps into the surface bend as freely as maps into flat complex space.",
          "Claimed: every K3 surface, projective or not.", NOLEAN,
          "Approximate on compact pieces, then glue them together through thin necks."),
 "041": V("Hyperkähler SYZ, for every deformation type.",
          ["On a hyperkähler manifold, a nef square-zero bundle should give a Lagrangian fibration.",
           "Before, only the four known deformation types were done."],
          "Claimed: every type, and the base is projective space.", NOTLEAN),
 "043": V("P equals W, special linear.",
          ["P equals W says two filtrations on the same cohomology agree.",
           "One comes from the Hitchin fibration, the other from Hodge theory."],
          "Claimed: every rank, completing fixed-determinant P equals W.", NOTLEAN),
 "044": V("Hikita's conjecture for every quiver.",
          ["Symplectic duality pairs a Higgs branch with a Coulomb branch.",
           "Hikita: one side's cohomology equals functions on the other's fixed locus."],
          "Claimed: true for every finite quiver, with a regularity condition.", NOTLEAN),
 "046": V("Shafarevich's convexity conjecture fails.",
          "Shafarevich expected universal covers to be holomorphically convex. This surface's cover is not.",
          "Claimed: a surface and a fourfold that fail.", NOLEAN,
          "Pinch curves together; one lifts to an endless chain of spheres."),
 "047": V("Zariski cancellation fails at last.",
          "Is X flat space if X times a line is? Open over the complex numbers.",
          "Claimed: false in dimension four, by one polynomial.", LEAN_MAIN,
          "One polynomial: add a variable and it's flat; an invariant says it wasn't."),
 "048": V("Lipman-Zariski fails for surfaces.",
          "Do free vector fields force a variety to be smooth? Expected yes in characteristic zero.",
          "Claimed: a complex surface where it fails.", NOLEAN,
          "Build the singular point analytically with free vector fields, then make it algebraic."),
 "049": V("Abhyankar-Sathaye fails in four variables.",
          "Its zero set is affine three-space, yet the polynomial is not a coordinate.",
          "Claimed: a counterexample in every dimension from four.", LEAN_MAIN,
          "At one point, all four slopes vanish, which no coordinate allows."),
 "050": V("Griffiths' positivity conjecture fails.",
          "Griffiths asked if ample bundles always carry positively curved metrics. True for line bundles.",
          "Claimed: ample bundles with no positive metric.", LEAN_MAIN,
          "Pull back by higher and higher power maps; ampleness lasts, but curvature eventually fails."),
 "051": V("Kobayashi's conjecture from nineteen seventy.",
          "With no entire curves inside, a compact Kähler manifold should have ample canonical bundle.",
          "Claimed: true, with no curvature hypothesis at all.", NOLEAN,
          "Brody's derivative bounds feed into the release's own minimal model results, giving ampleness."),
 "052": V("Split tangent bundles are products.",
          "If the tangent bundle splits in two integrable pieces, the cover should be a product.",
          "Claimed: the two-summand case of Beauville.", LEAN_MAIN,
          "Grow product boxes and extend them across their edges, until they cover everything."),
 "053": V("Pixton's completeness conjecture fails.",
          "Pixton listed relations among tautological classes and conjectured they are all of them.",
          "Claimed: a missing relation, in Chow and cohomology.", NOLEAN,
          "An alternating product of small diagonals vanishes, but is not in Pixton's span."),
 "054": V("Kuznetsov's rationality conjecture fails.",
          "Kuznetsov predicted a cubic fourfold is rational exactly when its K3 category is geometric.",
          "Claimed: most such cubics are irrational anyway.", NOLEAN,
          "Assume it is rational, count K3 pieces two different ways, and the counts disagree."),
 "055": V("A Gepner point on every quintic.",
          ["Physics predicts a stability condition with a symmetry of order five.",
           "Building any stability condition needed a Bogomolov-Gieseker-type inequality."],
          "Claimed: Toda's Gepner point, with phases shifting by two fifths.", NOTLEAN),
 "056": V("Flips terminate on every fourfold.",
          ["The minimal model program simplifies a variety by a sequence of flips.",
           "Must every sequence stop? Open past dimension three."],
          "Claimed: every log canonical sequence of flips stops on fourfolds.", NOTLEAN),
 "057": V("Campana's abelianity conjecture for special manifolds.",
          ["Special manifolds, in Campana's sense, have no fibration onto anything of general type.",
           "Campana predicted their fundamental groups are virtually abelian."],
          "Claimed: true for every special compact Kähler manifold.", NOTLEAN),
 "058": V("Kollár and Pardon's semialgebraic conjecture.",
          ["When can a universal cover be cut out by real polynomial inequalities?",
           "Only symmetric domain, times flat space, times a compact piece."],
          "Claimed: those products are the only possible ones.", "Lean checks only one half."),
 "059": V("Zariski's multiplicity question fails.",
          "Zariski asked whether the embedded topology of a singularity determines its multiplicity.",
          "Claimed: no, with multiplicities two and three.", NOLEAN,
          "In high dimensions, the Seifert form decides topology; match it, change the degree."),
 "060": V("The global spherical shell conjecture.",
          ["Class seven surfaces are the last unclassified compact complex surfaces.",
           "A spherical shell in each would make it a blown-up Hopf surface."],
          "Claimed: each one with b two positive has a shell.", NOTLEAN),
 "062": V("The LeBrun-Salamon conjecture.",
          ["The twistor space of a positive quaternion-Kähler manifold is a contact Fano manifold.",
           "LeBrun and Salamon asked: is every contact Fano manifold homogeneous?"],
          "Claimed: yes, so each such manifold is a Wolf space.", NOTLEAN),
 "063": V("The generalized Mukai conjecture.",
          "For a Fano manifold, rho times iota minus one is at most its dimension.",
          "Claimed: true for every smooth Fano manifold.", NOLEAN,
          "Curve counts through a point give rho eigenvalues of quantum multiplication, forcing the bound."),
 "064": V("The mu-constant problem for surfaces.",
          ["If the Milnor number stays constant, the topology should stay too.",
           "Lê and Ramanujam proved every case except surfaces in complex three-space."],
          "Claimed: true for surfaces in three-space as well.", NOTLEAN),
 "065": V("Virasoro constraints for complete intersections.",
          ["One generating function packs every Gromov-Witten invariant of a space, in all genera.",
           "The Virasoro conjecture says infinitely many differential operators annihilate it."],
          "Claimed: every smooth complete intersection, with no semisimplicity needed.", NOTLEAN),
 "066": V("Shokurov's bounded klt complements.",
          ["A complement makes a Fano-type fibration Calabi-Yau near a point.",
           "Its index says how far you must scale before it closes up."],
          "Claimed: klt complements with index bounded by dimension and epsilon.", NOTLEAN),
 "067": V("Campana-Peternell in dimension six.",
          "Fano manifolds with nef tangent bundle should be homogeneous. Known up to dimension five.",
          "Claimed: dimension six, the general conjecture open.", NOLEAN,
          "Few cases remain; follow the shortest curves, and intersection numbers rule them out."),
 "068": V("Yau's anticanonical nonvanishing problem.",
          "If minus K carries a semipositive metric, must some power have a section?",
          "Claimed: yes, for every smooth complex projective variety.", NOLEAN,
          "Split the cover, then count torus-invariant sections using an Euler characteristic."),
 "069": V("Quantum geometric Langlands, irrational level.",
          ["Quantum Langlands matches twisted D-modules for a group and for its dual group.",
           "The levels are c and minus one over r c."],
          "Claimed: every simple group and curve, c irrational.", NOTLEAN),
 "193": V("Serre's intersection positivity conjecture.",
          "Serre's intersection multiplicity, an alternating sum of Tor lengths, should be positive.",
          "Claimed: positive, even in ramified mixed characteristic.", NOLEAN,
          "Pass to perfectoid rings, average over Galois twists, and each twist is positive."),
 "194": V("Lech's conjecture from nineteen sixty.",
          "Multiplicity measures how singular a local ring is; Lech said flat maps never lower it.",
          "Claimed: proved in every dimension and characteristic.", LEAN_PART,
          "Work in characteristic p with Frobenius-based multiplicities, then carry the result back."),
 "195": V("No small Cohen-Macaulay module.",
          "Hochster asked if every complete local domain has a finite module of full depth.",
          "Claimed: a three-dimensional domain with none.", NOLEAN,
          "A Chern character inequality on a resolution rules any such module out."),
 "196": V("Kaplansky's zero divisors exist.",
          "Kaplansky asked if a torsion-free group algebra can have zero divisors; most expected not.",
          "Claimed: two nonzero elements whose product is zero.", LEAN_MAIN,
          "In the product, every group element appears an even number of times: it cancels."),
 "197": V("Kaplansky's direct finiteness fails.",
          "If a b is one, is b a one? A no gives a non-sofic group.",
          "Claimed: a one-sided inverse, not two-sided.", LEAN_PART,
          "Reuse the zero-divisor machine, so that unwanted terms in the product cancel in pairs."),
 "198": V("The finitistic dimension conjecture fails.",
          "Bass expected finite resolutions to have bounded length; here they grow without bound.",
          "Claimed: the finitistic dimension is infinite.", LEAN_MAIN,
          "One operation, repeated, dies after two m rounds but not two m minus two."),
 "199": V("Auslander-Reiten, Tachikawa and Nakayama fail.",
          "These conjectures all say a module with no self-extensions must be projective.",
          "Claimed: counterexamples over a field of characteristic two.", LEAN_MAIN,
          "A symmetric algebra with a rigid module; its endomorphism algebra then breaks Nakayama too."),
 "200": V("The Eisenbud-Green-Harris and lex-plus-powers conjectures.",
          ["Fix a regular sequence: the lex-plus-powers ideal should realize every Hilbert function.",
           "And it should also have the largest Betti numbers."],
          "Claimed: both conjectures, over every field of characteristic zero.", NOTLEAN),
 "201": V("Kurosh's division ring problem fails.",
          "Kurosh, nineteen forty-one: must algebraic division rings be locally finite?",
          "Claimed: two generators, infinite dimension, all algebraic.", NOLEAN,
          "Solve equations step by step, so that in the limit every element is algebraic."),
 "202": V("Alperin's weight conjecture, every block.",
          "Alperin's weight count was known case by case, using the classification of simple groups.",
          "Claimed: every block, with no classification.", NOLEAN,
          "Turn both sides into tuple counts; curves in characteristic p give the divisibility."),
 "203": V("Donovan's conjecture, every prime.",
          "Donovan predicted that blocks with bounded defect groups come in finitely many Morita classes.",
          "Claimed: true for every prime, including two.", NOLEAN,
          "Bound Cartan invariants uniformly, then handle group extensions by comparing Frobenius twists."),
 "204": V("Saturation for even spin groups.",
          ["Saturation: if an invariant appears after scaling the weights by N, it appears unscaled.",
           "Knutson and Tao proved type A in nineteen ninety-nine."],
          "Claimed: saturation for every even spin group.", NOTLEAN),
 "205": V("Saxl's conjecture on staircases.",
          "Saxl said the tensor square of the staircase representation contains every irreducible.",
          "Claimed: every Kronecker coefficient here is strictly positive.", LEAN_MAIN,
          "For each target, an explicit vector in one cyclic piece generates a copy."),
 "206": V("Finite lattice representation fails.",
          "Is every finite lattice the congruence lattice of a finite algebra? Open for decades.",
          "Claimed: no, and it is undecidable.", LEAN_PART,
          "A colouring test on graphs characterizes these lattices, and one lattice fails it."),
 "207": V("The Bass trace conjecture, every group.",
          ["Bass: the trace of an idempotent sees only elements of finite order.",
           "For torsion-free groups, idempotents are then zero and one."],
          "Claimed: the analytic version holds for every discrete group.", "Lean checks the algebraic version."),
 "208": V("Benson-Etingof-Ostrik, finite case.",
          "In characteristic p new Verlinde categories appear; B E O predicted no others are needed.",
          "Claimed: true for every finite category.", NOLEAN,
          "A higher Frobenius functor, aimed by a rank test, gives the fibre functor."),
 "209": V("Gersten's conjecture fails for ramified rings.",
          ["Gersten: a regular local ring's K-theory injects into its fraction field's.",
           "It was known whenever the ring contains a field."],
          "Claimed: explicit ramified rings where a K three class dies.", NOTLEAN),
 "210": V("Foulkes' conjecture, case six.",
          "Foulkes said one plethysm embeds in the other when a and b are swapped.",
          "Claimed: the case a equals six.", LEAN_PART,
          "The transpose map is onto for large b; the small cases are done separately."),
}


ORDER = ["$schema", "id", "discipline", "kind", "short", "title", "plain", "object", "proof", "achievement", "verify", "voice", "sources"]

def enrich(s, obj=None):
    """Add plain/proof/voice to a generated spec; with a proof, rescale the object scene to OBJ_WITH_PROOF.
    `obj` optionally replaces the object first (the equation-visualised versions)."""
    e = E[s["id"]]
    if obj is not None: s["object"] = obj
    s["plain"] = e["plain"]
    if e.get("proof"):
        s["proof"] = e["proof"]
        o = s["object"]
        if o["dur"] != OBJ_WITH_PROOF:
            o2 = scale(o, OBJ_WITH_PROOF / o["dur"]); o2["dur"] = OBJ_WITH_PROOF; s["object"] = o2
    s["voice"] = VOICE[s["id"]]
    return {k: s[k] for k in ORDER if k in s} | {k: v for k, v in s.items() if k not in ORDER}

if __name__ == "__main__":
    # 039 has no generator: enrich the file in place (idempotent: scaling only when the object is not yet 6.0 s)
    for id in sys.argv[1:] or ["039"]:
        p = os.path.join(OUT, id + ".json")
        s = enrich(json.load(open(p)))
        json.dump(s, open(p, "w"), indent=2, ensure_ascii=False)
        print("enriched", id)
