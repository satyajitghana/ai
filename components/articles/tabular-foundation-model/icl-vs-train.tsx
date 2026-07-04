"use client"

import { useState } from "react"

// The shape of the work, contrasted honestly. A gradient-boosted tree (XGBoost/LightGBM)
// fits your table with a loop of boosting rounds before it can predict; TabFM skips the
// loop entirely — your table is the context, and prediction is one forward pass. Drag the
// rounds to feel the sequential fit pile up. This is about the WORKFLOW, not accuracy:
// which is faster to stand up is a different question from which predicts better (the Elo
// chart answers that). Schematic.

const SEL = "oklch(0.60 0.15 255)"
const MUT = "var(--muted-foreground)"

const W = 760
const H = 236

export function IclVsTrain() {
  const [rounds, setRounds] = useState(200)
  const nDots = Math.min(22, Math.round(rounds / 14))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>two ways to predict a table · fit-loop vs one pass</span>
        <span className="text-muted-foreground/50">schematic</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Gradient-boosted trees run ${rounds} sequential boosting rounds before predicting; TabFM predicts in one forward pass with the table as context.`}>
          <defs>
            <marker id="vt-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SEL} strokeWidth={1.5} />
            </marker>
            <marker id="vt-arrow-m" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="6" refY="0">
              <path d="M0,-3.5L5,0L0,3.5" fill="none" stroke={MUT} strokeWidth={1.4} />
            </marker>
            <filter id="vt-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ── Lane A: gradient-boosted trees ── */}
          <text x={20} y={30} className="fill-muted-foreground font-mono" fontSize={11}>gradient-boosted trees (XGBoost / LightGBM)</text>
          <g>
            <rect x={20} y={44} width={90} height={40} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
            <text x={65} y={68} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>train set</text>

            {/* boosting rounds pile up sequentially */}
            {Array.from({ length: nDots }, (_, i) => (
              <circle key={i} cx={128 + i * 19} cy={64} r={5} fill={MUT} opacity={0.35 + (i / 22) * 0.5} className="transition-all duration-200" />
            ))}
            {nDots > 0 && (
              <path d={`M 122 64 C 128 64, ${128 + (nDots - 1) * 19} 64, ${134 + (nDots - 1) * 19} 64`} fill="none" stroke={MUT} strokeWidth={1.3} opacity={0.4} markerEnd="url(#vt-arrow-m)" />
            )}
            <text x={128 + 10.5 * 19} y={44} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{rounds} sequential boosting rounds</text>

            <rect x={556} y={44} width={96} height={40} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#vt-soft)" />
            <text x={604} y={68} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>fitted model</text>
            <path d={`M 652 64 C 662 64, 662 64, 668 64`} fill="none" stroke={MUT} strokeWidth={1.4} markerEnd="url(#vt-arrow-m)" />
            <rect x={674} y={48} width={66} height={32} rx={7} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.2} />
            <text x={707} y={68} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>predict</text>
          </g>

          {/* divider */}
          <line x1={20} y1={120} x2={740} y2={120} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />

          {/* ── Lane B: TabFM ── */}
          <text x={20} y={152} className="font-mono" fontSize={11} fontWeight={600} style={{ fill: SEL }}>TabFM · in-context</text>
          <g>
            <rect x={20} y={166} width={90} height={40} rx={8} fill="var(--background)" stroke={SEL} strokeWidth={1.5} filter="url(#vt-soft)" />
            <text x={65} y={185} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>your table</text>
            <text x={65} y={198} textAnchor="middle" className="font-mono" fontSize={8} style={{ fill: SEL }}>= context</text>

            <path d={`M 110 186 C 300 186, 460 186, 668 186`} fill="none" stroke={SEL} strokeWidth={1.8} markerEnd="url(#vt-arrow)" />
            <text x={388} y={176} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} style={{ fill: SEL }}>1 forward pass · no fit loop</text>

            <rect x={674} y={170} width={66} height={32} rx={7} fill="var(--background)" stroke={SEL} strokeWidth={1.5} filter="url(#vt-soft)" />
            <text x={707} y={190} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>predict</text>
          </g>
        </svg>

        {/* control */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>boosting rounds (drag) · {rounds}</span>
            <span>trees: {rounds} rounds · <span style={{ color: SEL }}>TabFM: 1 pass</span></span>
          </div>
          <input type="range" min={0} max={300} step={10} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.60_0.15_255)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The difference is the <span className="text-foreground">shape of the work</span>, not a quality claim. A boosted
          tree must <em>fit</em> your table — a sequential loop of rounds — before it predicts; TabFM folds the table in as
          context and answers in a single pass, no per-dataset training. Which one predicts <span className="text-foreground">better</span>
          {" "}is a separate question, and the honest answer lives in the Elo chart below, where the comparison is
          ensemble-vs-ensemble.
        </p>
      </div>
    </figure>
  )
}
