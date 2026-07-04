"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// One MoA round, played out as a scene. Diverse proposers answer in parallel — each
// strong on a different facet, none complete — then curved arrows carry all four drafts
// into the aggregator, which synthesizes one answer better than any single draft. The
// win-rate bars climb past the best individual proposer: collaborativeness, animated.

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
const ACCENT = "oklch(0.72 0.15 195)"

// scene geometry (viewBox units)
const W = 720
const NH = 40
const NW = 150
const nodeXs = PROPOSERS.map((_, i) => 100 + i * 174)
const PY = 40 // proposer row center
const AY = 168 // aggregator center

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

  const link = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mixture-of-agents · one round, live</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 font-mono text-xs text-muted-foreground">
          prompt: <span className="text-foreground">{QUESTION}</span>
        </div>

        {/* the network scene */}
        <svg viewBox={`0 0 ${W} 212`} className="w-full" role="img" aria-label={`Four proposers answer in parallel; their drafts flow into an aggregator that synthesizes one answer scoring ${AGG_SCORE} percent, above the best single proposer at ${bestProposer} percent`}>
          <defs>
            <marker id="mr-arrow" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="mr-soft" x="-30%" y="-40%" width="160%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* drafts flowing into aggregator (revealed when reading) */}
          {nodeXs.map((x, i) => (
            <path
              key={i}
              d={link(x, PY + NH / 2, W / 2, AY - 22)}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.5}
              markerEnd="url(#mr-arrow)"
              opacity={reading ? 0.5 : 0}
              className="transition-opacity duration-500"
            />
          ))}

          {/* proposer nodes */}
          {PROPOSERS.map((p, i) => {
            const shown = step >= i + 1
            return (
              <g key={p.name} opacity={shown ? 1 : 0.25} className="transition-opacity duration-500">
                <rect x={nodeXs[i] - NW / 2} y={PY - NH / 2} width={NW} height={NH} rx={10} fill="var(--background)" stroke={reading ? ACCENT : "var(--border)"} strokeWidth={1.5} filter={shown ? "url(#mr-soft)" : undefined} className="transition-colors duration-300" />
                <circle cx={nodeXs[i] - NW / 2 + 13} cy={PY} r={3.5} fill={ACCENT} opacity={0.85} />
                <text x={nodeXs[i] + 6} y={PY - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>{p.name}</text>
                <text x={nodeXs[i] + 6} y={PY + 11} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>{p.got}</text>
              </g>
            )
          })}

          {/* aggregator */}
          <g opacity={showSynth ? 1 : 0.35} className="transition-opacity duration-500">
            <rect x={W / 2 - 150} y={AY - 22} width={300} height={44} rx={11} fill={showSynth ? ACCENT : "var(--background)"} stroke={ACCENT} strokeWidth={1.5} filter="url(#mr-soft)" className="transition-all duration-500" />
            <text x={W / 2} y={AY - 3} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={showSynth ? "var(--background)" : "var(--foreground)"}>aggregator · Hermes 4</text>
            <text x={W / 2} y={AY + 12} textAnchor="middle" className="font-mono" fontSize={9} fill={showSynth ? "var(--background)" : "var(--muted-foreground)"} opacity={showSynth ? 0.85 : 1}>synthesize, don&rsquo;t vote</text>
          </g>
        </svg>

        {/* the actual drafts (prose) — fixed content, opacity-animated, so layout is stable */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROPOSERS.map((p, i) => {
            const shown = step >= i + 1
            return (
              <div key={p.name} className={cn("rounded-md border px-3 py-2 transition-all duration-500", shown ? "opacity-100" : "opacity-20", reading ? "border-foreground/30" : "")}>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: ACCENT }} />
                    {p.name}
                  </span>
                  <span className="text-muted-foreground">{p.got}</span>
                </div>
                <p className={cn("mt-1 text-sm leading-6 transition-opacity duration-300", shown ? "opacity-100" : "opacity-0")}>{p.text}</p>
              </div>
            )
          })}
        </div>

        {/* synthesis (prose) */}
        <div className={cn("mt-3 rounded-md border-l-2 px-3 py-2.5 transition-all duration-500", showSynth ? "bg-muted/30 opacity-100" : "opacity-30")} style={{ borderColor: showSynth ? ACCENT : "var(--border)" }}>
          <div className="font-mono text-[11px] text-muted-foreground">synthesized answer</div>
          <p className={cn("mt-1 text-sm leading-6 transition-opacity duration-300", showSynth ? "opacity-100" : "opacity-0")}>{SYNTHESIS}</p>
        </div>

        {/* win-rate bars as an SVG chart */}
        <div className="mt-4">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">win rate vs. best single proposer</div>
          <svg viewBox={`0 0 ${W} 156`} className="w-full" role="img" aria-label="Win-rate bars: each proposer against the synthesized MoA answer">
            {[...PROPOSERS, { name: "MoA", score: AGG_SCORE, highlight: true }].map((p, i) => {
              const y = 8 + i * 28
              const bx0 = 108
              const bx1 = W - 52
              const val = showScores ? p.score : 0
              const highlight = "highlight" in p && p.highlight
              return (
                <g key={p.name}>
                  <text x={bx0 - 10} y={y + 13} textAnchor="end" className={cn("font-mono", highlight ? "fill-foreground" : "fill-muted-foreground")} fontSize={11} fontWeight={highlight ? 600 : 400}>{p.name}</text>
                  <rect x={bx0} y={y} width={bx1 - bx0} height={18} rx={5} fill="var(--muted)" />
                  <rect x={bx0} y={y} width={((bx1 - bx0) * val) / AGG_SCORE} height={18} rx={5} fill={highlight ? ACCENT : "var(--muted-foreground)"} opacity={highlight ? 1 : 0.55} className="transition-all duration-700" />
                  <text x={bx1 + 8} y={y + 13} className={cn("font-mono tabular-nums", highlight ? "fill-foreground" : "fill-muted-foreground")} fontSize={10} fontWeight={highlight ? 600 : 400}>{val}%</text>
                </g>
              )
            })}
          </svg>
        </div>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The synthesized answer ({AGG_SCORE}%) clears the best single proposer
          ({bestProposer}%) because each draft contributed a different correct piece —
          the mechanism, the law, the number, the perception caveat. That lift from
          fusing diverse, individually-incomplete drafts is collaborativeness.
        </p>
      </div>
    </figure>
  )
}
