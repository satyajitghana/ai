"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

// The doom loop, forming and breaking — the decision token.
//
// At the position where a reasoning trace either restarts a span ("Wait, let me
// reconsider…") or moves on, the model samples one next token. Two things happen
// in a base model:
//   1. Each repeat makes the span more likely — Liquid reports the loop token's
//      probability climbing 0.41 -> 0.92 -> ~0.98 across repeats (self-reinforcing
//      context). The distribution collapses onto one token.
//   2. Under greedy/low-temp decoding, argmax = the loop token, so there is no exit.
//
// FTPO retrains only this final position: it pushes the rejected loop token down
// and spreads probability across several plausible *chosen* alternatives. The
// collapse never happens; argmax lands on an exit token; the loop breaks.
//
// Numbers are illustrative but track the blog's reported first-token climb. Every
// value below is fixed/deterministic — the only moving part is a bounded step
// index (0..3). Timers live in useEffect. Safe to prerender.

const LOOP = "oklch(0.63 0.2 25)" // red — the overtrained loop token
const EXIT = "oklch(0.7 0.14 165)" // teal — a chosen / exit alternative

type Cand = { tok: string; loop?: boolean }
const CANDS: Cand[] = [
  { tok: "Wait", loop: true },
  { tok: "Let's" },
  { tok: "Yes" },
  { tok: "Ok" },
  { tok: "The answer is" },
]

// loop-token probability at repeat 1..4 — base climbs toward 1, FTPO stays flat & low
const P_LOOP_BASE = [0.41, 0.72, 0.92, 0.98]
const P_LOOP_FTPO = [0.12, 0.12, 0.12, 0.12]
// how the *remaining* mass splits across the 4 alternatives
const W_BASE = [0.3, 0.28, 0.22, 0.2] // base barely leaves any, and evenly
const W_FTPO = [0.24, 0.21, 0.19, 0.36] // ftpo keeps them substantial, tilts to the exit

const STEPS = 4

function distribution(mode: "base" | "ftpo", step: number): number[] {
  const pLoop = (mode === "base" ? P_LOOP_BASE : P_LOOP_FTPO)[step]
  const w = mode === "base" ? W_BASE : W_FTPO
  const wsum = w[0] + w[1] + w[2] + w[3]
  const rest = 1 - pLoop
  return [pLoop, ...w.map((wi) => (rest * wi) / wsum)]
}

function argmax(p: number[]): number {
  let bi = 0
  for (let i = 1; i < p.length; i++) if (p[i] > p[bi]) bi = i
  return bi
}

const SPAN = "Wait, let me reconsider…"

export function DoomLoop() {
  const [mode, setMode] = useState<"base" | "ftpo">("base")
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!playing) return
    timer.current = setInterval(() => {
      setStep((s) => (s + 1) % STEPS)
    }, 1100)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing])

  const probs = distribution(mode, step)
  const pick = argmax(probs)
  const broke = mode === "ftpo" && !CANDS[pick].loop
  const maxP = Math.max(...probs)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>next-token distribution at the decision point</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* context tape — the span repeated (step+1) times */}
        <div className="mb-4">
          <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">
            context so far · {step + 1}× repeat
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: step + 1 }, (_, i) => (
              <span
                key={i}
                className="rounded-md border px-2 py-1 font-mono text-[11px] transition-all duration-300"
                style={{
                  borderColor: mode === "base" ? LOOP : "var(--border)",
                  color: mode === "base" ? LOOP : "var(--muted-foreground)",
                  opacity: 0.45 + (0.55 * (i + 1)) / (step + 1),
                }}
              >
                {SPAN}
              </span>
            ))}
          </div>
        </div>

        {/* distribution bars */}
        <div className="space-y-1.5">
          {CANDS.map((c, i) => {
            const p = probs[i]
            const isPick = i === pick
            const color = c.loop ? LOOP : EXIT
            return (
              <div key={c.tok} className="flex items-center gap-3">
                <span
                  className="w-24 shrink-0 truncate text-right font-mono text-[11px] sm:w-28"
                  style={{ color: c.loop ? LOOP : "var(--foreground)" }}
                >
                  {c.tok}
                </span>
                <div className="relative h-5 flex-1">
                  <div
                    className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm transition-all duration-500"
                    style={{
                      width: `${Math.max(p * 100, 1)}%`,
                      background: color,
                      opacity: isPick ? 0.95 : 0.4,
                      outline: isPick ? `2px solid ${color}` : "none",
                      outlineOffset: 2,
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[10px] tabular-nums text-muted-foreground"
                    style={{ left: `${Math.min(p * 100, 88)}%` }}
                  >
                    {(p * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* verdict */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
          <span className="text-muted-foreground">
            greedy argmax →{" "}
            <span style={{ color: CANDS[pick].loop ? LOOP : EXIT }}>
              &ldquo;{CANDS[pick].tok}&rdquo;
            </span>{" "}
            ({(maxP * 100).toFixed(0)}%)
          </span>
          <span
            className="rounded px-2 py-0.5"
            style={{
              background: broke ? EXIT : LOOP,
              color: "oklch(0.18 0 0)",
            }}
          >
            {broke ? "loop breaks — exits" : "loop continues — no exit"}
          </span>
        </div>

        {/* controls */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-3">
          <div className="flex items-center gap-1">
            {(["base", "ftpo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                  mode === m
                    ? "text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={mode === m ? { background: m === "ftpo" ? EXIT : LOOP } : undefined}
              >
                {m === "base" ? "base model" : "after FTPO"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">repeat</span>
            {[0, 1, 2, 3].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setStep(s)
                }}
                aria-pressed={step === s}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  step === s
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {s + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="ml-auto cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {playing ? "pause" : "play ▸"}
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          In the <span className="text-foreground">base model</span>, each repeat feeds
          the same span back into context, so the loop token{" "}
          <span style={{ color: LOOP }}>&ldquo;Wait&rdquo;</span> climbs from ~41% to ~98%.
          The distribution collapses onto one token, and greedy decoding has nowhere else
          to go. <span className="text-foreground">After FTPO</span>, that final position is
          retrained: &ldquo;Wait&rdquo; is held down and probability is spread across
          several <span style={{ color: EXIT }}>chosen alternatives</span>, so the argmax
          lands on an exit token and the loop never tightens.
        </p>
      </div>
    </figure>
  )
}
