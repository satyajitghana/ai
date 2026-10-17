"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog } from "@/lib/dmath"
import { useHydrated } from "@/lib/use-hydrated"

// Overdamped Langevin dynamics in the double well U(x) = (x^2 - 1)^2 at kT = 0.3
// (barrier = 1, about 3.3 kT), friction 1:
//   dx = -U'(x) dt + sqrt(2 kT) dW
// One Brownian path is drawn once, at a fine step of 0.002 for 1,000 time
// units (500,000 increments, seeded). Everything below reuses that one path:
// - "fine reference": Euler-Maruyama at 0.002, the thing every big step is
//   trying to reproduce.
// - "exact flow map": the fine path read every h. This is the oracle a Langevin
//   Flow Map is trained to imitate: the state at s + h as a deterministic
//   function of the state at s and the Brownian path on [s, s + h]. Here it is
//   computed by brute force, so it is exact by construction and costs h / 0.002
//   evaluations per step; a trained network would pay one.
// - "Euler at h": the naive big step, which sees only the force at the start
//   and the summed increment W(s + h) - W(s) of the same path.
// Computed in the browser after hydration; nothing here is fitted or learned.

const KT = 0.3
const DT = 0.002
const T_END = 1000
const N = Math.round(T_END / DT)
const SIG = Math.sqrt(2 * KT)
const KS = [5, 10, 25, 50, 75, 100, 125, 150, 200]
const WINDOW = 60

const force = (x: number) => -4 * x * (x * x - 1)

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

type Fine = { dW: Float64Array; x: Float64Array }
let cache: Fine | null = null

function fine(): Fine {
  if (cache) return cache
  const rnd = mulberry32(20261017)
  const dW = new Float64Array(N)
  const sd = Math.sqrt(DT)
  for (let i = 0; i < N; i += 2) {
    const u1 = Math.max(rnd(), 1e-12)
    const u2 = rnd()
    const r = Math.sqrt(-2 * mlog(u1))
    dW[i] = r * mcos(2 * Math.PI * u2) * sd
    if (i + 1 < N) dW[i + 1] = r * mcos(2 * Math.PI * u2 - Math.PI / 2) * sd
  }
  const x = new Float64Array(N + 1)
  x[0] = -1
  for (let i = 0; i < N; i++) x[i + 1] = x[i] + force(x[i]) * DT + SIG * dW[i]
  cache = { dW, x }
  return cache
}

function transitions(path: ArrayLike<number>, len: number) {
  let side = path[0] < 0 ? -1 : 1
  let n = 0
  for (let i = 0; i < len; i++) {
    const v = path[i]
    if (side < 0 && v > 0.5) {
      side = 1
      n++
    } else if (side > 0 && v < -0.5) {
      side = -1
      n++
    }
  }
  return n
}

const LO = -2
const HI = 2
const BINS = 40
function hist(path: ArrayLike<number>, len: number, stride: number) {
  const h = new Array<number>(BINS).fill(0)
  let n = 0
  for (let i = 0; i < len; i += stride) {
    const b = Math.floor(((path[i] - LO) / (HI - LO)) * BINS)
    if (b >= 0 && b < BINS) h[b]++
    n++
  }
  const w = (HI - LO) / BINS
  return h.map((c) => (n > 0 ? c / (n * w) : 0))
}

const BOLTZ = (() => {
  const pts: number[] = []
  let z = 0
  const M = 200
  for (let i = 0; i <= M; i++) {
    const x = LO + ((HI - LO) * i) / M
    const p = mexp(-((x * x - 1) * (x * x - 1)) / KT)
    pts.push(p)
    z += p * ((HI - LO) / M)
  }
  return pts.map((p) => p / z)
})()

const W = 640
const PH = 150
const PAD = 34
const C_REF = "oklch(0.62 0.02 260)"
const C_MAP = "oklch(0.55 0.15 255)"
const C_EUL = "oklch(0.66 0.17 45)"

export function DoubleWell() {
  const hydrated = useHydrated()
  const [ki, setKi] = useState(3)
  const k = KS[ki]
  const h = k * DT

  const sim = useMemo(() => {
    if (!hydrated) return null
    const { dW, x } = fine()
    const steps = Math.floor(N / k)
    const y = new Float64Array(steps + 1)
    y[0] = x[0]
    let blow: number | null = null
    let len = steps + 1
    for (let j = 0; j < steps; j++) {
      let w = 0
      for (let i = j * k; i < (j + 1) * k; i++) w += dW[i]
      const v = y[j] + force(y[j]) * h + SIG * w
      if (!Number.isFinite(v) || Math.abs(v) > 10) {
        blow = (j + 1) * h
        len = j + 1
        break
      }
      y[j + 1] = v
    }
    const sub = new Float64Array(steps + 1)
    for (let j = 0; j <= steps; j++) sub[j] = x[j * k]
    let w0 = 0
    for (let i = 0; i < k; i++) w0 += dW[i]
    const fbar = (x[k] - x[0] - SIG * w0) / h
    return {
      x,
      y,
      len,
      sub,
      blow,
      trRef: transitions(x, N + 1),
      trMap: transitions(sub, steps + 1),
      trEul: transitions(y, len),
      hRef: hist(x, N + 1, 5),
      hEul: hist(y, len, 1),
      f0: force(x[0]),
      fbar,
    }
  }, [hydrated, k, h])

  const tx = (t: number) => PAD + ((t / WINDOW) * (W - PAD - 8))
  const ty = (v: number) => 8 + ((1.8 - Math.max(-1.8, Math.min(1.8, v))) / 3.6) * (PH - 16)
  const hx = (v: number) => PAD + ((v - LO) / (HI - LO)) * (W - PAD - 8)
  const hy = (d: number) => PH - 14 - Math.min(d, 1.2) / 1.2 * (PH - 26)

  let refLine = ""
  let mapDots: [number, number][] = []
  let eulLine = ""
  let refBars = ""
  let eulBars = ""
  if (sim) {
    const lastFine = Math.round(WINDOW / DT)
    for (let i = 0; i <= lastFine; i += 25) refLine += `${i ? "L" : "M"}${tx(i * DT).toFixed(1)},${ty(sim.x[i]).toFixed(1)}`
    mapDots = []
    for (let j = 0; j * h <= WINDOW; j++) mapDots.push([tx(j * h), ty(sim.sub[j])])
    const lastBig = Math.min(sim.len - 1, Math.floor(WINDOW / h))
    for (let j = 0; j <= lastBig; j++) eulLine += `${j ? "L" : "M"}${tx(j * h).toFixed(1)},${ty(sim.y[j]).toFixed(1)}`
    const bw = (HI - LO) / BINS
    sim.hRef.forEach((d, b) => {
      refBars += `M${hx(LO + b * bw).toFixed(1)},${hy(d).toFixed(1)}H${hx(LO + (b + 1) * bw).toFixed(1)}`
    })
    sim.hEul.forEach((d, b) => {
      eulBars += `M${hx(LO + b * bw).toFixed(1)},${hy(d).toFixed(1)}H${hx(LO + (b + 1) * bw).toFixed(1)}`
    })
  }
  const boltzLine = BOLTZ.map((p, i) => `${i ? "L" : "M"}${hx(LO + ((HI - LO) * i) / 200).toFixed(1)},${hy(p).toFixed(1)}`).join("")

  const stable = h < 0.25
  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">
        One Brownian path, three integrators: a double well at step size h
      </figcaption>
      <label className="flex flex-wrap items-center gap-3">
        <span className="w-40 font-mono text-xs">h = {h.toFixed(3)} ({k} fine steps)</span>
        <Range
          min={0}
          max={KS.length - 1}
          step={1}
          value={ki}
          onChange={(e) => setKi(Number(e.target.value))}
          className="min-w-40 flex-1"
          aria-label="Big step size h"
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        Euler&apos;s linear stability limit at the minima is h = 2 / U&apos;&apos;(±1) = 0.25.{" "}
        {stable
          ? "This h is inside it, but the steep quartic walls can still throw a step past the far side after one large kick."
          : "This h is outside it."}
      </p>

      <svg viewBox={`0 0 ${W} ${PH}`} className="mt-3 w-full" role="img" aria-label="Trajectories over the first 60 time units">
        <line x1={PAD} x2={W - 8} y1={ty(1)} y2={ty(1)} stroke="currentColor" strokeOpacity={0.12} />
        <line x1={PAD} x2={W - 8} y1={ty(-1)} y2={ty(-1)} stroke="currentColor" strokeOpacity={0.12} />
        <text x={4} y={ty(1) + 4} className="fill-muted-foreground" fontSize={10}>+1</text>
        <text x={4} y={ty(-1) + 4} className="fill-muted-foreground" fontSize={10}>−1</text>
        {sim ? (
          <>
            <path d={refLine} fill="none" stroke={C_REF} strokeWidth={0.8} />
            <path d={eulLine} fill="none" stroke={C_EUL} strokeWidth={1.4} />
            {mapDots.map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={h > 0.04 ? 2.4 : 1.2} fill={C_MAP} />
            ))}
          </>
        ) : (
          <text x={W / 2} y={PH / 2} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
            simulating 500,000 fine steps…
          </text>
        )}
        <text x={W - 10} y={PH - 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>time 0 to 60</text>
      </svg>

      <svg viewBox={`0 0 ${W} ${PH}`} className="mt-2 w-full" role="img" aria-label="Histogram of x against the Boltzmann density">
        <path d={boltzLine} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeDasharray="3 3" />
        {sim ? (
          <>
            <path d={refBars} fill="none" stroke={C_MAP} strokeWidth={2} />
            <path d={eulBars} fill="none" stroke={C_EUL} strokeWidth={2} />
          </>
        ) : null}
        <text x={hx(-1)} y={PH - 2} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>x = −1</text>
        <text x={hx(1)} y={PH - 2} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>x = +1</text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span><span style={{ color: C_REF }}>━</span> fine reference (step 0.002)</span>
        <span><span style={{ color: C_MAP }}>●</span> exact flow map at h (same path)</span>
        <span><span style={{ color: C_EUL }}>━</span> Euler at h</span>
        <span><span className="opacity-60">┅</span> Boltzmann density</span>
      </div>

      {sim ? (
        <table className="mt-3 w-full text-left text-xs tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">over 1,000 time units</th>
              <th className="py-1 font-normal">well-to-well transitions</th>
              <th className="py-1 font-normal">evaluations per time unit</th>
              <th className="py-1 font-normal">outcome</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1">fine reference</td>
              <td>{sim.trRef}</td>
              <td>500</td>
              <td>ground truth</td>
            </tr>
            <tr>
              <td className="py-1">flow map at h</td>
              <td>{sim.trMap}</td>
              <td>{(1 / h).toFixed(0)} if learned</td>
              <td>exact by construction</td>
            </tr>
            <tr>
              <td className="py-1">Euler at h</td>
              <td>{sim.trEul}</td>
              <td>{(1 / h).toFixed(0)}</td>
              <td>{sim.blow === null ? "finished" : `blew up at t = ${sim.blow.toFixed(1)}`}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
      {sim ? (
        <p className="mt-3 text-xs text-muted-foreground">
          First step: Euler moves by the force at the start, f(x₀) = {sim.f0.toFixed(2)}. The exact map moves by the
          force averaged along the true path over that step, {sim.fbar.toFixed(2)}. That average is what the
          network&apos;s force head learns to predict.
        </p>
      ) : null}
    </figure>
  )
}
