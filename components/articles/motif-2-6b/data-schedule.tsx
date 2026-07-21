"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Motif's "data mixing scheduler" — a schedule for the *data*, run like a
// learning-rate schedule. The 2.5T-token corpus is split into eight domain
// groups whose sampling ratios move linearly from a start mix to an end mix over
// training. Early training is web-heavy and broad; late training swings hard into
// Korean, code, math, and reasoning. Drag the training-progress handle and watch
// the mixture morph. Numbers are the paper's Table 2 (initial → final ratios).

const ACCENT = "oklch(0.58 0.16 262)"

// [name, initial, final, color]
const GROUPS: Array<[string, number, number, string]> = [
  ["General Web", 0.68, 0.33, "oklch(0.62 0.03 260)"],
  ["Code", 0.1, 0.18, "oklch(0.6 0.15 262)"],
  ["Korean", 0.01, 0.3, "oklch(0.64 0.17 25)"],
  ["Math", 0.02, 0.1, "oklch(0.7 0.15 145)"],
  ["Reasoning", 0.01, 0.05, "oklch(0.68 0.16 300)"],
  ["Academic", 0.06, 0.03, "oklch(0.72 0.13 75)"],
  ["Specialized", 0.05, 0.01, "oklch(0.6 0.1 200)"],
  ["Multilingual", 0.07, 0.0, "oklch(0.55 0.08 330)"],
]

export function DataSchedule() {
  const [p, setP] = useState(0)
  const cur = GROUPS.map(([name, i, f, color]) => ({
    name,
    color,
    v: i + (f - i) * p,
    i,
    f,
  }))
  const tokens = (2.5 * p).toFixed(2)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        data mixing scheduler · the corpus mix moves like a learning-rate schedule
      </div>
      <div className="p-3 sm:p-4">
        {/* stacked composition bar */}
        <div className="flex h-9 w-full overflow-hidden rounded-md border">
          {cur.map((g) => (
            <div
              key={g.name}
              className="h-full transition-all duration-150"
              style={{ width: `${g.v * 100}%`, background: g.color }}
              title={`${g.name} ${(g.v * 100).toFixed(0)}%`}
            />
          ))}
        </div>

        {/* legend with current % and the initial→final trend */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          {cur.map((g) => {
            const up = g.f > g.i
            const flat = g.f === g.i
            return (
              <div key={g.name} className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: g.color }} />
                <span className="truncate text-muted-foreground">{g.name}</span>
                <span className="ml-auto tabular-nums text-foreground">
                  {(g.v * 100).toFixed(0)}%
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    color: flat
                      ? "var(--muted-foreground)"
                      : up
                        ? "oklch(0.7 0.15 145)"
                        : "oklch(0.64 0.17 25)",
                  }}
                >
                  {flat ? "·" : up ? "↑" : "↓"}
                </span>
              </div>
            )
          })}
        </div>

        {/* control */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>training progress — drag</span>
            <span className="tabular-nums text-foreground">
              ~{tokens}T / 2.5T tokens
            </span>
          </div>
          <Range min={0} max={1} step={0.01} value={p} onChange={(e) => setP(+e.target.value)} className="w-full" aria-label="training progress" accent={ACCENT} />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground/70">
            <span>start mix</span>
            <span>end mix</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The swing is the point. <span className="text-foreground">General Web</span> falls from
          68% to 33% while <span style={{ color: "oklch(0.64 0.17 25)" }}>Korean</span> climbs 1% →
          30% and <span style={{ color: "oklch(0.7 0.15 145)" }}>Math</span>,{" "}
          <span style={{ color: "oklch(0.6 0.15 262)" }}>Code</span>, and{" "}
          <span style={{ color: "oklch(0.68 0.16 300)" }}>Reasoning</span> all rise. The model
          learns language on broad web text first, then spends its final, best-behaved tokens on
          the dense skills the benchmarks actually test.
        </p>
      </div>
    </figure>
  )
}
