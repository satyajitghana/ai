"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Quantile Balancing. Standard sparse MoE keeps experts busy with an auxiliary
// load-balancing loss and a sensitive coefficient. Kimi K3 instead sets, per expert,
// a router-score threshold at a target QUANTILE — so every expert serves the same
// fraction of tokens by construction, no aux loss, no tuned knob. Top panel: one
// expert's scores across a batch, with the quantile threshold. Bottom panel: the
// resulting per-expert load, quantile vs aux-loss. Illustrative.

const ACCENT = "oklch(0.58 0.15 265)"
const NB = 40 // tokens in the batch (top panel)
const NE = 12 // experts (bottom panel)

const W = 760
const H = 430

// round to 2dp so server and client SVG attributes serialize identically (no hydration drift)
const R2 = (n: number): number => Math.round(n * 100) / 100

// deterministic score distribution for one expert (no Math.random)
function score(i: number): number {
  const v = 0.5 + 0.28 * Math.sin(i * 0.7 + 0.5) + 0.14 * Math.sin(i * 1.9) + 0.08 * Math.cos(i * 0.31)
  return Math.min(0.98, Math.max(0.04, v))
}
const SCORES = Array.from({ length: NB }, (_, i) => score(i))
const SORTED = [...SCORES].sort((a, b) => a - b)
function quantile(p: number): number {
  const idx = Math.min(SORTED.length - 1, Math.max(0, Math.round(p * (SORTED.length - 1))))
  return SORTED[idx]
}

// deterministic per-expert load under an aux-loss regime (uneven)
function auxLoad(e: number, q: number): number {
  const v = q * (1 + 1.05 * Math.sin(e * 1.3 + 1.1) + 0.25 * Math.cos(e * 0.7))
  return Math.min(0.96, Math.max(0.03, v))
}

// top panel geometry
const AX = 48
const AW = 664
const A_BASE = 196
const A_TOP = 66
const barW = (AW / NB) * 0.62
const bx = (i: number) => AX + (i + 0.5) * (AW / NB)

// bottom panel geometry
const B_BASE = 372
const B_TOP = 262
const eW = (AW / NE) * 0.5
const ex = (e: number) => AX + (e + 0.5) * (AW / NE)

export function QuantileBalancing() {
  const [q, setQ] = useState(0.35) // target fraction each expert keeps
  const [mode, setMode] = useState<"quantile" | "aux-loss">("quantile")

  const thr = quantile(1 - q)
  const keptY = R2(A_BASE - thr * (A_BASE - A_TOP))
  const keptCount = SCORES.filter((s) => s >= thr).length

  const loads = Array.from({ length: NE }, (_, e) => (mode === "quantile" ? q : auxLoad(e, q)))
  const maxL = Math.max(...loads)
  const minL = Math.min(...loads)
  const imbalance = (maxL / minL).toFixed(1)
  const targetY = R2(B_BASE - q * (B_BASE - B_TOP))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>quantile balancing · no aux loss, no tuned coefficient</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`One expert keeps the top ${Math.round(q * 100)}% of tokens by router-score quantile; the resulting per-expert load is balanced under quantile balancing and uneven under an aux-loss regime.`}>
          <defs>
            <filter id="qb-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* top panel label */}
          <text x={AX} y={52} className="fill-muted-foreground font-mono" fontSize={11}>
            router scores for one expert · {NB} tokens
          </text>

          {/* baseline */}
          <line x1={AX} y1={A_BASE} x2={AX + AW} y2={A_BASE} stroke="var(--border)" strokeWidth={1} />

          {/* score bars */}
          {SCORES.map((s, i) => {
            const kept = s >= thr
            const h = R2(s * (A_BASE - A_TOP))
            return (
              <rect
                key={i}
                x={R2(bx(i) - barW / 2)}
                y={R2(A_BASE - h)}
                width={R2(barW)}
                height={h}
                rx={1.5}
                fill={kept ? ACCENT : "var(--muted-foreground)"}
                fillOpacity={kept ? 0.9 : 0.3}
                className="transition-all duration-200"
              />
            )
          })}

          {/* quantile threshold line */}
          <line x1={AX} y1={keptY} x2={AX + AW} y2={keptY} stroke={ACCENT} strokeWidth={1.6} strokeDasharray="5 3" />
          <text x={AX + AW} y={keptY - 5} textAnchor="end" className="font-mono" fontSize={10} style={{ fill: ACCENT }}>
            {Math.round(q * 100)}% quantile → keep {keptCount}/{NB}
          </text>

          {/* bottom panel label */}
          <text x={AX} y={244} className="fill-muted-foreground font-mono" fontSize={11}>
            per-expert load · {NE} experts ({mode})
          </text>

          {/* target line */}
          <line x1={AX} y1={targetY} x2={AX + AW} y2={targetY} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <text x={AX} y={targetY - 4} className="fill-muted-foreground font-mono" fontSize={9}>
            target
          </text>

          {/* baseline bottom */}
          <line x1={AX} y1={B_BASE} x2={AX + AW} y2={B_BASE} stroke="var(--border)" strokeWidth={1} />

          {/* expert load bars */}
          {loads.map((l, e) => {
            const h = R2(l * (B_BASE - B_TOP))
            const off = mode === "quantile"
            return (
              <rect
                key={e}
                x={R2(ex(e) - eW / 2)}
                y={R2(B_BASE - h)}
                width={R2(eW)}
                height={h}
                rx={2}
                fill={off ? ACCENT : "var(--muted-foreground)"}
                fillOpacity={off ? 0.85 : 0.55}
                filter={off ? "url(#qb-soft)" : undefined}
                className="transition-all duration-200"
              />
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">balancing</span>
            {(["quantile", "aux-loss"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (mode === m ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {m}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            load imbalance (max/min){" "}
            <span style={{ color: mode === "quantile" ? ACCENT : "var(--muted-foreground)" }}>
              {mode === "quantile" ? "1.0× (balanced)" : `${imbalance}×`}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">target quantile q (fraction of tokens each expert keeps)</div>
          <Range min={0.1} max={0.6} step={0.05} value={q} onChange={(e) => setQ(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.58 0.15 265)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Allocation comes straight from the <span style={{ color: ACCENT }}>quantile</span> of each expert's router scores:
          keep the top <span className="text-foreground">q</span> fraction of tokens, and every expert ends up equally busy —
          no auxiliary loss, no sensitive balance coefficient to tune. Flip to{" "}
          <span className="text-foreground">aux-loss</span> and the same target leaves some experts starved and others
          overloaded — the imbalance quantile balancing is built to remove.
        </p>
      </div>
    </figure>
  )
}
