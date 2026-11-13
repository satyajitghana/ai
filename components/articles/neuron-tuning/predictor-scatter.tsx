"use client"

import { useMemo, useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { PRED, type PredRow } from "./predictor-data"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

// Each dot is one trained edit from the repository's experiment 03 (read from its committed result files, not
// re-trained). x = off-target write after training: sum over layers of |dW a(x)| on unrelated tokens. y = change on
// unrelated text F = KL(original || edited) per token. Rank correlation is computed here, over the dots shown.

const BLUE = "oklch(0.58 0.15 255)"
const ORANGE = "oklch(0.66 0.17 45)"
const GREY = "oklch(0.55 0.02 255)"

const LORA = new Set(["lorad", "lorac", "lora_d"])
const FAM: Record<string, string> = {
  sel8: "8 neurons, gradient choice",
  srand8: "8 matched neurons",
  col8: "8 neurons, gradient choice",
  sel128: "128 neurons, gradient choice",
  srand128: "128 matched neurons",
  dense8: "8 random active neurons",
  dense128: "128 random active neurons",
  lorad: "rank-1 LoRA, 1 layer",
  lorac: "rank-1 LoRA, 16 layers",
  lora_d: "rank-1 LoRA, 1 layer",
}
const TASKS = ["all", "casual", "weather", "lower", "recipe"] as const
type Task = (typeof TASKS)[number]
const TASK_LABEL: Record<Task, string> = {
  all: "all 210",
  casual: "casual register",
  weather: "weather rule",
  lower: "lower-case rule",
  recipe: "recipe rule",
}

function group(r: PredRow): "lora" | "sel" | "dense" {
  if (LORA.has(r[0])) return "lora"
  return r[4] < 0.35 ? "sel" : "dense"
}
const COLOR = { lora: GREY, sel: BLUE, dense: ORANGE }

function ranks(xs: number[]): number[] {
  const o = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const r = new Array<number>(xs.length)
  let i = 0
  while (i < o.length) {
    let j = i
    while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++
    for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2
    i = j + 1
  }
  return r
}

function spearman(a: number[], b: number[]): number {
  const ra = ranks(a)
  const rb = ranks(b)
  const n = a.length
  const ma = ra.reduce((s, v) => s + v, 0) / n
  const mb = rb.reduce((s, v) => s + v, 0) / n
  let c = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i++) {
    c += (ra[i] - ma) * (rb[i] - mb)
    va += (ra[i] - ma) * (ra[i] - ma)
    vb += (rb[i] - mb) * (rb[i] - mb)
  }
  return c / Math.sqrt(va * vb)
}

const W = 600
const H = 360
const PL = 56
const PR = 14
const PT = 14
const PB = 44
const X0 = -1
const X1 = 2
const Y0 = -4
const Y1 = 0.5

const sx = (v: number) => PL + ((mlog10(v) - X0) / (X1 - X0)) * (W - PL - PR)
const sy = (v: number) => PT + (1 - (mlog10(v) - Y0) / (Y1 - Y0)) * (H - PT - PB)

export function PredictorScatter() {
  const [task, setTask] = useState<Task>("all")
  const [hover, setHover] = useState<number | null>(null)
  const rows = useMemo(() => PRED.filter((r) => task === "all" || r[1] === task), [task])
  const rho = useMemo(() => spearman(rows.map((r) => r[2]), rows.map((r) => r[3])), [rows])
  const h = hover !== null ? rows[hover] : null
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">reported runs · correlation recomputed here</span>
        <div className="flex flex-wrap gap-1" role="tablist" onKeyDown={tablistKeys()} aria-label="Task">
          {TASKS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === task}
              tabIndex={t === task ? 0 : -1}
              onClick={() => {
                setTask(t)
                setHover(null)
              }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                t === task ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {TASK_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>{`Off-target write against change on unrelated text for ${rows.length} edits (${TASK_LABEL[task]}); Spearman rank correlation ${rho.toFixed(2)}.`}</title>
          {[0.1, 1, 10, 100].map((e) => (
            <g key={`x${e}`}>
              <line x1={sx(e)} x2={sx(e)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.08} />
              <text x={sx(e)} y={H - PB + 16} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                {e}
              </text>
            </g>
          ))}
          {(
            [
              [-4, 1e-4],
              [-3, 1e-3],
              [-2, 1e-2],
              [-1, 1e-1],
              [0, 1],
            ] as const
          ).map(([e, v]) => (
            <g key={`y${e}`}>
              <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PL - 6} y={sy(v) + 3} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                {`1e${e}`}
              </text>
            </g>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 8} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.75}>
            off-target write after training (log)
          </text>
          <text x={12} y={(PT + H - PB) / 2} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 12 ${(PT + H - PB) / 2})`}>
            change on unrelated text F (log)
          </text>
          {rows.map((r, i) => (
            <circle
              key={i}
              cx={sx(r[2])}
              cy={sy(Math.max(r[3], 1.1e-4))}
              r={hover === i ? 6 : 3.6}
              fill={COLOR[group(r)]}
              fillOpacity={hover === null || hover === i ? 0.8 : 0.35}
              stroke={hover === i ? "currentColor" : "none"}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
            />
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            <span style={{ color: BLUE }}>●</span> neurons quiet off-target (S below 0.35){" "}
            <span style={{ color: ORANGE }}>●</span> neurons active off-target <span style={{ color: GREY }}>●</span> LoRA
          </span>
          <span className="text-foreground">
            {rows.length} edits · Spearman {rho.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 min-h-[2.5em] font-mono text-[11px] text-muted-foreground">
          {h
            ? `${FAM[h[0]] ?? h[0]} · ${h[1]} · write ${h[2]} · F ${h[3]} · S ${h[4]}`
            : "Hover or tab to a dot. Each family has several learning rates and seeds, so a big part of the correlation is learning rate."}
        </p>
      </div>
    </figure>
  )
}
