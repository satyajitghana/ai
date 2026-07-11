"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The honest speed story, as an SVG ladder. Cold decode is disk-bound (~0.05–0.1 tok/s).
// A warm LRU cache, native MTP speculative decoding, and pinning the hottest experts stack
// up to the best real community result (~0.37 tok/s on a Ryzen AI 9 Framework 13). Every
// rung's readout shows BOTH tok/s and seconds-per-token, because even the best case is
// ~1 token every ~3 seconds. Endpoints are community-measured; the middle decomposition is
// illustrative (Colibri's README gives the endpoints, not the per-factor split).

const ACCENT = "oklch(0.62 0.15 250)"
const GOOD = "oklch(0.64 0.14 158)"

type Rung = { label: string; tps: number; note: string; kind: "measured" | "illustrative" }

const RUNGS: Rung[] = [
  { label: "cold · no cache", tps: 0.075, note: "disk-bound: ~11 GB reads/token", kind: "measured" },
  { label: "+ warm LRU cache", tps: 0.18, note: "hot experts served from RAM", kind: "illustrative" },
  { label: "+ MTP speculation", tps: 0.27, note: "int8 head · 2.2–2.8 tok/forward", kind: "illustrative" },
  { label: "+ pinned hot experts", tps: 0.37, note: "Ryzen AI 9 · Framework 13", kind: "measured" },
]

// external reference points (community-measured), plotted as ticks on the axis
const REFS = [
  { label: "Core Ultra 7 (24 GB)", tps: 0.11 },
  { label: "M5 Max (128 GB)", tps: 1.06 },
]

const W = 760
const ROWH = 46
const TOP = 20
const H = TOP + RUNGS.length * ROWH + 58
const LBLW = 168
const PADR = 92
const AXMAX = 1.1 // tok/s axis top (fits the M5 Max reference)
const plotX0 = LBLW
const plotW = W - LBLW - PADR
const xAt = (tps: number) => plotX0 + (tps / AXMAX) * plotW
const ticks = [0, 0.25, 0.5, 0.75, 1.0]

export function ThroughputLadder() {
  const [stage, setStage] = useState(RUNGS.length - 1) // reveal up to this rung
  const active = RUNGS[stage]
  const secPerTok = 1 / active.tps

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>throughput ladder · tokens per second</span>
        <span className="text-muted-foreground/50">endpoints measured · split illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Decode throughput ladder from cold ${RUNGS[0].tps} tok/s to warm-cache, MTP and pinning at ${RUNGS[3].tps} tok/s`}>
          <defs>
            <filter id="tl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* gridlines + axis ticks */}
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={xAt(tk)} y1={TOP - 4} x2={xAt(tk)} y2={TOP + RUNGS.length * ROWH} stroke="var(--border)" strokeWidth={1} opacity={tk === 0 ? 0.9 : 0.35} />
              <text x={xAt(tk)} y={TOP + RUNGS.length * ROWH + 16} textAnchor="middle" className="fill-muted-foreground/70 font-mono tabular-nums" fontSize={9}>{tk}</text>
            </g>
          ))}
          <text x={plotX0} y={TOP + RUNGS.length * ROWH + 32} className="fill-muted-foreground font-mono" fontSize={9}>tok/s →</text>

          {/* external reference markers */}
          {REFS.map((r) => (
            <g key={r.label}>
              <line x1={xAt(r.tps)} y1={TOP - 4} x2={xAt(r.tps)} y2={TOP + RUNGS.length * ROWH} stroke={ACCENT} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
              <text x={xAt(r.tps)} y={TOP - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>{r.label}</text>
            </g>
          ))}

          {/* rungs */}
          {RUNGS.map((r, i) => {
            const y = TOP + i * ROWH
            const shown = i <= stage
            const isActive = i === stage
            const barX1 = xAt(0)
            const barX2 = xAt(r.tps)
            const col = r.kind === "measured" ? GOOD : ACCENT
            return (
              <g key={r.label} className="transition-opacity duration-300" opacity={shown ? 1 : 0.28}>
                <text x={LBLW - 12} y={y + ROWH / 2 - 3} textAnchor="end" className={cn("font-mono", isActive ? "fill-foreground" : "fill-muted-foreground")} fontSize={11} fontWeight={isActive ? 600 : 400}>{r.label}</text>
                <text x={LBLW - 12} y={y + ROWH / 2 + 10} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8.5}>{r.note}</text>
                {/* track */}
                <rect x={barX1} y={y + ROWH / 2 - 7} width={plotW} height={14} rx={7} fill="var(--muted)" opacity={0.3} />
                {/* value bar */}
                <rect x={barX1} y={y + ROWH / 2 - 7} width={Math.max(barX2 - barX1, 3)} height={14} rx={7} fill={col} opacity={shown ? 0.9 : 0.4} filter={isActive ? "url(#tl-soft)" : undefined} className="transition-all duration-300" />
                {/* readout */}
                <text x={barX2 + 8} y={y + ROWH / 2 + 4} className={cn("font-mono tabular-nums", isActive ? "fill-foreground" : "fill-muted-foreground")} fontSize={10.5} fontWeight={isActive ? 600 : 400}>
                  {r.tps.toFixed(2)}
                </text>
              </g>
            )
          })}
        </svg>

        {/* stage control */}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-[10px] text-muted-foreground">reveal</span>
          {RUNGS.map((r, i) => (
            <button key={r.label} type="button" onClick={() => setStage(i)} aria-pressed={stage === i}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", stage === i ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {i === 0 ? "cold" : i === 1 ? "+cache" : i === 2 ? "+MTP" : "+pin"}
            </button>
          ))}
          <div className="ml-auto font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground">{active.tps.toFixed(2)}</span> tok/s ·{" "}
            <span className="text-foreground">~{secPerTok.toFixed(1)} s</span> / token
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Read the seconds-per-token, not just the rate. The best real community result —{" "}
          <span style={{ color: GOOD }}>0.37 tok/s</span> with a warm cache, MTP and pinning — is still{" "}
          <span className="text-foreground">~3 seconds per token</span>. Cold, it is 10–20 seconds per token. The two dashed
          references are other community machines; the M5 Max&apos;s 1.06 tok/s comes from far more RAM (128 GB), which lets far
          more experts stay resident. This is a feasibility feat, not an interactive-speed setup.
        </p>
      </div>
    </figure>
  )
}
