"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { CONTROLS, DOSES, type DoseRow } from "./deep"

// The edit's one free number, swept on a CPU. Each row is six base-model
// answers from the published samples, split at their loop onset and scored
// teacher-forced under weights rebuilt from the recovered u, the 64 columns
// and a chosen alpha (deep.ts). Bars are the change in mean log-probability
// per token against the unedited weights: the loop tail (what the edit should
// make unlikely) and the productive text before it (what it should leave
// alone). The controls keep the dose at 6 and change one other thing. Where
// Astra generated with a dose itself, its logged paired result is quoted.

const ACCENT = "oklch(0.62 0.16 35)"
const BLUE = "oklch(0.60 0.15 255)"
const MONO = "ui-monospace, monospace"

const W = 640
const LX = 150
const RX = W - 24
const SCALE = 0.2 // nats per token at the right edge

function Bars({ row }: { row: DoseRow }) {
  const sx = (v: number) => LX + (Math.abs(v) / SCALE) * (RX - LX)
  const H = 96
  const items = [
    { k: "loop tail", v: row.dTail, c: ACCENT },
    { k: "text before the loop", v: row.dHead, c: BLUE },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
      <title>
        {`${row.label}: loop tail ${row.dTail.toFixed(3)} nats per token, text before the loop ${row.dHead.toFixed(3)} nats per token, against the unedited weights.`}
      </title>
      {[0, 0.05, 0.1, 0.15, 0.2].map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={4} y2={H - 18} stroke="currentColor" strokeOpacity={0.08} />
          <text x={sx(t)} y={H - 5} fontSize={9} textAnchor="middle" fontFamily={MONO} fill="currentColor" fillOpacity={0.5}>
            {t === 0 ? "0" : `-${t.toFixed(2)}`}
          </text>
        </g>
      ))}
      {items.map((it, i) => {
        const y = 8 + i * 32
        return (
          <g key={it.k}>
            <text x={LX - 8} y={y + 13} fontSize={10} textAnchor="end" fontFamily={MONO} fill="currentColor">
              {it.k}
            </text>
            <rect x={LX} y={y + 2} width={Math.max(sx(Math.min(-it.v, SCALE)) - LX, 2)} height={16} rx={2} fill={it.c} fillOpacity={0.8} />
            <text x={sx(Math.min(-it.v, SCALE)) + 5} y={y + 14} fontSize={10} fontFamily={MONO} fill="currentColor">
              {it.v.toFixed(3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function DoseCurve() {
  const [mode, setMode] = useState<"dose" | "control">("dose")
  const [di, setDi] = useState(DOSES.findIndex((d) => d.alpha === 6))
  const [ci, setCi] = useState(0)
  const row = mode === "dose" ? DOSES[di] : CONTROLS[ci]
  const ratio = row.dHead < -0.0005 ? row.dTail / row.dHead : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">change in log-prob per token vs the unedited weights</span>
        <div className="flex gap-1">
          {(["dose", "control"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {m === "dose" ? "sweep alpha" : "controls at alpha 6"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {mode === "dose" ? (
          <label className="mb-2 flex items-center gap-3 font-mono text-xs">
            <span className="w-20 shrink-0">alpha = {DOSES[di].alpha}</span>
            <Range min={0} max={DOSES.length - 1} step={1} value={di} onChange={(e) => setDi(Number(e.target.value))} aria-label="alpha" className="w-full" />
          </label>
        ) : (
          <div className="mb-2 flex flex-wrap gap-1">
            {CONTROLS.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setCi(i)}
                aria-pressed={ci === i}
                className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${ci === i ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <p className="mb-1 font-mono text-[11px] text-muted-foreground">{row.what}</p>
        <Bars row={row} />
        <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">loop cost per unit of collateral</dt>
            <dd className="mt-0.5 text-sm">{ratio === null ? "n/a" : `${ratio.toFixed(1)}x`}</dd>
          </div>
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">loop tail, worst / best answer</dt>
            <dd className="mt-0.5 text-sm">
              {row.tailMin.toFixed(3)} / {row.tailMax.toFixed(3)}
            </dd>
          </div>
          <div className="col-span-2 rounded-lg border px-2.5 py-1.5 sm:col-span-1">
            <dt className="text-muted-foreground">Astra&apos;s log at this setting</dt>
            <dd className="mt-0.5 text-[11px] leading-snug">{row.logged ?? "not generated"}</dd>
          </div>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Measured on a CPU: six base-model answers, 43,214 tokens before their loops and 7,327 inside them, bfloat16.
        Teacher-forced log-probs are a mechanism check, not accuracy; the logged results are Astra&apos;s own paired
        generations on practice problems, at different problem sets and token caps, quoted from its history file.
      </figcaption>
    </figure>
  )
}
