"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { GATES } from "./data"

// The gates of the released checkpoint, per step, for K = 8, 12 or 16 on the code's time grid. Values are
// channel means I computed from the checkpoint's gate MLPs (see data.ts). x is the step's start time t_i.

const KS = [8, 12, 16] as const
type K = (typeof KS)[number]

const SERIES = [
  { sub: "frame", gate: "out", label: "frame s_out", color: "oklch(0.62 0.16 35)", dash: "" },
  { sub: "global", gate: "out", label: "global s_out", color: "oklch(0.55 0.15 255)", dash: "" },
  { sub: "frame", gate: "attn", label: "frame s_attn", color: "oklch(0.62 0.16 35)", dash: "5 4" },
  { sub: "global", gate: "attn", label: "global s_attn", color: "oklch(0.55 0.15 255)", dash: "5 4" },
  { sub: "frame", gate: "mlp", label: "frame s_mlp", color: "oklch(0.62 0.16 35)", dash: "1 4" },
  { sub: "global", gate: "mlp", label: "global s_mlp", color: "oklch(0.55 0.15 255)", dash: "1 4" },
] as const

const W = 640
const H = 260
const L = 44
const R = 16
const T = 14
const B = 34
const Y0 = 0.6
const Y1 = 1.0

const sx = (t: number) => L + t * (W - L - R)
const sy = (v: number) => T + ((Y1 - v) / (Y1 - Y0)) * (H - T - B)

export function GateSchedule() {
  const [k, setK] = useState<K>(16)
  const [step, setStep] = useState(0)
  const i = Math.min(step, k - 1)
  const g = GATES[k]
  const ts = Array.from({ length: k }, (_, j) => j / (k - 1))
  const tNext = i + 1 < k ? ts[i + 1] : 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        gate values per step · nvidia/dvlt checkpoint · channel means, computed from the weights
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="w-16 shrink-0 font-mono text-muted-foreground">K</span>
          {KS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setK(v)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono tabular-nums",
                v === k ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gate means per step against the step's start time">
          {[0.6, 0.7, 0.8, 0.9, 1.0].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={v === 1 ? 0.35 : 0.1} />
              <text x={L - 6} y={sy(v) + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <text key={t} x={sx(t)} y={H - B + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
              {t.toFixed(2)}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            step start t
          </text>
          <rect x={sx(ts[i]) - 5} y={T} width={10} height={H - T - B} fill="currentColor" opacity={0.06} />
          {SERIES.map((s) => {
            const ys = g[s.sub][s.gate]
            const d = ys.map((v, j) => `${j ? "L" : "M"}${sx(ts[j]).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")
            return (
              <g key={s.label}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
                {ys.map((v, j) => (
                  <circle key={j} cx={sx(ts[j])} cy={sy(v)} r={j === i ? 4 : 2.2} fill={s.color} />
                ))}
              </g>
            )
          })}
        </svg>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-16 shrink-0 font-mono text-muted-foreground">step</span>
          <Range min={0} max={k - 1} step={1} value={i} onChange={(e) => setStep(Number(e.target.value))} aria-label="step" className="w-full" />
          <span className="w-16 shrink-0 text-right font-mono tabular-nums">
            {i + 1} of {k}
          </span>
        </label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
          <span className="col-span-2 text-muted-foreground sm:col-span-3">
            interval ({ts[i].toFixed(3)}, {tNext.toFixed(3)})
          </span>
          {SERIES.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
              </svg>
              {s.label} <b className="tabular-nums">{g[s.sub][s.gate][i].toFixed(3)}</b>
            </span>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Each loop multiplies the state by s_out after adding the attention and MLP updates (scaled by s_attn and s_mlp and
        LayerScale). Every mean sits below 1. The frame sub-block&apos;s s_out climbs from about 0.73 to 0.93 over the pass whatever
        K is; the global sub-block&apos;s barely moves. The last step&apos;s interval is (1, 1), as in the code.
      </figcaption>
    </figure>
  )
}
