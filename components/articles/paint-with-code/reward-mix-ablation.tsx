"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The ablation the original write-up could only ask for.
//
// Three adapters are published on the Hub: watercolour-grpo-{judge-led,
// hps-led, hps-only}. The Hub API (`?blobs=true`) and each repo's
// adapter_config.json, checked directly rather than taken from either post,
// say all three are LoRA over the identical base (Qwen/Qwen3.5-35B-A3B), rank
// 16, alpha 32, dropout 0, the identical 17-entry `all-linear` target-module
// set (serialized in a different order per repo — a Python set has no
// guaranteed iteration order — but the same set once sorted), and an
// adapter_model.safetensors of the identical size, 121,864,672 bytes, in
// every repo. The sha256 of that file differs in all three: same
// architecture, same size, three genuinely different trained weights. The
// only thing that was ever meant to move is the split between the two
// model-judge weights, and the Hub confirms nothing else did.
//
// Reward curves are step-bucketed means of the `reward` column in
// results/curve-{run}.csv (HuggingEnvs/02-watercolour), downsampled from
// 60/110/110 raw steps to 12/14/14 points by averaging, not smoothed beyond
// that. x is the real step number, not a fraction of each run's own length,
// so hps-only's shorter line is visibly shorter rather than stretched to
// match — it really was stopped at step 60, the other two at 110 of a
// 200-step launch.
//
// Correlation between the two model-judge terms is computed here from the
// same CSVs' judge_mean/quality_mean group-mean columns — a number neither
// post reports. It is a coarser measurement than the original article's
// n_eff section: that one compared five judges scoring the *same* images at
// a fixed checkpoint. This compares two per-step group means across a run
// where the policy is changing, so raw correlation is inflated by the trend
// both curves share (both climb as training proceeds) — shown alongside the
// correlation of step-to-step deltas, which removes that shared trend and is
// the fairer read.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type RunKey = "judge-led" | "hps-led" | "hps-only"

type Run = {
  judge: number
  quality: number
  launched: number
  stopped: number
  firstThird: number
  finalThird: number
  slopeT: number
  color: string
  verdict: string
  curve: number[]
}

const RUNS: Record<RunKey, Run> = {
  "judge-led": {
    judge: 0.6,
    quality: 0.3,
    launched: 200,
    stopped: 110,
    firstThird: 0.45,
    finalThird: 0.72,
    slopeT: 10.5,
    color: GOOD,
    verdict:
      "the most diverse and artistically interesting of the three, by the author's own verdict — and the split Narreddi's write-up converged on",
    curve: [0.489, 0.412, 0.394, 0.477, 0.524, 0.586, 0.675, 0.643, 0.706, 0.682, 0.73, 0.732, 0.721, 0.73],
  },
  "hps-led": {
    judge: 0.3,
    quality: 0.6,
    launched: 200,
    stopped: 110,
    firstThird: 0.57,
    finalThird: 0.82,
    slopeT: 15.6,
    color: ACCENT,
    verdict: "convincing watercolours, but the best ones share a soft, wet-on-wet look that reads as almost a house style",
    curve: [0.521, 0.515, 0.577, 0.603, 0.674, 0.725, 0.77, 0.731, 0.755, 0.809, 0.803, 0.809, 0.812, 0.845],
  },
  "hps-only": {
    judge: 0.0,
    quality: 0.9,
    launched: 60,
    stopped: 60,
    firstThird: 0.58,
    finalThird: 0.71,
    slopeT: 6.41,
    color: WARM,
    verdict: "converges hardest — most of its paintings settle on the same handful of colours. The validation run, not a style choice.",
    curve: [0.565, 0.502, 0.655, 0.594, 0.6, 0.598, 0.678, 0.67, 0.67, 0.671, 0.726, 0.773],
  },
}

const ORDER: RunKey[] = ["judge-led", "hps-led", "hps-only"]

// judge_mean vs quality_mean, group means per step, from the published CSVs.
// hps-only has no judge term (weight 0), so there is nothing to correlate.
const CORR: Partial<Record<RunKey, { raw: number; detrended: number }>> = {
  "judge-led": { raw: 0.762, detrended: 0.456 },
  "hps-led": { raw: 0.68, detrended: 0.136 },
}

// n_eff for k = 2 equally-weighted signals at correlation rho — the same
// closed form the article's first widget uses at k = 5.
const nEff2 = (rho: number) => 2 / (1 + rho)

const MAX_STEP = 110

export function RewardMixAblation() {
  const [sel, setSel] = useState<RunKey>("judge-led")
  const run = RUNS[sel]

  const W = 720
  const CH = 150
  const X0 = 40
  const X1 = 692
  const Y0 = 18
  const Y1 = 118
  const SX = (step: number) => X0 + (step / MAX_STEP) * (X1 - X0)
  const SY = (v: number) => Y1 - v * (Y1 - Y0)

  const path = (k: RunKey) => {
    const r = RUNS[k]
    const n = r.curve.length
    let d = ""
    r.curve.forEach((v, i) => {
      const step = (i / (n - 1)) * r.stopped
      d += `${i === 0 ? "M" : "L"} ${SX(step).toFixed(2)} ${SY(v).toFixed(2)} `
    })
    return d
  }

  const maxW = 0.9 // hps-only's quality weight, the largest single term across all three runs

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen/Qwen3.5-35B-A3B · r=16 α=32 · same 17-module target set · 121,864,672-byte adapter, three different
          files
        </span>
        <span className="font-mono text-[10px]" style={{ color: run.color }}>
          the only variable: judge : quality
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSel(k)}
              aria-pressed={sel === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={sel === k ? { borderColor: `${RUNS[k].color}66` } : undefined}
            >
              {k} · {RUNS[k].judge.toFixed(2)}/{RUNS[k].quality.toFixed(2)}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-right font-mono text-[10px] text-foreground">pairwise judge</span>
            <div className="h-4 flex-1 rounded-sm bg-muted/40">
              <div
                className="h-4 rounded-sm"
                style={{ width: `${(run.judge / maxW) * 100}%`, background: run.color, opacity: 0.9 }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: run.color }}>
              {run.judge.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-right font-mono text-[10px] text-foreground">HPSv3 slot</span>
            <div className="h-4 flex-1 rounded-sm bg-muted/40">
              <div
                className="h-4 rounded-sm"
                style={{ width: `${(run.quality / maxW) * 100}%`, background: run.color, opacity: 0.55 }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: run.color }}>
              {run.quality.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${CH}`} width={W} height={CH} role="img" className="min-w-[600px] max-w-full">
            <title>
              Group-mean reward per step for all three runs, plotted against the real step number. hps-only stops at
              step 60; judge-led and hps-led were launched for 200 and stopped at 110, still climbing.
            </title>
            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            {[0, 0.5, 1].map((v) => (
              <g key={v}>
                <line x1={X0 - 4} y1={SY(v)} x2={X1} y2={SY(v)} stroke="currentColor" strokeOpacity={0.1} />
                <text x={X0 - 7} y={SY(v) + 3} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            {[0, 60, 110].map((s) => (
              <text key={s} x={SX(s)} y={Y1 + 13} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                {s}
              </text>
            ))}
            <text x={X1} y={13} fontSize={8.5} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              group-mean reward, by step
            </text>

            {ORDER.filter((k) => k !== sel).map((k) => (
              <path key={k} d={path(k)} fill="none" stroke={RUNS[k].color} strokeWidth={1.2} strokeOpacity={0.35} />
            ))}
            <path d={path(sel)} fill="none" stroke={run.color} strokeWidth={2.4} strokeOpacity={0.95} />
            <circle cx={SX(run.stopped)} cy={SY(run.finalThird)} r={4} fill={run.color} />
          </svg>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">steps</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: run.color }}>
              {run.stopped} / {run.launched}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {run.stopped === run.launched ? "ran to completion" : "stopped early, still climbing"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">first → final third</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: run.color }}>
              {run.firstThird.toFixed(2)} → {run.finalThird.toFixed(2)}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">Δ {(run.finalThird - run.firstThird).toFixed(2)} mean group reward</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">reward slope</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: run.color }}>
              t = +{run.slopeT.toFixed(1)}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">frac_reward_zero_std = 0.000 throughout</div>
          </div>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what it produced — </span>
          {run.verdict}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            how redundant are the two judges now? judge_mean vs quality_mean, per-step group means
          </div>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {(Object.keys(CORR) as RunKey[]).map((k) => {
              const c = CORR[k]!
              return (
                <div key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px]">
                  <span style={{ color: RUNS[k].color }}>{k}</span>
                  <span className="text-muted-foreground">
                    ρ<sub>raw</sub> {c.raw.toFixed(2)} → n<sub>eff</sub> {nEff2(c.raw).toFixed(2)}
                  </span>
                  <span className="text-foreground">
                    ρ<sub>detrended</sub> {c.detrended.toFixed(2)} → n<sub>eff</sub> {nEff2(c.detrended).toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
            detrended = correlation of step-to-step deltas, which removes the trend both curves share simply from
            training proceeding
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The naive number looks almost like the original rubric&rsquo;s cluster: raw correlation between the two
          model-judge terms sits at 0.68 to 0.76 across the runs that carry both, which by the same{" "}
          <span className="font-mono text-[11px] text-foreground">n = 2 / (1 + ρ)</span> arithmetic used above is
          worth barely more than one opinion. But most of that number is the two curves climbing together as the
          policy improves, not the two judges agreeing about any one picture — strip the shared trend out and the
          correlation drops to 0.14–0.46, and{" "}
          <span className="text-foreground">
            n<sub>eff</sub> rises to 1.4–1.8 out of a possible 2
          </span>
          .
          <br />
          <br />
          The stronger evidence is not a correlation coefficient at all. It is that moving the split from 0.60/0.30
          to 0.30/0.60 to 0.00/0.90 changed the shape of three otherwise-identical training runs and the paintings
          at the end of them — a converged, one-palette validation run; a reliable, wet-on-wet house style; and the
          most diverse set of the three. Two terms that were truly one opinion restated would have produced one
          outcome no matter how the weight moved between them. They did not.
        </p>
      </div>
    </figure>
  )
}
