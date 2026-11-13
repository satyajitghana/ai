"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { HIST } from "./measured-data"

// KVzip's Figure 5, redrawn from data: the distribution of the MAXIMUM attention
// each cached context KV pair receives, once during prefill (the context reading
// itself) and once during KVzip's reconstruction pass ("Repeat the previous
// context exactly." followed by the context, scored by the official
// attention/score.py). One count per (layer, KV head, token) pair, 20 bins of
// width 0.05. Three sources: my runs of the official code on Qwen3-4B-Instruct-2507
// (101 SQuAD contexts, and one 8,000-token essay haystack from the repo's own
// needle data), and the paper's own plotted numbers for LLaMA3.1-8B on SQuAD
// (data/score.csv in the arXiv source). The prose carries the headline numbers.

const RECON = "oklch(0.7 0.17 150)"
const PREFILL = "oklch(0.66 0.16 265)"

type Mode = "self" | "noself"

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`
}

export function ReconBars() {
  const [src, setSrc] = useState(0)
  const [mode, setMode] = useState<Mode>("self")
  const s = HIST.sources[src]
  const prefill = mode === "noself" && s.prefillNoSelf ? s.prefillNoSelf : s.prefill
  const recon = s.recon

  const W = 680
  const H = 250
  const PL = 44
  const PR = 10
  const PT = 12
  const PB = 40
  const n = recon.length
  const bw = (W - PL - PR) / n
  const ymax = 0.8
  const y = (v: number) => PT + (H - PT - PB) * (1 - Math.min(v, ymax) / ymax)
  const ticks = [0, 0.2, 0.4, 0.6, 0.8]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
        {HIST.sources.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setSrc(i)}
            aria-pressed={src === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
              src === i
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>
            <span className="inline-block size-2.5 rounded-sm align-middle" style={{ background: PREFILL }} /> prefill:{" "}
            <span className="text-foreground tabular-nums">{pct(prefill[0])}</span> of pairs below 0.05
          </span>
          <span>
            <span className="inline-block size-2.5 rounded-sm align-middle" style={{ background: RECON }} />{" "}
            reconstruction: <span className="text-foreground tabular-nums">{pct(recon[0])}</span> below 0.05
          </span>
          {s.prefillNoSelf ? (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={mode === "noself"}
                onChange={(e) => setMode(e.target.checked ? "noself" : "self")}
              />
              drop each token&apos;s attention to itself
            </label>
          ) : null}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Histogram of maximum attention per KV pair, ${s.label}. Prefill puts ${pct(prefill[0])} of pairs in the lowest bin, reconstruction puts ${pct(recon[0])} there.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PL - 6} y={y(t) + 3} fontSize="10" textAnchor="end" className="fill-muted-foreground font-mono">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {recon.map((r, i) => {
            const x = PL + i * bw
            const p = prefill[i]
            return (
              <g key={i}>
                <rect x={x + 1} y={y(p)} width={bw / 2 - 1} height={y(0) - y(p)} fill={PREFILL} fillOpacity={0.85} rx={1} />
                <rect x={x + bw / 2} y={y(r)} width={bw / 2 - 1} height={y(0) - y(r)} fill={RECON} fillOpacity={0.85} rx={1} />
              </g>
            )
          })}
          <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.3} />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <text
              key={t}
              x={PL + t * (W - PL - PR)}
              y={H - PB + 14}
              fontSize="10"
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
            >
              {t.toFixed(2)}
            </text>
          ))}
          <text x={(W + PL) / 2} y={H - 6} fontSize="10" textAnchor="middle" className="fill-muted-foreground font-mono">
            max attention a cached pair receives (softmax probability)
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{s.note}</p>
      </div>
    </figure>
  )
}
