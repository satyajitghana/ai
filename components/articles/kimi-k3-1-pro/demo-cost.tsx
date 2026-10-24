"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What a run costs at the Kimi API list price (platform.kimi.ai/docs/pricing/chat,
// read 2026-10-24), and what token mix the post's "3.8M tokens, $34.72" needs.
//
//   cost = T · ( o · P_out + (1 − o) · ( c · P_cached + (1 − c) · P_in ) )
//
// T total tokens, o the output share, c the cache-hit share of input. A 5-minute
// cache write is billed at the input price, so un-cached input is P_in either
// way. Solving for o at the claimed T and cost gives the output share the claim
// implies. Presets: the claim itself, Artificial Analysis's measured token mix
// for K3.1 Pro across its Intelligence Index (2.67% output, 94% of input cached),
// and the mean successful xdev-bench-hard trajectory in Moonshot's own table
// (159.8M in / 546K out, 0.34% output; caching not stated, so 0% here).

type Variant = "pro" | "highspeed" | "k3"
const PRICE: Record<Variant, { name: string; inp: number; out: number; cached: number }> = {
  pro: { name: "kimi-k3.1-pro", inp: 2, out: 10, cached: 0.2 },
  highspeed: { name: "kimi-k3.1-pro-highspeed", inp: 4, out: 20, cached: 0.2 },
  k3: { name: "kimi-k3", inp: 3, out: 15, cached: 0.3 },
}
const CLAIM_T = 3.8
const CLAIM_COST = 34.72

const PRESETS = [
  { id: "claim", label: "the post: 3.8M tokens", t: 3.8, o: 10, c: 0 },
  { id: "aa", label: "AA index mix", t: 3.8, o: 2.67, c: 94 },
  { id: "xdev", label: "xdev trajectory mix", t: 3.8, o: 0.34, c: 0 },
]

const usd = (v: number) => `$${v.toFixed(2)}`

export function DemoCost() {
  const [variant, setVariant] = useState<Variant>("pro")
  const [t, setT] = useState(3.8) // million tokens
  const [o, setO] = useState(10) // % output
  const [c, setC] = useState(0) // % of input served from cache

  const p = PRICE[variant]
  const inEff = (c / 100) * p.cached + (1 - c / 100) * p.inp
  const perM = (o / 100) * p.out + (1 - o / 100) * inEff
  const cost = t * perM

  // the output share that makes 3.8M tokens cost $34.72 at this cache share
  const need = (CLAIM_COST / CLAIM_T - inEff) / (p.out - inEff)
  const needTxt = need > 1 ? "impossible: more than 100% output" : need < 0 ? "below 0%" : `${(need * 100).toFixed(1)}% output`
  const buys = CLAIM_COST / perM

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-dashed border-foreground/15 text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="space-y-2 border-b px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground">list-price check · 3.8M tokens for $34.72?</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRICE) as Variant[]).map((v) => (
            <button key={v} type="button" aria-pressed={variant === v} onClick={() => setVariant(v)} className={chip(variant === v)}>
              {PRICE[v].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => {
                setT(pr.t)
                setO(pr.o)
                setC(pr.c)
              }}
              className={chip(t === pr.t && o === pr.o && c === pr.c)}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>total tokens</span>
            <span className="tabular-nums text-foreground">{t.toFixed(1)}M</span>
          </div>
          <Range min={0.5} max={100} step={0.1} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="total tokens, millions" />
        </label>
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>output share</span>
            <span className="tabular-nums text-foreground">{o.toFixed(2)}%</span>
          </div>
          <Range min={0} max={100} step={0.01} value={o} onChange={(e) => setO(Number(e.target.value))} aria-label="output share, percent" />
        </label>
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>input served from cache</span>
            <span className="tabular-nums text-foreground">{c}%</span>
          </div>
          <Range min={0} max={99} step={1} value={c} onChange={(e) => setC(Number(e.target.value))} aria-label="cache-hit share of input, percent" />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">this run costs</div>
            <div className="font-mono text-lg tabular-nums">{usd(cost)}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{usd(perM)} per million tokens</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">$34.72 buys, at this mix</div>
            <div className="font-mono text-lg tabular-nums">{buys.toFixed(1)}M tokens</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">3.8M at $34.72 needs</div>
            <div className="font-mono text-sm tabular-nums">{needTxt}</div>
            <div className="font-mono text-[10px] text-muted-foreground">at this cache share</div>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          At list price, 3.8M tokens of K3.1 Pro cost between $0.76 (all cached input) and $38.00 (all output). Hitting
          $34.72 needs about 89% of the tokens to be output with nothing cached, or 32% output on Highspeed. Agent runs
          look nothing like that: in Artificial Analysis&rsquo;s runs of K3.1 Pro, 2.67% of tokens were output and 94% of
          input came from cache, and at that mix 3.8M tokens cost roughly two dollars while $34.72 buys about 61M.
        </p>
      </div>
    </figure>
  )
}
