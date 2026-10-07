"use client"

import { useState } from "react"

import { mcos, mexp, mlog, mpow, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The Mahler volume product, computed for one family you can slide through.
//
// K = B_p^n, the unit l_p ball in R^n, is origin-symmetric, and its polar is
// B_q^n with 1/p + 1/q = 1. Its volume has a closed form,
//   |B_p^n| = (2 Gamma(1 + 1/p))^n / Gamma(1 + n/p),
// so the product |K| |K°| is exact for every p and n. Along this family:
//   p = 1 or p = infinity (cross-polytope / cube, both Hanner polytopes)
//     gives 4^n / n!, the conjectured (now claimed) minimum;
//   p = 2 (the Euclidean ball) gives |B_2^n|^2, the Blaschke-Santalo maximum.
// The widget plots the ratio |K||K°| / (4^n/n!) so the floor is always 1.
// The nonsymmetric bound (n+1)^(n+1)/(n!)^2 (simplices, centred at the
// Santalo point) is shown as a number for comparison; it is smaller than
// 4^n/n! for n >= 2, which is why the symmetric and general statements are
// different theorems. Nothing here proves anything: an l_p ball is one curve
// through the space of bodies, and the hard part of Mahler is every other body.
// Transcendentals go through lib/dmath so server and client agree.

// log Gamma by Lanczos (g = 7, n = 9); accurate to ~1e-13 for x > 0.5.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
]
function lgamma(x: number): number {
  if (x < 0.5) return mlog(Math.PI / Math.abs(msin(Math.PI * x))) - lgamma(1 - x)
  const z = x - 1
  let a = LANCZOS[0]
  const t = z + 7.5
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i)
  return 0.5 * mlog(2 * Math.PI) + (z + 0.5) * mlog(t) - t + mlog(a)
}

// log |B_p^n|; p = Infinity is the cube.
function logVolBall(p: number, n: number): number {
  if (!Number.isFinite(p)) return n * mlog(2)
  return n * (mlog(2) + lgamma(1 + 1 / p)) - lgamma(1 + n / p)
}

function dual(p: number): number {
  if (p === 1) return Infinity
  if (!Number.isFinite(p)) return 1
  return p / (p - 1)
}

// slider position s in [0, 1] -> p in [1, infinity], with s = 0.5 at p = 2
function pOf(s: number): number {
  if (s <= 0) return 1
  if (s >= 1) return Infinity
  return 1 / (1 - s) // s=0 ->1, s=0.5 ->2, s->1 -> infinity
}

function logFact(n: number): number {
  return lgamma(n + 1)
}

function fmt(x: number): string {
  if (x >= 1000) return x.toExponential(3)
  if (x >= 10) return x.toFixed(2)
  return x.toFixed(3)
}

// boundary of the unit l_p ball in the plane, as an SVG path
function ballPath(p: number, r: number, cx: number, cy: number): string {
  const pts: string[] = []
  const N = 160
  for (let i = 0; i <= N; i++) {
    const t = (2 * Math.PI * i) / N
    const c = mcos(t)
    const s = msin(t)
    let x: number
    let y: number
    if (!Number.isFinite(p)) {
      const m = Math.max(Math.abs(c), Math.abs(s))
      x = c / m
      y = s / m
    } else {
      const e = 2 / p
      x = Math.sign(c) * mpow(Math.abs(c), e)
      y = Math.sign(s) * mpow(Math.abs(s), e)
    }
    pts.push(`${(cx + r * x).toFixed(2)},${(cy - r * y).toFixed(2)}`)
  }
  return "M" + pts.join("L") + "Z"
}

const W = 520
const H = 220

export function MahlerVolumeProduct() {
  const [s, setS] = useState(0.5)
  const [n, setN] = useState(3)

  const p = pOf(s)
  const q = dual(p)
  const logProd = logVolBall(p, n) + logVolBall(q, n)
  const logHanner = n * mlog(4) - logFact(n)
  const logSimplex = (n + 1) * mlog(n + 1) - 2 * logFact(n)
  const ratio = mexp(logProd - logHanner)
  const ballRatio = mexp(2 * logVolBall(2, n) - logHanner)

  // curve of ratio over the slider for the chosen n
  const curve: string[] = []
  const M = 120
  for (let i = 0; i <= M; i++) {
    const si = i / M
    const pi = pOf(si)
    const r = mexp(logVolBall(pi, n) + logVolBall(dual(pi), n) - logHanner)
    const x = 40 + (si * (W - 60))
    const y = H - 30 - ((r - 1) / Math.max(ballRatio - 1, 1e-9)) * (H - 70)
    curve.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  const dotX = 40 + s * (W - 60)
  const dotY = H - 30 - ((ratio - 1) / Math.max(ballRatio - 1, 1e-9)) * (H - 70)

  const pLabel = Number.isFinite(p) ? p.toFixed(2) : "∞"
  const qLabel = Number.isFinite(q) ? q.toFixed(2) : "∞"

  return (
    <div className="not-prose my-6 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="mb-3 font-medium">Volume product of an l_p ball and its polar</div>
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        <svg viewBox="0 0 180 180" className="w-full max-w-[220px]" role="img"
          aria-label={`The unit l_${pLabel} ball (filled) and its polar, the unit l_${qLabel} ball (outlined), in the plane`}>
          <line x1="10" y1="90" x2="170" y2="90" className="stroke-muted-foreground/40" strokeWidth="1" />
          <line x1="90" y1="10" x2="90" y2="170" className="stroke-muted-foreground/40" strokeWidth="1" />
          <path d={ballPath(p, 55, 90, 90)} className="fill-sky-500/30 stroke-sky-600" strokeWidth="1.5" />
          <path d={ballPath(q, 55, 90, 90)} className="fill-none stroke-amber-600" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="8" y="176" className="fill-sky-700 dark:fill-sky-300 text-[10px]">K = B_{pLabel}</text>
          <text x="106" y="176" className="fill-amber-700 dark:fill-amber-300 text-[10px]">K° = B_{qLabel}</text>
        </svg>
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
            aria-label={`Volume product divided by 4^n/n! as p runs from 1 to infinity in dimension ${n}`}>
            <line x1="40" y1={H - 30} x2={W - 20} y2={H - 30} className="stroke-muted-foreground/50" />
            <text x="4" y={H - 26} className="fill-muted-foreground text-[10px]">1.0</text>
            <text x="4" y="44" className="fill-muted-foreground text-[10px]">{ballRatio.toFixed(2)}</text>
            <line x1="40" y1="40" x2={W - 20} y2="40" className="stroke-muted-foreground/25" strokeDasharray="3 3" />
            <polyline points={curve.join(" ")} className="fill-none stroke-sky-600" strokeWidth="2" />
            <circle cx={dotX} cy={dotY} r="5" className="fill-amber-500 stroke-background" strokeWidth="1.5" />
            <text x="40" y={H - 10} className="fill-muted-foreground text-[10px]">p = 1 (cross-polytope)</text>
            <text x={(W - 20) / 2 + 10} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[10px]">p = 2 (ball)</text>
            <text x={W - 20} y={H - 10} textAnchor="end" className="fill-muted-foreground text-[10px]">p = ∞ (cube)</text>
          </svg>
          <label className="mt-2 flex items-center gap-3">
            <span className="w-16 shrink-0 text-muted-foreground">p = {pLabel}</span>
            <input type="range" min={0} max={1} step={0.005} value={s} aria-label="Exponent p"
              onChange={(e) => setS(Number(e.target.value))} className="w-full accent-sky-600" />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">dimension n</span>
            {[2, 3, 4, 5, 6, 8].map((k) => (
              <button key={k} type="button" onClick={() => setN(k)}
                className={cn("rounded border px-2 py-0.5 tabular-nums",
                  k === n ? "border-sky-600 bg-sky-600 text-white" : "border-border hover:bg-muted")}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 tabular-nums sm:grid-cols-2">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">|K| · |K°|</dt><dd>{fmt(mexp(logProd))}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">symmetric floor 4^n/n!</dt><dd>{fmt(mexp(logHanner))}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">ratio to the floor</dt><dd>{ratio.toFixed(4)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">general floor (n+1)^(n+1)/(n!)^2</dt><dd>{fmt(mexp(logSimplex))}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Exact volumes from the closed form for l_p balls, computed in your browser. The curve touches 1
        only at the cross-polytope and the cube, both Hanner polytopes, and peaks at the Euclidean ball
        (Blaschke–Santaló). This is one slice through all convex bodies, not evidence for the theorem.
      </p>
    </div>
  )
}
