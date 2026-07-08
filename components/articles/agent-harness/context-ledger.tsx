"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why a harness keeps durable state in files instead of stuffing everything into
// the prompt. Weng's point: experiment logs, diffs, error traces and past
// trajectories "often grow much longer than the context window the model has
// trained for." Step through the turns of a long task and watch two strategies
// diverge against a fixed context window:
//   - naive:  append every log / diff / trace to the prompt → grows unbounded
//   - files:  keep a bounded working set in context, spill the rest to disk
// Numbers are illustrative token counts (k = thousands), not a measured trace.
//
// SSR-safe: fixed-length arrays, no random, no timers, deterministic first render.

const ACC = "oklch(0.68 0.14 200)" // teal — file-backed working set
const OVER = "oklch(0.62 0.2 25)" // red — context overflow
const MUTE = "oklch(0.62 0.02 260)" // naive-but-still-fitting

const WINDOW = 200 // context window, in k tokens

// Per-turn state (k tokens). Eight turns of a long-horizon task.
const NAIVE = [40, 66, 92, 118, 150, 176, 204, 236] // everything in the prompt
const FILES = [40, 46, 44, 52, 48, 54, 50, 56] // bounded working set in context
const DISK = [8, 44, 92, 150, 205, 274, 352, 438] // durable artifacts on disk

const TURNS = NAIVE.length
const MAXBAR = 260 // bar scale ceiling (k tokens)

export function ContextLedger() {
  const [t, setT] = useState(0)

  const naive = NAIVE[t]
  const files = FILES[t]
  const disk = DISK[t]
  const overflow = naive > WINDOW

  const pct = (v: number) => `${Math.min((v / MAXBAR) * 100, 100)}%`
  const winPct = `${(WINDOW / MAXBAR) * 100}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>context budget over a long task · {WINDOW}k window</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* two bars against the window ceiling */}
        <div className="relative">
          {/* window ceiling marker */}
          <div className="absolute top-0 bottom-8 w-px border-l border-dashed" style={{ left: winPct, borderColor: OVER }} aria-hidden />
          <div className="absolute -top-0.5 font-mono text-[10px]" style={{ left: winPct, color: OVER, transform: "translateX(4px)" }}>
            {WINDOW}k window
          </div>

          <div className="space-y-3 pt-5">
            {/* naive */}
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:w-36">naive · all in prompt</span>
              <div className="relative h-6 flex-1 rounded bg-muted/40">
                <div
                  className="absolute top-0 left-0 h-full rounded transition-all duration-300"
                  style={{ width: pct(naive), background: overflow ? OVER : MUTE }}
                />
                <span
                  className={cn("absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] tabular-nums")}
                  style={{ left: pct(naive), color: overflow ? OVER : "var(--muted-foreground)" }}
                >
                  {naive}k{overflow ? " · overflow" : ""}
                </span>
              </div>
            </div>

            {/* files */}
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-right font-mono text-[11px] text-foreground sm:w-36">files · working set</span>
              <div className="relative h-6 flex-1 rounded bg-muted/40">
                <div
                  className="absolute top-0 left-0 h-full rounded transition-all duration-300"
                  style={{ width: pct(files), background: ACC }}
                />
                <span className="absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] tabular-nums" style={{ left: pct(files), color: ACC }}>
                  {files}k
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* turn slider */}
        <div className="mt-4 flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">turn</span>
          <input
            type="range"
            min={0}
            max={TURNS - 1}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded bg-muted accent-current"
            style={{ color: ACC }}
            aria-label="task turn"
          />
          <span className="w-10 text-right font-mono text-[11px] tabular-nums text-foreground">{t + 1}/{TURNS}</span>
        </div>

        {/* the durable-state readout */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="font-mono text-[10px] text-muted-foreground">on disk (durable)</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: ACC }}>{disk}k</div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="font-mono text-[10px] text-muted-foreground">in context (files)</div>
            <div className="font-mono text-lg tabular-nums text-foreground">{files}k</div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="font-mono text-[10px] text-muted-foreground">in context (naive)</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: overflow ? OVER : "var(--muted-foreground)" }}>{naive}k</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The naive prompt appends every log, diff, and trace, so it grows with the task and{" "}
          <span style={{ color: OVER }}>overflows the window</span> by turn 7 — the model starts losing the early details. The file-backed
          harness keeps a <span style={{ color: ACC }}>bounded working set</span> in context and spills the growing history to disk, where it
          stays retrievable with <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">grep</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">read</code>. Same task, flat context cost.
        </p>
      </div>
    </figure>
  )
}
