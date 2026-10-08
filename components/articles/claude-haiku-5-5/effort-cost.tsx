"use client"

import { useState } from "react"
import { mlog } from "@/lib/dmath"

// Cost per task by effort level, decoded from the four accuracy-vs-cost charts
// on anthropic.com/claude-haiku-5-5. Those charts are inline SVG: each point is
// a <circle cx cy>, and each axis tick is a positioned label. Fitting the tick
// positions (log scale for cost, linear for score) turns every circle back into
// numbers. They are accurate to about a pixel: the decoded GDPval medium point
// reads 1275 Elo against the system card's 1277. Haiku 4.5 ran with a fixed
// thinking budget on these benchmarks (it has no effort setting).

type Pt = { effort: string; cost: number; score: number }
type Bench = { id: string; name: string; unit: string; h45: { cost: number; score: number }; h55: Pt[] }

const BENCHES: Bench[] = [
  {
    id: "osworld",
    name: "OSWorld 2.1 (offline)",
    unit: "%",
    h45: { cost: 1.455, score: 15.7 },
    h55: [
      { effort: "low", cost: 0.0698, score: 42.0 },
      { effort: "medium", cost: 0.1262, score: 53.3 },
      { effort: "high", cost: 0.1828, score: 61.4 },
      { effort: "xhigh", cost: 0.2799, score: 67.6 },
      { effort: "max", cost: 0.613, score: 72.4 },
    ],
  },
  {
    id: "gdpval",
    name: "GDPval-AA v2.1",
    unit: " Elo",
    h45: { cost: 0.24, score: 735 },
    h55: [
      { effort: "low", cost: 0.0116, score: 1125 },
      { effort: "medium", cost: 0.0305, score: 1275 },
      { effort: "high", cost: 0.0891, score: 1418 },
      { effort: "xhigh", cost: 0.2679, score: 1512 },
      { effort: "max", cost: 0.867, score: 1620 },
    ],
  },
  {
    id: "hle",
    name: "HLE, no tools",
    unit: "%",
    h45: { cost: 0.0936, score: 10.2 },
    h55: [
      { effort: "low", cost: 0.0033, score: 31.0 },
      { effort: "medium", cost: 0.0069, score: 35.5 },
      { effort: "high", cost: 0.0203, score: 39.7 },
      { effort: "xhigh", cost: 0.0647, score: 44.1 },
      { effort: "max", cost: 0.2143, score: 45.9 },
    ],
  },
  {
    id: "tb",
    name: "Terminal-Bench 4.0",
    unit: "%",
    h45: { cost: 0.791, score: 0 },
    h55: [
      { effort: "low", cost: 0.4247, score: 12.7 },
      { effort: "medium", cost: 0.6809, score: 20.2 },
      { effort: "high", cost: 1.04, score: 24.8 },
      { effort: "xhigh", cost: 1.758, score: 31.4 },
      { effort: "max", cost: 2.65, score: 39.2 },
    ],
  },
]

const W = 720
const H = 250
const PL = 24
const PR = 696
const AXIS_Y = 190
const LO = 0.002
const HI = 4

const r1 = (n: number) => Math.round(n * 10) / 10
const xOf = (c: number) => r1(PL + ((mlog(c) - mlog(LO)) / (mlog(HI) - mlog(LO))) * (PR - PL))
const TICKS = [0.01, 0.1, 1]

const CHEAP = "oklch(0.6 0.13 160)"
const DEAR = "oklch(0.6 0.17 30)"
const BASE = "oklch(0.62 0.03 260)"

function fmtCost(c: number) {
  return c < 0.01 ? `$${c.toFixed(4)}` : c < 1 ? `$${c.toFixed(3)}` : `$${c.toFixed(2)}`
}

export function EffortCost() {
  const [id, setId] = useState("gdpval")
  const b = BENCHES.find((x) => x.id === id) ?? BENCHES[0]
  const baseX = xOf(b.h45.cost)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cost per task by effort · Haiku 5.5 vs Haiku 4.5</span>
        <span className="text-muted-foreground/60">decoded from Anthropic&apos;s charts</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {BENCHES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${x.id === id ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {x.name}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${b.name}: Haiku 4.5 costs ${fmtCost(b.h45.cost)} per task. Haiku 5.5 costs ${b.h55.map((p) => `${fmtCost(p.cost)} at ${p.effort}`).join(", ")}.`}>
          <line x1={PL} y1={AXIS_Y} x2={PR} y2={AXIS_Y} stroke="var(--border)" strokeWidth={1} />
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={xOf(t)} y1={AXIS_Y} x2={xOf(t)} y2={AXIS_Y + 5} stroke="var(--muted-foreground)" strokeWidth={1} />
              <text x={xOf(t)} y={AXIS_Y + 18} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>{`$${t}`}</text>
            </g>
          ))}
          <text x={(PL + PR) / 2} y={AXIS_Y + 40} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>cost per task, USD, log scale</text>

          <rect x={PL} y={20} width={Math.max(0, baseX - PL)} height={AXIS_Y - 20} fill={CHEAP} opacity={0.06} />
          <rect x={baseX} y={20} width={Math.max(0, PR - baseX)} height={AXIS_Y - 20} fill={DEAR} opacity={0.06} />
          <line x1={baseX} y1={14} x2={baseX} y2={AXIS_Y} stroke={BASE} strokeWidth={2} strokeDasharray="5 4" />
          <text x={baseX} y={10} textAnchor="middle" className="font-mono" fontSize={10} fill={BASE}>
            {`Haiku 4.5 · ${fmtCost(b.h45.cost)} · ${b.h45.score}${b.unit}`}
          </text>

          {b.h55.map((p, i) => {
            const x = xOf(p.cost)
            const y = 40 + i * 30
            const cheaper = p.cost < b.h45.cost
            const pct = Math.round((p.cost / b.h45.cost - 1) * 100)
            const right = x < PR - 170
            return (
              <g key={p.effort}>
                <line x1={x} y1={y} x2={x} y2={AXIS_Y} stroke={cheaper ? CHEAP : DEAR} strokeWidth={1} strokeOpacity={0.35} />
                <circle cx={x} cy={y} r={6} fill={cheaper ? CHEAP : DEAR} stroke="var(--background)" strokeWidth={1.5} />
                <text x={right ? x + 11 : x - 11} y={y + 4} textAnchor={right ? "start" : "end"} className="fill-foreground font-mono" fontSize={11}>
                  {`${p.effort} · ${fmtCost(p.cost)} · ${pct > 0 ? "+" : ""}${pct}% · ${p.score}${b.unit}`}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Green points cost less per task than Haiku 4.5, orange points cost more. Each label gives the effort level,
          the cost per task, the change against Haiku 4.5, and the score. The launch table quotes the max-effort score.
          On three of these four benchmarks, max effort costs more per task than Haiku 4.5 did. The default effort is
          medium.
        </p>
      </div>
    </figure>
  )
}
