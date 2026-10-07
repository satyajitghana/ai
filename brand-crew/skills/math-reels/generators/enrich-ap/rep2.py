R = [
("A fractal dust of points. More than half-dimensional? Then its distances should fill an interval.", "A fractal dust of points. Over half-dimensional? Then its distances should fill an interval."),
("Carleson: square-integrable signals converge. Kolmogorov: merely integrable ones can fail. Where is the line?", "Square-integrable signals converge; merely integrable ones can fail. Where is the line?"),
("Claimed: L log L converges almost everywhere.", "Claimed: L log L signals converge almost everywhere."),
("Reduce to a dyadic tree, then cap the cost with an entropy budget.", "Reduce to a dyadic tree, then cap the total cost with an entropy budget."),
("experts doubted it could stay level.", "experts doubted it stays level."),
("Waves extended off a curved surface. The human", "Waves off a curved surface. The human"),
("The best human result still lost one twelfth.", "The best human result lost one twelfth."),
("Six neighbours for every point. Is this", "Six neighbours per point. Is this"),
("The counterexample: a determinant built from the Choi Lam form.", "The counterexample is built from the Choi Lam form."),
("For twenty years, a gap between upper and lower bounds.", "For twenty years, a gap between the bounds."),
("Claimed: the old embedding is essentially optimal.", "Claimed: the old embedding is essentially optimal, after all."),
("Polarity swaps bodies: the cube's dual is the diamond. Pietsch guessed covering counts survive the swap.", "Polarity swaps bodies; the cube's dual is the diamond. Pietsch guessed coverings survive it."),
("Blocks of points, each at least one apart, placed ever farther away. Each defeats small operators.", "Blocks of points at least one apart, ever farther away. Each defeats small operators."),
("L one was the open target.", "L one was open."),
("How long do particle dynamics follow Boltzmann's equation?", "How long do particles follow Boltzmann's equation?"),
("A Sobolev homeomorphism deforms one body onto another, like rubber. Smoothing by convolution destroys injectivity.", "A Sobolev homeomorphism deforms a body like rubber. Convolution smoothing destroys injectivity."),
("then smooth the result.", "then smooth the whole result."),
("Below it, the conjecture says no positive solution exists, in any dimension.", "Below it, conjecturally, no positive solution exists in any dimension."),
("            if re.search(r'[$\\\\{}^_=<>≤≥∞→0-9]', t): bad.append(f\"{id} voice symbol: {t}\")", "            if re.search(r'[$\\\\{}^_=<>≤≥∞→0-9]', t): bad.append(f\"{id} voice symbol: {t}\")\n            if len(t) > 96: bad.append(f\"{id} voice {sc} {len(t)} chars\")"),
]
f = 'enrich.py'; s = open(f).read()
for a, b in R:
    n = s.count(a)
    if n != 1: print('COUNT', n, a)
    s = s.replace(a, b)
open(f, 'w').write(s)
