import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, math, os, sys
sys.path.insert(0, _o.path.join(GEN, 'enrich-ap'))
import enrich as ENRICH
OUT = _OUT
PDE = 'Partial differential equations'
SCHEMA = '../../brand-crew/skills/math-reels/schema.json'
BW, BH = 1088, 448 - 14  # stage box (with heading)

def R(v): return round(v, 4)
def nd(id, x, y, **k): return dict(id=id, x=R(x / BW), y=R(y / BH), **k)

def write(spec):
    spec = {'$schema': SCHEMA, **spec}
    ENRICH.apply(spec)  # plain, proof, voice, object timing (oaimath/enrich-ap/enrich.py)
    with open(os.path.join(OUT, spec['id'] + '.json'), 'w') as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------- 366
nodes, edges = [], []
# smooth arc
arc = [(50, 250), (120, 205), (200, 188), (280, 200)]
for i, (x, y) in enumerate(arc): nodes.append(nd(f'a{i}', x, y, tone='accent'))
nodes[2]['label'] = 'arc'; nodes[2].update(lx=0, ly=120, lax=0.5)
for i in range(3): edges.append([f'a{i}', f'a{i+1}', {'tone': 'accent'}])
# crack tip
tip = [(350, 290), (420, 235), (500, 212)]
for i, (x, y) in enumerate(tip): nodes.append(nd(f't{i}', x, y, tone='accent'))
nodes[-1]['fill'] = 'hot'
nodes[-2]['label'] = 'crack tip'; nodes[-2].update(lx=0, ly=95, lax=0.5)
for i in range(2): edges.append([f't{i}', f't{i+1}', {'tone': 'accent'}])
# triple junction at 120 degrees
cx, cy, L = 700, 230, 95
nodes.append(nd('j', cx, cy, tone='accent', fill='accent'))
for k, ang in enumerate([90, 210, 330]):
    a = math.radians(ang)
    nodes.append(nd(f'j{k}', cx + L * math.cos(a), cy - L * math.sin(a), tone='accent'))
    edges.append(['j', f'j{k}', {'tone': 'accent'}])
nodes[-1]['label'] = '$120^\\circ$ junction'
nodes[-1].update(lx=-82, ly=88, lax=0.5)
# the island that the proof excludes
isl = [(900, 205), (985, 190), (1005, 262), (915, 280)]
for i, (x, y) in enumerate(isl): nodes.append(nd(f'i{i}', x, y, tone='bad'))
nodes[-1]['label'] = 'island: ruled out'; nodes[-1].update(lx=40, ly=76, lax=0.5)
for i in range(4): edges.append([f'i{i}', f'i{(i+1)%4}', {'tone': 'bad'}])

write({
  'id': '366', 'discipline': PDE, 'kind': 'proof',
  'short': 'Planar Mumford–Shah regularity',
  'title': {'title': 'The planar Mumford–Shah conjecture',
            'subtitle': 'Claim: near each interior point, a minimizer\'s edge set is a smooth arc, a crack tip or a $120^\\circ$ triple junction'},
  'object': {
    'dur': 8.4,
    'heading': 'Schematic: what the edge set $K$ may look like up close',
    'primitive': 'graph', 'r': 5, 'nodes': nodes, 'edges': edges, 'edgeAt': 0.4, 'edgeDur': 5.6,
    'beats': [
      {'at': 0.2, 'text': 'Mumford–Shah segments an image into a smooth part $u$ and an edge set $K$'},
      {'at': 3.2, 'text': 'Decades of work reduced the conjecture to one case: a bounded island of edge'},
      {'at': 5.9, 'text': 'The paper shows deleting the island saves length, so it cannot occur'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'Conjecture of Mumford and Shah (1989)',
    'statement': ['K \\text{ near each interior point: a } C^{1,\\alpha} \\text{ arc, a crack tip,}',
                  '\\text{or three arcs meeting at } 120^\\circ'],
    'context': 'Two days earlier, Deangelis posted a proof (arXiv:2609.26732). This is a second, independent one',
    'stamp': 'proved',
    'note': 'Interior only, absolute minimizers, $C^{1,\\alpha}$ arcs'},
  'verify': {'lean': 'part',
             'detail': 'Lean: the core compact-piece exclusion step. Not the reduction or the regularity inputs',
             'ourCheck': 'We found the Lean tree by grep; we did not build it'},
  'sources': [
    {'ref': 'review 366, claim', 'quote': 'a C^{1,α} arc ending at it (crack tip), or three C^{1,α} arcs meeting at 120°'},
    {'ref': 'review 366, known_before', 'quote': 'Conjectured by Mumford and Shah (CPAM 1989).'},
    {'ref': 'review 366, known_before', 'quote': "Francesco Deangelis posted 'Solution of the Mumford-Shah conjecture' (arXiv:2609.26732, v1 22 Sep 2026, v2 5 Oct 2026)"},
    {'ref': 'article, The planar Mumford–Shah conjecture', 'quote': 'This is a second, independent proof, not the first.'},
    {'ref': 'article, The planar Mumford–Shah conjecture', 'quote': 'Decades of work (Bonnet, David, Ambrosio–Fusco–Pallara, De Lellis–Focardi) reduced it to excluding one scenario, a bounded island of edge floating in a whole-plane blow-up limit.'},
    {'ref': 'article, The planar Mumford–Shah conjecture', 'quote': 'So the field vanishes, and deleting the island saves length.'},
    {'ref': 'article, The planar Mumford–Shah conjecture', 'quote': 'The reduction and the regularity inputs are not formalized. Interior statement only, absolute minimizers, $C^{1,\\alpha}$ arcs.'},
    {'ref': 'article, The planar Mumford–Shah conjecture', 'quote': 'I found that tree by grepping.'},
    {'ref': 'review 366, lean', 'quote': 'proves the core compact-piece exclusion step'},
  ]})

# ---------------------------------------------------------------- 367
write({
  'id': '367', 'discipline': PDE, 'kind': 'proof',
  'short': 'Bernoulli free boundaries: $d^* = 7$',
  'title': {'title': 'The critical dimension of the one-phase Bernoulli problem is 7',
            'subtitle': 'Claim: every one-homogeneous minimizer in $\\mathbb{R}^d$, $d \\le 6$, is flat, so free boundaries are smooth through dimension 6'},
  'object': {
    'dur': 8.4, 'primitive': 'numberline', 'min': 2.5, 'max': 8.5, 'y': 0.56,
    'ticks': [3, 4, 5, 6, 7, 8],
    'axisLabel': '$d^*$: the first dimension with a nonflat minimizing cone',
    'markers': [
      {'v': 4, 'label': '$d^* \\ge 4$', 'note': 'Caffarelli et al., 2004', 'at': 0.6},
      {'v': 5, 'label': '$d^* \\ge 5$', 'note': 'Jerison–Savin, 2015', 'at': 1.1},
      {'v': 7, 'label': 'cone in $\\mathbb{R}^7$', 'note': 'De Silva–Jerison, 2009', 'at': 1.6, 'side': 'below'},
    ],
    'ranges': [{'from': 5, 'to': 7, 'label': 'open', 'note': '$d^* \\in \\lbrace 5, 6, 7\\rbrace$', 'at': 2.4}],
    'slide': {'from': 5, 'to': 7, 'at': 4.4, 'dur': 1.5, 'label': 'claimed $d^* = 7$', 'note': 'cones flat for $d \\le 6$'},
    'beats': [
      {'at': 0.2, 'text': 'Free boundaries are smooth away from a singular set governed by $d^*$'},
      {'at': 2.8, 'text': 'Known since 2015: $d^*$ is 5, 6 or 7'},
      {'at': 5.6, 'text': 'The claim: no nonflat cone in dimensions 5 and 6, so $d^* = 7$'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'The critical dimension of the one-phase Bernoulli problem',
    'statement': ['d^* = 7', '\\dim_H \\mathrm{Sing} \\le n - 7 \\text{ for } n \\ge 7'],
    'context': 'Before: $d^* \\in \\lbrace 5, 6, 7\\rbrace$ (Jerison–Savin 2015; De Silva–Jerison 2009)',
    'stamp': 'proved',
    'note': 'The Bernoulli analogue of Simons\' theorem for minimal surfaces'},
  'verify': {'lean': 'part',
             'detail': 'Lean: only the nonflat cone in $\\mathbb{R}^7$, the 2009 half. Flatness in $d = 5, 6$ is not formalized',
             'ourCheck': 'We read the Lean docs; we did not build the Lean'},
  'sources': [
    {'ref': 'review 367, known_before', 'quote': 'Caffarelli–Jerison–Kenig 2004: d*≥4; Jerison–Savin 2015: stable homogeneous cones flat for d≤4, so d*≥5; De Silva–Jerison 2009: nonflat minimizing cone in R^7, so d*≤7.'},
    {'ref': 'review 367, claim', 'quote': 'dim_H Sing ≤ n−7 for n≥7 (sharp)'},
    {'ref': 'article, The critical dimension of the one-phase Bernoulli problem is 7', 'quote': 'Family 367 claims $d^* = 7$. It is the free-boundary analogue of Simons\' theorem that makes 8 critical for minimal surfaces.'},
    {'ref': 'article, The critical dimension of the one-phase Bernoulli problem is 7', 'quote': 'Lean covers only the existence of the non-flat cone in $\\mathbb R^7$ (`OAI/Analysis/BernoulliCone/Main.lean:10`), which is the 2009 half. The new part, flatness in dimensions 5 and 6, is not formalized.'},
    {'ref': 'review 367, lean', 'quote': 'per lean/docs/367.md and ComparatorChallenges/BernoulliNonflatInSeven.lean, only the existence side is formalized'},
  ]})

# ---------------------------------------------------------------- 368
blob = []
for k in range(14):
    t = 2 * math.pi * k / 14
    r = 0.95 + 0.18 * math.sin(2 * t + 0.6) + 0.1 * math.cos(3 * t)
    blob.append([R(1.25 * r * math.cos(t)), R(r * math.sin(t) * 0.9)])
sq = [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]
write({
  'id': '368', 'discipline': PDE, 'kind': 'proof',
  'short': 'Ball–Evans approximation in $\\mathbb{R}^3$',
  'title': {'title': 'The Ball–Evans approximation problem in three dimensions',
            'subtitle': 'Claim: every $W^{1,p}$ homeomorphism between bounded domains in $\\mathbb{R}^3$ is a limit of smooth diffeomorphisms'},
  'object': {
    'dur': 8.6, 'layout': 'sequence',
    'panels': [
      {'primitive': 'shape', 'until': 3.8,
       'shapes': [
         {'kind': 'polygon', 'points': sq, 'label': '$\\Omega \\to \\Lambda$', 'tone': 'accent', 'at': 0.2, 'dur': 0.9,
          'morph': {'kind': 'polygon', 'points': blob, 'at': 1.2, 'dur': 1.6}},
       ]},
      {'primitive': 'numberline', 'from': 3.8, 'min': 1.5, 'max': 6.5, 'y': 0.55,
       'ticks': [2, 3, 4, 5, 6], 'axisLabel': 'the dimension $n$',
       'markers': [
         {'v': 2, 'label': 'solved', 'note': '2011 to 2018', 'at': 0.5, 'tone': 'ok'},
         {'v': 3, 'label': '"wildly open"', 'note': 'Hencl, 2025', 'at': 1.0, 'side': 'below'},
         {'v': 3, 'label': 'claimed', 'note': 'every $1 \\le p < \\infty$', 'tone': 'claim', 'at': 2.8},
       ],
       'ranges': [{'from': 4, 'to': 6, 'label': 'counterexamples', 'note': 'for small $p$', 'tone': 'bad', 'at': 1.5, 'side': 'below'}]},
    ],
    'beats': [
      {'at': 0.2, 'text': 'Schematic: a Sobolev homeomorphism $f$ deforms $\\Omega$ onto $\\Lambda$, like an elastic body'},
      {'at': 2.6, 'text': 'Smoothing it by convolution destroys injectivity'},
      {'at': 4.0, 'text': 'The plane was settled; dimension 4 and up has counterexamples; 3 was open'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'Ball-Evans approximation problem (Ball, 2001)',
    'statement': ['f \\in W^{1,p}(\\Omega, \\Lambda) \\text{ homeo} \\;\\Rightarrow\\; f_j \\to f, \\; f_j \\text{ smooth diffeos}',
                  '\\Omega, \\Lambda \\subset \\mathbb{R}^3 \\text{ bounded}, \\quad 1 \\le p < \\infty'],
    'context': 'Before: Hencl\'s 2025 survey called dimension 3 "wildly open"',
    'stamp': 'proved',
    'note': 'Dimension 3 only; no claim about the inverses'},
  'verify': {'lean': 'none',
             'detail': 'No Lean: 192 pages of intricate geometric construction, the kind where gaps hide',
             'ourCheck': 'We reviewed the papers; we did not verify the constructions'},
  'sources': [
    {'ref': 'review 368, known_before', 'quote': "Question attributed by J. Ball to L.C. Evans (Ball, 'Singularities and computation of minimizers', 2001)."},
    {'ref': 'review 368, known_before', 'quote': 'Iwaniec–Kovalev–Onninen (p=2, ARMA 2011; then all 1<p<∞) and Hencl–Pratelli (p=1, JEMS 2018)'},
    {'ref': 'article, The Ball–Evans approximation problem in three dimensions', 'quote': 'Hencl\'s 2025 survey ([arXiv:2502.01336](https://arxiv.org/abs/2502.01336)) called dimension 3 "wildly open".'},
    {'ref': 'article, The Ball–Evans approximation problem in three dimensions', 'quote': 'Convolution destroys injectivity.'},
    {'ref': 'article, The Ball–Evans approximation problem in three dimensions', 'quote': 'It is 192 pages with no Lean, which is exactly the kind of intricate geometric construction where gaps hide.'},
    {'ref': 'review 368, claim', 'quote': 'Forward convergence only; no claim of Sobolev convergence of inverses.'},
  ]})

# ---------------------------------------------------------------- 369
dom = []
for k in range(72):
    t = 2 * math.pi * k / 72
    r = 1 - 0.3 * math.sin(t) ** 2 + 0.12 * math.sin(t) ** 3
    dom.append([R(1.3 * r * math.cos(t)), R(r * math.sin(t))])
write({
  'id': '369', 'discipline': PDE, 'kind': 'proof',
  'short': 'Hot spots on simply connected domains',
  'title': {'title': 'The hot spots conjecture for simply connected planar domains',
            'subtitle': 'Claim: on a smooth simply connected plate, the first Neumann eigenfunction has no interior critical point'},
  'object': {
    'dur': 8.2,
    'heading': 'Schematic: an insulated plate, smooth and without holes',
    'primitive': 'shape', 'scale': 1.0,
    'shapes': [
      {'kind': 'polygon', 'points': dom, 'tone': 'accent', 'at': 0.2, 'dur': 1.4, 'label': '$\\Omega$', 'labelAt': [0, 0.2]},
    ],
    'points': [
      {'p': [1.3, 0], 'label': 'hottest', 'tone': 'hot', 'at': 2.4},
      {'p': [-1.3, 0], 'label': 'coldest', 'tone': 'cool', 'at': 2.8},
    ],
    'beats': [
      {'at': 0.2, 'text': 'Heat an insulated plate and wait: the hottest and coldest points drift to the edge'},
      {'at': 3.2, 'text': 'It fails with holes (Burdzy–Werner 1999); in the plane, triangles were done in 2020'},
      {'at': 5.8, 'text': 'An interior critical point would break the eigenfunction multiplicity bound'},
    ]},
  'achievement': {
    'form': 'status', "label": "Rauch's hot spots conjecture (1974), smooth simply connected case",
    'statement': ['\\nabla u \\ne 0 \\text{ in } \\Omega', '\\min_{\\partial\\Omega} u < u(x) < \\max_{\\partial\\Omega} u'],
    'context': 'Before: triangles (Judge–Mondal 2020) and symmetric convex cases; false for domains with holes',
    'stamp': 'proved',
    'note': 'Smooth boundary only: convex polygons beyond triangles are not covered'},
  'verify': {'lean': 'main',
             'detail': 'Lean states the strict theorem; it assumes $u$ is smooth up to the boundary',
             'ourCheck': 'We did not build the Lean or run the comparator'},
  'sources': [
    {'ref': 'review 369, known_before', 'quote': 'Posed by J. Rauch (1974/75).'},
    {'ref': 'review 369, known_before', 'quote': 'Burdzy–Werner 1999 counterexample (planar domain with holes)'},
    {'ref': 'review 369, known_before', 'quote': 'Judge–Mondal (Annals 2020 + erratum 2022, all triangles)'},
    {'ref': 'article, The hot spots conjecture', 'quote': 'Heat an insulated plate and wait. Rauch conjectured in 1974 that the hottest and coldest points drift to the edge.'},
    {'ref': 'article, The hot spots conjecture', 'quote': 'That is more eigenfunctions than Nadirashvili\'s multiplicity bound of two allows.'},
    {'ref': 'article, The hot spots conjecture', 'quote': 'The formal statement assumes the eigenfunction is smooth up to the boundary, which elliptic regularity supplies but the proof does not derive.'},
    {'ref': 'article, The hot spots conjecture', 'quote': 'Convex polygons other than triangles are not covered.'},
    {'ref': 'review 369, lean', 'quote': 'I did not run the comparator.'},
  ]})

# ---------------------------------------------------------------- 370
write({
  'id': '370', 'discipline': PDE, 'kind': 'proof',
  'short': 'The Lane–Emden conjecture',
  'title': {'title': 'The Lane–Emden conjecture, in every dimension',
            'subtitle': 'Claim: below the Sobolev hyperbola, $-\\Delta u = v^p$, $-\\Delta v = u^q$ has no positive solution on $\\mathbb{R}^n$'},
  'object': {
    'dur': 8.6,
    'heading': 'Exponents $(p, q)$ for $n = 5$, the first open dimension',
    'primitive': 'plot', 'x': [0, 8], 'y': [0, 8],
    'xticks': [0, 2, 4, 6, 8], 'yticks': [2, 4, 6, 8], 'xlabel': '$p$', 'ylabel': '$q$', 'labelRoom': 210,
    'regions': [
      {'f': '1/(0.6-1/(x+1))-1', 'from': 0.68, 'to': 8, 'at': 2.6},
      {'f': '40', 'from': 0, 'to': 0.68, 'at': 2.6},
    ],
    'curves': [{'f': '1/(0.6-1/(x+1))-1', 'from': 0.72, 'to': 8, 'label': 'Sobolev hyperbola', 'at': 0.7, 'dur': 1.8}],
    'points': [{'x': 2.2, 'y': 0.9, 'label': 'no positive solution', 'at': 3.2}],
    'beats': [
      {'at': 0.2, 'text': 'The hyperbola $\\tfrac{1}{p+1} + \\tfrac{1}{q+1} = \\tfrac{n-2}{n}$, drawn exactly for $n = 5$'},
      {'at': 3.0, 'text': 'Below it, the conjecture says no positive solution exists'},
      {'at': 5.7, 'text': 'Proved up to $n = 4$ (Souplet, 2009); now claimed for every $n$'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'Lane-Emden conjecture (Mitidieri; Serrin-Zou; Souplet)',
    'statement': ['\\tfrac{1}{p+1} + \\tfrac{1}{q+1} > \\tfrac{n-2}{n}', '\\Longrightarrow \\text{ no positive entire solution}'],
    'context': 'Before: proved for $n \\le 4$; only partial regions for $n \\ge 5$, as recently as October 2025',
    'stamp': 'proved',
    'note': 'Also the weighted Hénon–Lane–Emden system, with $|x|^A$, $|x|^B$ weights'},
  'verify': {'lean': 'main',
             'detail': 'Lean: the full nonexistence theorem. The existence half of Phan\'s classification is imported',
             'ourCheck': 'We did not run the comparator'},
  'sources': [
    {'ref': 'article, The Lane–Emden conjecture', 'quote': 'no positive solution when $\\frac{1}{p+1} + \\frac{1}{q+1} > \\frac{n-2}{n}$'},
    {'ref': 'article, The Lane–Emden conjecture', 'quote': 'It was proved up to $n = 3$ by Serrin–Zou and Poláčik–Quittner–Souplet, and $n = 4$ by Souplet in 2009. Above that there were only partial regions, as recently as October 2025.'},
    {'ref': 'article, The Lane–Emden conjecture', 'quote': 'Family 370 claims every dimension, plus the weighted Hénon–Lane–Emden version with $|x|^A$ and $|x|^B$ weights'},
    {'ref': 'article, The Lane–Emden conjecture', 'quote': 'The existence half of Phan\'s classification is imported from Bidaut-Véron and Giacomini.'},
    {'ref': 'review 370, known_before', 'quote': 'Open for n≥5 as of 2025.'},
    {'ref': 'review 370, lean', 'quote': 'Comparator not run by me.'},
  ]})

# ---------------------------------------------------------------- 371
write({
  'id': '371', 'discipline': PDE, 'kind': 'proof',
  'short': 'Stable blowup for defocusing NLS',
  'title': {'title': 'Stable blowup for a defocusing Schrödinger equation',
            'subtitle': 'Claim: an open set of smooth data on the 12-dimensional torus blows up in finite time'},
  'object': {
    'dur': 8.4,
    'heading': 'Schematic: the size of $u$ at the blowup point; dashed: nearby data',
    'primitive': 'plot', 'x': [0, 1.25], 'y': [0, 7],
    'xticks': [{'v': 0, 'label': '0'}, {'v': 1, 'label': '$T$'}], 'yticks': [],
    'xlabel': 'time $t$', 'ylabel': '$|u(t, x^*)|$',
    'asymptotes': [{'x': 1, 'at': 0.6}],
    'curves': [
      {'f': '0.9/sqrt(1-x)', 'to': 0.988, 'labelDy': 30, 'tone': 'accent', 'label': 'one datum', 'at': 0.6, 'dur': 2.0},
      {'f': '0.8/sqrt(0.93-x)', 'to': 0.922, 'tone': 'soft', 'dash': True, 'at': 3.2, 'dur': 1.6},
      {'f': '0.85/sqrt(0.965-x)', 'to': 0.956, 'tone': 'soft', 'dash': True, 'at': 3.5, 'dur': 1.6},
    ],
    'beats': [
      {'at': 0.2, 'text': 'Defocusing NLS on $\\mathbb{T}^{12}$: in high dimension, energy no longer controls regularity'},
      {'at': 3.1, 'text': 'Earlier blowups needed a thin set of data. Here every nearby datum blows up too'},
      {'at': 5.9, 'text': 'So smooth random data blow up with positive probability'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'Defocusing NLS: blowup on an open set of data',
    'statement': ['i\\partial_t u + \\Delta u = |u|^{p-1}u \\ \\text{ on } \\mathbb{T}^{12}', '(T-t)^{1/(p-1)}\\,|u(t,x^*)| \\to c_0 > 0'],
    'context': 'Before: blowup only on thin, non-generic data (Merle–Raphaël–Rodnianski–Szeftel, 2022)',
    'stamp': 'proved',
    'note': 'For some odd power $p$, arbitrarily large: not every large $p$'},
  'verify': {'lean': 'main',
             'detail': 'Lean: stable blowup and the random-data corollary, about 191,000 lines',
             'ourCheck': 'We did not build the Lean'},
  'sources': [
    {'ref': 'article, Stable blowup for a defocusing Schrödinger equation', 'quote': 'There is an open set of data on the 12-dimensional torus that blows up in self-similar fashion, so random data blow up with positive probability.'},
    {'ref': 'article, Stable blowup for a defocusing Schrödinger equation', 'quote': 'Merle, Raphaël, Rodnianski and Szeftel showed smooth data can blow up (Inventiones 2022), but only on a thin, non-generic set of data.'},
    {'ref': 'article, Stable blowup for a defocusing Schrödinger equation', 'quote': 'The Lean development is enormous, about 191,000 lines'},
    {'ref': 'article, Stable blowup for a defocusing Schrödinger equation', 'quote': 'the theorem and the Lean give *some* odd power that can be taken arbitrarily large, not every large one.'},
    {'ref': 'review 371, claim', 'quote': 'nonempty open set U⊂H^k(T^12)'},
    {'ref': 'review 371, claim', 'quote': '(T−t)^{1/(p−1)}|u(t,x*)|→c0>0'},
    {'ref': 'review 371, lean', 'quote': 'Not run by me.'},
  ]})

# ---------------------------------------------------------------- 372
body = []
for k in range(64):
    t = 2 * math.pi * k / 64
    r = 1 + 0.12 * math.cos(2 * t) + 0.07 * math.sin(3 * t + 0.4)
    body.append([R(1.45 * r * math.cos(t)), R(0.95 * r * math.sin(t))])
inner = []
for k in range(48):
    t = 2 * math.pi * k / 48
    r = 1 + 0.15 * math.sin(2 * t)
    inner.append([R(0.15 + 0.5 * r * math.cos(t)), R(-0.05 + 0.32 * r * math.sin(t))])
write({
  'id': '372', 'discipline': PDE, 'kind': 'proof',
  'short': 'Calderón\'s problem for isotropic elasticity',
  'title': {'title': 'Boundary data determine an elastic body\'s Lamé moduli',
            'subtitle': 'Claim: on any smooth domain in $\\mathbb{R}^3$, the displacement-to-traction map fixes both $\\lambda$ and $\\mu$'},
  'object': {
    'dur': 8.4, 'layout': 'sequence',
    'panels': [
      {'primitive': 'shape', 'until': 4.8,
       'shapes': [
         {'kind': 'polygon', 'points': body, 'tone': 'accent', 'at': 0.2, 'dur': 1.2, 'fillA': 0.08},
         {'kind': 'polygon', 'points': inner, 'tone': 'soft', 'dash': True, 'at': 1.2, 'dur': 1.0, 'label': '$\\lambda(x), \\mu(x)$ ?', 'labelAt': [0.15, -0.05]},
       ],
       'points': [
         {'p': [-1.5, 0.35], 'label': 'push', 'tone': 'hot', 'at': 2.0},
         {'p': [1.36, 0.55], 'label': 'measure traction', 'tone': 'cool', 'at': 2.6},
       ]},
      {'primitive': 'equation', 'from': 4.8, 'lines': [
         {'tex': '\\Lambda_{\\lambda_1,\\mu_1} = \\Lambda_{\\lambda_2,\\mu_2}', 'at': 0.3},
         {'tex': '\\Longrightarrow\\; \\lambda_1 = \\lambda_2, \\;\\; \\mu_1 = \\mu_2', 'tone': 'accent', 'at': 1.2},
       ]},
    ],
    'beats': [
      {'at': 0.2, 'text': 'Schematic: push on the boundary of an elastic body and measure what pushes back'},
      {'at': 2.8, 'text': 'Do these boundary data fix the two Lamé moduli inside?'},
      {'at': 5.2, 'text': 'Claim: yes, for any smooth moduli, with no analyticity or closeness assumption'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'Elastic Calderón problem in three dimensions',
    'statement': ['\\Lambda_{\\lambda_1,\\mu_1} = \\Lambda_{\\lambda_2,\\mu_2} \\;\\Longrightarrow\\; (\\lambda_1,\\mu_1) = (\\lambda_2,\\mu_2)'],
    'context': 'Before: a 1994 global proof was cut back to near-constant moduli in a 2003 erratum',
    'stamp': 'proved',
    'note': 'Uniqueness only: no reconstruction or stability'},
  'verify': {'lean': 'main',
             'detail': 'Lean: global uniqueness for smooth moduli, about 31.6k lines',
             'ourCheck': 'We did not build the Lean or run the comparator'},
  'sources': [
    {'ref': 'article, Calderón\'s problem for isotropic elasticity', 'quote': 'Nakamura and Uhlmann claimed global uniqueness in 1994 and had to restrict it to near-constant moduli in a 2003 erratum.'},
    {'ref': 'article, Calderón\'s problem for isotropic elasticity', 'quote': 'with no analyticity or closeness assumption'},
    {'ref': 'article, Calderón\'s problem for isotropic elasticity', 'quote': 'gives uniqueness only, with no reconstruction or stability.'},
    {'ref': 'review 372, lean', 'quote': '42 files, ~31.6k lines, no sorry/axiom'},
    {'ref': 'review 372, lean', 'quote': 'Not run by me.'},
  ]})

# ---------------------------------------------------------------- 373
def box(cx, cy, h):
    return [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]]
write({
  'id': '373', 'discipline': PDE, 'kind': 'counterexample',
  'short': 'Three-electron Coulomb Monge problem',
  'title': {'title': 'No Monge minimizer for three electrons',
            'subtitle': 'Claim: a smooth density in $\\mathbb{R}^3$ whose optimal three-particle Coulomb plan is never a map'},
  'object': {
    'dur': 8.4,
    'heading': 'Schematic: the engineered density, five pieces',
    'primitive': 'shape', 'scale': 0.95,
    'shapes': [
      {'kind': 'polygon', 'points': box(0, 0, 0.22), 'tone': 'accent', 'at': 0.3, 'dur': 0.8, 'label': '$1/3$', 'fillA': 0.3},
      {'kind': 'polygon', 'points': box(1.15, 0, 0.17), 'tone': 'soft', 'at': 1.0, 'dur': 0.6, 'label': '$1/6$', 'labelAt': [1.15, 0]},
      {'kind': 'polygon', 'points': box(-1.15, 0, 0.17), 'tone': 'soft', 'at': 1.2, 'dur': 0.6, 'label': '$1/6$', 'labelAt': [-1.15, 0]},
      {'kind': 'polygon', 'points': box(0, 0.85, 0.17), 'tone': 'soft', 'at': 1.4, 'dur': 0.6, 'label': '$1/6$', 'labelAt': [0, 0.85]},
      {'kind': 'polygon', 'points': box(0, -0.85, 0.17), 'tone': 'soft', 'at': 1.6, 'dur': 0.6, 'label': '$1/6$', 'labelAt': [0, -0.85]},
    ],
    'beats': [
      {'at': 0.2, 'text': 'A central piece of mass $1/3$ and four outer pieces of mass $1/6$'},
      {'at': 2.9, 'text': 'Every optimal plan splits the central mass between two equally good families of triples'},
      {'at': 5.7, 'text': 'A map would push $1/3$ into a piece that holds $1/6$, so no map is optimal'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'The Monge (co-motion) ansatz for three electrons, Coulomb cost',
    'statement': ['c(x_1,x_2,x_3) = \\textstyle\\sum_{i<j} 1/|x_i - x_j|', '\\inf_{\\text{Monge}} = \\min_{\\text{Kantorovich}}, \\text{ not attained by any map}'],
    'context': 'Before: optimal maps were known for two particles (Cotar–Friesecke–Klüppelberg) and in one dimension',
    'stamp': 'counterexample',
    'note': 'The density is engineered, not physical, and the paper says so'},
  'verify': {'lean': 'main',
             'detail': 'Lean: the three-dimensional Coulomb case with equal infima, not the Riesz-cost extensions',
             'ourCheck': 'We did not build the Lean or run the comparator'},
  'sources': [
    {'ref': 'article, The three-marginal Coulomb Monge problem has no Monge minimizer', 'quote': 'any deterministic map from the central piece would push mass one third into a region that only holds one sixth'},
    {'ref': 'article, The three-marginal Coulomb Monge problem has no Monge minimizer', 'quote': 'Every optimal plan must split the central mass between two equally good families'},
    {'ref': 'article, The three-marginal Coulomb Monge problem has no Monge minimizer', 'quote': 'The density is engineered, not physical, and the paper says so.'},
    {'ref': 'review 373, caveats', 'quote': 'five disjoint components, central mass ν/3, four outer components ν/6'},
    {'ref': 'review 373, known_before', 'quote': 'N=2: Cotar–Friesecke–Klüppelberg (optimal maps exist). 1D any N: Colombo–De Pascale–Di Marino (cyclic optimal maps).'},
    {'ref': 'review 373, lean', 'quote': 'Only the 3D Coulomb case; the d≥2 Riesz extensions are excluded. Not run by me.'},
  ]})

# ---------------------------------------------------------------- 374
write({
  'id': '374', 'discipline': PDE, 'kind': 'improved-bound',
  'short': 'Brenier maps are $1/3$-stable, no better',
  'title': {'title': 'Sharp one-third stability of Brenier maps',
            'subtitle': 'Claim: optimal transport maps move at most like $W_2^{1/3}$, uniformly, and $1/3$ cannot be improved'},
  'object': {
    'dur': 8.8, 'layout': 'sequence',
    'panels': [
      {'primitive': 'plot', 'until': 4.4, 'x': [-1, 1], 'y': [0, 1.1], 'xticks': [-1, 0, 1], 'yticks': [],
       'xlabel': 'source point $x$', 'ylabel': 'convex potential', 'labelRoom': 190,
       'curves': [
         {'f': 'max(-x, 0.4, x)', 'label': 'max of 3 pieces', 'tone': 'accent', 'at': 0.3, 'dur': 1.4},
         {'f': 'max(-x, 0.4+0.15*x, x)', 'label': 'middle tilted', 'tone': 'hot', 'dash': True, 'at': 2.0, 'dur': 1.2, 'labelDy': -26},
       ]},
      {'primitive': 'numberline', 'from': 4.4, 'min': 0, 'max': 0.62, 'y': 0.6,
       'ticks': [0, {'v': 0.3333333, 'label': '$1/3$'}, {'v': 0.5, 'label': '$1/2$'}],
       'axisLabel': 'the exponent $\\beta$ in $\\|T_\\mu - T_\\nu\\| \\le C\\,W_2^{\\beta}$',
       'markers': [{'v': 0.5, 'label': 'conjectured', 'note': 'Letrouit', 'style': 'ring', 'tone': 'mute', 'at': 0.5, 'derived': '1/2'}],
       'slide': {'from': 0.5, 'to': 0.3333333, 'at': 1.5, 'dur': 1.5, 'label': 'sharp: $1/3$', 'note': 'uniform over targets', 'derived': '1/2 to 1/3'}},
    ],
    'beats': [
      {'at': 0.2, 'text': 'A Brenier map is the gradient of a convex potential; three pieces send mass to three atoms'},
      {'at': 2.3, 'text': 'Tilting the middle piece swaps a thin slab of source points between far-apart targets'},
      {'at': 5.4, 'text': 'That forces exponent $1/3$, not the conjectured $1/2$, and $1/3$ is achieved'},
    ]},
  'achievement': {
    'form': 'bound',
    'before': {'label': 'Best known (Divol et al.)', 'tex': 'C_{\\mu,\\nu}\\, W_2^{1/3}', 'note': 'constant depends on the atoms; Letrouit conjectured $1/2$'},
    'after': {'label': 'Claimed, 25 Sep 2026', 'tex': 'C(K,Y)\\, W_2^{1/3}', 'note': 'uniform over all targets, and $1/3$ is sharp'},
    'stamp': 'improved',
    'note': 'For a uniform source on a convex body; the $W_1$ picture differs'},
  'verify': {'lean': 'main',
             'detail': 'Lean: both the uniform bound and the three-atom sharpness example',
             'ourCheck': 'We did not build the Lean or run the comparator'},
  'sources': [
    {'ref': 'review 374, known_before', 'quote': 'Divol–Niles-Weed–Pooladian (W2^{1/3} with atom-dependent constants)'},
    {'ref': 'review 374, known_before', 'quote': 'Letrouit proved >1/3 fails for nonconvex sources and conjectured uniform square-root stability for uniform convex sources'},
    {'ref': 'review 374, claim', 'quote': 'the exponent 1/3 is sharp even for K=Y=[−1,1]^d and three-atom targets, disproving Letrouit\'s conjectured uniform 1/2 exponent'},
    {'ref': 'review 374, explainer', 'quote': 'tilting the middle piece of a max of three affine functions keeps its mass but swaps a thin slab of source points between far-apart targets'},
    {'ref': 'review 374, caveats', 'quote': 'W1 vs W2 distinction matters (a sharp W1^{1/4} estimate is consistent)'},
    {'ref': 'review 374, lean', 'quote': 'both the upper bound and the three-atom sharpness. Not run by me.'},
    {'ref': 'catalogue, family 374 manuscript path', 'quote': 'Sharp-One-Third-Stability-of-Brenier-Maps-September-25-2026/article.pdf'},
  ]})

# ---------------------------------------------------------------- 375
write({
  'id': '375', 'discipline': PDE, 'kind': 'proof',
  'short': 'De Giorgi\'s conjecture in dimension 8',
  'title': {'title': 'De Giorgi\'s conjecture in dimension eight',
            'subtitle': 'Claim: every monotone solution of $\\Delta u = u^3 - u$ on $\\mathbb{R}^8$ is a flat $\\tanh$ wall, with no extra assumption'},
  'object': {
    'dur': 8.8, 'layout': 'sequence',
    'panels': [
      {'primitive': 'plot', 'until': 3.6, 'x': [-4, 4], 'y': [-1.2, 1.2], 'xticks': [], 'yticks': [-1, 0, 1],
       'xlabel': '$e \\cdot x$', 'ylabel': '$u$', 'labelRoom': 230,
       'asymptotes': [{'y': 1, 'at': 0.4}, {'y': -1, 'at': 0.4}],
       'curves': [{'f': 'tanh(x/sqrt(2))', 'label': '$\\tanh\\big(\\tfrac{e\\cdot x - c}{\\sqrt 2}\\big)$', 'at': 0.5, 'dur': 1.8}]},
      {'primitive': 'numberline', 'from': 3.6, 'min': 1.5, 'max': 9.6, 'y': 0.56,
       'ticks': [2, 3, 4, 5, 6, 7, 8, 9], 'axisLabel': 'the dimension $n$',
       'markers': [
         {'v': 2, 'label': '1998', 'at': 0.4, 'tone': 'ok'},
         {'v': 3, 'label': '2000', 'at': 0.6, 'tone': 'ok'},
         {'v': 4, 'label': 'Sep 2026', 'note': 'human groups', 'at': 0.8, 'tone': 'ok'},
         {'v': 9, 'label': 'fails', 'note': 'del Pino et al., 2011', 'tone': 'bad', 'at': 1.1},
       ],
       'ranges': [{'from': 2, 'to': 8, 'label': 'Savin 2009', 'note': 'if $u \\to \\pm 1$ assumed', 'at': 1.4, 'side': 'below'}],
       'slide': {'from': 4, 'to': 8, 'at': 2.6, 'dur': 1.6, 'label': 'claimed: up to 8', 'note': 'no extra assumption'}},
    ],
    'beats': [
      {'at': 0.2, 'text': 'The conjecture: a solution increasing in one direction is this one-dimensional wall'},
      {'at': 3.7, 'text': 'Without Savin\'s extra assumption, humans had reached dimension 4'},
      {'at': 6.4, 'text': 'The claim jumps to 8, where the conjecture ends'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'De Giorgi\'s conjecture (1978), dimension 8',
    'statement': ['\\Delta u = u^3 - u, \\;\\; \\partial_8 u > 0 \\text{ on } \\mathbb{R}^8', '\\Longrightarrow\\; u = \\tanh\\big(\\tfrac{e\\cdot x - c}{\\sqrt 2}\\big)'],
    'context': 'Key step: every stable solution in $\\mathbb{R}^7$ is flat, with no energy-growth assumption',
    'stamp': 'proved',
    'note': '97 pages, no Lean: the result our review trusts least'},
  'verify': {'lean': 'none',
             'detail': 'No Lean. Flatness of stable solutions in $\\mathbb{R}^7$ rests on the paper alone',
             'ourCheck': 'We would not cite it as settled before an expert reads it'},
  'sources': [
    {'ref': 'article, De Giorgi\'s conjecture in dimension eight', 'quote': 'De Giorgi conjectured in 1978 that a solution of the Allen–Cahn equation $\\Delta u = u^3 - u$ that is monotone in one direction must be one-dimensional'},
    {'ref': 'article, De Giorgi\'s conjecture in dimension eight', 'quote': 'Ghoussoub and Gui proved dimension 2 (1998), Ambrosio and Cabré dimension 3 (2000), and Savin dimensions up to 8 (Annals 2009), but only under an extra assumption that $u \\to \\pm 1$ as the monotone coordinate goes to $\\pm\\infty$. Del Pino, Kowalczyk and Wei showed it fails from dimension 9 on (Annals 2011).'},
    {'ref': 'article, De Giorgi\'s conjecture in dimension eight', 'quote': 'The human frontier moved in September 2026.'},
    {'ref': 'article, De Giorgi\'s conjecture in dimension eight', 'quote': 'The key step is that every stable solution in $\\mathbb R^7$ is flat, again with no energy-growth assumption.'},
    {'ref': 'article, De Giorgi\'s conjecture in dimension eight', 'quote': 'This is 97 pages with no Lean formalization.'},
    {'ref': 'article, De Giorgi\'s conjecture in dimension eight', 'quote': 'De Giorgi\'s conjecture in dimension eight, and the result I trust least'},
    {'ref': 'article, De Giorgi\'s conjecture in dimension eight', 'quote': 'Until an expert has read the curvature-moment section, I would not cite it as settled.'},
    {'ref': 'review 375, claim', 'quote': 'is u=tanh((e·x−c)/√2) (one-dimensional)'},
  ]})

# ---------------------------------------------------------------- 376
write({
  'id': '376', 'discipline': PDE, 'kind': 'proof',
  'short': 'Turing machines in forced Navier–Stokes',
  'title': {'title': 'Turing machines in forced Navier–Stokes flows',
            'subtitle': 'Claim: for any machine, a smooth force makes a tagged fluid particle reach a region exactly when it halts'},
  'object': {
    'dur': 8.6, 'layout': 'sequence',
    'panels': [
      {'primitive': 'graph', 'until': 4.6, 'r': 11, 'edgeAt': 0.5, 'edgeDur': 2.6,
       'nodes': [
         {'id': 'm', 'x': 0.08, 'y': 0.4, 'label': 'machine $M$, input $w$', 'lx': 0, 'ly': 48, 'lax': 0.5, 'tone': 'soft'},
         {'id': 'f', 'x': 0.36, 'y': 0.4, 'label': 'smooth force $f$', 'lx': 0, 'ly': 48, 'lax': 0.5, 'tone': 'accent'},
         {'id': 'u', 'x': 0.64, 'y': 0.4, 'label': 'flow from rest on $\\mathbb{T}^3$', 'lx': 0, 'ly': 48, 'lax': 0.5, 'tone': 'accent'},
         {'id': 'p', 'x': 0.92, 'y': 0.4, 'label': 'particle enters $U$', 'lx': 0, 'ly': 48, 'lax': 0.5, 'tone': 'hot', 'fill': 'hot'},
       ],
       'edges': [['m', 'f', {'tone': 'accent'}], ['f', 'u', {'tone': 'accent'}], ['u', 'p', {'tone': 'accent'}]]},
      {'primitive': 'equation', 'from': 4.6, 'lines': [
         {'tex': 'f := \\partial_t u + (u\\cdot\\nabla)u - \\nu\\Delta u', 'at': 0.3},
         {'tex': '\\text{choose } u, \\text{ read off } f', 'tone': 'accent', 'at': 1.3, 'size': 34},
       ]},
    ],
    'beats': [
      {'at': 0.2, 'text': 'A compiler turns a Turing machine and its input into a force on the fluid'},
      {'at': 2.8, 'text': 'A tagged particle enters $U$ exactly when the machine halts'},
      {'at': 4.8, 'text': 'The catch: any smooth divergence-free velocity solves Navier–Stokes with this force'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'Universal computation in forced Navier-Stokes flows',
    'statement': ['\\text{particle enters } U \\iff M \\text{ halts on } w'],
    'context': 'Motivated by Tao\'s fluid-computer programme (JAMS 2016); nothing about unforced fluids or blowup',
    'stamp': 'proved',
    'note': 'Nine papers, 258 pages; the force does the work'},
  'verify': {'lean': 'part',
             'detail': 'Lean: six comparator challenges, incl. a compactly supported flow in $\\mathbb{R}^3$. Not every paper',
             'ourCheck': 'We did not build the Lean'},
  'sources': [
    {'ref': 'review 376, known_before', 'quote': "Tao, 'Finite time blowup for an averaged three-dimensional Navier–Stokes equation', JAMS 2016"},
    {'ref': 'article, Turing machines in forced Navier–Stokes flows', 'quote': 'Nine papers, 258 pages.'},
    {'ref': 'article, Turing machines in forced Navier–Stokes flows', 'quote': 'Any smooth divergence-free velocity becomes an exact Navier–Stokes solution once you define the force as its material acceleration minus the viscous term.'},
    {'ref': 'article, Turing machines in forced Navier–Stokes flows', 'quote': 'not anything about unforced fluids or Tao\'s blowup programme'},
    {'ref': 'article, Turing machines in forced Navier–Stokes flows', 'quote': 'Parts are in Lean, including a compactly supported version in $\\mathbb R^3$.'},
    {'ref': 'review 376, lean', 'quote': 'lean/docs/376.md lists six comparator challenges'},
    {'ref': 'review 376, lean', 'quote': 'other papers (Finite Instructions, Fixed Particle Test, Eventually Stationary, Prefix Instructions, Scalar Potentials) have no listed comparator'},
  ]})

# ---------------------------------------------------------------- 377
write({
  'id': '377', 'discipline': PDE, 'kind': 'proof',
  'short': 'Infinity-harmonic functions are $C^{1,\\alpha}$',
  'title': {'title': 'Infinity-harmonic functions are $C^{1,\\alpha}$ in every dimension',
            'subtitle': 'Claim: for every $d \\ge 3$, bounded infinity-harmonic functions have Hölder continuous gradients inside the ball'},
  'object': {
    'dur': 8.4,
    'heading': 'A slice of Aronsson\'s example $|x_1|^{4/3} - |x_2|^{4/3}$',
    'primitive': 'plot', 'x': [-1, 1], 'y': [-1.5, 1.5], 'xticks': [-1, 0, 1], 'yticks': [-1, 0, 1],
    'xlabel': '$x_1$', 'labelRoom': 230,
    'asymptotes': [{'y': 0, 'at': 0.4}],
    'curves': [
      {'f': 'pow(abs(x), 4/3)', 'label': '$u = |x_1|^{4/3}$', 'tone': 'accent', 'at': 0.5, 'dur': 1.6, 'labelDy': 14},
      {'f': '(4/3)*sign(x)*pow(abs(x), 1/3)', 'label': '$u\' \\propto |x_1|^{1/3}$', 'tone': 'hot', 'at': 2.4, 'dur': 1.6, 'labelDy': -16},
    ],
    'beats': [
      {'at': 0.2, 'text': 'Aronsson\'s infinity-harmonic example, sliced along the $x_1$-axis'},
      {'at': 2.8, 'text': 'Its gradient is only $|x_1|^{1/3}$ near 0, which caps the Hölder exponent at $1/3$'},
      {'at': 5.6, 'text': 'Claim: in every $d \\ge 3$ the gradient is Hölder with some $\\alpha_d > 0$'},
    ]},
  'achievement': {
    'form': 'status', 'label': 'Gradient regularity of infinity-harmonic functions, d at least 3',
    'statement': ['\\|\\nabla u\\|_{L^\\infty(B_{1/2})} + [\\nabla u]_{C^{0,\\alpha_d}(B_{1/2})} \\le C_d \\operatorname{osc}_{B_1} u'],
    'context': 'Before: $C^{1,\\alpha}$ in the plane (Evans–Savin 2008); in $d \\ge 3$ only differentiability (Evans–Smart 2011)',
    'stamp': 'proved',
    'note': '$\\alpha_d$ is not explicit; the optimal $1/3$ is not claimed'},
  'verify': {'lean': 'none',
             'detail': 'No Lean. The newest paper in the group (4 Oct 2026), so likely the least vetted',
             'ourCheck': 'We reviewed the paper; we did not check its Liouville theorem'},
  'sources': [
    {'ref': 'review 377, known_before', 'quote': 'Evans–Savin (Calc. Var. 2008): C^{1,α} in the plane; Evans–Smart (2011): everywhere differentiability in all dimensions.'},
    {'ref': 'review 377, known_before', 'quote': 'the example |x1|^{4/3}−|x2|^{4/3} (so α≤1/3)'},
    {'ref': 'article, Infinity-harmonic functions are C^{1,α}', 'quote': 'Aronsson\'s example caps the exponent at $1/3$.'},
    {'ref': 'review 377, caveats', 'quote': 'dated 4 Oct 2026, the most recent in the chunk, so likely the least vetted'},
    {'ref': 'review 377, claim', 'quote': 'α_d is non-explicit (compactness argument); no boundary or endpoint (α=1/3) claim.'},
  ]})
print('ok')
