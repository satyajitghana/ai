"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The published beta price list, plus the thing the list does not say out loud:
// the output multiplier varies from 2x to 5x across the catalog, and agent work
// is output-heavy, so the ranking by headline input price is not the ranking by
// what you actually pay.
//
// Prices are USD per 1M tokens, exactly as published on 2026-08-13. The cost
// model is mine: pick a token mix, and the bars re-rank.

type M = { id: string; label: string; inp: number; out: number }

const MODELS: M[] = [
  { id: "dsflash", label: "deepseek-v4-flash-latest", inp: 0.14, out: 0.28 },
  { id: "trinity", label: "trinity-large-thinking", inp: 0.25, out: 0.8 },
  { id: "inkling", label: "inkling-small", inp: 0.5, out: 1.2 },
  { id: "glm", label: "glm-5.2", inp: 1.4, out: 4.4 },
  { id: "dspro", label: "deepseek-v4-pro", inp: 1.74, out: 3.48 },
  { id: "kimi", label: "kimi-k3", inp: 3.0, out: 15.0 },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"

export function PriceLadder() {
  // millions of tokens in a notional long-horizon job
  const [inM, setInM] = useState(20)
  const [outM, setOutM] = useState(2)

  const rows = MODELS.map((m) => ({
    ...m,
    cost: m.inp * inM + m.out * outM,
    ratio: m.out / m.inp,
  })).sort((a, b) => a.cost - b.cost)

  const max = Math.max(...rows.map((r) => r.cost))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">beta price list · USD per 1M tokens</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {inM}M in · {outM}M out
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-44 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                {r.label}
              </span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${(r.cost / max) * 100}%`, background: ACCENT }} />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                ${r.cost.toFixed(2)}
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-[9px]" style={{ color: WARM }}>
                {r.ratio.toFixed(1)}×
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 text-right font-mono text-[9px] text-muted-foreground">
          right column: output price ÷ input price
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">input</span>
            <Range min={1} max={100} step={1} value={inM} onChange={(e) => setInM(Number(e.target.value))} className="flex-1" aria-label="millions of input tokens" accent={ACCENT} />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{inM}M</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">output</span>
            <Range min={0} max={40} step={1} value={outM} onChange={(e) => setOutM(Number(e.target.value))} className="flex-1" aria-label="millions of output tokens" accent={WARM} />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{outM}M</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { l: "read-heavy (20M / 2M)", i: 20, o: 2 },
            { l: "balanced (10M / 10M)", i: 10, o: 10 },
            { l: "generation-heavy (5M / 25M)", i: 5, o: 25 },
          ].map((p) => (
            <button
              key={p.l}
              type="button"
              onClick={() => { setInM(p.i); setOutM(p.o) }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                inM === p.i && outM === p.o
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.l}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The output multiplier is the number the price list does not draw attention to, and it ranges from{" "}
          <span className="text-foreground">2× to 5×</span>{" "}across six models. DeepSeek-V4-Flash and V4-Pro both
          charge exactly double for output; Kimi K3 charges five times. That means the ordering you get from
          skimming input prices is not the ordering you pay. Kimi K3&rsquo;s input price is 21× DeepSeek-V4-Flash&rsquo;s,
          but on a generation-heavy job the bill is 50× — the multiplier more than doubles the gap. And GLM-5.2
          overtakes DeepSeek-V4-Pro on that mix despite being the cheaper of the two to read.
        </p>
      </div>
    </figure>
  )
}
