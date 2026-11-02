"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CPU_RUNS } from "./cpu-data"
import { REPO_AGG, type Group } from "./data"

// A setting is one candidate neuron at one dose, scored on 8 sampled replies. Bars: the share of settings that reach
// 0.375 (the tool's "found" bar) or the mean hit rate, by which screen listed the neuron, against random neurons.
// First tab: the tool's own 46 runs on Qwen3.5-4B, recomputed from its published files (LLM judge, reported).
// Other tabs: our CPU re-implementation on Qwen3-0.6B, keyword scoring in place of the judge (measured).
// Small samples; read the counts.

const ACCENT = "oklch(0.62 0.16 35)"
const STREAM = "oklch(0.60 0.15 255)"
const GREEN = "oklch(0.62 0.13 160)"
const NULL = "oklch(0.55 0.02 255)"

const KEYS = ["read", "write", "both", "control"] as const
type Key = (typeof KEYS)[number]
const COLOR: Record<Key, string> = { read: STREAM, write: ACCENT, both: GREEN, control: NULL }
const NAME: Record<Key, string> = {
  read: "read screen only",
  write: "write screen only",
  both: "both screens",
  control: "random neurons",
}

type Tab = { id: string; label: string; src: string; groups: Partial<Record<Key, Group>>; line: string }

const TABS: Tab[] = [
  {
    id: "repo",
    label: "tool's own runs · 4B",
    src: "reported · recomputed from its files",
    groups: REPO_AGG,
    line: "46 targets, 22,950 steered settings and 2,208 control settings on Qwen3.5-4B, scored by an LLM judge.",
  },
  ...CPU_RUNS.map((r) => ({
    id: r.target,
    label: `${r.target} · 0.6B`,
    src: "measured · CPU re-run",
    groups: r.bySource as Partial<Record<Key, Group>>,
    line: `best: layer ${r.best.layer} neuron ${r.best.neuron} at dose ${r.best.dose > 0 ? "+" : "−"}${Math.abs(r.best.dose)} · confirmed ${r.best.hits}/${r.best.of} · random-neuron 95th percentile ${r.nullP95.toFixed(2)} · ${r.verdict} · ${r.totalS} s end to end`,
  })),
]

function Bars({ tab, metric }: { tab: Tab; metric: "mean_hit" | "frac_ge_0375" }) {
  const keys = KEYS.filter((k) => tab.groups[k])
  const W = 560
  const BH = 22
  const GAP = 12
  const L = 128
  const max = Math.max(0.1, ...keys.map((k) => tab.groups[k]![metric]))
  return (
    <svg viewBox={`0 0 ${W} ${keys.length * (BH + GAP)}`} role="img" className="h-auto w-full">
      <title>
        {`Bars for ${tab.label}: ` +
          keys.map((k) => `${NAME[k]}, ${tab.groups[k]![metric].toFixed(3)} from ${tab.groups[k]!.settings} settings`).join("; ") +
          "."}
      </title>
      {keys.map((k, i) => {
        const g = tab.groups[k]!
        const v = g[metric]
        const w = Math.max(1, (v / max) * (W - L - 130))
        const y = i * (BH + GAP)
        return (
          <g key={k}>
            <text x={0} y={y + BH / 2 + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.75}>
              {NAME[k]}
            </text>
            <rect x={L} y={y} width={w} height={BH} rx={3} fill={COLOR[k]} fillOpacity={0.85} />
            <text x={L + w + 6} y={y + BH / 2 + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.8}>
              {v.toFixed(3)} · {g.settings.toLocaleString("en-US")}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ScreenPrecision() {
  const [t, setT] = useState(0)
  const [metric, setMetric] = useState<"mean_hit" | "frac_ge_0375">("frac_ge_0375")
  const tab = TABS[t]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">{tab.src}</span>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Run">
          {TABS.map((r, k) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={k === t}
              onClick={() => setT(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                k === t ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex gap-1" role="group" aria-label="Metric">
          {(
            [
              ["frac_ge_0375", "share of settings at 0.375 or more"],
              ["mean_hit", "mean hit rate"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={metric === k}
              onClick={() => setMetric(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Bars tab={tab} metric={metric} />
        <p className="mt-3 rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed" aria-live="polite">
          {tab.line}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          The number after each value is how many settings it comes from. A neuron that one screen listed is counted once, under that screen;
          one that the read list and a write list both put on the shortlist is counted under both screens.
        </p>
      </div>
    </figure>
  )
}
