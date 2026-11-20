"use client"

import { useState } from "react"

// Where each number in the MAI Code 2 launch comes from, and what a reader can
// check it against. Microsoft's values: the chart data on
// microsoft.ai/models/mai-code-2/ and the model card PDF (17 Nov 2026).
// Outside values, all read on 2026-11-20: Artificial Analysis's FrontierCode 1.1
// and Terminal-Bench 4.0 records (artificialanalysis.ai/evaluations/frontiercode),
// Vals.ai's Terminal-Bench 2.1 table (as of 1 Oct 2026), and the official
// DeepSWE and Terminal-Bench 2.1 boards.

type Source = "microsoft" | "third-party" | "mixed"
type Check = "matches" | "differs" | "none"

type Row = {
  claim: string
  value: string
  ranBy: string
  harness: string
  source: Source
  check: Check
  outside: string
}

const ROWS: Row[] = [
  {
    claim: "MAI Code 2, DeepSWE 1.1",
    value: "73.2%",
    ranBy: "Microsoft (MSBench)",
    harness: "Copilot CLI 1.0.102, no subagents",
    source: "microsoft",
    check: "none",
    outside: "Datacurve's own board (mini-swe-agent, updated 22 September) lists none of the six models in Microsoft's charts.",
  },
  {
    claim: "Claude Opus 5.5, Terminal-Bench 2.1",
    value: "78.7%, $1.842/task",
    ranBy: "Microsoft (MSBench)",
    harness: "Copilot CLI",
    source: "microsoft",
    check: "differs",
    outside: "Vals.ai, Terminus 2 harness: 87.64% at $0.50 a task. Same model, same tasks, a different harness (and an effort setting Vals does not state): 8.9 points and 3.7x the cost apart.",
  },
  {
    claim: "GPT-6 Luna, Terminal-Bench 2.1",
    value: "69.3%",
    ranBy: "Microsoft (MSBench)",
    harness: "Copilot CLI",
    source: "microsoft",
    check: "differs",
    outside: "Vals.ai, Terminus 2: 73.03%.",
  },
  {
    claim: "MAI Code 2, SWE Atlas",
    value: "43.1%",
    ranBy: "Microsoft (MSBench)",
    harness: "Copilot CLI",
    source: "microsoft",
    check: "none",
    outside: "The same model card prints 80.9% for MAI Code 2 on SWE Atlas in its autonomy table, with no note on what differs.",
  },
  {
    claim: "MAI Code 2, FrontierCode v1.1",
    value: "52.0%, $0.31/task",
    ranBy: "Artificial Analysis, per Microsoft",
    harness: "AA's own",
    source: "third-party",
    check: "none",
    outside: "AA's public FrontierCode 1.1 page has no MAI model on it.",
  },
  {
    claim: "GPT-6.1 Sol, FrontierCode v1.1",
    value: "49.4%",
    ranBy: "Artificial Analysis, per Microsoft",
    harness: "AA's own",
    source: "third-party",
    check: "matches",
    outside: "AA's record for GPT-6.1 Sol (Max): 49.1%. Within a rerun of the same thing.",
  },
  {
    claim: "Claude Opus 5.5, FrontierCode v1.1",
    value: "56.0%",
    ranBy: "Artificial Analysis, per Microsoft",
    harness: "AA's own",
    source: "third-party",
    check: "differs",
    outside: "AA's record for Opus 5.5 (Max): 52.2%. AA's summary puts Opus 5.5 (Medium) at 57.1%. Neither is 56.0.",
  },
  {
    claim: "MAI Code 2, Terminal-Bench 4",
    value: "26.3%",
    ranBy: "Microsoft (model card)",
    harness: "not stated",
    source: "microsoft",
    check: "none",
    outside: "Not in the headline average. AA's Terminal-Bench 4.0 (its own harness): GPT-6.1 Sol 56.1%, Opus 5.5 59.6%, Haiku 5.5 32.8%.",
  },
  {
    claim: "Code 2 Flash, Terminal-Bench 4",
    value: "2.5%",
    ranBy: "Microsoft (model card)",
    harness: "not stated",
    source: "microsoft",
    check: "none",
    outside: "AA's Terminal-Bench 4.0: GPT-6 Luna 12.6%.",
  },
  {
    claim: "Preferred over GPT-6 Sol on frontend",
    value: "64%",
    ranBy: "Microsoft",
    harness: "258 annotators, blind side by side",
    source: "microsoft",
    check: "none",
    outside: "The blog says GPT-6 Sol; the model page says GPT-6.1 Sol. No task list or per-category split.",
  },
  {
    claim: "MAI Code 2 promo price",
    value: "$0.50 / $2.50 per 1M",
    ranBy: "GitHub",
    harness: "Copilot usage-based billing",
    source: "third-party",
    check: "matches",
    outside: "GitHub's models-and-pricing page: to 17 May 2027, then $1.00 / $5.00. Cached input $0.025, then $0.05.",
  },
]

const FILTERS: { id: string; label: string; test: (r: Row) => boolean }[] = [
  { id: "all", label: "all", test: () => true },
  { id: "ms", label: "Microsoft ran it", test: (r) => r.source === "microsoft" },
  { id: "out", label: "someone else ran it", test: (r) => r.source !== "microsoft" },
  { id: "differs", label: "an outside number differs", test: (r) => r.check === "differs" },
  { id: "none", label: "nothing to check against", test: (r) => r.check === "none" },
]

const BADGE: Record<Check, { text: string; cls: string }> = {
  matches: { text: "matches", cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  differs: { text: "differs", cls: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  none: { text: "no outside number", cls: "border-foreground/20 text-muted-foreground" },
}

export function Provenance() {
  const [filter, setFilter] = useState("all")
  const [open, setOpen] = useState<number | null>(1)
  const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0]
  const shown = ROWS.map((r, i) => ({ r, i })).filter(({ r }) => f.test(r))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>where each launch number comes from</span>
        <span className="text-muted-foreground/60">read 2026-11-20</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setFilter(x.id)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${filter === x.id ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {x.label} ({ROWS.filter(x.test).length})
            </button>
          ))}
        </div>

        <ul className="divide-y rounded-lg border">
          {shown.map(({ r, i }) => (
            <li key={r.claim}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
              >
                <span className="text-sm">
                  <span className="font-medium">{r.claim}</span>
                  <span className="font-mono text-xs text-muted-foreground"> · {r.value}</span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${BADGE[r.check].cls}`}>{BADGE[r.check].text}</span>
              </button>
              {open === i && (
                <div className="space-y-1 px-3 pb-3 text-sm">
                  <div className="font-mono text-[11px] text-muted-foreground">
                    ran by {r.ranBy} · harness: {r.harness}
                  </div>
                  <p className="leading-6">{r.outside}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-6 text-muted-foreground">
          Seven of these eleven numbers were produced by Microsoft, on its own evaluation platform, in the harness its
          models were trained in. The four from elsewhere are three FrontierCode scores and the price, and only the price
          and one of those scores can be found where Microsoft says they came from.
        </p>
      </div>
    </figure>
  )
}
