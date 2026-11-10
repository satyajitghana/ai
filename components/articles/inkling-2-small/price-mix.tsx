"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Tinker list prices, USD per million tokens, read from
// tinker-docs.thinkingmachines.ai/tinker/models/models_and_pricing/ on
// 2026-11-10 (64K-context rows). Prefill is input, Sample is output, Train is
// fine-tuning. The blended price is (1 - s) * prefill + s * sample for an
// output share s, with a cached fraction of the input billed at the cached rate.

const MODELS = [
  { name: "Inkling 2 Small", active: 17, total: 594, prefill: 0.3, cached: 0.03, sample: 1.0, train: 1.5, color: "oklch(0.70 0.15 55)" },
  { name: "Inkling-Small", active: 12, total: 276, prefill: 0.58, cached: 0.116, sample: 1.44, train: 1.73, color: "oklch(0.62 0.12 160)" },
  { name: "Inkling", active: 41, total: 975, prefill: 1.87, cached: 0.374, sample: 4.68, train: 5.61, color: "oklch(0.58 0.14 255)" },
] as const

export function PriceMix() {
  const [outShare, setOutShare] = useState(10)
  const [cachedShare, setCachedShare] = useState(50)

  const s = outShare / 100
  const c = cachedShare / 100
  const rows = MODELS.map((m) => {
    const input = (1 - c) * m.prefill + c * m.cached
    const blended = (1 - s) * input + s * m.sample
    return { ...m, blended, perActive: blended / m.active }
  })
  const max = Math.max(...rows.map((r) => r.blended))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>blended price per million tokens on Tinker</span>
        <span className="text-muted-foreground/60">list prices read 2026-11-10</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>output share of tokens: {outShare}%</span>
            <Range
              min={1}
              max={60}
              value={outShare}
              onChange={(e) => setOutShare(Number(e.target.value))}
              aria-label="Output share of tokens"
            />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>input served from prefix cache: {cachedShare}%</span>
            <Range
              min={0}
              max={95}
              value={cachedShare}
              onChange={(e) => setCachedShare(Number(e.target.value))}
              aria-label="Cached share of input"
            />
          </label>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">{r.name}</span>
              <div className="relative h-5 flex-1 rounded-sm bg-muted/30">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${Math.max((r.blended / max) * 100, 1).toFixed(2)}%`, background: r.color }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">
                &#36;{r.blended.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">model</th>
                <th className="py-1 pr-2 font-normal">active / total</th>
                <th className="py-1 pr-2 font-normal">in / cached / out</th>
                <th className="py-1 pr-2 font-normal">train</th>
                <th className="py-1 font-normal">blended per 1B active</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-border/40">
                  <td className="py-1 pr-2">{r.name}</td>
                  <td className="py-1 pr-2">
                    {r.active}B / {r.total}B
                  </td>
                  <td className="py-1 pr-2">
                    {r.prefill} / {r.cached} / {r.sample}
                  </td>
                  <td className="py-1 pr-2">{r.train}</td>
                  <td className="py-1">&#36;{r.perActive.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The newer, larger model lists below the smaller one it replaces on every line, input, output and training. A
          list price is a business decision as much as a cost, so this says what Tinker charges, not what the model
          costs to serve.
        </p>
      </div>
    </figure>
  )
}
