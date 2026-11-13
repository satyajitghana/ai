"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of task arithmetic with two parents, small enough to see every weight.
//
// A "model" is a vector of D = 24 weights; the base is all zeros. Each task
// cares about a set of coordinates (its support) and wants them at the values
// its fine-tune moved them to. Its loss is a weighted squared distance on that
// support only:
//
//   L_A(θ) = Σ_{j ∈ S_A} h_j (θ_j − a_j)²        score_A = 100 · exp(−1.2 · L_A(θ) / L_A(0))
//
// so the base scores 30 on both tasks (exp(−1.2) ≈ 0.30) and a perfect fit 100.
// Parent A's task vector τ_A is a on S_A plus small "drift" everywhere else (a
// fine-tune moves weights it was not aiming at). Same for B.
//
// The merge is θ = λ_A · trim(τ_A) + λ_B · trim(τ_B), where trim keeps the
// largest |entries| of each task vector (TIES-style top-k, no rescale). The
// overlap slider moves part of B's support onto A's; "conflict" flips B's
// sign on the shared coordinates. Every number is synthetic (seeded); the
// widget shows the shape of the effect, not any model's weights.

const D = 24
const BASE_K = 8 // support size per task

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type World = {
  sa: number[]
  sb: number[]
  a: number[] // target values, length D (0 off-support)
  b: number[]
  ta: number[] // task vectors, length D
  tb: number[]
  h: number[]
}

function buildWorld(overlap: number, conflict: boolean): World {
  const r = rng(7)
  const h = Array.from({ length: D }, () => 0.6 + r() * 0.8)
  const mag = Array.from({ length: D }, () => 0.55 + r() * 0.45)
  const sign = Array.from({ length: D }, () => (r() < 0.5 ? -1 : 1))
  const driftA = Array.from({ length: D }, () => (r() - 0.5) * 0.36)
  const driftB = Array.from({ length: D }, () => (r() - 0.5) * 0.36)
  const sa = Array.from({ length: BASE_K }, (_, i) => i) // coords 0..7
  const shared = Math.round((overlap / 100) * BASE_K)
  // B's support: `shared` coords taken from the top of A's, the rest after A's
  const sb: number[] = []
  for (let i = 0; i < shared; i++) sb.push(BASE_K - 1 - i)
  for (let i = 0; sb.length < BASE_K; i++) sb.push(BASE_K + i)
  const a = Array(D).fill(0)
  const b = Array(D).fill(0)
  for (const j of sa) a[j] = sign[j] * mag[j]
  for (const j of sb) {
    const isShared = sa.includes(j)
    const s = isShared ? (conflict ? -sign[j] : sign[j]) : sign[j]
    b[j] = s * (isShared ? mag[j] : mag[(j + 5) % D])
  }
  const ta = a.map((v, j) => (sa.includes(j) ? v : driftA[j]))
  const tb = b.map((v, j) => (sb.includes(j) ? v : driftB[j]))
  return { sa, sb, a, b, ta, tb, h }
}

function trim(t: number[], density: number) {
  const keep = Math.max(1, Math.round((density / 100) * t.length))
  const order = t
    .map((v, j) => [Math.abs(v), j] as const)
    .sort((x, y) => y[0] - x[0] || x[1] - y[1])
    .slice(0, keep)
    .map(([, j]) => j)
  const set = new Set(order)
  return t.map((v, j) => (set.has(j) ? v : 0))
}

function loss(theta: number[], target: number[], support: number[], h: number[]) {
  let l = 0
  for (const j of support) l += h[j] * (theta[j] - target[j]) * (theta[j] - target[j])
  return l
}

function score(theta: number[], target: number[], support: number[], h: number[]) {
  const l0 = loss(Array(D).fill(0), target, support, h)
  return 100 * mexp((-1.2 * loss(theta, target, support, h)) / l0)
}

function cosine(x: number[], y: number[]) {
  let xy = 0
  let xx = 0
  let yy = 0
  for (let j = 0; j < D; j++) {
    xy += x[j] * y[j]
    xx += x[j] * x[j]
    yy += y[j] * y[j]
  }
  return xy / Math.sqrt(xx * yy)
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
const f2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2)

export function InterferenceLab() {
  const [la, setLa] = useState(100)
  const [lb, setLb] = useState(100)
  const [density, setDensity] = useState(100)
  const [overlap, setOverlap] = useState(0)
  const [conflict, setConflict] = useState(false)

  const w = useMemo(() => buildWorld(overlap, conflict), [overlap, conflict])

  const res = useMemo(() => {
    const ta = trim(w.ta, density)
    const tb = trim(w.tb, density)
    const m = ta.map((v, j) => (la / 100) * v + (lb / 100) * tb[j])
    const sc = (th: number[]) => {
      const A = score(th, w.a, w.sa, w.h)
      const B = score(th, w.b, w.sb, w.h)
      return { A, B, mean: (A + B) / 2 }
    }
    const zero = Array(D).fill(0)
    return {
      m,
      ta,
      tb,
      merged: sc(m),
      pA: sc(w.ta),
      pB: sc(w.tb),
      base: sc(zero),
      cos: cosine(w.ta, w.tb),
    }
  }, [w, la, lb, density])

  const bestParent = Math.max(res.pA.mean, res.pB.mean)
  const gain = res.merged.mean - bestParent
  const verdict =
    gain > 0.5
      ? "constructive: the merge beats both parents on the mean"
      : gain < -0.5
        ? "destructive: the merge is worse than the better parent"
        : "a wash: within half a point of the better parent"

  // bar geometry
  const W = 720
  const ROW = 46
  const colW = W / D
  const rows: { label: string; v: number[]; tone: string }[] = [
    { label: "τ_A", v: res.ta, tone: "fill-sky-600 dark:fill-sky-400" },
    { label: "τ_B", v: res.tb, tone: "fill-amber-600 dark:fill-amber-400" },
    { label: "merge", v: res.m, tone: "fill-foreground" },
  ]
  const H = rows.length * ROW + 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">two task vectors, one merge</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy model, 24 weights, seeded</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            λ_A (weight on parent A): <span className="text-foreground">{f2(la / 100)}</span>
            <Range min={0} max={150} step={5} value={la} onChange={(e) => setLa(Number(e.target.value))} className="mt-1 w-full" aria-label="lambda A" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            λ_B (weight on parent B): <span className="text-foreground">{f2(lb / 100)}</span>
            <Range min={0} max={150} step={5} value={lb} onChange={(e) => setLb(Number(e.target.value))} className="mt-1 w-full" aria-label="lambda B" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            density (top-k by magnitude kept): <span className="text-foreground">{density}%</span>
            <Range min={10} max={100} step={5} value={density} onChange={(e) => setDensity(Number(e.target.value))} className="mt-1 w-full" aria-label="density" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            support shared by the two tasks: <span className="text-foreground">{Math.round((overlap / 100) * BASE_K)} of {BASE_K} weights</span>
            <Range min={0} max={100} step={12.5} value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} className="mt-1 w-full" aria-label="overlap" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5" role="group" aria-label="shared weights">
            {[false, true].map((c) => (
              <button
                key={String(c)}
                type="button"
                onClick={() => setConflict(c)}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-[11px]",
                  conflict === c ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c ? "shared weights conflict" : "shared weights agree"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setLa(100)
              setLb(100)
              setDensity(100)
            }}
            className="rounded-md border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            plain sum (λ 1, 1)
          </button>
          <button
            type="button"
            onClick={() => {
              setLa(50)
              setLb(50)
              setDensity(100)
            }}
            className="rounded-md border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            average (λ 0.5, 0.5)
          </button>
        </div>

        <svg viewBox={`0 0 ${W + 60} ${H}`} className="mt-4 w-full" role="img" aria-label="Bars for each of 24 weights: parent A's task vector, parent B's, and the merged vector. Shaded columns mark each task's support.">
          {Array.from({ length: D }, (_, j) => {
            const inA = w.sa.includes(j)
            const inB = w.sb.includes(j)
            return (
              <g key={j}>
                {inA && <rect x={60 + j * colW} y={0} width={colW} height={H - 22} className="fill-sky-500/10" />}
                {inB && <rect x={60 + j * colW} y={0} width={colW} height={H - 22} className="fill-amber-500/10" />}
              </g>
            )
          })}
          {rows.map((r, ri) => {
            const mid = ri * ROW + ROW / 2
            return (
              <g key={r.label}>
                <text x={0} y={mid + 4} className="fill-muted-foreground font-mono text-[11px]">
                  {r.label}
                </text>
                <line x1={60} x2={60 + W} y1={mid} y2={mid} className="stroke-border" strokeWidth={1} />
                {r.v.map((v, j) => {
                  const hgt = Math.min(1, Math.abs(v) / 2) * (ROW / 2 - 3)
                  const y = v >= 0 ? mid - hgt : mid
                  return <rect key={j} x={60 + j * colW + 3} y={y} width={colW - 6} height={Math.max(0.5, hgt)} className={r.tone} />
                })}
              </g>
            )
          })}
          <text x={60} y={H - 6} className="fill-muted-foreground font-mono text-[10px]">
            blue band: task A cares · amber band: task B cares · bars: change from the base
          </text>
        </svg>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {[
            ["base", res.base],
            ["parent A", res.pA],
            ["parent B", res.pB],
            ["merge", res.merged],
          ].map(([name, s]) => {
            const sc = s as { A: number; B: number; mean: number }
            return (
              <div key={name as string} className={cn("rounded-md border px-2.5 py-2", name === "merge" ? "bg-muted/40" : "bg-muted/20")}>
                <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{name as string}</dt>
                <dd className="mt-0.5 font-mono text-sm text-foreground">mean {f1(sc.mean)}</dd>
                <dd className="font-mono text-[10px] text-muted-foreground">
                  task A {f1(sc.A)} · task B {f1(sc.B)}
                </dd>
              </div>
            )
          })}
        </dl>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground" aria-live="polite">
          cos(τ_A, τ_B) = <span className="text-foreground">{f2(res.cos)}</span> · merge minus better parent ={" "}
          <span className="text-foreground">{gain >= 0 ? "+" : ""}{f1(gain)}</span> · {verdict}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          With no shared weights the plain sum is close to perfect on both tasks: each parent&apos;s change lands where the
          other task does not look. Share weights that agree and the sum overshoots them, so the average does better.
          Share weights that conflict and no λ recovers both tasks. Lowering density drops the small drift each
          fine-tune leaves on weights it was not aiming at. Baphomet ran density 1.0: nothing trimmed.
        </p>
      </div>
    </figure>
  )
}
