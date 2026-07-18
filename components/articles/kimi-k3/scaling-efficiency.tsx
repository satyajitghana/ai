"use client"

import { useState } from "react"

// Scaling efficiency, as a chart. K3's architecture + recipe convert compute into
// capability ~2.5x more efficiently than K2: it reaches the same capability at about
// 1/2.5 the training compute. Two saturating curves over log-compute; drag the
// capability marker and read off the compute K3 saves. Illustrative shape; the 2.5x
// figure is Moonshot's reported overall scaling-efficiency gain.

const ACCENT = "oklch(0.58 0.15 265)"
const MUTED = "var(--muted-foreground)"

const W = 760
const H = 400
const PL = 66 // plot left
const PR = 720
const PT = 54
const PB = 300

const LOG_MIN = -0.7
const LOG_MAX = 1.9
const KK = 2.4
const C0_K2 = -0.25
const C0_K3 = -0.25 - 0.39794 // shift left by log10(2.5) -> 2.5x less compute

const xPix = (L: number) => PL + ((L - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (PR - PL)
const yPix = (cap: number) => PB - (cap / 100) * (PB - PT)
const capAt = (L: number, c0: number) => Math.max(0, Math.min(100, 100 * (1 - Math.exp(-KK * (L - c0)))))

function curve(c0: number): string {
  const steps = 72
  let d = ""
  for (let i = 0; i <= steps; i++) {
    const L = LOG_MIN + ((LOG_MAX - LOG_MIN) * i) / steps
    d += (i === 0 ? "M " : "L ") + xPix(L).toFixed(1) + " " + yPix(capAt(L, c0)).toFixed(1) + " "
  }
  return d
}
const PATH_K2 = curve(C0_K2)
const PATH_K3 = curve(C0_K3)

const X_TICKS = [0, 0.7, 1.3, 1.9] // log10 relative compute
const Y_TICKS = [50, 70, 90]

export function ScalingEfficiency() {
  const [cap, setCap] = useState(80)

  const ln = Math.log(1 - cap / 100) // negative
  const LK2 = C0_K2 - ln / KK
  const LK3 = C0_K3 - ln / KK
  const ratio = Math.pow(10, LK2 - LK3)
  const r2 = (n: number): number => Math.round(n * 100) / 100
  const xk2 = r2(xPix(Math.min(LOG_MAX, LK2)))
  const xk3 = r2(xPix(Math.min(LOG_MAX, LK3)))
  const yc = r2(yPix(cap))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>scaling efficiency · compute → capability</span>
        <span className="text-muted-foreground/50">~2.5× vs K2</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Capability versus training compute for K2 and K3; at capability ${cap}, K3 needs about ${ratio.toFixed(1)} times less compute than K2.`}>
          <defs>
            <marker id="se-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="5" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.4} />
            </marker>
            <filter id="se-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* gridlines + x ticks */}
          {X_TICKS.map((L) => (
            <g key={`x${L}`}>
              <line x1={xPix(L)} y1={PT} x2={xPix(L)} y2={PB} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.4} />
              <text x={xPix(L)} y={PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {Math.round(Math.pow(10, L))}×
              </text>
            </g>
          ))}
          {/* y ticks */}
          {Y_TICKS.map((c) => (
            <g key={`y${c}`}>
              <line x1={PL} y1={yPix(c)} x2={PR} y2={yPix(c)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.4} />
              <text x={PL - 8} y={yPix(c) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {c}
              </text>
            </g>
          ))}
          <text x={(PL + PR) / 2} y={PB + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            relative training compute (log)
          </text>
          <text x={PL - 8} y={PT - 8} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>
            capability
          </text>

          {/* curves */}
          <path d={PATH_K2} fill="none" stroke={MUTED} strokeWidth={2} strokeOpacity={0.7} />
          <path d={PATH_K3} fill="none" stroke={ACCENT} strokeWidth={2.4} filter="url(#se-soft)" />

          {/* capability marker line + dots */}
          <line x1={PL} y1={yc} x2={PR} y2={yc} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <line x1={xk3} y1={yc} x2={xk2} y2={yc} stroke={ACCENT} strokeWidth={1.6} markerStart="url(#se-arrow)" markerEnd="url(#se-arrow)" />
          <circle cx={xk2} cy={yc} r={4.5} fill="var(--background)" stroke={MUTED} strokeWidth={2} />
          <circle cx={xk3} cy={yc} r={4.5} fill={ACCENT} stroke="var(--background)" strokeWidth={1.5} />
          <text x={(xk2 + xk3) / 2} y={yc - 8} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} style={{ fill: ACCENT }}>
            {ratio.toFixed(1)}× less compute
          </text>

          {/* curve labels */}
          <text x={xPix(1.9) - 4} y={yPix(capAt(1.9, C0_K2)) + 14} textAnchor="end" className="font-mono" fontSize={10} fill={MUTED}>K2</text>
          <text x={xPix(1.55)} y={yPix(capAt(1.55, C0_K3)) - 8} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} style={{ fill: ACCENT }}>K3</text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="font-mono text-[11px] text-muted-foreground">
            target capability <span style={{ color: ACCENT }}>{cap}</span>
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            K3 reaches it at <span style={{ color: ACCENT }}>{ratio.toFixed(1)}×</span> less training compute than K2
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">capability level (drag)</div>
          <input type="range" min={55} max={95} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.15_265)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same axes, two models: at any capability you pick, the <span style={{ color: ACCENT }}>K3</span> curve gets there
          well to the left of <span className="text-foreground">K2</span> — about <span style={{ color: ACCENT }}>2.5×</span>{" "}
          less training compute. That is the whole point of the architecture and recipe changes: not a bigger number on a
          spec sheet, but more capability per FLOP spent.
        </p>
      </div>
    </figure>
  )
}
