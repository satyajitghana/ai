"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// GEPA's reflective evolutionary loop, drawn as a real cycle. A parent prompt is
// sampled from a Pareto frontier of candidates, run on a small minibatch, and its
// full execution trace + the evaluator's textual feedback are handed to a single
// reflective LLM call that writes an improved prompt in natural language. The child
// is scored; if it wins on any instance it rejoins the frontier, and the loop turns
// again. Step through the six stages. Illustrative — not a measured trace.

const ACCENT = "oklch(0.62 0.19 285)" // indigo — the active path
const MUTE = "var(--muted-foreground)"

const W = 780
const H = 360
const NW = 200 // node width
const NH = 52 // node height
const HH = NH / 2

type Node = { cx: number; cy: number; title: string; sub: string }

// 6 nodes on a rounded-rectangle "racetrack": top row L→R, bottom row R→L.
const NODES: Node[] = [
  { cx: 145, cy: 76, title: "Pareto frontier", sub: "pool of candidate prompts" }, // 0
  { cx: 390, cy: 76, title: "Sample a parent", sub: "pick from the frontier" }, //     1
  { cx: 635, cy: 76, title: "Run a minibatch", sub: "a few rollouts, not 1000s" }, //  2
  { cx: 635, cy: 284, title: "Collect the trace", sub: "+ textual feedback" }, //      3
  { cx: 390, cy: 284, title: "LLM reflects", sub: "→ proposes a mutation" }, //   4
  { cx: 145, cy: 284, title: "Evaluate + update", sub: "keep if it wins" }, //         5
]

const STAGE_TEXT = [
  "The candidate pool is a Pareto frontier — each prompt is the best the search has found on at least one task instance, so specialists survive next to all-rounders.",
  "Instead of always mutating the single best-on-average prompt, GEPA samples a parent from the frontier — keeping the search diverse and hard to trap in a local optimum.",
  "The parent system is run on a small minibatch of tasks: a handful of rollouts, where reinforcement learning would burn thousands.",
  "GEPA collects the full execution trace — reasoning, tool calls, tool outputs — plus the evaluator's natural-language feedback on exactly what went wrong.",
  "One reflective LLM call reads the trace and the feedback and writes a better prompt — diagnosing the failure in words, not in a scalar reward or a policy gradient.",
  "The child is scored on the minibatch; if it beats any frontier member on any instance it joins the frontier. Then the loop turns again.",
]

// left/right/top/bottom edges of a node
const L = (n: Node) => n.cx - NW / 2
const R = (n: Node) => n.cx + NW / 2
const T = (n: Node) => n.cy - HH
const B = (n: Node) => n.cy + HH

// horizontal connector, bows by `bow` (positive = upward)
function hCurve(x1: number, x2: number, y: number, bow: number) {
  const k = (x2 - x1) * 0.5
  return `M ${x1} ${y} C ${x1 + k} ${y - bow}, ${x2 - k} ${y - bow}, ${x2} ${y}`
}
// vertical connector, bows by `bow` (positive = rightward)
function vCurve(y1: number, y2: number, x: number, bow: number) {
  const k = (y2 - y1) * 0.5
  return `M ${x} ${y1} C ${x + bow} ${y1 + k}, ${x + bow} ${y2 - k}, ${x} ${y2}`
}

// edge i connects NODES[i] -> NODES[(i+1)%6]
const EDGES: string[] = [
  hCurve(R(NODES[0]), L(NODES[1]), NODES[0].cy, 18), // 0->1 top, bow up
  hCurve(R(NODES[1]), L(NODES[2]), NODES[1].cy, 18), // 1->2 top, bow up
  vCurve(B(NODES[2]), T(NODES[3]), NODES[2].cx, 20), // 2->3 right side, bow right
  hCurve(L(NODES[3]), R(NODES[4]), NODES[3].cy, -18), // 3->4 bottom, bow down
  hCurve(L(NODES[4]), R(NODES[5]), NODES[4].cy, -18), // 4->5 bottom, bow down
  vCurve(T(NODES[5]), B(NODES[0]), NODES[5].cx, -20), // 5->0 left side, bow left (return)
]

export function ReflectiveLoop() {
  const [stage, setStage] = useState(4) // default: the reflection step (the whole point)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>GEPA · one turn of the reflective loop</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`GEPA's reflective evolutionary loop: sample a parent from the Pareto frontier, run a minibatch, collect the execution trace and textual feedback, an LLM reflects to propose a mutation, evaluate and update the frontier, then repeat. Current stage: ${NODES[stage].title}.`}
        >
          <defs>
            <marker id="gepa-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="gepa-arrow-mute" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={MUTE} strokeWidth={1.5} opacity={0.55} />
            </marker>
            <filter id="gepa-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* connectors (behind nodes). The active edge = the one leaving the current stage. */}
          {EDGES.map((d, i) => {
            const active = i === stage
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={active ? ACCENT : MUTE}
                strokeWidth={active ? 2 : 1.5}
                opacity={active ? 0.95 : 0.32}
                strokeDasharray={i === 5 ? "5 4" : undefined}
                markerEnd={`url(#${active ? "gepa-arrow" : "gepa-arrow-mute"})`}
                className="transition-all duration-300"
              />
            )
          })}

          {/* center caption for the cycle */}
          <text x={390} y={176} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={11}>
            reflect &amp; evolve
          </text>
          <text x={390} y={192} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize={9}>
            a few rollouts per turn
          </text>

          {/* nodes */}
          {NODES.map((n, i) => {
            const active = i === stage
            return (
              <g key={i} className="transition-all duration-300">
                <rect
                  x={L(n)}
                  y={T(n)}
                  width={NW}
                  height={NH}
                  rx={10}
                  fill="var(--background)"
                  stroke={active ? ACCENT : "var(--border)"}
                  strokeWidth={active ? 2 : 1.5}
                  filter={active ? "url(#gepa-soft)" : undefined}
                  opacity={active ? 1 : 0.9}
                />
                <text
                  x={n.cx}
                  y={n.cy - 3}
                  textAnchor="middle"
                  fill={active ? ACCENT : "var(--foreground)"}
                  className="font-mono"
                  fontSize={12.5}
                  fontWeight={600}
                >
                  {n.title}
                </text>
                <text x={n.cx} y={n.cy + 13} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
                  {n.sub}
                </text>
                {/* step index badge */}
                <circle cx={L(n) + 14} cy={T(n) + 14} r={9} fill={active ? ACCENT : "var(--muted)"} />
                <text
                  x={L(n) + 14}
                  y={T(n) + 17.5}
                  textAnchor="middle"
                  fill={active ? "var(--background)" : "var(--muted-foreground)"}
                  className="font-mono"
                  fontSize={10}
                  fontWeight={600}
                >
                  {i + 1}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls: numbered step chips */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">step</span>
            {NODES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStage(i)}
                aria-pressed={stage === i}
                aria-label={`Stage ${i + 1}: ${NODES[i].title}`}
                className={cn(
                  "size-6 cursor-pointer rounded-md font-mono text-[11px] transition-colors",
                  stage === i ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={stage === i ? { background: ACCENT } : undefined}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStage((s) => (s + 5) % 6)}
              aria-label="Previous stage"
              className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              prev
            </button>
            <button
              type="button"
              onClick={() => setStage((s) => (s + 1) % 6)}
              aria-label="Next stage"
              className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              next
            </button>
          </div>
        </div>

        {/* stage readout — min-height reserved so stepping never shifts layout */}
        <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-muted-foreground sm:min-h-[3rem]">
          <span className="font-mono text-xs" style={{ color: ACCENT }}>
            {stage + 1}. {NODES[stage].title}
          </span>{" "}
          — {STAGE_TEXT[stage]}
        </p>
      </div>
    </figure>
  )
}
