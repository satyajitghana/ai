"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The control surface that separates Qwen-Audio-3.0-TTS from a plain read-aloud
// model: a free-style natural-language instruction sets the overall delivery
// (role, emotion, rate, timbre, accent), while 86 fine-grained inline tags drop
// non-verbal events — laughter, breathing, sighing, coughing — at the word level
// inside the text itself. Switch the instruction and watch the same script's
// intended delivery change; the [tags] stay put and fire where they sit.

const ACCENT = "oklch(0.6 0.18 300)" // violet

const INSTRUCTIONS = [
  { label: "warm narrator", desc: "measured pace, low pitch, gentle affect — an audiobook register" },
  { label: "excited, fast", desc: "raised pitch and rate, energetic stress on the key words" },
  { label: "whispered", desc: "breathy low-energy phonation, close and intimate" },
  { label: "customer service", desc: "bright, even, professionally friendly, crisply enunciated" },
]

// the script, split so inline tags render as chips
const SCRIPT: Array<{ t: string; tag?: boolean }> = [
  { t: "So — " },
  { t: "[breath]", tag: true },
  { t: " here's the thing. " },
  { t: "[laughter]", tag: true },
  { t: " It actually worked. " },
  { t: "[sigh]", tag: true },
  { t: " Finally." },
]

export function InlineControl() {
  const [i, setI] = useState(1)
  const instr = INSTRUCTIONS[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        instruction + inline tags · say what, and how, separately
      </div>
      <div className="p-3 sm:p-4">
        {/* instruction chips */}
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">
          natural-language instruction
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INSTRUCTIONS.map((ins, idx) => {
            const on = idx === i
            return (
              <button
                key={ins.label}
                type="button"
                onClick={() => setI(idx)}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                  on
                    ? "border-transparent text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={on ? { background: ACCENT } : undefined}
              >
                {ins.label}
              </button>
            )
          })}
        </div>

        {/* script with inline tag chips */}
        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">script</div>
          <p className="text-[15px] leading-8 text-foreground">
            {SCRIPT.map((seg, si) =>
              seg.tag ? (
                <span
                  key={si}
                  className="mx-0.5 rounded px-1 py-0.5 font-mono text-[11px]"
                  style={{
                    background: `color-mix(in oklch, ${ACCENT} 16%, transparent)`,
                    color: ACCENT,
                  }}
                >
                  {seg.t}
                </span>
              ) : (
                <span key={si}>{seg.t}</span>
              ),
            )}
          </p>
        </div>

        <div className="mt-3 font-mono text-[11px]">
          <span className="text-muted-foreground">delivery · </span>
          <span style={{ color: ACCENT }}>{instr.label}</span>
          <span className="text-muted-foreground"> — {instr.desc}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The instruction re-colors the whole line — pitch, rate, affect — without touching a word
          of the text. The <span style={{ color: ACCENT }}>[tags]</span> are separate: 86 of them,
          placed inline, fire non-verbal events exactly where they sit. Content, global style, and
          punctuated non-verbals are three independent knobs, which is what "controllable" actually
          has to mean.
        </p>
      </div>
    </figure>
  )
}
