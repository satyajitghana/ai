"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number here is the paper's own (arXiv 2609.05334), read off its OOD-split
// tables against the FP32 baseline's 95.13% (Table 1):
//
//  - H-BAC alone (50% pruning, post-finetune): 95.53% (Table 2 / Table 13)      -> +0.40pp
//  - PTQ-Dynamic alone:                        94.34% (Table 6 / Table 13)      -> -0.79pp
//  - Attention-Based KD alone, from the FULL (unpruned) teacher:
//                                               96.71 +/- 1.03% (Table 7)       -> +1.58pp
//  - "predicted if independent": the plain sum of the three deltas above
//    (0.40 - 0.79 + 1.58 = +1.19pp) -- not a paper number, a naive-additivity
//    baseline computed here to make the comparison legible.
//  - Full pipeline (H-BAC -> Attention KD -> PTQ-Dynamic), mean of 4 tested
//    configurations: 95.13 +/- 2.32% (Table 4 / Table 13, n=4)                 -> +0.00pp
//  - Full pipeline, the single traced 50%-ratio run (Table 4's own worked
//    example): 91.97%                                                         -> -3.16pp
//  - Direct-trained TinyViT of the identical final size (6.01 MB, INT8),
//    skipping H-BAC and KD entirely (Table 4's "direct-training alternative"):
//    94.87%                                                                   -> -0.26pp
//
// The KD-alone number distills from the FULL teacher; the pipeline's own KD stage
// distills from the H-BAC-PRUNED teacher instead, which the paper separately
// measures as 1.84pp worse (93.68% vs 95.53%, Sec. 4.3) -- one concrete, disclosed
// reason the parts don't simply sum. That's noted in the explanatory paragraph
// rather than encoded as a separate row.

type Row = {
  key: string
  label: string
  delta: number
  std?: number
  kind: "measured" | "predicted"
  note: string
}

const FIXED_ROWS: Row[] = [
  { key: "hbac", label: "H-BAC alone (50% pruning)", delta: 0.4, kind: "measured", note: "95.53% vs. 95.13% baseline -- pruning here costs no accuracy at all." },
  { key: "ptq", label: "PTQ-Dynamic alone", delta: -0.79, kind: "measured", note: "94.34% -- the expected small cost of INT8 with no further adaptation." },
  { key: "kd", label: "Attention KD alone (full teacher)", delta: 1.58, std: 1.03, kind: "measured", note: "96.71 ± 1.03% -- the single best-performing standalone technique." },
]

const PRED_ROW: Row = { key: "pred", label: "predicted, if independent", delta: 0.4 - 0.79 + 1.58, kind: "predicted", note: "plain sum of the three deltas above" }

const POS = "oklch(0.6 0.14 155)"
const NEG = "oklch(0.62 0.17 27)"
const PRED_COLOR = "oklch(0.62 0.02 260)"
const XMIN = -4.4
const XMAX = 2.3
const W = 720
const ML = 208
const PR_ = 54
const ROW_H = 40
const PAD_T = 30
const PAD_B = 26
const ROWS = 6
const H = PAD_T + ROWS * ROW_H + PAD_B
const PLOT_W = W - ML - PR_

const xPos = (v: number) => ML + ((v - XMIN) / (XMAX - XMIN)) * PLOT_W
const rowY = (i: number) => PAD_T + i * ROW_H + ROW_H / 2

function fmtPP(v: number) {
  const sign = v > 0.004 ? "+" : v < -0.004 ? "−" : "±"
  return `${sign}${Math.abs(v).toFixed(2)}pp`
}

export function AdditivityLedger() {
  const [showPred, setShowPred] = useState(true)
  const [pipelineMode, setPipelineMode] = useState<"mean" | "traced">("mean")

  const pipelineRow: Row =
    pipelineMode === "mean"
      ? { key: "pipe", label: "full pipeline (mean, n=4)", delta: 0.0, std: 2.32, kind: "measured", note: "95.13 ± 2.32% averaged over 4 runs -- lands back on the baseline." }
      : { key: "pipe", label: "full pipeline (traced run)", delta: -3.16, kind: "measured", note: "91.97% -- the one specific run Table 4 walks stage by stage." }

  const directRow: Row = { key: "direct", label: "direct-trained, same final size", delta: -0.26, kind: "measured", note: "94.87% -- TinyViT trained on labels only, then quantized. No H-BAC, no KD." }

  const rows: (Row | null)[] = [...FIXED_ROWS, showPred ? PRED_ROW : null, pipelineRow, directRow]

  const gridStart = Math.ceil(XMIN)
  const gridEnd = Math.floor(XMAX)
  const gridTicks = Array.from({ length: gridEnd - gridStart + 1 }, (_, i) => gridStart + i)

  const gap = PRED_ROW.delta - pipelineRow.delta

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">accuracy delta vs. FP32 baseline (95.13%, OOD split) &middot; Tables 1, 4, 6, 7, 13</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Accuracy change from the 95.13% FP32 baseline for each compression technique alone, a naive-additive prediction of ${fmtPP(PRED_ROW.delta)}, and the measured combined pipeline at ${fmtPP(pipelineRow.delta)}`}
        >
          {gridTicks.map((g) => (
            <g key={g}>
              <line x1={xPos(g)} x2={xPos(g)} y1={PAD_T - 6} y2={H - PAD_B + 4} stroke="currentColor" className="text-border" strokeWidth={g === 0 ? 0 : 1} opacity={0.6} />
              <text x={xPos(g)} y={H - PAD_B + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
                {g > 0 ? `+${g}` : g}
              </text>
            </g>
          ))}
          {/* zero line = FP32 baseline */}
          <line x1={xPos(0)} x2={xPos(0)} y1={PAD_T - 10} y2={H - PAD_B + 4} stroke="currentColor" className="text-foreground/35" strokeWidth={1.25} strokeDasharray="2 3" />
          <text x={xPos(0)} y={PAD_T - 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            FP32 baseline
          </text>

          {rows.map((r, i) => {
            const y = rowY(i)
            if (!r) {
              return (
                <g key={`empty-${i}`}>
                  <text x={16} y={y + 3.5} className="fill-muted-foreground/50 font-mono italic" fontSize={10.5}>
                    predicted row hidden
                  </text>
                </g>
              )
            }
            const isPred = r.kind === "predicted"
            const color = r.delta >= 0 ? POS : NEG
            const dotColor = isPred ? PRED_COLOR : color
            const x0 = xPos(0)
            const x1 = xPos(r.delta)
            return (
              <g key={r.key}>
                <text x={16} y={y + 3.5} className="fill-foreground font-mono" fontSize={10.5}>
                  {r.label}
                </text>
                {r.std !== undefined && (
                  <line x1={xPos(r.delta - r.std)} x2={xPos(r.delta + r.std)} y1={y} y2={y} stroke={dotColor} strokeWidth={1.25} opacity={0.45} />
                )}
                <line x1={x0} x2={x1} y1={y} y2={y} stroke={dotColor} strokeWidth={2} strokeDasharray={isPred ? "3 3" : undefined} opacity={isPred ? 0.75 : 0.9} />
                <circle cx={x1} cy={y} r={5} fill={isPred ? "var(--background)" : dotColor} stroke={dotColor} strokeWidth={1.75} />
                <text x={x1 + (r.delta >= 0 ? 10 : -10)} y={y + 3.5} textAnchor={r.delta >= 0 ? "start" : "end"} className="font-mono" fontSize={9.5} fill={dotColor}>
                  {fmtPP(r.delta)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">naive-additive prediction</span>
            {[
              { v: true, l: "show" },
              { v: false, l: "hide" },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setShowPred(opt.v)}
                aria-pressed={showPred === opt.v}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  showPred === opt.v ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">pipeline result</span>
            {(["mean", "traced"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPipelineMode(m)}
                aria-pressed={pipelineMode === m}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  pipelineMode === m ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "mean" ? "mean, n=4" : "single traced run"}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {showPred ? (
            <>
              Sum the three standalone deltas and independence predicts a{" "}
              <span style={{ color: PRED_COLOR }}>{fmtPP(PRED_ROW.delta)}</span>{" "}pipeline — roughly 96.3% accuracy. The{" "}
              measured pipeline lands at{" "}
              <span style={{ color: pipelineRow.delta >= 0 ? POS : NEG }}>{fmtPP(pipelineRow.delta)}</span>, a{" "}
              <span className="text-foreground">{Math.abs(gap).toFixed(2)}pp shortfall</span>{" "}from that prediction
              {pipelineMode === "traced" ? ", and the paper discloses exactly one reason for part of it: distilling from the H-BAC-pruned teacher rather than the full one costs 1.84pp on its own (95.53% → 93.68%, Section 4.3)." : "."}
            </>
          ) : (
            <>
              With the prediction hidden, what&rsquo;s left is the plain measured landscape: three techniques that each
              help or cost a little on their own, a chained pipeline that lands back{" "}
              <span style={{ color: pipelineRow.delta >= 0 ? POS : NEG }}>{fmtPP(pipelineRow.delta)}</span>{" "}from
              baseline, and a same-size model trained with none of it at{" "}
              <span style={{ color: directRow.delta >= 0 ? POS : NEG }}>{fmtPP(directRow.delta)}</span>. Toggle the
              prediction back on to see why that pipeline result is a wash rather than a compounded win.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
