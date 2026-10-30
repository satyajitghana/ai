"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { FUNNEL, NF_TOTAL_NEURONS } from "./data"

// The five stages of neuron-finder's default run, with the counts that go through each one. The counts are read from
// the repository's own result files (one run, "calm", and the median over 46 runs); the stage descriptions are read
// from neuron_finder.py at commit 38ae049. Nothing here was re-run on the 4B model.

type Stage = {
  id: string
  name: string
  count: number
  unit: string
  what: string
  cost: string
  tag: "read from code" | "reported by the repository"
}

const STAGES: Stage[] = [
  {
    id: "pairs",
    name: "1 · pairs",
    count: 48,
    unit: "replies",
    what: "The model answers 24 everyday prompts twice, once under the persona's system prompt and once without it. The model writes both sides of every pair, so the contrast is on-policy.",
    cost: "48 short generations",
    tag: "read from code",
  },
  {
    id: "screen",
    name: "2 · screen",
    count: NF_TOTAL_NEURONS,
    unit: "neurons scored",
    what: "Every MLP neuron gets a read score (does it fire more on the persona's replies, in units of its natural spread?) and a write score (the gradient of log p(persona reply) minus log p(plain reply), projected on its down_proj column). No steering happens yet.",
    cost: "about 30 s on an RTX 3090 (README)",
    tag: "reported by the repository",
  },
  {
    id: "shortlist",
    name: "3 · shortlist",
    count: FUNNEL.candidates,
    unit: "neurons",
    what: "The top 30 of each score list, plus the top 2 of each list in every layer from 15% to 95% of the depth (late layers have larger scores and would crowd out the early ones), plus 16 random neurons as a null. The median over the 46 published runs is 165.5 distinct candidates.",
    cost: "a sort",
    tag: "read from code",
  },
  {
    id: "steer",
    name: "4 · steer",
    count: FUNNEL.settings,
    unit: "settings",
    what: "Each candidate is pushed at three doses (0.8, 1.5, 2.5 residual norms) with the sign its screen gave. Each setting gets 8 sampled replies at temperature 0.8 and one judge call. The 48 control settings (16 random neurons at the same doses) set the bar.",
    cost: "4,296 sampled replies and 537 judge calls (489 candidate settings and 48 control settings, 8 replies each)",
    tag: "read from code",
  },
  {
    id: "confirm",
    name: "5 · confirm",
    count: FUNNEL.confirmed,
    unit: "settings",
    what: "The five best settings get 32 fresh replies under a new seed. The winner is called found if at least 3 in 8 of its replies are hits and its rate beats the 95th percentile of the random neurons; partial if it only beats them; not found otherwise.",
    cost: "160 replies and 5 judge calls",
    tag: "read from code",
  },
]

const ACCENT = "oklch(0.62 0.16 35)"
const STREAM = "oklch(0.60 0.15 255)"

function fmt(n: number) {
  return n.toLocaleString("en-US")
}

export function FinderPipeline() {
  const [i, setI] = useState(1)
  const stage = STAGES[i]
  const maxLog = mlog10(NF_TOTAL_NEURONS)
  const W = 560
  const BH = 26
  const GAP = 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">neuron-finder · one default run · log scale</span>
        <span className="font-mono text-[10px] text-muted-foreground">{stage.tag}</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${STAGES.length * (BH + GAP) + 4}`} role="img" className="h-auto w-full">
          <title>
            A funnel on a log scale. 48 replies make the pairs, 294,912 neurons are scored, 163 are shortlisted, 489
            settings are steered, 5 are confirmed and 1 neuron is reported.
          </title>
          {STAGES.map((s, k) => {
            const w = Math.max(8, ((mlog10(Math.max(1, s.count)) + 0.2) / (maxLog + 0.2)) * (W - 190))
            const y = k * (BH + GAP) + 2
            const on = k === i
            return (
              <g key={s.id} onClick={() => setI(k)} className="cursor-pointer">
                <text x={0} y={y + BH / 2 + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={on ? 0.95 : 0.55}>
                  {s.name}
                </text>
                <rect x={96} y={y} width={w} height={BH} rx={4} fill={on ? ACCENT : STREAM} fillOpacity={on ? 0.9 : 0.35} />
                <text x={96 + w + 8} y={y + BH / 2 + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={on ? 0.95 : 0.6}>
                  {fmt(s.count)}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Pipeline stage">
          {STAGES.map((s, k) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={k === i}
              onClick={() => setI(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                k === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm leading-relaxed">
          <p>
            <span className="font-medium">{fmt(stage.count)}</span> <span className="text-muted-foreground">{stage.unit}</span>
          </p>
          <p className="mt-1.5">{stage.what}</p>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">cost: {stage.cost}</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          294,912 is 32 layers of 9,216 neurons, the Qwen3.5-4B this tool defaults to. The bar lengths are logarithms, so each step down is
          roughly a factor of 10 to 1,000, not a few pixels.
        </p>
      </div>
    </figure>
  )
}
