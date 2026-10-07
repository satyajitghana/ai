"use client"

// What a green Comparator run does and does not tell you, layer by layer, on six
// real statements from the release. Everything here comes from the repo at
// commit adc7f1241: line counts are `wc -l` of lean/ComparatorChallenges/*.lean,
// the axiom list is from the matching .json (all 405 configs permit exactly
// propext, Quot.sound and Classical.choice), and the scope notes paraphrase the
// family's lean/docs/NNN.md page. Nothing is computed in the browser.
//
// Dual-native: the prose section "What the green tick means" walks the same five
// layers and names the same caveats for each example.

import { useState } from "react"

type Example = {
  id: string
  label: string
  file: string
  lines: number
  defs: string
  reader: string
  scope: string
}

const EXAMPLES: Example[] = [
  {
    id: "zeta",
    label: "ζ zero-free for Re s > 7/8",
    file: "QuasiRiemannHypothesis.lean",
    lines: 9,
    defs: "None of its own. riemannZeta is mathlib's.",
    reader:
      "Check one mathlib convention: riemannZeta 1 is a junk value, (γ − log 4π)/2, which is nonzero, so including s = 1 in the half-plane does not make the claim vacuous or false.",
    scope:
      "Headline covered: ζ and every Dirichlet L-function, plus finite-order Hecke L over Q(√−3). The human-edited 11/12 companion has no separate statement. The paper's later applications are not included.",
  },
  {
    id: "kaplansky",
    label: "Kaplansky direct finiteness fails",
    file: "KaplanskyDirectFiniteness.lean",
    lines: 17,
    defs: "None. Field, CharP, Group.FG and MonoidAlgebra are mathlib's.",
    reader:
      "Eight lines of statement: a finite field of characteristic 2, a finitely generated group, and a, b in K[G] with ab = 1 but ba ≠ 1. Easy to read and hard to misstate.",
    scope:
      "The counterexample is covered. That the group is nonsofic is outside the statement, but it follows from Elek–Szabó (direct finiteness holds for every sofic group), so a checked counterexample is a checked nonsofic group.",
  },
  {
    id: "erdos",
    label: "Erdős: divergent 1/n sums contain long APs",
    file: "ErdosReciprocal.lean",
    lines: 36,
    defs: "HasAP and reciprocalTerm, both a few lines.",
    reader:
      "Check HasAP demands a positive common difference (it does: 0 < d) and that the reciprocal sum is over the set (n = 0 contributes 0⁻¹ = 0 in Lean, harmless).",
    scope:
      "Only the qualitative consequence is formalized. The headline quantitative bound C·N·exp(−c(log N)^ε) on progression-free sets is outside the statement.",
  },
  {
    id: "dft",
    label: "Exact DFT below n log n",
    file: "ExactFourier.lean",
    lines: 62,
    defs: "A circuit model from scratch: add, sub and scale-by-any-complex gates.",
    reader:
      "Check the model: scalar multiplications by arbitrary predetermined constants cost one gate, and fan-out and permutations are free. That is the unbounded-coefficient model, where Morgenstern's n log n lower bound does not apply.",
    scope:
      "Weaker than the headline. Lean proves cost < c·n·log₂n for some n beyond every cutoff (a subsequence); the summary's all-n O(n(log n)^(1−δ)) with δ = 10^−13 is not what is checked.",
  },
  {
    id: "matmul",
    label: "Matrix multiplication ω ≤ 9/4",
    file: "MatrixMultiplication.lean",
    lines: 132,
    defs: "Straight-line programs, their cost, AdmissibleExponent, omega as an sInf.",
    reader:
      "omega ℂ is sInf of the admissible exponents, and Lean's sInf of an empty or unbounded-below set of reals is 0. The theorem means what it says only because the schoolbook n³ algorithm makes the set nonempty and any correct program needs at least on the order of n² gates. Both are true, neither is part of the statement, so a reviewer has to know it.",
    scope:
      "Covered: ω(ℂ) ≤ 9/4, α > 93/200 and the 0.709 rectangular bound. A second statement gives ω(F) < 2.371054886006746 over every field.",
  },
  {
    id: "fgf",
    label: "All free group factors isomorphic",
    file: "InterpolatedFactors.lean",
    lines: 225,
    defs:
      "L(G) as the bicommutant of left translations on ℓ²(G), its trace, the ultraweak topology, corners, stabilization, and the interpolated factors.",
    reader:
      "Mathlib has no group von Neumann algebras, so the statement builds them. For non-integer r it takes a corner of L(F₂) ⊗ B(ℓ²) cut by a projection of trace (r − 1)^(−1/2), chosen with Classical.epsilon. A reviewer must check that this is Dykema's compression formula, that such a projection exists, and that the isomorphism notion (normal, trace-preserving *-isomorphism) is the right one.",
    scope:
      "Covered: every pair r, s > 1, including ∞. The fundamental-group corollary is not a separate statement.",
  },
]

const LAYERS = [
  {
    k: "kernel",
    title: "1. The proof type-checks",
    body: "Comparator exports the solution's proof terms with lean4export and replays them in Lean's kernel. Tactics, macros and elaborator tricks are not trusted; only the kernel is. One of the 405 configs also turns on nanoda, a second independent kernel.",
  },
  {
    k: "axioms",
    title: "2. Only standard axioms",
    body: "Every config permits exactly propext, Quot.sound and Classical.choice. I grepped the 121,734 files under lean/OAI: no sorry, no admit, no axiom declarations, no native_decide.",
  },
  {
    k: "match",
    title: "3. It proves the stated theorem",
    body: "The statement lives in a separate challenge file that imports only Mathlib (all 405 do). Comparator checks that the solution's theorem has exactly that type, so the solution cannot quietly redefine a term the statement uses.",
  },
  {
    k: "reader",
    title: "4. The statement means what the paper says",
    body: "No tool does this. Someone has to read the challenge file, including every definition it introduces, against the paper. formalization.yaml lists review status: unchecked.",
  },
  {
    k: "scope",
    title: "5. The statement is the headline",
    body: "Each lean/docs page names what was selected and what is left out. 85 of the 235 pages carve something out explicitly.",
  },
]

export function TrustStepper() {
  const [ex, setEx] = useState("matmul")
  const [layer, setLayer] = useState(3)
  const e = EXAMPLES.find((x) => x.id === ex) ?? EXAMPLES[0]
  const L = LAYERS[layer]
  const machine = layer < 3

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="font-mono text-xs text-muted-foreground">
        pick a result, then a layer of the guarantee
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === ex}
            onClick={() => setEx(x.id)}
            className={`rounded-md border px-2 py-1 text-left text-xs ${
              x.id === ex ? "ring-2 ring-foreground/40 bg-background" : "opacity-75 hover:opacity-100"
            }`}
          >
            {x.label}
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">{x.lines} lines</span>
          </button>
        ))}
      </div>

      <ol className="mt-4 grid gap-1.5 sm:grid-cols-5">
        {LAYERS.map((l, i) => (
          <li key={l.k}>
            <button
              type="button"
              aria-pressed={i === layer}
              onClick={() => setLayer(i)}
              className={`h-full w-full rounded-md border px-2 py-1.5 text-left text-[11px] leading-4 ${
                i < 3
                  ? "border-emerald-600/50 bg-emerald-600/10"
                  : "border-orange-500/60 bg-orange-500/10"
              } ${i === layer ? "ring-2 ring-foreground/40" : "opacity-75 hover:opacity-100"}`}
            >
              <span className="block font-semibold">{l.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {i < 3 ? "machine-checked" : "human judgment"}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-3 rounded-md border bg-background/60 p-3">
        <p className="text-xs leading-5">{L.body}</p>
        <dl className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-[7rem_1fr] sm:gap-x-3">
          <dt className="font-mono text-muted-foreground">statement</dt>
          <dd className="font-mono">
            lean/ComparatorChallenges/{e.file} ({e.lines} lines)
          </dd>
          <dt className="font-mono text-muted-foreground">own defs</dt>
          <dd>{e.defs}</dd>
          {machine ? (
            <>
              <dt className="font-mono text-muted-foreground">status</dt>
              <dd>
                Passes by construction if Comparator succeeds. I did not run it; this layer is what
                the tool claims to establish.
              </dd>
            </>
          ) : layer === 3 ? (
            <>
              <dt className="font-mono text-muted-foreground">to check</dt>
              <dd>{e.reader}</dd>
            </>
          ) : (
            <>
              <dt className="font-mono text-muted-foreground">scope</dt>
              <dd>{e.scope}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
