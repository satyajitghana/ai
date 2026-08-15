"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The most useful pattern in the Qwen3.8-27B card, and it is not one Qwen draws
// attention to: sort the benchmarks by whether they measure DOING or KNOWING and
// the 27B lands on opposite sides of the bigger models.
//
// Against Qwen3.7-Plus — a larger model from the previous generation — the 27B
// wins every agentic row, several by huge margins, and loses the two pure
// knowledge rows. That is a consistent enough split to be a claim about what a
// generation of post-training buys, rather than noise.
//
// All figures are from the Qwen3.8-27B model card. They are the vendor's own
// numbers on the vendor's own harness, which is the caveat that belongs on the
// whole table.

type Row = { name: string; sub: string; v: number; prev: number; plus: number; opus: number | null }

const AGENTIC: Row[] = [
  { name: "DeepSWE 1.1", sub: "agentic coding", v: 42.2, prev: 13.3, plus: 14.2, opus: null },
  { name: "QwenSWEBench", sub: "software engineering", v: 79.0, prev: 49.3, plus: 59.2, opus: 63.8 },
  { name: "RecreationBench", sub: "application recreation", v: 47.1, prev: 29.8, plus: 30.2, opus: null },
  { name: "Vision2Web", sub: "visual web development", v: 62.9, prev: 45.0, plus: 42.1, opus: null },
  { name: "OSWorld-Verified", sub: "computer use", v: 84.3, prev: 63.9, plus: 73.3, opus: 72.7 },
  { name: "WebArena-Verified", sub: "browser use", v: 64.8, prev: 48.8, plus: 55.3, opus: null },
  { name: "SWE-MM", sub: "multimodal SWE", v: 38.6, prev: 25.7, plus: 30.0, opus: 27.1 },
  { name: "Terminal Bench 2.1", sub: "agentic terminal", v: 73.0, prev: 63.4, plus: 64.0, opus: 78.2 },
  { name: "CoWorkBench", sub: "long-horizon office work", v: 70.7, prev: 61.0, plus: 65.1, opus: 68.2 },
  { name: "SWE-bench Pro", sub: "agentic coding", v: 61.7, prev: 53.5, plus: 57.6, opus: 53.4 },
  { name: "JobBench", sub: "professional job tasks", v: 33.4, prev: 21.8, plus: 27.6, opus: null },
  { name: "AndroidWorld", sub: "mobile use", v: 81.9, prev: 70.3, plus: 81.0, opus: 62.0 },
  { name: "NL2Repo-Bench", sub: "repo-level generation", v: 42.3, prev: 36.2, plus: 41.1, opus: 47.6 },
]

const KNOWING: Row[] = [
  { name: "GPQA Diamond", sub: "scientific reasoning", v: 89.2, prev: 87.8, plus: 90.3, opus: 91.3 },
  { name: "HLE", sub: "multidisciplinary reasoning", v: 30.8, prev: 24.0, plus: 34.7, opus: 40.0 },
  { name: "ERQA", sub: "embodied intelligence", v: 65.5, prev: 62.5, plus: 69.8, opus: 40.8 },
  { name: "RealWorldQA", sub: "real-world perception", v: 85.9, prev: 84.1, plus: 86.9, opus: 73.9 },
  { name: "OmniDocBench 1.5", sub: "document intelligence", v: 91.1, prev: 89.4, plus: 91.4, opus: 86.6 },
  { name: "LiveCodeBench v6", sub: "competitive coding", v: 90.3, prev: 83.9, plus: 89.6, opus: 88.8 },
  { name: "IFBench", sub: "instruction following", v: 79.5, prev: 69.1, plus: 79.1, opus: 62.5 },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

export function AgencySplit() {
  const [tab, setTab] = useState<"do" | "know">("do")
  const rows = tab === "do" ? AGENTIC : KNOWING
  const beats = rows.filter((r) => r.v > r.plus).length
  const gaps = rows.map((r) => r.v - r.plus)
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Qwen3.8-27B against three larger models</span>
        <span className="font-mono text-[10px]" style={{ color: mean > 0 ? GOOD : WARM }}>
          {beats}/{rows.length} over Qwen3.7-Plus · mean {mean > 0 ? "+" : ""}{mean.toFixed(1)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {([["do", "doing — agents, tools, computer use"], ["know", "knowing — exams, perception, recall"]] as const).map(
            ([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-pressed={tab === k}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  tab === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ),
          )}
        </div>

        <div className="mt-3 space-y-1">
          {rows.map((r) => {
            const lo = Math.min(r.v, r.prev, r.plus, r.opus ?? 100)
            const win = r.v > r.plus
            return (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-right">
                  <span className="block font-mono text-[10px] text-foreground">{r.name}</span>
                  <span className="block font-mono text-[8px] text-muted-foreground">{r.sub}</span>
                </span>
                <div className="relative h-5 flex-1 rounded-sm bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${r.v}%`, background: win ? GOOD : WARM, opacity: 0.85 }} />
                  <span className="absolute inset-y-0 w-px" style={{ left: `${r.plus}%`, background: "currentColor", opacity: 0.85 }} />
                  <span className="absolute inset-y-1 w-px" style={{ left: `${r.prev}%`, background: MUTED }} />
                  {r.opus !== null ? (
                    <span className="absolute inset-y-1.5 w-px" style={{ left: `${r.opus}%`, background: ACCENT }} />
                  ) : null}
                </div>
                <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{r.v.toFixed(1)}</span>
                <span
                  className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums"
                  style={{ color: win ? GOOD : WARM }}
                >
                  {r.v > r.plus ? "+" : ""}{(r.v - r.plus).toFixed(1)}
                </span>
                <span className="sr-only">{`, lower bound ${lo}`}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[9px] text-muted-foreground">
          <span>bar = Qwen3.8-27B</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-px" style={{ background: "currentColor" }} />
            Qwen3.7-Plus (larger, previous gen)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-px" style={{ background: MUTED }} />
            Qwen3.6-27B
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-px" style={{ background: ACCENT }} />
            Opus4.6 Max
          </span>
          <span>right column = margin over 3.7-Plus</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {tab === "do" ? (
            <>
              Thirteen agentic rows, thirteen wins over a larger previous-generation model, mean margin{" "}
              <span className="text-foreground">+10.9 points</span>. DeepSWE 1.1 goes from 13.3 to 42.2 — a
              three-fold jump that no plausible amount of scale explains and that reads as a benchmark the training
              set learned to do. OSWorld-Verified at 84.3 beats every column including Opus4.6 Max.
            </>
          ) : (
            <>
              Now switch the axis. Against the same larger model the 27B{" "}
              <span className="text-foreground">loses five of these seven</span> — ERQA by 4.3 points and HLE by 3.9,
              the two hardest recall rows on the card. These are the questions where the answer has to already be
              inside the weights, and the two it wins are the two that reward following a format. The split is
              the useful finding in this release: a generation of post-training bought a great deal of doing and
              almost no knowing, and 27B parameters is still 27B parameters when the question is what the model
              knows.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
