"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 8 of the Ultramarine blog, row by row, against one comparator at a time.
//
// The launch line is "similar performance to Fable 5". On the eight rows the
// blog publishes, Ultramarine is ahead of Claude Fable 5 on four and behind on
// four, and two of the six knowledge-work rows are benchmarks Paper Instruments
// built and graded themselves (PI Knowledge Work, DiligenceBench). The "own"
// filter drops those two, so the tally a reader sees is the one on other
// people's benchmarks.
//
// Every score is transcribed from Table 8. `src` is who produced the comparator
// numbers, from the blog's "Notes to Evaluations".

const WIN = "oklch(0.55 0.16 155)"
const LOSS = "oklch(0.58 0.19 27)"
const UM = "oklch(0.45 0.2 268)"

type Row = {
  name: string
  cat: "knowledge" | "coding"
  own: boolean
  um: number
  glm: number
  fable: number
  src: string
}

const ROWS: Row[] = [
  { name: "JobBench", cat: "knowledge", own: false, um: 62.9, glm: 56.3, fable: 57.4, src: "Fable from leaderboard; GLM run by PI" },
  { name: "PI Knowledge Work", cat: "knowledge", own: true, um: 59.3, glm: 52.0, fable: 57.8, src: "PI's internal suite; all runs by PI" },
  { name: "FrontierFinance", cat: "knowledge", own: false, um: 53.3, glm: 50.7, fable: 49.2, src: "Fable from leaderboard; GLM run by PI" },
  { name: "AutomationBench", cat: "knowledge", own: false, um: 50.2, glm: 48.8, fable: 46.2, src: "Fable and GLM as their developers report" },
  { name: "DiligenceBench", cat: "knowledge", own: true, um: 50.6, glm: 48.2, fable: 52.9, src: "PI's own benchmark; all runs by PI" },
  { name: "APEX-Agents 1.1", cat: "knowledge", own: false, um: 57.0, glm: 52.8, fable: 63.6, src: "Fable from leaderboard; GLM public score" },
  { name: "Terminal-Bench 2.1", cat: "coding", own: false, um: 83.2, glm: 84.3, fable: 84.3, src: "comparators as developers report" },
  { name: "DeepSWE 1.1", cat: "coding", own: false, um: 61.5, glm: 63.4, fable: 69.9, src: "Fable from leaderboard" },
]

type Vs = "fable" | "glm"
type Sort = "table" | "gap"

const VS_LABEL: Record<Vs, string> = { fable: "Claude Fable 5", glm: "GLM-5.3 Flash (base)" }

const fmt = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(1)}`

export function WhereItWins() {
  const [vs, setVs] = useState<Vs>("fable")
  const [sort, setSort] = useState<Sort>("gap")
  const [hideOwn, setHideOwn] = useState(false)

  const rows = ROWS.filter((r) => !(hideOwn && r.own)).map((r) => {
    const them = vs === "fable" ? r.fable : r.glm
    // one decimal place of published scores; round the difference so 0.1-step
    // gaps do not print as 1.0999999
    const gap = Math.round((r.um - them) * 10) / 10
    return { ...r, them, gap }
  })
  const shown = sort === "gap" ? [...rows].sort((a, b) => b.gap - a.gap) : rows

  const kw = rows.filter((r) => r.cat === "knowledge")
  const ahead = kw.filter((r) => r.gap > 0).length
  const meanKw = kw.length ? Math.round((kw.reduce((s, r) => s + r.gap, 0) / kw.length) * 100) / 100 : 0
  const allAhead = rows.filter((r) => r.gap > 0).length

  const W = 700
  const ROW_H = 30
  const H = shown.length * ROW_H + 10
  const MID = 470
  const SCALE = 14 // px per point; the widest gap, DeepSWE vs Fable at -8.4, is 118 px

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Ultramarine 1 Flash minus {VS_LABEL[vs]}</span>
        <span className="font-mono text-[10px]" style={{ color: ahead * 2 > kw.length ? WIN : LOSS }}>
          ahead on {ahead} of {kw.length} knowledge-work rows · mean {fmt(meanKw)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(VS_LABEL) as Vs[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setVs(k)}
              aria-pressed={vs === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                vs === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              vs {VS_LABEL[k]}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground/40">|</span>
          <button
            type="button"
            onClick={() => setSort(sort === "gap" ? "table" : "gap")}
            className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            sort: {sort === "gap" ? "by gap" : "table order"}
          </button>
          <button
            type="button"
            onClick={() => setHideOwn(!hideOwn)}
            aria-pressed={hideOwn}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              hideOwn
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {hideOwn ? "showing others' benchmarks only" : "hide PI's own benchmarks"}
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              {`A diverging bar chart of Ultramarine 1 Flash minus ${VS_LABEL[vs]} on ${rows.length} benchmarks. Ultramarine is ahead on ${allAhead} and behind or level on ${rows.length - allAhead}.`}
            </title>
            <line x1={MID} y1={2} x2={MID} y2={H - 4} stroke="currentColor" strokeOpacity={0.3} />
            {shown.map((r, i) => {
              const y = 4 + i * ROW_H
              const colour = r.gap > 0 ? WIN : r.gap < 0 ? LOSS : "currentColor"
              const w = Math.abs(r.gap) * SCALE
              return (
                <g key={r.name}>
                  <text x={4} y={y + 11} fontSize={9.5} fill="currentColor" fillOpacity={0.9} fontFamily="ui-monospace, monospace">
                    {r.name}
                    {r.own ? " ·own" : ""}
                    {r.cat === "coding" ? " ·code" : ""}
                  </text>
                  <text x={4} y={y + 23} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                    {r.src}
                  </text>
                  <text x={MID - 130} y={y + 15} fontSize={9} textAnchor="end" fontFamily="ui-monospace, monospace">
                    <tspan fill={UM}>{r.um.toFixed(1)}</tspan>
                    <tspan fill="currentColor" fillOpacity={0.5}> vs {r.them.toFixed(1)}</tspan>
                  </text>
                  <rect
                    x={r.gap >= 0 ? MID : MID - w}
                    y={y + 7}
                    width={Math.max(2, w)}
                    height={12}
                    rx={2}
                    fill={colour}
                    fillOpacity={r.cat === "coding" ? 0.4 : 0.8}
                  />
                  <text x={W - 2} y={y + 17} fontSize={9} textAnchor="end" fill={colour} fontFamily="ui-monospace, monospace">
                    {fmt(r.gap)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          ·own = a benchmark Paper Instruments built and graded · ·code = reported &ldquo;for reference&rdquo;, not a
          target of the training · scores from Table 8 of the Ultramarine blog
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Against Fable 5 the knowledge-work rows split four to two, and the mean gap is about one point. The
          two losses are not small: APEX-Agents by 6.6, DiligenceBench by 2.3. Hide PI&rsquo;s own benchmarks and
          the tally is three of four, still one large loss.{" "}
          <span className="text-foreground">Switch to the base model</span> and the picture changes shape: six of
          six knowledge-work rows go up, by 4.1 on average, and both coding rows go down by one to two points.
          That is what targeted post-training looks like.
        </p>
      </div>
    </figure>
  )
}
