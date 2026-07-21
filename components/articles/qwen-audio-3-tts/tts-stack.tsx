"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Qwen-Audio-3.0-TTS is a two-model stack in the CosyVoice lineage: an
// autoregressive LM that predicts discrete speech tokens from text (+ a spoken
// reference for zero-shot cloning), then a flow-matching decoder that turns those
// tokens into a mel-spectrogram, then a vocoder that reconstructs — and
// super-resolves — the waveform to 48 kHz. The distinctive piece is the 12.5 Hz
// supervised tokenizer up front: few tokens per second means the LM decodes far
// fewer autoregressive steps. Click a stage to unpack it.

const ACCENT = "oklch(0.6 0.18 300)" // violet

const STAGES = [
  {
    key: "text",
    label: "text + instruction",
    sub: "role · emotion · rate · tags",
    detail:
      "Free-style natural-language instructions set role, emotion, speaking style, rate, timbre, and accent, and 86 fine-grained inline tags place non-verbal events — laughter, breathing, coughing, sighing — down to the word.",
  },
  {
    key: "tok",
    label: "12.5 Hz tokenizer",
    sub: "supervised, low-frame-rate",
    detail:
      "A supervised speech tokenizer running at 12.5 frames per second. Few tokens per second of audio means the autoregressive LM takes far fewer decode steps, cutting latency while still carrying content and speaker identity.",
  },
  {
    key: "lm",
    label: "LM (autoregressive)",
    sub: "predicts speech tokens",
    detail:
      "The language model generates the discrete speech-token sequence from the text and instruction, conditioned on a reference clip for zero-shot voice cloning. Robust even when the reference is noisy or reverberant — no explicit denoising.",
  },
  {
    key: "fm",
    label: "flow-matching decoder",
    sub: "tokens → mel",
    detail:
      "A flow-matching (FM) model maps the discrete speech tokens to a continuous mel-spectrogram, carrying timbre and prosody. It gets its own robustness stage and RL stage in training, which is what hardens generation against degraded prompts.",
  },
  {
    key: "voc",
    label: "vocoder + super-res",
    sub: "mel → 48 kHz",
    detail:
      "The vocoder reconstructs the waveform from the mel and super-resolves it to 48 kHz output. One pass can synthesize long-form speech up to three minutes.",
  },
]

export function TtsStack() {
  const [k, setK] = useState("tok")
  const [clone, setClone] = useState(true)
  const active = STAGES.find((s) => s.key === k) ?? STAGES[1]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        the stack · text → tokens → mel → 48 kHz waveform
      </div>
      <div className="p-3 sm:p-4">
        {/* pipeline */}
        <div className="flex flex-wrap items-stretch gap-1.5">
          {STAGES.map((s, i) => {
            const on = s.key === k
            const dimClone = !clone && (s.key === "tok" || s.key === "lm")
            return (
              <div key={s.key} className="flex items-stretch gap-1.5">
                <button
                  type="button"
                  onClick={() => setK(s.key)}
                  aria-pressed={on}
                  className={cn(
                    "cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors",
                    on ? "bg-muted/40" : "bg-muted/10 hover:bg-muted/25",
                  )}
                  style={on ? { borderColor: ACCENT } : undefined}
                >
                  <div
                    className="font-mono text-[11px]"
                    style={{ color: on ? ACCENT : "var(--foreground)" }}
                  >
                    {s.label}
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                    {s.sub}
                    {dimClone ? " · +ref" : ""}
                  </div>
                </button>
                {i < STAGES.length - 1 ? (
                  <span className="flex items-center font-mono text-muted-foreground/50">
                    →
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* zero-shot reference path toggle */}
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <button
            type="button"
            onClick={() => setClone((c) => !c)}
            aria-pressed={clone}
            className="cursor-pointer rounded-full border px-2 py-0.5 transition-colors hover:text-foreground"
            style={clone ? { borderColor: ACCENT, color: ACCENT } : undefined}
          >
            zero-shot clone {clone ? "on" : "off"}
          </button>
          <span>
            {clone
              ? "a reference clip conditions the tokenizer + LM to copy an unseen voice"
              : "no reference — the LM speaks in a default voice"}
          </span>
        </div>

        {/* detail panel */}
        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="font-mono text-[11px]" style={{ color: ACCENT }}>
            {active.label}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{active.detail}</p>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two models, trained in five stages: the LM and the flow-matching decoder are pretrained
          independently, jointly annealed on high-quality data, then each gets its own
          reinforcement-learning pass (plus a robustness stage for the decoder). The split is why
          you can instruct <span className="text-foreground">what</span> to say and{" "}
          <span className="text-foreground">how</span> separately — content lives in the LM, voice
          and prosody in the decoder.
        </p>
      </div>
    </figure>
  )
}
