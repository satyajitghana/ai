"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why dynamic composition is affordable. Naively, transforming every head's attention
// vector into every other head's is an H x H transform per query/key pair: H^2 numbers.
// DCMHA never builds that tensor. It factors the transform into a query-wise term plus
// a key-wise term (row + column decomposition), and factors each of those into a
// rank-R product plus a diagonal gate (low-rank + diagonal decomposition) — cost
// 2*H*R + H. Drag H (head count) and pick R (rank) and watch the gap between "the
// naive tensor" and "what DCMHA actually computes" widen as heads scale up.

const ACCENT = "oklch(0.66 0.16 200)"
const NAIVE = "oklch(0.64 0.18 25)"
const D_H = 128 // per-head dim used in the paper's own 6.9B-scale worked example

export function ComposeCost() {
  const [h, setH] = useState(8)
  const [r, setR] = useState<1 | 2 | 4>(2)

  const naive = h * h
  const dcmha = 2 * h * r + h
  const ratio = dcmha / naive
  const extraParamPct = ((2 * r + 1) / (3 * D_H)) * 100
  const top = Math.max(naive, dcmha)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        cost of composing heads: full tensor vs. low-rank + diagonal
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>heads (H)</span>
              <span className="tabular-nums text-foreground">{h}</span>
            </div>
            <Range
              min={2}
              max={64}
              step={2}
              value={h}
              onChange={(e) => setH(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer"
              aria-label="number of heads"
              accent={ACCENT}
            />
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-muted-foreground">rank (R)</span>
            {[1, 2, 4].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setR(v as 1 | 2 | 4)}
                aria-pressed={r === v}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 transition-colors",
                  r === v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={r === v ? { background: ACCENT } : undefined}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-right font-mono text-xs text-muted-foreground">
              naive H² tensor
            </span>
            <div className="relative h-5 flex-1 rounded-sm bg-muted/30">
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                style={{ width: `${(naive / top) * 100}%`, background: NAIVE }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
              {naive.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-right font-mono text-xs text-muted-foreground">
              DCMHA 2HR+H
            </span>
            <div className="relative h-5 flex-1 rounded-sm bg-muted/30">
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                style={{ width: `${(dcmha / top) * 100}%`, background: ACCENT }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
              {dcmha.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            DCMHA cost / naive cost ={" "}
            <span className="text-foreground">{(ratio * 100).toFixed(1)}%</span>
          </span>
          <span>
            extra params at D_h={D_H}:{" "}
            <span className="text-foreground">{extraParamPct.toFixed(2)}%</span>
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The naive way to let every head read every other head is a transform tensor of
          size H², applied at every query/key pair — quadratic in head count. DCMHA never
          forms it: the query-wise and key-wise Compose terms are each a rank-{r} product
          plus a diagonal gate, so the real cost is <strong>2HR + H</strong>. At H = {h},
          R = {r}, that is <span className="text-foreground">{dcmha}</span>{" "}instead of{" "}
          <span className="text-foreground">{naive}</span>{" "}— and the gap only grows as H
          scales up, which is why DCMHA stays cheap at 32 and 64 heads where a full H×H
          tensor would not. The paper reports this concretely at 6.9B scale (D_h = 128,
          R = 2): about 1.3% extra parameters and 1.9–3.3% extra FLOPs, depending on
          sequence length.
        </p>
      </div>
    </figure>
  )
}
