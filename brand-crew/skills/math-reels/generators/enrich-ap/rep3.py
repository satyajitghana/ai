R = [
('"Falconer\'s distance problem."', '"Falconer\'s problem, every dimension."'),
("Split the wave into packets and bound how they crowd.", "Split the wave into packets and bound how they crowd across scales."),
('"A counterexample to Lax."', '"A counterexample to Lax\'s conjecture."'),
("Claimed: the old embedding is essentially optimal, after all.", "Claimed: the old embedding is essentially optimal."),
('"Edit distance, sharply."', '"Edit distance, sharply pinned down."'),
('"Approximation without bounds."', '"Approximation, but without any bounds."'),
("Hard spheres reached the full regular lifespan.", "Hard spheres reached the regular lifespan."),
("not over single collisions.", "not over single binary collisions."),
('"From particles to Boltzmann."', '"From particles to Boltzmann\'s equation."'),
]
f = 'enrich.py'; s = open(f).read()
for a, b in R:
    n = s.count(a)
    if n != 1: print('COUNT', n, a)
    s = s.replace(a, b)
open(f, 'w').write(s)
