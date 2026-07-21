"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// DSpark's second idea, drawn as a chart. A confidence head scores each drafted
// position (the bars); a hardware-aware scheduler keeps only the leading prefix
// whose confidence clears a threshold τ (the horizontal line), and routes scarce
// target-batch capacity to those tokens. Drag τ — and flip the load — to see the
// verify length trade against wasted compute. Illustrative confidences (a plausible
// decay along the block); the real head is trained end-to-end and post-hoc calibrated.

const GREEN = "oklch(0.72 0.15 150)"

// per-position confidence, decaying down the W=5 block (drafts get less certain)
const CONF = [0.97, 0.88, 0.74, 0.58, 0.41]
const TOK = ["E", "F", "G", "H", "I"]

// scene geometry (viewBox units)
const W = 460
const H = 200
const PAD_L = 34
const PAD_R = 14
const TOP = 16
const PLOT_H = 132 // bar plot height
const BASE = TOP + PLOT_H // y of the baseline
const COLW = (W - PAD_L - PAD_R) / CONF.length
const barW = COLW * 0.5
const colCx = (i: number) => PAD_L + COLW * (i + 0.5)
const yFor = (c: number) => BASE - c * PLOT_H

export function ConfidenceScheduler() {
  const [tau, setTau] = useState(0.55)
  const [heavy, setHeavy] = useState(false)

  // keep the leading run of positions whose confidence clears τ
  let kept = 0
  for (const c of CONF) {
    if (c >= tau) kept++
    else break
  }
  const expected = CONF.slice(0, kept).reduce((a, b) => a + b, 0) + 1
  const wasted = heavy ? CONF.length - kept : 0
  const recommend = heavy ? 0.7 : 0.2
  const tauY = yFor(tau)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">confidence-scheduled verification</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "light load" },
            { v: true, label: "heavy load" },
          ].map((o) => (
            <button key={o.label} type="button" onClick={() => setHeavy(o.v)} aria-pressed={heavy === o.v}
              className={cn("cursor-pointer rounded-md px-2 py-1 transition-colors",
                heavy === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={`Confidence bars for 5 drafted tokens with threshold tau at ${tau.toFixed(2)}; leading ${kept} kept`}>
          <defs>
            <filter id="cs-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* y gridlines at 0.25 / 0.5 / 0.75 / 1.0 */}
          {[0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={PAD_L} y1={yFor(v)} x2={W - PAD_R} y2={yFor(v)} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text x={PAD_L - 6} y={yFor(v) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8}>{v.toFixed(2)}</text>
            </g>
          ))}

          {/* bars */}
          {CONF.map((c, i) => {
            const inPrefix = i < kept
            return (
              <g key={i}>
                <rect x={colCx(i) - barW / 2} y={yFor(c)} width={barW} height={c * PLOT_H} rx={4}
                  fill={inPrefix ? GREEN : "var(--muted-foreground)"} opacity={inPrefix ? 1 : 0.3}
                  filter={inPrefix ? "url(#cs-soft)" : undefined} className="transition-all duration-200" />
                <text x={colCx(i)} y={yFor(c) - 5} textAnchor="middle" className="fill-muted-foreground font-mono tabular-nums" fontSize={9}>{c.toFixed(2)}</text>
                <text x={colCx(i)} y={BASE + 15} textAnchor="middle"
                  className={inPrefix ? "fill-foreground font-mono" : "fill-muted-foreground/60 font-mono"}
                  fontSize={11} fontWeight={600} textDecoration={inPrefix ? undefined : "line-through"}>{TOK[i]}</text>
                <text x={colCx(i)} y={BASE + 29} textAnchor="middle"
                  className="font-mono" fontSize={8} fill={inPrefix ? GREEN : "var(--muted-foreground)"} opacity={inPrefix ? 1 : 0.6}>
                  {inPrefix ? "verify" : "drop"}
                </text>
              </g>
            )
          })}

          {/* baseline */}
          <line x1={PAD_L} y1={BASE} x2={W - PAD_R} y2={BASE} stroke="var(--border)" strokeWidth={1.5} />

          {/* threshold τ line */}
          <line x1={PAD_L} y1={tauY} x2={W - PAD_R} y2={tauY} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="5 4" className="transition-all duration-200" />
          <g className="transition-all duration-200" style={{ transform: `translateY(${tauY}px)` }}>
            <rect x={W - PAD_R - 52} y={-9} width={52} height={17} rx={4} fill="var(--foreground)" />
            <text x={W - PAD_R - 26} y={3} textAnchor="middle" className="font-mono tabular-nums" fontSize={9} fontWeight={600} fill="var(--background)">τ {tau.toFixed(2)}</text>
          </g>
        </svg>

        {/* threshold slider */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>drag confidence threshold τ</span>
            <span className="tabular-nums text-foreground">{tau.toFixed(2)}</span>
          </div>
          <Range min={0} max={0.99} step={0.01} value={tau}
            onChange={(e) => setTau(parseFloat(e.target.value))}
            className="w-full cursor-pointer " aria-label="confidence threshold" accent="var(--foreground)" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>prefix verified <span className="text-foreground">{kept}/{CONF.length}</span></span>
          <span>expected accepted <span className="text-foreground">~{expected.toFixed(1)} tok</span></span>
          <span className="ml-auto">{heavy ? <>wasted verifies <span className="text-foreground">{wasted}</span></> : <>spare capacity <span className="text-foreground">ample</span></>}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {heavy ? (
            <>
              Under heavy concurrency, target-batch slots are precious. Verifying the low-confidence tail just burns them on tokens that will be rejected — so the scheduler raises τ (try{" "}
              <button type="button" onClick={() => setTau(recommend)}
                className="cursor-pointer underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground">τ ≈ {recommend}</button>
              ), trims the block to its confident head, and spends the freed capacity on more requests.
            </>
          ) : (
            <>
              With GPUs underutilized, verification is nearly free — so the scheduler drops τ (try{" "}
              <button type="button" onClick={() => setTau(recommend)}
                className="cursor-pointer underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground">τ ≈ {recommend}</button>
              ), verifies the whole block, and squeezes out every accepted token it can. The length is chosen per request, from live engine load.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
