"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { COLS_L15, COLS_L19, COUNTS, LAYERS } from "./data"

// What the published edit is, read from the two checkpoints. Every number on
// this widget comes from data.ts, which was printed by a bit-for-bit diff of
// the base and edited safetensors (488 tensors compared, 2 differ). The column
// strip draws all 3,584 output columns of one layer's MLP down_proj and marks
// the 64 that changed, at their real indices. The dose slider replays the
// logged search: Astra tried alpha 1, 2 and 4 on the full matrices, then 4 and
// 6 on the 64 selected columns; the shipped edit is alpha 6, which leaves each
// selected column's component along the loop direction at 1 - 6 = -5 times
// its original value (measured: the median ratio is -5.00 in both layers).

const ACCENT = "oklch(0.62 0.16 35)"
const BLUE = "oklch(0.60 0.15 255)"
const MONO = "ui-monospace, monospace"

const W = 640
const STRIP_Y = 34
const STRIP_H = 46
const PX = 14
const PW = W - 2 * PX
const N_COLS = 3584

const DOSES = [0, 1, 2, 4, 6] as const

const DENOMS = [
  { key: "nominal", label: "the nominal 0.8 billion", n: COUNTS.nominal },
  { key: "checkpoint", label: "every tensor in the release (vision tower included)", n: COUNTS.checkpoint },
  { key: "lm", label: "the language model only", n: COUNTS.languageModel },
  { key: "lmNoEmb", label: "the language model minus its embedding table", n: COUNTS.languageModel - COUNTS.embedding },
] as const

const fmt = (n: number) => n.toLocaleString("en-US")

export function EditAnatomy() {
  const [layer, setLayer] = useState<15 | 19>(15)
  const [doseIdx, setDoseIdx] = useState(4)
  const [denom, setDenom] = useState(0)
  const cols = layer === 15 ? COLS_L15 : COLS_L19
  const info = LAYERS[layer]
  const alpha = DOSES[doseIdx]
  const along = 1 - alpha
  const sx = (c: number) => PX + (c / (N_COLS - 1)) * PW

  // bar for "component along u": 1 = untouched, negative = pushed past zero
  const BAR_Y = 120
  const BAR_H = 22
  const zeroX = PX + PW * (5 / 6)
  const unit = PW / 6
  const barX = along >= 0 ? zeroX : zeroX + along * unit
  const barW = Math.abs(along) * unit

  const d = DENOMS[denom]
  const share = (COUNTS.touched / d.n) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the shipped edit · layers.{layer}.mlp.down_proj · measured
        </span>
        <div className="flex gap-1">
          {([15, 19] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayer(l)}
              aria-pressed={layer === l}
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${layer === l ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              layer {l}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} 170`} role="img" className="h-auto w-full">
          <title>
            {`The 3,584 output columns of layer ${layer}'s MLP down-projection, drawn left to right, with the 64 columns the edit changed marked in orange. Below, the component of those columns along the loop direction: 1 before the edit, ${along} at dose ${alpha}.`}
          </title>
          <text x={PX} y={20} fontSize={10} fontFamily={MONO} fill="currentColor" fillOpacity={0.6}>
            {`down_proj: 1,024 rows x 3,584 columns · each column is one MLP neuron's write into the residual stream`}
          </text>
          <rect x={PX} y={STRIP_Y} width={PW} height={STRIP_H} rx={4} fill="currentColor" fillOpacity={0.06} />
          {cols.map((c) => (
            <rect key={c} x={sx(c) - 0.8} y={STRIP_Y} width={1.6} height={STRIP_H} fill={ACCENT} />
          ))}
          {[0, 1024, 2048, 3072, 3583].map((t) => (
            <text key={t} x={sx(t)} y={STRIP_Y + STRIP_H + 12} fontSize={9} fontFamily={MONO} textAnchor="middle" fill="currentColor" fillOpacity={0.5}>
              {t}
            </text>
          ))}
          <text x={PX} y={BAR_Y - 8} fontSize={10} fontFamily={MONO} fill="currentColor" fillOpacity={0.6}>
            {`component of each changed column along the loop direction u`}
          </text>
          <line x1={zeroX} x2={zeroX} y1={BAR_Y - 4} y2={BAR_Y + BAR_H + 4} stroke="currentColor" strokeOpacity={0.4} />
          <line x1={zeroX + unit} x2={zeroX + unit} y1={BAR_Y - 4} y2={BAR_Y + BAR_H + 4} stroke={BLUE} strokeDasharray="3 3" />
          <rect x={barX} y={BAR_Y} width={Math.max(barW, 1)} height={BAR_H} rx={3} fill={along >= 0 ? BLUE : ACCENT} fillOpacity={0.85} />
          {[-5, -4, -3, -2, -1, 0, 1].map((t) => (
            <text key={t} x={zeroX + t * unit} y={BAR_Y + BAR_H + 16} fontSize={9} fontFamily={MONO} textAnchor="middle" fill="currentColor" fillOpacity={0.5}>
              {t === 1 ? "1 (base)" : t}
            </text>
          ))}
        </svg>

        <label className="mt-1 flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">dose α</span>
          <Range
            min={0}
            max={DOSES.length - 1}
            step={1}
            value={doseIdx}
            onChange={(e) => setDoseIdx(Number(e.target.value))}
            aria-label="Dose alpha"
            accent={ACCENT}
          />
          <span className="w-10 text-right">{alpha}</span>
        </label>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {`W' = W − α · u (u·W) on the selected columns. α = ${alpha}: the part of each column that writes along u becomes ${along} times what it was.`}
          {alpha === 6 ? " This is the shipped edit." : alpha === 0 ? " No edit." : " A dose Astra tried on the way (logged)."}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["columns changed", `${cols.length} of 3,584`],
            ["values whose bits differ", `${fmt(info.changedBits)} of ${fmt(info.touched)}`],
            ["relative change (Frobenius)", `${(info.relFrob * 100).toFixed(2)}%`],
            ["energy in one singular value", `${(info.rank1 * 100).toFixed(4)}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 rounded-lg border px-3 py-2.5">
          <div className="font-mono text-[11px] text-muted-foreground">
            {`131,072 touched weights as a share of…`}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {DENOMS.map((x, i) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setDenom(i)}
                aria-pressed={denom === i}
                className={`rounded-md border px-2 py-0.5 text-left font-mono text-[11px] ${denom === i ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="mt-2 font-mono text-sm">
            {`${fmt(COUNTS.touched)} / ${fmt(d.n)} = ${share.toFixed(4)}%`}
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Measured from the two public checkpoints. Of 488 tensors, only these two differ. In each, the change is a single
        outer product: one 1,024-number direction times 64 per-column coefficients. That is why a few values per
        layer round back to the same bfloat16 number and the bit count lands just under 65,536.
      </figcaption>
    </figure>
  )
}
