"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Smart Turn v3.2 endpointing, drawn as a timeline, from the README's
// description and its four default values:
//
//   --speculative_reopen_ms            800   (complete turns)
//   --smart_turn_incomplete_delay_ms   600   (incomplete turns)
//   --smart_turn_max_wait_ms          2000   (output gate for incomplete)
//
// The mechanism: Silero decides speech ended. Smart Turn then classifies the
// turn as complete or incomplete using content and prosody. Either way STT and
// LLM work may start speculatively — the classification only decides how long
// to wait before committing, and whether resumed speech discards the work.

type Case = {
  id: string
  label: string
  verdict: string
  events: { at: number; len: number; what: string; kind: "audio" | "work" | "gate" | "out" | "discard" }[]
  read: string
}

const SCALE = 3200 // ms of timeline drawn

const CASES: Case[] = [
  {
    id: "complete",
    label: "complete turn",
    verdict: "Smart Turn agrees the turn ended",
    events: [
      { at: 0, len: 1200, what: "user speech", kind: "audio" },
      { at: 1200, len: 800, what: "STT + LLM start immediately · speculative_reopen_ms = 800", kind: "work" },
      { at: 2000, len: 900, what: "commit → TTS out", kind: "out" },
    ],
    read: "The fast path. Silero finalizes, Smart Turn confirms, and work begins at once. The 800 ms window is not idle waiting — STT and the LLM are already running inside it. It exists so that if the user resumes speaking, the turn can be reopened before anything has been spoken back at them.",
  },
  {
    id: "incomplete",
    label: "incomplete turn",
    verdict: "Smart Turn thinks the user is mid-thought",
    events: [
      { at: 0, len: 1000, what: "user speech", kind: "audio" },
      { at: 1000, len: 600, what: "hold · smart_turn_incomplete_delay_ms = 600", kind: "gate" },
      { at: 1600, len: 700, what: "STT + LLM start", kind: "work" },
      { at: 2300, len: 700, what: "output gated to smart_turn_max_wait_ms = 2000", kind: "out" },
    ],
    read: "A trailing \"so...\" or a rising intonation reads as unfinished, so the pipeline waits 600 ms before spending anything. Even once work starts, output stays gated by a 2-second ceiling from the endpoint — the system will not answer a sentence it believes is still being spoken, but it also will not wait forever if the user never resumes.",
  },
  {
    id: "reopen",
    label: "speech resumes",
    verdict: "the user carries on during the delay",
    events: [
      { at: 0, len: 1000, what: "user speech", kind: "audio" },
      { at: 1000, len: 500, what: "hold", kind: "gate" },
      { at: 1500, len: 400, what: "work started", kind: "work" },
      { at: 1900, len: 400, what: "speech resumes → revision N+1", kind: "discard" },
      { at: 2300, len: 900, what: "audio re-emitted, prior work discarded", kind: "audio" },
    ],
    read: "The case that makes the whole design safe. If speech resumes during either delay, the turn is reopened as a newer revision, the accumulated audio is re-emitted, and work from the previous revision is thrown away before it reaches the user. Speculation is only free if the wrong guesses are invisible, and revision numbering is what makes them invisible.",
  },
]

const COLORS: Record<string, string> = {
  audio: "oklch(0.62 0.03 250)",
  work: "oklch(0.60 0.15 255)",
  gate: "oklch(0.68 0.13 85)",
  out: "oklch(0.55 0.16 155)",
  discard: "oklch(0.58 0.19 25)",
}

export function SmartTurn() {
  const [sel, setSel] = useState(0)
  const c = CASES[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Smart Turn v3.2 · speculative endpointing</span>
        <span className="font-mono text-[10px] text-muted-foreground">quantized CPU ONNX, on by default</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CASES.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === sel
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {c.events.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative h-5 flex-1 rounded-sm bg-muted/30">
                <div
                  className="absolute inset-y-0 rounded-sm"
                  style={{
                    left: `${(e.at / SCALE) * 100}%`,
                    width: `${(e.len / SCALE) * 100}%`,
                    background: COLORS[e.kind],
                    opacity: e.kind === "gate" ? 0.55 : 1,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                {e.at}–{e.at + e.len}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-1.5 space-y-0.5">
          {c.events.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: COLORS[e.kind] }} />
              <span className="truncate font-mono text-[10px] text-muted-foreground">{e.what}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px] text-foreground">{c.verdict}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{c.read}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Silero decides <em>that</em> speech stopped; Smart Turn decides whether the person was{" "}
          <em>finished</em>, using content and prosody rather than silence alone. That distinction is most of what
          separates a voice agent that interrupts you from one that does not. The pipeline then does something
          slightly greedy: it starts STT and the LLM before it is sure, and relies on revision numbering to throw
          the work away if the guess was wrong. Latency you can reclaim, tokens you can waste — but only if a
          discarded revision can never be heard.
        </p>
      </div>
    </figure>
  )
}
