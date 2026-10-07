"use client"

// Which conditional lower bounds fall, which lose their evidence, and which
// are untouched, transcribed from Figure 1, Section 1.2 and the "unaffected
// conjectures" paragraph of arXiv 2610.06783. Click a problem to see how the
// new algorithm reaches it (or why it doesn't) and the bound it now has.
// No numbers are computed here; every bound is the paper's.
//
// Dual-native: the article's section on what falls names every problem below.

import { useState } from "react"

type Status = "falls" | "evidence-gone" | "stands"
type Node = { id: string; name: string; status: Status; path: string; now: string }

const NODES: Node[] = [
  { id: "lop", name: "Lopsided All-Edges Sparse Triangle", status: "falls", path: "Solved directly: it is the wanted entries of a thin product (Sec. 3.1), middle part n^ε with ε < 0.12.", now: "O(n²/D^0.063) for |W| ≤ n²/√D" },
  { id: "et", name: "Exact Triangle", status: "falls", path: "Hash weights mod a prime p near √D, one lopsided instance per residue chunk and piece of C (Theorem 17).", now: "O(n^2.9983), deterministic" },
  { id: "3sum", name: "3SUM (integers)", status: "falls", path: "3SUM → n^(1/2) Exact Triangle instances of n^(1/2) vertices [CH20, VW13] → lopsided triangles.", now: "O(n^1.9992), deterministic" },
  { id: "apsp", name: "APSP and (min,+)-product", status: "falls", path: "(min,+)-product → Exact Triangle on n^(1/3) vertices, n² times [VW10, VW18, VW13].", now: "O(n^2.9995) (Cor. 26 path: 2.99942)" },
  { id: "real", name: "Real 3SUM, real APSP", status: "falls", path: "Fredman's trick turns comparisons of sums into counting triangles [CVX22]; needs the counting version, which the thin product also gives.", now: "O(n^1.998), O(n^2.998) expected, Las Vegas" },
  { id: "apspclass", name: "APSP class", status: "falls", path: "Subcubic-equivalent to APSP: Negative Triangle, Radius, Median, Replacement Paths, Second Shortest Path, Metricity, Minimum Weight Cycle, Tree Edit Distance, Maximum Subarray, Wiener Index.", now: "truly subcubic, all of them" },
  { id: "3sumclass", name: "3SUM class", status: "falls", path: "Subquadratic-equivalent to 3SUM: GeomBase, All-Numbers 3SUM, Convolution-3SUM, 3-Linear Degeneracy Testing (3AP), #3SUM, MonoConvolution.", now: "truly subquadratic; MonoConvolution O(n^1.4999)" },
  { id: "minconv", name: "(min,+)-convolution, Knapsack", status: "falls", path: "Reduces to both 3SUM and the (min,+)-product [BIS17, CMWW19, BCD+14].", now: "truly subquadratic; 0/1 Knapsack O(n + t^(2-δ)), randomized" },
  { id: "kclique", name: "Zero/Min/Max-Weight k-Clique", status: "falls", path: "Nešetřil–Poljak folding turns k-Clique into a triangle problem [NP85].", now: "O(n^(k-ε))" },
  { id: "dirapsp", name: "Directed unweighted APSP", status: "falls", path: "Zwick's algorithm as a reduction to small-weight (min,+) products [Zwi02, CVX21].", now: "polynomially faster than Zwick's n^2.5275" },
  { id: "omv", name: "Hinted OMv (thin hints)", status: "falls", path: "The data-structure version answers single entries after preprocessing (Theorem 24).", now: "refuted for hint dimension n^τ, τ < 0.1204" },
  { id: "3xor", name: "3XOR", status: "falls", path: "Same approach with linear hashing over F2 (Remark 23).", now: "truly subquadratic" },
  { id: "geom", name: "3SUM-hard geometry", status: "evidence-gone", path: "Three collinear points, minimum-area triangle, motion planning, polygon containment. The reductions run from 3SUM to these, so a fast 3SUM says nothing about them.", now: "still O(n²); now open" },
  { id: "dyn", name: "Dynamic graph lower bounds", status: "evidence-gone", path: "Reachability, shortest paths, subgraph connectivity, matching [Păt10, AV14, KPP16]. Hard under 3SUM; 3SUM is no longer hard.", now: "no new algorithm, no conditional bound" },
  { id: "balanced", name: "Balanced All-Edges Sparse Triangle", status: "evidence-gone", path: "Needs the middle part far bigger than n^0.12. The m^(4/3) hypothesis for it is the paper's own suggested replacement.", now: "still m^(4/3); a candidate hypothesis" },
  { id: "attn", name: "Dynamic attention (thin end)", status: "evidence-gone", path: "van den Brand, Song and Zhou's optimality proof rests on a hinted-OMv variant; for τ < 0.1204 it needs a new hypothesis (Sec. 5.4).", now: "upper bound unchanged" },
  { id: "seth", name: "SETH and Orthogonal Vectors", status: "stands", path: "Not known to reduce to sparse triangles; no fast nondeterministic algorithms either. Attention's quadratic lower bounds rest here.", now: "untouched" },
  { id: "ksum", name: "k-SUM, k-XOR for k ≥ 4; 3SUM-Indexing", status: "stands", path: "No fine-grained self-reductions; the known reductions would be slower than the n^⌈k/2⌉ baseline.", now: "untouched" },
  { id: "omvplain", name: "OMv without hints", status: "stands", path: "The data structure needs a thin hint; plain OMv has none.", now: "untouched" },
  { id: "models", name: "Restricted-model lower bounds", status: "stands", path: "n³ for (min,+) straight-line programs, Ω(n²) for 3-linear decision trees. The new algorithms hash the weights away and count triangles with integer matrix products, outside those models.", now: "still true, still irrelevant" },
]

const STYLE: Record<Status, { label: string; tone: string }> = {
  falls: { label: "new, faster algorithm", tone: "border-blue-500/60 bg-blue-500/10" },
  "evidence-gone": { label: "hardness evidence gone, no speedup", tone: "border-zinc-500/50 bg-zinc-500/10" },
  stands: { label: "untouched", tone: "border-emerald-600/50 bg-emerald-600/10" },
}

export function ReductionMap() {
  const [sel, setSel] = useState("3sum")
  const active = NODES.find((n) => n.id === sel) ?? NODES[0]
  const groups: Status[] = ["falls", "evidence-gone", "stands"]

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 font-mono text-xs text-muted-foreground">
        3SUM / APSP → Exact Triangle → Lopsided Sparse Triangle → wanted entries of a thin product
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1.5 font-mono text-[11px] font-semibold">{STYLE[g].label}</div>
            <div className="flex flex-col gap-1">
              {NODES.filter((n) => n.status === g).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  aria-pressed={n.id === sel}
                  onClick={() => setSel(n.id)}
                  className={`rounded border px-2 py-1 text-left font-mono text-[11px] ${STYLE[g].tone} ${
                    n.id === sel ? "ring-2 ring-foreground/40" : "opacity-85 hover:opacity-100"
                  }`}
                >
                  {n.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border bg-background/60 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="font-mono text-sm font-semibold">{active.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{STYLE[active.status].label}</span>
        </div>
        <p className="mt-2 text-xs leading-5">{active.path}</p>
        <p className="mt-1 font-mono text-xs">now: {active.now}</p>
      </div>
    </div>
  )
}
