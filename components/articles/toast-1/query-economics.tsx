"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Per-query cost and latency, from the launch post's own figures:
//
//   standard Toast 1   $0.016 - $0.023   ~8 s median
//   fusion (RRF x3)    $0.05  - $0.07    ~11 s median
//   frontier agents    "7-11x cheaper"   20 s to 4 minutes
//
// The frontier band is the post's own characterisation of the systems in its
// evaluation that reached similar quality; it names no model per point, so it
// is drawn as a band rather than a set of dots. Cost for that band is derived
// from the stated 7-11x multiple against the standard configuration, which
// makes it an inference from their claim rather than a published number — the
// component labels it as such.

type Mode = { id: string; name: string; lo: number; hi: number; latLo: number; latHi: number; derived?: boolean; note: string }

const MODES: Mode[] = [
  {
    id: "std",
    name: "Toast 1 · standard",
    lo: 0.016, hi: 0.023, latLo: 8, latHi: 8,
    note: "The default configuration. Eight-second median latency is slow for a search box and fast for an agent that decomposes a query, runs several rounds of retrieval, and inspects sources before answering.",
  },
  {
    id: "fusion",
    name: "Toast 1 · fusion (RRF ×3)",
    lo: 0.05, hi: 0.07, latLo: 11, latHi: 11,
    note: "Three retrieval passes fused with reciprocal rank fusion. Roughly 3x the cost and 3 seconds more latency for the highest quality the post reports — this is the configuration plotted on the BrowseComp Plus chart.",
  },
  {
    id: "frontier",
    name: "frontier retrieval agents",
    lo: 0.112, hi: 0.253, latLo: 20, latHi: 240, derived: true,
    note: "The systems in Mixedbread's evaluation that reached comparable quality. Latency is quoted directly — 20 seconds to four minutes. The cost band here is derived from the post's \"7-11x cheaper\" claim rather than published per-system, so treat it as their arithmetic, not a measurement.",
  },
]

const A = "oklch(0.60 0.15 255)"
const B = "oklch(0.68 0.13 85)"
const C = "oklch(0.62 0.03 250)"
const COLORS = [A, B, C]

export function QueryEconomics() {
  const [sel, setSel] = useState(0)
  const [queries, setQueries] = useState(10000)
  const m = MODES[sel]

  const maxCost = 0.253
  const maxLat = 240

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n))
  const monthly = (mm: Mode) => [mm.lo * queries, mm.hi * queries]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">cost and latency per query</span>
        <span className="font-mono text-[10px] text-muted-foreground">launch pricing</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {MODES.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "w-full cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
              )}
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-foreground">
                  {x.name}
                  {x.derived ? <span className="ml-1 text-muted-foreground">· cost derived</span> : null}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  ${x.lo.toFixed(3)}–${x.hi.toFixed(3)} · {x.latLo === x.latHi ? `${x.latLo}s` : `${x.latLo}–${x.latHi}s`}
                </span>
              </div>
              <div className="relative h-3 rounded-sm bg-muted/40">
                <div
                  className="absolute inset-y-0 rounded-sm"
                  style={{
                    left: `${(x.lo / maxCost) * 100}%`,
                    width: `${Math.max(1.5, ((x.hi - x.lo) / maxCost) * 100)}%`,
                    background: COLORS[i],
                  }}
                />
              </div>
              <div className="relative mt-1 h-2 rounded-sm bg-muted/25">
                <div
                  className="absolute inset-y-0 rounded-sm"
                  style={{
                    left: `${(x.latLo / maxLat) * 100}%`,
                    width: `${Math.max(1, ((x.latHi - x.latLo) / maxLat) * 100)}%`,
                    background: COLORS[i],
                    opacity: 0.5,
                  }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">queries / month</span>
          <Range
            min={1000}
            max={1000000}
            step={1000}
            value={queries}
            onChange={(e) => setQueries(Number(e.target.value))}
            className="min-w-[10rem] flex-1"
            aria-label="queries per month"
            accent={A}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{fmt(queries)}</span>
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {MODES.map((x, i) => {
            const [a, b] = monthly(x)
            return (
              <div key={x.id} className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
                <div className="truncate font-mono text-[10px] text-muted-foreground">{x.name}</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: COLORS[i] }}>
                  ${Math.round(a).toLocaleString()}–${Math.round(b).toLocaleString()}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {m.note}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two of these three bands are published numbers and one is arithmetic. Mixedbread gives cost and latency
          directly for both Toast 1 configurations, and for the frontier comparison gives latency (20 seconds to
          four minutes) but only a multiple for cost — &ldquo;7–11× cheaper.&rdquo; The band above inverts that
          multiple, so it is their claim rendered, not an independent measurement. The latency gap is the part that
          needs no arithmetic: a search subagent that answers in eight seconds and one that answers in four minutes
          are different products regardless of price.
        </p>
      </div>
    </figure>
  )
}
