R = [
("Stack perpendicular lifts on a plane; any embedding crowds points.", "Stack perpendicular lifts on a plane; any embedding then crowds too many points."),
("Expand in Faber polynomials and bound coefficients with a positive kernel.", "Expand in Faber polynomials and bound the coefficients with a positive kernel."),
("Claimed: constant two, even with matrices.", "Claimed: constant two, even with matrix coefficients."),
('"Crouzeix\'s conjecture, complete form."', '"Crouzeix\'s conjecture, in complete form."'),
("random walks travel in straight lines, breaking Markov type.", "random walks travel in straight lines, which breaks Markov type."),
("The island's energy is constant, so deleting it saves length.", "The island's energy interaction is constant, so deleting it saves length."),
("Claimed: arcs, tips and triple junctions only.", "Claimed: smooth arcs, tips and triple junctions only."),
("would force too many independent gradients.", "would force too many independent eigenfunction gradients."),
("Claimed: true for every smooth, hole-free plate.", "Claimed: true for every smooth plate without holes."),
]
f = 'enrich.py'; s = open(f).read()
for a, b in R:
    n = s.count(a)
    if n != 1: print('COUNT', n, a)
    s = s.replace(a, b)
open(f, 'w').write(s)
