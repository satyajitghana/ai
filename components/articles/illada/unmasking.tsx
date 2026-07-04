"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The defining difference, animated. An autoregressive model writes left-to-right,
// one token per forward pass — N tokens, N passes. A masked diffusion model starts
// from an all-masked sequence and unmasks tokens in parallel over a few denoising
// steps, in confidence order rather than reading order, with every prediction able
// to see the whole sequence (bidirectional). Flip the mode and watch the cost in
// forward passes change. Hand-authored schedule; illustrative of the mechanism.

const ACCENT = "oklch(0.66 0.15 150)"
const TOKENS = ["a", "diffusion", "LM", "unmasks", "many", "tokens", "at", "once", "not", "one", "by", "one"]

// diffusion: a few parallel steps, revealed in confidence order (NOT left-to-right)
const DIFF_STEP: number[] = [3, 1, 2, 2, 3, 1, 4, 1, 3, 4, 4, 2]
const DIFF_STEPS = 4

// scene geometry (viewBox units)
const N = TOKENS.length
const W = 820
const MX = 12
const GAP = 6
const NW = (W - 2 * MX - (N - 1) * GAP) / N
const BADGE = 26 // step-badge band
const NY = BADGE + 8
const NH = 38
const H = NY + NH + 8
const nx = (i: number) => MX + i * (NW + GAP)

type Mode = "diffusion" | "autoregressive"

export function Unmasking() {
  const [mode, setMode] = useState<Mode>("diffusion")
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  const maxStep = mode === "diffusion" ? DIFF_STEPS : TOKENS.length
  const revealStep = (i: number) => (mode === "diffusion" ? DIFF_STEP[i] : i + 1)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setStep((s) => (s >= maxStep + 1 ? 0 : s + 1)), 700)
    return () => clearInterval(id)
  }, [playing, maxStep])

  const revealed = TOKENS.filter((_, i) => revealStep(i) <= step).length
  const justRevealed = (i: number) => revealStep(i) === step

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">generation order</span>
        <div className="flex gap-1">
          {(["diffusion", "autoregressive"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setStep(0)
              }}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                mode === m ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
              style={mode === m ? { background: ACCENT } : undefined}
            >
              {m === "diffusion" ? "diffusion (any-order)" : "autoregressive (L→R)"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${mode} generation: ${revealed} of ${N} tokens unmasked${mode === "diffusion" ? `, several per denoising step` : `, one per forward pass, left to right`}.`}>
          <defs>
            <filter id="unmask-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {TOKENS.map((tok, i) => {
            const rs = revealStep(i)
            const shown = rs <= step
            const fresh = justRevealed(i)
            const badgeOn = shown
            return (
              <g key={i}>
                {/* step badge — which step this position resolves at */}
                <circle cx={nx(i) + NW / 2} cy={12} r={8} fill={badgeOn ? ACCENT : "var(--muted)"} fillOpacity={badgeOn ? 0.9 : 0.35} className="transition-all duration-300" />
                <text x={nx(i) + NW / 2} y={15} textAnchor="middle" fill={badgeOn ? "var(--background)" : "var(--muted-foreground)"} className="font-mono" fontSize={9} fontWeight={600}>
                  {rs}
                </text>

                {/* token node */}
                <rect
                  x={nx(i)}
                  y={NY}
                  width={NW}
                  height={NH}
                  rx={7}
                  fill={fresh ? ACCENT : shown ? "var(--background)" : "var(--muted)"}
                  fillOpacity={fresh ? 0.95 : shown ? 1 : 0.15}
                  stroke={fresh ? ACCENT : shown ? "var(--border)" : "var(--border)"}
                  strokeWidth={1.5}
                  strokeDasharray={shown ? undefined : "3 3"}
                  filter={fresh || shown ? "url(#unmask-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={nx(i) + NW / 2}
                  y={NY + NH / 2 + 3}
                  textAnchor="middle"
                  fill={fresh ? "var(--background)" : shown ? "var(--foreground)" : "transparent"}
                  className="font-mono transition-all duration-300"
                  fontSize={9}
                  fontWeight={fresh ? 600 : 400}
                >
                  {shown ? tok : "MASK"}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="flex items-center justify-between">
          <div className="min-h-[2.5rem] font-mono text-[11px] text-muted-foreground">
            {mode === "diffusion"
              ? `denoising step ${Math.min(step, DIFF_STEPS)}/${DIFF_STEPS} · ${revealed}/${TOKENS.length} tokens unmasked${
                  step > 0 && step <= DIFF_STEPS ? " — several at once, bidirectional context" : ""
                }`
              : `forward pass ${Math.min(step, TOKENS.length)}/${TOKENS.length} · ${revealed}/${TOKENS.length} tokens — one at a time, left to right`}
          </div>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex shrink-0 cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
            {playing ? "pause" : "play"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>forward passes <span style={{ color: mode === "diffusion" ? ACCENT : undefined }} className={mode === "diffusion" ? "" : "text-foreground"}>{maxStep}</span></span>
          <span>tokens / pass <span className="text-foreground">{mode === "diffusion" ? "many" : "1"}</span></span>
          <span>attention <span className="text-foreground">{mode === "diffusion" ? "bidirectional" : "causal"}</span></span>
        </div>

        {/* both mode paragraphs overlaid in one grid cell so the block sizes to
            the taller one and toggling mode never reflows the page */}
        <div className="grid">
          {(["diffusion", "autoregressive"] as Mode[]).map((m) => (
            <p
              key={m}
              aria-hidden={m !== mode}
              className={cn(
                "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
                m === mode ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              {m === "diffusion"
                ? "Diffusion decodes the whole block at once and commits its most confident predictions each step, so a 12-token answer lands in ~4 passes — and because there's no causal mask, every position conditions on the entire sequence, left and right. The cost is that quality depends on how many denoising steps you spend."
                : "Autoregression commits exactly one token per forward pass, strictly left to right, each conditioned only on what came before. Simple and strong — but the number of sequential passes is the length of the output, and that serial dependency is the latency floor diffusion is trying to break."}
            </p>
          ))}
        </div>
      </div>
    </figure>
  )
}
