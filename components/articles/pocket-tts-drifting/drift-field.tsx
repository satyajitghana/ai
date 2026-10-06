"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { DATA, DATA_SPREAD, STEPS, readout, simulate } from "./drift-sim"

// A 2-D toy of the drifting field. Gold diamonds are data, blue dots are the
// generator's samples. Each training step every sample moves along
// V = attraction to data - repulsion from its siblings, with the kernel
// exp(-d / tau) on per-frame normalised distances. The reader picks a fixed
// tau, or lets tau learn from a start value, and scrubs through training.
// See drift-sim.ts for the exact computation.

const VIEW = 400
const PAD = 14
const sx = (v: number) => Math.round((PAD + (v / 10) * (VIEW - 2 * PAD)) * 100) / 100
const sy = (v: number) => Math.round((PAD + ((10 - v) / 10) * (VIEW - 2 * PAD)) * 100) / 100

// slider position 0..100 -> tau on a log scale from 0.01 to 20
const TAU_MIN = 0.01
const TAU_MAX = 20
const toTau = (p: number) =>
  Math.round(mexp(mlog(TAU_MIN) + (p / 100) * (mlog(TAU_MAX) - mlog(TAU_MIN))) * 1000) / 1000
const toPos = (t: number) =>
  Math.round(((mlog(t) - mlog(TAU_MIN)) / (mlog(TAU_MAX) - mlog(TAU_MIN))) * 100)

const PRESETS: { label: string; mode: "fixed" | "learned"; tau: number }[] = [
  { label: "fixed 0.02 (too tight)", mode: "fixed", tau: 0.02 },
  { label: "fixed 0.3", mode: "fixed", tau: 0.3 },
  { label: "fixed 10 (too wide)", mode: "fixed", tau: 10 },
  { label: "learned from 0.05", mode: "learned", tau: 0.05 },
  { label: "learned from 1.0", mode: "learned", tau: 1 },
]

const GEN = "#2f6fd6"
const DAT = "#c9a227"

function fmt(v: number, d = 2) {
  return v.toFixed(d)
}

export function DriftField() {
  const [mode, setMode] = useState<"fixed" | "learned">("fixed")
  const [pos, setPos] = useState(toPos(0.3))
  const [step, setStep] = useState(STEPS)
  const [playing, setPlaying] = useState(false)
  const tau0 = toTau(pos)

  // a run is ~160 field evaluations; defer it so the slider stays responsive
  const tauRun = useDeferredValue(tau0)
  const run = useMemo(() => simulate(mode, tauRun), [mode, tauRun])
  const cur = run[step]
  const r = readout(cur.x)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS) {
          setPlaying(false)
          return s
        }
        return Math.min(STEPS, s + 2)
      })
    }, 50)
    return () => clearInterval(id)
  }, [playing])

  const stalled = cur.vrms < 0.001 && r.miss > 1
  const verdict = stalled
    ? "stalled: the samples only see each other, so the field is zero and nothing moves"
    : r.miss < 0.45 && r.spread > 0.8 * DATA_SPREAD
      ? "covered: every cluster has samples on it"
      : r.spread < 0.5 * DATA_SPREAD
        ? "one blob: the samples still move as a lump, data uncovered"
        : "partly covered"

  // trails: every 8th step for each sample, up to the current step
  const trails = cur.x.map((_, i) => {
    const pts: string[] = []
    for (let s = 0; s <= step; s += 8) pts.push(`${sx(run[s].x[i][0])},${sy(run[s].x[i][1])}`)
    pts.push(`${sx(cur.x[i][0])},${sy(cur.x[i][1])}`)
    return pts.join(" ")
  })

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-drift-field={`${mode}-${tau0}-${step}`}
      aria-label="A two-dimensional toy of the drifting field: generated samples drift toward three clusters of data under a kernel whose temperature you choose"
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b px-4 py-4">
        <div>
          <span className="font-mono text-xs text-muted-foreground">kernel temperature</span>
          <div className="mt-2 flex gap-2">
            {(["fixed", "learned"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-sm border px-2.5 py-0.5 font-mono text-xs",
                  mode === m
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "fixed" ? "fixed τ" : "learned τ"}
              </button>
            ))}
          </div>
        </div>
        <label className="block min-w-[12rem] flex-1">
          <span className="font-mono text-xs text-muted-foreground">
            {mode === "fixed" ? "τ" : "τ at step 0"} = {tau0}
          </span>
          <Range
            min={0}
            max={100}
            step={1}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="kernel temperature, log scale from 0.01 to 20"
          />
        </label>
        <label className="block min-w-[12rem] flex-1">
          <span className="font-mono text-xs text-muted-foreground">
            training step {step} / {STEPS}
          </span>
          <Range
            min={0}
            max={STEPS}
            step={1}
            value={step}
            onChange={(e) => {
              setPlaying(false)
              setStep(Number(e.target.value))
            }}
            className="mt-2 w-full"
            aria-label="training step"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (step >= STEPS) setStep(0)
            setPlaying((p) => !p)
          }}
          className="rounded-sm border px-2.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          {playing ? "pause" : "play from here"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setMode(p.mode)
              setPos(toPos(p.tau))
              setStep(0)
              setPlaying(true)
            }}
            className="rounded-sm border px-2.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="mx-auto w-full max-w-[26rem] rounded-sm bg-muted/30"
          role="img"
          aria-label={`Step ${step}: ${verdict}`}
        >
          {trails.map((t, i) => (
            <polyline key={`t${i}`} points={t} fill="none" stroke={GEN} strokeOpacity={0.18} strokeWidth={1} />
          ))}
          {DATA.map(([x, y], i) => (
            <rect
              key={`d${i}`}
              x={sx(x) - 4.5}
              y={sy(y) - 4.5}
              width={9}
              height={9}
              transform={`rotate(45 ${sx(x)} ${sy(y)})`}
              fill={DAT}
            />
          ))}
          {cur.x.map(([x, y], i) => {
            const [mx, my] = cur.move[i]
            const ex = Math.round((sx(x + 3 * mx)) * 100) / 100
            const ey = Math.round((sy(y + 3 * my)) * 100) / 100
            return (
              <g key={`g${i}`}>
                <line x1={sx(x)} y1={sy(y)} x2={ex} y2={ey} stroke={GEN} strokeWidth={1.4} strokeOpacity={0.7} />
                <circle cx={sx(x)} cy={sy(y)} r={4.2} fill={GEN} />
              </g>
            )
          })}
        </svg>

        <dl className="grid content-start gap-3 font-mono text-xs">
          <div>
            <dt className="text-muted-foreground">τ at this step</dt>
            <dd className="text-base tabular-nums">{fmt(cur.tau, 3)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">miss (data → nearest sample)</dt>
            <dd className="text-base tabular-nums">{fmt(r.miss)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">sample spread (data: {fmt(DATA_SPREAD)})</dt>
            <dd className="text-base tabular-nums">{fmt(r.spread)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">field RMS</dt>
            <dd className="text-base tabular-nums">{fmt(cur.vrms, 3)}</dd>
          </div>
          <p className="leading-relaxed text-muted-foreground">{verdict}</p>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Gold diamonds are 36 fixed data points in three clusters; the 36 blue dots are generated samples, which
        start as one tight blob. Each step, every sample moves along the drifting field (the short line is three
        steps of it): pulled toward data, pushed from its siblings, with weights from a kernel exp(−d / τ) on
        distances divided by their mean. No network: the samples move directly, which is the move the loss asks
        the network to make. A toy, so the numbers are its own, not Kyutai&apos;s.
      </figcaption>
    </figure>
  )
}
