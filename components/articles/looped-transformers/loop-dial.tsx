"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// TML-d24-varloop-research at 1..5 passes, every score from its model card's
// evaluation table (thinkingmachines/TML-d24-varloop-research, README).
// Trained on 1-5 passes sampled 1:2:6:2:1 in midtraining, post-trained at 3.
// The cost row is my arithmetic: layer applications 12 + 12P, and bytes read
// per token at batch 1 from the UD-Q4_K_M tensor sizes, 1.347 + 0.905P GB,
// relative to 3 passes.

type Bench = { name: string; group: "reasoning" | "agentic" | "knowledge"; v: number[]; unit?: string }

const BENCHES: Bench[] = [
  { name: "DeepSWE v1.1", group: "agentic", v: [0.7, 28.3, 47.4, 46.9, 48.2] },
  { name: "SWEBench Pro v2 (Hard)", group: "agentic", v: [39.7, 69.1, 78.9, 76.0, 78.4] },
  { name: "BrowseComp", group: "agentic", v: [29.4, 53.8, 65.7, 69.4, 71.0] },
  { name: "ARC-AGI-2", group: "reasoning", v: [0.8, 12.2, 22.1, 20.3, 27.1] },
  { name: "GPQA Diamond", group: "reasoning", v: [69.6, 79.2, 84.2, 81.9, 83.1] },
  { name: "HLE (text only)", group: "reasoning", v: [10.5, 20.0, 24.9, 25.4, 25.9] },
  { name: "MRCR v2, 256K-512K", group: "reasoning", v: [26.2, 65.2, 89.2, 93.4, 92.1] },
  { name: "GraphWalks BFS 1M", group: "reasoning", v: [5.7, 39.4, 52.1, 56.2, 57.8] },
  { name: "SimpleQA Verified", group: "knowledge", v: [6.3, 6.5, 7.3, 6.8, 6.7] },
  { name: "AA-Omniscience accuracy", group: "knowledge", v: [15.5, 16.3, 18.4, 18.0, 17.4] },
  { name: "WorldVQA", group: "knowledge", v: [11.3, 13.0, 14.2, 14.3, 13.5] },
]

const COLORS = ["oklch(0.80 0.06 250)", "oklch(0.72 0.10 250)", "oklch(0.62 0.15 255)", "oklch(0.52 0.15 260)", "oklch(0.42 0.13 265)"]
const read = (p: number) => 1.347 + 0.905 * p

export function LoopDial() {
  const [sel, setSel] = useState(0)
  const b = BENCHES[sel]
  const top = Math.max(...b.v, 1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one checkpoint, five loop counts: what each pass buys</span>
        <span className="text-muted-foreground/60">scores: the varloop model card; cost: my arithmetic</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {BENCHES.map((x, i) => (
            <button
              key={x.name}
              type="button"
              onClick={() => setSel(i)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px]",
                i === sel ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground",
              )}
            >
              {x.name}
            </button>
          ))}
        </div>

        <div className="font-mono text-[11px] text-muted-foreground">
          {b.group === "knowledge"
            ? "closed-book recall: the loop adds compute, not storage"
            : b.group === "agentic"
              ? "long-horizon agentic task"
              : "multi-step reasoning or long context"}
        </div>

        <div className="space-y-1.5">
          {b.v.map((v, i) => {
            const p = i + 1
            const rel = read(p) / read(3)
            return (
              <div key={p} className="flex items-center gap-2">
                <span className="w-16 shrink-0 font-mono text-[11px]">
                  {p} {p === 1 ? "pass" : "passes"}
                </span>
                <div className="h-5 flex-1 rounded-sm bg-muted/40">
                  <div className="h-5 rounded-sm" style={{ width: `${(v / top) * 100}%`, background: COLORS[i] }} />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{v.toFixed(1)}%</span>
                <span className="hidden w-36 shrink-0 text-right font-mono text-[10px] text-muted-foreground sm:inline">
                  {12 + 12 * p} layers · {rel.toFixed(2)}x bytes
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The model was post-trained at 3 passes and saw 1, 2, 4 and 5 less often, so the off-3 columns may understate what a model trained at
        those counts would do (the card says so). &quot;Bytes&quot; is weight traffic per decoded token at batch 1, relative to 3 passes.
      </figcaption>
    </figure>
  )
}
