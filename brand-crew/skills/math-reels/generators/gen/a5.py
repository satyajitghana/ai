import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
exec(open(_o.path.join(GEN, 'gen', 'common.py')).read())
E=r"$\text{Erd\H{o}s}$"
# ---------------- 084 Erdos similarity
x0,s0=0.2,0.6
copy=[x0+s0*2**-n for n in range(1,5)]
gaps=[(0.335,0.365),(0.615,0.635),(0.86,0.875),(0.09,0.105)]
ranges=[]; edges=[0.0]
segs=[]; prev=0.0
for a,b in sorted(gaps):
    segs.append((prev,a)); prev=b
segs.append((prev,1.0))
for k,(a,b) in enumerate(segs):
    r={"from":a,"to":b,"tone":"accent","at":0.6+0.15*k,"side":"below","derived":"schematic set, gaps placed by hand"}
    if k==3: r.update({"label":"$E$","note":"nearly full measure","side":"below"})
    ranges.append(r)
markers=[]
for n,v in enumerate(copy):
    m={"v":round(v,6),"tone":"hot" if n==1 else "soft","at":3.4+0.25*n,"derived":"x + s 2^-n, x = 0.2, s = 0.6"}
    if n==0: m.update({"label":"a copy","note":r"$x + s\,2^{-n}$"})
    if n==1: m.update({"label":"in a gap","note":r"misses $E$","tone":"hot"})
    markers.append(m)
W({"id":"084","discipline":RCA,"kind":"partial","short":"Erdős similarity: geometric sequences".replace("Erdős","$\\text{Erd\\H{o}s}$"),
 "title":{"title":E+" similarity conjecture for geometric sequences","subtitle":r"Claim: for every ratio $q$, a set of measure near 1 in $[0,1]$ contains no scaled, shifted copy of $\{q^n\}$"},
 "object":{"dur":8.6,"primitive":"numberline","min":0,"max":1,"y":0.55,
   "ticks":[{"v":0,"label":"0"},{"v":0.5,"label":"$1/2$"},{"v":1,"label":"1"}],
   "ranges":ranges,"markers":markers,
   "beats":[{"at":0.2,"text":E+r" (1974): can a big set avoid every copy of $\{1/2, 1/4, 1/8, \dots\}$?"},
    {"at":3.2,"text":"Schematic: $E$ fills most of $[0,1]$, with small gaps placed by a random routing tree"},
    {"at":6.0,"text":"Shift and scale the sequence anywhere: one of its points lands in a gap"}]},
 "achievement":{"form":"status","label":"The similarity conjecture (1974), geometric case",
   "statement":[r"\forall q \in (0,1)\ \exists E \subset [0,1],\ |E| > 1-\eta,\ x + s\{q^n\} \not\subset E"],
   "context":r"Open for fifty years even for $\{1/2, 1/4, 1/8, \dots\}$","stamp":"partial",
   "note":r"Geometric sequences only, and $E$ depends on $q$; the full conjecture is untouched"},
 "verify":{"lean":"part","detail":r"Lean covers only the dyadic case $q = 1/2$; the general-$q$ paper is not formalized","ourCheck":"We read the review and the article; we did not run Comparator"},
 "sources":[S("article, Erdős similarity","Erdős asked in 1974 whether every infinite set $A$ can be \"avoided\""),
   S("article, Erdős similarity","Even $A = \\lbrace 1/2, 1/4, 1/8, \\dots\\rbrace$ was open for fifty years"),
   S("article, Erdős similarity","The set depends on $q$, and the full conjecture for all infinite sets is untouched."),
   S("review 084, lean","partial formalization — only the dyadic case"),
   S("review 084, lean","The general-q paper (Oct 5, 2026) is not formalized per lean/docs/084.md.")]})

# ---------------- 085 disk maximal
F="max(0,1-abs(t))+0.6*max(0,1-abs(t-3)/0.5)"
MF="(()=>{const f=t=>"+F+";let m=f(x);for(let i=1;i<=50;i++){const r=i*0.12;let s=0;for(let k=0;k<30;k++){s+=f(x-r+(k+0.5)*2*r/30)}m=max(m,s/30)}return m})()"
W({"id":"085","discipline":RCA,"kind":"partial","short":"Disk maximal function in $W^{1,1}$",
 "title":{"title":"The centered disk maximal function in $W^{1,1}$","subtitle":r"Claim: for $f \in W^{1,1}(\mathbb R^2)$, $\|\nabla Mf\|_{L^1} \le C\,\|\nabla f\|_{L^1}$ for centered disk averages"},
 "object":{"dur":8.4,"primitive":"plot","x":[-3,5],"y":[0,1.15],"labelRoom":120,
   "xticks":[{"v":0,"label":"0"}],"yticks":[{"v":1,"label":"1"}],"xlabel":"$x$, one dimension for illustration",
   "curves":[{"f":"(t=>"+F+")(x)","tone":"soft","label":"$f$","at":0.5,"dur":1.4,"labelDy":10},
             {"f":MF,"tone":"accent","label":"$Mf$","at":2.8,"dur":2.0,"labelDy":-10}],
   "regions":[{"f":MF,"f2":"(t=>"+F+")(x)","at":5.0}],
   "beats":[{"at":0.2,"text":"A function $f$, drawn in one dimension for illustration"},
    {"at":2.7,"text":"$Mf(x)$ is the largest average of $|f|$ over intervals centered at $x$: computed here"},
    {"at":5.6,"text":"The claim, for planar disks: $Mf$ has at most $C$ times the total slope of $f$"}]},
 "achievement":{"form":"status","label":"Sobolev endpoint question for maximal functions (2004)",
   "statement":[r"\|\nabla Mf\|_{L^1(\mathbb R^2)} \le C\,\|\nabla f\|_{L^1(\mathbb R^2)}"],
   "context":r"Before: $W^{1,p}$ for $p > 1$ (Kinnunen, 1997), and the centered case in 1D (Kurka, 2015)","stamp":"partial",
   "note":"Planar centered disks only; not higher dimensions or uncentered averages"},
 "verify":{"lean":"main","detail":r"The endpoint theorem for $W^{1,1}$ inputs is in Lean; the BV extension is excluded","ourCheck":"We computed the 1D curves shown; we did not run Comparator"},
 "sources":[S("review 085, known_before","Question of Hajłasz and Onninen (2004, Ann. Acad. Sci. Fenn. Math., 'On boundedness of maximal functions in Sobolev spaces', Question 1). Kinnunen (1997) handled W^{1,p}, p>1."),
   S("review 085, known_before","Kurka (centered, 1D, 2015)"),
   S("review 085, caveats","Only the planar centered-disk case of the Hajłasz-Onninen question; higher dimensions and the uncentered/other-shape cases are not claimed"),
   S("review 085, lean","BV extension excluded per lean/docs/085.md.")]})

# ---------------- 086 trilinear Hilbert
W({"id":"086","discipline":RCA,"kind":"partial","short":"The trilinear Hilbert transform",
 "title":{"title":"A first $L^p$ bound for the trilinear Hilbert transform","subtitle":r"Claim: $\mathrm{p.v.}\int f_1(x-t)\,f_2(x-2t)\,f_3(x-3t)\,dt/t$ is bounded $L^3 \times L^3 \times L^3 \to L^1$"},
 "object":{"dur":8.4,"panels":[
   {"primitive":"numberline","min":-0.5,"max":3.6,"until":4.0,"y":0.55,"arrow":False,
    "markers":[{"v":3,"label":"$x$","tone":"ink","at":0.5},{"v":2,"label":"$x-t$","note":"$f_1$","tone":"accent","at":0.9},
               {"v":1,"label":"$x-2t$","note":"$f_2$","tone":"cool","at":1.3},{"v":0,"label":"$x-3t$","note":"$f_3$","tone":"warn","at":1.7}]},
   {"primitive":"equation","from":4.0,"mode":"stack","lines":[
     {"tex":r"\int f_1(x-t)\,f_2(x-2t)\,\tfrac{dt}{t}","note":"bilinear: bounded, 1997","tone":"soft","at":0.3,"size":36},
     {"tex":r"\int f_1(x-t)\,f_2(x-2t)\,f_3(x-3t)\,\tfrac{dt}{t}","note":"trilinear: no bound","tone":"ink","at":1.2,"size":36}]}],
  "beats":[{"at":0.2,"text":"Three functions read at a four-term progression with common gap $t$"},
   {"at":4.1,"text":"Two functions were tamed by Lacey and Thiele; the third brings in quadratic structure"},
   {"at":6.3,"text":r"The claim: a bound at $L^3 \times L^3 \times L^3 \to L^1$, the first at any exponent"}]},
 "achievement":{"form":"status","label":"Trilinear Hilbert transform, one exponent tuple",
   "statement":[r"\|T(f_1,f_2,f_3)\|_{L^1} \le C\,\|f_1\|_{L^3}\|f_2\|_{L^3}\|f_3\|_{L^3}"],
   "context":"Before: no $L^p$ bound at any exponent; only sublogarithmic gains (Tao, 2016)","stamp":"partial",
   "note":"93 pages, no Lean, dated the day before the release"},
 "verify":{"lean":"none","detail":"No Comparator statement and no Lean formalization for this family","ourCheck":"We read the review and the article; no proof was checked"},
 "sources":[S("review 086, known_before","Bilinear Hilbert transform bounded by Lacey-Thiele (Annals 1997, 1999)."),
   S("review 086, known_before","Tao (2016, 'Cancellation for the multilinear Hilbert transform') got only sublogarithmic improvement of truncation bounds"),
   S("article, trilinear Hilbert transform","93 pages, no Lean, dated the day before the release"),
   S("review 086, lean","none — no lean/docs/086.md, no comparator challenge, no formalization.yaml entry.")]})
