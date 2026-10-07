"use client"

import { useState } from "react"

// Mirrors fastvideo/models/schedulers/scheduling_piflow.py (PiflowScheduler):
//   segment = 1 / (N - (1 - final_step_size_scale))      final_step_size_scale = 0.5
//   raw_i   = 1 - i * segment,   i = 0..N-1;   the last segment ends at eps (1e-6)
//   sigma   = shift * raw / (1 + (shift - 1) * raw)      shift = 5.0 (base), 3.5 (VSR)
//   substeps per segment = max(1, round((raw_src - raw_dst) * num_policy_substeps)), 128
// Each network call returns n_grid = 10 x0 predictions for its segment; the policy
// interpolates between them and Euler-integrates the substeps with no network call.

const FINAL = 0.5
const SUB = 128
const EPS = 1e-6

function schedule(n: number, shift: number) {
  const seg = 1 / (n - (1 - FINAL))
  const raw = Array.from({ length: n }, (_, i) => 1 - i * seg)
  return raw.map((r, i) => {
    const dst = i + 1 < n ? raw[i + 1] : EPS
    const sub = Math.max(1, Math.round((r - dst) * SUB))
    const sigma = (shift * r) / (1 + (shift - 1) * r)
    return { raw: r, dst, sub, sigma }
  })
}

const W = 700
const H = 120
const X0 = 20
const X1 = 680

export function PiflowSchedule() {
  const [n, setN] = useState(10)
  const [vsr, setVsr] = useState(false)
  const shift = vsr ? 3.5 : 5.0
  const steps = schedule(n, shift)
  const totalSub = steps.reduce((a, s) => a + s.sub, 0)
  // raw time runs 1 -> 0 left to right
  const x = (raw: number) => X0 + (1 - raw) * (X1 - X0)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Network calls</span>
          <input type="range" min={2} max={20} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of network calls" />
          <span className="w-6 font-mono">{n}</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={vsr} onChange={(e) => setVsr(e.target.checked)} />
          <span className="text-muted-foreground">VSR scheduler (shift 3.5)</span>
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="pi-Flow segments: one network call per segment, cheap policy substeps inside it">
        <text x={X0} y={14} fontSize={8.5} fill="currentColor" fillOpacity={0.6}>
          raw time 1 (noise)
        </text>
        <text x={X1} y={14} textAnchor="end" fontSize={8.5} fill="currentColor" fillOpacity={0.6}>
          0 (clean)
        </text>
        {steps.map((s, i) => {
          const a = x(s.raw)
          const b = x(s.dst)
          const ticks = Array.from({ length: s.sub }, (_, k) => a + ((k + 1) * (b - a)) / s.sub)
          return (
            <g key={i}>
              <rect x={a} y={30} width={b - a} height={34} fill={i % 2 ? "oklch(0.62 0.12 250)" : "oklch(0.7 0.12 250)"} fillOpacity={0.35} />
              {ticks.map((t, k) => (
                <line key={k} x1={t} x2={t} y1={52} y2={64} stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.6} />
              ))}
              <circle cx={a} cy={40} r={4.5} fill="oklch(0.6 0.2 27)" />
              {n <= 12 && (
                <text x={(a + b) / 2} y={84} textAnchor="middle" fontSize={7.5} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                  σ {s.sigma.toFixed(2)}
                </text>
              )}
            </g>
          )
        })}
        <circle cx={X0 + 6} cy={104} r={4} fill="oklch(0.6 0.2 27)" />
        <text x={X0 + 14} y={107} fontSize={8} fill="currentColor" fillOpacity={0.7}>
          network call (10 x0 predictions each)
        </text>
        <line x1={X0 + 230} x2={X0 + 230} y1={98} y2={110} stroke="currentColor" strokeOpacity={0.5} />
        <text x={X0 + 238} y={107} fontSize={8} fill="currentColor" fillOpacity={0.7}>
          policy substep (interpolate, then one Euler step; no network)
        </text>
      </svg>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs">
          {n} network calls · guidance 1.0 · {n} forwards
        </div>
        <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs">{totalSub} policy substeps in total</div>
        <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs">
          last segment is {FINAL}× the others ({steps[n - 1].sub} substeps vs {steps[0].sub})
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Computed with the formulas in FastVideo&apos;s PiflowScheduler. The distilled checkpoints were trained for 10 calls (VSR: 2);
        the scheduler accepts any count, but other counts are off the training distribution. σ is the shifted noise level each call
        sees.
      </figcaption>
    </figure>
  )
}
