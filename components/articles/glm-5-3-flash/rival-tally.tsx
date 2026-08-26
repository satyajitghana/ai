"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Z.ai's own table, scored head to head.
//
// The announcement says GLM-5.3-Flash is "approaching Claude Opus 4.8 on coding
// and agentic benchmarks", which turns out to undersell it: on the fourteen rows
// where both models have a number, GLM-5.3-Flash is ahead on nine. It is the
// comparison they do *not* frame that goes the other way — against Gemini 3.7
// Flash the general video and perception rows are a clean sweep in Gemini's
// favour, on a model whose headline is native multimodality.
//
// Numbers are transcribed from the benchmark table in the GLM-5.3-Flash post.
// Blank cells there are blank here; a row only counts when both models have one.
// GDPval-AA v2 is an Artificial Analysis rating rather than a percentage, so it
// is scored as a win/loss but never drawn on the percentage axis.

const WIN = "oklch(0.55 0.16 155)"
const LOSS = "oklch(0.58 0.19 27)"

type Row = { name: string; cat: "agentic" | "office" | "vision"; rating?: boolean; s: (number | null)[] }

// column order: GLM-5.3-Flash, GLM-5.2, DeepSeek-V4-Vision-Exp, Opus 4.8, GPT-5.6 Terra, Gemini 3.7 Flash
const RIVALS = [
  { i: 3, label: "Claude Opus 4.8" },
  { i: 4, label: "GPT-5.6 Terra" },
  { i: 5, label: "Gemini 3.7 Flash" },
  { i: 2, label: "DeepSeek-V4-Vision-Exp" },
  { i: 1, label: "GLM-5.2 (predecessor)" },
] as const

const ROWS: Row[] = [
  { name: "Terminal Bench 2.1", cat: "agentic", s: [84.3, 81, 83.9, 85, 87.4, 85.8] },
  { name: "DeepSWE v1.1", cat: "agentic", s: [63.4, 46.2, 59.3, 58, 69.6, 65.3] },
  { name: "NL2Repo", cat: "agentic", s: [56.3, 48.9, 57.7, 69.7, null, null] },
  { name: "Toolathlon Verified", cat: "agentic", s: [78.4, 59.9, 75.9, 76.2, 74.9, null] },
  { name: "AutomationBench v1.0.6", cat: "agentic", s: [48.8, 26.2, 38.8, 41, 37.2, 52.3] },
  { name: "Agents' Last Exam", cat: "agentic", s: [26.3, 20.4, 27.3, 27, 28, null] },
  { name: "HLE w/ tools", cat: "agentic", s: [55.3, 54.7, 55.1, 57.9, null, null] },
  { name: "GDPval-AA v2", cat: "office", rating: true, s: [1773, 1504, 1675, 1582, 1571, 1527] },
  { name: "OfficeQA Pro", cat: "office", s: [62.4, null, 57.9, 48.9, null, null] },
  { name: "CharXiv Reasoning", cat: "office", s: [89.4, null, 80.4, 89.9, 88, 88.7] },
  { name: "Chartography", cat: "office", s: [78, null, 64.3, 75, 68, 65] },
  { name: "BabyVision", cat: "vision", s: [53.4, null, 35.1, 46.8, 61.6, 70.9] },
  { name: "MVbench", cat: "vision", s: [77.8, null, 69.4, 67.1, 75, 82.2] },
  { name: "MMVU", cat: "vision", s: [80.5, null, 72.7, 67.4, 75.8, 82.3] },
]

const CAT_COLOUR: Record<string, string> = {
  agentic: "oklch(0.60 0.15 255)",
  office: "oklch(0.68 0.13 85)",
  vision: "oklch(0.55 0.10 300)",
}

const CATS = {
  agentic: "coding + agentic",
  office: "office + charts",
  vision: "video + perception",
} as const

export function RivalTally() {
  const [rival, setRival] = useState(3)
  const r = RIVALS.find((x) => x.i === rival)!

  const scored = ROWS.map((row) => {
    const mine = row.s[0]
    const theirs = row.s[rival]
    if (mine == null || theirs == null) return { row, mine, theirs, delta: null as number | null }
    return { row, mine, theirs, delta: mine - theirs }
  })
  const live = scored.filter((x) => x.delta !== null)
  const wins = live.filter((x) => (x.delta as number) > 0).length

  const byCat = (c: keyof typeof CATS) => {
    const set = live.filter((x) => x.row.cat === c)
    return { n: set.length, w: set.filter((x) => (x.delta as number) > 0).length }
  }

  const W = 700
  const ROW_H = 18
  const H = ROWS.length * ROW_H + 14
  const MID = 430
  // widest negative delta is NL2Repo at -13.4; at 6 px/point that bar starts at
  // MID-80, which clears the score column ending at MID-120
  const SCALE = 6

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          GLM-5.3-Flash minus {r.label}
        </span>
        <span className="font-mono text-[10px]" style={{ color: wins * 2 >= live.length ? WIN : LOSS }}>
          ahead on {wins} of {live.length} comparable rows
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {RIVALS.map((x) => (
            <button
              key={x.i}
              type="button"
              onClick={() => setRival(x.i)}
              aria-pressed={rival === x.i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                rival === x.i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(CATS) as (keyof typeof CATS)[]).map((c) => {
            const { n, w } = byCat(c)
            return (
              <div key={c} className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{CATS[c]}</div>
                <div
                  className="font-mono text-sm tabular-nums"
                  style={{ color: n === 0 ? "inherit" : w * 2 >= n ? WIN : LOSS }}
                >
                  {n ? `${w} / ${n} ahead` : "no shared rows"}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A diverging bar chart of GLM-5.3-Flash minus ${r.label} across ${live.length} shared benchmarks. GLM-5.3-Flash is ahead on ${wins} and behind on ${live.length - wins}.`}
            </title>
            <line x1={MID} y1={2} x2={MID} y2={H - 8} stroke="currentColor" strokeOpacity={0.3} />
            {scored.map((x, i) => {
              const y = 4 + i * ROW_H
              if (x.delta === null) {
                return (
                  <g key={x.row.name}>
                    <text x={14} y={y + 11} fontSize={8.5} fill="currentColor" fillOpacity={0.3} fontFamily="ui-monospace, monospace">
                      {x.row.name}
                    </text>
                    <text x={MID + 8} y={y + 11} fontSize={7.5} fill="currentColor" fillOpacity={0.3} fontFamily="ui-monospace, monospace">
                      not published for {r.label}
                    </text>
                  </g>
                )
              }
              const d = x.delta
              const colour = d > 0 ? WIN : LOSS
              // ratings live on a different scale; show them as a fixed-width marker
              const w = x.row.rating ? 26 : Math.min(200, Math.abs(d) * SCALE)
              return (
                <g key={x.row.name}>
                  <text x={14} y={y + 11} fontSize={8.5} fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    {x.row.name}
                  </text>
                  {/* a dot, not text: the category column collided with the scores */}
                  <rect
                    x={4}
                    y={y + 4}
                    width={5}
                    height={5}
                    rx={1}
                    fill={CAT_COLOUR[x.row.cat]}
                    fillOpacity={0.85}
                  />
                  <text x={MID - 120} y={y + 11} fontSize={7.5} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {x.mine} vs {x.theirs}
                  </text>
                  <rect
                    x={d > 0 ? MID : MID - w}
                    y={y + 3}
                    width={Math.max(2, w)}
                    height={10}
                    rx={2}
                    fill={colour}
                    fillOpacity={x.row.rating ? 0.4 : 0.78}
                  />
                  <text x={W - 2} y={y + 11} fontSize={8} textAnchor="end" fill={colour} fontFamily="ui-monospace, monospace">
                    {x.row.rating ? `${d > 0 ? "+" : ""}${d} pts` : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          GDPval-AA v2 is a rating, not a percentage — drawn at a fixed width and excluded from the
          bar scale
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Z.ai describe this as &ldquo;approaching Claude Opus 4.8&rdquo;, and on their own numbers
          that is modest to the point of being wrong:{" "}
          <span style={{ color: WIN }}>GLM-5.3-Flash is ahead on nine of the fourteen rows</span>{" "}
          where both have a score. The five it loses are worth naming though, because one is not
          close — NL2Repo, repository-scale code generation, at 56.3 against 69.7.
          <br />
          <br />
          Now switch to Gemini 3.7 Flash and read the bottom three rows.{" "}
          <span className="text-foreground">
            BabyVision, MVbench and MMVU all go the other way, and not narrowly
          </span>{" "}
          — 53.4 against 70.9 on BabyVision. Those are general video and perception, and this is a
          model whose headline claim is being the first natively multimodal GLM. The chart-and-document
          rows it wins comfortably; the see-the-world rows it does not. That is a real and specific
          shape, and no single &ldquo;approaching frontier&rdquo; sentence carries it.
        </p>
      </div>
    </figure>
  )
}
