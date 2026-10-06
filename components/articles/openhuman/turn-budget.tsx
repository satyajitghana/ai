"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Where a coding task's tokens and seconds go, for three harnesses driving the same
// model (deepseek-v4.1-flash, high reasoning) on the same six SWE-bench Verified tasks.
//
// Seeds, all from tinyhumansai/openhuman-benchmarks, run swe-x86-1:
//   fixed    system prompt + tool schemas on the first request (o200k_base, the
//            proxy's count; summary.md)
//   calls    model calls per task, mean over the six tasks all three solved (meter.jsonl)
//   avg      prompt tokens per call over those calls (meter.jsonl)
//   perCall  mean seconds per model call, summed request time / calls (meter.jsonl)
//   outside  mean task wall time minus summed model time: harness start-up, tool
//            execution and everything else that is not waiting on the model
//   cache    cached prompt tokens / prompt tokens over those calls
//
// The model: call k sends the fixed prefix plus a history that grows by g tokens per
// call, with g chosen so the mean over the measured call count equals the measured
// average. n calls then cost n*fixed + g*n*(n-1)/2 prompt tokens. That is arithmetic
// on measured inputs, labelled reasoned in the article. Only + - * / and Math.round,
// which are exact, so server and client render the same digits.

type H = {
  id: string
  name: string
  color: string
  sys: number
  tools: number
  calls: number
  avg: number
  perCall: number
  outside: number
  cache: number
}

const HARNESSES: H[] = [
  {
    id: "oh",
    name: "OpenHuman",
    color: "oklch(0.66 0.2 20)",
    sys: 944,
    tools: 3647,
    calls: 11.2,
    avg: 9714,
    perCall: 3.09,
    outside: 1.4,
    cache: 0.902,
  },
  {
    id: "oc",
    name: "OpenClaw",
    color: "oklch(0.66 0.14 250)",
    sys: 5656,
    tools: 1990,
    calls: 15.0,
    avg: 16412,
    perCall: 2.59,
    outside: 12.8,
    cache: 0.94,
  },
  {
    id: "he",
    name: "Hermes Agent",
    color: "oklch(0.7 0.13 150)",
    sys: 4457,
    tools: 8789,
    calls: 18.8,
    avg: 23359,
    perCall: 2.09,
    outside: 21.2,
    cache: 0.947,
  },
]

function run(h: H, n: number) {
  const fixed = h.sys + h.tools
  const g = (2 * (h.avg - fixed)) / (h.calls - 1)
  const fixedTotal = n * fixed
  const history = (g * n * (n - 1)) / 2
  const total = fixedTotal + history
  const fresh = total * (1 - h.cache)
  const model = n * h.perCall
  return { fixed, g, fixedTotal, history, total, fresh, model, time: model + h.outside }
}

const k = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : `${Math.round(v / 100) / 10}k`)
const s = (v: number) => `${Math.round(v * 10) / 10} s`

export function TurnBudget() {
  const [mode, setMode] = useState<"measured" | "same">("measured")
  const [n, setN] = useState(15)

  const rows = HARNESSES.map((h) => {
    const calls = mode === "measured" ? h.calls : n
    return { h, calls, r: run(h, calls) }
  })
  const maxTok = Math.max(...rows.map((x) => x.r.total))
  const maxT = Math.max(...rows.map((x) => x.r.time))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">one coding task · same model, same tasks · six tasks all three solved</span>
        <div className="flex gap-1">
          {(
            [
              { id: "measured", label: "each harness's own call count" },
              { id: "same", label: "same call count for all" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              aria-pressed={mode === o.id}
              className={cn(
                "cursor-pointer rounded px-2 py-1 font-mono text-xs transition-colors",
                mode === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("px-3 pt-3 sm:px-4", mode === "measured" && "opacity-40")}>
        <label className="block">
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>model calls per task</span>
            <span className="tabular-nums text-foreground">{mode === "measured" ? "measured" : n}</span>
          </div>
          <Range
            min={1}
            max={40}
            step={1}
            value={n}
            disabled={mode === "measured"}
            onChange={(e) => setN(Number(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="model calls per task, applied to every harness"
          />
        </label>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        {rows.map(({ h, calls, r }) => (
          <div key={h.id}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
              <span style={{ color: h.color }} className="font-semibold">
                {h.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {Math.round(calls * 10) / 10} calls · fixed prefix {r.fixed.toLocaleString("en-US")} tok ({h.sys.toLocaleString("en-US")} prompt + {h.tools.toLocaleString("en-US")} tools) · history +{Math.round(r.g).toLocaleString("en-US")}/call
              </span>
            </div>
            <div className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-2 font-mono text-[11px]">
              <span className="text-muted-foreground">prompt</span>
              <div className="flex h-4 overflow-hidden rounded bg-muted/40">
                <div
                  style={{ width: `${(r.fixedTotal / maxTok) * 100}%`, background: h.color, opacity: 0.95 }}
                  className="transition-all duration-300"
                  title="fixed prefix, re-sent every call"
                />
                <div
                  style={{ width: `${(r.history / maxTok) * 100}%`, background: h.color, opacity: 0.4 }}
                  className="transition-all duration-300"
                  title="conversation history"
                />
              </div>
              <span className="text-right tabular-nums">{k(r.total)} tok</span>

              <span className="text-muted-foreground">uncached</span>
              <div className="flex h-2 overflow-hidden rounded bg-muted/40">
                <div style={{ width: `${(r.fresh / maxTok) * 100}%`, background: h.color }} className="transition-all duration-300" />
              </div>
              <span className="text-right tabular-nums text-muted-foreground">
                {k(r.fresh)} · {Math.round(h.cache * 1000) / 10}% hit
              </span>

              <span className="text-muted-foreground">time</span>
              <div className="flex h-4 overflow-hidden rounded bg-muted/40">
                <div
                  style={{ width: `${(r.model / maxT) * 100}%`, background: h.color, opacity: 0.85 }}
                  className="transition-all duration-300"
                  title="waiting on the model"
                />
                <div
                  style={{ width: `${(h.outside / maxT) * 100}%` }}
                  className="bg-foreground/35 transition-all duration-300"
                  title="outside the model: start-up, tools"
                />
              </div>
              <span className="text-right tabular-nums">{s(r.time)}</span>
            </div>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Prompt bars: solid is the fixed prefix re-sent on every call, faded is conversation history. Time bars:
        coloured is waiting on the model, grey is everything outside it. Inputs are measured from the
        vendor&apos;s committed logs (run <code>swe-x86-1</code>); the totals at other call counts are arithmetic on
        them. Switch to <em>same call count</em>: OpenHuman&apos;s calls are the slowest of the three, so its lead
        on time shrinks to a few seconds at 15 calls and reverses past about 20.
      </figcaption>
    </figure>
  )
}
