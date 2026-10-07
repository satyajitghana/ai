from common import *
D='Convex and metric geometry'
# ---------------- 095
write({'id':'095','discipline':D,'kind':'disproof',
 'short':'Hyperbolicity cones vs. semidefinite lifts',
 'title':{'title':'A hyperbolicity cone that is not spectrahedral',
   'subtitle':'Claim: the generalized Lax conjecture is false; an explicit cone is no linear slice of any PSD cone'},
 'object':{'dur':8.4,'primitive':'equation','mode':'replace','lines':[
    {'tex':'\\Lambda_+(p) \;\\overset{?}{=}\; \\{\\,x : L(x) \\succeq 0\\,\\}','at':0.3,'size':50,
     'note':'Generalized Lax: every hyperbolicity cone is a slice of a PSD cone'},
    {'tex':'p(X,Z,y) = \\det\\!\\big((\\det X)\\,Z - \\Phi_y(\\operatorname{adj} X)\\big)','at':3.4,'size':46,
     'note':'on $S^4 \\times S^4 \\times \\mathbb{R}^3$: 23 variables, degree 20'}],
   'beats':[
    {'at':0.2,'text':'Hyperbolicity cones generalize the PSD cone, and interior-point methods run on them'},
    {'at':3.3,'text':'The counterexample: a determinant built from the Choi–Lam biquadratic form'},
    {'at':6.0,'text':'Its cone equals $\\{L(x) \\succeq 0\\}$ for no linear pencil $L$ of any size'}]},
 'achievement':{'form':'status','label':'Generalized Lax conjecture (open since Helton–Vinnikov, 2007)',
   'statement':['\\text{every hyperbolicity cone} = \\{\\,x : L(x) \\succeq 0\\,\\}'],
   'context':'Counterexample: degree 20 in 23 variables. A second paper claims a cone with no semidefinite lift at all',
   'stamp':'disproved','note':'The stronger no-lift claim (Projected Lax) is the one not in Lean'},
 'verify':{'lean':'part','detail':'In Lean: the explicit degree-20 cone is not spectrahedral. Not: the no-semidefinite-lift theorem',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('095','claim',"p(X,Z,y)=det((det X)Z - Phi_y(adj X)) on S^4 x S^4 x R^3 (23 variables, degree 20"),
   R('095','claim','built from the Choi-Lam biquadratic form'),
   R('095','known_before','Helton-Vinnikov (CPAM 2007)'),
   R('095','known_before','The generalized Lax conjecture (every hyperbolicity cone is spectrahedral) has been open since then.'),
   A('Hyperbolicity cones that are not slices of the PSD cone','Hyperbolicity cones generalize the cone of positive semidefinite matrices, and interior-point methods run on them.'),
   R('095','lean',"The stronger 'no semidefinite lift / not a spectrahedral shadow' theorem (paper 1, which disproves the Projected Lax Conjecture) and paper 3's lift are NOT formalized."),
   C('095','Hyperbolicity-Cones-Without-Semidefinite-Lifts-October-5-2026/nonliftable-hyperbolicity.pdf')]})
# ---------------- 096
def sector(c_deg, half_deg, r=1.0, n=24):
    pts=[[0,0]]
    for i in range(n+1):
        t=math.radians(c_deg-half_deg+2*half_deg*i/n); pts.append([round(r*math.cos(t),4),round(r*math.sin(t),4)])
    return pts
def cen(c_deg, half_deg):
    L=math.sin(math.radians(half_deg))/math.sqrt(2*math.pi); t=math.radians(c_deg)
    return [round(L*math.cos(t),4),round(L*math.sin(t),4)]
tones=['accent','cool','warn']
halves={'primitive':'shape','until':3.2,'shapes':[
   {'kind':'polygon','points':sector(0,90),'tone':'accent','fillA':0.18,'at':0.3,'dur':1.0},
   {'kind':'polygon','points':sector(180,90),'tone':'cool','fillA':0.18,'at':0.6,'dur':1.0}],
   'points':[{'p':cen(0,90),'tone':'ink','at':1.6},{'p':cen(180,90),'tone':'ink','at':1.8}]}
prop={'primitive':'shape','from':3.2,'shapes':[
   {'kind':'polygon','points':sector(90+120*i,60),'tone':tones[i],'fillA':0.18,'at':0.2+0.3*i,'dur':1.0} for i in range(3)],
   'points':[{'p':cen(90+120*i,60),'tone':'ink','at':1.6+0.2*i} for i in range(3)]}
write({'id':'096','discipline':D,'kind':'proof',
 'short':'The Gaussian propeller conjecture',
 'title':{'title':'The Gaussian propeller conjecture in every dimension',
   'subtitle':'Claim: splitting Gaussian space into any number of pieces, the squared centres of mass sum to at most $9/(8\\pi)$'},
 'object':{'dur':8.4,'layout':'sequence','heading':'Squared Gaussian centres of mass, summed: $\\sum_i \\|\\int_{A_i} x\\,d\\gamma\\|^2$',
   'panels':[halves,prop],
   'beats':[
    {'at':0.2,'text':'Two half-planes: each dot is a piece’s centre of mass, and the sum is $1/\\pi$'},
    {'at':3.3,'text':'Three 120-degree blades, a propeller, do better: $9/(8\\pi)$'},
    {'at':5.9,'text':'Khot–Naor: no partition, in any dimension, into any number of pieces beats it'}]},
 'achievement':{'form':'status','label':'Khot–Naor propeller conjecture (2009)',
   'statement':['\\sum_i \\Big\\| \\int_{A_i} x \\, d\\gamma_d \\Big\\|^2 \;\\le\; \\frac{9}{8\\pi}'],
   'context':'Before: proved in $\\mathbb{R}^3$, up to four cells (Heilman–Jagannath–Naor, 2013, computer-assisted)',
   'stamp':'proved','note':'Its NP-hardness corollary rests on a separate "Unique Games Theorem" claim'},
 'verify':{'lean':'main','detail':'In Lean: the bound for all $d, k$ and its attainment; the $\\mathbb{R}^3$ case re-proved, not assumed',
   'ourCheck':'From the paper and its Lean docs; we did not build the Lean'},
 'sources':[
   R('096','claim','sum_i ||integral_{A_i} x dgamma_d||^2 <= 9/(8 pi)'),
   R('096','claim','equality is attained for d>=2, k>=3 by three planar 120-degree sectors times R^{d-2}'),
   R('096','known_before','Posed by Khot and Naor in their work on approximate kernel clustering (Mathematika 2009)'),
   R('096','known_before','Heilman, Jagannath and Naor proved the conjecture in R^3, i.e. for at most four active cells, with a computer-assisted proof (arXiv:1112.2993; Discrete Comput. Geom. 50 (2013))'),
   A('The Gaussian propeller','That is a separate extraordinary claim, so read the complexity consequence as conditional.'),
   R('096','lean','so the Heilman-Jagannath-Naor input appears to be re-proved inside Lean rather than assumed'),
   C('096','The-Gaussian-Propeller-Bound-in-Every-Dimension-September-24-2026/main.pdf')]})
