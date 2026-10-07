import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
#!/usr/bin/env python3
# Generates math-reel specs for the physics / operator-algebras group (families 260-303).
import json, math, os, re, sys

OUT = _OUT
os.makedirs(OUT, exist_ok=True)
MP, OA = 'Mathematical physics', 'Operator algebras'
OC_LEAN = 'We compared the Lean scope with the claim; we did not build it'
OC_NONE = "We read the papers' claims and caveats; we did not referee them"

def R(i, field, q): return {'ref': f'review {i}, {field}', 'quote': q}
def A(sec, q): return {'ref': f'article, {sec}', 'quote': q}
def C(i, q): return {'ref': f'catalogue, family {i} manuscript path', 'quote': q}
def B(at, text): return {'at': at, 'text': text}

SPECS = []
def spec(id, disc, kind, short, title, subtitle, obj, ach, verify, sources):
    s = {'$schema': '../../brand-crew/skills/math-reels/schema.json', 'id': id, 'discipline': disc, 'kind': kind,
         'short': short, 'title': {'title': title, 'subtitle': subtitle}, 'object': obj, 'achievement': ach,
         'verify': verify, 'sources': sources}
    SPECS.append(s)

def status(label, statement, context, stamp, note=None):
    a = {'form': 'status', 'label': label, 'statement': statement, 'context': context, 'stamp': stamp}
    if note: a['note'] = note
    return a

def V(lean, detail, oc=None):
    return {'lean': lean, 'detail': detail, 'ourCheck': oc or (OC_NONE if lean == 'none' else OC_LEAN)}

# ---------------------------------------------------------------- 260
spec('260', MP, 'proof', 'Spacetime Penrose inequality',
     'The spacetime Penrose inequality, in every dimension',
     'Claim: mass is at least that of a Schwarzschild black hole with the same minimum enclosing area, for all $n \\ge 3$',
     {'dur': 8.4,
      'heading': '$m \\ge \\tfrac{1}{2}\\,(A_{\\min}/\\omega_{n-1})^{(n-2)/(n-1)}$, drawn for $n = 3$ in schematic units',
      'primitive': 'plot', 'x': [0, 4], 'y': [0, 1.4], 'labelRoom': 230,
      'xlabel': 'minimum enclosing area $A_{\\min}$', 'ylabel': 'ADM mass $m$',
      'curves': [{'f': '0.5*sqrt(x)', 'label': 'Schwarzschild', 'tone': 'accent', 'at': 0.6, 'dur': 1.8}],
      'regions': [{'f': '1.4', 'f2': '0.5*sqrt(x)', 'at': 3.2, 'tone': 'accent'}],
      'points': [{'x': 1, 'y': 0.5, 'label': 'equality: a Schwarzschild slice', 'at': 2.4},
                 {'x': 2.6, 'y': 1.15, 'label': 'allowed', 'at': 3.6, 'tone': 'soft'}],
      'beats': [B(0.2, 'Initial data with a trapped boundary: its mass against its minimum enclosing area'),
                B(3.2, 'Schwarzschild sits exactly on the curve; the claim is that nothing falls below it'),
                B(5.9, "The area is the least area of any enclosing cut, not the horizon's own area")]},
     status("Penrose's inequality (1973), enclosing-area form",
            ['m \\ge \\tfrac{1}{2} \\Big(\\frac{A_{\\min}}{\\omega_{n-1}}\\Big)^{\\frac{n-2}{n-1}}'],
            'Before: only the time-symmetric case, $n = 3$ (2001) and $3 \\le n \\le 7$ (Bray–Lee 2009)', 'proved',
            'Under dominant energy and decay hypotheses; 13 manuscripts, about 1,355 pages'),
     V('part', 'Lean covers a supporting end-replacement construction and Schwarzschild examples, not the inequality'),
     [R('260', 'known_before', 'Penrose proposed the inequality in 1973'),
      R('260', 'known_before', 'J. Diff. Geom. 59, 2001'),
      R('260', 'known_before', 'for 3<=n<=7 by Bray-Lee (Duke Math. J. 148, 2009, arXiv:0705.1128)'),
      R('260', 'caveats', '13 manuscripts, ~1,355 pages'),
      R('260', 'lean', 'only the Cha-Khuri-Sakovich end-replacement construction and Schwarzschild equality examples'),
      A('The spacetime Penrose inequality', "must be stated with a minimal enclosing area rather than the horizon's own area")])

# ---------------------------------------------------------------- 261
ext = [[0, 1], [0, 4], [0, 6], [1, 2], [1, 5], [2, 0], [2, 3], [2, 6], [3, 1], [3, 4], [4, 2], [4, 5], [4, 0], [5, 3], [5, 6], [6, 1], [6, 4], [1, 0], [3, 6], [6, 6]]
loc = [[3, 3, 'hot'], [2, 3], [3, 2], [4, 3], [3, 4]]
spec('261', MP, 'proof', 'Anderson model: $d \\ge 3$ and $d = 2$',
     'Delocalization in three dimensions, localization in two',
     'Claim: weak disorder leaves a.c. spectrum on $\\mathbb Z^d$, $d \\ge 3$; on $\\mathbb Z^2$ any disorder gives pure point spectrum',
     {'dur': 8.4, 'layout': 'split',
      'panels': [{'primitive': 'grid', 'rows': 7, 'cols': 7, 'cells': ext, 'caption': '$d \\ge 3$, weak disorder: spread out'},
                 {'primitive': 'grid', 'rows': 7, 'cols': 7, 'cells': loc, 'caption': '$d = 2$, any disorder: trapped'}],
      'beats': [B(0.2, "Schematic: where an electron's wave sits in a random lattice"),
                B(3.0, 'Claim: in $d \\ge 3$ at weak disorder, some states stay extended (a.c. spectrum)'),
                B(5.8, 'and in two dimensions any disorder traps every state (pure point spectrum)')]},
     status('Anderson (1958); Simon\'s extended-states problem (2000)',
            ['d \\ge 3,\\ \\text{weak disorder: purely a.c. on an interval}',
             'd = 2,\\ \\text{any } h > 0\\text{: pure point spectrum}'],
            'Before: a.c. spectrum known only on trees; 2D localization only near band edges', 'proved',
            'Uniform single-site law only; 171 pages, nothing formal on the headline'),
     V('part', 'Lean: only that the almost-sure spectrum on $\\mathbb Z^2$ is $[-4-h, 4+h]$, a textbook fact'),
     [R('261', 'known_before', 'Anderson 1958 predicted localization'),
      R('261', 'known_before', "'Schrodinger operators in the twenty-first century' (2000)"),
      R('261', 'caveats', '171 pages of multiscale/probabilistic arguments'),
      R('261', 'lean', 'identifying the almost-sure spectrum on Z^2 as [-4-h,4+h]')])

# ---------------------------------------------------------------- 262
spec('262', MP, 'proof', 'Sharp 1D Lieb–Thirring constants',
     'Sharp one-dimensional Lieb–Thirring constants',
     'Claim: for $\\tfrac{1}{2} < \\gamma < \\tfrac{3}{2}$ the sharp constant is the one-bound-state constant, for matrix potentials too',
     {'dur': 8.4, 'primitive': 'plot', 'x': [-4, 4], 'y': [-2.2, 0.5], 'labelRoom': 200,
      'xlabel': '$x$', 'ylabel': 'potential and energy',
      'yticks': [{'v': -1, 'label': '$-1$'}, {'v': 0, 'label': '0'}],
      'curves': [{'f': '-2/pow(cosh(x),2)', 'label': '$-2\\,\\mathrm{sech}^2 x$', 'tone': 'accent', 'at': 0.5, 'dur': 1.8},
                 {'f': '-1', 'from': -1.3, 'to': 1.3, 'label': 'its one bound state', 'tone': 'warn', 'dash': True, 'at': 2.6, 'dur': 0.8}],
      'beats': [B(0.2, 'A one-bound-state well: $-2\\,\\mathrm{sech}^2 x$ traps exactly one level, at $E = -1$'),
                B(3.2, 'Lieb–Thirring bounds $\\sum_j |E_j|^{\\gamma}$ by a constant times $\\int W^{\\gamma+1/2}$'),
                B(6.0, 'Claim: for $\\tfrac{1}{2} < \\gamma < \\tfrac{3}{2}$ wells with one bound state are the worst case')]},
     status('Lieb–Thirring conjecture (1976)',
            ['L_{\\gamma,1} = L^{\\mathrm{one}}_{\\gamma,1}, \\quad \\tfrac{1}{2} < \\gamma < \\tfrac{3}{2}'],
            'Known: $\\gamma \\ge 3/2$ (1976, 1978), $\\gamma = 1/2$ (1998), $\\gamma = 1$ (Read–Schulz, Sept 2026)', 'proved',
            'Also for Hermitian matrix potentials, with every equality case classified'),
     V('main', 'Scalar theorem in Lean; the matrix version and the equality classification are not'),
     [R('262', 'known_before', 'Lieb-Thirring conjecture (1976)'),
      R('262', 'known_before', 'gamma>=3/2 (Aizenman-Lieb 1978), gamma=1/2 (Hundertmark-Lieb-Thomas 1998)'),
      R('262', 'known_before', 'Read-Schulz (arXiv:2609.10478, September 2026)'),
      R('262', 'lean', 'Matrix version and equality classification not formalized.')])

# ---------------------------------------------------------------- 263
spec('263', MP, 'proof', 'The ionization conjecture',
     'The ionization conjecture',
     'Claim: $M$ nuclei of total charge $Z$ bind at most $Z + CM$ electrons, with one universal constant $C$',
     {'dur': 8.6, 'primitive': 'plot', 'x': [0, 400], 'y': [0, 150], 'labelRoom': 210,
      'xlabel': 'nuclear charge $Z$', 'ylabel': 'excess electrons $N - Z$ (one atom)',
      'curves': [{'f': 'x', 'to': 120, 'label': 'Lieb 1984', 'tone': 'soft', 'at': 0.5, 'dur': 1.0},
                 {'f': '0.22*x+3*cbrt(x)', 'label': 'Nam 2012', 'tone': 'soft', 'at': 1.3, 'dur': 1.2},
                 {'f': 'pow(x,5/7)', 'label': 'Fefferman–Seco 1990', 'tone': 'mute', 'at': 2.2, 'dur': 1.2},
                 {'f': '8', 'label': 'claimed: $C$', 'tone': 'accent', 'at': 5.6, 'dur': 1.2}],
      'beats': [B(0.2, 'How many electrons beyond $Z$ can one nucleus bind? Upper bounds so far'),
                B(3.0, 'Lieb $2Z + 1$, Nam $1.22Z + 3Z^{1/3}$, Fefferman–Seco $Z + O(Z^{5/7})$; constants schematic'),
                B(5.6, 'Claim: the excess is a universal constant per nucleus, $N \\le Z + CM$')]},
     status('The ionization conjecture (on Simon\'s list, 2000)',
            ['N \\le Z + C\\,M \\quad (C \\text{ universal})'],
            'Before: $N < 1.22Z + 3Z^{1/3}$ (Nam 2012); proved only within Hartree–Fock (Solovej 2003)', 'proved',
            '$C$ is not explicit; strict binding only'),
     V('part', 'Lean: the $m^{7/3}$ ionization-energy and outer-radius asymptotics. Not $N \\le Z + CM$'),
     [R('263', 'known_before', 'Lieb N<2Z+M (Phys. Rev. A 1984); Nam N<1.22Z+3Z^{1/3} (Commun. Math. Phys. 312, 2012)'),
      R('263', 'known_before', 'N<=Z+O(Z^{5/7}) by Fefferman-Seco (1990)'),
      R('263', 'known_before', 'Hartree-Fock theory (Ann. Math. 158, 2003)'),
      R('263', 'known_before', "listed by Simon in 'Schrodinger operators in the twenty-first century' (2000)"),
      A('The ionization conjecture', 'The best theorems said roughly $2Z$ (Lieb 1984) and then $1.22Z + 3Z^{1/3}$'),
      R('263', 'lean', 'I_m(Z)/m^{7/3}->a_TF')])

# ---------------------------------------------------------------- 264
spec('264', MP, 'partial', 'Strong cosmic censorship near Kerr',
     'Strong cosmic censorship near two-ended Kerr data',
     'Claim: near each fixed rotating Kerr, data with a square-integrable-connection extension are non-generic',
     {'dur': 8.4, 'primitive': 'numberline', 'min': -0.5, 'max': 3.5, 'y': 0.58,
      'ticks': [{'v': 0, 'label': '$C^0$'}, {'v': 1, 'label': '$C^0 \\cap W^{1,2}_{\\rm loc}$'}, {'v': 2, 'label': '$C^1$'}, {'v': 3, 'label': '$C^2$'}],
      'axisLabel': 'regularity asked of a future extension, weaker to stronger',
      'markers': [{'v': 0, 'label': 'extensions exist', 'note': 'Dafermos–Luk, near Kerr', 'tone': 'bad', 'at': 0.8}],
      'ranges': [{'from': 1, 'to': 3, 'label': 'claimed: non-generic', 'note': 'near Kerr, no symmetry', 'tone': 'claim', 'at': 3.4}],
      'beats': [B(0.2, 'Can a black-hole interior be continued past its Cauchy horizon? It depends on regularity'),
                B(3.0, 'Near Kerr, continuous extensions exist: the $C^0$ form of censorship is false'),
                B(5.7, 'Claim: extensions with square-integrable connection form a meagre set')]},
     status('Strong cosmic censorship, Christodoulou\'s formulation',
            ['\\{\\text{data near Kerr with a } C^0 \\cap W^{1,2}_{\\rm loc} \\text{ extension}\\}',
             '\\text{is meagre (likewise for } C^1, C^2)'],
            'Before: no near-Kerr genericity result without symmetry; Luk–Oh had spherical symmetry', 'partial',
            'Local only: a small neighbourhood of each fixed Kerr with $0 < |a| < M$'),
     V('none', 'No formalization; about 278 pages across three mutually dependent papers'),
     [R('264', 'caveats', '~278 pages across three mutually dependent papers'),
      R('264', 'known_before', 'Dafermos-Luk proved C^0 stability of the Kerr Cauchy horizon (arXiv:1710.01722), so the C^0 formulation is false near Kerr')])

# ---------------------------------------------------------------- 265
reg = [[r, c] for r in range(2, 6) for c in range(4, 9)]
spec('265', MP, 'proof', 'Area law for 2D gapped systems',
     'An area law for two-dimensional gapped systems',
     'Claim: a uniform global gap bounds each region\'s entanglement entropy by a constant times its boundary',
     {'dur': 8.2, 'primitive': 'grid', 'rows': 8, 'cols': 14, 'cells': reg,
      'blocks': [{'r': 2, 'c': 4, 'h': 4, 'w': 5, 'label': 'region $A$', 'at': 1.6}],
      'caption': '$S(A) \\le C\\,|\\partial A|$: entropy bounded by boundary edges, not cells',
      'beats': [B(0.2, 'A gapped Hamiltonian on a patch of $\\mathbb Z^2$, and a region $A$ of its ground state'),
                B(3.0, 'Volume law: entropy grows with the cells of $A$. Area law: with its boundary edges'),
                B(5.6, 'Claim: a global spectral gap alone forces the area law, for any region shape')]},
     status('Area-law conjecture for 2D gapped ground states',
            ['S(\\rho_A) \\le C\\,|\\partial A|'],
            'Before: 1D (Hastings 2007); in 2D only frustration-free systems with local gaps (STOC 2022)', 'proved',
            'PEPS companion: bond dimension poly($L$), error $\\le 1/L$, existence only'),
     V('none', 'No formalization; 146 pages'),
     [R('265', 'known_before', 'Proven in 1D by Hastings (J. Stat. Mech. 2007, P08024)'),
      R('265', 'known_before', '(STOC 2022, arXiv:2103.02492)'),
      A('An area law for two-dimensional gapped systems', 'No Lean; 146 pages.')])

# ---------------------------------------------------------------- 266
nodes, edges = [], []
for side, cx in (('a', 0.25), ('b', 0.75)):
    for k in range(6):
        ang = -math.pi / 2 + 2 * math.pi * k / 6
        nodes.append({'id': f'{side}{k}', 'x': round(cx + 0.13 * math.cos(ang), 4), 'y': round(0.5 + 0.34 * math.sin(ang), 4), 'tone': 'ink'})
for side in 'ab':
    for i in range(6):
        for j in range(i + 1, 6):
            edges.append([f'{side}{i}', f'{side}{j}', {'tone': 'accent', 'w': 2}])
for i in range(6):
    for j in range(6):
        edges.append([f'a{i}', f'b{j}', {'tone': 'warn', 'w': 1.2, 'a': 0.4}])
spec('266', MP, 'proof', 'Mutually unbiased bases in dimension six',
     'Exactly three mutually unbiased bases in dimension six',
     "Claim: $\\mathbb C^6$ has at most three mutually unbiased bases, settling Zauner's $N(6) = 3$",
     {'dur': 8.4, 'heading': 'Two candidate bases: orthogonal within (blue), unbiased across (orange)',
      'primitive': 'graph', 'nodes': nodes, 'edges': edges, 'r': 11, 'edgeAt': 0.5, 'edgeDur': 4.6,
      'beats': [B(0.2, 'Two more unbiased bases would need two 6-cliques with all 36 cross pairs unbiased'),
                B(5.4, 'An exhaustive search over phase balls finds that this pattern never survives')]},
     status("Zauner's conjecture (1991)", ['N(6) = 3'],
            'Before: $3 \\le N(6) \\le 7$; even a complete set of 7 had not been ruled out', 'proved',
            'The 3 rests on a floating-point search under stated arithmetic conditions'),
     V('part', 'Lean: at most 5 bases, so no complete set of 7. Not the bound of 3'),
     [R('266', 'known_before', 'Zauner conjectured N(6)=3 (diploma thesis 1991; doctoral thesis 1999)'),
      R('266', 'known_before', 'Even the nonexistence of a complete set of 7 was open.'),
      R('266', 'lean', "'every MUB family in C^6 has at most 5 members'"),
      A('Three mutually unbiased bases in dimension six', 'joined by all 36 orange cross edges marking unbiasedness')])

# ---------------------------------------------------------------- 267
spec('267', MP, 'proof', 'Bose–Einstein condensation at $T > 0$',
     'Bose–Einstein condensation at positive temperature',
     'Claim: the dilute 3D hard-sphere Bose gas condenses in the thermodynamic limit at some fixed temperature $T > 0$',
     {'dur': 8.4, 'primitive': 'plot', 'x': [0, 0.02], 'y': [0.7, 1.03], 'labelRoom': 250,
      'xlabel': 'gas parameter $\\rho a^3$', 'ylabel': 'fraction in the condensate',
      'xticks': [{'v': 0, 'label': '0'}], 'yticks': [{'v': 1, 'label': '1'}],
      'curves': [{'f': '1-8/(3*sqrt(PI))*sqrt(x)', 'label': '$1 - \\tfrac{8}{3\\sqrt\\pi}\\sqrt{\\rho a^3}$', 'tone': 'accent', 'at': 0.6, 'dur': 2.0}],
      'regions': [{'f': '1-8/(3*sqrt(PI))*sqrt(x)', 'f2': '0.7', 'at': 2.6, 'tone': 'accent'}],
      'beats': [B(0.2, 'Dilute hard-sphere bosons: the fraction in one quantum state, against the gas parameter'),
                B(3.0, 'The curve: the claimed Bogoliubov depletion law, to leading order'),
                B(5.8, 'Headline claim: a positive fraction still condenses at a fixed $T > 0$')]},
     status('Bose–Einstein condensation of an interacting gas',
            ['\\text{condensate fraction} > 0 \\text{ at some fixed } T > 0', '\\text{in the thermodynamic limit}'],
            'Before: proofs only in scaling limits; even $T = 0$ in the thermodynamic limit was open', 'proved',
            '$T$ is small and not located; hard spheres at small fixed density'),
     V('part', 'Lean: ground-state BEC for the dilute hard-sphere gas. Not the $T > 0$ theorem'),
     [R('267', 'claim', 'the Bogoliubov depletion law (8/(3 sqrt pi)) sqrt(rho a^3)'),
      R('267', 'known_before', 'Thermodynamic-limit BEC, even at zero temperature, was open.'),
      R('267', 'lean', 'HardSphere.lean (standard axioms) formalizes ground-state BEC for the dilute hard-sphere gas')])

# ---------------------------------------------------------------- 268
g268 = math.log(20) / 784
spec('268', MP, 'proof', 'The spin-one Haldane gap',
     'The spin-one Haldane gap',
     'Claim: the spin-1 Heisenberg ring has a unique ground state and a gap above $\\log(20)/784$ for even $L \\ge 2304$',
     {'dur': 8.6, 'primitive': 'numberline', 'min': -0.02, 'max': 0.46, 'y': 0.6,
      'ticks': [{'v': 0, 'label': '0'}],
      'markers': [{'v': 0.4105, 'label': 'numerical gap', 'note': 'DMRG: 0.41050', 'tone': 'mute', 'style': 'ring', 'at': 0.5},
                  {'v': 0, 'label': 'gapless', 'note': 'half-integer spin', 'side': 'below', 'at': 0.9}],
      'slide': {'from': 0, 'to': round(g268, 8), 'derived': 'log(20)/784', 'at': 1.4, 'dur': 1.2, 'label': 'claimed bound', 'note': '$> \\log(20)/784$'},
      'zoom': {'min': -0.0008, 'max': 0.0048, 'at': 3.2, 'dur': 2.0, 'counter': True,
               'ticks': [{'v': 0, 'label': '0'}, {'v': round(g268, 8), 'label': '$\\log(20)/784$'}]},
      'beats': [B(0.2, 'Spin-1 Heisenberg chain: numerics put the gap near 0.41; half-integer chains have none'),
                B(3.2, 'Zoom in near zero, where the proven bound lives'),
                B(5.8, 'Claim: the gap stays above $\\log(20)/784$, about 0.0038, for every even $L \\ge 2304$')]},
     status("Haldane's conjecture (1981), spin one",
            ['\\gamma_L > \\log(20)/784 \\quad (\\text{even } L \\ge 2304)'],
            'Before: gaps proved only for AKLT-type models; numerics give about 0.41', 'proved',
            'Computer-assisted certificates; about 100 times below the numerical gap'),
     V('none', 'No formalization; the finite computer certificates need independent rerunning'),
     [R('268', 'claim', '> log(20)/784 for even L>=2304'),
      R('268', 'known_before', "Haldane's conjecture (1981 ILL preprint"),
      R('268', 'known_before', 'DMRG estimate of the gap 0.41050 (White-Huse 1993)'),
      R('268', 'caveats', 'Proven bound log(20)/784 is about 0.0038 vs the numerical 0.41'),
      A('The spin-one Haldane gap', 'The bound is about 100 times smaller than the numerical gap')])

# ---------------------------------------------------------------- 269
spec('269', MP, 'proof', 'The Laughlin spectral gap',
     'A uniform Laughlin gap, stable under weak disorder',
     'Claim: above the Laughlin state at filling $1/3$ the gap is at least $1/25$ for all large $N$',
     {'dur': 8.2, 'primitive': 'plot', 'x': [0, 1], 'y': [-0.02, 0.2], 'labelRoom': 230,
      'xlabel': 'system size $N$ (large)', 'ylabel': 'energy',
      'regions': [{'f': '0.2', 'f2': '0.04', 'at': 3.0, 'tone': 'cool'}],
      'curves': [{'f': '0', 'label': 'Laughlin state, $E = 0$', 'tone': 'accent', 'at': 0.6, 'dur': 1.4, 'labelDy': 14},
                 {'f': '0.04', 'label': 'gap $\\ge 1/25$', 'tone': 'warn', 'dash': True, 'at': 3.0, 'dur': 1.4, 'labelDy': -14}],
      'beats': [B(0.2, 'Electrons in the lowest Landau level at filling $1/3$, with the $V_1$ interaction'),
                B(3.0, 'The Laughlin state has energy zero; every other state sits above a gap'),
                B(5.6, 'Claim: the gap stays at least $1/25$ for all large $N$, so it never closes')]},
     status('Laughlin spectral-gap conjecture (Haldane 1983)',
            ['H^2 \\ge \\gamma H, \\quad \\gamma > 1/25'],
            'Before: only truncated thin-cylinder and torus models (Nachtergaele–Warzel–Young 2021)', 'proved',
            'Also stable under weak bounded disorder, with existential constants'),
     V('part', 'Lean: the uniform gap and $H^2 \\ge \\gamma H$. Not stability under disorder'),
     [R('269', 'claim', 'the gap above the Laughlin state is at least 1/25 for all large N'),
      R('269', 'known_before', '(Haldane 1983; Trugman-Kivelson 1985)'),
      R('269', 'known_before', 'Nachtergaele-Warzel-Young (CMP 383, 2021)')])

# ---------------------------------------------------------------- 270
spec('270', MP, 'proof', 'BFSS threshold bound state',
     'The BFSS threshold bound state, for every $N$',
     'Claim: SU($N$) BFSS matrix quantum mechanics has exactly one normalizable zero-energy state, for every $N \\ge 2$',
     {'dur': 8.4, 'primitive': 'numberline', 'min': -1, 'max': 6, 'y': 0.6, 'axisLabel': 'energy (positions schematic)',
      'ranges': [{'from': 0, 'to': 6, 'label': 'continuous spectrum', 'tone': 'cool', 'at': 0.6, 'side': 'below'}],
      'markers': [{'v': 0, 'label': 'one bound state', 'note': 'zero energy, every $N$', 'tone': 'claim', 'at': 2.6},
                  {'v': 2, 'label': 'SU(2)', 'note': 'bound states inside', 'tone': 'hot', 'style': 'ring', 'at': 5.4},
                  {'v': 4, 'label': '', 'tone': 'hot', 'style': 'ring', 'at': 5.8},
                  {'v': 5, 'label': '', 'tone': 'hot', 'style': 'ring', 'at': 6.0}],
      'beats': [B(0.2, 'Energy spectrum of the BFSS matrix model: a continuum starting at zero'),
                B(2.8, 'Claim: exactly one normalizable state sits at the threshold, for every $N \\ge 2$'),
                B(5.4, 'Companion claim: for SU(2), infinitely many bound states inside the continuum')]},
     status('Witten (1995); BFSS matrix theory (1997)',
            ['\\dim \\ker H_{SU(N)} = 1 \\quad \\text{for every } N \\ge 2'],
            'Before: rigorous for SU(2) only (Sethi–Stern 1998); general $N$ by non-rigorous index counts', 'proved',
            'The SU(2) companion contradicts a statement in the original BFSS paper'),
     V('none', 'No formalization; physicists should check the closure of the supercharge form'),
     [R('270', 'known_before', 'Witten (1995) predicted the D0-brane threshold bound state'),
      R('270', 'known_before', 'PRD 55, 1997'),
      R('270', 'known_before', 'Sethi-Stern (CMP 194, 1998'),
      R('270', 'caveats', 'contradicts a statement in the original BFSS paper')])

# ---------------------------------------------------------------- 271
spec('271', MP, 'proof', 'Magnetization and Bloch\'s law',
     "Spontaneous magnetization and Bloch's law",
     'Claim: the 3D quantum Heisenberg ferromagnet orders at low temperature, with $\\omega(S^z_0) \\ge S/4$',
     {'dur': 8.4, 'primitive': 'plot', 'x': [0, 1], 'y': [0, 1.15], 'labelRoom': 230,
      'xlabel': 'temperature $T$', 'ylabel': 'magnetization',
      'yticks': [{'v': 1, 'label': '$S$'}, {'v': 0.25, 'label': '$S/4$'}],
      'curves': [{'f': '1-0.9*pow(x,1.5)', 'to': 0.95, 'label': "Bloch: $S - c\\,T^{3/2}$", 'tone': 'soft', 'at': 0.6, 'dur': 1.8},
                 {'f': '0.25', 'to': 0.45, 'label': 'claimed floor, low $T$', 'tone': 'accent', 'dash': True, 'at': 3.0, 'dur': 1.0}],
      'regions': [{'f': '1-0.9*pow(x,1.5)', 'f2': '0.25', 'from': 0, 'to': 0.45, 'at': 3.6, 'tone': 'accent'}],
      'beats': [B(0.2, 'Schematic: magnetization of the 3D quantum Heisenberg ferromagnet as $T$ rises'),
                B(3.0, 'Claim: at low $T$ a translation-invariant KMS state keeps $\\omega(S^z_0) \\ge S/4$'),
                B(5.8, "and the loss follows Bloch's $T^{3/2}$ law with its exact coefficient (paper only)")]},
     status("Lieb's Problem A (1999): quantum ferromagnetic order",
            ['\\omega(S^z_0) \\ge S/4 \\quad (d \\ge 3,\\ \\text{low } T)'],
            'Before: order proved for the quantum antiferromagnet (1978), never for the ferromagnet', 'proved',
            "Bloch's law, its lattice correction and the spherical law are paper-only"),
     V('part', 'Lean: spontaneous magnetization ($\\ell/8$ with $\\ell = 2S$). Not Bloch\'s law'),
     [R('271', 'known_before', 'Lieb posed quantum ferromagnetic ordering as Problem A in his 1999 open-problem list'),
      R('271', 'known_before', 'quantum antiferromagnet with S>=1 (Dyson-Lieb-Simon 1978)'),
      R('271', 'lean', 'omega(S^z_0) >= l/8, l=2S')])

# ---------------------------------------------------------------- 272
spec('272', MP, 'disproof', 'PPT-squared is false',
     'PPT-squared is false, and entanglement without secret key',
     'Claim: a PPT channel on $M_{21}$ whose square still preserves entanglement',
     {'dur': 8.2, 'heading': 'Half of an entangled pair, sent through a PPT channel $\\Phi$ twice',
      'primitive': 'graph', 'r': 24, 'edgeAt': 0.6, 'edgeDur': 3.2,
      'nodes': [{'id': 'r', 'x': 0.1, 'y': 0.12, 'label': '$R$'}, {'id': 'a', 'x': 0.1, 'y': 0.72, 'label': '$A$'},
                {'id': 'p1', 'x': 0.37, 'y': 0.72, 'label': '$\\Phi$', 'tone': 'accent'},
                {'id': 'p2', 'x': 0.63, 'y': 0.72, 'label': '$\\Phi$', 'tone': 'accent'},
                {'id': 'b', 'x': 0.9, 'y': 0.72, 'label': '$B$'}],
      'edges': [['r', 'a', {'tone': 'cool'}], ['a', 'p1'], ['p1', 'p2'], ['p2', 'b'], ['r', 'b', {'tone': 'hot', 'w': 3}]],
      'beats': [B(0.2, 'The conjecture: two passes through any PPT channel break all entanglement with $R$'),
                B(4.2, 'Claim: a trace-preserving PPT channel on $M_{21}$ whose square keeps some (yellow)')]},
     status("Christandl's PPT-squared conjecture (2012)",
            ['\\Phi \\text{ PPT} \\Rightarrow \\Phi \\circ \\Phi \\text{ entanglement breaking}'],
            'Counterexamples: one PPT channel on $M_{21}$, and two PPT maps on $10 \\times 10$ matrices', 'disproved',
            'Same construction: entangled, yet zero distillable key (stated protocol class)'),
     V('part', 'Lean: both PPT counterexamples. Not the zero-distillable-key statement'),
     [R('272', 'lean', '(21x21 trace-preserving PPT channel whose square is not entanglement breaking)'),
      R('272', 'claim', 'two PPT maps on 10x10 matrices whose composition is not entanglement breaking'),
      R('272', 'known_before', "Christandl's PPT^2 conjecture (2012, Banff)")])

# ---------------------------------------------------------------- 273
spec('273', MP, 'proof', 'The entropy photon-number inequality',
     'The entropy photon-number inequality',
     'Claim: on a beam splitter, $N(\\rho_C) \\ge \\eta N(\\rho_A) + (1-\\eta) N(\\rho_B)$ for all finite-energy multimode inputs',
     {'dur': 8.6, 'layout': 'sequence',
      'panels': [{'primitive': 'graph', 'r': 26, 'edgeAt': 0.5, 'edgeDur': 1.6, 'until': 3.6,
                  'nodes': [{'id': 'a', 'x': 0.12, 'y': 0.2, 'label': '$\\rho_A$'}, {'id': 'b', 'x': 0.12, 'y': 0.8, 'label': '$\\rho_B$'},
                            {'id': 's', 'x': 0.5, 'y': 0.5, 'label': '$\\eta$', 'tone': 'accent'}, {'id': 'c', 'x': 0.88, 'y': 0.5, 'label': '$\\rho_C$'}],
                  'edges': [['a', 's'], ['b', 's'], ['s', 'c', {'tone': 'accent'}]]},
                 {'primitive': 'plot', 'from': 3.6, 'x': [0, 1], 'y': [0, 4.2], 'labelRoom': 260,
                  'xlabel': 'transmissivity $\\eta$', 'ylabel': 'entropy photon number',
                  'xticks': [{'v': 0, 'label': '0'}, {'v': 1, 'label': '1'}],
                  'curves': [{'f': '1+2*x', 'label': '$\\eta N(\\rho_A) + (1-\\eta)N(\\rho_B)$', 'tone': 'soft', 'at': 0.4, 'dur': 1.2}],
                  'regions': [{'f': '4.2', 'f2': '1+2*x', 'at': 1.8, 'tone': 'accent'}],
                  'points': [{'x': 0, 'y': 1, 'label': '$N(\\rho_B)$', 'at': 0.5}, {'x': 1, 'y': 3, 'label': '$N(\\rho_A)$', 'at': 1.3}]}],
      'beats': [B(0.2, 'Two independent light beams mixed on a beam splitter of transmissivity $\\eta$'),
                B(3.7, 'Entropy photon number $N(\\rho) = g^{-1}(S(\\rho)/n)$ of the output, against $\\eta$'),
                B(6.2, 'Claim: the output always lands in the shaded region, on or above the line')]},
     status('Guha–Erkmen–Shapiro conjecture (2008)',
            ['N(\\rho_C) \\ge \\eta\\, N(\\rho_A) + (1-\\eta)\\, N(\\rho_B)'],
            'Before: the weaker quantum entropy power inequality (2014) and Gaussian or thermal special cases', 'proved',
            'Gives the capacity region of the degraded pure-loss bosonic broadcast channel'),
     V('main', 'The inequality for every $n \\ge 1$ modes and finite-energy inputs; consequences are not'),
     [R('273', 'known_before', 'Guha-Erkmen-Shapiro (ITA 2008, arXiv:0710.5666)'),
      R('273', 'known_before', '(Konig-Smith 2014; De Palma-Mari-Giovannetti 2014)'),
      R('273', 'lean', 'The broadcast-capacity and minimum-output-entropy consequences are not formalized.')])

# ---------------------------------------------------------------- 274
ins = [{'id': f'x{i}', 'x': 0.08, 'y': round(0.06 + 0.176 * (i - 1), 3), 'label': f'$x_{i}$', 'lx': -22, 'lax': 1} for i in range(1, 7)]
gates = [{'id': 'g1', 'x': 0.38, 'y': 0.15, 'fill': 'accent'}, {'id': 'g2', 'x': 0.38, 'y': 0.5, 'fill': 'accent'}, {'id': 'g3', 'x': 0.38, 'y': 0.85, 'fill': 'accent'},
         {'id': 'h1', 'x': 0.65, 'y': 0.32, 'fill': 'accent'}, {'id': 'h2', 'x': 0.65, 'y': 0.68, 'fill': 'accent'},
         {'id': 'o', 'x': 0.9, 'y': 0.5, 'tone': 'hot', 'fill': 'hot', 'label': 'measured output', 'ly': -34}]
e274 = [['x1', 'g1'], ['x2', 'g1'], ['x3', 'g1'], ['x4', 'g1'], ['x1', 'g2'], ['x3', 'g2'], ['x5', 'g2'], ['x6', 'g2'], ['x3', 'g3'], ['x4', 'g3'], ['x5', 'g3'], ['x6', 'g3'],
        ['g1', 'h1'], ['g2', 'h1'], ['g2', 'h2'], ['g3', 'h2'], ['g1', 'h2'], ['h1', 'o'], ['h2', 'o']]
spec('274', MP, 'proof', 'Parity is not in QAC$^0$',
     'Parity is not in QAC$^0$',
     'Claim: constant-depth quantum circuits with many-input Toffolis and polynomial ancillas cannot compute parity',
     {'dur': 8.4, 'heading': 'Depth-2 sketch: one-qubit gates, many-input Toffolis, ancillas in $|0\\rangle$',
      'primitive': 'graph', 'nodes': ins + gates, 'edges': e274, 'r': 12, 'edgeAt': 0.5, 'edgeDur': 3.6,
      'beats': [B(0.2, 'Constant depth, polynomially many qubits, one measured output qubit'),
                B(3.2, 'Classically, constant-depth AND/OR circuits cannot compute parity'),
                B(5.8, 'Claim: neither can these, beyond any fixed advantage over $1/2$ for large $n$')]},
     status("Moore's question (1999)", ['\\mathrm{PARITY} \\notin \\mathrm{QAC}^0'],
            'Before: only with few ancillas, at most slightly superlinear (Anshu–Dong–Ou–Yao 2025)', 'proved',
            'Bounded error with one measured output; strict majority follows too'),
     V('main', 'Every depth and polynomial qubit count: success below $1/2 + \\varepsilon$, and below $2/3$'),
     [R('274', 'known_before', 'Moore (1999, quant-ph/9903046)'),
      R('274', 'known_before', 'Anshu-Dong-Ou-Yao (STOC 2025, arXiv:2410.06499) with slightly superlinear ancillas'),
      R('274', 'lean', 'success probability is below 1/2+eps (and below 2/3)')])

# ---------------------------------------------------------------- 275
spec('275', MP, 'proof', 'QMA-hardness of the Coulomb problem',
     'QMA-hardness of continuum Coulomb energy',
     "Claim: approximating a molecule's electronic ground-state energy is QMA-hard, even with unit-charge nuclei",
     {'dur': 8.2, 'primitive': 'tree', 'at': 0.3,
      'nodes': [{'id': 'r', 'label': 'Coulomb ground energy is QMA-hard', 'status': 'lean'},
                {'id': 'k', 'label': 'Kitaev: local Hamiltonian', 'parent': 'r', 'status': 'prior'},
                {'id': 'e', 'label': 'encode it in nuclei', 'parent': 'r', 'status': 'lean'},
                {'id': 'u', 'label': 'unit charges, rational positions', 'parent': 'e', 'status': 'lean'},
                {'id': 'b', 'label': 'binary-encoded charges', 'parent': 'e', 'status': 'lean'}],
      'beats': [B(0.2, "The reduction: any QMA problem becomes a molecule's ground-state energy"),
                B(3.0, 'Only electrons, clamped nuclei and Coulomb forces: no basis set, field or extra potential'),
                B(5.6, 'Claim: approximating that energy is QMA-hard under polynomial-time reductions')]},
     status('Hardness of the electronic structure problem',
            ['\\text{approximating } \\inf \\mathrm{spec}\\, H_{\\rm Coulomb} \\text{ is QMA-hard}'],
            'Before: hardness needed a lattice basis or a site-dependent magnetic field (2009)', 'proved',
            'Worst case only: it says nothing about typical molecules'),
     V('main', 'Both the binary-charge and the unit-charge versions are in Lean'),
     [R('275', 'known_before', 'Schuch-Verstraete (Nature Physics 5, 2009)'),
      R('275', 'lean', 'both the binary-charge and unit-charge versions')])

# ---------------------------------------------------------------- 276
spec('276', MP, 'proof', 'Capacity of generalized amplitude damping',
     'Classical capacity of generalized amplitude damping',
     'Claim: for every such qubit channel the classical capacity equals the one-shot Holevo capacity',
     {'dur': 8.4, 'primitive': 'shape', 'axes': True,
      'shapes': [{'kind': 'circle', 'r': 1, 'tone': 'soft', 'dash': True, 'label': 'input states', 'labelAt': [-1.65, 0.85], 'at': 0.3},
                 {'kind': 'circle', 'r': 1, 'tone': 'accent', 'label': 'outputs', 'labelAt': [1.45, 0.6], 'at': 1.2,
                  'morph': {'kind': 'ellipse', 'rx': 0.707, 'ry': 0.5, 'c': [0, 0.25], 'at': 2.8, 'dur': 1.8}}],
      'points': [{'p': [0, 0.5], 'label': 'thermal fixed point', 'at': 4.8, 'tone': 'hot'}],
      'beats': [B(0.2, 'A qubit relaxing in a warm bath: the channel squeezes the Bloch ball'),
                B(3.0, 'Outputs shrink toward a thermal fixed point (one choice of damping and temperature)'),
                B(5.8, 'Claim: entangled inputs never help; capacity is the one-shot Holevo value')]},
     status('Open problem listed by Leditzky–Kaur–Datta–Wilde (2018)',
            ['C(\\mathcal A_{\\gamma,N}) = \\chi(\\mathcal A_{\\gamma,N})'],
            'Before: only upper and lower bounds (Khatri–Sharma–Wilde 2020)', 'proved',
            'Additivity with arbitrary partner channels is claimed but not formalized'),
     V('main', 'Additivity over repeated uses and equality with the operational capacity'),
     [R('276', 'known_before', 'listed open by Leditzky-Kaur-Datta-Wilde (PRA 97, 012332, 2018), with bounds by Khatri-Sharma-Wilde (2020)'),
      R('276', 'lean', 'Additivity with arbitrary different partner channels is not formalized.')])

# ---------------------------------------------------------------- 277
spec('277', MP, 'proof', 'Threshold repetition for entangled games',
     'Threshold parallel repetition for entangled games',
     'Claim: winning a $v + \\delta$ fraction of $k$ parallel rounds is exponentially unlikely, for any finite game',
     {'dur': 8.2, 'primitive': 'plot', 'x': [0, 10], 'y': [0, 1.05], 'labelRoom': 280,
      'xlabel': 'parallel rounds $k$', 'ylabel': 'chance of winning a $v + \\delta$ fraction',
      'curves': [{'f': 'exp(-0.45*x)', 'label': '$e^{-\\kappa\\,\\delta^5 k/(1+\\log|A||B|)}$', 'tone': 'accent', 'at': 0.8, 'dur': 2.4}],
      'regions': [{'f': 'exp(-0.45*x)', 'at': 3.4, 'tone': 'accent'}],
      'beats': [B(0.2, 'Entangled players play $k$ copies of a game with value $v < 1$ in parallel'),
                B(3.0, 'Claim: winning a $v + \\delta$ fraction of the rounds becomes exponentially unlikely'),
                B(5.6, "Constants illustrative; the paper's rate is $\\delta^5$, the Lean's $\\delta^{13}$")]},
     status('Threshold parallel repetition, entangled games',
            ['\\Pr[\\ge (v+\\delta)k \\text{ wins}] \\le e^{-\\kappa\\,\\delta^5 k/(1+\\log|A||B|)}'],
            'Before: XOR, free and anchored games; only polynomial decay for general games (Yuen 2016)', 'proved',
            "The hard all-wins step is credited to prior work, including OpenAI's own"),
     V('main', "Lean proves it with $\\delta^{13}$ in place of the paper's $\\delta^5$"),
     [R('277', 'known_before', 'polynomial decay for general games (Yuen 2016)'),
      R('277', 'lean', "with delta^13 in place of the paper's delta^5")])

# ---------------------------------------------------------------- 278
spec('278', MP, 'counterexample', 'Kohn–Sham representability fails',
     'Failure of Kohn–Sham ensemble representation',
     'Claim: a three-electron molecule whose ground-state density no noninteracting ensemble reproduces',
     {'dur': 8.6, 'layout': 'sequence',
      'panels': [{'primitive': 'graph', 'r': 22, 'edgeAt': 0.8, 'edgeDur': 0.6, 'until': 3.6,
                  'nodes': [{'id': 'n1', 'x': 0.38, 'y': 0.5, 'label': '$Z$', 'tone': 'accent'}, {'id': 'n2', 'x': 0.62, 'y': 0.5, 'label': '$Z$', 'tone': 'accent'},
                            {'id': 'e1', 'x': 0.24, 'y': 0.2, 'label': '$e$', 'tone': 'cool'}, {'id': 'e2', 'x': 0.74, 'y': 0.22, 'label': '$e$', 'tone': 'cool'},
                            {'id': 'e3', 'x': 0.5, 'y': 0.85, 'label': '$e$', 'tone': 'cool'}],
                  'edges': [['n1', 'n2', {'tone': 'faint'}]]},
                 {'primitive': 'venn', 'from': 3.6,
                  'sets': [{'label': 'Coulomb ground-state densities'}, {'label': 'noninteracting ensembles'}],
                  'regions': [{'set': 'A&!B', 'label': 'this molecule', 'x': 0.32, 'y': 0.5, 'at': 1.8}]}],
      'beats': [B(0.2, 'Three electrons, two equal nuclear charges $Z$ (given by an exact formula)'),
                B(3.7, 'Kohn–Sham DFT assumes noninteracting electrons can reproduce every such density'),
                B(6.2, 'Claim: this one cannot, for any potential in $L^{3/2} + L^\\infty$')]},
     status('Kohn–Sham ensemble representability',
            ['\\rho_{\\rm GS} = \\rho_{\\text{noninteracting ensemble in some } v}'],
            'Counterexample: a three-electron molecule with two equal positive-integer nuclear charges', 'counterexample',
            'One potential class only; the nuclear charge is likely huge'),
     V('none', 'No formalization; manuscript only'),
     [R('278', 'claim', 'three-electron Coulomb molecule with two equal positive-integer nuclear charges'),
      R('278', 'caveats', 'the nuclear charge is specified only by a formula (likely huge)')])

# ---------------------------------------------------------------- 279
spec('279', MP, 'proof', 'Exact factoring, fixed finite gate set',
     'Exact quantum factoring over a fixed finite gate set',
     'Claim: poly-time circuits over one finite gate set factor every $N \\ge 2$ completely, with probability 1',
     {'dur': 8.0, 'primitive': 'equation', 'mode': 'stack',
      'lines': [{'tex': '\\Pr[\\text{Shor finds the factors}] \\ge 1 - \\varepsilon', 'tone': 'soft', 'at': 0.4, 'size': 40},
                {'tex': '\\Pr[\\text{output} = \\text{full factorization of } N] = 1', 'tone': 'accent', 'at': 3.2, 'size': 40}],
      'beats': [B(0.2, "Shor's algorithm succeeds with high probability, using arbitrary rotation angles"),
                B(3.0, 'Claim: a uniform polynomial-time circuit family over one fixed finite gate set'),
                B(5.6, 'outputs the complete prime factorization of every $N \\ge 2$, with no error at all')]},
     status('Is factoring in exact quantum polynomial time?',
            ['\\text{Factoring} \\in \\text{EQP (one fixed finite gate set)}'],
            'Before: Shor (1994) errs with small probability; exact variants needed continuous angles', 'proved',
            'A complexity refinement, not a faster algorithm'),
     V('main', 'Exact polynomial-time factoring is in Lean; the formal circuit model should be audited'),
     [R('279', 'known_before', 'Shor (1994) factors with bounded error'),
      R('279', 'caveats', 'no practical speedup')])

# ---------------------------------------------------------------- 280
spec('280', MP, 'partial', 'Unitary VOAs and conformal nets',
     'Unitary vertex operator algebras and conformal nets',
     'Claim: every simple unitary strongly rational VOA is strongly local and gives a completely rational net',
     {'dur': 8.2, 'primitive': 'tree', 'at': 0.3,
      'nodes': [{'id': 'r', 'label': 'VOA $V$ gives a conformal net', 'status': 'lean'},
                {'id': 's', 'label': 'strong locality', 'parent': 'r', 'status': 'lean'},
                {'id': 'c', 'label': 'complete rationality', 'parent': 'r', 'status': 'paper'},
                {'id': 'm', 'label': 'unitary modules', 'parent': 'r', 'status': 'paper'},
                {'id': 'b', 'label': 'braided equivalence', 'parent': 'r', 'status': 'paper'},
                {'id': 'k', 'label': 'CKLW bridge', 'parent': 's', 'status': 'prior'}],
      'beats': [B(0.2, 'Two axioms for chiral conformal field theory: VOAs and conformal nets'),
                B(3.0, 'Claim: they match for every simple unitary strongly rational VOA'),
                B(5.6, 'Solid boxes are in Lean; the tensor-category matching is paper-only')]},
     status('Strong-locality conjecture (Carpi–Kawahigashi–Longo–Weiner, 2018)',
            ['V \\text{ simple, unitary, strongly rational} \\Rightarrow V \\text{ strongly local}'],
            'The conjecture is for every simple unitary VOA; this covers the strongly rational ones', 'partial'),
     V('part', 'Lean: energy bounds, strong locality and the net. Not the module or tensor results'),
     [R('280', 'known_before', '(Memoirs AMS 254, 2018, arXiv:1503.01260)'),
      R('280', 'caveats', 'Strongly rational case only')])

# ---------------------------------------------------------------- 281
spec('281', MP, 'proof', 'QAOA reaches the SK optimum',
     'QAOA attains the Sherrington–Kirkpatrick optimum',
     'Claim: with size to infinity first, finite-depth QAOA gets arbitrarily close to the SK ground-state energy',
     {'dur': 8.2, 'primitive': 'plot', 'x': [0, 10], 'y': [-0.85, -0.1], 'labelRoom': 230,
      'xlabel': 'depth $p$', 'ylabel': 'energy per spin, size $\\to \\infty$ first',
      'curves': [{'f': '-0.76', 'label': 'SK ground state', 'tone': 'soft', 'dash': True, 'at': 0.4, 'dur': 1.0, 'labelDy': 16},
                 {'f': '-0.76+0.5*exp(-0.45*x)', 'label': 'QAOA at depth $p$', 'tone': 'accent', 'at': 1.4, 'dur': 2.4, 'labelDy': -16}],
      'beats': [B(0.2, 'Schematic: QAOA energy on the Sherrington–Kirkpatrick model as depth grows'),
                B(3.0, 'Size goes to infinity first, then depth; the angles do not depend on size'),
                B(5.6, 'Claim: the energy reaches the true ground state, as the conjecture predicted')]},
     status('Conjecture of Basso–Farhi–Marwaha–Villalonga–Zhou (2022)',
            ['\\lim_{p\\to\\infty}\\, \\lim_{N\\to\\infty} \\tfrac1N E_p = \\text{SK ground-state energy}'],
            "Before: energies computed at fixed depth; Montanari's classical algorithm assumes no overlap gap", 'proved',
            'No depth bound and no efficient way to choose the angles'),
     V('part', 'Lean: Parisi-measure facts, conditional on a minimizer. Not QAOA convergence'),
     [R('281', 'known_before', 'Basso-Farhi-Marwaha-Villalonga-Zhou (TQC 2022, arXiv:2110.14206)'),
      R('281', 'caveats', 'No bound on the needed depth and no efficient angle selection')])

# ---------------------------------------------------------------- 282
spec('282', MP, 'conditional', 'Scale to conformal symmetry in 4D',
     'From scale symmetry to local conformal symmetry in 4D',
     'Claim: under stated axioms, a scale-invariant 4D QFT has a symmetric, conserved, traceless stress tensor',
     {'dur': 8.2, 'primitive': 'tree', 'at': 0.3, 'legend': False,
      'nodes': [{'id': 'r', 'label': 'traceless improved stress tensor', 'status': 'paper'},
                {'id': 'u', 'label': 'unitary, positive energy', 'parent': 'r', 'status': 'paper'},
                {'id': 'd', 'label': 'discrete scaling spectrum', 'parent': 'r', 'status': 'paper'},
                {'id': 'n', 'label': 'bounded local net', 'parent': 'r', 'status': 'paper'},
                {'id': 'c', 'label': 'local dilatation current', 'parent': 'r', 'status': 'paper'}],
      'beats': [B(0.2, 'Four hypotheses on a scale-invariant four-dimensional quantum field theory'),
                B(3.0, 'Claim: under them the stress tensor improves to a symmetric, conserved, traceless one'),
                B(5.6, 'That gives local conformal Ward identities, not a global conformal action')]},
     status('Scale implies conformal invariance (2D: Polchinski 1988)',
            ['\\text{scale invariance} \\Rightarrow T\'^{\\mu}{}_{\\mu} = 0 \\text{ after improvement}'],
            'Before: perturbative arguments (2012) and a nonperturbative one under assumptions (2015)', 'conditional',
            'Conditional on a strong axiomatic framework; not the physics question'),
     V('none', 'No formalization; manuscript only'),
     [R('282', 'known_before', 'Polchinski (1988) proved scale implies conformal in 2D'),
      R('282', 'known_before', 'Luty-Polchinski-Rattazzi (2012)'),
      R('282', 'known_before', 'Dymarsky-Komargodski-Schwimmer-Theisen (JHEP 2015)')])

# ---------------------------------------------------------------- 283
spec('283', MP, 'proof', 'Unitary synthesis from a Boolean oracle',
     'Polynomial-time unitary synthesis from a Boolean oracle',
     'Claim: one uniform polynomial oracle circuit reaches every $n$-qubit unitary within diamond distance $1/2$',
     {'dur': 8.2, 'primitive': 'sequence', 'at': 0.4, 'stagger': 0.22,
      'items': ['$H$', '$T$', '$\\mathcal O$', 'CNOT', '$T^\\dagger$', '$\\mathcal O$', '$H$', '$\\mathcal O$', '$T$'],
      'marks': {'2': 'accent', '5': 'accent', '7': 'accent'}, 'ellipsis': True,
      'caption': 'gates from $\\{H, T, T^\\dagger, \\mathrm{CNOT}\\}$ and calls to a Boolean oracle $\\mathcal O$',
      'beats': [B(0.2, 'A circuit generated in polynomial time from $n$ alone, with Boolean oracle calls'),
                B(3.0, 'The oracle is chosen for the target unitary $U$; the circuit is not'),
                B(5.6, 'Claim: it reaches every $n$-qubit $U$ within diamond distance $1/2$')]},
     status('Unitary synthesis problem (Aaronson–Kuperberg 2007)',
            ['\\exists f:\\ \\lVert C^{f}_n - U \\rVert_\\diamond \\le \\tfrac{1}{2} \\text{ for every } n\\text{-qubit } U'],
            'Before: a one-query lower bound (Lombardi–Ma–Wright, STOC 2024)', 'proved',
            'Constant error only; building the oracle efficiently is not claimed'),
     V('none', 'No formalization; a short manuscript'),
     [R('283', 'known_before', 'Aaronson-Kuperberg (Theory of Computing 3, 2007)'),
      R('283', 'known_before', 'Lombardi-Ma-Wright (STOC 2024)'),
      R('283', 'claim', '(gates H, T, T^dagger, CNOT')])

# ---------------------------------------------------------------- 284
spec('284', MP, 'disproof', 'Randomized vs quantum queries: exponent 4',
     'The optimal quartic separation of randomized and quantum queries',
     'Claim: total functions with $R \\ge Q^{4-o(1)}$, so the known $R = O(Q^4)$ is optimal',
     {'dur': 8.6, 'primitive': 'numberline', 'min': 2.3, 'max': 4.3, 'y': 0.62,
      'ticks': [{'v': 2.5, 'label': '$5/2$'}, 3, 4], 'axisLabel': 'exponent $\\alpha$ in $R(f) \\ge Q(f)^{\\alpha}$',
      'markers': [{'v': 2.5, 'label': 'cheat sheets', 'note': '$5/2$', 'at': 0.5, 'derived': '5/2'},
                  {'v': 2.666667, 'label': 'Tal', 'note': '$8/3$', 'at': 0.8, 'derived': '8/3'},
                  {'v': 3, 'label': 'best before', 'note': '$3 - o(1)$', 'at': 1.1},
                  {'v': 4, 'label': 'upper bound', 'note': '$R = O(Q^4)$, 2021', 'side': 'below', 'at': 1.4}],
      'slide': {'from': 3, 'to': 4, 'at': 3.0, 'dur': 1.5, 'label': 'claimed', 'note': '$4 - o(1)$'},
      'beats': [B(0.2, 'How far can quantum queries beat randomized ones on total functions?'),
                B(3.0, 'Separations crept up to $3 - o(1)$, and a cubic upper bound was conjectured'),
                B(5.8, 'Claim: $4 - o(1)$, matching the known $R = O(Q^4)$: the exponent is exactly 4')]},
     {'form': 'bound',
      'before': {'label': 'Best separation before', 'tex': 'R \\ge Q^{3-o(1)}', 'note': 'Bansal–Sinha; Sherstov–Storozhenko–Wu'},
      'after': {'label': 'Claimed, 5 Oct 2026', 'tex': 'R \\ge Q^{4-o(1)}', 'note': 'total Boolean functions, up to polylog factors'},
      'note': 'Disproves the conjectured $R = O(Q^3)$; with $R = O(Q^4)$ the exponent is 4', 'stamp': 'disproved'},
     V('none', 'No formalization; 19 pages that query-complexity experts can check quickly'),
     [R('284', 'known_before', 'Best separations: 5/2 (Aaronson-Ben-David-Kothari cheat sheets), 8/3 (Tal), 3-o(1) (Bansal-Sinha; Sherstov-Storozhenko-Wu)'),
      R('284', 'known_before', 'Aaronson-Ben-David-Kothari-Rao-Tal (STOC 2021), via Huang\'s sensitivity theorem, proved D=O(Q^4) and conjectured R=O(Q^3)'),
      R('284', 'caveats', 'Short (19 pages)'),
      C('284', 'A-Nearly-Quartic-Separation-Between-Randomized-and-Quantum-Query-Complexity-October-5-2026/quartic-query-separation.pdf')])

# ---------------------------------------------------------------- 285
spec('285', OA, 'disproof', 'Baum–Connes and Kadison–Kaplansky fail',
     'Counterexamples to Baum–Connes and Kadison–Kaplansky',
     'Claim: a torsion-free group with a projection of trace strictly between 0 and $1/2$ in its reduced C*-algebra',
     {'dur': 8.4, 'primitive': 'numberline', 'min': -0.1, 'max': 1.1, 'y': 0.6,
      'ticks': [0, {'v': 0.5, 'label': '$1/2$'}, 1], 'axisLabel': 'trace $\\tau(e)$ of a projection $e$ in $C^*_r(G)$',
      'markers': [{'v': 0, 'label': '$e = 0$', 'note': 'trivial', 'at': 0.5}, {'v': 1, 'label': '$e = 1$', 'note': 'trivial', 'at': 0.8}],
      'ranges': [{'from': 0, 'to': 0.5, 'derived': '1/2', 'label': 'claimed: $0 < \\tau(e) < 1/2$', 'note': 'torsion-free $G$', 'tone': 'claim', 'at': 3.0}],
      'beats': [B(0.2, 'Kadison–Kaplansky: for torsion-free $G$, the only projections are 0 and 1'),
                B(3.0, 'Claim: a torsion-free group with a projection of trace strictly between 0 and $1/2$'),
                B(5.7, 'Another group carries an irrational trace, which assembly cannot reach (Lück)')]},
     status('Baum–Connes (1982) and Kadison–Kaplansky conjectures',
            ['G \\text{ torsion-free} \\Rightarrow \\text{projections in } C^*_r(G) \\text{ are } 0, 1'],
            'Before: counterexamples only with coefficients (Higson–Lafforgue–Skandalis 2002)', 'disproved',
            '184 pages and no formalization: the first claim to referee'),
     V('none', 'No formalization and no Comparator challenge'),
     [R('285', 'known_before', 'Baum-Connes conjecture (1982 manuscript'),
      R('285', 'known_before', 'Higson-Lafforgue-Skandalis, GAFA 2002'),
      R('285', 'claim', 'a projection e in C*_r(G_proj) with 0<tau(e)<1/2'),
      R('285', 'caveats', '184 pages'),
      A('Counterexamples to Baum–Connes and Kadison–Kaplansky', 'there is no Comparator challenge')])

# ---------------------------------------------------------------- 286
spec('286', OA, 'proof', 'Rigidity of lattice von Neumann algebras',
     'Rigidity and arithmetic of lattice von Neumann algebras',
     'Claim: finite-index correspondences of twisted lattice factors all come from group-level data',
     {'dur': 8.2, 'primitive': 'tree', 'at': 0.3,
      'nodes': [{'id': 'r', 'label': 'correspondences come from group data', 'status': 'paper'},
                {'id': 'f', 'label': 'subgroup isomorphisms', 'parent': 'r', 'status': 'paper'},
                {'id': 'p', 'label': 'projective representations', 'parent': 'r', 'status': 'paper'},
                {'id': 't', 'label': 'Popa: property (T) rigidity', 'parent': 'r', 'status': 'prior'},
                {'id': 'o', 'label': "OpenAI's earlier Connes result", 'parent': 'r', 'status': 'prior'}],
      'beats': [B(0.2, 'Twisted group factors of property (T) lattices over local fields'),
                B(3.0, 'Claim: every finite-index correspondence is built from two kinds of group data'),
                B(5.6, 'So the algebra remembers the group, the cocycle and the scale')]},
     status('W*-rigidity for property (T) lattices',
            ['L_c(\\Gamma)^t \\cong L_d(\\Lambda) \\Rightarrow \\text{recover } \\Gamma,\\ c,\\ t'],
            "Builds on Popa's deformation/rigidity and on OpenAI's earlier counterexample to Connes' rigidity", 'proved',
            'Technical: 190 pages, significance mostly internal to W*-rigidity'),
     V('none', 'No formalization; depends on earlier OpenAI-produced results'),
     [R('286', 'caveats', 'Very long (190 pages), unformalized, and depends on earlier OpenAI-produced results')])

# ---------------------------------------------------------------- 287
spec('287', OA, 'proof', 'The free group factors are isomorphic',
     'The free group factors are all isomorphic',
     'Claim: $L(\\mathbb F_n) \\cong L(\\mathbb F_{n+1})$ for $n \\ge 3$, hence every $L(\\mathbb F_r)$, $1 < r \\le \\infty$, is one factor',
     {'dur': 8.6, 'primitive': 'numberline', 'min': 1, 'max': 6.6, 'y': 0.58,
      'ticks': [{'v': 2, 'label': '$\\mathbb F_2$'}, {'v': 3, 'label': '$\\mathbb F_3$'}, {'v': 4, 'label': '$\\mathbb F_4$'}, {'v': 5, 'label': '$\\mathbb F_5$'}, {'v': 6, 'label': '$\\mathbb F_6$'}],
      'axisLabel': 'interpolated free group factors $L(\\mathbb F_r)$, $r > 1$',
      'ranges': [{'from': 3, 'to': 6, 'label': 'one factor', 'note': 'Theorem 1.1, $n \\ge 3$', 'tone': 'claim', 'at': 1.0},
                 {'from': 2, 'to': 6, 'label': 'all the same factor', 'tone': 'claim', 'side': 'below', 'at': 5.0}],
      'slide': {'from': 3, 'to': 2, 'at': 3.0, 'dur': 1.5, 'label': 'amplify by $t = \\sqrt2$', 'note': '$L(\\mathbb F_3)_t \\cong L(\\mathbb F_2)$'},
      'beats': [B(0.2, 'Interpolated free group factors: either all the same, or all different (1994)'),
                B(2.9, 'Claim: $L(\\mathbb F_n) \\cong L(\\mathbb F_{n+1})$ for $n \\ge 3$; amplifying by $\\sqrt2$ reaches $\\mathbb F_2$'),
                B(5.6, 'So every $L(\\mathbb F_r)$, $1 < r \\le \\infty$, is one and the same factor')]},
     status('Free group factor problem (credited to Kadison)',
            ['L(\\mathbb F_2) \\cong L(\\mathbb F_3) \\cong \\cdots \\cong L(\\mathbb F_\\infty)'],
            'Before: all isomorphic or pairwise different (Dykema, Radulescu 1994); most expected different', 'proved',
            'Free entropy dimension is not an invariant of the generated algebra'),
     V('main', 'All interpolated factors isomorphic, $1 < r \\le \\infty$, in about 17.6k lines of Lean',
       'We read the Lean definitions; we did not run the build'),
     [R('287', 'known_before', 'Dykema (Pacific J. Math. 1994) and Radulescu (Invent. Math. 1994)'),
      R('287', 'lean', '~17.6k lines'),
      A('free group factors are all the same', 'Its Theorem 1.1 gives a trace-preserving isomorphism'),
      A('free group factors are all the same', 'it goes the direction almost nobody expected'),
      A('free group factors are all the same', 'I read the definitions and they are the standard ones'),
      A('free group factors are all the same', 'I did not run it')])

# ---------------------------------------------------------------- 288
dcells = [[r, c] for b in range(3) for r in (2 * b, 2 * b + 1) for c in (2 * b, 2 * b + 1)]
spec('288', OA, 'proof', "Kadison's similarity problem",
     "Kadison's similarity problem",
     'Claim: every bounded unital homomorphism of a C*-algebra into $B(H)$ is similar to a *-homomorphism',
     {'dur': 8.6, 'layout': 'sequence',
      'panels': [{'primitive': 'grid', 'rows': 6, 'cols': 6, 'cells': dcells, 'until': 3.6,
                  'blocks': [{'r': 0, 'c': 0, 'h': 2, 'w': 2, 'label': '$Y$', 'at': 1.0}, {'r': 2, 'c': 2, 'h': 2, 'w': 2, 'label': '$Y$', 'at': 1.3},
                             {'r': 4, 'c': 4, 'h': 2, 'w': 2, 'label': '$Y$', 'at': 1.6}],
                  'caption': '$Y^{(h)} = Y \\oplus \\cdots \\oplus Y$, here $h = 3$'},
                 {'primitive': 'equation', 'from': 3.6, 'mode': 'stack',
                  'lines': [{'tex': '\\lVert [Y^{(h)}, X] \\rVert \\le C\\, g_P(Y)\\, \\lVert X \\rVert', 'tone': 'accent', 'at': 0.3, 'size': 48},
                            {'tex': 'X \\in M_h(P),\\ \\text{every } h,\\ \\text{one } C', 'tone': 'soft', 'at': 1.2, 'size': 34}]}],
      'beats': [B(0.2, 'The $h$-fold amplification of an operator $Y$, acting on $h \\times h$ matrices over $P$'),
                B(3.7, 'Key estimate: one constant $C$ for every von Neumann algebra and every size $h$'),
                B(6.2, 'With Haagerup and Kirchberg, that gives similarity for every C*-algebra')]},
     status("Kadison's similarity problem (1955)",
            ['\\rho = S\\,\\pi(\\cdot)\\,S^{-1} \\text{ for every bounded unital hom } \\rho'],
            'Before: cyclic case (Haagerup 1983), nuclear, no-trace and property $\\Gamma$ cases; $L(\\mathbb F_2)$ type open', 'proved',
            'Corollary: every von Neumann algebra is hyperreflexive, one universal constant'),
     V('main', 'Similarity for every C*-algebra and Hilbert space, plus the uniform commutator estimate',
       'We read the Lean statement; we did not build it'),
     [R('288', 'known_before', 'Kadison 1955'), R('288', 'known_before', 'Haagerup (Ann. Math. 1983)'),
      R('288', 'caveats', 'fidelity audit and actual build not done by me')])

# ---------------------------------------------------------------- 289
spec('289', OA, 'proof', 'Strong Kadison–Kastler stability',
     'Strong Kadison–Kastler stability',
     'Claim: von Neumann algebras close enough are conjugate by a unitary near 1, with a universal tolerance',
     {'dur': 8.4, 'primitive': 'shape',
      'shapes': [{'kind': 'regular', 'n': 7, 'r': 1, 'tone': 'accent', 'label': '$M$', 'labelAt': [0, 0], 'at': 0.3},
                 {'kind': 'regular', 'n': 7, 'r': 1.06, 'rot': -1.33, 'tone': 'soft', 'label': '$N$', 'labelAt': [1.4, 0.75], 'at': 1.0,
                  'morph': {'kind': 'regular', 'n': 7, 'r': 1, 'at': 3.4, 'dur': 1.8}}],
      'beats': [B(0.2, 'Schematic: two von Neumann algebras on one Hilbert space, unit balls within $\\delta$'),
                B(3.2, 'Claim: a unitary $u$ with $\\lVert u - 1 \\rVert < \\varepsilon$ carries one exactly onto the other'),
                B(6.0, 'and $\\delta$ depends only on $\\varepsilon$: not on the algebras or the space')]},
     status('Kadison–Kastler conjecture (1972), strong form',
            ['d(M,N) < \\delta(\\varepsilon) \\Rightarrow uMu^* = N,\\ \\lVert u - 1 \\rVert < \\varepsilon'],
            'Before: injective algebras, separable nuclear C*-algebras (2012), some II$_1$ factors (2014)', 'proved',
            'Fails for norm-separable C*-algebras (companion counterexample)'),
     V('main', 'Universal strong stability for von Neumann algebras; the counterexamples are paper-only'),
     [R('289', 'known_before', 'Kadison-Kastler (Amer. J. Math. 1972)'),
      R('289', 'known_before', '(Christensen-Sinclair-Smith-White-Winter, Acta Math. 2012)'),
      R('289', 'known_before', 'Duke 2014')])

# ---------------------------------------------------------------- 290
spec('290', OA, 'proof', "Connes' bicentralizer problem",
     "Connes' bicentralizer problem",
     'Claim: every type III$_1$ factor with separable predual has trivial bicentralizer, via a relative version',
     {'dur': 8.4, 'primitive': 'shape',
      'shapes': [{'kind': 'circle', 'r': 1.1, 'tone': 'soft', 'label': '$M$', 'labelAt': [-0.82, 0.82], 'at': 0.3},
                 {'kind': 'circle', 'r': 0.72, 'c': [0.18, -0.12], 'tone': 'cool', 'label': '$N$', 'labelAt': [-0.3, 0.38], 'at': 1.0},
                 {'kind': 'circle', 'r': 0.32, 'c': [0.38, -0.3], 'tone': 'accent', 'label': '$P$', 'labelAt': [0.38, -0.3], 'at': 3.2}],
      'beats': [B(0.2, 'An inclusion $N \\subset M$ with separable preduals and a faithful normal expectation'),
                B(3.0, 'Claim: an amenable $P$ inside $N$ already has the same relative commutant in the core'),
                B(5.8, 'Special case: every type III$_1$ factor has trivial bicentralizer')]},
     status("Connes' bicentralizer problem (1980)",
            ['B(M, \\varphi) = \\mathbb C \\text{ for every type III}_1 \\text{ factor } M'],
            'Before: hyperfinite case (Haagerup 1987); many cases (Ando–Haagerup–Houdayer–Marrakchi 2020)', 'proved',
            'Separable predual; 35 pages over two papers for a 45-year-old problem'),
     V('part', 'Lean: a supporting bounded spectral-recovery theorem only, not the conjecture'),
     [R('290', 'known_before', 'Connes posed the bicentralizer problem (1980, Kingston)'),
      R('290', 'known_before', 'Haagerup proved it for hyperfinite III_1 factors (Acta Math. 1987)'),
      R('290', 'known_before', '(Math. Ann. 2020, arXiv:1804.05706)'),
      R('290', 'caveats', 'for a 45-year-old problem'),
      A("Connes' bicentralizer problem", 'in 35 pages over two papers')])

# ---------------------------------------------------------------- 291
spec('291', OA, 'proof', 'Toms–Winter: comparison implies $\\mathcal Z$',
     'Strict comparison implies Jiang–Su stability',
     'Claim: simple separable unital nuclear C*-algebras with strict comparison absorb $\\mathcal Z$ (Toms–Winter)',
     {'dur': 8.4, 'primitive': 'graph', 'r': 16, 'edgeAt': 0.8, 'edgeDur': 5.0,
      'nodes': [{'id': 'z', 'x': 0.5, 'y': 0.14, 'label': '$\\mathcal Z$-stable', 'ly': -36, 'fill': 'accent'},
                {'id': 'd', 'x': 0.18, 'y': 0.82, 'label': 'finite nuclear dimension', 'ly': 38},
                {'id': 's', 'x': 0.82, 'y': 0.82, 'label': 'strict comparison', 'ly': 38}],
      'edges': [['z', 'd', {'tone': 'soft', 'w': 3}], ['z', 's', {'tone': 'faint', 'w': 2}], ['s', 'z', {'tone': 'accent', 'w': 4}]],
      'beats': [B(0.2, 'Three regularity properties of simple separable nuclear C*-algebras'),
                B(2.8, '$\\mathcal Z$-stability and finite nuclear dimension were shown equivalent in 2021'),
                B(5.6, 'Claim: strict comparison implies $\\mathcal Z$-stability, so all three agree (unital case)')]},
     status('Toms–Winter conjecture',
            ['A \\text{ has strict comparison} \\Rightarrow A \\cong A \\otimes \\mathcal Z'],
            'Before: known only with conditions on the trace space or uniform property $\\Gamma$', 'proved',
            "Also Robert–Tikuisis C1 and the unital stably finite case of Szabó's Conj. A"),
     V('part', 'Lean: the unital comparison-to-$\\mathcal Z$ step and uniform property $\\Gamma$. Not (b) or (c)'),
     [R('291', 'known_before', 'Castillejos-Evington-Tikuisis-White-Winter (Invent. Math. 2021)')])

# ---------------------------------------------------------------- 292
spec('292', OA, 'counterexample', "Kirchberg's $\\mathcal O_2$ embedding problem",
     "Kirchberg's $\\mathcal O_2$ ultrapower embedding problem",
     'Claim: a separable unital C*-algebra that embeds in no ultrapower $\\mathcal O_2^\\omega$, nor any nuclear ultrapower',
     {'dur': 8.4, 'primitive': 'shape',
      'shapes': [{'kind': 'circle', 'r': 1.15, 'tone': 'soft', 'label': 'separable C*-algebras', 'labelAt': [1.75, 0.95], 'at': 0.3},
                 {'kind': 'circle', 'r': 0.78, 'c': [-0.28, -0.05], 'tone': 'cool', 'label': 'embed in $\\mathcal O_2^\\omega$', 'labelAt': [-0.28, 0.45], 'at': 1.0},
                 {'kind': 'circle', 'r': 0.34, 'c': [-0.42, -0.3], 'tone': 'accent', 'label': 'exact', 'labelAt': [-0.42, -0.3], 'at': 1.8}],
      'points': [{'p': [0.75, -0.25], 'label': '$C^*(G)$', 'at': 5.6, 'tone': 'hot'}],
      'beats': [B(0.2, 'Kirchberg–Phillips: every separable exact C*-algebra embeds in $\\mathcal O_2$'),
                B(3.0, 'Kirchberg asked: does every separable C*-algebra embed in the ultrapower $\\mathcal O_2^\\omega$?'),
                B(5.6, 'Claim: no. $C^*(G)$ for one explicit group embeds in no nuclear ultrapower')]},
     status("Kirchberg's embedding problem",
            ['A \\hookrightarrow \\mathcal O_2^\\omega \\text{ for every separable } A\\,?'],
            'Counterexample: $C^*(G)$ for $G = \\mathbb Z[\\tfrac{1}{2}]^3 \\rtimes (\\mathrm{SL}_3(\\mathbb Z) \\times \\mathbb Z)$', 'counterexample',
            'No unital embedding into $B^\\omega$ for any nonzero unital nuclear $B$'),
     V('main', 'The non-embedding theorem is in Lean; the paper is 14 pages'),
     [R('292', 'caveats', 'Only 14 pages and Lean-checked')])

# ---------------------------------------------------------------- 293
spec('293', OA, 'counterexample', 'No hyperinvariant subspace',
     'An operator with no hyperinvariant subspace',
     'Claim: a nonzero quasinilpotent operator whose commutant is a proper, closed, transitive algebra',
     {'dur': 8.2, 'primitive': 'graph', 'preset': 'complete', 'n': 7, 'edgeAt': 0.6, 'edgeDur': 3.6,
      'beats': [B(0.2, 'Schematic: operators commuting with $T$ move any nonzero vector near any other'),
                B(3.0, 'So no closed subspace besides $0$ and $H$ is preserved by the whole commutant'),
                B(5.6, 'Claim: such a $T$ exists, nonzero and quasinilpotent, on every separable $H$')]},
     status('Hyperinvariant subspace and transitive algebra problems',
            ['\\exists\\, T \\ne 0 \\text{ quasinilpotent with no hyperinvariant subspace}'],
            'Before: Lomonosov (1973) when $T$ commutes with a nonzero compact; Banach-space examples only', 'counterexample',
            'Does not settle the invariant subspace problem itself'),
     V('main', '$T \\ne 0$, quasinilpotent, with a transitive, proper, SOT-closed commutant'),
     [R('293', 'known_before', 'Lomonosov (1973)'),
      R('293', 'caveats', 'Does NOT resolve the invariant subspace problem itself')])

# ---------------------------------------------------------------- 294
spec('294', OA, 'counterexample', "Kaplansky's quasitraces are not traces",
     "Kaplansky's quasitraces are not traces",
     'Claim: a separable unital C*-algebra with 2-quasitraces but no tracial state',
     {'dur': 8.2, 'primitive': 'equation', 'mode': 'stack',
      'lines': [{'tex': '\\tau(a+b) = \\tau(a) + \\tau(b) \\quad \\text{if } ab = ba', 'tone': 'soft', 'at': 0.4, 'size': 38},
                {'tex': '\\text{trace: additive for all } a, b', 'tone': 'soft', 'at': 2.8, 'size': 38},
                {'tex': '\\lvert \\tau(a+b) - \\tau(a) - \\tau(b) \\rvert \\ge \\tfrac{1}{144}', 'tone': 'accent', 'at': 5.4, 'size': 42}],
      'beats': [B(0.2, 'A 2-quasitrace is additive only on commuting elements'),
                B(2.7, 'Kaplansky asked whether every quasitrace is in fact a trace'),
                B(5.3, 'Claim: an algebra where every quasitrace misses additivity by at least $1/144$')]},
     status("Kaplansky's quasitrace question",
            ['\\text{every 2-quasitrace on a C*-algebra is a trace}'],
            'Before: yes for exact algebras (Haagerup, circulated 1991); this algebra is non-exact', 'counterexample',
            'Also: two stably finite algebras with a properly infinite tensor product'),
     V('main', 'Both statements, with the $1/144$ in the statement itself'),
     [R('294', 'claim', 'every quasitrace misses additivity by >= 1/144'),
      R('294', 'known_before', 'circulated 1991'),
      A("Kaplansky's quasitraces are not traces", 'with the $1/144$ in the statement itself')])

# ---------------------------------------------------------------- 295
spec('295', OA, 'proof', 'The Kadison–Ringrose conjecture',
     'The Kadison–Ringrose cohomology conjecture',
     'Claim: every bounded Hochschild cocycle of a von Neumann algebra is a coboundary in every degree $k \\ge 2$',
     {'dur': 8.0, 'primitive': 'grid', 'rows': 1, 'cols': 6, 'stagger': 0.12,
      'values': [['$H^1$', '$H^2$', '$H^3$', '$H^4$', '$H^5$', '$H^6$']],
      'cells': [[0, 0, 'soft'], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
      'blocks': [{'r': 0, 'c': 0, 'h': 1, 'w': 1, 'label': 'Kadison–Sakai', 'tone': 'soft', 'at': 1.4},
                 {'r': 0, 'c': 1, 'h': 1, 'w': 5, 'label': 'claimed: all vanish', 'at': 5.4}],
      'caption': '$H^k(M, M)$: bounded Hochschild cohomology, any von Neumann algebra $M$',
      'beats': [B(0.2, 'Bounded Hochschild cohomology of a von Neumann algebra, coefficients in itself'),
                B(2.8, 'Degree one vanishes: every derivation is inner (Kadison–Sakai)'),
                B(5.4, 'Claim: every degree $k \\ge 2$ vanishes too, with no separability or type hypothesis')]},
     status('Kadison–Ringrose conjecture (1971)',
            ['H^k(M, M) = 0 \\quad \\text{for every } k \\ge 2'],
            'Before: hyperfinite (1972), types I, II$_\\infty$, III and McDuff (1987), property $\\Gamma$ (2003)', 'proved',
            '$L(\\mathbb F_2)$-type factors were the gap; linked to family 288'),
     V('main', 'Vanishing in every degree $\\ge 2$ for any W*-algebra; degree one is outside the statement'),
     [R('295', 'known_before', 'Kadison-Ringrose (1971) conjectured'),
      R('295', 'known_before', 'Johnson-Kadison-Ringrose (1972)'),
      R('295', 'known_before', 'Christensen-Effros-Sinclair (Invent. Math. 1987)'),
      R('295', 'known_before', '(Ann. Math. 2003)'),
      R('295', 'caveats', "288's uniform derivation estimate")])

# ---------------------------------------------------------------- 296
spec('296', OA, 'proof', 'The generator problem',
     'The generator problem for finite factors',
     'Claim: every II$_1$ factor with separable predual is generated by a single operator',
     {'dur': 8.2, 'primitive': 'equation', 'mode': 'stack',
      'lines': [{'tex': 'P \\subset M \\ \\text{irreducible, hyperfinite (Popa)}', 'tone': 'soft', 'at': 0.4, 'size': 36},
                {'tex': 'M = W^*(P, u) \\ \\text{for generic unitaries } u', 'tone': 'ink', 'at': 3.0, 'size': 36},
                {'tex': 'P = W^*(a) \\Rightarrow M = W^*(a, u) = W^*(x)', 'tone': 'accent', 'at': 5.6, 'size': 38}],
      'beats': [B(0.2, 'Start from an irreducible hyperfinite subfactor $P$ of a II$_1$ factor $M$'),
                B(2.9, 'Claim: a generic unitary $u$ together with $P$ generates all of $M$'),
                B(5.5, '$P$ is singly generated, and two generators combine into one')]},
     status("Kadison's generator problem (1967)",
            ['M = W^*(x) \\text{ for every II}_1 \\text{ factor with separable predual}'],
            'Before: type I, properly infinite, Cartan, property $\\Gamma$ and many more; $L(\\mathbb F_n)$ open', 'proved',
            'With the direct-integral reduction: every separable von Neumann algebra'),
     V('main', 'Single generation and the relative dense-$G_\\delta$ statement are both in Lean',
       'We checked it does not use family 287; we did not build the Lean'),
     [R('296', 'known_before', "Kadison's generator problem (1967 Baton Rouge problem list)"),
      A('The generator problem', 'I checked whether it quietly uses family 287; it does not.')])

# ---------------------------------------------------------------- 297
spec('297', OA, 'counterexample', "Naimark's problem in ZFC",
     "A ZFC counterexample to Naimark's problem",
     'Claim: in ZFC, a simple non-elementary C*-algebra whose irreducible representations are all equivalent',
     {'dur': 8.4, 'primitive': 'venn',
      'sets': [{'label': 'one irreducible representation'}, {'label': 'elementary: $K(H)$'}],
      'regions': [{'set': 'A&B', 'label': 'separable: same', 'at': 2.6}, {'set': 'A&!B', 'label': 'new example', 'x': 0.33, 'y': 0.5, 'at': 5.4}],
      'beats': [B(0.2, 'Algebras with one irreducible representation, and the elementary ones $K(H)$'),
                B(2.8, 'Separable: they coincide (Rosenberg 1953). Assuming $\\diamondsuit$ they differ (2004)'),
                B(5.6, 'Claim: in plain ZFC, a simple nonseparable example with a faithful trace')]},
     status("Naimark's problem (1948)",
            ['\\text{unique irreducible representation} \\Rightarrow A \\cong K(H)'],
            'Before: true for separable algebras (Rosenberg 1953); false assuming $\\diamondsuit$ (Akemann–Weaver 2004)', 'counterexample',
            "Not first: Tanaka's ZFC example appeared two days earlier"),
     V('main', 'The ZFC counterexample, over Hilbert spaces in arbitrary universes'),
     [R('297', 'known_before', 'Naimark (1948/1951)'), R('297', 'known_before', 'Rosenberg (1953)'),
      R('297', 'known_before', 'Akemann-Weaver (PNAS 2004)'),
      R('297', 'known_before', 'two days before this manuscript')])

# ---------------------------------------------------------------- 298
spec('298', OA, 'counterexample', 'Two free entropies differ',
     'Two notions of free entropy differ, even when finite',
     "Claim: a tuple $X$ with $-\\infty < \\chi(X) \\le \\chi^*(X) - \\tfrac{1}{2} < \\infty$",
     {'dur': 8.2, 'primitive': 'numberline', 'min': 0, 'max': 3, 'y': 0.62,
      'axisLabel': 'free entropy of one bounded tuple $X$ (positions schematic)',
      'markers': [{'v': 1, 'label': '$\\chi(X)$', 'note': 'microstates', 'at': 0.5, 'tone': 'cool'},
                  {'v': 2, 'label': '$\\chi^*(X)$', 'note': 'free Fisher information', 'at': 0.9, 'tone': 'cool'}],
      'ranges': [{'from': 1, 'to': 2, 'label': 'claimed gap $\\ge 1/2$', 'tone': 'claim', 'side': 'below', 'at': 3.0}],
      'beats': [B(0.2, 'Two free entropies for a tuple of operators, with $\\chi \\le \\chi^*$ (2003)'),
                B(2.9, 'Voiculescu asked whether they agree; equality was known in one variable'),
                B(5.6, 'Claim: a tuple where both are finite and $\\chi \\le \\chi^* - \\tfrac{1}{2}$')]},
     status('Voiculescu: do the two free entropies agree?',
            ['\\chi(X) = \\chi^*(X) \\text{ whenever both are finite}'],
            'Before: $\\chi \\le \\chi^*$ (Biane–Capitaine–Guionnet 2003); equality in one variable', 'counterexample',
            'Large but fixed number of variables; norm cutoff, limsup normalization'),
     V('main', 'The separation, with microstates free entropy itself defined in Lean'),
     [R('298', 'known_before', 'Biane-Capitaine-Guionnet (Invent. Math. 2003) proved chi <= chi*'),
      R('298', 'claim', '-infinity < chi(X) <= chi*(X) - 1/2 < infinity')])

# ---------------------------------------------------------------- 299
spec('299', OA, 'proof', 'The Kirchberg–Rørdam character criterion',
     'The Kirchberg–Rørdam character criterion',
     'Claim: a unital separable C*-algebra is $\\mathcal Z$-stable exactly when its central sequence algebra has no characters',
     {'dur': 8.0, 'primitive': 'equation', 'mode': 'stack',
      'lines': [{'tex': 'A \\otimes \\mathcal Z \\cong A', 'tone': 'ink', 'at': 0.4, 'size': 44},
                {'tex': '\\Updownarrow', 'tone': 'accent', 'at': 2.8, 'size': 40},
                {'tex': 'A_\\omega \\cap A\' \\ \\text{has no characters}', 'tone': 'accent', 'at': 3.2, 'size': 44}],
      'beats': [B(0.2, 'Jiang–Su stability: the regularity behind the classification of C*-algebras'),
                B(2.8, 'Claim: it holds exactly when the central sequence algebra has no characters'),
                B(5.4, 'For every nonzero unital separable C*-algebra: no nuclearity or trace hypothesis')]},
     status('Kirchberg–Rørdam question (2015)',
            ['A \\cong A \\otimes \\mathcal Z \\iff A_\\omega \\cap A\' \\text{ has no characters}'],
            'Before: partial results under extra hypotheses; Dadarlat–Toms asked about tensor powers (2009)', 'proved',
            'Also: infinite tensor powers without characters absorb $\\mathcal Z$'),
     V('main', 'The character criterion, for every free ultrafilter; the tensor-power result is not listed'),
     [R('299', 'known_before', 'Kirchberg-Rordam (Int. J. Math. 2015, arXiv:1409.1395)'),
      R('299', 'known_before', 'Dadarlat-Toms (Adv. Math. 2009)')])

# ---------------------------------------------------------------- 300
pc = [[r, c] for (a, n) in ((0, 3), (3, 2), (5, 3)) for r in range(a, a + n) for c in range(a, a + n)]
spec('300', OA, 'proof', 'Paving over any masa',
     'Approximation and quadratic strong-operator paving',
     'Claim: self-adjoint elements pave over any masa with at most $5 \\times 10^8\\,\\varepsilon^{-2}$ projections',
     {'dur': 8.2, 'primitive': 'grid', 'rows': 8, 'cols': 8, 'cells': pc, 'stagger': 0.03,
      'blocks': [{'r': 0, 'c': 0, 'h': 3, 'w': 3, 'label': '$P_1$', 'at': 1.4}, {'r': 3, 'c': 3, 'h': 2, 'w': 2, 'label': '$P_2$', 'at': 1.8},
                 {'r': 5, 'c': 5, 'h': 3, 'w': 3, 'label': '$P_3$', 'at': 2.2}],
      'caption': 'cut by projections $P_i$ from the masa (schematic)',
      'beats': [B(0.2, 'An operator, cut into blocks by projections from a maximal abelian subalgebra'),
                B(2.9, 'Paving: on each block the operator is within $\\varepsilon$ of the masa'),
                B(5.6, 'Claim: $5 \\times 10^8\\,\\varepsilon^{-2}$ projections suffice, over any masa in any algebra')]},
     status('Popa–Vaes paving conjectures',
            ['\\#\\{P_i\\} \\le 5 \\times 10^{8}\\, \\varepsilon^{-2}'],
            'Before: paving for the diagonal of $B(\\ell^2)$ via Kadison–Singer (Marcus–Spielman–Srivastava 2015)', 'proved',
            'Strong-operator paving; the constants are explicit but huge'),
     V('none', 'No formalization; manuscript only'),
     [R('300', 'claim', 'at most 5x10^8 eps^-2 projections'),
      R('300', 'known_before', '(solved by Marcus-Spielman-Srivastava, Ann. Math. 2015)'),
      R('300', 'caveats', 'constants explicit but huge')])

# ---------------------------------------------------------------- 301
spec('301', OA, 'proof', 'Trace cones classify $\\mathcal W$-stabilizations',
     'The trace cone classifies Razak–Jacelon stabilizations',
     'Claim: separable nuclear $A \\otimes \\mathcal W \\otimes \\mathcal K$ are classified by their cones of tracial weights',
     {'dur': 8.2, 'primitive': 'shape',
      'shapes': [{'kind': 'polygon', 'points': [[-1.3, -0.9], [-2.25, 0.85], [-0.35, 0.85]], 'tone': 'accent', 'label': '$T(A)$', 'labelAt': [-1.3, 0.35], 'at': 0.3},
                 {'kind': 'polygon', 'points': [[1.3, -0.9], [0.45, 0.85], [2.15, 0.85]], 'tone': 'cool', 'label': '$T(B)$', 'labelAt': [1.3, 0.35], 'at': 1.2}],
      'beats': [B(0.2, 'Schematic: cones of tracial weights, the invariant left after stabilizing'),
                B(2.9, 'Tensoring with the Razak–Jacelon algebra $\\mathcal W$ kills all K-theory'),
                B(5.6, 'Claim: matching cones means isomorphic algebras, and every cone map is realized')]},
     status("Robert's question on trace cones",
            ['A \\otimes \\mathcal W \\otimes \\mathcal K \\cong B \\otimes \\mathcal W \\otimes \\mathcal K \\iff T(A) \\cong T(B)'],
            'Before: simple cases (Robert; Castillejos–Evington) and simple stably projectionless classification', 'proved',
            'Separable nuclear algebras with any ideal structure'),
     V('none', 'No formalization; manuscript only'),
     [R('301', 'claim', 'classified by their topological cone of extended lower-semicontinuous tracial weights'),
      R('301', 'caveats', 'specialist classification result')])

# ---------------------------------------------------------------- 302
spec('302', OA, 'proof', 'Radius of comparison is half mean dimension',
     'Radius of comparison equals half the mean dimension',
     'Claim: for every minimal homeomorphism, $\\mathrm{rc}(C(X) \\rtimes_h \\mathbb Z) = \\tfrac{1}{2}\\,\\mathrm{mdim}(X, h)$',
     {'dur': 8.2, 'primitive': 'plot', 'x': [0, 4], 'y': [0, 2.4], 'labelRoom': 200,
      'xlabel': 'mean dimension $\\mathrm{mdim}(X, h)$', 'ylabel': 'radius of comparison',
      'xticks': [0, 1, 2, 3, 4], 'yticks': [0, 1, 2],
      'curves': [{'f': 'x/2', 'label': '$\\mathrm{rc} = \\tfrac{1}{2}\\,\\mathrm{mdim}$', 'tone': 'accent', 'at': 3.0, 'dur': 1.8}],
      'points': [{'x': 0, 'y': 0, 'label': 'mdim 0: $\\mathcal Z$-stable (2017)', 'at': 1.0}],
      'beats': [B(0.2, 'A minimal dynamical system $(X, h)$ and its crossed-product C*-algebra'),
                B(2.8, 'Claim: the radius of comparison is exactly half the mean dimension'),
                B(5.4, 'for every minimal $\\mathbb Z$-system, infinite values included')]},
     status('Phillips–Toms conjecture',
            ['\\mathrm{rc}(C(X) \\rtimes_h \\mathbb Z) = \\tfrac{1}{2}\\, \\mathrm{mdim}(X, h)'],
            'Before: mean dimension zero (Elliott–Niu 2017), upper bounds (Niu), lower bounds (2022)', 'proved',
            'Key input: a vanishing theorem in complex cobordism, an unusual route'),
     V('none', 'No formalization; needs homotopy theorists as well as operator algebraists'),
     [R('302', 'known_before', 'Elliott-Niu (Duke 2017, arXiv:1406.2382) mdim 0 => Z-stable'),
      R('302', 'known_before', 'Hirshberg-Phillips (Adv. Math. 2022, arXiv:2009.13045) lower bounds')])

# ---------------------------------------------------------------- 303
spec('303', OA, 'proof', 'Weak pure infiniteness is strong',
     'Weak pure infiniteness and $\\mathcal O_\\infty$ absorption',
     'Claim: if every positive element is properly infinite, the C*-algebra is strongly purely infinite',
     {'dur': 8.2, 'primitive': 'shape',
      'shapes': [{'kind': 'circle', 'r': 0.85, 'c': [-0.8, 0], 'tone': 'cool', 'label': 'purely infinite', 'labelAt': [-0.8, 1.12], 'at': 0.3,
                  'morph': {'kind': 'circle', 'r': 0.85, 'c': [0, 0], 'at': 3.2, 'dur': 1.8}},
                 {'kind': 'circle', 'r': 0.85, 'c': [0.8, 0], 'tone': 'accent', 'label': 'strongly purely infinite', 'labelAt': [0.8, -1.12], 'at': 1.0,
                  'morph': {'kind': 'circle', 'r': 0.85, 'c': [0, 0], 'at': 3.2, 'dur': 1.8}}],
      'beats': [B(0.2, "Kirchberg and Rørdam's notions of pure infiniteness for non-simple C*-algebras"),
                B(3.0, 'Claim: if every positive element is properly infinite, they coincide'),
                B(5.6, 'So separable nuclear algebras of this kind absorb $\\mathcal O_\\infty$')]},
     status('Kirchberg–Rørdam: is pure infiniteness strong?',
            ['\\text{every } a \\ge 0 \\text{ properly infinite} \\Rightarrow A \\text{ strongly purely infinite}'],
            'Before: special cases, e.g. Hausdorff primitive spectrum (Blanchard–Kirchberg 2004)', 'proved',
            'No exactness, unitality or simplicity needed; the weak version needs exactness'),
     V('main', 'Both formal statements: individual strong infiniteness and the exact case'),
     [R('303', 'known_before', '(Hausdorff primitive spectrum, JFA 2004)'),
      R('303', 'lean', 'ExactInfiniteness.lean and IndividualStrongInfiniteness.lean')])

# ================================================================ enrichment pass
# plain line, proof idea (archetype + 2-4 plain steps), narration, and the equation
# visualiser for the equation-only reels. Proof ideas come from the review's
# explainer/claim, the article, or the paper's own proof-strategy section; where
# none of those states an idea honestly in plain words, the proof scene is omitted.
OBJ_WITH_PROOF = 6.0
TIME_KEYS = {'at', 'dur', 'edgeAt', 'edgeDur', 'sweepAt', 'sweep', 'until'}

def _retime(o, f, panel=False):
    if isinstance(o, list):
        for x in o: _retime(x, f)
    elif isinstance(o, dict):
        for k, v in list(o.items()):
            if isinstance(v, (int, float)) and not isinstance(v, bool) and (k in TIME_KEYS or (k == 'from' and panel)):
                o[k] = round(v * f, 2)
            elif isinstance(v, (dict, list)):
                _retime(v, f, panel=(k == 'panels'))
    return o

def _retime_panels(obj, f):
    for k, v in list(obj.items()):
        if k == 'dur': continue
        if k == 'panels':
            for p in v:
                for kk, vv in list(p.items()):
                    if kk in ('from', 'until') and isinstance(vv, (int, float)): p[kk] = round(vv * f, 2)
                _retime(p, f)
        elif isinstance(v, (int, float)) and not isinstance(v, bool) and k in TIME_KEYS:
            obj[k] = round(v * f, 2)
        elif isinstance(v, (dict, list)):
            _retime(v, f)

def PF(arch, steps, **data): return {'archetype': arch, 'steps': steps, 'data': data}
def _pack(t, lim=96):
    # one caption line holds at most 96 characters: split at sentence ends, packed greedily
    out = []
    for p in re.split(r'(?<=[.?!;:])\s+', t):
        if out and len(out[-1]) + 1 + len(p) <= lim: out[-1] += ' ' + p
        else: out.append(p)
    return out
def VO(*lines):
    names = ['title', 'object', 'proof', 'achievement', 'verify'] if len(lines) == 5 else ['title', 'object', 'achievement', 'verify']
    return [{'scene': s, 'text': p} for s, t in zip(names, lines) for p in _pack(t)]

EN = {}
EN['260'] = dict(
    plain="A black hole must be heavy enough for its size: its mass can't fall below what its enclosing area demands",
    proof=PF('reduction', ["Reshape the data so it looks like a moment frozen in time",
                           "There, mass and enclosing area can be controlled together",
                           "Compare every enclosing surface back to the original data"],
             boxes=['moving data, trapped surface', 'a frozen-in-time comparison', 'mass against enclosing area'], arrow='becomes'),
    voice=VO("Black holes, mass and area.",
             "Mass against smallest enclosing area: a Schwarzschild black hole sits exactly on this curve.",
             "Reshape the data to look frozen in time, then compare every enclosing surface back.",
             "Claimed: nothing falls below it, in every dimension.",
             "Lean checks part."))
EN['261'] = dict(
    plain="An electron in a messy crystal: in 3D it can still roam freely, in a flat 2D crystal it always gets stuck",
    proof=PF('local-to-global', ["Study the random lattice block by block, at growing scales",
                                 "Flag uncertain sites and retry them with fresh randomness",
                                 "Keep their effect small, so waves still spread in 3D",
                                 "In 2D, a separate uniform estimate traps every state"],
             cols=3, rows=2, patchLabel='a block of sites', label='scale by scale'),
    voice=VO("Roaming or trapped electrons?",
             "In three dimensions weak disorder leaves waves spread out; in two, any disorder traps them.",
             "Check the lattice block by block, retry uncertain sites, and keep their effect small.",
             "Claimed: both halves of Anderson's picture.",
             "Lean checks part."))
EN['262'] = dict(
    plain="Bounds how much energy a dip can trap; the worst case turns out to be a dip holding a single level",
    proof=PF('reduction', ["Reduce all the trapped levels to one inequality on an interval",
                           "Its key step compares matrices one simple change at a time",
                           "A continuation argument carries it across the whole range"],
             boxes=['every bound state', 'one finite-interval inequality', 'rank-one comparison'], arrow='reduces to'),
    voice=VO("The sharp Lieb–Thirring constant.",
             "This well traps exactly one level. Such wells should be the worst case.",
             "Turn all levels into one interval inequality, then prove it piece by piece.",
             "Claimed: sharp across the whole open range.",
             "Lean-checked, scalar case."))
EN['263'] = dict(
    plain="How many extra electrons can an atom hold? Experiments say one or two; this claims at most a fixed number",
    proof=PF('reduction', ["Look at the outer electrons from beyond a fixed radius",
                           "There they see an almost neutral system: charges screen out",
                           "A neutral system holds few extras: a constant per nucleus"],
             boxes=['how many extra electrons?', 'what the outer electrons see', 'almost neutral: a constant cap'], arrow='screening'),
    voice=VO("How many electrons fit?",
             "Proven bounds allowed about twice the charge. Experiments suggest just one or two extra.",
             "Far out, the outer electrons see an almost neutral atom, capping the excess.",
             "Claimed: at most a constant extra per nucleus.",
             "Lean checks part."))
EN['264'] = dict(
    plain="Can spacetime be continued past the inside of a black hole? For typical ones, not smoothly enough to matter",
    proof=PF('contradiction', ["Suppose the interior could be continued smoothly enough",
                               "Then tiny loops force one curvature measure to be small",
                               "A late gravitational wave makes it large: typical data can't"],
             assume='a smooth-enough extension', smaller='tiny loops: curvature small', impossible='a late wave: curvature large'),
    voice=VO("Strong cosmic censorship near Kerr.",
             "Continuous extensions past the horizon exist. The question is whether smoother ones do.",
             "If one existed, tiny loops force curvature small; a late wave makes it large.",
             "Claimed: typical nearby data allow none.",
             "No Lean check."))
EN['265'] = dict(
    plain="Entanglement in a calm 2D quantum material grows with a region's fence, not its field: border, not area",
    proof=PF('construction', ["Use only the energy gap to build approximate ground-state filters",
                              "Organize them layer by layer across the square lattice",
                              "Turn them into an entanglement bound set by the boundary"],
             pieces=[{'label': 'energy gap', 'role': 'the only input'},
                     {'label': 'approximate filters', 'role': 'built layer by layer'},
                     {'label': 'entropy bound', 'role': 'counts boundary edges'}], result='the area law'),
    voice=VO("An area law in two dimensions.",
             "Entanglement of a region: does it grow with its area, or only with its boundary?",
             "From the gap alone, build ground-state filters layer by layer and bound entanglement.",
             "Claimed: the boundary wins, for any region.",
             "No Lean check."))
EN['266'] = dict(
    plain="Ways to measure a 6-level quantum system that tell you nothing about each other: the claim is only three exist",
    proof=PF('local-to-global', ["Cover every candidate vector with small balls of phases",
                                 "Certify which pairs of balls could be orthogonal or unbiased",
                                 "Search all patterns by computer: two more bases never fit"],
             cols=3, rows=2, patchLabel='a ball of phases', label='an exhaustive computer search'),
    voice=VO("Unbiased bases in dimension six.",
             "Two more bases would need this pattern: two cliques, every cross pair unbiased.",
             "Cover all candidates with tiny balls, rule out pairs, then search every remaining pattern.",
             "Claimed: exactly three, by computer search.",
             "Lean checks part."))
EN['267'] = dict(
    plain="Cool a gas and many atoms pile into one shared state; this claims it happens for real, colliding atoms",
    proof=PF('probabilistic', ["Picture the gas as random loops of particle paths",
                               "Bound how often the loops run into each other",
                               "So long loops hold a fixed share: the gas condenses"],
             samples=60, threshold=0.55, mean=0.68, thresholdLabel='a positive fraction', label='share in long loops'),
    voice=VO("Condensation in an interacting gas.",
             "Dilute colliding hard spheres: what fraction of the particles shares a single quantum state?",
             "Write the gas as random loops; long loops carry a fixed share.",
             "Claimed: condensation at a fixed positive temperature.",
             "Lean checks part."))
EN['268'] = dict(
    plain="A chain of tiny magnets needs a minimum energy kick to stir: predicted in 1981, claimed proved here",
    proof=PF('induction', ["Write one sum two ways: by energies and along the chain",
                           "Doubling length and inverse temperature sharpens both",
                           "Two computer-checked starts carry it to every even length"],
             levels=4, labels=['certificate', '$2L$', '$4L$', '$\\cdots$'], step='double length and $\\beta$ together'),
    voice=VO("The spin-one Haldane gap.",
             "Numerics put the gap near point four one; the proven bound is far smaller.",
             "Computer certificates start it; doubling length and coldness together carries it everywhere.",
             "Claimed: the gap stays open for long chains.",
             "No Lean check."))
EN['269'] = dict(
    plain="Electrons in a strong magnetic field form a stiff quantum fluid; this claims its energy gap never closes",
    proof=PF('reduction', ["Turn the gap question into one operator inequality",
                           "Prove it piece by piece, splitting states by particles and holes",
                           "It holds at every size, so the gap never closes"],
             boxes=['a gap above Laughlin', '$H^2 \\ge \\gamma H$', 'split: flux, particles, holes'], arrow='follows from'),
    voice=VO("The Laughlin gap stays open.",
             "The Laughlin state has zero energy. Every other state sits above a gap.",
             "One operator inequality gives the gap, proved by splitting particles and holes.",
             "Claimed: at least one twenty-fifth, for all sizes.",
             "Lean checks part."))
EN['270'] = dict(
    plain="In matrix theory a graviton is a state sitting exactly at zero energy; this claims there is exactly one",
    proof=PF('reduction', ["Add a mass term, where an index can count the states",
                           "Control what happens as particles cluster or separate",
                           "Remove the mass carefully: exactly one state survives"],
             boxes=['count zero-energy states', 'with mass: an index', 'mass to zero: exactly one'], arrow='deform'),
    voice=VO("The matrix theory bound state.",
             "The spectrum is a continuum from zero. Does a true state sit exactly there?",
             "Add a mass and count states by an index, then remove the mass carefully.",
             "Claimed: exactly one, for every N.",
             "No Lean check."))
EN['271'] = dict(
    plain="Why is iron magnetic? This claims the textbook quantum model of a magnet really lines its spins up when cold",
    proof=PF('probabilistic', ["Write the magnet as random loops of swapped spins",
                               "Pin every spin on the boundary pointing up",
                               "Interior loops almost always reach a pin, so spins lean up"],
             samples=60, threshold=0.5, mean=0.66, thresholdLabel='half up', label='chance an inside spin is up'),
    voice=VO("Why magnets stay magnetic.",
             "Magnetization falls as it warms. Does order survive at low temperature in three dimensions?",
             "Write spins as random loops and pin the boundary up; most loops reach it.",
             "Claimed: at least a quarter of full magnetization.",
             "Lean checks part."))
EN['272'] = dict(
    plain="A noisy quantum channel used twice was believed to wipe out all entanglement; here is one that doesn't",
    proof=PF('counterexample', ["The conjecture: a PPT channel applied twice kills entanglement",
                                "It held in small dimensions; build one explicit larger channel",
                                "Applied twice, it still leaves entanglement: the conjecture fails"],
             items=6, breakAt=5, label='entanglement survives', caption='small cases hold, then the explicit channel'),
    voice=VO("A favourite quantum conjecture falls.",
             "Pass a state through this noisy channel twice. The conjecture said all entanglement is gone.",
             "It held in small dimensions; this explicit channel on twenty-one levels breaks it.",
             "Claimed: entanglement survives two passes.",
             "Lean checks part."))
EN['273'] = dict(
    plain="Mix two light beams on a half-mirror: the output can't be more orderly than mixing plain thermal light",
    proof=PF('contradiction', ["Suppose two beams mixed to less entropy than thermal light",
                               "Compare them with thermal light at the same entropies",
                               "That forces a negative minimum, which the analysis rules out"],
             assume='a pair beating thermal light', smaller='a negative minimum of three entropies', impossible='ruled out'),
    voice=VO("Mixing light can't beat thermal.",
             "Two independent beams meet on a beam splitter. How much entropy must come out?",
             "Suppose some pair beat thermal light; comparing with thermal references forces a contradiction.",
             "Claimed: never less than thermal light.",
             "Lean-checked main theorem."))
EN['274'] = dict(
    plain="Shallow quantum circuits can't tell whether a string has an odd or even number of ones, however wide",
    proof=PF('induction', ["Cut the circuit into its fixed number of layers",
                           "Layer by layer, a projection estimate keeps influence local",
                           "The output's link to parity fades as the input grows"],
             levels=4, labels=['inputs', 'layer 1', 'layer 2', '$\\cdots$'], step='influence stays local'),
    voice=VO("Parity beats shallow quantum circuits.",
             "Constant depth, polynomially many qubits, one measured output. Shallow classical circuits already fail.",
             "Go layer by layer, keeping influence local; the output's link to parity fades.",
             "Claimed: no fixed advantage, for large inputs.",
             "Lean-checked main theorem."))
EN['275'] = dict(
    plain="Finding a molecule's lowest energy is as hard as any problem a quantum computer can check, in the worst case",
    proof=PF('reduction', ["Start from a problem known to be hard even for quantum computers",
                           "Encode it in a careful arrangement of atomic nuclei",
                           "The molecule's lowest energy now answers the hard problem"],
             boxes=['a hard quantum problem', 'an arrangement of nuclei', "the molecule's lowest energy"], arrow='encode'),
    voice=VO("Molecules are hard, in principle.",
             "Only electrons, fixed nuclei and Coulomb forces. Estimating the lowest energy becomes the problem.",
             "Encode a known hard quantum problem in where nuclei sit; the energy answers it.",
             "Claimed: as hard as quantum verification.",
             "Lean-checked main theorem."))
EN['276'] = dict(
    plain="How much information can a qubit cooling in a warm room carry? Tangling the inputs together doesn't help",
    proof=PF('reduction', ["The answer is simple if entangled inputs never help",
                           "That comes down to one entropy inequality for block matrices",
                           "Prove it, and the one-use formula is the true capacity"],
             boxes=['entangled inputs never help', 'an entropy inequality', 'capacity = one-use value'], arrow='reduces to'),
    voice=VO("Capacity of a cooling qubit.",
             "This noisy channel squeezes the ball of qubit states toward a warm fixed point.",
             "Entangling many inputs never helps, thanks to one entropy inequality for block matrices.",
             "Claimed: capacity equals the one-shot formula.",
             "Lean-checked main theorem."))
EN['277'] = dict(
    plain="Two players cheat with shared quantum links; play many rounds at once and big winning streaks become rare",
    proof=PF('probabilistic', ["Play many copies of the game at the same time",
                               "A known conditioning estimate controls rounds one at a time",
                               "So wins concentrate: beating the value is exponentially rare"],
             samples=60, threshold=0.72, mean=0.55, thresholdLabel='value plus a margin', label='fraction of rounds won'),
    voice=VO("Repeating games with entangled players.",
             "Entangled players play many copies at once: how often do they beat the value?",
             "A known conditioning estimate, applied round by round, makes the number of wins concentrate.",
             "Claimed: exponentially unlikely, for every finite game.",
             "Lean: weaker rate."))
EN['278'] = dict(
    plain="Chemistry software assumes any electron cloud can be copied by simpler, non-interacting electrons. Not always",
    proof=PF('counterexample', ["The theory assumes every density comes from simpler electrons",
                                "Build a molecule: three electrons, two equal nuclei",
                                "Its density matches no such system: the assumption fails"],
             items=5, breakAt=4, label='no potential works', caption='densities simpler electrons can reproduce'),
    voice=VO("A crack under chemistry software.",
             "Three electrons, two equal nuclei. Can independent electrons in some potential reproduce its density?",
             "Build this exact molecule; no potential makes simpler electrons match its density.",
             "Claimed: this density cannot be reproduced.",
             "No Lean check."))
EN['279'] = dict(
    plain="Shor's quantum factoring works with high probability; this version always succeeds, with a fixed set of gates",
    proof=PF('reduction', ["Factoring reduces to finding the order of a number, as in Shor",
                           "Make each order trial succeed with chance exactly one quarter",
                           "One exact amplification step turns that quarter into certainty"],
             boxes=['factor $N$', 'find an order', 'chance: one quarter', 'chance: certain'], arrow='then'),
    object={'primitive': 'equation', 'mode': 'stack',
            'lines': [{'tex': '\\Pr[\\text{Shor finds the factors}] \\ge \\term{e}{1 - \\varepsilon}', 'tone': 'soft', 'at': 0.3, 'size': 40, 'y': 0.08,
                       'terms': {'e': {'label': 'high, not certain', 'tone': 'warn', 'at': 0.8,
                                       'visual': {'kind': 'bar', 'v': 0.85, 'max': 1, 'dx': 0, 'w': 170, 'h': 40}}}},
                      {'tex': '\\Pr[\\text{output} = \\text{full factorization of } N] = \\term{one}{1}', 'tone': 'accent', 'at': 2.4, 'size': 40, 'y': 0.6,
                       'terms': {'one': {'label': 'no error at all', 'tone': 'accent', 'mark': 'box', 'at': 0.9,
                                         'visual': {'kind': 'bar', 'v': 1, 'max': 1, 'dx': -60, 'w': 170, 'h': 40}}}}],
            'beats': [B(0.2, "Shor's algorithm succeeds with high probability, using arbitrary rotation angles"),
                      B(2.6, 'Claim: one fixed finite gate set factors every $N \\ge 2$ completely, with no error at all')]},
    voice=VO("Factoring with zero error.",
             "Shor's algorithm usually succeeds. This circuit, using one fixed gate set, always does.",
             "Make each trial succeed exactly one time in four, then amplify that to certainty.",
             "Claimed: exact factoring in polynomial time.",
             "Lean-checked main theorem."))
EN['280'] = dict(
    plain="Physicists have two rulebooks for 2D quantum field theories; this claims they describe the same theories",
    voice=VO("Two rulebooks for conformal field theory.",
             "Vertex operator algebras and conformal nets: two ways to axiomatize chiral conformal field theory. Do they describe the same theories?",
             "Claimed: yes, for every simple, unitary, strongly rational algebra.",
             "Lean checks part of it."))
EN['281'] = dict(
    plain="A quantum optimization recipe, run deep enough, finds the best energy of a classic disordered magnet model",
    voice=VO("Quantum optimization reaches the optimum.",
             "Run the quantum approximate optimization algorithm on the Sherrington–Kirkpatrick spin glass. Let size grow first and depth after, with fixed angles.",
             "Claimed: it gets arbitrarily close to the true ground state.",
             "Lean checks part only."))
EN['282'] = dict(
    plain="If a quantum theory looks the same at every zoom level, does it also keep angles? Yes, under strong axioms",
    proof=PF('reduction', ["Angle symmetry follows if the stress tensor can be made traceless",
                           "Under the axioms, improve the stress tensor so its trace vanishes",
                           "Its charges stay the same, so the symmetry is unbroken"],
             boxes=['scale invariance', 'a traceless stress tensor', 'local conformal symmetry'], arrow='improve'),
    voice=VO("Scale symmetry to conformal symmetry.",
             "Four strong hypotheses on a scale-invariant quantum field theory in four dimensions.",
             "Under them, the stress tensor improves to a traceless one, with the same charges.",
             "Claimed, conditionally: local conformal symmetry follows.",
             "No Lean check."))
EN['283'] = dict(
    plain="Give a quantum computer a cleverly chosen classical lookup table, and a short circuit can mimic any operation",
    voice=VO("Any unitary, from one oracle.",
             "A circuit built in polynomial time from the input size alone, calling a Boolean oracle; only the oracle depends on the target.",
             "Claimed: within diamond distance one half of every unitary.",
             "No Lean check yet."))
EN['284'] = dict(
    plain="How much can quantum computers save when they answer by peeking at inputs? Up to the fourth power, exactly",
    proof=PF('construction', ["Start from Forrelation: easy for quantum, hard for random guessing",
                              "Add a cheat sheet whose address it computes, checked by pointers",
                              "The full function keeps the gap, nearly to the fourth power"],
             pieces=[{'label': 'Forrelation', 'role': 'quantum-easy core'},
                     {'label': 'cheat sheet', 'role': 'pointers certify the address'},
                     {'label': 'total function', 'role': 'a near-quartic gap'}], result='randomized needs about $Q^4$'),
    voice=VO("Quantum versus random queries.",
             "Separations crept up to cubic, and cubic was conjectured to be the limit.",
             "Wrap Forrelation in a pointer cheat sheet; the total function keeps the advantage.",
             "Claimed: nearly quartic, so the exponent is four.",
             "No Lean check."))
EN['285'] = dict(
    plain="Two big conjectures said some symmetry algebras hold no 'fractional' pieces; here are groups where they do",
    proof=PF('construction', ["Build a group from labelled expander-like graphs",
                              "A matrix over the group then has a gap in its spectrum",
                              "Cut at the gap: a projection with a forbidden trace"],
             pieces=[{'label': 'expander-like graphs', 'role': 'labelled building blocks'},
                     {'label': 'the group', 'role': 'a graphical presentation'},
                     {'label': 'a spectral gap', 'role': 'cut there: a projection'}], result='a forbidden trace'),
    voice=VO("Baum–Connes and Kadison–Kaplansky fail.",
             "For torsion-free groups, the only projections were supposed to be zero and one.",
             "Build groups from expander graphs; cutting at a spectral gap yields a projection.",
             "Claimed: a projection with trace below one half.",
             "No Lean check."))
EN['286'] = dict(
    plain="Algebras built from very rigid symmetry groups remember the group exactly, like a fingerprint",
    voice=VO("Lattice algebras remember their groups exactly.",
             "Von Neumann algebras of property T lattices over local fields: which finite-index bridges connect them to other group algebras, exactly?",
             "Claimed: every such bridge comes from actual group data alone.",
             "No Lean check yet."))
EN['287'] = dict(
    plain="Algebras built from free groups with 2, 3 or more generators were thought to differ; claim: all the same",
    proof=PF('construction', ["Start with the extra generator and the n others, all free",
                              "Nudge the others slightly so a word in them mimics the extra one",
                              "Repeat with shrinking errors: n generators do the work of n+1"],
             pieces=[{'label': '$n$ free unitaries', 'role': 'each moves a tiny amount'},
                     {'label': 'a word in them', 'role': 'mimics the extra $C$'},
                     {'label': 'the limit', 'role': 'still generates everything'}], result='$L(\\mathbb F_n) \\cong L(\\mathbb F_{n+1})$'),
    voice=VO("The free group factors coincide.",
             "Free group factors were known to be all equal or all different. Which one?",
             "Nudge the generators so a word mimics one extra; repeat with shrinking errors.",
             "Claimed: they are all the same factor.",
             "Lean-checked main theorem."))
EN['288'] = dict(
    plain="Can a 'bent' representation of an algebra always be straightened by changing how lengths are measured? Yes",
    proof=PF('reduction', ["Known: it suffices that commutators stay bounded in matrix copies",
                           "Prove that bound in a model free product, by averaging",
                           "Popa's theorem plants the model inside any factor"],
             boxes=['similarity', 'one uniform constant', 'a free-product model'], arrow='reduces to'),
    voice=VO("Kadison's similarity problem, answered.",
             "One universal constant bounds every commutator, for every algebra and every matrix size.",
             "The bound suffices; prove it in a free model, then plant it everywhere.",
             "Claimed: every bounded representation can be straightened.",
             "Lean-checked main theorem."))
EN['289'] = dict(
    plain="If two algebras of operators are almost the same, a tiny rotation turns one exactly into the other",
    proof=PF('correspondence', ["Pair each unitary of one algebra with a nearby one in the other",
                                "Correct the pairs by averaging so they multiply consistently",
                                "A uniform commutator bound turns this into one small rotation"],
             leftTitle='unitaries in $M$', rightTitle='nearby ones in $N$',
             left=['$u_1$', '$u_2$', '$u_3$', '$u_4$'], right=['$v_1$', '$v_2$', '$v_3$', '$v_4$'],
             pairs=[[0, 0], [1, 1], [2, 2], [3, 3]], label='corrected to multiply consistently'),
    voice=VO("Close algebras are nearly identical.",
             "Two von Neumann algebras on one space, with unit balls within delta.",
             "Match nearby unitaries, average to fix their products, and control every matrix level.",
             "Claimed: a tiny rotation matches them exactly.",
             "Lean-checked main theorem."))
EN['290'] = dict(
    plain="A test from Connes' classification of the algebras behind quantum fields always gives the trivial answer",
    voice=VO("Connes' bicentralizer problem, claimed solved.",
             "Connes asked this in nineteen eighty. Inside any inclusion with separable preduals, find an amenable piece with the same commutant.",
             "Claimed: every type three one factor has trivial bicentralizer.",
             "Lean checks a supporting part."))
EN['291'] = dict(
    plain="Three ways to say a C*-algebra is well behaved were conjectured equal; the missing link is now claimed",
    voice=VO("Strict comparison gives Jiang–Su stability.",
             "Three regularity properties of simple nuclear C star algebras. Two were already shown equivalent, in twenty twenty one. The third?",
             "Claimed: strict comparison implies the others, so all three agree.",
             "Lean checks the unital step."))
EN['292'] = dict(
    plain="Is there one tidy universal algebra that every separable algebra fits inside? No: here is one that doesn't",
    proof=PF('contradiction', ["Suppose the algebra fit inside a nuclear ultrapower",
                               "Then each matched representation needs a predecessor match",
                               "Finite chains of matches are forced to repeat: a contradiction"],
             assume='an embedding into a nuclear ultrapower', smaller='each match needs a predecessor', impossible='chains forced to repeat'),
    voice=VO("Kirchberg's embedding problem: no.",
             "Every separable exact algebra embeds in O two. Does every one fit in its ultrapower?",
             "If it fit, every matched representation needs a predecessor, but finite chains must repeat.",
             "Claimed: one explicit group algebra fits nowhere nuclear.",
             "Lean-checked main theorem."))
EN['293'] = dict(
    plain="Usually an operator leaves some subspace untouched by everything that commutes with it; this one leaves none",
    proof=PF('construction', ["Build an operator whose powers shrink to nothing",
                              "Make everything that commutes with it move any vector near any other",
                              "So no subspace stays fixed by all of them"],
             pieces=[{'label': 'quasinilpotent $T$', 'role': 'powers shrink to zero'},
                     {'label': 'its commutant', 'role': 'reaches near every vector'},
                     {'label': 'no fixed subspace', 'role': 'none is hyperinvariant'}], result='a counterexample'),
    voice=VO("No hyperinvariant subspace at all.",
             "The operators commuting with T move any nonzero vector arbitrarily close to any other.",
             "Build an operator whose powers fade, whose commuting operators can reach everywhere.",
             "Claimed: it exists on every separable Hilbert space.",
             "Lean-checked main theorem."))
EN['294'] = dict(
    plain="A quasitrace measures size but adds up correctly only for pieces that commute; here it can never fully add up",
    proof=PF('counterexample', ["A quasitrace adds up correctly only on commuting pieces",
                                "Build an algebra with two pieces where adding always fails",
                                "Every quasitrace misses by at least $1/144$: no trace exists"],
             items=5, breakAt=4, label='misses by at least $1/144$', caption='commuting pairs add up; one pair never does'),
    object={'primitive': 'equation', 'mode': 'stack',
            'lines': [{'tex': '\\tau(a+b) = \\tau(a) + \\tau(b) \\quad \\text{if } ab = ba', 'tone': 'soft', 'at': 0.3, 'size': 38, 'y': 0.16,
                       'relation': {'kind': 'eq', 'at': 0.9, 'left': {'v': 1}, 'right': {'v': 1}, 'label': 'equal when $a$ and $b$ commute', 'dy': 16}},
                      {'tex': '\\lvert \\term{g}{\\tau(a+b) - \\tau(a) - \\tau(b)} \\rvert \\ge \\term{c}{\\tfrac{1}{144}}', 'tone': 'accent', 'at': 2.6, 'size': 42, 'y': 0.6,
                       'terms': {'g': {'label': 'additivity gap', 'tone': 'bad', 'at': 0.7},
                                 'c': {'label': 'never smaller', 'tone': 'accent', 'mark': 'box', 'at': 1.4}}}],
            'beats': [B(0.2, 'A 2-quasitrace is additive only on commuting elements'),
                      B(2.7, 'Claim: an algebra where every quasitrace misses additivity by at least $1/144$')]},
    voice=VO("Quasitraces that aren't traces.",
             "A quasitrace adds up correctly only on commuting elements. Kaplansky asked whether it always adds.",
             "Build an algebra where adding always fails, by at least one hundred forty-fourth.",
             "Claimed: so no tracial state exists.",
             "Lean-checked, bound included."))
EN['295'] = dict(
    plain="Claims these operator algebras can't be bent into new shapes: every 'deformation' of them is trivial",
    proof=PF('reduction', ["The standard route needs bounded cocycles to behave in matrix copies",
                           "Uniform estimates, like those behind similarity, give exactly that",
                           "So cohomology vanishes in every degree from two up"],
             boxes=['cohomology vanishes', 'cocycles completely bounded', 'uniform matrix estimates'], arrow='needs'),
    voice=VO("Kadison–Ringrose cohomology, every degree.",
             "Degree one was known: every derivation is inner. Higher degrees were open for some factors.",
             "Uniform matrix estimates, like those solving similarity, tame every bounded cocycle.",
             "Claimed: it vanishes in every degree from two.",
             "Lean-checked main theorem."))
EN['296'] = dict(
    plain="Can a whole infinite algebra of operators be built from just one operator? Like one key cutting every lock",
    proof=PF('construction', ["Find a well-understood piece inside the algebra (Popa)",
                              "Add a typical unitary: together they generate everything",
                              "That piece needs one generator, and two combine into one"],
             pieces=[{'label': '$P$', 'role': 'hyperfinite, one generator'},
                     {'label': '$u$', 'role': 'a generic unitary'},
                     {'label': '$x$', 'role': 'one operator for both'}], result='$M = W^*(x)$'),
    object={'primitive': 'equation', 'mode': 'stack',
            'lines': [{'tex': 'M = W^*(\\term{p}{P}, \\term{u}{u})', 'tone': 'ink', 'at': 0.3, 'size': 44, 'y': 0.22,
                       'terms': {'p': {'label': 'hyperfinite piece', 'tone': 'cool', 'at': 0.7},
                                 'u': {'label': 'generic unitary', 'tone': 'accent', 'at': 1.3, 'side': 'above'}}},
                      {'tex': 'P = W^*(a) \\;\\Rightarrow\\; M = \\term{two}{W^*(a, u)} = \\term{one}{W^*(x)}', 'tone': 'accent', 'at': 2.6, 'size': 40, 'y': 0.56,
                       'terms': {'two': {'label': 'two generators', 'tone': 'soft', 'at': 0.7, 'visual': {'kind': 'dots', 'n': 2, 'w': 120, 'h': 40}},
                                 'one': {'label': 'one operator', 'tone': 'accent', 'mark': 'box', 'at': 1.4, 'visual': {'kind': 'dots', 'n': 1, 'w': 120, 'h': 40}}}}],
            'beats': [B(0.2, 'Start from an irreducible hyperfinite subfactor $P$ of a II$_1$ factor $M$'),
                      B(2.7, '$P$ is singly generated, and two generators combine into one')]},
    voice=VO("One operator generates everything.",
             "Inside the factor, take a well-understood hyperfinite piece P, then add a generic unitary u.",
             "Together they generate everything; P needs one generator, and two combine into one.",
             "Claimed: every such factor is singly generated.",
             "Lean-checked main theorem."))
EN['297'] = dict(
    plain="An algebra with just one way to act irreducibly, yet unlike the standard example; built without extra axioms",
    proof=PF('construction', ["Build the algebra in a long, uncountable sequence of steps",
                              "Each step adds a bridge that makes old pure states equivalent",
                              "Unique extensions keep earlier states intact along the way"],
             pieces=[{'label': 'a simple algebra', 'role': 'the start'},
                     {'label': 'bridges', 'role': 'old pure states become equivalent'},
                     {'label': 'unique extensions', 'role': 'earlier states stay intact'}], result='one irreducible representation'),
    voice=VO("Naimark's problem, without extra axioms.",
             "Separable examples are always the compact operators. Extra set theory gave a strange exception.",
             "Build it in uncountably many steps, each making old pure states equivalent.",
             "Claimed: one exists using only standard axioms.",
             "Lean-checked main theorem."))
EN['298'] = dict(
    plain="Two ways to measure how random a set of operators is, by counting and by calculus, can disagree",
    voice=VO("Two free entropies can disagree.",
             "Voiculescu defined free entropy twice: by counting matrix approximations, and through free Fisher information. One is never larger than the other.",
             "Claimed: both finite, yet at least one half apart.",
             "Lean checks the main theorem."))
EN['299'] = dict(
    plain="A simple test for when an algebra soaks up a special regularizing algebra: look for characters",
    proof=PF('construction', ["No characters means pieces that never commute, in any picture",
                              "Combine them into one element whose square is zero",
                              "Spread it over tensor powers: a dimension-drop algebra fits"],
             pieces=[{'label': 'noncommuting pieces', 'role': 'from no characters'},
                     {'label': 'a square-zero element', 'role': 'full, built from bridges'},
                     {'label': 'a dimension-drop map', 'role': 'gives $\\mathcal Z$'}], result='$A \\otimes \\mathcal Z \\cong A$'),
    object={'primitive': 'equation', 'mode': 'stack',
            'lines': [{'tex': 'A \\otimes \\term{z}{\\mathcal Z} \\cong A', 'tone': 'ink', 'at': 0.3, 'size': 44, 'y': 0.14,
                       'terms': {'z': {'label': 'Jiang–Su algebra', 'tone': 'accent', 'mark': 'box', 'at': 0.7}}},
                      {'tex': '\\Updownarrow', 'tone': 'accent', 'at': 2.0, 'size': 40, 'y': 0.38},
                      {'tex': '\\term{c}{A_\\omega \\cap A\'} \\ \\text{has no } \\term{ch}{\\text{characters}}', 'tone': 'accent', 'at': 2.4, 'size': 42, 'y': 0.56,
                       'terms': {'c': {'label': 'central sequences', 'tone': 'cool', 'at': 0.7},
                                 'ch': {'label': 'maps to $\\mathbb C$', 'tone': 'accent', 'at': 1.4}}}],
            'beats': [B(0.2, 'Jiang–Su stability: the regularity behind the classification of C*-algebras'),
                      B(2.5, 'Claim: it holds exactly when the central sequence algebra has no characters')]},
    voice=VO("A test for Jiang–Su stability.",
             "Absorbing the Jiang–Su algebra drives classification. When does an algebra absorb it?",
             "Without characters, build a square-zero element and spread it across tensor powers.",
             "Claimed: exactly when central sequences have no characters.",
             "Lean-checked main theorem."))
EN['300'] = dict(
    plain="Chop a huge operator into a few blocks so each block is nearly diagonal; how few blocks suffice?",
    voice=VO("Paving over any abelian subalgebra.",
             "Cut an operator into blocks with projections from a maximal abelian subalgebra. On each block it is nearly diagonal. How few blocks suffice?",
             "Claimed: about one over epsilon squared blocks suffice.",
             "No Lean check yet."))
EN['301'] = dict(
    plain="After a standard flattening step, these algebras are told apart by one thing alone: their traces",
    proof=PF('reduction', ["Tensoring with the Razak–Jacelon algebra wipes out K-theory",
                           "Only the traces are left to tell the algebras apart",
                           "Show matching trace cones force isomorphic algebras"],
             boxes=['tensor with $\\mathcal W$', 'K-theory vanishes', 'the trace cone classifies'], arrow='then'),
    voice=VO("Traces classify, after stabilizing.",
             "Tensoring with the Razak–Jacelon algebra kills all K theory. Only traces remain.",
             "With K theory gone, the trace cone is the only invariant left to match.",
             "Claimed: the trace cone is a complete invariant.",
             "No Lean check."))
EN['302'] = dict(
    plain="Two measures of a system's complexity, one from motion and one from algebra: one is exactly half the other",
    proof=PF('squeeze', ["Known: the comparison radius is at most half the mean dimension",
                         "Complex cobordism supplies a matching lower bound",
                         "Upper meets lower: exactly half"],
             lower={'from': 0.1, 'v': 0.5, 'label': 'new lower bound'},
             upper={'v': 0.5, 'label': 'known upper bound (Niu)', 'tone': 'soft'},
             upperStep=0, lowerStep=1, target={'v': 0.5, 'label': 'half the mean dimension'}),
    voice=VO("Comparison radius, half the dimension.",
             "A minimal dynamical system and its crossed product algebra. How do their two sizes compare?",
             "Half was already an upper bound; complex cobordism supplies the matching lower bound.",
             "Claimed: exactly half, for every minimal system.",
             "No Lean check."))
EN['303'] = dict(
    plain="Several definitions of algebras that endlessly copy themselves were thought different; the natural ones agree",
    voice=VO("Weak pure infiniteness is strong.",
             "Kirchberg and Rørdam defined several kinds of pure infiniteness for non-simple C star algebras. They asked how these compare. Do they agree?",
             "Claimed: if every positive element is properly infinite, they coincide.",
             "Lean-checked main theorem."))

for s in SPECS:
    e = EN.get(s['id'])
    if not e: continue
    s['plain'] = e['plain']
    if 'object' in e:
        o = dict(e['object']); o['dur'] = OBJ_WITH_PROOF if 'proof' in e else s['object']['dur']
        s['object'] = {'dur': o.pop('dur'), **o}
    elif 'proof' in e:
        f = OBJ_WITH_PROOF / s['object']['dur']
        _retime_panels(s['object'], f)
        s['object']['dur'] = OBJ_WITH_PROOF
        bt = s['object'].get('beats')
        if bt and bt[0]['at'] < 0.15: bt[0]['at'] = 0.15
    if 'proof' in e: s['proof'] = e['proof']
    s['voice'] = e['voice']

for s in SPECS:
    with open(os.path.join(OUT, s['id'] + '.json'), 'w') as f:
        json.dump(s, f, indent=2, ensure_ascii=False); f.write('\n')
print(len(SPECS), 'specs written to', OUT)
