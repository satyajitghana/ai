"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 419 human ratings in github.com/pat-jj/r4t-rebuttal, one row per query.
//
// Each of the two spreadsheets holds 35 Google Forms sheets: one form per broad
// Polyvore query, six respondents each (Qwen form 10 has five), rating "Result
// 1" and "Result 2" on the paper's own Alignment and Diversity rubrics, 1-5.
// The four numbers below are the per-query means of those responses, in the
// order [Result 1 alignment, Result 2 alignment, Result 1 diversity, Result 2
// diversity]. One Result-1 alignment cell is blank in each file -- both in form
// 11 -- and is dropped pairwise, which is why two of these means are over five
// raters rather than six.
//
// The repo publishes no legend saying which arm is which system. The article
// argues from pixel-matching against the paper's Figure 3 that Result 1 is the
// zero-shot baseline, and labels the arms that way here. The finding this chart
// is for does not rest on that: whichever arm is R4T, it takes one metric and
// loses the other, and the paper's Table 1 has it taking both.
const DATA: Record<string, number[][]> = {
  gemma: [
    [3.6667, 2.1667, 2.8333, 2.1667], [4.1667, 3.6667, 4.8333, 4.0], [5.0, 3.8333, 2.3333, 4.6667],
    [5.0, 4.8333, 4.0, 5.0], [4.5, 3.1667, 3.5, 2.8333], [4.1667, 3.8333, 4.3333, 4.1667],
    [4.6667, 3.8333, 4.8333, 4.1667], [4.0, 4.0, 4.0, 4.3333], [5.0, 4.6667, 3.5, 4.6667],
    [3.6667, 3.6667, 2.6667, 4.0], [4.0, 3.6667, 3.5, 3.6667], [4.8333, 4.6667, 3.0, 4.5],
    [4.1667, 3.5, 3.6667, 3.6667], [4.5, 2.5, 1.5, 2.6667], [3.0, 4.1667, 3.0, 4.1667],
    [4.1667, 4.1667, 4.1667, 4.1667], [4.6667, 3.8333, 3.3333, 3.5], [4.8333, 4.0, 3.3333, 3.5],
    [3.3333, 3.0, 1.8333, 3.1667], [3.5, 3.0, 3.0, 2.6667], [4.8333, 4.6667, 4.1667, 4.5],
    [4.8333, 4.6667, 4.0, 4.0], [4.6667, 4.6667, 4.0, 4.5], [4.1667, 4.5, 4.1667, 4.3333],
    [4.1667, 4.1667, 4.1667, 4.5], [3.0, 3.6667, 1.6667, 3.6667], [4.6667, 4.0, 3.1667, 4.0],
    [3.3333, 3.1667, 2.3333, 2.8333], [4.6667, 3.5, 4.6667, 3.5], [3.8333, 3.3333, 2.8333, 3.1667],
    [4.8333, 5.0, 4.1667, 4.0], [4.6667, 3.3333, 3.8333, 3.1667], [4.6667, 4.0, 4.8333, 4.0],
    [3.6667, 3.5, 3.6667, 3.6667], [3.6667, 1.6667, 3.0, 1.6667],
  ],
  qwen: [
    [4.6667, 4.3333, 2.3333, 2.0], [4.6667, 3.6667, 2.6667, 3.5], [3.6667, 3.5, 1.5, 2.8333],
    [5.0, 4.8333, 4.0, 3.6667], [4.3333, 4.3333, 2.1667, 3.1667], [4.8333, 4.5, 4.6667, 3.6667],
    [4.8333, 2.0, 2.6667, 1.8333], [4.8333, 3.3333, 3.6667, 3.3333], [2.1667, 2.8333, 2.0, 3.0],
    [4.6, 4.0, 3.6, 3.4], [5.0, 3.5, 2.0, 3.5], [3.0, 3.5, 2.5, 3.3333],
    [4.6667, 4.0, 1.6667, 2.6667], [4.8333, 3.8333, 4.0, 3.6667], [5.0, 3.6667, 2.0, 3.5],
    [4.6667, 3.3333, 2.0, 2.8333], [4.6667, 4.1667, 3.6667, 4.3333], [4.3333, 3.3333, 2.5, 3.3333],
    [4.3333, 4.1667, 4.3333, 4.1667], [4.8333, 4.6667, 3.5, 3.6667], [5.0, 4.1667, 2.0, 3.8333],
    [4.5, 3.5, 3.1667, 3.0], [3.8333, 2.8333, 2.6667, 2.6667], [5.0, 4.5, 2.6667, 3.5],
    [5.0, 2.3333, 2.0, 1.8333], [2.5, 3.0, 2.5, 2.6667], [5.0, 4.1667, 2.1667, 4.0],
    [4.8333, 4.6667, 3.1667, 3.8333], [5.0, 3.6667, 2.3333, 3.5], [5.0, 4.6667, 3.1667, 4.3333],
    [4.5, 3.0, 1.3333, 2.1667], [4.5, 4.0, 3.0, 3.8333], [4.8333, 4.5, 3.6667, 4.3333],
    [4.1667, 4.0, 2.3333, 3.6667], [3.0, 2.0, 2.1667, 1.5],
  ],
}

// Table 1, Polyvore column, on the paper's own unexplained 0-100 scale. Only the
// direction is comparable: the paper never states how its 5-point Likert judge
// scores become these numbers.
const JUDGE: Record<string, Record<string, { base: number; folm: number; diff: number }>> = {
  gemma: {
    alignment: { base: 31.2, folm: 39.8, diff: 37.6 },
    diversity: { base: 56.0, folm: 76.8, diff: 74.3 },
  },
  qwen: {
    alignment: { base: 23.4, folm: 28.0, diff: 27.4 },
    diversity: { base: 37.0, folm: 62.8, diff: 65.0 },
  },
}

const SIGN: Record<string, Record<string, string>> = {
  gemma: { alignment: "5.9e-05", diversity: "0.15" },
  qwen: { alignment: "7.7e-07", diversity: "0.058" },
}

const BASE_C = "oklch(0.68 0.17 55)"
const R4T_C = "oklch(0.58 0.16 260)"

const W = 720
const PL = 40
const PR = 690
const ROW_H = 13
const TOP = 16

const xPix = (v: number) => PL + ((v - 1) / 4) * (PR - PL)

type Family = "gemma" | "qwen"
type Metric = "alignment" | "diversity"

export function JudgeVsHumans() {
  const [family, setFamily] = useState<Family>("qwen")
  const [metric, setMetric] = useState<Metric>("alignment")

  const bi = metric === "alignment" ? 0 : 2
  const ri = metric === "alignment" ? 1 : 3
  const rows = DATA[family]
    .map((r, i) => ({ q: i + 1, base: r[bi], r4t: r[ri] }))
    .sort((a, b) => b.r4t - b.base - (a.r4t - a.base))

  const mean = (k: "base" | "r4t") => rows.reduce((s, r) => s + r[k], 0) / rows.length
  const mb = mean("base")
  const mr = mean("r4t")
  const wins = rows.filter((r) => r.r4t > r.base).length
  const losses = rows.filter((r) => r.r4t < r.base).length
  const ties = rows.length - wins - losses
  const j = JUDGE[family][metric]
  const H = TOP + rows.length * ROW_H + 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          35 queries, one row each · the rebuttal repo&rsquo;s raw ratings
        </span>
        <div className="flex flex-wrap gap-1">
          {(["gemma", "qwen"] as Family[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamily(f)}
              aria-pressed={family === f}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                family === f
                  ? "border-foreground/30 bg-muted/60 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "gemma" ? "Gemma3-4B" : "Qwen3-4B"}
            </button>
          ))}
          {(["alignment", "diversity"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === m
                  ? "border-foreground/30 bg-muted/60 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Paired per-query ${metric} means for the ${family} spreadsheet. Each of the 35 rows joins the Result 1 mean to the Result 2 mean on a 1 to 5 scale, sorted by the size of the gap. Result 1 averages ${mb.toFixed(2)} and Result 2 averages ${mr.toFixed(2)}; Result 2 is higher on ${wins} of 35 queries and lower on ${losses}.`}
        >
          {[1, 2, 3, 4, 5].map((t) => (
            <g key={`g${t}`}>
              <line
                x1={xPix(t)}
                y1={TOP - 8}
                x2={xPix(t)}
                y2={TOP + rows.length * ROW_H}
                stroke="var(--border)"
                strokeWidth={1}
                strokeOpacity={0.4}
              />
              <text
                x={xPix(t)}
                y={TOP + rows.length * ROW_H + 15}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {t}
              </text>
            </g>
          ))}

          {rows.map((r, i) => {
            const y = TOP + i * ROW_H + ROW_H / 2
            const up = r.r4t > r.base
            return (
              <g key={r.q}>
                <text
                  x={PL - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  fontSize={8}
                >
                  q{r.q}
                </text>
                <line
                  x1={xPix(Math.min(r.base, r.r4t))}
                  y1={y}
                  x2={xPix(Math.max(r.base, r.r4t))}
                  y2={y}
                  stroke={up ? R4T_C : BASE_C}
                  strokeOpacity={0.45}
                  strokeWidth={2}
                />
                <circle cx={xPix(r.base)} cy={y} r={3.1} fill={BASE_C} />
                <circle cx={xPix(r.r4t)} cy={y} r={3.1} fill={R4T_C} />
              </g>
            )
          })}

          <line
            x1={xPix(mb)}
            y1={TOP - 10}
            x2={xPix(mb)}
            y2={TOP + rows.length * ROW_H}
            stroke={BASE_C}
            strokeWidth={1.4}
            strokeDasharray="4 3"
          />
          <line
            x1={xPix(mr)}
            y1={TOP - 10}
            x2={xPix(mr)}
            y2={TOP + rows.length * ROW_H}
            stroke={R4T_C}
            strokeWidth={1.4}
            strokeDasharray="4 3"
          />
        </svg>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span style={{ color: BASE_C }}>&#9679;</span> Result 1 — zero-shot fan-out (inferred),
            mean {mb.toFixed(2)}
          </span>
          <span>
            <span style={{ color: R4T_C }}>&#9679;</span> Result 2 — R4T (inferred), mean{" "}
            {mr.toFixed(2)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border bg-background/60 p-3 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              humans, {metric}
            </div>
            <div className="mt-1 font-mono text-sm">
              {(mr - mb >= 0 ? "+" : "") + (mr - mb).toFixed(2)} for R4T
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {wins} win / {losses} loss / {ties} tie · sign test p = {SIGN[family][metric]}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              LLM judge, same metric
            </div>
            <div className="mt-1 font-mono text-sm">
              {j.base} &rarr; {j.diff} (diffusion)
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              Table 1, Polyvore · FOLM {j.folm} · scale undefined
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              agree?
            </div>
            <div
              className="mt-1 font-mono text-sm"
              style={{ color: mr - mb > 0 === j.diff > j.base ? undefined : BASE_C }}
            >
              {mr - mb > 0 === j.diff > j.base ? "same direction" : "opposite direction"}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              judge has R4T ahead on both metrics; the ratings do not
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Per-query means computed from <code>polyvore_gemma_responses.xlsx</code> and{" "}
        <code>polyvore_qwen_responses.xlsx</code> in{" "}
        <a
          href="https://github.com/pat-jj/r4t-rebuttal"
          className="underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
        >
          pat-jj/r4t-rebuttal
        </a>
        . Judge numbers are Table 1&rsquo;s (arXiv:2603.06397v1); only their direction is comparable.
      </figcaption>
    </figure>
  )
}
