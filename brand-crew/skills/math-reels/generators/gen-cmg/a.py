from common import *
D='Convex and metric geometry'
# ---------------- 087
write({'id':'087','discipline':D,'kind':'proof',
 'short':"Mahler's conjectures, every dimension",
 'title':{'title':'The Mahler conjectures in every dimension',
   'subtitle':'Claim: $|K|\\,|K^\\circ| \\ge 4^n/n!$ for symmetric bodies, and the simplex floor for all bodies, in every $\\mathbb{R}^n$'},
 'object':{'dur':8.4,'layout':'split',
   'heading':'In the plane: a body $K$ and its polar $K^\\circ$, along the $\\ell_p$ balls',
   'panels':[
    {'primitive':'shape','shapes':[{'kind':'superellipse','p':2,'r':1,'label':'$K$','tone':'accent','at':0.3,'dur':1.2,
       'morph':{'kind':'superellipse','p':40,'r':1,'at':3.0,'dur':1.8}}]},
    {'primitive':'shape','shapes':[{'kind':'superellipse','p':2,'r':1,'label':'$K^\\circ$','tone':'cool','at':0.5,'dur':1.2,
       'morph':{'kind':'superellipse','p':1,'r':1,'at':3.0,'dur':1.8}}]}],
   'beats':[
    {'at':0.2,'text':'The disc is its own polar, and there the volume product $|K|\\,|K^\\circ|$ is largest'},
    {'at':3.0,'text':'Push $K$ to the square: $K^\\circ$ becomes the diamond, and the product falls to $4^n/n!$'},
    {'at':5.8,'text':'Mahler (1939): no symmetric body goes lower. Proved before only for $n \\le 3$'}]},
 'achievement':{'form':'status','label':"Mahler's conjectures (1939), symmetric and general",
   'statement':['|K|\\,|K^\\circ| \;\\ge\; \\tfrac{4^n}{n!}','\\min_z |K|\\,|(K-z)^\\circ| \;\\ge\; \\tfrac{(n+1)^{n+1}}{(n!)^2}'],
   'context':"Before: dimensions 2 and 3 only, special classes, and Bourgain–Milman's $c^n/n!$",
   'stamp':'proved','note':'Equality: Hanner polytopes (symmetric) and simplices (general)'},
 'verify':{'lean':'main','detail':'Four Comparator statements: both inequalities, both equality cases, and Gromov width 4',
   'ourCheck':'We read the symmetric statement for traps; we did not build the Lean'},
 'sources':[
   R('087','claim','for every origin-symmetric convex body K in R^n, n>=1, |K||K°| >= 4^n/n!, with equality iff K is a linear image of a Hanner polytope'),
   R('087','claim','min_z |K||(K-z)°| (Santaló point) >= (n+1)^{n+1}/(n!)^2, equality iff K is a simplex'),
   R('087','known_before','Mahler (1939) posed the symmetric problem'),
   R('087','known_before','asymptotic Bourgain-Milman (1987) c^n/n!'),
   A('The Mahler conjectures','Blaschke and Santaló showed its maximum is the Euclidean ball\'s.'),
   A('The Mahler conjectures','Before this release the conjecture was settled in dimensions two and three only.'),
   A('The Mahler conjectures','Four Comparator challenges cover the symmetric inequality, its equality classification, the general inequality with its simplex equality case, and the Gromov width.'),
   A('The Mahler conjectures','I read it for traps and found none.'),
   R('087','lean','Not formalized: functional Mahler inequalities and entropy-transport corollaries; embedding at capacity exactly 4.'),
   C('087','The-symmetric-Mahler-conjecture-and-its-equality-cases-September-22-2026/paper.pdf')]})
# ---------------- 088
write({'id':'088','discipline':D,'kind':'proof',
 'short':"Petty's projection conjecture, $n \\ge 4$",
 'title':{'title':"Petty's projection conjecture for $n \\ge 4$",
   'subtitle':'Claim: at fixed volume, ellipsoids have the smallest projection body, in every dimension from four up'},
 'object':{'dur':8.4,'layout':'sequence','panels':[
    {'primitive':'shape','until':5.0,'shapes':[
      {'kind':'regular','n':6,'r':0.866,'label':'$\\Pi K$','labelAt':[1.12,0],'tone':'soft','dash':True,'fillA':0.05,'at':0.9,'dur':1.2,
        'morph':{'kind':'circle','r':0.64,'at':3.0,'dur':1.6}},
      {'kind':'regular','n':3,'r':0.5,'label':'$K$','tone':'accent','at':0.3,'dur':1.0,
        'morph':{'kind':'circle','r':0.32,'at':3.0,'dur':1.6}}]},
    {'primitive':'equation','from':5.0,'mode':'replace','lines':[
      {'tex':'\\frac{|\\Pi(\\Delta_{10}\\times\\Delta_{10})|}{|\\Pi\\,\\Delta_{20}|} = \\frac{\\text{22,355,476}}{\\text{22,020,096}} > 1','at':0.3,'size':44,
       'note':'normalized projection-body volumes, computed exactly'}]}],
   'beats':[
    {'at':0.2,'text':"The projection body $\\Pi K$ records the areas of all of $K$'s shadows. A planar sketch"},
    {'at':2.8,'text':'Petty (1971): at fixed volume, ellipsoids make $\\Pi K$ smallest. Claimed for $n \\ge 4$'},
    {'at':5.2,'text':"Companion: two 10-simplices beat one 20-simplex, against Brannen's conjecture"}]},
 'achievement':{'form':'status','label':"Petty's projection conjecture (1971)",
   'statement':['\\frac{|\\Pi K|}{|K|^{n-1}} \;\\ge\; \\kappa_{n-1}^{\\,n}\\,\\kappa_n^{2-n} \\quad (n \\ge 4)'],
   'context':'Equality only for ellipsoids. Before: local results and bodies of revolution; $n = 3$ is separate human work',
   'stamp':'proved','note':'The dimension-20 counterexample is simpler, not first: Feng–Hu–Liu–Xu had $d \\ge 9$'},
 'verify':{'lean':'main','detail':'In Lean: the inequality for $n \\ge 4$ with ellipsoid equality, and the dimension-20 counterexample',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('088','claim','|ΠK|/|K|^{n-1} >= κ_{n-1}^n κ_n^{2-n}, equality iff K is an ellipsoid'),
   R('088','claim','The product of two 10-dimensional simplices has normalized projection-body volume exceeding that of the 20-dimensional simplex (exact ratio 22,355,476/22,020,096)'),
   R('088','known_before','Petty (1971) conjectured ellipsoids minimize'),
   R('088','known_before','already disproved in every dimension d>=9 by Feng, Hu, Liu, Xu'),
   A("Petty's projection conjecture",'The projection body $\\Pi K$ records the areas of all of $K$\'s shadows.'),
   A("Petty's projection conjecture",'The "all $n \\ge 3$" in the summary depends on a separate human result for $n = 3$ by Chen, Feng, Li, Xi and Xu.'),
   R('088','lean','ProjectionCounterexample.lean `universal_simplex_upper_bound_false` (dimension 20;'),
   C('088','Pettys-projection-volume-conjecture-in-dimensions-at-least-four-September-24-2026/paper.pdf')]})
# ---------------- 089
gx=[0.30,0.43,0.57,0.70]; gy=[0.12,0.46,0.80]
nodes=[]; idx={}
for j,y in enumerate(gy):
    for i,x in enumerate(gx):
        nid=f'v{j}{i}'; nodes.append({'id':nid,'x':x,'y':y}); idx[(j,i)]=nid
E=[]
for j in range(3):
    for i in range(4):
        if i<3: E.append((idx[(j,i)],idx[(j,i+1)]))
        if j<2: E.append((idx[(j,i)],idx[(j+1,i)]))
E+= [(idx[(0,0)],idx[(1,1)]),(idx[(1,2)],idx[(2,3)]),(idx[(0,3)],idx[(1,2)]),(idx[(1,0)],idx[(2,1)])]
def cutgraph(side, until=None, frm=None):
    ns=[dict(n, fill='cool' if n['id'] in side else None) for n in nodes]
    for n in ns:
        if n['fill'] is None: del n['fill']
    es=[[a,b,{'tone':'hot'}] if ((a in side)!=(b in side)) else [a,b] for a,b in E]
    p={'primitive':'graph','nodes':ns,'edges':es,'edgeAt':0.3,'edgeDur':1.6,'r':14}
    if until: p['until']=until
    if frm: p['from']=frm
    return p
s1={idx[(j,0)] for j in range(3)}|{idx[(0,1)]}
s2={idx[(0,2)],idx[(0,3)],idx[(1,2)],idx[(1,3)],idx[(2,3)]}
write({'id':'089','discipline':D,'kind':'proof',
 'short':'Planar graphs embed into $L_1$',
 'title':{'title':'Planar and bounded-treewidth graphs embed into $L_1$',
   'subtitle':'Claim: every planar graph metric embeds into $L_1$ with distortion at most a universal constant $C$'},
 'object':{'dur':8.4,'layout':'sequence','panels':[cutgraph(s1,until=4.0),cutgraph(s2,frm=4.0)],
   'beats':[
    {'at':0.2,'text':'A small planar graph with edge lengths. $L_1$ distances are positive sums of cuts'},
    {'at':3.0,'text':'A cut splits the vertices in two; the edges it cuts are marked'},
    {'at':5.8,'text':'Claim: random cuts that separate every pair in proportion to its distance, at bounded loss'}]},
 'achievement':{'form':'bound',
   'before':{'label':'Best known for planar, 1999','tex':'O(\\sqrt{\\log n})','note':'Rao; series-parallel (treewidth 2) also bounded'},
   'after':{'label':'Claimed, 23 Sep 2026','tex':'O(1)','note':'any edge lengths; and $C(k)$ for treewidth below $k$'},
   'note':'Two cases of the GNRS conjecture (1999), not all of it; $C$ is not explicit'},
 'verify':{'lean':'main','detail':'In Lean: both main theorems, planarity via topological drawings. Not: the flow-cut corollaries',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('089','known_before','Rao (1999) O(sqrt(log n)) for planar'),
   R('089','known_before','Gupta-Newman-Rabinovich-Sinclair (FOCS 1999 / Combinatorica 2004) conjectured bounded L1 distortion for every minor-closed family'),
   R('089','known_before','series-parallel/treewidth-2'),
   R('089','claim','embeds into L1 with distortion <= C'),
   A('Planar and bounded-treewidth graphs','$L_1$ metrics are positive combinations of cuts, so the task is a random cut distribution that separates pairs in proportion to distance without cutting edges often.'),
   A('Planar and bounded-treewidth graphs','Constants are not explicit, and the full GNRS conjecture for all minor-closed families remains open.'),
   R('089','lean','Not formalized: flow-cut gap and almost-embeddable corollaries.'),
   C('089','Planar-Graph-Metrics-Embed-into-L1-with-Constant-Distortion-September-23-2026/paper.pdf')]})
# ---------------- 090
a=105; cx=544; cy=230; pts={}
for j in range(-2,3):
    for i in range(-2,3):
        if abs(i+j)<=2:
            pts[(i,j)]=(cx+a*(i+j/2), cy+a*math.sqrt(3)/2*j)
nodes=[]; 
for (i,j),(x,y) in pts.items():
    n={'id':f'p{i}_{j}'.replace('-','m'),'x':round(x/1088,4),'y':round(y/448,4)}
    if (i,j)==(0,0): n['fill']='accent'; n['tone']='accent'
    nodes.append(n)
nid=lambda i,j: f'p{i}_{j}'.replace('-','m')
edges=[]
for (i,j) in pts:
    for di,dj in [(1,0),(0,1),(-1,1)]:
        if (i+di,j+dj) in pts:
            hl=(i,j)==(0,0) or (i+di,j+dj)==(0,0)
            edges.append([nid(i,j),nid(i+di,j+dj)]+([{'tone':'accent'}] if hl else []))
# center edges last so they draw on top
edges.sort(key=lambda e: len(e)==3)
write({'id':'090','discipline':D,'kind':'proof',
 'short':'Triangular lattice, universally optimal',
 'title':{'title':'The triangular lattice is universally optimal',
   'subtitle':'Claim: in the plane, no density-one configuration has lower energy, for every completely monotone interaction'},
 'object':{'dur':8.4,'primitive':'graph','nodes':nodes,'edges':edges,'edgeAt':0.5,'edgeDur':2.6,'r':11,
   'beats':[
    {'at':0.2,'text':'The triangular lattice: every point has six nearest neighbours'},
    {'at':3.2,'text':'Energy: the average of $g(|x-y|^2)$ over pairs, for any completely monotone $g$'},
    {'at':5.9,'text':'Claim: no locally finite configuration of density one does better, for any such $g$'}]},
 'achievement':{'form':'status','label':'Cohn–Kumar universal optimality (2007), in the plane',
   'statement':['E_g(C) \;\\ge\; E_g(A_2) \\quad \\text{for every completely monotone } g'],
   'context':'Before: only among lattices; $E_8$ and Leech (dimensions 8 and 24) were settled in 2022',
   'stamp':'proved','note':'Minimum value only, not uniqueness; the Sandier–Serfaty claim is not in Lean'},
 'verify':{'lean':'part','detail':'In Lean: universal optimality and the Cohn–Elkies certificate. Not: Sandier–Serfaty, Riesz, log',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   A('The triangular lattice is universally optimal','Cohn and Kumar conjectured in 2007 that the triangular lattice is "universally optimal" in the plane.'),
   A('The triangular lattice is universally optimal','as $E_8$ and the Leech lattice do in dimensions 8 and 24 (Cohn, Kumar, Miller, Radchenko and Viazovska, Annals 2022)'),
   A('The triangular lattice is universally optimal','Family 090 claims the planar case for every locally finite configuration of density one.'),
   A('The triangular lattice is universally optimal','Only the minimum value is proved, not uniqueness of minimizers.'),
   R('090','known_before','Lattice-restricted results'),
   R('090','lean','NOT formalized: the Sandier-Serfaty / Coulomb paper, the Riesz/log renormalized-energy results'),
   C('090','An-atomic-certificate-for-triangular-lattice-universal-optimality-September-26-2026/paper.pdf')]})
# ---------------- 091
box=lambda w,h:[[-w,-h],[w,-h],[w,h],[-w,h]]
write({'id':'091','discipline':D,'kind':'proof',
 'short':'The log-Brunn–Minkowski inequality',
 'title':{'title':'The log-Brunn–Minkowski inequality in every dimension',
   'subtitle':'Claim: geometric averaging of support functions never loses volume, for origin-symmetric convex bodies'},
 'object':{'dur':8.4,'primitive':'shape','shapes':[
    {'kind':'polygon','points':box(1,0.25),'label':'$K$','labelAt':[-0.82,0],'tone':'cool','at':0.3,'dur':1.0},
    {'kind':'polygon','points':box(0.25,1),'label':'$L$','labelAt':[0,0.82],'tone':'warn','at':1.0,'dur':1.0},
    {'kind':'polygon','points':box(0.5,0.5),'label':'$h_K^{1/2}h_L^{1/2}$','labelAt':[0.0,-0.36],'tone':'accent','w':3.4,'fillA':0.3,'at':3.0,'dur':1.2},
    {'kind':'polygon','points':box(0.625,0.625),'label':'Minkowski mean','labelAt':[1.3,0.7],'tone':'soft','dash':True,'fillA':0.0,'at':5.6,'dur':1.0}],
   'beats':[
    {'at':0.2,'text':'Two origin-symmetric bodies: a wide box $K$ and a tall box $L$, each of area 1'},
    {'at':2.9,'text':'Average their support functions geometrically: the Wulff body is the middle square'},
    {'at':5.5,'text':'Its area is at least $|K|^{1/2}|L|^{1/2}$ (equal here); the usual Minkowski mean is bigger'}]},
 'achievement':{'form':'status','label':'Böröczky–Lutwak–Yang–Zhang conjecture (2012)',
   'statement':['\\big|W[h_K^{1-\\lambda} h_L^{\\lambda}]\\big| \;\\ge\; |K|^{1-\\lambda}\\,|L|^{\\lambda}'],
   'context':'Before: the plane (BLYZ), unconditional bodies (Saroglou), local and partial-symmetry cases',
   'stamp':'proved','note':'Symmetric bodies only; equality cases not claimed'},
 'verify':{'lean':'main','detail':'In Lean, in one file of about 24,000 lines. Not: the $L_p$, measure and B-conjecture corollaries',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('091','known_before','Conjectured by Böröczky-Lutwak-Yang-Zhang (Adv. Math. 2012), who proved n=2.'),
   R('091','known_before','unconditional bodies (Saroglou 2015)'),
   R('091','claim','the Wulff body W[h_K^{1-λ} h_L^λ] has volume >= |K|^{1-λ}|L|^λ'),
   A('The log-Brunn–Minkowski inequality','Family 091 claims every dimension in 20 pages, and the main inequality is in Lean, in a single file of about 24,000 lines'),
   A('The log-Brunn–Minkowski inequality','Those corollaries are not formalized, and equality cases are not claimed.'),
   C('091','The-logarithmic-Brunn-Minkowski-conjecture-September-23-2026/paper.pdf')]})
