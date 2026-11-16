"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { poisson, rng } from "./rng"

// From an electrode array to the vector an adapter reads, and the control that
// decides whether "the neurons" separate the cues or the device does.
//
// Shape taken from BioLLM's published viewer-status.json: 64 electrode slots,
// seven driven channels (12, 18, 22, 24, 36, 38, 46 on culture 149), spikes
// counted in 15 bins over 50-1050 ms after the cue, one mean count per
// channel, three symbols. Everything else is a toy: the cultures, rates and
// decoding accuracies below are simulated with a seeded PRNG, not their data.

const CHANNELS = [12, 18, 22, 24, 36, 38, 46]
const BINS = 15
const SYMBOLS = ["A", "B", "C"] as const
const TRIALS_PER = 30
const BASE = [1.1, 0.7, 1.4, 0.9, 1.2, 0.6, 1.0]
// how each symbol reshapes the per-channel rates when the neurons respond
const PATTERN = [
  [0.9, -0.4, 0.2, -0.5, 0.6, 0.1, -0.3],
  [-0.5, 0.8, -0.3, 0.6, -0.2, -0.4, 0.5],
  [0.1, -0.3, 0.7, 0.2, -0.5, 0.8, -0.2],
]
// the array-wide shift each symbol's stimulation adds (charge, artefact)
const SHIFT = [0, 0.55, 1.1]

type Trial = { s: number; raster: number[][]; feat: number[]; mean: number; grid: number[] }

function simulate(neural: number, device: number): Trial[] {
  const r = rng(149)
  const out: Trial[] = []
  for (let s = 0; s < 3; s++) {
    for (let t = 0; t < TRIALS_PER; t++) {
      const raster: number[][] = []
      const feat: number[] = []
      for (let c = 0; c < CHANNELS.length; c++) {
        const lam = Math.max(0.05, BASE[c] * (1 + neural * PATTERN[s][c]) + device * SHIFT[s]) / BINS
        const row: number[] = []
        let sum = 0
        for (let b = 0; b < BINS; b++) {
          const k = Math.min(3, poisson(r, lam * 4))
          row.push(k)
          sum += k
        }
        raster.push(row)
        feat.push(sum / BINS)
      }
      // the other 57 slots: undriven, low activity plus the same array-wide shift
      const grid: number[] = []
      for (let e = 0; e < 64; e++) {
        const i = CHANNELS.indexOf(e)
        grid.push(i >= 0 ? feat[i] : poisson(r, (0.25 + device * SHIFT[s]) * 2) / 8)
      }
      const mean = grid.reduce((a, b) => a + b, 0) / 64
      out.push({ s, raster, feat, mean, grid })
    }
  }
  return out
}

// leave-one-out nearest centroid; returns accuracy
function decode(trials: Trial[], pick: (t: Trial) => number[]) {
  let ok = 0
  const xs = trials.map(pick)
  for (let i = 0; i < trials.length; i++) {
    const cent: number[][] = [[], [], []]
    const cnt = [0, 0, 0]
    for (let j = 0; j < trials.length; j++) {
      if (j === i) continue
      const s = trials[j].s
      const x = xs[j]
      if (!cent[s].length) cent[s] = x.map(() => 0)
      for (let k = 0; k < x.length; k++) cent[s][k] += x[k]
      cnt[s] += 1
    }
    let best = 0
    let bestD = Infinity
    for (let s = 0; s < 3; s++) {
      let d = 0
      for (let k = 0; k < xs[i].length; k++) {
        const diff = xs[i][k] - cent[s][k] / cnt[s]
        d += diff * diff
      }
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    if (best === trials[i].s) ok += 1
  }
  return ok / trials.length
}

const TEAL = "oklch(0.70 0.12 185)"
const ORANGE = "oklch(0.70 0.15 55)"

export function MeaPipeline() {
  const [neuralPct, setNeuralPct] = useState(0)
  const [devicePct, setDevicePct] = useState(70)
  const [sym, setSym] = useState(1)
  const [trial, setTrial] = useState(3)

  const neural = neuralPct / 100
  const device = devicePct / 100
  const trials = useMemo(() => simulate(neural, device), [neural, device])
  const accChan = useMemo(() => decode(trials, (t) => t.feat), [trials])
  const accMean = useMemo(() => decode(trials, (t) => [t.mean]), [trials])
  const cur = trials[sym * TRIALS_PER + trial]

  const chanAbove = accChan > 0.45
  const meanAtChance = accMean < 0.45
  const verdict = !chanAbove
    ? "Nothing separates the symbols."
    : meanAtChance
      ? "Per-channel pattern separates the symbols and the array mean does not: the rule allows “from the neurons”."
      : "The array mean alone separates the symbols: the rule only allows “the device signal separates the symbols”."

  const gmax = Math.max(0.8, ...cur.grid)
  const fmax = 1.2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          electrodes → spike bins → one vector · simulated culture
        </span>
        <div className="flex gap-1">
          {SYMBOLS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setSym(i)}
              aria-pressed={sym === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sym === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              cue {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[auto_1fr_auto]">
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">64 electrode slots</div>
          <svg viewBox="0 0 136 136" className="h-36 w-36" role="img" aria-label="Electrode grid coloured by spike count; the seven driven channels are outlined">
            {cur.grid.map((v, e) => {
              const x = (e % 8) * 17 + 2
              const y = Math.floor(e / 8) * 17 + 2
              const driven = CHANNELS.includes(e)
              return (
                <rect
                  key={e}
                  x={x}
                  y={y}
                  width={14}
                  height={14}
                  rx={3}
                  fill={TEAL}
                  fillOpacity={0.08 + 0.85 * Math.min(1, v / gmax)}
                  stroke={driven ? "currentColor" : "none"}
                  strokeWidth={1.2}
                />
              )
            })}
          </svg>
        </div>

        <div className="min-w-0">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">
            driven channels · 15 bins, 50 to 1050 ms after the cue
          </div>
          <svg viewBox="0 0 330 150" className="w-full" role="img" aria-label="Spike raster of the seven driven channels">
            {cur.raster.map((row, c) => (
              <g key={c}>
                <text x={0} y={c * 20 + 15} className="fill-muted-foreground font-mono" fontSize={9}>
                  ch{CHANNELS[c]}
                </text>
                <line x1={32} x2={328} y1={c * 20 + 12} y2={c * 20 + 12} stroke="currentColor" strokeOpacity={0.08} />
                {row.map((k, b) =>
                  Array.from({ length: k }, (_, j) => (
                    <line
                      key={`${b}-${j}`}
                      x1={34 + b * 19.6 + j * 4}
                      x2={34 + b * 19.6 + j * 4}
                      y1={c * 20 + 5}
                      y2={c * 20 + 18}
                      stroke={ORANGE}
                      strokeWidth={1.6}
                    />
                  )),
                )}
              </g>
            ))}
          </svg>
          <label className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            trial
            <Range min={0} max={TRIALS_PER - 1} value={trial} onChange={(e) => setTrial(Number(e.target.value))} className="w-40" />
            {trial + 1} of {TRIALS_PER}
          </label>
        </div>

        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">feature z (mean count)</div>
          <svg viewBox="0 0 120 150" className="h-36 w-28" role="img" aria-label="Per-channel feature vector and the array mean">
            {cur.feat.map((v, c) => (
              <g key={c}>
                <rect x={0} y={c * 18 + 4} width={Math.max(1, (v / fmax) * 90)} height={11} rx={2} fill={ORANGE} fillOpacity={0.8} />
                <text x={94} y={c * 18 + 13} className="fill-muted-foreground font-mono" fontSize={8}>
                  {v.toFixed(2)}
                </text>
              </g>
            ))}
            <rect x={0} y={134} width={Math.max(1, (cur.mean / fmax) * 90)} height={11} rx={2} fill={TEAL} />
            <text x={94} y={143} className="fill-muted-foreground font-mono" fontSize={8}>
              mean
            </text>
          </svg>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          <span>
            neurons respond to the cue: <b className="text-foreground">{neuralPct}%</b>
          </span>
          <Range min={0} max={100} value={neuralPct} onChange={(e) => setNeuralPct(Number(e.target.value))} accent={ORANGE} />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          <span>
            array-wide shift from the stimulus itself: <b className="text-foreground">{devicePct}%</b>
          </span>
          <Range min={0} max={100} value={devicePct} onChange={(e) => setDevicePct(Number(e.target.value))} accent={TEAL} />
        </label>
      </div>

      <div className="border-t px-4 py-3 font-mono text-[11px]">
        <div className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2">
          <span className="text-muted-foreground">per-channel z</span>
          <div className="h-2.5 rounded bg-muted/40">
            <div className="h-2.5 rounded" style={{ width: `${(accChan * 100).toFixed(1)}%`, background: ORANGE }} />
          </div>
          <span>{(accChan * 100).toFixed(0)}%</span>
          <span className="text-muted-foreground">array mean only</span>
          <div className="h-2.5 rounded bg-muted/40">
            <div className="h-2.5 rounded" style={{ width: `${(accMean * 100).toFixed(1)}%`, background: TEAL }} />
          </div>
          <span>{(accMean * 100).toFixed(0)}%</span>
        </div>
        <p className="mt-2 text-muted-foreground">
          Which of 3 cues was sent, leave-one-out over 90 simulated trials (chance 33%). {verdict}
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Illustrative. The layout (64 slots, seven driven channels, 15 bins, one mean per channel, three symbols) follows
        BioLLM&apos;s published results file; the spikes and accuracies are simulated here. Start with the neurons at 0%
        and the shift at 70%: both decoders separate the cues, and none of it comes from a neuron.
      </figcaption>
    </figure>
  )
}
