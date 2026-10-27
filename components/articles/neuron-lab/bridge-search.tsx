"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { BRIDGES, BRIDGE_SAMPLES, CANDIDATES, CONTROLS, DOSES } from "./data"

// Both widgets draw the numbers in data.ts, which are the output of scripts/neuron-lab/data_discover.py for the
// "talk about bridges and landmarks" axis on Qwen3-0.6B. Nothing here is interpolated or invented.

const ACCENT = "oklch(0.65 0.16 55)"
const GREY = "oklch(0.6 0.04 255)"

const STEPS = [
  { n: "58,368", label: "neurons of layers 8 to 26, ranked by how differently they fire on 16 bridge texts and 30 other texts", w: 100 },
  { n: "6 of 40", label: "of the 40 strongest in the first half of the texts kept their sign and |d'| above 1 on the second half", w: 52 },
  { n: "6", label: "best candidates (of 32 screened) taken to a dose sweep next to 6 random neurons", w: 34 },
  { n: "1", label: "worked: L23 N1505 pushed down at dose 0.5, with perplexity 38.0 against 21.5", w: 14 },
  { n: "0", label: "pairs of working neurons (there was only one to pair)", w: 3 },
]

export function BridgeFunnel() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        finding a bridge neuron in Qwen3-0.6B: what survived each test (measured; bar lengths are schematic)
      </div>
      <div className="space-y-2 px-4 py-3">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className="w-14 shrink-0 text-right font-mono tabular-nums">{s.n}</span>
            <div className="h-5 flex-1">
              <div className="h-full rounded-sm" style={{ width: `${s.w}%`, background: i === 3 ? ACCENT : GREY, opacity: i === 4 ? 0.4 : 1 }} />
            </div>
          </div>
        ))}
        <ol className="space-y-1 pt-1 text-xs leading-5 text-muted-foreground">
          {STEPS.map((s, i) => (
            <li key={i}>
              <span className="font-mono text-foreground">{s.n}</span> {s.label}.
            </li>
          ))}
        </ol>
        <p className="text-xs leading-5 text-muted-foreground">
          For scale: a random neuron in layers 8 to 26 has a mean |d&apos;| of {BRIDGES.randomMeanAbsD} and a 99th percentile of {BRIDGES.randomP99AbsD}; the largest of all was {BRIDGES.maxAbsD}. The best screening lifts were {BRIDGES.stage1CandidateBestLifts.slice(0, 2).join(" and ")} bridge words per 100 words; the best of 32 random neurons got {BRIDGES.stage1ControlBestLift}.
        </p>
      </div>
    </figure>
  )
}

export function BridgeSweep() {
  const [i, setI] = useState(5)
  const [who, setWho] = useState(0)
  const dose = DOSES[i]
  const cand = CANDIDATES[who]
  const best = Math.max(...CONTROLS.map((c) => c.lift[i]))
  const works = cand.lift[i] >= 3 && cand.lift[i] > best && cand.ppl[i] <= 3 * BRIDGES.baselinePpl
  const W = 520
  const H = 150
  const x = (k: number) => 34 + (k / (DOSES.length - 1)) * (W - 60)
  const yl = (v: number) => H - 24 - (v / 8) * (H - 44)
  const yp = (v: number) => H - 24 - ((v - 15) / 50) * (H - 44)
  const path = (vals: number[], f: (v: number) => number) => vals.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)} ${f(v).toFixed(1)}`).join(" ")
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        dose sweep: bridge words gained per 100 words, with random neurons beside it (measured, greedy, 5 prompts x 40 tokens)
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Candidate neuron">
          {CANDIDATES.map((c, k) => (
            <button key={k} role="tab" aria-selected={k === who} onClick={() => setWho(k)} className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", k === who ? "border-foreground bg-muted" : "text-muted-foreground hover:text-foreground")}>
              L{c.layer} N{c.neuron}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Lift by dose for L${cand.layer} N${cand.neuron}: ${cand.lift.join(", ")}; random neurons stay near zero.`}>
          {[0, 2, 4, 6, 8].map((v) => (
            <g key={v}>
              <line x1={34} x2={W - 26} y1={yl(v)} y2={yl(v)} stroke="currentColor" opacity={0.1} />
              <text x={28} y={yl(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>{v}</text>
            </g>
          ))}
          <line x1={34} x2={W - 26} y1={yl(3)} y2={yl(3)} stroke={ACCENT} strokeDasharray="4 3" opacity={0.6} />
          <text x={W - 26} y={yl(3) - 3} textAnchor="end" fontSize={9} fill={ACCENT}>needs 3</text>
          {CONTROLS.map((c, k) => (
            <path key={k} d={path(c.lift, yl)} fill="none" stroke={GREY} strokeWidth={1} opacity={0.5} />
          ))}
          <path d={path(cand.lift, yl)} fill="none" stroke={ACCENT} strokeWidth={2.2} />
          {DOSES.map((d, k) => (
            <g key={d}>
              <circle cx={x(k)} cy={yl(cand.lift[k])} r={k === i ? 5 : 3} fill={ACCENT} />
              <text x={x(k)} y={H - 8} textAnchor="middle" fontSize={9} fill="currentColor" opacity={k === i ? 1 : 0.6}>{d}</text>
            </g>
          ))}
          <path d={path(cand.ppl, yp)} fill="none" stroke="oklch(0.6 0.16 295)" strokeWidth={1.4} strokeDasharray="2 3" />
        </svg>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-12 shrink-0 font-mono text-muted-foreground">dose</span>
          <Range className="w-full" min={0} max={DOSES.length - 1} step={1} value={i} onChange={(e) => setI(+e.target.value)} accent={ACCENT} aria-label="Dose" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{dose}</span>
        </label>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">L{cand.layer} N{cand.neuron} lift at dose {dose}</dt>
          <dd className="text-right font-mono tabular-nums">{cand.lift[i]}</dd>
          <dt className="text-muted-foreground">best of the 6 random neurons at this dose</dt>
          <dd className="text-right font-mono tabular-nums">{best}</dd>
          <dt className="text-muted-foreground">perplexity (unsteered {BRIDGES.baselinePpl})</dt>
          <dd className="text-right font-mono tabular-nums">{cand.ppl[i]}</dd>
          <dt className="text-muted-foreground">passes all three tests</dt>
          <dd className="text-right font-mono">{works ? "yes" : "no"}</dd>
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          The dashed violet line is perplexity (scale 15 to 65). Pushing any neuron harder makes the text worse; the question is whether the words you wanted arrive first. For this neuron they do, but only at dose 0.5, where the held-out perplexity has already risen from {BRIDGES.baselinePpl} to {CANDIDATES[0].ppl[5]}.
        </p>
        <div className="space-y-2 border-t pt-3 text-xs leading-5">
          {BRIDGE_SAMPLES.map((s) => (
            <div key={s.prompt}>
              <div className="font-mono text-muted-foreground">&ldquo;{s.prompt}&rdquo;</div>
              <div><span className="text-muted-foreground">unsteered:</span> {s.baseline}</div>
              <div><span className="text-muted-foreground">L23 N1505 at 0.5:</span> {s.steered}</div>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
