"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The price story, plotted. Every number here is H Company's own reported
// figure from the Holo4 blog's headline table: a benchmark score (y) against
// the dollar cost per task (x, log scale, at H Models API rates for Holo4 and
// Alibaba Cloud list prices for the Qwen base). Nothing is re-run here. The
// point the scatter makes is the one the prose makes: on the saturated OSWorld,
// Holo4-27B barely clears its own base model but at a third the cost; on the
// harder OSWorld 2.0 it trades ~20 points of score to Opus 5.5 for roughly a
// seventh of the price.
//
// x positions go through mlog10 (lib/dmath) so the server and the client
// serialize the same SVG coordinate string and React does not report a
// hydration mismatch — Math.log is spec-allowed to differ by one ULP between
// engines.

type Kind = "holo" | "base" | "frontier"
type Point = { model: string; score: number; cost: number; kind: Kind; place?: "above" | "below" }
type Bench = { key: string; label: string; blurb: string; points: Point[] }

const COLOR: Record<Kind, string> = {
  holo: "oklch(0.55 0.21 295)", // Holo4 — violet
  base: "oklch(0.6 0.02 260)", // Qwen base — grey
  frontier: "oklch(0.64 0.15 45)", // closed frontier — amber
}

const BENCHES: Bench[] = [
  {
    key: "osworld",
    label: "OSWorld",
    blurb:
      "The saturated one. Holo4-27B at 85.2% is 0.9 points over its Qwen3.8-27B base — but at $0.08 a task against the base's $0.22.",
    points: [
      { model: "Holo4-27B", score: 85.2, cost: 0.08, kind: "holo", place: "above" },
      { model: "Holo4-35B-A3B", score: 80.8, cost: 0.05, kind: "holo", place: "below" },
      { model: "Qwen3.8-27B base", score: 84.3, cost: 0.22, kind: "base", place: "below" },
    ],
  },
  {
    key: "osworld2",
    label: "OSWorld 2.0",
    blurb:
      "The hard one. Holo4-27B is 13.7 points over its base here, but 20.1 points under Opus 5.5 — which costs $8.48 a task against Holo4-27B's $1.22.",
    points: [
      { model: "Holo4-27B", score: 61.7, cost: 1.22, kind: "holo", place: "above" },
      { model: "Holo4-35B-A3B", score: 30.9, cost: 0.61, kind: "holo", place: "below" },
      { model: "Qwen3.8-27B base", score: 48.0, cost: 3.49, kind: "base", place: "below" },
      { model: "Opus 5.5", score: 81.8, cost: 8.48, kind: "frontier", place: "above" },
    ],
  },
  {
    key: "automationbench",
    label: "AutomationBench",
    blurb:
      "Business automation over MCP tools and APIs. Holo4-27B reaches 45.4% at $0.05; Opus 5 leads at 50.3% but at $3.05.",
    points: [
      { model: "Holo4-27B", score: 45.4, cost: 0.05, kind: "holo", place: "above" },
      { model: "Holo4-35B-A3B", score: 34.5, cost: 0.02, kind: "holo", place: "below" },
      { model: "Qwen3.8-27B base", score: 40.3, cost: 0.09, kind: "base", place: "below" },
      { model: "Opus 5", score: 50.3, cost: 3.05, kind: "frontier", place: "above" },
    ],
  },
  {
    key: "androidworld",
    label: "AndroidWorld",
    blurb:
      "Phone apps. Holo4-27B at 85.1% clears its base's 81.9% and runs at $0.08 a task against $0.13.",
    points: [
      { model: "Holo4-27B", score: 85.1, cost: 0.08, kind: "holo", place: "above" },
      { model: "Holo4-35B-A3B", score: 77.6, cost: 0.07, kind: "holo", place: "below" },
      { model: "Qwen3.8-27B base", score: 81.9, cost: 0.13, kind: "base", place: "below" },
    ],
  },
]

// Plot geometry in SVG user units.
const W = 720
const H = 440
const PAD = { l: 44, r: 20, t: 16, b: 46 }
const PLOT_W = W - PAD.l - PAD.r
const PLOT_H = H - PAD.t - PAD.b
const X_MIN = 0.01
const X_MAX = 12
const Y_MIN = 0
const Y_MAX = 90
const X_TICKS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10]
const Y_TICKS = [0, 20, 40, 60, 80]

const lx0 = mlog10(X_MIN)
const lx1 = mlog10(X_MAX)
const xOf = (cost: number) =>
  PAD.l + ((mlog10(cost) - lx0) / (lx1 - lx0)) * PLOT_W
const yOf = (score: number) =>
  PAD.t + (1 - (score - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H

const fmtCost = (c: number) => `$${c.toFixed(2)}`

export function CostAccuracy() {
  const [key, setKey] = useState("osworld2")
  const bench = BENCHES.find((b) => b.key === key) ?? BENCHES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Score vs cost per task · H Company&rsquo;s reported numbers</span>
        <span className="text-muted-foreground/60">left is cheaper · up is better</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {BENCHES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setKey(b.key)}
              aria-pressed={key === b.key}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                key === b.key
                  ? "text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={key === b.key ? { background: COLOR.holo } : undefined}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="mt-3 text-muted-foreground">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label={`Scatter of ${bench.label} score against cost per task on a log scale`}
          >
            {/* y grid + labels */}
            {Y_TICKS.map((t) => (
              <g key={`y${t}`}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={yOf(t)}
                  y2={yOf(t)}
                  stroke="currentColor"
                  strokeOpacity={0.14}
                />
                <text
                  x={PAD.l - 6}
                  y={yOf(t) + 3.5}
                  textAnchor="end"
                  className="fill-current font-mono"
                  fontSize={11}
                  opacity={0.7}
                >
                  {t}%
                </text>
              </g>
            ))}

            {/* x grid + labels */}
            {X_TICKS.map((t) => (
              <g key={`x${t}`}>
                <line
                  x1={xOf(t)}
                  x2={xOf(t)}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="currentColor"
                  strokeOpacity={0.09}
                />
                <text
                  x={xOf(t)}
                  y={H - PAD.b + 16}
                  textAnchor="middle"
                  className="fill-current font-mono"
                  fontSize={11}
                  opacity={0.7}
                >
                  {`$${t}`}
                </text>
              </g>
            ))}
            <text
              x={W - PAD.r}
              y={H - 6}
              textAnchor="end"
              className="fill-current font-mono"
              fontSize={10.5}
              opacity={0.55}
            >
              USD per task · log scale
            </text>

            {/* points */}
            {bench.points.map((p) => {
              const cx = xOf(p.cost)
              const cy = yOf(p.score)
              const above = p.place !== "below"
              return (
                <g key={p.model}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={p.kind === "holo" ? 6.5 : 5}
                    fill={COLOR[p.kind]}
                    stroke="var(--background, #fff)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={cx}
                    y={above ? cy - 11 : cy + 17}
                    textAnchor="middle"
                    className="fill-current font-mono"
                    fontSize={11}
                    fontWeight={p.kind === "holo" ? 600 : 400}
                    opacity={p.kind === "holo" ? 1 : 0.85}
                  >
                    {p.model}
                  </text>
                  <text
                    x={cx}
                    y={above ? cy - 11 + 12 : cy + 17 + 12}
                    textAnchor="middle"
                    className="fill-current font-mono tabular-nums"
                    fontSize={10}
                    opacity={0.6}
                  >
                    {p.score}% · {fmtCost(p.cost)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR.holo }} />
            Holo4
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR.base }} />
            Qwen base
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR.frontier }} />
            closed frontier
          </span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm leading-6 text-foreground">{bench.blurb}</p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Holo4 scores are the mean of two to four runs in H&rsquo;s own harness (a single run on
            OSWorld 2.0); frontier scores are public numbers from other harnesses at other effort
            settings, so the across-model comparison is H&rsquo;s own, not a matched one.
          </p>
        </div>
      </div>
    </figure>
  )
}
