"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { mlog } from "@/lib/dmath"

// The whole cluster's argument in one plot: put six browser-tab models next to
// ordinary language models on a shared log axis (parameters, or bytes actually
// shipped to a browser) and the five-to-eight order-of-magnitude gap reads
// instantly. The Y axis is NOT one shared benchmark — it can't be, these solve
// different problems — so it is two honestly-labeled series: each browser
// model's own reported accuracy on its own narrow task, and MMLU for the
// general models. The point is never "gpu-lexer beats Llama 3 8B at anything";
// it is "a model this small can sit at the ceiling of ITS task while a general
// model needs 5-8 more orders of magnitude to sit at the ceiling of a much
// bigger one." Every number below is cited in the article prose.

type Point = {
  name: string
  params: number
  bytes: number // real, measured shipped-weights/bundle size (bf16 estimate for general models)
  metricLabel: string
  metricValue: number | null // null = no published figure (rendered as an open "?" marker)
  group: "browser" | "general"
  note: string
}

const POINTS: Point[] = [
  {
    name: "gpu-lexer",
    params: 41_321,
    bytes: 28_305,
    metricLabel: "Shiki agreement (held-out)",
    metricValue: 83.02,
    group: "browser",
    note: "27.64 KiB, syntax highlighting, no language ID",
  },
  {
    name: "gpu-time",
    params: 38_745,
    bytes: 45_561,
    metricLabel: "exact schedule match (real English)",
    metricValue: 97.6,
    group: "browser",
    note: "44.5 KiB package, text → dates/RFC 5545",
  },
  {
    name: "gpu-query",
    params: 29_597,
    bytes: 40_960,
    metricLabel: "transfer accuracy (schemas unseen in training)",
    metricValue: 98.88,
    group: "browser",
    note: "40 KiB int6, search phrase → structured filter",
  },
  {
    name: "neural-flexbox",
    params: 36_354,
    bytes: 33_801,
    metricLabel: "coordinates within 1px (in-distribution)",
    metricValue: 94.03,
    group: "browser",
    note: "33.0 KiB, approximates one CSS flex row",
  },
  {
    name: "gpu-cron",
    params: 35_783,
    bytes: 35_494,
    metricLabel: "no accuracy figure published",
    metricValue: null,
    group: "browser",
    note: "no model card or repo found — tested live in this piece",
  },
  {
    name: "tinySarf",
    params: 245_063,
    bytes: 239_894,
    metricLabel: "teacher-label agreement (not human gold)",
    metricValue: 87.02,
    group: "browser",
    note: "234 KiB, Arabic morphology, unpromoted release",
  },
  {
    name: "Llama-3.2-1B-Instruct",
    params: 1_236_000_000,
    bytes: 1_236_000_000 * 2,
    metricLabel: "MMLU",
    metricValue: 49.3,
    group: "general",
    note: "Meta, bf16 size estimated at 2 bytes/param",
  },
  {
    name: "Llama-3.2-3B-Instruct",
    params: 3_210_000_000,
    bytes: 3_210_000_000 * 2,
    metricLabel: "MMLU",
    metricValue: 63.4,
    group: "general",
    note: "Meta, bf16 size estimated at 2 bytes/param",
  },
  {
    name: "Phi-3-mini-4k",
    params: 3_800_000_000,
    bytes: 3_800_000_000 * 2,
    metricLabel: "MMLU",
    metricValue: 68.8,
    group: "general",
    note: "Microsoft, bf16 size estimated at 2 bytes/param",
  },
  {
    name: "Llama-3-8B-Instruct",
    params: 8_030_000_000,
    bytes: 8_030_000_000 * 2,
    metricLabel: "MMLU (5-shot)",
    metricValue: 67.4,
    group: "general",
    note: "Meta, bf16 size estimated at 2 bytes/param",
  },
  {
    name: "Llama-3.1-405B-Instruct",
    params: 405_000_000_000,
    bytes: 405_000_000_000 * 2,
    metricLabel: "MMLU (5-shot)",
    metricValue: 87.7,
    group: "general",
    note: "Meta, bf16 size estimated at 2 bytes/param",
  },
]

const BROWSER_COLOR = "oklch(0.7 0.16 165)"
const GENERAL_COLOR = "oklch(0.6 0.03 260)"
const FRONTIER_Y = 90

const W = 680
const H = 400
const padL = 42
const padR = 16
const padT = 34
const padB = 46
const r2 = (n: number) => Math.round(n * 100) / 100

function fmtParams(n: number) {
  if (n >= 1_000_000_000) return `${r2(n / 1_000_000_000)}B`
  if (n >= 1_000_000) return `${r2(n / 1_000_000)}M`
  if (n >= 1_000) return `${Math.round(n / 1000)}K`
  return String(n)
}

function fmtBytes(n: number) {
  const GiB = 1024 ** 3
  const MiB = 1024 ** 2
  const KiB = 1024
  if (n >= GiB) return `${r2(n / GiB)} GiB`
  if (n >= MiB) return `${r2(n / MiB)} MiB`
  if (n >= KiB) return `${r2(n / KiB)} KiB`
  return `${n} B`
}

export function SizeCapabilityScatter() {
  const [axis, setAxis] = useState<"params" | "bytes">("params")
  const [hover, setHover] = useState<number | null>(null)

  const xs = POINTS.map((p) => (axis === "params" ? p.params : p.bytes))
  const xlo = Math.min(...xs) * 0.55
  const xhi = Math.max(...xs) * 2.2
  const ylo = 0
  const yhi = 100

  const sx = (v: number) =>
    r2(padL + ((mlog(v) - mlog(xlo)) / (mlog(xhi) - mlog(xlo))) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - (v - ylo) / (yhi - ylo)) * (H - padT - padB))

  const ticks = useMemo(() => {
    const t =
      axis === "params"
        ? [1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12]
        : [1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12]
    return t.filter((v) => v >= xlo * 0.95 && v <= xhi * 1.05)
  }, [xlo, xhi, axis])

  const fmtTick = (v: number) =>
    axis === "params" ? fmtParams(v) : fmtBytes(v).replace(" ", "")

  const hp = hover != null ? POINTS[hover] : null
  const NO_VALUE_Y = 7

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          size vs. capability, log axis
        </span>
        <div className="flex gap-1">
          {(["params", "bytes"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAxis(a)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                axis === a
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {a === "params" ? "parameters" : "bytes shipped"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter of ${
            axis === "params" ? "parameter count" : "bytes shipped to the browser"
          } against each model's own headline accuracy, log-scaled x axis. The six browser models cluster between 27.5 KiB and 234 KiB; the general language models start at Llama-3.2-1B and run to Llama-3.1-405B.`}
        >
          {/* frontier reference band */}
          <line
            x1={padL}
            y1={sy(FRONTIER_Y)}
            x2={W - padR}
            y2={sy(FRONTIER_Y)}
            stroke={GENERAL_COLOR}
            strokeOpacity="0.5"
            strokeDasharray="4 3"
          />
          <text
            x={W - padR}
            y={sy(FRONTIER_Y) - 5}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            fontSize="8.5"
          >
            closed frontier ≈ 90 MMLU (size undisclosed)
          </text>

          {/* y gridlines */}
          {[0, 25, 50, 75, 100].map((gy) => (
            <g key={gy}>
              <line
                x1={padL}
                y1={sy(gy)}
                x2={W - padR}
                y2={sy(gy)}
                stroke="currentColor"
                strokeOpacity="0.07"
              />
              <text
                x={padL - 6}
                y={sy(gy) + 3}
                textAnchor="end"
                className="fill-muted-foreground/60 font-mono"
                fontSize="9"
              >
                {gy}
              </text>
            </g>
          ))}
          <text
            x={12}
            y={16}
            className="fill-muted-foreground/60 font-mono"
            fontSize="8.5"
          >
            % — own task accuracy (browser) · MMLU (general)
          </text>

          {/* x ticks */}
          {ticks.map((tv) => (
            <text
              key={tv}
              x={sx(tv)}
              y={H - 28}
              textAnchor="middle"
              className="fill-muted-foreground/60 font-mono"
              fontSize="9"
            >
              {fmtTick(tv)}
            </text>
          ))}
          <text
            x={(W + padL) / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground/50 font-mono"
            fontSize="9"
          >
            {axis === "params" ? "parameters" : "bytes shipped to the browser"} (log)
          </text>

          {/* "no value published" lane */}
          <line
            x1={padL}
            y1={sy(NO_VALUE_Y)}
            x2={W - padR}
            y2={sy(NO_VALUE_Y)}
            stroke="currentColor"
            strokeOpacity="0.05"
            strokeDasharray="2 4"
          />

          {/* points */}
          {POINTS.map((p, i) => {
            const x = sx(axis === "params" ? p.params : p.bytes)
            const y = p.metricValue == null ? sy(NO_VALUE_Y) : sy(p.metricValue)
            const on = hover === i
            const color = p.group === "browser" ? BROWSER_COLOR : GENERAL_COLOR
            const dim = hover != null && !on
            if (p.metricValue == null) {
              return (
                <g
                  key={p.name}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                  opacity={dim ? 0.45 : 1}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={on ? 7 : 5.5}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.6}
                    strokeDasharray="2.5 2"
                  />
                  <text
                    x={x}
                    y={y + 3}
                    textAnchor="middle"
                    className="fill-current font-mono"
                    fontSize="7.5"
                    style={{ color }}
                  >
                    ?
                  </text>
                  <text
                    x={x}
                    y={y + 17}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    fontSize="8"
                  >
                    {p.name}
                  </text>
                </g>
              )
            }
            return (
              <g
                key={p.name}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer"
                opacity={dim ? 0.45 : 1}
              >
                <circle cx={x} cy={y} r={on ? 6.5 : 4.5} fill={color} />
                {p.group === "browser" && on ? (
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    className="fill-foreground font-mono"
                    fontSize="9"
                    fontWeight={700}
                  >
                    {p.name}
                  </text>
                ) : null}
              </g>
            )
          })}

          {hp ? (
            <g
              transform={`translate(${Math.min(
                sx(axis === "params" ? hp.params : hp.bytes) + 8,
                W - 210
              )}, ${Math.max(
                (hp.metricValue == null ? sy(NO_VALUE_Y) : sy(hp.metricValue)) - 44,
                padT
              )})`}
            >
              <rect width="206" height="40" rx="5" fill="var(--background)" stroke="var(--border)" />
              <text x="7" y="12" className="fill-foreground font-mono" fontSize="9" fontWeight="600">
                {hp.name}
              </text>
              <text x="7" y="23" className="fill-muted-foreground font-mono" fontSize="8">
                {fmtParams(hp.params)} params · {fmtBytes(hp.bytes)}
              </text>
              <text x="7" y="33.5" className="fill-muted-foreground font-mono" fontSize="8">
                {hp.metricValue == null
                  ? hp.metricLabel
                  : `${hp.metricValue}% ${hp.metricLabel}`}
              </text>
            </g>
          ) : null}
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: BROWSER_COLOR }} />{" "}
            browser-tab models (this piece)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: GENERAL_COLOR }} />{" "}
            general LLMs (MMLU)
          </span>
          <span className="ml-auto">hover a point</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This is not one benchmark — the browser models solve six different
          narrow problems and the general models solve one broad one, so the Y
          axis is two honestly-different series, not a shared leaderboard. What
          the log X axis shows plainly is scale:{" "}
          <span className="text-foreground">
            {axis === "params" ? "29,597 to 245,063 parameters" : "27.6 KiB to 234 KiB"}
          </span>{" "}
          for all six browser models versus{" "}
          <span className="text-foreground">
            {axis === "params" ? "1.24 billion to 405 billion" : "2.3 GiB to 754 GiB"}
          </span>{" "}
          for five ordinary open-weight language models — five to seven orders
          of magnitude, and the closed frontier is further right still, at a
          size nobody discloses.
        </p>
      </div>
    </figure>
  )
}
