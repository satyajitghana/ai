"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Nine reward signals, and how many opinions they actually contained.
//
// The post gives three hard facts about the first rubric and leaves the rest of
// the weights unstated:
//
//   - four quality judges plus prompt adherence correlated with each other at
//     0.85 to 0.95
//   - code length contributed "roughly a third of the total reward" and had
//     saturated by step thirty, producing zero gradient afterward
//   - HPSv3, "the one signal showing real variance", was weighted at 0.10
//
// Those three facts are enough to reconstruct the shape. For k equally-weighted
// signals with common pairwise correlation rho, the effective number of
// independent signals is the standard equicorrelation result:
//
//   n_eff = k / (1 + (k - 1) * rho)
//
// At k = 5 and rho = 0.90 that is 5 / 4.6 = 1.087. Across the stated 0.85-0.95
// band it runs from 1.04 to 1.14. Five judges were worth roughly one opinion.
//
// The two binary gates' weights are not published, so they are a slider here.
// Everything downstream of them is arithmetic.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type State = "dead" | "cluster" | "live"

const STATE_META: Record<State, { l: string; c: string }> = {
  dead: { l: "no gradient after step 30", c: WARM },
  cluster: { l: "one opinion, stated five times", c: MUTED },
  live: { l: "the only independent signal left", c: GOOD },
}

const NEW_RUBRIC = [
  { l: "compiles and uses p5.brush", w: 0.05, kind: "binary gate", c: MUTED },
  { l: "length check", w: 0.05, kind: "binary gate", c: MUTED },
  { l: "HPSv3", w: 0.3, kind: "human preference model", c: GOOD },
  { l: "pairwise judge against the reference pool", w: 0.6, kind: "wins against two sampled references", c: ACCENT },
]

export function RedundantRubric() {
  const [rho, setRho] = useState(90)
  const [gate, setGate] = useState(5)
  const [tab, setTab] = useState<"old" | "new">("old")

  const g = gate / 100
  const LENGTH = 0.33
  const HPS = 0.1
  const judgeTotal = Math.max(0, 1 - LENGTH - HPS - 2 * g)
  const perJudge = judgeTotal / 5

  const r = rho / 100
  const nEff = 5 / (1 + 4 * r)

  const dead = LENGTH + 2 * g
  const distinctOpinions = nEff + 1

  const OLD = [
    { l: "compilation gate", w: g, s: "dead" as State, note: "binary, and the model compiles reliably within a few dozen steps" },
    { l: "uses p5.brush, not native p5", w: g, s: "dead" as State, note: "binary, same story" },
    { l: "code length ramp → ~3,000 tokens", w: LENGTH, s: "dead" as State, note: "saturated by step 30 — a third of the reward, producing nothing" },
    { l: "prompt adherence (GPT-5.4 + Gemini council)", w: perJudge, s: "cluster" as State, note: "correlated 0.85–0.95 with the four below" },
    { l: "recognisability", w: perJudge, s: "cluster" as State, note: "correlated 0.85–0.95 with the rest of the cluster" },
    { l: "aesthetics", w: perJudge, s: "cluster" as State, note: "correlated 0.85–0.95 with the rest of the cluster" },
    { l: "technique", w: perJudge, s: "cluster" as State, note: "correlated 0.85–0.95 with the rest of the cluster" },
    { l: "depth", w: perJudge, s: "cluster" as State, note: "correlated 0.85–0.95 with the rest of the cluster" },
    { l: "HPSv3", w: HPS, s: "live" as State, note: "the one signal showing real variance — weighted at a tenth" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          n<sub>eff</sub> = k / (1 + (k−1)ρ) — the effective number of independent signals
        </span>
        <span className="font-mono text-[10px]" style={{ color: tab === "old" ? WARM : GOOD }}>
          {tab === "old" ? `${distinctOpinions.toFixed(2)} distinct opinions` : "4 signals, none redundant"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["old", "the first rubric — nine signals"],
              ["new", "the second — four"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tab === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === "old" ? (
          <>
            <div className="mt-3 space-y-1">
              {OLD.map((x) => (
                <div key={x.l} className="flex items-center gap-2">
                  <span className="w-56 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.l}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div
                      className="h-4 rounded-sm"
                      style={{
                        width: `${x.w * 100}%`,
                        background: STATE_META[x.s].c,
                        opacity: x.s === "dead" ? 0.45 : x.s === "cluster" ? 0.6 : 0.95,
                      }}
                    />
                  </div>
                  <span
                    className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums"
                    style={{ color: STATE_META[x.s].c }}
                  >
                    {x.w.toFixed(2)}
                  </span>
                  <span className="hidden w-56 shrink-0 truncate font-mono text-[9px] text-muted-foreground lg:inline">
                    {x.note}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {(Object.keys(STATE_META) as State[]).map((k) => (
                <span key={k} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                  <span
                    className="inline-block h-2 w-3 rounded-sm"
                    style={{ background: STATE_META[k].c, opacity: k === "dead" ? 0.45 : k === "cluster" ? 0.6 : 0.95 }}
                  />
                  {STATE_META[k].l}
                </span>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="w-32 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                  judge correlation ρ
                </span>
                <Range
                  min={85}
                  max={95}
                  step={1}
                  value={rho}
                  onChange={(e) => setRho(Number(e.target.value))}
                  className="flex-1"
                  aria-label="pairwise correlation among the five quality judges"
                  accent={MUTED}
                />
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {(rho / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-32 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                  each binary gate
                </span>
                <Range
                  min={1}
                  max={15}
                  step={1}
                  value={gate}
                  onChange={(e) => setGate(Number(e.target.value))}
                  className="flex-1"
                  aria-label="weight assigned to each binary gate"
                  accent={ACCENT}
                />
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {g.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
              ρ is the reported 0.85–0.95 band · the two binary gates&rsquo; weights are not published, so they are a
              slider; everything downstream of them is arithmetic
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">dead weight</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
                  {(dead * 100).toFixed(0)}%
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">of the reward, gradient-free after step 30</div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">five judges are worth</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: MUTED }}>
                  {nEff.toFixed(2)}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">independent signals, at ρ = {(rho / 100).toFixed(2)}</div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">distinct opinions total</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
                  {distinctOpinions.toFixed(2)}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">
                  weighted {judgeTotal.toFixed(2)} : {HPS.toFixed(2)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-1">
              {NEW_RUBRIC.map((x) => (
                <div key={x.l} className="flex items-center gap-2">
                  <span className="w-56 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.l}</span>
                  <div className="h-5 flex-1 rounded-sm bg-muted/40">
                    <div className="h-5 rounded-sm" style={{ width: `${x.w * 100}%`, background: x.c, opacity: 0.9 }} />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                    {x.w.toFixed(2)}
                  </span>
                  <span className="hidden w-56 shrink-0 truncate font-mono text-[9px] text-muted-foreground lg:inline">
                    {x.kind}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { l: "same base model", v: "same", note: "and the same training data" },
                { l: "to the old plateau", v: "3× faster", note: "then kept climbing past it" },
                { l: "code length", v: "13.5k → <2k", note: "the model learned verbosity did not help" },
              ].map((x) => (
                <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
                  <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
                    {x.v}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground">{x.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 font-mono text-[9px] text-muted-foreground">
              weights sum to {NEW_RUBRIC.reduce((a, b) => a + b.w, 0).toFixed(2)} · the two binary gates are worth a
              tenth between them, and 90% of the reward is two genuinely different opinions about the picture
            </div>
          </>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The post reports the correlation and leaves the arithmetic implicit, and the arithmetic is the part worth
          having. For <span className="font-mono text-[11px] text-foreground">k</span>{" "}signals sharing a common
          pairwise correlation <span className="font-mono text-[11px] text-foreground">ρ</span>, the effective
          number of independent ones is{" "}
          <span className="font-mono text-[11px] text-foreground">k / (1 + (k−1)ρ)</span>. Drag ρ across the
          reported 0.85–0.95 band and the five judges never rise above{" "}
          <span className="text-foreground">1.14</span>{" "}independent signals or fall below 1.04.{" "}
          <em>Five judges were worth one opinion.</em>
          <br />
          <br />
          Put that next to the other two facts and the whole rubric collapses. A third of the reward stopped
          producing gradient at step 30 and stayed in the sum anyway. The five-judge cluster — one opinion, five
          times — carried {(judgeTotal * 100).toFixed(0)}% of the weight. The one measurement that disagreed with
          it was weighted {HPS.toFixed(2)}.{" "}
          <span className="text-foreground">A model optimizing that objective is being told one thing loudly, a
          second thing at a whisper, and nothing at all with the rest</span>{" "}— which is a fair description of a
          flat, clip-art flower with five rounded petals.
        </p>
      </div>
    </figure>
  )
}
