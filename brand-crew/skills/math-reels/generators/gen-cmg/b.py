from common import *
D='Convex and metric geometry'
# ---------------- 092
r=0.42; a=r*math.sqrt(3); rows=[(-0.63,True),(0,False),(0.63,True)]
shapes=[]; k=0
for y,off in rows:
    xs=[(i+0.5)*a for i in range(-3,3)] if off else [i*a for i in range(-3,4)]
    for x in xs:
        if abs(x)+r>2.75: continue
        shapes.append({'kind':'circle','r':r,'c':[round(x,4),y],'tone':'accent','fillA':0.16,'w':1.8,'at':round(0.3+0.12*k,2),'dur':0.6}); k+=1
write({'id':'092','discipline':D,'kind':'proof',
 'short':'Covering density of order $n\\log n$',
 'title':{'title':'Covering space with convex bodies costs $\\Theta(n\\log n)$',
   'subtitle':'Claim: one lattice covers $\\mathbb{R}^n$ with density $C\\,n\\log n$ for every convex body, and some bodies need $c\\,n\\log n$'},
 'object':{'dur':8.4,'heading':'Translates of one disc covering the plane, on a lattice','primitive':'shape','shapes':shapes,
   'beats':[
    {'at':0.2,'text':'Every point is covered; the darker overlaps are the waste'},
    {'at':3.4,'text':'Covering density: how many copies sit over a typical point, on average'},
    {'at':5.9,'text':'In $\\mathbb{R}^n$ the worst body forces density of order $n\\log n$, lattice or not'}]},
 'achievement':{'form':'bound',
   'before':{'label':'Best lattice bound, Jul 2026','tex':'n\\log n\\,(\\log\\log n)^{10/3}','note':"Li–Liu, exponent $10/3+o(1)$; Rogers (1957): $n\\log n$ for translates"},
   'after':{'label':'Claimed, 23 Sep 2026','tex':'C\\,n\\log n','note':'one lattice, any convex body, and a matching $c\\,n\\log n$ lower bound'},
   'note':'New: the translative lower bound. The lattice half sharpens July 2026 work'},
 'verify':{'lean':'main','detail':'In Lean: the single-lattice bound, and all four suprema of order $n\\log n$',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('092','known_before','Rogers (1957/59): translative covering density <= n log n + n log log n + 5n'),
   R('092','known_before',"Li-Liu 'Nearly Sharp Bounds for Lattice Coverings by Convex Bodies' arXiv:2607.28429 (July 2026): C n log n (log log n)^{10/3+o(1)} upper"),
   R('092','claim','has a covering by translates along one full-rank lattice with density <= C n log n'),
   R('092','claim','whose translative covering density (any locally finite center set) exceeds c n log n'),
   R('092','caveats','The genuinely new qualitative statement is the translative lower bound c n log n'),
   A('Covering space with convex bodies','The lattice half is a sharp but incremental improvement on two-month-old human work.'),
   R('092','lean','CoveringDensity.lean `CoveringOrder.optimal_order` (all four suprema Θ(n log n)'),
   C('092','A-single-lattice-covering-bound-of-order-n-log-n-September-23-2026/paper.pdf')]})
# ---------------- 093
write({'id':'093','discipline':D,'kind':'proof',
 'short':'Dimension-free log-Sobolev, subgaussian',
 'title':{'title':'A dimension-free log-Sobolev inequality',
   'subtitle':'Claim: log-concave laws with $a$-subgaussian marginals satisfy log-Sobolev with constant $C a^2$, in every dimension'},
 'object':{'dur':8.4,'primitive':'plot','x':[1,36],'y':[0,8],'labelRoom':190,
   'xlabel':'dimension $n$','ylabel':'log-Sobolev constant, in units of $a^2$',
   'curves':[
     {'f':'x','to':6,'label':'$n\\,a^2$, Bobkov','tone':'mute','dash':True,'at':0.6,'dur':1.2},
     {'f':'sqrt(x)','label':'$\\sqrt{n}\\,a^2$, Bizeul','tone':'soft','at':2.6,'dur':1.6},
     {'f':'1.4','label':'$C a^2$, claimed','tone':'accent','at':5.0,'dur':1.4}],
   'beats':[
    {'at':0.2,'text':'How the log-Sobolev constant can grow with dimension $n$: orders only, constants omitted'},
    {'at':2.7,'text':"Bobkov's criterion gives order $n\\,a^2$; Bizeul reached about $\\sqrt{n}\\,a^2$"},
    {'at':5.1,'text':'Claim: a constant $C a^2$, the same in every dimension'}]},
 'achievement':{'form':'status','label':"Bizeul's conjecture (2023)",
   'statement':['\\mathrm{Ent}_\\mu(f^2) \;\\le\; C\\,a^2 \\int |\\nabla f|^2 \\, d\\mu'],
   'context':'Before: constants of order $n\\,a^2$ (Bobkov), then about $\\sqrt{n}\\,a^2$ (Bizeul)',
   'stamp':'proved','note':'A 2023 conjecture, not a classical one; needs a density and centring'},
 'verify':{'lean':'none','detail':'No Lean: a 65-page contradiction argument, not formalized',
   'ourCheck':'We read the paper and abstract; nothing here is machine-checked'},
 'sources':[
   R('093','known_before','Conjectured by P. Bizeul (2023, his Conjecture 2'),
   R('093','known_before',"Prior bounds: Bobkov's criterion gives order n a^2; Bizeul improved to about sqrt(n)·a^2-type dimension dependence"),
   R('093','claim','satisfies Ent_μ(f^2) <= C a^2 ∫|Df|^2 dμ for all smooth compactly supported f, in every dimension'),
   R('093','caveats','65-page unformalized contradiction argument'),
   R('093','caveats','requires a Lebesgue density (full-dimensional) and centering'),
   R('093','caveats','it is a recently posed (2023) conjecture rather than a classical one'),
   C('093','A-dimension-free-logarithmic-Sobolev-inequality-for-subgaussian-log-concave-measures-September-23-2026/paper.pdf')]})
# ---------------- 094
write({'id':'094','discipline':D,'kind':'proof',
 'short':'Dimension reduction in $L_p$, $n^{o(1)}$',
 'title':{'title':'Dimension reduction in $L_p$ with $n^{o(1)}$ coordinates',
   'subtitle':'Claim: any $n$ points of $L_p$, $1<p<\\infty$, $p \\ne 2$, fit in $\\ell_p^d$ with $d = n^{o(1)}$ at any fixed distortion'},
 'object':{'dur':8.4,'primitive':'plot','x':[2,400],'y':[0,30],'labelRoom':200,
   'xlabel':'number of points $n$','ylabel':'coordinates needed (schematic)',
   'curves':[
     {'f':'log(x)','label':'$\\log n$: $p = 2$ (JL)','tone':'mute','at':0.6,'dur':1.4},
     {'f':'x','to':22,'label':'$n$: best for $p<2$','tone':'soft','dash':True,'at':2.6,'dur':1.2},
     {'f':'exp(sqrt(log(x)))','label':'$n^{o(1)}$: claimed','tone':'accent','at':5.0,'dur':1.6}],
   'beats':[
    {'at':0.2,'text':'Coordinates needed to embed $n$ points with fixed distortion; schematic, constants omitted'},
    {'at':2.7,'text':'Johnson–Lindenstrauss gives $\\log n$ for $p = 2$; for $p<2$ the best was linear in $n$'},
    {'at':5.1,'text':'Claim: $n^{o(1)}$ for every $p \\ne 2$; drawn here for $p = 3/2$, $\\exp(\\sqrt{\\log n})$'}]},
 'achievement':{'form':'bound',
   'before':{'label':'Best known for p < 2','tex':'O_{p,D}(n)','note':"Schechtman; Ball's exact bound is $\\binom{n}{2}$"},
   'after':{'label':'Claimed, 23 Sep 2026','tex':'e^{C(\\log n)^{\\gamma(p)}} = n^{o(1)}','note':'$\\gamma = 2-p$ for $p<2$, $1-2/p$ for $p>2$; existential'},
   'note':'Exact isometric embeddings still need about $n^2$ coordinates'},
 'verify':{'lean':'main','detail':"In Lean: the paper's Theorem 1.1 in full, self-contained",
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('094','claim','d_p(n,D) <= exp(C_{p,D} (log n)^{gamma(p)}), gamma(p)=2-p for p<2 and 1-2/p for p>2; hence d=n^{o(1)}'),
   R('094','known_before','Johnson and Lindenstrauss (1984) gave O_D(log n) for p=2'),
   R('094','known_before','Schechtman reached O_{p,D}(n) coordinates for p<2'),
   R('094','known_before','Ball (Europ. J. Combin. 1990) gave the exact binom(n,2) bound'),
   R('094','claim','Constants are not uniform as p->1, p->2 or D->1; existential, no algorithm.'),
   A('Dimension reduction in $L_p$','Exact isometric embeddings need about $n^2$.'),
   R('094','lean',"ComparatorChallenges/SubpolynomialLp.lean states the paper's Theorem 1.1 in full"),
   C('094','Subpolynomial-dimension-reduction-in-Lp-September-23-2026/paper.pdf')]})
