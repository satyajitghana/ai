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

const TOKENS = ["a", "diffusion", "LM", "unmasks", "many", "tokens", "at", "once", "not", "one", "by", "one"]

// diffusion: a few parallel steps, revealed in confidence order (NOT left-to-right)
const DIFF_STEP: number[] = [3, 1, 2, 2, 3, 1, 4, 1, 3, 4, 4, 2]
const DIFF_STEPS = 4

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
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
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
                "cursor-pointer rounded px-2 py-1 transition-colors",
                mode === m
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "diffusion" ? "diffusion (any-order)" : "autoregressive (L→R)"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* token sequence */}
        <div className="flex min-h-[64px] flex-wrap items-center gap-1.5 rounded-md border bg-muted/20 p-3">
          {TOKENS.map((t, i) => {
            const shown = revealStep(i) <= step
            const fresh = justRevealed(i)
            return (
              <span
                key={i}
                className={cn(
                  "rounded px-2 py-1 font-mono text-sm transition-all duration-300",
                  shown
                    ? fresh
                      ? "text-background"
                      : "border border-transparent text-foreground"
                    : "border border-dashed border-foreground/30 text-muted-foreground/40"
                )}
                style={fresh ? { background: "oklch(0.72 0.15 150)" } : undefined}
              >
                {shown ? t : "▢"}
              </span>
            )
          })}
        </div>

        {/* step indicator */}
        <div className="font-mono text-[11px] text-muted-foreground">
          {mode === "diffusion"
            ? `denoising step ${Math.min(step, DIFF_STEPS)}/${DIFF_STEPS} · ${revealed}/${TOKENS.length} tokens unmasked${
                step > 0 && step <= DIFF_STEPS ? " — several at once, bidirectional context" : ""
              }`
            : `forward pass ${Math.min(step, TOKENS.length)}/${TOKENS.length} · ${revealed}/${TOKENS.length} tokens — one at a time, left to right`}
        </div>

        {/* cost comparison */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="forward passes" value={`${maxStep}`} highlight={mode === "diffusion"} />
          <Stat label="tokens / pass" value={mode === "diffusion" ? "many" : "1"} />
          <Stat label="attention" value={mode === "diffusion" ? "bidirectional" : "causal"} />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {mode === "diffusion"
            ? "Diffusion decodes the whole block at once and commits its most confident predictions each step, so a 12-token answer lands in ~4 passes — and because there's no causal mask, every position conditions on the entire sequence, left and right. The cost is that quality depends on how many denoising steps you spend."
            : "Autoregression commits exactly one token per forward pass, strictly left to right, each conditioned only on what came before. Simple and strong — but the number of sequential passes is the length of the output, and that serial dependency is the latency floor diffusion is trying to break."}
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium", highlight ? "text-foreground" : "text-foreground")}>{value}</div>
    </div>
  )
}
