"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { macos, mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One SwiGLU neuron, drawn exactly as the neuron-lens design notes define it.
// Left: the activation act = silu(g) * u as a function of the gate pre-activation g = a . x and the up
// projection u = b . x. Right: the two read directions of the two poles, a_hat + b_hat and a_hat - b_hat, for a
// chosen cosine between the unit gate row a_hat and the unit up row b_hat (the notes report a median cosine of
// 0.00 at every layer but L2 in Qwen3-8B, so the poles are read along nearly perpendicular directions).
// No model weights are involved: this is the formula, evaluated.

const POS = "oklch(0.62 0.16 55)"
const NEG = "oklch(0.58 0.16 290)"
const RANGE = 4
const N = 25

const silu = (g: number) => g / (1 + mexp(-g))
const act = (g: number, u: number) => silu(g) * u
const ACT_MAX = 4 * 4 // |act| tops out near silu(4) * 4

function cellFill(a: number) {
  const t = Math.min(1, Math.abs(a) / (ACT_MAX * 0.55))
  return a >= 0 ? `oklch(0.62 0.16 55 / ${(0.06 + 0.86 * t).toFixed(3)})` : `oklch(0.58 0.16 290 / ${(0.06 + 0.86 * t).toFixed(3)})`
}

const PRESETS = [
  { label: "gate open, up positive", g: 2.5, u: 2.5 },
  { label: "gate open, up negative", g: 2.5, u: -2.5 },
  { label: "gate closed", g: -2.5, u: 2.5 },
  { label: "gate at zero", g: 0, u: 3 },
] as const

export function GatePlane() {
  const [g, setG] = useState(2.5)
  const [u, setU] = useState(2.5)
  const [cos, setCos] = useState(0)

  const a = act(g, u)
  const pole = a > 0.05 ? "+" : a < -0.05 ? "−" : "neither"

  const X0 = 44
  const Y0 = 22
  const S = 288
  const cell = S / N
  const px = X0 + ((g + RANGE) / (2 * RANGE)) * S
  const py = Y0 + ((RANGE - u) / (2 * RANGE)) * S

  // read directions for the chosen cosine: a_hat = (1, 0), b_hat = (c, sqrt(1 - c^2))
  const s = Math.sqrt(1 - cos * cos)
  const plus = { x: 1 + cos, y: s }
  const minus = { x: 1 - cos, y: -s }
  const norm = (v: { x: number; y: number }) => Math.sqrt(v.x * v.x + v.y * v.y)
  const cosPoles = (plus.x * minus.x + plus.y * minus.y) / (norm(plus) * norm(minus))
  const CX = 520
  const CY = 150
  const R = 92
  const arrow = (v: { x: number; y: number }, color: string, label: string, dy = 0) => {
    const n = norm(v)
    const ex = CX + (v.x / n) * R
    const ey = CY - (v.y / n) * R
    return (
      <g>
        <line x1={CX} y1={CY} x2={ex} y2={ey} stroke={color} strokeWidth={3} />
        <circle cx={ex} cy={ey} r={4.5} fill={color} />
        <text x={ex + (ex >= CX ? 8 : -8)} y={ey + dy} textAnchor={ex >= CX ? "start" : "end"} fontSize={10} fontFamily="ui-monospace, monospace" fill={color}>
          {label}
        </text>
      </g>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one SwiGLU neuron · the formula, evaluated · reasoned</span>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setG(p.g)
                setU(p.u)
              }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                g === p.g && u === p.u ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 720 340" role="img" className="h-auto w-full">
          <title>
            Left: a heat map of the neuron activation silu(g) times u over the gate pre-activation g and the up projection u,
            orange where positive and violet where negative, with the chosen point marked. Right: the two read directions of
            the two poles, the unit gate row plus and minus the unit up row, drawn for the chosen angle between those rows.
          </title>
          {Array.from({ length: N * N }, (_, k) => {
            const i = k % N
            const j = Math.floor(k / N)
            const gv = -RANGE + ((i + 0.5) / N) * 2 * RANGE
            const uv = RANGE - ((j + 0.5) / N) * 2 * RANGE
            return <rect key={k} x={X0 + i * cell} y={Y0 + j * cell} width={cell + 0.4} height={cell + 0.4} fill={cellFill(act(gv, uv))} />
          })}
          <rect x={X0} y={Y0} width={S} height={S} fill="none" stroke="currentColor" strokeOpacity={0.25} />
          <line x1={X0 + S / 2} y1={Y0} x2={X0 + S / 2} y2={Y0 + S} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
          <line x1={X0} y1={Y0 + S / 2} x2={X0 + S} y2={Y0 + S / 2} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
          <text x={X0 + S / 2} y={Y0 + S + 16} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.7}>
            gate pre-activation g = a · x
          </text>
          <text x={14} y={Y0 + S / 2} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.7} transform={`rotate(-90 14 ${Y0 + S / 2})`}>
            up projection u = b · x
          </text>
          <text x={X0 + S - 6} y={Y0 + 14} textAnchor="end" fontSize={10} fontFamily="ui-monospace, monospace" fill={POS}>
            + pole
          </text>
          <text x={X0 + S - 6} y={Y0 + S - 8} textAnchor="end" fontSize={10} fontFamily="ui-monospace, monospace" fill={NEG}>
            − pole
          </text>
          <text x={X0 + 6} y={Y0 + 14} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            gate closed: ~0
          </text>
          <circle cx={px} cy={py} r={6} fill="none" stroke="currentColor" strokeWidth={2} />
          <circle cx={px} cy={py} r={2} fill="currentColor" />

          <text x={CX} y={26} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.8}>
            the two read directions
          </text>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeOpacity={0.12} />
          <line x1={CX} y1={CY} x2={CX + R} y2={CY} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 3" />
          <text x={CX + R + 6} y={CY + 14} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            a_hat
          </text>
          {arrow(plus, POS, "a_hat + b_hat", -6)}
          {arrow(minus, NEG, "a_hat − b_hat", 14)}
          <text x={CX} y={CY + R + 34} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.75}>
            cos(a_hat, b_hat) = {cos.toFixed(2)} · angle between the poles’ reads {((macos(Math.max(-1, Math.min(1, cosPoles))) * 180) / Math.PI).toFixed(0)}°
          </text>
        </svg>

        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="block font-mono text-[11px] text-muted-foreground">
            gate g = {g.toFixed(2)}
            <Range min={-RANGE} max={RANGE} step={0.05} value={g} onChange={(e) => setG(Number(e.target.value))} accent={POS} aria-label="gate pre-activation" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            up u = {u.toFixed(2)}
            <Range min={-RANGE} max={RANGE} step={0.05} value={u} onChange={(e) => setU(Number(e.target.value))} accent={NEG} aria-label="up projection" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            cos(a_hat, b_hat) = {cos.toFixed(2)}
            <Range min={-0.6} max={0.6} step={0.02} value={cos} onChange={(e) => setCos(Number(e.target.value))} aria-label="cosine between the unit gate row and the unit up row" />
          </label>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          act = silu({g.toFixed(2)}) × {u.toFixed(2)} = <span className="font-mono text-foreground">{a.toFixed(2)}</span>.{" "}
          {pole === "+" && "The + pole fires: the neuron adds +act × W_down[:, n] to the residual stream."}
          {pole === "−" && "The − pole fires: the activation is negative, so the neuron adds −|act| × W_down[:, n]."}
          {pole === "neither" && "Neither pole fires: the gate is closed or the up projection is near zero, so the write is near zero."}
        </p>
      </div>
    </figure>
  )
}
