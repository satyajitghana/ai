"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { LEDGER } from "./data"

// One real optimizer step from my toy LM head, summed by token-frequency bin.
// Each bar is how much that bin of vocabulary rows would move its logits for an
// average context, per unit learning rate. The cross-entropy gradient (and so
// SGD-M's momentum buffer, a running sum of gradients) sums to zero over the
// vocabulary; Adam's per-row division by sqrt(v) does not preserve that.

type Opt = "mom" | "adam"

const POS = "oklch(0.62 0.15 255)"
const NEG = "oklch(0.66 0.17 40)"

const W = 620
const H = 210
const PL = 92
const PR = 64
const ROW = 28
const PT = 22

function fmt(v: number): string {
  const a = Math.abs(v)
  if (a === 0) return "0"
  if (a < 1e-3) return v.toExponential(1)
  if (a < 10) return v.toFixed(2)
  return v.toFixed(0)
}

export function ZeroSumLedger() {
  const [opt, setOpt] = useState<Opt>("adam")
  const vals = LEDGER.bins.map((b) => b[opt])
  const tot = opt === "adam" ? LEDGER.tot_adam : LEDGER.tot_mom
  const abs = opt === "adam" ? LEDGER.abs_adam : LEDGER.abs_mom
  const max = Math.max(...vals.map((v) => Math.abs(v)))
  const mid = PL + (W - PL - PR) / 2
  const half = (W - PL - PR) / 2
  const sx = (v: number) => mid + (v / max) * half

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured: one step of a toy LM head, V 2,048, step 2,000</span>
        <span className="font-mono text-[10px] text-muted-foreground">bars rescaled per optimizer</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["mom", "SGD-M: momentum of the gradient"],
              ["adam", "Adam: m / (√v + ε)"],
            ] as [Opt, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setOpt(id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                opt === id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Per-bin push on the logits for ${opt === "adam" ? "Adam" : "SGD with momentum"}; total over the vocabulary ${fmt(tot)} against an absolute sum of ${fmt(abs)}`}
        >
          <line x1={mid} x2={mid} y1={PT - 10} y2={PT + ROW * vals.length} className="stroke-muted-foreground" strokeWidth="0.8" />
          <text x={mid - 6} y={PT - 12} textAnchor="end" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }} fill={NEG}>
            raises logits
          </text>
          <text x={mid + 6} y={PT - 12} style={{ fontSize: 9, fontFamily: "var(--font-mono)" }} fill={POS}>
            lowers logits
          </text>
          {LEDGER.bins.map((b, i) => {
            const v = b[opt]
            const y = PT + i * ROW
            const x0 = Math.min(mid, sx(v))
            const w = Math.abs(sx(v) - mid)
            return (
              <g key={b.ranks}>
                <text x={PL - 8} y={y + 15} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                  ranks {b.ranks}
                </text>
                <rect x={x0} y={y + 5} width={Math.max(w, 0.8)} height={ROW - 10} rx={2} fill={v >= 0 ? POS : NEG} />
                <text
                  x={v >= 0 ? sx(v) + 4 : sx(v) - 4}
                  y={y + 15}
                  textAnchor={v >= 0 ? "start" : "end"}
                  className="fill-foreground"
                  style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
                >
                  {fmt(v)}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">sum over all 2,048 rows</div>
            <div className="font-mono text-lg">{fmt(tot)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">net share, |sum| / sum of |row|</div>
            <div className="font-mono text-lg">{opt === "adam" ? `${((Math.abs(tot) / abs) * 100).toFixed(0)}%` : `${(Math.abs(tot) / abs).toExponential(0)}`}</div>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Under the momentum buffer the bins cancel to rounding error, so the step moves logits relative to each other and leaves their average
          alone. Adam divides each row by its own running gradient scale. Rare tokens have tiny, consistent gradients and a tiny scale, so they get
          full-size steps in the same direction, and the vocabulary as a whole slides downwards.
        </p>
      </div>
    </figure>
  )
}
