"use client"

import { useMemo, useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, msin } from "@/lib/dmath"

// One update, three ways, on a body that rotates in the plane. A heading is a
// unit complex number (c, s) = (cos θ, sin θ): the 2-D cousin of the unit
// quaternion, one constraint on two numbers. The classic EKF keeps (c, s) as
// two free numbers with a 2x2 covariance; the error-state filter keeps the
// point on the circle and a 1-D error δθ in its tangent; the iterated one
// re-linearises that update until it stops moving.
//
// The sensor sees a known world direction m = (1, 0) in the body frame,
// z = R(θ)ᵀ m, noise-free here so only the filters differ. Every number is
// computed below from the slider; none is drawn by hand.

const DEG = Math.PI / 180
const SIG0 = 40 * DEG // prior heading sigma
const TURN = 40 * DEG // gyro rotation in the predict step
const SIG_G = 5 * DEG // gyro noise over that step
const SIG_Z = 0.1 // sensor noise per component (assumed by the filters)
const TH0 = 20 * DEG // prior heading estimate

const C_EKF = "oklch(0.66 0.17 45)"
const C_ESKF = "oklch(0.6 0.14 220)"
const C_IEKF = "oklch(0.58 0.15 150)"

const STEPS = [
  { t: "Prior", d: "The estimate says 20° with σ 40°. The truth is further round. The EKF holds two numbers (c, s); its covariance is a thin ellipse along the circle's tangent." },
  { t: "Predict", d: "The gyro turns the body 40°. The ESKF adds 40° to the angle and the gyro noise to σ². The EKF rotates (c, s), a linear map here, and adds noise to both numbers, so its ellipse fattens in the radial direction, which is not a direction a rotation can move in." },
  { t: "Measure", d: "The sensor reports where a known landmark sits in the body frame. The gap between that and the predicted direction is the innovation." },
  { t: "EKF update", d: "The EKF adds K·y to (c, s). The correction is a straight line in the plane, so the result leaves the circle: |q| is no longer 1." },
  { t: "EKF renormalise", d: "The textbook patch divides by |q|. The angle it lands on is short of the correction, and the covariance is left as it was, tied to the old tangent." },
  { t: "ESKF update", d: "The ESKF solves for δθ in the tangent and wraps it onto the circle: θ ⊞ δθ. Same linearisation point as the EKF, but the step stays on the manifold." },
  { t: "IEKF iterations", d: "Re-linearise at the new angle and solve again, keeping the prior in the cost. Each pass is a Gauss-Newton step on the MAP problem; it stops when the step does." },
]

function wrap(a: number) {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x < -Math.PI) x += 2 * Math.PI
  return x
}

function compute(errDeg: number) {
  const truth0 = TH0 + errDeg * DEG
  const truth = truth0 + TURN
  // ESKF predict
  const thP = TH0 + TURN
  const vP = SIG0 * SIG0 + SIG_G * SIG_G
  // EKF prior: (c, s) with covariance J σ² Jᵀ + tiny radial, then rotate and add isotropic noise
  const c0 = mcos(TH0)
  const s0 = msin(TH0)
  const J0 = [-s0, c0]
  let P = [
    [J0[0] * J0[0] * SIG0 * SIG0 + 1e-6, J0[0] * J0[1] * SIG0 * SIG0],
    [J0[1] * J0[0] * SIG0 * SIG0, J0[1] * J0[1] * SIG0 * SIG0 + 1e-6],
  ]
  const Pprior = P
  const ct = mcos(TURN)
  const st = msin(TURN)
  const F = [
    [ct, -st],
    [st, ct],
  ]
  const x1 = [ct * c0 - st * s0, st * c0 + ct * s0]
  const FP = [
    [F[0][0] * P[0][0] + F[0][1] * P[1][0], F[0][0] * P[0][1] + F[0][1] * P[1][1]],
    [F[1][0] * P[0][0] + F[1][1] * P[1][0], F[1][0] * P[0][1] + F[1][1] * P[1][1]],
  ]
  P = [
    [FP[0][0] * F[0][0] + FP[0][1] * F[0][1] + SIG_G * SIG_G, FP[0][0] * F[1][0] + FP[0][1] * F[1][1]],
    [FP[1][0] * F[0][0] + FP[1][1] * F[0][1], FP[1][0] * F[1][0] + FP[1][1] * F[1][1] + SIG_G * SIG_G],
  ]
  const Ppred = P
  // measurement z = R(θ)ᵀ m with m = (1, 0): z = (cos θ, -sin θ); linear in (c, s): H = [[1, 0], [0, -1]]
  const z = [mcos(truth), -msin(truth)]
  const r = SIG_Z * SIG_Z
  // EKF update (2-D)
  const y = [z[0] - x1[0], z[1] + x1[1]]
  const S = [
    [P[0][0] + r, -P[0][1]],
    [-P[1][0], P[1][1] + r],
  ]
  const det = S[0][0] * S[1][1] - S[0][1] * S[1][0]
  const Si = [
    [S[1][1] / det, -S[0][1] / det],
    [-S[1][0] / det, S[0][0] / det],
  ]
  // K = P Hᵀ S⁻¹, Hᵀ = [[1, 0], [0, -1]]
  const PHt = [
    [P[0][0], -P[0][1]],
    [P[1][0], -P[1][1]],
  ]
  const K = [
    [PHt[0][0] * Si[0][0] + PHt[0][1] * Si[1][0], PHt[0][0] * Si[0][1] + PHt[0][1] * Si[1][1]],
    [PHt[1][0] * Si[0][0] + PHt[1][1] * Si[1][0], PHt[1][0] * Si[0][1] + PHt[1][1] * Si[1][1]],
  ]
  const xE = [x1[0] + K[0][0] * y[0] + K[0][1] * y[1], x1[1] + K[1][0] * y[0] + K[1][1] * y[1]]
  // P = (I - K H) P, H = diag(1, -1)
  const IKH = [
    [1 - K[0][0], K[0][1]],
    [-K[1][0], 1 + K[1][1]],
  ]
  const PE = [
    [IKH[0][0] * P[0][0] + IKH[0][1] * P[1][0], IKH[0][0] * P[0][1] + IKH[0][1] * P[1][1]],
    [IKH[1][0] * P[0][0] + IKH[1][1] * P[1][0], IKH[1][0] * P[0][1] + IKH[1][1] * P[1][1]],
  ]
  const nE = Math.sqrt(xE[0] * xE[0] + xE[1] * xE[1])
  const thE = matan2(xE[1], xE[0])
  const Jn = [-xE[1] / (nE * nE), xE[0] / (nE * nE)]
  const vE = Jn[0] * (PE[0][0] * Jn[0] + PE[0][1] * Jn[1]) + Jn[1] * (PE[1][0] * Jn[0] + PE[1][1] * Jn[1])

  // ESKF / IEKF update in δθ
  const h = (t: number) => [mcos(t), -msin(t)]
  const Hd = (t: number) => [-msin(t), -mcos(t)]
  const iters: number[] = []
  let tj = thP
  let vI = vP
  for (let j = 0; j < 8; j++) {
    const Hj = Hd(tj)
    const hj = h(tj)
    const mu = thP - tj
    const rr = [z[0] - hj[0] - Hj[0] * mu, z[1] - hj[1] - Hj[1] * mu]
    // scalar-state update with a 2-D measurement: information form
    const info = 1 / vP + (Hj[0] * Hj[0] + Hj[1] * Hj[1]) / r
    const Kv = [Hj[0] / r / info, Hj[1] / r / info]
    const d = mu + Kv[0] * rr[0] + Kv[1] * rr[1]
    tj = tj + d
    vI = 1 / info
    iters.push(tj)
    if (Math.abs(d) < 1e-7) break
  }
  const thS = iters[0]
  const H0 = Hd(thP)
  const vS = 1 / (1 / vP + (H0[0] * H0[0] + H0[1] * H0[1]) / r)
  return { truth0, truth, thP, vP, x1, Pprior, Ppred, xE, PE, nE, thE, vE, thS, vS, iters, thI: iters[iters.length - 1], vI }
}

const CX = 170
const CY = 160
const RAD = 112
const px = (c: number, s: number) => [CX + RAD * c, CY - RAD * s]

function ellipsePath(cx: number, cy: number, P: number[][], k = 1) {
  const a = P[0][0]
  const b = P[0][1]
  const d = P[1][1]
  const m = (a + d) / 2
  const q = Math.sqrt(((a - d) / 2) ** 2 + b * b)
  const l1 = Math.sqrt(Math.max(m + q, 0)) * k
  const l2 = Math.sqrt(Math.max(m - q, 0)) * k
  const ang = 0.5 * matan2(2 * b, a - d)
  let p = ""
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * 2 * Math.PI
    const u = l1 * mcos(t)
    const v = l2 * msin(t)
    const wx = cx + u * mcos(ang) - v * msin(ang)
    const wy = cy + u * msin(ang) + v * mcos(ang)
    const [X, Y] = px(wx, wy)
    p += `${i ? "L" : "M"}${X.toFixed(1)},${Y.toFixed(1)}`
  }
  return p + "Z"
}

function arcPath(t0: number, t1: number, r = RAD) {
  let p = ""
  const n = 30
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    p += `${i ? "L" : "M"}${(CX + r * mcos(t)).toFixed(1)},${(CY - r * msin(t)).toFixed(1)}`
  }
  return p
}

function Body({ th, col, dashed }: { th: number; col: string; dashed?: boolean }) {
  const c = mcos(th)
  const s = msin(th)
  const tip = [CX + 34 * c, CY - 34 * s]
  const l = [CX - 16 * c - 12 * s, CY + 16 * s - 12 * c]
  const rr = [CX - 16 * c + 12 * s, CY + 16 * s + 12 * c]
  return (
    <g>
      <line x1={CX} y1={CY} x2={CX + RAD * c} y2={CY - RAD * s} stroke={col} strokeWidth="1" strokeDasharray={dashed ? "3 3" : undefined} opacity="0.7" />
      <path d={`M${tip[0].toFixed(1)},${tip[1].toFixed(1)} L${l[0].toFixed(1)},${l[1].toFixed(1)} L${rr[0].toFixed(1)},${rr[1].toFixed(1)} Z`} fill="none" stroke={col} strokeWidth="1.4" strokeDasharray={dashed ? "3 2" : undefined} />
    </g>
  )
}

const deg = (a: number) => `${(wrap(a) / DEG).toFixed(1)}°`

export function EskfStep() {
  const [err, setErr] = useState(70)
  const [step, setStep] = useState(0)
  const R = useMemo(() => compute(err), [err])

  const truthNow = step === 0 ? R.truth0 : R.truth
  const showEKF = step <= 4
  const ekfPoint = step >= 3 ? (step === 3 ? R.xE : [R.xE[0] / R.nE, R.xE[1] / R.nE]) : step >= 1 ? R.x1 : [mcos(TH0), msin(TH0)]
  const ekfP = step >= 3 ? R.PE : step >= 1 ? R.Ppred : R.Pprior
  const thNow = step === 0 ? TH0 : R.thP
  const sNow = Math.sqrt(step === 0 ? SIG0 * SIG0 : R.vP)
  const [zx, zy] = [mcos(R.truth), msin(R.truth)]

  const rows = [
    { k: "truth", th: R.truth, sig: NaN, col: "var(--muted-foreground)" },
    { k: "EKF (renormalised)", th: R.thE, sig: Math.sqrt(R.vE), col: C_EKF },
    { k: "ESKF", th: R.thS, sig: Math.sqrt(R.vS), col: C_ESKF },
    { k: `IEKF (${R.iters.length} passes)`, th: R.thI, sig: Math.sqrt(R.vI), col: C_IEKF },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one heading update: EKF vs ESKF vs IEKF</span>
        <span>
          step {step + 1}/{STEPS.length}
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[340px_1fr] sm:p-4">
        <svg viewBox="0 0 340 320" className="w-full" role="img" aria-label="A unit circle of headings. The body's true heading is a dashed spoke; the EKF's estimate is a point with a 2-D covariance ellipse that can leave the circle; the ESKF's estimate is a point on the circle with an arc of uncertainty; IEKF iterates step along the circle.">
          <circle cx={CX} cy={CY} r={RAD} fill="none" stroke="var(--border)" strokeWidth="1.2" />
          <line x1={CX - RAD - 14} x2={CX + RAD + 14} y1={CY} y2={CY} stroke="var(--border)" strokeWidth="0.6" />
          <line y1={CY - RAD - 14} y2={CY + RAD + 14} x1={CX} x2={CX} stroke="var(--border)" strokeWidth="0.6" />
          <text x={CX + RAD + 8} y={CY - 6} fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">c</text>
          <text x={CX + 6} y={CY - RAD - 6} fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">s</text>

          <Body th={truthNow} col="var(--muted-foreground)" dashed />

          {step === 2 ? (
            <g>
              <line x1={CX} y1={CY} x2={CX + (RAD + 8) * zx} y2={CY - (RAD + 8) * zy} stroke="var(--foreground)" strokeWidth="1.6" />
              <text x={CX + (RAD + 14) * zx} y={CY - (RAD + 14) * zy} fontFamily="monospace" fontSize="9" fill="var(--foreground)">z says</text>
            </g>
          ) : null}

          {showEKF ? (
            <g>
              <path d={ellipsePath(ekfPoint[0], ekfPoint[1], ekfP)} fill="oklch(0.66 0.17 45 / 0.12)" stroke={C_EKF} strokeWidth="1" />
              {step === 4 ? <line x1={px(R.xE[0], R.xE[1])[0]} y1={px(R.xE[0], R.xE[1])[1]} x2={px(ekfPoint[0], ekfPoint[1])[0]} y2={px(ekfPoint[0], ekfPoint[1])[1]} stroke={C_EKF} strokeDasharray="2 2" /> : null}
              {step === 3 ? <line x1={px(R.x1[0], R.x1[1])[0]} y1={px(R.x1[0], R.x1[1])[1]} x2={px(R.xE[0], R.xE[1])[0]} y2={px(R.xE[0], R.xE[1])[1]} stroke={C_EKF} strokeWidth="1.4" /> : null}
              <circle cx={px(ekfPoint[0], ekfPoint[1])[0]} cy={px(ekfPoint[0], ekfPoint[1])[1]} r="4" fill={C_EKF} />
            </g>
          ) : (
            <circle cx={px(mcos(R.thE), msin(R.thE))[0]} cy={px(mcos(R.thE), msin(R.thE))[1]} r="3.5" fill={C_EKF} opacity="0.7" />
          )}

          {step <= 2 ? (
            <g>
              <path d={arcPath(thNow - sNow, thNow + sNow, RAD + 7)} fill="none" stroke={C_ESKF} strokeWidth="4" opacity="0.45" />
              <circle cx={CX + (RAD + 7) * mcos(thNow)} cy={CY - (RAD + 7) * msin(thNow)} r="4" fill={C_ESKF} />
            </g>
          ) : null}
          {step >= 5 ? (
            <g>
              <path d={arcPath(R.thP, R.thS, RAD + 7)} fill="none" stroke={C_ESKF} strokeWidth="1.4" />
              <path d={arcPath(R.thS - Math.sqrt(R.vS), R.thS + Math.sqrt(R.vS), RAD + 7)} fill="none" stroke={C_ESKF} strokeWidth="4" opacity="0.45" />
              <circle cx={CX + (RAD + 7) * mcos(R.thS)} cy={CY - (RAD + 7) * msin(R.thS)} r="4" fill={C_ESKF} />
            </g>
          ) : null}
          {step === 6
            ? R.iters.map((t, i) => (
                <circle key={i} cx={CX + (RAD + 16) * mcos(t)} cy={CY - (RAD + 16) * msin(t)} r={i === R.iters.length - 1 ? 4 : 2.5} fill={C_IEKF} opacity={0.5 + (0.5 * (i + 1)) / R.iters.length} />
              ))
            : null}
        </svg>

        <div className="flex flex-col gap-3">
          <div>
            <div className="font-mono text-xs text-foreground">{STEPS[step].t}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{STEPS[step].d}</p>
            {step === 3 || step === 4 ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                |q| after the update = <span className="text-foreground">{R.nE.toFixed(3)}</span>
              </p>
            ) : null}
            {step === 6 ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                passes: {R.iters.map((t) => deg(t)).join(" → ")}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40">
              back
            </button>
            <button type="button" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-40">
              next
            </button>
          </div>
          {step >= 5 ? (
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-muted-foreground">
                  <td>after the update</td>
                  <td className="text-right">heading</td>
                  <td className="text-right">σ claimed</td>
                  <td className="text-right">error / σ</td>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.k} style={{ color: r.col }}>
                    <td>{r.k}</td>
                    <td className="text-right tabular-nums">{deg(r.th)}</td>
                    <td className="text-right tabular-nums">{Number.isFinite(r.sig) ? deg(r.sig) : ""}</td>
                    <td className="text-right tabular-nums">{Number.isFinite(r.sig) ? (Math.abs(wrap(R.truth - r.th)) / r.sig).toFixed(1) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>how wrong the prior is</span>
              <span className="tabular-nums text-foreground">{err}°</span>
            </div>
            <Range min={5} max={120} step={5} value={err} onChange={(e) => setErr(parseInt(e.target.value, 10))} className="w-full cursor-pointer" aria-label="prior heading error in degrees" accent="var(--foreground)" />
          </div>
        </div>
      </div>
    </figure>
  )
}
