"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What "+37% on average" averages. Every input is a mean over five runs copied
// from the paper's Table 1 (online-from-scratch protocol, 100 tasks per
// benchmark, 50 on SWE-bench Lite) or Table 2 (held-out protocol, 50 + 50
// tasks). The arithmetic is ours: relative gain = Sentry / reference - 1 per
// benchmark, then an unweighted mean over benchmarks. Only + - * / are used,
// so no dmath wrappers are needed.

type Bench = { name: string; unit: string; sentry: number; refs: Record<string, number> }

const T1: Bench[] = [
  {
    name: "WebShop",
    unit: "avg. reward",
    sentry: 0.468,
    refs: { base: 0.17, AgentGuard: 0.258, AgentForesight: 0.168, AgentFixer: 0.171, Wink: 0.264 },
  },
  {
    name: "AppWorld",
    unit: "test pass %",
    sentry: 38.53,
    refs: { base: 25.59, AgentGuard: 25.09, AgentForesight: 24.17, AgentFixer: 26.69, Wink: 27.56 },
  },
  {
    name: "SWE-bench Lite",
    unit: "accuracy",
    sentry: 0.3,
    refs: { base: 0.2, AgentGuard: 0.22, AgentForesight: 0.24, AgentFixer: 0.22, Wink: 0.18 },
  },
  {
    name: "Mind2Web Replay",
    unit: "completion",
    sentry: 0.736,
    refs: { base: 0.42, AgentGuard: 0.45, AgentForesight: 0.43, AgentFixer: 0.687, Wink: 0.37 },
  },
]

const T2: Bench[] = [
  { name: "WebShop", unit: "avg. reward", sentry: 0.495, refs: { ACE: 0.335 } },
  { name: "Mind2Web Replay", unit: "completion", sentry: 0.729, refs: { ACE: 0.562 } },
]

const RUNTIME = ["AgentGuard", "AgentForesight", "AgentFixer", "Wink"]

type RefKey = "best" | "AgentGuard" | "AgentForesight" | "AgentFixer" | "Wink" | "base" | "ACE"

const OPTIONS: { key: RefKey; label: string; note: string }[] = [
  { key: "best", label: "best per column (paper)", note: "Table 1 · the paper's choice: whichever baseline is strongest on that benchmark" },
  { key: "AgentGuard", label: "AgentGuard", note: "Table 1 · one fixed baseline everywhere" },
  { key: "Wink", label: "Wink", note: "Table 1 · one fixed baseline everywhere" },
  { key: "AgentFixer", label: "AgentFixer", note: "Table 1 · one fixed baseline everywhere" },
  { key: "base", label: "base agent", note: "Table 1 · no intervention at all" },
  { key: "ACE", label: "ACE (Table 2)", note: "Table 2 · held-out protocol, two benchmarks only, different base-agent numbers" },
]

function refFor(b: Bench, key: RefKey): { name: string; value: number } {
  if (key === "best") {
    let name = RUNTIME[0]
    for (const r of RUNTIME) if (b.refs[r] > b.refs[name]) name = r
    return { name, value: b.refs[name] }
  }
  return { name: key === "base" ? "base agent" : key, value: b.refs[key] }
}

const fmt = (x: number) => (Math.round(x * 1000) / 10).toFixed(1)
const fmtVal = (x: number) => (x >= 1 ? x.toFixed(2) : x.toFixed(3))

export function GainArithmetic() {
  const [key, setKey] = useState<RefKey>("best")
  const rows = (key === "ACE" ? T2 : T1).map((b) => {
    const ref = refFor(b, key)
    return { b, ref, rel: b.sentry / ref.value - 1, abs: b.sentry - ref.value }
  })
  const mean = rows.reduce((s, r) => s + r.rel, 0) / rows.length
  const maxRel = Math.max(...rows.map((r) => r.rel), 0.01)
  const opt = OPTIONS.find((o) => o.key === key)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2.5 sm:px-4">
        <span className="mr-1 font-mono text-[11px] text-muted-foreground">Sentry vs</span>
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setKey(o.key)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors",
              o.key === key
                ? "border-foreground/30 bg-muted/60 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <div className="font-mono text-[11px] text-muted-foreground">{opt.note}</div>
        {rows.map((r) => (
          <div key={r.b.name} className="grid grid-cols-[7.5rem_1fr] items-center gap-2 sm:grid-cols-[9rem_1fr_10rem]">
            <div className="text-xs">
              <div className="font-semibold">{r.b.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{r.b.unit}</div>
            </div>
            <div className="h-5 rounded bg-muted/40">
              <div
                className="flex h-5 items-center justify-end rounded bg-amber-500/70 pr-1.5 font-mono text-[11px] text-foreground"
                style={{ width: `${Math.max(8, (r.rel / maxRel) * 100).toFixed(1)}%` }}
              >
                +{fmt(r.rel)}%
              </div>
            </div>
            <div className="col-span-2 font-mono text-[11px] text-muted-foreground sm:col-span-1">
              {fmtVal(r.b.sentry)} vs {fmtVal(r.ref.value)} ({r.ref.name}) · Δ {r.abs >= 0 ? "+" : ""}
              {fmtVal(r.abs)}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-2">
          <span className="text-sm">
            unweighted mean of the relative gains:{" "}
            <strong className="font-mono">+{fmt(mean)}%</strong>
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {key === "best" ? "paper: “37% on average”" : key === "ACE" ? "paper: “39%”" : "not a figure the paper quotes"}
          </span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Inputs are the paper&rsquo;s reported means (Tables 1 and 2, Qwen3.5-9B, five runs). The
        ratios and averages are reasoned from them. Table 1 and Table 2 use different protocols and
        task sets, so their percentages do not stack.
      </figcaption>
    </figure>
  )
}
