"use client"

import { useEffect, useState } from "react"
import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  PauseIcon,
  PlayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// TRINITY's cyclical coordination, drawn as the loop it is. A <20K-parameter
// coordinator reads the small-model hidden state and each turn assigns one agent
// from the pool a role — Thinker → Worker → Verifier. The Verifier either loops
// back (REVISE, the curved edge back to Worker) or exits (ACCEPT). Step the turns
// and watch the active node and the edge taken light up. Hand-authored trace of
// one depreciation problem.

const ROLE = {
  Thinker: { hue: 255, blurb: "plan / decompose / critique" },
  Worker: { hue: 150, blurb: "do the work — derive, compute, code" },
  Verifier: { hue: 65, blurb: "check correctness → ACCEPT / REVISE" },
} as const
type RoleName = keyof typeof ROLE
const color = (r: RoleName) => `oklch(0.72 0.14 ${ROLE[r].hue})`

type Turn = {
  agent: string
  role: RoleName
  text: string
  verdict?: "ACCEPT" | "REVISE"
}

const TURNS: Turn[] = [
  { agent: "Gemini-2.5-Pro", role: "Thinker", text: "Decompose: straight-line depreciation = (cost − salvage) / life. Read off cost = 50000, salvage = 5000, life = 8." },
  { agent: "GPT-5", role: "Worker", text: "Compute 50000 / 8 = 6250 per year." },
  { agent: "Claude-4-Sonnet", role: "Verifier", text: "Salvage value was dropped — the formula subtracts salvage before dividing.", verdict: "REVISE" },
  { agent: "GPT-5", role: "Worker", text: "(50000 − 5000) / 8 = 45000 / 8 = 5625 per year." },
  { agent: "Claude-4-Sonnet", role: "Verifier", text: "Formula and arithmetic check out: 8 × 5625 = 45000.", verdict: "ACCEPT" },
]

// scene geometry (viewBox units) — a cycle: Thinker → Worker → Verifier → (loop)
const NODE: Record<RoleName, { x: number; y: number }> = {
  Thinker: { x: 130, y: 44 },
  Worker: { x: 110, y: 158 },
  Verifier: { x: 310, y: 158 },
}
const DONE = { x: 310, y: 44 }
const NW = 100
const NH = 34
// edge paths keyed by "from>to"
const EDGE: Record<string, string> = {
  "Thinker>Worker": "M 130 61 C 130 104, 110 104, 110 141",
  "Worker>Verifier": "M 160 158 C 205 158, 225 158, 260 158",
  "Verifier>Worker": "M 300 141 C 250 92, 170 92, 110 141",
  "Verifier>done": "M 310 141 C 310 110, 310 92, 310 58",
}

export function TrinityLoop() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const atEnd = i >= TURNS.length - 1

  useEffect(() => {
    if (!playing || atEnd) return
    const t = setTimeout(() => setI((n) => n + 1), 1700)
    return () => clearTimeout(t)
  }, [playing, atEnd, i])

  const turn = TURNS[i]
  const prev = i > 0 ? TURNS[i - 1] : null
  const activeEdge = prev ? `${prev.role}>${turn.role}` : null
  const acceptEdge = turn.verdict === "ACCEPT" ? "Verifier>done" : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>TRINITY — coordinate a pool by role</span>
        <span className="text-muted-foreground/60">turn {i + 1}/{TURNS.length}</span>
      </div>

      <div className="px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        problem: a $50,000 machine, $5,000 salvage, 8-year life — annual depreciation?
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 420 210" className="w-full" role="img"
          aria-label={`Role loop, turn ${i + 1}: ${turn.role} (${turn.agent})${turn.verdict ? " " + turn.verdict : ""}`}>
          <defs>
            <marker id="tl-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <marker id="tl-a" viewBox="0 -5 10 10" markerWidth="8" markerHeight="8" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--foreground)" strokeWidth={1.6} />
            </marker>
            <filter id="tl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* edges */}
          {Object.entries(EDGE).map(([id, d]) => {
            const on = id === activeEdge || id === acceptEdge
            return (
              <path key={id} d={d} fill="none" stroke={on ? "var(--foreground)" : "var(--muted-foreground)"}
                strokeWidth={on ? 2 : 1.3} markerEnd={`url(#${on ? "tl-a" : "tl-m"})`}
                strokeDasharray={id === "Verifier>Worker" ? "5 4" : undefined}
                style={{ opacity: on ? 1 : 0.22, transition: "opacity 0.3s, stroke-width 0.3s" }} />
            )
          })}
          {/* revise edge label */}
          <text x={205} y={86} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}
            opacity={activeEdge === "Verifier>Worker" ? 1 : 0.4}>REVISE</text>

          {/* role nodes */}
          {(Object.keys(NODE) as RoleName[]).map((r) => {
            const n = NODE[r]
            const on = r === turn.role
            return (
              <g key={r}>
                <rect x={n.x - NW / 2} y={n.y - NH / 2} width={NW} height={NH} rx={9}
                  fill={on ? color(r) : "var(--background)"} stroke={color(r)} strokeWidth={1.5}
                  filter={on ? "url(#tl-soft)" : undefined} className="transition-all duration-300" />
                <text x={n.x} y={n.y + 4} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={600}
                  fill={on ? "oklch(0.18 0 0)" : "var(--foreground)"}>{r}</text>
              </g>
            )
          })}

          {/* terminate node */}
          <g>
            <rect x={DONE.x - 44} y={DONE.y - 15} width={88} height={30} rx={15}
              fill={acceptEdge ? color("Verifier") : "var(--background)"} stroke={color("Verifier")} strokeWidth={1.5}
              filter={acceptEdge ? "url(#tl-soft)" : undefined} className="transition-all duration-300" />
            <text x={DONE.x} y={DONE.y + 4} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600}
              fill={acceptEdge ? "oklch(0.18 0 0)" : "var(--muted-foreground)"}>ACCEPT ✓</text>
          </g>
        </svg>

        {/* current turn — fixed min-height so the flip never shifts layout */}
        <div className="mt-2 min-h-[132px] rounded-md bg-muted/40 px-3 py-2.5"
          style={{ borderColor: color(turn.role) }}>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: color(turn.role), color: "oklch(0.18 0 0)" }}>{turn.role}</span>
            <span className="text-muted-foreground">←</span>
            <span className="font-medium">{turn.agent}</span>
            <span className="text-[10px] text-muted-foreground">· {ROLE[turn.role].blurb}</span>
          </div>
          <p className="mt-2 text-sm leading-6">{turn.text}</p>
          {turn.verdict ? (
            <div className={cn("mt-2 flex items-center gap-1.5 font-mono text-xs font-medium",
              turn.verdict === "ACCEPT" ? "text-foreground" : "text-muted-foreground")}>
              {turn.verdict === "ACCEPT" ? <CheckCircleIcon size={14} weight="fill" /> : <WarningCircleIcon size={14} weight="fill" />}
              {turn.verdict}
              {turn.verdict === "ACCEPT" ? " → terminate (answer: $5,625 / yr)" : " → loop continues"}
            </div>
          ) : null}
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center gap-3 border-t px-3 py-2">
        <button type="button" onClick={() => setPlaying((p) => !p)} disabled={atEnd}
          className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
          {playing && !atEnd ? <PauseIcon size={13} weight="fill" /> : <PlayIcon size={13} weight="fill" />}
          {playing && !atEnd ? "pause" : "play"}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)) }} disabled={i === 0}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
          ← prev
        </button>
        <button type="button" onClick={() => { setPlaying(false); setI((n) => Math.min(TURNS.length - 1, n + 1)) }} disabled={atEnd}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
          next →
        </button>
        <button type="button" onClick={() => { setPlaying(false); setI(0) }}
          className="ml-auto flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowCounterClockwiseIcon size={13} weight="bold" />
          reset
        </button>
      </div>
    </figure>
  )
}
