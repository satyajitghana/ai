"use client"

import { useId, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The whole argument, made quantitative: how long does synthesizing a page of
// N tokens take, at four measured tokens/second figures for this exact model
// (Qwen3.8-27B), and where does that time land against the three perceptual
// thresholds human-factors research has used since the 1960s (Nielsen, 1993):
// 0.1s reads as instantaneous, 1s keeps a user's flow of thought unbroken, 10s
// is the point they stop waiting and go do something else. "Time to first
// paint" assumes the model only has to emit the first ~8% of the document
// (header, nav, the first visible row) before the browser's own streaming
// HTML parser can paint something — a deliberately conservative slice.
//
// Sources for the four rates (see article body for the primary links):
//  - Cerebras: ~1,850 tok/s, Cerebras's own published Qwen3.8-27B figure on
//    the Shared Tier (inference-docs.cerebras.ai), batch 1.
//  - RTX 3090, tuned: ~120 tok/s single-user decode, third-party llama.cpp/
//    vLLM recipe with int8 GEMMs + MTP speculative decoding.
//  - RTX 4090, native MTP: 65 tok/s decode, the demo author's own benchmark
//    of this exact checkpoint (Alok, "Part 1", posted the day before Part 2).
//  - Mac Studio, default: ~14 tok/s, Q4_K_M via plain Ollama, no speculative
//    decoding — the number most people actually get on a Mac.
//
// Log-scale time axis (all runtime math through lib/dmath, per house rule).

type Tier = { label: string; sub: string; toks: number; highlight?: boolean }

const TIERS: Tier[] = [
  { label: "Cerebras", sub: "Qwen3.8-27B, Shared Tier · 1,850 tok/s", toks: 1850, highlight: true },
  { label: "RTX 3090", sub: "tuned, MTP + int8 · 120 tok/s", toks: 120 },
  { label: "RTX 4090", sub: "native MTP, Alok's own bench · 65 tok/s", toks: 65 },
  { label: "Mac Studio", sub: "Ollama, out of the box · 14 tok/s", toks: 14 },
]

const FIRST_PAINT_FRACTION = 0.08 // share of the document needed before the browser paints something

const TMIN = 0.1
const TMAX = 120
const LOGMIN = mlog10(TMIN)
const LOGSPAN = mlog10(TMAX) - LOGMIN

function pos(seconds: number): number {
  const clamped = Math.min(Math.max(seconds, TMIN), TMAX)
  return ((mlog10(clamped) - LOGMIN) / LOGSPAN) * 100
}

const BANDS: { from: number; to: number; label: string; color: string }[] = [
  { from: 0.1, to: 1, label: "feels instant", color: "oklch(0.66 0.15 150)" },
  { from: 1, to: 10, label: "needs a spinner", color: "oklch(0.75 0.14 80)" },
  { from: 10, to: 120, label: "attention wanders", color: "var(--destructive)" },
]

const PRESETS: { label: string; tokens: number }[] = [
  { label: "short result · 800 tok", tokens: 800 },
  { label: "article page · 3,000 tok", tokens: 3000 },
  { label: "media grid · 8,000 tok", tokens: 8000 },
  { label: "heavy real-world HTML · 20,000 tok", tokens: 20000 },
]

function fmtTime(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
  if (seconds < 100) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function LatencyThreshold() {
  const [tokens, setTokens] = useState(4000)
  const sliderId = useId()

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>page size vs. generation time · log scale</span>
        <span className="tabular-nums text-foreground">{tokens.toLocaleString()} tokens</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* preset chips */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setTokens(p.tokens)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors",
                tokens === p.tokens
                  ? "border-foreground/40 bg-foreground/[0.06] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* slider */}
        <label htmlFor={sliderId} className="sr-only">
          page size in tokens
        </label>
        <Range
          id={sliderId}
          min={300}
          max={20000}
          step={100}
          value={tokens}
          onChange={(e) => setTokens(Number(e.target.value))}
          className="w-full"
        />

        {/* band ruler */}
        <div className="mt-4 flex items-center gap-3">
          <span className="w-24 shrink-0 sm:w-32" aria-hidden />
          <div className="relative h-5 flex-1 overflow-hidden rounded-sm">
            {BANDS.map((b) => (
              <span
                key={b.label}
                className="absolute inset-y-0"
                style={{ left: `${pos(b.from)}%`, width: `${pos(b.to) - pos(b.from)}%`, background: b.color, opacity: 0.16 }}
              />
            ))}
            {[0.1, 1, 10, 100].map((t) => (
              <span
                key={t}
                className="absolute top-0 bottom-0 w-px bg-border"
                style={{ left: `${pos(t)}%` }}
              />
            ))}
          </div>
          <span className="w-24 shrink-0 sm:w-32" aria-hidden />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 sm:w-32" aria-hidden />
          <div className="relative h-4 flex-1">
            {[0.1, 1, 10, 100].map((t) => (
              <span
                key={t}
                className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground tabular-nums"
                style={{ left: `${pos(t)}%` }}
              >
                {t < 1 ? `${t * 1000}ms` : `${t}s`}
              </span>
            ))}
          </div>
          <span className="w-24 shrink-0 sm:w-32" aria-hidden />
        </div>

        {/* tier rows */}
        <div className="mt-3 space-y-3">
          {TIERS.map((tier) => {
            const ttc = tokens / tier.toks
            const ttfp = (tokens * FIRST_PAINT_FRACTION) / tier.toks
            const barPct = pos(ttc)
            const tickPct = pos(ttfp)
            const insideLabel = barPct >= 78

            return (
              <div key={tier.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-right font-mono text-[11px] leading-tight sm:w-32">
                  <span className={cn(tier.highlight ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {tier.label}
                  </span>
                </span>

                <div className="relative h-7 flex-1">
                  {/* time-to-complete bar */}
                  <div
                    className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm transition-all duration-300"
                    style={{
                      width: `${Math.max(barPct, 0.6)}%`,
                      background: tier.highlight ? "oklch(0.6 0.14 210)" : "oklch(0.62 0.02 260)",
                      opacity: tier.highlight ? 0.95 : 0.55,
                    }}
                  />
                  {/* value label for time-to-complete */}
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 font-mono text-[10.5px] tabular-nums transition-all duration-300",
                      insideLabel ? "pr-1.5 text-background" : "pl-1.5 text-muted-foreground"
                    )}
                    style={insideLabel ? { right: `${100 - barPct}%` } : { left: `${barPct}%` }}
                  >
                    {fmtTime(ttc)}
                  </span>
                  {/* first-paint tick */}
                  <div
                    className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2 bg-foreground/70 transition-all duration-300"
                    style={{ left: `${tickPct}%` }}
                    title={`first paint ≈ ${fmtTime(ttfp)}`}
                  />
                </div>

                <span className="w-24 shrink-0 font-mono text-[10.5px] text-muted-foreground tabular-nums sm:w-32">
                  paint {fmtTime(ttfp)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "oklch(0.66 0.15 150)", opacity: 0.5 }} />
            0.1–1s: feels instant
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "oklch(0.75 0.14 80)", opacity: 0.5 }} />
            1–10s: needs a spinner
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive/50" />
            10s+: attention wanders
          </span>
          <span>│ tick = first paint (8% of doc)</span>
        </div>
      </div>
    </figure>
  )
}
