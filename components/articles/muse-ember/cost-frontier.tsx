"use client"

import { useState } from "react"

// Artificial Analysis Intelligence Index v5.0.1 against cost per index task, one
// point per reasoning-effort setting. Every number is read from the model objects
// embedded in artificialanalysis.ai/models/<slug> pages (fields intelligenceIndex,
// intelligenceIndexCostPerTask.cost.total and .cacheRead,
// intelligenceIndexOutputTokensPerTask.output, cacheHitPrice), fetched 2026-11-09.
//
// All three models list $0.10 per million input tokens and $0.50 per million
// output tokens. The only list price that differs is the cache read: $0.004 for
// Muse Ember, $0.01 for the other two. The toggle re-prices Ember's cache reads at
// $0.01 (multiplies its cacheRead cost by 2.5) and leaves everything else alone.

type Pt = { effort: string; idx: number; cost: number; cacheRead: number; out: number }
type Series = { id: string; name: string; color: string; pts: Pt[] }

const EMBER = "oklch(0.58 0.17 255)"
const HAIKU = "oklch(0.62 0.15 40)"
const LUNA = "oklch(0.6 0.12 150)"

const SERIES: Series[] = [
  {
    id: "ember",
    name: "Muse Ember",
    color: EMBER,
    pts: [
      { effort: "xhigh", idx: 34.11, cost: 0.1162, cacheRead: 0.0565, out: 72365 },
      { effort: "max", idx: 36.02, cost: 0.1359, cacheRead: 0.0665, out: 84482 },
    ],
  },
  {
    id: "haiku",
    name: "Claude Haiku 5.5",
    color: HAIKU,
    pts: [
      { effort: "medium", idx: 24.6, cost: 0.0918, cacheRead: 0.0473, out: 53335 },
      { effort: "high", idx: 29.87, cost: 0.1586, cacheRead: 0.0864, out: 88064 },
      { effort: "xhigh", idx: 34.64, cost: 0.2484, cacheRead: 0.1385, out: 136177 },
      { effort: "max", idx: 36.48, cost: 0.411, cacheRead: 0.2325, out: 225966 },
    ],
  },
  {
    id: "luna",
    name: "GPT-6 Luna",
    color: LUNA,
    pts: [
      { effort: "high", idx: 21.43, cost: 0.0729, cacheRead: 0.0433, out: 32839 },
      { effort: "xhigh", idx: 23.45, cost: 0.1041, cacheRead: 0.0651, out: 43893 },
      { effort: "max", idx: 27.86, cost: 0.152, cacheRead: 0.0896, out: 75296 },
    ],
  },
]

const W = 640
const H = 340
const L = 52
const R = 16
const T = 14
const B = 44
const XMAX = 0.45
const YMIN = 18
const YMAX = 40

const sx = (c: number) => L + (c / XMAX) * (W - L - R)
const sy = (v: number) => T + ((YMAX - v) / (YMAX - YMIN)) * (H - T - B)
const usd = (n: number) => `$${n.toFixed(3)}`
const k = (n: number) => `${Math.round(n / 1000)}K`

export function CostFrontier() {
  const [same, setSame] = useState(false)
  const [sel, setSel] = useState("ember:max")

  const priced = (s: Series, p: Pt) => (s.id === "ember" && same ? p.cost + p.cacheRead * 1.5 : p.cost)

  const [sid, eff] = sel.split(":")
  const s0 = SERIES.find((s) => s.id === sid) ?? SERIES[0]
  const p0 = s0.pts.find((p) => p.effort === eff) ?? s0.pts[1]
  const emberMax = SERIES[0].pts[1]
  const haikuMax = SERIES[1].pts[3]
  const emberCost = priced(SERIES[0], emberMax)
  const ratio = emberCost / haikuMax.cost

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>AA Intelligence Index v5.0.1 against cost per index task</span>
        <span className="text-muted-foreground/60">artificialanalysis.ai, 2026-11-09</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setSame((v) => !v)}
            aria-pressed={same}
            className={`rounded-md border px-2.5 py-1 ${same ? "bg-muted" : "bg-background"}`}
          >
            {same ? "Ember cache reads at $0.01 (the others' price)" : "Ember cache reads at $0.004 (list price)"}
          </button>
          <span className="text-muted-foreground">click to re-price</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">Ember max</div>
            <div className="text-lg" style={{ color: EMBER }}>{usd(emberCost)}</div>
            <div className="text-muted-foreground/70">index 36.02</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">Haiku 5.5 max</div>
            <div className="text-lg" style={{ color: HAIKU }}>{usd(haikuMax.cost)}</div>
            <div className="text-muted-foreground/70">index 36.48</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">Ember / Haiku cost</div>
            <div className="text-lg">{ratio.toFixed(2)}</div>
            <div className="text-muted-foreground/70">{same ? "same cache price" : "Meta's \"about a third\""}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">output tokens / task</div>
            <div className="text-lg">
              {k(emberMax.out)} <span className="text-muted-foreground">vs</span> {k(haikuMax.out)}
            </div>
            <div className="text-muted-foreground/70">both at max effort</div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter of index score against cost per task. ${SERIES.map((s) => `${s.name}: ${s.pts.map((p) => `${p.effort} ${p.idx} at ${usd(priced(s, p))}`).join(", ")}`).join(". ")}.`}
        >
          {[20, 25, 30, 35, 40].map((v) => (
            <g key={v}>
              <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 8} y={sy(v) + 4} textAnchor="end" fontSize={13} className="fill-muted-foreground font-mono">
                {v}
              </text>
            </g>
          ))}
          {[0, 0.1, 0.2, 0.3, 0.4].map((c) => (
            <text key={c} x={sx(c)} y={H - B + 20} textAnchor="middle" fontSize={13} className="fill-muted-foreground font-mono">
              {`$${c.toFixed(1)}`}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} className="fill-muted-foreground font-mono">
            cost per index task (USD)
          </text>
          {SERIES.map((s) => (
            <g key={s.id}>
              <polyline
                points={s.pts.map((p) => `${sx(priced(s, p))},${sy(p.idx)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                opacity={0.6}
              />
              {s.pts.map((p) => {
                const key = `${s.id}:${p.effort}`
                const hot = key === sel
                return (
                  <g key={key} onClick={() => setSel(key)} style={{ cursor: "pointer" }}>
                    <circle cx={sx(priced(s, p))} cy={sy(p.idx)} r={hot ? 8 : 6} fill={s.color} stroke="var(--background)" strokeWidth={2} />
                    <text x={sx(priced(s, p)) + 10} y={sy(p.idx) + (s.id === "ember" ? -8 : 16)} fontSize={12} fill={s.color} className="font-mono">
                      {p.effort}
                    </text>
                  </g>
                )
              })}
            </g>
          ))}
          {SERIES.map((s, i) => (
            <g key={`lg-${s.id}`}>
              <circle cx={L + 14 + i * 170} cy={T + 8} r={5} fill={s.color} />
              <text x={L + 24 + i * 170} y={T + 12} fontSize={12} className="fill-foreground font-mono">
                {s.name}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-2 rounded-lg border px-3 py-2 font-mono text-xs">
          <span style={{ color: s0.color }}>{`${s0.name} (${p0.effort})`}</span>
          <span className="text-muted-foreground">{` index ${p0.idx.toFixed(2)}, ${usd(priced(s0, p0))} per task, of which cache reads ${usd(s0.id === "ember" && same ? p0.cacheRead * 2.5 : p0.cacheRead)}; ${p0.out.toLocaleString("en-US")} output tokens per task`}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          One point per reasoning-effort setting; click a point for its breakdown. All three models list the same input and output
          price, so horizontal distance is mostly tokens. The one price that differs is the cache read, and in an agent benchmark about
          97% of input tokens are cache reads. The toggle bills Ember&apos;s cache reads at the rate the other two pay: its max point
          moves from {usd(emberMax.cost)} to {usd(emberMax.cost + emberMax.cacheRead * 1.5)}, and &quot;a third of the cost&quot;
          becomes a little over half.
        </p>
      </div>
    </figure>
  )
}
