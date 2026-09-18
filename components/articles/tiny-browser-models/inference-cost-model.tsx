"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"

// The economics, with real numbers on both sides. An API call to a hosted
// model costs something on every single request — Claude Haiku 4.5 is
// Anthropic's cheapest current model at $1/$5 per million input/output
// tokens (published rate). A CDN-delivered browser model costs a fraction of
// a cent to SHIP, once, per visitor — then every inference after that runs on
// the visitor's own GPU for $0, no server, no per-request bill at all. The
// two costs don't even have the same shape: one is O(calls), the other is
// O(visitors) and roughly flat regardless of how many times that visitor's
// browser calls the model. Log Y axis because the gap is 4-6 orders of
// magnitude by design, not a rounding choice.

const HAIKU_INPUT_PER_MTOK = 1.0
const HAIKU_OUTPUT_PER_MTOK = 5.0
const ASSUMED_INPUT_TOKENS = 50
const ASSUMED_OUTPUT_TOKENS = 30
const API_COST_PER_CALL =
  (ASSUMED_INPUT_TOKENS / 1_000_000) * HAIKU_INPUT_PER_MTOK +
  (ASSUMED_OUTPUT_TOKENS / 1_000_000) * HAIKU_OUTPUT_PER_MTOK // = $0.0002/call

const CDN_DOLLARS_PER_GB = 0.1 // assumed, mid-range published CDN egress rate

const MODELS = [
  { name: "gpu-lexer", bytes: 28_305 },
  { name: "gpu-time", bytes: 45_561 },
  { name: "gpu-query", bytes: 40_960 },
  { name: "neural-flexbox", bytes: 33_801 },
  { name: "gpu-cron", bytes: 35_494 },
  { name: "tinySarf", bytes: 239_894 },
] as const

const MAXN = 5000
const W = 640
const H = 280
const PL = 46
const PB = 30
const PT = 16
const PR = 12
const YLO = 1e-7
const YHI = 3

function fmtUSD(v: number) {
  if (v === 0) return "$0"
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toExponential(2)}`
}

export function InferenceCostModel() {
  const [n, setN] = useState(200)
  const [modelIdx, setModelIdx] = useState(0)
  const model = MODELS[modelIdx]

  const browserOneTime = (model.bytes / 1_000_000_000) * CDN_DOLLARS_PER_GB
  const apiAt = (k: number) => k * API_COST_PER_CALL
  const browserAt = (_k: number) => browserOneTime // flat: paid once per visitor, not per call

  const x = (k: number) => PL + (k / MAXN) * (W - PL - PR)
  const y = (c: number) => {
    const clamped = Math.max(c, YLO)
    return (
      PT +
      (1 - (mlog10(clamped) - mlog10(YLO)) / (mlog10(YHI) - mlog10(YLO))) *
        (H - PT - PB)
    )
  }

  const api = apiAt(n)
  const browser = browserAt(n)
  const ratio = browser > 0 ? api / browser : 0

  const apiPath = Array.from({ length: 41 }, (_, i) => (i / 40) * MAXN)
    .map((k, i) => `${i === 0 ? "M" : "L"} ${x(k).toFixed(1)} ${y(Math.max(apiAt(k), YLO)).toFixed(1)}`)
    .join(" ")

  const gridExp = [-6, -4, -2, 0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cost of N task calls: API vs. a browser-tab model</span>
        <span className="text-muted-foreground/60">log Y · real published rates</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {MODELS.map((m, i) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setModelIdx(i)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                modelIdx === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">calls this session</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{n}</div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">Haiku 4.5 API, {n}×</div>
              <div className="font-mono text-lg font-semibold tabular-nums text-muted-foreground">
                {fmtUSD(api)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: "oklch(0.7 0.16 165)" }}>
                {model.name}, once per visitor
              </div>
              <div
                className="font-mono text-lg font-semibold tabular-nums"
                style={{ color: "oklch(0.7 0.16 165)" }}
              >
                {fmtUSD(browser)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">browser model is</div>
              <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {ratio >= 2 ? `${Math.round(ratio).toLocaleString()}×` : ratio.toFixed(1) + "×"}
                <span className="text-xs text-muted-foreground"> cheaper</span>
              </div>
            </div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At ${n} calls in one session, the Haiku 4.5 API costs ${fmtUSD(api)} while ${model.name} delivered once from a CDN costs ${fmtUSD(browser)} total, ${Math.round(ratio).toLocaleString()} times less, and every further call is free.`}
        >
          {gridExp.map((e) => (
            <g key={e}>
              <line
                x1={PL}
                x2={W - PR}
                y1={y(10 ** e)}
                y2={y(10 ** e)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text x={PL - 5} y={y(10 ** e) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
                {fmtUSD(10 ** e)}
              </text>
            </g>
          ))}

          <path d={apiPath} fill="none" stroke="oklch(0.6 0.03 260)" strokeWidth={2.25} strokeLinecap="round" />
          <line
            x1={PL}
            x2={W - PR}
            y1={y(browser)}
            y2={y(browser)}
            stroke="oklch(0.7 0.16 165)"
            strokeWidth={2.25}
            strokeLinecap="round"
          />

          <circle cx={x(n)} cy={y(Math.max(api, YLO))} r={4} fill="oklch(0.6 0.03 260)" stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={x(n)} cy={y(browser)} r={4} fill="oklch(0.7 0.16 165)" stroke="var(--background)" strokeWidth={1.5} />
          <line x1={x(n)} x2={x(n)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/15" strokeWidth={1} />

          <text x={W - PR} y={y(api) - 6} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
            API cost, linear in calls
          </text>
          <text x={PL} y={y(browser) - 6} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={8.5}>
            {model.name}: one download, then $0/call forever
          </text>

          <text x={(PL + W - PR) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            calls in this session →
          </text>
        </svg>

        <label className="mt-1 block">
          <span className="sr-only">calls this session</span>
          <Range
            min={1}
            max={MAXN}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent="oklch(0.7 0.16 165)"
          />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Assumptions, stated plainly: the API side is{" "}
          <a href="https://claude.com" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
            Claude Haiku 4.5
          </a>
          &rsquo;s published $1 / $5 per million input/output tokens, costing a
          typical 50-in/30-out parse-this-phrase call{" "}
          <span className="text-foreground">$0.0002</span> every single time.
          The browser side is {model.name}&rsquo;s real, measured bundle size —{" "}
          <span className="text-foreground">
            {(model.bytes / 1024).toFixed(1)} KiB
          </span>{" "}
          — at an assumed $0.10/GB CDN egress rate, paid once when a visitor&rsquo;s
          browser downloads it and never again for that visitor. It is not a
          crossover chart: the browser model is already cheaper at call one,
          and every call after that widens the gap, because one side scales
          with calls and the other does not scale with calls at all.
        </p>
      </div>
    </figure>
  )
}
