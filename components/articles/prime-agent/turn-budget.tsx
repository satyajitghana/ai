"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The concrete task from the article: "grep 200 files and summarize the hits."
// Left lane is a schema-based tool-call agent (one grep call, then one
// read-or-inspect round trip per matching file, then a final summarize call).
// Right lane is an RLM turn: the grep, the read, and the aggregation all
// happen as Python inside one persistent cell, so the model only round-trips
// once. Round-trip and token counts below are an illustrative cost model, not
// a benchmark — Prime Agent publishes neither.

const TOOL = "oklch(0.63 0.19 25)"
const RLM = "oklch(0.60 0.15 255)"

const W = 720
const H = 210
const LANE_TOP_TOOL = 30
const LANE_TOP_RLM = 128
const DOT_R = 4
const ROW_MAX = 36 // dots per row before wrapping
const DOT_GAP = 16
const START_X = 40

function toolCallTurns(n: number): number {
  // 1 grep call + 1 inspect round trip per matching file + 1 final summarize call.
  return n + 2
}

function rlmTurns(): number {
  // A constant, small number of cells: explore, write the loop, run it.
  return 3
}

function toolCallTokens(n: number): number {
  // Each round trip repeats tool schemas + call/result envelopes.
  return 520 * (n + 2)
}

function rlmTokens(n: number): number {
  // One cell's code + a printed, human-picked slice of the output; grows
  // slowly with n because the model still has to look at *some* of it.
  return 1400 + 5 * n
}

function dotPositions(count: number): { x: number; y: number }[] {
  const shown = Math.min(count, ROW_MAX * 2)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(i / ROW_MAX)
    const col = i % ROW_MAX
    out.push({ x: START_X + col * DOT_GAP, y: row * 14 })
  }
  return out
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

export function TurnBudget() {
  const [n, setN] = useState(60)

  const toolTurns = toolCallTurns(n)
  const rlmTurnCount = rlmTurns()
  const toolTok = toolCallTokens(n)
  const rlmTok = rlmTokens(n)

  const toolDots = dotPositions(toolTurns)
  const toolOverflow = toolTurns - toolDots.length
  const rlmDots = dotPositions(rlmTurnCount)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>grep {n} files and summarize the hits · round trips</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Tool-call agent needs ${toolTurns} round trips for ${n} files; an RLM turn needs ${rlmTurnCount} regardless of file count`}
        >
          <defs>
            <filter id="pa-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* tool-call lane */}
          <text x={START_X} y={LANE_TOP_TOOL - 12} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            tool-call agent
          </text>
          <g transform={`translate(0, ${LANE_TOP_TOOL})`}>
            {toolDots.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={DOT_R} fill={TOOL} opacity={0.85} />
            ))}
            {toolOverflow > 0 ? (
              <text x={START_X + ROW_MAX * DOT_GAP + 4} y={14} className="fill-muted-foreground font-mono" fontSize={10}>
                +{toolOverflow} more
              </text>
            ) : null}
          </g>
          <text x={START_X} y={LANE_TOP_TOOL + 46} className="fill-muted-foreground font-mono" fontSize={10}>
            1 grep call + {n} per-file round trips + 1 summarize ={" "}
            <tspan className="fill-foreground" fontWeight={600}>{toolTurns} calls</tspan>
          </text>

          <line x1={0} y1={94} x2={W} y2={94} stroke="var(--border)" strokeWidth={1} />

          {/* RLM lane */}
          <text x={START_X} y={LANE_TOP_RLM - 12} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            RLM turn
          </text>
          <g transform={`translate(0, ${LANE_TOP_RLM})`}>
            {rlmDots.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={DOT_R} fill={RLM} filter="url(#pa-soft)" />
            ))}
          </g>
          <text x={START_X} y={LANE_TOP_RLM + 24} className="fill-muted-foreground font-mono" fontSize={10}>
            grep + read + aggregate run as Python inside one cell ={" "}
            <tspan className="fill-foreground" fontWeight={600}>{rlmTurnCount} calls</tspan>, any {n}
          </text>
        </svg>

        {/* controls */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>files matched</span>
            <span className="text-foreground">{n}</span>
          </div>
          <Range min={5} max={300} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer" accent={RLM} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[11px]">
          <div className={cn("rounded-md border p-2")} style={{ borderColor: TOOL }}>
            <div className="text-muted-foreground">tool-call agent</div>
            <div className="mt-0.5 text-foreground">{toolTurns} round trips</div>
            <div className="text-muted-foreground">~{fmt(toolTok)} tok</div>
          </div>
          <div className={cn("rounded-md border p-2")} style={{ borderColor: RLM }}>
            <div className="text-muted-foreground">RLM turn</div>
            <div className="mt-0.5 text-foreground">{rlmTurnCount} round trips</div>
            <div className="text-muted-foreground">~{fmt(rlmTok)} tok</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag the slider. A schema-based agent that grep{"'"}s then inspects each hit pays one round
          trip per file{" "}— the loop lives in the conversation, so the transcript grows with{" "}
          <span className="text-foreground">n</span>. An RLM turn writes the loop instead of living
          inside one: grep, read, and aggregation run as Python in a single cell, so the round-trip
          count stays flat and only the printed summary grows. The token and call counts here are a{" "}
          cost model to make the shape visible, not a measured benchmark.
        </p>
      </div>
    </figure>
  )
}
