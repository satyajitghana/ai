"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { BENCHES, MODELS, type BenchId, type Bin } from "./aa-bins"

// Artificial Analysis's own calibration bins for four decision models, per
// benchmark, and the pooled view AA's page draws. Pooled bins are recomputed
// here: each benchmark's answers are weighted by 1 / (that benchmark's answer
// count), so every benchmark counts a quarter, which is how AA pools them (it
// reproduces the page's pooled accuracy and confidence in every bin). ECE is
// the bin-mass-weighted mean of |confidence - accuracy|.

type View = "pooled" | BenchId

type Pt = { w: number; conf: number; acc: number }

function pooled(bins: Record<BenchId, Bin[]>): Pt[] {
  const acc: Record<number, Pt> = {}
  for (const b of BENCHES) {
    const rows = bins[b.id]
    const tot = rows.reduce((s, r) => s + r[0], 0)
    for (const [n, c, a] of rows) {
      const i = Math.min(9, Math.floor(c * 10))
      const w = n / tot / 4
      const x = acc[i] ?? { w: 0, conf: 0, acc: 0 }
      x.w += w
      x.conf += w * c
      x.acc += w * a
      acc[i] = x
    }
  }
  return Object.keys(acc)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => ({ w: acc[i].w, conf: acc[i].conf / acc[i].w, acc: acc[i].acc / acc[i].w }))
}

function single(rows: Bin[]): Pt[] {
  const tot = rows.reduce((s, r) => s + r[0], 0)
  return rows.map(([n, c, a]) => ({ w: n / tot, conf: c, acc: a }))
}

function ece(pts: Pt[]): number {
  const tw = pts.reduce((s, p) => s + p.w, 0)
  return pts.reduce((s, p) => s + p.w * Math.abs(p.conf - p.acc), 0) / tw
}

const W = 420
const H = 300
const P = 34
const sx = (v: number) => P + v * (W - P - 12)
const sy = (v: number) => H - P - v * (H - P - 12)

export function IndexCalibration() {
  const [model, setModel] = useState(0)
  const [view, setView] = useState<View>("pooled")
  const m = MODELS[model]

  const pts = useMemo(() => (view === "pooled" ? pooled(m.bins) : single(m.bins[view])), [m, view])
  const e = ece(pts)
  const perBench = BENCHES.map((b) => ece(single(m.bins[b.id])))
  const meanPer = perBench.reduce((s, x) => s + x, 0) / perBench.length
  const pooledE = ece(pooled(m.bins))
  const n = view === "pooled" ? null : m.bins[view].reduce((s, r) => s + r[0], 0)

  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.conf).toFixed(1)},${sy(p.acc).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        reported bins: Artificial Analysis Decision Index page data · ECE recomputed (measured)
      </div>

      <div className="grid gap-2 border-b p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Model">
          {MODELS.map((x, i) => (
            <button
              key={x.name}
              type="button"
              onClick={() => setModel(i)}
              aria-pressed={model === i}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                model === i ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {x.name} · {x.index.toFixed(2)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which answers">
          {(["pooled", ...BENCHES.map((b) => b.id)] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                view === v ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {v === "pooled" ? "pooled, as AA draws it" : BENCHES.find((b) => b.id === v)!.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${m.name}, ${view === "pooled" ? "pooled across the four benchmarks" : BENCHES.find((b) => b.id === view)!.label}: accuracy against confidence per bin, expected calibration error ${(e * 100).toFixed(1)} points. Points below the diagonal are overconfident.`}
        >
          <polygon
            points={`${sx(0)},${sy(0)} ${sx(1)},${sy(1)} ${sx(1)},${sy(0)}`}
            fill="oklch(0.65 0.17 30)"
            fillOpacity={0.07}
          />
          {[0, 0.5, 1].map((g) => (
            <g key={g}>
              <line x1={sx(0)} y1={sy(g)} x2={sx(1)} y2={sy(g)} stroke="var(--border)" />
              <text x={P - 6} y={sy(g) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>
                {g.toFixed(1)}
              </text>
              <text x={sx(g)} y={H - P + 14} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>
                {g.toFixed(1)}
              </text>
            </g>
          ))}
          <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="currentColor" strokeDasharray="4 3" opacity={0.5} />
          <text x={sx(0.62)} y={sy(0.12)} fontSize={9} fill="currentColor" opacity={0.55}>
            overconfident
          </text>
          <text x={sx(0.04)} y={sy(0.9)} fontSize={9} fill="currentColor" opacity={0.55}>
            underconfident
          </text>
          <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.5} />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.conf)}
              cy={sy(p.acc)}
              r={(2.5 + 9 * Math.sqrt(p.w)).toFixed(2)}
              fill="var(--primary)"
              fillOpacity={0.55}
              stroke="var(--primary)"
            />
          ))}
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>
            confidence on the chosen option
          </text>
          <text x={10} y={H / 2} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7} transform={`rotate(-90 10 ${H / 2})`}>
            accuracy
          </text>
        </svg>

        <dl className="grid content-start gap-2 font-mono text-xs">
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">this view, ECE</dt>
            <dd>{(e * 100).toFixed(1)} pts</dd>
          </div>
          {n !== null && (
            <div className="flex justify-between gap-2 border-b pb-1">
              <dt className="text-muted-foreground">answers binned</dt>
              <dd>{n.toLocaleString("en-US")}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">pooled ECE</dt>
            <dd>{(pooledE * 100).toFixed(1)} pts</dd>
          </div>
          {BENCHES.map((b, i) => (
            <div key={b.id} className="flex justify-between gap-2 border-b pb-1">
              <dt className="text-muted-foreground">{b.label}</dt>
              <dd>{(perBench[i] * 100).toFixed(1)} pts</dd>
            </div>
          ))}
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">mean of the four</dt>
            <dd>{(meanPer * 100).toFixed(1)} pts</dd>
          </div>
        </dl>
      </div>
    </figure>
  )
}
