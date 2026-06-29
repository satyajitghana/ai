"use client"

import { useEffect, useMemo, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

// A constant-velocity Kalman filter tracking a noisy 1-D signal, live. The true
// value (faint) is observed only through scattered noisy measurements; the filter
// predicts, then corrects toward each measurement by the Kalman gain, and the
// shaded band is its ±1σ uncertainty. Drag the two noises: R is how much you
// distrust the sensor, Q is how much you let the state drift. Measurements are
// fixed (seeded); only the filter's assumptions change.

const NS = 64
const DT = 1
const MEAS_STD = 7 // true observation noise used to synthesise the data

// deterministic gaussian noise (LCG + Box-Muller) so SSR and re-renders match
function makeData() {
  let s = 12345
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const gauss = () => {
    const u = Math.max(rand(), 1e-9)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  const truth: number[] = []
  const meas: number[] = []
  for (let t = 0; t < NS; t++) {
    const tv = 50 + 28 * Math.sin(t * 0.11) + 8 * Math.sin(t * 0.31)
    truth.push(tv)
    meas.push(tv + gauss() * MEAS_STD)
  }
  return { truth, meas }
}

// run a 2-state (pos, vel) CV Kalman filter; return per-step estimate + std
function runKF(meas: number[], q: number, r: number) {
  let x = [meas[0], 0]
  let P = [
    [50, 0],
    [0, 50],
  ]
  const F = [
    [1, DT],
    [0, 1],
  ]
  const Q = [
    [(q * DT * DT * DT) / 3, (q * DT * DT) / 2],
    [(q * DT * DT) / 2, q * DT],
  ]
  const est: number[] = []
  const std: number[] = []
  for (let t = 0; t < meas.length; t++) {
    // predict
    const xp = [F[0][0] * x[0] + F[0][1] * x[1], F[1][0] * x[0] + F[1][1] * x[1]]
    const FP = [
      [F[0][0] * P[0][0] + F[0][1] * P[1][0], F[0][0] * P[0][1] + F[0][1] * P[1][1]],
      [F[1][0] * P[0][0] + F[1][1] * P[1][0], F[1][0] * P[0][1] + F[1][1] * P[1][1]],
    ]
    let Pp = [
      [FP[0][0] * F[0][0] + FP[0][1] * F[0][1], FP[0][0] * F[1][0] + FP[0][1] * F[1][1]],
      [FP[1][0] * F[0][0] + FP[1][1] * F[0][1], FP[1][0] * F[1][0] + FP[1][1] * F[1][1]],
    ]
    Pp = [
      [Pp[0][0] + Q[0][0], Pp[0][1] + Q[0][1]],
      [Pp[1][0] + Q[1][0], Pp[1][1] + Q[1][1]],
    ]
    // update (H = [1, 0])
    const S = Pp[0][0] + r
    const K = [Pp[0][0] / S, Pp[1][0] / S]
    const y = meas[t] - xp[0]
    x = [xp[0] + K[0] * y, xp[1] + K[1] * y]
    P = [
      [(1 - K[0]) * Pp[0][0], (1 - K[0]) * Pp[0][1]],
      [Pp[1][0] - K[1] * Pp[0][0], Pp[1][1] - K[1] * Pp[0][1]],
    ]
    est.push(x[0])
    std.push(Math.sqrt(Math.max(P[0][0], 0)))
  }
  return { est, std }
}

export function KalmanTrack() {
  const [q, setQ] = useState(0.5)
  const [r, setR] = useState(49)
  const [t, setT] = useState(NS)
  const [playing, setPlaying] = useState(true)

  const { truth, meas } = useMemo(makeData, [])
  const { est, std } = useMemo(() => runKF(meas, q, r), [meas, q, r])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x >= NS ? 0 : x + 1)), 90)
    return () => clearInterval(id)
  }, [playing])

  const W = 620
  const H = 220
  const pad = 12
  const sx = (i: number) => pad + (i / (NS - 1)) * (W - 2 * pad)
  const sy = (v: number) => H - pad - ((v - 10) / 90) * (H - 2 * pad)
  const n = Math.max(t, 1)

  const truthPath = truth.slice(0, n).map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")
  const estPath = est.slice(0, n).map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")
  const bandTop = est.slice(0, n).map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v + std[i]).toFixed(1)}`).join(" ")
  const bandBot = est.slice(0, n).map((v, i) => `${sx(i).toFixed(1)},${sy(v - std[i]).toFixed(1)}`).reverse().join(" L")
  const band = n > 1 ? `${bandTop} L${bandBot} Z` : ""

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>constant-velocity Kalman filter · live</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A Kalman filter estimate (line with shaded uncertainty band) tracking noisy measurements of a smooth true signal." className="w-full">
          {band ? <path d={band} fill="oklch(0.72 0.15 195 / 0.16)" stroke="none" /> : null}
          <path d={truthPath} fill="none" stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
          {meas.slice(0, n).map((v, i) => (
            <circle key={i} cx={sx(i)} cy={sy(v)} r="1.7" fill="var(--muted-foreground)" opacity="0.5" />
          ))}
          <path d={estPath} fill="none" stroke="oklch(0.72 0.15 195)" strokeWidth="2" />
        </svg>

        <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-0 w-4 border-t border-dashed border-muted-foreground" />truth</span>
          <span className="flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" />measurements</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: "oklch(0.72 0.15 195)" }} />estimate ±1σ</span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Slider label="measurement noise R (distrust sensor)" value={r} min={1} max={300} step={1} onChange={setR} fmt={(v) => v.toFixed(0)} />
          <Slider label="process noise Q (let state drift)" value={q} min={0.01} max={5} step={0.01} onChange={setQ} fmt={(v) => v.toFixed(2)} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Raise <span className="text-foreground">R</span> and the filter trusts its
          prediction over the sensor — the estimate smooths out but lags. Raise{" "}
          <span className="text-foreground">Q</span> and it trusts fresh measurements more —
          it snaps to the data but gets jittery. The Kalman gain is exactly this ratio,
          computed optimally each step from the covariances, and the band is the filter&rsquo;s
          own honest estimate of how unsure it is.
        </p>
      </div>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  fmt: (v: number) => string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full cursor-pointer accent-foreground" aria-label={label} />
    </div>
  )
}
