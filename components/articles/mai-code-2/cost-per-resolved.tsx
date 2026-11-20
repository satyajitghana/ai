"use client"

import { useState } from "react"

// Every pass rate and cost per task below is Microsoft's, read from the chart
// data embedded in microsoft.ai/models/mai-code-2/ on 2026-11-20 (the page's
// two price-performance charts carry a JSON object with `pass` and `cost` per
// benchmark). Microsoft states the MAI models' costs at the launch promotion,
// half of list. The "list price" view doubles only the MAI costs, which is
// exact here: GitHub's pricing table doubles every MAI price (input, cached
// input, output) on 2027-05-17 and changes nothing else. Cost per resolved
// task is cost per task divided by pass rate, my arithmetic.

type Family = {
  id: string
  label: string
  models: [string, string, string]
  // price of the MAI model divided by the comparator's, per token type, at promo
  priceRatio: [number, number]
  bench: { name: string; pass: [number, number, number]; cost: [number, number, number] }[]
}

const FAMILIES: Family[] = [
  {
    id: "code2",
    label: "MAI Code 2",
    models: ["MAI Code 2", "GPT-6.1 Sol", "Claude Opus 5.5"],
    priceRatio: [0.25, 0.125],
    bench: [
      { name: "DeepSWE 1.1", pass: [73.2, 74.6, 69.0], cost: [0.618, 1.212, 10.717] },
      { name: "Terminal-Bench 2.1", pass: [84.6, 85.0, 78.7], cost: [0.081, 0.265, 1.842] },
      { name: "SWE Atlas", pass: [43.1, 47.4, 57.5], cost: [0.228, 0.605, 4.234] },
      { name: "FrontierCode v1.1", pass: [52.0, 49.4, 56.0], cost: [0.31, 0.96, 8.43] },
    ],
  },
  {
    id: "flash",
    label: "MAI Code 2 Flash",
    models: ["Code 2 Flash", "GPT-6 Luna", "Claude Haiku 5.5"],
    priceRatio: [0.5, 0.5],
    bench: [
      { name: "DeepSWE 1.1", pass: [59.9, 59.6, 46.0], cost: [0.098, 0.159, 0.668] },
      { name: "Terminal-Bench 2.1", pass: [78.3, 69.3, 73.4], cost: [0.023, 0.028, 0.067] },
      { name: "SWE Atlas", pass: [44.8, 36.4, 42.1], cost: [0.034, 0.051, 0.223] },
    ],
  },
]

const COLORS = ["oklch(0.62 0.16 160)", "oklch(0.6 0.03 260)", "oklch(0.62 0.14 40)"]

type Metric = "task" | "resolved"

function usd(v: number) {
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.1) return `$${v.toFixed(3)}`
  return `$${v.toFixed(3)}`
}

function pct(v: number) {
  return `${v.toFixed(v >= 10 ? 0 : 1)}%`
}

export function CostPerResolved() {
  const [famId, setFamId] = useState("code2")
  const [list, setList] = useState(false)
  const [metric, setMetric] = useState<Metric>("resolved")
  const fam = FAMILIES.find((f) => f.id === famId) ?? FAMILIES[0]

  const mult = (i: number) => (i === 0 && list ? 2 : 1)
  const value = (b: Family["bench"][number], i: number) => {
    const c = b.cost[i] * mult(i)
    return metric === "task" ? c : c / (b.pass[i] / 100)
  }

  const n = fam.bench.length
  const avg = [0, 1, 2].map((i) => fam.bench.reduce((s, b) => s + value(b, i), 0) / n)
  const avgPass = [0, 1, 2].map((i) => fam.bench.reduce((s, b) => s + b.pass[i], 0) / n)

  const rows = [
    ...fam.bench.map((b) => ({ name: b.name, v: [0, 1, 2].map((i) => value(b, i)), p: b.pass })),
    { name: `Mean of the ${n}`, v: avg, p: avgPass },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>{metric === "task" ? "cost per task" : "cost per resolved task"} · Microsoft&apos;s runs, max effort</span>
        <span className="text-muted-foreground/60">{list ? "MAI at list price (from 17 May 2027)" : "MAI at launch promo (half of list)"}</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFamId(f.id)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${famId === f.id ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground/40">|</span>
          {(["resolved", "task"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${metric === m ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "resolved" ? "per resolved task" : "per task"}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground/40">|</span>
          <button
            type="button"
            onClick={() => setList(!list)}
            aria-pressed={list}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${list ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {list ? "list price" : "promo price"}
          </button>
        </div>

        <div className="flex flex-wrap gap-4 font-mono text-[11px]">
          {fam.models.map((m, i) => (
            <span key={m} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />
              {m}
            </span>
          ))}
        </div>

        <div className="space-y-4">
          {rows.map((r, ri) => {
            const max = Math.max(...r.v)
            const last = ri === rows.length - 1
            return (
              <div key={r.name} className={last ? "border-t pt-3" : ""}>
                <div className="mb-1 font-mono text-xs font-semibold">{r.name}</div>
                <div className="space-y-1">
                  {r.v.map((v, i) => (
                    <div key={i} className="grid grid-cols-[1fr_9.5rem] items-center gap-2 sm:grid-cols-[1fr_11rem]">
                      <div className="h-3 rounded-sm bg-muted/40">
                        <div className="h-3 rounded-sm" style={{ width: `${Math.max(0.6, (v / max) * 100).toFixed(2)}%`, background: COLORS[i] }} />
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <span className="text-foreground">{usd(v)}</span>
                        <span className="text-muted-foreground"> · {pct(r.p[i])} pass</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid gap-2 rounded-lg border px-3 py-2 font-mono text-xs sm:grid-cols-2">
          {[1, 2].map((j) => (
            <div key={j}>
              {fam.models[0]} vs {fam.models[j]}:{" "}
              <span className="font-semibold" style={{ color: avg[0] > avg[j] ? COLORS[2] : COLORS[0] }}>
                {((avg[0] / avg[j]) * 100).toFixed(0)}% of the cost
              </span>
              <span className="text-muted-foreground">
                {" "}· {((avgPass[0] / avgPass[j]) * 100).toFixed(0)}% of the mean pass rate
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The MAI models&apos; prices are a fixed fraction of each rival&apos;s on every token type ({fam.priceRatio[0] === 0.25 ? "a quarter of GPT-6.1 Sol's and an eighth of Opus 5.5's" : "half of GPT-6 Luna's and of Haiku 5.5's short-prompt tier"}, at the promo). So a cost
          ratio divided by that fraction is how much more or less billed token volume the MAI model spent on the same tasks.
          Dividing by the pass rate charges each model for its failed attempts too. The list-price toggle doubles only the
          MAI column, as GitHub&apos;s price table does on 17 May 2027.
        </p>
      </div>
    </figure>
  )
}
