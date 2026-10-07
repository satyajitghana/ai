import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, math, os
import sys as _sys; _sys.path.insert(0, GEN); from enrich_ag import enrich
OUT = _OUT
AG = 'Algebraic and complex geometry'
SCH = '../../brand-crew/skills/math-reels/schema.json'
GRADED = {"ref": "article, Algebraic geometry and algebra", "quote": "I graded what each family claims, not whether it is right."}
OURCHECK_GRADED = "We graded the claim, not whether it is right"

def spec(id, kind, short, title, subtitle, obj, ach, verify, sources):
    s = {"$schema": SCH, "id": id, "discipline": AG, "kind": kind, "short": short,
         "title": {"title": title, "subtitle": subtitle}, "object": obj, "achievement": ach,
         "verify": verify, "sources": sources}
    s = enrich(s)
    with open(os.path.join(OUT, id + '.json'), 'w') as f:
        json.dump(s, f, indent=2, ensure_ascii=False)

def A(sec, q): return {"ref": "article, " + sec, "quote": q}
def R(id, field, q): return {"ref": f"review {id}, {field}", "quote": q}

# ---------------------------------------------------------------- 032 Hodge
spec("032", "proof", r"Hodge for CM abelian varieties",
  r"The Hodge conjecture for CM abelian varieties",
  r"Claim: on every CM abelian variety, every rational $(p,p)$ class comes from algebraic cycles",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.9, "lines": [
      {"tex": r"\mathrm{CH}^p(A)_{\mathbb Q} \twoheadrightarrow H^{2p}(A,\mathbb Q)\cap H^{p,p}(A)", "tone": "accent", "at": 0.3, "size": 40},
      {"tex": r"\text{cycles} \;\longrightarrow\; \text{Hodge classes}", "tone": "soft", "at": 1.2, "size": 30}]},
    {"primitive": "tree", "from": 3.9, "nodes": [
      {"id": "t", "label": "Theorem 1.1: every CM Hodge class is algebraic", "status": "paper"},
      {"id": "r", "label": "reduce to one four-factor line, $v_1+v_2=v_3+v_4$", "parent": "t", "status": "paper"},
      {"id": "s", "label": "a ball-quotient surface with a nonzero period", "parent": "t", "status": "paper"},
      {"id": "d", "label": "Deligne 1982: classes are absolute Hodge", "parent": "r", "status": "prior"},
      {"id": "h", "label": "Hecke and Frobenius slopes", "parent": "s", "status": "paper"}]}],
   "beats": [
     {"at": 0.2, "text": "Theorem 1.1: the cycle class map hits every rational $(p,p)$ class"},
     {"at": 4.0, "text": "Every CM Hodge class reduces to one line on a product of four CM varieties"},
     {"at": 6.6, "text": "A surface mapping to all four, with a nonzero period, gives the cycle"}]},
  {"form": "status", "label": "Hodge conjecture (Hodge 1950), the CM abelian case",
   "statement": [r"\mathrm{CH}^p(A)_{\mathbb Q} \twoheadrightarrow H^{2p}(A,\mathbb Q)\cap H^{p,p}(A)"],
   "context": r"Before: Deligne (1982) made the classes absolute Hodge; Markman (2025) settled all abelian fourfolds",
   "stamp": "proved",
   "note": "A special case of Hodge, not the Millennium problem; it implies Tate over $\\mathbb{F}_q$"},
  {"lean": "none", "detail": "Nothing in family 032 is in Lean, and the release says so", "ourCheck": "We followed the outline; Sections 4 to 6 need a specialist"},
  [A("The Hodge conjecture for CM abelian varieties (family 032)", r"Theorem 1.1 says the cycle class map $\mathrm{CH}^p(A)_{\mathbb Q} \to H^{2p}(A,\mathbb Q)\cap H^{p,p}(A)$ is surjective for every CM abelian variety $A$ and every $p$"),
   A("The Hodge conjecture for CM abelian varieties (family 032)", "Deligne proved in 1982 that they are \"absolute Hodge\""),
   A("The Hodge conjecture for CM abelian varieties (family 032)", r"Markman's 2025 preprint (arXiv:2502.03415) made all abelian fourfolds work"),
   A("The Hodge conjecture for CM abelian varieties (family 032)", r"where $v_1+v_2=v_3+v_4$"),
   A("The Hodge conjecture for CM abelian varieties (family 032)", r"Nothing in 032 is in Lean, and the release says so."),
   A("The Hodge conjecture for CM abelian varieties (family 032)", r"I can't judge Sections 4 to 6."),
   R("032", "known_before", "Hodge conjecture (Hodge 1950; Clay Millennium problem)"),
   R("032", "claim", "the Tate conjecture for all abelian varieties over finite fields"),
   R("032", "caveats", "is a special case of the Hodge conjecture, not the Millennium problem")])

# ---------------------------------------------------------------- 033 Iitaka
spec("033", "proof", r"Iitaka's conjecture $C_{n,m}$",
  r"Iitaka's subadditivity conjecture $C_{n,m}$",
  r"Claim: in every fibration $X \to Z$ with general fibre $F$, $\kappa(X) \ge \kappa(F) + \kappa(Z)$",
  {"dur": 8.2, "layout": "sequence", "panels": [
    {"primitive": "shape", "until": 4.1, "shapes": [
      {"kind": "polygon", "points": [[-1.6, -0.15], [1.6, -0.15], [1.6, 1.05], [-1.6, 1.05]], "tone": "soft", "at": 0.2, "dur": 1.0, "label": "$X$", "labelAt": [-1.3, 0.85]},
      {"kind": "polygon", "points": [[0.35, -0.15], [0.39, -0.15], [0.39, 1.05], [0.35, 1.05]], "tone": "accent", "at": 1.2, "dur": 0.8, "label": "fibre $F$", "labelAt": [0.85, 0.45]},
      {"kind": "polygon", "points": [[-1.6, -0.82], [1.6, -0.82], [1.6, -0.78], [-1.6, -0.78]], "tone": "cool", "at": 1.8, "dur": 0.8, "label": "base $Z$", "labelAt": [-2.15, -0.8]}],
     "points": [{"p": [0.37, -0.8], "label": "$z$", "tone": "accent", "at": 2.4}]},
    {"primitive": "equation", "from": 4.1, "lines": [
      {"tex": r"\kappa(X) \;\ge\; \kappa(F) + \kappa(Z)", "tone": "accent", "at": 0.3, "size": 52},
      {"tex": r"\kappa = \text{Kodaira dimension}", "tone": "soft", "at": 1.1, "size": 30}]}],
   "beats": [
     {"at": 0.2, "text": "A fibration $f\\colon X \\to Z$, drawn schematically: one fibre $F$ over each point"},
     {"at": 4.2, "text": "Kodaira dimension should be superadditive along the fibration"},
     {"at": 6.2, "text": "Known for decades only case by case"}]},
  {"form": "status", "label": "Iitaka's subadditivity conjecture (1970s)",
   "statement": [r"\kappa(X) \ge \kappa(F) + \kappa(Z)"],
   "context": "Before: curve bases, general-type bases or fibres, abelian bases, total dimension at most 6 (Birkar 2009)",
   "stamp": "proved",
   "note": "Also Campana's orbifold form; earlier claims by Tsuji and Maehara are not used"},
  {"lean": "part", "detail": "Lean covers only the negative-fibre branch of the additivity paper, a small edge case", "ourCheck": "We read the Lean scope; we did not build it or check the proofs"},
  [R("033", "known_before", "Birkar 2009 (total dim ≤ 6)"),
   R("033", "known_before", "Iitaka's conjecture C_{n,m} (Iitaka 1970s)"),
   R("033", "claim", "κ(X,K_X+D_X) ≥ κ(F,K_F+D_F)+κ(Y,K_Y+D_Y)"),
   A("Iitaka's subadditivity conjecture (family 033)", r"$\kappa(X)\ge\kappa(F)+\kappa(Z)$ for $f\colon X\to Z$ with general fibre $F$"),
   A("Iitaka's subadditivity conjecture (family 033)", "The papers say plainly that earlier preprint claims by Tsuji and Maehara are not used"),
   A("Iitaka's subadditivity conjecture (family 033)", "The Lean side covers only the negative-fibre branch of the additivity paper (`LogKodairaFiberNegative.lean`), which is a small edge case.")])

# ---------------------------------------------------------------- 034 Abundance
spec("034", "proof", "Log abundance in characteristic zero",
  "Log abundance in characteristic zero, every dimension",
  r"Claim: for every lc pair $(X,B)$ in characteristic 0, if $K_X+B$ is nef it is semiample",
  {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "sequence", "until": 3.8, "items": ["1", "2", "3", "4", "5", "6", "7", "8"], "ellipsis": True,
     "marks": {"0": "ok", "1": "ok", "2": "ok", "3": {"tone": "accent", "at": 2.0}, "4": {"tone": "accent", "at": 2.2}, "5": {"tone": "accent", "at": 2.4}, "6": {"tone": "accent", "at": 2.6}, "7": {"tone": "accent", "at": 2.8}},
     "caption": "dimension of $X$: green known before, violet claimed"},
    {"primitive": "tree", "from": 3.8, "nodes": [
      {"id": "a", "label": "Log abundance, char 0 (034)", "status": "paper"},
      {"id": "i", "label": "log Iitaka subadditivity (033)", "parent": "a", "status": "paper"},
      {"id": "m", "label": "minimal models for glc pairs (036)", "parent": "a", "status": "paper"},
      {"id": "s", "label": "signed boundary criterion", "parent": "a", "status": "paper"},
      {"id": "h", "label": "Hacon–Popa–Schnell", "parent": "i", "status": "prior"}]}],
   "beats": [
     {"at": 0.2, "text": "Abundance was known for surfaces and threefolds; from dimension 4, even nonvanishing was open"},
     {"at": 3.9, "text": "The induction imports other release results as finished theorems"},
     {"at": 6.4, "text": "Dashed: unrefereed release papers. Grey: published prior work"}]},
  {"form": "status", "label": "Abundance conjecture (Kawamata, Miyaoka, Shokurov; 1980s)",
   "statement": [r"K_X+B \text{ nef} \;\Longrightarrow\; K_X+B \text{ semiample}"],
   "context": "Before: surfaces, threefolds, and the log general type case (BCHM); open in dimension 4 and up",
   "stamp": "proved",
   "note": "The family has 14 manuscripts and 781 pages, all unrefereed"},
  {"lean": "none", "detail": "Nothing here is in Lean; the Kahler version still lists log subadditivity as an assumption".replace("Kahler", "Kähler"), "ourCheck": OURCHECK_GRADED},
  [A("Log abundance in characteristic zero (family 034)", "The family has 14 manuscripts and 781 pages."),
   A("Log abundance in characteristic zero (family 034)", "In dimension 4 and up, even the first step, nonvanishing, was open."),
   A("Log abundance in characteristic zero (family 034)", "This paper takes log Iitaka subadditivity from family 033 as a finished theorem"),
   R("034", "known_before", "Abundance conjecture (Kawamata, Miyaoka, Shokurov; 1980s)"),
   R("034", "caveats", "the projective headline is unconditional modulo the release's own 033 and 036_2"),
   R("034", "claim", "if K_X+B is nef then it is semiample"),
   R("034", "caveats", "the Kähler paper (034_0, Oct 4) states this as an explicit Assumption 1.1"),
   GRADED])

# ---------------------------------------------------------------- 035 char p threefolds
spec("035", "partial", r"Threefold abundance, $\nu = 1$, char $p > 3$",
  r"Threefold abundance in characteristic $p > 3$, numerical dimension one",
  r"Claim: a nef log canonical threefold adjoint of numerical dimension one is semiample when $p > 3$",
  {"dur": 8.0, "layout": "sequence", "panels": [
    {"primitive": "sequence", "until": 4.2, "items": ["2", "3", "5", "7", "$p$"], "ellipsis": True,
     "marks": {"0": "mute", "1": "mute", "2": {"tone": "warn", "at": 2.0}, "3": {"tone": "accent", "at": 2.3}, "4": {"tone": "accent", "at": 2.5}},
     "caption": "the characteristic $p$: claimed for $p > 3$; amber, $p = 5$, is where to look"},
    {"primitive": "equation", "from": 4.2, "lines": [
      {"tex": r"\nu(K_X+B) = 1 \;\Longrightarrow\; K_X+B \text{ semiample}", "tone": "accent", "at": 0.3, "size": 44},
      {"tex": r"\dim X = 3,\quad \operatorname{char} k = p > 3", "tone": "soft", "at": 1.1, "size": 30}]}],
   "beats": [
     {"at": 0.2, "text": "In characteristic $p$, the threefold MMP is fully established only for $p > 5$"},
     {"at": 4.3, "text": "One numerical case of abundance, transplanted from Miyaoka's complex proof"}]},
  {"form": "status", "label": "Abundance for threefolds in positive characteristic",
   "statement": [r"\nu(K_X+B) = 1,\quad p > 3", r"\Longrightarrow\; K_X+B \text{ semiample}"],
   "context": "Before: the big and $\\nu = 0$ cases for $p > 5$; the $\\nu = 1$ and $\\nu = 2$ cases open",
   "stamp": "partial",
   "note": "A single case of abundance; how the paper handles $p = 5$ should be checked"},
  {"lean": "none", "detail": "No Lean for this family", "ourCheck": OURCHECK_GRADED},
  [R("035", "claim", "over an algebraically closed field of characteristic p > 3"),
   R("035", "known_before", "the ν=1 and ν=2 cases in positive characteristic were open in general"),
   R("035", "caveats", "Relies on the char-p threefold MMP, which is only fully established for p > 5 in the literature"),
   A("Four narrower results", "nef log canonical threefold adjoints of numerical dimension one are semiample when $p>3$"),
   GRADED])

# ---------------------------------------------------------------- 036 minimal models
spec("036", "proof", "Minimal models and generalised abundance",
  "Minimal models for every lc pair, and generalised abundance",
  r"Claim: generalized lc pairs have minimal models or Mori fibre spaces, and $K_X+B+M$ nef is numerically semiample",
  {"dur": 8.2, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.9, "lines": [
      {"tex": r"K_X+B+M \text{ nef} \;\Longrightarrow\; K_X+B+M \equiv \text{semiample}", "tone": "accent", "at": 0.3, "size": 40},
      {"tex": r"(X,B) \text{ klt},\ K_X+B \text{ pseudo-effective},\ M \text{ nef}", "tone": "soft", "at": 1.1, "size": 28}]},
    {"primitive": "tree", "from": 3.9, "nodes": [
      {"id": "g", "label": "Generalised abundance (036)", "status": "paper"},
      {"id": "a", "label": "log abundance (034)", "parent": "g", "status": "paper"},
      {"id": "t", "label": "fourfold termination (056)", "parent": "g", "status": "paper"},
      {"id": "b", "label": "BCHM, log general type (2010)", "parent": "g", "status": "prior"}]}],
   "beats": [
     {"at": 0.2, "text": "Generalised abundance: adding a nef moduli part $M$ does not spoil semiampleness"},
     {"at": 4.0, "text": "The proof uses two other release families as black boxes"},
     {"at": 6.4, "text": "So it stands or falls with families 034 and 056"}]},
  {"form": "status", "label": "Existence of minimal models; generalised abundance",
   "statement": [r"K_X+B+M \text{ nef}", r"\Longrightarrow\; K_X+B+M \equiv \text{semiample}"],
   "context": "Before: minimal models for log general type (BCHM, 2010); low-dimensional cases",
   "stamp": "proved",
   "note": "Existence only: no claim that every MMP terminates"},
  {"lean": "none", "detail": "No Lean for this family", "ourCheck": OURCHECK_GRADED},
  [A("Minimal models and generalised abundance (family 036)", "The generalised abundance paper uses the release's own abundance and termination theorems as black boxes, so it stands or falls with families 034 and 056."),
   R("036", "known_before", "BCHM (JAMS 2010)"),
   R("036", "known_before", "Lazić–Peternell formulated generalised abundance ('On generalised abundance, I', Publ. RIMS 2020) and proved low-dimensional cases"),
   R("036", "caveats", "036_2 is the existence form only ('makes no assertion that every arbitrary MMP terminates')"),
   R("036", "claim", "K_X+B+M is numerically equivalent to a semiample Q-Cartier divisor"),
   GRADED])

# ---------------------------------------------------------------- 037 ODP gap (n = 4 instance)
spec("037", "proof", "The ordinary double point volume gap",
  "The ordinary double point volume gap",
  r"Claim: a singular klt point of an $n$-fold has normalized volume at most $2(n-1)^n$, equal only at an ODP",
  {"dur": 8.4, "primitive": "numberline", "min": 0, "max": 290, "y": 0.6,
   "ticks": [{"v": 0, "label": "0"}, {"v": 162, "label": "$2\\cdot 3^4$"}, {"v": 256, "label": "$4^4$"}],
   "axisLabel": "normalized volume $\\widehat{\\mathrm{vol}}(x,X)$ of a point on a fourfold, $n = 4$",
   "markers": [
     {"v": 256, "label": "smooth point", "note": "$n^n$", "tone": "ok", "at": 0.6},
     {"v": 162, "label": "ordinary double point", "note": "$2(n-1)^n$", "tone": "claim", "at": 2.4},
     {"v": 90, "label": "other klt points", "note": "somewhere below", "tone": "mute", "style": "ring", "at": 3.0}],
   "ranges": [{"from": 162, "to": 256, "label": "the gap", "note": "no singular point here", "at": 4.0, "side": "below", "tone": "hot"}],
   "beats": [
     {"at": 0.2, "text": "Smooth points have the largest normalized volume, $n^n$"},
     {"at": 2.6, "text": "The claim: every singular klt point sits at or below the ordinary double point"},
     {"at": 5.4, "text": "Shown for $n = 4$; the claim covers every dimension $n \\ge 2$"}]},
  {"form": "status", "label": "Spotti–Sun conjecture (2017)",
   "statement": [r"\widehat{\mathrm{vol}}(x,X) \le 2(n-1)^n \quad \text{for singular klt } x"],
   "context": "Before: dimension 3 (Liu–Xu, 2019); dimensions 4 and up open",
   "stamp": "proved",
   "note": "Equality only at the ordinary double point; zero boundary only"},
  {"lean": "none", "detail": "No Lean; the every-dimension proof inducts from a separately proved fourfold case", "ourCheck": OURCHECK_GRADED},
  [R("037", "claim", "the normalized volume vol̂(x,X) ≤ 2(n−1)^n, with equality iff the analytic germ is an ordinary double point"),
   R("037", "known_before", "Smooth points maximize it (n^n; Li–Liu–Xu)"),
   R("037", "known_before", "Spotti–Sun (2017, Pure Appl. Math. Q.)"),
   R("037", "known_before", "Liu–Xu (Duke 2019, 'K-stability of cubic threefolds') proved dimension 3 in general. Dimensions ≥ 4 were open."),
   R("037", "caveats", "Boundary-zero only"),
   R("037", "explainer", "The proof is an induction on dimension starting from a separately proved fourfold case."),
   GRADED])

# ---------------------------------------------------------------- 038 Fujita
spec("038", "proof", r"Fujita's freeness, $m \ge n+1$",
  "Fujita's freeness conjecture",
  r"Claim: on every smooth projective $n$-fold, $K_X + mL$ is globally generated for all $m \ge n+1$",
  {"dur": 8.4, "primitive": "numberline", "min": 0.7, "max": 2.1, "y": 0.6,
   "ticks": [1, 1.5, 2],
   "axisLabel": "the factor $c$ in $m \\ge c\\,n$, for large $n$",
   "markers": [
     {"v": 1.776, "label": "Han", "note": "$\\lceil 1.776\\,n \\rceil$", "at": 0.8},
     {"v": 1, "label": "sharp on $\\mathbb{P}^n$", "note": "$m = n+1$", "style": "ring", "tone": "mute", "at": 1.4, "side": "below"}],
   "slide": {"from": 1.776, "to": 1, "at": 3.0, "dur": 1.5, "label": "claimed $n+1$", "note": "every $n$"},
   "beats": [
     {"at": 0.2, "text": "Fujita: adding $n+1$ copies of any ample $L$ to $K_X$ gives a base-point-free bundle"},
     {"at": 2.8, "text": "Known up to dimension 5; the best general bound was linear, about $1.78\\,n$"},
     {"at": 5.4, "text": "The claim is the sharp bound, in a 25-page paper"}]},
  {"form": "status", "label": "Fujita's freeness conjecture (1987)",
   "statement": [r"K_X + mL \text{ globally generated for all } m \ge n+1"],
   "context": "Before: dimensions up to 5; in general about $1.78\\,n$, after Angehrn–Siu's quadratic bound",
   "stamp": "proved",
   "note": "Freeness only; Fujita's very-ampleness conjecture is not claimed"},
  {"lean": "none", "detail": "No Lean; a previously announced proof by Chan was withdrawn", "ourCheck": OURCHECK_GRADED},
  [R("038", "known_before", "Han (recent preprint, as cited) m ≥ ⌈1.776 n⌉"),
   A("Fujita's freeness conjecture (family 038)", "Fujita conjectured in 1987 that for a smooth projective $n$-fold and any ample $L$, the bundle $K_X+mL$ is globally generated for $m\\ge n+1$."),
   A("Fujita's freeness conjecture (family 038)", "It was known up to dimension 5"),
   A("Fujita's freeness conjecture (family 038)", "In general the best bound was linear, around $1.78\\,n$ in a recent preprint, after Angehrn–Siu's quadratic bound"),
   A("Fujita's freeness conjecture (family 038)", "The paper claims the sharp $n+1$ in 25 pages."),
   A("Fujita's freeness conjecture (family 038)", "It covers only freeness, not Fujita's very-ampleness conjecture."),
   R("038", "known_before", "Chan's announced proof was withdrawn"),
   GRADED])

# ---------------------------------------------------------------- 040 Bloch
spec("040", "proof", r"Bloch's conjecture, $p_g = q = 0$",
  r"Bloch's conjecture for surfaces with $p_g = q = 0$",
  r"Claim: on every surface with $p_g = q = 0$, all points are rationally equivalent: $\mathrm{CH}_0(S) \cong \mathbb{Z}$",
  {"dur": 8.4, "primitive": "tree", "at": 0.4, "nodes": [
     {"id": "r", "label": "$\\deg\\colon \\mathrm{CH}_0(S) \\cong \\mathbb{Z}$", "status": "paper"},
     {"id": "d", "label": "$0 = c[\\Delta_X] + \\Gamma$ in $\\mathrm{CH}^2(X\\times X)_{\\mathbb Q}$", "parent": "r", "status": "paper"},
     {"id": "ro", "label": "Roitman's theorem", "parent": "r", "status": "prior"},
     {"id": "a", "label": "$K^2 \\le 8$: lattice argument", "parent": "d", "status": "paper"},
     {"id": "b", "label": "$K^2 = 9$: Cartwright–Steger", "parent": "d", "status": "paper"}],
   "beats": [
     {"at": 0.2, "text": "A virtual count on Quot schemes gives one identity on $X \\times X$"},
     {"at": 3.0, "text": "Two numerical branches show the diagonal coefficient $c$ is positive"},
     {"at": 5.6, "text": "$K^2 = 9$ covers the fake projective planes: where to look first"}]},
  {"form": "status", "label": "Bloch's conjecture (Bloch 1975)",
   "statement": [r"p_g = q = 0 \;\Longrightarrow\; \deg\colon \mathrm{CH}_0(S) \xrightarrow{\ \sim\ } \mathbb{Z}"],
   "context": "Before: Kodaira dimension below 2 (Bloch–Kas–Lieberman, 1976) and scattered general-type families",
   "stamp": "proved",
   "note": "Integral coefficients; with Bloch–Kas–Lieberman, the full $p_g = 0$ statement"},
  {"lean": "none", "detail": "No Lean; 45 pages", "ourCheck": OURCHECK_GRADED},
  [R("040", "known_before", "Bloch's conjecture (Bloch 1975/1980 'Lectures on algebraic cycles')"),
   A("Bloch's conjecture for surfaces with $p_g=0$ (family 040)", "Bloch, Kas and Lieberman proved it in 1976 for Kodaira dimension below 2."),
   A("Bloch's conjecture for surfaces with $p_g=0$ (family 040)", "a decomposition $0=c[\\Delta_X]+\\Gamma$ in $\\mathrm{CH}^2(X\\times X)_{\\mathbb Q}$"),
   A("Bloch's conjecture for surfaces with $p_g=0$ (family 040)", "using a lattice argument when $K^2\\le8$ and a comparison with Cartwright and Steger's surface when $K^2=9$"),
   A("Bloch's conjecture for surfaces with $p_g=0$ (family 040)", "since $K^2=9$ covers the fake projective planes"),
   R("040", "claim", "deg: CH_0(S) → Z is an isomorphism (integral coefficients)"),
   R("040", "caveats", "45 pp, no Lean"),
   GRADED])

# ---------------------------------------------------------------- 041 HK SYZ
spec("041", "proof", "Hyperkähler SYZ and $\\mathbb{P}^n$ bases",
  "The hyperkähler SYZ conjecture, for every deformation type",
  r"Claim: a nef isotropic line bundle on any hyperkähler manifold gives a Lagrangian fibration over $\mathbb{P}^n$",
  {"dur": 8.2, "layout": "sequence", "panels": [
    {"primitive": "sequence", "until": 4.2, "items": ["$K3^{[n]}$", "$\\mathrm{Kum}_n$", "OG6", "OG10", "$?$"],
     "marks": {"0": "ok", "1": "ok", "2": "ok", "3": "ok", "4": {"tone": "accent", "at": 2.4}},
     "caption": "the four known deformation types were done; the claim covers every type"},
    {"primitive": "equation", "from": 4.2, "lines": [
      {"tex": r"L \text{ nef},\ q(c_1(L)) = 0 \;\Longrightarrow\; X \to B,\ \dim B = n", "tone": "accent", "at": 0.3, "size": 38},
      {"tex": r"B \cong \mathbb{P}^n", "tone": "accent", "at": 1.3, "size": 46}]}],
   "beats": [
     {"at": 0.2, "text": "Known type by type: $K3^{[n]}$, generalized Kummers, OG6 and OG10"},
     {"at": 4.3, "text": "Claimed for all: the fibration exists, and its base is always projective space"}]},
  {"form": "status", "label": "Hyperkähler SYZ conjecture; Matsushita's base question",
   "statement": [r"L \text{ nef},\ q(c_1(L)) = 0 \;\Longrightarrow\; X \to \mathbb{P}^n \text{ Lagrangian}"],
   "context": "Before: the four known deformation types; base $\\mathbb{P}^n$ when it is smooth (Hwang, 2008)",
   "stamp": "proved",
   "note": "With external boundedness: finitely many deformation types per dimension if $b_2 \\ge 5$"},
  {"lean": "none", "detail": "No Lean; the two papers cite each other", "ourCheck": OURCHECK_GRADED},
  [R("041", "known_before", "OG6 and OG10 (Mongardi–Rapagnetta, Mongardi–Onorati)"),
   R("041", "known_before", "Hwang (Invent. Math. 2008) when base smooth"),
   R("041", "claim", "every holomorphic line bundle L with nonzero nef isotropic class (q(c1(L))=0) is semiample, giving a Lagrangian fibration X → B with dim B = n"),
   R("041", "claim", "The base of every Lagrangian fibration of a compact IHS Kähler manifold is isomorphic to P^n"),
   R("041", "caveats", "the finiteness corollary needs b2 ≥ 5 and the external EFGMS boundedness theorem. No Lean."),
   A("Hyperkähler SYZ and Lagrangian bases (family 041)", "The two papers cite each other."),
   GRADED])

# ---------------------------------------------------------------- 042 K3 Oka
lis = [[round(0.92 * math.sin(5 * t + 0.4), 3), round(0.92 * math.sin(6 * t), 3)] for t in [2 * math.pi * i / 240 for i in range(240)]]
spec("042", "proof", "Every K3 surface is Oka",
  "Every K3 surface is an Oka manifold",
  r"Claim: every complex K3 surface, projective or not, is Oka, with dense entire curves through every point",
  {"dur": 8.2, "primitive": "shape", "scale": 1.0, "shapes": [
     {"kind": "superellipse", "p": 4, "r": 1.12, "tone": "soft", "at": 0.2, "dur": 1.0, "fill": False, "label": "$S$", "labelAt": [1.32, 1.0]},
     {"kind": "polygon", "points": lis, "tone": "accent", "at": 1.4, "dur": 3.6, "fill": False, "w": 1.8}],
   "points": [{"p": lis[0], "label": "$f(0)$", "tone": "hot", "at": 1.3}],
   "beats": [
     {"at": 0.2, "text": "A K3 surface $S$, drawn schematically as a square"},
     {"at": 1.6, "text": "An immersed entire curve $f\\colon \\mathbb{C} \\to S$ winding through it, with dense image"},
     {"at": 5.4, "text": "Oka: maps into $S$ are as flexible as maps into $\\mathbb{C}^n$"}]},
  {"form": "status", "label": "Open question: is every K3 surface an Oka manifold?",
   "statement": [r"S \text{ a K3 surface} \;\Longrightarrow\; S \text{ is Oka}"],
   "context": "Before: known only for special K3s, such as elliptic and Kummer types",
   "stamp": "proved",
   "note": "The family title also names class VII, but the theorem is about K3"},
  {"lean": "none", "detail": "No Lean for this family", "ourCheck": OURCHECK_GRADED},
  [R("042", "claim", "Every complex K3 surface (projective or not, any Picard rank) has the convex approximation property, hence is an Oka manifold"),
   R("042", "known_before", "Known for special K3s (elliptic/Kummer types"),
   A("Every K3 surface is Oka (family 042)", "The family title also mentions class VII surfaces, but the paper's theorem is about K3."),
   GRADED])

# ---------------------------------------------------------------- 043 P = W
spec("043", "proof", r"$P = W$ for $\mathrm{SL}_n$, every rank",
  r"$P = W$ for $\mathrm{SL}_n$ in every rank",
  r"Claim: for $\mathrm{SL}_n$ the perverse filtration equals the weight filtration in every composite rank, completing $P = W$",
  {"dur": 8.0, "layout": "sequence", "panels": [
    {"primitive": "sequence", "until": 4.3, "items": ["2", "3", "4", "5", "6", "7", "8", "9"], "ellipsis": True, "index": "",
     "marks": {"0": "cool", "1": "cool", "3": "cool", "5": "cool", "2": {"tone": "accent", "at": 2.2}, "4": {"tone": "accent", "at": 2.4}, "6": {"tone": "accent", "at": 2.6}, "7": {"tone": "accent", "at": 2.8}},
     "caption": "rank $n$: blue, prime ranks (Maulik–Shen); violet, composite ranks, claimed"},
    {"primitive": "equation", "from": 4.3, "lines": [
      {"tex": r"P = W", "tone": "accent", "at": 0.3, "size": 64},
      {"tex": r"\text{perverse filtration (Hitchin)} \;=\; \text{weight filtration (character variety)}", "tone": "soft", "at": 1.1, "size": 26}]}],
   "beats": [
     {"at": 0.2, "text": "For $\\mathrm{SL}_n$, prime ranks were done; composite ranks have hard variant parts"},
     {"at": 4.4, "text": "Topology of the Hitchin fibration matches the Hodge theory of the character variety"}]},
  {"form": "status", "label": "P = W conjecture (de Cataldo–Hausel–Migliorini)",
   "statement": [r"P = W \text{ for } \mathrm{SL}_n,\ \text{every rank } n \ge 2"],
   "context": "Before: rank 2 (2012), $\\mathrm{GL}_n$ (Maulik–Shen; Hausel–Mellit–Minets–Schiffmann), $\\mathrm{SL}_n$ in prime rank",
   "stamp": "proved",
   "note": "Composite ranks are new here; prime ranks are Maulik–Shen's"},
  {"lean": "none", "detail": "No Lean; 39 pages building on the $\\mathrm{GL}_n$ proofs", "ourCheck": OURCHECK_GRADED},
  [R("043", "claim", "this gives P = W for SL_n in every rank n ≥ 2"),
   R("043", "known_before", "de Cataldo–Hausel–Migliorini (Annals 2012) rank 2"),
   R("043", "caveats", "Builds on the GL_n proofs; the new content is the composite-rank variant cohomology. 39 pp. No Lean."),
   A("P = W for $\\mathrm{SL}_n$ (family 043)", "With Maulik–Shen's prime-rank case, this completes fixed-determinant P = W."),
   GRADED])

# ---------------------------------------------------------------- 044 Hikita
spec("044", "proof", "Equivariant Hikita for every quiver",
  "The equivariant Hikita conjecture for every finite quiver",
  "Claim: for any finite quiver, Higgs-branch cohomology equals functions on the Coulomb-branch fixed locus",
  {"dur": 8.0, "layout": "sequence", "panels": [
    {"primitive": "graph", "until": 3.8, "edgeAt": 0.5, "edgeDur": 1.8,
     "nodes": [{"id": "a", "x": 0.2, "y": 0.55, "label": "1"}, {"id": "b", "x": 0.45, "y": 0.25, "label": "2"},
               {"id": "c", "x": 0.7, "y": 0.6, "label": "3"}, {"id": "d", "x": 0.85, "y": 0.25, "label": "4"}],
     "edges": [["a", "b"], ["b", "c"], ["a", "c", {"tone": "accent"}], ["c", "d"], ["b", "d", {"tone": "accent"}]]},
    {"primitive": "equation", "from": 3.8, "lines": [
      {"tex": r"H^*_{\mathrm{eq}}(\text{Nakajima quiver variety}) \;\cong\; \mathbb{C}[\text{Coulomb branch}^{\text{fixed}}]", "tone": "accent", "at": 0.3, "size": 32},
      {"tex": r"\text{Higgs side} \qquad\qquad \text{Coulomb side}", "tone": "soft", "at": 1.1, "size": 26}]}],
   "beats": [
     {"at": 0.2, "text": "A small quiver, schematically; the claim allows any finite quiver, loops and multi-edges too"},
     {"at": 3.9, "text": "Symplectic duality: cohomology on one side, functions on a fixed scheme on the other"},
     {"at": 6.2, "text": "Under a regularity hypothesis on the stability character"}]},
  {"form": "status", "label": "Hikita's conjecture (2017), equivariant form",
   "statement": [r"H^*_{\mathrm{eq}}(\mathfrak{M}) \cong \mathbb{C}[\,\mathcal{C}^{\text{fixed}}\,]"],
   "context": "Before: hypertoric cases, ADE quivers, some affine type A cases",
   "stamp": "proved",
   "note": "Needs a regular stability character"},
  {"lean": "none", "detail": "No Lean; a single 41-page paper", "ourCheck": OURCHECK_GRADED},
  [R("044", "known_before", "Hikita (IMRN 2017) conjecture"),
   R("044", "claim", "Equivariant cohomological Hikita conjecture for arbitrary finite quivers (loops and multi-edges allowed) under a regularity hypothesis on the stability character"),
   R("044", "caveats", "Requires a regular stability character (free action on the stable locus); 41 pp, single paper. No Lean."),
   GRADED])

# ---------------------------------------------------------------- 046 Shafarevich
spec("046", "counterexample", "Shafarevich's convexity conjecture fails",
  "Counterexamples to Shafarevich's conjecture",
  "Claim: a projective surface whose universal cover is not holomorphically convex",
  {"dur": 8.2, "primitive": "venn",
   "sets": [{"label": "$\\pi_1$ linear", "tone": "cool"}, {"label": "cover convex", "tone": "ok"}],
   "regions": [{"set": "A&B", "label": "EKPR 2012", "at": 1.8}, {"set": "A&!B", "label": "none", "at": 2.6, "x": 0.33}],
   "members": [{"x": 0.88, "y": 0.82, "label": "claimed surface", "tone": "hot", "at": 4.0}],
   "beats": [
     {"at": 0.2, "text": "Projective varieties, schematically: linear $\\pi_1$ forces a convex cover (EKPR, 2012)"},
     {"at": 3.8, "text": "The counterexample lives outside both: non-linear $\\pi_1$, cover not convex"},
     {"at": 6.0, "text": "A second example: a fourfold with large $\\pi_1$ whose cover is not Stein"}]},
  {"form": "status", "label": "Shafarevich's holomorphic convexity conjecture (1972)",
   "statement": [r"\widetilde{X} \text{ holomorphically convex for every projective } X"],
   "context": "Claimed: a smooth projective surface, and a fourfold with large $\\pi_1$, that both fail it",
   "stamp": "counterexample",
   "note": "26 pages for the surface; its infinitude argument deserves a careful read"},
  {"lean": "none", "detail": "No Lean for this family", "ourCheck": OURCHECK_GRADED},
  [R("046", "known_before", "Shafarevich conjecture (Shafarevich, Basic Algebraic Geometry, 1972/74)"),
   R("046", "known_before", "Known for linear fundamental groups: Eyssidieux–Katzarkov–Pantev–Ramachandran (Annals 2012)"),
   R("046", "claim", "a smooth connected projective complex SURFACE whose universal cover is not holomorphically convex"),
   R("046", "claim", "a smooth projective fourfold X with large fundamental group (no compact curves upstairs) whose universal cover is not Stein"),
   A("Shafarevich's holomorphic convexity conjecture fails (family 046)", "The first one, 26 pages for a disproof of a famous conjecture, deserves a careful reading of its infinitude argument."),
   GRADED])

# ---------------------------------------------------------------- 047 Zariski cancellation
spec("047", "counterexample", r"Zariski cancellation fails over $\mathbb{C}$",
  r"Zariski cancellation fails over $\mathbb{C}$",
  r"Claim: one polynomial $H$ in five variables gives $A$ with $A[w] \cong \mathbb{C}^{[5]}$ but $A \not\cong \mathbb{C}^{[4]}$",
  {"dur": 8.4, "primitive": "equation", "mode": "stack", "lines": [
      {"tex": "x = s^2+u^3+p^2F", "tone": "soft", "at": 0.3, "size": 32, "y": 0.03},
      {"tex": r"\term{h}{H} = x^2F - (1+2sx)J - p^2J^2 - pu", "tone": "ink", "at": 1.0, "size": 38, "y": 0.19, "terms": {"h": {"label": "one polynomial", "tone": "accent", "mark": "box", "at": 0.6}}},
      {"tex": r"A = \mathbb{C}[p,s,u,F,J]/(H)", "tone": "ink", "at": 2.2, "size": 38, "y": 0.42},
      {"tex": r"\term{a}{A[w] \cong \mathbb{C}^{[5]}} \quad\text{but}\quad \term{b}{A \not\cong \mathbb{C}^{[4]}}", "tone": "accent", "at": 3.4, "size": 42, "y": 0.62, "terms": {"a": {"label": "add a line: flat space", "tone": "ok", "at": 0.6}, "b": {"label": "alone: not flat", "tone": "bad", "at": 1.5}}}],
   "beats": [
     {"at": 0.2, "text": "One explicit hypersurface in $\\mathbb{C}^5$"},
     {"at": 3.0, "text": "Adjoining one variable makes it a polynomial ring"},
     {"at": 5.2, "text": "Yet $A$ itself is not one, so the extra line cannot be cancelled"}]},
  {"form": "status", "label": "Zariski cancellation problem",
   "statement": [r"X \times \mathbb{A}^1 \cong \mathbb{A}^{n+1} \;\Longrightarrow\; X \cong \mathbb{A}^n"],
   "context": "Before: true for complex surfaces (around 1980); false in characteristic $p$ (Gupta, 2014)",
   "stamp": "counterexample",
   "note": "Here $n = 4$; dimension 3 over $\\mathbb{C}$ is still open"},
  {"lean": "main", "detail": "Comparator states the dimension, domain and both isomorphism claims for this $H$", "ourCheck": "We read the Comparator statement; we did not run the checker"},
  [A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "With $x = s^2+u^3+p^2F$"),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "H = x^2F - (1+2sx)J - p^2J^2 - pu"),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "A = \\mathbb C[p,s,u,F,J]/(H)"),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "with $A[w]\\cong\\mathbb C^{[5]}$ but $A\\not\\cong\\mathbb C^{[4]}$"),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "Cancellation asks whether $X\\times\\mathbb A^1\\cong\\mathbb A^{n+1}$ forces $X\\cong\\mathbb A^n$."),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "by Fujita, Miyanishi and Sugie around 1980"),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "Neena Gupta disproved it in positive characteristic in 2014"),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "Dimension 3 over $\\mathbb C$ is still open."),
   A("Zariski cancellation fails over $\\mathbb C$ (family 047)", "The Comparator statement says exactly that, with Krull dimension, `IsDomain` and both isomorphism claims spelled out"),
   R("047", "caveats", "I did not run the checker")])

# ---------------------------------------------------------------- 048 Lipman-Zariski
spec("048", "counterexample", "Lipman–Zariski fails for complex surfaces",
  "A counterexample to Lipman–Zariski in characteristic zero",
  r"Claim: a normal complex surface with free tangent sheaf, $\mathrm{Der}_{\mathbb{C}}(A) \cong A^2$, that is not smooth",
  {"dur": 8.0, "primitive": "equation", "mode": "replace", "lines": [
      {"tex": r"\term{d}{\mathrm{Der}_{\mathbb{C}}(A) \text{ free}} \;\overset{?}{\Longrightarrow}\; \term{s}{A \text{ smooth}}", "tone": "ink", "at": 0.3, "size": 44, "y": 0.3, "note": "Lipman (1965): free tangent sheaf already forces normality", "terms": {"d": {"label": "vector fields: a free module", "tone": "cool", "at": 0.8}, "s": {"label": "no singular point", "tone": "ok", "at": 1.6}}},
      {"tex": r"\term{f}{\mathrm{Der}_{\mathbb{C}}(A) \cong A^2},\qquad \term{n}{A_{\mathfrak m} \text{ not regular}}", "tone": "accent", "at": 3.9, "size": 44, "y": 0.3, "note": "one isolated Gorenstein singular point", "terms": {"f": {"label": "free, rank two", "tone": "ok", "at": 0.6}, "n": {"label": "a singular point", "tone": "bad", "at": 1.3, "visual": {"kind": "shape", "shape": "superellipse", "p": 0.55, "w": 120, "h": 80}}}}],
   "beats": [
     {"at": 0.2, "text": "If the vector fields form a free module of the right rank, is the variety smooth?"},
     {"at": 3.9, "text": "The claim: a surface over $\\mathbb{C}$ where the answer is no"},
     {"at": 6.0, "text": "Built analytically first, then algebraized"}]},
  {"form": "status", "label": "Lipman–Zariski conjecture (1965)",
   "statement": [r"\mathrm{Der}_{\mathbb{C}}(A) \text{ free} \;\Longrightarrow\; A \text{ smooth}"],
   "context": "Before: true for hypersurfaces, lci, klt and log canonical spaces; fails in char $p$ for $xy = z^p$",
   "stamp": "counterexample",
   "note": "Necessarily not log canonical, consistent with what was known"},
  {"lean": "none", "detail": "No Lean; 37 pages", "ourCheck": OURCHECK_GRADED},
  [R("048", "known_before", "Lipman–Zariski conjecture (Lipman, Amer. J. Math. 1965)"),
   R("048", "claim", "Der_C(A) ≅ A² free but A_m not regular; the singularity is an isolated Gorenstein surface singularity"),
   A("Lipman–Zariski fails for surfaces (family 048)", "Lipman showed in 1965 that a free tangent sheaf forces normality"),
   A("Lipman–Zariski fails for surfaces (family 048)", "In characteristic $p$ it fails already for $xy=z^p$."),
   A("Lipman–Zariski fails for surfaces (family 048)", "It is necessarily not log canonical, which is consistent with what was known."),
   R("048", "caveats", "Built first analytically then algebraized via completed local ring; 37 pp; no Lean."),
   GRADED])

# ---------------------------------------------------------------- 049 Abhyankar-Sathaye
spec("049", "counterexample", "Abhyankar–Sathaye fails in four variables",
  "The Abhyankar–Sathaye conjecture fails in four variables",
  r"Claim: an explicit $F$ in $\mathbb{C}[h,u,v,w]$ whose zero set is $\mathbb{C}^3$, yet $F$ is not a coordinate",
  {"dur": 8.6, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 4.6, "lines": [
      {"tex": r"x = u^3 + hv,\qquad y = -u^2 + hw", "tone": "soft", "at": 0.3, "size": 34, "y": 0.06},
      {"tex": r"x^2 + y^3 = h\,s", "tone": "soft", "at": 1.1, "size": 34, "y": 0.27},
      {"tex": r"F = h - p - 1,\qquad \term{q}{\mathbb{C}[h,u,v,w]/(F) \cong \mathbb{C}^{[3]}}", "tone": "accent", "at": 2.2, "size": 38, "y": 0.5, "terms": {"q": {"label": "zero set: a flat 3-space", "tone": "ok", "at": 0.8}}}]},
    {"primitive": "equation", "from": 4.6, "lines": [
      {"tex": r"\term{g}{\nabla F}\big(2,0,-\tfrac12,\tfrac12\big) = \term{z}{0}", "tone": "ink", "at": 0.3, "size": 48, "y": 0.22, "terms": {"g": {"label": "all four slopes", "tone": "hot", "at": 0.5}, "z": {"label": "vanish here", "tone": "bad", "at": 0.9, "visual": {"kind": "curve", "f": "(x-0.5)*(x-0.5)", "x": [0, 1], "y": [-0.02, 0.3], "ref": 0, "w": 150, "h": 70}}}},
      {"tex": r"\text{a coordinate's gradient never vanishes}", "tone": "soft", "at": 1.6, "size": 30, "y": 0.85}]}],
   "beats": [
     {"at": 0.2, "text": "Perturb the cusp $(u^3,-u^2)$; the zero set of $F$ is a copy of affine 3-space"},
     {"at": 4.7, "text": "Expanded, $F$ has 69 terms and degree 17, and its gradient vanishes at one point"},
     {"at": 6.8, "text": "So no automorphism sends a variable to $F$"}]},
  {"form": "status", "label": "Abhyankar–Sathaye embedding conjecture (1970s)",
   "statement": [r"\mathbb{C}[x]/(F) \cong \mathbb{C}^{[n-1]} \;\Longrightarrow\; F \text{ is a coordinate}"],
   "context": "Before: true for lines in the plane (Abhyankar–Moh–Suzuki); open for $n \\ge 3$ for fifty years",
   "stamp": "counterexample",
   "note": "Every $n \\ge 4$; the original question in three variables is untouched"},
  {"lean": "main", "detail": "Lean: $\\mathbb{C}[x]/(F) \\cong \\mathbb{C}^{[n-1]}$ and no automorphism sends a variable to $F$", "ourCheck": "We expanded $F$ exactly and found $\\nabla F = 0$; we did not build the Lean"},
  [A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "x = u^3 + hv,\\qquad y = -u^2 + hw,\\qquad x^2 + y^3 = h\\,s,"),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "Put $p = -2s^2x + 3sy^2 - 3s^3y$ and $F = h - p - 1$. The paper proves $\\mathbb C[h,u,v,w]/(F)\\cong\\mathbb C^{[3]}$"),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "But $\\nabla F = 0$ at $(2,0,-\\tfrac12,\\tfrac12)$"),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "so a coordinate's gradient never vanishes"),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "It has 69 terms and degree 17"),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "Start from the cusp $(u^3,-u^2)$ and perturb it"),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "It has been open for $n\\ge 3$ for fifty years"),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "The original question in three variables, a plane in 3-space, is untouched."),
   A("The Abhyankar–Sathaye conjecture fails in four variables (family 049)", "I expanded $F$ in exact rational arithmetic to check that half myself."),
   R("049", "known_before", "open since the 1970s"),
   R("049", "caveats", "I did not run the checker")])

# ---------------------------------------------------------------- 050 Griffiths
spec("050", "counterexample", "Griffiths' positivity conjecture fails",
  "A counterexample to Griffiths' positivity conjecture",
  r"Claim: rank-2 bundles $E_m$ on $\mathbb{P}^1 \times \mathbb{P}^1$ that are ample but carry no Griffiths-positive metric",
  {"dur": 8.2, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 3.9, "lines": [
      {"tex": r"E_m = f_m^*G \otimes \mathcal{O}(1,1)", "tone": "accent", "at": 0.3, "size": 48},
      {"tex": r"f_m = m\text{-th power map on } \mathbb{P}^1 \times \mathbb{P}^1", "tone": "soft", "at": 1.1, "size": 30}]},
    {"primitive": "sequence", "from": 3.9, "items": ["$E_1$", "$E_2$", "$E_3$", "$E_4$", "$E_5$", "$E_6$", "$E_7$"], "ellipsis": True,
     "marks": {"0": "ok", "1": "ok", "2": "ok", "3": "ok", "4": "ok", "5": "ok", "6": "ok"},
     "caption": "all ample; for $m \\ge m_0$ none has a Griffiths-positive metric"}],
   "beats": [
     {"at": 0.2, "text": "Pull one bundle $G$ back by higher and higher power maps"},
     {"at": 4.0, "text": "Ampleness persists for every $m$"},
     {"at": 6.0, "text": "A curvature obstruction at a point eventually rules out every positive metric"}]},
  {"form": "status", "label": "Griffiths' positivity question (1969)",
   "statement": [r"E \text{ ample} \;\Longrightarrow\; E \text{ has a Griffiths-positive metric}"],
   "context": "Before: true for line bundles and on curves; widely believed true in general",
   "stamp": "counterexample",
   "note": "$m_0$ comes from a compactness argument and is not explicit"},
  {"lean": "main", "detail": "Lean states it with custom definitions of ampleness and Hermitian metrics, which need an audit", "ourCheck": "We did not read the 181-line challenge file in full"},
  [R("050", "claim", "E_m = f_m^*G ⊗ O(1,1) (f_m = m-th power map) is ample for all m ≥ 1 but admits no smooth Hermitian metric with strictly Griffiths-positive curvature for all m ≥ m0 (m0 ineffective)"),
   R("050", "known_before", "Griffiths (1969, 'Hermitian differential geometry, Chern classes and positive vector bundles', Problem 0.9)"),
   R("050", "known_before", "Widely believed TRUE before this."),
   R("050", "caveats", "I did not read the 181-line challenge file in full"),
   A("Griffiths' positivity conjecture fails (family 050)", "with $m_0$ coming from a compactness argument and not explicit"),
   A("Griffiths' positivity conjecture fails (family 050)", "It holds for line bundles and on curves"),
   A("Griffiths' positivity conjecture fails (family 050)", "A Lean statement about Hermitian metrics and ampleness needs custom definitions, and those deserve an audit")])

# ---------------------------------------------------------------- 051 Kobayashi
spec("051", "proof", "Kobayashi's canonical ampleness conjecture",
  "Kobayashi's canonical ampleness conjecture",
  r"Claim: every compact Kähler manifold with no entire curves $\mathbb{C} \to X$ has ample canonical bundle",
  {"dur": 8.4, "primitive": "tree", "at": 0.3, "nodes": [
     {"id": "k", "label": "Kobayashi: hyperbolic $\\Rightarrow K_X$ ample", "status": "paper"},
     {"id": "f", "label": "Fujita freeness (038)", "parent": "k", "status": "paper"},
     {"id": "s", "label": "semialgebraic covers (058)", "parent": "k", "status": "paper"},
     {"id": "b", "label": "Brody's derivative bounds", "parent": "k", "status": "prior"},
     {"id": "a", "label": "log abundance (034)", "parent": "s", "status": "paper"},
     {"id": "c", "label": "abelianity (057)", "parent": "s", "status": "paper"}],
   "beats": [
     {"at": 0.2, "text": "What the proof rests on, bottom up"},
     {"at": 2.8, "text": "Four of its inputs are other unrefereed results from the same release"},
     {"at": 5.6, "text": "No curvature hypothesis at all, unlike every earlier result"}]},
  {"form": "status", "label": "Kobayashi's conjecture (1970)",
   "statement": [r"X \text{ compact K\"ahler, Brody hyperbolic}", r"\Longrightarrow\; K_X \text{ ample}"],
   "context": "Before: only with a curvature hypothesis (Wu–Yau 2016, Tosatti–Yang, Diverio–Trapani)",
   "stamp": "proved",
   "note": "Downstream of the least-checked parts of the release"},
  {"lean": "none", "detail": "No Lean; 31 pages", "ourCheck": OURCHECK_GRADED},
  [R("051", "known_before", "Kobayashi's conjecture (Kobayashi 1970"),
   R("051", "known_before", "Wu–Yau (Invent. Math. 2016, negative holomorphic sectional curvature)"),
   R("051", "caveats", "Uses two other release results as inputs: Fujita freeness (038, Corollary 6.3) and the semialgebraic-universal-cover theorem (058), which itself uses the release's log abundance (034_3) and abelianity (057)"),
   R("051", "caveats", "31 pp; no Lean."),
   A("Kobayashi's canonical ampleness conjecture (family 051)", "That puts it downstream of the least-checked parts of the release."),
   GRADED])
print('ok')
