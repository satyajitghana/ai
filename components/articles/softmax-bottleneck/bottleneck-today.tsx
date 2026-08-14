"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Has the geometry relaxed since 2017? No. It tightened.
//
// Every row is read from that model's published config.json on the Hub —
// hidden_size and vocab_size, nothing inferred. The ratio |V| / d is the same
// quantity the paper's own setup had at 25 (d = 400 over a 10,000-token
// vocabulary), in the experiment where breaking the bound was worth 3.6
// perplexity.
//
// The ratio is NOT a severity score. rank(A) for natural language is still
// unmeasured, and a 2026 model has representations no 2017 LSTM had. What the
// column shows is that the shape everyone stopped worrying about has not gone
// away: vocabularies grew roughly 15x while hidden sizes grew about 10x, and for
// small models the gap widened enormously.

type M = { id: string; label: string; d: number; v: number; note?: string }

const MODELS: M[] = [
  { id: "qwen06", label: "Qwen3-0.6B", d: 1024, v: 151936 },
  { id: "smol135", label: "SmolLM2-135M", d: 576, v: 49152 },
  { id: "qwen17", label: "Qwen3-1.7B", d: 2048, v: 151936 },
  { id: "oss20", label: "gpt-oss-20b", d: 2880, v: 201088 },
  { id: "smol3", label: "SmolLM3-3B", d: 2048, v: 128256 },
  { id: "qwen4", label: "Qwen3-4B", d: 2560, v: 151936 },
  { id: "olmo1", label: "OLMo-2-1B", d: 2048, v: 100352 },
  { id: "qwen8", label: "Qwen3-8B", d: 4096, v: 151936 },
  { id: "qwen32", label: "Qwen3-32B", d: 5120, v: 151936 },
  { id: "olmo7", label: "OLMo-2-7B", d: 4096, v: 100352 },
  { id: "kimi", label: "Kimi-K2", d: 7168, v: 163840 },
  { id: "phi4", label: "phi-4", d: 5120, v: 100352 },
  { id: "dsv3", label: "DeepSeek-V3", d: 7168, v: 129280 },
  { id: "mistral", label: "Mistral-7B-v0.3", d: 4096, v: 32768, note: "the only one here with a small vocabulary" },
]

const PAPER = { label: "the paper's PTB softmax", d: 400, v: 10000 }

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

export function BottleneckToday() {
  const [sel, setSel] = useState("qwen06")

  const paperRatio = PAPER.v / PAPER.d
  const rows = MODELS.map((m) => ({ ...m, ratio: m.v / m.d })).sort((a, b) => b.ratio - a.ratio)
  const max = Math.max(...rows.map((r) => r.ratio))
  const cur = rows.find((r) => r.id === sel) ?? rows[0]
  const tighter = rows.filter((r) => r.ratio > paperRatio).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">vocabulary ÷ hidden size, from published configs</span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          {tighter} of {rows.length} tighter than 2017
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {rows.map((r) => {
            const on = r.id === sel
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSel(r.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                  on ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                )}
              >
                <span className="w-32 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                  {r.label}
                </span>
                <div className="relative h-4 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{ width: `${(r.ratio / max) * 100}%`, background: r.ratio > paperRatio ? WARM : GOOD }}
                  />
                  <div
                    className="absolute top-0 h-4 w-px"
                    style={{ left: `${(paperRatio / max) * 100}%`, background: "currentColor", opacity: 0.55 }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {r.ratio.toFixed(0)}×
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-1 pl-32 font-mono text-[9px] text-muted-foreground">
          vertical tick = the 2017 paper&rsquo;s own ratio (400 dims over a 10,000-token vocabulary, 25×)
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{cur.label}</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              d = {cur.d.toLocaleString()}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">rank ceiling on the logits</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">vocabulary</div>
            <div className="font-mono text-sm tabular-nums text-foreground">{cur.v.toLocaleString()}</div>
            <div className="font-mono text-[9px] text-muted-foreground">directions the true matrix may need</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">unreachable share</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {(100 * (1 - cur.d / cur.v)).toFixed(1)}%
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">if rank(A) were full</div>
          </div>
        </div>
        {cur.note ? (
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">{cur.note}</div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read this as geometry, not as a severity score — the true rank of natural language is still unmeasured, and
          a 2026 model has representations no 2017 LSTM had. What the column does show is that the constraint the
          field stopped worrying about did not relax. Vocabularies grew from ten thousand to two hundred thousand
          while hidden sizes grew from hundreds to thousands, and{" "}
          <span className="text-foreground">the small models got it worst</span>: Qwen3-0.6B carries the same
          151,936-token vocabulary as Qwen3-32B through one fifth the width. Nobody re-ran the measurement.
        </p>
      </div>
    </figure>
  )
}
