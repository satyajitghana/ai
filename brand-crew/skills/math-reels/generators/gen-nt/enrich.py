# Enrichment pass for the number theory / logic / group theory reels:
# a plain-words line, the proof idea as an archetype (only where the review's
# explainer or the paper's own overview states it), and narration.
# common.write() merges these into each spec and, when a proof scene is added,
# retimes the object scene to 6.0 s so the reel stays within 21 s.

LEAN_MAIN = "Lean: main theorem."
LEAN_PART = "Lean: part only."
LEAN_NONE = "Not in Lean."


def P(archetype, steps, **data):
    return {"archetype": archetype, "steps": steps, "data": data}


def V(title, obj, proof, ach, verify):
    v = [("title", title)] + [("object", o) for o in (obj if isinstance(obj, list) else [obj])]
    if proof:
        v.append(("proof", proof))
    v += [("achievement", ach), ("verify", verify)]
    return v


E = {
  # ------------------------------------------------------------ number theory
  "001": dict(
    plain="Several 'rulers' measure the same hidden piece of a shape; the claim is they all read the same fraction",
    proof=P("reduction", [
        "Start from any Hodge class on the reduced shape",
        "Move it to one pulled back from a special, symmetric CM variety",
        "There the pairing can be computed, and it is a fraction"],
        boxes=["any specialized Hodge class", "pulled back from a CM variety", "pairing computed: in $\\mathbb{Q}$"],
        arrow="becomes"),
    voice=V("Milne's rationality conjecture.",
            "Each theory computes the pairing on its own. The claim: all give one fraction.",
            "Move each class to a special symmetric variety, where the pairing can be computed.",
            "Claimed proved, even at the prime two.", LEAN_NONE)),
  "002": dict(
    plain="One formula ties a curve's rational points to one analytic number; this proves it exactly for rank 0 or 1",
    proof=P("local-to-global", [
        "Both sides of the formula are numbers built from primes",
        "Check each prime's share on its own, with special points on the curve",
        "Every prime matches, so the whole formula holds"],
        cols=3, rows=2, patchLabel="one prime at a time", label="the exact formula"),
    voice=V("The Birch and Swinnerton-Dyer formula.",
            "It predicts one number exactly, prime by prime. Only the rank part was known.",
            "The proof checks each prime's share on its own, then puts them together.",
            "Claimed: exact, in rank zero or one.", LEAN_NONE)),
  "003": dict(
    plain="Zeta's zeros control how evenly primes are spread; this keeps them a fixed distance from the danger edge",
    proof=P("contradiction", [
        "Suppose some zero sits to the right of 7/8",
        "Then a related function would stretch too far to the left",
        "Two exact formulas for one sum forbid that, so no zero is there"],
        assume="a zero right of $7/8$", smaller="$1/L$ reaches too far left", impossible="impossible"),
    voice=V("No zeros past seven eighths.",
            "The known zero-free strip thins to nothing. The claim: a fixed margin, at every height.",
            "Assume a zero too far right; two exact formulas for one sum forbid it.",
            "Claimed: no zero past seven eighths.", LEAN_MAIN)),
  "004": dict(
    plain="No program can tell, for every polynomial equation, whether it has a solution in fractions",
    proof=P("reduction", [
        "Points $nP$ on an elliptic curve stand in for whole numbers $n$",
        "Turn each whole-number question into tests over fractions",
        "A decider for fractions would decide whole numbers: impossible"],
        boxes=["equation over $\\mathbb{Z}$", "tests over $\\mathbb{Q}$", "undecidable (Matiyasevich)"],
        arrow="becomes"),
    voice=V("Hilbert's tenth, over the fractions.",
            "Multiples of one point on an elliptic curve stand in for the whole numbers.",
            "A decider for fractions would decide whole numbers, which Matiyasevich showed is impossible.",
            "Claimed: no such algorithm exists.", LEAN_NONE)),
  "005": dict(
    plain="Catalan's constant is a simple endless sum; is it a fraction, or does its decimal never repeat?",
    proof=P("contradiction", [
        "Suppose $G$ were a fraction $a/b$",
        "Build huge determinants in which the $\\zeta(2)$ part cancels",
        "One bound says they are not too small, another that they are"],
        assume="$G = a/b$", smaller="a nonzero determinant, yet tiny", impossible="the bounds cross"),
    voice=V("Catalan's constant is irrational.",
            "One minus a ninth plus a twenty-fifth, and so on. Never proved irrational.",
            "Suppose it were a fraction. Two bounds on giant determinants would then cross.",
            "Claimed: it is not a fraction at all.", LEAN_MAIN)),
  "006": dict(
    plain="Twist one elliptic curve every possible way: half the twists get rank 0, half rank 1, like a fair coin",
    proof=P("reduction", [
        "Smith: an algebraic rank is 0 or 1, half the time each",
        "New: at the prime 2, that rank equals the analytic rank",
        "So the analytic ranks split half and half too"],
        boxes=["Selmer ranks: half 0, half 1 (Smith)", "new: Selmer rank = analytic rank", "analytic ranks: half 0, half 1"],
        arrow="transfers"),
    voice=V("Goldfeld's conjecture on twisted curves.",
            "Twist a curve every way. Goldfeld predicted average rank one half. Before, only upper bounds.",
            "Smith did the algebraic side. A new converse at the prime two transfers it.",
            "Claimed: half rank zero, half rank one.", LEAN_NONE)),
  "007": dict(
    plain="Is a number's count of prime factors odd or even? Knowing it for $n$ tells you nothing about $n + h$",
    # no proof scene: the closed-walk trace method has no honest archetype
    voice=V("Chowla's conjecture, the two-point case.",
            ["Each number gets plus or minus one by its prime factors' parity.", "Do neighbours correlate? Tao proved it only with logarithmic weights."],
            None,
            "Claimed: no correlation, with plain averages. Two points only.", LEAN_MAIN)),
  "008": dict(
    plain="A symmetry algebra was predicted to be as simple as possible: one building block per odd size, nothing more",
    proof=P("squeeze", [
        "Brown showed one free building block per odd weight exists",
        "New: a cap on how big each weight's piece can be",
        "Floor meets cap: nothing extra, the algebra is free"],
        lower={"from": 0.08, "v": 0.6, "label": "at least: Brown's generators", "tone": "cool"},
        upper={"from": 0.95, "v": 0.6, "label": "at most: new dimension bound"},
        lowerStep=0, upperStep=1,
        target={"v": 0.6, "label": "$\\mathfrak{grt}_1 \\cong \\mathrm{Lie}(\\sigma_3, \\sigma_5, \\ldots)$"}),
    voice=V("The Deligne Drinfeld conjecture.",
            "One generator in every odd weight: three, five, seven. Computers checked up to twenty-nine.",
            "Brown built the generators. A new size bound leaves no room for anything extra.",
            "Claimed: free, with nothing extra.", LEAN_MAIN)),
  "009": dict(
    plain="A big number system is rebuilt from a small table of how its elements multiply, like a skeleton from bones",
    proof=P("construction", [
        "Record which pairs of elements multiply to zero in degree two",
        "Those pairs trace out lines, as in projective geometry",
        "Lines and valuations rebuild the field itself"],
        pieces=[{"label": "vanishing products in $K_2$", "role": "the data"},
                {"label": "lines", "role": "projective geometry"},
                {"label": "valuations", "role": "read off the lines"}],
        result="the field, up to Frobenius twists"),
    voice=V("A field from Milnor K-theory.",
            "Degree one and two data should pin down the field. Uniqueness is in Lean.",
            "Products that vanish trace out lines, and lines rebuild the field.",
            "Claimed: the field comes back, up to Frobenius.", "Lean: uniqueness only.")),
  "010": dict(
    plain="Certain symmetries of the rational numbers were predicted to come from modular forms; this settles the prime 2",
    proof=P("reduction", [
        "Start with a 2-adic symmetry of the rational numbers",
        "First show it appears in a big space of modular objects",
        "Then show it is a genuine classical modular form"],
        boxes=["odd 2-adic Galois representation", "appears in completed cohomology", "a classical eigenform"],
        arrow="then"),
    voice=V("Fontaine Mazur at prime two.",
            "Odd primes were essentially done. At two, scalar and reducible cases stayed open.",
            "First it appears in completed cohomology, then it becomes a classical form.",
            "Claimed: every such representation is modular.", LEAN_NONE)),
  "011": dict(
    plain="Take a prime, subtract 1, and factor what is left: the pieces look just like a random number's",
    # no proof scene: 'determinant estimates with marks' cannot be stated honestly in plain steps
    voice=V("Factoring p minus one.",
            ["For many primes, how small can every prime factor of p minus one be?", "The record was a fixed power of x."],
            None,
            "Claimed: every power works, and they factor like random integers.", LEAN_NONE)),
  "012": dict(
    plain="Is the biggest prime factor of a number bigger than its neighbour's? A fair coin flip: exactly half",
    # no proof scene: the amplification / second-moment argument has no honest archetype
    voice=V("Neighbours' largest prime factors.",
            ["How often is n's largest prime factor below n plus one's? Bounds crept to zero point two eight.", "A logarithmic version was known."],
            None,
            "Claimed: exactly half the time, because the two sizes are independent.", LEAN_MAIN)),
  "013": dict(
    plain="Could the primes be built by adding every number in one list to every number in another? No",
    proof=P("contradiction", [
        "Suppose the primes, give or take a few, were all sums $a + b$",
        "Sieves force $A$ and $B$ to look small modulo every prime",
        "A new inverse theorem says such sets can't exist"],
        assume="primes $= A + B$", smaller="$A$, $B$ small mod every prime", impossible="impossible"),
    voice=V("Primes are not a sumset.",
            "Could the primes, give or take a few, be all the sums from two sets?",
            "If so, both sets look sparse mod every prime, which a new theorem forbids.",
            "Claimed: no such pair exists.", LEAN_MAIN)),
  "014": dict(
    plain="A dictionary between two worlds of geometry, now built for curves over finite fields",
    # no proof scene: eight papers, no single proof idea stated in the review
    voice=V("Geometric Langlands in characteristic p.",
            ["A sheaf to local system dictionary, known over the complex numbers, now in characteristic p.", "From it come Ramanujan-type bounds for cusp forms."],
            None,
            "Claimed, under conditions on p. One paper is conditional.", LEAN_NONE)),
  "015": dict(
    plain="Special lattice shapes from number fields spread evenly over all shapes, like sand settling flat",
    proof=P("reduction", [
        "Known rigidity leaves only a few possible limits",
        "Prime degree rules out the in-between ones",
        "No mass escapes to infinity, so the limit is even"],
        boxes=["do packets spread evenly?", "rigidity: few possible limits", "no in-between limit, no escape"],
        arrow="leaves"),
    voice=V("Duke's theorem in higher degree.",
            "Torus orbits from number fields, one packet per field. Degrees two and three were known.",
            "Rigidity leaves few possible limits; prime degree rules out all but the even one.",
            "Claimed: an even spread, nothing lost.", "Lean: prime degree.")),
  "016": dict(
    plain="Shapes should cross special sub-shapes in surprising ways only finitely often; this proves it in two settings",
    proof=P("contradiction", [
        "Suppose infinitely many unlikely points spread everywhere",
        "Sort them into height levels and rescale each level",
        "Their limit needs a direction that tangent positivity forbids"],
        assume="infinitely many unlikely points", smaller="a rescaled limit", impossible="impossible"),
    voice=V("Zilber Pink, for abelian varieties.",
            "A subvariety should meet special ones in too small a dimension only finitely often.",
            "Infinitely many such points would force a limit that tangent positivity rules out.",
            "Claimed: finitely many, over the algebraic numbers.", LEAN_NONE)),
  "017": dict(
    plain="How well can fractions approximate pi? The claim: no better than they approximate almost any number",
    proof=P("contradiction", [
        "Suppose pi had unusually good fraction approximations",
        "Use several of them to build a nonzero determinant",
        "Whole-number reasons keep it big; analysis makes it tiny"],
        assume="unusually good $p_i/q_i$", smaller="a nonzero determinant", impossible="too small to be nonzero"),
    voice=V("Pi's irrationality exponent is two.",
            "Bounds fell from forty-two to about seven. The claim jumps straight to two.",
            "Too-good fractions for pi would build a determinant both nonzero and too small.",
            "Claimed: two, the least any irrational has.", LEAN_MAIN)),
  "018": dict(
    plain="In arithmetic symmetry groups, every normal subgroup comes from the obvious source: no surprise ones",
    proof=P("contradiction", [
        "Suppose a surprise normal subgroup existed",
        "Dividing by it would leave a finite quotient group",
        "For these last group types such quotients can't exist"],
        assume="a surprise normal subgroup", smaller="a finite quotient", impossible="impossible"),
    voice=V("The Margulis Platonov conjecture.",
            "Normal subgroups should come only from compact places. A few exceptional types stayed open.",
            "A surprise subgroup would leave a finite quotient, which cannot exist here.",
            "Claimed: every global field, characteristic two included.", LEAN_NONE)),
  "019": dict(
    plain="Points on a curve should match exactly the 'splittings' of its symmetry group, like keys to locks",
    proof=P("reduction", [
        "Known: every section points at one spot, a valuation",
        "Build a special cover that rules out the bad spots",
        "Lift the section to a birational one",
        "Koenigsmann's theorem turns it into a real point"],
        boxes=["a section", "sits at a valuation", "lifted: birational section", "a rational point"]),
    voice=V("Grothendieck's section conjecture, p-adic case.",
            "Rational points should be exactly the splittings of the arithmetic fundamental group.",
            "A special cover lifts each section to a birational one, where Koenigsmann's theorem applies.",
            "Claimed: every section is a point.", LEAN_NONE)),
  "020": dict(
    plain="Plug $n$ into $n^4 + 2$: how often has the answer no repeated prime factor? A fixed share of the time",
    # no proof scene: the determinant-cut geometry has no honest archetype
    voice=V("Squarefree values of quartics.",
            ["Some values of n to the fourth plus two have a square factor.", "Quartics were open since nineteen fifty-three."],
            None,
            "Claimed: degrees four to eight, with the predicted density.", LEAN_MAIN)),
  "021": dict(
    plain="How long can a run of whole numbers all share a prime with a fixed product? At most about $k^2$",
    # no proof scene: the sieve expansion with an inverse estimate has no honest archetype
    voice=V("Jacobsthal's function, a quadratic bound.",
            ["How long can integers in a row all share a prime with k given primes?", "Is about k squared enough?"],
            None,
            "Claimed: about k squared, with a double-log saving.", LEAN_MAIN)),
  "022": dict(
    plain="Give fractions enough room and almost every number is approximated infinitely often, even aiming off-centre",
    proof=P("contradiction", [
        "Suppose a positive share of points is never approximated",
        "Stack weighted intervals around the shifted fractions",
        "They spread evenly, with their overlaps kept under control",
        "So they must hit the missed set: contradiction"],
        assume="a missed set of positive measure", smaller="an even, weighted cover", impossible="impossible"),
    voice=V("Duffin Schaeffer, with a shift.",
            "When this series diverges, almost every x is approximated infinitely often, even off-centre.",
            "A missed set would be hit by an evenly spread cover of intervals. Contradiction.",
            "Claimed: any fixed shift works.", LEAN_NONE)),
  "023": dict(
    plain="Sums attached to primes look like random arrows on a circle, but lean slightly one way, as predicted",
    # no proof scene: the dispersion / large-sieve argument has no honest archetype
    voice=V("Patterson's bias for cubic Gauss sums.",
            ["Each Gauss sum has size one. Random signs would cancel, yet a slight bias survives.", "Patterson predicted it in nineteen seventy-eight."],
            None,
            "Claimed: Patterson's bias, now with no unproved hypothesis.", LEAN_MAIN)),
  "024": dict(
    plain="Which numbers come out of Euler's totient function? Now we can count them almost exactly",
    # no proof scene: the review gives no proof idea
    voice=V("How many totients are there?",
            ["Values of Euler's phi function: no odd number above one appears.", "Ford found the growth order; Erdős and Hall asked for more."],
            None,
            "Claimed: an asymptotic formula, up to a bounded wobble.", LEAN_MAIN)),
  "025": dict(
    plain="Write any fraction as a sum of different $1/n$ pieces, as ancient Egyptians did: very few pieces suffice",
    proof=P("probabilistic", [
        "Look at many candidate denominators at once",
        "On average they have many divisors with small remainders",
        "So good denominators exist: $\\log\\log b$ terms suffice"],
        samples=70, threshold=0.55, mean=0.7, thresholdLabel="enough small remainders", label="most denominators"),
    voice=V("Short Egyptian fractions.",
            "How many unit fractions does a fraction need? Vose's bound stood since nineteen eighty-five.",
            "Most denominators have many divisors with small remainders, so few terms suffice.",
            "Claimed: log log b terms, the best possible.", LEAN_MAIN)),
  "026": dict(
    plain="Gaps between primes average about $\\log p$; this shows a fixed share of gaps are many times longer",
    proof=P("probabilistic", [
        "Weight each stretch of numbers with a sieve",
        "Under the weights, a prime likely starts the stretch",
        "and the next $C \\log X$ numbers are likely all composite",
        "So a positive share of gaps are long"],
        samples=70, threshold=0.55, mean=0.7, thresholdLabel="a long gap", label="weighted average"),
    voice=V("Many large prime gaps.",
            "Near p, gaps between primes average log p. Does a fixed share exceed any multiple?",
            "Sieve weights make a prime likely, followed by a long stretch with no primes.",
            "Claimed: yes, for every multiple C.", LEAN_PART)),
  "027": dict(
    plain="All ways of turning a surface's loops into matrices form a space full of whole-number points",
    proof=P("induction", [
        "Rank one is the easy start",
        "Cut the surface into simpler pieces",
        "Build each rank from the smaller ones, step by step"],
        levels=5, base="rank 1", var="r", step="cut into simpler pieces"),
    voice=V("Integral points on character varieties.",
            "Represent a curve's loops by matrices. Litt asked if integral points are dense.",
            "Start at rank one, cut the surface into pieces, and climb rank by rank.",
            "Claimed: dense, on every component.", LEAN_NONE)),
  "028": dict(
    plain="Hop between primes on a grid with steps of bounded length: you can never walk off to infinity",
    proof=P("counting", [
        "Remove the multiples of a few small Gaussian primes",
        "A walk's leftovers mod those primes show only so many patterns",
        "A long walk would need more patterns than exist",
        "So every walk stays trapped in a bounded region"],
        boxes=4, items=5, label="more steps than patterns", boxLabel="residue patterns mod a few primes"),
    voice=V("The Gaussian moat problem.",
            "Gaussian primes, joined when close. Can you walk to infinity with bounded steps?",
            "A long walk would need more residue patterns than a few primes allow.",
            "Claimed: no, every such walk stays trapped.", LEAN_MAIN)),
  "029": dict(
    plain="Powers of a number like 2 cycle through every remainder mod $p$ for infinitely many primes $p$, as Artin guessed",
    proof=P("construction", [
        "Show certain $L$-functions have no zeros in a wide strip",
        "Sieve for primes $p$ where $p - 1$ factors in a controlled way",
        "Together they give many primes where $a$ is a primitive root"],
        pieces=[{"label": "zero-free region", "role": "Hecke $L$-functions"},
                {"label": "a sieve", "role": "shapes $p - 1$"}],
        result="infinitely many primes, for every admissible $a$"),
    voice=V("Artin's primitive root conjecture.",
            "Do the powers of a hit every nonzero remainder mod p, for infinitely many primes?",
            "A zero-free region plus a sieve on p minus one give many primes.",
            "Claimed: infinitely many, not Artin's density.", LEAN_NONE)),
  "030": dict(
    plain="Every elliptic curve over these number systems matches a modular form, like a fingerprint on file",
    proof=P("reduction", [
        "Link the curve to others by congruences, one prime at a time",
        "Switch primes: mod $p$, then mod $3$, then mod $p$ again",
        "End at a curve already known to be modular"],
        boxes=["$E/K$", "mod $p$", "mod $3$", "mod $p$", "known modular"]),
    voice=V("Modularity over imaginary quadratic fields.",
            "Congruences chain the curve down to one known to be modular, as in Wiles's switch.",
            "Switch primes: mod p, mod three, mod p, landing on a known modular curve.",
            "Claimed: every elliptic curve is modular.", LEAN_NONE)),
  "031": dict(
    plain="A number field's symmetry group remembers the field; even a one-way map of symmetries comes from fields",
    proof=P("reduction", [
        "Start from any open map between the two Galois groups",
        "Show it respects roots of unity, from openness alone",
        "Hoshi's criterion then gives the field embedding"],
        boxes=["an open map of Galois groups", "compatible with roots of unity", "a field embedding (Hoshi)"],
        arrow="gives"),
    voice=V("Uchida's conjecture on Galois groups.",
            "Isomorphic Galois groups come from isomorphic fields. Uchida asked the same for open maps.",
            "Openness alone forces compatibility with roots of unity, and a known criterion finishes.",
            "Claimed: every open map comes from fields.", LEAN_NONE)),
  # ------------------------------------------------------------ logic
  "240": dict(
    plain="If a class of structures has just one model at one huge size, it has just one at every bigger size",
    proof=P("construction", [
        "Go to a model that is large enough",
        "Find a minimal type inside it and build a geometry on it",
        "The geometry carries uniqueness up to every larger size"],
        pieces=[{"label": "a large model", "role": "start"},
                {"label": "a minimal type", "role": "inside it"},
                {"label": "a geometry on it", "role": "controls models"}],
        result="categoricity transfers upward"),
    voice=V("Shelah's eventual categoricity conjecture.",
            "One model in one large enough size should mean one model in every larger size.",
            "Inside a large model, a minimal type and its geometry carry uniqueness upward.",
            "Claimed, in standard set theory alone.", LEAN_PART)),
  "241": dict(
    plain="Rank problems by which can be solved using the other's answers: that ranking has no mirror symmetry",
    proof=P("construction", [
        "Any symmetry comes from an explicit map on reals",
        "Feed it four mixes of a real $t$ and two generic reals",
        "The four outputs give back $t$, so nothing can move"],
        pieces=[{"label": "a real $t$", "role": "any real"},
                {"label": "two generic reals", "role": "Baire category"},
                {"label": "four values of the map", "role": "Slaman–Woodin"}],
        result="$t$ recovered: the symmetry is the identity"),
    voice=V("Rigidity of the Turing degrees.",
            "Degrees ordered by computability. Slaman and Woodin fixed everything above zero double jump.",
            "Four values of the map at mixed reals recover the original, so nothing moves.",
            "Claimed: the only symmetry is the identity.", LEAN_MAIN)),
  "242": dict(
    plain="Every list a computer can generate is the set of inputs where one equation has exactly one solution",
    proof=P("reduction", [
        "Known: exactly one witness works if exponentials are allowed",
        "Encode exponentials with points $nP$ on an elliptic curve",
        "Each $n$ has one point, so the witness stays unique"],
        boxes=["single-fold with exponentials (known)", "exponentials via points $nP$", "single-fold polynomial"],
        arrow="becomes"),
    voice=V("Diophantine sets with one witness.",
            "Every computable list is where a polynomial has a solution. Matiyasevich asked for exactly one.",
            "Points on an elliptic curve encode exponentials, exactly one point per number.",
            "Claimed: exactly one witness, for every list.", LEAN_MAIN)),
  "243": dict(
    plain="A leading candidate 'language' for all fast computations on unordered data misses one fast problem",
    proof=P("construction", [
        "Build two grid-like structures: total charge zero, or one",
        "Linear equations over $\\mathbb{F}_3$ tell them apart in polynomial time",
        "Their symmetries make every CPT program answer alike"],
        pieces=[{"label": "grid, charge zero", "role": "query: yes"},
                {"label": "grid, charge one", "role": "query: no"},
                {"label": "shared symmetries", "role": "hide the difference"}],
        result="CPT answers both the same"),
    voice=V("Choiceless polynomial time misses P.",
            "Choiceless polynomial time with counting was the leading candidate to capture polynomial time.",
            "Two grids differ by one charge; symmetry hides it from every such program.",
            "Claimed: a polynomial time query it cannot define.", LEAN_MAIN)),
  "244": dict(
    plain="Being able to reverse every onto-map does not give you the power to pick from every family of sets",
    proof=P("construction", [
        "Start from an ordinary model of set theory with Choice",
        "Add new sets by symmetric forcing, built from diagrams",
        "Every partition maps back in, yet one family has no choice"],
        pieces=[{"label": "a model of ZFC", "role": "start"},
                {"label": "symmetric forcing", "role": "adds new sets"},
                {"label": "monoid of diagrams", "role": "controls symmetry"}],
        result="PP holds, Choice fails"),
    voice=V("The Partition Principle without Choice.",
            "Choice implies the Partition Principle. Does the converse hold? Open since nineteen oh two.",
            "Symmetric forcing builds a model where partitions inject back, yet choice fails.",
            "Claimed: Partition does not imply Choice.", LEAN_MAIN)),
  "245": dict(
    plain="If every program in a typed language has some way to finish, then every way of running it finishes",
    proof=P("contradiction", [
        "Suppose some legal term can be reduced forever",
        "A diagonal trick turns that into a term with no normal form",
        "That breaks weak normalization: impossible"],
        assume="an endless reduction", smaller="a term with no normal form", impossible="impossible"),
    voice=V("Weak normalization implies strong.",
            "Some evaluation order always finishes. Does every order? Conjectured for every pure type system.",
            "An endless reduction would let a diagonal trick build a term that never finishes.",
            "Claimed: yes, in every pure type system.", LEAN_MAIN)),
  # ------------------------------------------------------------ group theory
  "246": dict(
    plain="If a group looks like a sphere from far away, it really is a symmetry group of hyperbolic 3-space",
    proof=P("reduction", [
        "The group's boundary at infinity is a topological sphere",
        "New: curve families can't get too thick at any scale",
        "So the sphere can be made round, and the group acts on $\\mathbb{H}^3$"],
        boxes=["boundary: a sphere", "uniform modulus bound", "a round sphere", "acts on $\\mathbb{H}^3$"],
        arrow="gives"),
    voice=V("Cannon's conjecture on hyperbolic groups.",
            "Hyperbolic three-manifold groups have a sphere at infinity. Cannon conjectured the converse.",
            "A uniform bound on curve families at every scale makes the sphere round.",
            "Claimed: the group acts on hyperbolic space.", LEAN_MAIN)),
  "247": dict(
    plain="Every element cycles back after finitely many steps, yet the group is infinite and has a finite rulebook",
    proof=P("construction", [
        "Start from a graded algebra where every element is nilpotent",
        "Make it finitely presented: an algebra $R$ over $\\mathbb{F}_2$",
        "Its Steinberg group inherits it: every element has finite order"],
        pieces=[{"label": "graded nil algebra", "role": "elements nilpotent"},
                {"label": "finitely presented $R$", "role": "over $\\mathbb{F}_2$"},
                {"label": "$\\mathrm{St}_{12}(R)$", "role": "Steinberg group"}],
        result="infinite, yet every element has finite order"),
    voice=V("A finitely presented Burnside group.",
            "Golod found infinite groups of finite-order elements, but they needed infinitely many relations.",
            "Nilness of a graded algebra becomes periodicity of its finitely presented Steinberg group.",
            "Claimed: infinite and periodic, yet finitely presented.", LEAN_PART)),
  "248": dict(
    plain="Some infinite groups allow a fair 'average' that moving things doesn't disturb; this famous one does not",
    proof=P("contradiction", [
        "Suppose $F$ were amenable, with nearly invariant sets",
        "Colour dyadic partitions with a map that has no fixed point",
        "Averaging forces a near fixed point: contradiction"],
        assume="Følner sets for $F$", smaller="a map with no fixed point", impossible="impossible"),
    voice=V("Thompson's group F, not amenable.",
            "Maps of an interval with dyadic breaks. Asked in nineteen seventy-nine, and long contested.",
            "Averaging over invariant sets would force a fixed point that cannot exist.",
            "Claimed: F has no invariant mean.", LEAN_MAIN)),
  "249": dict(
    plain="Two ways to measure a group's dimension, by algebra and by building it, agree everywhere except here",
    proof=P("counterexample", [
        "Bestvina and Brady built groups where one of two conjectures fails",
        "Compute the shape of one such group: no 2-dimensional model",
        "So algebra says 2, geometry says 3: Eilenberg–Ganea fails"],
        items=6, breakAt=5, label="dimensions differ", caption="groups where algebra and geometry agree"),
    voice=V("The Eilenberg Ganea conjecture fails.",
            "Algebraic and geometric dimension always agree, except possibly at two. Here they differ.",
            "Computing its homotopy rules out any two-dimensional model, so geometry needs three.",
            "Claimed: algebra says two, geometry says three.", LEAN_MAIN)),
  "250": dict(
    plain="Groups a computer can fully check are exactly those that fit inside a simple group with finite rules",
    proof=P("construction", [
        "Start with any group whose word problem is solvable",
        "Wrap it in a finite algebraic envelope",
        "The envelope makes a Thompson-like simple host finitely presented"],
        pieces=[{"label": "$G$, word problem solvable", "role": "input"},
                {"label": "finite algebraic envelope", "role": "new"},
                {"label": "Thompson-like simple group", "role": "host"}],
        result="$G$ inside a finitely presented simple group"),
    voice=V("The Boone Higman conjecture.",
            "Inside a finitely presented simple group, the word problem is solvable. The converse?",
            "Wrap the group in a finite algebraic envelope, making a simple host finitely presented.",
            "Claimed: yes, for every such group.", LEAN_MAIN)),
  "251": dict(
    plain="Groups that can be fairly averaged are exactly those whose bounded actions can be made rigid",
    proof=P("contradiction", [
        "Suppose a nonamenable group had every representation unitarizable",
        "Build one special representation for it",
        "Its unitarizing similarity would give an invariant mean",
        "But the group has none: contradiction"],
        assume="nonamenable, all unitarizable", smaller="an invariant mean", impossible="impossible"),
    voice=V("Dixmier's unitarizability problem.",
            "Amenable groups are unitarizable. In nineteen fifty Dixmier asked if the converse holds.",
            "One special representation, if unitarizable, would hand the group an invariant mean.",
            "Claimed: amenable exactly when unitarizable, for every group.", LEAN_MAIN)),
  "252": dict(
    plain="Usually every element of a group shows up in some finite snapshot; here one stays invisible in all of them",
    proof=P("counterexample", [
        "Glue Euclidean triangles into a nonpositively curved complex",
        "Most elements of its group show up in some finite quotient",
        "One element vanishes in every finite quotient"],
        items=7, breakAt=6, label="dies in every finite quotient", caption="elements, each seen in some finite quotient"),
    voice=V("Hyperbolic, not residually finite.",
            "Hyperbolic groups people use are residually finite. Gromov asked whether all of them are.",
            "A triangle complex traps one element, which dies in every finite quotient.",
            "Claimed: so it is not linear either.", LEAN_MAIN)),
  "253": dict(
    plain="One infinite group with a finite rulebook that is unbreakable and can be fairly averaged, all at once",
    proof=P("construction", [
        "Cut squares into polygons and shuffle the pieces",
        "The dynamics makes the group amenable",
        "Local rewriting gives finitely many relations",
        "Its alternating subgroup is simple: all three at once"],
        pieces=[{"label": "polygon exchanges", "role": "shuffle pieces"},
                {"label": "amenable", "role": "from the dynamics"},
                {"label": "finitely presented", "role": "local rewriting"},
                {"label": "simple", "role": "alternating subgroup"}],
        result="all three at once"),
    voice=V("Simple, amenable, finitely presented.",
            "Three properties never seen together before: finitely presented, simple and amenable.",
            "Polygon shuffles give amenability, local rewriting finite rules, a subgroup simplicity.",
            "Claimed: one infinite group with all three.", LEAN_MAIN)),
  "254": dict(
    plain="Braid-like groups each have a natural space built from a diagram; this shows the space has no hidden holes",
    proof=P("induction", [
        "Give every cell of the cover a harmonic height",
        "Peel the cover away, layer by layer",
        "No layer can create a hole, so the cover is contractible"],
        levels=5, labels=["base", "layer", "layer", "layer", "$\\cdots$"], step="remove a layer: no new hole"),
    voice=V("The K pi one conjecture.",
            "A poset model of the cover, peeled layer by layer. Lean checks the contractibility.",
            "Harmonic heights peel the cover away, and no layer can create a hole.",
            "Claimed: every Artin group.", LEAN_MAIN)),
  "255": dict(
    plain="If a group looks like a polycyclic group from far away, it really is one, up to a finite piece",
    proof=P("reduction", [
        "Model the group's large-scale shape on a solvable Lie group",
        "Its self-maps keep the height coordinate, up to bounded error",
        "That rigid height forces the algebra: virtually polycyclic"],
        boxes=["shaped like a solvable Lie group", "self-maps keep height", "virtually polycyclic"],
        arrow="forces"),
    voice=V("Polycyclic groups, recognized by shape.",
            "Gromov handled nilpotent groups in nineteen eighty-one; the solvable analogue stayed open.",
            "Large-scale self-maps keep a height coordinate, and that forces algebraic structure.",
            "Claimed: every virtually polycyclic group is recognized.", LEAN_MAIN)),
  "256": dict(
    plain="Add one new letter and one new rule to a nontrivial group: it can never collapse to nothing",
    proof=P("contradiction", [
        "Suppose an element of $A$ dies once the relation is added",
        "Draw that as a planar surface with one nontrivial boundary",
        "A phase count shows no such surface exists"],
        assume="an element of $A$ dies", smaller="one nontrivial boundary", impossible="impossible"),
    voice=V("Kervaire's conjecture, and Howie's.",
            "Can one new generator and one relation kill a nontrivial group? Kervaire said no.",
            "A dying element would give a planar surface that a phase count forbids.",
            "Claimed: never. Howie's version is paper only.", LEAN_PART)),
  "257": dict(
    plain="A group that is negatively curved from far away, yet cannot act nicely on any nonpositively curved space",
    proof=P("contradiction", [
        "Suppose the group acted nicely on a CAT(0) space",
        "Take a limiting configuration of least energy",
        "That configuration contradicts how the complex was built"],
        assume="a geometric CAT(0) action", smaller="a limiting energy configuration", impossible="impossible"),
    voice=V("Hyperbolic, but not CAT zero.",
            "Free, surface and cubulated groups all act on CAT zero spaces. Gromov asked about all.",
            "Any such action would yield a limiting energy configuration, which is impossible.",
            "Claimed: one hyperbolic group never does.", LEAN_MAIN)),
  "258": dict(
    plain="Groups defined by a single rule are negatively curved unless one specific bad pattern sits inside",
    proof=P("induction", [
        "Break the group down by the Magnus–Moldavanskii hierarchy",
        "The bottom pieces are hyperbolic",
        "Each step up keeps hyperbolicity, so the group has it too"],
        levels=5, base="bottom", var="k", step="one HNN step keeps hyperbolicity"),
    voice=V("Gersten's conjecture for one-relator groups.",
            "Baumslag Solitar subgroups block hyperbolicity. Gersten said they are the only obstruction here.",
            "Climb the hierarchy one step at a time; each step keeps hyperbolicity.",
            "Claimed: no such subgroup means hyperbolic.", LEAN_NONE)),
  "259": dict(
    plain="Cost counts the links needed to connect a group's motions; here two motions of one group cost differently",
    proof=P("counterexample", [
        "Build a group from one long relation word",
        "Some actions: a height coordinate makes connections cheap",
        "The Bernoulli action provably needs more: the costs differ"],
        items=6, breakAt=5, label="costs more", caption="free actions of one group, compared by cost"),
    voice=V("A group without fixed price.",
            "Cost is the cheapest way to connect orbits. Does it depend only on the group?",
            "Height coordinates make some actions cheap; a rank bound makes the Bernoulli action dearer.",
            "Claimed: no, two costs differ.", LEAN_NONE)),
}
