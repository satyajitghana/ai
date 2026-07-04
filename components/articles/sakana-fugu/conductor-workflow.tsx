"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Conductor's output, made legible. It emits three parallel lists —
// model_id (which agent), subtasks (a natural-language instruction), and
// access_list (which earlier outputs that agent may see). Those three lists ARE
// a workflow graph. Flip between the topologies the Conductor learns to produce
// and watch the same triple of lists redraw the DAG. Hover a node to trace its
// edges. The recursive topology draws its self-loop literally.

const AGENTS = [
  { name: "GPT-5", hue: 150 },
  { name: "Claude-4", hue: 25 },
  { name: "Gemini-2.5", hue: 255 },
  { name: "DeepSeek-R1", hue: 200 },
]
const SELF = -1 // the Conductor selecting itself as a worker
const agentColor = (i: number) =>
  i === SELF ? "oklch(0.7 0.17 320)" : `oklch(0.72 0.14 ${AGENTS[i].hue})`
const agentName = (i: number) => (i === SELF ? "Conductor" : AGENTS[i].name)

type Node = {
  id: string
  kind: "io" | "agent" | "self"
  agent?: number
  sub?: string
  x: number
  y: number
}

type Preset = {
  label: string
  h: number
  nodes: Node[]
  edges: [string, string][]
  loop?: string // node id that draws a recursive self-loop
  lists: { model_id: string; subtasks: string; access_list: string }
  caption: string
}

const PRESETS: Record<string, Preset> = {
  chain: {
    label: "chain",
    h: 250,
    nodes: [
      { id: "Q", kind: "io", x: 180, y: 24 },
      { id: "0", kind: "agent", agent: 2, sub: "plan an algorithm", x: 180, y: 96 },
      { id: "1", kind: "agent", agent: 0, sub: "implement in python", x: 180, y: 164 },
      { id: "A", kind: "io", x: 180, y: 230 },
    ],
    edges: [["Q", "0"], ["0", "1"], ["1", "A"]],
    lists: {
      model_id: "[2, 0]",
      subtasks: '["plan an algorithm", "implement in python"]',
      access_list: "[[], [\"all\"]]",
    },
    caption:
      "The simplest topology: a plan step feeds an implementation step. access_list = [[], [\"all\"]] means step 0 sees only the question, step 1 sees step 0's output.",
  },
  parallel: {
    label: "parallel + verify",
    h: 300,
    nodes: [
      { id: "Q", kind: "io", x: 180, y: 22 },
      { id: "0", kind: "agent", agent: 2, sub: "restate + translate", x: 180, y: 88 },
      { id: "1", kind: "agent", agent: 0, sub: "solve, approach A", x: 90, y: 160 },
      { id: "2", kind: "agent", agent: 3, sub: "solve, approach B", x: 270, y: 160 },
      { id: "3", kind: "agent", agent: 1, sub: "verify + merge", x: 180, y: 232 },
      { id: "A", kind: "io", x: 180, y: 282 },
    ],
    edges: [
      ["Q", "0"], ["0", "1"], ["0", "2"], ["0", "3"], ["1", "3"], ["2", "3"], ["3", "A"],
    ],
    lists: {
      model_id: "[2, 0, 3, 1]",
      subtasks: '["restate", "solve A", "solve B", "verify + merge"]',
      access_list: "[[], [0], [0], [\"all\"]]",
    },
    caption:
      "Two solvers run from the same setup, then a verifier with access \"all\" sees every prior output and merges them. The Conductor designs this branch-and-join itself — no human topology.",
  },
  recursive: {
    label: "recursive",
    h: 258,
    nodes: [
      { id: "Q", kind: "io", x: 180, y: 24 },
      { id: "0", kind: "agent", agent: 0, sub: "draft a solution", x: 180, y: 94 },
      { id: "1", kind: "self", agent: SELF, sub: "re-orchestrate", x: 180, y: 166 },
      { id: "A", kind: "io", x: 180, y: 234 },
    ],
    edges: [["Q", "0"], ["0", "1"], ["1", "A"]],
    loop: "1",
    lists: {
      model_id: "[0, C]",
      subtasks: '["draft a solution", "re-orchestrate + refine"]',
      access_list: "[[], [\"all\"]]",
    },
    caption:
      "The Conductor can name itself (C) as a worker. That spawns a fresh sub-workflow on the draft — a recursive topology (the self-loop) that turns inference depth into a tunable compute axis.",
  },
}

const NW = 140
const NH = 44
const IW = 104
const IH = 28

export function ConductorWorkflow() {
  const [key, setKey] = useState<keyof typeof PRESETS>("parallel")
  const [hover, setHover] = useState<string | null>(null)
  const preset = PRESETS[key]
  const node = (id: string) => preset.nodes.find((n) => n.id === id)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">three lists → one workflow</span>
        <div className="flex gap-1">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} type="button" onClick={() => setKey(k as keyof typeof PRESETS)} aria-pressed={k === key}
              className={cn("cursor-pointer rounded-md px-2 py-1 transition-colors",
                k === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-2">
        {/* the three lists */}
        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-6">
            <div><span className="text-muted-foreground">model_id&nbsp;&nbsp;&nbsp;= </span>{preset.lists.model_id}</div>
            <div><span className="text-muted-foreground">subtasks&nbsp;&nbsp;&nbsp;= </span>{preset.lists.subtasks}</div>
            <div><span className="text-muted-foreground">access_list = </span>{preset.lists.access_list}</div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
            {preset.nodes.filter((n) => n.kind !== "io").map((n) => (
              <span key={n.id} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: agentColor(n.agent!) }} />
                {n.id}: {agentName(n.agent!)}
              </span>
            ))}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{preset.caption}</p>
        </div>

        {/* the DAG */}
        <div>
          <svg viewBox={`0 0 360 ${preset.h}`} className="w-full" role="img" aria-label={`Conductor ${preset.label} workflow graph`}>
            <defs>
              <marker id="cw-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
              </marker>
              <filter id="cw-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
              </filter>
            </defs>

            {/* edges */}
            {preset.edges.map(([from, to], i) => {
              const a = node(from)
              const b = node(to)
              const sy = a.y + (a.kind === "io" ? IH : NH) / 2
              const ty = b.y - (b.kind === "io" ? IH : NH) / 2
              const dy = Math.max((ty - sy) / 2, 10)
              const active = hover === null || hover === to || hover === from
              return (
                <path key={i}
                  d={`M ${a.x} ${sy} C ${a.x} ${sy + dy}, ${b.x} ${ty - dy}, ${b.x} ${ty}`}
                  fill="none" stroke="var(--muted-foreground)" strokeWidth={hover === to ? 2 : 1.3}
                  markerEnd="url(#cw-arrow)"
                  style={{ opacity: active ? 0.65 : 0.12, transition: "opacity 0.25s, stroke-width 0.25s" }} />
              )
            })}

            {/* recursive self-loop */}
            {preset.loop && (() => {
              const n = node(preset.loop)
              const rx = n.x + NW / 2
              const ry = n.y
              return (
                <path key="loop"
                  d={`M ${rx} ${ry - 8} C ${rx + 46} ${ry - 26}, ${rx + 46} ${ry + 26}, ${rx} ${ry + 8}`}
                  fill="none" stroke={agentColor(SELF)} strokeWidth={1.5} markerEnd="url(#cw-arrow)" opacity={0.8} />
              )
            })()}

            {/* nodes */}
            {preset.nodes.map((n) =>
              n.kind === "io" ? (
                <g key={n.id}>
                  <rect x={n.x - IW / 2} y={n.y - IH / 2} width={IW} height={IH} rx={14}
                    fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
                    {n.id === "Q" ? "user question" : "final answer"}
                  </text>
                </g>
              ) : (
                <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                  <rect x={n.x - NW / 2} y={n.y - NH / 2} width={NW} height={NH} rx={9}
                    fill="var(--background)" stroke={hover === n.id ? agentColor(n.agent!) : "var(--border)"}
                    strokeWidth={1.5} filter="url(#cw-soft)" className="transition-colors" />
                  <rect x={n.x - NW / 2} y={n.y - NH / 2 + 5} width={4} height={NH - 10} rx={2} fill={agentColor(n.agent!)} />
                  <text x={n.x - NW / 2 + 14} y={n.y - 3} className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
                    {n.kind === "self" ? "↻ " : ""}{agentName(n.agent!)}
                  </text>
                  <text x={n.x - NW / 2 + 14} y={n.y + 11} className="fill-muted-foreground font-mono" fontSize={9}>
                    {n.sub}
                  </text>
                </g>
              )
            )}
          </svg>
        </div>
      </div>
    </figure>
  )
}
