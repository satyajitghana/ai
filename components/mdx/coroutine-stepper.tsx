"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// An animated walk-through of a switch/__LINE__ coroutine. Each "frame" is one
// observable step: which source line is executing, what the saved `state` is,
// and what the function has emitted so far. Purpose-built for the coroutines
// article — it makes the "jump back into the middle of the switch" visible.
//
// Degrades gracefully: with no JS the article's prose + code already explain
// everything; this is progressive enhancement (the signature interactive bit).

type Frame = {
  line: number // 1-based index into CODE
  state: string // value of `state` after this step
  note: string // what just happened
  emit?: string // character emitted on this step (crReturn)
  ret?: boolean // this step returns to the caller
}

const CODE = [
  "int next(void) {",
  "  static int state = 0, i;",
  "  switch (state) {",
  "    case 0:",
  "      for (i = 0; i < 3; i++) {",
  "        state = __LINE__;  return i;",
  "        case __LINE__: ;",
  "      }",
  "  }",
  "  return -1;",
  "}",
]

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

export function CoroutineStepper() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frame = FRAMES[i]
  const atEnd = i >= FRAMES.length - 1
  const emitted = FRAMES.slice(0, i + 1)
    .filter((f) => f.emit)
    .map((f) => f.emit)

  // Only schedules the async advance — no synchronous setState in the effect.
  // "Stopped" is derived from `atEnd`, so playback simply stops at the last frame.
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
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>next() — a 0,1,2 generator</span>
        <span>
          step {i + 1}/{FRAMES.length}
        </span>
      </div>

      {/* Code with the live line highlighted */}
      <pre className="overflow-x-auto px-3 py-3 font-mono text-xs leading-6">
        {CODE.map((line, n) => {
          const active = frame.line === n + 1
          return (
            <div
              key={n}
              className={cn(
                "-mx-3 px-3 transition-colors",
                active && "bg-foreground/10 text-foreground"
              )}
            >
              <span className="mr-3 inline-block w-4 text-right text-muted-foreground/50 select-none">
                {n + 1}
              </span>
              {active ? (
                <span className="mr-1 text-foreground">▸</span>
              ) : (
                <span className="mr-1 opacity-0">▸</span>
              )}
              {line}
            </div>
          )
        })}
      </pre>

      {/* Live state readout */}
      <div className="grid grid-cols-2 gap-px border-t bg-border font-mono text-xs">
        <div className="bg-background px-3 py-2">
          <span className="text-muted-foreground">saved state: </span>
          <span className="font-semibold">{frame.state}</span>
        </div>
        <div className="bg-background px-3 py-2">
          <span className="text-muted-foreground">emitted: </span>
          <span className="font-semibold">
            {emitted.length ? emitted.join(" ") : "—"}
          </span>
        </div>
      </div>

      <div className="border-t px-3 py-2 font-mono text-xs">
        <span
          className={cn(
            "text-muted-foreground",
            frame.ret && "text-foreground"
          )}
        >
          {frame.ret ? "↩ " : "  "}
          {frame.note}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={atEnd}
          className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing && !atEnd ? (
            <PauseIcon size={13} weight="fill" />
          ) : (
            <PlayIcon size={13} weight="fill" />
          )}
          {playing && !atEnd ? "pause" : "play"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            setI((n) => Math.max(0, n - 1))
          }}
          disabled={i === 0}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← prev
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            setI((n) => Math.min(FRAMES.length - 1, n + 1))
          }}
          disabled={i >= FRAMES.length - 1}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          next →
        </button>
        <button
          type="button"
          onClick={reset}
          className="ml-auto flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowCounterClockwiseIcon size={13} weight="bold" />
          reset
        </button>
      </div>
    </figure>
  )
}
