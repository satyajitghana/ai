"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// GLM-5.2 -> GLM-5.3 on every row where both are scored.
//
// This is the only chart in the article that gets to be read as a clean
// controlled comparison, because Z.ai says the two models share a base:
// "It uses the same base model as GLM-5.2 — every gain comes from
// post-training." So each bar below is a post-training delta, not a
// new-pretrain delta.
//
// Scores transcribed from the launch post's comparison table.

type Row = { group: string; name: string; a: number; b: number; note?: string }

// a = GLM-5.2, b = GLM-5.3
const ROWS: Row[] = [
  { group: "Coding", name: "Terminal Bench 2.1", a: 81, b: 88.2 },
  { group: "Coding", name: "Terminal Bench 3.0", a: 4.6, b: 28.3, note: "6.2x — the largest relative move on the board, off a floor so low that 5.2 was essentially not playing." },
  { group: "Coding", name: "DeepSWE (v1.1)", a: 46.2, b: 66.9 },
  { group: "Coding", name: "NL2Repo", a: 48.9, b: 58 },
  { group: "Coding", name: "ProgramBench (Almost Solved)", a: 9.5, b: 19 },
  { group: "Coding", name: "FrontierSWE", a: 67.5, b: 78.1 },
  { group: "Coding", name: "SWE-Marathon (v1.1)", a: 19.4, b: 42.5 },
  { group: "Coding", name: "PostTrainBench", a: 31.7, b: 39.8 },
  { group: "Cyber", name: "CyberGym", a: 77.2, b: 84.5 },
  { group: "Cyber", name: "ExploitBench", a: 24.4, b: 54.4, note: "The 'more than doubles' claim in the post. It checks out — 2.23x." },
  { group: "Agentic", name: "Toolathlon Verified", a: 59.9, b: 73 },
  { group: "Agentic", name: "AutomationBench (v1.0.6)", a: 26.2, b: 48.2 },
  { group: "Agentic", name: "Agents' Last Exam (ALE-CLI)", a: 23.8, b: 28.5, note: "The smallest relative gain of the sixteen, at 1.20x." },
  { group: "Agentic", name: "HLE w/ Tools", a: 54.7, b: 62.5 },
]

const OLD = "oklch(0.62 0.03 250)"
const NEW = "oklch(0.60 0.15 255)"

const GROUPS = ["All", "Coding", "Cyber", "Agentic"] as const

export function PostTrainDelta() {
  const [g, setG] = useState<(typeof GROUPS)[number]>("All")

  const shown = ROWS.filter((r) => g === "All" || r.group === g)
  const max = 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">same base model · post-training only</span>
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setG(k)}
              aria-pressed={g === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                g === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {shown.map((r) => {
            const mult = r.b / r.a
            return (
              <div key={r.name}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground">{r.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {r.a} → <span style={{ color: NEW }}>{r.b}</span> · {mult.toFixed(2)}×
                  </span>
                </div>
                <div className="relative mt-1 h-3 rounded-sm bg-muted/40">
                  <div className="absolute inset-y-0 rounded-sm" style={{ width: `${(r.b / max) * 100}%`, background: NEW }} />
                  <div className="absolute inset-y-0 rounded-sm" style={{ width: `${(r.a / max) * 100}%`, background: OLD }} />
                </div>
                {r.note ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{r.note}</div> : null}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: OLD }} />
            GLM-5.2
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: NEW }} />
            GLM-5.3
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Fourteen benchmarks where both models are scored, and GLM-5.3 is ahead on every one of them. That is a
          cleaner result than it looks, because the two models share a base: whatever moved here was moved by
          post-training, not by a new pretraining run. The spread is the interesting part — a 1.20× gain on Agents&rsquo;
          Last Exam and a 6.2× gain on Terminal-Bench 3.0 are not the same kind of claim, and the biggest multiples
          all sit on benchmarks where GLM-5.2 started near the floor.
        </p>
      </div>
    </figure>
  )
}
