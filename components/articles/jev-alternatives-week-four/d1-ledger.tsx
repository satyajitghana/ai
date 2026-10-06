"use client"

import { useState, type ReactNode } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Liquid's d1-vs-frontier comparison, one application at a time. Every number is
// read from the playground's own data file (d1.liquid.ai/demos/data/compare.json,
// measured 2026-10-05 by Liquid, read by me 2026-10-06). Nothing here was re-run:
// the file is Liquid's run, so the values are reported; the averages and the
// cost ratios are my arithmetic on that file (reasoned), and the averages land on
// the published chart's 94% / 91% / 98%, $0.54 / $26 / $85 and 3.7 s / 14.1 s /
// 15.8 s exactly — but only once Smart Folders' cost is taken per passage while
// its time stays per 105-passage run. The point of the widget is that "a run"
// is a different thing in every row.

type Model = "d1" | "gpt" | "opus"

const MODELS: { key: Model; name: string; tone: string }[] = [
  { key: "d1", name: "d1", tone: "bg-violet-500" },
  { key: "gpt", name: "GPT-6.1 Sol", tone: "bg-zinc-600 dark:bg-zinc-400" },
  { key: "opus", name: "Claude Opus 5.5", tone: "bg-zinc-400 dark:bg-zinc-600" },
]

type Row = {
  key: string
  name: string
  run: string // what one "run" is, for cost
  timeRun: string // what one "run" is, for time
  metric: string
  n: string
  quality: Record<Model, number>
  qualityText: Record<Model, string>
  cost: Record<Model, number> // dollars per run
  seconds: Record<Model, number> // seconds per run
}

const ROWS: Row[] = [
  {
    key: "compact",
    name: "Context Compaction",
    run: "one coding-agent session",
    timeRun: "one session",
    metric: "needed tool outputs kept whole",
    n: "7 needed outputs in 4 sessions",
    quality: { d1: 1, gpt: 6 / 7, opus: 1 },
    qualityText: { d1: "7 of 7", gpt: "6 of 7", opus: "7 of 7" },
    cost: { d1: 0.00031482, gpt: 0.0058925, opus: 0.019316 },
    seconds: { d1: 0.48, gpt: 6.0, opus: 7.57 },
  },
  {
    key: "labels",
    name: "Smart Folders",
    run: "one passage filed",
    timeRun: "105 passages",
    metric: "passages filed in the reference subfolder",
    n: "105 passages",
    quality: { d1: 0.962, gpt: 0.981, opus: 1 },
    qualityText: { d1: "96%", gpt: "98%", opus: "100%" },
    cost: { d1: 0.002672 / 105, gpt: 0.150952 / 105, opus: 0.47628 / 105 },
    seconds: { d1: 7.91, gpt: 19.33, opus: 15.78 },
  },
  {
    key: "table",
    name: "Smart Filter",
    run: "one SQL query over 150 tickets",
    timeRun: "one query",
    metric: "F1 against hand labels",
    n: "150 tickets",
    quality: { d1: 0.9466, gpt: 0.9515, opus: 0.9762 },
    qualityText: { d1: "94.7", gpt: "95.2", opus: "97.6" },
    cost: { d1: 0.0008482, gpt: 0.0451613, opus: 0.141842 },
    seconds: { d1: 6.0, gpt: 6.57, opus: 7.77 },
  },
  {
    key: "inspect",
    name: "Visual Inspection",
    run: "one photo, pass or reject",
    timeRun: "one photo",
    metric: "balanced accuracy",
    n: "96 photos, four VisA lines",
    quality: { d1: 0.9062, gpt: 0.8229, opus: 0.9167 },
    qualityText: { d1: "91%", gpt: "82%", opus: "92%" },
    cost: { d1: 0.0000481, gpt: 0.0025633, opus: 0.0061693 },
    seconds: { d1: 0.75, gpt: 3.34, opus: 4.02 },
  },
  {
    key: "code",
    name: "Code Search",
    run: "one question answered",
    timeRun: "one question",
    metric: "questions answered in the right place",
    n: "15 questions",
    quality: { d1: 0.8, gpt: 13 / 15, opus: 1 },
    qualityText: { d1: "12 of 15", gpt: "13 of 15", opus: "15 of 15" },
    cost: { d1: 0.0012519, gpt: 0.0682531, opus: 0.2505005 },
    seconds: { d1: 2.21, gpt: 17.83, opus: 24.33 },
  },
  {
    key: "web",
    name: "Web Agent",
    run: "one flight-search goal",
    timeRun: "one goal",
    metric: "goals completed, checked on the site",
    n: "7 goals",
    quality: { d1: 1, gpt: 1, opus: 1 },
    qualityText: { d1: "7 of 7", gpt: "7 of 7", opus: "7 of 7" },
    cost: { d1: 0.00075637, gpt: 0.0298871, opus: 0.0855806 },
    seconds: { d1: 5.06, gpt: 31.82, opus: 35.05 },
  },
]

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

const AVG: Row = {
  key: "avg",
  name: "Liquid's average",
  run: "a mean over six different kinds of run",
  timeRun: "six different kinds of run",
  metric: "mean of six different metrics",
  n: "six applications",
  quality: {
    d1: mean(ROWS.map((r) => r.quality.d1)),
    gpt: mean(ROWS.map((r) => r.quality.gpt)),
    opus: mean(ROWS.map((r) => r.quality.opus)),
  },
  qualityText: { d1: "94%", gpt: "91%", opus: "98%" },
  cost: {
    d1: mean(ROWS.map((r) => r.cost.d1)),
    gpt: mean(ROWS.map((r) => r.cost.gpt)),
    opus: mean(ROWS.map((r) => r.cost.opus)),
  },
  seconds: {
    d1: mean(ROWS.map((r) => r.seconds.d1)),
    gpt: mean(ROWS.map((r) => r.seconds.gpt)),
    opus: mean(ROWS.map((r) => r.seconds.opus)),
  },
}

const ALL = [AVG, ...ROWS]

// Cost per 1,000 runs on a log axis from $0.01 to $1,000. mlog10 keeps the
// server and client strings identical.
const LO = 0.01
const HI = 1000
function logPct(v: number): number {
  const x = (mlog10(v) - mlog10(LO)) / (mlog10(HI) - mlog10(LO))
  return Math.max(0, Math.min(1, x)) * 100
}

function dollars(v: number): string {
  if (v >= 100) return `$${Math.round(v).toLocaleString("en-US")}`
  if (v >= 10) return `$${v.toFixed(1)}`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(3)}`
}

function Panel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <p className="mb-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="grid gap-1.5">{children}</div>
    </div>
  )
}

function Bar({
  label,
  pct,
  value,
  tone,
  hl,
}: {
  label: string
  pct: number
  value: string
  tone: string
  hl: boolean
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-xs">
      <span className={cn("truncate font-mono text-[10px]", hl ? "font-semibold" : "text-muted-foreground")}>
        {label}
      </span>
      <div className="relative h-4 rounded-sm bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-sm", tone)}
          style={{ width: `${Math.max(pct, 0.8).toFixed(2)}%` }}
        />
        <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[10px] font-semibold">
          {value}
        </span>
      </div>
    </div>
  )
}

export function D1Ledger() {
  const [key, setKey] = useState("avg")
  const row = ALL.find((r) => r.key === key) ?? AVG

  const ratioGpt = row.cost.gpt / row.cost.d1
  const ratioOpus = row.cost.opus / row.cost.d1
  const qMin = 0.75

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        d1 vs two frontier chat models · Liquid&apos;s own run, one application at a time
      </div>

      <div
        className="flex flex-wrap gap-2 border-b px-3 py-2"
        role="group"
        aria-label="Pick an application"
      >
        {ALL.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setKey(r.key)}
            aria-pressed={key === r.key}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              key === r.key ? "bg-foreground text-background" : "hover:bg-muted"
            )}
          >
            {r.name}
          </button>
        ))}
      </div>

      <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 border-b px-3 py-2 text-xs leading-5">
        <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">one run</dt>
        <dd className="m-0">
          cost: {row.run}; time: {row.timeRun}
        </dd>
        <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">quality</dt>
        <dd className="m-0">{row.metric}</dd>
        <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">sample</dt>
        <dd className="m-0">{row.n}</dd>
      </dl>

      <div className="grid gap-3 p-3 md:grid-cols-3">
        <Panel title={`quality (axis from ${Math.round(qMin * 100)}%)`}>
          {MODELS.map((m) => (
            <Bar
              key={m.key}
              label={m.name}
              hl={m.key === "d1"}
              tone={m.tone}
              pct={((row.quality[m.key] - qMin) / (1 - qMin)) * 100}
              value={row.qualityText[m.key]}
            />
          ))}
        </Panel>
        <Panel title="cost per 1,000 runs (log axis)">
          {MODELS.map((m) => (
            <Bar
              key={m.key}
              label={m.name}
              hl={m.key === "d1"}
              tone={m.tone}
              pct={logPct(row.cost[m.key] * 1000)}
              value={dollars(row.cost[m.key] * 1000)}
            />
          ))}
        </Panel>
        <Panel title="seconds per run">
          {MODELS.map((m) => (
            <Bar
              key={m.key}
              label={m.name}
              hl={m.key === "d1"}
              tone={m.tone}
              pct={(row.seconds[m.key] / 36) * 100}
              value={`${row.seconds[m.key].toFixed(1)} s`}
            />
          ))}
        </Panel>
      </div>

      <p className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        d1 is {ratioGpt.toFixed(1)}x cheaper than GPT-6.1 Sol and {ratioOpus.toFixed(1)}x cheaper
        than Claude Opus 5.5 here
        {key === "avg"
          ? ". Across single applications the range is 18.7x to 200.1x."
          : "."}
      </p>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Values from Liquid&apos;s published comparison file, run once per model on 2026-10-05;
        nothing here was re-run. The average row reproduces Liquid&apos;s chart, and its cost
        column is a mean over six differently sized runs, dominated by Code Search and Smart
        Filter.
      </figcaption>
    </figure>
  )
}
