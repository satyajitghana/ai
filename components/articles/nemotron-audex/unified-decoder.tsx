"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Audex's central idea, made tangible: there is ONE decoder and ONE extended
// vocabulary (205,312 tokens). Text, speech, and general-audio tokens all live in
// the same softmax; the "task" just changes which token types show up in the
// output stream and which decoder is handed the discrete tokens at the end. Audio
// inputs enter as continuous embeddings (audio encoder + MLP adapters); audio
// outputs leave as discrete tokens (speech → XCodec2, general audio → XCodec1).
// Flip between tasks and watch the same backbone re-route its own token types.

type Mod = "text" | "speech" | "audio" | "wave"

const TEXT = "var(--muted-foreground)"
const SPEECH = "oklch(0.7 0.16 150)" // green
const AUDIO = "oklch(0.72 0.15 70)" // amber

const TASKS = [
  {
    key: "asr",
    label: "ASR",
    blurb: "speech → text",
    inMod: "wave" as Mod,
    inText: "audio in",
    out: ["text", "text", "text", "text", "text"] as Mod[],
    decoder: null,
    outText: "transcript",
  },
  {
    key: "tts",
    label: "TTS",
    blurb: "text → speech",
    inMod: "text" as Mod,
    inText: '"…the reactor is stable."',
    out: ["speech", "speech", "speech", "speech", "speech", "speech"] as Mod[],
    decoder: "Speech Decoder · XCodec2",
    outText: "speech",
  },
  {
    key: "tta",
    label: "Text→Audio",
    blurb: "text → general audio",
    inMod: "text" as Mod,
    inText: '"rain on a tin roof"',
    out: ["audio", "audio", "audio", "audio", "audio"] as Mod[],
    decoder: "Audio Decoder · XCodec1 + VAE",
    outText: "general audio",
  },
  {
    key: "s2s",
    label: "Speech→Speech",
    blurb: "spoken in, spoken out",
    inMod: "wave" as Mod,
    inText: "audio in",
    out: ["text", "text", "speech", "speech", "speech", "speech"] as Mod[],
    decoder: "Speech Decoder · XCodec2",
    outText: "speech reply",
  },
]

const modColor = (m: Mod) =>
  m === "speech" ? SPEECH : m === "audio" ? AUDIO : TEXT
const modLabel = (m: Mod) =>
  m === "speech" ? "sp" : m === "audio" ? "au" : "txt"

export function UnifiedDecoder() {
  const [k, setK] = useState("tts")
  const task = TASKS.find((t) => t.key === k) ?? TASKS[1]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        one decoder, one vocabulary · the task just re-routes the token types
      </div>
      <div className="p-3 sm:p-4">
        {/* task tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {TASKS.map((t) => {
            const on = t.key === k
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setK(t.key)}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                  on
                    ? "border-transparent text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={on ? { background: SPEECH } : undefined}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="grid items-stretch gap-2 sm:grid-cols-[auto_1fr_auto] sm:gap-3">
          {/* input */}
          <div className="flex flex-col justify-center rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] text-muted-foreground">
              input · {task.inMod === "wave" ? "audio encoder → adapters" : "text tokens"}
            </div>
            <div className="mt-1 font-mono text-xs text-foreground">{task.inText}</div>
          </div>

          {/* backbone + output token stream */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="rounded-md border border-dashed px-3 py-1.5 text-center font-mono text-[11px] text-muted-foreground">
              Nemotron-Cascade-2-30B-A3B · single decoder · 205,312-token vocab
            </div>
            <div className="mt-2.5 mb-1 font-mono text-[10px] text-muted-foreground">
              output token stream
            </div>
            <div className="flex flex-wrap gap-1">
              {task.out.map((m, i) => (
                <span
                  key={i}
                  className="flex h-6 min-w-9 items-center justify-center rounded-md px-1.5 font-mono text-[10px] text-white"
                  style={{ background: modColor(m) }}
                >
                  {modLabel(m)}
                </span>
              ))}
            </div>
          </div>

          {/* decoder + output modality */}
          <div className="flex flex-col justify-center rounded-lg border bg-muted/20 px-3 py-2.5">
            {task.decoder ? (
              <>
                <div className="font-mono text-[10px] text-muted-foreground">detokenize</div>
                <div className="mt-1 font-mono text-[11px] text-foreground">{task.decoder}</div>
                <div className="mt-1.5 font-mono text-[10px]" style={{ color: SPEECH }}>
                  → {task.outText}
                </div>
              </>
            ) : (
              <>
                <div className="font-mono text-[10px] text-muted-foreground">output</div>
                <div className="mt-1 font-mono text-xs text-foreground">{task.outText}</div>
                <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                  text tokens — no decoder
                </div>
              </>
            )}
          </div>
        </div>

        {/* legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(["text", "speech", "audio"] as Mod[]).map((m) => (
            <span key={m} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: modColor(m) }} />
              {m} token
            </span>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Nothing here is a bolted-on adapter head. The backbone emits{" "}
          <span style={{ color: SPEECH }}>speech</span> and{" "}
          <span style={{ color: AUDIO }}>audio</span> tokens from the same softmax it uses for{" "}
          <span className="text-foreground">text</span>, in one autoregressive stream — so a
          spoken-in / spoken-out turn is just a sequence that happens to switch token types
          partway through. That uniformity is what lets Audex keep its text brain while gaining
          ears and a voice.
        </p>
      </div>
    </figure>
  )
}
