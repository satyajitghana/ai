"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How wide is a medal-rate interval at this paper's scale, and what does the
// paper's own interval leave out?
//
// The model. Each task t has its own medal probability p_t, drawn from some
// distribution over tasks with mean m. A run medals with probability p_t. The
// reported number is the macro average over T tasks of the per-task mean over
// N seeds. Split a single run's variance m(1-m) into a between-task share rho
// (how far apart the tasks' p_t are: rho = 1 means every task is a sure medal
// or a sure miss) and a within-task share 1 - rho (seed luck). Then:
//
//   tasks held fixed, seeds resampled (the paper's bootstrap, Appendix A.5):
//       Var = m(1-m)(1-rho) / (N T)
//   tasks and seeds both resampled (a fresh draw of tasks from the same pool):
//       Var = m(1-m)(rho + (1-rho)/N) / T
//
// rho is not printed in the paper. The presets back it out of the paper's own
// printed interval, assuming the interval is roughly normal: e.g. Malena on
// GLM 5.2, fixed30, 62.5 [58.3, 66.7] with 4 seeds gives rho ~ 0.76. That is
// an estimate from one number under a model, which is why the prose says
// "reasoned" about everything this widget prints.
//
// Only + - * / and sqrt, which IEEE-754 makes exact on every engine.

type Preset = {
  id: string
  name: string
  m: number
  T: number
  N: number
  rho: number
  printed?: [number, number]
}

const PRESETS: Preset[] = [
  { id: "glm30", name: "Malena · GLM 5.2 · fixed30", m: 62.5, T: 30, N: 4, rho: 0.76, printed: [58.3, 66.7] },
  { id: "ais30", name: "AiScientist · GLM 5.2 · fixed30", m: 47.1, T: 30, N: 4, rho: 0.69, printed: [42.3, 52.2] },
  { id: "base14", name: "Malena base · fixed14", m: 55.7, T: 14, N: 3, rho: 0.76, printed: [48.2, 62.9] },
  { id: "bp14", name: "+B+P3 · fixed14", m: 33.3, T: 14, N: 3, rho: 0.66, printed: [23.8, 40.5] },
  { id: "full75", name: "same agent, all 75 tasks", m: 62.5, T: 75, N: 4, rho: 0.76 },
]

const Z = 1.96
const FIX = "oklch(0.58 0.15 255)"
const FULL = "oklch(0.66 0.16 40)"
const PRINT = "var(--muted-foreground)"

function intervals(mPct: number, T: number, N: number, rho: number) {
  const m = mPct / 100
  const v = m * (1 - m)
  const seSeeds = Math.sqrt((v * (1 - rho)) / (N * T)) * 100
  const seFull = Math.sqrt((v * (rho + (1 - rho) / N)) / T) * 100
  const floor = Math.sqrt((v * rho) / T) * 100 // infinite seeds, tasks still resampled
  const clamp = (a: number) => Math.min(100, Math.max(0, a))
  return {
    seeds: [clamp(mPct - Z * seSeeds), clamp(mPct + Z * seSeeds)] as [number, number],
    full: [clamp(mPct - Z * seFull), clamp(mPct + Z * seFull)] as [number, number],
    halfSeeds: Z * seSeeds,
    halfFull: Z * seFull,
    halfFloor: Z * floor,
  }
}

export function IntervalExplorer() {
  const [pid, setPid] = useState<string>("glm30")
  const [m, setM] = useState(62.5)
  const [T, setT] = useState(30)
  const [N, setN] = useState(4)
  const [rho, setRho] = useState(0.76)

  const preset = PRESETS.find((p) => p.id === pid)
  const printed =
    preset && preset.m === m && preset.T === T && preset.N === N && preset.rho === rho ? preset.printed : undefined

  const load = (p: Preset) => {
    setPid(p.id)
    setM(p.m)
    setT(p.T)
    setN(p.N)
    setRho(p.rho)
  }

  const r = intervals(m, T, N, rho)

  const W = 640
  const L = 150
  const R = 16
  const x = (v: number) => L + (v / 100) * (W - L - R)
  const rows: { label: string; sub: string; iv: [number, number]; color: string }[] = [
    { label: "tasks fixed", sub: "what the paper's bootstrap varies", iv: r.seeds, color: FIX },
    { label: "tasks resampled", sub: "a fresh draw of tasks", iv: r.full, color: FULL },
  ]
  if (printed) rows.unshift({ label: "as printed", sub: "the paper's own bracket", iv: printed, color: PRINT })
  const rowH = 40
  const top = 24
  const H = top + rows.length * rowH + 24

  const step = 100 / T
  const desc = `Medal rate ${m.toFixed(1)} percent on ${T} tasks with ${N} seeds each, between-task share ${rho.toFixed(
    2,
  )}. Holding tasks fixed, the 95 percent interval is ${r.seeds[0].toFixed(1)} to ${r.seeds[1].toFixed(
    1,
  )}. Resampling tasks too, it is ${r.full[0].toFixed(1)} to ${r.full[1].toFixed(1)}.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>how wide is a medal rate?</span>
        <span className="text-muted-foreground/60">normal approximation · numbers computed here</span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => load(p)}
            aria-pressed={pid === p.id}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-[10.5px] transition-colors",
              pid === p.id ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-x-6 gap-y-2 px-4 pt-3 sm:grid-cols-2">
        {(
          [
            ["medal rate", `${m.toFixed(1)}%`, m, 5, 95, 0.5, (v: number) => setM(v), "Medal rate in percent"],
            ["tasks", `${T}`, T, 5, 75, 1, (v: number) => setT(v), "Number of tasks"],
            ["seeds per task", `${N}`, N, 1, 10, 1, (v: number) => setN(v), "Seeds per task"],
            ["between-task share ρ", rho.toFixed(2), rho, 0, 0.95, 0.01, (v: number) => setRho(v), "Between-task share of variance"],
          ] as const
        ).map(([name, shown, val, min, max, st, set, aria]) => (
          <label key={name} className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span className="w-[150px] shrink-0">
              {name} <span className="text-foreground">{shown}</span>
            </span>
            <Range
              min={min}
              max={max}
              step={st}
              value={val}
              onChange={(e) => {
                setPid("")
                set(Number(e.target.value))
              }}
              aria-label={aria}
              className="flex-1"
            />
          </label>
        ))}
      </div>

      <div className="overflow-x-auto px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label={desc}>
          {[0, 20, 40, 60, 80, 100].map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={top - 10} x2={x(t)} y2={H - 20} className="stroke-border" strokeDasharray="2 4" />
              <text x={x(t)} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                {`${t}%`}
              </text>
            </g>
          ))}
          <line x1={x(m)} y1={top - 12} x2={x(m)} y2={H - 20} stroke="currentColor" strokeWidth={1} opacity={0.5} />
          {rows.map((row, i) => {
            const y = top + i * rowH + 10
            return (
              <g key={row.label}>
                <text x={0} y={y + 2} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                  {row.label}
                </text>
                <text x={0} y={y + 14} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                  {row.sub}
                </text>
                <rect
                  x={x(row.iv[0])}
                  y={y - 6}
                  width={Math.max(2, x(row.iv[1]) - x(row.iv[0]))}
                  height={12}
                  rx={3}
                  fill={row.color}
                  opacity={0.75}
                />
                <text x={x(row.iv[1]) + 6} y={y + 3} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                  {`${row.iv[0].toFixed(1)}–${row.iv[1].toFixed(1)}`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid gap-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
        <div>
          one task flipping moves the rate by <span className="text-foreground">{step.toFixed(1)} pts</span>
        </div>
        <div>
          half-width, tasks fixed <span style={{ color: FIX }}>±{r.halfSeeds.toFixed(1)}</span>; resampled{" "}
          <span style={{ color: FULL }}>±{r.halfFull.toFixed(1)}</span>
        </div>
        <div>
          with infinite seeds, resampled still <span className="text-foreground">±{r.halfFloor.toFixed(1)}</span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">
        ρ is backed out of each preset&apos;s printed bracket, so the &ldquo;as printed&rdquo; and &ldquo;tasks fixed&rdquo;
        bars match by construction. The orange bar is the one the paper does not report: how far the number could move on
        another set of tasks of the same kind. More seeds shrink the blue bar toward nothing; only more tasks shrink the
        orange one.
      </figcaption>
    </figure>
  )
}
