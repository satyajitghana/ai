"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { GOAL, H, HGT, START, W, WALL, buildWorld, planStats, stats } from "./toy"

// Our toy, not the paper's code: the idealized GTP prior update (Eq. 7) and
// Algorithm 1's beam search on a 4,096-sequence grid world. See toy.ts.

const CELL = 44
const PAD = 14
const GW = W * CELL
const GH = HGT * CELL
const LAMBDAS = [1, 2, 4]
const NMAX = 8

const cx = (x: number) => PAD + x * CELL + CELL / 2
const cy = (y: number) => PAD + y * CELL + CELL / 2
const f2 = (v: number) => v.toFixed(2)

export function PriorSharpening() {
  const world = useMemo(() => buildWorld(), [])
  const [n, setN] = useState(0)
  const [lambda, setLambda] = useState(1)

  const s = useMemo(() => stats(world, n, lambda), [world, n, lambda])
  const plan = useMemo(() => planStats(world, n, lambda), [world, n, lambda])
  const curve = useMemo(
    () => Array.from({ length: NMAX + 1 }, (_, k) => stats(world, k, lambda).expJ),
    [world, lambda]
  )

  const vmax = Math.max(...s.visits, 1e-9)
  const ex = plan.example
  const exPath = Array.from({ length: H + 1 }, (_, h) => world.path[ex * (H + 1) + h])

  // E[J] sparkline: J runs from -16 (worst plan) to -10 (best)
  const SX = (k: number) => 8 + (k / NMAX) * 184
  const SY = (j: number) => 8 + ((-10 - j) / 6) * 64

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          our toy: exact prior updates and beam search on 4,096 six-move plans
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          n = {n} · λ = {lambda}
        </span>
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:p-4">
        <svg
          viewBox={`0 0 ${GW + PAD * 2} ${GH + PAD * 2}`}
          className="w-full"
          role="img"
          aria-label={`A seven by five grid. The agent starts on the left, the goal is on the right, and a three-cell wall blocks the middle column. Shading shows where plans drawn from the prior after ${n} updates spend their moves; a dashed line shows the prior's average move sequence, which runs straight into the wall.`}
        >
          {Array.from({ length: W * HGT }, (_, i) => {
            const x = Math.floor(i / HGT)
            const y = i % HGT
            const wall = WALL.has(`${x},${y}`)
            return (
              <rect
                key={i}
                x={PAD + x * CELL + 1}
                y={PAD + y * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                rx={5}
                fill={wall ? "var(--foreground)" : "oklch(0.62 0.15 250)"}
                fillOpacity={wall ? 0.75 : Number((0.04 + 0.7 * (s.visits[i] / vmax)).toFixed(3))}
                stroke="var(--border)"
              />
            )
          })}
          <polyline
            points={s.meanPath.map(([x, y]) => `${f2(cx(x))},${f2(cy(y))}`).join(" ")}
            fill="none"
            stroke="oklch(0.65 0.18 30)"
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
          <polyline
            points={exPath.map((c) => `${cx(Math.floor(c / HGT))},${cy(c % HGT)}`).join(" ")}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <text x={cx(START[0])} y={cy(START[1]) + 4} textAnchor="middle" className="fill-foreground font-mono text-[12px] font-semibold">
            S
          </text>
          <text x={cx(GOAL[0])} y={cy(GOAL[1]) + 4} textAnchor="middle" className="fill-foreground font-mono text-[12px] font-semibold">
            G
          </text>
        </svg>

        <div className="flex flex-col gap-3 font-mono text-[11px]">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">prior updates n: {n}</span>
            <Range min={0} max={NMAX} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="number of prior updates" />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">temperature λ</span>
            {LAMBDAS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLambda(l)}
                className={cn(
                  "rounded-full border px-2.5 py-1 transition-colors hover:bg-muted/30",
                  l === lambda && "bg-muted/40 text-foreground"
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div>
              <dt className="text-muted-foreground">E[J] under prior</dt>
              <dd className="tabular-nums">{s.expJ.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">mass on J = −10</dt>
              <dd className="tabular-nums">{(s.optMass * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">next update gains</dt>
              <dd className="tabular-nums">+{s.gain.toFixed(3)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">λ·KL (the bound)</dt>
              <dd className="tabular-nums">{(lambda * s.kl).toFixed(3)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">beam search finds −10</dt>
              <dd className="tabular-nums">{(plan.beamHit * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">best of 32 finds −10</dt>
              <dd className="tabular-nums">{(plan.bestHit * 100).toFixed(1)}%</dd>
            </div>
          </dl>
          <svg viewBox="0 0 200 80" className="w-full max-w-[240px]" role="img" aria-label="Expected objective under the prior for each number of updates.">
            <line x1={8} y1={SY(-10)} x2={192} y2={SY(-10)} stroke="var(--border)" strokeDasharray="3 3" />
            <polyline
              points={curve.map((j, k) => `${f2(SX(k))},${f2(SY(j))}`).join(" ")}
              fill="none"
              stroke="oklch(0.62 0.15 250)"
              strokeWidth={2}
            />
            <circle cx={f2(SX(n))} cy={f2(SY(curve[n]))} r={3.5} fill="oklch(0.65 0.18 30)" />
            <text x={192} y={SY(-10) - 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
              best J = −10
            </text>
          </svg>
        </div>
      </div>
      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        Shading: expected visits of a plan drawn from the prior after {n} update{n === 1 ? "" : "s"} at
        λ = {lambda}. Dashed: the prior&rsquo;s average move sequence, which is where a single Gaussian
        centred on it would aim; with two equally good routes, above and below the wall, the average
        runs into the wall. Solid: the plan beam search returns on one call. Success rates are over 200
        seeded planning calls with the paper&rsquo;s 32-candidate budget. Each update gains at least
        λ·KL, as Theorem 3.1 says it must. Our toy, with a perfect value function and exact
        resampling in place of a diffusion model.
      </p>
    </figure>
  )
}
