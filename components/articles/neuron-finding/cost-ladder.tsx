"use client"

import { mlog10 } from "@/lib/dmath"

import { CPU_RUNS } from "./cpu-data"

// How many sampled replies each way of finding a neuron spends, on a log scale. The neuron-finder figure is its
// default run (489 candidate settings and 48 control settings at 8 replies, plus 5 confirms at 32), read from its
// published result files. The persona-library figure is the page's own count. The two exhaustive sweeps are
// arithmetic: every neuron, the dose count each protocol uses, 8 replies.

const ACCENT = "oklch(0.62 0.16 35)"
const STREAM = "oklch(0.60 0.15 255)"
const MUTE = "oklch(0.55 0.02 255)"

type Bar = { label: string; value: number; kind: "measured" | "reported" | "reasoned"; color: string }

const cpuMean = CPU_RUNS.length
  ? Math.round(CPU_RUNS.reduce((a, r) => a + r.timing.steer_screen_sequences + r.confirmed.length * 32, 0) / CPU_RUNS.length)
  : 0

const BARS: Bar[] = [
  { label: "our CPU re-run, one target", value: cpuMean, kind: "measured", color: ACCENT },
  { label: "neuron-finder, one target", value: 4456, kind: "reported", color: STREAM },
  { label: "persona library, Qwen3-8B", value: 884736, kind: "reported", color: MUTE },
  { label: "sweep Qwen3-0.6B, 2 doses", value: 86016 * 2 * 8, kind: "reasoned", color: MUTE },
  { label: "sweep Qwen3.5-4B, 3 doses", value: 294912 * 3 * 8, kind: "reasoned", color: MUTE },
]

function fmt(n: number) {
  return n.toLocaleString("en-US")
}

export function CostLadder() {
  const W = 600
  const L = 190
  const BH = 24
  const GAP = 12
  const lo = 2
  const hi = 7.2
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">sampled replies spent · log scale</span>
        <span className="font-mono text-[10px] text-muted-foreground">measured · reported · reasoned</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${BARS.length * (BH + GAP)}`} role="img" className="h-auto w-full">
          <title>
            {"Bars on a log scale: " + BARS.map((b) => `${b.label}, ${fmt(b.value)} replies (${b.kind})`).join("; ") + "."}
          </title>
          {BARS.map((b, i) => {
            const w = Math.max(4, ((mlog10(Math.max(1, b.value)) - lo) / (hi - lo)) * (W - L - 110))
            const y = i * (BH + GAP)
            return (
              <g key={b.label}>
                <text x={0} y={y + BH / 2 + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.75}>
                  {b.label}
                </text>
                <rect x={L} y={y} width={w} height={BH} rx={3} fill={b.color} fillOpacity={0.85} />
                <text x={L + w + 6} y={y + BH / 2 + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.8}>
                  {fmt(b.value)}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="mt-2 text-xs text-muted-foreground">
          The axis is logarithmic. A full sweep of Qwen3.5-4B with neuron-finder&apos;s own protocol would spend about 1,600 times what its
          screen-and-shortlist run does; the screens are what make the left two bars possible.
        </p>
      </div>
    </figure>
  )
}
