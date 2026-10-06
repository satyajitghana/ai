"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan, mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A two-dimensional toy of OPF state synthesis (paper Eq. 5, Proposition 1,
// Corollary 1, Appendix A). d = 2, K = 2, r = 1: two unit projector columns
// p1 = (1, 0) and p2 = (cos t, sin t). The analysis map is P^T, the factor
// coordinates are u = P^T z, and a predicted factor vector u + e is turned
// back into a state two ways:
//   pinv synthesis       z_hat = (P^T)^+ (u + e)   -- what the paper uses
//   transpose synthesis  z_hat = P (u + e)         -- exact only if P is orthogonal
// For this P, P^T P = [[1, c], [c, 1]] with c = cos t, so the singular values are
// sqrt(1 + c) and sqrt(1 - c), kappa = sqrt((1 + c) / (1 - c)) = cot(t / 2), and
// the worst-case error amplification of pinv synthesis is 1 / sigma_min.
// The presets pick the angle whose 2-D kappa equals a condition number reported
// in the paper (Table 5) or measured on a released checkpoint by this site;
// the toy matches kappa only, not the 128- or 160-dimensional geometry.

const ACCENT = "oklch(0.58 0.14 285)"
const WARN = "oklch(0.62 0.16 40)"
const Z: [number, number] = [0.55, 0.75]

type Preset = { key: string; label: string; kappa: number; note: string }

const PRESETS: Preset[] = [
  { key: "orth", label: "orthogonal", kappa: 1, note: "the zero-penalty limit of Proposition 1" },
  { key: "cw", label: "CausalWorld release", kappa: 1.14, note: "measured on the released CausalWorld checkpoint" },
  { key: "wb2", label: "WeatherBench2 release", kappa: 9.17, note: "measured on the released WeatherBench2 checkpoint" },
  { key: "mh", label: "unconstrained heads", kappa: 438.52, note: "paper Table 5, capacity-matched multi-head" },
]

// angle (hundredths of a degree) whose 2-D condition number is kappa: t = 2 atan(1 / kappa)
function stepsFor(kappa: number) {
  return Math.round((((2 * matan(1 / kappa)) * 180) / Math.PI) * 100)
}

function fmt(x: number, digits = 3) {
  if (!Number.isFinite(x)) return "∞"
  if (Math.abs(x) >= 100) return x.toFixed(0)
  if (Math.abs(x) >= 10) return x.toFixed(1)
  return x.toFixed(digits)
}

export function SynthesisGeometry() {
  const [steps, setSteps] = useState(9000)
  const [eps, setEps] = useState(10) // hundredths
  const deg = steps / 100
  const t = deg * (Math.PI / 180)
  const c = mcos(t)
  const s = msin(t)
  const e = eps / 100

  // factor coordinates and the error: factor 1 overshoots, factor 2 undershoots
  const u1 = Z[0]
  const u2 = c * Z[0] + s * Z[1]
  const e1 = e / Math.SQRT2
  const e2 = -e / Math.SQRT2
  const a1 = u1 + e1
  const a2 = u2 + e2

  // (P^T)^{-1} = [[1, 0], [-c/s, 1/s]]
  const pinv: [number, number] = [a1, (a2 - c * a1) / s]
  // transpose synthesis P a = a1 p1 + a2 p2
  const trans: [number, number] = [a1 + a2 * c, a2 * s]

  const dist = (p: [number, number]) => Math.sqrt((p[0] - Z[0]) ** 2 + (p[1] - Z[1]) ** 2)
  const errPinv = dist(pinv)
  const errTrans = dist(trans)
  const sigmaMin = Math.sqrt(Math.max(0, 1 - c))
  const kappa = sigmaMin > 0 ? Math.sqrt((1 + c) / (1 - c)) : Infinity
  const overlap = c * c

  // drawing: origin at (150, 190), 120 px per unit, y up
  const O = { x: 150, y: 190 }
  const S = 120
  const X = (v: number) => O.x + v * S
  const Y = (v: number) => O.y - v * S
  const clampPt = (p: [number, number]): [number, number] => [
    Math.max(-1.05, Math.min(1.9, p[0])),
    Math.max(-1.3, Math.min(1.45, p[1])),
  ]
  const pinvDraw = clampPt(pinv)
  const transDraw = clampPt(trans)
  const offPlot = pinvDraw[0] !== pinv[0] || pinvDraw[1] !== pinv[1]

  const active = PRESETS.find((p) => stepsFor(p.kappa) === steps)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          state synthesis in 2-D: d = 2, K = 2, r = 1
        </span>
        <span className="font-mono text-[10px] tabular-nums" style={{ color: kappa > 5 ? WARN : ACCENT }}>
          κ₂(P) = {fmt(kappa)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 640 330" className="w-full" role="img"
          aria-label="Two projector directions in a plane, the true latent state, and the state recovered by pseudoinverse and by transpose synthesis from noisy factor predictions.">
          <defs>
            <marker id="ja-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="ja-arrow-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="ja-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* plot frame */}
          <rect x={18} y={18} width={290} height={300} rx={10} fill="var(--background)" stroke="var(--border)" />
          <line x1={X(-1)} y1={O.y} x2={X(1.3)} y2={O.y} stroke="var(--border)" />
          <line x1={O.x} y1={Y(1.3)} x2={O.x} y2={Y(-1.05)} stroke="var(--border)" />

          {/* projector directions */}
          <line x1={O.x} y1={O.y} x2={X(1)} y2={Y(0)} stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#ja-arrow-m)" />
          <text x={X(1) + 4} y={Y(0) + 14} className="fill-muted-foreground font-mono text-[11px]">p₁</text>
          <line x1={O.x} y1={O.y} x2={X(c)} y2={Y(s)} stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#ja-arrow-m)" />
          <text x={X(c) + 6} y={Y(s) - 4} className="fill-muted-foreground font-mono text-[11px]">p₂</text>
          {deg < 89.99 ? (
            <path
              d={`M ${X(0.28)} ${O.y} A ${0.28 * S} ${0.28 * S} 0 0 0 ${X(0.28 * c)} ${Y(0.28 * s)}`}
              fill="none" stroke="var(--muted-foreground)" strokeDasharray="2 3" />
          ) : null}

          {/* true state */}
          <line x1={O.x} y1={O.y} x2={X(Z[0])} y2={Y(Z[1])} stroke={ACCENT} strokeWidth={1.8} markerEnd="url(#ja-arrow)" />
          <text x={X(Z[0]) - 14} y={Y(Z[1]) - 8} className="font-mono text-[11px]" fill={ACCENT}>z</text>

          {/* transpose synthesis */}
          <line x1={X(Z[0])} y1={Y(Z[1])} x2={X(transDraw[0])} y2={Y(transDraw[1])} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
          <circle cx={X(transDraw[0])} cy={Y(transDraw[1])} r={5} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={1.5} />
          <text x={X(transDraw[0]) + 8} y={Y(transDraw[1]) + 4} className="fill-muted-foreground font-mono text-[10px]">P(u+e)</text>

          {/* pinv synthesis */}
          <line x1={X(Z[0])} y1={Y(Z[1])} x2={X(pinvDraw[0])} y2={Y(pinvDraw[1])} stroke={WARN} strokeWidth={1.5} />
          <rect x={X(pinvDraw[0]) - 5} y={Y(pinvDraw[1]) - 5} width={10} height={10} rx={2} fill={WARN} filter="url(#ja-soft)" />
          <text x={X(pinvDraw[0]) + 8} y={Y(pinvDraw[1]) - 6} className="font-mono text-[10px]" fill={WARN}>
            (Pᵀ)⁺(u+e){offPlot ? " →" : ""}
          </text>

          {/* readout panel */}
          <g transform="translate(332, 18)">
            <rect width={290} height={300} rx={10} fill="var(--background)" stroke="var(--border)" filter="url(#ja-soft)" />
            {[
              ["angle between p₁ and p₂", `${deg.toFixed(2)}°`],
              ["cross-factor overlap ‖p₁ᵀp₂‖²", fmt(overlap, 4)],
              ["σ_min(P)", fmt(sigmaMin, 4)],
              ["condition number κ₂(P)", fmt(kappa)],
              ["factor error ‖e‖", fmt(e, 2)],
              ["pinv state error ‖ẑ − z‖", fmt(errPinv)],
              ["  amplification ‖ẑ − z‖ / ‖e‖", e > 0 ? `${fmt(errPinv / e, 2)}×` : "—"],
              ["  worst case 1 / σ_min", `${fmt(1 / sigmaMin, 2)}×`],
              ["transpose state error", fmt(errTrans)],
            ].map(([k, v], i) => (
              <g key={k} transform={`translate(14, ${30 + i * 30})`}>
                <text className="fill-muted-foreground font-mono text-[11px]">{k}</text>
                <text x={262} textAnchor="end" className="fill-foreground font-mono text-[12px] tabular-nums">{v}</text>
              </g>
            ))}
          </g>
        </svg>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">angle between projectors: {deg.toFixed(2)}°</span>
            <Range min={20} max={9000} step={1} value={steps} accent={ACCENT}
              onChange={(ev) => setSteps(Number(ev.target.value))}
              aria-label="Angle between the two projector directions, in hundredths of a degree" className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">factor prediction error ‖e‖: {e.toFixed(2)}</span>
            <Range min={0} max={30} step={1} value={eps} accent={WARN}
              onChange={(ev) => setEps(Number(ev.target.value))}
              aria-label="Magnitude of the factor prediction error" className="w-full" />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => setSteps(stepsFor(p.kappa))}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                active?.key === p.key && "bg-muted/40 text-foreground"
              )}>
              {p.label} · κ {p.kappa}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The error vector pushes factor 1 up and factor 2 down by the same amount. At 90° both
          syntheses land on the same point and the state error equals ‖e‖. Close the angle and the
          pseudoinverse still recovers z exactly when e = 0, but every unit of factor error becomes
          up to 1/σ_min units of state error; transpose synthesis is wrong even with perfect
          factors. {active ? `Preset: ${active.note}; the toy matches its condition number only.` : ""}
          {" "}In two dimensions a κ of 438.52 is an angle of about a quarter of a degree.
        </p>
      </div>
    </figure>
  )
}
