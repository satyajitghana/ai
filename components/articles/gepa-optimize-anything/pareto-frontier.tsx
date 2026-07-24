"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why GEPA selects parents from a Pareto frontier instead of always mutating the
// single best-on-average prompt. Each dot is a candidate prompt scored on two task
// instances. "Greedy" keeps only the highest-average candidate; "Pareto" keeps every
// non-dominated candidate — including specialists that win one instance outright and
// would be thrown away by an average. Toggle to see what greedy discards. Illustrative.

const ACCENT = "oklch(0.62 0.19 285)" // indigo — kept candidates
const WARM = "oklch(0.70 0.15 55)" // amber — the specialist greedy discards

const W = 560
const H = 380
const ML = 46
const MR = 18
const MT = 20
const MB = 42
const PX0 = ML
const PX1 = W - MR
const PY0 = MT
const PY1 = H - MB

const x = (v: number) => PX0 + (v / 100) * (PX1 - PX0)
const y = (v: number) => PY1 - (v / 100) * (PY1 - PY0)
const r2 = (n: number) => Math.round(n * 100) / 100

type P = { id: string; a: number; b: number; front: boolean }
// non-dominated (frontier) candidates, sorted by objective A ascending
const FRONT: P[] = [
  { id: "α", a: 30, b: 92, front: true }, // specialist: best on B, weak on A
  { id: "β", a: 58, b: 80, front: true },
  { id: "γ", a: 78, b: 62, front: true }, // best average
  { id: "δ", a: 92, b: 34, front: true }, // specialist: best on A
]
const DOM: P[] = [
  { id: "e", a: 40, b: 55, front: false },
  { id: "f", a: 55, b: 45, front: false },
  { id: "g", a: 22, b: 58, front: false },
  { id: "h", a: 70, b: 40, front: false },
  { id: "i", a: 48, b: 28, front: false },
  { id: "j", a: 64, b: 54, front: false },
  { id: "k", a: 35, b: 72, front: false },
]
const PTS = [...FRONT, ...DOM]
// best-on-average candidate = γ (avg 70); the specialist greedy discards = α
const GREEDY = "γ"

type Mode = "greedy" | "pareto"

export function ParetoFrontier() {
  const [mode, setMode] = useState<Mode>("pareto")
  const [hover, setHover] = useState<string | null>(null)

  const frontierPath =
    "M " + FRONT.map((p) => `${r2(x(p.a))} ${r2(y(p.b))}`).join(" L ")

  const kept = (p: P) => (mode === "greedy" ? p.id === GREEDY : p.front)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>selection · why keep a frontier, not the best?</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter of candidate prompts scored on two task instances. In ${mode} mode, ${
            mode === "greedy" ? "only the best-average candidate is kept" : "all four non-dominated candidates on the Pareto frontier are kept"
          }.`}
        >
          <defs>
            <filter id="pf-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* gridlines + axis ticks */}
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={PY0} x2={x(t)} y2={PY1} stroke="var(--border)" strokeWidth={1} opacity={t === 0 ? 0.6 : 0.25} />
              <line x1={PX0} y1={y(t)} x2={PX1} y2={y(t)} stroke="var(--border)" strokeWidth={1} opacity={t === 0 ? 0.6 : 0.25} />
              <text x={x(t)} y={PY1 + 14} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{t}</text>
              <text x={PX0 - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>{t}</text>
            </g>
          ))}

          {/* axis labels */}
          <text x={(PX0 + PX1) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>score · task instance A →</text>
          <text x={14} y={(PY0 + PY1) / 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10} transform={`rotate(-90 14 ${(PY0 + PY1) / 2})`}>score · task instance B →</text>

          {/* Pareto frontier line (only in pareto mode) */}
          {mode === "pareto" && (
            <path d={frontierPath} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7} />
          )}

          {/* points */}
          {PTS.map((p) => {
            const isKept = kept(p)
            const isSpecialist = p.id === "α" || p.id === "δ"
            const isDiscarded = mode === "greedy" && p.id === "α"
            const fill = isDiscarded ? WARM : isKept ? ACCENT : "var(--muted-foreground)"
            const rad = isKept ? 7 : 4.5
            const op = isKept ? 1 : 0.3
            const showTag = hover === p.id || (mode === "pareto" && p.front) || isDiscarded
            return (
              <g
                key={p.id}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={x(p.a)}
                  cy={y(p.b)}
                  r={rad}
                  fill={fill}
                  opacity={op}
                  stroke={isKept ? "var(--background)" : "none"}
                  strokeWidth={1.5}
                  filter={isKept ? "url(#pf-soft)" : undefined}
                  className="transition-all duration-300"
                />
                {showTag && (
                  <text
                    x={x(p.a)}
                    y={y(p.b) - (rad + 6)}
                    textAnchor="middle"
                    fill={isDiscarded ? WARM : isKept ? ACCENT : "var(--muted-foreground)"}
                    className="font-mono"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {p.id}
                    {isSpecialist ? " ·spec" : ""}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">selection</span>
            {(["greedy", "pareto"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={mode === m ? { background: ACCENT } : undefined}
              >
                {m === "greedy" ? "keep best-average" : "keep Pareto frontier"}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            kept <span style={{ color: ACCENT }}>{mode === "greedy" ? 1 : FRONT.length}</span> of {PTS.length}
          </div>
        </div>

        <p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground sm:min-h-[3rem]">
          {mode === "greedy" ? (
            <>
              Greedy keeps only the highest-<span className="text-foreground">average</span> prompt (<span style={{ color: ACCENT }}>γ</span>).
              The specialist <span style={{ color: WARM }}>α</span> — which is best of all on instance B — looks mediocre on
              average and gets thrown away, so its lessons can never be recombined.
            </>
          ) : (
            <>
              GEPA keeps every <span className="text-foreground">non-dominated</span> candidate — the four on the frontier,
              including both specialists <span style={{ color: ACCENT }}>α</span> and <span style={{ color: ACCENT }}>δ</span> —
              and samples parents from that set. A prompt that wins even one instance stays in the gene pool.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
