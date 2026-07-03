"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The two phases of every generate() call, animated. Prefill processes the whole
// prompt in one parallel pass (compute-bound, GPU arithmetic saturated) and fills
// the KV cache; then decode emits one token per pass, each reading the entire
// cache for a tiny matmul (memory-bound, arithmetic mostly idle). Watch the
// bottleneck flip from compute to memory bandwidth. Illustrative; loops.

const PROMPT = ["Explain", "how", "LLM", "inference", "works"]
const GEN = ["It", "runs", "two", "phases", "on", "one", "GPU", "."]

type Phase = "prefill" | "decode"
type State = { phase: Phase; step: number } // step = decode tokens emitted

const START: State = { phase: "prefill", step: 0 }

function next(s: State): State {
  if (s.phase === "prefill") return { phase: "decode", step: 0 }
  if (s.step >= GEN.length) return START
  return { phase: "decode", step: s.step + 1 }
}

export function PrefillDecode() {
  const [s, setS] = useState<State>(START)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setS(next), s.phase === "prefill" ? 1200 : 650)
    return () => clearInterval(id)
  }, [playing, s.phase, s.step])

  const cacheSize = PROMPT.length + (s.phase === "decode" ? s.step : 0)
  const compute = s.phase === "prefill" ? 0.95 : 0.28
  const memory = s.phase === "prefill" ? 0.4 : 0.92

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>one generate() call · prefill → decode</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* phase banner */}
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <div
            className={cn(
              "rounded-md border px-3 py-2 transition-all",
              s.phase === "prefill" ? "border-foreground/40 bg-muted/40" : "opacity-40"
            )}
          >
            <div className="font-medium text-foreground">prefill</div>
            <div className="text-[10px] text-muted-foreground">compute-bound · TTFT</div>
          </div>
          <div
            className={cn(
              "rounded-md border px-3 py-2 transition-all",
              s.phase === "decode" ? "border-foreground/40 bg-muted/40" : "opacity-40"
            )}
          >
            <div className="font-medium text-foreground">decode</div>
            <div className="text-[10px] text-muted-foreground">memory-bound · ITL</div>
          </div>
        </div>

        {/* prompt */}
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">prompt</div>
          <div className="flex flex-wrap gap-1.5">
            {PROMPT.map((t, i) => (
              <span
                key={i}
                className={cn(
                  // always keep a 1px border (transparent in prefill) so token width and
                  // the row's wrap point stay constant across the phase flip
                  "rounded border px-2 py-1 font-mono text-xs transition-all",
                  s.phase === "prefill" ? "border-transparent text-background" : "text-muted-foreground"
                )}
                style={s.phase === "prefill" ? { background: "oklch(0.72 0.15 195)" } : undefined}
              >
                {t}
              </span>
            ))}
            <span
              className={cn(
                "px-1 py-1 font-mono text-[10px] text-muted-foreground transition-opacity",
                s.phase === "prefill" ? "opacity-100" : "opacity-0"
              )}
            >
              ← all at once, one matmul
            </span>
          </div>
        </div>

        {/* KV cache — all slots always rendered (inactive ones faint) so the row
            never grows and shifts the layout */}
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">
            KV cache · {cacheSize} tokens
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: PROMPT.length + GEN.length }).map((_, i) => {
              const active = i < cacheSize
              return (
                <span
                  key={i}
                  className="h-4 w-4 rounded-sm transition-colors"
                  style={{
                    background: !active
                      ? "var(--muted)"
                      : i < PROMPT.length
                        ? "oklch(0.72 0.13 195 / 0.5)"
                        : "oklch(0.72 0.14 150 / 0.7)",
                    opacity: active ? 1 : 0.35,
                  }}
                  title={i < PROMPT.length ? "from prefill" : "appended during decode"}
                />
              )
            })}
          </div>
        </div>

        {/* generated — all tokens always present (future ones invisible) to keep a
            fixed height */}
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">output</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {GEN.map((t, i) => {
              const shown = s.phase === "decode" && i < s.step
              return (
                <span
                  key={i}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-xs transition-all",
                    !shown
                      ? "border border-transparent opacity-0"
                      : i === s.step - 1
                        ? "border border-transparent text-background"
                        : "border text-foreground"
                  )}
                  style={shown && i === s.step - 1 ? { background: "oklch(0.72 0.15 150)" } : undefined}
                >
                  {t}
                </span>
              )
            })}
            <span className="inline-block h-5 w-1.5 animate-pulse self-center bg-foreground/50" aria-hidden />
          </div>
        </div>

        {/* bottleneck meters */}
        <div className="space-y-2">
          <Meter label="compute (arithmetic)" frac={compute} hot={s.phase === "prefill"} />
          <Meter label="memory bandwidth" frac={memory} hot={s.phase === "decode"} />
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="bottleneck" value={s.phase === "prefill" ? "compute" : "memory BW"} />
          <Stat label="metric" value={s.phase === "prefill" ? "TTFT" : "ITL"} highlight />
          <Stat label="GPU util" value={s.phase === "prefill" ? "~95%" : "~30%"} />
        </div>

        {/* both captions overlaid in one grid cell so the block sizes to the taller
            (decode) text and never reflows the prose below when the phase flips */}
        <div className="grid">
          <p
            aria-hidden={s.phase !== "prefill"}
            className={cn(
              "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
              s.phase === "prefill" ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            Prefill runs the whole prompt through every layer in parallel — a big
            matrix-matrix multiply that saturates the GPU&rsquo;s math units. Its latency is
            Time To First Token (TTFT), and it leaves behind the KV cache.
          </p>
          <p
            aria-hidden={s.phase !== "decode"}
            className={cn(
              "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
              s.phase === "decode" ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            Decode emits one token per pass: compute Q for the new token, attend over the
            cached K/V, append. The arithmetic is tiny but the GPU still streams every
            weight and the whole cache from memory — so bandwidth, not compute, sets the
            Inter-Token Latency (ITL), and most of the math units sit idle.
          </p>
        </div>
      </div>
    </figure>
  )
}

function Meter({ label, frac, hot }: { label: string; frac: number; hot: boolean }) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      <span className="w-40 shrink-0 text-right text-muted-foreground">{label}</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
        <div
          className="h-full rounded transition-all duration-500"
          style={{
            width: `${frac * 100}%`,
            background: hot ? "oklch(0.72 0.15 195)" : "oklch(0.62 0.02 260)",
          }}
        />
      </div>
      <span className="w-9 shrink-0 tabular-nums text-muted-foreground">{Math.round(frac * 100)}%</span>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium text-foreground", highlight && "")}>{value}</div>
    </div>
  )
}
