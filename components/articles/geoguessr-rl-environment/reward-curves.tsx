"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The article's central technical argument, made checkable rather than
// described. Two curves over the same distance axis:
//
//   game    = max(0, exp(-d / 1492.7) - cost)
//   trainer = min(1, 0.5*exp(-d / 1492.7) + 0.5*exp(-d / 5000)) * (1 - min(cost, 0.2))
//
// Both constants (1492.7 km decay, 5000 km long scale, 0.2 cost cap) and both
// formulas are read directly off env/server/scoring.py and
// train/grpo_geoguesser.py in HuggingEnvs/HuggingEnvs (03-geoguesser) — not
// paraphrased from the article's prose. `game` is what the leaderboard reports
// and what the *environment* itself computes; `trainer` is what
// grpo_geoguesser.py's training_reward() actually optimises. They diverge in
// two places: a second, slower decay scale that keeps a gradient past 6,000 km,
// and a multiplicative cost that can never collapse the ordering of two bad
// guesses the way subtraction-then-floor does.
//
// Recomputed independently (see the article prose for the exact numbers):
// replaying the environment's own scoring.py at the board's 9 untouched
// reference models' mean action cost (0.0998) puts the zero-floor cliff at
// ~3,440 km, and at the untrained 4B's own mean cost (0.108) at ~3,322 km --
// which is where the "about 3,300 km" figure in the article lands almost
// exactly. At the cheapest arm on the board (sonnet-5, cost 0.047) the cliff
// sits at ~4,564 km, matching the article's "about 4,500 km for a cheap
// episode." Both derived here with the same two formulas, not hardcoded.

const DECAY_KM = 1492.7
const LONG_DECAY_KM = 5000
const COST_CAP = 0.2
const D_MAX = 20000

const game = (d: number, cost: number) => Math.max(0, mexp(-d / DECAY_KM) - cost)
const trainer = (d: number, cost: number) =>
  Math.min(1, 0.5 * mexp(-d / DECAY_KM) + 0.5 * mexp(-d / LONG_DECAY_KM)) *
  (1 - Math.min(cost, COST_CAP))

// Solve the game curve's zero-floor cliff in closed form: exp(-d/1492.7) = cost.
const gameCliff = (cost: number) => (cost <= 0 ? D_MAX : -DECAY_KM * Math.log(cost))

const GAME_COLOR = "oklch(0.62 0.16 25)"
const TRAINER_COLOR = "oklch(0.58 0.15 255)"
const FLAT_FILL = "oklch(0.62 0.16 25)"

// Real per-episode action costs from board.json (mean over 200 tasks, pass@4).
const COST_PRESETS = [
  { label: "sonnet-5 (cheapest arm)", cost: 0.047 },
  { label: "untrained 4B (own mean cost)", cost: 0.108 },
  { label: "Qwen3.5-122B-A10B (priciest reference arm)", cost: 0.14 },
]

// The article's own worked example: two misses the game curve cannot tell apart.
const DISTANCE_PRESETS = [
  { label: "3,324 km miss", d: 3324 },
  { label: "18,723 km miss", d: 18723 },
]

const W = 720
const H = 320
const padL = 46
const padR = 14
const padT = 18
const padB = 40
const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000

export function RewardCurves() {
  const [cost, setCost] = useState(0.108)
  const [dist, setDist] = useState(3324)

  const sx = (d: number) => r2(padL + (d / D_MAX) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - v) * (H - padT - padB))

  const { gamePath, trainerPath } = useMemo(() => {
    const STEPS = 160
    const gp: string[] = []
    const tp: string[] = []
    for (let i = 0; i <= STEPS; i++) {
      const d = (i / STEPS) * D_MAX
      gp.push(`${sx(d)},${sy(game(d, cost))}`)
      tp.push(`${sx(d)},${sy(trainer(d, cost))}`)
    }
    return { gamePath: gp.join(" "), trainerPath: tp.join(" ") }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cost])

  const cliff = Math.min(D_MAX, gameCliff(cost))
  const gAtDist = r4(game(dist, cost))
  const tAtDist = r4(trainer(dist, cost))
  const pastCliff = dist >= cliff

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-left font-mono text-[11px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the game&rsquo;s curve vs the trainer&rsquo;s curve
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          action cost = {cost.toFixed(3)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {COST_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setCost(p.cost)}
              className={chip(cost === p.cost)}
            >
              {p.label} · {p.cost.toFixed(3)}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Two reward curves against distance in kilometres, at an action cost of ${cost}. The game curve, max of 0 and exp(-d/1492.7) minus cost, is dashed and floors at zero past ${Math.round(cliff)} km, shown as a shaded flat zone. The trainer curve, the two-scale mixture used for training, stays above zero across the full range. A marker at ${dist} km reads off both values.`}
        >
          {/* flat / zero zone, shaded */}
          <rect
            x={sx(cliff)}
            y={padT}
            width={Math.max(0, sx(D_MAX) - sx(cliff))}
            height={H - padT - padB}
            fill={FLAT_FILL}
            opacity={0.08}
          />
          <line
            x1={sx(cliff)}
            y1={padT}
            x2={sx(cliff)}
            y2={H - padB}
            stroke={GAME_COLOR}
            strokeOpacity={0.5}
            strokeDasharray="3 3"
          />
          <text
            x={sx(cliff) + 4}
            y={padT + 10}
            className="fill-muted-foreground font-mono"
            fontSize="8.5"
          >
            cliff · {Math.round(cliff).toLocaleString()} km
          </text>

          {/* y gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((gy) => (
            <g key={gy}>
              <line
                x1={padL}
                y1={sy(gy)}
                x2={W - padR}
                y2={sy(gy)}
                stroke="currentColor"
                strokeOpacity={0.07}
              />
              <text
                x={padL - 6}
                y={sy(gy) + 3}
                textAnchor="end"
                className="fill-muted-foreground/60 font-mono"
                fontSize="9"
              >
                {gy}
              </text>
            </g>
          ))}
          {/* x ticks */}
          {[0, 5000, 10000, 15000, 20000].map((gx) => (
            <text
              key={gx}
              x={sx(gx)}
              y={H - 24}
              textAnchor="middle"
              className="fill-muted-foreground/60 font-mono"
              fontSize="9"
            >
              {(gx / 1000).toFixed(0)}k
            </text>
          ))}
          <text
            x={(W + padL) / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground/50 font-mono"
            fontSize="9"
          >
            distance from truth (km)
          </text>

          <polyline
            points={gamePath}
            fill="none"
            stroke={GAME_COLOR}
            strokeWidth={1.8}
            strokeDasharray="5 4"
          />
          <polyline points={trainerPath} fill="none" stroke={TRAINER_COLOR} strokeWidth={2} />

          {/* distance marker */}
          <line
            x1={sx(dist)}
            y1={padT}
            x2={sx(dist)}
            y2={H - padB}
            stroke="currentColor"
            strokeOpacity={0.35}
          />
          <circle cx={sx(dist)} cy={sy(gAtDist)} r={4} fill={GAME_COLOR} />
          <circle cx={sx(dist)} cy={sy(tAtDist)} r={4} fill={TRAINER_COLOR} />
        </svg>

        <div className="mt-1">
          <Range
            min={0}
            max={D_MAX}
            step={1}
            value={dist}
            onChange={(e) => setDist(+e.target.value)}
            className="w-full"
            aria-label="distance from truth in kilometres"
            accent={TRAINER_COLOR}
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {DISTANCE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDist(p.d)}
              className={chip(dist === p.d)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-xs sm:grid-cols-4">
          <div>
            <div className="text-[9px] tracking-wide text-muted-foreground uppercase">
              distance
            </div>
            <div className="tabular-nums">{Math.round(dist).toLocaleString()} km</div>
          </div>
          <div>
            <div className="text-[9px] tracking-wide text-muted-foreground uppercase">
              game reward
            </div>
            <div className="tabular-nums" style={{ color: GAME_COLOR }}>
              {gAtDist.toFixed(4)}
              {pastCliff ? " (floored)" : ""}
            </div>
          </div>
          <div>
            <div className="text-[9px] tracking-wide text-muted-foreground uppercase">
              trainer reward
            </div>
            <div className="tabular-nums" style={{ color: TRAINER_COLOR }}>
              {tAtDist.toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-[9px] tracking-wide text-muted-foreground uppercase">
              GRPO group advantage
            </div>
            <div className="tabular-nums">
              {pastCliff ? "zero if all 8 land past the cliff" : "survives"}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag to <span style={{ color: GAME_COLOR }}>3,324 km</span> and then to{" "}
          <span style={{ color: GAME_COLOR }}>18,723 km</span>: the dashed{" "}
          <span style={{ color: GAME_COLOR }}>game curve</span> reads 0.0000 at both — a
          5.6&times; difference in how wrong the guess was, and zero difference in what it
          scores. The solid <span style={{ color: TRAINER_COLOR }}>trainer curve</span> never
          floors: it keeps a second, 5,000&nbsp;km decay scale alive under the first one, so a
          GRPO group of eight rollouts that all land on the wrong continent still has a
          gradient instead of eight identical zeros.
        </p>
      </div>
    </figure>
  )
}
