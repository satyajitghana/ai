"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Fitness against evaluations spent, and what selection on a small fitness
// set does to the number you report.
//
// A search proposes N candidates one after another. Candidate i has a true
// accuracy p_i that drifts upward as the search learns:
//
//   p_i = 0.66 + 0.07 · (1 − exp(−i / 35)) + 0.025 · z_i,   z_i ~ N(0, 1)   (clipped to [0.3, 0.95])
//
// Its fitness is measured on n items: m_i = Binomial(n, p_i) / n. The search
// keeps the candidate with the best measured fitness. Three lines over the
// item-generations spent (i · n): the best measured fitness so far, the true
// accuracy of that incumbent, and the best true accuracy among candidates
// evaluated so far. The gap between the first two at the end is the winner's
// curse. The search model is invented (seeded); only the sampling arithmetic is
// real. Baphomet's own four fitness numbers sit in a separate strip below.

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NMAX = 200
const ITEM_SETS = [40, 110, 180, 400]
const SEEDS = [1, 2, 3, 4, 5]

type Run = {
  p: number[]
  m: number[]
}

function simulate(seed: number, n: number): Run {
  const r = rng(seed * 7919 + 13)
  const p: number[] = []
  const m: number[] = []
  for (let i = 0; i < NMAX; i++) {
    const u1 = Math.max(1e-9, r())
    const u2 = r()
    const z = Math.sqrt(-2 * mlog(u1)) * mcos(2 * Math.PI * u2)
    const pi = Math.min(0.95, Math.max(0.3, 0.66 + 0.07 * (1 - mexp(-i / 35)) + 0.025 * z))
    let k = 0
    for (let j = 0; j < n; j++) if (r() < pi) k++
    p.push(pi)
    m.push(k / n)
  }
  return { p, m }
}

const pct = (v: number) => (Math.round(v * 1000) / 10).toFixed(1)

export function CurseSim() {
  const [n, setN] = useState(110)
  const [count, setCount] = useState(104)
  const [seed, setSeed] = useState(1)

  const run = useMemo(() => simulate(seed, n), [seed, n])

  const series = useMemo(() => {
    const best: number[] = []
    const incTrue: number[] = []
    const bestTrue: number[] = []
    let bi = 0
    let bt = 0
    for (let i = 0; i < count; i++) {
      if (run.m[i] > run.m[bi]) bi = i
      if (run.p[i] > bt) bt = run.p[i]
      best.push(run.m[bi])
      incTrue.push(run.p[bi])
      bestTrue.push(bt)
    }
    const rank = run.p.slice(0, count).filter((v) => v > run.p[bi]).length + 1
    return { best, incTrue, bestTrue, pick: bi, rank }
  }, [run, count])

  const W = 720
  const H = 250
  const L = 52
  const R = 16
  const T = 14
  const B = 34
  const spent = count * n
  const x = (i: number) => L + ((i + 1) / count) * (W - L - R)
  const yMin = 0.55
  const yMax = 0.95
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B)
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Math.max(yMin, Math.min(yMax, v))).toFixed(1)}`).join(" ")

  const last = count - 1
  const measured = series.best[last]
  const truth = series.incTrue[last]
  const se180 = Math.sqrt((truth * (1 - truth)) / 180)
  const xticks = [0.25, 0.5, 0.75, 1].map((f) => Math.round(f * count))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">fitness against evaluations spent</span>
        <span className="font-mono text-[10px] text-muted-foreground">simulated search, seeded; not Baphomet&apos;s run</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            candidates evaluated: <span className="text-foreground">{count}</span>
            <Range min={10} max={NMAX} step={2} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full" aria-label="candidates" />
          </label>
          <div>
            <span className="block font-mono text-[11px] text-muted-foreground">items per fitness evaluation</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <div className="flex rounded-md border p-0.5" role="group" aria-label="items per evaluation">
                {ITEM_SETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setN(v)}
                    className={cn("rounded px-2.5 py-1 font-mono text-[11px]", n === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex rounded-md border p-0.5" role="group" aria-label="seed">
                {SEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeed(s)}
                    className={cn("rounded px-2 py-1 font-mono text-[11px]", seed === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                    aria-label={`seed ${s}`}
                  >
                    s{s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Line chart of fitness against item-generations spent: best measured fitness, the true accuracy of that pick, and the best true accuracy so far.">
          {[0.6, 0.7, 0.8, 0.9].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          {xticks.map((i) => (
            <text key={i} x={x(i - 1)} y={H - 14} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
              {(i * n).toLocaleString("en-US")}
            </text>
          ))}
          <text x={L} y={H - 2} className="fill-muted-foreground font-mono text-[10px]">
            item-generations spent (candidates × items)
          </text>
          <path d={path(series.bestTrue)} fill="none" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth={1.5} strokeDasharray="4 4" />
          <path d={path(series.incTrue)} fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={2} />
          <path d={path(series.best)} fill="none" className="stroke-foreground" strokeWidth={2} />
          <circle cx={x(series.pick)} cy={y(Math.min(yMax, run.m[series.pick]))} r={4} className="fill-foreground" />
          <circle cx={x(series.pick)} cy={y(run.p[series.pick])} r={4} className="fill-sky-600 dark:fill-sky-400" />
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-0.5 w-4 bg-foreground align-middle" />
            best measured fitness so far
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-4 bg-sky-600 align-middle dark:bg-sky-400" />
            true accuracy of that pick
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-4 border-t border-dashed border-emerald-600 align-middle dark:border-emerald-400" />
            best true accuracy evaluated
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {[
            ["evaluations spent", spent.toLocaleString("en-US"), "item-generations"],
            ["pick, measured", `${pct(measured)}%`, `on ${n} items`],
            ["pick, true", `${pct(truth)}%`, `${measured >= truth ? "+" : "−"}${pct(Math.abs(measured - truth))} pts optimism`],
            ["pick's true rank", `${series.rank} of ${count}`, `180-item test SE ±${pct(se180)} pts`],
          ].map(([a, v, c]) => (
            <div key={a} className="rounded-md border bg-muted/20 px-2.5 py-2">
              <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{a}</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{v}</dd>
              <dd className="font-mono text-[9px] text-muted-foreground">{c}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 rounded-md border p-3">
          <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">Baphomet&apos;s own numbers, from the model card</div>
          <svg viewBox="0 0 720 86" className="mt-2 w-full" role="img" aria-label="Fitness on the 110-item set: Baphomet 1.0 0.603, round one best 0.722, round two best 0.733, Baphomet 1.1 0.764. Held-out 180-item test: 1.0 at 77.8 percent, 1.1 at 79.4 percent.">
            {(() => {
              const sx = (v: number) => 40 + ((v - 0.55) / (0.85 - 0.55)) * 640
              const pts: [number, string, number][] = [
                [0.603, "1.0", 0],
                [0.722, "round 1", 1],
                [0.733, "round 2", 0],
                [0.764, "1.1", 1],
              ]
              return (
                <g>
                  <line x1={40} x2={680} y1={30} y2={30} className="stroke-border" />
                  <text x={0} y={34} className="fill-muted-foreground font-mono text-[10px]">fit</text>
                  {pts.map(([v, lab, up]) => (
                    <g key={lab}>
                      <circle cx={sx(v)} cy={30} r={4.5} className="fill-foreground" />
                      <text x={sx(v)} y={up ? 16 : 50} textAnchor="middle" className="fill-foreground font-mono text-[10px]">
                        {lab} {v.toFixed(3)}
                      </text>
                    </g>
                  ))}
                  <line x1={40} x2={680} y1={72} y2={72} className="stroke-border" />
                  <text x={0} y={76} className="fill-muted-foreground font-mono text-[10px]">test</text>
                  {[
                    [0.778, "1.0 77.8%"],
                    [0.794, "1.1 79.4%"],
                  ].map(([v, lab], i) => (
                    <g key={lab as string}>
                      <circle cx={sx(v as number)} cy={72} r={4.5} className="fill-sky-600 dark:fill-sky-400" />
                      <text x={sx(v as number) + (i ? 8 : -8)} y={66} textAnchor={i ? "start" : "end"} className="fill-foreground font-mono text-[10px]">
                        {lab as string}
                      </text>
                    </g>
                  ))}
                </g>
              )
            })()}
          </svg>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Fitness: 110 items at a 4,096-token cap, the set the search selected on. Test: 180 other items at 8,192. The
            same axis, from 55% to 85%.
          </p>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The black line only goes up: it is a maximum. The blue line is what that maximum is worth on fresh items, and it
          sits below. Shrink the fitness set to 40 items and the gap widens; grow it to 400 and it narrows, at ten times
          the evaluation bill. More candidates on a fixed set buy a higher black line faster than a higher blue one.
        </p>
      </div>
    </figure>
  )
}
