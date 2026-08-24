"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A fixed end-to-end budget, split three ways.
//
// Kaplan and Chinchilla both answer the same question — given a training
// budget, pick N and D — and both treat the model as finished once it is
// trained. Two later results break that assumption from opposite ends:
// Sardana et al. (arXiv:2401.00448) put serving cost into the objective, and
// Roberts et al. (arXiv:2604.01411) put the number of samples drawn at
// inference into it, jointly optimising N, D and k under one end-to-end budget
// and finding the optimum sits well inside the over-training regime.
//
// The surface below is illustrative, not fitted. It is built from three honest
// component behaviours — loss falls as a power law in N and in D, and pass@k
// rises as 1 − (1 − p)^k — so the qualitative moves are right even though the
// constants are invented. Every readout is labelled as such.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const PRESETS = [
  { k: "chinchilla", label: "Chinchilla", nShare: 50, samples: 0, note: "training-optimal: split the budget evenly between N and D, one sample" },
  { k: "serving", label: "inference-aware", nShare: 26, samples: 0, note: "Sardana et al.: shrink N, buy D, because serving is paid per parameter" },
  { k: "t2", label: "T² (2026)", nShare: 18, samples: 62, note: "Roberts et al.: hold back budget for samples at inference, and over-train harder" },
] as const

export function ThirdAxis() {
  const [nShare, setNShare] = useState(50)
  const [samples, setSamples] = useState(0)
  const [preset, setPreset] = useState<string | null>("chinchilla")

  // One budget, in arbitrary units, split three ways.
  const inferShare = samples / 200 // up to 50% of the budget goes to sampling
  const trainShare = 1 - inferShare
  const n = trainShare * (nShare / 100)
  const d = trainShare * (1 - nShare / 100)

  // component behaviours, illustrative
  const lossFromN = mpow(Math.max(n, 1e-4), -0.076)
  const lossFromD = mpow(Math.max(d, 1e-4), -0.095)
  const loss = 1.6 - 0.5 * (1 / lossFromN) - 0.5 * (1 / lossFromD)
  // a single-sample success probability that improves as loss falls
  const p1 = Math.min(0.92, Math.max(0.02, 1.15 - loss))
  const k = 1 + Math.round((samples / 100) * 24)
  const passK = 1 - mpow(1 - p1, k)

  const W = 700
  const H = 132

  const bar = (x: number, w: number, colour: string, label: string, sub: string) => (
    <g key={label}>
      <rect x={x} y={26} width={Math.max(0, w)} height={34} rx={5} fill={colour} fillOpacity={0.75} />
      {w > 58 ? (
        <>
          <text x={x + w / 2} y={47} fontSize={10} textAnchor="middle" fill="#fff" fontFamily="ui-monospace, monospace">
            {label}
          </text>
          <text x={x + w / 2} y={74} fontSize={8.5} textAnchor="middle" fill={colour} fontFamily="ui-monospace, monospace">
            {sub}
          </text>
        </>
      ) : null}
    </g>
  )

  const X0 = 20
  const BW = W - 40

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one end-to-end budget, split across parameters, tokens and samples
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          pass@{k} = {(passK * 100).toFixed(1)}%
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.k}
              type="button"
              onClick={() => {
                setNShare(p.nShare)
                setSamples(p.samples)
                setPreset(p.k)
              }}
              aria-pressed={preset === p.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                preset === p.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              A single budget bar split into three coloured segments: parameters, training tokens,
              and samples drawn at inference. Moving the sliders moves budget between them.
            </title>
            <text x={X0} y={16} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              total budget
            </text>
            {bar(X0, BW * n, ACCENT, "parameters N", `${(n * 100).toFixed(0)}% of budget`)}
            {bar(X0 + BW * n, BW * d, WARM, "tokens D", `${(d * 100).toFixed(0)}%`)}
            {bar(X0 + BW * (n + d), BW * inferShare, GOOD, `samples k=${k}`, `${(inferShare * 100).toFixed(0)}%`)}

            <line x1={X0} y1={92} x2={X0 + BW} y2={92} stroke="currentColor" strokeOpacity={0.15} />
            <text x={X0} y={110} fontSize={9} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              tokens per parameter, implied:{" "}
              <tspan fill={WARM}>{n > 0 ? (20 * (d / Math.max(n, 1e-6))).toFixed(0) : "—"}</tspan>
            </text>
            <text x={X0 + BW} y={110} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              illustrative — the shape is the claim, not the digits
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              training split → N
            </span>
            <Range
              min={5}
              max={80}
              step={1}
              value={nShare}
              onChange={(e) => {
                setNShare(Number(e.target.value))
                setPreset(null)
              }}
              className="flex-1"
              aria-label="how much of the training budget goes to parameters rather than tokens"
              accent={ACCENT}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{nShare}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              held for sampling
            </span>
            <Range
              min={0}
              max={100}
              step={2}
              value={samples}
              onChange={(e) => {
                setSamples(Number(e.target.value))
                setPreset(null)
              }}
              className="flex-1"
              aria-label="how much of the end-to-end budget is spent drawing samples at inference"
              accent={GOOD}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              k={k}
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "loss (lower better)", v: loss.toFixed(3), c: ACCENT },
            { l: "one sample succeeds", v: `${(p1 * 100).toFixed(1)}%`, c: WARM },
            { l: `any of ${k} succeeds`, v: `${(passK * 100).toFixed(1)}%`, c: GOOD },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          {preset ? PRESETS.find((p) => p.k === preset)!.note : "custom split"}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Kaplan and Chinchilla answer the same question — given a training budget, choose N and D —
          and both treat a model as finished the moment it stops training. That was a fair
          assumption when a model answered once per question.
          <br />
          <br />
          It is not one now. Once you are allowed to draw{" "}
          <span className="font-mono text-[11px] text-foreground">k</span>{" "}samples and keep the best,
          some of the budget should never reach the training run at all — and the model you train
          with what is left should be{" "}
          <span className="text-foreground">smaller and more over-trained</span>{" "}than either earlier
          law would tell you, because a cheap model is what makes drawing twenty samples affordable.
          The line never broke. It grew an axis, and the axis pushes in the same direction the
          serving bill was already pushing.
        </p>
      </div>
    </figure>
  )
}
