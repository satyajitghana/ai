"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The "text tax": bolt audio onto an LLM and its text scores usually fall off a
// cliff. Audex's claim is that they don't. Pick a text benchmark and compare the
// audio LLMs head-to-head — Audex (green) sits at or near the top of every one,
// while lighter audio models (Voxtral, MiMo, Step-Audio) show the tax plainly.
// All numbers are from the paper's Table 5 (higher is better); "–" = not reported.

const AUDEX = "oklch(0.7 0.16 150)" // green

const NAMES: Record<string, string> = {
  S: "Step-Audio R1.1 33B",
  V: "Voxtral Small-24B",
  M: "MiMo-Audio 7B",
  Q3: "Qwen3-Omni 30B Thinking",
  Q35: "Qwen3.5-Omni Flash 35B",
  A: "Audex 30B-A3B",
}

const BENCH: { key: string; note: string; vals: Record<string, number> }[] = [
  { key: "AIME 2025", note: "competition math", vals: { S: 44.8, Q3: 73.7, A: 91.2 } },
  { key: "MMLU-Pro", note: "knowledge", vals: { S: 75.3, V: 60.5, M: 55.3, Q3: 80.4, Q35: 79.9, A: 78.9 } },
  { key: "GPQA-Diamond", note: "graduate science", vals: { S: 60.7, V: 37.9, M: 13.8, Q3: 73.1, Q35: 76.4, A: 74.9 } },
  { key: "ArenaHard v2", note: "alignment", vals: { S: 44.3, V: 5.0, M: 18.7, Q3: 55.1, A: 81.6 } },
  { key: "IFBench", note: "instruction following", vals: { S: 32.2, V: 25.2, M: 24.4, Q3: 52.4, Q35: 38.4, A: 77.8 } },
  { key: "LiveCodeBench v6", note: "coding", vals: { S: 22.9, V: 22.9, Q3: 59.2, Q35: 56.6, A: 85.3 } },
  { key: "τ²-Bench", note: "agentic tool use", vals: { Q3: 45.4, Q35: 78.0, A: 57.2 } },
]

export function TextTax() {
  const [bi, setBi] = useState(4) // IFBench — a stark one
  const bench = BENCH[bi]

  const rows = Object.entries(bench.vals)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v)
  const max = Math.max(...rows.map((r) => r.v), 1)
  const audexRank = rows.findIndex((r) => r.k === "A") + 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        the text tax · audio LLMs scored on text-only benchmarks
      </div>
      <div className="p-3 sm:p-4">
        {/* benchmark tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {BENCH.map((b, i) => {
            const on = i === bi
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBi(i)}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                  on
                    ? "border-transparent text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={on ? { background: AUDEX } : undefined}
              >
                {b.key}
              </button>
            )
          })}
        </div>

        <div className="mb-2 font-mono text-[10px] text-muted-foreground">
          {bench.key} · {bench.note} · higher is better
        </div>

        <div className="space-y-1.5">
          {rows.map((r) => {
            const isA = r.k === "A"
            return (
              <div key={r.k} className="grid grid-cols-[132px_1fr_38px] items-center gap-2 sm:grid-cols-[180px_1fr_38px]">
                <span
                  className={cn(
                    "truncate font-mono text-[11px]",
                    isA ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {NAMES[r.k]}
                </span>
                <span className="h-4 overflow-hidden rounded bg-muted/50">
                  <span
                    className="block h-full rounded transition-all duration-300"
                    style={{
                      width: `${(r.v / max) * 100}%`,
                      background: isA ? AUDEX : "var(--muted-foreground)",
                      opacity: isA ? 1 : 0.4,
                    }}
                  />
                </span>
                <span
                  className={cn(
                    "text-right font-mono text-[11px] tabular-nums",
                    isA ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {r.v.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          On <span className="text-foreground">{bench.key}</span> Audex ranks{" "}
          <span style={{ color: AUDEX }}>
            #{audexRank} of {rows.length}
          </span>
          . Across the table it holds frontier text scores — AIME 91.2, MMLU-Pro 78.9,
          a 1M-token context — where models that grafted audio on top give much of it back.
          The audio ability is additive, not a trade.
        </p>
      </div>
    </figure>
  )
}
