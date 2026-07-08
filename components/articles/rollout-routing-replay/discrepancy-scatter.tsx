"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the routing mismatch does to the whole token distribution.
//
// The paper generates ~20M rollout tokens with SGLang, then re-scores them with
// Megatron, and scatters inference-prob (x) against training-prob (y). Points on
// y = x mean the two engines agree. A DENSE model sits in a tight band; the MoE
// model fans out because the router flips experts; MoE + R3 collapses back to
// near-dense. Toggle the mode to reproduce the three panels of Figure 2.
//
// The scatter itself is an illustrative, fully-deterministic point cloud (a pure
// hash per index — no randomness, no timers, no unbounded loops, so it prerenders
// safely). The KL numbers printed below are the paper's MEASURED values.

const ACC = "oklch(0.62 0.16 150)"
const BAD = "oklch(0.58 0.19 25)"

type Mode = "dense" | "moe" | "moe+r3"
const MODES: { id: Mode; label: string; kl: number; note: string }[] = [
  { id: "dense", label: "Dense (Qwen3-8B)", kl: 0.64, note: "No router. Training and inference stay on the diagonal — the reference band." },
  { id: "moe", label: "MoE (Qwen3-30B-A3B)", kl: 1.54, note: "The router flips experts between engines. The band fans out and extreme tokens (red) appear off-diagonal." },
  { id: "moe+r3", label: "MoE + R3", kl: 0.75, note: "Replaying the rollout mask collapses the band back to near-dense — KL 1.54 → 0.75 ×10⁻³." },
]
const WIDTH: Record<Mode, number> = { dense: 0.13, moe: 0.44, "moe+r3": 0.18 }

const N = 200
// deterministic uint32 hash → [0,1); pure, matches the design script exactly
function h(i: number, seed: number): number {
  let x = ((i + 1) * seed) >>> 0
  x = (x ^ (x << 13)) >>> 0
  x = (x ^ (x >>> 17)) >>> 0
  x = (x ^ (x << 5)) >>> 0
  return x / 4294967296
}
const logit = (p: number) => Math.log(p / (1 - p))
const sig = (z: number) => 1 / (1 + Math.exp(-z))

// geometry
const VW = 520
const VH = 360
const L = 60
const T = 14
const S = 300 // plot size
const px = (p: number) => L + p * S
const py = (p: number) => T + (1 - p) * S

export function DiscrepancyScatter() {
  const [mode, setMode] = useState<Mode>("moe")
  const w = WIDTH[mode]
  const active = MODES.find((m) => m.id === mode)!

  const pts = Array.from({ length: N }, (_, i) => {
    const pI = 0.05 + 0.9 * h(i, 2654435761)
    const g = (h(i, 40503) * 2 - 1 + (h(i, 2246822519) * 2 - 1)) / 2
    const pT = sig(logit(pI) + w * g * 3.0)
    const extreme = Math.max(pT / pI, pI / pT) > 2
    return { pI, pT, extreme }
  })
  const nExtreme = pts.filter((p) => p.extreme).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>training vs inference token probability</span>
        <span className="text-muted-foreground/50">illustrative cloud · measured KL</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" role="img" aria-label={`Scatter of training probability against inference probability for the ${active.label} model. Points on the diagonal mean the two engines agree; the ${mode === "moe" ? "MoE band fans out with extreme off-diagonal tokens" : "band hugs the diagonal"}.`}>
            {/* axes frame */}
            <rect x={L} y={T} width={S} height={S} fill="none" stroke="var(--border)" strokeWidth={1} />
            {/* gridlines + ticks */}
            {[0.25, 0.5, 0.75].map((tk) => (
              <g key={tk}>
                <line x1={px(tk)} y1={T} x2={px(tk)} y2={T + S} stroke="var(--border)" strokeOpacity={0.4} />
                <line x1={L} y1={py(tk)} x2={L + S} y2={py(tk)} stroke="var(--border)" strokeOpacity={0.4} />
              </g>
            ))}
            {[0, 0.5, 1].map((tk) => (
              <g key={`lbl-${tk}`}>
                <text x={px(tk)} y={T + S + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                  {tk}
                </text>
                <text x={L - 8} y={py(tk) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                  {tk}
                </text>
              </g>
            ))}
            {/* 2x corridor (dashed) and y=x diagonal */}
            <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="var(--muted-foreground)" strokeWidth={1} strokeOpacity={0.6} />
            <line x1={px(0)} y1={py(0)} x2={px(0.5)} y2={py(1)} stroke={BAD} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5} />
            <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(0.5)} stroke={BAD} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5} />
            {/* points */}
            {pts.map((p, i) => (
              <circle key={i} cx={px(p.pI)} cy={py(p.pT)} r={p.extreme ? 2.4 : 2} fill={p.extreme ? BAD : ACC} opacity={p.extreme ? 0.9 : 0.5} className="transition-all duration-500" />
            ))}
            {/* axis titles */}
            <text x={L + S / 2} y={VH - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
              inference probability (SGLang)
            </text>
            <text x={14} y={T + S / 2} textAnchor="middle" transform={`rotate(-90 14 ${T + S / 2})`} className="fill-muted-foreground font-mono" fontSize={10}>
              training probability (Megatron)
            </text>
          </svg>

          {/* readout */}
          <div className="flex flex-col gap-3 sm:w-52">
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
              <div className="font-mono text-[10px] text-muted-foreground">train–infer KL (measured)</div>
              <div className="mt-0.5 font-mono text-2xl font-semibold tabular-nums" style={{ color: mode === "moe" ? BAD : ACC }}>
                {active.kl.toFixed(2)}
                <span className="ml-1 text-xs text-muted-foreground">×10⁻³</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                dense 0.64 · MoE 1.54 · MoE+R3 0.75
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px]">
              <span className="text-muted-foreground">extreme (&gt;2×) in sample</span>
              <span className="tabular-nums font-semibold" style={{ color: nExtreme > 3 ? BAD : "var(--muted-foreground)" }}>
                {nExtreme}/{N}
              </span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{active.note}</p>
          </div>
        </div>

        {/* mode toggle */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-[10px] text-muted-foreground">model</span>
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={cn("cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors", mode === m.id ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")} style={mode === m.id ? { background: m.id === "moe" ? BAD : ACC } : undefined}>
              {m.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACC }} /> on-diagonal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: BAD }} /> &gt;2× off
            </span>
          </span>
        </div>
      </div>
    </figure>
  )
}
