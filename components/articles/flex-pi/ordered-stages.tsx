"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Why eight ordered stages punish a policy so much harder than one.
//
// The self-repair task is a robot fixing its own gripper across eight stages that
// must complete in order, split between two arms, with the tightest insertion
// near the end. Flex-pi in full joint mode finishes all eight in 11 of 20
// rollouts. The best baseline manages it once.
//
// 11/20 against 1/20 is an 11x gap in end-to-end success, which sounds like a
// difference in kind. Under the simplest model — stages independent, each with
// per-stage reliability p, all eight needed — it is not:
//
//   P(all eight) = p^8   =>   p = P^(1/8)
//
// 0.55^(1/8) = 0.928 and 0.05^(1/8) = 0.688. A 24-point difference in per-stage
// reliability, compounded eight times, is the whole 11x. Independence is
// obviously wrong in detail (a bad early seat makes later stages harder, and
// retries are visible in the rollout videos), which makes this a lower bound on
// how sharp the compounding is, not an upper one.
//
// The tolerances are the project page's. Stage 7 is the tightest: a 4 mm bit into
// a 4.5 mm socket.
//
// mpow because these exponents reach the DOM.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const STAGES = [
  { n: 3, label: "insert gripper", detail: "19 mm part into a 20 mm holder", tol: 0.5 },
  { n: 5, label: "insert screw", detail: "4.5 mm M5 screw into an 8 mm hole", tol: 1.75 },
  { n: 7, label: "screw in", detail: "4 mm bit into a 4.5 mm socket", tol: 0.25 },
]

const MEASURED = [
  { l: "Flex-π (full joint)", runs: 11, c: GOOD },
  { l: "best baseline", runs: 1, c: WARM },
]

export function OrderedStages() {
  const [n, setN] = useState(8)
  const [p, setP] = useState(92.8)

  const per = p / 100
  const all = mpow(per, n)

  const implied = (succ: number) => mpow(succ / 20, 1 / 8)

  const W = 720
  const H = 92
  const cw = (W - 20) / n

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          self-repair gripper · {n} stages, in order · 20 rollouts per method
        </span>
        <span className="font-mono text-[10px]" style={{ color: all > 0.4 ? GOOD : WARM }}>
          {(all * 100).toFixed(1)}% finish the sequence
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              A chain of stage boxes shaded by the cumulative probability of having reached each one, fading toward
              the end of the sequence
            </title>
            {Array.from({ length: n }, (_, i) => {
              const reach = mpow(per, i + 1)
              const x = 10 + i * cw
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={22}
                    width={cw - 5}
                    height={30}
                    rx={4}
                    fill={ACCENT}
                    fillOpacity={0.15 + 0.75 * reach}
                  />
                  <text
                    x={x + (cw - 5) / 2}
                    y={41}
                    fontSize={9}
                    fill="currentColor"
                    fillOpacity={0.9}
                    textAnchor="middle"
                    fontFamily="ui-monospace, monospace"
                  >
                    {i + 1}
                  </text>
                  <text
                    x={x + (cw - 5) / 2}
                    y={66}
                    fontSize={8.5}
                    fill="currentColor"
                    fillOpacity={0.5}
                    textAnchor="middle"
                    fontFamily="ui-monospace, monospace"
                  >
                    {(reach * 100).toFixed(0)}%
                  </text>
                </g>
              )
            })}
            <text x={10} y={14} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              shading = chance of still being alive at this stage
            </text>
            <text x={10} y={84} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              a failure anywhere ends the rollout — no stage can be skipped or reordered
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">per-stage</span>
            <Range
              min={50}
              max={99.5}
              step={0.1}
              value={p}
              onChange={(e) => setP(Number(e.target.value))}
              className="flex-1"
              aria-label="per-stage reliability"
              accent={ACCENT}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{p.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">stages</span>
            <Range
              min={1}
              max={16}
              step={1}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="flex-1"
              aria-label="number of ordered stages"
              accent={GOOD}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{n}</span>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            what the measured end-to-end numbers imply per stage
          </div>
          <div className="mt-2 space-y-1">
            {MEASURED.map((m) => {
              const ip = implied(m.runs)
              return (
                <div key={m.l} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{m.l}</span>
                  <span className="w-24 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {m.runs}/20 rollouts
                  </span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${ip * 100}%`, background: m.c }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: m.c }}>
                    {(ip * 100).toFixed(1)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setP(Number((ip * 100).toFixed(1)))}
                    className="shrink-0 cursor-pointer rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    use
                  </button>
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
            assuming stages are independent — which they are not, so treat these as the mildest version of the
            gap
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            three of the eight stages, with their clearances
          </div>
          {STAGES.map((s) => (
            <div key={s.n} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
              <span className="w-16 shrink-0 text-right text-foreground">stage {s.n}</span>
              <span className="w-28 shrink-0 text-muted-foreground">{s.label}</span>
              <span className="flex-1 text-muted-foreground">{s.detail}</span>
              <span className="tabular-nums" style={{ color: s.tol <= 0.25 ? WARM : ACCENT }}>
                ±{s.tol} mm
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Eleven rollouts out of twenty against one out of twenty reads like a difference in kind. Work backwards
          through the eighth root and it is a difference of{" "}
          <span className="text-foreground">twenty-four points of per-stage reliability</span>: about 93% against
          about 69%. Neither of those is a shocking number on its own. Compounded eight times, one of them
          finishes the task most of the time and the other almost never does.
          <br />
          <br />
          That is the argument for measuring long-horizon tasks at all, and it cuts both ways. It means a policy
          can look competent stage by stage and be useless end to end — and it means a modest per-stage
          improvement, of the kind that is easy to dismiss as noise, is worth an order of magnitude where the
          stages are ordered and unskippable. Drag the stage count and watch how fast even a 95% policy stops
          finishing anything.
        </p>
      </div>
    </figure>
  )
}
