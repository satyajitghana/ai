"use client"

import { useEffect, useState } from "react"
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr"

// The iterated EKF update, as point-to-plane registration. The current pose
// estimate is wrong, so the deskewed scan (red) floats off the map surface
// (grey). Each iteration: find each point's nearest map plane, measure the
// point-to-plane residual, solve one Gauss-Newton/Kalman step for the state
// correction, apply it, and relinearize. The residual collapses in a handful of
// iterations — that's why FAST-LIO iterates instead of doing one EKF update.
// 2D illustration of the SE(3) registration the real filter does.

const STEPS = 5
// true points on a corner: a horizontal wall and a vertical wall
const TRUE: [number, number][] = [
  [20, 70], [30, 70], [40, 70], [50, 70], [60, 70], [70, 70], [80, 70],
  [80, 60], [80, 50], [80, 40], [80, 30],
]

// initial pose error (rotation about centre + translation), shrunk each iteration
const E0 = { th: 0.42, tx: -16, ty: 10 }
const CX = 55
const CY = 55
const DECAY = 0.42

function transformed(k: number) {
  const f = Math.pow(DECAY, k) // remaining error fraction after k iters
  const th = E0.th * f
  const tx = E0.tx * f
  const ty = E0.ty * f
  return TRUE.map(([x, y]) => {
    const dx = x - CX
    const dy = y - CY
    const rx = CX + (dx * Math.cos(th) - dy * Math.sin(th)) + tx
    const ry = CY + (dx * Math.sin(th) + dy * Math.cos(th)) + ty
    return [rx, ry] as [number, number]
  })
}

// residual ≈ mean distance to the nearest wall (y=70 or x=80)
function residual(pts: [number, number][]) {
  const d = pts.map(([x, y]) => Math.min(Math.abs(y - 70), Math.abs(x - 80)))
  return d.reduce((a, b) => a + b, 0) / d.length
}

export function IEKFRegister() {
  const [k, setK] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setK((x) => (x >= STEPS + 1 ? 0 : x + 1)), 900)
    return () => clearInterval(id)
  }, [])

  const kk = Math.min(k, STEPS)
  const pts = transformed(kk)
  const res = residual(pts)
  const res0 = residual(transformed(0))
  const converged = kk >= STEPS

  const W = 300
  const sc = (v: number) => 16 + (v / 100) * (W - 32)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>iterated EKF · point-to-plane registration</span>
        <button type="button" onClick={() => setK(0)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          <ArrowCounterClockwiseIcon size={12} weight="bold" /> restart
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[300px_1fr]">
        <svg viewBox={`0 0 ${W} ${W}`} role="img" aria-label="Scan points converging onto two map walls over iterated-EKF iterations." className="mx-auto w-full max-w-[300px] rounded-md border bg-muted/20">
          {/* map walls (planes) */}
          <line x1={sc(16)} y1={sc(70)} x2={sc(84)} y2={sc(70)} stroke="var(--muted-foreground)" strokeWidth="3" opacity="0.4" strokeLinecap="round" />
          <line x1={sc(80)} y1={sc(74)} x2={sc(80)} y2={sc(26)} stroke="var(--muted-foreground)" strokeWidth="3" opacity="0.4" strokeLinecap="round" />
          <text x={sc(45)} y={sc(78)} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="var(--muted-foreground)">map plane</text>
          {/* residual lines to nearest wall */}
          {pts.map(([x, y], i) => {
            const toH = Math.abs(y - 70)
            const toV = Math.abs(x - 80)
            const [nx, ny] = toH < toV ? [x, 70] : [80, y]
            return <line key={i} x1={sc(x)} y1={sc(y)} x2={sc(nx)} y2={sc(ny)} stroke="oklch(0.72 0.15 25)" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5" />
          })}
          {/* scan points */}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={sc(x)} cy={sc(y)} r="2.6" fill={converged ? "oklch(0.72 0.15 150)" : "oklch(0.72 0.15 25)"} />
          ))}
        </svg>

        <div className="flex flex-col justify-center gap-3">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
            <Stat label="iteration" value={`${kk}/${STEPS}`} />
            <Stat label="mean residual" value={`${res.toFixed(1)}`} highlight />
          </div>
          {/* residual bar */}
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">point-to-plane residual</div>
            <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
              <div className="h-full rounded transition-all duration-500" style={{ width: `${(res / res0) * 100}%`, background: converged ? "oklch(0.72 0.15 150)" : "oklch(0.72 0.15 25)" }} />
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {converged
              ? "Converged: every component of the state correction dx fell below the threshold (0.001 in the code), so the scan sits on the map and the covariance is updated. This pose is the odometry output."
              : "Each iteration re-associates points to planes at the latest estimate, builds the measurement Jacobian H, and takes one Kalman step dx = K·h + (I−KH)(x⊟x̂). Relinearizing is what makes the very nonlinear point-to-plane fit converge."}
          </p>
        </div>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-medium text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
