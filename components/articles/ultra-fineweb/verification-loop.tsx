"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The two problems the pipeline exists to solve, and why they are the same
// problem.
//
// The technical report frames model-driven filtering as having two unsolved
// issues, and both are about cost rather than accuracy:
//
//   1. There is no efficient way to verify a filtering decision. The ground truth
//      for "is this data good" is "does training on it help", and finding that out
//      normally means a training run — so decisions get made on proxies and nobody
//      closes the loop.
//   2. Seed data selection for the classifier is subjective. A quality classifier
//      needs positive and negative examples, and where those come from is usually
//      "human expertise".
//
// The second is unsolvable without the first. Once verification is cheap enough to
// run repeatedly, seed selection stops being a judgement call and becomes a search
// — you can try a seed set, measure what it does, and adjust.
//
// The classifier being fastText is the other half of the same argument. A filter
// has to run over a trillion tokens; an LLM-based classifier costing a forward
// pass per document is not a filter, it is a second pretraining run. Make the
// expensive part rare and the cheap part fast.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Mode = "naive" | "ultra"

const MODES: Record<Mode, { label: string; steps: { l: string; sub: string; cost: "high" | "low"; c: string }[]; loop: string; note: string }> = {
  naive: {
    label: "the loop nobody closes",
    steps: [
      { l: "pick seed data", sub: "by human judgement", cost: "low", c: MUTED },
      { l: "train a classifier", sub: "on that seed set", cost: "low", c: MUTED },
      { l: "filter the corpus", sub: "over a trillion tokens", cost: "high", c: WARM },
      { l: "pretrain a model", sub: "the only real ground truth", cost: "high", c: WARM },
      { l: "evaluate", sub: "and now you know", cost: "low", c: MUTED },
    ],
    loop: "one iteration costs a pretraining run",
    note: "The ground truth for 'is this data good' is 'does training on it help'. Establishing that the honest way means a full run, so in practice the loop is closed once, or never — and the seed set that determined everything was chosen by taste at step one.",
  },
  ultra: {
    label: "with a cheap verification strategy",
    steps: [
      { l: "propose seed data", sub: "positive and negative candidates", cost: "low", c: ACCENT },
      { l: "verify cheaply", sub: "rapid evaluation of the effect on training", cost: "low", c: GOOD },
      { l: "optimize the seed set", sub: "now a search, not a judgement call", cost: "low", c: GOOD },
      { l: "train a fastText classifier", sub: "lightweight by necessity", cost: "low", c: ACCENT },
      { l: "filter the corpus", sub: "1T+ tokens, once", cost: "high", c: WARM },
    ],
    loop: "the first three steps iterate; only the last one is expensive",
    note: "A verification strategy cheap enough to run repeatedly turns filter design from a one-shot guess into a search. Seed selection — the step that was 'human expertise' — becomes something you can optimize, because you can now measure what a seed set does before committing a trillion tokens to it.",
  },
}

export function VerificationLoop() {
  const [mode, setMode] = useState<Mode>("ultra")
  const m = MODES[mode]

  const W = 720
  const H = 122
  const BW = 128
  const GAP = 14

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">{m.loop}</span>
        <span className="font-mono text-[10px]" style={{ color: mode === "ultra" ? GOOD : WARM }}>
          {m.steps.filter((s) => s.cost === "high").length} expensive step
          {m.steps.filter((s) => s.cost === "high").length > 1 ? "s" : ""} per iteration
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MODES) as Mode[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {MODES[k].label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              A five-stage filtering loop, with the expensive stages marked. In the naive version two stages cost a
              full training run; with a cheap verification strategy only the final corpus pass is expensive.
            </title>
            {m.steps.map((s, i) => {
              const x = 6 + i * (BW + GAP)
              return (
                <g key={s.l}>
                  <rect
                    x={x}
                    y={26}
                    width={BW}
                    height={50}
                    rx={6}
                    fill={s.c}
                    fillOpacity={s.cost === "high" ? 0.2 : 0.1}
                    stroke={s.c}
                    strokeOpacity={s.cost === "high" ? 0.9 : 0.45}
                    strokeWidth={s.cost === "high" ? 1.75 : 1}
                  />
                  <text x={x + BW / 2} y={46} fontSize={9.5} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {s.l}
                  </text>
                  <foreignObject x={x + 4} y={50} width={BW - 8} height={22}>
                    <div style={{ fontSize: "7.5px", lineHeight: "10px", textAlign: "center", fontFamily: "ui-monospace, monospace", opacity: 0.55 }}>
                      {s.sub}
                    </div>
                  </foreignObject>
                  {s.cost === "high" ? (
                    <text x={x + BW / 2} y={20} fontSize={8} fill={WARM} textAnchor="middle" fontFamily="ui-monospace, monospace">
                      expensive
                    </text>
                  ) : null}
                  {i < m.steps.length - 1 ? (
                    <polygon points={`${x + BW + 10},51 ${x + BW + 3},47 ${x + BW + 3},55`} fill="currentColor" fillOpacity={0.35} />
                  ) : null}
                </g>
              )
            })}

            {/* the iteration arc */}
            {mode === "ultra" ? (
              <>
                <path
                  d={`M${6 + 2 * (BW + GAP) + BW / 2},76 L${6 + 2 * (BW + GAP) + BW / 2},96 L${6 + BW / 2},96 L${6 + BW / 2},76`}
                  fill="none"
                  stroke={GOOD}
                  strokeWidth={1.75}
                />
                <polygon points={`${6 + BW / 2},78 ${6 + BW / 2 - 4},86 ${6 + BW / 2 + 4},86`} fill={GOOD} />
                <text x={6 + BW + GAP + BW / 2} y={110} fontSize={9} fill={GOOD} textAnchor="middle" fontFamily="ui-monospace, monospace">
                  iterate here, cheaply
                </text>
              </>
            ) : (
              <>
                <path
                  d={`M${6 + 4 * (BW + GAP) + BW / 2},76 L${6 + 4 * (BW + GAP) + BW / 2},96 L${6 + BW / 2},96 L${6 + BW / 2},76`}
                  fill="none"
                  stroke={WARM}
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                />
                <polygon points={`${6 + BW / 2},78 ${6 + BW / 2 - 4},86 ${6 + BW / 2 + 4},86`} fill={WARM} />
                <text x={W / 2} y={110} fontSize={9} fill={WARM} textAnchor="middle" fontFamily="ui-monospace, monospace">
                  the only honest loop runs through a pretraining run — so it runs once, or never
                </text>
              </>
            )}
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">{m.note}</div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two stated problems look independent and are not. Seed selection is subjective{" "}
          <em>because</em>{" "}verification is expensive: nobody chooses seed data by taste when they could measure
          it instead. Make the loop cheap and the second problem dissolves into the first.
          <br />
          <br />
          The fastText choice is the same argument at the other end. A filter has to run over a trillion tokens,
          so an LLM-based classifier costing a forward pass per document{" "}
          <span className="text-foreground">is not a filter, it is a second pretraining run</span>. The design is
          consistent throughout: make the expensive part rare, make the frequent part cheap, and put the loop
          around the cheap part.
        </p>
      </div>
    </figure>
  )
}
