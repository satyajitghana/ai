"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Multi-token prediction, made adjustable. From one position t, the model predicts
// the next n tokens at once: a shared trunk feeds n output heads (Meta's parallel
// heads) or n sequential modules that keep the causal chain (DeepSeek-V3). Pick n,
// flip the flavor, and read off the training loss as a sum of cross-entropies.
// Hand-authored example; the predicted tokens are illustrative.

const CTX = ["The", "cat", "sat", "on", "the"]
const FUTURE = ["mat", "and", "the", "dog"] // x_{t+1..t+4}

export function MTPHeads() {
  const [n, setN] = useState(4)
  const [sequential, setSequential] = useState(false)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">multi-token prediction · n heads</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "parallel (Meta)" },
            { v: true, label: "sequential (DeepSeek)" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setSequential(o.v)}
              aria-pressed={sequential === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                sequential === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* context */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {CTX.map((w, i) => (
            <span
              key={i}
              className={cn(
                "rounded border px-2 py-1",
                i === CTX.length - 1
                  ? "border-foreground/40 text-foreground"
                  : "bg-muted/40 text-muted-foreground"
              )}
            >
              {w}
            </span>
          ))}
          <span className="font-mono text-[10px] text-muted-foreground">← position t</span>
        </div>

        {/* trunk */}
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-center font-mono text-xs">
          shared transformer trunk → z<sub>t</sub>
        </div>

        {/* heads */}
        <div className={cn("grid gap-2", `grid-cols-${n}`)} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {FUTURE.slice(0, n).map((tok, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {/* dependency arrow in sequential mode */}
              <div className="flex h-3 items-center font-mono text-[10px] text-muted-foreground">
                {sequential && i > 0 ? "↳ sees x" : ""}
                {sequential && i > 0 ? <sub>t+{i}</sub> : ""}
              </div>
              <div
                className="w-full rounded px-1 py-1.5 text-center font-mono text-[10px]"
                style={{ background: `oklch(0.72 0.13 ${150 + i * 12})`, color: "oklch(0.2 0 0)" }}
              >
                {sequential ? `module ${i + 1}` : `head ${i + 1}`}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                x<sub>t+{i + 1}</sub>
              </div>
              <div className="w-full rounded border bg-background px-1 py-1 text-center font-mono text-xs">
                {tok}
              </div>
            </div>
          ))}
        </div>

        {/* loss */}
        <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">L</span> ={" "}
          {FUTURE.slice(0, n).map((_, i) => (
            <span key={i}>
              {i > 0 ? " − " : "− "}log P(x<sub>t+{i + 1}</sub> | z<sub>t</sub>
              {sequential && i > 0 ? <>, x<sub>t+{i}</sub></> : null})
            </span>
          ))}
        </div>

        {/* n selector */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">n =</span>
          {[1, 2, 3, 4].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setN(k)}
              aria-pressed={n === k}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                n === k
                  ? "border-transparent bg-foreground text-background"
                  : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {k}
            </button>
          ))}
          {n === 4 ? (
            <span className="text-muted-foreground">· n=4 is the sweet spot for ~7B on code</span>
          ) : null}
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {sequential
            ? "DeepSeek-V3 keeps the full causal chain: module k feeds its hidden state and the already-known token forward, so depth-2 conditions on depth-1's prediction. Heavier, but the drafts are coherent."
            : "Meta's heads are independent off the same trunk — they don't see each other's predictions. Cheaper, and at inference you can discard the extra heads for a zero-overhead next-token model, or keep them to self-speculate."}
        </p>
      </div>
    </figure>
  )
}
