"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A port of two files of OPAL (xingjian-bai/opal at 2e83eb0): opal/schedule.py, which decides at which
// updates the agent is asked, and opal/estimate.py, which prices those decisions from the authors' own
// 567 measured Opus 5.5 decisions. Same arithmetic, same constants. Every number shown is also in the prose.

type Schedule = "front" | "uniform"

const EARLY_FRACTION = 0.05
const EARLY_SHARE = 0.2
// (low, typical, high), from estimate.py
const FIRST_SECONDS = [100, 250, 430]
const LATER_SECONDS = [10, 27, 50]
const FIRST_COST = [0.3, 1.08, 1.6]
const LATER_COST = [0.05, 0.23, 0.38]

// Python's round(): halves go to the even neighbour.
function pyRound(x: number) {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

function snap(updates: number[], total: number, cadence: number) {
  const s = new Set(updates.map((u) => Math.ceil(u / cadence) * cadence))
  return [...s].filter((u) => u > 0 && total - u >= cadence).sort((a, b) => a - b)
}

function decisionUpdates(total: number, n: number, cadence: number, schedule: Schedule) {
  if (total <= 1 || n <= 0) return []
  if (schedule === "uniform") {
    const gap = Math.max(1, Math.floor(total / n))
    return snap(Array.from({ length: n }, (_, i) => gap * (i + 1)), total, cadence)
  }
  const nEarly = Math.max(1, pyRound(n * EARLY_SHARE))
  const segments: [number, number][] = [
    [EARLY_FRACTION, nEarly],
    [1, Math.max(0, n - nEarly)],
  ]
  const out: number[] = []
  const seen = new Set<number>()
  let start = 0
  for (const [frac, c] of segments) {
    const end = frac === 1 ? total : Math.max(1, Math.floor(total * frac))
    const span = end - start
    const parts = end === total ? c + 1 : c
    const raw = c ? Array.from({ length: c }, (_, i) => start + pyRound((span * (i + 1)) / parts)) : []
    for (const u of snap(raw, total, cadence)) {
      if (!seen.has(u)) {
        seen.add(u)
        out.push(u)
      }
    }
    start = end
  }
  return out
}

const cost = (n: number, w: number) => (n <= 0 ? 0 : FIRST_COST[w] + (n - 1) * LATER_COST[w])
const waiting = (n: number, w: number) => (n <= 0 ? 0 : FIRST_SECONDS[w] + (n - 1) * LATER_SECONDS[w])

const PRESETS = [
  { key: "dit", label: "LightningDiT-XL/1", total: 80000 },
  { key: "gold", label: "Goldfish Amharic", total: 64626 },
  { key: "rae", label: "RAEv2-B", total: 25020 },
  { key: "nano", label: "modded-nanogpt", total: 3250 },
  { key: "cpu", label: "my CPU toy", total: 3000 },
] as const

const usd = (x: number) => `$${(Math.round(x * 100) / 100).toFixed(2)}`
function dur(s: number) {
  if (s < 90) return `${Math.round(s)} s`
  if (s < 5400) return `${Math.round(s / 60)} min`
  return `${(Math.round(s / 360) / 10).toFixed(1)} h`
}
const r2 = (n: number) => Math.round(n * 100) / 100

const W = 640
const X0 = 12
const X1 = 628

export function DecisionPlanner() {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("dit")
  const [n, setN] = useState(50)
  const [schedule, setSchedule] = useState<Schedule>("front")
  const [blocking, setBlocking] = useState(true)
  const every = 50
  const total = PRESETS.find((p) => p.key === preset)!.total
  const ups = decisionUpdates(total, n, every, schedule)
  const xOf = (u: number) => r2(X0 + (u / total) * (X1 - X0))
  const early = ups.filter((u) => u <= total * EARLY_FRACTION).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">when OPAL asks, and what it costs · opal/schedule.py + estimate.py</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="run length">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={preset === p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                preset === p.key ? "border-foreground/30 bg-muted/40 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label} · {p.total.toLocaleString("en-US")}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <label className="flex items-center gap-3 font-mono text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">decisions {n}</span>
            <Range min={1} max={100} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="decisions" className="w-full" />
          </label>
          <div className="flex gap-1.5" role="group" aria-label="schedule">
            {(["front", "uniform"] as Schedule[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={schedule === s}
                onClick={() => setSchedule(s)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px]",
                  schedule === s ? "border-foreground/30 bg-muted/40 text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={!blocking}
            onClick={() => setBlocking((b) => !b)}
            className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
          >
            {blocking ? "training waits" : "training goes on"}
          </button>
        </div>

        <svg viewBox={`0 0 ${W} 74`} className="w-full" role="img" aria-label={`${ups.length} decision updates over ${total} updates`}>
          <rect x={X0} y={14} width={xOf(total * EARLY_FRACTION) - X0} height={34} className="fill-amber-500/15" />
          <line x1={X0} x2={X1} y1={48} y2={48} className="stroke-muted-foreground/50" />
          {ups.map((u) => (
            <line key={u} x1={xOf(u)} x2={xOf(u)} y1={20} y2={48} className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={1.2} />
          ))}
          <text x={X0} y={64} fontSize={11} className="fill-muted-foreground font-mono">0</text>
          <text x={X1} y={64} fontSize={11} textAnchor="end" className="fill-muted-foreground font-mono">
            update {total.toLocaleString("en-US")}
          </text>
          <text x={X0 + 2} y={10} fontSize={10} className="fill-amber-700 font-mono dark:fill-amber-400">first 5%</text>
        </svg>

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">decisions that can happen</div>
            <div className="text-base">{ups.length}</div>
            <div className="text-muted-foreground">{early} in the first 5%</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">agent cost, typical</div>
            <div className="text-base">{usd(cost(ups.length, 1))}</div>
            <div className="text-muted-foreground">
              {usd(cost(ups.length, 0))} to {usd(cost(ups.length, 2))}
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">training waits, typical</div>
            <div className="text-base">{blocking ? dur(waiting(ups.length, 1)) : "0 s"}</div>
            <div className="text-muted-foreground">
              {blocking ? `${dur(waiting(ups.length, 0))} to ${dur(waiting(ups.length, 2))}` : "edits land late instead"}
            </div>
          </div>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          Decisions snap up to the next check (every 50 updates) and none falls in the last 50. Prices are the medians and ranges
          of 567 decisions the authors logged with Opus 5.5 at effort high: first decision $1.08 (reads the code), each later one
          $0.23. Reported, for comparison: the LightningDiT-XL/1 run cost $6.42 for about 100 decisions.
        </p>
      </div>
    </figure>
  )
}
