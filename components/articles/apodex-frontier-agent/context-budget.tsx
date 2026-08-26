"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why fanning out beats one long loop, in the one currency that matters.
//
// A ReAct agent accumulates. Every page it reads, every command it runs, every
// error it recovers from stays in the same context for the rest of the task, so
// the context grows linearly with the work and the model spends the back half of
// a long task reasoning over a transcript mostly made of things it already dealt
// with. Past the window it is worse than slow — something has to be discarded,
// and the agent does not know which parts it will need.
//
// Agent Team changes the shape rather than the size. Each sub-agent gets a
// bounded assignment and its own fresh context, and returns a structured report.
// The coordinator never sees the raw observations — only k reports. Both the
// worst sub-agent context and the coordinator context stay flat in total work,
// as long as k grows with it.
//
// This is a model with a stated arithmetic, not a measurement: Apodex publishes
// scores, not context traces. The 262,144-token line is real — it is the
// deployment context length in the model card.

const ACCENT = "oklch(0.60 0.15 255)"
const GOOD = "oklch(0.55 0.16 155)"
const WARM = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"

const LIMIT = 262144
const SYS = 4000 // system prompt + tool schemas
const REPORT = 1800 // a structured sub-agent report

export function ContextBudget() {
  const [steps, setSteps] = useState(120)
  const [obs, setObs] = useState(2400)
  const [k, setK] = useState(5)
  const [show, setShow] = useState<"context" | "wall">("context")

  const reactPeak = SYS + steps * obs
  const perAgent = Math.ceil(steps / k)
  const subPeak = SYS + perAgent * obs
  const coordPeak = SYS + k * REPORT + steps * 12 // + a task-board line per step
  const teamPeak = Math.max(subPeak, coordPeak)

  const STEP_S = 6 // seconds per step, illustrative
  const reactWall = steps * STEP_S
  const teamWall = perAgent * STEP_S + k * 4 + 40 // fan-out, collection, synthesis

  const W = 700
  const H = 150
  const X0 = 128
  const MAXC = Math.max(reactPeak, teamPeak, LIMIT) * 1.06
  const MAXW = Math.max(reactWall, teamWall) * 1.06
  const pxC = (v: number) => X0 + (v / MAXC) * (W - X0 - 78)
  const pxW = (v: number) => X0 + (v / MAXW) * (W - X0 - 78)

  const fmtK = (v: number) => `${Math.round(v / 1000)}k`
  const fmtT = (v: number) => (v >= 60 ? `${Math.floor(v / 60)}m ${Math.round(v % 60)}s` : `${Math.round(v)}s`)

  const bars =
    show === "context"
      ? [
          { l: "ReAct — one context", v: reactPeak, c: reactPeak > LIMIT ? BAD : ACCENT, sub: `${steps} steps × ${fmtK(obs)} tokens` },
          { l: "Team — worst sub-agent", v: subPeak, c: subPeak > LIMIT ? BAD : GOOD, sub: `${perAgent} steps each` },
          { l: "Team — coordinator", v: coordPeak, c: coordPeak > LIMIT ? BAD : WARM, sub: `${k} reports of ${fmtK(REPORT)}` },
        ]
      : [
          { l: "ReAct — serial", v: reactWall, c: ACCENT, sub: `${steps} steps, one at a time` },
          { l: "Team — fanned out", v: teamWall, c: GOOD, sub: `${perAgent} steps deep, ${k} wide, plus synthesis` },
        ]

  const px = show === "context" ? pxC : pxW
  const fmt = show === "context" ? fmtK : fmtT

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one long-horizon task, {steps} tool steps of real work
        </span>
        <span className="font-mono text-[10px]" style={{ color: reactPeak > LIMIT ? BAD : GOOD }}>
          {reactPeak > LIMIT
            ? `ReAct overflows the window by ${fmtK(reactPeak - LIMIT)} tokens`
            : `both fit — ReAct at ${Math.round((reactPeak / LIMIT) * 100)}% of the window`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["context", "peak context"],
              ["wall", "wall clock"],
            ] as const
          ).map(([kk, label]) => (
            <button
              key={kk}
              type="button"
              onClick={() => setShow(kk)}
              aria-pressed={show === kk}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                show === kk
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
              {show === "context"
                ? `Peak context for three agents on a ${steps}-step task. The single ReAct context reaches ${fmtK(reactPeak)} tokens; the worst Agent Team sub-agent reaches ${fmtK(subPeak)} and the coordinator ${fmtK(coordPeak)}, against a ${fmtK(LIMIT)}-token deployment window.`
                : `Wall clock for the same task. Serial ReAct takes ${fmtT(reactWall)}; the fanned-out Agent Team takes ${fmtT(teamWall)}.`}
            </title>

            {show === "context" ? (
              <>
                <line x1={pxC(LIMIT)} y1={6} x2={pxC(LIMIT)} y2={H - 34} stroke={BAD} strokeDasharray="3 3" strokeOpacity={0.7} />
                <text x={pxC(LIMIT)} y={H - 22} fontSize={7.5} textAnchor="middle" fill={BAD} fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                  262,144 — the deployed window
                </text>
              </>
            ) : null}

            {bars.map((b, i) => {
              const y = 12 + i * 40
              return (
                <g key={b.l}>
                  <text x={X0 - 10} y={y + 12} fontSize={8.5} textAnchor="end" fill={b.c} fontFamily="ui-monospace, monospace">
                    {b.l}
                  </text>
                  <text x={X0 - 10} y={y + 22} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    {b.sub}
                  </text>
                  <rect x={px(0)} y={y + 2} width={Math.max(2, px(b.v) - px(0))} height={18} rx={3} fill={b.c} fillOpacity={0.75} />
                  <text x={px(b.v) + 7} y={y + 15} fontSize={9} fill={b.c} fontFamily="ui-monospace, monospace">
                    {fmt(b.v)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["tool steps", steps, setSteps, 10, 400, 5, ACCENT, "how many tool calls the whole task takes"],
              ["tokens / step", obs, setObs, 200, 8000, 100, WARM, "how much text one observation returns"],
              ["sub-agents", k, setK, 1, 10, 1, GOOD, "how wide the coordinator fans the work out"],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={v}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          a model of the two schedules, not a trace — the 262,144 window is the real deployment
          figure from the model card
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The ReAct bar is not merely bigger, it grows with the task. Every page read and every
          recovered error stays in the same context for the rest of the run, so a long job spends its
          back half reasoning over a transcript largely made of things it already finished with.
          Push the steps slider right and it crosses the window —{" "}
          <span style={{ color: BAD }}>at which point something has to be discarded</span>, and the
          agent has no principled way to know which part it will need in an hour.
          <br />
          <br />
          Fanning out does not make the total work smaller. It changes which agent has to hold it.
          Each sub-agent sees a bounded slice and returns a structured report; the coordinator sees{" "}
          <span className="text-foreground">k reports, never the raw observations</span>. Both bars
          stay flat as long as you widen k with the task — which is also why the wall-clock tab
          barely resembles the context tab, and why the two arguments for the Team harness are
          genuinely separate. Raising k buys latency <em>and</em>{" "}buys headroom, and only one of
          those is what the benchmark deltas are measuring.
        </p>
      </div>
    </figure>
  )
}
