"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The expressive control interface, and what it does not yet do.
//
// Nar exposes three independent controls — emotion, delivery, and non-verbal
// events — and renders them as text markup that does not modify the tokenizer:
//
//   <nar_control emotion=sadness intensity=0.900 delivery=crying_speech>
//   I <nar_event type=sob after_word=1 duration=short count=1> thought of you today.
//
// Keeping controls in the text stream rather than in new special tokens is the
// design decision worth noticing. New control tokens would mean re-encoding every
// piece of speech data and retraining from scratch — which is exactly what the
// docs list under "changes that require retraining", alongside changing the codec
// or the speech-token layout.
//
// And the docs say the quiet part: "The current checkpoint has not learned this
// markup, so it cannot produce crying speech or laughter on its own. These
// capabilities require an expressive SFT checkpoint." The interface is here; the
// capability is a training-data problem, and the repository says so rather than
// letting the API imply otherwise.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const EMOTIONS = ["neutral", "joy", "sadness", "anger", "fear", "surprise"] as const
const DELIVERY = ["neutral", "crying_speech", "speech_laugh"] as const
const EVENTS = ["laugh", "chuckle", "sob", "cry", "sniff", "sigh", "gasp", "breath"] as const

const TEXT = ["I", "thought", "of", "you", "today."]

export function ControlMarkup() {
  const [emotion, setEmotion] = useState<string>("sadness")
  const [delivery, setDelivery] = useState<string>("crying_speech")
  const [event, setEvent] = useState<string>("sob")
  const [after, setAfter] = useState(1)
  const [intensity, setIntensity] = useState(90)

  const words = TEXT.slice()
  const rendered = [
    `<nar_control emotion=${emotion} intensity=${(intensity / 100).toFixed(3)} delivery=${delivery}>`,
    words
      .map((w, i) => (i === after ? `<nar_event type=${event} after_word=${after} duration=short count=1> ${w}` : w))
      .join(" "),
  ].join("\n")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          three independent controls, rendered as text — no new tokens, no re-encoding
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          the shipped checkpoint has not learned this markup
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {(
            [
              ["emotion", EMOTIONS, emotion, setEmotion, ACCENT],
              ["delivery", DELIVERY, delivery, setDelivery, GOOD],
              ["event", EVENTS, event, setEvent, WARM],
            ] as const
          ).map(([label, opts, cur, setter, color]) => (
            <div key={label}>
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {opts.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => (setter as (v: string) => void)(o)}
                    aria-pressed={cur === o}
                    className={cn(
                      "cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors",
                      cur === o
                        ? "border-foreground/30 bg-muted/50 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    style={cur === o ? { color } : undefined}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">intensity</span>
            <Range min={0} max={100} step={1} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="flex-1" aria-label="emotion intensity" accent={ACCENT} />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {(intensity / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">after word</span>
            <Range min={0} max={TEXT.length - 1} step={1} value={after} onChange={(e) => setAfter(Number(e.target.value))} className="flex-1" aria-label="position of the non-verbal event" accent={WARM} />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{after}</span>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what the model sees</div>
          <pre className="mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-6 text-foreground">{rendered}</pre>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
          <span className="text-foreground">speech_laugh</span>{" "}means the text is spoken with laughter;{" "}
          <span className="text-foreground">laugh</span>{" "}is a separate laughter event. Likewise{" "}
          <span className="text-foreground">crying_speech</span>{" "}and{" "}
          <span className="text-foreground">sob</span>{" "}are annotated separately — a distinction most expressive
          TTS interfaces collapse into one label.
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Controls live in the text stream rather than in new special tokens, and that is not a stylistic
          preference. The repository has a section called{" "}
          <em>changes that require retraining</em>, and adding control tokens is on it, next to changing the codec
          or the speech-token layout — because any of those means{" "}
          <span className="text-foreground">re-encoding every piece of speech data and training the model
          again</span>. Markup that the existing tokenizer already handles keeps expressive control on the
          near side of that line.
          <br />
          <br />
          And then the honest part, which is in the same docs: the shipped checkpoint{" "}
          <em>has not learned this markup</em>{" "}and cannot produce crying speech or laughter on its own. The
          interface exists; the capability needs labelled expressive SFT data. Publishing a control surface and
          stating plainly that the current weights ignore it is the opposite of how this usually goes.
        </p>
      </div>
    </figure>
  )
}
