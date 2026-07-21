"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Token maxing. Drag the horizon: as an agentic task runs longer / wider,
// tokens per task climb steeply while the per-token price keeps falling — yet
// total spend still rises, because tokens grow faster than price drops. The
// falling price masks the rising bill. Two curves + a live spend readout. Shapes
// are illustrative; the mechanism (spend = tokens x price) is the paper's point
// (Sayed Ali et al., 2026).

const ACCENT = "oklch(0.62 0.14 250)"
const r2 = (n: number) => Math.round(n * 100) / 100

const KMAX = 24
const TOK_MAX = 62000

const tokensAt = (u: number) => 2000 + 58000 * Math.pow(u, 1.8)
const priceAt = (u: number) => 10 * Math.exp(-1.4 * u) // $ / MTok
const spendAt = (u: number) => (tokensAt(u) / 1e6) * priceAt(u) // $ / task

const W = 760
const H = 380
const PL = 66, PR = 686, PT = 40, PB = 300

const xPix = (u: number) => r2(PL + u * (PR - PL))
const yTok = (t: number) => r2(PB - (t / TOK_MAX) * (PB - PT))
const yPrc = (p: number) => r2(PB - (p / 10) * (PB - PT))

function pathOf(f: (u: number) => number, yScale: (v: number) => number) {
  const steps = 72
  let d = ""
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    d += (i === 0 ? "M " : "L ") + xPix(u) + " " + yScale(f(u)) + " "
  }
  return d.trim()
}
const TOK_PATH = pathOf(tokensAt, yTok)
const PRC_PATH = pathOf(priceAt, yPrc)

const X_TICKS = [1, 6, 12, 18, 24]
const TOK_TICKS = [0, 20000, 40000, 60000]
const PRC_TICKS = [0, 5, 10]

export function TokenMaxing() {
  const [k, setK] = useState(6)
  const u = (k - 1) / (KMAX - 1)
  const tok = tokensAt(u)
  const prc = priceAt(u)
  const spend = spendAt(u)
  const spendBarW = r2(Math.min(1, spend / 0.16) * 150)
  const mx = xPix(u)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>token maxing · price falls, spend rises</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Over ${k} turns, tokens per task reach ${Math.round(tok / 1000)}k while price falls to $${prc.toFixed(2)} per million tokens, yet total spend rises to $${spend.toFixed(3)} per task.`}>
          <defs>
            <filter id="tm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* horizontal gridlines from token ticks */}
          {TOK_TICKS.map((t) => (
            <line key={`g${t}`} x1={PL} y1={yTok(t)} x2={PR} y2={yTok(t)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.35} />
          ))}
          {/* left axis: tokens */}
          {TOK_TICKS.map((t) => (
            <text key={`tl${t}`} x={PL - 8} y={yTok(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{t === 0 ? "0" : `${t / 1000}k`}</text>
          ))}
          {/* right axis: price */}
          {PRC_TICKS.map((p) => (
            <text key={`pr${p}`} x={PR + 8} y={yPrc(p) + 3} textAnchor="start" className="font-mono" fontSize={9} fill={ACCENT} opacity={0.8}>{`$${p}`}</text>
          ))}
          {/* x ticks */}
          {X_TICKS.map((t) => {
            const ux = (t - 1) / (KMAX - 1)
            return (
              <text key={`x${t}`} x={xPix(ux)} y={PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{t}</text>
            )
          })}
          <text x={(PL + PR) / 2} y={PB + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>agent turns / task horizon (k) →</text>
          <text x={PL - 8} y={PT - 14} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>tokens / task</text>
          <text x={PR + 8} y={PT - 14} textAnchor="end" className="font-mono" fontSize={10} fill={ACCENT}>price $/MTok</text>

          {/* curves */}
          <path d={PRC_PATH} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeOpacity={0.7} strokeDasharray="5 4" />
          <path d={TOK_PATH} fill="none" stroke={ACCENT} strokeWidth={2.4} filter="url(#tm-soft)" />

          {/* marker */}
          <line x1={mx} y1={PT} x2={mx} y2={PB} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <circle cx={mx} cy={yTok(tok)} r={4.5} fill={ACCENT} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={mx} cy={yPrc(prc)} r={4.5} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={2} />

          {/* curve labels */}
          <text x={xPix(0.9)} y={yTok(tokensAt(0.9)) - 8} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} fill={ACCENT}>tokens ↑</text>
          <text x={xPix(0.82)} y={yPrc(priceAt(0.82)) + 16} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--muted-foreground)">price ↓</text>
        </svg>

        {/* readout */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
          <span>tokens/task <span className="text-foreground">{(tok / 1000).toFixed(1)}k</span></span>
          <span>price <span className="text-foreground">${prc.toFixed(2)}</span>/MTok ↓</span>
          <span className="flex items-center gap-2">
            total spend <span style={{ color: ACCENT }} className="font-semibold">${spend.toFixed(3)}</span> ↑
            <span className="inline-block h-2 rounded-full" style={{ width: spendBarW / 3, background: ACCENT }} aria-hidden />
          </span>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">task horizon — more turns, wider context (drag)</div>
          <Range min={1} max={KMAX} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.62 0.14 250)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag right. The per-token <span className="text-muted-foreground">price</span> keeps falling —
          the number everyone quotes when they say inference is getting cheaper. But{" "}
          <span style={{ color: ACCENT }}>tokens per task</span> climb faster, so the product of the two,{" "}
          <span style={{ color: ACCENT }}>total spend</span>, rises the whole way. That is token maxing:
          the falling headline price masks a rising bill.
        </p>
      </div>
    </figure>
  )
}
