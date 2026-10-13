"use client"

import { useMemo, useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { errorRun, type Format, type Memory } from "./sim"

// Where the rounding error goes. A toy Mamba-2 head (8 x 32 state, random
// inputs, a fresh decay every step) decoded 4,096 steps four ways: exactly, with
// the state rounded after every update (conventional low-precision decoding),
// with one ReplaySSM checkpoint rounded once per window, and with ReplaySSM's
// separate copies — an exact recurrence plus a low-precision read copy cast from
// it at every flush and never fed back. The curves are relative output error
// against the exact run, averaged over log-spaced bins. Everything is computed
// in the browser from a fixed seed, so the first render matches the server.

const STEPS = 4096
// Two drawings of the same chart: wide for sm and up, narrow for phones, where
// an 11-unit label in a 360-wide viewBox lands at about 10.5 px.
type Geo = { w: number; h: number; pad: { l: number; r: number; t: number; b: number }; fs: number }
const WIDE: Geo = { w: 640, h: 230, pad: { l: 44, r: 22, t: 12, b: 30 }, fs: 10 }
const NARROW: Geo = { w: 360, h: 250, pad: { l: 46, r: 22, t: 12, b: 30 }, fs: 11 }
const YMIN = -5
const YMAX = 1

const chip = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

// x: log2(step) from 4 (16 steps) to 12 (4,096 steps); computed with exact
// halving so no transcendental is needed.
const log2int = (n: number) => {
  let e = 0
  let x = n
  while (x >= 2) {
    x /= 2
    e++
  }
  // linear interpolation inside the octave is enough for placing a point
  return e + (x - 1)
}
const xsOf = (g: Geo, step: number) => g.pad.l + ((log2int(step) - 4) / 8) * (g.w - g.pad.l - g.pad.r)
const yLogOf = (g: Geo, v: number) => {
  const c = Math.max(YMIN, Math.min(YMAX, v))
  return g.pad.t + ((YMAX - c) / (YMAX - YMIN)) * (g.h - g.pad.t - g.pad.b)
}
const ysOf = (g: Geo, err: number) => yLogOf(g, err > 0 ? mlog10(err) : YMIN)
const TICKS: [number, string][] = [
  [-5, "0.001%"],
  [-4, "0.01%"],
  [-3, "0.1%"],
  [-2, "1%"],
  [-1, "10%"],
  [0, "100%"],
  [1, "1000%"],
]

const SERIES = [
  { key: "conv", label: "rounded every step (conventional)", cls: "stroke-orange-600 dark:stroke-orange-400", dash: "" },
  { key: "shared", label: "one checkpoint, rounded once per window", cls: "stroke-amber-500 dark:stroke-amber-300", dash: "6 4" },
  { key: "separate", label: "separate: exact recurrence, rounded read copy", cls: "stroke-sky-600 dark:stroke-sky-400", dash: "" },
] as const

export function ErrorLoop() {
  const [fmt, setFmt] = useState<Format>("fp8")
  const [sr, setSr] = useState(true)
  const [memory, setMemory] = useState<Memory>("long")
  const [L, setL] = useState(16)

  const r = useMemo(() => errorRun({ fmt, sr, memory, L, steps: STEPS }), [fmt, sr, memory, L])
  const last = r.binSteps.length - 1
  const end = { conv: r.conv[last], shared: r.shared[last], separate: r.separate[last] }
  const pct = (v: number) => (v >= 0.1 ? `${(v * 100).toFixed(0)}%` : v >= 0.001 ? `${(v * 100).toFixed(2)}%` : `${(v * 100).toFixed(4)}%`)

  const desc = `${fmt.toUpperCase()} state, ${sr ? "stochastic" : "round-to-nearest"} rounding, ${memory}-memory head, window ${L}. Relative output error after ${STEPS} steps: ${pct(end.conv)} when rounded every step, ${pct(end.shared)} with one checkpoint, ${pct(end.separate)} with separate precisions.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>where the rounding error goes</span>
        <span className="text-muted-foreground/60">toy Mamba-2 head, 4,096 decode steps, error vs an exact run</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        <span>stored format:</span>
        {(
          [
            ["fp16", "FP16"],
            ["fp8", "FP8 E4M3"],
            ["fp4", "FP4 E2M1"],
          ] as const
        ).map(([k, lab]) => (
          <button key={k} type="button" aria-pressed={fmt === k} onClick={() => setFmt(k)} className={chip(fmt === k)}>
            {lab}
          </button>
        ))}
        <span>rounding:</span>
        <button type="button" aria-pressed={sr} onClick={() => setSr(true)} className={chip(sr)}>
          stochastic
        </button>
        <button type="button" aria-pressed={!sr} onClick={() => setSr(false)} className={chip(!sr)}>
          to nearest
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-2 font-mono text-[11px] text-muted-foreground">
        <span>head memory:</span>
        <button type="button" aria-pressed={memory === "long"} onClick={() => setMemory("long")} className={chip(memory === "long")}>
          long, decay 0.9995 to 0.99999
        </button>
        <button type="button" aria-pressed={memory === "short"} onClick={() => setMemory("short")} className={chip(memory === "short")}>
          short, decay 0.9 to 0.95
        </button>
        <span>window L:</span>
        {[4, 16, 64].map((v) => (
          <button key={v} type="button" aria-pressed={L === v} onClick={() => setL(v)} className={chip(L === v)}>
            {v}
          </button>
        ))}
      </div>

      <div className="px-2 pt-3 sm:px-4" role="img" aria-label={desc}>
        {([WIDE, NARROW] as const).map((g) => (
          <svg
            key={g.w}
            viewBox={`0 0 ${g.w} ${g.h}`}
            className={g === WIDE ? "hidden h-auto w-full sm:block" : "mx-auto block h-auto w-full max-w-[480px] sm:hidden"}
            aria-hidden="true"
          >
            {TICKS.map(([e, lab]) => (
              <g key={e}>
                <line x1={g.pad.l} x2={g.w - g.pad.r} y1={yLogOf(g, e)} y2={yLogOf(g, e)} className="stroke-border" strokeDasharray="2 3" />
                <text x={g.pad.l - 5} y={yLogOf(g, e) + 3.5} textAnchor="end" fontSize={g.fs} className="fill-muted-foreground font-mono">
                  {lab}
                </text>
              </g>
            ))}
            {[16, 64, 256, 1024, 4096].map((t) => (
              <text key={t} x={xsOf(g, t)} y={g.h - 10} textAnchor="middle" fontSize={g.fs} className="fill-muted-foreground font-mono">
                {t.toLocaleString("en-US")}
              </text>
            ))}
            {SERIES.map((sr2) => {
              const vals = r[sr2.key]
              const pts = r.binSteps.map((st, i) => `${xsOf(g, st).toFixed(1)},${ysOf(g, vals[i]).toFixed(1)}`).join(" ")
              return (
                <polyline
                  key={sr2.key}
                  points={pts}
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray={sr2.dash}
                  className={sr2.cls}
                  strokeLinejoin="round"
                />
              )
            })}
          </svg>
        ))}
      </div>

      <div className="space-y-1 px-4 pb-3 font-mono text-[10.5px]">
        <p className="my-0 text-muted-foreground">x: decode step (log scale) · y: relative output error, log scale</p>
        {SERIES.map((s2) => (
          <div key={s2.key} className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" x2="22" y1="4" y2="4" strokeWidth={2} strokeDasharray={s2.dash} className={s2.cls} />
            </svg>
            <span className="flex-1 text-muted-foreground">{s2.label}</span>
            <span className="tabular-nums text-foreground">{pct(end[s2.key])}</span>
          </div>
        ))}
        <p className="my-0 pt-1 text-muted-foreground">
          error at step 4,096: the separate copy is {(end.shared / end.separate).toFixed(1)}x below one shared checkpoint and{" "}
          {(end.conv / end.separate).toFixed(0)}x below rounding every step
        </p>
      </div>
    </figure>
  )
}
