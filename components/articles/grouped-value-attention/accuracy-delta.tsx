"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// The central argument, drawn instead of asserted. Every number here is Table 2 of
// the paper, verbatim — the five-task average accuracy for each trained variant,
// each itself an arithmetic mean over three seeds. The paper never reports the
// per-seed spread, so there is no real error bar to draw. What IS on the record is
// the spread across the paper's OWN seven variants — the same architecture family,
// same 30B tokens, differing only in initialization/normalization choices — and
// the gap between two long-established methods (GQA, MLA) in this same table. Both
// are real, sourced numbers; both dwarf the -0.01 the paper is calling "near-GQA."

const GQA_C = "oklch(0.62 0.02 260)"
const MLA_C = "oklch(0.62 0.15 250)"
const GVA_C = "oklch(0.72 0.15 195)"
const PROPOSED_C = "oklch(0.68 0.17 195)"

type Row = { id: string; label: string; avg: number; kind: "gqa" | "mla" | "gva" | "proposed" }

const ROWS: Row[] = [
  { id: "gqa", label: "GQA", avg: 44.36, kind: "gqa" },
  { id: "mla", label: "MLA", avg: 43.88, kind: "mla" },
  { id: "gva-base", label: "GVA, baseline init", avg: 43.91, kind: "gva" },
  { id: "gva-scale", label: "GVA, scale-matched + Q-norm", avg: 44.41, kind: "gva" },
  { id: "gva-var", label: "GVA, variance-fixed, no Q-norm", avg: 43.77, kind: "gva" },
  { id: "gva-d24", label: "GVA + DRoPE, d_r = 24", avg: 44.29, kind: "gva" },
  { id: "gva-d16", label: "GVA + DRoPE, d_r = 16 — proposed", avg: 44.35, kind: "proposed" },
]

const GQA_AVG = 44.36
const GVA_FAMILY = ROWS.filter((r) => r.kind === "gva" || r.kind === "proposed")
const BAND_MIN = Math.min(...GVA_FAMILY.map((r) => r.avg)) // 43.77
const BAND_MAX = Math.max(...GVA_FAMILY.map((r) => r.avg)) // 44.41
const MLA_AVG = ROWS.find((r) => r.kind === "mla")!.avg

const COLOR: Record<Row["kind"], string> = { gqa: GQA_C, mla: MLA_C, gva: GVA_C, proposed: PROPOSED_C }

type Mode = "raw" | "delta"

const W = 680
const ROW_H = 32
const TOP = 54
const BOT = 34
const PL = 210
const PR = 28
const H = TOP + ROWS.length * ROW_H + BOT

export function AccuracyDelta() {
  const [mode, setMode] = useState<Mode>("raw")

  const domain: [number, number] = mode === "raw" ? [43.6, 44.6] : [-0.8, 0.2]
  const val = (v: number) => (mode === "raw" ? v : v - GQA_AVG)
  const ticks = mode === "raw" ? [43.6, 43.8, 44.0, 44.2, 44.4, 44.6] : [-0.8, -0.6, -0.4, -0.2, 0, 0.2]

  const sx = (v: number) => PL + ((v - domain[0]) / (domain[1] - domain[0])) * (W - PL - PR)
  const rowY = (i: number) => TOP + i * ROW_H + ROW_H / 2

  const bandX1 = sx(val(BAND_MIN))
  const bandX2 = sx(val(BAND_MAX))
  const gqaX = sx(val(GQA_AVG))
  const mlaX = sx(val(MLA_AVG))
  const proposedRow = ROWS.findIndex((r) => r.kind === "proposed")
  const gqaRow = ROWS.findIndex((r) => r.kind === "gqa")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>five-task average accuracy · every trained variant (paper, Table 2)</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Average accuracy across seven trained variants. GQA 44.36, MLA 43.88 — 0.48 points apart, two established methods in the same experiment. The proposed GVA with decoupled RoPE (d_r=16) reaches 44.35, 0.01 below GQA. Across the paper's own seven GVA-family variants — differing only in initialization and normalization, same data, same tokens — the average ranges from 43.77 to 44.41, a 0.64-point spread. The paper reports three seeds per configuration but never a per-seed standard deviation.`}
        >
          {/* gridlines */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={TOP - 8} y2={TOP + ROWS.length * ROW_H} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text x={sx(t)} y={TOP - 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
                {mode === "raw" ? t.toFixed(1) : (t > 0 ? "+" : "") + t.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={W - PR} y={TOP - 32} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            {mode === "raw" ? "average accuracy (%)" : "Δ vs GQA (points)"}
          </text>

          {/* GVA-family spread band */}
          <rect x={bandX1} y={TOP - 6} width={bandX2 - bandX1} height={ROWS.length * ROW_H} fill={GVA_C} opacity={0.08} />
          <line x1={bandX1} x2={bandX1} y1={TOP - 6} y2={TOP + ROWS.length * ROW_H} stroke={GVA_C} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
          <line x1={bandX2} x2={bandX2} y1={TOP - 6} y2={TOP + ROWS.length * ROW_H} stroke={GVA_C} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
          <text x={(bandX1 + bandX2) / 2} y={TOP + ROWS.length * ROW_H + 20} textAnchor="middle" className="font-mono" fontSize={9.5} fill={GVA_C}>
            GVA-family spread · 0.64 pts (init/norm only)
          </text>

          {/* GQA reference line */}
          <line x1={gqaX} x2={gqaX} y1={TOP - 6} y2={TOP + ROWS.length * ROW_H} stroke={GQA_C} strokeWidth={1.3} strokeDasharray="4 3" opacity={0.7} />

          {/* GQA <-> MLA bracket */}
          <line x1={Math.min(gqaX, mlaX)} x2={Math.max(gqaX, mlaX)} y1={TOP - 30} y2={TOP - 30} stroke="var(--muted-foreground)" strokeWidth={1} />
          <line x1={gqaX} x2={gqaX} y1={TOP - 30} y2={TOP - 24} stroke="var(--muted-foreground)" strokeWidth={1} />
          <line x1={mlaX} x2={mlaX} y1={TOP - 30} y2={TOP - 24} stroke="var(--muted-foreground)" strokeWidth={1} />
          <text x={(gqaX + mlaX) / 2} y={TOP - 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
            GQA↔MLA: 0.48 pts
          </text>

          {/* row labels + dots */}
          {ROWS.map((r, i) => (
            <g key={r.id}>
              <line x1={PL} x2={W - PR} y1={rowY(i)} y2={rowY(i)} stroke="var(--border)" strokeWidth={1} opacity={0.35} />
              <text
                x={PL - 12}
                y={rowY(i) + 3.5}
                textAnchor="end"
                className="font-mono"
                fontSize={10.5}
                fontWeight={r.kind === "proposed" ? 700 : 400}
                fill={r.kind === "proposed" ? "var(--foreground)" : "var(--muted-foreground)"}
              >
                {r.label}
              </text>
              <circle
                cx={sx(val(r.avg))}
                cy={rowY(i)}
                r={r.kind === "proposed" ? 5.5 : r.kind === "gqa" || r.kind === "mla" ? 5 : 4}
                fill={COLOR[r.kind]}
                stroke="var(--background)"
                strokeWidth={1.5}
              />
              <text
                x={sx(val(r.avg)) + (r.kind === "proposed" ? -10 : 10)}
                y={rowY(i) + 3.5}
                textAnchor={r.kind === "proposed" ? "end" : "start"}
                className="font-mono tabular-nums"
                fontSize={9.5}
                fontWeight={r.kind === "proposed" ? 700 : 400}
                fill={r.kind === "proposed" ? PROPOSED_C : "var(--muted-foreground)"}
              >
                {mode === "raw" ? r.avg.toFixed(2) : (val(r.avg) >= 0 ? "+" : "") + val(r.avg).toFixed(2)}
              </text>
            </g>
          ))}

          {/* connector between GQA and proposed row, since the headline is that distance */}
          <line
            x1={gqaX}
            x2={sx(val(ROWS[proposedRow].avg))}
            y1={rowY(gqaRow)}
            y2={rowY(proposedRow)}
            stroke={PROPOSED_C}
            strokeWidth={1.3}
            strokeDasharray="3 3"
            opacity={0.55}
          />
        </svg>

        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">view</span>
          {(["raw", "delta"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-md border border-transparent px-2 py-1 font-mono text-[10px] transition-colors",
                mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === m ? { background: PROPOSED_C } : undefined}
            >
              {m === "raw" ? "raw average" : "Δ vs GQA"}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The proposed row (bold) sits <span className="text-foreground">0.01 points</span>{" "}below GQA — but the seven
          GVA variants the paper itself trained, changing only initialization and query normalization, already span{" "}
          <span style={{ color: GVA_C }}>0.64 points</span>. And GQA and MLA — two methods nobody disputes are
          different architectures — land <span className="text-foreground">0.48 points</span>{" "}apart in this same
          run. The paper reports three random seeds per configuration and averages them, but never publishes the
          per-seed spread, so there is no error bar to put on any of these dots — only the honest fact that 0.01 is
          small next to everything else moving in this table.
        </p>
      </div>
    </figure>
  )
}
