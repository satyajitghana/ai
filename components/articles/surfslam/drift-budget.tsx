"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog, mlog10, msin } from "@/lib/dmath"

// A toy ROV circles a 40 m wreck for 550 s (the length of SurfSLAM's Long
// sequence) at 0.35 m/s, 12 m down, bobbing 1.5 m. Four estimators ride the
// same simulated sensors:
//
//   IMU only         integrate a biased accelerometer twice
//   + DVL            velocity measured by the DVL (8 Hz, biased, noisy), rotated
//                    by gyro-integrated heading; during a dropout (no bottom
//                    lock) velocity is propagated from the accelerometer instead
//   + barometer      the same, but depth is read from pressure every step
//   + registrations  the same, plus a relative-position measurement whenever the
//                    vehicle is within 2 m of where it was at least 20 s ago
//                    (SurfSLAM's minimum keyframe age), at most one every 5 s
//
// A registration's residual is spread linearly over the poses between the two
// keyframes. For a translation-only chain with equal odometry noise and a
// precise loop measurement, that is the exact least-squares answer; applied
// one registration at a time it is an approximation of what iSAM2 does.
//
// Every bias and noise value below is a toy choice of mine, not a measured
// property of SurfSLAM's sensors. The point is the shape of each curve.

const DT = 0.125 // 8 Hz, the DVL rate in the paper
const T = 550
const N = Math.round(T / DT)
const SPEED = 0.35
const LEG = 40
const RAD = 7
const PERIM = 2 * LEG + 2 * Math.PI * RAD
const Z0 = 12
const ACC_BIAS = [0.003, -0.0025, 0.001] as const // m/s^2
const ACC_NOISE = 0.02 // m/s^2 per sample
const GYRO_BIAS = (0.003 * Math.PI) / 180 // rad/s
const DVL_BIAS = [0.004, 0.002, 0.003] as const // m/s, body frame (fwd, left, down)
const BARO_NOISE = 0.03 // m
const REG_DIST = 2
const REG_MIN_AGE = 20
const REG_GAP = 5
const REG_NOISE = 0.05 // m
const DROP_BURST = 10 // s

type V3 = [number, number, number]

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

// Stadium-shaped loop: two 40 m legs joined by 7 m semicircles.
function truthAt(t: number): { p: V3; psi: number; vz: number } {
  const s = (SPEED * t) % PERIM
  let x: number
  let y: number
  let psi: number
  if (s < LEG) {
    x = s
    y = 0
    psi = 0
  } else if (s < LEG + Math.PI * RAD) {
    const a = (s - LEG) / RAD
    x = LEG + RAD * msin(a)
    y = RAD - RAD * mcos(a)
    psi = a
  } else if (s < 2 * LEG + Math.PI * RAD) {
    x = LEG - (s - LEG - Math.PI * RAD)
    y = 2 * RAD
    psi = Math.PI
  } else {
    const a = (s - 2 * LEG - Math.PI * RAD) / RAD
    x = -RAD * msin(a)
    y = RAD + RAD * mcos(a)
    psi = Math.PI + a
  }
  const w = (2 * Math.PI) / 137.5
  const z = Z0 + 1.5 * msin(w * t)
  const vz = 1.5 * w * mcos(w * t)
  return { p: [x, y, z], psi, vz }
}

export type DriftResult = {
  truth: V3[]
  paths: V3[][] // per estimator, one pose per step (smoothed, for the plan view)
  err: number[][] // per estimator, online 3-D error at each second
  depthErr: [number, number] // final |z error|, + DVL vs + barometer
  regs: number[] // registration times, s
  dropouts: [number, number][]
}

export function simulate(dvlNoise: number, dropoutPct: number): DriftResult {
  const r = rng(20260926)
  const gauss = () => Math.sqrt(-2 * mlog(Math.max(r(), 1e-9))) * mcos(2 * Math.PI * r())

  // Dropout bursts: evenly spread, jittered, seeded.
  const nBursts = Math.round((dropoutPct / 100) * (T / DROP_BURST))
  const dropouts: [number, number][] = []
  const jr = rng(99)
  for (let b = 0; b < nBursts; b++) {
    const slot = T / nBursts
    const start = b * slot + jr() * Math.max(slot - DROP_BURST, 0)
    dropouts.push([start, Math.min(start + DROP_BURST, T)])
  }
  const inDrop = (t: number) => dropouts.some(([a, b]) => t >= a && t < b)

  const truth: V3[] = []
  const psis: number[] = []
  const vels: V3[] = []
  for (let k = 0; k <= N; k++) {
    const { p, psi, vz } = truthAt(k * DT)
    truth.push(p)
    psis.push(psi)
    vels.push([SPEED * mcos(psi), SPEED * msin(psi), vz])
  }

  // Estimators: 0 IMU only, 1 +DVL, 2 +barometer, 3 +registrations.
  const pos: V3[] = [0, 1, 2, 3].map(() => [...truth[0]] as V3)
  const vel: V3[] = [0, 1, 2, 3].map(() => [...vels[0]] as V3)
  const paths: V3[][] = [0, 1, 2, 3].map(() => [[...truth[0]] as V3])
  const err: number[][] = [[0], [0], [0], [0]]
  const regs: number[] = []
  let psiHat = psis[0]
  let zDvl = truth[0][2]
  let lastReg = -Infinity

  for (let k = 1; k <= N; k++) {
    const t = k * DT
    // IMU: world-frame acceleration (finite difference of truth), biased and noisy.
    const acc: V3 = [0, 1, 2].map(
      (i) => (vels[k][i] - vels[k - 1][i]) / DT + ACC_BIAS[i] + ACC_NOISE * gauss()
    ) as V3
    let dpsi = psis[k] - psis[k - 1]
    if (dpsi < -Math.PI) dpsi += 2 * Math.PI
    psiHat += dpsi + GYRO_BIAS * DT

    // DVL: body-frame velocity, rotated by the estimated heading.
    const dropped = inDrop(t)
    const fwd = SPEED + DVL_BIAS[0] + dvlNoise * gauss()
    const lat = DVL_BIAS[1] + dvlNoise * gauss()
    const vzm = vels[k][2] + DVL_BIAS[2] + dvlNoise * gauss()
    const c = mcos(psiHat)
    const s = msin(psiHat)
    const dvlWorld: V3 = [c * fwd - s * lat, s * fwd + c * lat, vzm]

    for (let e = 0; e < 4; e++) {
      if (e === 0 || dropped) {
        for (let i = 0; i < 3; i++) vel[e][i] += acc[i] * DT
      } else {
        vel[e] = [...dvlWorld] as V3
      }
      for (let i = 0; i < 3; i++) pos[e][i] += vel[e][i] * DT
    }
    zDvl = pos[1][2]
    // Barometer: absolute depth every step.
    const zBaro = truth[k][2] + BARO_NOISE * gauss()
    pos[2][2] = zBaro
    pos[3][2] = zBaro
    for (let e = 0; e < 4; e++) paths[e].push([...pos[e]] as V3)

    // Registrations, checked once a second (1 Hz keyframes, as in the paper).
    if (k % 8 === 0 && t - lastReg >= REG_GAP) {
      for (let m = 0; m <= k - (REG_MIN_AGE / DT); m += 8) {
        const dx = truth[k][0] - truth[m][0]
        const dy = truth[k][1] - truth[m][1]
        if (dx * dx + dy * dy > REG_DIST * REG_DIST) continue
        const meas: V3 = [dx + REG_NOISE * gauss(), dy + REG_NOISE * gauss(), truth[k][2] - truth[m][2]]
        const est = paths[3]
        const res: V3 = [0, 1, 2].map((i) => meas[i] - (est[k][i] - est[m][i])) as V3
        for (let j = m + 1; j <= k; j++) {
          const f = (j - m) / (k - m)
          for (let i = 0; i < 2; i++) est[j][i] += f * res[i]
        }
        pos[3] = [...est[k]] as V3
        regs.push(t)
        lastReg = t
        break
      }
    }

    if (k % 8 === 0) {
      for (let e = 0; e < 4; e++) {
        const d = [0, 1, 2].map((i) => pos[e][i] - truth[k][i])
        err[e].push(Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]))
      }
    }
  }

  return {
    truth,
    paths,
    err,
    depthErr: [Math.abs(zDvl - truth[N][2]), Math.abs(pos[2][2] - truth[N][2])],
    regs,
    dropouts,
  }
}

const COLORS = [
  "oklch(0.64 0.2 25)", // IMU only
  "oklch(0.72 0.15 75)", // + DVL
  "oklch(0.62 0.17 250)", // + barometer
  "oklch(0.62 0.15 150)", // + registrations
] as const
const NAMES = ["IMU only", "IMU + DVL", "+ barometer", "+ stereo registrations"] as const

// Plan view, metres to px.
const PW = 460
const PH = 250
const PS = 7.2
const OX = 14 * PS
const OY = PH - 18
const sx = (x: number) => OX + x * PS
const sy = (y: number) => OY - (y + 8) * PS * 0.92

// Error plot, log scale 1 cm to 1 km.
const EW = 460
const EH = 170
const LO = -2
const HI = 3
const ex = (t: number) => 34 + (t / T) * (EW - 44)
const TICKS = [
  [0.01, "1 cm"],
  [0.1, "10 cm"],
  [1, "1 m"],
  [10, "10 m"],
  [100, "100 m"],
  [1000, "1 km"],
] as const
const ey = (e: number) => 8 + ((HI - Math.max(LO, Math.min(HI, mlog10(Math.max(e, 1e-3))))) / (HI - LO)) * (EH - 28)

function fmtM(e: number) {
  if (e >= 100) return `${e.toFixed(0)} m`
  if (e >= 10) return `${e.toFixed(1)} m`
  return `${e.toFixed(2)} m`
}

export function DriftBudget() {
  const [noise, setNoise] = useState(0.02)
  const [drop, setDrop] = useState(10)
  const r = useMemo(() => simulate(noise, drop), [noise, drop])

  const poly = (pts: V3[]) =>
    pts
      .filter((_, k) => k % 8 === 0)
      .map((p, k) => `${k ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`)
      .join(" ")
  const errPath = (es: number[]) => es.map((e, k) => `${k ? "L" : "M"}${ex(k).toFixed(1)},${ey(e).toFixed(1)}`).join(" ")
  const final = r.err.map((es) => es[es.length - 1])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>550 s around a wreck · four estimators, one set of sensors</span>
        <span className="tabular-nums">{r.regs.length} registrations</span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <svg
          viewBox={`0 0 ${PW} ${PH}`}
          role="img"
          aria-label="Plan view: the true stadium-shaped path around the wreck, dashed, and the paths estimated with the DVL and with stereo registrations. The IMU-only estimate leaves the frame."
          className="w-full"
        >
          <defs>
            <clipPath id="surfslam-plan">
              <rect x="0" y="0" width={PW} height={PH} />
            </clipPath>
          </defs>
          <rect x={sx(3)} y={sy(9.5)} width={34 * PS} height={5 * PS * 0.92} rx="6" fill="var(--muted)" stroke="var(--border)" />
          <text x={sx(20)} y={sy(6.4)} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
            wreck, 40 m
          </text>
          <g clipPath="url(#surfslam-plan)">
            <path d={poly(r.truth)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.2" strokeDasharray="4 4" />
            {[0, 2, 3].map((e) => (
              <path key={e} d={poly(r.paths[e])} fill="none" stroke={COLORS[e]} strokeWidth={e === 3 ? 1.8 : 1.3} opacity="0.9" />
            ))}
          </g>
          <circle cx={sx(0)} cy={sy(0)} r="3.5" fill="var(--foreground)" />
          <text x={sx(0) + 6} y={sy(0) + 13} fontFamily="monospace" fontSize="10" fill="var(--foreground)">
            start
          </text>
          <line x1={PW - 70} y1={PH - 8} x2={PW - 70 + 10 * PS} y2={PH - 8} stroke="var(--foreground)" strokeWidth="1.2" />
          <text x={PW - 70} y={PH - 12} fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
            10 m
          </text>
        </svg>

        <svg
          viewBox={`0 0 ${EW} ${EH}`}
          role="img"
          aria-label={`Position error against time on a log scale. After 550 s: IMU only ${fmtM(final[0])}, IMU plus DVL ${fmtM(final[1])}, plus barometer ${fmtM(final[2])}, plus stereo registrations ${fmtM(final[3])}.`}
          className="w-full"
        >
          {r.dropouts.map(([a, b], k) => (
            <rect key={k} x={ex(a)} y="8" width={Math.max(ex(b) - ex(a), 1)} height={EH - 28} fill="var(--muted)" />
          ))}
          {TICKS.map(([v, label]) => (
            <g key={label}>
              <line x1="34" y1={ey(v)} x2={EW - 10} y2={ey(v)} stroke="var(--border)" strokeWidth="0.8" />
              <text x="30" y={ey(v) + 3} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
                {label}
              </text>
            </g>
          ))}
          {r.regs.map((t, k) => (
            <line key={k} x1={ex(t)} y1={EH - 20} x2={ex(t)} y2={EH - 15} stroke={COLORS[3]} strokeWidth="1.2" />
          ))}
          {r.err.map((es, e) => (
            <path key={e} d={errPath(es)} fill="none" stroke={COLORS[e]} strokeWidth="1.5" />
          ))}
          <text x="34" y={EH - 3} fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
            0 s
          </text>
          <text x={EW - 10} y={EH - 3} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
            550 s
          </text>
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums sm:grid-cols-4">
          {NAMES.map((n, e) => (
            <div key={n} className="flex flex-col">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block size-2 rounded-full" style={{ background: COLORS[e] }} />
                {n}
              </dt>
              <dd className="text-foreground">{fmtM(final[e])} at 550 s</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>DVL velocity noise (1σ)</span>
              <span className="tabular-nums text-foreground">{noise.toFixed(3)} m/s</span>
            </div>
            <Range
              min={0}
              max={0.1}
              step={0.005}
              value={noise}
              onChange={(e) => setNoise(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="DVL velocity noise in metres per second"
              accent="var(--foreground)"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>DVL dropout (lost bottom lock)</span>
              <span className="tabular-nums text-foreground">{drop}% of the run</span>
            </div>
            <Range
              min={0}
              max={60}
              step={5}
              value={drop}
              onChange={(e) => setDrop(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer"
              aria-label="percentage of the run with DVL dropout"
              accent="var(--foreground)"
            />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The IMU-only error grows with the square of time and leaves the frame within a minute or
          two. The DVL turns that into slow, roughly linear growth, because it measures velocity
          and only one integration is left. Shaded bands are dropouts: while the DVL has no bottom
          lock, the estimate falls back to the accelerometer and the curve bends up. The barometer
          removes the depth part of the drift (depth error at 550 s: {fmtM(r.depthErr[0])}{" "}
          without it, {fmtM(r.depthErr[1])}{" "}with it). Registrations only start once the vehicle
          comes back past where it began, and each one (ticks along the bottom) pulls the estimate
          back. Every bias and noise level here is a toy value, not SurfSLAM&apos;s.
        </p>
      </div>
    </figure>
  )
}
