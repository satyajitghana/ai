"use client"

import { useState } from "react"

// From the OrcaCyber harness report's own table ("Tokens, LLM Requests, and
// Estimated Cost", Continuum-AI-Corp/OrcaCyber-Harness-CyberGym-Technical-Report
// @ 4847a00). The DeepSeek row is a per-task mean over all 1,507 tasks; the
// OrcaCyber-Zero-1.0 row is a per-task mean over only the 656 tasks where the
// router escalated to it. To put both on one footing, the Zero row is scaled by
// 656 / 1,507, which is how the report's own "total" row is built (its totals
// reproduce from these inputs). Only + - * / is used, so server and client agree.

const TASKS = 1507
const ESCALATED = 656

type Metric = { id: string; name: string; ds: number; zero: number; unit: string; digits: number }

const METRICS: Metric[] = [
  { id: "episodes", name: "Tasks it ran on", ds: TASKS, zero: ESCALATED, unit: "tasks", digits: 0 },
  { id: "input", name: "Input tokens", ds: 15575435, zero: 7901687, unit: "tokens / task", digits: 0 },
  { id: "output", name: "Output tokens", ds: 320222, zero: 257003, unit: "tokens / task", digits: 0 },
  { id: "requests", name: "Model requests", ds: 223, zero: 121, unit: "requests / task", digits: 1 },
  { id: "cost", name: "Estimated cost", ds: 1.15, zero: 4.98, unit: "USD / task", digits: 2 },
]

const DS = "#94a3b8"
const ZERO = "#ea580c"

function fmt(v: number, digits: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function WhoDidTheWork() {
  const [id, setId] = useState("episodes")
  const m = METRICS.find((x) => x.id === id) ?? METRICS[0]
  // Episodes are counted, not averaged: both bars are raw task counts.
  const isCount = m.id === "episodes"
  const ds = m.ds
  const zero = isCount ? m.zero : (m.zero * ESCALATED) / TASKS
  const total = isCount ? TASKS : ds + zero
  const zeroShare = isCount ? (zero / TASKS) * 100 : (zero / total) * 100
  const dsShare = 100 - zeroShare

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Who did the work in the 98.01% run
      </div>
      <div className="mt-2 flex flex-wrap gap-1 font-mono text-[11px]">
        {METRICS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setId(x.id)}
            className={`rounded-md border px-2 py-0.5 ${x.id === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {x.name}
          </button>
        ))}
      </div>

      {isCount ? (
        <div className="mt-4 space-y-2 font-mono text-[11px]">
          <Bar label="DeepSeek V4 Flash" pct={100} color={DS} value={`${fmt(TASKS, 0)} of ${fmt(TASKS, 0)}`} />
          <Bar label="OrcaCyber Zero 1.0" pct={zeroShare} color={ZERO} value={`${fmt(ESCALATED, 0)} of ${fmt(TASKS, 0)}`} />
        </div>
      ) : (
        <div className="mt-4 font-mono text-[11px]">
          <div className="flex h-6 overflow-hidden rounded">
            <div style={{ width: `${dsShare.toFixed(2)}%`, background: DS }} />
            <div style={{ width: `${zeroShare.toFixed(2)}%`, background: ZERO }} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: DS }} />
              DeepSeek V4 Flash: {fmt(ds, m.digits)} {m.unit} ({dsShare.toFixed(1)}%)
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: ZERO }} />
              OrcaCyber Zero 1.0: {fmt(zero, m.digits)} {m.unit} ({zeroShare.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      <p className="mt-3 text-sm">
        {isCount
          ? "The DeepSeek worker ran every task. The router handed a session to OrcaCyber Zero 1.0 only after stall signals crossed a threshold, at most once per task: 656 times, 43.5% of tasks."
          : `Averaged over all ${fmt(TASKS, 0)} tasks, Zero 1.0 accounts for ${zeroShare.toFixed(1)}% of this. It was the expensive tier: about two-thirds of the cost, a fifth of the requests.`}
      </p>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Inputs are the harness report&apos;s per-model table. Zero 1.0&apos;s figures are per escalated task in the report;
        here they are scaled by 656/1,507 so both models share one denominator, which reproduces the report&apos;s own
        totals (19,015,055 input tokens, 432,097 output, USD 3.32 per task). The report does not say which tasks were
        escalated, or how many of the 1,477 passes came after an escalation.
      </figcaption>
    </figure>
  )
}

function Bar({ label, pct, color, value }: { label: string; pct: number; color: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-2 sm:grid-cols-[11rem_1fr_auto]">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-3.5 overflow-hidden rounded bg-muted/40">
        <div className="h-full rounded" style={{ width: `${pct.toFixed(2)}%`, background: color }} />
      </div>
      <span>{value}</span>
    </div>
  )
}
