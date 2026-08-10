"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog, mlog10, mpow } from "@/lib/dmath"

// HeteroP's actual payoff: pick a model scale (width/depth, tied to the
// paper's real 56x-activated-parameter sweep, 20M -> 1.12B), and read the
// optimal learning rate off a schematic loss-vs-LR valley for two
// parameterizations. Under HeteroP the valley's floor sits at the same LR
// no matter the scale; under standard parameterization (SP) it drifts, and
// at large scale + high LR training comes apart. The VALLEY SHAPE is
// illustrative; the two facts it encodes are the paper's own (Fig. 7):
// HeteroP's optimum stays ~1e-3 across the full range, SP's drifts
// 1e-4 -> 6e-4, and several high-LR SP runs diverge.

const HETERO = "oklch(0.60 0.15 265)"
const SP = "oklch(0.62 0.16 30)"

const W = 700
const H = 300
const padL = 46
const padR = 16
const padT = 16
const padB = 40

const r2 = (n: number) => Math.round(n * 100) / 100

const LOG_MIN = -5 // 1e-5
const LOG_MAX = -2 // 1e-2

// activated params (millions) at slider position t in [0,1]: 20 * 56^t
const paramsAt = (t: number) => 20 * mpow(56, t)
const layersAt = (t: number) => 4 * mpow(8, t)

const HETERO_LOG_OPT = -3 // 1e-3, fixed
const SP_LOG_OPT_0 = -4 // 1e-4 at t=0
const SP_LOG_OPT_1 = mlog10(6e-4) // ~-3.222 at t=1
const spLogOpt = (t: number) => SP_LOG_OPT_0 + t * (SP_LOG_OPT_1 - SP_LOG_OPT_0)

function lossAt(logLR: number, logOpt: number, k: number, rightK: number) {
  const d = logLR - logOpt
  const k2 = d >= 0 ? rightK : k
  return Math.min(1, k2 * d * d)
}

const PRESETS = [
  { label: "proxy", t: 0 },
  { label: "mid", t: mlog(8) / mlog(56) },
  { label: "largest", t: 1 },
]

export function HeteroPDrift() {
  const [t, setT] = useState(0)

  const sx = (logLR: number) => r2(padL + ((logLR - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - v) * (H - padT - padB))

  const heteroOpt = HETERO_LOG_OPT
  const spOpt = spLogOpt(t)
  const spRightK = 2.6 + 9 * t // steepens sharply with scale -> divergence at large t

  const STEPS = 90
  const heteroPts: string[] = []
  const spPts: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const logLR = LOG_MIN + (i / STEPS) * (LOG_MAX - LOG_MIN)
    heteroPts.push(`${sx(logLR)},${sy(0.06 + lossAt(logLR, heteroOpt, 2.6, 2.6))}`)
    spPts.push(`${sx(logLR)},${sy(0.06 + lossAt(logLR, spOpt, 2.6, spRightK))}`)
  }

  const diverging = t > 0.45
  const params = paramsAt(t)
  const layers = layersAt(t)
  const paramsLabel = params >= 1000 ? `${(params / 1000).toFixed(2)}B` : `${Math.round(params)}M`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">heterop vs. standard parameterization · optimal lr</span>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setT(p.t)}
              className="cursor-pointer rounded-full border border-transparent px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At ${paramsLabel} activated parameters, HeteroP's optimal learning rate stays near 1 times 10 to the minus 3, while standard parameterization's optimum has drifted to about ${mpow(10, spOpt).toExponential(1)} and is starting to diverge at high learning rates.`}
        >
          {/* gridlines + LR ticks */}
          {[-5, -4, -3, -2].map((lg) => (
            <g key={lg}>
              <line x1={sx(lg)} y1={padT} x2={sx(lg)} y2={H - padB} stroke="currentColor" strokeOpacity={0.08} />
              <text x={sx(lg)} y={H - padB + 14} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>
                1e{lg}
              </text>
            </g>
          ))}
          <text x={(padL + W - padR) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize={9}>
            base learning rate (log scale)
          </text>
          <text x={10} y={padT + 8} className="fill-muted-foreground/50 font-mono" fontSize={9}>
            worse
          </text>
          <text x={10} y={H - padB - 4} className="fill-muted-foreground/50 font-mono" fontSize={9}>
            better
          </text>

          {/* curves */}
          <polyline points={spPts.join(" ")} fill="none" stroke={SP} strokeWidth={2} strokeDasharray="5 3" />
          <polyline points={heteroPts.join(" ")} fill="none" stroke={HETERO} strokeWidth={2} />

          {/* optima markers */}
          <circle cx={sx(heteroOpt)} cy={sy(0.06)} r={4} fill={HETERO} />
          <circle cx={sx(spOpt)} cy={sy(0.06)} r={4} fill={SP} />

          {diverging ? (
            <text x={W - padR} y={padT + 12} textAnchor="end" fontSize={10} fontWeight={600} fill={SP}>
              SP: high-LR runs diverging
            </text>
          ) : null}

          {/* legend */}
          <g>
            <line x1={W - 210} y1={padT + 4} x2={W - 190} y2={padT + 4} stroke={HETERO} strokeWidth={2} />
            <text x={W - 184} y={padT + 7} fontSize={10} className="fill-foreground font-mono">HeteroP</text>
            <line x1={W - 210} y1={padT + 20} x2={W - 190} y2={padT + 20} stroke={SP} strokeWidth={2} strokeDasharray="5 3" />
            <text x={W - 184} y={padT + 23} fontSize={10} className="fill-foreground font-mono">SP (single global ratio)</text>
          </g>
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">model scale</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{paramsLabel} act.</div>
            <div className="text-[10px] text-muted-foreground">{layers.toFixed(0)} layers</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">HeteroP optimal LR</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: HETERO }}>~1e-3</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">SP optimal LR</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: SP }}>
              ~{mpow(10, spOpt).toExponential(1)}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>model scale (proxy → largest)</span>
            <span className="tabular-nums text-foreground">×{(paramsAt(t) / paramsAt(0)).toFixed(1)}</span>
          </div>
          <Range min={0} max={1} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full" aria-label="model scale" accent={HETERO} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The valley shape here is schematic — the paper plots training loss directly, not this cartoon — but the
          two numbers it encodes are real: HeteroP&rsquo;s per-tensor ratios keep the optimal base LR at about{" "}
          <span style={{ color: HETERO }}>1e-3</span>{" "}across a 56× activated-parameter range (20M → 1.12B) and an 8×
          depth range (4 → 32 layers). A single global ratio (SP) lets the optimum drift{" "}
          <span style={{ color: SP }}>1e-4 → 6e-4</span>, and several of its high-LR runs at large scale diverge
          outright. Without that stability, points on a scaling-law fit aren&rsquo;t comparable — each is tuned
          differently by construction.
        </p>
      </div>
    </figure>
  )
}
