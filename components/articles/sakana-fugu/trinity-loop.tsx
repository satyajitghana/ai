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

// TRINITY's cyclical coordination, made watchable. A <20K-parameter coordinator
// reads the small-model hidden state, and each turn assigns one agent from the
// pool a role — Thinker, Worker, or Verifier. The loop ends when the Verifier
// returns ACCEPT. Hand-authored trace of one depreciation problem.

const ROLE = {
  Thinker: { hue: 255, blurb: "plan / decompose / critique" },
  Worker: { hue: 150, blurb: "do the work — derive, compute, code" },
  Verifier: { hue: 65, blurb: "check correctness → ACCEPT / REVISE" },
} as const
type RoleName = keyof typeof ROLE

type Turn = {
  agent: string
  role: RoleName
  text: string
  verdict?: "ACCEPT" | "REVISE"
}

const TURNS: Turn[] = [
  {
    agent: "Gemini-2.5-Pro",
    role: "Thinker",
    text: "Decompose: straight-line depreciation = (cost − salvage) / life. Read off cost = 50000, salvage = 5000, life = 8.",
  },
  {
    agent: "GPT-5",
    role: "Worker",
    text: "Compute 50000 / 8 = 6250 per year.",
  },
  {
    agent: "Claude-4-Sonnet",
    role: "Verifier",
    text: "Salvage value was dropped — the formula subtracts salvage before dividing.",
    verdict: "REVISE",
  },
  {
    agent: "GPT-5",
    role: "Worker",
    text: "(50000 − 5000) / 8 = 45000 / 8 = 5625 per year.",
  },
  {
    agent: "Claude-4-Sonnet",
    role: "Verifier",
    text: "Formula and arithmetic check out: 8 × 5625 = 45000.",
    verdict: "ACCEPT",
  },
]

const color = (r: RoleName) => `oklch(0.72 0.14 ${ROLE[r].hue})`

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

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>TRINITY — coordinate a pool by role</span>
        <span>turn {i + 1}/{TURNS.length}</span>
      </div>

      {/* role legend */}
      <div className="flex flex-wrap gap-3 border-b px-4 py-2 font-mono text-[11px]">
        {(Object.keys(ROLE) as RoleName[]).map((r) => (
          <span key={r} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ background: color(r) }} />
            {r}
          </span>
        ))}
      </div>

      <div className="px-4 pt-3 pb-1 font-mono text-[11px] text-muted-foreground">
        problem: a $50,000 machine, $5,000 salvage, 8-year life — annual depreciation?
      </div>

      {/* current turn */}
      <div className="px-4 py-3">
        <div
          className="rounded-md border-l-2 bg-muted/30 px-3 py-2.5"
          style={{ borderColor: color(turn.role) }}
        >
          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: color(turn.role), color: "oklch(0.18 0 0)" }}
            >
              {turn.role}
            </span>
            <span className="text-muted-foreground">←</span>
            <span className="font-medium">{turn.agent}</span>
            <span className="text-[10px] text-muted-foreground">
              · {ROLE[turn.role].blurb}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6">{turn.text}</p>
          {turn.verdict ? (
            <div
              className={cn(
                "mt-2 flex items-center gap-1.5 font-mono text-xs font-medium",
                turn.verdict === "ACCEPT" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {turn.verdict === "ACCEPT" ? (
                <CheckCircleIcon size={14} weight="fill" />
              ) : (
                <WarningCircleIcon size={14} weight="fill" />
              )}
              {turn.verdict}
              {turn.verdict === "ACCEPT" ? " → terminate (answer: $5,625 / yr)" : " → loop continues"}
            </div>
          ) : null}
        </div>

        {/* transcript of prior turns */}
        {i > 0 ? (
          <div className="mt-3 space-y-1">
            {TURNS.slice(0, i).map((t, n) => (
              <div key={n} className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="text-muted-foreground/50">{n + 1}.</span>
                <span className="size-2 rounded-full" style={{ background: color(t.role) }} />
                <span className="w-16 shrink-0">{t.role}</span>
                <span className="truncate">{t.agent}{t.verdict ? ` · ${t.verdict}` : ""}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* controls */}
      <div className="flex items-center gap-3 border-t px-3 py-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={atEnd}
          className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing && !atEnd ? <PauseIcon size={13} weight="fill" /> : <PlayIcon size={13} weight="fill" />}
          {playing && !atEnd ? "pause" : "play"}
        </button>
        <button
          type="button"
          onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)) }}
          disabled={i === 0}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← prev
        </button>
        <button
          type="button"
          onClick={() => { setPlaying(false); setI((n) => Math.min(TURNS.length - 1, n + 1)) }}
          disabled={atEnd}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          next →
        </button>
        <button
          type="button"
          onClick={() => { setPlaying(false); setI(0) }}
          className="ml-auto flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowCounterClockwiseIcon size={13} weight="bold" />
          reset
        </button>
      </div>
    </figure>
  )
}
