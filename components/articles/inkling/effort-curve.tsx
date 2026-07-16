"use client"

import { useState } from "react"

// Controllable effort, drawn as a curve. Inkling varies how many tokens it spends
// per query via the system message + a per-token cost, trading accuracy for
// efficiency. Thinking Machines report that on Terminal-Bench-2.1 it reaches
// Nemotron-3-Ultra-equivalent accuracy at ~1/3 the generated tokens. Drag the
// effort knob and the same score sits ~3x further right on the reference curve.
// The curve SHAPE is illustrative; the real anchors are the ~63.8% TB-2.1 plateau
// and the reported ~1/3-token match — not independently verified.

const INK = "oklch(0.58 0.16 285)"
const REF = "oklch(0.66 0.03 275)"

const P = 66 // accuracy plateau (%), just above Inkling's 63.8 TB-2.1
const TAU = 9000 // Inkling token constant
const TMAX = 90000 // x-axis max (mean generated tokens)

const W = 760
const H = 360
const PL = 54
const PR = 22
const PT = 26
const PB = 48
const YMAX = 70

const accInk = (t: number) => P * (1 - Math.exp(-t / TAU))
const accNem = (t: number) => P * (1 - Math.exp(-t / (3 * TAU)))

const xAt = (t: number) => PL + (t / TMAX) * (W - PL - PR)
const yAt = (a: number) => PT + (1 - a / YMAX) * (H - PT - PB)

const TICKS_X = [0, 20000, 40000, 60000, 80000]
const TICKS_Y = [0, 20, 40, 60]

const kfmt = (t: number) => (t === 0 ? "0" : `${(t / 1000).toFixed(0)}k`)

const path = (f: (t: number) => number) => {
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * TMAX
    pts.push(`${i === 0 ? "M" : "L"} ${xAt(t).toFixed(1)} ${yAt(f(t)).toFixed(1)}`)
  }
  return pts.join(" ")
}

export function EffortCurve() {
  const [effort, setEffort] = useState(0.55)

  const tInk = 2500 + effort * (26000 - 2500)
  const acc = accInk(tInk)
  const tNem = 3 * tInk // Nemotron reaches the SAME accuracy here, by the ~3x claim
  const ratio = tNem / tInk

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>controllable effort · Terminal-Bench-2.1</span>
        <span className="text-muted-foreground/60">illustrative curve</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">accuracy at this effort</div>
            <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: INK }}>
              {acc.toFixed(1)}<span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: INK }}>Inkling tokens</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: INK }}>{kfmt(tInk)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: REF }}>Nemotron for same score</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: REF }}>{kfmt(tNem)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">Inkling spends</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
                1/{ratio.toFixed(0)}<span className="text-xs text-muted-foreground"> the tokens</span>
              </div>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At this effort Inkling reaches ${acc.toFixed(1)} percent on Terminal-Bench-2.1 using ${kfmt(tInk)} tokens; the reference curve needs about ${kfmt(tNem)} tokens for the same score`}>
          <defs>
            <marker id="ink-eff-dot" viewBox="0 0 10 10" markerWidth="5" markerHeight="5" refX="5" refY="5">
              <circle cx="5" cy="5" r="4" fill={INK} />
            </marker>
          </defs>

          {/* gridlines + axes */}
          {TICKS_Y.map((a) => (
            <g key={a}>
              <line x1={PL} x2={W - PR} y1={yAt(a)} y2={yAt(a)} stroke="currentColor" className="text-border" strokeWidth={1} opacity={a === 0 ? 1 : 0.5} />
              <text x={PL - 8} y={yAt(a) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>{a}</text>
            </g>
          ))}
          {TICKS_X.map((t) => (
            <text key={t} x={xAt(t)} y={H - PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>{kfmt(t)}</text>
          ))}

          {/* Nemotron reference curve */}
          <path d={path(accNem)} fill="none" stroke={REF} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
          {/* Inkling curve */}
          <path d={path(accInk)} fill="none" stroke={INK} strokeWidth={2.75} strokeLinecap="round" />

          {/* matched-accuracy tie: horizontal from Inkling point to Nemotron point */}
          <line x1={xAt(tInk)} x2={xAt(tNem)} y1={yAt(acc)} y2={yAt(acc)} stroke="currentColor" className="text-foreground/25" strokeWidth={1} strokeDasharray="2 3" />
          <line x1={xAt(tInk)} x2={xAt(tInk)} y1={yAt(acc)} y2={H - PB} stroke={INK} strokeWidth={1} opacity={0.4} />
          <line x1={xAt(tNem)} x2={xAt(tNem)} y1={yAt(acc)} y2={H - PB} stroke={REF} strokeWidth={1} opacity={0.4} />

          {/* the two matched points */}
          <circle cx={xAt(tNem)} cy={yAt(acc)} r={4.5} fill="var(--background)" stroke={REF} strokeWidth={2} />
          <circle cx={xAt(tInk)} cy={yAt(acc)} r={5} fill={INK} stroke="var(--background)" strokeWidth={1.5} />

          {/* labels on curves */}
          <text x={xAt(78000)} y={yAt(accNem(78000)) - 8} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>Nemotron-3-Ultra (ref)</text>
          <text x={xAt(52000)} y={yAt(accInk(52000)) - 9} textAnchor="middle" className="font-mono" fontSize={10} fill={INK}>Inkling</text>

          <text x={(PL + W - PR) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>mean generated tokens per task →</text>
          <text x={16} y={PT + 4} className="fill-muted-foreground font-mono" fontSize={10} transform={`rotate(-90 16 ${(PT + H - PB) / 2})`}>accuracy %</text>
        </svg>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>effort knob (system message + per-token cost) — drag</span>
            <span>{(effort * 100).toFixed(0)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={effort} onChange={(e) => setEffort(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.16_285)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both curves climb toward the same ceiling — but Inkling gets there{" "}
          <span className="text-foreground">sooner</span>. Read the tie line: at whatever score the effort knob
          lands on, the reference model needs roughly <span style={{ color: REF }}>three times</span> the tokens
          to match it. Turn effort down and you trade a little accuracy for a lot fewer tokens; turn it up and you
          approach the <span style={{ color: INK }}>~63.8%</span> Terminal-Bench-2.1 plateau. The ~1/3-token figure
          is Thinking Machines&apos; own measurement.
        </p>
      </div>
    </figure>
  )
}
