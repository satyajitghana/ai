"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { BEST_D_FORMAL, BEST_D_FRENCH, NEURON_A, NEURON_B } from "./data"

// For each of the 28 layers, the largest |d'| of any of its 3,072 neurons,
// where d' is the difference of the neuron's mean activation (token-mean per
// prompt) between the two prompt sets over their pooled standard deviation.
// French vs English: 30 parallel pairs. Formal vs casual: 20 pairs.
// Measured; the two neurons the article steers are marked.

type Set = "french" | "formal"

const ACCENT = "oklch(0.62 0.16 35)"
const STREAM = "oklch(0.60 0.15 255)"

export function ContrastRank() {
  const [set, setSet] = useState<Set>("french")
  const vals = set === "french" ? BEST_D_FRENCH : BEST_D_FORMAL
  const max = 14
  const BW = 22
  const H = 160

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">best neuron per layer · largest |d&apos;| · measured</span>
        <div className="flex gap-1">
          {(["french", "formal"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSet(k)}
              aria-pressed={set === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                set === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "french" ? "French vs English" : "formal vs casual"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${28 * BW + 40} ${H + 34}`} role="img" className="h-auto w-full">
          <title>
            Bars give, for each of the 28 layers, the largest absolute d-prime of any neuron in that layer. French against
            English peaks at 13.8 in layer 20 and has other tall bars at 16, 17 and 23; formal against casual peaks at 7.1
            in layer 19.
          </title>
          {[0, 5, 10].map((t) => (
            <g key={t}>
              <line x1={32} x2={28 * BW + 36} y1={H - (t / max) * H} y2={H - (t / max) * H} stroke="currentColor" strokeOpacity={0.12} />
              <text x={26} y={H - (t / max) * H + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {t}
              </text>
            </g>
          ))}
          {vals.map((v, i) => {
            const mark = set === "french" && (i === NEURON_A.layer || i === NEURON_B.layer)
            return (
              <g key={i}>
                <rect x={34 + i * BW + 2} y={H - (v / max) * H} width={BW - 4} height={(v / max) * H} rx={2} fill={mark ? ACCENT : STREAM} fillOpacity={mark ? 0.9 : 0.4} />
                {(i % 3 === 0 || mark) && (
                  <text x={34 + i * BW + BW / 2} y={H + 13} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
                    {i}
                  </text>
                )}
              </g>
            )
          })}
          <text x={34} y={H + 28} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.5}>
            layer{set === "french" ? " (orange: the two neurons steered in this article)" : ""}
          </text>
        </svg>
        <p className="mt-1 text-xs text-muted-foreground">
          A random neuron has a mean |d&apos;| of about 0.6 and a 99th percentile of about 2.3 to 2.7. Every bar above is far outside that, and the
          tall ones sit in the middle and late layers.
        </p>
      </div>
    </figure>
  )
}
