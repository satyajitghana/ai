"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Three of K3's reward functions, drawn together because they share a shape.
//
// The report specifies each one separately -- reasoning-effort budgets in
// §4.1.2, the Agentic Generative Reward Model in the same section, kernel tasks
// in §4.2.4 -- and every one of them is a smooth reward with a hard cliff
// bolted onto the axis the model would otherwise exploit. Length, verbosity,
// and numerical precision are all things a policy can trade away for score, and
// in all three cases the answer is not a penalty term but a guillotine.
//
// Published, exactly:
//   effort  -- task reward overridden to -1 when total tokens exceed tau * b0(x),
//              where b0 is a per-problem budget estimated from the cold-start
//              model; tau is annealed down to turn the max-effort expert into
//              the high- and low-effort ones, per domain, human-in-the-loop.
//              T(y) counts thinking tokens for general tasks and cumulative
//              output tokens including tool-call arguments for agentic ones.
//   GRM     -- tournament-style binary comparisons; a candidate whose output
//              exceeds sigma * l0 automatically loses.
//   kernel  -- zero reward above a numerical error threshold; matching an expert
//              implementation is 0.5; approaching the hardware roofline moves
//              the reward toward 1.
//
// The paper fixes two points on the kernel curve (0.5 at expert parity, ->1 at
// roofline) and does not state the shape below parity; the ramp drawn here is
// an assumption, marked as one. The expert implementation's own distance from
// the roofline is a slider for the same reason.

const ACCENT = "oklch(0.58 0.15 265)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 25)"

type Tab = "effort" | "grm" | "kernel"

const TABS: { k: Tab; l: string; where: string }[] = [
  { k: "effort", l: "reasoning effort", where: "§4.1.2" },
  { k: "grm", l: "agentic reward model", where: "§4.1.2" },
  { k: "kernel", l: "GPU kernels", where: "§4.2.4" },
]

const GRM_PROTOCOL = [
  "read the outcome, product, or text output",
  "generate a rubric",
  "score each candidate against the rubric",
  "record the rubric-assigned scores in a scorepad",
]

const HACKS = ["CUDA graph replay", "input caching", "precision reduction"]

export function RewardCliffs() {
  const [tab, setTab] = useState<Tab>("effort")
  const [tau, setTau] = useState(150)
  const [sigma, setSigma] = useState(130)
  const [expert, setExpert] = useState(55)

  const W = 700
  const H = 160
  const X0 = 52
  const X1 = 604
  const Y0 = 18
  const Y1 = 112

  const t = tau / 100
  const sg = sigma / 100
  const ex = expert / 100

  // x axis runs 0..2 for the two budget panels, 0..1 (fraction of roofline) for kernels
  const XMAX = tab === "kernel" ? 1 : 2
  const PX = (v: number) => X0 + (v / XMAX) * (X1 - X0)
  // y axis runs -1..1 for effort (the override is negative), 0..1 elsewhere
  const YMIN = tab === "effort" ? -1 : 0
  const PY = (v: number) => Y1 - ((v - YMIN) / (1 - YMIN)) * (Y1 - Y0)

  const cliffAt = tab === "effort" ? t : tab === "grm" ? sg : null

  // reward as a function of the exploited axis
  const rewardAt = (v: number) => {
    if (tab === "effort") return v <= t ? 0.8 : -1
    if (tab === "grm") return v <= sg ? 0.5 : 0
    if (v < ex) return (0.5 * v) / ex
    return 0.5 + (0.5 * (v - ex)) / (1 - ex)
  }

  // sampled path, split at the discontinuity so no line is drawn across the cliff
  const seg = (lo: number, hi: number) => {
    let d = ""
    for (let i = 0; i <= 48; i++) {
      const v = lo + ((hi - lo) * i) / 48
      d += `${i === 0 ? "M" : "L"} ${PX(v).toFixed(2)} ${PY(rewardAt(v)).toFixed(2)} `
    }
    return d
  }

  const meta: Record<Tab, { x: string; y: string; note: string; cliffLabel: string }> = {
    effort: {
      x: "tokens used ÷ the problem's budget b₀(x)",
      y: "task reward",
      note: "τ is annealed downward to turn the max-effort expert into the high- and low-effort ones",
      cliffLabel: "reward overridden to −1",
    },
    grm: {
      x: "output length ÷ the cold-start model's length ℓ₀",
      y: "chance in a binary comparison",
      note: "σ is the verbosity multiplier — past it the candidate loses regardless of quality",
      cliffLabel: "automatic loss",
    },
    kernel: {
      x: "achieved performance, as a fraction of the hardware roofline",
      y: "reward",
      note: "zero throughout if the numerical error exceeds the threshold, or a hack is detected · the paper fixes the two labelled points and does not state the shape below parity, so the dashed ramp is an assumption",
      cliffLabel: "",
    },
  }
  const m = meta[tab]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          three reward functions, one shape — a smooth score with a guillotine on the axis you would game
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          {TABS.find((x) => x.k === tab)!.where}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setTab(x.k)}
              aria-pressed={tab === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tab === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.l}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              The selected reward function plotted against the quantity a policy could trade away for score. The two
              budget rewards hold a flat value and then drop vertically at their threshold; the kernel reward rises
              through 0.5 at expert parity toward 1 at the hardware roofline.
            </title>

            <text x={8} y={12} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              {m.y}
            </text>

            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            {(tab === "effort" ? [-1, 0, 1] : [0, 0.5, 1]).map((v) => (
              <g key={v}>
                <line x1={X0 - 4} y1={PY(v)} x2={X1} y2={PY(v)} stroke="currentColor" strokeOpacity={0.1} />
                <text
                  x={X0 - 7}
                  y={PY(v) + 3}
                  fontSize={8}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.45}
                  fontFamily="ui-monospace, monospace"
                >
                  {v}
                </text>
              </g>
            ))}

            {(tab === "kernel" ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1, 1.5, 2]).map((v) => (
              <g key={`x${v}`}>
                <line x1={PX(v)} y1={Y1} x2={PX(v)} y2={Y1 + 4} stroke="currentColor" strokeOpacity={0.25} />
                <text
                  x={PX(v)}
                  y={Y1 + 14}
                  fontSize={8}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.42}
                  fontFamily="ui-monospace, monospace"
                >
                  {v}
                  {v === 1 && tab !== "kernel" ? "×" : ""}
                </text>
              </g>
            ))}

            {cliffAt !== null ? (
              <>
                <rect
                  x={PX(cliffAt)}
                  y={Y0}
                  width={X1 - PX(cliffAt)}
                  height={Y1 - Y0}
                  fill={BAD}
                  fillOpacity={0.07}
                />
                <path d={seg(0, cliffAt)} fill="none" stroke={GOOD} strokeWidth={2.2} />
                <path d={seg(cliffAt + 0.001, XMAX)} fill="none" stroke={BAD} strokeWidth={2.2} />
                <line
                  x1={PX(cliffAt)}
                  y1={PY(rewardAt(0))}
                  x2={PX(cliffAt)}
                  y2={PY(rewardAt(XMAX))}
                  stroke={BAD}
                  strokeWidth={2.2}
                  strokeDasharray="3 2"
                />
                <text
                  x={PX(cliffAt) + 8}
                  y={Y0 + 12}
                  fontSize={9}
                  fill={BAD}
                  fontFamily="ui-monospace, monospace"
                >
                  {m.cliffLabel}
                </text>
                <text
                  x={PX(cliffAt)}
                  y={Y0 - 5}
                  fontSize={9}
                  textAnchor="middle"
                  fill={BAD}
                  fontFamily="ui-monospace, monospace"
                >
                  {tab === "effort" ? "τ" : "σ"} = {cliffAt.toFixed(2)}
                </text>
              </>
            ) : (
              <>
                <path d={seg(0, ex)} fill="none" stroke={ACCENT} strokeWidth={2.2} strokeDasharray="4 3" />
                <path d={seg(ex, 1)} fill="none" stroke={GOOD} strokeWidth={2.2} />
                <circle cx={PX(ex)} cy={PY(0.5)} r={4} fill={ACCENT} />
                <text
                  x={PX(ex) + 8}
                  y={PY(0.5) - 11}
                  fontSize={9}
                  fill={ACCENT}
                  fontFamily="ui-monospace, monospace"
                >
                  expert implementation → 0.5
                </text>
                <text
                  x={X1 - 4}
                  y={Y0 - 5}
                  fontSize={9}
                  textAnchor="end"
                  fill={GOOD}
                  fontFamily="ui-monospace, monospace"
                >
                  roofline → 1
                </text>
              </>
            )}

            <text
              x={(X0 + X1) / 2}
              y={H - 4}
              fontSize={8.5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.45}
              fontFamily="ui-monospace, monospace"
            >
              {m.x}
            </text>
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-40 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            {tab === "effort" ? "budget multiplier τ" : tab === "grm" ? "verbosity multiplier σ" : "expert vs roofline"}
          </span>
          <Range
            min={tab === "kernel" ? 20 : 40}
            max={tab === "kernel" ? 90 : 190}
            step={5}
            value={tab === "effort" ? tau : tab === "grm" ? sigma : expert}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (tab === "effort") setTau(v)
              else if (tab === "grm") setSigma(v)
              else setExpert(v)
            }}
            className="flex-1"
            aria-label={
              tab === "effort"
                ? "how many times the estimated budget a trajectory may spend before the reward is overridden"
                : tab === "grm"
                  ? "how much longer than the cold-start model a candidate may be before it automatically loses"
                  : "how close the expert implementation itself gets to the hardware roofline"
            }
            accent={tab === "kernel" ? ACCENT : BAD}
          />
          <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {(tab === "effort" ? t : tab === "grm" ? sg : ex).toFixed(2)}
          </span>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{m.note}</div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          {tab === "effort" ? (
            <>
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                what counts toward the budget
              </div>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                <div className="font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">general tasks</span> — thinking tokens
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">agentic tasks</span> — cumulative output tokens, reasoning traces
                  and tool-call arguments together
                </div>
              </div>
              <div className="mt-2 font-mono text-[9px] text-muted-foreground">
                b₀(x) is estimated per problem from the cold-start model · τ is set per domain under human-in-the-loop
                guidance · the max-effort expert is trained first, then τ anneals down to produce high and low
              </div>
            </>
          ) : tab === "grm" ? (
            <>
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                the judge&rsquo;s mandatory protocol
              </div>
              <ol className="mt-1.5 space-y-1">
                {GRM_PROTOCOL.map((s, i) => (
                  <li key={s} className="flex gap-2 font-mono text-[10px] text-muted-foreground">
                    <span style={{ color: ACCENT }}>{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2 font-mono text-[9px] text-muted-foreground">
                used for non-verifiable general tasks · tournament-style group reward over binary comparisons · the
                rubric is written before the scoring, not after
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                what the hacking-detection system penalizes
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {HACKS.map((h) => (
                  <span
                    key={h}
                    className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                    style={{ borderColor: `${BAD}55` }}
                  >
                    {h}
                  </span>
                ))}
                <span className="rounded-full border border-dashed px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  extended as new ones appear
                </span>
              </div>
              <div className="mt-2 font-mono text-[9px] text-muted-foreground">
                single-operator kernels through fused mega-kernels · CUDA, Triton, CuTe DSL, Gluon, ThunderKittens,
                TileLang · BF16, FP8 and FP4 · exceed the numerical error threshold and the reward is zero regardless
                of speed
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Each of these could have been a penalty term — subtract something proportional to length, to verbosity, to
          numerical error — and none of them is.{" "}
          <span className="text-foreground">
            Every one is a cliff: cross the line and the score is not reduced, it is gone
          </span>
          . That is a deliberate choice about what a policy can trade. A smooth penalty is an exchange rate, and a
          model doing RL will find the price at which a longer answer or a lower-precision kernel is worth paying
          for. A discontinuity has no exchange rate.
          <br />
          <br />
          The kernel task is the clearest case, because it is the one where the report admits the arms race out loud.
          Correctness is a gate, performance is graded against a human expert&rsquo;s implementation with the
          hardware roofline as the ceiling, and on top of both sits a detector for CUDA graph replay, input caching
          and precision reduction — extended, in Moonshot&rsquo;s words, as new hacking strategies were observed
          during development. Reward design here is not a function you write once; it is a surface you keep patching
          while something intelligent probes it.
        </p>
      </div>
    </figure>
  )
}
