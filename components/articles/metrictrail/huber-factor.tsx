"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"

// MetricTrail's metric-depth factor, drawn from the code that ships it.
//
// vipe/metrictrail/dpvo/ba.py, _metric_unary_terms():
//   r      = log(d_prior) - log(d)          (d = patch inverse depth)
//   robust = min(1, huber_delta / |r|)
//   weight = prior_lambda * confidence * robust
//   C     += weight / d^2 ; rhs += weight * r / d
// i.e. one iteratively reweighted Huber term per patch, added to the depth
// diagonal of DPVO's Schur system. Shipped constants (configs/slam/metrictrail_local.yaml):
//   METRIC_DEPTH_PRIOR_WEIGHT 1.0, METRIC_DEPTH_PRIOR_HUBER 0.3, METRIC_DEPTH_PRIOR_WARMUP 12,
//   METRIC_DEPTH_MIN 0.2, METRIC_DEPTH_MAX 500.0
// Everything below is that formula evaluated, nothing fitted.

const R_MAX = 1.5
const W = 640
const H = 250
const PADL = 44
const PADR = 14
const PADT = 14
const PADB = 34
const Y_MAX = 1.2

const px = (r: number) => PADL + ((r + R_MAX) / (2 * R_MAX)) * (W - PADL - PADR)
const py = (c: number) => PADT + (1 - Math.min(c, Y_MAX) / Y_MAX) * (H - PADT - PADB)

const l2 = (r: number) => 0.5 * r * r
const huber = (r: number, d: number) => (Math.abs(r) <= d ? 0.5 * r * r : d * (Math.abs(r) - 0.5 * d))
const irls = (r: number, d: number) => (Math.abs(r) <= d ? 1 : d / Math.abs(r))

function path(f: (r: number) => number) {
  const pts: string[] = []
  for (let i = 0; i <= 120; i++) {
    const r = -R_MAX + (2 * R_MAX * i) / 120
    pts.push(`${i ? "L" : "M"}${px(r).toFixed(1)},${py(f(r)).toFixed(1)}`)
  }
  return pts.join(" ")
}

const PRIOR = "oklch(0.66 0.15 150)"
const PLAIN = "oklch(0.62 0.04 260)"
const HOT = "oklch(0.65 0.18 35)"

export function HuberFactor() {
  const [r100, setR] = useState(55)
  const [d100, setD] = useState(30)
  const [frame, setFrame] = useState(20)
  const r = r100 / 100
  const d = d100 / 100
  const on = frame > 12
  const w = on ? irls(r, d) : 0
  const ratio = mexp(Math.abs(r))
  const pull = w * r // the step the factor alone asks for, in log inverse depth

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one patch, one metric-depth factor · the formula in <code>dpvo/ba.py</code>, evaluated
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1.5fr_1fr]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Cost of the metric-depth factor against the log disagreement between the patch depth and the single-image prediction. A grey parabola is plain least squares; the green curve is Huber with threshold ${d.toFixed(2)}, quadratic inside the threshold and linear outside it. The marker sits at a disagreement of ${r.toFixed(2)}, a depth ratio of ${ratio.toFixed(2)}.`}
        >
          {[0, 0.4, 0.8, 1.2].map((c) => (
            <g key={c}>
              <line x1={PADL} x2={W - PADR} y1={py(c)} y2={py(c)} stroke="var(--border)" strokeWidth={0.6} />
              <text x={PADL - 6} y={py(c) + 3} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">
                {c.toFixed(1)}
              </text>
            </g>
          ))}
          {[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((x) => (
            <text key={x} x={px(x)} y={H - PADB + 14} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
              {x}
            </text>
          ))}
          <text x={(PADL + W - PADR) / 2} y={H - 4} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
            r = log(prior inverse depth) - log(patch inverse depth)
          </text>
          <rect x={px(-d)} y={PADT} width={px(d) - px(-d)} height={H - PADT - PADB} fill={PRIOR} fillOpacity={0.08} />
          <path d={path(l2)} fill="none" stroke={PLAIN} strokeWidth={1.4} strokeDasharray="4 3" />
          <path d={path((x) => huber(x, d))} fill="none" stroke={on ? PRIOR : PLAIN} strokeWidth={2.4} />
          <line x1={px(r)} x2={px(r)} y1={PADT} y2={H - PADB} stroke={HOT} strokeWidth={1} strokeDasharray="2 2" />
          <circle cx={px(r)} cy={py(huber(r, d))} r={5} fill={on ? HOT : "var(--muted)"} stroke="var(--foreground)" strokeWidth={0.8} />
          <text x={PADL + 6} y={PADT + 12} fontSize={10} className="fill-muted-foreground font-mono">
            dashed: least squares · solid: Huber, delta = {d.toFixed(2)}
          </text>
        </svg>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">disagreement r = {r.toFixed(2)}</span>
            <Range min={-150} max={150} value={r100} onChange={(e) => setR(Number(e.target.value))} accent={HOT} />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">Huber delta = {d.toFixed(2)} (shipped: 0.30)</span>
            <Range min={5} max={150} value={d100} onChange={(e) => setD(Number(e.target.value))} accent={PRIOR} />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">accepted graph frame = {frame} (factor off for the first 12)</span>
            <Range min={1} max={40} value={frame} onChange={(e) => setFrame(Number(e.target.value))} />
          </label>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">depth ratio</dt>
            <dd>{ratio.toFixed(2)}x {r > 0 ? "(prior says nearer)" : r < 0 ? "(prior says farther)" : ""}</dd>
            <dt className="text-muted-foreground">IRLS weight</dt>
            <dd>{on ? w.toFixed(3) : "0 (warm-up)"}</dd>
            <dt className="text-muted-foreground">pull, weight x r</dt>
            <dd>{on ? pull.toFixed(3) : "0"}{on && Math.abs(r) > d ? " (capped at delta)" : ""}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Inside the band the prior pulls in proportion to the disagreement. Past it the pull stays at delta however wrong the
            prediction is, so a patch the prior misjudges by 3x pushes no harder than one it misjudges by 1.35x, and the reprojection
            terms from the other frames win.
          </p>
        </div>
      </div>
    </figure>
  )
}
