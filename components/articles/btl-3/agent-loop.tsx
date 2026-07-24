"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// BTL-3's agent turn, drawn as the loop it was RL-tuned to run. A turn is
// reason -> route -> (act on tools | answer directly) -> observe -> recover ->
// back to reason, and the distinctive move is the ROUTE decision: BTL-3 is
// tuned to *not* call a tool when none is needed (BFCL "irrelevance") and to
// stop when the task is done. Pick a scenario; the path the model takes lights
// up and the matching self-reported BFCL score is shown. Illustrative — the
// arrows are the behaviour, not a trace of any one run. SSR-safe: no time/random,
// fixed geometry.

const ACCENT = "oklch(0.60 0.18 275)" // indigo

type Scen = "simple" | "parallel" | "recover" | "irrelevance"

const SCEN: Record<
  Scen,
  { label: string; nodes: string[]; edges: string[]; toolSub: string; readout: string; score: string }
> = {
  simple: {
    label: "one tool",
    nodes: ["reason", "route", "tool", "observe", "done"],
    edges: ["r-ro", "ro-t", "t-o", "o-done"],
    toolSub: "1 call · single",
    readout: "BFCL Simple",
    score: "93.2%",
  },
  parallel: {
    label: "parallel tools",
    nodes: ["reason", "route", "tool", "observe", "done"],
    edges: ["r-ro", "ro-t", "t-o", "o-done"],
    toolSub: "3 calls · parallel",
    readout: "BFCL Parallel",
    score: "87.0%",
  },
  recover: {
    label: "recover",
    nodes: ["reason", "route", "tool", "observe", "recover", "done"],
    edges: ["r-ro", "ro-t", "t-o", "o-rec", "rec-r", "o-done"],
    toolSub: "call · then failure",
    readout: "failure recovery",
    score: "retry loop",
  },
  irrelevance: {
    label: "no tool",
    nodes: ["reason", "route", "done"],
    edges: ["r-ro", "ro-done"],
    toolSub: "— skipped",
    readout: "BFCL Irrelevance",
    score: "91.2%",
  },
}

type Node = { id: string; x: number; y: number; w: number; h: number; label: string; sub: string }

const NODES: Node[] = [
  { id: "reason", x: 45, y: 130, w: 132, h: 44, label: "reason", sub: "thinking mode" },
  { id: "route", x: 210, y: 130, w: 104, h: 44, label: "route", sub: "act or answer" },
  { id: "tool", x: 392, y: 130, w: 176, h: 44, label: "tool call", sub: "1 call · single" },
  { id: "observe", x: 392, y: 224, w: 176, h: 44, label: "observe", sub: "inspect result" },
  { id: "recover", x: 210, y: 224, w: 104, h: 44, label: "recover", sub: "on failure" },
  { id: "done", x: 584, y: 40, w: 140, h: 44, label: "answer · stop", sub: "no action needed" },
]

const EDGES: Record<string, string> = {
  "r-ro": "M 177 152 C 190 152, 197 152, 210 152",
  "ro-t": "M 314 152 C 340 152, 366 152, 392 152",
  "ro-done": "M 262 130 C 380 80, 480 84, 596 84",
  "t-o": "M 480 174 C 480 195, 480 204, 480 224",
  "o-done": "M 568 246 C 662 246, 700 158, 692 84",
  "o-rec": "M 392 246 C 366 246, 340 246, 314 246",
  "rec-r": "M 210 246 C 150 246, 111 210, 111 174",
}

export function AgentLoop() {
  const [scen, setScen] = useState<Scen>("simple")
  const cfg = SCEN[scen]
  const activeNodes = new Set(cfg.nodes)
  const activeEdges = new Set(cfg.edges)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>agent turn · reason → act → observe → stop</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 760 300"
          className="w-full"
          role="img"
          aria-label={`BTL-3 agent loop, scenario: ${cfg.label}. The model reasons, routes, and ${
            scen === "irrelevance"
              ? "answers directly without calling a tool"
              : scen === "recover"
                ? "recovers from a failed tool call before finishing"
                : "calls tools, observes results, then stops"
          }.`}
        >
          <defs>
            <marker id="btl-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="btl-arrow-dim" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--border)" strokeWidth={1.5} />
            </marker>
            <filter id="btl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* branch labels near the route fork */}
          <text x={352} y={104} className="fill-muted-foreground/70 font-mono" fontSize={9}>
            no tool needed
          </text>
          <text x={330} y={144} className="fill-muted-foreground/70 font-mono" fontSize={9}>
            call
          </text>

          {/* connectors (behind nodes) */}
          {Object.entries(EDGES).map(([id, d]) => {
            const on = activeEdges.has(id)
            return (
              <path
                key={id}
                d={d}
                fill="none"
                stroke={on ? ACCENT : "var(--border)"}
                strokeWidth={1.5}
                strokeDasharray={id === "rec-r" || id === "o-rec" ? "4 3" : undefined}
                markerEnd={`url(#${on ? "btl-arrow" : "btl-arrow-dim"})`}
                opacity={on ? 0.9 : 0.28}
                className="transition-all duration-300"
              />
            )
          })}

          {/* nodes */}
          {NODES.map((n) => {
            const on = activeNodes.has(n.id)
            const sub = n.id === "tool" ? cfg.toolSub : n.sub
            const cx = n.x + n.w / 2
            const cy = n.y + n.h / 2
            return (
              <g key={n.id} className="transition-all duration-300">
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={9}
                  fill="var(--background)"
                  stroke={on ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  opacity={on ? 1 : 0.5}
                  filter={on ? "url(#btl-soft)" : undefined}
                />
                <text
                  x={cx}
                  y={cy - 3}
                  textAnchor="middle"
                  className={on ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={12}
                  fontWeight={600}
                >
                  {n.label}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9} opacity={on ? 0.9 : 0.5}>
                  {sub}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">scenario</span>
            {(Object.keys(SCEN) as Scen[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScen(s)}
                aria-pressed={scen === s}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  scen === s ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={scen === s ? { background: ACCENT } : undefined}
              >
                {SCEN[s].label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {cfg.readout} <span style={{ color: ACCENT }}>{cfg.score}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every turn runs the same loop, but the <span className="text-foreground">route</span> step decides what happens next.
          When a task needs tools, BTL-3 emits one or many calls, <span className="text-foreground">observes</span> the results, and{" "}
          <span style={{ color: ACCENT }}>recovers</span> if one fails. When none is needed it answers directly and stops —
          the behaviour BFCL scores as <span className="text-foreground">irrelevance</span>. All scores are Bad Theory Labs&rsquo; own.
        </p>
      </div>
    </figure>
  )
}
