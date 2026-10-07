import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
exec(open(_o.path.join(GEN, 'gen', 'common.py')).read())
# ---------------- 081 David-Semmes
def wave(amp,y0=0):
    xs=[round(-2.5+5*i/80,3) for i in range(81)]
    f=lambda x: amp*(0.6*math.sin(2.1*x)+0.3*math.sin(5.3*x+1)+0.25*math.sin(9.7*x+2))
    top=[[x,round(y0+f(x),3)] for x in xs]
    return top+[[x,round(y0+f(x)-0.004,3)] for x in reversed(xs)]
W({"id":"081","discipline":RCA,"kind":"proof","short":"Riesz transforms and rectifiability",
 "title":{"title":"Riesz transforms force rectifiability in higher codimension","subtitle":r"Claim: if the $n$-dimensional Riesz transform is bounded on $L^2(\mu)$, then $\mu$ is uniformly rectifiable"},
 "object":{"dur":8.4,"primitive":"shape","shapes":[
    {"kind":"polygon","points":[[-2.5,0],[2.5,0],[2.5,-0.004],[-2.5,-0.004]],"tone":"faint","fill":False,"dash":True,"at":0.2,"dur":0.6},
    {"kind":"polygon","points":wave(0.55),"tone":"accent","fill":False,"w":2.6,"at":0.5,"dur":1.6,
     "morph":{"kind":"polygon","points":wave(0.08),"at":3.4,"dur":2.2}}],
  "points":[{"p":[2.3,0.12],"label":"best-fitting plane","tone":"mute","at":1.0}],
  "beats":[{"at":0.2,"text":"Schematically: a piece of the set, against its best-fitting plane"},
   {"at":3.2,"text":"Zoom in a scale: bounded Riesz pairings force the rescaled heights toward a plane"},
   {"at":6.0,"text":"Flatter at every scale, so the set is built from Lipschitz pieces"}]},
 "achievement":{"form":"status","label":"The David–Semmes problem, higher codimension",
   "statement":[r"R_\mu \text{ bounded on } L^2(\mu) \;\Longrightarrow\; \mu \text{ uniformly rectifiable}", r"d \ge 4, \quad 2 \le n \le d-2"],
   "context":r"Before: $n = 1$ (1996) and codimension one (Nazarov, Tolsa and Volberg, 2014)","stamp":"proved",
   "note":r"Not the cases $n = 1$ or $n = d-1$, which were already known"},
 "verify":{"lean":"main","detail":"The quantitative theorem, in about 824 Lean files; not the variation corollaries","ourCheck":"We read the review of the statement; we did not run Comparator"},
 "sources":[S("review 081, known_before","n=1: Mattila–Melnikov–Verdera (Annals 1996, via Menger curvature). Codimension 1: Nazarov–Tolsa–Volberg (Acta Math. 2014, arXiv:1212.5229)"),
   S("review 081, claim","For integers d ≥ 4 and 2 ≤ n ≤ d-2"),
   S("article, David–Semmes","It is 56 pages, and the quantitative theorem is in Lean (`Uniformity/Rectifiability.lean:89`, about 824 files). The variation and principal-value corollaries are not."),
   S("review 081, caveats","Does not cover n=d-1 or n=1 (already known)."),
   S("review 081, caveats","No expert reaction found.")]})

# ---------------- 082 triangular Hilbert
P=(0.32,0.9)
nodes=[{"id":"P","x":P[0],"y":P[1],"label":"$(x,y)$","lx":-22,"lax":1,"tone":"ink"}]
edges=[]
for k,(dx,dy) in enumerate([(0.1,0.243),(0.2,0.486),(0.3,0.73)]):
    a,b=f"A{k}",f"B{k}"
    nodes.append({"id":a,"x":round(P[0]+dx,3),"y":P[1],"tone":"cool","label":"$(x+t,\\,y)$" if k==2 else None,"ly":34})
    nodes.append({"id":b,"x":P[0],"y":round(P[1]-dy,3),"tone":"warn","label":"$(x,\\,y+t)$" if k==2 else None,"lx":-22,"lax":1})
    edges+= [["P",a,{"tone":"cool"}],["P",b,{"tone":"warn"}],[a,b,{"tone":"accent","a":0.6}]]
for N in nodes:
    if N.get("label") is None: N.pop("label",None); N.pop("lx",None); N.pop("ly",None); N.pop("lax",None)
W({"id":"082","discipline":RCA,"kind":"partial","short":"The triangular Hilbert transform",
 "title":{"title":"The triangular Hilbert transform at the symmetric point","subtitle":r"Claim: the maximal triangular Hilbert transform is bounded $L^3 \times L^3 \to L^{3/2}$"},
 "object":{"dur":8.4,"primitive":"graph","nodes":nodes,"edges":edges,"r":7,"edgeAt":0.5,"edgeDur":3.0,
  "beats":[{"at":0.2,"text":r"$F$ is read at $(x+t,y)$ and $G$ at $(x,y+t)$: a right triangle for each $t$"},
   {"at":3.3,"text":r"Summed against $dt/t$, the variables are entangled in a cycle that defeats time-frequency analysis"},
   {"at":6.0,"text":"The claim: the first Lebesgue bound of any kind for the flat operator"}]},
 "achievement":{"form":"status","label":"Thiele's Problem 13: the exponents (3, 3, 3)",
   "statement":[r"T(F,G)(x,y) = \int F(x+t,y)\,G(x,y+t)\,\tfrac{dt}{t}", r"\|T^{*}(F,G)\|_{L^{3/2}} \le C\,\|F\|_{L^3}\|G\|_{L^3}"],
   "context":"Before: no Lebesgue bound of any kind for the flat operator","stamp":"partial",
   "note":"Only the symmetric point; the rest of the conjectured range is not claimed"},
 "verify":{"lean":"main","detail":r"Lean: the maximal $L^3 \times L^3 \to L^{3/2}$ bound. Not the variation or dyadic results","ourCheck":"We read the review of the statement; we did not run Comparator"},
 "sources":[S("review 082, known_before","Thiele's problem list (arXiv:1701.06637, Section 9 Problem 13) asks for the L^3×L^3×L^3 bound."),
   S("review 082, known_before","No Lebesgue bound for the flat operator was known before this release."),
   S("review 082, lean","NOT formalized: annular r-variation (Oct 5) and the dyadic absolute bound."),
   S("review 082, caveats","Only the symmetric point; boundedness at other Hölder exponents (the general THT conjecture) is not claimed.")]})

# ---------------- 083 Lipschitz Hilbert
nodes=[];edges=[]
cols,rows=9,5
for i in range(cols):
    for j in range(rows):
        cx=0.08+0.84*i/(cols-1); cy=0.1+0.8*j/(rows-1)
        th=0.75*math.sin(2.2*cx+1.3*cy)+0.35*math.cos(3.1*cy)
        hl=(i==4 and j==2)
        L=0.13 if hl else 0.045
        dx=L*math.cos(th); dy=L*math.sin(th)*1088/448
        a,b=f"a{i}_{j}",f"b{i}_{j}"
        nodes.append({"id":a,"x":round(cx-dx,4),"y":round(cy-dy,4),"tone":"accent" if hl else "faint"})
        nodes.append({"id":b,"x":round(cx+dx,4),"y":round(cy+dy,4),"tone":"accent" if hl else "faint"})
        edges.append([a,b,{"tone":"accent" if hl else "soft","w":4 if hl else 2.2}])
# put highlighted edge last so it draws last
hlE=[e for e in edges if e[2]["tone"]=="accent"]; edges=[e for e in edges if e[2]["tone"]!="accent"]+hlE
W({"id":"083","discipline":RCA,"kind":"proof","short":"Hilbert transforms along Lipschitz fields",
 "title":{"title":"Hilbert transforms along Lipschitz directions","subtitle":r"Claim: for every 1-Lipschitz planar unit field $v$, the short-scale Hilbert transform along $v$ is $L^2$-bounded"},
 "object":{"dur":8.4,"primitive":"graph","nodes":nodes,"edges":edges,"r":2.5,"edgeAt":0.4,"edgeDur":3.2,
  "beats":[{"at":0.2,"text":r"A unit vector field $v$: at each point a direction, turning in a Lipschitz way"},
   {"at":3.4,"text":r"Integrate $f(x - t\,v(x))$ against $dt/t$ along the short segment at each point"},
   {"at":6.0,"text":r"The claim: this singular integral is bounded on $L^2$, uniformly in the truncation"}]},
 "achievement":{"form":"status","label":"Stein's conjecture, as stated by Lacey and Li",
   "statement":[r"\Bigl\| \int_{\varepsilon<|t|<a} f(x - t\,v(x))\,\tfrac{dt}{t} \Bigr\|_{L^2} \le C\,\|f\|_{L^2}"],
   "context":"Before: only conditionally (Lacey–Li), or for fields of one variable (Bateman–Thiele)","stamp":"proved",
   "note":r"Short scales only, about $1/\mathrm{Lip}(v)$; not all scales, not Zygmund's conjecture"},
 "verify":{"lean":"main","detail":"Uniform truncation, principal-value and weak-(2,2) bounds for every 1-Lipschitz unit field","ourCheck":"We read the review of the statement; we did not run Comparator"},
 "sources":[S("review 083, claim","Only the short-scale (reciprocal-Lipschitz) form is claimed, which is the form of Stein's conjecture as stated by Lacey-Li; the Zygmund maximal-function conjecture is not addressed."),
   S("review 083, lean","main theorem formalized — ComparatorChallenges/LipschitzHilbert.lean states both `main` (exists a in (0,1/2), C>0 with uniform hard-truncation, principal-value, weak-(2,2) bounds and bounded L^2 extensions for all 1-Lipschitz unit fields)"),
   S("review 083, caveats","Lean comparator check is the strongest evidence; I did not run it.")]})
