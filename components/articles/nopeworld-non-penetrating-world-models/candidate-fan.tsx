"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mhypot, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// NoPeWorld's decision for one chunk, from above, with the labels computed the way the
// paper's training targets are (Sec. 3.1-3.2, App. S2.3-S2.4):
//   34 candidates: the input (KEEP), STOP, the input shortened to 75/50/25/12.5 %, half-length
//   turns at 30 and 60 degrees each side, and 12 points per side on the intent ellipse
//   rho(a) = min(1, cos a / (cos^2 a + w sin^2 a)), w = 0.5 (the delta and rho lists are
//   copied from nopeworld/head/candidates.py).
//   clearance g: a 0.25 m disc swept along the candidate, its gap to the wall.
//   safety P = Phi((g - m) / 0.03 m), m = 0.05 m.
//   intent A = exp(-e^2 / 2 s^2), s = 0.5, e the error against the collide-and-slide
//   response of the input, its cross-slide part weighted by w.
//   Rule (Eq. 6): keep the input if it is safe and no safe candidate beats its A by more
//   than delta; otherwise run the safe candidate with the highest A; stop if none is safe.
// Here the labels are the ground truth a simulator would give. NoPeWorld's head predicts
// them from the DiT's hidden states instead; that prediction is what the paper trains.
// The wall is an infinite line and the step length is fixed: a geometric toy.

const ELL_D = [8.8, 17.58, 26.4, 35.24, 44.13, 52.84, 60.85, 67.76, 73.66, 78.83, 83.53, 88.0]
const ELL_R = [0.9999, 0.9989, 0.994, 0.9798, 0.9474, 0.8851, 0.7873, 0.6621, 0.5215, 0.3735, 0.2224, 0.0697]
const NAMES = [
  "KEEP", "STOP", "SLOW 75%", "SLOW 50%", "SLOW 25%", "SLOW 12.5%", "half-turn R30", "half-turn R60",
  ...ELL_D.map((d) => `ellipse R${d.toFixed(0)}`),
  "half-turn L30", "half-turn L60",
  ...ELL_D.map((d) => `ellipse L${d.toFixed(0)}`),
]
const DELTA = [0, 0, 0, 0, 0, 0, 30, 60, ...ELL_D, -30, -60, ...ELL_D.map((d) => -d)]
const RHO = [1, 0, 0.75, 0.5, 0.25, 0.125, 0.433, 0.25, ...ELL_R, 0.433, 0.25, ...ELL_R]

const R_DISC = 0.25
const MARGIN = 0.05
const SIGMA = 0.5
const W_LAT = 0.5
const STEP = 0.9 // metres per chunk, about walking speed over a 0.75 s chunk

// Abramowitz-Stegun 7.1.26 erf, enough for a soft label
function phi(z: number) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * mexp(-x * x)
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y)
}

type V = [number, number]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1]
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]]
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k]

function decide(dist: number, angleDeg: number, tau: number, delta: number) {
  // camera at the origin facing +y; the wall passes the point (0, dist) and its normal n
  // (pointing back at the camera) is tilted by angleDeg
  const a = (angleDeg * Math.PI) / 180
  const n: V = [msin(a), -mcos(a)]
  const p0: V = [0, dist]
  const gap = (p: V) => dot(sub(p, p0), n) // > 0 on the camera's side
  const u: V = [0, STEP]

  // collide-and-slide response of the input: go until the disc touches, then slide
  const g0 = gap([0, 0]) - R_DISC
  const along = -dot(u, n) // how fast the input closes on the wall
  let vS: V = u
  if (along > 1e-9 && g0 < along) {
    const t = Math.max(0, g0 / along)
    const rest = mul(u, 1 - t)
    const slid = sub(rest, mul(n, dot(rest, n)))
    vS = add(mul(u, t), slid)
  }
  const tan = sub(u, mul(n, dot(u, n)))
  const tl = mhypot(tan[0], tan[1])
  const that: V = tl > 1e-6 ? [tan[0] / tl, tan[1] / tl] : [0, 1]
  const tperp: V = [-that[1], that[0]]

  const cands = DELTA.map((dDeg, i) => {
    const r = (dDeg * Math.PI) / 180
    const d: V = [msin(r) * RHO[i] * STEP, mcos(r) * RHO[i] * STEP]
    const gEnd = gap(d) - R_DISC
    const g = Math.max(-0.25, Math.min(1, Math.min(g0, gEnd))) // a straight sweep is closest at an end
    const P = phi((g - MARGIN) / 0.03)
    const e = sub(d, vS)
    const ea = dot(e, that)
    const eb = dot(e, tperp)
    const e2 = (ea * ea + W_LAT * eb * eb) / (STEP * STEP)
    const A = mexp(-e2 / (2 * SIGMA * SIGMA))
    return { i, d, g, P, A, safe: P >= tau }
  })
  const safe = cands.filter((c) => c.safe)
  let pick = 1 // STOP when nothing is safe
  if (safe.length) {
    const best = safe.reduce((b, c) => (c.A > b.A ? c : b))
    pick = cands[0].safe && best.A <= cands[0].A + delta ? 0 : best.i
  }
  return { cands, pick, vS, n, p0 }
}

const S = 150 // px per metre
const CX = 260
const CY = 330

export function CandidateFan() {
  const [dist, setDist] = useState(0.9)
  const [angle, setAngle] = useState(35)
  const [tau, setTau] = useState(0.85)
  const [showAll, setShowAll] = useState(true)
  const res = useMemo(() => decide(dist, angle, tau, 0.03), [dist, angle, tau])
  const X = (x: number) => CX + x * S
  const Y = (y: number) => CY - y * S
  const keep = res.cands[0]
  const pick = res.cands[res.pick]
  const nSafe = res.cands.filter((c) => c.safe).length
  // wall line endpoints, long enough to cross the view
  const tdir: V = [-res.n[1], res.n[0]]
  const w1 = add(res.p0, mul(tdir, 3))
  const w2 = add(res.p0, mul(tdir, -3))
  const verdict = res.pick === 0 ? "kept" : nSafe === 0 ? "stopped (nothing safe)" : "changed"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">one decision, 34 candidates, from above</span>
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className={cn("rounded px-2 py-0.5", showAll ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
        >
          {showAll ? "all candidates" : "chosen only"}
        </button>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 520 380" className="w-full rounded-md border bg-muted/20" role="img" aria-label="A camera at the bottom, a wall ahead, and a fan of candidate motions coloured safe or unsafe, with the chosen one highlighted">
          <line x1={X(w1[0])} y1={Y(w1[1])} x2={X(w2[0])} y2={Y(w2[1])} stroke="currentColor" strokeWidth="6" opacity="0.55" />
          <text x={12} y={18} fontSize="11" className="fill-muted-foreground font-mono">wall</text>
          {/* the input's collide-and-slide response */}
          <line x1={X(0)} y1={Y(0)} x2={X(res.vS[0])} y2={Y(res.vS[1])} stroke="#d97706" strokeWidth="2" strokeDasharray="5 4" />
          {res.cands.map((c) => {
            if (!showAll && c.i !== res.pick && c.i !== 0) return null
            if (c.i === 1) return null
            const col = c.safe ? "#16a34a" : "#dc2626"
            const on = c.i === res.pick
            return (
              <line
                key={c.i}
                x1={X(0)}
                y1={Y(0)}
                x2={X(c.d[0])}
                y2={Y(c.d[1])}
                stroke={col}
                strokeWidth={on ? 4 : c.i === 0 ? 2.5 : 1.2}
                opacity={on ? 1 : 0.35 + 0.5 * c.A}
              />
            )
          })}
          {res.pick !== 1 ? (
            <circle cx={X(pick.d[0])} cy={Y(pick.d[1])} r={R_DISC * S} fill="none" stroke="#16a34a" strokeDasharray="3 3" />
          ) : null}
          <circle cx={X(0)} cy={Y(0)} r={R_DISC * S} fill="currentColor" opacity="0.12" />
          <circle cx={X(0)} cy={Y(0)} r={5} fill="currentColor" />
          <text x={X(0) + 10} y={Y(0) + 4} fontSize="11" className="fill-foreground font-mono">camera, W held</text>
          {res.pick === 1 ? (
            <text x={X(0) - 18} y={Y(0) - 14} fontSize="12" className="fill-foreground font-mono">STOP</text>
          ) : null}
        </svg>

        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">input clearance g </span>
            <span className="text-foreground">{keep.g.toFixed(2)} m</span>
            <span className="text-muted-foreground"> · P(safe) </span>
            <span className={keep.safe ? "text-green-600" : "text-red-600"}>{keep.P.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">safe candidates </span>
            <span className="text-foreground">{nSafe} of 34</span>
          </div>
          <div>
            <span className="text-muted-foreground">decision </span>
            <span className="text-foreground">{verdict}: {NAMES[res.pick]}</span>
          </div>
          <div>
            <span className="text-muted-foreground">intent A of what runs </span>
            <span className="text-foreground">{pick.A.toFixed(2)}</span>
            <span className="text-muted-foreground"> (input&apos;s own: {keep.A.toFixed(2)})</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 font-mono text-xs">
            <span className="text-muted-foreground">wall ahead: {dist.toFixed(2)} m</span>
            <Range min={0.3} max={2} step={0.05} value={dist} onChange={(e) => setDist(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span className="text-muted-foreground">wall angle: {angle}°{angle === 0 ? " (head-on)" : ""}</span>
            <Range min={0} max={75} step={1} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span className="text-muted-foreground">safety threshold τ: {tau.toFixed(2)}</span>
            <Range min={0.5} max={0.99} step={0.01} value={tau} onChange={(e) => setTau(Number(e.target.value))} />
          </label>
        </div>
        <figcaption className="mt-3 text-xs text-muted-foreground">
          The input moves 0.9 m into a wall. Every candidate is swept with a 0.25 m disc. Green ones keep at least the 0.05 m margin (soft label P ≥ τ). Red ones would touch the wall. The dashed orange line is what a game engine would do with the input: walk to the wall, then slide along it. Brighter lines score higher on intent A against that slide. Head-on, the best safe motion is a stop or a short step. At an angle it is a turn that slides. The candidate set and formulas are the paper&apos;s (App. S2.3-S2.4), and the labels are exact geometry. NoPeWorld&apos;s head has to predict these labels from the DiT&apos;s hidden states, without a map.
        </figcaption>
      </div>
    </figure>
  )
}
