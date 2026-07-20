"use client"

import { useState } from "react"

// Harness leverage. Efficiency (cost cut) is model-invariant — every model gets
// 32-61% cheaper. But the QUALITY gain from the same orchestration upgrade
// scales almost perfectly with a model's baseline strength (r = 0.99, n = 6).
// x = mean baseline capability, y = quality gain from the harness. Scrub the
// slider to highlight one model. Numbers read from the paper's Figure 6
// (Sayed Ali et al., 2026); the fitted line is least-squares over the six points.

const ACCENT = "oklch(0.62 0.14 250)"
const r2 = (n: number) => Math.round(n * 100) / 100

type M = { name: string; x: number; y: number; cost: number }

// ordered weakest -> strongest baseline so the slider reads left -> right
const MODELS: M[] = [
  { name: "Qwen 3.6", x: 0.710, y: -0.031, cost: 44 },
  { name: "Flash 3.5", x: 0.740, y: 0.010, cost: 61 },
  { name: "GLM 5.1", x: 0.752, y: 0.029, cost: 48 },
  { name: "Gemini 3.1", x: 0.765, y: 0.050, cost: 32 },
  { name: "Sonnet 4.6", x: 0.788, y: 0.073, cost: 38 },
  { name: "Palmyra X6", x: 0.792, y: 0.079, cost: 52 },
]

// least-squares fit over the six points (module scope, deterministic)
const n = MODELS.length
const mx = MODELS.reduce((s, m) => s + m.x, 0) / n
const my = MODELS.reduce((s, m) => s + m.y, 0) / n
const slope = MODELS.reduce((s, m) => s + (m.x - mx) * (m.y - my), 0) / MODELS.reduce((s, m) => s + (m.x - mx) ** 2, 0)
const intercept = my - slope * mx
const fit = (x: number) => slope * x + intercept

const W = 760
const H = 430
const PL = 72, PR = 724, PT = 44, PB = 344
const XMIN = 0.695, XMAX = 0.802
const YMIN = -0.045, YMAX = 0.092

const xPix = (x: number) => r2(PL + ((x - XMIN) / (XMAX - XMIN)) * (PR - PL))
const yPix = (y: number) => r2(PB - ((y - YMIN) / (YMAX - YMIN)) * (PB - PT))

const X_TICKS = [0.70, 0.72, 0.74, 0.76, 0.78, 0.80]
const Y_TICKS = [-0.04, 0, 0.04, 0.08]

const signed = (v: number) => (v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3))

export function HarnessLeverage() {
  const [sel, setSel] = useState(5) // Palmyra X6 — the leader
  const s = MODELS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>harness leverage · quality gain vs baseline strength</span>
        <span className="text-muted-foreground/50">r = 0.99 · n = 6</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Scatter of quality gain from the harness against baseline model strength. ${s.name} at baseline ${s.x.toFixed(2)} gains ${signed(s.y)} quality, and is ${s.cost}% cheaper. Points rise almost perfectly with baseline strength, r = 0.99.`}>
          <defs>
            <filter id="hl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* x gridlines + ticks */}
          {X_TICKS.map((x) => (
            <g key={`x${x}`}>
              <line x1={xPix(x)} y1={PT} x2={xPix(x)} y2={PB} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.4} />
              <text x={xPix(x)} y={PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{x.toFixed(2)}</text>
            </g>
          ))}
          {/* y gridlines + ticks */}
          {Y_TICKS.map((y) => (
            <g key={`y${y}`}>
              <line x1={PL} y1={yPix(y)} x2={PR} y2={yPix(y)} stroke={y === 0 ? "var(--muted-foreground)" : "var(--border)"} strokeWidth={1} strokeDasharray={y === 0 ? "4 3" : undefined} strokeOpacity={y === 0 ? 0.6 : 0.4} />
              <text x={PL - 8} y={yPix(y) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{signed(y)}</text>
            </g>
          ))}
          {/* axis labels */}
          <text x={(PL + PR) / 2} y={PB + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>mean baseline capability →</text>
          <text x={PL - 10} y={PT - 14} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>quality gain from harness (Δq̄)</text>
          <text x={PR} y={yPix(0) - 6} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>parity</text>

          {/* fitted line across the domain */}
          <line x1={xPix(XMIN + 0.004)} y1={yPix(fit(XMIN + 0.004))} x2={xPix(XMAX - 0.004)} y2={yPix(fit(XMAX - 0.004))} stroke={ACCENT} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.6} />
          <text x={xPix(0.775)} y={yPix(fit(0.775)) - 8} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} fill={ACCENT}>r = 0.99</text>

          {/* points */}
          {MODELS.map((m, i) => {
            const active = i === sel
            const cx = xPix(m.x)
            const cy = yPix(m.y)
            return (
              <g key={m.name}>
                {active ? (
                  <>
                    <line x1={cx} y1={cy} x2={cx} y2={PB} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                    <line x1={PL} y1={cy} x2={cx} y2={cy} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                  </>
                ) : null}
                <circle cx={cx} cy={cy} r={active ? 7 : 5} fill={active ? ACCENT : "var(--muted-foreground)"} fillOpacity={active ? 1 : 0.45} stroke="var(--background)" strokeWidth={1.5} filter={active ? "url(#hl-soft)" : undefined} className="transition-all duration-200" />
                <text x={cx} y={cy - (active ? 13 : 10)} textAnchor="middle" className="font-mono" fontSize={active ? 11 : 9} fontWeight={active ? 600 : 400} fill={active ? ACCENT : "var(--muted-foreground)"}>{m.name}</text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
          <span>
            <span style={{ color: ACCENT }}>{s.name}</span> · baseline {s.x.toFixed(2)}
          </span>
          <span>
            quality <span style={{ color: ACCENT }}>{signed(s.y)}</span>
          </span>
          <span className="ml-auto">cost still <span className="text-foreground">−{s.cost}%</span></span>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">highlight model — weaker → stronger baseline (drag)</div>
          <input type="range" min={0} max={MODELS.length - 1} value={sel} onChange={(e) => setSel(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.14_250)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two different stories on two axes. On <span className="text-foreground">cost</span> every model
          wins — 32% to 61% cheaper — so efficiency is a property of the harness, not the model. On{" "}
          <span style={{ color: ACCENT }}>quality</span>, the gain climbs the diagonal with baseline
          strength: Palmyra X6 and Sonnet 4.6 lead (+0.079, +0.073), while Qwen 3.6 actually regresses
          (−0.031) yet is still 44% cheaper. Stronger models extract more from the same orchestration
          upgrade — that is the leverage.
        </p>
      </div>
    </figure>
  )
}
