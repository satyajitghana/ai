"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Table 8 of the report, verbatim: TTFT is the measured quantity; prefill
// throughput is DERIVED from it (context / TTFT). Decode throughput is
// reported directly and stays flat regardless of context length. The point
// of this widget is to make that flatness visible next to the rising prefill
// number, and to run the actual arithmetic for a chosen output length —
// exactly the prefill-is-compute-bound / decode-is-memory-bound split.

const ACCENT = "oklch(0.72 0.15 195)"
const MUTED = "oklch(0.62 0.02 260)"

type Config = {
  key: string
  label: string
  context: string
  contextTokens: string // "1M" or "10M", for prose
  ttft: number // seconds, measured
  prefill: number // tok/s, derived
  decode: number // tok/s, measured
}

const CONFIGS: Config[] = [
  { key: "1m-c1", label: "1M · c1", context: "1M tokens, concurrency 1", contextTokens: "1M", ttft: 23.6, prefill: 42_400, decode: 335 },
  { key: "1m-c4", label: "1M · c4", context: "1M tokens, concurrency 4 (mean)", contextTokens: "1M", ttft: 49.3, prefill: 81_200, decode: 322 },
  { key: "10m-c1", label: "10M · c1", context: "10M tokens, concurrency 1", contextTokens: "10M", ttft: 72.9, prefill: 137_200, decode: 337 },
]

const TTFT_MAX = 73
const PREFILL_MAX = 138_000
const DECODE_MAX = 340

export function PrefillDecodeMath() {
  const [sel, setSel] = useState(2) // default: the 10M headline row
  const [outputTokens, setOutputTokens] = useState(800)
  const cfg = CONFIGS[sel]

  const decodeTime = outputTokens / cfg.decode
  const totalTime = cfg.ttft + decodeTime
  const ratio = Math.round(cfg.prefill / cfg.decode)

  const bar = (value: number, max: number) => `${Math.min(100, Math.max(1.5, (value / max) * 100)).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>prefill vs. decode · single B200, table 8</span>
        <span className="text-muted-foreground/50">measured, not simulated</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CONFIGS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setSel(i)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                i === sel
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">time to first token</span>
            <div className="h-3 rounded-sm bg-muted/30">
              <div className="h-3 rounded-sm" style={{ width: bar(cfg.ttft, TTFT_MAX), background: ACCENT }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
              {cfg.ttft.toFixed(1)}s
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">prefill (derived)</span>
            <div className="h-3 rounded-sm bg-muted/30">
              <div className="h-3 rounded-sm" style={{ width: bar(cfg.prefill, PREFILL_MAX), background: MUTED }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
              {(cfg.prefill / 1000).toFixed(1)}K/s
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">decode (measured)</span>
            <div className="h-3 rounded-sm bg-muted/30">
              <div className="h-3 rounded-sm" style={{ width: bar(cfg.decode, DECODE_MAX), background: MUTED }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
              {cfg.decode}/s
            </span>
          </div>
        </div>

        <div className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          {cfg.context} — prefill runs <span className="text-foreground">{ratio}×</span>{" "}faster than decode, token
          for token. That ratio is the compute-bound / memory-bound split, not a serving inefficiency.
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>output tokens wanted (drag)</span>
            <span className="text-foreground">{outputTokens}</span>
          </div>
          <Range
            min={50}
            max={4000}
            step={50}
            value={outputTokens}
            onChange={(e) => setOutputTokens(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          At <span className="text-foreground">{cfg.context}</span>, first token lands at{" "}
          <span style={{ color: ACCENT }}>{cfg.ttft.toFixed(1)}s</span>{" "}— that is what a{" "}
          {cfg.contextTokens}-token prefill running at{" "}
          {(cfg.prefill / 1000).toFixed(1)}K tok/s actually costs in wall-clock time. From there, streaming{" "}
          <span className="text-foreground">{outputTokens}</span>{" "}output tokens at {cfg.decode} tok/s adds{" "}
          <span style={{ color: ACCENT }}>{decodeTime.toFixed(1)}s</span>, for{" "}
          <span style={{ color: ACCENT }}>{totalTime.toFixed(1)}s</span>{" "}total. The two rates differ by ~
          {ratio}× because they are different bottlenecks — prefill is one big matrix multiply over the whole
          prompt, decode is one token at a time gated by memory bandwidth (see{" "}
          <a href="/articles/how-llm-inference-works" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
            how LLM inference works
          </a>
          ) — and no architecture change moves them closer together; it only shifts where the two curves sit.
        </p>
      </div>
    </figure>
  )
}
