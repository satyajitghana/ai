"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// RQ2 with the row the paper's Table 2 leaves out.
//
// Table 2 runs four skill banks through the same DS4-Flash reasoning loop and
// reports mean and std over five runs on seven benchmarks. Its Code2Skill row
// equals Table 1's "DS4-Flash, reasoning, with Code2Skill" row to the displayed
// precision (44.70 vs 44.7, 42.34 vs 42.3, ...), so Table 1's matching
// no-skill row is the same loop with the skills switched off. That is the
// control this chart adds. Averages over the seven are the paper's for the four
// banks and mine (plain arithmetic on Table 1) for the control.

const BENCH = ["Avg", "SWE", "BigCode", "AIME", "HMMT", "Terminal", "LongCLI", "AgentBench"] as const
type Bench = (typeof BENCH)[number]

const BANKS: { k: string; label: string; color: string; v: Record<Bench, number> }[] = [
  {
    k: "t2s",
    label: "Trace2Skill",
    color: "oklch(0.64 0.06 250)",
    v: { Avg: 31.0, SWE: 6.0, BigCode: 31.9, AIME: 63.3, HMMT: 46.7, Terminal: 6.9, LongCLI: 18.8, AgentBench: 43.1 },
  },
  {
    k: "expel",
    label: "ExpeL",
    color: "oklch(0.62 0.07 300)",
    v: { Avg: 27.9, SWE: 7.5, BigCode: 29.4, AIME: 50.0, HMMT: 20.0, Terminal: 22.2, LongCLI: 18.8, AgentBench: 47.4 },
  },
  {
    k: "skillrl",
    label: "SkillRL-Bank",
    color: "oklch(0.64 0.08 200)",
    v: { Avg: 32.8, SWE: 36.8, BigCode: 29.4, AIME: 43.3, HMMT: 26.7, Terminal: 31.9, LongCLI: 10.4, AgentBench: 51.2 },
  },
  {
    k: "c2s",
    label: "Code2Skill",
    color: "oklch(0.6 0.15 155)",
    v: { Avg: 49.5, SWE: 44.7, BigCode: 42.3, AIME: 70.0, HMMT: 53.3, Terminal: 45.2, LongCLI: 30.0, AgentBench: 61.3 },
  },
]

const NONE: Record<Bench, number> = {
  Avg: 41.6,
  SWE: 34.32,
  BigCode: 43.27,
  AIME: 63.33,
  HMMT: 46.0,
  Terminal: 33.9,
  LongCLI: 15.0,
  AgentBench: 55.27,
}

const SCALE = 80

export function BaselineCheck() {
  const [b, setB] = useState<Bench>("Avg")
  const [ctl, setCtl] = useState(true)
  const none = NONE[b]
  // Table 2 prints one decimal; 63.3 and 63.33 are the same 19-of-30 on AIME.
  const below = BANKS.filter((x) => x.v[b] < none - 0.05).map((x) => x.label)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          four skill banks, one DS4-Flash reasoning loop, and the loop with no skills
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">paper, Tables 1 &amp; 2</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {BENCH.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setB(x)}
              aria-pressed={x === b}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors",
                x === b
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/35",
              )}
            >
              {x === "Avg" ? "average of 7" : x}
            </button>
          ))}
        </div>

        <div className="relative mt-4 space-y-2">
          {BANKS.map((x) => {
            const v = x.v[b]
            return (
              <div key={x.k} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-right font-mono text-[10px] text-foreground sm:w-28">{x.label}</span>
                <div className="relative h-5 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-5 rounded-sm transition-all"
                    style={{ width: `${Math.min(100, (v / SCALE) * 100).toFixed(2)}%`, background: x.color, opacity: 0.9 }}
                  />
                  {ctl && (
                    <div
                      className="absolute inset-y-[-3px] border-l-2 border-dashed border-foreground/70"
                      style={{ left: `${Math.min(100, (none / SCALE) * 100).toFixed(2)}%` }}
                      aria-hidden
                    />
                  )}
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums" style={{ color: x.color }}>
                  {v.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCtl((c) => !c)}
            aria-pressed={ctl}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors",
              ctl ? "border-foreground/30 bg-muted/50 text-foreground" : "bg-muted/20 text-muted-foreground",
            )}
          >
            {ctl ? "hide" : "show"} the no-skill control
          </button>
          {ctl && (
            <span className="font-mono text-[10px] text-muted-foreground">
              dashed line: no skills, {none.toFixed(b === "Avg" ? 1 : 2)}
            </span>
          )}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {ctl ? (
            below.length === 0 ? (
              <>Every bank is above the no-skill loop here.</>
            ) : (
              <>
                Below the no-skill loop: <span className="text-foreground">{below.join(", ")}</span>.
              </>
            )
          ) : (
            <>This is Table 2 as published: Code2Skill first on every benchmark.</>
          )}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Start on the average, then turn the control off and on. As published, the comparison says code beats
          trajectories. With the control, it says all three trajectory banks, as the authors built them, made the
          agent worse than no skills at all, and so did Code2Skill on BigCodeBench. Beating a baseline that
          loses to nothing is not the same result as beating a working one.
        </p>
      </div>
    </figure>
  )
}
