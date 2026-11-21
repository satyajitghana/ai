"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The three Qwen3.8-27B harness adapters, task by task, as their own model cards
// report them (harness-hub/Qwen3.8-27B-{pi,opencode,hermes}-adapted, read 2026-11-20).
// Paired runs: one attempt per task, thinking off, 100-step budget, temperature 0.8.
// The four outcome groups are arithmetic on each card's pass rates and its
// "newly solved / lost" column: both = base solved - lost; neither = tasks - both - new - lost.
// Each "both" count matches the task count of the card's own work-per-task table.
// p is the card's exact sign test; I recomputed every one and they match.
// The thinking bars come from each card's four-column table, which on Terminal-Bench
// uses the tasks all four runs graded (83 for pi and OpenCode, 85 for Hermes), so pi's and OpenCode's
// differ slightly from the paired rates.

type H = "pi" | "opencode" | "hermes"
type B = "swe" | "tb"
type Row = {
  n: number
  both: number
  gained: number
  lost: number
  base: number
  adapted: number
  ci: number
  p: string
  turns: [number, number]
  four: [number, number, number, number]
  fourN: number
}

const DATA: Record<H, Record<B, Row>> = {
  pi: {
    swe: { n: 51, both: 18, gained: 15, lost: 2, base: 39.2, adapted: 64.7, ci: 14.2, p: "0.0023", turns: [23, 59], four: [39.2, 74.5, 64.7, 74.5], fourN: 51 },
    tb: { n: 86, both: 32, gained: 16, lost: 2, base: 39.5, adapted: 55.8, ci: 9.1, p: "0.0013", turns: [8, 18], four: [41.0, 54.2, 56.6, 56.6], fourN: 83 },
  },
  opencode: {
    swe: { n: 51, both: 15, gained: 11, lost: 3, base: 35.3, adapted: 51.0, ci: 13.9, p: "0.057", turns: [13, 48], four: [35.3, 47.1, 51.0, 54.9], fourN: 51 },
    tb: { n: 84, both: 31, gained: 13, lost: 8, base: 46.4, adapted: 52.4, ci: 10.7, p: "0.38", turns: [8, 16], four: [47.0, 55.4, 53.0, 56.6], fourN: 83 },
  },
  hermes: {
    swe: { n: 51, both: 12, gained: 10, lost: 3, base: 29.4, adapted: 43.1, ci: 13.3, p: "0.092", turns: [22, 59], four: [29.4, 45.1, 43.1, 51.0], fourN: 51 },
    tb: { n: 85, both: 31, gained: 19, lost: 7, base: 44.7, adapted: 58.8, ci: 11.4, p: "0.029", turns: [8, 21], four: [44.7, 58.8, 58.8, 57.6], fourN: 85 },
  },
}

const HARNESS: { k: H; label: string }[] = [
  { k: "pi", label: "pi" },
  { k: "opencode", label: "OpenCode" },
  { k: "hermes", label: "Hermes Agent" },
]
const BENCH: { k: B; label: string }[] = [
  { k: "swe", label: "SWE-bench Pro (hard 51)" },
  { k: "tb", label: "Terminal-Bench 2.1" },
]

const GROUPS = [
  { k: "both", label: "both solve", fill: "oklch(0.62 0.03 260 / 0.55)" },
  { k: "gained", label: "only the adapter", fill: "oklch(0.66 0.14 160)" },
  { k: "lost", label: "only the base", fill: "oklch(0.64 0.17 25)" },
  { k: "neither", label: "neither", fill: "transparent" },
] as const

const FOUR = ["base", "base, thinking", "adapter", "adapter, thinking"]

export function HarnessLedger() {
  const [h, setH] = useState<H>("pi")
  const [b, setB] = useState<B>("swe")
  const d = DATA[h][b]
  const neither = d.n - d.both - d.gained - d.lost
  const counts = { both: d.both, gained: d.gained, lost: d.lost, neither }
  const dots: { g: (typeof GROUPS)[number] }[] = []
  for (const g of GROUPS) for (let i = 0; i < counts[g.k]; i++) dots.push({ g })

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Three adapters, one base model: task by task</span>
        <span className="font-mono text-[11px] text-muted-foreground">model cards, thinking off, 1 attempt</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">harness</span>
          {HARNESS.map((x) => (
            <button key={x.k} type="button" className={btn(h === x.k)} aria-pressed={h === x.k} onClick={() => setH(x.k)}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">benchmark</span>
          {BENCH.map((x) => (
            <button key={x.k} type="button" className={btn(b === x.k)} aria-pressed={b === x.k} onClick={() => setB(x.k)}>
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_15rem]">
          <div>
            <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">{d.n} tasks, one dot each</div>
            <div className="flex flex-wrap gap-[4px]" role="img" aria-label={`${d.both} solved by both, ${d.gained} only by the adapter, ${d.lost} only by the base, ${neither} by neither`}>
              {dots.map((x, i) => (
                <span
                  key={i}
                  className={cn("size-3.5 rounded-full border", x.g.k === "neither" ? "border-foreground/25" : "border-transparent")}
                  style={{ background: x.g.fill }}
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              {GROUPS.map((g) => (
                <span key={g.k}>
                  <span className={cn("mr-1 inline-block size-2.5 rounded-full align-middle", g.k === "neither" && "border border-foreground/30")} style={{ background: g.fill }} />
                  {g.label} <span className="tabular-nums text-foreground">{counts[g.k]}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2 font-mono text-[11.5px]">
            <div className="rounded-lg border bg-background/40 px-2.5 py-2">
              <div className="text-muted-foreground">pass@1</div>
              <div className="tabular-nums text-foreground">
                {d.base.toFixed(1)}% → {d.adapted.toFixed(1)}%
              </div>
              <div className="tabular-nums text-muted-foreground">
                +{(d.adapted - d.base).toFixed(1)} ± {d.ci.toFixed(1)} pts · p = {d.p}
              </div>
            </div>
            <div className="rounded-lg border bg-background/40 px-2.5 py-2">
              <div className="text-muted-foreground">median turns, tasks both solve</div>
              <div className="tabular-nums text-foreground">
                {d.turns[1]} → {d.turns[0]}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <div className="font-mono text-[11px] text-muted-foreground">with and without thinking ({d.fourN} tasks all four runs graded)</div>
          {d.four.map((v, i) => (
            <div key={FOUR[i]} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{FOUR[i]}</span>
              <div className="h-2.5 rounded-sm bg-muted/40">
                <div className="h-2.5 rounded-sm" style={{ width: `${v}%`, background: i >= 2 ? "oklch(0.66 0.14 160 / 0.8)" : "oklch(0.6 0.03 260 / 0.6)" }} />
              </div>
              <span className="text-right font-mono text-[11px] tabular-nums text-foreground">{v.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {d.lost > 0 ? `The red dots are tasks the base model solved and the adapter did not: training also costs some. ` : ""}
          {Number(d.p) < 0.05
            ? "The sign test on the tasks that changed outcome clears 0.05 here."
            : "Here the sign test on the tasks that changed outcome does not clear 0.05: on one attempt per task this gain is within the noise."}
        </p>
      </div>
    </figure>
  )
}
