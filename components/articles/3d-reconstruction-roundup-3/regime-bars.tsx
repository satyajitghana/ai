"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { TS, TS_SAMPLES, type Regime, type TsMetric, type TsModel } from "./data"

// Trainspotting's held-out results split by capture regime. Every number was
// recomputed by us from the per-sample CSVs the authors ship (see data.ts).

const MODELS: TsModel[] = ["VGGT", "π3", "VGGT-Ω", "Spotter"]
const REGIMES: Regime[] = ["fixed", "roaming", "instance-pooled", "all"]
const METRICS: { id: TsMetric; label: string; idx: number; higher: boolean; unit: string; max: number }[] = [
  { id: "auc5", label: "Pose AUC@5°", idx: 0, higher: true, unit: "%", max: 100 },
  { id: "auc30", label: "Pose AUC@30°", idx: 1, higher: true, unit: "%", max: 100 },
  { id: "absrel", label: "Depth AbsRel", idx: 2, higher: false, unit: "", max: 0.3 },
  { id: "comp", label: "Completeness", idx: 3, higher: false, unit: "% of extent", max: 18 },
]
const COLORS: Record<TsModel, string> = {
  VGGT: "oklch(0.7 0.03 250)",
  "π3": "oklch(0.62 0.08 200)",
  "VGGT-Ω": "oklch(0.64 0.17 30)",
  Spotter: "oklch(0.55 0.15 255)",
}

const W = 640
const ROW_H = 74
const LABEL_W = 120
const BAR_X = LABEL_W + 8
const BAR_W = W - BAR_X - 60

export function RegimeBars() {
  const [metric, setMetric] = useState<TsMetric>("auc5")
  const m = METRICS.find((x) => x.id === metric) ?? METRICS[0]
  const H = REGIMES.length * ROW_H + 16
  const fmt = (v: number) => (m.id === "absrel" ? v.toFixed(3) : v.toFixed(1))

  const f = TS.fixed
  const p = TS["instance-pooled"]
  const desc = `${m.label} on held-out Trainspotting objects by capture regime. Fixed objects: VGGT-Omega ${fmt(
    f["VGGT-Ω"][m.idx],
  )}, Spotter ${fmt(f.Spotter[m.idx])}. Instance-pooled designs: VGGT-Omega ${fmt(p["VGGT-Ω"][m.idx])}, Spotter ${fmt(
    p.Spotter[m.idx],
  )}.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>trainspotting, split by regime</span>
        <span className="text-muted-foreground/60">recomputed from the shipped per-sample CSVs</span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {METRICS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setMetric(x.id)}
            aria-pressed={metric === x.id}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              metric === x.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
          {REGIMES.map((g, gi) => {
            const y0 = 8 + gi * ROW_H
            return (
              <g key={g}>
                <text x={LABEL_W} y={y0 + 22} textAnchor="end" className="fill-foreground font-mono" fontSize={12}>
                  {g}
                </text>
                <text x={LABEL_W} y={y0 + 38} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
                  {TS_SAMPLES[g]} samples
                </text>
                {MODELS.map((mod, mi) => {
                  const v = TS[g][mod][m.idx]
                  const w = Math.max(1, Math.min(1, v / m.max) * BAR_W)
                  const y = y0 + mi * 15
                  return (
                    <g key={mod}>
                      <rect x={BAR_X} y={y} width={w} height={12} rx={2} fill={COLORS[mod]} />
                      <text x={BAR_X + w + 4} y={y + 10} className="fill-muted-foreground font-mono" fontSize={10}>
                        {fmt(v)}
                      </text>
                    </g>
                  )
                })}
                {gi < REGIMES.length - 1 && (
                  <line x1={8} x2={W - 8} y1={y0 + ROW_H - 6} y2={y0 + ROW_H - 6} className="stroke-border" strokeWidth={1} />
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-1 font-mono text-[11px] text-muted-foreground">
        {MODELS.map((mod) => (
          <span key={mod} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[mod] }} />
            {mod}
          </span>
        ))}
        <span className="text-muted-foreground/60">{m.higher ? "higher is better" : "lower is better"}</span>
      </div>
      <figcaption className="px-4 pb-4 pt-2 text-sm text-muted-foreground">
        Measured from the authors&apos; released per-sample results, not from running the models. The ground truth is
        Trainspotting&apos;s own pseudo-ground truth, produced by the same pipeline whose output Spotter was fine-tuned on.
        Note that VGGT-Ω, the starting checkpoint, is the weakest of the four on camera pose in every regime.
      </figcaption>
    </figure>
  )
}
