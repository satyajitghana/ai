"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog, mlog10, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A two-dimensional toy of SIGReg as H-JEPA ships it (h_jepa/loss.py:13-47).
// 256 embeddings in R^2 stand in for one timestep of a batch of N sequences.
// For a direction u the embeddings are projected to h = Z u, the empirical
// characteristic function (ECF) of h is taken at 17 knots on [0, 3], and the
// Epps-Pulley statistic is
//   T(h) = n * sum_k w_k * [ (mean cos(t_k h) - exp(-t_k^2 / 2))^2 + (mean sin(t_k h))^2 ]
// with trapezoid weights doubled for the even half-domain (2 dt inside, dt at
// the ends) times the Gaussian window exp(-t^2 / 2). The released loss draws
// 1,024 random unit directions per call; this toy sweeps 16 evenly spaced
// directions so the average is deterministic. Samples come from a fixed LCG +
// Box-Muller, so server and client agree.

const ACCENT = "oklch(0.56 0.13 250)"
const WARN = "oklch(0.62 0.16 40)"
const N = 256
const K = 17
const DIRS = 16

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s + 0.5) / 4294967296
  }
}

const BASE: [number, number][] = (() => {
  const r = lcg(7)
  const out: [number, number][] = []
  for (let i = 0; i < N; i++) {
    const u = r()
    const v = r()
    const R = Math.sqrt(-2 * mlog(u))
    out.push([R * mcos(2 * Math.PI * v), R * msin(2 * Math.PI * v)])
  }
  return out
})()

const KNOTS = Array.from({ length: K }, (_, k) => (3 * k) / (K - 1))
const DT = 3 / (K - 1)
const WEIGHTS = KNOTS.map((t, k) => (k === 0 || k === K - 1 ? DT : 2 * DT) * mexp((-t * t) / 2))

function ecf(h: number[]) {
  return KNOTS.map((t) => {
    let c = 0
    let s = 0
    for (const x of h) {
      c += mcos(x * t)
      s += msin(x * t)
    }
    return { c: c / h.length, s: s / h.length }
  })
}

function statistic(h: number[]) {
  const e = ecf(h)
  let sum = 0
  for (let k = 0; k < K; k++) {
    const target = mexp((-KNOTS[k] * KNOTS[k]) / 2)
    sum += WEIGHTS[k] * ((e[k].c - target) ** 2 + e[k].s ** 2)
  }
  return sum * h.length
}

type Mode = {
  key: string
  label: string
  map: (p: [number, number], i: number) => [number, number]
  moves: boolean
  note: string
}

const MODES: Mode[] = [
  {
    key: "healthy",
    label: "healthy",
    map: (p) => p,
    moves: true,
    note: "An isotropic Gaussian cloud. Every direction passes; the average sits at the statistic's noise floor, near 1 in expectation, which is where the paper says a healthy run settles.",
  },
  {
    key: "squash",
    label: "dimensional collapse",
    map: (p) => [p[0], 0.05 * p[1]],
    moves: true,
    note: "One axis squashed to 5% of its width. Projections along the surviving axis still look Gaussian, which is why one direction is not enough; directions near the dead axis fail hard and drag the average up.",
  },
  {
    key: "shrink",
    label: "shrunk",
    map: (p) => [0.2 * p[0], 0.2 * p[1]],
    moves: true,
    note: "The right shape at a fifth of the scale. The target is a standard Gaussian, so scale is part of the test: shrinking every embedding toward zero is penalised in every direction.",
  },
  {
    key: "constant",
    label: "full collapse",
    map: () => [0.3, 0.3],
    moves: false,
    note: "Every embedding is the same point, the solution a prediction loss alone would love because it is trivially predictable. SIGReg punishes it in every direction.",
  },
  {
    key: "slow",
    label: "slow-feature collapse",
    map: (p) => p,
    moves: false,
    note: "Each sequence gets one Gaussian draw that encodes only its scene and never changes while the robot moves. Across the batch at one timestep the cloud is identical to the healthy one, so the statistic is identical too. SIGReg cannot see this failure; it is why H-JEPA needs an inverse-dynamics term on DROID.",
  },
]

export function SigregProbe() {
  const [modeKey, setModeKey] = useState("healthy")
  const [angleIdx, setAngleIdx] = useState(4)
  const mode = MODES.find((m) => m.key === modeKey) ?? MODES[0]
  const Z = BASE.map((p, i) => mode.map(p, i))

  const perDir = Array.from({ length: DIRS }, (_, m) => {
    const a = (Math.PI * m) / DIRS
    const ca = mcos(a)
    const sa = msin(a)
    return statistic(Z.map((z) => z[0] * ca + z[1] * sa))
  })
  const avg = perDir.reduce((x, y) => x + y, 0) / DIRS

  const a = (Math.PI * angleIdx) / DIRS
  const ca = mcos(a)
  const sa = msin(a)
  const h = Z.map((z) => z[0] * ca + z[1] * sa)
  const e = ecf(h)

  // scatter: centre (110, 130), 32 px per unit
  const SX = (v: number) => 110 + Math.max(-3.2, Math.min(3.2, v)) * 32
  const SY = (v: number) => 130 - Math.max(-3.2, Math.min(3.2, v)) * 32

  // ECF plot area: x 250..420 for t in [0, 3]; y 30..210 for value in [-0.2, 1]
  const PX = (t: number) => 250 + (t / 3) * 170
  const PY = (v: number) => 210 - ((v + 0.2) / 1.2) * 180
  const targetPath = Array.from({ length: 61 }, (_, i) => {
    const t = (3 * i) / 60
    return `${i === 0 ? "M" : "L"}${PX(t).toFixed(1)},${PY(mexp((-t * t) / 2)).toFixed(1)}`
  }).join(" ")
  const ecfPath = e.map((p, k) => `${k === 0 ? "M" : "L"}${PX(KNOTS[k]).toFixed(1)},${PY(p.c).toFixed(1)}`).join(" ")

  // bar chart of the 16 per-direction statistics, log scale 0.1..200
  const barY = (v: number) => {
    const lv = mlog10(Math.max(0.1, Math.min(200, v)))
    return 210 - ((lv + 1) / (mlog10(200) + 1)) * 180
  }
  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          SIGReg on one timestep: 256 embeddings, 17 knots, 16 directions
        </span>
        <span className="font-mono text-[11px] tabular-nums" style={{ color: avg > 3 ? WARN : ACCENT }}>
          mean statistic = {fmt(avg)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 640 250" className="w-full" role="img"
          aria-label="Left, a scatter of 256 two-dimensional embeddings with the current projection direction. Middle, the empirical characteristic function of the projected values against the standard Gaussian's. Right, the normality statistic for each of 16 directions on a log scale.">
          <defs>
            <marker id="hj-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={WARN} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* scatter */}
          <rect x={6} y={26} width={208} height={208} rx={10} fill="var(--background)" stroke="var(--border)" />
          <text x={14} y={18} className="fill-muted-foreground font-mono text-[10px]">embeddings z (batch at one timestep)</text>
          <line x1={SX(-3)} y1={130} x2={SX(3)} y2={130} stroke="var(--border)" />
          <line x1={110} y1={SY(3)} x2={110} y2={SY(-3)} stroke="var(--border)" />
          {Z.map((z, i) => (
            <circle key={i} cx={SX(z[0])} cy={SY(z[1])} r={1.7} fill={ACCENT} fillOpacity={0.55} />
          ))}
          <line x1={110 - ca * 90} y1={130 + sa * 90} x2={110 + ca * 90} y2={130 - sa * 90}
            stroke={WARN} strokeWidth={1.6} markerEnd="url(#hj-arrow)" />
          <text x={110 + ca * 92 + 4} y={130 - sa * 92} className="font-mono text-[10px]" fill={WARN}>u</text>

          {/* ECF */}
          <text x={250} y={18} className="fill-muted-foreground font-mono text-[10px]">Re ECF of h = z·u vs e^(−t²/2)</text>
          <line x1={PX(0)} y1={PY(0)} x2={PX(3)} y2={PY(0)} stroke="var(--border)" />
          <line x1={PX(0)} y1={PY(-0.2)} x2={PX(0)} y2={PY(1)} stroke="var(--border)" />
          <path d={targetPath} fill="none" stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth={1.4} />
          <path d={ecfPath} fill="none" stroke={ACCENT} strokeWidth={1.8} />
          {e.map((p, k) => (
            <circle key={k} cx={PX(KNOTS[k])} cy={PY(p.c)} r={2.2} fill={ACCENT} />
          ))}
          <text x={PX(3)} y={PY(0) + 14} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">t = 3</text>
          <text x={PX(0)} y={PY(0) + 14} className="fill-muted-foreground font-mono text-[10px]">0</text>
          <text x={PX(0) - 4} y={PY(1) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">1</text>

          {/* per-direction statistic */}
          <text x={446} y={18} className="fill-muted-foreground font-mono text-[10px]">statistic per direction (log)</text>
          <line x1={446} y1={barY(1)} x2={634} y2={barY(1)} stroke="var(--muted-foreground)" strokeDasharray="2 3" />
          <text x={634} y={barY(1) - 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">1</text>
          {perDir.map((v, m) => (
            <rect key={m} x={448 + m * 11.5} y={barY(v)} width={8.5} height={Math.max(1, 210 - barY(v))} rx={1.5}
              fill={m === angleIdx ? WARN : ACCENT} fillOpacity={m === angleIdx ? 0.95 : 0.55} />
          ))}
          <line x1={446} y1={210} x2={634} y2={210} stroke="var(--border)" />
          <text x={446} y={226} className="fill-muted-foreground font-mono text-[10px]">
            this u: {fmt(perDir[angleIdx])}
          </text>
          <text x={446} y={242} className="fill-muted-foreground font-mono text-[10px]">
            moves with the robot: {mode.moves ? "yes" : "no"}
          </text>
        </svg>

        <label className="mt-3 block">
          <span className="font-mono text-[11px] text-muted-foreground">
            projection direction u: {((180 * angleIdx) / DIRS).toFixed(2)}°
          </span>
          <Range min={0} max={DIRS - 1} step={1} value={angleIdx} accent={WARN}
            onChange={(ev) => setAngleIdx(Number(ev.target.value))}
            aria-label="Projection direction, one of 16 evenly spaced angles" className="w-full" />
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button key={m.key} type="button" onClick={() => setModeKey(m.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                m.key === modeKey && "bg-muted/40 text-foreground"
              )}>
              {m.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">{mode.note}</p>
      </div>
    </figure>
  )
}
