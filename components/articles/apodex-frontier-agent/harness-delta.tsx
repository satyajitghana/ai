"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Apodex publishes three rows per benchmark, which is rarer than it should be:
// the previous model, the new model in a single-agent ReAct loop, and the new
// model in the Agent Team harness. Same weights in rows two and three.
//
// That means the gap between them is a measurement of the harness, isolated
// from the model — and it turns out to be a large fraction of what the release
// reports. On BioMysteryBench the harness moves the score further than the
// entire model upgrade does.
//
// Every number is read from Apodex's own benchmark charts (the model card and
// the FrontierAgent README carry the same figures). The splits and shares below
// are computed from them here.

const BASE = "oklch(0.72 0.07 250)"
const MODEL = "oklch(0.60 0.15 255)"
const HARNESS = "oklch(0.55 0.16 155)"
const RIVAL = "oklch(0.68 0.13 85)"

type Bench = {
  name: string
  domain: string
  prev?: number
  react: number
  team: number
  rival: number
  rivalName: string
}

const FULL: Bench[] = [
  { name: "APEX-Agents", domain: "professional work", prev: 16.5, react: 34.4, team: 38.5, rival: 42.3, rivalName: "Claude Opus 5" },
  { name: "GDPval", domain: "professional work", prev: 59.3, react: 69.5, team: 78.8, rival: 89.4, rivalName: "Claude Opus 5" },
  { name: "FrontierFinance", domain: "finance", prev: 40.3, react: 48.7, team: 54.3, rival: 49.2, rivalName: "Claude Fable 5" },
  { name: "FrontierScience-Research", domain: "scientific research", prev: 28.3, react: 55.0, team: 63.3, rival: 55.0, rivalName: "DeepSeek V4 Flash" },
  { name: "BioMysteryBench", domain: "human-difficult science", prev: 17.6, react: 23.5, team: 35.3, rival: 49.4, rivalName: "Claude Opus 5" },
  { name: "Humanity's Last Exam", domain: "reasoning + search", prev: 49.0, react: 53.2, team: 56.1, rival: 64.7, rivalName: "Claude Opus 5" },
]

const MINI: Bench[] = [
  { name: "APEX-Agent", domain: "professional work", react: 24.2, team: 27.7, rival: 27.9, rivalName: "Kimi K2.6" },
  { name: "FrontierFinance", domain: "finance", react: 40.0, team: 50.2, rival: 49.2, rivalName: "Claude Fable 5" },
  { name: "FrontierScience-Research", domain: "scientific research", react: 45.0, team: 51.7, rival: 55.0, rivalName: "DeepSeek V4 Flash" },
]

export function HarnessDelta() {
  const [tier, setTier] = useState<"full" | "mini">("full")
  const rows = tier === "full" ? FULL : MINI

  const shares = rows
    .filter((r) => r.prev !== undefined)
    .map((r) => (r.team - r.react) / (r.team - (r.prev as number)))
  const meanShare = shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null
  const beats = rows.filter((r) => r.team > r.rival).length

  const W = 700
  const ROW_H = 34
  const H = rows.length * ROW_H + 40
  const X0 = 176
  const MAXV = 100
  const px = (v: number) => X0 + (v / MAXV) * (W - X0 - 34)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          same weights, two harnesses — the gap is the harness
        </span>
        <span className="font-mono text-[10px]" style={{ color: HARNESS }}>
          {meanShare !== null
            ? `${Math.round(meanShare * 100)}% of the 1.0 → 1.1 gain is the harness`
            : `Agent Team leads ReAct on all ${rows.length}`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["full", "Apodex-1.1 · flagship"],
              ["mini", "Apodex-1.1-mini · 36B open weights"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTier(k)}
              aria-pressed={tier === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tier === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Stacked bars for ${rows.length} benchmarks. Each bar shows the previous model's score, the increment from the new model in a ReAct loop, and the further increment from running the same weights in the Agent Team harness, with a marker for the strongest competing system. Agent Team beats that marker on ${beats} of ${rows.length}.`}
            </title>

            {rows.map((r, i) => {
              const y = 8 + i * ROW_H
              const prev = r.prev ?? 0
              const modelGain = r.react - prev
              const harnessGain = r.team - r.react
              const beat = r.team > r.rival
              return (
                <g key={r.name}>
                  <text x={X0 - 10} y={y + 12} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    {r.name}
                  </text>
                  <text x={X0 - 10} y={y + 22} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    {r.domain}
                  </text>

                  {r.prev !== undefined ? (
                    <rect x={px(0)} y={y + 3} width={Math.max(1, px(prev) - px(0))} height={15} rx={3} fill={BASE} fillOpacity={0.6} />
                  ) : null}
                  <rect
                    x={px(prev)}
                    y={y + 3}
                    width={Math.max(1, px(r.react) - px(prev))}
                    height={15}
                    rx={3}
                    fill={MODEL}
                    fillOpacity={0.75}
                  />
                  <rect
                    x={px(r.react)}
                    y={y + 3}
                    width={Math.max(1, px(r.team) - px(r.react))}
                    height={15}
                    rx={3}
                    fill={HARNESS}
                    fillOpacity={0.85}
                  />
                  {/* the total goes in a fixed right-hand column: at high scores the
                      bar end and the competitor marker sit on top of each other */}
                  <text x={W - 2} y={y + 14} fontSize={9} textAnchor="end" fill={HARNESS} fontFamily="ui-monospace, monospace">
                    {r.team.toFixed(1)}
                  </text>

                  {/* the strongest competing system */}
                  <line x1={px(r.rival)} y1={y} x2={px(r.rival)} y2={y + 22} stroke={RIVAL} strokeWidth={1.4} strokeOpacity={0.85} />
                  <text
                    x={px(r.rival) + 4}
                    y={y + 29}
                    fontSize={7}
                    fill={RIVAL}
                    fillOpacity={0.85}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.rivalName} {r.rival.toFixed(1)}
                    {beat ? " — passed" : ""}
                  </text>

                  {harnessGain > 4 ? (
                    <text
                      x={(px(r.react) + px(r.team)) / 2}
                      y={y + 14}
                      fontSize={7.5}
                      textAnchor="middle"
                      fill="#fff"
                      fontFamily="ui-monospace, monospace"
                    >
                      +{harnessGain.toFixed(1)}
                    </text>
                  ) : null}
                  {modelGain > 8 ? (
                    <text
                      x={(px(prev) + px(r.react)) / 2}
                      y={y + 14}
                      fontSize={7.5}
                      textAnchor="middle"
                      fill="#fff"
                      fontFamily="ui-monospace, monospace"
                    >
                      +{modelGain.toFixed(1)}
                    </text>
                  ) : null}
                </g>
              )
            })}

            <line x1={X0} y1={H - 26} x2={W - 34} y2={H - 26} stroke="currentColor" strokeOpacity={0.2} />
            {[0, 25, 50, 75, 100].map((t) => (
              <text key={t} x={px(t)} y={H - 14} fontSize={7.5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                {t}
              </text>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ["Apodex 1.0", BASE],
              ["+ the 1.1 model, ReAct", MODEL],
              ["+ the Agent Team harness", HARNESS],
              ["strongest competitor", RIVAL],
            ] as const
          ).map(([label, colour]) => (
            <span key={label} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: colour }} />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Rows two and three are the same checkpoint. Nothing about the weights differs between
          them — only the scaffolding the weights run inside, and whether the coordinator is allowed
          to fan work out to bounded sub-agents instead of doing it in one long loop. So the green
          segment is a rare thing: a{" "}
          <span className="text-foreground">measurement of a harness, with the model held fixed</span>.
          <br />
          <br />
          Across the six flagship benchmarks it averages about{" "}
          <span style={{ color: HARNESS }}>40% of the total gain</span>{" "}from 1.0 to 1.1. On
          BioMysteryBench it is <span style={{ color: HARNESS }}>+11.8</span>{" "}against{" "}
          <span style={{ color: MODEL }}>+5.9</span>{" "}for the entire model upgrade — the harness
          contributes twice what the new weights do. Note also where the yellow markers sit: Agent
          Team passes the strongest competing system on two of six, and on GDPval and BioMysteryBench
          it is not close. This is a good open model with an unusually good harness, not a frontier
          model.
        </p>
      </div>
    </figure>
  )
}
