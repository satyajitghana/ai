"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The honesty of a myth-busting ablation lives in the controls. IFM Research's
// central methodological move: rebuild Ouro-style and Huginn-style loops so both
// unroll to the SAME logical depth — 112 block executions — before comparing them.
// Ouro-style: one 28-block tied stack, looped 4x (28x4=112). Huginn-style: an
// 8-block untied prelude + a 12-block tied core looped 8x + an 8-block untied
// coda (8+12x8+8=112). Toggle which parameters are shared (tied, reused every
// pass) vs distinct (untied, applied once) across both topologies.

const CORE = "oklch(0.60 0.14 250)" // tied / shared weights
const ENV = "oklch(0.75 0.13 80)" // untied prelude/coda

const W = 760
const H = 260
const MX = 40
const AREA = W - 2 * MX
const RH = 34

const OURO_Y = 78
const HUGINN_Y = 178

const TOTAL = 112
const PRELUDE = 8
const CORE_BLOCKS = 96 // 12 x 8
const CODA = 8

const preludeW = (AREA * PRELUDE) / TOTAL
const coreW = (AREA * CORE_BLOCKS) / TOTAL
const codaW = (AREA * CODA) / TOTAL

type Focus = "all" | "tied" | "untied"

export function MatchedDepth() {
  const [focus, setFocus] = useState<Focus>("all")

  const tiedOp = focus === "untied" ? 0.18 : 1
  const untiedOp = focus === "tied" ? 0.18 : 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>matched logical depth · 112 block executions either way</span>
        <span className="text-muted-foreground/50">controlled setup</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Ouro-style loops a 28-block tied stack 4 times; Huginn-style runs an 8-block untied prelude, a 12-block tied core looped 8 times, and an 8-block untied coda. Both total 112 logical block executions, so neither topology is given a depth advantage."
        >
          <defs>
            <filter id="md-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* Ouro row */}
          <text x={MX} y={OURO_Y - 14} className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            Ouro-style
          </text>
          <text x={MX + AREA} y={OURO_Y - 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            28 blocks × 4 passes = 112
          </text>
          {/* bracket */}
          <path
            d={`M ${MX} ${OURO_Y - 8} L ${MX} ${OURO_Y - 4} L ${MX + AREA} ${OURO_Y - 4} L ${MX + AREA} ${OURO_Y - 8}`}
            fill="none"
            stroke={CORE}
            strokeWidth={1.2}
            opacity={tiedOp * 0.6}
          />
          <rect x={MX} y={OURO_Y} width={AREA} height={RH} rx={7} fill={CORE} opacity={0.16 * tiedOp} stroke={CORE} strokeWidth={1.5} filter="url(#md-soft)" className="transition-opacity duration-300" style={{ opacity: tiedOp }} fillOpacity={0.16} />
          {[1, 2, 3].map((i) => (
            <line key={i} x1={MX + (AREA / 4) * i} y1={OURO_Y} x2={MX + (AREA / 4) * i} y2={OURO_Y + RH} stroke="var(--background)" strokeWidth={1.5} opacity={tiedOp * 0.7} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <text key={i} x={MX + (AREA / 4) * (i + 0.5)} y={OURO_Y + RH / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} opacity={tiedOp}>
              pass {i + 1}
            </text>
          ))}
          <text x={MX} y={OURO_Y + RH + 16} className="fill-muted-foreground font-mono" fontSize={9} opacity={tiedOp}>
            entire 28-block network is the recurrent body — no untied prelude/coda
          </text>

          {/* Huginn row */}
          <text x={MX} y={HUGINN_Y - 14} className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            Huginn-style
          </text>
          <text x={MX + AREA} y={HUGINN_Y - 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            8 + 12×8 + 8 = 112
          </text>

          {/* prelude */}
          <rect x={MX} y={HUGINN_Y} width={preludeW} height={RH} rx={6} fill={ENV} stroke={ENV} strokeWidth={1.5} filter="url(#md-soft)" className="transition-opacity duration-300" style={{ opacity: untiedOp }} fillOpacity={0.85} />
          <text x={MX + preludeW / 2} y={HUGINN_Y + RH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} opacity={untiedOp} style={{ fill: "oklch(0.2 0 0)" }}>
            P
          </text>

          {/* core, subdivided into 8 */}
          <g style={{ opacity: tiedOp }} className="transition-opacity duration-300">
            <rect x={MX + preludeW} y={HUGINN_Y} width={coreW} height={RH} rx={6} fill={CORE} fillOpacity={0.85} stroke={CORE} strokeWidth={1.5} filter="url(#md-soft)" />
            {Array.from({ length: 7 }, (_, i) => (
              <line key={i} x1={MX + preludeW + (coreW / 8) * (i + 1)} y1={HUGINN_Y} x2={MX + preludeW + (coreW / 8) * (i + 1)} y2={HUGINN_Y + RH} stroke="var(--background)" strokeWidth={1.2} opacity={0.55} />
            ))}
            <text x={MX + preludeW + coreW / 2} y={HUGINN_Y + RH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} style={{ fill: "oklch(0.98 0 0)" }}>
              tied core R × 8
            </text>
          </g>

          {/* coda */}
          <rect x={MX + preludeW + coreW} y={HUGINN_Y} width={codaW} height={RH} rx={6} fill={ENV} stroke={ENV} strokeWidth={1.5} filter="url(#md-soft)" className="transition-opacity duration-300" style={{ opacity: untiedOp }} fillOpacity={0.85} />
          <text x={MX + preludeW + coreW + codaW / 2} y={HUGINN_Y + RH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} opacity={untiedOp} style={{ fill: "oklch(0.2 0 0)" }}>
            C
          </text>

          <text x={MX} y={HUGINN_Y + RH + 16} className="fill-muted-foreground font-mono" fontSize={9}>
            untied prelude / coda (each own params, applied once) sandwich a smaller tied core
          </text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">highlight</span>
            {([["all", "all"], ["tied (shared weights)", "tied"], ["untied (own params)", "untied"]] as [string, Focus][]).map(([label, v]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFocus(v)}
                aria-pressed={focus === v}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  focus === v ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            both topologies: <span className="text-foreground">112</span>{" "}logical block executions
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ouro-style and Huginn-style are matched on purpose: same 112 logical block executions, same
          730M stored / 2.9B unrolled-equivalent parameter budget (8B-resident / 0.8B-active for the MoE
          runs), same token budgets and benchmark suite. Whatever wins, it is not winning on a hidden
          depth or parameter advantage — the only thing that differs is which of these blocks share weights
          (blue, reused every pass) and which stand alone (amber, their own parameters, applied once).
        </p>
      </div>
    </figure>
  )
}
