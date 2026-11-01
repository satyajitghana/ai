"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { LEVEL_ROWS, TOKEN_TOTALS } from "./data"

// Mean tokens per validation example, by the dataset's own complexity level (1 to 10), counted with the
// model's own tokenizer.json over all 213 validation rows. Three parts: the system and user prompt, the
// reasoning trace (`reasoning_content`) and the answer (`content`, which holds the HTML). Nothing here is
// estimated; the bars are the means printed by the counting script, in tokens.

const C_THINK = "oklch(0.64 0.14 255)"
const C_CODE = "oklch(0.66 0.15 40)"
const C_PROMPT = "oklch(0.62 0.12 150)"

const W = 640
const LABEL = 34
const BAR_H = 20
const GAP = 8
const TOP = 26
const XMAX = 40000
const PW = W - LABEL - 20
const H = TOP + LEVEL_ROWS.length * (BAR_H + GAP) + 24

const sx = (t: number) => LABEL + (t / XMAX) * PW

export function TokenBudget() {
  const [sel, setSel] = useState(9)
  const row = LEVEL_ROWS[sel]
  const mean = row.prompt + row.think + row.code
  const ticks = [0, 10000, 20000, 30000, 40000]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          tokens per training example · 213 validation rows · measured with the model&apos;s tokenizer
        </span>
        <span className="font-mono text-xs">
          level {row.level} · n={row.n}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Stacked bars of mean tokens per example for complexity levels 1 to 10: reasoning trace (blue), code (orange)
            and prompt (green). Level 1 averages 20,921 tokens, level 3 31,014, level 7 35,593 and level 10 34,418. The
            code share rises with level; the reasoning share does not.
          </title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={TOP - 6} y2={H - 24} stroke="currentColor" strokeOpacity={0.12} />
              <text
                x={sx(t)}
                y={H - 8}
                textAnchor="middle"
                fontSize={9}
                fontFamily="ui-monospace, monospace"
                fill="currentColor"
                fillOpacity={0.55}
              >
                {t === 0 ? "0" : `${t / 1000}k`}
              </text>
            </g>
          ))}
          {LEVEL_ROWS.map((r, i) => {
            const y = TOP + i * (BAR_H + GAP)
            const xt = sx(r.think)
            const xc = sx(r.think + r.code)
            const xp = sx(r.think + r.code + r.prompt)
            return (
              <g
                key={r.level}
                onClick={() => setSel(i)}
                style={{ cursor: "pointer" }}
                opacity={i === sel ? 1 : 0.62}
              >
                <text
                  x={LABEL - 8}
                  y={y + BAR_H / 2 + 3}
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="ui-monospace, monospace"
                  fill="currentColor"
                  fontWeight={i === sel ? 700 : 400}
                >
                  L{r.level}
                </text>
                <rect x={LABEL} y={y} width={xt - LABEL} height={BAR_H} fill={C_THINK} />
                <rect x={xt} y={y} width={xc - xt} height={BAR_H} fill={C_CODE} />
                <rect x={xc} y={y} width={Math.max(1, xp - xc)} height={BAR_H} fill={C_PROMPT} />
                <rect x={LABEL} y={y - 2} width={W - LABEL} height={BAR_H + 4} fill="transparent" />
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
          <span><i className="mr-1 inline-block h-2 w-2" style={{ background: C_THINK }} />reasoning trace</span>
          <span><i className="mr-1 inline-block h-2 w-2" style={{ background: C_CODE }} />code</span>
          <span><i className="mr-1 inline-block h-2 w-2" style={{ background: C_PROMPT }} />prompt</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Pick a complexity level">
          {LEVEL_ROWS.map((r, i) => (
            <button
              key={r.level}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px]",
                i === sel ? "bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              L{r.level}
            </button>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <div><dt className="text-muted-foreground">mean total</dt><dd className="tabular-nums">{mean.toLocaleString("en-US")}</dd></div>
          <div><dt className="text-muted-foreground">reasoning / code</dt><dd className="tabular-nums">{(row.think / row.code).toFixed(2)}</dd></div>
          <div><dt className="text-muted-foreground">over 16,384</dt><dd className="tabular-nums">{row.over16} of {row.n}</dd></div>
          <div><dt className="text-muted-foreground">longest</dt><dd className="tabular-nums">{row.max.toLocaleString("en-US")}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          All 213 rows: mean {TOKEN_TOTALS.mean.toLocaleString("en-US")} tokens, median {TOKEN_TOTALS.median.toLocaleString("en-US")},
          longest {TOKEN_TOTALS.max.toLocaleString("en-US")}. The technical report&apos;s training run averages{" "}
          {TOKEN_TOTALS.reportedMean.toLocaleString("en-US")} (112,903,599 input tokens over 3,912 examples).
        </p>
      </div>
    </figure>
  )
}
