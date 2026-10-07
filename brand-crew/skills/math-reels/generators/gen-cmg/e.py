from common import *
D='Convex and metric geometry'
# ---------------- 099
write({'id':'099','discipline':D,'kind':'improved-bound',
 'short':'Edit distance into $\\ell_1$: the sharp exponent',
 'title':{'title':'Edit distance into $\\ell_1$: the exponent is right',
   'subtitle':'Claim: embedding edit distance on length-$d$ strings into $\\ell_1$ needs distortion $\\exp(\\Theta(\\sqrt{\\log d\\,\\log\\log d}))$'},
 'object':{'dur':8.4,'primitive':'plot','x':[3,60],'y':[0,18],'labelRoom':190,
   'xlabel':'$\\log d$','ylabel':'$\\log$ of the distortion (schematic)',
   'curves':[
     {'f':'sqrt(x*log(x))','label':'upper, 2007','tone':'soft','at':0.6,'dur':1.4},
     {'f':'log(x)','label':'lower, 2009','tone':'mute','dash':True,'at':1.8,'dur':1.2},
     {'f':'0.55*sqrt(x*log(x))','label':'lower, claimed','tone':'accent','at':4.6,'dur':1.6}],
   'regions':[{'f':'sqrt(x*log(x))','f2':'0.55*sqrt(x*log(x))','tone':'accent','at':6.2}],
   'beats':[
    {'at':0.2,'text':'Log of the best distortion, against $\\log d$; constants schematic'},
    {'at':2.6,'text':'For twenty years: Ostrovsky–Rabani above, only $\\Omega(\\log d)$ below'},
    {'at':5.0,'text':'Claim: the lower bound has the same shape. The 2007 embedding is optimal'}]},
 'achievement':{'form':'bound',
   'before':{'label':'Best lower bound, 2009','tex':'\\Omega(\\log d)','note':'Krauthgamer–Rabani; the upper bound was exponentially larger'},
   'after':{'label':'Claimed, 27 Sep 2026','tex':'e^{\\Omega(\\sqrt{\\log d\\,\\log\\log d})}','note':'matches Ostrovsky–Rabani up to the constant in the exponent'},
   'note':'Pins the log of the distortion up to constants, not the distortion itself'},
 'verify':{'lean':'main','detail':'In Lean: both exponential-scale bounds, uniformly over alphabets, and the companion constructions',
   'ourCheck':'From the papers and their Lean docs; we did not build the Lean'},
 'sources':[
   R('099','known_before','Upper bound 2^{O(sqrt(log d log log d))}: Ostrovsky and Rabani (JACM 2007).'),
   R('099','known_before','Krauthgamer-Rabani (SIAM J. Comput. 2009) Omega(log d)'),
   R('099','claim','is between exp(c sqrt(log d log log d)) and exp(C sqrt(log d log log d))'),
   R('099','caveats','Determines log of the distortion up to constants, not the distortion up to constants.'),
   A('Edit distance into','The best impossibility result was Krauthgamer and Rabani\'s $\\Omega(\\log d)$, an exponential gap that stood for twenty years.'),
   R('099','lean',"the tree paper's constant-distortion binary conversion is excluded"),
   C('099','Edit-Distance-in-l1-Matching-Bounds-up-to-Constants-in-the-Exponent-September-27-2026/paper.pdf')]})
# ---------------- 100
claimed=0.5-(13/6000)*(1/2000)**2
write({'id':'100','discipline':D,'kind':'counterexample',
 'short':'Cylinder coverings below the half-area bound',
 'title':{'title':'Cylinder coverings below the half-area bound',
   'subtitle':'Claim: cylinders can cover a regular tetrahedron with total cross-section below half its smallest shadow'},
 'object':{'dur':8.4,'primitive':'numberline','min':0.25,'max':0.6,'y':0.66,
   'heading':'Cylinders covering a tetrahedron: cross-section over smallest shadow',
   'ticks':[{'v':1/3,'label':'$1/3$'},{'v':0.5,'label':'$1/2$'}],
   'axisLabel':'total base area of the cylinders, normalized',
   'markers':[
     {'v':1/3,'label':'Bezdek–Litvak','note':'proven floor','at':0.5,'derived':'1/3'},
     {'v':0.5,'label':"Bang's two cylinders",'note':'conjectured floor','at':0.9,'derived':'1/2'},
     {'v':claimed,'label':'claimed','note':'$\\approx \\tfrac{1}{2} - 5\\times 10^{-10}$','tone':'claim','at':3.8,'derived':'1/2 - (13/6000)(1/2000)^2'}],
   'zoom':{'min':0.4999999990,'max':0.5000000003,'at':1.6,'dur':2.0,'counter':True,
     'ticks':[{'v':0.5,'label':'$1/2$'}]},
   'beats':[
    {'at':0.2,'text':"Bang's two cylinders cover it at exactly half its smallest shadow"},
    {'at':2.8,'text':'Zoom in just below $1/2$'},
    {'at':5.0,'text':'16,000,000 cylinders in nearby directions dip about $5 \\times 10^{-10}$ below it'}]},
 'achievement':{'form':'bound',
   'before':{'label':'Conjectured floor','tex':'\\tfrac{1}{2}','note':"Bang's two-cylinder cover attains it"},
   'after':{'label':'Claimed, 27 Sep 2026','tex':'\\tfrac{1}{2} - \\tfrac{13}{6000}\\varepsilon^2 + O(\\varepsilon^4)','note':'for $0<\\varepsilon \\le 1/2000$, with $2\\lceil 2/\\varepsilon^2\\rceil$ cylinders'},
   'note':'Refutes the $1/2$ bound; the true constant lies between $1/3$ and just under $1/2$'},
 'verify':{'lean':'main','detail':'In Lean: the expansion and the strict counterexample. Not: the extension to every tetrahedron',
   'ourCheck':'From the papers and their Lean docs; we did not build the Lean'},
 'sources':[
   R('100','claim','whose total base area, normalized by sqrt2, is 1/2 - (13/6000) eps^2 + O(eps^4) for 0<eps<=1/2000, hence strictly below half the minimum projection area'),
   R('100','claim','m=2*ceil(2/eps^2) cylinders'),
   R('100','known_before','who proved the directionwise sum is >= 1/3 in R^3'),
   A('Cylinder coverings below the half-area bound','At the largest allowed $\\epsilon = 1/2000$ that is about $5 \\times 10^{-10}$, bought with $2\\lceil 2/\\epsilon^2\\rceil$ = 16,000,000 cylinders.'),
   A('Cylinder coverings below the half-area bound','That refutes the $1/2$ constant and leaves the truth somewhere between Bezdek and Litvak\'s $1/3$ and just under $1/2$.'),
   R('100','lean','Per lean/docs/100.md the affine extension to every nondegenerate tetrahedron is outside the selected statements.'),
   C('100','Finite-angular-cylinder-covers-below-the-half-area-bound-September-27-2026/main.pdf')]})
# ---------------- 101
s=math.sqrt(4/math.sqrt(3)); R3=s/math.sqrt(3)
write({'id':'101','discipline':D,'kind':'proof',
 'short':'The simplex conjecture for $L_K$',
 'title':{'title':'The simplex has the largest isotropic constant',
   'subtitle':'Claim: in every dimension, $L_K$ is at most the simplex’s value, with equality only for simplices'},
 'object':{'dur':8.4,'layout':'sequence','panels':[
    {'primitive':'shape','until':3.6,'shapes':[
      {'kind':'circle','r':round(1/math.sqrt(math.pi),4),'tone':'soft','fillA':0.06,'at':0.3,'dur':0.9},
      {'kind':'polygon','points':[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],'tone':'cool','fillA':0.06,'at':0.9,'dur':0.9},
      {'kind':'regular','n':3,'r':round(R3,4),'tone':'accent','fillA':0.14,'at':1.5,'dur':0.9}],
      'points':[{'p':[0,0],'tone':'ink','at':2.3}]},
    {'primitive':'numberline','from':3.6,'min':0.275,'max':0.318,'y':0.6,
     'axisLabel':'the isotropic constant $L_K$ in the plane',
     'markers':[
       {'v':1/math.sqrt(4*math.pi),'label':'disc','note':'$1/\\sqrt{4\\pi}$','at':0.6,'derived':'1/sqrt(4 pi)'},
       {'v':1/math.sqrt(12),'label':'square','note':'$1/(2\\sqrt3)$','at':1.0,'derived':'1/sqrt(12)'},
       {'v':(6*math.sqrt(3))**-0.5,'label':'triangle','note':'$(6\\sqrt3)^{-1/2}$','tone':'claim','at':1.6,'derived':'(6 sqrt 3)^(-1/2)'}]}],
   'beats':[
    {'at':0.2,'text':'A disc, a square and a triangle, each of area 1, centred at their centroids'},
    {'at':3.7,'text':'Their isotropic constants, computed exactly: the triangle’s is the largest'},
    {'at':6.0,'text':'Claim: in every dimension the simplex has the largest $L_K$, and only the simplex'}]},
 'achievement':{'form':'status','label':'The sharp simplex conjecture for isotropic constants',
   'statement':['L_K \;\\le\; \\frac{(n!)^{1/n}}{(n+1)^{(n+1)/(2n)}\\sqrt{n+2}}'],
   'context':'Before: $L_K$ bounded (Klartag–Lehec, 2024); the sharp form known in the plane',
   'stamp':'proved','note':"If right, it also implies the general Mahler inequality (Klartag, 2018)"},
 'verify':{'lean':'none','detail':'No Lean: 42 pages of hard analysis, unformalized. Treat it as a claim',
   'ourCheck':'We read the paper and abstract; nothing here is machine-checked'},
 'sources':[
   R('101','claim','L_K <= (n!)^{1/n} / ((n+1)^{(n+1)/(2n)} sqrt(n+2)), the isotropic constant of the simplex, with equality iff K is a simplex'),
   R('101','known_before','Bourgain\'s slicing problem (L_K bounded by an absolute constant) was resolved by Klartag and Lehec (arXiv:2412.15044, Dec 2024'),
   R('101','known_before','proved in the plane by Campi-Colesanti-Gronchi'),
   R('101','known_before','Klartag (Adv. Math. 2018) showed the simplex bound implies nonsymmetric Mahler.'),
   R('101','caveats','Unformalized and not peer-reviewed, 42 pages of hard analysis'),
   C('101','A-sharp-entropy-bound-and-the-simplex-inequality-for-isotropic-constants-October-5-2026/isotropic-simplex.pdf')]})
