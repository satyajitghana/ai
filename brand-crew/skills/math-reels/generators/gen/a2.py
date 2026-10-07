import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, math
exec(open(_o.path.join(GEN, 'gen', 'common.py')).read())
# ---------------- 075 L log L
rings=[("$L^2$ · Carleson 1966",0.75,0.3,"soft",False),("$L^p,\\ p>1$ · Hunt 1968",1.3,0.55,"soft",False),
       ("$L\\log L\\log\\log\\log L$ · Antonov 1996",2.0,0.8,"soft",False),("$L\\log L$ · the claim",2.45,1.03,"accent",False),
       ("$L^1$ · fails, Kolmogorov",2.85,1.25,"bad",True)]
shapes=[]
for i,(lab,rx,ry,tn,dash) in enumerate(rings):
    shapes.append({"kind":"ellipse","rx":rx,"ry":ry,"tone":tn,"dash":dash,"fill":tn=="accent","fillA":0.1,"label":lab,"labelAt":[0,0] if i==0 else [0,round(ry-0.13,3)],
                   "at":[0.3,1.0,1.7,5.6,3.0][i],"dur":0.9})
W({"id":"075","discipline":RCA,"kind":"proof","short":r"Fourier series of $L\log L$ functions",
 "title":{"title":r"Fourier series converge almost everywhere in $L\log L$","subtitle":r"Claim: for every $f$ with $\int |f|\log(2+|f|) < \infty$, the partial sums $S_N f \to f$ almost everywhere"},
 "object":{"dur":8.4,"primitive":"shape","shapes":shapes,"beats":[
   {"at":0.2,"text":"Each ring is a space of functions whose Fourier series converge almost everywhere"},
   {"at":2.9,"text":r"Kolmogorov: in $L^1$ they can diverge. The known rings crept toward it"},
   {"at":5.5,"text":r"The claim: the natural boundary, $L\log L$, is a convergence space too"}]},
 "achievement":{"form":"status","label":"The L log L conjecture, recorded by Lie",
   "statement":[r"f \in L\log L(\mathbb T) \;\Longrightarrow\; S_N f(x) \to f(x) \text{ for a.e. } x"],
   "context":r"Before: $L\log L\log\log\log L$ (Antonov, 1996)","stamp":"proved",
   "note":"No Lean; 76 pages of an entropy method far from time-frequency analysis"},
 "verify":{"lean":"none","detail":"No Comparator file and no Lean development for this family","ourCheck":"We read the review and the article; no proof was checked"},
 "sources":[S("review 075, known_before","Carleson (1966) L^2; Hunt (1968) L^p, p>1; Kolmogorov's L^1 counterexample (1923/26)."),
   S("review 075, known_before","Antonov (1996) L log L log log log L"),
   S("article, L log L","It is 76 pages with no Lean, and I can't tell which."),
   S("review 075, lean","none — no lean/docs/075.md, no comparator file, no matching Lean directory found.")]})

# ---------------- 076 Littlewood
RS="(()=>{let p=[1],q=[1];while(p.length<32){const a=p.concat(q),b=p.concat(q.map(v=>-v));p=a;q=b}let re=0,im=0;for(let k=0;k<32;k++){re+=p[k]*cos(k*x);im+=p[k]*sin(k*x)}return sqrt(re*re+im*im)/sqrt(32)})()"
W({"id":"076","discipline":RCA,"kind":"disproof","short":"Ultraflat Littlewood polynomials",
 "title":{"title":r"Ultraflat $\pm 1$ polynomials exist","subtitle":r"Claim: for every $\varepsilon$ and large $N$, a $\pm1$ polynomial with $(1-\varepsilon)\sqrt N \le |P| \le (1+\varepsilon)\sqrt N$ on the circle"},
 "object":{"dur":8.6,"primitive":"plot","x":[0,6.2832],"y":[0,1.6],"labelRoom":190,
   "xticks":[{"v":0,"label":"0"},{"v":3.1416,"label":r"$\pi$"},{"v":6.2832,"label":r"$2\pi$"}],
   "yticks":[{"v":1,"label":r"$\sqrt N$"},{"v":1.4142,"label":r"$\sqrt{2N}$"}],
   "xlabel":r"$\theta$, around the unit circle","ylabel":r"$|P(e^{i\theta})|$",
   "regions":[{"f":"1.1","f2":"0.9","at":4.2}],
   "curves":[{"f":RS,"tone":"soft","w":2,"at":0.5,"dur":2.6,"label":"Rudin–Shapiro"},
             {"f":"1.1","tone":"accent","dash":True,"at":4.0,"dur":1.0,"label":r"$(1+\varepsilon)\sqrt N$","labelDy":-8},
             {"f":"0.9","tone":"accent","dash":True,"at":4.3,"dur":1.0,"label":r"$(1-\varepsilon)\sqrt N$","labelDy":8}],
   "beats":[{"at":0.2,"text":r"A real $\pm1$ polynomial on the circle: its average size is $\sqrt N$"},
    {"at":3.3,"text":r"Rudin–Shapiro signs stay under $\sqrt{2N}$, but swing far from $\sqrt N$"},
    {"at":5.9,"text":r"The claim: for every $\varepsilon$, some $\pm1$ signing stays inside the band"}]},
 "achievement":{"form":"status","label":"A fixed gap for every ±1 polynomial (conjectured)",
   "statement":[r"\max_{|z|=1} |P(z)| \ge (1+c)\sqrt N"],
   "context":r"Conjectured by $\text{Erd\H{o}s}$. Before: flat only within constant factors (Annals 2020)",
   "stamp":"disproved","note":"Existential, no rate or algorithm; el Abdalaoui (2025) claims the opposite"},
 "verify":{"lean":"part","detail":r"Lean: $\max|P| \le (1+\eta)\sqrt N$ and finite-$p$ flatness. Not the two-sided theorem","ourCheck":"We computed the Rudin–Shapiro curve shown; we did not run Comparator"},
 "sources":[S("review 076, known_before","Balister–Bollobás–Morris–Sahasrabudhe–Tiba, 'Flat Littlewood polynomials exist' (Annals 2020) gives c1√N ≤ |P| ≤ c2√N."),
   S("review 076, known_before","Rudin–Shapiro gives max ≤ √(2N)"),
   S("review 076, known_before","Contrary claim: el Abdalaoui (arXiv:2504.21499, 2025) asserts Littlewood polynomials are not L^α-flat for even α ≥ 4 and no ultraflat sequence exists"),
   S("review 076, claim","Existential, no rate, no algorithm."),
   S("review 076, lean","NOT formalized: the two-sided ultraflat theorem (3), the √N/16 lower bound (2), and the merit-factor/Morse-shift consequences."),
   S("review 076, known_before","Erdős conjectured max|P| ≥ (1+c)√N.")]})

# ---------------- 077 restriction
W({"id":"077","discipline":RCA,"kind":"proof","short":"Fourier restriction in three dimensions",
 "title":{"title":"Fourier restriction for curved surfaces in three dimensions","subtitle":r"Claim: Fourier extension from a positively curved surface in $\mathbb R^3$ is bounded into $L^p$ for every $p > 3$"},
 "object":{"dur":8.4,"primitive":"numberline","min":2.85,"max":4.15,
   "ticks":[{"v":3,"label":"3"},{"v":3.142857,"label":"$22/7$"},{"v":3.25,"label":"$13/4$"},{"v":4,"label":"4"}],
   "axisLabel":r"the exponent $p$ in $\|Eg\|_{L^p(\mathbb R^3)}$",
   "markers":[{"v":4,"label":"Tomas–Stein","note":r"$L^2 \to L^4$","at":0.8},
              {"v":3.25,"label":"Guth","note":"2016","at":1.6,"derived":"13/4"},
              {"v":3.142857,"label":"Wang–Wu","note":r"$p > 22/7$","at":2.4,"side":"below","derived":"22/7"},
              {"v":3,"label":"conjectured","note":"$p > 3$","style":"ring","tone":"mute","at":3.0,"side":"below"}],
   "slide":{"from":3.142857,"to":3,"at":5.2,"dur":1.5,"label":"claimed","note":"every $p > 3$","derived":"22/7 to 3"},
   "beats":[{"at":0.2,"text":"Extend a function off a curved surface by Fourier transform: which $L^p$ does it reach?"},
    {"at":2.7,"text":r"The human record was $p > 22/7$, after Guth's $13/4$"},
    {"at":5.1,"text":r"The claim closes the range to every $p > 3$, for the sphere and every positively curved surface"}]},
 "achievement":{"form":"bound","before":{"label":"Best known, Wang–Wu","tex":r"p > \tfrac{22}{7}","note":"positively curved surfaces in $\\mathbb R^3$"},
   "after":{"label":"Claimed, 24 Sep 2026","tex":"p > 3","note":"sphere and every surface with definite second form"},
   "note":"No Lean; it uses the 3D Kakeya maximal theorem from family 074"},
 "verify":{"lean":"none","detail":"No Comparator statement; the Lean files hold only surface scaffolding","ourCheck":"We read the review and the article; no proof was checked"},
 "sources":[S("article, Fourier restriction","The human record was the Wang–Wu bound $p > 22/7$ ([arXiv:2411.08871](https://arxiv.org/abs/2411.08871)), after Guth's polynomial partitioning reached $13/4$."),
   S("review 077, known_before","Guth polynomial partitioning p>13/4 (JAMS 2016)"),
   S("review 077, known_before","Tomas–Stein L^2→L^4."),
   S("review 077, known_before","Wang–Wu (arXiv:2411.08871) p>22/7"),
   S("article, Fourier restriction","the general-surface paper plugs in the 3D Kakeya maximal theorem from family 074"),
   S("catalogue, family 077 manuscript path","Elliptic-capacity-propagation-and-Fourier-restriction-to-the-sphere-September-24-2026"),
   S("review 077, lean","contains only surface/chart scaffolding")]})
