R = [
("A region with wild holes. Bend it, and every hole becomes a disk or a point.", "A region with wild holes. Bend it, and each hole becomes a disk or point."),
("How badly can a conformal map squeeze area? The range stuck near three point four two.", "How badly can a conformal map squeeze area? The range stalled near three point four."),
("Two functions on a triangle, entangled in a cycle. No bound of any kind was known.", "Two functions on a triangle, entangled in a cycle. No bound at all was known."),
("Can a big set avoid every scaled, shifted copy of one half, one quarter, one eighth?", "Can a big set avoid every shifted copy of one half, one quarter, one eighth?"),
("A shape and its dual. Push the disk to a square and the volume product falls.", "A shape and its dual. Push the disk to a square; the volume product falls."),
("Split a Gaussian cloud and sum each piece's squared centre. Two halves give one over pi.", "Split a Gaussian cloud; sum each piece's squared centre. Two halves give one over pi."),
("Doubling: every ball is covered by a few half-size balls. Surely such sets fit somewhere finite?", "Doubling: every ball is covered by few half-size balls. Surely such sets fit somewhere finite?"),
("Two cylinders cover it at exactly half its smallest shadow. Zoom in just below one half.", "Two cylinders cover it at exactly half its smallest shadow. Zoom in below one half."),
("A disk, a square and a triangle of equal area. Computed exactly, the triangle spreads most.", "A disk, a square, a triangle of equal area. Computed exactly, the triangle spreads most."),
("This matrix: one eigenvalue, zero, but a disk of numerical range. It shows two is sharp.", "This matrix: one eigenvalue, zero, but a disk of numerical range. Two is sharp."),
("K-convex means no uniform copies of l one n. Does cotype on both sides force it?", "K-convex means no uniform copies of l one n. Does cotype on both sides suffice?"),
("A random walk in a space. Markov type asks it to spread no faster than diffusion.", "A random walk in a space. Markov type says it spreads no faster than diffusion."),
("A diamond: every edge becomes two paths, depth by depth. Here they need ever more distortion.", "A diamond: each edge becomes two paths, depth by depth. Here they need growing distortion."),
("Segment an image into a smooth part and edges. Decades reduced the question to one island.", "Segment an image into smooth parts and edges. Decades reduced the question to one island."),
("Heat an insulated plate and wait. The hottest and coldest points should drift to the edge.", "Heat an insulated plate and wait. The hottest and coldest points should reach the edge."),
("Push on the boundary and measure what pushes back. Do these data fix both moduli inside?", "Push on the boundary, measure what pushes back. Do these data fix both moduli inside?"),
("A centre of mass one third, four outer pieces of one sixth. Plans split the centre.", "A centre of mass one third, four outer pieces of one sixth. Plans split it."),
("A solution rising in one direction should be a flat wall. Humans had reached dimension four.", "A solution rising in one direction should be a flat wall. Humans reached dimension four."),
]
f = 'enrich.py'; s = open(f).read()
for a, b in R:
    n = s.count(a)
    if n != 1: print('COUNT', n, a)
    s = s.replace(a, b)
open(f, 'w').write(s)
