import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, math, os, sys
OUT=_OUT
def W(spec):
    spec={"$schema":"../../brand-crew/skills/math-reels/schema.json",**spec}
    json.dump(spec,open(f"{OUT}/{spec['id']}.json",'w'),indent=2,ensure_ascii=False)
RCA="Real and complex analysis"
def S(ref,q): return {"ref":ref,"quote":q}

# ---------------- 071 Koebe
def blob(cx,cy,r,seed):
    import random; rnd=random.Random(seed); pts=[]
    n=9
    for k in range(n):
        a=2*math.pi*k/n; rr=r*(0.6+0.75*rnd.random())
        pts.append([round(cx+rr*math.cos(a),3),round(cy+rr*math.sin(a),3)])
    return pts
holes=[(-1.65,0.25,0.5,'circle',0.42),(-0.35,-0.35,0.42,'circle',0.34),(0.95,0.38,0.5,'circle',0.44),(2.0,-0.45,0.28,'circle',0.05),(0.15,0.75,0.2,'circle',0.04)]
shapes=[{"kind":"ellipse","rx":2.75,"ry":1.18,"tone":"faint","fill":False,"dash":True,"at":0.1,"dur":0.9}]
for i,(cx,cy,r,k,r2) in enumerate(holes):
    shapes.append({"kind":"polygon","points":blob(cx,cy,r,i+3),"tone":"accent","fillA":0.3,"at":0.5+0.25*i,"dur":0.9,
                   "morph":{"kind":"circle","c":[cx,cy],"r":r2,"at":3.4+0.2*i,"dur":1.6}})
W({"id":"071","discipline":RCA,"kind":"proof","short":"Koebe's circle-domain conjecture",
 "title":{"title":"Koebe's circle-domain conjecture","subtitle":"Claim: every domain in the Riemann sphere maps conformally onto one whose holes are round disks or points"},# equivalent to one whose holes are round disks or points"},
 "object":{"dur":8.4,"primitive":"shape","shapes":shapes,"beats":[
   {"at":0.2,"text":"Schematically: a domain with irregular holes, some of them tiny"},
   {"at":3.2,"text":"Map it conformally so every hole becomes a round disk or a point"},
   {"at":5.9,"text":"Koebe did finitely many holes in 1920. The claim: any number, even uncountably many"}]},
 "achievement":{"form":"status","label":"Koebe's Kreisnormierungsproblem (1908)",
   "statement":[r"\text{every domain } \Omega \subset \hat{\mathbb C} \;\cong\; \text{a circle domain}"],
   "context":"Before: finitely many holes (Koebe, 1920), countably many (He and Schramm, 1993)",
   "stamp":"proved","note":"Existence only: uniqueness of the circle-domain model is not claimed"},
 "verify":{"lean":"main","detail":"Existence and removability-implies-rigidity, in about 211,000 lines of Lean","ourCheck":"We read the review of the statement; we did not run Comparator"},
 "sources":[S("review 071, known_before","Posed by Koebe in 1908/1909 (Kreisnormierungsproblem). Koebe proved the finitely connected case (1920)."),
   S("review 071, known_before","He and Schramm proved the countably connected case and rigidity of countably connected circle domains (Annals 1993)"),
   S("review 071, claim","Uniqueness of the circle-domain model in general is NOT claimed."),
   S("article, Koebe's circle-domain conjecture","The Lean development is the largest in this group, about 211,000 lines in roughly 2,600 files."),
   S("review 071, caveats","I did not run the comparator.")]})

# ---------------- 072 Brennan
W({"id":"072","discipline":RCA,"kind":"proof","short":"Brennan's conjecture",
 "title":{"title":"Brennan's conjecture, and Kraetzer's formula fails","subtitle":r"Claim: $\int |\varphi'|^s\,dA < \infty$ for every $4/3 < s < 4$, for every conformal map onto the disk"},
 "object":{"dur":8.6,"panels":[
   {"primitive":"numberline","min":1,"max":4.5,"until":5.6,
    "ticks":[{"v":1,"label":"1"},{"v":4/3,"label":"$4/3$"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"}],
    "axisLabel":r"exponents $s$ with $\int |\varphi'|^s\,dA < \infty$",
    "ranges":[{"from":4/3,"to":3,"label":"classical","note":r"$4/3 < s < 3$","at":0.6,"side":"below","tone":"old","derived":"4/3 to 3"}],
    "markers":[{"v":3.421,"label":"Bertilsson","note":"1999 thesis","at":1.3},
               {"v":4,"label":"conjectured end","note":"Brennan, 1978","style":"ring","tone":"mute","at":1.8}],
    "slide":{"from":3.421,"to":4,"at":3.0,"dur":1.5,"label":"claimed","note":r"every $s < 4$"}},
   {"primitive":"plot","from":5.6,"x":[-2.2,2.2],"y":[0,1.2],
    "xticks":[{"v":-2,"label":"$-2$"},{"v":-1,"label":"$-1$"},{"v":0,"label":"0"},{"v":1,"label":"1"},{"v":2,"label":"2"}],
    "yticks":[{"v":0.25,"label":"$1/4$"},{"v":1,"label":"1"}],"xlabel":"$t$","ylabel":r"$B_b(t)$",
    "curves":[{"f":"x*x/4","from":-2,"to":2,"label":r"Kraetzer: $t^2/4$","tone":"soft","dash":True,"at":0.3,"dur":1.2}],
    "points":[{"x":-1,"y":0.25,"label":r"claim: $B_b(-1) < 1/4$","at":1.4,"tone":"hot"}]}],
  "beats":[{"at":0.2,"text":"How badly can a conformal map compress area near a wild boundary?"},
   {"at":2.9,"text":"The upper end stuck at about 3.42 for a quarter-century. The claim reaches 4"},
   {"at":5.8,"text":r"A companion: Kraetzer's 1996 formula fails at $t = -1$, by an uncomputed gap"}]},
 "achievement":{"form":"status","label":"Brennan's conjecture (1978)",
   "statement":[r"\int_\Omega |\varphi'|^s\,dA < \infty \quad \text{for } \tfrac{4}{3} < s < 4"],
   "context":r"Before: the upper end reached about 3.42 (Bertilsson, 1999); equivalent to $B_S(-2) = 1$",
   "stamp":"proved","note":r"The Kraetzer disproof is at $t = -1$ only, and the gap is not computed"},
 "verify":{"lean":"main","detail":r"Brennan and $B_b(-1) < 1/4$ are in Lean; $B_S(t) = |t| - 1$ for all $t \le -2$ is not","ourCheck":"We read the statements; we did not run Comparator"},
 "sources":[S("review 072, known_before","Brennan (1978) conjectured the range 4/3<s<4; the lower end and s<3 were classical"),
   S("review 072, known_before","Bertilsson (thesis, KTH 1999) reached 4/3<s<3.421"),
   S("article, Brennan's conjecture","Bertilsson's 1999 thesis pushed the upper end to about 3.42, and it stuck there for a quarter-century."),
   S("article, Brennan's conjecture","Kraetzer conjectured in 1996, from numerics on Julia sets, that the bounded-class spectrum is exactly $t^2/4$ for $|t| \\le 2$."),
   S("article, Brennan's conjecture","The paper proves $B_b(-1) < 1/4$, so Kraetzer's formula fails at $t = -1$. It does not say by how much: the gap $\\epsilon$ is never computed."),
   S("review 072, lean","The B_S(t)=|t|-1 for all t≤-2 statement is in the paper but not in the comparator file.")]})

# ---------------- 073 Falconer
W({"id":"073","discipline":RCA,"kind":"proof","short":"Falconer's distance conjecture",
 "title":{"title":"Falconer's distance conjecture, in every dimension","subtitle":r"Claim: a compact $E \subset \mathbb R^d$ with $\dim_H E > d/2$ has a distance set of positive length"},
 "object":{"dur":8.4,"primitive":"numberline","min":0.85,"max":1.65,
   "ticks":[{"v":1,"label":"1"},{"v":1.25,"label":"$5/4$"},{"v":4/3,"label":"$4/3$"},{"v":1.5,"label":"$3/2$"}],
   "axisLabel":r"dimension of $E \subset \mathbb R^2$ that forces $|\Delta(E)| > 0$",
   "markers":[{"v":1.5,"label":"Falconer","note":"1985","at":0.8,"derived":"(d+1)/2 at d=2"},
              {"v":4/3,"label":"Wolff","note":"1999","at":2.9,"derived":"4/3"},
              {"v":1.25,"label":"Guth et al.","note":"2020","at":3.5,"side":"below","derived":"5/4"},
              {"v":1,"label":"conjectured","note":"$d/2$","style":"ring","tone":"mute","at":4.0}],
   "slide":{"from":1.25,"to":1,"at":5.6,"dur":1.5,"label":"claimed","note":"every dimension $d$","derived":"5/4 to d/2 = 1"},
   "beats":[{"at":0.2,"text":r"$\Delta(E)$ collects all distances $|x - y|$ between points of a fractal set $E$"},
    {"at":2.8,"text":r"In the plane the threshold fell from $3/2$ to $4/3$ to $5/4$ over forty years"},
    {"at":5.5,"text":r"The claim: $d/2$ suffices, in every dimension"}]},
 "achievement":{"form":"status","label":"Falconer's distance conjecture (1985)",
   "statement":[r"\dim_H E > \tfrac d2 \;\Longrightarrow\; |\Delta(E)| > 0"],
   "context":r"Before: open in every dimension; in the plane the best threshold was $5/4$",
   "stamp":"proved","note":r"Strict threshold only: nothing at exactly $d/2$, and no pinned version"},
 "verify":{"lean":"main","detail":"All dimensions, with the planar Furstenberg input also proved in Lean","ourCheck":"We read the Lean statement; we did not run Comparator"},
 "sources":[S("review 073, known_before","Posed by Falconer (Mathematika 1985), who proved the threshold (d+1)/2."),
   S("review 073, known_before","Wolff (1999) 4/3 in the plane"),
   S("review 073, known_before","Guth–Iosevich–Ou–Wang (Invent. Math. 2020, arXiv:1808.09346) 5/4 in the plane (pinned)"),
   S("review 073, known_before","Before this release the conjecture was open in every dimension."),
   S("article, Falconer","Then came forty years of steady work"),
   S("article, Falconer","The strict threshold is all it claims. Nothing is said at exactly $d/2$, and nothing about the pinned version."),
   S("article, Falconer","Then it proves that input in Lean as well (`publishedPlanarFurstenberg_proved`), so the top-level statement is unconditional.")]})

# ---------------- 074 Kakeya
needles=[]
for i in range(12):
    a=math.pi*i/12; ox=0.25*math.sin(3*a); oy=0.2*math.cos(5*a)
    c,s=math.cos(a),math.sin(a)
    needles.append({"kind":"polygon","points":[[round(ox-c*0.95,3),round(oy-s*0.95,3)],[round(ox+c*0.95,3),round(oy+s*0.95,3)]],"fill":False,"tone":"accent" if i%2==0 else "cool","w":2.4,"at":0.4+0.13*i,"dur":0.5})
W({"id":"074","discipline":RCA,"kind":"proof","short":"Kakeya in three and four dimensions",
 "title":{"title":"Kakeya in three and four dimensions","subtitle":r"Claim: every Kakeya set in $\mathbb R^4$ has full dimension, and the 3D Kakeya maximal estimate holds"},
 "object":{"dur":8.8,"panels":[
   {"primitive":"shape","until":3.6,"shapes":needles},
   {"primitive":"numberline","from":3.6,"min":2.8,"max":4.3,
    "ticks":[{"v":3,"label":"3"},{"v":3.5,"label":"$7/2$"},{"v":4,"label":"4"}],
    "axisLabel":r"Hausdorff dimension of a Kakeya set in $\mathbb R^4$",
    "markers":[{"v":3,"label":"Wolff","note":"$3$","at":0.5,"side":"below"},
               {"v":3.059,"label":"Katz–Zahl","note":"$\\ge 3.059$","at":0.9},
               {"v":4,"label":"full","note":"conjectured","style":"ring","tone":"mute","at":1.3,"side":"below"}],
    "slide":{"from":3.059,"to":4,"at":2.2,"dur":1.5,"label":"claimed","note":"dimension 4"}}],
  "beats":[{"at":0.2,"text":"Schematically: a unit segment in every direction, packed into one set"},
   {"at":3.7,"text":r"In $\mathbb R^4$ the best lower bound on its dimension was 3.059"},
   {"at":6.1,"text":"The claim: full dimension 4. In 3D, the maximal-function upgrade"}]},
 "achievement":{"form":"status","label":"The Kakeya conjectures in three and four dimensions",
   "statement":[r"K \subset \mathbb R^4 \text{ Kakeya} \;\Longrightarrow\; \dim_H K = 4",
                r"\|K_\delta f\|_{L^3(S^2)} \le C_\epsilon\, \delta^{-\epsilon} \|f\|_{L^3(\mathbb R^3)}"],
   "context":r"Before: the 3D set conjecture by Wang and Zahl (2025); in $\mathbb R^4$, Katz and Zahl's 3.059",
   "stamp":"proved","note":"No Lean; 272 pages, and the 4D paper uses a lemma from the 3D one"},
 "verify":{"lean":"none","detail":"No Comparator statement; the Lean files only set up tubes and the maximal operator","ourCheck":"We read the review and the article's reading; no proof was checked"},
 "sources":[S("review 074, known_before","Katz–Zahl planebrush Hausdorff ≥ 3.059"),
   S("review 074, known_before","In R^4: Wolff 3"),
   S("article, Kakeya","Before this, the best bound was Katz and Zahl's 3.059."),
   S("article, Kakeya","Hong Wang and Joshua Zahl proved it in February 2025"),
   S("article, Kakeya","Caveats: 272 pages between the two, no Lean, and the four-dimensional paper uses a lemma (a weighted plank bound) from the three-dimensional one."),
   S("review 074, lean","only sets up tubes, the maximal operator and elementary fixed-scale/Hölder lemmas, not the theorem")]})
