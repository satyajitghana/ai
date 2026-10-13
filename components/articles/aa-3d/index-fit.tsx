"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// "Each point on the Intelligence Index is worth about 18 Elo (Pearson 0.92)."
// The 21 rows are Artificial Analysis's own records, read from the model data
// embedded in artificialanalysis.ai/evaluations/aa-3d on 13 October 2026:
// AA-3D Elo, Intelligence Index v4.3, Terminal-Bench 4.0 and SciCode (both as
// percentages). The fit is ordinary least squares and r is Pearson's, computed
// here; with all 21 rows it reproduces AA's 18 and 0.92, and its 0.81 and 0.76
// for the two single benchmarks.

type Row = { name: string; elo: number; ii: number; tb: number; sc: number; text?: boolean }

const ROWS: Row[] = [
  { name: "Claude Sonnet 5.5", elo: 1194.2, ii: 56.0, tb: 63.6, sc: 61.0 },
  { name: "Claude Opus 5.5", elo: 1190.1, ii: 57.6, tb: 59.6, sc: 66.9 },
  { name: "GPT-6 Astra", elo: 1165.2, ii: 52.7, tb: 59.1, sc: 56.5 },
  { name: "Claude Fable 5.1", elo: 1131.4, ii: 53.4, tb: 52.0, sc: 63.1 },
  { name: "GPT-6 Sol", elo: 1122.7, ii: 47.6, tb: 43.9, sc: 57.6 },
  { name: "GPT-6.1 Sol", elo: 1114.5, ii: 51.8, tb: 56.1, sc: 54.2 },
  { name: "Muse Spark 1.3", elo: 1035.3, ii: 48.1, tb: 33.3, sc: 58.8 },
  { name: "GPT-6 Luna", elo: 1000.0, ii: 38.1, tb: 12.6, sc: 54.6 },
  { name: "Claude Haiku 5.5", elo: 994.0, ii: 43.4, tb: 32.8, sc: 55.0 },
  { name: "Grok 4.7", elo: 993.7, ii: 46.4, tb: 25.8, sc: 57.4 },
  { name: "Kimi K3", elo: 981.9, ii: 43.6, tb: 12.6, sc: 59.5 },
  { name: "MiMo-V2.6-Pro", elo: 977.2, ii: 46.3, tb: 34.8, sc: 60.9 },
  { name: "Gemini 3.8 Flash", elo: 964.8, ii: 40.9, tb: 19.7, sc: 56.6 },
  { name: "Qwen3.8 Max", elo: 948.3, ii: 45.4, tb: 38.9, sc: 52.1 },
  { name: "GLM-5.3-Flash", elo: 930.7, ii: 41.8, tb: 32.8, sc: 51.6 },
  { name: "Mistral Large 4 Preview", elo: 867.8, ii: 38.4, tb: 26.8, sc: 54.2 },
  { name: "Step 5 Preview", elo: 847.5, ii: 43.7, tb: 33.3, sc: 58.9 },
  { name: "GLM-5.3", elo: 781.7, ii: 44.8, tb: 41.9, sc: 59.0, text: true },
  { name: "MiniMax-M3", elo: 738.6, ii: 29.2, tb: 2.0, sc: 47.1 },
  { name: "Inkling", elo: 579.1, ii: 25.0, tb: 1.0, sc: 47.0 },
  { name: "Nemotron 3 Ultra", elo: 569.1, ii: 22.9, tb: 0.5, sc: 40.3, text: true },
]

// The three with an Intelligence Index under 30.
const WEAKEST = new Set(["MiniMax-M3", "Inkling", "Nemotron 3 Ultra"])

type Axis = "ii" | "tb" | "sc"
const AXES: { id: Axis; label: string; unit: string; lo: number; hi: number }[] = [
  { id: "ii", label: "Intelligence Index", unit: "points", lo: 20, hi: 60 },
  { id: "tb", label: "Terminal-Bench 4.0", unit: "%", lo: 0, hi: 70 },
  { id: "sc", label: "SciCode", unit: "%", lo: 38, hi: 70 },
]

function ols(xs: number[], ys: number[]) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) * (xs[i] - mx)
    syy += (ys[i] - my) * (ys[i] - my)
  }
  const slope = sxy / sxx
  return { n, slope, icpt: my - slope * mx, r: sxy / Math.sqrt(sxx * syy) }
}

const W = 600
const H = 320
const P = { l: 46, r: 14, t: 14, b: 38 }
const Y0 = 500
const Y1 = 1250

export function IndexFit() {
  const [axis, setAxis] = useState<Axis>("ii")
  const [drop, setDrop] = useState(false)
  const ax = AXES.find((a) => a.id === axis)!
  const rows = ROWS.filter((r) => !(drop && WEAKEST.has(r.name)))
  const fitR = ols(
    rows.map((r) => r[axis]),
    rows.map((r) => r.elo),
  )
  const sx = (v: number) => P.l + ((v - ax.lo) / (ax.hi - ax.lo)) * (W - P.l - P.r)
  const sy = (v: number) => P.t + (1 - (v - Y0) / (Y1 - Y0)) * (H - P.t - P.b)
  const resid = rows
    .map((r) => ({ name: r.name, d: r.elo - (fitR.icpt + fitR.slope * r[axis]) }))
    .sort((a, b) => b.d - a.d)
  const top = resid.slice(0, 2)
  const bottom = resid.slice(-2).reverse()
  const yTicks = [600, 800, 1000, 1200]
  const xTicks = [0, 1, 2, 3, 4].map((k) => ax.lo + ((ax.hi - ax.lo) * k) / 4)
  const desc = `AA-3D Elo against ${ax.label} for ${fitR.n} models: ${fitR.slope.toFixed(1)} Elo per ${
    ax.unit === "%" ? "percentage point" : "point"
  }, Pearson r ${fitR.r.toFixed(2)}.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>AA-3D Elo against general benchmarks</span>
        <span className="text-muted-foreground/60">AA&apos;s records · fit computed here</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 font-mono text-[10px]">
        {AXES.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={axis === a.id}
            onClick={() => setAxis(a.id)}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
              axis === a.id
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={drop}
          onClick={() => setDrop((v) => !v)}
          className={cn(
            "ml-2 cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
            drop
              ? "border-amber-600/50 bg-amber-500/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {drop ? "three weakest dropped" : "drop the three weakest"}
        </button>
      </div>
      <div className="overflow-x-auto px-4 pt-2 pb-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label={desc}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.15} />
              <text x={P.l - 6} y={sy(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={H - P.b + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {t.toFixed(0)}
            </text>
          ))}
          <text x={(P.l + W - P.r) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
            {ax.label} ({ax.unit})
          </text>
          <text x={10} y={P.t + 4} className="fill-muted-foreground font-mono" fontSize={9.5}>
            Elo
          </text>
          <line
            x1={sx(ax.lo)}
            x2={sx(ax.hi)}
            y1={sy(fitR.icpt + fitR.slope * ax.lo)}
            y2={sy(fitR.icpt + fitR.slope * ax.hi)}
            stroke="oklch(0.58 0.14 250)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          {ROWS.map((r) => {
            const out = drop && WEAKEST.has(r.name)
            const yy = Math.max(P.t, Math.min(H - P.b, sy(r.elo)))
            const labelled = top.some((t) => t.name === r.name) || bottom.some((t) => t.name === r.name)
            return (
              <g key={r.name} opacity={out ? 0.25 : 1}>
                <circle
                  cx={sx(r[axis])}
                  cy={yy}
                  r={4}
                  fill={r.text ? "none" : "currentColor"}
                  stroke="currentColor"
                  className={labelled ? "text-sky-600 dark:text-sky-400" : "text-foreground/70"}
                >
                  <title>{`${r.name}: Elo ${r.elo.toFixed(0)}, ${ax.label} ${r[axis].toFixed(1)}`}</title>
                </circle>
                {labelled && !out ? (
                  <text x={sx(r[axis]) + 7} y={yy + 3} className="fill-sky-700 font-mono dark:fill-sky-300" fontSize={9}>
                    {r.name}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="grid gap-x-6 gap-y-1 border-t px-4 py-3 font-mono text-[11px] sm:grid-cols-2">
        <p className="my-0">
          <span className="text-muted-foreground">{fitR.n} models · </span>
          {fitR.slope.toFixed(1)} Elo per {ax.unit === "%" ? "point of score" : "index point"}
          <span className="text-muted-foreground"> · Pearson r </span>
          <span className="tabular-nums">{fitR.r.toFixed(2)}</span>
        </p>
        <p className="my-0 text-muted-foreground">
          furthest above: {top.map((t) => `${t.name} +${t.d.toFixed(0)}`).join(", ")}
          <br />
          furthest below: {bottom.map((t) => `${t.name} ${t.d.toFixed(0)}`).join(", ")}
        </p>
        <p className="col-span-full my-0 text-[10px] text-muted-foreground/80">
          hollow = text-only (no image tool; it never saw its own scene). Elo axis clipped at 500.
        </p>
      </div>
    </figure>
  )
}
