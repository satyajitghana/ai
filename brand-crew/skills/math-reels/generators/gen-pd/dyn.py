from common import *

# ---------------------------------------------------------------- 143 ----
spec('143', 'proof',
     "Hilbert's 16th: uniform limit-cycle bounds",
     "Hilbert's sixteenth problem: a uniform bound on limit cycles",
     "Claim: for each degree $d$ there is a finite $B(d)$ bounding the limit cycles of every degree-$d$ planar field",
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'shape', 'until': 3.8, 'shapes': [
             {'kind': 'ellipse', 'rx': 0.62, 'ry': 0.42, 'tone': 'accent', 'label': 'cycle 1', 'labelAt': [0, 0.6], 'at': 0.3, 'fillA': 0.08},
             {'kind': 'ellipse', 'rx': 1.35, 'ry': 0.86, 'tone': 'accent', 'label': 'cycle 2', 'labelAt': [0, 1.02], 'at': 1.0, 'fillA': 0.05}],
          'points': [{'p': [0, 0], 'label': 'equilibrium', 'at': 0.4, 'tone': 'ink'}]},
         {'primitive': 'tree', 'from': 3.8, 'at': 0.3, 'nodes': [
             {'id': 'b', 'label': '$B(d)$ for every degree $d$', 'status': 'paper'},
             {'id': 'z', 'label': 'Isolated zeros', 'parent': 'b', 'status': 'paper'},
             {'id': 'p', 'label': 'Passage packets', 'parent': 'b', 'status': 'paper'},
             {'id': 't', 'label': 'Transfer models', 'parent': 'b', 'status': 'paper'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Quintic Liénard fields: at most two limit cycles, and two occur. This half is in Lean'},
         {'at': 3.9, 'text': 'The uniform bound funnels through one isolated-zero finiteness theorem'},
         {'at': 6.4, 'text': 'None of that half is formalized, and it gives no formula for $B(d)$'}]},
     {'form': 'status', 'label': "Hilbert's sixteenth problem, second part (1900)",
      'statement': [r'\#\{\text{limit cycles}\} \le B(d)\ \text{ for every field of degree} \le d',
                    r'\deg F \le 5:\ \text{at most 2 limit cycles, and 2 occur}'],
      'context': 'Before: no uniform bound for any $d \\ge 2$, not even quadratic fields',
      'stamp': 'proved',
      'note': 'Non-effective: no formula for $B(d)$, not even for $d = 2$'},
     'Lean covers only the quintic Liénard count; the uniform bound (160 pp.) is not formalized',
     'We read the Liénard statement; we did not build the Lean',
     [R('143', 'known_before', "Hilbert's 16th problem, part 2 (1900)"),
      R('143', 'known_before', 'Uniform bound H(d) unknown for every d>=2, even quadratic fields.'),
      R('143', 'claim', 'Every classical Liénard system x\'=y-F(x), y\'=-x with F a real polynomial of degree at most 5 has at most two limit cycles, and two is attained'),
      R('143', 'caveats', 'The landmark half (uniform bound, 160 pp.) is NOT formalized'),
      A("Hilbert's sixteenth problem: the unformalized half", 'It gives no formula for $B(d)$, not even for $d=2$.'),
      A("Hilbert's sixteenth problem: the unformalized half", 'everything funnels through an absolute isolated-zero finiteness theorem for the matching systems'),
      CP('143'), NOBUILD])

# ---------------------------------------------------------------- 144 ----
n = 7
vals = [['1' if i == j else '0' for j in range(n)] for i in range(n)]
spec('144', 'proof',
     "Banach's simple Lebesgue spectrum",
     "Banach's simple Lebesgue-spectrum problem",
     'Claim: a smooth volume-preserving map of the 3-torus whose single orbit $f \\circ T^n$ is an orthonormal basis',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'grid', 'until': 4.4, 'rows': n, 'cols': n, 'values': vals, 'cells': [[i, i, 'accent'] for i in range(n)],
          'caption': '$\\langle f \\circ T^m, f \\circ T^n \\rangle$ for $m, n$ from $-3$ to $3$'},
         {'primitive': 'equation', 'from': 4.4, 'mode': 'stack', 'lines': [
             {'tex': r'\{\, f \circ T^n : n \in \mathbb Z \,\}\ \text{ is an orthonormal basis of } L^2_0', 'at': 0.3, 'tone': 'ink'},
             {'tex': r'U_T \;\cong\; \text{multiplication by } z \text{ on } L^2(S^1)', 'at': 1.4, 'tone': 'accent'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Inner products along one orbit $f \\circ T^n$: the identity matrix'},
         {'at': 4.5, 'text': 'And complete: one orbit spans everything. Bernoulli shifts need infinitely many'},
         {'at': 7.0, 'text': 'Built from smooth twists of the 3-torus'}]},
     {'form': 'status', 'label': "Banach's question (Scottish Book), in Rokhlin's form",
      'statement': [r'\{ f \circ T^n \}_{n \in \mathbb Z}\ \text{ orthonormal basis of } L^2_0(\mathbb T^3)',
                    r'T\ \ C^\infty,\ \text{volume-preserving, mixing}'],
      'context': 'Before: a Lebesgue component of multiplicity two (Mathew and Nadkarni, 1984)',
      'stamp': 'proved',
      'note': 'Probability-space form: the real-line question Ulam recorded differs'},
     'Comparator statement ThreeTorus.lean, standard axioms; not in the main-results list',
     OUR_LEAN,
     [R('144', 'known_before', 'Mathew & Nadkarni (1984) Lebesgue component of multiplicity two'),
      R('144', 'claim', 'There is a C-infinity diffeomorphism T of the 3-torus preserving Lebesgue volume'),
      R('144', 'caveats', 'The paper itself says the historical real-line question recorded by Ulam differs from the probability-space form solved here.'),
      R('144', 'caveats', 'Lean challenge ThreeTorus.lean exists with docs/144.md (standard axioms), but it is not listed in formalization.yaml status.main_results.'),
      CP('144'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 145 ----
spec('145', 'proof',
     "Rokhlin's multiple-mixing problem",
     "Rokhlin's multiple-mixing problem",
     'Claim: every invertible mixing transformation of any probability space is mixing of every order',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'numberline', 'until': 4.2, 'min': 0, 'max': 30, 'ticks': [], 'axisLabel': 'time',
          'markers': [{'v': 2, 'label': '$A$', 'note': 'now', 'tone': 'ink', 'at': 0.5},
                      {'v': 10, 'label': '$T^{-n}B$', 'note': 'gap $n$', 'tone': 'ink', 'at': 0.8}],
          'slide': {'from': 15, 'to': 27, 'at': 1.4, 'dur': 1.6, 'label': '$T^{-(n+m)}C$', 'note': 'gap $m \\to \\infty$'}},
         {'primitive': 'equation', 'from': 4.2, 'mode': 'stack', 'lines': [
             {'tex': r'\mu(A \cap T^{-n}B) \;\to\; \mu(A)\,\mu(B)', 'at': 0.3, 'tone': 'soft'},
             {'tex': r'\mu(A \cap T^{-n}B \cap T^{-(n+m)}C) \;\to\; \mu(A)\,\mu(B)\,\mu(C)', 'at': 1.3, 'tone': 'accent'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Mixing: events far apart in time become independent'},
         {'at': 4.3, 'text': 'Rokhlin, 1949: does that force three or more events to decouple jointly?'},
         {'at': 6.8, 'text': 'Claim: yes, for every order $k \\ge 3$'}]},
     {'form': 'status', 'label': "Rokhlin's multiple-mixing problem (1949)",
      'statement': [r'\text{mixing} \;\Rightarrow\; \text{mixing of every order } k \ge 3'],
      'context': 'Before: rank one (Kalikow 1984), singular spectrum (Host 1991), finite rank (Ryzhikov 1993)',
      'stamp': 'proved',
      'note': 'Any probability space, standard or not, in 40 pages; false for $\\mathbb Z^2$ actions'},
     'Comparator Rokhlin.lean states every order $k \\ge 3$, standard axioms; not in main results',
     OUR_FAITH,
     [R('145', 'known_before', 'Posed by Rokhlin (1949).'),
      R('145', 'known_before', 'rank-one maps 2→3 (Kalikow 1984); singular spectrum (Host 1991); finite rank (Ryzhikov 1993); mixing locally uniformly shearing flows (Kanigowski–Ravotti); fails for Z^2 actions (Ledrappier 1978)'),
      R('145', 'caveats', 'Only 40 pages for one of ergodic theory\'s most famous problems.'),
      R('145', 'caveats', 'uses only propext/Quot.sound/Classical.choice, but is not in formalization.yaml main_results'),
      CP('145'), READ_FAITHFUL, NOBUILD])

# ---------------------------------------------------------------- 146 ----
spec('146', 'proof',
     'Positive entropy for the standard map',
     'Positive metric entropy for the standard map',
     'Claim: past some $k_0$, every Chirikov standard map has positive metric entropy for area',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'plot', 'until': 4.4, 'x': [0, 1], 'y': [-1.25, 1.25],
          'xticks': [0, {'v': 0.25, 'label': '1/4'}, {'v': 0.5, 'label': '1/2'}, {'v': 0.75, 'label': '3/4'}, 1],
          'yticks': [], 'xlabel': '$x$', 'ylabel': 'kick $\\propto \\sin 2\\pi x$', 'labelRoom': 60,
          'curves': [{'f': 'sin(2*PI*x)', 'tone': 'accent', 'at': 0.5, 'dur': 1.6}],
          'asymptotes': [{'x': 0.25, 'at': 2.0}, {'x': 0.75, 'at': 2.0}],
          'points': [{'x': 0.25, 'y': 1, 'label': '$\\cos 2\\pi x = 0$', 'at': 2.4, 'tone': 'hot'},
                     {'x': 0.75, 'y': -1, 'label': 'expansion lost', 'at': 2.6, 'tone': 'hot'}]},
         {'primitive': 'numberline', 'from': 4.4, 'min': 0, 'max': 10, 'ticks': [{'v': 0, 'label': '0'}],
          'axisLabel': 'the parameter $k$, schematically',
          'markers': [{'v': 3, 'label': '$k_0$', 'note': 'exists, not explicit', 'tone': 'claim', 'at': 0.6, 'side': 'above'}],
          'ranges': [{'from': 3, 'to': 10, 'label': 'claimed: positive entropy', 'note': 'every $k \\ge k_0$', 'tone': 'claim', 'at': 1.2}]}],
      'beats': [
         {'at': 0.2, 'text': '$f_k(x,y) = (x + y + k\\sin 2\\pi x,\\ y + k\\sin 2\\pi x)$ loses expansion where $\\cos 2\\pi x = 0$'},
         {'at': 4.5, 'text': 'Sinai asked for a positive-measure set of $k$. The claim covers every $k \\ge k_0$'},
         {'at': 7.0, 'text': 'Elliptic islands kept blocking proofs for decades'}]},
     {'form': 'status', 'label': "Sinai's conjecture (Berger–Turaev, Conjecture 0.4)",
      'statement': [r'h_{\mathrm{area}}(f_k) > 0\ \ \text{ for every } k \ge k_0'],
      'context': 'Before: positive entropy only after a $C^\\infty$ perturbation (Berger and Turaev, 2019)',
      'stamp': 'proved',
      'note': '$k_0$ is not explicit; no claim of ergodicity'},
     'Comparator statements for entropy, Lyapunov exponent and components; not in main results',
     OUR_LEAN,
     [R('146', 'known_before', 'in the form of Berger & Turaev (Conjecture 0.4)'),
      R('146', 'known_before', 'Berger & Turaev (2019) positive entropy after C^∞ perturbation'),
      R('146', 'claim', 'f_k(x,y)=(x+y+k sin 2πx, y+k sin 2πx)'),
      R('146', 'caveats', 'but k0 is not explicit; no claim of ergodicity or a.e. positive exponents'),
      R('146', 'caveats', 'Lean challenges StandardMapEntropy/Lyapunov/Components exist (docs/146.md), not in yaml main_results.'),
      CP('146'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 147 ----
a, b = 1.3, 0.8
c2 = a * a - b * b
caustics = []
for i, ap in enumerate([1.22, 1.15, 1.08]):
    caustics.append({'kind': 'ellipse', 'rx': ap, 'ry': round(math.sqrt(ap * ap - c2), 4), 'tone': 'cool', 'dash': True,
                     'fill': False, 'w': 1.8, 'at': 2.6 + 0.4 * i, 'dur': 1.0})
fx = round(math.sqrt(c2), 4)
spec('147', 'proof',
     'The near-boundary Birkhoff conjecture',
     'The near-boundary Birkhoff conjecture',
     'Claim: a smooth convex billiard with a continuous collar of caustics at its boundary is an ellipse',
     {'dur': 8.4, 'primitive': 'shape',
      'shapes': [{'kind': 'ellipse', 'rx': a, 'ry': b, 'tone': 'accent', 'w': 3, 'label': 'table', 'labelAt': [0, 0.95], 'at': 0.3, 'fillA': 0.06}] + caustics,
      'points': [{'p': [-fx, 0], 'label': 'focus', 'at': 1.6, 'tone': 'soft'}, {'p': [fx, 0], 'at': 1.6, 'tone': 'soft'}],
      'beats': [
         {'at': 0.2, 'text': 'A caustic is a curve that billiard trajectories stay tangent to'},
         {'at': 2.8, 'text': 'An ellipse has a full collar of them next to its boundary: confocal ellipses'},
         {'at': 5.6, 'text': 'Claim: a continuous collar like this forces the table to be an ellipse'}]},
     {'form': 'status', 'label': 'Birkhoff conjecture (1927), near-boundary form',
      'statement': [r'\text{continuous collar of caustics} \;\Rightarrow\; \text{ellipse}'],
      'context': 'Before: only near ellipses (Avila–De Simoi–Kaloshin 2016; Kaloshin–Sorrentino 2018)',
      'stamp': 'proved',
      'note': 'Not the full conjecture: the Cantor family of caustics KAM gives does not count'},
     'No Lean statement: a 146-page main paper plus a 27-page bridge',
     OUR_NONE,
     [R('147', 'known_before', 'Birkhoff conjecture (Birkhoff 1927; Poritsky 1950)'),
      R('147', 'known_before', 'Avila, De Simoi & Kaloshin (Annals 2016) near low-eccentricity ellipses; Kaloshin & Sorrentino (Annals 2018) near any ellipse'),
      R('147', 'caveats', 'No Lean. 146-page main paper plus 27-page bridge.'),
      R('147', 'caveats', 'a Cantor family, which is what KAM gives generically, does not count'),
      CP('147'), READ_ALL])

# ---------------------------------------------------------------- 148 ----
spec('148', 'proof',
     'The dimension of self-similar measures',
     'The entropy-rate dimension formula for self-similar measures',
     'Claim: on the line, $\\dim_H \\mu = \\min\\{1, h_{\\mathrm{RW}}/\\chi\\}$ for every self-similar measure, exact overlaps allowed',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'numberline', 'until': 3.9, 'min': 0, 'max': 10, 'y': 0.58,
          'ticks': [{'v': 0, 'label': '0'}, {'v': 10, 'label': '1'}], 'axisLabel': 'two contractions $x \\mapsto r_i x + t_i$ of $[0,1]$',
          'ranges': [{'from': 0, 'to': 6, 'label': '$f_1[0,1]$', 'tone': 'claim', 'at': 0.6, 'side': 'above'},
                     {'from': 4, 'to': 10, 'label': '$f_2[0,1]$', 'tone': 'cool', 'at': 1.1, 'side': 'below'},
                     {'from': 4, 'to': 6, 'label': 'overlap', 'tone': 'hot', 'at': 1.8, 'side': 'above'}]},
         {'primitive': 'equation', 'from': 3.9, 'mode': 'replace', 'lines': [
             {'tex': r'\dim_H \mu = \min\Bigl\{1, \frac{H(p)}{\chi}\Bigr\}', 'note': 'Hochman 2014: true under exponential separation', 'at': 0.3, 'tone': 'soft'},
             {'tex': r'\dim_H \mu = \min\Bigl\{1, \frac{h_{\mathrm{RW}}}{\chi}\Bigr\}', 'note': 'claimed: every system, exact overlaps allowed', 'at': 2.3, 'tone': 'accent'}]}],
      'beats': [
         {'at': 0.2, 'text': 'A self-similar measure: the law of a random composition of contractions'},
         {'at': 4.0, 'text': 'If two words give the same map you lose entropy. The conjecture: that is the only way'},
         {'at': 6.5, 'text': 'Count maps, not addresses, and the formula holds'}]},
     {'form': 'status', 'label': "Varjú's Conjecture 3; contains the exact-overlaps conjecture on the line",
      'statement': [r'\dim_H \mu = \min\Bigl\{1, \frac{h_{\mathrm{RW}}}{\chi}\Bigr\}'],
      'context': 'Before: Hochman (2014) under exponential separation; algebraic and special families',
      'stamp': 'proved',
      'note': 'Dimension only: absolute continuity is not addressed'},
     "Main theorem in the release's main formal results (SelfSimilar.json), standard axioms",
     OUR_FAITH,
     [R('148', 'known_before', 'Hochman (Annals 2014): formula with h=H(p) under exponential separation'),
      R('148', 'known_before', "Stated as Conjecture 3 in Varjú's ICM/survey."),
      R('148', 'claim', 'dim_H μ = min{1, h_RW/χ}'),
      R('148', 'caveats', 'Main theorem is in formalization.yaml main_results (SelfSimilar.json, OAI.EntropyRateDimension.entropy_rate_dimension, standard axioms)'),
      R('148', 'caveats', 'Dimension only; absolute continuity not addressed.'),
      CP('148'), READ_FAITHFUL, NOBUILD])

# ---------------------------------------------------------------- 149 ----
spec('149', 'proof',
     'Permanence for mass-action networks',
     'Classwise permanence for weakly reversible mass-action systems',
     'Claim: in every weakly reversible mass-action network, species stay bounded and away from zero, uniformly',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'graph', 'until': 4.0, 'r': 34, 'edgeAt': 0.5, 'edgeDur': 1.8, 'nodes': [
             node('ab', 250, 70, label='$A{+}B$'), node('c', 110, 360, label='$C$'), node('aa', 390, 360, label='$2A$'),
             node('b', 700, 215, label='$B$'), node('z', 940, 215, label='$\\varnothing$')],
          'edges': [['ab', 'c', {'tone': 'accent'}], ['c', 'aa', {'tone': 'accent'}], ['aa', 'ab', {'tone': 'accent'}], ['b', 'z', {'tone': 'cool'}]]},
         {'primitive': 'shape', 'from': 4.0, 'shapes': [
             {'kind': 'polygon', 'points': [[-1.6, -0.95], [1.6, -0.95], [0, 1.0]], 'tone': 'soft', 'fillA': 0.04, 'label': 'class $P$', 'labelAt': [1.25, 0.25], 'at': 0.2, 'dur': 1.0},
             {'kind': 'ellipse', 'c': [0, -0.25], 'rx': 0.6, 'ry': 0.36, 'tone': 'accent', 'fillA': 0.18, 'label': '$K_P$', 'labelAt': [0, -0.25], 'at': 1.2, 'dur': 1.0}],
          'points': [{'p': [-1.15, -0.75], 'label': 'start', 'at': 1.8, 'tone': 'ink'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Weakly reversible: every reaction can be undone by a chain of reactions'},
         {'at': 4.1, 'text': 'Claim: each conservation class $P$ has one compact convex set $K_P$'},
         {'at': 6.6, 'text': 'Every trajectory enters it in finite time (schematic)'}]},
     {'form': 'status', 'label': 'Persistence and permanence conjectures, weakly reversible networks',
      'statement': [r'\text{every class } P:\ \text{one compact convex } K_P',
                    r'\text{entered by every trajectory in finite time}'],
      'context': 'Before: two species (2013), one linkage class (2014, 2020); the general case open',
      'stamp': 'proved',
      'note': 'Fixed positive rate constants only'},
     'Lean covers boundedness and persistence with start-dependent bounds, not uniform permanence',
     OUR_LEAN,
     [R('149', 'known_before', 'Craciun, Nazarov & Pantea (SIAM J. Appl. Math. 2013): permanence for two-species (endotactic) systems'),
      R('149', 'known_before', 'Gopalkrishnan, Miller & Shiu (SIAM J. Appl. Dyn. Syst. 2014): permanence for strongly endotactic networks, incl. one linkage class; Boros & Hofbauer (SIAM J. Appl. Dyn. Syst. 2020): another single-linkage-class proof'),
      R('149', 'caveats', 'Lean (MassAction challenge, docs/149.md) covers the boundedness/persistence statement with initial-state-dependent bounds, not the classwise uniform permanence'),
      R('149', 'caveats', 'Fixed rate constants only'),
      CP('149'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 150 ----
# a real billiard path in a triangle, computed by reflection
T = [(200.0, 425.0), (900.0, 425.0), (590.0, 30.0)]
def refl(px, py, dx, dy):
    best = None
    for k in range(3):
        ax, ay = T[k]; bx, by = T[(k + 1) % 3]
        ex, ey = bx - ax, by - ay
        den = dx * ey - dy * ex
        if abs(den) < 1e-12: continue
        t = ((ax - px) * ey - (ay - py) * ex) / den
        u = ((ax - px) * dy - (ay - py) * dx) / den
        if t > 1e-6 and -1e-9 <= u <= 1 + 1e-9 and (best is None or t < best[0]):
            best = (t, k, ex, ey)
    t, k, ex, ey = best
    qx, qy = px + t * dx, py + t * dy
    L = math.hypot(ex, ey); ux, uy = ex / L, ey / L
    dot = dx * ux + dy * uy
    return qx, qy, 2 * dot * ux - dx, 2 * dot * uy - dy
px, py = 430.0, 425.0
ang = math.radians(-63.0)
dx, dy = math.cos(ang), math.sin(ang)
pts = [(px, py)]
for _ in range(13):
    px, py, dx, dy = refl(px, py, dx, dy)
    pts.append((px, py))
nodes = [node(f'v{i}', x, y, tone='soft') for i, (x, y) in enumerate(T)]
nodes += [node(f'p{i}', x, y, tone='accent') for i, (x, y) in enumerate(pts)]
edges = [['v0', 'v1', {'tone': 'soft', 'w': 2.6}], ['v1', 'v2', {'tone': 'soft', 'w': 2.6}], ['v2', 'v0', {'tone': 'soft', 'w': 2.6}]]
edges += [[f'p{i}', f'p{i + 1}', {'tone': 'accent', 'w': 2, 'a': 0.9}] for i in range(len(pts) - 1)]
spec('150', 'proof',
     'Irrational triangle billiards are ergodic',
     'Weak mixing of triangular billiards with an irrational angle',
     'Claim: in every triangle with an angle irrational to $\\pi$, the billiard flow is ergodic and weakly mixing',
     {'dur': 8.6, 'primitive': 'graph', 'r': 4, 'edgeAt': 0.4, 'edgeDur': 5.2, 'nodes': nodes, 'edges': edges,
      'beats': [
         {'at': 0.2, 'text': 'A ball bouncing in a triangle: no curvature to make it chaotic'},
         {'at': 3.0, 'text': 'Unfolded, the path is a straight line on a flat surface with cone points'},
         {'at': 5.8, 'text': 'Claim: with an irrational angle, almost every path fills the table evenly'}]},
     {'form': 'status', 'label': 'Ergodicity of every irrational triangle billiard',
      'statement': [r'\text{an angle} \notin \pi\mathbb Q \;\Rightarrow\; \text{ergodic, weakly mixing}'],
      'context': 'Before: a dense $G_\\delta$ of polygons (Kerckhoff–Masur–Smillie 1986); numerics raised doubts',
      'stamp': 'proved',
      'note': 'Two papers of 12 and 13 pages: very short for a problem this hard'},
     'Ergodicity has a Comparator statement that builds the billiard flow; weak mixing has none',
     OUR_LEAN,
     [R('150', 'known_before', 'Kerckhoff, Masur & Smillie (Annals 1986): ergodic for a dense G_δ of polygons'),
      R('150', 'caveats', 'Two papers of 12 and 13 pages for a problem considered very hard'),
      R('150', 'caveats', 'Ergodicity is formalized (IrrationalTriangleBilliard challenge, docs/150.md, standard axioms; not in yaml main_results); weak mixing is not.'),
      CP('150'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 151 ----
spec('151', 'disproof',
     "A $C^1$ counterexample to Shub's conjecture",
     'A $C^1$ counterexample to the entropy conjecture',
     'Claim: a $C^1$ self-map with zero topological entropy whose homology grows like $2^n$',
     # equation visualiser: the conjecture's two sides named, the squaring sphere's doubling
     # drawn (illustrative), and the claimed inequality animated as a bar that falls short
     {'dur': 6.2, 'primitive': 'equation', 'mode': 'replace', 'lines': [
         {'tex': r'\term{h}{h_{\mathrm{top}}(f)} \;\ge\; \term{r}{\log \rho(f_*)}', 'note': "Shub's conjecture", 'at': 0.2, 'tone': 'soft', 'y': 0.3,
          'terms': {'h': {'label': 'how fast orbits separate', 'tone': 'cool', 'at': 0.5},
                    'r': {'label': 'growth on homology', 'tone': 'warn', 'at': 1.0,
                          'visual': {'kind': 'curve', 'f': 'Math.pow(2, x)', 'x': [0, 5], 'y': [0, 32], 'dx': 40, 'w': 150, 'h': 70}}}},
         {'tex': r'\term{z}{h_{\mathrm{top}}(f) = 0} \;<\; \term{l}{\log 2} \;\le\; \log \rho(f_*)', 'at': 2.6, 'tone': 'accent', 'y': 0.3,
          'terms': {'z': {'label': 'zero entropy', 'tone': 'cool', 'at': 0.4},
                    'l': {'label': 'eigenvalue 2 on $H_2$', 'tone': 'warn', 'at': 0.9}},
          'relation': {'kind': 'lt', 'at': 1.3, 'left': {'from': 1.0, 'v': 0.04, 'label': '$h_{\\mathrm{top}}$'},
                       'right': {'v': 0.7, 'label': '$\\log 2$'}, 'dy': 80}}],
      'beats': [
         {'at': 0.15, 'text': 'Shub, 1974: growth in homology should force topological entropy'},
         {'at': 2.5, 'text': 'One sphere coordinate mostly squares, giving the factor 2; a circle clock can stall'},
         {'at': 4.4, 'text': 'Small stored signals hide the winding: $C^1$ is just enough room'}]},
     {'form': 'status', 'stamp': 'disproved', 'label': "Shub's entropy conjecture (1974), $C^1$ self-map form",
      'statement': [r'h_{\mathrm{top}}(f) \ge \log \rho(f_*)\ \text{ fails for some } C^1 f'],
      'context': 'Yomdin (1987) proved it for $C^\\infty$; the counterexample lives on $S^1 \\times (S^2)^{q+1}$',
      'note': 'Noninvertible map: the $C^1$ diffeomorphism case remains open'},
     'Comparator builds the manifold concretely in Euclidean space; not in the main-results list',
     OUR_LEAN,
     [R('151', 'known_before', 'Shub (1974) entropy conjecture'),
      R('151', 'known_before', 'Yomdin (1987) C^∞'),
      R('151', 'claim', "h_top(f)=0 < log 2 ≤ log ρ(f_*), disproving the general C^1 self-map form of Shub's entropy conjecture"),
      R('151', 'caveats', 'Noninvertible map; the C^1 diffeomorphism case (the version many authors mean) remains open.'),
      R('151', 'caveats', 'formalizes the existence statement with the manifold concretely S^1×(S^2)^{q+1} embedded in Euclidean space'),
      CP('151'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 152 ----
spec('152', 'counterexample',
     'Zero entropy, no smooth model',
     'Zero entropy does not guarantee a smooth positive-volume model',
     'Claim: an ergodic zero-entropy system that no smooth volume-preserving map on any compact manifold realizes',
     {'dur': 8.4, 'primitive': 'shape', 'shapes': [
         {'kind': 'ellipse', 'rx': 2.3, 'ry': 1.08, 'tone': 'soft', 'fillA': 0.05, 'label': 'finite entropy', 'labelAt': [1.25, 0.5], 'at': 0.3},
         {'kind': 'ellipse', 'c': [-0.85, -0.05], 'rx': 1.05, 'ry': 0.72, 'tone': 'accent', 'fillA': 0.14, 'label': 'smooth volume models', 'labelAt': [-0.85, -0.05], 'at': 2.4}],
      'points': [{'p': [0.95, -0.5], 'label': 'new: $h = 0$', 'at': 5.2, 'tone': 'hot'}],
      'beats': [
         {'at': 0.2, 'text': 'Kushnirenko: smooth volume-preserving maps have finite entropy'},
         {'at': 2.7, 'text': 'That was the only known obstruction to a smooth model (schematic sets)'},
         {'at': 5.3, 'text': 'Claim: a zero-entropy ergodic system outside the smooth ones'}]},
     {'form': 'status', 'stamp': 'counterexample', 'label': 'Smooth realization problem (Anosov–Katok 1970)',
      'statement': [r'h(T) = 0,\ T \text{ ergodic, no smooth positive-volume model}'],
      'context': 'Before: infinite entropy was the only known obstruction (Kushnirenko)',
      'note': 'Models preserving other measures are not excluded'},
     'Lean proves only a finite-entropy version; the zero-entropy point is outside it',
     OUR_LEAN,
     [R('152', 'known_before', 'Smooth realization problem (Anosov–Katok 1970'),
      R('152', 'known_before', 'Only obstruction known: Kushnirenko — smooth diffeomorphisms have finite entropy.'),
      R('152', 'caveats', 'Lean (SmoothObstruction, docs/152.md) only proves the finite-entropy version; the zero-entropy conclusion, which is the actual point, is outside the formalized statement.'),
      R('152', 'caveats', 'Smooth model here means positive smooth volume; does not exclude models preserving other measures.'),
      CP('152'), READ_ALL, NOBUILD])

# ---------------------------------------------------------------- 153 ----
salem = max(r.real for r in __import__('numpy').roots([1, -1, -1, -1, 1]) if abs(r.imag) < 1e-12)
golden = (1 + math.sqrt(5)) / 2
spec('153', 'proof',
     'Singular Bernoulli convolutions beyond Pisot',
     'Non-Pisot singularity for Bernoulli convolutions',
     'Claim: $\\nu_\\lambda$ is singular whenever $1/\\lambda$ is a quartic Salem number in $(1,2)$',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'equation', 'until': 3.0, 'mode': 'replace', 'lines': [
             {'tex': r'\nu_\lambda = \text{law of } \textstyle\sum_{n \ge 0} \pm\, \lambda^n', 'note': 'independent fair signs', 'at': 0.3, 'tone': 'ink'}]},
         {'primitive': 'numberline', 'from': 3.0, 'min': 1, 'max': 2, 'ticks': [{'v': 1, 'label': '1'}, {'v': 2, 'label': '2'}],
          'axisLabel': 'the parameter $1/\\lambda$',
          'markers': [{'v': round(golden, 10), 'derived': '(1 + sqrt 5)/2', 'label': 'golden ratio', 'note': 'Pisot: singular (1939)', 'at': 0.6},
                      {'v': round(salem, 10), 'derived': 'largest real root of x^4 - x^3 - x^2 - x + 1', 'label': 'a quartic Salem', 'note': 'claimed singular', 'tone': 'claim', 'at': 2.4}]}],
      'beats': [
         {'at': 0.2, 'text': 'A Bernoulli convolution: the law of a random signed series in powers of $\\lambda$'},
         {'at': 3.1, 'text': '$\\text{Erd\\H{o}s}$, 1939: singular when $1/\\lambda$ is a Pisot number, like the golden ratio'},
         {'at': 5.7, 'text': 'Claim: singular too at every quartic Salem number in $(1,2)$'}]},
     {'form': 'status', 'label': 'Singular non-Pisot Bernoulli convolutions (recorded as open)',
      'statement': [r'1/\lambda \text{ quartic Salem in } (1,2) \;\Rightarrow\; \nu_\lambda \text{ singular}'],
      'context': 'Before: only Pisot reciprocals were known to give a singular law ($\\text{Erd\\H{o}s}$ 1939)',
      'stamp': 'proved',
      'note': "The 'classification' is an infinite approximation condition, not an algorithm"},
     'No Lean statement; the manuscripts are unformalized',
     OUR_NONE,
     [R('153', 'known_before', 'Erdős (1939): singular when 1/λ Pisot'),
      R('153', 'claim', 'ν_λ is singular when 1/λ is any quartic Salem number in (1,2)'),
      R('153', 'caveats', "The 'classification' is equivalent-but-ineffective (an infinite approximation condition)"),
      R('153', 'known_before', 'Existence of any non-Pisot singular parameter is recorded as open in recent literature'),
      CP('153'), READ_ALL])

# ---------------------------------------------------------------- 154 ----
spec('154', 'proof',
     'Pointwise multiple ergodic averages',
     'Pointwise multiple ergodic averages for mixing transformations',
     'Claim: for every mixing $T$, multiple ergodic averages converge almost everywhere, for any number of functions',
     {'dur': 8.6, 'layout': 'sequence', 'panels': [
         {'primitive': 'equation', 'until': 3.6, 'mode': 'replace', 'lines': [
             {'tex': r'\frac1N \sum_{k \le N}\, \prod_{j=1}^{n} f_j(T^{jk}x) \;\longrightarrow\; \prod_{j=1}^{n} \int f_j', 'note': 'for almost every $x$', 'at': 0.3, 'tone': 'ink'}]},
         {'primitive': 'tree', 'from': 3.6, 'at': 0.3, 'nodes': [
             {'id': 'r', 'label': 'a.e. convergence, mixing $T$', 'status': 'paper'},
             {'id': 'k', 'label': 'Rokhlin (family 145)', 'parent': 'r', 'status': 'lean'},
             {'id': 'h', 'label': '$L^3$ trilinear Hilbert', 'parent': 'r', 'status': 'paper'}]}],
      'beats': [
         {'at': 0.2, 'text': 'Multiple ergodic averages: the dynamical engine behind Szemerédi\'s theorem'},
         {'at': 3.7, 'text': 'Rokhlin\'s theorem identifies the limit; an $L^3$ bound gives convergence'},
         {'at': 6.3, 'text': 'That $L^3$ bound comes from another family, and is a famous problem itself'}]},
     {'form': 'status', 'label': "Furstenberg's pointwise question, the mixing case",
      'statement': [r'\tfrac1N\textstyle\sum_{k\le N}\prod_j f_j(T^{jk}x) \to \prod_j \int f_j\ \ \text{a.e.}'],
      'context': 'Before: $L^2$ convergence (Host–Kra 2005, Ziegler 2007); pointwise for K-systems and distal systems',
      'stamp': 'proved',
      'note': 'Rests on two companion manuscripts from the same release'},
     'No Lean statement; its trilinear Hilbert input is a separate, unformalized manuscript',
     OUR_NONE,
     [R('154', 'known_before', 'Host–Kra (2005) and Ziegler (2007) L^2 convergence'),
      R('154', 'caveats', 'Depends on two companion results: Rokhlin multiple mixing (family 145) and an L^3 bound for the trilinear Hilbert transform'),
      A('Dynamics: four more structural results', "It imports Rokhlin's theorem from family 145 and an $L^3$ bound for the trilinear Hilbert transform from another family of the release, which is itself a famous open problem in harmonic analysis."),
      CP('154'), READ_ALL])
print('dyn ok')
