"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

import { KERNEL_RUNS, type KernelRun } from "./kernel-runs-data"

// The four kernel-optimization runs from the RSI-top project page, re-plotted
// from the data the page itself embeds. Every derived number on this widget
// (stall share, gain, how much of the gain lands right after an intervention)
// is computed here from those arrays, the same way the article computes them.

const VAN = "oklch(0.6 0.1 220)"
const OURS = "oklch(0.6 0.19 18)"
const STALL = "oklch(0.8 0.13 75)"
const STALL_MIN = 20 / 60 // the page's definition: >= 20 minutes with < 2 cycles of gain

const W = 720
const H = 300
const ML = 44
const MR = 118
const MT = 18
const MB = 30
const Y0 = 0.55
const Y1 = 1.26

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

function valueAt(pts: [number, number][], t: number) {
  let v = pts[0][1]
  for (const [x, y] of pts) {
    if (x <= t + 1e-9) v = y
    else break
  }
  return v
}

function stats(run: KernelRun) {
  const stalls = run.stalls.filter(([a, b]) => b - a >= STALL_MIN)
  const stalled = stalls.reduce((s, [a, b]) => s + (b - a), 0)
  const ups: [number, number][] = []
  for (let i = 1; i < run.ours.length; i++) {
    const [t0, v0] = run.ours[i - 1]
    const [t1, v1] = run.ours[i]
    if (Math.abs(t1 - t0) < 1e-3 && v1 > v0 + 1e-5) ups.push([t1, v1 - v0])
  }
  const dots = run.dots.map((d) => d[0])
  let near = 0
  let total = 0
  for (const [t, g] of ups) {
    total += g
    const prev = dots.filter((d) => d <= t + 1e-6)
    if (prev.length && (t - prev[prev.length - 1]) * 60 <= 20) near += g
  }
  return {
    stallShare: stalled / run.H,
    gain: run.cycles.van / run.cycles.ours - 1,
    nearShare: total > 0 ? near / total : 0,
    interventions: run.dots.length,
  }
}

export function KernelStallExplorer() {
  const [idx, setIdx] = useState(2)
  const run = KERNEL_RUNS[idx]
  const [tPct, setTPct] = useState(100)
  const t = (tPct / 100) * run.H
  const s = useMemo(() => stats(run), [run])

  const X = (h: number) => ML + (h / run.H) * (W - ML - MR)
  const Y = (v: number) => MT + (1 - (Math.min(Y1, Math.max(Y0, v)) - Y0) / (Y1 - Y0)) * (H - MT - MB)

  const path = (pts: [number, number][]) => {
    const vis = pts.filter(([x]) => x <= t)
    if (!vis.length) return ""
    const last = vis[vis.length - 1]
    const all = [...vis, [t, last[1]] as [number, number]]
    return all.map(([x, y], i) => `${i ? "L" : "M"}${r1(X(Math.max(0, x)))} ${r1(Y(y))}`).join(" ")
  }

  const vNow = valueAt(run.van, t)
  const oNow = t >= run.fork ? valueAt(run.ours, t) : vNow
  const refs = [
    { v: 1363 / run.cycles.gpt, label: `GPT-5.6 Sol, $300: ${run.cycles.gpt}` },
    { v: 1363 / run.cycles.opus, label: `Claude Opus 5, $300: ${run.cycles.opus}` },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">four kernel runs, re-plotted from the project page&apos;s own data</span>
        <div className="flex flex-wrap gap-1">
          {KERNEL_RUNS.map((k, i) => (
            <button
              key={k.name}
              type="button"
              onClick={() => {
                setIdx(i)
                setTPct(100)
              }}
              aria-pressed={i === idx}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === idx ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k.name.replace(" · ", " / ")}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${run.name}: the framework alone ends at ${run.cycles.van} cycles; the RSI-top branch, forked at ${r2(run.fork)} hours, ends at ${run.cycles.ours} cycles after ${run.dots.length} interventions.`}
        >
          {run.stalls
            .filter(([a, b]) => b - a >= STALL_MIN && a < t)
            .map(([a, b]) => (
              <rect key={`s${a}`} x={r1(X(a))} y={MT} width={r1(X(Math.min(b, t)) - X(a))} height={H - MT - MB} fill={STALL} opacity={0.22} />
            ))}
          {[0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2].map((v) => (
            <g key={`g${v}`}>
              <line x1={ML} x2={W - MR} y1={r1(Y(v))} y2={r1(Y(v))} stroke="var(--border)" strokeOpacity={v === 1 ? 0.9 : 0.4} />
              <text x={ML - 6} y={r1(Y(v)) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {Array.from({ length: run.H / 2 + 1 }, (_, i) => i * 2).map((h) => (
            <text key={`x${h}`} x={r1(X(h))} y={H - 10} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
              {h} h
            </text>
          ))}
          {refs.map((rf, i) => (
            <g key={rf.label}>
              <line x1={ML} x2={W - MR} y1={r1(Y(rf.v))} y2={r1(Y(rf.v))} stroke="var(--muted-foreground)" strokeDasharray="4 4" opacity={0.7} />
              <text x={ML + 6} y={r1(Y(rf.v)) + (i === 0 ? -4 : 11)} fontSize={9} className="fill-muted-foreground font-mono">
                {rf.label}
              </text>
            </g>
          ))}
          <line x1={r1(X(run.fork))} x2={r1(X(run.fork))} y1={MT} y2={H - MB} stroke={OURS} strokeDasharray="2 3" opacity={0.7} />
          <text x={r1(X(run.fork)) + 4} y={H - MB - 6} fontSize={9} fill={OURS} className="font-mono">
            branch point ({r2(run.fork)} h)
          </text>
          <path d={path(run.van)} fill="none" stroke={VAN} strokeWidth={2.2} />
          {t >= run.fork ? <path d={path(run.ours)} fill="none" stroke={OURS} strokeWidth={2.4} /> : null}
          {run.dots
            .filter(([x]) => x <= t)
            .map(([x, y]) => (
              <circle key={`d${x}`} cx={r1(X(x))} cy={r1(Y(y))} r={3.4} fill={OURS} />
            ))}
          <text x={W - MR + 6} y={r1(Y(vNow)) + 4} fontSize={10} fill={VAN} className="font-mono">
            alone: {Math.round(1363 / vNow)}
          </text>
          {t >= run.fork ? (
            <text x={W - MR + 6} y={r1(Y(oNow)) - 4} fontSize={10} fill={OURS} className="font-mono font-semibold">
              RSI-top: {Math.round(1363 / oNow)}
            </text>
          ) : null}
          <text x={ML} y={MT - 6} fontSize={9} className="fill-muted-foreground font-mono">
            normalized performance = 1363 / cycles (higher is better); end labels in cycles
          </text>
        </svg>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>scrub through the run</span>
            <span className="tabular-nums text-foreground">{r1(t)} h of {run.H} h</span>
          </div>
          <Range min={0} max={100} step={1} value={tPct} onChange={(e) => setTPct(Number(e.target.value))} className="w-full cursor-pointer" accent={OURS} aria-label="Hours into the run" />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">time stalled, alone</dt>
            <dd className="text-sm text-foreground tabular-nums">{(s.stallShare * 100).toFixed(1)}%</dd>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">final gain, one run</dt>
            <dd className="text-sm text-foreground tabular-nums">+{(s.gain * 100).toFixed(1)}%</dd>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">interventions · cost</dt>
            <dd className="text-sm text-foreground tabular-nums">
              {s.interventions} · ${run.cost}
            </dd>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">gain within 20 min of one</dt>
            <dd className="text-sm text-foreground tabular-nums">{(s.nearShare * 100).toFixed(0)}%</dd>
          </div>
        </dl>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Amber bands are stalls of at least 20 minutes in the framework-alone run; red dots are RSI-top
          interventions. Everything left of the branch point is the same run. The gain is the framework&apos;s final
          cycles over RSI-top&apos;s, from one run of each, with no repeat seeds. The cost is the project page&apos;s figure
          for the RSI-top run; the framework-alone run&apos;s cost is not given.
        </p>
      </div>
    </figure>
  )
}
