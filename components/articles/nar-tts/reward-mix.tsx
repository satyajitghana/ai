"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The GRPO reward, and the two rewards that are implemented and switched off.
//
// Every weight is from the repository's grpo.md. They sum to exactly 1.00, and
// each reward is normalized inside its own prompt group before the weighted sum
// — which matters, because CER, cosine speaker similarity and a clipping
// diagnostic have no common scale.
//
// The part worth the article is the emotion and event rewards. Both are
// implemented. Both are at weight zero. The docs give the reason:
//
//   "Do not enable them until an independently validated classifier has been
//    selected using synthetic Turkish speech. Using the same SER model as both
//    the reward and the success metric encourages reward hacking."
//
// And the same discipline appears twice more: Whisper verification at inference
// is deliberately a different ASR family from the Qwen3-ASR used as the training
// reward, and the evaluation section says outright not to evaluate only with the
// model you trained against.
//
// Shipping a reward you built and then refusing to turn it on, in writing, is
// the rarest thing in this repository.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type R = { l: string; w: number; model: string; c: string; blocked?: boolean; why?: string }

const REWARDS: R[] = [
  { l: "intelligibility", w: 0.6, model: "Qwen3-ASR CER + ground-truth NLL", c: ACCENT },
  { l: "speaker similarity", w: 0.15, model: "WavLM-Large + ECAPA", c: GOOD },
  { l: "speaker drift", w: 0.07, model: "overlapping WavLM windows", c: GOOD },
  { l: "technical quality", w: 0.08, model: "clipping, level, silence, repetition", c: MUTED },
  { l: "duration consistency", w: 0.05, model: "reference duration", c: MUTED },
  { l: "prosody", w: 0.05, model: "pitch, energy, voicing, pauses", c: MUTED },
  {
    l: "emotion",
    w: 0,
    model: "a speech-emotion classifier",
    c: WARM,
    blocked: true,
    why: "The success criteria also score emotion accuracy. Using the same SER model as reward and metric means the model can learn to satisfy that classifier rather than to sound sad — and the evaluation would report success.",
  },
  {
    l: "non-verbal events",
    w: 0,
    model: "an event detector",
    c: WARM,
    blocked: true,
    why: "Same structure: event F1 and position error are in the success criteria. A detector used as both judge and target measures its own agreement with itself.",
  },
]

const SEPARATIONS = [
  { l: "training reward ASR", v: "Qwen3-ASR", c: ACCENT },
  { l: "inference verification ASR", v: "Whisper — a different family, on purpose", c: GOOD },
  { l: "release evaluation ASR", v: "\"do not evaluate only with the model used for training\"", c: GOOD },
]

export function RewardMix() {
  const [sel, setSel] = useState(0)
  const [enable, setEnable] = useState(false)
  const r = REWARDS[sel]
  const total = REWARDS.reduce((a, x) => a + x.w, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one GRPO recipe · 8 generations per group across 8 GPUs · each reward normalized within its group
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          weights sum to {total.toFixed(2)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {REWARDS.map((x, i) => {
            const w = x.blocked && enable ? 0.1 : x.w
            return (
              <button
                key={x.l}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={i === sel}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                  i === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                  x.blocked && "opacity-90",
                )}
              >
                <span className="w-36 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.l}</span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{
                      width: `${Math.max(0.5, w * 100)}%`,
                      background: x.c,
                      opacity: x.blocked ? 0.55 : 0.9,
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                  {w.toFixed(2)}
                </span>
                <span className="hidden w-56 shrink-0 truncate font-mono text-[9px] text-muted-foreground lg:inline">
                  {x.model}
                </span>
                {x.blocked ? (
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px]" style={{ background: `${WARM}22`, color: WARM }}>
                    held at zero
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setEnable((v) => !v)}
          aria-pressed={enable}
          className={cn(
            "mt-2 flex w-full cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
            enable ? "bg-muted/40" : "hover:bg-muted/20",
          )}
          style={{ borderColor: enable ? WARM : undefined }}
        >
          <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: enable ? WARM : "transparent", border: enable ? "none" : "1px solid currentColor" }} />
          <span className="font-mono text-[10px] text-foreground">turn the style rewards on anyway</span>
          <span className="font-mono text-[9px] text-muted-foreground">
            {enable ? "— and now the metric and the reward are the same model" : ""}
          </span>
        </button>

        {enable ? (
          <div className="mt-2 rounded-lg border px-3 py-2.5 text-sm leading-6 text-muted-foreground" style={{ borderColor: WARM }}>
            The success criteria include <span className="font-mono text-[11px] text-foreground">emotion accuracy</span>{" "}
            and <span className="font-mono text-[11px] text-foreground">event F1</span>, scored by a classifier. Put
            that same classifier in the reward and the policy optimizes its agreement with the judge rather than the
            thing the judge was standing in for — and the evaluation, which uses the judge, reports that it worked.
            The docs&rsquo; instruction is to validate an independent classifier on synthetic Turkish speech first.
          </div>
        ) : (
          <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[11px]" style={{ color: r.c }}>
              {r.l} · weight {r.w.toFixed(2)} · {r.model}
            </div>
            {r.why ? <div className="mt-1 text-sm leading-6 text-muted-foreground">{r.why}</div> : null}
          </div>
        )}

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            the same discipline, three times over — never judge with the model you trained against
          </div>
          <div className="mt-2 space-y-1">
            {SEPARATIONS.map((s) => (
              <div key={s.l} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
                <span className="w-44 shrink-0 text-right text-foreground">{s.l}</span>
                <span style={{ color: s.c }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sixty per cent of the reward is intelligibility, which is the right allocation for a TTS system and also
          the least interesting thing here. The interesting thing is the two rows at zero.
          <br />
          <br />
          Emotion and event rewards are <em>implemented</em>{" "}and deliberately switched off, with the reason
          written down: the project&rsquo;s own success criteria score emotion accuracy and event F1 using a
          classifier, and putting that classifier into the reward means{" "}
          <span className="text-foreground">optimizing the model&rsquo;s agreement with the judge rather than the
          thing the judge stands for</span>. The same instinct shows up twice more — Whisper verifies at inference
          precisely because the training reward used Qwen3-ASR, and the evaluation section says not to score a
          release with the model it was trained against.
          <br />
          <br />
          Building a reward, wiring it in, and then refusing to turn it on until you have a judge you did not
          train against is a discipline most projects with far more resources do not maintain.
        </p>
      </div>
    </figure>
  )
}
