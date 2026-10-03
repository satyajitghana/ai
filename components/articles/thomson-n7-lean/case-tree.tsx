"use client"

// The proof's spine: split on the smallest pairwise inner product m, then close
// each cell with its own certificate. Click a cell to see which certificate
// handles it and the margin it leaves above E(P). Every number here is from
// paper/PAPER.md and the Lean source; nothing is computed in the browser.
//
// Dual-native: the prose below the widget names every cell, certificate and
// margin, and the detail panel defaults to a selection so the server-rendered
// (no-JS) page already shows one cell's detail.

import { useState } from "react"

type Cell = {
  id: string
  name: string
  range: string
  kind: "cap" | "slab" | "case1"
  cert: string
  margin: string
  detail: string
}

const CELLS: Cell[] = [
  {
    id: "cap",
    name: "cap",
    range: "[-1, -0.99]",
    kind: "cap",
    cert: "typed 3-point, then rigidity + local minimality",
    margin: "E(P) - 2.3e-16 (near-sharp)",
    detail:
      "Contains the bipyramid itself, so the certificate cannot be strict here — it comes 2.3e-16 below E(P). That near-equality confines any rival to a tube of width 1/165000 around P's Gram pattern; a combinatorial argument forces the ring into a pentagon, and an exact second-order expansion proves P is a strict local minimum. This is the only cell that yields the uniqueness clause.",
  },
  { id: "s1", name: "slab 1", range: "[-0.99, -0.98]", kind: "slab", cert: "typed 3-point, Λ = 2^100", margin: "E(P) + 2.6e-6", detail: "One typed certificate, pole pair pinned to the slab, every other pair at least the lower end. Strict margin, so no minimiser lives here." },
  { id: "s2", name: "slab 2", range: "[-0.98, -0.96]", kind: "slab", cert: "typed 3-point, Λ = 2^100", margin: "E(P) + 2.6e-6", detail: "Same shape as slab 1, different integer certificate. The five slabs together cover [-0.99, -0.90]." },
  { id: "s3", name: "slab 3", range: "[-0.96, -0.94]", kind: "slab", cert: "typed 3-point, Λ = 2^100", margin: "E(P) + 2.6e-6", detail: "Typed bound with its own PSD blocks and slack polynomials; the kernel checks the exact identities." },
  { id: "s4", name: "slab 4", range: "[-0.94, -0.93]", kind: "slab", cert: "typed 3-point, Λ = 2^100", margin: "E(P) + 2.6e-6", detail: "A narrow slab near the hard region; the breakpoints are chosen so every slab stays feasible." },
  { id: "s5", name: "slab 5", range: "[-0.93, -0.90]", kind: "slab", cert: "typed 3-point, Λ = 2^100", margin: "E(P) + 2.6e-6", detail: "The last slab, meeting Case 1 at m = -0.90." },
  {
    id: "c1",
    name: "Case 1",
    range: "m ≥ -0.90",
    kind: "case1",
    cert: "untyped 3-point + degree-10 minorant, Λ = 2^160",
    margin: "E(P) + 3.2e-4",
    detail:
      "No near-antipodal pair, so one symmetric certificate suffices: a degree-5 three-point semidefinite bound plus a polynomial minorant H of the kernel phi(t) = (2-2t)^(-1/2). The margin is a comfortable 3.2e-4, so equality never occurs in this case.",
  },
]

const tone: Record<Cell["kind"], string> = {
  cap: "border-orange-500/60 bg-orange-500/10",
  slab: "border-emerald-600/50 bg-emerald-600/10",
  case1: "border-blue-500/50 bg-blue-500/10",
}

export function CaseTree() {
  const [sel, setSel] = useState("cap")
  const active = CELLS.find((c) => c.id === sel) ?? CELLS[0]

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="mb-2 font-mono text-xs text-muted-foreground">
        split on m = min inner product &rarr; one certificate per cell
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CELLS.map((c) => {
          const on = c.id === sel
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSel(c.id)}
              aria-pressed={on}
              className={`rounded-md border px-2.5 py-2 text-left transition-colors ${tone[c.kind]} ${
                on ? "ring-2 ring-foreground/40" : "opacity-80 hover:opacity-100"
              } ${c.kind === "case1" ? "grow" : ""}`}
            >
              <div className="font-mono text-xs font-semibold">{c.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{c.range}</div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-md border bg-background/60 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-mono text-sm font-semibold">{active.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{active.range}</span>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-1 font-mono text-xs sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <dt className="text-muted-foreground">certificate</dt>
          <dd>{active.cert}</dd>
          <dt className="text-muted-foreground">margin</dt>
          <dd>{active.margin}</dd>
        </dl>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{active.detail}</p>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Seven cells, closed left to right by exact integer arithmetic in the Lean
        kernel. The five slabs and Case 1 leave a strict gap above E(P); only the
        cap, which contains the bipyramid, is handled by rigidity and an exact
        local-minimality argument, and it is the cell that proves uniqueness.
      </p>
    </div>
  )
}
