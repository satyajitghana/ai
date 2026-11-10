"use client"

import { useState } from "react"

import { RUNS } from "./deep"

// The three budgets' edits against the base model, read from the logs'
// evaluation shards (deep.ts). Per MATH level: accuracy over all 500 problems
// x 4 samples (solid bar), and the share of first samples that fell into a
// loop and never closed their thinking (the hatched bar, out of the 200 first
// samples the logs keep). The base model is drawn as a faint outline under
// every run so the change reads directly.

const ACCENT = "oklch(0.62 0.16 35)"
const BLUE = "oklch(0.60 0.15 255)"
const MONO = "ui-monospace, monospace"

const W = 640
const LX = 70
const RX = W - 20
const ROW = 46
const TOP = 24

export function RunLevels() {
  const [idx, setIdx] = useState(3)
  const run = RUNS[idx]
  const base = RUNS[0]
  const H = TOP + 5 * ROW + 26
  const sx = (v: number) => LX + (v / 100) * (RX - LX)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">MATH-500 by difficulty level, per forward-pass budget</span>
        <div className="flex flex-wrap gap-1">
          {RUNS.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setIdx(i)}
              aria-pressed={idx === i}
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${idx === i ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <p className="mb-2 font-mono text-[11px] text-muted-foreground">
          {run.edit} · weights changed: {run.changed}
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            {`${run.label}: accuracy by level ${run.levels.map((l, i) => `L${i + 1} ${l.acc}%`).join(", ")}; first samples stuck in an unclosed loop ${run.levels
              .map((l, i) => `L${i + 1} ${l.loopOpen} of ${l.n}`)
              .join(", ")}.`}
          </title>
          <defs>
            <pattern id="wsp-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke={ACCENT} strokeWidth="2.2" />
            </pattern>
          </defs>
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={TOP - 6} y2={H - 20} stroke="currentColor" strokeOpacity={0.08} />
              <text x={sx(t)} y={H - 6} fontSize={9} textAnchor="middle" fontFamily={MONO} fill="currentColor" fillOpacity={0.5}>
                {t}%
              </text>
            </g>
          ))}
          {run.levels.map((l, i) => {
            const y = TOP + i * ROW
            const b = base.levels[i]
            const loopPct = (l.loopOpen / l.n) * 100
            const baseLoopPct = (b.loopOpen / b.n) * 100
            return (
              <g key={i}>
                <text x={LX - 10} y={y + 14} fontSize={11} textAnchor="end" fontFamily={MONO} fill="currentColor">
                  level {i + 1}
                </text>
                <rect x={LX} y={y + 2} width={Math.max(sx(b.acc) - LX, 1)} height={15} rx={2} fill="none" stroke={BLUE} strokeOpacity={0.5} strokeDasharray="3 2" />
                <rect x={LX} y={y + 2} width={Math.max(sx(l.acc) - LX, 2)} height={15} rx={2} fill={BLUE} fillOpacity={0.8} />
                <text x={sx(l.acc) + 5} y={y + 13} fontSize={10} fontFamily={MONO} fill="currentColor">
                  {l.acc.toFixed(1)}% right
                </text>
                <rect x={LX} y={y + 21} width={Math.max(sx(baseLoopPct) - LX, 1)} height={13} rx={2} fill="none" stroke={ACCENT} strokeOpacity={0.5} strokeDasharray="3 2" />
                <rect x={LX} y={y + 21} width={Math.max(sx(loopPct) - LX, 2)} height={13} rx={2} fill="url(#wsp-hatch)" stroke={ACCENT} strokeOpacity={0.8} />
                <text x={sx(Math.max(loopPct, 0)) + 5} y={y + 31} fontSize={9} fontFamily={MONO} fill="currentColor" fillOpacity={0.75}>
                  {l.loopOpen}/{l.n} stuck in a loop
                </text>
              </g>
            )
          })}
          <text x={LX} y={12} fontSize={9} fontFamily={MONO} fill="currentColor" fillOpacity={0.55}>
            dashed outline = base model
          </text>
        </svg>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["MATH-500 avg@4", `${run.acc.toFixed(1)}%`],
            ["solved at least once", `${run.pass4.toFixed(1)}%`],
            ["first samples closed", `${run.closed} / 200`],
            ["looped, then closed", `${run.loopThenClosed} / ${run.looped}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Measured from the evaluation shards in the published logs. Accuracy is every MATH-500 problem, four samples each
        (thinking on, 32,768-token cap). The loop bars are the first sample of 200 problems, the only full texts the
        logs keep; a loop is a run of 3,000 characters whose lines at least 90% repeat earlier lines.
      </figcaption>
    </figure>
  )
}
