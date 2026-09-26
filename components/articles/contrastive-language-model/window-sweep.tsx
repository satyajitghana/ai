"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How much the verifier's answer depends on how many final steps it averages.
//
// Measured, not reported. The public evaluation file
// tarsur385/deepswe-prm-embeddings-8k (deepswe_eval_opus5max.parquet, revision
// e57c948) carries a `prm_score` column: the per-step cosine of the earlier
// three-fold CLM heads (tarsur385/deepswe-prm-heads-8k), each step scored by the
// fold head that never trained on its task. I read only the metadata columns
// (313 KB of a 681 MB file, by HTTP range request), grouped the 44,409 steps into
// their 449 rollouts, scored each rollout by the mean of its last W step scores,
// and applied the release's own best-of-N rule (evaluation/bon_eval.py: pick the
// maximum, exact expectation over uniform tie-breaking, N = 4). The counts below
// are that computation for every W. No ties occurred, so every count is whole.
//
// These are NOT the fine-tuned seed-42 head behind the 81.6% headline; that
// head's per-step scores are not published, and its 31/38 is reported.

const WINDOWS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 40, 60, 1000,
]
// picks out of all 113 tasks
const ALL = [
  85, 84, 82, 83, 84, 85, 85, 88, 90, 88, 90, 89, 88, 89, 90, 88, 86, 86, 87, 85, 85, 83, 84, 84, 84,
  83, 83, 84, 82, 84, 82, 81, 80,
]
// picks out of the 38 tasks the seed-42 split holds out
const HELD = [
  28, 27, 27, 27, 28, 28, 28, 30, 31, 29, 30, 30, 30, 30, 31, 30, 29, 29, 29, 29, 29, 28, 28, 28, 28,
  28, 27, 28, 26, 27, 27, 27, 27,
]

const RANDOM_ALL = 82.5
const ORACLE_ALL = 100
const RANDOM_HELD = 28
const ORACLE_HELD = 34
const RELEASE_W = 12

const W = 680
const H = 230
const PL = 40
const PR = 12
const PT = 14
const PB = 30
const Y_MIN = 78
const Y_MAX = 102

const ACCENT = "oklch(0.60 0.17 25)"
const MUTED = "oklch(0.62 0.13 250)"

const sx = (i: number) => PL + (i / (WINDOWS.length - 1)) * (W - PL - PR)
const sy = (v: number) => PT + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PT - PB)

const label = (w: number) => (w === 1000 ? "all steps" : `last ${w}`)
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`

export function WindowSweep() {
  const [idx, setIdx] = useState(WINDOWS.indexOf(RELEASE_W))
  const w = WINDOWS[idx]
  const all = ALL[idx]
  const held = HELD[idx]

  const path = ALL.map((v, i) => `${i === 0 ? "M" : "L"} ${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ")
  const ticks = [1, 4, 8, 12, 16, 20, 24, 30, 60, 1000]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>best-of-4 over Opus 5 rollouts · trajectory score = mean of the last W step scores</span>
        <span className="text-muted-foreground/60">measured · three-fold heads</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Tasks solved by the picked rollout, out of 113, as the averaging window changes. With the ${label(w)} step scores the selector solves ${all} of 113, against ${RANDOM_ALL} for a random pick and ${ORACLE_ALL} for an oracle.`}
        >
          {[80, 85, 90, 95, 100].map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth={0.75} />
              <text x={PL - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {v}
              </text>
            </g>
          ))}

          <line x1={PL} x2={W - PR} y1={sy(ORACLE_ALL)} y2={sy(ORACLE_ALL)} stroke={MUTED} strokeWidth={1.25} strokeDasharray="5 3" />
          <text x={W - PR} y={sy(ORACLE_ALL) - 4} textAnchor="end" fill={MUTED} className="font-mono" fontSize={9}>
            oracle 100 / 113
          </text>
          <line x1={PL} x2={W - PR} y1={sy(RANDOM_ALL)} y2={sy(RANDOM_ALL)} stroke="var(--foreground)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
          <text x={sx(WINDOWS.indexOf(20))} y={sy(RANDOM_ALL) + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            random pick 82.5 / 113
          </text>

          <line x1={sx(WINDOWS.indexOf(RELEASE_W))} x2={sx(WINDOWS.indexOf(RELEASE_W))} y1={PT} y2={H - PB} stroke="var(--border)" strokeWidth={1} />
          <text x={sx(WINDOWS.indexOf(RELEASE_W)) + 4} y={PT + 8} className="fill-muted-foreground font-mono" fontSize={9}>
            the release&apos;s W = 12
          </text>

          <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} />
          {ALL.map((v, i) => (
            <circle key={i} cx={sx(i)} cy={sy(v)} r={i === idx ? 5 : 2.2} fill={ACCENT} opacity={i === idx ? 1 : 0.7} />
          ))}

          {ticks.map((t) => {
            const i = WINDOWS.indexOf(t)
            return (
              <text key={t} x={sx(i)} y={H - PB + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {t === 1000 ? "all" : t}
              </text>
            )
          })}
          <text x={PL} y={H - 4} className="fill-muted-foreground font-mono" fontSize={9}>
            W, final steps averaged (not to scale past 30)
          </text>
        </svg>

        <label className="mt-1 block">
          <span className="sr-only">averaging window</span>
          <Range
            min={0}
            max={WINDOWS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">window</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{label(w)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">all 113 tasks</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: ACCENT }}>
              {all}/113
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {pct(all, 113)} · random {pct(RANDOM_ALL, 113)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">the 38 held-out tasks</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{held}/38</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              random {RANDOM_HELD} · oracle {ORACLE_HELD}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">vs random, 113 tasks</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {all - RANDOM_ALL > 0 ? "+" : ""}
              {(all - RANDOM_ALL).toFixed(1)}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">tasks</div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Each rollout&apos;s steps are scored by a head that never saw that task (three task-disjoint
        folds of 38, 38 and 37). Windows of 8 to 16 steps beat a random pick by 5.5 to 7.5 tasks out of
        113; windows of 1 to 7 are within 2.5 tasks of it, and averaging every step does worse than
        random. The release fixes W = 12 and does not say how 12 was chosen.
      </figcaption>
    </figure>
  )
}
