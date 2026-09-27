"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import {
  EPS,
  ETA,
  NET_LR,
  NET_UNITS,
  PLOT_TARGET,
  PLOT_X,
  RATE,
  T,
  THRESH,
  firstCapped,
  simulate,
  type Frame,
  type MethodId,
} from "@/components/articles/functional-gradient-descent/fgd-sim"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Four ways to minimise L(f) = 1/2 ||f - f*||^2 on [0, 1], stepped side by
// side. The top panel is the current function f_t against the target. The
// middle panel is the functional gradient f_t - f* (thin) and, for the grid
// methods, the piecewise-constant g_t the program actually stores and steps
// along (thick); the gap between the two is what the certified bound U covers.
// The bottom panel is the loss of all four on a log scale, with Theorem 3.10's
// guaranteed envelope for the adaptive run while its tolerance holds. Every
// number is computed on load by fgd-sim.ts, deterministically.

const ADAPT = "oklch(0.62 0.16 150)"
const G16 = "oklch(0.72 0.09 235)"
const G128 = "oklch(0.55 0.14 255)"
const NET = "oklch(0.72 0.16 65)"
const BAD = "oklch(0.6 0.19 25)"

const METHODS: { id: MethodId; label: string; color: string }[] = [
  { id: "adaptive", label: "Adaptive FGD", color: ADAPT },
  { id: "grid16", label: "Fixed grid, 16 cells", color: G16 },
  { id: "grid128", label: "Fixed grid, 128 cells", color: G128 },
  { id: "net", label: `ReLU net, ${NET_UNITS} units, Adam`, color: NET },
]

const W = 640
const PAD_L = 54
const PAD_R = 14
const X0 = PAD_L
const X1 = W - PAD_R

// panel A: the function
const A_TOP = 26
const A_BOT = 170
const F_MAX = 1.15
// panel B: the gradient
const B_TOP = 230
const B_BOT = 314
// panel C: the loss
const C_TOP = 354
const C_BOT = 500
const H = 528
const LOG_HI = -1
const LOG_LO = -7

const r2 = (n: number) => Math.round(n * 100) / 100
const sx = (x: number) => r2(X0 + x * (X1 - X0))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const syA = (v: number) => r2(A_TOP + ((F_MAX - clamp(v, -F_MAX, F_MAX)) / (2 * F_MAX)) * (A_BOT - A_TOP))
const stepX = (t: number) => r2(X0 + (t / T) * (X1 - X0))
const syC = (loss: number) => {
  const l = clamp(mlog10(loss), LOG_LO, LOG_HI)
  return r2(C_TOP + ((LOG_HI - l) / (LOG_HI - LOG_LO)) * (C_BOT - C_TOP))
}

function stepPath(edges: number[], values: number[], sy: (v: number) => number): string {
  let d = `M ${sx(edges[0])} ${sy(values[0])}`
  for (let i = 0; i < values.length; i++) {
    d += ` H ${sx(edges[i + 1])}`
    if (i + 1 < values.length) d += ` V ${sy(values[i + 1])}`
  }
  return d
}

function linePath(ys: number[], sy: (v: number) => number): string {
  return ys.map((v, i) => `${i === 0 ? "M" : "L"} ${sx(PLOT_X[i])} ${sy(v)}`).join(" ")
}

function fmtLoss(v: number): string {
  const [m, e] = v.toExponential(2).split("e")
  return `${m}×10${superscript(e)}`
}

function superscript(e: string): string {
  const map: Record<string, string> = { "-": "⁻", "+": "", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" }
  return e
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
}

function fmtScale(v: number): string {
  if (v >= 0.1) return v.toFixed(2)
  if (v >= 0.01) return v.toFixed(3)
  if (v >= 0.001) return v.toFixed(4)
  return v.toExponential(1)
}

export function AdaptiveFit({ initialMethod = "adaptive", initialStep = 6 }: { initialMethod?: MethodId; initialStep?: number }) {
  const runs = simulate()
  const [method, setMethod] = useState<MethodId>(initialMethod)
  const [t, setT] = useState(Math.min(T, Math.max(0, Math.round(initialStep))))

  const meta = METHODS.find((m) => m.id === method)!
  const frame: Frame = runs[method][t]
  const isGrid = method !== "net"
  const capAt = firstCapped(runs.adaptive)
  const l0 = runs.adaptive[0].loss

  // panel B autoscale: the gradient shrinks by orders of magnitude, so the
  // panel rescales to the current step and prints its scale.
  const resid = frame.samples.map((v, i) => v - PLOT_TARGET[i])
  let bMax = 0
  for (const v of resid) bMax = Math.max(bMax, Math.abs(v))
  for (const v of frame.gvalues) bMax = Math.max(bMax, Math.abs(v))
  bMax = bMax > 0 ? bMax * 1.1 : 1
  const syB = (v: number) => r2(B_TOP + ((bMax - clamp(v, -bMax, bMax)) / (2 * bMax)) * (B_BOT - B_TOP))

  const fPath = isGrid ? stepPath(frame.edges, frame.values, syA) : linePath(frame.samples, syA)
  const targetPath = linePath(PLOT_TARGET, syA)
  const residPath = linePath(resid, syB)
  const gPath = isGrid ? stepPath(frame.edges, frame.gvalues, syB) : ""
  const ticks = isGrid ? frame.edges.slice(1, -1) : frame.edges

  const envelope: string[] = []
  for (let s = 0; s < capAt; s++) {
    let v = l0
    for (let k = 0; k < s; k++) v *= RATE
    envelope.push(`${s === 0 ? "M" : "L"} ${stepX(s)} ${syC(v)}`)
  }

  const ratioOk = frame.ratio < THRESH
  const summary = `${meta.label} at step ${t}: loss ${frame.loss.toExponential(2)}${isGrid ? `, ${frame.cells} cells` : ""}.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">fitting f* on [0, 1] · gradient descent in function space</span>
        <span className="font-mono text-[11px] text-muted-foreground/60">runs in your browser</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="method">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={method === m.id}
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                method === m.id
                  ? "border-foreground/30 bg-muted/40 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              )}
            >
              <span className="inline-block size-2 rounded-full" style={{ background: m.color }} />
              {m.label}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
          {/* ---- panel A: f_t against f* ---- */}
          <text x={X0} y={A_TOP - 10} className="fill-muted-foreground font-mono" fontSize={13}>
            f_t and the target f*
          </text>
          <line x1={X0} y1={syA(0)} x2={X1} y2={syA(0)} stroke="currentColor" strokeOpacity={0.12} />
          <rect x={X0} y={A_TOP} width={X1 - X0} height={A_BOT - A_TOP} fill="none" stroke="currentColor" strokeOpacity={0.12} />
          <path d={targetPath} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.4} strokeDasharray="4 3" />
          <path d={fPath} fill="none" stroke={meta.color} strokeWidth={2} strokeLinejoin="round" />
          {/* the representation: cell boundaries, or the network's kinks */}
          {ticks.map((x, i) => (
            <line key={i} x1={sx(x)} y1={A_BOT} x2={sx(x)} y2={A_BOT + 8} stroke={meta.color} strokeOpacity={isGrid ? 0.55 : 0.9} strokeWidth={isGrid ? 0.7 : 1.6} />
          ))}
          <text x={X1} y={A_BOT + 20} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>
            {isGrid ? `${frame.cells} cells: ticks mark their edges` : `${frame.edges.length} kinks inside [0, 1]: ticks mark them`}
          </text>
          {[-1, 0, 1].map((v) => (
            <text key={v} x={X0 - 6} y={syA(v) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={11}>
              {v}
            </text>
          ))}

          {/* ---- panel B: the gradient and what is stored of it ---- */}
          <text x={X0} y={B_TOP - 10} className="fill-muted-foreground font-mono" fontSize={13}>
            {isGrid ? "gradient f_t − f* (thin) and the stored g_t (thick)" : "gradient f_t − f*: the net never stores it"}
          </text>
          <rect x={X0} y={B_TOP} width={X1 - X0} height={B_BOT - B_TOP} fill="none" stroke="currentColor" strokeOpacity={0.12} />
          <line x1={X0} y1={syB(0)} x2={X1} y2={syB(0)} stroke="currentColor" strokeOpacity={0.15} />
          {isGrid && <path d={gPath} fill="none" stroke={meta.color} strokeOpacity={0.85} strokeWidth={2.2} strokeLinejoin="round" />}
          <path d={residPath} fill="none" stroke="currentColor" strokeOpacity={0.75} strokeWidth={0.9} />
          <text x={X0 - 6} y={B_TOP + 8} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={11}>
            +{fmtScale(bMax)}
          </text>
          <text x={X0 - 6} y={B_BOT} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={11}>
            −{fmtScale(bMax)}
          </text>

          {/* ---- panel C: loss of all four, log scale ---- */}
          <text x={X0} y={C_TOP - 10} className="fill-muted-foreground font-mono" fontSize={13}>
            loss L(f_t), log scale, all four methods
          </text>
          {[-1, -2, -3, -4, -5, -6, -7].map((e) => {
            const y = r2(C_TOP + ((LOG_HI - e) / (LOG_HI - LOG_LO)) * (C_BOT - C_TOP))
            return (
              <g key={e}>
                <line x1={X0} y1={y} x2={X1} y2={y} stroke="currentColor" strokeOpacity={0.08} />
                <text x={X0 - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={11}>
                  1e{e}
                </text>
              </g>
            )
          })}
          {[0, 10, 20, 30, 40].map((s) => (
            <text key={s} x={stepX(s)} y={C_BOT + 14} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={11}>
              {s}
            </text>
          ))}
          <text x={X1} y={C_BOT + 26} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={11}>
            step t
          </text>

          {/* where the adaptive run hits the finest allowed cell */}
          <line x1={stepX(capAt)} y1={C_TOP} x2={stepX(capAt)} y2={C_BOT} stroke={ADAPT} strokeOpacity={0.35} strokeDasharray="1 3" />
          <text x={stepX(capAt) + 4} y={C_BOT - 6} className="font-mono" fontSize={11} fill={ADAPT}>
            cell-width floor reached
          </text>

          {METHODS.map((m) => {
            const d = runs[m.id].map((f, s) => `${s === 0 ? "M" : "L"} ${stepX(s)} ${syC(f.loss)}`).join(" ")
            const on = m.id === method
            return <path key={m.id} d={d} fill="none" stroke={m.color} strokeWidth={on ? 2.4 : 1.3} strokeOpacity={on ? 1 : 0.7} />
          })}
          {/* Theorem 3.10 (iii) envelope, while the adaptive tolerance holds */}
          <path d={envelope.join(" ")} fill="none" stroke={ADAPT} strokeWidth={1.6} strokeDasharray="5 4" />
          <line x1={X1 - 222} y1={C_TOP + 12} x2={X1 - 196} y2={C_TOP + 12} stroke={ADAPT} strokeWidth={1.6} strokeDasharray="5 4" />
          <text x={X1 - 190} y={C_TOP + 16} className="font-mono" fontSize={11} fill={ADAPT}>
            Theorem 3.10 bound, adaptive
          </text>
          <line x1={stepX(t)} y1={C_TOP} x2={stepX(t)} y2={C_BOT} stroke="currentColor" strokeOpacity={0.35} />
          {METHODS.map((m) => (
            <circle key={m.id} cx={stepX(t)} cy={syC(runs[m.id][t].loss)} r={m.id === method ? 4 : 2.5} fill={m.color} />
          ))}
        </svg>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>step t</span>
            <span className="tabular-nums text-foreground">{t}</span>
          </div>
          <Range min={0} max={T} step={1} value={t} onChange={(e) => setT(+e.target.value)} className="w-full" aria-label="step" accent={meta.color} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono sm:grid-cols-5">
          <Tile label="loss L(f_t)" color={meta.color}>
            {fmtLoss(frame.loss)}
          </Tile>
          <Tile label="Theorem 3.10 bound" color={method === "adaptive" && t < capAt ? ADAPT : undefined}>
            {method !== "adaptive" ? "none" : t < capAt ? fmtLoss(l0 * rateTo(t)) : "void"}
          </Tile>
          <Tile label={isGrid ? "cells in g_t" : "hidden units"}>{frame.cells.toLocaleString("en-US")}</Tile>
          <Tile label="cells split this step">{method === "adaptive" ? frame.splits : "never"}</Tile>
          <Tile label="certified U / ‖g_t‖" color={isGrid ? (ratioOk ? ADAPT : BAD) : undefined}>
            {isGrid ? (frame.ratio >= 100 ? Math.round(frame.ratio).toLocaleString("en-US") : frame.ratio.toFixed(3)) : "n/a"}
          </Tile>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The loss is <span className="font-mono">½‖f − f*‖²</span>, so the functional gradient is the residual{" "}
          <span className="font-mono">f_t − f*</span> itself. Each grid method stores a piecewise-constant{" "}
          <span className="font-mono">g_t</span>, read at cell midpoints, and steps{" "}
          <span className="font-mono">f ← f − {ETA}·g_t</span>. The adaptive run splits its worst cell until a
          certified bound on the storage error is under a third of <span className="font-mono">‖g_t‖</span>{" "}
          (the paper&rsquo;s test with ε = {EPS}); the fixed grids never split, so that ratio climbs past the
          threshold and their loss stalls. The network is trained on the same loss with Adam at {NET_LR}.
          The dashed line is the rate Theorem 3.10 guarantees, <span className="font-mono">{RATE}</span>{" "}
          per step, far looser than what the run achieves. It stops applying once cells reach their minimum
          width of 1/1,024 and the test can no longer pass; from there the adaptive run is a fixed grid too.
        </p>
      </div>
    </figure>
  )
}

function rateTo(s: number): number {
  let v = 1
  for (let k = 0; k < s; k++) v *= RATE
  return v
}

function Tile({ label, color, children }: { label: string; color?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-base tabular-nums", !color && "text-foreground")} style={color ? { color } : undefined}>
        {children}
      </div>
    </div>
  )
}
