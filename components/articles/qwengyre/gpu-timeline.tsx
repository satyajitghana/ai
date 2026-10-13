"use client"

import { useId, useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { C, CONFIG, K, MEDIAN_H, N, B, STEPS, STARVED, TIMEOUT_H, TRAIN, runAll, type Policy, type SimResult } from "./sim"

// Three GPU placement policies run on the same draw of rollout durations, so
// the only thing that differs between the panels is the scheduling rule. The
// simulator (./sim.ts) is a toy of the paper's rules, with eight cells; it does
// not reproduce the paper's cluster or its numbers, and the hours it prints
// are its own. The measured results are in the paper's Tables 1 and 2.

const ORDER: { k: Policy; label: string; note: string }[] = [
  { k: "colocate", label: "Colocate", note: "whole pool switches; waits for the last rollout" },
  { k: "async", label: "Async", note: "fixed 4 training / 4 rollout cells" },
  { k: "elastic", label: "Elastic (QwenGyre rules)", note: "cells leave rollout one at a time" },
]

const W = 720
const LEFT = 8
const ROW = 7
const GAP = 1.5
const PANEL_H = K * (ROW + GAP)
const PANEL_GAP = 30
const TOP = 16

function fill(code: number) {
  if (code === TRAIN) return "oklch(0.68 0.15 18)"
  if (code === STARVED) return "none"
  if (code === 0) return "none"
  return `oklch(0.62 0.13 295 / ${(0.22 + 0.19 * code).toFixed(2)})`
}

function Panel({
  r,
  y,
  maxT,
  label,
  note,
  hatch,
}: {
  r: SimResult
  y: number
  maxT: number
  label: string
  note: string
  hatch: string
}) {
  const sx = (t: number) => LEFT + ((W - LEFT - 4) * t) / maxT
  return (
    <g>
      <text x={LEFT} y={y - 5} className="fill-foreground" fontSize={10.5} fontFamily="var(--font-mono, monospace)">
        {label}
        <tspan className="fill-muted-foreground" dx={8} fontSize={9.5}>
          {note}
        </tspan>
      </text>
      <text x={W - 4} y={y - 5} textAnchor="end" className="fill-foreground" fontSize={10.5} fontFamily="var(--font-mono, monospace)">
        {r.hours.toFixed(1)} h
      </text>
      {Array.from({ length: K }, (_, c) => (
        <rect
          key={`bg${c}`}
          x={sx(0)}
          y={y + c * (ROW + GAP)}
          width={(sx(r.hours) - sx(0)).toFixed(2)}
          height={ROW}
          fill={`url(#${hatch})`}
          opacity={0.55}
        />
      ))}
      {r.segments
        .filter((s) => s.code !== 0)
        .map((s, i) => {
          const x0 = sx(s.t0)
          const x1 = sx(s.t1)
          const starved = s.code === STARVED
          return (
            <rect
              key={i}
              x={x0.toFixed(2)}
              y={(y + s.cell * (ROW + GAP)).toFixed(2)}
              width={Math.max(0.4, x1 - x0).toFixed(2)}
              height={ROW}
              fill={fill(s.code)}
              stroke={starved ? "oklch(0.68 0.15 18)" : "none"}
              strokeWidth={starved ? 0.8 : 0}
            />
          )
        })}
      {r.stepTimes.map((t, i) => (
        <line
          key={`s${i}`}
          x1={sx(t).toFixed(2)}
          x2={sx(t).toFixed(2)}
          y1={y - 1}
          y2={y + PANEL_H - GAP + 1}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="1.5 1.5"
          strokeWidth={0.7}
        />
      ))}
    </g>
  )
}

export function GpuTimeline() {
  const [sigma, setSigma] = useState(0.45)
  const [trainHours, setTrainHours] = useState(0.5)
  const [seed, setSeed] = useState(1)
  const [streaming, setStreaming] = useState(false)
  const hatch = `hatch${useId().replace(/[^a-zA-Z0-9]/g, "")}`

  const res = useMemo(() => runAll({ sigma, trainHours, seed, asyncStreaming: streaming }), [sigma, trainHours, seed, streaming])
  const maxT = Math.max(res.colocate.hours, res.async.hours, res.elastic.hours)
  const tickEvery = maxT > 24 ? 4 : 2
  const ticks: number[] = []
  for (let t = 0; t <= maxT; t += tickEvery) ticks.push(t)
  const H = TOP + 3 * PANEL_H + 2 * PANEL_GAP + 22
  const panelY = (i: number) => TOP + i * (PANEL_H + PANEL_GAP)
  const sx = (t: number) => LEFT + ((W - LEFT - 4) * t) / maxT

  const vs = (p: Policy) => (res[p].hours / res.elastic.hours).toFixed(2)
  const btn = "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Same rollouts, three schedulers: {STEPS} training steps on {K} cells</span>
        <span className="font-mono text-[11px] text-muted-foreground">a toy model, not the paper&apos;s cluster</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
            <span>
              rollout tail (spread of log duration): <span className="text-foreground">{sigma.toFixed(2)}</span>
            </span>
            <Range min={0.15} max={0.85} step={0.05} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} aria-label="rollout tail" />
          </label>
          <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
            <span>
              training cost per step, on all {K} cells: <span className="text-foreground">{trainHours.toFixed(2)} h</span>
            </span>
            <Range min={0.25} max={1.5} step={0.25} value={trainHours} onChange={(e) => setTrainHours(Number(e.target.value))} aria-label="training cost per step" />
          </label>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <input type="checkbox" checked={streaming} onChange={(e) => setStreaming(e.target.checked)} />
            let Async stream groups into training (the paper&apos;s A3)
          </label>
          <button type="button" className={btn} onClick={() => setSeed((s) => s + 1)}>
            new draw of durations
          </button>
          <span className="font-mono text-[11px] text-muted-foreground">draw #{seed}</span>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] text-foreground" role="img" aria-label="Cell roles over time for Colocate, Async and Elastic scheduling">
            <defs>
              <pattern id={hatch} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={4} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
              </pattern>
            </defs>
            {ORDER.map((o, i) => (
              <Panel key={o.k} r={res[o.k]} y={panelY(i)} maxT={maxT} label={o.label} note={o.k === "async" && streaming ? "fixed 4 / 4, streaming" : o.note} hatch={hatch} />
            ))}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={sx(t).toFixed(2)} x2={sx(t).toFixed(2)} y1={H - 20} y2={H - 16} stroke="currentColor" strokeOpacity={0.5} />
                <text x={sx(t).toFixed(2)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={9} fontFamily="var(--font-mono, monospace)">
                  {t}h
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "oklch(0.62 0.13 295 / 0.79)" }} /> rollout (darker = fuller cell)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "oklch(0.68 0.15 18)" }} /> training
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm border" style={{ borderColor: "oklch(0.68 0.15 18)" }} /> training role, no data yet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed" /> idle
          </span>
          <span>dotted line = a step finishes</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {ORDER.map((o) => {
            const r = res[o.k]
            return (
              <div key={o.k} className={cn("rounded-lg border px-3 py-2", o.k === "elastic" && "border-foreground/25 bg-muted/30")}>
                <div className="font-mono text-[11px] text-muted-foreground">{o.label}</div>
                <div className="font-mono text-sm text-foreground">
                  {r.hours.toFixed(1)} h{o.k !== "elastic" && <span className="text-muted-foreground"> · elastic is {vs(o.k)}x faster</span>}
                </div>
                <div className="font-mono text-[10.5px] text-muted-foreground">
                  cells busy {(100 * r.busyShare).toFixed(0)}% of the time · (φ, μ) = ({CONFIG[o.k].phi}, {CONFIG[o.k].mu})
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
          Each cell serves {C} executions at a time; a step trains {B} groups of {N}. Durations are lognormal around {MEDIAN_H} h and capped at a {TIMEOUT_H} h timeout. All three hold the paper&apos;s mean scheduling staleness of 1.5 policy versions. Push the tail up and the training cost down and Colocate catches Elastic, because nearly every burst ends at the timeout anyway.
        </p>
      </div>
    </figure>
  )
}
