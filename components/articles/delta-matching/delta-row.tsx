"use client"

import { useState } from "react"

import { DATA } from "@/components/articles/delta-matching/data"
import { cn } from "@/lib/utils"

// One attention row, eight keys, through our simulated FP8 backward (public/articles/delta-matching/code/worked_row.py).
// Every number comes from data.ts. Pick which delta the softmax gradient subtracts and the row of dS re-centres:
// stale (the saved-output shortcut), consistent dO (dequantized gradient in the shortcut), matched (the paper's rule).

const W = DATA.worked
type Method = "stale" | "consistent" | "matched"

const METHODS: { k: Method; label: string; formula: string; color: string }[] = [
  { k: "stale", label: "stale", formula: "δ = ⟨dO, O⟩ (BF16 dO and the saved BF16 output)", color: "oklch(0.62 0.19 30)" },
  { k: "consistent", label: "consistent dO", formula: "δ = ⟨dÔ, O⟩ (FP8-rounded dO in the same shortcut)", color: "oklch(0.68 0.14 85)" },
  { k: "matched", label: "matched (Delta-Matching)", formula: "δ = Σⱼ Pⱼ · dP̂ⱼ (from the backward&apos;s own P and dP̂)", color: "oklch(0.58 0.15 160)" },
]

const BAR_W = 34
const GAP = 12
const X0 = 28
const WIDTH = X0 + W.keys * (BAR_W + GAP)

function fmt(x: number): string {
  const a = Math.abs(x)
  if (a === 0) return "0"
  if (a < 1e-3) return x.toExponential(1)
  return x.toFixed(4)
}

export function DeltaRow() {
  const [method, setMethod] = useState<Method>("stale")
  const m = METHODS.find((x) => x.k === method) ?? METHODS[0]
  const dS = W.dS[method]
  let pos = 0
  let neg = 0
  for (const v of dS) {
    if (v > 0) pos += v
    else neg += v
  }
  const sum = pos + neg
  const abs = pos - neg
  const frac = (sum / abs) * 100

  const pTop = 0.6
  const sTop = 0.32
  const pH = 70
  const sH = 70

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one attention row · 8 keys · our simulation of the FP8 backward</span>
        <span className="font-mono text-[10px] text-muted-foreground">last query of a toy head, T = 8, D = 4</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {METHODS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setMethod(x.k)}
              aria-pressed={method === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                method === x.k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {m.formula} = <span className="text-foreground tabular-nums">{W.delta[method].toFixed(4)}</span>
        </p>

        <svg viewBox={`0 0 ${WIDTH} ${pH + sH * 2 + 70}`} className="w-full" role="img" aria-label="Probabilities before and after FP8 rounding, and the softmax gradient dS for the chosen delta, with its row sum">
          <text x={0} y={10} className="fill-muted-foreground" fontSize={9}>P (FP32) and P̂ (E4M3)</text>
          {W.P.map((p, j) => {
            const x = X0 + j * (BAR_W + GAP)
            const h1 = (p / pTop) * pH
            const h2 = (W.Ph[j] / pTop) * pH
            return (
              <g key={j}>
                <rect x={x} y={16 + pH - h1} width={BAR_W / 2 - 1} height={h1} className="fill-foreground/35" />
                <rect x={x + BAR_W / 2} y={16 + pH - h2} width={BAR_W / 2 - 1} height={h2} fill={m.color} opacity={0.55} />
                <text x={x + BAR_W / 2} y={16 + pH + 11} textAnchor="middle" className="fill-muted-foreground" fontSize={8}>
                  k{j}
                </text>
              </g>
            )
          })}
          <text x={0} y={16 + pH + 28} className="fill-muted-foreground" fontSize={9}>dS = P · (dP̂ − δ)   (up: positive, down: negative)</text>
          {dS.map((v, j) => {
            const x = X0 + j * (BAR_W + GAP)
            const mid = 16 + pH + 36 + sH
            const h = (Math.abs(v) / sTop) * sH
            return (
              <rect key={j} x={x} y={v >= 0 ? mid - h : mid} width={BAR_W - 2} height={Math.max(h, 0.5)} fill={m.color} opacity={0.85} />
            )
          })}
          <line x1={X0 - 4} x2={WIDTH} y1={16 + pH + 36 + sH} y2={16 + pH + 36 + sH} className="stroke-border" />
        </svg>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Σ positive dS</dt>
            <dd className="tabular-nums text-foreground">{fmt(pos)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Σ negative dS</dt>
            <dd className="tabular-nums text-foreground">{fmt(neg)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">row sum (should be 0)</dt>
            <dd className="tabular-nums font-medium" style={{ color: m.color }}>
              {sum.toExponential(2)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">as a share of Σ|dS|</dt>
            <dd className="tabular-nums text-foreground">{Math.abs(frac) < 1e-3 ? frac.toExponential(1) : frac.toFixed(3)} %</dd>
          </div>
        </dl>

        {method === "stale" && (
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            The paper&apos;s eq. 2 splits this residual into a probability-rounding term ({W.eq2.probability_term.toExponential(2)}) and a gradient-rounding term ({W.eq2.gradient_term.toExponential(2)}); together{" "}
            {W.eq2.sum.toExponential(2)}, against the measured {W.eq2.stale_row_sum.toExponential(2)}. The small leftover is the BF16 rounding of the saved output, which eq. 2 leaves out.
          </p>
        )}
      </div>
    </figure>
  )
}
