"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The switch/__LINE__ coroutine drawn as the state machine it really is. Each call to
// next() dispatches on the saved `state`: the first call runs the loop body and yields,
// and every later call jumps straight back into the middle of the switch (case 6) —
// that back-edge is the whole trick. Step the trace and watch the active node + the
// transition light up. Degrades gracefully: prose + code already explain it; this is
// the signature interactive.

type Frame = {
  line: number
  state: string
  note: string
  emit?: string
  ret?: boolean
}

// A hand-authored trace of three calls to next() returning 0, 1, 2, then -1.
const FRAMES: Frame[] = [
  { line: 2, state: "0", note: "call #1 — state is 0" },
  { line: 3, state: "0", note: "switch (state) → jump to case 0" },
  { line: 4, state: "0", note: "case 0: enter the function body" },
  { line: 5, state: "0", note: "for: i = 0, 0 < 3 ✓" },
  { line: 6, state: "6", note: "save state = __LINE__ (6), then return 0", emit: "0", ret: true },
  { line: 3, state: "6", note: "call #2 — switch (state=6)" },
  { line: 7, state: "6", note: "jump straight to case 6 — mid-loop!" },
  { line: 5, state: "6", note: "for: i++ → 1, 1 < 3 ✓" },
  { line: 6, state: "6", note: "save state = 6, return 1", emit: "1", ret: true },
  { line: 3, state: "6", note: "call #3 — switch (state=6)" },
  { line: 7, state: "6", note: "resume at case 6 again" },
  { line: 5, state: "6", note: "for: i++ → 2, 2 < 3 ✓" },
  { line: 6, state: "6", note: "save state = 6, return 2", emit: "2", ret: true },
  { line: 5, state: "6", note: "call #4 — resume, i++ → 3, 3 < 3 ✗" },
  { line: 10, state: "6", note: "loop done; fall through to return -1", emit: "-1", ret: true },
]

type NodeId = "A" | "B" | "C" | "D" | "E"

function nodeIdOf(f: Frame): NodeId {
  switch (f.line) {
    case 2:
    case 4:
      return "A"
    case 3:
      return f.state === "0" ? "A" : "D"
    case 5:
      return "B"
    case 6:
      return "C"
    case 7:
      return "D"
    case 10:
      return "E"
    default:
      return "A"
  }
}

const NODES: { id: NodeId; x: number; y: number; w: number; h: number; t: string; s: string }[] = [
  { id: "A", x: 34, y: 127, w: 108, h: 46, t: "next()", s: "state = 0" },
  { id: "B", x: 196, y: 127, w: 108, h: 46, t: "for i < 3", s: "loop body" },
  { id: "C", x: 358, y: 127, w: 108, h: 46, t: "yield i", s: "save state=6" },
  { id: "D", x: 281, y: 43, w: 108, h: 46, t: "resume", s: "case 6" },
  { id: "E", x: 512, y: 127, w: 96, h: 46, t: "done", s: "return −1" },
]

const EDGES: { from: NodeId; to: NodeId; d: string; lx: number; ly: number; label: string; anchor?: "start" | "middle" | "end" }[] = [
  { from: "A", to: "B", d: "M142 150 C 160 158, 178 158, 196 150", lx: 169, ly: 143, label: "state 0" },
  { from: "B", to: "C", d: "M304 150 C 322 158, 340 158, 358 150", lx: 331, ly: 143, label: "i<3 · return i" },
  { from: "C", to: "D", d: "M412 127 C 412 96, 389 84, 389 78", lx: 430, ly: 108, label: "next call", anchor: "start" },
  { from: "D", to: "B", d: "M300 89 C 280 108, 255 112, 250 127", lx: 252, ly: 108, label: "case 6 · i++", anchor: "end" },
  { from: "B", to: "E", d: "M250 173 C 250 214, 545 214, 555 173", lx: 400, ly: 210, label: "i==3 · return −1", anchor: "middle" },
]

const ACC = "oklch(0.62 0.14 255)"
const W = 620
const H = 230

export function CoroutineStepper() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frame = FRAMES[i]
  const atEnd = i >= FRAMES.length - 1
  const emitted = FRAMES.slice(0, i + 1).filter((f) => f.emit).map((f) => f.emit)

  const active = nodeIdOf(frame)
  const prev = i > 0 ? nodeIdOf(FRAMES[i - 1]) : null
  const activeEdge = prev && prev !== active ? `${prev}-${active}` : null

  useEffect(() => {
    if (!playing || atEnd) return
    const t = setTimeout(() => setI((n) => n + 1), 1100)
    return () => clearTimeout(t)
  }, [playing, atEnd, i])

  const reset = () => {
    setPlaying(false)
    setI(0)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>next() as a state machine · a 0,1,2 generator</span>
        <span>step {i + 1}/{FRAMES.length}</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Coroutine state machine; current step: ${frame.note}`}>
          <defs>
            <marker id="cs-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6.5" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <marker id="cs-arrow-on" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6.5" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACC} strokeWidth={1.5} />
            </marker>
            <filter id="cs-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* edges */}
          {EDGES.map((e) => {
            const on = activeEdge === `${e.from}-${e.to}`
            return (
              <g key={`${e.from}-${e.to}`}>
                <path d={e.d} fill="none" stroke={on ? ACC : "var(--muted-foreground)"} strokeOpacity={on ? 0.95 : 0.4} strokeWidth={on ? 2 : 1.5} markerEnd={`url(#${on ? "cs-arrow-on" : "cs-arrow"})`} className="transition-all duration-300" />
                <text x={e.lx} y={e.ly} textAnchor={e.anchor ?? "middle"} className="font-mono" fontSize={9.5} fill={on ? ACC : "var(--muted-foreground)"} fillOpacity={on ? 1 : 0.75}>{e.label}</text>
              </g>
            )
          })}

          {/* nodes */}
          {NODES.map((nd) => {
            const on = active === nd.id
            return (
              <g key={nd.id} className="transition-all duration-300">
                <rect x={nd.x} y={nd.y} width={nd.w} height={nd.h} rx={10}
                  fill={on ? "color-mix(in oklch, oklch(0.62 0.14 255) 14%, var(--background))" : "var(--background)"}
                  stroke={on ? ACC : "var(--border)"} strokeWidth={on ? 1.75 : 1.25}
                  filter={on ? "url(#cs-soft)" : undefined} className="transition-all duration-300" />
                <text x={nd.x + nd.w / 2} y={nd.y + 20} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={600} fill={on ? "var(--foreground)" : "var(--muted-foreground)"}>{nd.t}</text>
                <text x={nd.x + nd.w / 2} y={nd.y + 35} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>{nd.s}</text>
              </g>
            )
          })}
        </svg>

        {/* live readout */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground">saved state <span className="font-semibold text-foreground">{frame.state}</span></span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">emitted <span className="font-semibold text-foreground">{emitted.length ? emitted.join(" ") : "—"}</span></span>
        </div>

        <div className="mt-1.5 font-mono text-[11px]">
          <span className={cn("text-muted-foreground", frame.ret && "text-foreground")}>
            {frame.ret ? "↩ " : "  "}{frame.note}
          </span>
        </div>

        {/* controls */}
        <div className="mt-3 flex items-center gap-3 border-t pt-3">
          <button type="button" onClick={() => setPlaying((p) => !p)} disabled={atEnd}
            className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {playing && !atEnd ? <PauseIcon size={13} weight="fill" /> : <PlayIcon size={13} weight="fill" />}
            {playing && !atEnd ? "pause" : "play"}
          </button>
          <button type="button" onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)) }} disabled={i === 0}
            className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
            ← prev
          </button>
          <button type="button" onClick={() => { setPlaying(false); setI((n) => Math.min(FRAMES.length - 1, n + 1)) }} disabled={atEnd}
            className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
            next →
          </button>
          <button type="button" onClick={reset}
            className="ml-auto flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ArrowCounterClockwiseIcon size={13} weight="bold" />
            reset
          </button>
        </div>
      </div>
    </figure>
  )
}
