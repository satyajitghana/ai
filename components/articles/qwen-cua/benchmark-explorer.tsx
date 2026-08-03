"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 1 of the paper, made explorable one benchmark at a time. The point is
// honesty, not a highlight reel: Qwen-CUA leads on 2 of 8 benchmarks outright
// (OSWorld-Verified, MacAgentBench) and trails Claude Opus 4.8 on the other
// six. The "leader" marker is computed from the data on every render — it is
// never hand-picked per benchmark, so it can't drift out of sync with the
// numbers if they're ever revised.
//
// All scores are the paper's own reported numbers (Table 1); baselines were
// reproduced by the Qwen-CUA authors under non-identical inference settings
// (Qwen-3.7 non-thinking, GPT-5.5 xhigh effort, Opus-4.8 max) — noted in the
// footer, not hidden.

type Row = { model: string; value: number }
type Bench = { key: string; label: string; unit: string; note?: string; rows: Row[] }

const MODEL_COLOR: Record<string, string> = {
  "Qwen-CUA": "oklch(0.68 0.14 200)",
  "Qwen-3.7": "oklch(0.6 0.02 260)",
  "GPT-5.5": "oklch(0.4 0.01 260)",
  "Opus-4.8": "oklch(0.64 0.15 45)",
}
const BENCHES: Bench[] = [
  {
    key: "osworld-verified",
    label: "OSWorld-Verified",
    unit: "success rate",
    note: "Everyday desktop workflows. XLang Lab both built this benchmark and co-authored Qwen-CUA.",
    rows: [
      { model: "Qwen-CUA", value: 86.2 },
      { model: "Qwen-3.7", value: 73.3 },
      { model: "GPT-5.5", value: 78.7 },
      { model: "Opus-4.8", value: 83.4 },
    ],
  },
  {
    key: "osworld2",
    label: "OSWorld 2.0",
    unit: "binary completion",
    note: "Long-horizon tasks, strict pass/fail. Partial-credit scores run higher for every model.",
    rows: [
      { model: "Qwen-CUA", value: 18.5 },
      { model: "Qwen-3.7", value: 2.5 },
      { model: "GPT-5.5", value: 13.9 },
      { model: "Opus-4.8", value: 20.3 },
    ],
  },
  {
    key: "mypcbench",
    label: "MyPCBench",
    unit: "perfect-task rate",
    note: "Personalized, cross-app workflows tied to a simulated user's files and accounts.",
    rows: [
      { model: "Qwen-CUA", value: 58.7 },
      { model: "Qwen-3.7", value: 51.6 },
      { model: "GPT-5.5", value: 47.3 },
      { model: "Opus-4.8", value: 62.0 },
    ],
  },
  {
    key: "macagentbench",
    label: "MacAgentBench",
    unit: "pass@1",
    note: "25 real macOS apps, bare-metal Mac minis. One domain (\"clock\") scored 0% for every model — a known evaluator bug the paper disclosed rather than quietly fixed.",
    rows: [
      { model: "Qwen-CUA", value: 69.2 },
      { model: "Qwen-3.7", value: 57.1 },
      { model: "GPT-5.5", value: 66.7 },
      { model: "Opus-4.8", value: 58.4 },
    ],
  },
  {
    key: "gym-anything",
    label: "Gym-Anything",
    unit: "avg. score",
    note: "97 of 197 possible environments actually ran; 100 were excluded for setup reasons.",
    rows: [
      { model: "Qwen-CUA", value: 46.3 },
      { model: "Qwen-3.7", value: 33.1 },
      { model: "GPT-5.5", value: 45.6 },
      { model: "Opus-4.8", value: 47.3 },
    ],
  },
  {
    key: "scienceboard",
    label: "ScienceBoard",
    unit: "score",
    note: "Scientific-software workflows (Celestia, ChimeraX, GrassGIS, KAlgebra, Lean, TeXstudio).",
    rows: [
      { model: "Qwen-CUA", value: 64.5 },
      { model: "Qwen-3.7", value: 35.5 },
      { model: "GPT-5.5", value: 65.08 },
      { model: "Opus-4.8", value: 66.8 },
    ],
  },
  {
    key: "webarena",
    label: "WebArena",
    unit: "success rate",
    note: "Realistic, functional websites — the one benchmark where GPT-5.5 leads outright.",
    rows: [
      { model: "Qwen-CUA", value: 64.16 },
      { model: "Qwen-3.7", value: 46.2 },
      { model: "GPT-5.5", value: 68.9 },
      { model: "Opus-4.8", value: 65.6 },
    ],
  },
  {
    key: "redteamcua",
    label: "RedTeamCUA",
    unit: "benign task success",
    note: "Same run also measures attack success rate under indirect prompt injection: Qwen-CUA 16.4%, Qwen-3.7 36.6%, GPT-5.5 15.6%, Opus-4.8 0.7% (lower is safer).",
    rows: [
      { model: "Qwen-CUA", value: 74.0 },
      { model: "Qwen-3.7", value: 70.5 },
      { model: "GPT-5.5", value: 75.7 },
      { model: "Opus-4.8", value: 80.7 },
    ],
  },
]

function niceMax(dataMax: number): number {
  const withHeadroom = dataMax * 1.18
  return Math.max(10, Math.ceil(withHeadroom / 10) * 10)
}

export function BenchmarkExplorer() {
  const [key, setKey] = useState("osworld-verified")
  const bench = BENCHES.find((b) => b.key === key) ?? BENCHES[0]
  const scaleMax = niceMax(Math.max(...bench.rows.map((r) => r.value)))
  const best = bench.rows.reduce((a, b) => (b.value > a.value ? b : a))
  const qwen = bench.rows.find((r) => r.model === "Qwen-CUA")!
  const qwenLeads = qwen.model === best.model
  const gap = Math.round((best.value - qwen.value) * 10) / 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Table 1 · 8 computer-use benchmarks</span>
        <span className="text-muted-foreground/50">leader marked with ●</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {BENCHES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setKey(b.key)}
              aria-pressed={key === b.key}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                key === b.key ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={key === b.key ? { background: "oklch(0.68 0.14 200)" } : undefined}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2.5">
          {bench.rows.map((r) => {
            const pct = Math.min(100, (r.value / scaleMax) * 100)
            const isBest = r.model === best.model
            const isQwen = r.model === "Qwen-CUA"
            return (
              <div key={r.model} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-24 shrink-0 truncate text-right font-mono text-xs sm:w-28",
                    isQwen ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.model}
                </span>
                <div className="relative h-6 flex-1">
                  <div className="absolute inset-0 rounded-sm bg-muted/40" />
                  <div
                    className="absolute top-0 h-full rounded-sm"
                    style={{ width: `${pct}%`, background: MODEL_COLOR[r.model], opacity: isQwen ? 0.95 : 0.65 }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] tabular-nums text-foreground"
                    style={{ left: `${pct}%` }}
                  >
                    {isBest ? "● " : ""}
                    {r.value}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 font-mono text-[11px] text-muted-foreground">
          scale: 0–{scaleMax}% ({bench.unit})
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm leading-6 text-foreground">
            {qwenLeads ? (
              <>Qwen-CUA leads {bench.label} at {qwen.value}%.</>
            ) : (
              <>
                Qwen-CUA trails the leader ({best.model}) on {bench.label} by {gap} points — {qwen.value}%
                vs {best.value}%.
              </>
            )}
          </p>
          {bench.note ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{bench.note}</p> : null}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Across all eight, Qwen-CUA leads outright on two (OSWorld-Verified, MacAgentBench), is within a
          few points on four more, and trails GPT-5.5 on WebArena and Opus-4.8 on safety (RedTeamCUA). The
          headline number is real, but it is the best of eight results, not the typical one.
        </p>
      </div>
    </figure>
  )
}
