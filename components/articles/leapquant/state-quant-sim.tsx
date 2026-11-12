"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { type Format, type Memory, makeInputs, outlierRatios, run } from "./sim"

// A recurrent-state quantization simulator. One toy Gated DeltaNet head
// (32 x 32 state, L2-normalised keys with a few biased and wide channels, a few
// large value channels, decay just under 1) decoded 4,096 steps exactly, and
// again with the state stored in BF16, INT8 or INT4. The grey curve stores the
// state after every step with nothing else, the usual way. The coloured curve
// uses the settings below: a window between re-quantizations, r Compensator
// Tokens and residual smoothing. Everything runs from a fixed seed, so the
// server render and the browser agree.

const STEPS = 4096
const EVERY = 64
const WINDOWS = [1, 2, 4, 8, 16, 32]
const RANKS = [0, 1, 2, 4, 8]

type Geo = { w: number; h: number; pad: { l: number; r: number; t: number; b: number }; fs: number }
const WIDE: Geo = { w: 640, h: 230, pad: { l: 48, r: 18, t: 12, b: 30 }, fs: 10 }
const NARROW: Geo = { w: 360, h: 250, pad: { l: 48, r: 16, t: 12, b: 30 }, fs: 11 }
const YMIN = -4
const YMAX = 1
const TICKS: [number, string][] = [
  [-4, "0.01%"],
  [-3, "0.1%"],
  [-2, "1%"],
  [-1, "10%"],
  [0, "100%"],
  [1, "1000%"],
]

const xOf = (g: Geo, step: number) => g.pad.l + (step / STEPS) * (g.w - g.pad.l - g.pad.r)
const yLog = (g: Geo, e: number) => {
  const c = Math.max(YMIN, Math.min(YMAX, e))
  return g.pad.t + ((YMAX - c) / (YMAX - YMIN)) * (g.h - g.pad.t - g.pad.b)
}
const yOf = (g: Geo, err: number) => yLog(g, Number.isFinite(err) ? (err > 0 ? mlog10(err) : YMIN) : YMAX)

const chip = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

const pct = (v: number) =>
  !Number.isFinite(v) || v >= 10 ? "over 1000%" : v >= 0.1 ? `${(v * 100).toFixed(0)}%` : v >= 0.01 ? `${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(2)}%`

export function StateQuantSim() {
  const [fmt, setFmt] = useState<Format>("int8")
  const [memory, setMemory] = useState<Memory>("long")
  const [wi, setWi] = useState(4) // index into WINDOWS -> 16
  const [r, setR] = useState(4)
  const [smooth, setSmooth] = useState(true)
  const win = WINDOWS[wi]

  const inputs = useMemo(() => makeInputs(STEPS, memory), [memory])
  const base = useMemo(() => run(inputs, { fmt, window: 1, r: 0, smooth: false, steps: STEPS }, EVERY), [inputs, fmt])
  const mine = useMemo(() => run(inputs, { fmt, window: win, r, smooth, steps: STEPS }, EVERY), [inputs, fmt, win, r, smooth])
  const ratios = useMemo(() => outlierRatios(base.state, r), [base.state, r])

  const endBase = base.err[base.err.length - 1]
  const endMine = mine.err[mine.err.length - 1]
  const better = endMine > 0 && Number.isFinite(endBase) ? endBase / endMine : 0
  const setting = `${fmt.toUpperCase()}, window ${win}, ${r} Compensator Token${r === 1 ? "" : "s"}, smoothing ${smooth ? "on" : "off"}`
  const desc = `Relative state error over ${STEPS} decode steps of a toy Gated DeltaNet head. Stored every step with nothing else: ${pct(endBase)} at the end. With ${setting}: ${pct(endMine)}.`

  const bars = [
    { label: "state", v: ratios.state },
    { label: `minus ${r} comp. token${r === 1 ? "" : "s"}`, v: ratios.residual },
    { label: "then smoothed", v: ratios.smoothed },
  ]
  const barMax = Math.max(...bars.map((b) => b.v), 1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>recurrent-state quantization simulator</span>
        <span className="text-muted-foreground/60">toy GDN head, 32 x 32 state, 4,096 steps</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        <span>stored as:</span>
        {(
          [
            ["bf16", "BF16"],
            ["int8", "INT8"],
            ["int4", "INT4"],
          ] as const
        ).map(([k, lab]) => (
          <button key={k} type="button" aria-pressed={fmt === k} onClick={() => setFmt(k)} className={chip(fmt === k)}>
            {lab}
          </button>
        ))}
        <span>head memory:</span>
        <button type="button" aria-pressed={memory === "long"} onClick={() => setMemory("long")} className={chip(memory === "long")}>
          long, decay 0.9996 to 1
        </button>
        <button type="button" aria-pressed={memory === "short"} onClick={() => setMemory("short")} className={chip(memory === "short")}>
          short, decay 0.996 to 1
        </button>
      </div>

      <div className="grid gap-x-6 gap-y-2 px-4 pt-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <label className="flex items-center gap-3">
          <span className="w-36 shrink-0">re-quantize every {win === 1 ? "step" : `${win} steps`}</span>
          <Range
            min={0}
            max={WINDOWS.length - 1}
            step={1}
            value={wi}
            onChange={(e) => setWi(Number(e.target.value))}
            aria-label="Window length in tokens"
            className="flex-1"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span>Compensator Tokens:</span>
          {RANKS.map((v) => (
            <button key={v} type="button" aria-pressed={r === v} onClick={() => setR(v)} className={chip(r === v)}>
              {v}
            </button>
          ))}
          <button type="button" aria-pressed={smooth} onClick={() => setSmooth(!smooth)} className={chip(smooth)}>
            smoothing {smooth ? "on" : "off"}
          </button>
        </div>
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
                <line x1={g.pad.l} x2={g.w - g.pad.r} y1={yLog(g, e)} y2={yLog(g, e)} className="stroke-border" strokeDasharray="2 3" />
                <text x={g.pad.l - 5} y={yLog(g, e) + 3.5} textAnchor="end" fontSize={g.fs} className="fill-muted-foreground font-mono">
                  {lab}
                </text>
              </g>
            ))}
            {[0, 1024, 2048, 3072, 4096].map((t) => (
              <text key={t} x={xOf(g, t)} y={g.h - 10} textAnchor="middle" fontSize={g.fs} className="fill-muted-foreground font-mono">
                {t.toLocaleString("en-US")}
              </text>
            ))}
            <polyline
              points={base.err.map((e, i) => `${xOf(g, (i + 1) * EVERY).toFixed(1)},${yOf(g, e).toFixed(1)}`).join(" ")}
              fill="none"
              strokeWidth={2}
              className="stroke-muted-foreground/70"
              strokeLinejoin="round"
            />
            <polyline
              points={mine.err.map((e, i) => `${xOf(g, (i + 1) * EVERY).toFixed(1)},${yOf(g, e).toFixed(1)}`).join(" ")}
              fill="none"
              strokeWidth={2.2}
              className="stroke-orange-600 dark:stroke-orange-400"
              strokeLinejoin="round"
            />
          </svg>
        ))}
      </div>

      <div className="space-y-1 px-4 pb-2 font-mono text-[10.5px]">
        <p className="my-0 text-muted-foreground">x: decode step · y: ‖S_stored − S_exact‖ / ‖S_exact‖, log scale</p>
        <div className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" x2="22" y1="4" y2="4" strokeWidth={2} className="stroke-muted-foreground/70" />
          </svg>
          <span className="flex-1 text-muted-foreground">
            {fmt.toUpperCase()}, stored every step, no fixes ({base.rounds.toLocaleString("en-US")} quantizations)
          </span>
          <span className="tabular-nums text-foreground">{pct(endBase)}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" x2="22" y1="4" y2="4" strokeWidth={2.2} className="stroke-orange-600 dark:stroke-orange-400" />
          </svg>
          <span className="flex-1 text-muted-foreground">
            your settings ({mine.rounds.toLocaleString("en-US")} quantizations)
          </span>
          <span className="tabular-nums text-foreground">{pct(endMine)}</span>
        </div>
        <p className="my-0 pt-1 text-muted-foreground">
          {better >= 1.05
            ? `error at step 4,096 is ${better.toFixed(better >= 10 ? 0 : 1)}x lower than storing every step`
            : better > 0 && better < 0.95
              ? "these settings end worse than storing every step"
              : "these settings end about where storing every step does"}
        </p>
      </div>

      <div className="border-t px-4 py-3 font-mono text-[10.5px] text-muted-foreground">
        <p className="my-0 pb-2">peak / median magnitude of the exact state at step 4,096 (the paper&apos;s Figure 6, in miniature)</p>
        <div className="space-y-1.5">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-40 shrink-0">{b.label}</span>
              <div className="h-2.5 flex-1 rounded-sm bg-muted/40">
                <div className="h-2.5 rounded-sm bg-sky-600/80 dark:bg-sky-400/80" style={{ width: `${((b.v / barMax) * 100).toFixed(1)}%` }} />
              </div>
              <span className="w-12 text-right tabular-nums text-foreground">{b.v.toFixed(1)}x</span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
