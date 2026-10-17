"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

import { BUDGET, VALLEYS, score, simulate, spread, type Mechanisms } from "./collapse-sim"

// An illustrative toy, not RSI-top: a 2D "idea landscape" with five valleys of
// different depth, a native search that keeps refining its best point in the
// direction that last helped, and a stall-triggered cohort of four agents whose
// three diversity mechanisms can be switched on and off. Every configuration
// spends the same 240 evaluations; an intervention costs 8 of them.

const NATIVE = "oklch(0.6 0.1 220)"
const OURS = "oklch(0.6 0.19 18)"
const LAND = "oklch(0.55 0.16 285)"

const G = 30 // heat-map cells per side
const S = 300 // landscape size in px
const r1 = (v: number) => Math.round(v * 10) / 10

const MECHS: { key: keyof Mechanisms; label: string; hint: string }[] = [
  { key: "views", label: "different views", hint: "each agent ranks the archive by 3 of 5 toy metrics" },
  { key: "ideas", label: "different ideas", hint: "a portfolio of 8 directions, near and far" },
  { key: "lineages", label: "different starting points", hint: "each agent builds on a far-apart branch" },
]

const SEEDS = [1, 2, 3, 4, 5]
const BATCH = Array.from({ length: 20 }, (_, i) => i + 1)

const HEAT = (() => {
  const cells: { x: number; y: number; s: number }[] = []
  for (let i = 0; i < G; i++)
    for (let j = 0; j < G; j++) cells.push({ x: i, y: j, s: score((i + 0.5) / G, (j + 0.5) / G) })
  return cells
})()

export function CollapseToy() {
  const [mech, setMech] = useState<Mechanisms>({ views: false, ideas: false, lineages: false })
  const [rsi, setRsi] = useState(true)
  const [seed, setSeed] = useState(1)
  const [step, setStep] = useState(BUDGET)

  const cfg = rsi ? mech : null
  const res = useMemo(() => simulate(cfg, seed), [cfg, seed])
  const base = useMemo(() => simulate(null, seed), [seed])
  const batch = useMemo(() => {
    const fin = BATCH.map((s) => {
      const r = simulate(cfg, s)
      return { best: r.best[r.best.length - 1], spread: spread(r) }
    })
    const mean = fin.reduce((a, b) => a + b.best, 0) / fin.length
    const deep = fin.filter((f) => f.best > 0.8).length
    const sp = fin.reduce((a, b) => a + b.spread, 0) / fin.length
    return { mean, deep, sp }
  }, [cfg])

  const shown = res.points.slice(0, step)
  const bestNow = res.best[Math.min(step, res.best.length) - 1]
  const firstIv = res.interventions.filter((i) => i < step).length

  // best-so-far curve
  const CW = 340
  const CH = 300
  const cx = (i: number) => 30 + (i / (BUDGET - 1)) * (CW - 40)
  const cy = (v: number) => 14 + (1 - v) * (CH - 44)
  const curve = (b: number[]) =>
    b
      .slice(0, step)
      .map((v, i) => `${i ? "L" : "M"}${r1(cx(i))} ${r1(cy(v))}`)
      .join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">exploration collapse, a toy (illustrative, not RSI-top&apos;s code)</span>
        <button
          type="button"
          onClick={() => setRsi((v) => !v)}
          aria-pressed={rsi}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            rsi ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {rsi ? "stall interventions: on" : "stall interventions: off"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MECHS.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={!rsi}
              onClick={() => setMech((o) => ({ ...o, [m.key]: !o[m.key] }))}
              aria-pressed={mech[m.key]}
              title={m.hint}
              className={cn(
                "cursor-pointer rounded-lg border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                mech[m.key] ? "border-foreground/40 bg-muted/60 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="font-semibold">{mech[m.key] ? "on" : "off"}</span> · {m.label}
              <span className="block text-[10px] text-muted-foreground">{m.hint}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <svg viewBox={`0 0 ${S} ${S}`} className="w-full rounded-md border border-border/50" role="img" aria-label={`Idea landscape with five valleys of depth 0.55 to 1.0. After ${step} evaluations the best depth found is ${bestNow.toFixed(2)}.`}>
            {HEAT.map((c) => (
              <rect key={`${c.x}-${c.y}`} x={(c.x * S) / G} y={(c.y * S) / G} width={S / G + 0.5} height={S / G + 0.5} fill={LAND} fillOpacity={r1(c.s * 8) / 10} />
            ))}
            {VALLEYS.map((v) => (
              <text key={v.name} x={r1(v.x * S)} y={r1(v.y * S) - 10} textAnchor="middle" fontSize={11} className="fill-foreground font-mono font-semibold">
                {v.name} {v.depth.toFixed(2)}
              </text>
            ))}
            {shown.map((p, i) =>
              p.by === "cohort" && p.parent >= 0 ? (
                <line
                  key={`l${i}`}
                  x1={r1(res.points[p.parent].x * S)}
                  y1={r1(res.points[p.parent].y * S)}
                  x2={r1(p.x * S)}
                  y2={r1(p.y * S)}
                  stroke={OURS}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              ) : null,
            )}
            {shown.map((p, i) => (
              <circle key={`p${i}`} cx={r1(p.x * S)} cy={r1(p.y * S)} r={p.by === "cohort" ? 3 : 2} fill={p.by === "cohort" ? OURS : NATIVE} fillOpacity={0.85} />
            ))}
          </svg>

          <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label={`Best depth so far over ${BUDGET} evaluations, for this configuration and for the native search alone.`}>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={`g${v}`}>
                <line x1={30} x2={CW - 10} y1={r1(cy(v))} y2={r1(cy(v))} stroke="var(--border)" strokeOpacity={0.4} />
                <text x={26} y={r1(cy(v)) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                  {v.toFixed(2)}
                </text>
              </g>
            ))}
            {res.interventions
              .filter((i) => i < step)
              .map((i) => (
                <line key={`iv${i}`} x1={r1(cx(i))} x2={r1(cx(i))} y1={CH - 30} y2={CH - 24} stroke={OURS} strokeWidth={2} />
              ))}
            <path d={curve(base.best)} fill="none" stroke={NATIVE} strokeWidth={2} strokeDasharray={rsi ? "4 3" : undefined} />
            {rsi ? <path d={curve(res.best)} fill="none" stroke={OURS} strokeWidth={2.4} /> : null}
            <text x={30} y={CH - 8} fontSize={9} className="fill-muted-foreground font-mono">
              evaluations →   ticks: interventions
            </text>
          </svg>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              seed
              {SEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeed(s)}
                  aria-pressed={s === seed}
                  className={cn(
                    "cursor-pointer rounded border px-1.5 py-0.5 tabular-nums",
                    s === seed ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </span>
            <span className="tabular-nums text-foreground">
              eval {step} / {BUDGET} · best {bestNow.toFixed(2)} · {firstIv} interventions
            </span>
          </div>
          <Range min={1} max={BUDGET} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} className="w-full cursor-pointer" accent={OURS} aria-label="Evaluations so far" />
        </div>

        <div className="mt-3 rounded-lg border border-border/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          across 20 seeds, this configuration: mean best depth{" "}
          <span className="text-foreground tabular-nums">{batch.mean.toFixed(2)}</span>, runs that reach depth above 0.8:{" "}
          <span className="text-foreground tabular-nums">{batch.deep} of 20</span>, valleys touched on average:{" "}
          <span className="text-foreground tabular-nums">{batch.sp.toFixed(1)} of 5</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The native search keeps building on its best point and keeps stepping the way that last worked, so it
          settles in valley A and stays. With interventions on and every mechanism off, the four agents read the
          same frontier and propose the same small tweak: more evaluations, same valley. In this toy no single
          mechanism escapes reliably; branching from different places and proposing far-apart ideas together is what
          reaches the deeper valleys. The numbers are the toy&apos;s, not the paper&apos;s.
        </p>
      </div>
    </figure>
  )
}
