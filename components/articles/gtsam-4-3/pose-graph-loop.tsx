"use client"

import { useEffect, useReducer } from "react"
import { ArrowCounterClockwiseIcon, PlayIcon, SkipForwardIcon } from "@phosphor-icons/react/dist/ssr"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, mlog, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A 13-pose loop, solved in your browser. A robot drives twelve 1 m steps,
// turning 30 degrees each time, so the true path closes on itself. Its gyro
// reads high by a bias you set, plus a little seeded noise, so dead reckoning
// does not close. Each odometry reading is a between-factor (a square on an
// edge); the start carries a tight prior. Toggle the loop-closure factor
// ("x12 is back at x0") and run Gauss-Newton: the whole trajectory moves at
// once, the error spreads across every factor, and the 1-sigma ellipses shrink.
//
// The solver is mine and deliberately small: poses are (x, y, theta) and the
// update is added directly, where GTSAM retracts on the Pose2 manifold; the
// between residual is translation-in-frame-i plus wrapped heading difference,
// where GTSAM uses the SE(2) logarithm. The normal equations are 39 x 39 and are
// factored densely with Cholesky; the sparsity panel shows what a sparse solver
// would see.

const N = 12
const DEG = Math.PI / 180
const SIG = [0.05, 0.05, 2 * DEG] as const // odometry sigmas (m, m, rad)
const SIG_LOOP = [0.05, 0.05, 1 * DEG] as const
const SIG_PRIOR = 1e-3
const DIM = 3 * (N + 1)
const MAX_ITERS = 12

type Pose = [number, number, number]
type Factor = { i: number; j: number; z: Pose; sig: readonly number[] }

const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI))

function compose(p: Pose, u: Pose): Pose {
  const c = mcos(p[2])
  const s = msin(p[2])
  return [p[0] + c * u[0] - s * u[1], p[1] + s * u[0] + c * u[1], wrap(p[2] + u[2])]
}

// Seeded odometry: the same readings on the server and in every browser.
function odometry(biasDeg: number): Pose[] {
  let s = 20260926
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const gauss = () => Math.sqrt(-2 * mlog(Math.max(rand(), 1e-9))) * mcos(2 * Math.PI * rand())
  const out: Pose[] = []
  for (let k = 0; k < N; k++) {
    const a = gauss()
    const b = gauss()
    const c = gauss()
    out.push([1 + 0.03 * a, 0.03 * b, (30 + biasDeg) * DEG + 1 * DEG * c])
  }
  return out
}

function deadReckon(odom: Pose[]): Pose[] {
  const est: Pose[] = [[0, 0, 0]]
  for (const u of odom) est.push(compose(est[est.length - 1], u))
  return est
}

const TRUTH: Pose[] = (() => {
  const t: Pose[] = [[0, 0, 0]]
  for (let k = 0; k < N; k++) t.push(compose(t[k], [1, 0, 30 * DEG]))
  return t
})()

function factorsFor(odom: Pose[], loop: boolean): Factor[] {
  const f: Factor[] = odom.map((z, k) => ({ i: k, j: k + 1, z, sig: SIG }))
  if (loop) f.push({ i: N, j: 0, z: [0, 0, 0], sig: SIG_LOOP })
  return f
}

// Residual and Jacobians of one between-factor.
function between(pi: Pose, pj: Pose, z: Pose) {
  const dx = pj[0] - pi[0]
  const dy = pj[1] - pi[1]
  const c = mcos(pi[2])
  const s = msin(pi[2])
  const r = [c * dx + s * dy - z[0], -s * dx + c * dy - z[1], wrap(pj[2] - pi[2] - z[2])]
  const Ji = [
    [-c, -s, -s * dx + c * dy],
    [s, -c, -c * dx - s * dy],
    [0, 0, -1],
  ]
  const Jj = [
    [c, s, 0],
    [-s, c, 0],
    [0, 0, 1],
  ]
  return { r, Ji, Jj }
}

// Whitened squared error of each factor, and the total 0.5 * sum (GTSAM's graph.error()).
function factorErrors(est: Pose[], factors: Factor[]) {
  const per = factors.map((f) => {
    const { r } = between(est[f.i], est[f.j], f.z)
    return 0.5 * r.reduce((a, v, d) => a + (v / f.sig[d]) ** 2, 0)
  })
  const prior = 0.5 * est[0].reduce((a, v) => a + (v / SIG_PRIOR) ** 2, 0)
  return { per, total: prior + per.reduce((a, b) => a + b, 0) }
}

// Normal equations H dx = -g at the current estimate.
function linearize(est: Pose[], factors: Factor[]) {
  const H = Array.from({ length: DIM }, () => new Float64Array(DIM))
  const g = new Float64Array(DIM)
  for (let d = 0; d < 3; d++) {
    H[d][d] += 1 / SIG_PRIOR ** 2
    g[d] += est[0][d] / SIG_PRIOR ** 2
  }
  for (const f of factors) {
    const { r, Ji, Jj } = between(est[f.i], est[f.j], f.z)
    const w = f.sig.map((sg) => 1 / (sg * sg))
    const blocks: [number, number[][]][] = [
      [f.i, Ji],
      [f.j, Jj],
    ]
    for (const [a, Ja] of blocks) {
      for (let p = 0; p < 3; p++) {
        let gp = 0
        for (let d = 0; d < 3; d++) gp += Ja[d][p] * w[d] * r[d]
        g[3 * a + p] += gp
        for (const [b, Jb] of blocks) {
          for (let q = 0; q < 3; q++) {
            let h = 0
            for (let d = 0; d < 3; d++) h += Ja[d][p] * w[d] * Jb[d][q]
            H[3 * a + p][3 * b + q] += h
          }
        }
      }
    }
  }
  return { H, g }
}

function cholesky(H: Float64Array[]) {
  const n = H.length
  const L = Array.from({ length: n }, () => new Float64Array(n))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = H[i][j]
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k]
      L[i][j] = i === j ? Math.sqrt(Math.max(sum, 1e-12)) : sum / L[j][j]
    }
  }
  return L
}

// Solve L L^T x = b.
function cholSolve(L: Float64Array[], b: Float64Array) {
  const n = L.length
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k]
    y[i] = s / L[i][i]
  }
  const x = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]
    x[i] = s / L[i][i]
  }
  return x
}

function gaussNewtonStep(est: Pose[], factors: Factor[]): Pose[] {
  const { H, g } = linearize(est, factors)
  const L = cholesky(H)
  const dx = cholSolve(
    L,
    g.map((v) => -v)
  )
  return est.map((p, k) => [p[0] + dx[3 * k], p[1] + dx[3 * k + 1], wrap(p[2] + dx[3 * k + 2])] as Pose)
}

// 2x2 position marginals: columns of H^-1 for each pose's x and y.
function positionMarginals(est: Pose[], factors: Factor[]) {
  const { H } = linearize(est, factors)
  const L = cholesky(H)
  return est.map((_, k) => {
    const cols = [3 * k, 3 * k + 1].map((c) => {
      const e = new Float64Array(DIM)
      e[c] = 1
      return cholSolve(L, e)
    })
    return [cols[0][3 * k], cols[0][3 * k + 1], cols[1][3 * k + 1]] as const // sxx, sxy, syy
  })
}

// Block sparsity of H and of its Cholesky factor R under the ordering x0..x12.
function sparsity(loop: boolean) {
  const n = N + 1
  const adj = Array.from({ length: n }, () => new Set<number>())
  const link = (a: number, b: number) => {
    adj[a].add(b)
    adj[b].add(a)
  }
  for (let k = 0; k < N; k++) link(k, k + 1)
  if (loop) link(N, 0)
  const H = adj.map((s, i) => new Set([i, ...s]))
  // Elimination game: eliminating i connects all its later neighbours.
  const work = adj.map((s) => new Set(s))
  const R = Array.from({ length: n }, (_, i) => new Set([i]))
  for (let i = 0; i < n; i++) {
    const later = [...work[i]].filter((j) => j > i)
    for (const j of later) R[i].add(j)
    for (const a of later) for (const b of later) if (a !== b) work[a].add(b)
  }
  const fillKeys = new Set<string>()
  R.forEach((row, i) => row.forEach((j) => j > i && !adj[i].has(j) && fillKeys.add(`${i}-${j}`)))
  const nnzR = R.reduce((acc, row) => acc + row.size, 0)
  return { H, R, fill: fillKeys.size, fillKeys, nnzR }
}

function rmse(est: Pose[]) {
  const s = est.reduce((a, p, k) => a + (p[0] - TRUTH[k][0]) ** 2 + (p[1] - TRUTH[k][1]) ** 2, 0)
  return Math.sqrt(s / est.length)
}

type State = {
  bias: number
  loop: boolean
  est: Pose[]
  iter: number
  history: number[]
  running: boolean
}

type Action =
  | { type: "bias"; bias: number }
  | { type: "loop" }
  | { type: "step" }
  | { type: "run" }
  | { type: "tick" }
  | { type: "reset" }

function start(bias: number, loop: boolean): State {
  const odom = odometry(bias)
  const est = deadReckon(odom)
  return { bias, loop, est, iter: 0, history: [factorErrors(est, factorsFor(odom, loop)).total], running: false }
}

function advance(s: State): State {
  const factors = factorsFor(odometry(s.bias), s.loop)
  const est = gaussNewtonStep(s.est, factors)
  const err = factorErrors(est, factors).total
  const prev = s.history[s.history.length - 1]
  const converged = Math.abs(prev - err) <= 1e-4 * Math.max(prev, 1e-9) || s.iter + 1 >= MAX_ITERS
  return { ...s, est, iter: s.iter + 1, history: [...s.history, err], running: s.running && !converged }
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "bias":
      return start(a.bias, s.loop)
    case "loop": {
      const loop = !s.loop
      const err = factorErrors(s.est, factorsFor(odometry(s.bias), loop)).total
      return { ...s, loop, iter: 0, history: [err], running: false }
    }
    case "step":
      return advance({ ...s, running: false })
    case "run":
      return s.running ? { ...s, running: false } : { ...s, running: true }
    case "tick":
      return s.running ? advance(s) : s
    case "reset":
      return start(s.bias, s.loop)
  }
}

// World (metres) to SVG.
const PX = 78
const X0 = 2.05
const Y0 = 4.35
const W = 420
const H = 410
const sx = (x: number) => (x + X0) * PX
const sy = (y: number) => (Y0 - y) * PX

const EST = "oklch(0.62 0.17 250)"
const LOOP = "oklch(0.66 0.2 25)"
const FILL = "oklch(0.8 0.15 80)"

export function PoseGraphLoop() {
  const [s, dispatch] = useReducer(reducer, 3, (b: number) => start(b, false))

  useEffect(() => {
    if (!s.running) return
    const id = setInterval(() => dispatch({ type: "tick" }), 450)
    return () => clearInterval(id)
  }, [s.running])

  const odom = odometry(s.bias)
  const factors = factorsFor(odom, s.loop)
  const { per, total } = factorErrors(s.est, factors)
  const marg = positionMarginals(s.est, factors)
  const sp = sparsity(s.loop)
  const maxPer = Math.max(...per, 1e-9)
  const gap = Math.sqrt((s.est[N][0] - s.est[0][0]) ** 2 + (s.est[N][1] - s.est[0][1]) ** 2)
  const sigEnd = Math.sqrt(Math.max(marg[N][0], 0))

  const truthPath = TRUTH.map((p, k) => `${k ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>13-pose loop · Gauss-Newton in your browser</span>
        <span className="tabular-nums">
          iteration {s.iter} · graph error {total.toFixed(2)}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`A loop of 13 robot poses. The dashed grey path is the truth; the blue path is the current estimate after ${s.iter} Gauss-Newton iterations. The loop-closure factor is ${s.loop ? "on" : "off"}.`}
          className="w-full"
        >
          <path d={`${truthPath} Z`} fill="none" stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />

          {/* 1-sigma position ellipses */}
          {marg.map(([a, b, c], k) => {
            const tr = (a + c) / 2
            const det = Math.sqrt(Math.max(((a - c) / 2) ** 2 + b * b, 0))
            const l1 = Math.sqrt(Math.max(tr + det, 0))
            const l2 = Math.sqrt(Math.max(tr - det, 0))
            const ang = (0.5 * matan2(2 * b, a - c)) / DEG
            if (l1 * PX < 1.5) return null
            return (
              <ellipse
                key={`e${k}`}
                cx={sx(s.est[k][0]).toFixed(1)}
                cy={sy(s.est[k][1]).toFixed(1)}
                rx={(l1 * PX).toFixed(1)}
                ry={Math.max(l2 * PX, 0.5).toFixed(1)}
                transform={`rotate(${(-ang).toFixed(1)} ${sx(s.est[k][0]).toFixed(1)} ${sy(s.est[k][1]).toFixed(1)})`}
                fill={EST}
                fillOpacity="0.1"
                stroke={EST}
                strokeOpacity="0.35"
                strokeWidth="0.8"
              />
            )
          })}

          {/* factors: edges with a square at the midpoint, shaded by that factor's error */}
          {factors.map((f, k) => {
            const a = s.est[f.i]
            const b = s.est[f.j]
            const isLoop = f.i === N && f.j === 0
            const mx = sx((a[0] + b[0]) / 2)
            const my = sy((a[1] + b[1]) / 2)
            const heat = per[k] / maxPer
            return (
              <g key={`f${k}`}>
                <line
                  x1={sx(a[0]).toFixed(1)}
                  y1={sy(a[1]).toFixed(1)}
                  x2={sx(b[0]).toFixed(1)}
                  y2={sy(b[1]).toFixed(1)}
                  stroke={isLoop ? LOOP : EST}
                  strokeWidth={isLoop ? 1.6 : 1.4}
                  strokeDasharray={isLoop ? "5 4" : undefined}
                />
                <rect
                  x={(mx - 4.5).toFixed(1)}
                  y={(my - 4.5).toFixed(1)}
                  width="9"
                  height="9"
                  fill={LOOP}
                  fillOpacity={(0.08 + 0.92 * heat).toFixed(2)}
                  stroke={isLoop ? LOOP : "var(--foreground)"}
                  strokeWidth="0.8"
                />
              </g>
            )
          })}

          {/* prior factor on x0 */}
          <line x1={sx(0)} y1={sy(0)} x2={sx(0) - 18} y2={sy(0) + 18} stroke="var(--foreground)" strokeWidth="1" />
          <rect x={sx(0) - 23} y={sy(0) + 13} width="9" height="9" fill="var(--foreground)" />
          <text x={sx(0) - 26} y={sy(0) + 36} fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
            prior
          </text>

          {/* poses: a circle with a heading tick */}
          {s.est.map((p, k) => {
            const cx = sx(p[0])
            const cy = sy(p[1])
            const hx = cx + 11 * mcos(p[2])
            const hy = cy - 11 * msin(p[2])
            return (
              <g key={`x${k}`}>
                <line x1={cx.toFixed(1)} y1={cy.toFixed(1)} x2={hx.toFixed(1)} y2={hy.toFixed(1)} stroke="var(--foreground)" strokeWidth="1.2" />
                <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="5.5" fill="var(--background)" stroke={EST} strokeWidth="1.8" />
                {k === 0 || k === N ? (
                  <text x={(cx + 8).toFixed(1)} y={(cy + (k === 0 ? 16 : -9)).toFixed(1)} fontFamily="monospace" fontSize="11" fill="var(--foreground)">
                    x{k}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        <div className="flex flex-col gap-3 font-mono text-xs text-muted-foreground">
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 tabular-nums">
            <dt>position RMSE</dt>
            <dd className="text-right text-foreground">{rmse(s.est).toFixed(3)} m</dd>
            <dt>gap x12 → x0</dt>
            <dd className="text-right text-foreground">{gap.toFixed(2)} m</dd>
            <dt>σx of x12</dt>
            <dd className="text-right text-foreground">{sigEnd.toFixed(3)} m</dd>
          </dl>

          <div>
            <div className="mb-1">error by iteration</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums text-foreground">
              {s.history.map((e, k) => (
                <span key={k} className={k === s.history.length - 1 ? "" : "text-muted-foreground"}>
                  {e < 10 ? e.toFixed(2) : e.toFixed(0)}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Pattern label="H = AᵀA" rows={sp.H} />
            <Pattern label="R" rows={sp.R} fill={sp.fillKeys} upper />
          </div>
          <div className="leading-5">
            R holds {sp.nnzR} of 169 blocks
            {sp.fill ? <span>; the {sp.fill} amber ones are fill-in.</span> : <span>, with no fill-in.</span>}
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>gyro bias (per step)</span>
              <span className="tabular-nums text-foreground">{s.bias.toFixed(1)}°</span>
            </div>
            <Range
              min={0}
              max={6}
              step={0.5}
              value={s.bias}
              onChange={(e) => dispatch({ type: "bias", bias: parseFloat(e.target.value) })}
              className="w-full cursor-pointer"
              aria-label="gyro bias in degrees per step"
              accent="var(--foreground)"
            />
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <button
              type="button"
              aria-pressed={s.loop}
              onClick={() => dispatch({ type: "loop" })}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                s.loop ? "border-transparent text-white" : "text-muted-foreground hover:text-foreground"
              )}
              style={s.loop ? { background: LOOP } : undefined}
            >
              loop closure: {s.loop ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "step" })}
              className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <SkipForwardIcon size={12} weight="fill" />
              one step
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "run" })}
              className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <PlayIcon size={12} weight="fill" />
              {s.running ? "stop" : "optimise"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "reset" })}
              className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowCounterClockwiseIcon size={12} />
              dead reckoning
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Squares are factors, shaded by how much error each one carries. With the loop
          closure off, dead reckoning already satisfies every odometry factor, so the
          error is zero and there is nothing to optimise; only the ellipses grow. Switch
          it on and the whole error sits on the one red square. Two or three{" "}
          <span className="text-foreground">Gauss-Newton</span>{" "}steps later it is shared
          by all thirteen factors, the loop closes, and{" "}
          <span className="text-foreground">σx of x12</span>{" "}collapses. The price shows in
          the right-hand panel: one extra factor fills a whole column of{" "}
          <span className="text-foreground">R</span>.
        </p>
      </div>
    </figure>
  )
}

function Pattern({
  label,
  rows,
  fill,
  upper = false,
}: {
  label: string
  rows: Set<number>[]
  fill?: Set<string>
  upper?: boolean
}) {
  const n = rows.length
  const c = 6
  return (
    <div>
      <div className="mb-1">{label}</div>
      <svg viewBox={`0 0 ${n * c} ${n * c}`} role="img" aria-label={`${label}: block sparsity pattern`} className="w-full border">
        {rows.map((row, i) =>
          [...row].map((j) =>
            upper && j < i ? null : (
              <rect
                key={`${i}-${j}`}
                x={j * c}
                y={i * c}
                width={c}
                height={c}
                fill={fill?.has(`${i}-${j}`) ? FILL : (i === N && j === 0) || (i === 0 && j === N) ? LOOP : EST}
                opacity="0.85"
              />
            )
          )
        )}
      </svg>
    </div>
  )
}
