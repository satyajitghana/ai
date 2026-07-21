"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// HMPO — Hybrid Median-length Policy Optimization, drawn as a real diagram. For each
// query the policy samples a group of G rollouts. HMPO sets the length budget b to the
// MEDIAN length of the *correct* rollouts in that group (no static threshold, no tuning),
// then pays a cosine-decay token reward that is high for short-and-correct traces, fades
// to λ at the budget, and drops to exactly 0 for anything over budget OR incorrect. As
// the policy gets more concise the median shrinks, so the budget self-tightens — an
// implicit curriculum. Drag the candidate length and the training progress; flip λ and
// correctness. Lengths are illustrative; the reward is the paper's exact formula.

const GREEN = "oklch(0.58 0.14 155)"
const RED = "oklch(0.60 0.17 25)"
const ACCENT = "oklch(0.60 0.15 255)"

const W = 760
const H = 360
const ML = 56
const MR = 28
const PLOTW = W - ML - MR
const N_MAX = 4000
const STRIP_Y = 74
const Y_TOP = 158 // reward = 1
const Y_BOT = 300 // reward = 0

// deterministic group of G=10 rollouts (base lengths in tokens), correct flag
const GROUP = [
  { n: 820, ok: true },
  { n: 640, ok: false },
  { n: 1050, ok: true },
  { n: 1280, ok: true },
  { n: 3100, ok: false },
  { n: 1500, ok: true },
  { n: 1720, ok: true },
  { n: 2800, ok: false },
  { n: 1980, ok: true },
  { n: 2350, ok: true },
]

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const xOf = (n: number) => ML + (n / N_MAX) * PLOTW
const yOf = (r: number) => Y_BOT - r * (Y_BOT - Y_TOP)

function rewardIfCorrect(n: number, b: number, lambda: number) {
  if (n >= b) return 0
  return Math.min(1, Math.cos((Math.PI * n) / (2 * b)) + lambda)
}

export function HmpoBudget() {
  const [progress, setProgress] = useState(35)
  const [cand, setCand] = useState(1100)
  const [lambda, setLambda] = useState(0.8)
  const [correct, setCorrect] = useState(true)

  const scale = 1 - 0.42 * (progress / 100)
  const group = useMemo(() => GROUP.map((g) => ({ ...g, len: Math.round(g.n * scale) })), [scale])
  const b = useMemo(() => median(group.filter((g) => g.ok).map((g) => g.len)), [group])

  // reward curve (bounded sampling)
  const path = useMemo(() => {
    const STEPS = 120
    let d = ""
    for (let i = 0; i <= STEPS; i++) {
      const n = (i / STEPS) * N_MAX
      const r = rewardIfCorrect(n, b, lambda)
      d += `${i === 0 ? "M" : "L"} ${xOf(n).toFixed(1)} ${yOf(r).toFixed(1)} `
    }
    return d.trim()
  }, [b, lambda])

  const rTok = rewardIfCorrect(cand, b, lambda)
  const rFinal = correct ? rTok : 0
  const overBudget = cand >= b

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>HMPO · median budget + cosine-decay token reward</span>
        <span className="text-muted-foreground/50">illustrative lengths</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A group of ten rollouts; the median length of the correct ones sets the budget b at ${b} tokens. A ${cand}-token ${correct ? "correct" : "incorrect"} trace earns final reward ${rFinal.toFixed(2)}.`}>
          <defs>
            <filter id="hmpo-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* zero-reward region (n >= b) */}
          <rect x={xOf(b)} y={Y_TOP - 8} width={W - MR - xOf(b)} height={Y_BOT - Y_TOP + 8} fill={RED} opacity={0.05} />
          <rect x={ML} y={Y_TOP - 8} width={xOf(b) - ML} height={Y_BOT - Y_TOP + 8} fill={GREEN} opacity={0.05} />

          {/* strip label */}
          <text x={ML} y={44} className="fill-muted-foreground font-mono" fontSize={11}>group of G = 10 rollouts, placed by length →</text>

          {/* rollout dots */}
          {group.map((g, i) => {
            const jitter = ((i % 3) - 1) * 11
            return (
              <g key={i}>
                <circle cx={xOf(g.len)} cy={STRIP_Y + jitter} r={6.5} fill={g.ok ? GREEN : RED} opacity={0.85} filter="url(#hmpo-soft)" />
                {g.ok ? null : <path d={`M ${xOf(g.len) - 2.6} ${STRIP_Y + jitter - 2.6} L ${xOf(g.len) + 2.6} ${STRIP_Y + jitter + 2.6} M ${xOf(g.len) + 2.6} ${STRIP_Y + jitter - 2.6} L ${xOf(g.len) - 2.6} ${STRIP_Y + jitter + 2.6}`} stroke="var(--background)" strokeWidth={1.2} />}
              </g>
            )
          })}

          {/* median budget line through both views */}
          <line x1={xOf(b)} y1={52} x2={xOf(b)} y2={Y_BOT} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.9} />
          <text x={xOf(b)} y={116} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>median b = {b}</text>

          {/* y axis ticks: 0, lambda, 1 */}
          {[0, lambda, 1].map((r, i) => (
            <g key={i}>
              <line x1={ML} y1={yOf(r)} x2={W - MR} y2={yOf(r)} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text x={ML - 6} y={yOf(r) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{i === 1 ? "λ" : r.toFixed(0)}</text>
            </g>
          ))}
          <text x={ML - 6} y={Y_TOP - 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>R_token</text>

          {/* x axis */}
          <line x1={ML} y1={Y_BOT} x2={W - MR} y2={Y_BOT} stroke="var(--border)" strokeWidth={1.2} />
          {[0, 1000, 2000, 3000, 4000].map((n) => (
            <text key={n} x={xOf(n)} y={Y_BOT + 15} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{n === 0 ? "0" : `${n / 1000}k`}</text>
          ))}
          <text x={(ML + W - MR) / 2} y={Y_BOT + 30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>response length n (tokens)</text>

          {/* reward curve */}
          <path d={path} fill="none" stroke={ACCENT} strokeWidth={2.2} />

          {/* candidate marker */}
          <line x1={xOf(cand)} y1={Y_TOP - 8} x2={xOf(cand)} y2={Y_BOT} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <circle cx={xOf(cand)} cy={yOf(rFinal)} r={5.5} fill={correct && !overBudget ? ACCENT : RED} stroke="var(--background)" strokeWidth={1.5} />

          {/* readout */}
          <g transform={`translate(${xOf(cand) > W - 180 ? xOf(cand) - 168 : xOf(cand) + 12}, ${Y_TOP - 4})`}>
            <rect x={0} y={0} width={156} height={52} rx={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1.2} filter="url(#hmpo-soft)" />
            <text x={10} y={17} className="fill-muted-foreground font-mono" fontSize={9.5}>R_acc {correct ? "1" : "0"} · R_token {rTok.toFixed(2)}</text>
            <text x={10} y={34} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>R_final = {rFinal.toFixed(2)}</text>
            <text x={10} y={47} className="font-mono" fontSize={9} fill={correct && !overBudget ? GREEN : RED}>{!correct ? "incorrect → 0" : overBudget ? "over budget → 0" : "short & correct"}</text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">trace</span>
            {([[true, "correct"], [false, "incorrect"]] as [boolean, string][]).map(([v, lbl]) => (
              <button key={lbl} type="button" onClick={() => setCorrect(v)} aria-pressed={correct === v}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", correct === v ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {lbl}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">λ</span>
            {[0.4, 0.8].map((v) => (
              <button key={v} type="button" onClick={() => setLambda(v)} aria-pressed={lambda === v}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", lambda === v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={lambda === v ? { background: ACCENT } : undefined}>
                {v}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            budget <span style={{ color: ACCENT }}>{b}</span> tokens · {group.filter((g) => g.ok).length}/10 correct
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">candidate length n (drag)</div>
            <Range min={0} max={N_MAX} step={20} value={cand} onChange={(e) => setCand(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.60 0.15 255)" />
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">training progress → policy gets concise (drag)</div>
            <Range min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.58 0.14 155)" />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The budget <span style={{ color: ACCENT }}>b</span> is just the median length of the group's{" "}
          <span style={{ color: GREEN }}>correct</span> rollouts — no threshold to tune. Reward decays from 1 toward λ as a
          correct trace grows, then falls off a cliff to <span className="text-foreground">0</span> the moment it runs over
          budget, and an <span style={{ color: RED }}>incorrect</span> trace earns 0 at any length (correctness first, length
          second). Push training progress and the whole distribution slides left, so <span style={{ color: ACCENT }}>b</span>{" "}
          self-tightens as the model learns to be concise.
        </p>
      </div>
    </figure>
  )
}
