"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the self-improvement loop actually moved.
//
// Ornith-1.5 is Ornith-1.0 with the loop extended from scaffold-and-rollout
// optimization to jointly optimizing task generation as well. Both generations
// are reported side by side at 397B and 35B, on the same benchmark suite, which
// makes the delta an unusually clean read on what the addition bought.
//
// It is not uniform, and the pattern is the interesting part. Knowledge and
// single-shot reasoning benchmarks move a few points. Long-horizon agentic
// benchmarks move enormously: DeepSWE goes from 8 to 56 at 397B and from 0 to 22
// at 35B, Toolathlon from 43.2 to 71.2, Frontier-Bench from 2.7 to 13.5.
//
// That is exactly the shape you would predict from a curriculum that generates
// its own tasks and scaffolds — and it is also the shape you would predict from
// a training loop that has learned the structure of these particular harnesses.
// The numbers cannot distinguish those, which is worth saying out loud.
//
// All values from the project page's full tables; every Ornith-1.5 result is
// averaged over five independent runs.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Row = { b: string; group: "coding" | "reasoning" | "agentic"; v10: number; v15: number }

const SCALES: { key: string; label: string; sub: string; rows: Row[] }[] = [
  {
    key: "397",
    label: "397B MoE",
    sub: "the flagship · compared against GLM-5.2, DeepSeek-V4-Flash, Claude Opus 4.8 and Kimi K3",
    rows: [
      { b: "DeepSWE", group: "coding", v10: 8, v15: 56 },
      { b: "Toolathlon-Verified", group: "agentic", v10: 43.2, v15: 71.2 },
      { b: "Frontier-Bench v0.1", group: "coding", v10: 2.7, v15: 13.5 },
      { b: "SWE Atlas – QnA", group: "coding", v10: 41.2, v15: 55.6 },
      { b: "HLE (no tools)", group: "reasoning", v10: 30.2, v15: 44.6 },
      { b: "NL2Repo", group: "coding", v10: 48.2, v15: 59.5 },
      { b: "Terminal Bench 2.1", group: "coding", v10: 77.5, v15: 86.1 },
      { b: "HLE (with tools)", group: "reasoning", v10: 47.5, v15: 56.1 },
      { b: "BrowseComp", group: "agentic", v10: 79.7, v15: 86.6 },
      { b: "WideSearch", group: "agentic", v10: 75.2, v15: 80.8 },
      { b: "GPQA Diamond", group: "reasoning", v10: 88.1, v15: 92.8 },
      { b: "ClawEval", group: "agentic", v10: 77.1, v15: 81.4 },
      { b: "MCP-Atlas", group: "agentic", v10: 76.4, v15: 80 },
      { b: "SWE-bench Verified", group: "coding", v10: 82.4, v15: 86 },
      { b: "SWE-bench Pro", group: "coding", v10: 62.2, v15: 65.1 },
      { b: "SWE-bench Multilingual", group: "coding", v10: 78.9, v15: 79.6 },
    ],
  },
  {
    key: "35",
    label: "35B-A3B MoE",
    sub: "3B active per token · compared against Qwen3.6-35B-A3B, Gemma-4-31B and Muse-Glimmer-30B",
    rows: [
      { b: "DeepSWE", group: "coding", v10: 0, v15: 22 },
      { b: "Frontier-Bench v0.1", group: "coding", v10: 1.4, v15: 5.1 },
      { b: "NL2Repo", group: "coding", v10: 34.6, v15: 46.2 },
      { b: "SWE-bench Pro", group: "coding", v10: 50.4, v15: 59.6 },
      { b: "MCP-Atlas", group: "agentic", v10: 64.4, v15: 70.2 },
      { b: "Terminal Bench 2.1", group: "coding", v10: 64.2, v15: 67.8 },
      { b: "Toolathlon-Verified", group: "agentic", v10: 42.4, v15: 48.7 },
      { b: "BrowseComp", group: "agentic", v10: 63.5, v15: 67.6 },
      { b: "WideSearch", group: "agentic", v10: 63.4, v15: 67.8 },
      { b: "HLE (no tools)", group: "reasoning", v10: 20.8, v15: 25.6 },
      { b: "SWE Atlas – QnA", group: "coding", v10: 37.1, v15: 39.8 },
      { b: "SWE-bench Verified", group: "coding", v10: 75.6, v15: 79 },
      { b: "HLE (with tools)", group: "reasoning", v10: 30.1, v15: 33.4 },
      { b: "GPQA Diamond", group: "reasoning", v10: 86.2, v15: 89.2 },
      { b: "ClawEval", group: "agentic", v10: 69.8, v15: 72.5 },
      { b: "SWE-bench Multilingual", group: "coding", v10: 69.3, v15: 71.4 },
    ],
  },
]

const GROUP_COLOR = { coding: ACCENT, reasoning: GOOD, agentic: WARM } as const

export function GenerationDelta() {
  const [sel, setSel] = useState("397")
  const [sort, setSort] = useState<"abs" | "rel">("abs")
  const s = SCALES.find((x) => x.key === sel) ?? SCALES[0]

  const rows = [...s.rows].sort((a, b) =>
    sort === "abs" ? b.v15 - b.v10 - (a.v15 - a.v10) : (b.v15 + 1) / (b.v10 + 1) - (a.v15 + 1) / (a.v10 + 1),
  )
  const maxDelta = Math.max(...rows.map((r) => r.v15 - r.v10))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Ornith-1.0 → Ornith-1.5 · same benchmark suite · five runs averaged
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          biggest gain +{maxDelta.toFixed(1)} points
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SCALES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground">·</span>
          {(
            [
              ["abs", "by point gain"],
              ["rel", "by ratio"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              aria-pressed={sort === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sort === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{s.sub}</div>

        <div className="mt-3 space-y-1">
          {rows.map((r) => {
            const d = r.v15 - r.v10
            return (
              <div key={r.b} className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{r.b}</span>
                <div className="relative h-4 flex-1 rounded-sm bg-muted/30">
                  <div
                    className="absolute left-0 h-4 rounded-sm"
                    style={{ width: `${r.v10}%`, background: "currentColor", opacity: 0.18 }}
                    title={`Ornith-1.0: ${r.v10}`}
                  />
                  <div
                    className="absolute h-4"
                    style={{
                      left: `${r.v10}%`,
                      width: `${d}%`,
                      background: GROUP_COLOR[r.group],
                      opacity: 0.9,
                      borderRadius: 2,
                    }}
                    title={`+${d.toFixed(1)} to ${r.v15}`}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {r.v10.toFixed(1)}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {r.v15.toFixed(1)}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: GROUP_COLOR[r.group] }}>
                  +{d.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {(
            [
              ["coding", ACCENT],
              ["reasoning", GOOD],
              ["agentic", WARM],
            ] as const
          ).map(([l, c]) => (
            <span key={l} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: c }} />
              {l}
            </span>
          ))}
          <span className="font-mono text-[9px] text-muted-foreground">
            faded bar = Ornith-1.0 · solid segment = what 1.5 added
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The gains are wildly uneven, and the top and bottom of this list say different things. GPQA Diamond, a
          knowledge benchmark, moves 4.7 points. SWE-bench Multilingual moves 0.7. DeepSWE moves{" "}
          <span className="text-foreground">from 8 to 56</span>, and at 35B from a flat zero to 22.
          <br />
          <br />
          That is exactly the shape you would predict if a curriculum that proposes its own tasks and builds its
          own scaffolds mostly buys long-horizon agentic competence rather than knowledge. It is also exactly the
          shape you would predict if a training loop has learned the structure of these particular harnesses. The
          numbers cannot separate those two readings, and the one benchmark that would help —{" "}
          <span className="text-foreground">something the loop demonstrably never touched</span>{" "}— is the one
          nobody publishes.
        </p>
      </div>
    </figure>
  )
}
