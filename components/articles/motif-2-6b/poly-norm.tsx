"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// PolyNorm, Motif's activation. Instead of a fixed nonlinearity (GELU, SwiGLU),
// the feed-forward network passes its input through a normalized polynomial of
// degree 3: roughly  PolyNorm(x) = a₁·n(x) + a₂·n(x²) + a₃·n(x³), where n(·) is a
// per-power normalization that keeps the three terms on comparable scales. The
// weights aᵢ are learned, so the network can shape its own activation and pick up
// higher-order interactions a single fixed curve can't. Drag the three weights
// and watch the composed activation change; GELU is drawn faintly for reference.

const ACCENT = "oklch(0.58 0.16 262)" // indigo
const GHOST = "oklch(0.7 0.04 40)"

const W = 600
const H = 300
const padL = 40
const padR = 16
const padT = 16
const padB = 34
const plotW = W - padL - padR
const plotH = H - padT - padB
const XR = 3

const r2 = (n: number) => Math.round(n * 100) / 100
const sx = (x: number) => r2(padL + ((x + XR) / (2 * XR)) * plotW)

const gelu = (x: number) =>
  0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x)))

export function PolyNorm() {
  const [a1, setA1] = useState(1)
  const [a2, setA2] = useState(0.3)
  const [a3, setA3] = useState(0.1)

  const f = (x: number) => a1 * x + a2 * x * x + a3 * x * x * x

  const xs = Array.from({ length: 121 }, (_, i) => -XR + (i / 120) * 2 * XR)
  const yR = Math.max(3, Math.ceil(Math.max(...xs.map((x) => Math.abs(f(x))))))
  const sy = (y: number) => r2(padT + (1 - (y + yR) / (2 * yR)) * plotH)

  const path = (fn: (x: number) => number) =>
    xs.map((x) => `${sx(x)},${sy(fn(x))}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        PolyNorm · a learned degree-3 activation, not a fixed curve
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 rounded-md border border-dashed px-3 py-1.5 text-center font-mono text-[11px] text-muted-foreground">
          PolyNorm(x) = a₁·n(x) + a₂·n(x²) + a₃·n(x³)
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`The PolyNorm activation for weights a1 ${a1.toFixed(2)}, a2 ${a2.toFixed(2)}, a3 ${a3.toFixed(2)}, drawn against a faint GELU reference curve.`}
        >
          {/* gridlines */}
          {[-yR, -yR / 2, 0, yR / 2, yR].map((gy, i) => (
            <line key={i} x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity={gy === 0 ? 0.22 : 0.07} />
          ))}
          {[-3, -2, -1, 0, 1, 2, 3].map((gx) => (
            <line key={gx} x1={sx(gx)} y1={padT} x2={sx(gx)} y2={H - padB} stroke="currentColor" strokeOpacity={gx === 0 ? 0.22 : 0.05} />
          ))}
          {[-3, 0, 3].map((gx) => (
            <text key={gx} x={sx(gx)} y={H - padB + 14} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">{gx}</text>
          ))}
          <text x={sx(0) + 4} y={sy(yR) + 8} className="fill-muted-foreground/50 font-mono" fontSize="9">{yR}</text>

          {/* component terms, faint */}
          <polyline points={path((x) => a1 * x)} fill="none" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
          <polyline points={path((x) => a2 * x * x)} fill="none" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
          <polyline points={path((x) => a3 * x * x * x)} fill="none" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />

          {/* GELU reference */}
          <polyline points={path(gelu)} fill="none" stroke={GHOST} strokeWidth="1.5" strokeOpacity="0.7" />
          <text x={sx(2.1)} y={sy(gelu(2.1)) - 5} className="font-mono" fontSize="9" fill={GHOST}>GELU</text>

          {/* PolyNorm curve */}
          <polyline points={path(f)} fill="none" stroke={ACCENT} strokeWidth="2.5" />
        </svg>

        {/* controls */}
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {([["a₁ · x", a1, setA1, -1, 2] as const, ["a₂ · x²", a2, setA2, -1, 1] as const, ["a₃ · x³", a3, setA3, -0.5, 0.5] as const]).map(
            ([label, val, set, lo, hi]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{label}</span>
                  <span className="tabular-nums text-foreground">{val.toFixed(2)}</span>
                </div>
                <Range min={lo} max={hi} step={0.05} value={val} onChange={(e) => set(+e.target.value)} className="w-full" aria-label={label} accent={ACCENT} />
              </div>
            ),
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A fixed activation like GELU is one shape the whole network must live with. PolyNorm hands
          the shape to the model: three learned weights over normalized powers of the input let each
          layer bend its own curve — near-linear, saturating, or S-shaped — capturing higher-order
          token interactions. The per-power normalization is what keeps x³ from blowing up the
          scale, which is the trick that makes a cubic activation trainable at all.
        </p>
      </div>
    </figure>
  )
}
