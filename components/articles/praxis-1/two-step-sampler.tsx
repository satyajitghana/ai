"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What Praxis-1's sampler does with two Euler steps and a flow shift of 12.5.
//
// The time grid is praxis/sampler.py's window_time_grid:
//   u = linspace(1, 0, N + 1),   t = s u / (1 + (s - 1) u)
// so N = 2, s = 12.5 gives [1, 0.926, 0]. The Euler update is
//   x <- x + (t_next - t) v(x, t)
// and in rectified flow v = (x - x0_hat) / t, so the last step, which goes to
// t = 0, lands exactly on the model's clean-sample prediction x0_hat at the
// last evaluated t. That part is true of the real model.
//
// The rest is a toy, not Praxis-1: a 24-row, 2-D action chunk whose clean
// distribution is two trajectories (reach the left mug, reach the right mug)
// with prior weights set by the "context" slider. For two point masses the
// ideal denoiser is exact:
//   x0_hat = sum_k w_k x0_k,  w_k ∝ pi_k exp(-|x - (1 - t) x0_k|^2 / (2 t^2))
// The toy shows how much of the choice between the two the sampler itself can
// make at a given (N, s), and how much must come from conditioning.
// Transcendentals go through lib/dmath so SSR and the browser agree.

const R = 24
const D = R * 2
const TARGETS: [number, number][] = [
  [-0.6, 0.8],
  [0.6, 0.8],
]

const ease = (u: number) => u * u * (3 - 2 * u)
const MODES: number[][] = TARGETS.map(([tx, ty]) => {
  const out: number[] = []
  for (let i = 0; i < R; i++) {
    const e = ease(i / (R - 1))
    out.push(tx * e, ty * e)
  }
  return out
})

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussians(seed: number, n: number): number[] {
  const rnd = mulberry32(seed)
  const out: number[] = []
  while (out.length < n) {
    const u1 = Math.max(rnd(), 1e-12)
    const u2 = rnd()
    const r = Math.sqrt(-2 * mlog(u1))
    out.push(r * mcos(2 * Math.PI * u2))
    if (out.length < n) out.push(r * mcos(2 * Math.PI * u2 - Math.PI / 2))
  }
  return out
}

function timeGrid(n: number, s: number): number[] {
  const g: number[] = []
  for (let j = 0; j <= n; j++) {
    const u = 1 - j / n
    g.push((s * u) / (1 + (s - 1) * u))
  }
  return g
}

type Run = { final: number[]; preds: number[][]; wLeft: number[]; grid: number[] }

function sample(n: number, s: number, pLeft: number, seed: number): Run {
  const grid = timeGrid(n, s)
  let x = gaussians(seed, D)
  const preds: number[][] = []
  const wLeft: number[] = []
  const pis = [pLeft, 1 - pLeft]
  for (let j = 0; j < n; j++) {
    const t = grid[j]
    const tn = grid[j + 1]
    const lw = pis.map((pi, k) => {
      let d = 0
      for (let i = 0; i < D; i++) {
        const r = x[i] - (1 - t) * MODES[k][i]
        d += r * r
      }
      return mlog(pi) - d / (2 * t * t)
    })
    const mx = Math.max(lw[0], lw[1])
    const e0 = mexp(lw[0] - mx)
    const e1 = mexp(lw[1] - mx)
    const w0 = e0 / (e0 + e1)
    const x0 = MODES[0].map((m, i) => w0 * m + (1 - w0) * MODES[1][i])
    preds.push(x0)
    wLeft.push(w0)
    x = x.map((xi, i) => xi + (tn - t) * ((xi - x0[i]) / t))
  }
  return { final: x, preds, wLeft, grid }
}

const W = 300
const H = 230
const sx = (v: number) => W / 2 + v * 190
const sy = (v: number) => H - 24 - v * 230
const path = (xs: number[]) => {
  let d = ""
  for (let i = 0; i < R; i++) {
    d += `${i === 0 ? "M" : "L"}${sx(xs[2 * i]).toFixed(1)} ${sy(xs[2 * i + 1]).toFixed(1)} `
  }
  return d.trim()
}

export function TwoStepSampler() {
  const [n, setN] = useState(2)
  const [shift, setShift] = useState(12.5)
  const [pLeft, setPLeft] = useState(0.5)
  const [seed, setSeed] = useState(7)

  const run = sample(n, shift, pLeft, seed)
  const endX = run.final[D - 2]
  const endY = run.final[D - 1]
  const dl = [0, 1].map((k) => {
    const dx = endX - TARGETS[k][0]
    const dy = endY - TARGETS[k][1]
    return Math.sqrt(dx * dx + dy * dy)
  })
  const dist = Math.min(dl[0], dl[1])
  const lastT = run.grid[n - 1]
  const lastW = run.wLeft[n - 1]
  const committed = lastW > 0.95 || lastW < 0.05
  const accent = "var(--hg-accent, oklch(0.72 0.15 195))"

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="A toy two-mode action chunk denoised with Praxis-1's Euler sampler and flow shift"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        the time grid is Praxis-1&rsquo;s sampler; the two-mug action distribution is a toy
      </div>

      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">Euler steps</span>
          <Range
            min={1}
            max={8}
            step={1}
            value={n}
            onChange={(e) => setN(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="number of Euler steps"
          />
          <span className="w-16 shrink-0 text-right tabular-nums">{n}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">flow shift</span>
          <Range
            min={1}
            max={24}
            step={0.5}
            value={shift}
            onChange={(e) => setShift(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="flow shift of the time grid"
          />
          <span className="w-16 shrink-0 text-right tabular-nums">{shift.toFixed(1)}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">context says left</span>
          <Range
            min={0.5}
            max={0.99}
            step={0.01}
            value={pLeft}
            onChange={(e) => setPLeft(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="how strongly the conditioning favours the left mug"
          />
          <span className="w-16 shrink-0 text-right tabular-nums">{(pLeft * 100).toFixed(0)}%</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-28 shrink-0 text-muted-foreground">presets</span>
          {[
            { label: "Praxis-1: 2 steps, shift 12.5", n: 2, s: 12.5 },
            { label: "Runway's start: 2 steps, shift 8", n: 2, s: 8 },
            { label: "8 steps, shift 1", n: 8, s: 1 },
            { label: "1 step", n: 1, s: 1 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={p.n === n && p.s === shift}
              onClick={() => {
                setN(p.n)
                setShift(p.s)
              }}
              className={cn(
                "rounded border px-2 py-1",
                p.n === n && p.s === shift
                  ? "border-foreground/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="rounded border border-transparent px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            new noise
          </button>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`The sampled chunk ends ${dist.toFixed(2)} units from the nearest mug after ${n} steps at shift ${shift.toFixed(1)}.`}
        >
          {MODES.map((m, k) => (
            <path key={k} d={path(m)} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" strokeWidth={1.5} />
          ))}
          {TARGETS.map(([tx, ty], k) => (
            <g key={k}>
              <rect x={sx(tx) - 11} y={sy(ty) - 9} width={22} height={18} rx={3} fill="none" stroke="currentColor" strokeOpacity={0.6} />
              <text x={sx(tx)} y={sy(ty) - 14} textAnchor="middle" className="fill-current font-mono text-[10px] opacity-60">
                {k === 0 ? "left mug" : "right mug"}
              </text>
            </g>
          ))}
          {run.preds.slice(0, -1).map((p, j) => (
            <path key={j} d={path(p)} fill="none" stroke={accent} strokeOpacity={0.25} strokeWidth={1.5} />
          ))}
          <path d={path(run.final)} fill="none" stroke={accent} strokeWidth={2.5} />
          <circle cx={sx(endX)} cy={sy(endY)} r={4} fill={accent} />
          <circle cx={sx(0)} cy={sy(0)} r={3} fill="currentColor" />
          <text x={sx(0)} y={H - 6} textAnchor="middle" className="fill-current font-mono text-[10px] opacity-60">
            gripper now
          </text>
        </svg>

        <div className="flex flex-col gap-2 font-mono text-xs tabular-nums">
          <div className="text-muted-foreground">time grid (1 = pure noise)</div>
          <svg viewBox="0 0 260 34" width="100%" role="img" aria-label={`Time grid: ${run.grid.map((g) => g.toFixed(3)).join(", ")}`}>
            <line x1={10} y1={14} x2={250} y2={14} stroke="currentColor" strokeOpacity={0.4} />
            {run.grid.map((g, j) => (
              <g key={j}>
                <circle cx={250 - g * 240} cy={14} r={j === n - 1 ? 4.5 : 3} fill={j === n ? "currentColor" : accent} fillOpacity={j === n ? 0.5 : 1} />
              </g>
            ))}
            <text x={10} y={31} className="fill-current text-[9px] opacity-60">t = 1</text>
            <text x={250} y={31} textAnchor="end" className="fill-current text-[9px] opacity-60">t = 0</text>
          </svg>
          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">grid</span>
            <span className="text-right">{run.grid.map((g) => g.toFixed(3)).join(" → ")}</span>
            <span className="text-muted-foreground">last evaluation at t =</span>
            <span className="text-right text-foreground">{lastT.toFixed(3)}</span>
            <span className="text-muted-foreground">left-mug weight at that read</span>
            <span className="text-right">{(lastW * 100).toFixed(1)}%</span>
            <span className="text-muted-foreground">end of chunk to nearest mug</span>
            <span className="text-right text-foreground">{dist.toFixed(2)}</span>
          </div>
          <p className="my-0 text-muted-foreground">
            {committed
              ? "The sampler committed to one mug by itself."
              : "The sampler never committed: the chunk is a blend of the two reaches, steered only by the context."}
          </p>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Faint lines are the clean chunk predicted at each evaluation; the bold line is the output,
        which always equals the last prediction. Units are normalized action space, the mugs 1.2
        apart. The toy has an exact denoiser; Praxis-1&rsquo;s is learned and conditioned on the
        frames, the pose and the instruction.
      </figcaption>
    </figure>
  )
}
