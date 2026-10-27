"use client"

import { useState } from "react"

// Three E2B-relevant PRs report their own end-to-end speedups. Multiply them and compare with the headline.
// Reasoned: the product is an upper bound only if the effects were independent; the first two both cut prefill work.

const BASE = 37_900
const HEAD = 108_000
const ITEMS = [
  { n: 60445, label: "KV-sharing fast prefill", lo: 1.0, hi: 2.06, def: 1.5, note: "reported 1.34-2.06x prefill-heavy, 1.04-1.21x decode-heavy" },
  { n: 60674, label: "Fused Triton kernels", lo: 1.0, hi: 1.9, def: 1.4, note: "reported up to 1.90x prefill, 1.06x decode" },
  { n: 60317, label: "Attention tiling", lo: 1.0, hi: 1.12, def: 1.06, note: "reported 1.02-1.12x" },
] as const

export function SpeedupCompose() {
  const [v, setV] = useState<number[]>(ITEMS.map((i) => i.def))
  const prod = v.reduce((a, b) => a * b, 1)
  const target = HEAD / BASE
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        reported per-PR factors, multiplied · the headline is {HEAD.toLocaleString("en-US")} / {BASE.toLocaleString("en-US")} = {target.toFixed(3)}x
      </div>
      <div className="grid gap-3 p-3 sm:p-4">
        {ITEMS.map((it, i) => (
          <label key={it.n} className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
            <span>
              #{it.n} {it.label}: <span className="text-foreground">{v[i].toFixed(2)}x</span> <span className="opacity-70">({it.note})</span>
            </span>
            <input
              type="range"
              min={it.lo}
              max={it.hi}
              step={0.01}
              value={v[i]}
              aria-label={`${it.label} factor`}
              onChange={(e) => setV(v.map((x, j) => (j === i ? Number(e.target.value) : x)))}
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span>
            product: <b>{prod.toFixed(2)}x</b>
          </span>
          <span className="text-muted-foreground">
            {prod >= target ? "reaches" : "falls short of"} {target.toFixed(2)}x
          </span>
          <span className="text-muted-foreground">at that factor, {BASE.toLocaleString("en-US")} tok/s becomes {Math.round(BASE * prod).toLocaleString("en-US")}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          All three sliders at their reported maxima give {(2.06 * 1.9 * 1.12).toFixed(2)}x, so the headline is reachable only near the top of every range at
          once. Fast prefill and the fused kernels both remove prefill work, so their gains need not multiply. None of the PRs says which workload produced
          37,900 and 108,000.
        </p>
      </div>
    </figure>
  )
}
