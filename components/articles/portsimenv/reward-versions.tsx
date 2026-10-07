"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The three reward functions that are all still in berth_core/reward.py,
// plotted over the same five eval tasks the source article charts:
//
//   v1 score     infeasible 0.2 x clean; cost > naive: 0.2 + 0.4 naive/cost;
//                else 0.6 + 0.4 (naive - cost) / (naive - optimum)
//   v2 score_v2  0.2 + 0.8 exp(-g / 0.25), g = (cost - optimum) / (naive - optimum)
//   v3 score_v3  0.2 + 0.8 exp(-g / 0.5),  g = (cost - optimum) / (optimum - floor + 100)
//
// dock-v1 tasks carry rules.reward = 3, so only v3 is live. Optimum, naive
// and greedy costs are the task's stored reference; the floor is
// check.unavoidable_cost, which I recomputed for each task; model costs are
// the dock-eval50 rollouts (results/rollouts/dock-eval50/index.json), feasible
// plans only. My recomputed v3 matches every stored rollout reward.

type Task = {
  id: string
  label: string
  floor: number
  optimum: number
  naive: number
  greedy: number
  models: { name: string; cost: number }[]
}

const TASKS: Task[] = [
  {
    id: "dock-24B-w37x1-standard-0",
    label: "standard · APM · 15 ships",
    floor: 144,
    optimum: 229,
    naive: 734,
    greedy: 534,
    models: [
      { name: "GPT-6.1 Sol", cost: 229 },
      { name: "Sonnet 5.5", cost: 229 },
      { name: "GLM-5.3", cost: 254 },
      { name: "Qwen3.8-27B", cost: 263 },
    ],
  },
  {
    id: "dock-24B-w16x1-busy-0",
    label: "busy · APM · 16 ships",
    floor: 737,
    optimum: 1349,
    naive: 4069,
    greedy: 1641,
    models: [
      { name: "GPT-6.1 Sol", cost: 1349 },
      { name: "Sonnet 5.5", cost: 1365 },
      { name: "GLM-5.3-Flash", cost: 1415 },
      { name: "Qwen3.8-2.4T", cost: 1497 },
    ],
  },
  {
    id: "dock-36A-w06x1-busy-0",
    label: "busy · BEST · 25 ships",
    floor: 0,
    optimum: 40,
    naive: 824,
    greedy: 191,
    models: [
      { name: "GPT-6.1 Sol", cost: 40 },
      { name: "Sonnet 5.5", cost: 60 },
      { name: "Qwen3.8-2.4T", cost: 67 },
    ],
  },
  {
    id: "dock-24B-w35x2-storm-1",
    label: "storm · APM · 24 ships",
    floor: 244,
    optimum: 312,
    naive: 2701,
    greedy: 642,
    models: [
      { name: "GPT-6.1 Sol", cost: 312 },
      { name: "GLM-5.3-Flash", cost: 332 },
      { name: "Qwen3.8-2.4T", cost: 342 },
      { name: "Sonnet 5.5", cost: 381 },
    ],
  },
  {
    id: "dock-24B-w16x2-extreme-0",
    label: "extreme · APM · 28 ships",
    floor: 347,
    optimum: 466,
    naive: 1485,
    greedy: 860,
    models: [
      { name: "GPT-6.1 Sol", cost: 466 },
      { name: "GLM-5.3", cost: 466 },
      { name: "Sonnet 5.5", cost: 519 },
      { name: "Qwen3.8-2.4T", cost: 692 },
    ],
  },
]

const v1 = (c: number, t: Task) =>
  c > t.naive ? 0.2 + (0.4 * t.naive) / c : 0.6 + (0.4 * (t.naive - c)) / Math.max(1, t.naive - t.optimum)
const v2 = (c: number, t: Task) => 0.2 + 0.8 * mexp(-Math.max(0, c - t.optimum) / Math.max(1, t.naive - t.optimum) / 0.25)
const v3 = (c: number, t: Task) =>
  0.2 + 0.8 * mexp(-(Math.max(0, c - t.optimum) / (Math.max(0, t.optimum - t.floor) + 100)) / 0.5)

const CURVES = [
  { key: "v1", label: "v1: anchored on the naive re-plan", fn: v1, color: "oklch(0.65 0.03 260)", dash: "5 4" },
  { key: "v2", label: "v2: gap over naive − optimum", fn: v2, color: "oklch(0.62 0.13 300)", dash: "2 3" },
  { key: "v3", label: "v3 (live): gap over the avoidable cost", fn: v3, color: "oklch(0.62 0.16 45)", dash: "" },
] as const

const W = 720
const H = 300
const padL = 40
const padR = 16
const padT = 16
const padB = 38
const r2 = (n: number) => Math.round(n * 100) / 100

export function RewardVersions() {
  const [ti, setTi] = useState(3)
  const t = TASKS[ti]
  const lo = t.optimum * 0.85
  const hi = t.naive * 1.08
  const [frac, setFrac] = useState(0.2)
  const cost = Math.round(mpow(10, mlog(lo) / mlog(10) + frac * (mlog(hi) / mlog(10) - mlog(lo) / mlog(10))))
  const clamped = Math.max(t.optimum, cost)

  const sx = (c: number) => r2(padL + ((mlog(c) - mlog(lo)) / (mlog(hi) - mlog(lo))) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - v) * (H - padT - padB))

  const paths = useMemo(() => {
    const out: Record<string, string> = {}
    for (const cv of CURVES) {
      const pts: string[] = []
      const N = 180
      for (let i = 0; i <= N; i++) {
        const c = mpow(10, mlog(t.optimum) / mlog(10) + (i / N) * (mlog(hi) / mlog(10) - mlog(t.optimum) / mlog(10)))
        pts.push(`${sx(c)},${sy(cv.fn(c, t))}`)
      }
      out[cv.key] = pts.join(" ")
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ti])

  const ticks = useMemo(() => {
    const cands = [10, 20, 30, 50, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000]
    return cands.filter((c) => c >= lo && c <= hi)
  }, [lo, hi])

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">three rewards in reward.py, one task at a time</span>
        <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TASKS.map((x, i) => (
            <button key={x.id} type="button" className={chip(i === ti)} onClick={() => setTi(i)}>
              {x.label}
            </button>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Reward against plan cost on a log axis for ${t.label}: optimum ${t.optimum}, floor ${t.floor}, naive re-plan ${t.naive}, greedy ${t.greedy}. Three curves: v1 anchored on the naive plan, v2 scaled by naive minus optimum, v3 scaled by the avoidable cost. At a cost of ${clamped}, v1 gives ${v1(clamped, t).toFixed(2)}, v2 ${v2(clamped, t).toFixed(2)}, v3 ${v3(clamped, t).toFixed(2)}.`}
        >
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((g) => (
            <g key={g}>
              <line x1={padL} x2={W - padR} y1={sy(g)} y2={sy(g)} stroke="currentColor" strokeOpacity={g === 0.2 ? 0.25 : 0.07} />
              <text x={padL - 6} y={sy(g) + 3} textAnchor="end" fontSize="9" className="fill-muted-foreground/70 font-mono">
                {g.toFixed(1)}
              </text>
            </g>
          ))}
          <rect x={padL} y={sy(0.2)} width={W - padL - padR} height={r2(sy(0) - sy(0.2))} fill="oklch(0.6 0.2 25)" fillOpacity={0.06} />
          <text x={W - padR - 4} y={r2(sy(0.1) + 3)} textAnchor="end" fontSize="9" className="fill-muted-foreground font-mono">
            any rule broken: 0 to 0.2
          </text>
          {ticks.map((c) => (
            <text key={c} x={sx(c)} y={H - padB + 14} textAnchor="middle" fontSize="9" className="fill-muted-foreground/70 font-mono">
              {c}
            </text>
          ))}
          <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" fontSize="9.5" className="fill-muted-foreground font-mono">
            plan cost (log scale)
          </text>
          {[
            { c: t.optimum, l: "optimum" },
            { c: t.greedy, l: "greedy" },
            { c: t.naive, l: "naive" },
          ].map((m) => (
            <g key={m.l}>
              <line x1={sx(m.c)} x2={sx(m.c)} y1={padT} y2={sy(0)} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 3" />
              <text x={r2(sx(m.c) + 3)} y={padT + 9} fontSize="9" className="fill-muted-foreground font-mono">
                {m.l} {m.c}
              </text>
            </g>
          ))}
          {CURVES.map((cv) => (
            <polyline key={cv.key} points={paths[cv.key]} fill="none" stroke={cv.color} strokeWidth={cv.key === "v3" ? 2.4 : 1.6} strokeDasharray={cv.dash} />
          ))}
          {t.models.map((m, k) => (
            <g key={m.name}>
              <circle cx={sx(Math.max(m.cost, lo))} cy={sy(v3(m.cost, t))} r={3.6} fill="oklch(0.62 0.16 45)" stroke="white" strokeWidth={1} />
              <text x={r2(sx(Math.max(m.cost, lo)) + 6)} y={r2(sy(v3(m.cost, t)) + 12 + k * 10)} fontSize="8.5" className="fill-foreground/80 font-mono">
                {m.name} {m.cost}
              </text>
            </g>
          ))}
          <line x1={sx(clamped)} x2={sx(clamped)} y1={padT} y2={sy(0)} stroke="currentColor" strokeOpacity={0.7} />
        </svg>
        <label className="mt-2 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-28 shrink-0">your plan: {clamped}</span>
          <Range min={0} max={1} step={0.005} value={frac} onChange={(e) => setFrac(Number(e.target.value))} aria-label="plan cost" />
        </label>
        <div className="mt-2 grid gap-1.5 font-mono text-[11px] sm:grid-cols-3">
          {CURVES.map((cv) => (
            <div key={cv.key} className="rounded-md border px-2.5 py-1.5">
              <span className="mr-1.5 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: cv.color }} />
              <span className="text-muted-foreground">{cv.label}</span>
              <div className="text-sm font-semibold">{cv.fn(clamped, t).toFixed(3)}</div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Optimum, greedy and naive costs are each task&rsquo;s stored references; floors recomputed with the environment&rsquo;s{" "}
        <code>unavoidable_cost</code> rule; dots are the feasible eval plans on the live v3 curve. Only v3 grades dock-v1.
      </figcaption>
    </figure>
  )
}
