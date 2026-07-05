"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// TabFM's 3-stage architecture, drawn as one pipeline you can step through. A table
// flows left→right: (1) COLUMN attention — a Set Transformer over features, so the
// model is permutation-invariant across columns, with Fourier features embedding
// numeric values; (2) ROW compression — each row is squeezed to a CLS token, with RoPE
// position encoding; (3) a 24-block IN-CONTEXT transformer that reads the labeled rows
// as context and predicts the test row. Pick a stage to focus it. Schematic.

const SEL = "oklch(0.60 0.15 255)"

type Stage = "column" | "row" | "icl"
const STAGES: { key: Stage; label: string }[] = [
  { key: "column", label: "column attn" },
  { key: "row", label: "row compress" },
  { key: "icl", label: "ICL ×24" },
]
const CAPTION: Record<Stage, string> = {
  column: "Column attention: a Set Transformer attends across features (order-invariant); numeric values enter via Fourier features.",
  row: "Row compression: each row is pooled to a single CLS token, tagged with RoPE positions so rows keep an order.",
  icl: "In-context transformer: 24 blocks read the labeled rows as context and predict the test row — one forward pass, no training.",
}

const W = 760
const H = 300
const PW = 214
const PY = 46
const PH = 208
const P1 = 20
const P2 = 273
const P3 = 526

export function PipelineStages() {
  const [stage, setStage] = useState<Stage>("column")

  const panelOp = (s: Stage) => (stage === s ? 1 : 0.34)
  const panelStroke = (s: Stage) => (stage === s ? SEL : "var(--border)")

  const hconn = (x1: number, x2: number, y: number) => `M ${x1} ${y} C ${x1 + 16} ${y}, ${x2 - 16} ${y}, ${x2} ${y}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>architecture · table in, prediction out</span>
        <span className="text-muted-foreground/50">schematic</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="TabFM three-stage pipeline: column attention, row compression, then a 24-block in-context transformer.">
          <defs>
            <marker id="ps-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SEL} strokeWidth={1.5} />
            </marker>
            <marker id="ps-arrow-m" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="6" refY="0">
              <path d="M0,-3.5L5,0L0,3.5" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.4} />
            </marker>
            <filter id="ps-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* inter-panel connectors */}
          <path d={hconn(P1 + PW, P2, PY + PH / 2)} fill="none" stroke={SEL} strokeWidth={1.5} markerEnd="url(#ps-arrow)" opacity={0.7} />
          <path d={hconn(P2 + PW, P3, PY + PH / 2)} fill="none" stroke={SEL} strokeWidth={1.5} markerEnd="url(#ps-arrow)" opacity={0.7} />
          <text x={(P1 + PW + P2) / 2} y={PY + PH / 2 - 8} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>rows</text>
          <text x={(P2 + PW + P3) / 2} y={PY + PH / 2 - 8} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>CLS</text>

          {/* ── Panel 1: column attention ── */}
          <g>
            <rect x={P1} y={PY} width={PW} height={PH} rx={12} fill="var(--background)" stroke={panelStroke("column")} strokeWidth={1.5} filter={stage === "column" ? "url(#ps-soft)" : undefined} />
            <text x={P1 + 16} y={PY + 22} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>1 · column attention</text>
            <text x={P1 + 16} y={PY + 37} className="fill-muted-foreground font-mono" fontSize={9}>Set Transformer over features</text>
            <g opacity={panelOp("column")} className="transition-opacity duration-300">
              {/* attention arcs across columns */}
              {[0, 1, 2].map((i) => {
                const cw = 32, gap = 18, x0 = P1 + 18
                const xa = x0 + i * (cw + gap) + cw / 2
                const xb = x0 + (i + 1) * (cw + gap) + cw / 2
                const yTop = PY + 96
                return <path key={i} d={`M ${xa} ${yTop} C ${xa} ${yTop - 26}, ${xb} ${yTop - 26}, ${xb} ${yTop}`} fill="none" stroke={SEL} strokeWidth={1.4} opacity={0.7} />
              })}
              {[0, 1, 2, 3].map((i) => {
                const cw = 32, gap = 18, x0 = P1 + 18
                const x = x0 + i * (cw + gap)
                return (
                  <g key={i}>
                    <rect x={x} y={PY + 98} width={cw} height={28} rx={6} fill="var(--muted)" stroke={SEL} strokeWidth={1.2} />
                    <text x={x + cw / 2} y={PY + 116} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>f{i + 1}</text>
                  </g>
                )
              })}
              <text x={P1 + PW / 2} y={PY + 150} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} style={{ fill: SEL }}>permutation-invariant</text>
              <text x={P1 + PW / 2} y={PY + 176} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>numeric value → Fourier</text>
              <text x={P1 + PW / 2} y={PY + 190} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>features (sin / cos)</text>
            </g>
          </g>

          {/* ── Panel 2: row compression ── */}
          <g>
            <rect x={P2} y={PY} width={PW} height={PH} rx={12} fill="var(--background)" stroke={panelStroke("row")} strokeWidth={1.5} filter={stage === "row" ? "url(#ps-soft)" : undefined} />
            <text x={P2 + 16} y={PY + 22} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>2 · row compression</text>
            <text x={P2 + 16} y={PY + 37} className="fill-muted-foreground font-mono" fontSize={9}>each row → CLS token · RoPE</text>
            <g opacity={panelOp("row")} className="transition-opacity duration-300">
              {[0, 1, 2].map((i) => {
                const y = PY + 66 + i * 40
                const barX = P2 + 18, barW = 96
                const cx = P2 + PW - 34
                return (
                  <g key={i}>
                    <rect x={barX} y={y} width={barW} height={18} rx={5} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
                    <text x={barX + barW / 2} y={y + 13} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>row {i + 1}</text>
                    <path d={`M ${barX + barW} ${y + 9} C ${barX + barW + 12} ${y + 9}, ${cx - 24} ${y + 9}, ${cx - 12} ${y + 9}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#ps-arrow-m)" opacity={0.7} />
                    <circle cx={cx} cy={y + 9} r={11} fill={SEL} opacity={0.9} filter="url(#ps-soft)" />
                    <text x={cx} y={y + 12} textAnchor="middle" fontSize={8} fontWeight={600} fill="var(--background)">CLS</text>
                  </g>
                )
              })}
              <text x={P2 + PW / 2} y={PY + 196} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>one token per row</text>
            </g>
          </g>

          {/* ── Panel 3: ICL transformer ── */}
          <g>
            <rect x={P3} y={PY} width={PW} height={PH} rx={12} fill="var(--background)" stroke={panelStroke("icl")} strokeWidth={1.5} filter={stage === "icl" ? "url(#ps-soft)" : undefined} />
            <text x={P3 + 16} y={PY + 22} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>3 · in-context transformer</text>
            <text x={P3 + 16} y={PY + 37} className="fill-muted-foreground font-mono" fontSize={9}>reads context rows, predicts</text>
            <g opacity={panelOp("icl")} className="transition-opacity duration-300">
              {[0, 1, 2, 3, 4].map((i) => {
                const y = PY + 54 + i * 15
                const bx = P3 + 40, bw = 120
                return <rect key={i} x={bx} y={y} width={bw} height={11} rx={3} fill={SEL} opacity={0.28 + i * 0.06} />
              })}
              <text x={P3 + PW - 20} y={PY + 92} textAnchor="end" className="font-mono" fontSize={11} fontWeight={700} style={{ fill: SEL }}>×24</text>
              <text x={P3 + PW - 20} y={PY + 106} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>blocks</text>
              {/* arrow down to prediction */}
              <path d={`M ${P3 + PW / 2} ${PY + 132} C ${P3 + PW / 2} ${PY + 146}, ${P3 + PW / 2} ${PY + 146}, ${P3 + PW / 2} ${PY + 158}`} fill="none" stroke={SEL} strokeWidth={1.5} markerEnd="url(#ps-arrow)" opacity={0.8} />
              <rect x={P3 + 34} y={PY + 162} width={PW - 68} height={30} rx={8} fill="var(--background)" stroke={SEL} strokeWidth={1.5} filter="url(#ps-soft)" />
              <text x={P3 + PW / 2} y={PY + 181} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>predict label</text>
            </g>
          </g>
        </svg>

        {/* stage control */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">stage</span>
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStage(s.key)}
              aria-pressed={stage === s.key}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors",
                stage === s.key ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="mt-3 min-h-[3rem] text-sm leading-6 text-muted-foreground">
          {CAPTION[stage]}
        </p>
      </div>
    </figure>
  )
}
