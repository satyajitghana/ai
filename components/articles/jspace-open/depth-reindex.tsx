"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The reindex trick, made visual. Six open models with different layer counts,
// each drawn as a bar split into sensory / workspace / motor at the same
// relative boundaries the explorer reports (~46.5% / ~64.1%).
//
//  - "raw layers": bar width ∝ true layer count, so the stage boundaries land at
//    different x for every model — nothing lines up.
//  - "reindexed 0–100%": every model resampled onto a common depth grid, so the
//    boundaries snap onto two shared vertical guides. Same layout, same relative
//    depth, from a 12-layer GPT-2 to a 64-layer Qwen.
//
// Pure, deterministic, bounded render (a fixed map over 6 models) — SSR-safe.

const SENSORY = "oklch(0.56 0.13 285)"
const WORKSPACE = "oklch(0.64 0.13 195)"
const MOTOR = "oklch(0.74 0.14 80)"

const SENS_END = 0.465
const MOTOR_START = 0.641

// (name, layer count, family) — spread across families and sizes
const MODELS = [
  { id: "gpt2-small", layers: 12 },
  { id: "llama3.1-8b", layers: 32 },
  { id: "olmo-3-7b", layers: 32 },
  { id: "qwen3-14b", layers: 40 },
  { id: "gemma-3-12b", layers: 48 },
  { id: "qwen3-32b", layers: 64 },
] as const

const MAXL = 64

// geometry
const W = 560
const ROWH = 40
const TOP = 30
const H = TOP + MODELS.length * ROWH + 34
const LABEL_W = 96
const BX = LABEL_W + 8
const BW = W - BX - 20
const BARH = 20

export function DepthReindex() {
  const [reindexed, setReindexed] = useState(true)

  const g1 = BX + SENS_END * BW
  const g2 = BX + MOTOR_START * BW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stage layout · {reindexed ? "reindexed 0–100%" : "raw layers"}</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Six models' sensory/workspace/motor stage layout, ${reindexed ? "reindexed to a common 0-100% depth axis so boundaries align" : "on raw layer counts so boundaries do not align"}.`}
        >
          {/* shared guides at the relative boundaries */}
          {[g1, g2].map((gx, k) => (
            <line
              key={k}
              x1={gx}
              y1={TOP - 8}
              x2={gx}
              y2={TOP + MODELS.length * ROWH - 8}
              stroke="var(--foreground)"
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={reindexed ? 0.55 : 0.18}
            />
          ))}
          <text x={g1} y={TOP - 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            {Math.round(SENS_END * 100)}%
          </text>
          <text x={g2} y={TOP - 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            {Math.round(MOTOR_START * 100)}%
          </text>

          {MODELS.map((m, i) => {
            const y = TOP + i * ROWH
            const width = reindexed ? BW : BW * (m.layers / MAXL)
            const s = width * SENS_END
            const wsp = width * (MOTOR_START - SENS_END)
            const mot = width * (1 - MOTOR_START)
            return (
              <g key={m.id}>
                <text x={LABEL_W} y={y + BARH / 2 + 4} textAnchor="end" className="fill-foreground font-mono" fontSize={10}>
                  {m.id}
                </text>
                <rect x={BX} y={y} width={s} height={BARH} rx={2} fill={SENSORY} className="transition-all duration-300" />
                <rect x={BX + s} y={y} width={wsp} height={BARH} fill={WORKSPACE} className="transition-all duration-300" />
                <rect x={BX + s + wsp} y={y} width={mot} height={BARH} rx={2} className="transition-all duration-300" fill={MOTOR} />
                <text x={BX + width + 6} y={y + BARH / 2 + 4} className="fill-muted-foreground/70 font-mono" fontSize={9}>
                  {m.layers}L
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">layer axis</span>
            {[
              { k: false, label: "raw layers" },
              { k: true, label: "reindexed 0–100%" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setReindexed(o.k)}
                aria-pressed={reindexed === o.k}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  reindexed === o.k ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            {(
              [
                ["sensory", SENSORY],
                ["workspace", WORKSPACE],
                ["motor", MOTOR],
              ] as const
            ).map(([name, col]) => (
              <span key={name} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: col }} /> {name}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          On <span className="text-foreground">raw layers</span>, a 12-layer GPT-2 and a 64-layer Qwen split into stages at wildly different
          absolute depths, and the boundaries scatter. <span className="text-foreground">Reindex</span> every model onto a common 0&ndash;100%
          axis and the same three regions snap onto the two guides &mdash; the explorer&rsquo;s{" "}
          <span style={{ color: SENSORY }}>sensory</span>&nbsp;/&nbsp;<span style={{ color: WORKSPACE }}>workspace</span>&nbsp;/&nbsp;
          <span style={{ color: MOTOR }}>motor</span> layout, at nearly the same fraction of depth across unrelated families. That shared
          relative layout is what the CKA matrix picks up as a 45&deg; band.
        </p>
      </div>
    </figure>
  )
}
