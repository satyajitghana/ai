"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The methodological point the paper itself never states: VLD is parameter-matched
// by construction (Sec. 4, "the actual number of parameters do not change") but it
// is NOT compute-matched -- the word "FLOP" does not appear anywhere in arXiv
// 2506.18233. Looping the same block k times still runs that block's forward pass
// k times per token, so per-token compute rises with the loop factor even though
// stored parameters do not move at all.
//
// The two backbones and their Cycle-pattern op15 accuracies below are exact,
// Table 1. Both native models have ~12.5M params/layer (the paper states the four
// baselines "have identical per-layer parameter counts but varying native layer
// depths" -- 50M/4L, 100M/8L, 150M/12L, 200M/16L). Per-token FLOPs uses the
// standard forward-pass approximation C ~= 2 x active params (Kaplan et al.,
// arXiv:2001.08361) applied to the params ACTUALLY invoked per token, i.e.
// per-layer-params x effective depth -- an illustrative first-order estimate,
// since the paper reports no FLOPs number of its own to check it against.

type Backbone = { key: "4L" | "8L"; label: string; layers: number; totalParams: number; acc: (number | null)[] }

const PER_LAYER = 12_500_000 // ~= 12.5M params/layer, constant across the paper's four native depths

const BACKBONES: Backbone[] = [
  { key: "4L", label: "4-layer / 50M backbone", layers: 4, totalParams: 50_000_000, acc: [54.9, 62.1, 61.6, 65.7, 70.7] },
  { key: "8L", label: "8-layer / 100M backbone", layers: 8, totalParams: 100_000_000, acc: [62.0, 63.3, 61.0, 66.8, null] },
]

const PARAM_COLOR = "oklch(0.60 0.15 255)"
const COMPUTE_COLOR = "oklch(0.68 0.16 40)"

const AXIS_LO = 1e7
const AXIS_HI = 1e9
const TICKS = [1e7, 3e7, 1e8, 3e8, 1e9]
const fmtFlops = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${Math.round(n / 1e6)}M` : `${n}`)

export function ComputeAccounting() {
  const [bbKey, setBbKey] = useState<Backbone["key"]>("4L")
  const [k, setK] = useState(1)
  const bb = BACKBONES.find((b) => b.key === bbKey) ?? BACKBONES[0]

  const effDepth = bb.layers * k
  const computeFlops = 2 * PER_LAYER * effDepth
  const paramFlopsEquivalent = 2 * bb.totalParams // for comparison, drawn as the fixed reference bar
  const acc = bb.acc[k - 1] ?? null

  const pos = useMemo(() => {
    const lo = mlog10(AXIS_LO)
    const hi = mlog10(AXIS_HI)
    return (v: number) => Math.min(100, Math.max(0, ((mlog10(v) - lo) / (hi - lo)) * 100))
  }, [])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">params vs. per-token compute as loop count rises</span>
        <div className="flex gap-1">
          {BACKBONES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                setBbKey(b.key)
                setK(1)
              }}
              aria-pressed={bbKey === b.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                bbKey === b.key ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* log-scale axis with two rows: fixed params, growing compute */}
        <div className="relative">
          <svg viewBox="0 0 640 30" className="w-full" aria-hidden="true">
            {TICKS.map((t) => (
              <g key={t}>
                <line x1={`${pos(t)}%`} x2={`${pos(t)}%`} y1="0" y2="30" stroke="currentColor" strokeOpacity="0.08" />
              </g>
            ))}
          </svg>
          <div className="relative -mt-[26px] mb-3 h-4">
            {TICKS.map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground/60"
                style={{ left: `${pos(t)}%` }}
              >
                {fmtFlops(t)}
              </span>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-right font-mono text-[10px] text-muted-foreground">stored params</span>
              <div className="relative h-3 flex-1 rounded-full bg-muted/20">
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${pos(paramFlopsEquivalent)}%`, background: PARAM_COLOR }}
                />
              </div>
              <span className="w-20 shrink-0 font-mono text-[10px] tabular-nums" style={{ color: PARAM_COLOR }}>
                {bb.totalParams >= 1e6 ? `${bb.totalParams / 1e6}M` : bb.totalParams}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-right font-mono text-[10px] text-muted-foreground">compute / token</span>
              <div className="relative h-3 flex-1 rounded-full bg-muted/20">
                <div
                  className="absolute top-0 h-3 rounded-full transition-all"
                  style={{ width: `${pos(computeFlops)}%`, background: COMPUTE_COLOR, opacity: 0.85 }}
                />
              </div>
              <span className="w-20 shrink-0 font-mono text-[10px] tabular-nums" style={{ color: COMPUTE_COLOR }}>
                {fmtFlops(computeFlops)} FLOPs
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">loop factor ×{k}</span>
          <Range min={1} max={5} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} accent={COMPUTE_COLOR} className="flex-1" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 font-mono text-[10px]">
          <div>
            <div className="text-muted-foreground">effective depth</div>
            <div className="text-foreground">{bb.layers} × {k} = {effDepth}</div>
          </div>
          <div>
            <div className="text-muted-foreground">params (unchanged)</div>
            <div className="text-foreground">{bb.totalParams / 1e6}M</div>
          </div>
          <div>
            <div className="text-muted-foreground">Cycle op15 acc.</div>
            <div className="text-foreground">{acc != null ? `${acc}%` : "not tested (Table 1: –)"}</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag the slider and the <span style={{ color: PARAM_COLOR }}>params dot</span> never moves &mdash;
          that&rsquo;s the paper&rsquo;s whole construction, parameters held fixed by definition. But the{" "}
          <span style={{ color: COMPUTE_COLOR }}>compute bar</span> grows in lockstep with the loop factor,
          because the block&rsquo;s forward pass now runs {k}× per token instead of once. Table 1&rsquo;s
          accuracy climbs alongside it. Nothing here is free; it&rsquo;s just not paid for in parameters,
          and the paper never puts a FLOPs number next to the gain to say what it <em>is</em> paid for in.
        </p>
      </div>
    </figure>
  )
}
