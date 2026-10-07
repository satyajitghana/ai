import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, os
import sys as _sys, os as _os; _sys.path.insert(0, _o.path.join(GEN, 'gen-gt')); from enrich_gt import enrich  # plain, proof, voice, visualised equations
OUT = _OUT
S = {}
TOPO = "Topology"
LEAN_NOT_BUILT = {"ref": "review {id}, caveats", "quote": "I did not build the Lean library (no compilation allowed), so 'formalized' means the release ships a sorry-free, axiom-free (propext/Quot.sound/Classical.choice only) proof whose Comparator statement I read."}

def base(id, kind, short, title, subtitle):
    return {"$schema": "../../brand-crew/skills/math-reels/schema.json", "id": id, "discipline": TOPO, "kind": kind,
            "short": short, "title": {"title": title, "subtitle": subtitle}}

# ------------------------------------------------------------------ 304
s = base("304", "proof", "Hilbert–Smith in every dimension",
         "The Hilbert–Smith conjecture in every dimension",
         r"Claim: a locally compact group acting faithfully on a connected $n$-manifold is a Lie group, for every $n$")
s["object"] = {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "numberline", "until": 4.2, "min": 0.2, "max": 8.6, "ticks": [1, 2, 3, 4, 5, 6, 7, 8],
     "axisLabel": r"dimension $n$ of the manifold",
     "ranges": [{"from": 1, "to": 2, "label": "classical", "at": 0.6, "side": "above"},
                {"from": 4, "to": 8, "label": "claimed", "note": r"every $n \ge 4$", "tone": "claim", "at": 2.4, "side": "above"}],
     "markers": [{"v": 3, "label": "Pardon", "note": "2013", "at": 1.3, "side": "below"}]},
    {"primitive": "equation", "from": 4.2, "mode": "stack", "lines": [
        {"tex": r"\mathbb Z_p \curvearrowright M \ \text{faithful} \ \Rightarrow\ 4u_d = p^k\,c", "at": 0.3, "size": 40},
        {"tex": r"c \in L_d^{-1}\,\mathbb Z\,u_d", "at": 1.3, "size": 40, "tone": "soft"},
        {"tex": r"p^k > 4L_d \ \Rightarrow\ \text{impossible}", "at": 2.3, "size": 40, "tone": "accent"}]}],
    "beats": [
        {"at": 0.2, "text": r"Known in dimensions 1 and 2, and in dimension 3 since Pardon. Never above"},
        {"at": 4.3, "text": r"Everything reduces to the $p$-adic integers $\mathbb Z_p$ acting faithfully"},
        {"at": 6.8, "text": r"A signature-like class would split into $p^k$ equal lattice parts. It cannot"}]}
s["achievement"] = {"form": "status", "label": "Hilbert–Smith conjecture (Smith, 1940s)",
    "statement": [r"G \curvearrowright M^n \text{ faithfully} \ \Rightarrow\ G \text{ is a Lie group}"],
    "context": r"Before: dimensions 1 to 3 (Pardon 2013), and Lipschitz, quasiconformal or Hölder actions",
    "stamp": "proved", "note": "A new sheaf-theoretic invariant, with nothing in Lean"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: 46 pages for a problem about eighty years old",
               "ourCheck": "We read the proof outline; we did not check the proof"}
s["sources"] = [
    {"ref": "review 304, known_before", "quote": "Dimensions 1-2 classical; dimension 3 proved by Pardon (J. Amer. Math. Soc. 2013)."},
    {"ref": "review 304, known_before", "quote": "Posed as the action form of Hilbert's fifth problem (Smith, 1940s)."},
    {"ref": "review 304, known_before", "quote": "No unrestricted proof in dimension >= 4 before this."},
    {"ref": "review 304, caveats", "quote": "46 pages for a ~80-year-old problem"},
    {"ref": "review 304, explainer", "quote": "a faithful Z_p-action would split one class into p^k equal integral parts summing to 4u, impossible once p^k exceeds four times the lattice denominator."},
    {"ref": "article, The Hilbert–Smith conjecture", "quote": "A faithful action would split one class into $p^k$ equal integral parts summing to $4u_d$, and once $p^k > 4L_d$ that is impossible."},
    {"ref": "article, The Hilbert–Smith conjecture", "quote": "plus under regularity assumptions (Lipschitz, quasiconformal, Hölder)"}]
S["304"] = s

# ------------------------------------------------------------------ 305
s = base("305", "counterexample", "Disc embedding fails: $F_2$ is not good",
         "Four-dimensional disc embedding fails for $F_2$",
         r"Claim: a 4-manifold meets every algebraic test for disc embedding, yet its circles bound no disjoint discs")
s["object"] = {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "equation", "until": 4.0, "mode": "stack", "lines": [
        {"tex": r"\lambda(f_i, g_j) = \delta_{ij}", "note": "holds", "at": 0.4},
        {"tex": r"\lambda(g_i, g_j) = 0", "note": "holds", "at": 1.0},
        {"tex": r"\tilde\mu(g_i) = 0", "note": "holds", "at": 1.6}]},
    {"primitive": "venn", "from": 4.0, "sets": [{"label": "good groups"}, {"label": r"groups containing $F_2$"}],
     "regions": [{"set": "A&B", "label": r"$\varnothing$, claimed", "tone": "hot", "at": 2.0}],
     "members": [{"x": 0.3, "y": 0.5, "label": r"$\mathbb Z^2$", "at": 1.2}, {"x": 0.64, "y": 0.5, "label": r"$F_2$", "tone": "hot", "at": 1.5}]}],
    "beats": [
        {"at": 0.2, "text": "Immersed discs with dual spheres: every algebraic precondition holds"},
        {"at": 3.0, "text": "Yet the boundary circles bound no disjoint locally flat discs at all"},
        {"at": 5.6, "text": r"So $F_2$ is not good, and no group containing it is (schematically)"}]}
s["achievement"] = {"form": "status", "label": "Is every group good? (Freedman's disc embedding, open since 1982)",
    "statement": [r"F_2 \text{ is not good}"],
    "context": r"Before: disc embedding known for good groups (elementary amenable, subexponential growth)",
    "stamp": "counterexample", "note": "The same new invariant carries family 320; one error would sink both"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: three papers, 133 pages, a new marked-tensor invariant",
               "ourCheck": "We read the construction's outline; we did not check the proof"}
s["sources"] = [
    {"ref": "article, Disc embedding", "quote": r"$\lambda(f_i, g_j) = \delta_{ij}$, $\lambda(g_i, g_j) = 0$, $\tilde\mu(g_i) = 0$, yet whose boundary circles bound no disjoint locally flat discs at all. Hence $F_2$ is not good, and no group containing it is."},
    {"ref": "review 305, known_before", "quote": "Freedman's disc embedding theorem (1982; Freedman-Quinn 1990) holds for good groups (elementary amenable groups and groups of subexponential growth, closure properties)."},
    {"ref": "review 305, caveats", "quote": "Three papers (133 pp), no Lean."},
    {"ref": "review 305, caveats", "quote": "The PD4 paper and the companion Borel-conjecture paper (family 320) import the marked tensor obstruction as a black box, so one error would propagate to three headline claims."}]
S["305"] = s

# ------------------------------------------------------------------ 306
s = base("306", "proof", "Purely cosmetic surgery",
         "The purely cosmetic surgery conjecture",
         r"Claim: for a nontrivial knot, different surgery slopes never give the same oriented 3-manifold")
s["object"] = {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "numberline", "until": 4.2, "min": -3.3, "max": 3.3, "ticks": [-3, -2, -1, 0, 1, 2, 3],
     "axisLabel": r"surgery slope $r$ on a knot $K \subset S^3$",
     "markers": [{"v": -2, "label": r"slope $-2$", "note": "genus-2 knot", "tone": "hot", "style": "ring", "at": 1.4},
                 {"v": 2, "label": r"slope $+2$", "note": "genus-2 knot", "tone": "hot", "style": "ring", "at": 1.7}]},
    {"primitive": "equation", "from": 4.2, "mode": "stack", "lines": [
        {"tex": r"S^3_{-2}(K) \cong S^3_{2}(K) \ \Rightarrow\ \Omega \neq 0", "at": 0.3, "size": 38},
        {"tex": r"\partial(\text{1-dim moduli}) \ \Rightarrow\ 2^\eta\,\Omega = 0", "at": 1.3, "size": 38},
        {"tex": r"\text{contradiction}", "at": 2.3, "size": 38, "tone": "accent"}]}],
    "beats": [
        {"at": 0.2, "text": r"Floer theory left one case: slopes $-2$ and $2$ on a genus-2 knot"},
        {"at": 4.3, "text": "A hypothetical homeomorphism gives a nonzero integer instanton count"},
        {"at": 6.8, "text": "Counted again on a monopole moduli space, it must vanish"}]}
s["achievement"] = {"form": "status", "label": "Purely cosmetic surgery conjecture (Gordon 1990, Kirby problem 1.81)",
    "statement": [r"r \neq s \ \Rightarrow\ S^3_r(K) \not\cong S^3_s(K)"],
    "context": r"Before: only $\pm 2$ on a genus-2 knot remained (Hanselman 2023; Daemi–Lidman–Miller Eismeier)",
    "stamp": "proved", "note": "A 144-page monopole argument that gauge theorists have not yet checked"}
s["verify"] = {"lean": "none", "detail": "Manuscript only: the new part is a 144-page SO(3)-monopole cobordism argument",
               "ourCheck": "We read the proof outline; we did not check the proof"}
s["sources"] = [
    {"ref": "article, The purely cosmetic surgery conjecture", "quote": "What was left: slopes $-2$ and $2$ on a genus-2 knot."},
    {"ref": "review 306, known_before", "quote": "Gordon (1990, Conj. 6.1)/Kirby problem 1.81(A) (Bleiler)."},
    {"ref": "review 306, known_before", "quote": "Hanselman (J. Eur. Math. Soc. 2023: slopes +-2 or +-1/q, +-2 needs genus 2)"},
    {"ref": "review 306, caveats", "quote": "The new part is a 144-page SO(3)-monopole cobordism argument"},
    {"ref": "article, The purely cosmetic surgery conjecture", "quote": "so $2^\\eta \\Omega = 0$."}]
S["306"] = s

# ------------------------------------------------------------------ 307
nodes, edges = [], []
def comp(prefix, pts, es):
    for i, (x, y) in enumerate(pts): nodes.append({"id": f"{prefix}{i}", "x": x, "y": y})
    for a, b in es: edges.append([f"{prefix}{a}", f"{prefix}{b}"])
comp("a", [(0.12, 0.3), (0.06, 0.62), (0.18, 0.62)], [(0, 1), (1, 2), (2, 0)])
comp("b", [(0.32, 0.25), (0.44, 0.25), (0.44, 0.7), (0.32, 0.7)], [(0, 1), (1, 2), (2, 3), (3, 0), (0, 2)])
import math
hexp = [(0.75 + 0.17 * math.cos(math.pi / 2 + 2 * math.pi * k / 6) * 0.62, 0.48 - 0.36 * math.sin(math.pi / 2 + 2 * math.pi * k / 6)) for k in range(6)]
hexp = [(round(x, 3), round(y, 3)) for x, y in hexp]
comp("c", hexp, [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 0), (0, 3)])
s = base("307", "counterexample", "Coarse Novikov fails, bounded geometry",
         "The rational coarse Novikov conjecture fails",
         r"Claim: a union of finite bounded-degree graphs carries an infinite-order class whose coarse index vanishes")
s["object"] = {"dur": 8.4, "layout": "sequence", "panels": [
    {"primitive": "graph", "until": 4.4, "nodes": nodes, "edges": edges, "edgeAt": 0.4, "edgeDur": 2.6, "r": 11},
    {"primitive": "equation", "from": 4.4, "mode": "stack", "lines": [
        {"tex": r"\mu : KX_1(X) \to K_1\big(C^*_{\mathrm{Roe}}(X)\big)", "at": 0.3, "size": 40},
        {"tex": r"\alpha \text{ of infinite order}, \quad \mu(\alpha) = 0", "at": 1.3, "size": 40, "tone": "accent"}]}],
    "beats": [
        {"at": 0.2, "text": "Finite graphs of bounded degree, short cycles allowed (schematically)"},
        {"at": 4.5, "text": "Coarse assembly sends coarse K-homology to the K-theory of the Roe algebra"},
        {"at": 7.0, "text": "An infinite-order class dies under it"}]}
s["achievement"] = {"form": "status", "label": "Rational coarse Novikov conjecture (Roe; Higson–Roe)",
    "statement": [r"\mu \otimes \mathbb Q \text{ is not injective on bounded geometry}"],
    "context": r"Before: Yu, for finite asymptotic dimension (1998) and Hilbert-space embeddings (2000)",
    "stamp": "counterexample", "note": "Lean covers the reduced Roe algebra; the maximal version is paper-only"}
s["verify"] = {"lean": "main", "detail": r"Lean: the reduced-algebra counterexample, about 34.5k lines; the maximal headline is not",
               "ourCheck": "We read the Comparator statement; we did not build the Lean"}
s["sources"] = [
    {"ref": "review 307, claim", "quote": "a coarse disjoint union of finite connected graphs of uniformly bounded degree, with an infinite-order class alpha in KX_1(X) whose image under ordinary coarse assembly into K_1 of the reduced Roe algebra vanishes; so the rational coarse Novikov conjecture fails."},
    {"ref": "review 307, known_before", "quote": "Yu proved isomorphism for finite asymptotic dimension (1998) and for spaces coarsely embeddable in Hilbert space (2000)"},
    {"ref": "review 307, caveats", "quote": "335 files, ~34.5k lines, no sorry. It formalizes the ordinary (reduced) coarse Novikov counterexample; the maximal-assembly paper (the family's headline title) is not covered."},
    {"ref": "article, Coarse Novikov fails", "quote": "The graphs have short cycles, which is why Willett and Yu's large-girth injectivity theorem doesn't apply."},
    {"ref": "review 307, caveats", "quote": LEAN_NOT_BUILT["quote"]}]
S["307"] = s

# ------------------------------------------------------------------ 308
s = base("308", "proof", "Smith–Toda complexes $V(n)$ at every height",
         "Finite Smith–Toda complexes at every height",
         r"Claim: for every $n$ there is a prime $p$ and a finite spectrum $V(n)$ killing $p, v_1, \ldots, v_n$ once")
s["object"] = {"dur": 8.4, "heading": r"$BP_*V(n) = BP_*/(p, v_1, \ldots, v_n)$, all exponents one",
    "primitive": "sequence", "items": [r"$V(0)$", r"$V(1)$", r"$V(2)$", r"$V(3)$", r"$V(4)$", r"$V(5)$", r"$V(6)$"],
    "ellipsis": True, "at": 0.4, "stagger": 0.16,
    "marks": {"0": {"tone": "soft", "at": 1.8}, "1": {"tone": "soft", "at": 1.9}, "2": {"tone": "soft", "at": 2.0}, "3": {"tone": "soft", "at": 2.1},
              "4": {"tone": "accent", "at": 4.0}, "5": {"tone": "accent", "at": 4.4}, "6": {"tone": "accent", "at": 4.8}},
    "caption": r"grey: known for large enough $p$ · colour: claimed, at a prime depending on $n$",
    "beats": [
        {"at": 0.2, "text": r"The Moore spectrum $V(0)$, then $V(1)$ to $V(3)$ for $p > 2, 4, 6$"},
        {"at": 3.4, "text": r"Whether $V(4)$ exists at any prime was open. The claim: every $V(n)$ exists"},
        {"at": 6.2, "text": r"Built in an ultraproduct over primes, then descended to one large $p$"}]}
s["achievement"] = {"form": "status", "label": "Smith–Toda complexes at every height (V(4) open at every prime)",
    "statement": [r"\forall n\ \exists p:\ BP_*V(n) = BP_*/(p, v_1, \ldots, v_n)"],
    "context": r"Consistent with Nave: $V((p+1)/2)$ never exists for $p \ge 7$, and here $p$ grows with $n$",
    "stamp": "proved", "note": r"The prime is not explicit, except a separate $V(4)$ at $p = 1009$"}
s["verify"] = {"lean": "none", "detail": r"Manuscript only; the explicit $V(4)$ at $p = 1009$ is a separate 44-page paper",
               "ourCheck": "We read the construction's outline; we did not check the proof"}
s["sources"] = [
    {"ref": "review 308, known_before", "quote": "Smith-Toda: V(0) Moore spectrum; V(1),V(2),V(3) exist for p > 2,4,6 (Adams, Smith, Toda). Nave (Annals 2010): V((p+1)/2) does not exist for p >= 7."},
    {"ref": "review 308, claim", "quote": "Explicitly, V(4) exists at p = 1009."},
    {"ref": "review 308, caveats", "quote": "The explicit p=1009 V(4) paper is a separate 44-page construction I did not check."},
    {"ref": "article, Smith–Toda complexes at every height", "quote": "Consistent with Nave, since the prime grows with $n$."}]
S["308"] = s

# ------------------------------------------------------------------ 309
s = base("309", "proof", "Kervaire invariant at the prime 3",
         "The Kervaire invariant problem at the prime three",
         r"Claim: at $p = 3$ the classes $b_j$ survive exactly for $j = 0, 2, 3$, in stems 10, 106 and 322")
s["object"] = {"dur": 8.6, "layout": "sequence", "panels": [
    {"primitive": "sequence", "until": 4.2, "items": [r"$b_0$", r"$b_1$", r"$b_2$", r"$b_3$", r"$b_4$", r"$b_5$", r"$b_6$"],
     "ellipsis": True, "at": 0.3, "stagger": 0.12,
     "marks": {"0": {"tone": "ok", "at": 1.4}, "1": {"tone": "bad", "at": 1.6}, "2": {"tone": "ok", "at": 1.8},
               "3": {"tone": "accent", "at": 2.4}, "4": {"tone": "bad", "at": 2.8}, "5": {"tone": "bad", "at": 2.9}, "6": {"tone": "bad", "at": 3.0}},
     "caption": "green: known to survive · red: dies · colour: newly claimed survivor"},
    {"primitive": "numberline", "from": 4.2, "min": 0, "max": 345, "ticks": [0, 100, 200, 300], "y": 0.6,
     "axisLabel": "stem of the mod-3 Adams spectral sequence",
     "markers": [{"v": 10, "label": r"$b_0$", "note": "stem 10", "at": 0.5},
                 {"v": 106, "label": r"$b_2$", "note": "stem 106", "at": 0.9},
                 {"v": 322, "label": r"$b_3$, new", "note": "stem 322", "tone": "claim", "at": 1.6}]}],
    "beats": [
        {"at": 0.2, "text": r"Odd-primary Kervaire classes $b_j$: $b_0$ and $b_2$ survive, $b_1$ dies"},
        {"at": 2.7, "text": r"The claim: $b_3$ survives too, and every $b_j$ with $j \ge 4$ dies"},
        {"at": 5.4, "text": "The new class in stem 322 is built from the known stem-106 class"}]}
s["achievement"] = {"form": "status", "label": "Kervaire invariant problem at the prime 3",
    "statement": [r"b_j \text{ survives} \iff j \in \{0, 2, 3\}"],
    "context": r"Each detected by an element of exact order 3. At $p = 2$: Hill–Hopkins–Ravenel (2016)",
    "stamp": "proved", "note": "90 pages of spectral-sequence bookkeeping, not yet audited"}
s["verify"] = {"lean": "none", "detail": r"Manuscript only: 90 pages, via $C_9$ acting on height-6 Morava E-theory",
               "ourCheck": "We read the proof outline; we did not check the differentials"}
s["sources"] = [
    {"ref": "review 309, claim", "quote": "At p = 3, the standard odd-primary Kervaire classes b_j in the mod-3 Adams spectral sequence survive exactly for j in {0,2,3} (stems 10, 106, 322), each detected by an element of exact order 3; b_1 and all b_j, j >= 4, die."},
    {"ref": "review 309, known_before", "quote": "Prime 2: Hill-Hopkins-Ravenel (Annals 2016)"},
    {"ref": "review 309, known_before", "quote": "at p = 3 the survival of b_0, b_2 was known and b_1 dies; higher indices open."},
    {"ref": "review 309, caveats", "quote": "90 pages; proves a conjectured coefficient-action model"},
    {"ref": "article, The Kervaire invariant problem at the prime 3", "quote": "The new class in stem 322 is built from the known stem-106 class."},
    {"ref": "article, The Kervaire invariant problem at the prime 3", "quote": "using $C_9$ acting on height-6 Morava E-theory"}]
S["309"] = s

for k, v in S.items():
    json.dump(enrich(v), open(os.path.join(OUT, k + ".json"), "w"), ensure_ascii=False, indent=2)
print('wrote', list(S))
