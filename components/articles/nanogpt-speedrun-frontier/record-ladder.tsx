"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The full results table from primeintellect.ai/research/nanogpt-speedrun.
//
// The metric: the speedrun trains a 124M GPT and counts optimizer steps to reach
// validation loss 3.28. The tuned baseline the agents start from passes at 3,290
// steps; the human record claim sits at 2,600. So the gap on offer is 690 steps,
// and "gap closed" = (3290 - record) / 690. Every published percentage in the
// table reproduces from that formula exactly, which is how I know I am reading
// the metric the same way they are.
//
// The cost view is mine, not theirs: steps gained per unit of spend. It is the
// question the leaderboard does not answer, and it reorders the table.

type Row = {
  model: string
  harness: string
  record: number
  at24: number | null
  totalTok: number // millions
  outTok: number // thousands
  exps: number | null
  calls: number | null
  days: number
  tag?: "serial" | "running"
}

const BASE = 3290
const HUMAN = 2600

const ROWS: Row[] = [
  { model: "Fable 5", harness: "claude-code · high", record: 2726, at24: 3010, totalTok: 800, outTok: 1100, exps: 811, calls: 3000, days: 8.7 },
  { model: "Opus 5", harness: "claude-code · max", record: 2920, at24: 3045, totalTok: 183, outTok: 690, exps: 292, calls: 401, days: 2.9, tag: "serial" },
  { model: "Kimi K3", harness: "prime-agent · max", record: 2930, at24: 3125, totalTok: 112, outTok: 2200, exps: null, calls: 488, days: 3.6, tag: "serial" },
  { model: "Kimi K3", harness: "kimi-code · max", record: 2974, at24: 3135, totalTok: 682, outTok: 1400, exps: 713, calls: 4000, days: 5.1 },
  { model: "Opus 4.8", harness: "claude-code · max", record: 3018, at24: 3180, totalTok: 318, outTok: 2300, exps: 427, calls: 2000, days: 3.0 },
  { model: "GPT-5.6 Sol", harness: "codex · xhigh", record: 3042, at24: 3160, totalTok: 2900, outTok: 2200, exps: 963, calls: 28000, days: 6.1 },
  { model: "GPT-5.6 Sol Pro", harness: "codex · xhigh", record: 3058, at24: 3100, totalTok: 1200, outTok: 4600, exps: 509, calls: 7000, days: 3.4, tag: "serial" },
  { model: "Sonnet 5", harness: "claude-code · max", record: 3105, at24: 3120, totalTok: 998, outTok: 2100, exps: 213, calls: 2000, days: 2.0 },
  { model: "GPT-5.6 Luna", harness: "codex · xhigh", record: 3110, at24: 3170, totalTok: 894, outTok: 888, exps: 362, calls: 12000, days: 1.9 },
  { model: "Grok 4.5", harness: "grok-cli · xhigh", record: 3120, at24: 3160, totalTok: 46, outTok: 385, exps: 399, calls: 4000, days: 2.7 },
  { model: "Qwen3.8 Max", harness: "qwen-code · max", record: 3120, at24: 3225, totalTok: 216, outTok: 629, exps: 312, calls: 866, days: 1.9, tag: "running" },
  { model: "GLM 5.2", harness: "pi · high", record: 3150, at24: 3200, totalTok: 57, outTok: 1700, exps: 194, calls: 1000, days: 1.8 },
  { model: "DeepSeek V4 Pro", harness: "claude-code · max", record: 3205, at24: 3205, totalTok: 26, outTok: 319, exps: 189, calls: 309, days: 1.1, tag: "running" },
  { model: "GPT-5.6 Terra", harness: "codex · xhigh", record: 3214, at24: 3214, totalTok: 417, outTok: 298, exps: 154, calls: 3000, days: 1.1, tag: "serial" },
  { model: "Grok 4.6", harness: "grok-cli · xhigh", record: 3220, at24: null, totalTok: 27, outTok: 346, exps: 97, calls: 691, days: 0.6, tag: "running" },
  { model: "Muse Spark 1.2", harness: "muse-code · xhigh", record: 3230, at24: null, totalTok: 41, outTok: 910, exps: 56, calls: 724, days: 0.6, tag: "running" },
  { model: "Muse Spark 1.1", harness: "pi · max", record: 3232, at24: 3240, totalTok: 122, outTok: 1600, exps: 489, calls: 2000, days: 3.7 },
  { model: "GPT-5.5", harness: "codex · xhigh", record: 3234, at24: 3234, totalTok: null as unknown as number, outTok: null as unknown as number, exps: null, calls: null, days: 1.1, tag: "serial" },
  { model: "Kimi K2.7", harness: "kimi-code · max", record: 3240, at24: 3240, totalTok: 160, outTok: 763, exps: 187, calls: 3000, days: 1.6 },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const gap = (r: Row) => (100 * (BASE - r.record)) / (BASE - HUMAN)
const gained = (r: Row) => BASE - r.record

export function RecordLadder() {
  const [mode, setMode] = useState<"gap" | "cost">("gap")

  const rows =
    mode === "gap"
      ? ROWS
      : [...ROWS]
          .filter((r) => r.totalTok != null)
          .map((r) => ({ ...r, per: (r.totalTok * 1e6) / gained(r) }))
          .sort((a, b) => a.per - b.per)

  const maxPer = mode === "cost" ? Math.max(...(rows as (Row & { per: number })[]).map((r) => r.per)) : 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          steps to val loss 3.28 · baseline 3,290 · human 2,600
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          nobody reached the human record
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["gap", "share of the 690-step gap closed"],
              ["cost", "total tokens per step gained"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {rows.map((r, i) => {
            const g = gap(r)
            const per = (r as Row & { per?: number }).per ?? 0
            return (
              <div key={`${r.model}-${r.harness}`} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-right font-mono text-[9px] text-muted-foreground">{i + 1}</span>
                <span className="w-36 shrink-0 truncate text-right">
                  <span className="block font-mono text-[10px] text-foreground">{r.model}</span>
                  <span className="block font-mono text-[8px] text-muted-foreground">{r.harness}</span>
                </span>
                <div className="h-5 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-5 rounded-sm"
                    style={{
                      width: mode === "gap" ? `${g}%` : `${Math.max(1, (per / maxPer) * 100)}%`,
                      background: mode === "gap" ? (g > 40 ? GOOD : ACCENT) : per < 1e6 ? GOOD : WARM,
                      opacity: r.tag === "serial" ? 0.55 : 1,
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {r.record.toLocaleString()}
                </span>
                <span
                  className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums"
                  style={{ color: mode === "gap" ? (g > 40 ? GOOD : ACCENT) : per < 1e6 ? GOOD : WARM }}
                >
                  {mode === "gap" ? `${g.toFixed(1)}%` : `${(per / 1e6).toFixed(2)}M`}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[9px] text-muted-foreground">
          <span>middle column = record, in optimizer steps</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT, opacity: 0.55 }} />
            faded = ran under the serial rulebook, not the standard one
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {mode === "gap" ? (
            <>
              Every published percentage reproduces exactly from{" "}
              <span className="font-mono text-foreground">(3290 − record) / 690</span>, so the scoreboard is doing
              nothing clever. The shape it hides is that{" "}
              <span className="text-foreground">the top four are a different population</span> from the rest: four
              runs above 45%, then a cliff to 39% and a long tail that never gets past a quarter of the gap. And
              nobody reached 100%, which is where a human already is.
            </>
          ) : (
            <>
              Now divide the steps each model won by the tokens it burned winning them, and the order changes
              completely. Grok 4.5 is the thriftiest at{" "}
              <span className="text-foreground">0.27M tokens per step</span>{" "}— and closed 24.6% of the gap.
              GPT-5.6 Sol paid <span className="text-foreground">11.7M</span>{" "}per step for 35.9%. That is a 43×
              spread the leaderboard gives you no way to see, and most of it is not buying rank.
              <br />
              <br />
              The model that is good on both axes is{" "}
              <span className="text-foreground">Opus 5</span>: second place at 0.49M tokens per step, in under
              three days. Fable 5 wins the table outright but pays 1.42M per step and takes 8.7 days to do it —
              nearly three times Opus 5&rsquo;s rate for an extra 194 steps. Whether that trade is worth it depends
              entirely on whether you are buying a record or buying research.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
