"use client"

import { useMemo, useState } from "react"

import { mlog } from "@/lib/dmath"

// Where Needle 3 actually sits, on a shared log axis, against two clusters
// this site has already measured independently: the browser-tab models in
// /articles/tiny-browser-models (tens of thousands of parameters, one task
// each, shipped as a static asset) and the constrained-decoding argument in
// /articles/parallel-constrained-decoding (small output space -> a small model
// can match a big one). Needle 3 is the connective case: bigger than a
// browser-tab model by three orders of magnitude, smaller than the general
// tool-callers it beats by one to two, on the same benchmark those baselines
// are plotted on in Cactus's own Figure 2 (Mobile Actions, base checkpoints,
// no fine-tuning). The browser cluster has no Mobile Actions score — it solves
// a different task — so it is plotted on its own headline metric, in a
// visually distinct series, exactly as the precedent chart on this site does.
// The claim is never "gpu-query beats Needle" (different tasks); it is "five
// orders of magnitude of parameter count, on this site, in eleven weeks."

type Point = {
  name: string
  params: number
  metric: number | null
  metricLabel: string
  group: "browser" | "tool"
  note: string
}

const POINTS: Point[] = [
  { name: "gpu-query", params: 29_597, metric: 98.88, metricLabel: "transfer accuracy, own task", group: "browser", note: "search phrase → filter, unseen schemas" },
  { name: "gpu-time", params: 38_745, metric: 97.6, metricLabel: "exact match, own task", group: "browser", note: "text → date/RFC 5545" },
  { name: "neural-flexbox", params: 36_354, metric: 94.03, metricLabel: "within 1px, own task", group: "browser", note: "approximates a CSS flex row" },
  { name: "gpu-lexer", params: 41_321, metric: 83.02, metricLabel: "Shiki agreement, own task", group: "browser", note: "syntax highlighting, no language ID" },
  { name: "gpu-cron", params: 35_783, metric: null, metricLabel: "no score published", group: "browser", note: "text → cron expression" },
  { name: "tinySarf", params: 245_063, metric: 87.02, metricLabel: "teacher agreement, own task", group: "browser", note: "Arabic morphology" },

  { name: "Needle3-4L", params: 29_000_000, metric: 11.7, metricLabel: "Mobile Actions, base", group: "tool", note: "gated, CQ2-bit" },
  { name: "Needle 2", params: 45_000_000, metric: 63.5, metricLabel: "Mobile Actions, base", group: "tool", note: "CQ2-bit, prior generation" },
  { name: "Needle3-8L", params: 52_000_000, metric: 36.8, metricLabel: "Mobile Actions, base", group: "tool", note: "gated, CQ2-bit" },
  { name: "Needle3-16L", params: 98_000_000, metric: 80.7, metricLabel: "Mobile Actions, base", group: "tool", note: "gated, CQ2-bit" },
  { name: "Needle3-20L", params: 121_000_000, metric: 86.0, metricLabel: "Mobile Actions, base", group: "tool", note: "gated, CQ2-bit, the shipped model" },
  { name: "LFM2.5 230M", params: 230_000_000, metric: 69.3, metricLabel: "Mobile Actions, base", group: "tool", note: "f16 · vLLM" },
  { name: "FunctionGemma 270M", params: 270_000_000, metric: 65.1, metricLabel: "Mobile Actions, base", group: "tool", note: "f16 · vLLM" },
  { name: "LFM2.5 350M", params: 350_000_000, metric: 72.8, metricLabel: "Mobile Actions, base", group: "tool", note: "f16 · vLLM" },
  { name: "Qwen3.5 0.8B", params: 800_000_000, metric: 76.0, metricLabel: "Mobile Actions, base", group: "tool", note: "f16 · vLLM" },
  { name: "LFM2.5 1.2B", params: 1_200_000_000, metric: 82.4, metricLabel: "Mobile Actions, base", group: "tool", note: "f16 · vLLM" },
  { name: "Apple FM", params: 3_000_000_000, metric: 57.6, metricLabel: "Mobile Actions, base", group: "tool", note: "on-device" },
]

const BROWSER = "oklch(0.7 0.16 165)"
const TOOL = "oklch(0.62 0.03 260)"
const NEEDLE3 = "oklch(0.68 0.18 27)"
const DEEPSEEK_Y = 88.4

const W = 720
const H = 380
const padL = 40
const padR = 14
const padT = 30
const padB = 40
const r2 = (n: number) => Math.round(n * 100) / 100

function fmtParams(n: number) {
  if (n >= 1_000_000_000) return `${r2(n / 1_000_000_000)}B`
  if (n >= 1_000_000) return `${r2(n / 1_000_000)}M`
  if (n >= 1_000) return `${Math.round(n / 1000)}K`
  return String(n)
}

export function SizeCapabilityPlacement() {
  const [hover, setHover] = useState<number | null>(null)

  const xlo = Math.min(...POINTS.map((p) => p.params)) * 0.6
  const xhi = Math.max(...POINTS.map((p) => p.params)) * 2.0

  const sx = (v: number) =>
    r2(padL + ((mlog(v) - mlog(xlo)) / (mlog(xhi) - mlog(xlo))) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - v / 100) * (H - padT - padB))

  const ticks = useMemo(
    () => [1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10].filter((v) => v >= xlo * 0.9 && v <= xhi * 1.1),
    [xlo, xhi],
  )

  const NO_SCORE_Y = 6
  const hp = hover != null ? POINTS[hover] : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          parameters (log) vs. each cluster&rsquo;s own headline metric
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          browser models: /articles/tiny-browser-models
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Scatter of parameter count against each model's own headline accuracy, log-scaled x axis. Six browser-tab models cluster between 29,597 and 245,063 parameters. Needle 3's five subnetworks run from 25M to 121M, alongside Needle 2 and six general tool-calling baselines from 230M to 3B, all scored on Mobile Actions. DeepSeek V4 Flash is a dashed reference line at 88.4, size undisclosed."
        >
          <line x1={padL} y1={sy(DEEPSEEK_Y)} x2={W - padR} y2={sy(DEEPSEEK_Y)} stroke={NEEDLE3} strokeOpacity="0.5" strokeDasharray="4 3" />
          <text x={W - padR} y={sy(DEEPSEEK_Y) - 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize="8.5">
            DeepSeek V4 Flash · 88.4 (cloud, size undisclosed)
          </text>

          {[0, 25, 50, 75, 100].map((gy) => (
            <g key={gy}>
              <line x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity="0.07" />
              <text x={padL - 6} y={sy(gy) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">
                {gy}
              </text>
            </g>
          ))}
          <text x={10} y={14} className="fill-muted-foreground/60 font-mono" fontSize="8.5">
            % — own headline metric (browser) · Mobile Actions (tool-calling)
          </text>

          {ticks.map((tv) => (
            <text key={tv} x={sx(tv)} y={H - 22} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">
              {fmtParams(tv)}
            </text>
          ))}
          <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">
            total parameters (log)
          </text>

          <line x1={padL} y1={sy(NO_SCORE_Y)} x2={W - padR} y2={sy(NO_SCORE_Y)} stroke="currentColor" strokeOpacity="0.05" strokeDasharray="2 4" />

          {POINTS.map((p, i) => {
            const x = sx(p.params)
            const y = p.metric == null ? sy(NO_SCORE_Y) : sy(p.metric)
            const on = hover === i
            const isNeedle3 = p.name.startsWith("Needle3")
            const color = p.group === "browser" ? BROWSER : isNeedle3 ? NEEDLE3 : TOOL
            const dim = hover != null && !on
            return (
              <g key={p.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <circle cx={x} cy={y} r={on ? 6 : isNeedle3 ? 4.5 : 3.6} fill={color} opacity={dim ? 0.25 : p.metric == null ? 0.5 : 0.9} stroke={p.metric == null ? color : "none"} strokeDasharray={p.metric == null ? "2 2" : undefined} />
                {on ? (
                  <text x={x} y={y - 10} textAnchor="middle" className="fill-foreground font-mono" fontSize="9.5" fontWeight={600}>
                    {p.name}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: BROWSER }} /> browser-tab models (own task)
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: NEEDLE3 }} /> Needle 3 subnetworks
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: TOOL }} /> Needle 2 &amp; general baselines
          </span>
        </div>

        <div className="mt-3 min-h-[3.25rem] rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {hp ? (
            <>
              <span className="font-mono text-foreground">{hp.name}</span> · {fmtParams(hp.params)} params ·{" "}
              {hp.metric != null ? `${hp.metric}% ${hp.metricLabel}` : hp.metricLabel} — {hp.note}
            </>
          ) : (
            "Hover a point. The x-axis alone spans gpu-query's 29,597 parameters to Apple FM's 3 billion — just over five orders of magnitude, all of it either verified against a repository or read off Cactus's own chart."
          )}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Needle3-20L sits at 121M parameters and 86.0 on Mobile Actions, ahead of LFM2.5 1.2B (82.4) at roughly a
          tenth its size — the &ldquo;beats models 10x its size&rdquo; claim, on this specific benchmark, checks out.
          The browser cluster is not a counterexample to that; it is a different point entirely.{" "}
          <span className="text-foreground">Six models solving one narrow, deterministic task each get to 83-99%
          agreement at 30-250 thousand parameters</span>{" "}— three orders of magnitude below Needle 3&rsquo;s
          smallest slice — precisely because a syntax highlighter or a date parser has nothing like a tool schema to
          select from. Constrain the output space and the parameter count the task needs falls off a cliff; Needle 3
          and the browser cluster are two points on the same curve, five orders of magnitude apart on the x-axis
          because they constrain the space by two very different amounts.
        </p>
      </div>
    </figure>
  )
}
