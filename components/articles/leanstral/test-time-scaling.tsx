"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The thesis, made draggable. Leanstral has no bespoke test-time-scaling method — it
// just spends more tokens inside the ordinary agent loop. So performance scales
// smoothly with the per-attempt token budget. Drag the budget from 25k to 4M and
// watch PutnamBench (Pass@8, 672 problems) climb 15 → 587. Data read from Mistral's
// published "PutnamBench Test-Time Scaling" figure.

const ACCENT = "oklch(0.70 0.19 42)"
const TOTAL = 672

// [label, budget-tokens, problems solved] at the marked points on the curve
const PTS = [
  { label: "25k", solved: 15 },
  { label: "50k", solved: 44 },
  { label: "100k", solved: 126 },
  { label: "200k", solved: 244 },
  { label: "500k", solved: 396 },
  { label: "1M", solved: 493 },
  { label: "2M", solved: 573 },
  { label: "4M", solved: 587 },
] as const

// chart geometry (viewBox units)
const W = 640
const H = 300
const PL = 44 // left pad (y axis)
const PB = 34 // bottom pad (x axis)
const PT = 16
const PR = 14

const x = (i: number) => PL + (i / (PTS.length - 1)) * (W - PL - PR)
const y = (solved: number) => PT + (1 - solved / TOTAL) * (H - PT - PB)

export function TestTimeScaling() {
  const [i, setI] = useState(PTS.length - 1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((k) => (k + 1) % PTS.length), 900)
    return () => clearInterval(id)
  }, [playing])

  const cur = PTS[i]
  const pct = ((cur.solved / TOTAL) * 100).toFixed(0)

  // full curve path + the filled area up to the current budget
  const line = PTS.map((p, k) => `${k === 0 ? "M" : "L"} ${x(k)} ${y(p.solved)}`).join(" ")
  const fill =
    `M ${x(0)} ${y(0)} ` +
    PTS.slice(0, i + 1).map((p, k) => `L ${x(k)} ${y(p.solved)}`).join(" ") +
    ` L ${x(i)} ${y(0)} Z`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>PutnamBench test-time scaling · more tokens → more proofs</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "sweeping" : "sweep"}
        </button>
      </div>

      <div className="p-4">
        {/* readout */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">per-attempt token budget</div>
            <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: ACCENT }}>{cur.label}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground">PutnamBench solved (Pass@8)</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {cur.solved}<span className="text-base text-muted-foreground">/{TOTAL}</span>{" "}
              <span className="text-base" style={{ color: ACCENT }}>{pct}%</span>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${cur.label} tokens per attempt, Leanstral solves ${cur.solved} of ${TOTAL} PutnamBench problems`}>
          {/* gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line x1={PL} x2={W - PR} y1={y(g * TOTAL)} y2={y(g * TOTAL)} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={PL - 6} y={y(g * TOTAL) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>{Math.round(g * 100)}%</text>
            </g>
          ))}
          {/* filled area up to current budget */}
          <path d={fill} fill={ACCENT} opacity={0.14} />
          {/* full curve */}
          <path d={line} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.5} />
          {/* solid portion up to current */}
          <path d={PTS.slice(0, i + 1).map((p, k) => `${k === 0 ? "M" : "L"} ${x(k)} ${y(p.solved)}`).join(" ")} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* x labels + dots */}
          {PTS.map((p, k) => (
            <g key={p.label}>
              <circle cx={x(k)} cy={y(p.solved)} r={k === i ? 5 : 3} fill={k <= i ? ACCENT : "var(--muted)"} stroke={k === i ? "var(--background)" : "none"} strokeWidth={1.5} />
              <text x={x(k)} y={H - PB + 16} textAnchor="middle" className={cn("font-mono", k === i ? "fill-foreground" : "fill-muted-foreground")} fontSize={10}>{p.label}</text>
            </g>
          ))}
          {/* marker value */}
          <text x={x(i)} y={y(cur.solved) - 10} textAnchor="middle" className="fill-foreground font-mono font-semibold" fontSize={12}>{cur.solved}</text>
          <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>token limit per attempt →</text>
        </svg>

        {/* the actual control */}
        <label className="mt-2 block">
          <span className="sr-only">token budget</span>
          <input
            type="range"
            min={0}
            max={PTS.length - 1}
            step={1}
            value={i}
            onChange={(e) => { setPlaying(false); setI(Number(e.target.value)) }}
            className="w-full cursor-pointer accent-[oklch(0.70_0.19_42)]"
          />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          No plateau tricks, no bespoke scaffold — the curve climbs monotonically because Leanstral
          just keeps working the proof. That is the whole claim: <span className="text-foreground">compute
          spent inside the ordinary loop converts directly into solved theorems</span>. At the far right,
          ~$4 of tokens per problem edges Seed-Prover 1.5&apos;s high setting (which budgets ~10 H20-days,
          ~$300+ per problem).
        </p>
      </div>
    </figure>
  )
}
