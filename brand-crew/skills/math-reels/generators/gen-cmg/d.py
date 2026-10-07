from common import *
D='Convex and metric geometry'
# ---------------- 097
angs=[10,-35,25,50,-20,5,40,-45,15,30]; U=72; ox,oy=150,250
vs=[(math.cos(math.radians(t)),math.sin(math.radians(t))) for t in angs]
def walk(signs):
    x=y=0; P=[(0,0)]
    for s,(vx,vy) in zip(signs,vs): x+=s*vx; y+=s*vy; P.append((x,y))
    return P
sg=[]; x=y=0
for vx,vy in vs:
    s=min((1,-1),key=lambda s:(x+s*vx)**2+(y+s*vy)**2); sg.append(s); x+=s*vx; y+=s*vy
Pu=walk([1]*10); Ps=walk(sg)
print('signed max', max(math.hypot(*p) for p in Ps), 'unsigned end', Pu[-1])
fx=lambda p: round((ox+U*p[0])/1088,4); fy=lambda p: round((oy-U*p[1])/448,4)
nodes=[{'id':'o','x':fx((0,0)),'y':fy((0,0)),'label':'$0$','tone':'ink'}]
edges=[]
for i in range(1,11):
    nodes.append({'id':f'u{i}','x':fx(Pu[i]),'y':fy(Pu[i]),'tone':'faint'})
for i in range(1,11):
    nodes.append({'id':f's{i}','x':fx(Ps[i]),'y':fy(Ps[i]),'tone':'accent','fill':'accent'})
for i in range(1,11): edges.append(['o' if i==1 else f'u{i-1}',f'u{i}',{'tone':'mute'}])
for i in range(1,11): edges.append(['o' if i==1 else f's{i-1}',f's{i}',{'tone':'accent'}])
write({'id':'097','discipline':D,'kind':'proof',
 'short':'The Euclidean Steinitz–Bergström bound',
 'title':{'title':'The Euclidean Steinitz constant is $\\Theta(\\sqrt d)$',
   'subtitle':'Claim: signs exist that keep every prefix sum of unit vectors in $\\mathbb{R}^d$ within $C\\sqrt d$, however many there are'},
 'object':{'dur':8.4,'primitive':'graph','nodes':nodes,'edges':edges,'r':7,'edgeAt':0.6,'edgeDur':5.0,
   'beats':[
    {'at':0.2,'text':'A small instance: ten unit vectors in the plane, in a fixed order'},
    {'at':2.9,'text':'Added with $+$ signs they drift away (grey); chosen signs keep the walk near $0$'},
    {'at':5.9,'text':'Claim: some signs keep every prefix sum within $C\\sqrt d$, however many vectors'}]},
 'achievement':{'form':'bound',
   'before':{'label':'Best known, Banaszczyk 2012','tex':'O(\\sqrt d + \\sqrt{\\log N})','note':'grows, slowly, with the number $N$ of vectors'},
   'after':{'label':'Claimed, 24 Sep 2026','tex':'C\\sqrt d','note':'independent of $N$; existential, $C$ not explicit'},
   'note':'Signs become an ordering, so the Steinitz constant is $\\Theta(\\sqrt d)$'},
 'verify':{'lean':'main','detail':'In Lean: the signed prefix bound and the zero-sum ordering, for all $d$ and $N$',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('097','known_before','Banaszczyk (Random Struct. Alg. 2012) proved O(sqrt d + sqrt log N) for signed series'),
   R('097','claim','one choice of signs keeps every signed prefix sum within Euclidean norm C sqrt(d), independent of N'),
   R('097','claim','the Euclidean Steinitz constant S_2(d)=Theta(sqrt d). Existential, no algorithm.'),
   R('097','caveats','The constant C is not explicit in the statement.'),
   C('097','The-Euclidean-Steinitz-Bergstrom-theorem-September-24-2026/The-Euclidean-Steinitz-Bergstrom-theorem-September-24-2026.pdf')]})
# ---------------- 098
cells=[]
R7,C16=7,16
for c in range(C16):
    for r in (1,4): cells.append([r,c,'accent'])
for r in range(R7):
    for c in (2,7,12): cells.append([r,c,'hot' if r in (1,4) else 'cool'])
write({'id':'098','discipline':D,'kind':'counterexample',
 'short':'A doubling set in $\\ell_2$ that fits no $\\mathbb{R}^k$',
 'title':{'title':'A doubling subset of Hilbert space that fits in no $\\mathbb{R}^k$',
   'subtitle':'Claim: a subset of $\\ell_2$ with doubling constant at most 76,800 has no bi-Lipschitz embedding into any $\\mathbb{R}^k$'},
 'object':{'dur':8.4,'primitive':'grid','rows':R7,'cols':C16,'cells':cells,'stagger':0.03,
   'caption':'schematic: a base plane with coloured strips, at one of many sparse scales',
   'beats':[
    {'at':0.2,'text':'Doubling: every ball is covered by boundedly many balls of half the radius'},
    {'at':2.9,'text':'The set stacks orthogonal displacements over a plane, steered by coloured strips'},
    {'at':5.8,'text':'Claim: any map into some $\\mathbb{R}^k$ crowds too many separated points into a ball'}]},
 'achievement':{'form':'status','label':'Question of Lang and Plaut (2001)',
   'statement':['S \\subset \\ell_2 \\text{ doubling} \;\\overset{?}{\\Longrightarrow}\; S \\hookrightarrow \\mathbb{R}^k \\text{ bi-Lipschitz}'],
   'context':'Answer: no. A subset of $\\ell_2$ with doubling constant at most 76,800 embeds in no $\\mathbb{R}^k$',
   'stamp':'counterexample','note':'Before: counterexamples only in $L_p$, $p>2$; a 2017 Hilbert attempt was withdrawn'},
 'verify':{'lean':'main','detail':'In Lean: the $\\ell_2$ set, and a compact one in every infinite-dimensional Banach space',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('098','claim','There is a fixed subset S of real l_2 with doubling constant at most 76800 that admits no bi-Lipschitz embedding into any R^k at any finite distortion.'),
   R('098','known_before','Lang and Plaut (Geom. Dedicata 87, 2001, Question 2.4) asked whether every doubling subset of Hilbert space bi-Lipschitz embeds in some R^k'),
   R('098','known_before',"Schioppa's 2017 claimed Hilbert counterexample (arXiv:1703.10265) was withdrawn."),
   R('098','known_before','Lafforgue-Naor (Geom. Dedicata 172, 2014) gave a counterexample in L_p for p>2'),
   R('098','explainer','The construction stacks orthogonal displacements on a base plane, controlled by periodically coloured horizontal and vertical strips at sparse scales.'),
   A('A doubling subset of Hilbert space','Differentiating a would-be embedding on "sheets" forces too many separated points into a bounded ball.'),
   C('098','A-doubling-Hilbert-subset-with-no-finite-dimensional-bi-Lipschitz-embedding-September-25-2026/main.pdf')]})
