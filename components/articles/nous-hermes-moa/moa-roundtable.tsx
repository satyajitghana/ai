"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// One MoA round, played out. Diverse proposers answer in parallel — each strong on
// a different facet, none complete — then the aggregator reads all of them and
// synthesizes one answer that's better than any single draft. The win-rate meter
// climbs past the best individual proposer: collaborativeness, animated. Loops.

const QUESTION = "Why is the sky blue?"

const PROPOSERS = [
  { name: "Qwen-110B", text: "Sunlight scatters off the air — that's what makes it blue.", score: 52, got: "mechanism, but vague" },
  { name: "WizardLM", text: "Rayleigh scattering: shorter (blue) wavelengths scatter more than red.", score: 61, got: "names the physics" },
  { name: "Llama-3-70B", text: "Scattering rate ∝ 1/λ⁴, so blue scatters ~5.5× more than red.", score: 64, got: "the quantitative law" },
  { name: "Mixtral", text: "Because of the atmosphere and how light behaves in it.", score: 40, got: "weak, hand-wavy" },
]

const SYNTHESIS =
  "Sunlight hits air molecules and scatters; by Rayleigh's law the rate ∝ 1/λ⁴, so short blue wavelengths scatter about 5.5× more than red and fill the sky — and it reads blue rather than violet partly because of how our eyes respond."
const AGG_SCORE = 71

const STEPS = 9 // 0 question, 1–4 proposers, 5 read, 6 synth, 7 score, 8 hold

export function MoARoundtable() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS), 950)
    return () => clearInterval(id)
  }, [playing])

  const reading = step >= 5
  const showSynth = step >= 6
  const showScores = step >= 7
  const bestProposer = Math.max(...PROPOSERS.map((p) => p.score))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>mixture-of-agents · one round, live</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="font-mono text-xs text-muted-foreground">
          prompt: <span className="text-foreground">{QUESTION}</span>
        </div>

        {/* proposers */}
        <div className="grid gap-2 sm:grid-cols-2">
          {PROPOSERS.map((p, i) => {
            const shown = step >= i + 1
            return (
              <div
                key={p.name}
                className={cn(
                  "rounded-md border px-3 py-2 transition-all duration-500",
                  shown ? "opacity-100" : "opacity-20",
                  reading ? "border-foreground/30" : ""
                )}
              >
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: `oklch(0.72 0.13 ${130 + i * 55})` }}
                    />
                    {p.name}
                  </span>
                  <span className="text-muted-foreground">{p.got}</span>
                </div>
                <p className={cn("mt-1 text-sm leading-6 transition-opacity duration-300", shown ? "opacity-100" : "opacity-0")}>{p.text}</p>
              </div>
            )
          })}
        </div>

        {/* flow indicator */}
        <div
          className={cn(
            "text-center font-mono text-[10px] transition-colors",
            reading ? "text-foreground" : "text-muted-foreground/50"
          )}
        >
          ↓ all four drafts → aggregator (aggregate &amp; synthesize)
        </div>

        {/* aggregator */}
        <div
          className={cn(
            "rounded-md border-l-2 px-3 py-2.5 transition-all duration-500",
            showSynth ? "border-foreground/40 bg-muted/30 opacity-100" : "border-border opacity-30"
          )}
        >
          <div className="font-mono text-[11px] text-muted-foreground">
            aggregator · Hermes 4 — synthesize, don&rsquo;t vote
          </div>
          <p className={cn("mt-1 text-sm leading-6 transition-opacity duration-300", showSynth ? "opacity-100" : "opacity-0")}>{SYNTHESIS}</p>
        </div>

        {/* win-rate bars */}
        <div className="space-y-1.5 pt-1">
          {PROPOSERS.map((p, i) => (
            <ScoreBar
              key={p.name}
              label={p.name}
              value={showScores ? p.score : 0}
              max={AGG_SCORE}
            />
          ))}
          <ScoreBar label="MoA" value={showScores ? AGG_SCORE : 0} max={AGG_SCORE} highlight />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The synthesized answer ({AGG_SCORE}%) clears the best single proposer
          ({bestProposer}%) because each draft contributed a different correct piece —
          the mechanism, the law, the number, the perception caveat. That lift from
          fusing diverse, individually-incomplete drafts is collaborativeness.
        </p>
      </div>
    </figure>
  )
}

function ScoreBar({
  label,
  value,
  max,
  highlight,
}: {
  label: string
  value: number
  max: number
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      <span
        className={cn(
          "w-24 shrink-0 text-right",
          highlight ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-muted">
        <div
          className="h-full rounded transition-all duration-700"
          style={{
            width: `${(value / max) * 100}%`,
            background: highlight ? "oklch(0.72 0.15 195)" : "oklch(0.62 0.02 260)",
          }}
        />
      </div>
      <span
        className={cn(
          "w-10 shrink-0 tabular-nums",
          highlight ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {value}%
      </span>
    </div>
  )
}
