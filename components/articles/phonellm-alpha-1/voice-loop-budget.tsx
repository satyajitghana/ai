"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The "voice-to-voice latency budget" table (images/04), reproduced stage by
// stage rather than redrawn as a single number. The card states a target:
// "people are happy talking to an agent with a P95 voice-to-voice latency of
// 1,500ms." Every non-LLM stage is fixed by the audio pipeline, not the model:
//
//   capture + transport in : mic 40 + opus enc 21 + network 10 + packet 2
//                             + jitter 40 + opus dec 1            = 114ms
//   STT + endpointing                                             = 300ms
//   LLM time-to-first-token                                       = variable
//   sentence aggregation                                          =  20ms
//   TTS time-to-first-byte                                        = 120ms
//   transport out + playback : opus enc 21 + packet 2 + network 10
//                             + jitter 40 + opus dec 1 + speaker 15 = 89ms
//                                                    fixed subtotal = 643ms
//
// The card's own worked total, 1,293ms, plugs a generic reference
// architecture's 650ms "LLM time-to-first-token target" into that 643ms --
// it is not PhoneLLM's own measured number. PhoneLLM's actual PhoneBench P50
// TTFAT (leaderboard chart, images/01) is 331ms, nearly half that target:
// 643 + 331 = 974ms, comfortably under even the card's own 1,293ms worked
// example. Swap in another model's real leaderboard TTFAT for the LLM stage
// and the fixed 643ms doesn't move -- only the total does, against the same
// 1,500ms line.

const CAPTURE = "oklch(0.62 0.03 250)"
const STT = "oklch(0.60 0.15 255)"
const TTS = "oklch(0.60 0.13 300)"
const OK = "oklch(0.55 0.16 155)"
const OVER = "oklch(0.58 0.19 27)"
const TARGET = "oklch(0.68 0.13 85)"

const CAPTURE_MS = 114
const STT_MS = 300
const AGG = 20
const TTS_MS = 120
const OUT = 89
const FIXED_TOTAL = CAPTURE_MS + STT_MS + AGG + TTS_MS + OUT // 643

const LLMS = [
  { label: "PhoneLLM Alpha 1", p50: 331, p95: 600, shipped: true },
  { label: "GPT-4.1", p50: 889, p95: 1190 },
  { label: "GPT-5.6 Luna", p50: 786, p95: 1736 },
  { label: "GPT-5.6 Terra", p50: 980, p95: 1957 },
  { label: "Gemini 3.6 Flash", p50: 1168, p95: 1468 },
  { label: "Claude Haiku 4.5", p50: 707, p95: 899 },
  { label: "Claude Sonnet 5", p50: 1651, p95: 2166 },
] as const

const TARGET_MS = 1500
const SCALE_MS = 3000
const X0 = 14
const TRACK_W = 672
const px = (ms: number) => X0 + (ms / SCALE_MS) * TRACK_W

export function VoiceLoopBudget() {
  const [modelIdx, setModelIdx] = useState(0)
  const [mode, setMode] = useState<"p50" | "p95">("p50")

  const model = LLMS[modelIdx]
  const llmMs = model[mode]
  const total = FIXED_TOTAL + llmMs
  const overBudget = total > TARGET_MS
  const llmColor = overBudget ? OVER : OK

  const bars = useMemo(() => {
    const durations = [
      { ms: CAPTURE_MS, color: CAPTURE, opacity: 0.55 },
      { ms: STT_MS, color: STT, opacity: 0.55 },
      { ms: llmMs, color: llmColor, opacity: 0.9 },
      { ms: AGG, color: CAPTURE, opacity: 0.4 },
      { ms: TTS_MS, color: TTS, opacity: 0.7 },
      { ms: OUT, color: CAPTURE, opacity: 0.55 },
    ]
    return durations.reduce<{ x0: number; x1: number; color: string; opacity: number }[]>((acc, d) => {
      const x0 = acc.length === 0 ? 0 : acc[acc.length - 1].x1
      acc.push({ x0, x1: x0 + d.ms, color: d.color, opacity: d.opacity })
      return acc
    }, [])
  }, [llmMs, llmColor])

  const llmBar = bars[2]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">voice-to-voice budget, 643ms fixed + one LLM stage</span>
        <div className="flex gap-1.5">
          {(["p50", "p95"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              TTFAT {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 700 100`} width={700} height={100} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A stacked bar of the non-LLM voice pipeline, 643 milliseconds fixed, plus ${model.label}'s ${mode.toUpperCase()} time-to-first-answer-token of ${llmMs} milliseconds, totalling ${total} milliseconds against a 1,500 millisecond target. ${overBudget ? "This total exceeds the target." : "This total is inside the target."}`}
            </title>

            <line x1={X0} y1={16} x2={X0 + TRACK_W} y2={16} stroke="currentColor" strokeOpacity={0.15} />
            {[0, 500, 1000, 1500, 2000, 2500, 3000].map((t) => (
              <g key={t}>
                <line x1={px(t)} y1={12} x2={px(t)} y2={62} stroke="currentColor" strokeOpacity={t === 0 ? 0 : 0.08} />
                <text x={px(t)} y={9} fontSize={6.5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {t}
                </text>
              </g>
            ))}

            {bars.map((b, i) => (
              <rect
                key={i}
                x={px(b.x0)}
                y={22}
                width={Math.max(1, px(b.x1) - px(b.x0))}
                height={28}
                fill={b.color}
                fillOpacity={b.opacity}
              />
            ))}

            <line x1={px(TARGET_MS)} y1={12} x2={px(TARGET_MS)} y2={78} stroke={TARGET} strokeDasharray="3 3" strokeWidth={1.3} />
            <text x={px(TARGET_MS) + 4} y={78} fontSize={7} fill={TARGET} fontFamily="ui-monospace, monospace">
              1,500ms target
            </text>

            <text x={X0} y={64} fontSize={8} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
              total {total.toLocaleString()}ms
            </text>
            <text x={(px(llmBar.x0) + px(llmBar.x1)) / 2} y={40} textAnchor="middle" fontSize={7.5} fill="white" fillOpacity={0.95} fontFamily="ui-monospace, monospace">
              {llmMs >= 260 ? `LLM ${llmMs}ms` : ""}
            </text>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {LLMS.map((m, i) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setModelIdx(i)}
              aria-pressed={modelIdx === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                modelIdx === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Everything except the highlighted segment is fixed by the audio pipeline —{" "}
          <span style={{ color: CAPTURE }}>643ms</span> of capture, transcription, sentence
          aggregation, TTS-to-first-byte, and playback that no LLM choice changes. The card&rsquo;s
          own worked example fills that slot with a reference architecture&rsquo;s 650ms LLM
          time-to-first-token <em>target</em>, for a printed total of 1,293ms. At{" "}
          <span style={{ color: OK }}>PhoneLLM&rsquo;s own measured {LLMS[0].p50}ms P50</span> instead —
          its real PhoneBench leaderboard figure, not the target — the same pipeline totals only{" "}
          <strong className="text-foreground">{(FIXED_TOTAL + LLMS[0].p50).toLocaleString()}ms</strong>, 319ms
          under the card&rsquo;s own worked example.
          {modelIdx === 0 ? (
            " Currently showing that same row."
          ) : (
            <>
              {" "}Currently showing <span style={{ color: llmColor }}>{model.label}</span> at {mode.toUpperCase()}
              , which puts the identical pipeline at{" "}
              <strong className="text-foreground">{total.toLocaleString()}ms</strong>
              {overBudget
                ? ` — ${Math.round(((total - TARGET_MS) / TARGET_MS) * 100)}% over the 1,500ms target, entirely from the LLM stage.`
                : ", still inside the 1,500ms target."}
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
