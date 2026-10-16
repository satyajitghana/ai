"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// One SRE investigation, step by step: the Postgres autovacuum incident from
// Section 6 of Datadog's Scout report (Figures 10 and 11). Each step is one
// tool call the agent made: the tool, the question it asked, what came back.
// Two side panels update as evidence arrives: the hypotheses the runbook and
// the evidence put on the table (open, ruled out, confirmed), and the five-hop
// causal chain from the node drain to the alert, which the agent uncovers
// backwards, from the symptom toward the cause. The text of every step is the
// report's own; the report calls these "selected steps", so the real run made
// more calls than the ten shown here.

const ACCENT = "oklch(0.55 0.2 295)"
const GOOD = "oklch(0.6 0.14 155)"
const BAD = "oklch(0.6 0.18 25)"

type HypState = "hidden" | "open" | "out" | "lead" | "confirmed"

type Step = {
  phase: string
  tool: string
  q: string
  a: string
  hyps: Record<string, HypState>
  hops: number[] // causal hops known after this step (1 = root cause … 5 = alert)
  verdict?: string
}

const HYPS = [
  { id: "writes", label: "Write spike" },
  { id: "idle", label: "Long idle transaction" },
  { id: "lag", label: "Lagging replica" },
  { id: "slot", label: "Stale replication slot" },
]

const HOPS = [
  { n: 1, label: "Node drain", sub: "read replica and its local disk removed" },
  { n: 2, label: "Replica rebuilt", sub: "new pod, empty disk, not ready" },
  { n: 3, label: "Replication slot stuck", sub: "pins the cleanup horizon" },
  { n: 4, label: "Dead rows pile up", sub: "0.3M to 4.5M" },
  { n: 5, label: "Alert", sub: "30 of 30 autovacuum workers busy" },
]

const H0: Record<string, HypState> = { writes: "hidden", idle: "hidden", lag: "hidden", slot: "hidden" }

const STEPS: Step[] = [
  {
    phase: "Alert",
    tool: "MONITOR",
    q: "What fired?",
    a: "All 30 autovacuum workers busy for more than an hour, while dead rows accumulate.",
    hyps: H0,
    hops: [5],
  },
  {
    phase: "Test the runbook's causes",
    tool: "DOCS",
    q: "What does the runbook say causes this alert?",
    a: "Either more writes, or vacuum activity that does not match writes.",
    hyps: { ...H0, writes: "open" },
    hops: [5],
  },
  {
    phase: "Test the runbook's causes",
    tool: "METRICS",
    q: "When did workers and dead rows change?",
    a: "Workers rose to 30 of 30 two hours earlier. Dead rows climbed without a break to 4.5M.",
    hyps: { ...H0, writes: "open" },
    hops: [4, 5],
  },
  {
    phase: "Test the runbook's causes",
    tool: "TRACES",
    q: "Do traces show a slow span in the Postgres service?",
    a: "Only an unrelated gRPC error. The run set traces aside and went back to database telemetry.",
    hyps: { ...H0, writes: "open" },
    hops: [4, 5],
  },
  {
    phase: "Test the runbook's causes",
    tool: "KUBERNETES",
    q: "Which database pods restarted or moved?",
    a: "The primary is steady. One read replica is only 2 hours old, on a new node, and not fully ready.",
    hyps: { ...H0, writes: "open" },
    hops: [4, 5],
  },
  {
    phase: "Test the runbook's causes",
    tool: "DASHBOARDS",
    q: "Do writes, CPU or I/O explain the load?",
    a: "Rows read rose 10x while the query count stayed flat: workers scanning tables, not client load.",
    hyps: { ...H0, writes: "out" },
    hops: [4, 5],
    verdict: "Ruled out: a write spike. Cleanup is running but cannot remove dead rows.",
  },
  {
    phase: "Find what holds cleanup back",
    tool: "LOGS",
    q: "What do vacuum completion logs report?",
    a: "Rows are dead but not yet removable, with the same oldest-transaction limit on every table for two hours.",
    hyps: { writes: "out", idle: "open", lag: "open", slot: "hidden" },
    hops: [4, 5],
  },
  {
    phase: "Find what holds cleanup back",
    tool: "METRICS",
    q: "Is an idle transaction or a lagging replica holding it?",
    a: "No idle transactions in 4 hours, and the replicas that report lag are under 4 s behind.",
    hyps: { writes: "out", idle: "out", lag: "out", slot: "lead" },
    hops: [3, 4, 5],
    verdict: "Lead: something outside the primary pins the cleanup horizon.",
  },
  {
    phase: "Follow the broken replica",
    tool: "LOGS",
    q: "Which pods log write-ahead log errors?",
    a: "The new replica: the segment it needs has already been removed. It retries every 9 seconds.",
    hyps: { writes: "out", idle: "out", lag: "out", slot: "lead" },
    hops: [2, 3, 4, 5],
  },
  {
    phase: "Follow the broken replica",
    tool: "CHANGES",
    q: "Why was that replica replaced?",
    a: "A node drain evicted it 10 minutes before the onset. Its local disk went with the node.",
    hyps: { writes: "out", idle: "out", lag: "out", slot: "lead" },
    hops: [1, 2, 3, 4, 5],
  },
  {
    phase: "Follow the broken replica",
    tool: "LOGS",
    q: "Does the primary still serve that replica?",
    a: "Yes, through its replication slot, and it refuses every request for the missing log.",
    hyps: { writes: "out", idle: "out", lag: "out", slot: "confirmed" },
    hops: [1, 2, 3, 4, 5],
    verdict: "Conclusion: the evicted replica's stale slot is what pins the horizon. Drop the slot and rebuild the replica.",
  },
]

const HYP_STYLE: Record<HypState, { text: string; color: string }> = {
  hidden: { text: "not yet raised", color: "var(--muted-foreground)" },
  open: { text: "open", color: ACCENT },
  out: { text: "ruled out", color: BAD },
  lead: { text: "lead", color: ACCENT },
  confirmed: { text: "confirmed", color: GOOD },
}

export function IncidentWalk() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const last = STEPS.length - 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one investigation · Postgres autovacuum alert</span>
        <span className="text-muted-foreground/60">
          step {i} of {last} · selected steps, report Figure 11
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1.4fr_1fr]">
        {/* the tool call */}
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{s.phase}</div>
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                style={{ background: "color-mix(in oklch, " + ACCENT + " 15%, transparent)", color: ACCENT }}
              >
                {s.tool}
              </span>
              <span className="text-sm font-medium">{s.q}</span>
            </div>
            <p className="m-0 text-sm text-muted-foreground">{s.a}</p>
          </div>
          {s.verdict ? (
            <p className="mt-2 mb-0 border-l-2 pl-2 text-sm" style={{ borderColor: i === last ? GOOD : ACCENT }}>
              {s.verdict}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setI(Math.max(0, i - 1))}
              disabled={i === 0}
              className="rounded-md border px-2.5 py-1 font-mono text-xs disabled:opacity-40"
            >
              ← back
            </button>
            <Range
              min={0}
              max={last}
              step={1}
              value={i}
              onChange={(e) => setI(Number(e.target.value))}
              className="w-full cursor-pointer"
              accent={ACCENT}
              aria-label="Investigation step"
            />
            <button
              type="button"
              onClick={() => setI(Math.min(last, i + 1))}
              disabled={i === last}
              className="rounded-md border px-2.5 py-1 font-mono text-xs disabled:opacity-40"
            >
              next →
            </button>
          </div>
        </div>

        {/* hypotheses + causal chain */}
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">hypotheses</div>
            <ul className="m-0 list-none space-y-1 p-0">
              {HYPS.map((h) => {
                const st = s.hyps[h.id]
                const look = HYP_STYLE[st]
                return (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={cn(st === "out" && "line-through opacity-60", st === "hidden" && "opacity-40")}>
                      {h.label}
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: look.color }}>
                      {look.text}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              causal chain, found back to front
            </div>
            <ol className="m-0 list-none space-y-1 p-0">
              {HOPS.map((h) => {
                const known = s.hops.includes(h.n)
                return (
                  <li
                    key={h.n}
                    className={cn("flex gap-2 rounded-md border px-2 py-1 text-xs transition-opacity", !known && "opacity-30")}
                    style={known && h.n === 1 && i === last ? { borderColor: GOOD } : undefined}
                  >
                    <span className="font-mono tabular-nums text-muted-foreground">{h.n}</span>
                    <span>
                      <span className="font-medium">{h.label}</span>
                      <span className="text-muted-foreground">{" · "}{h.sub}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </figure>
  )
}
