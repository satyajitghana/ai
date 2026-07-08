"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Gemma 4's long-context story is a memory story: the KV cache is what blows up
// as the context grows, so the architecture is tuned to shrink it. Three moves,
// stacked here as three bars:
//   1. Baseline — every layer is global, storing K and V for every token. Linear
//      in context, and the whole reason a 128k prompt is expensive to serve.
//   2. + sliding-window local (5:1) — 5 of every 6 layers only attend inside a
//      fixed window W, so their KV cache stops growing past W. Only the 1-in-6
//      global layers still scale with the full context.
//   3. + values=keys on global layers — the global layers reuse K as V, so they
//      store one tensor instead of two. Halves the part that still grows.
//
// SSR-SAFE: first render is pure and deterministic. No timers, no Math.random,
// no unbounded loops — bars are a closed-form function of (context, config).
// The paper reports a 37.5% reduction of the *global* KV cache from the combined
// tricks (pp-RoPE + values=keys + KV sharing); the numbers below are a schematic
// scaling model to build intuition, not the exact model config.

const ACCENT = "oklch(0.62 0.17 255)" // Gemma blue — the shipped config
const MID = "oklch(0.68 0.13 230)" // lighter blue — the intermediate step
const BASE = "oklch(0.62 0.02 260)" // muted — the baseline

const W = 1024 // sliding-window size for local layers (tokens), illustrative
const LOCAL_FRAC = 5 / 6 // 5:1 local:global
const GLOBAL_FRAC = 1 / 6

const CTXS = [8, 16, 32, 64, 128] as const // context length in K tokens

// average KV footprint per layer, in "token-units" (K+V counted as 2, K-only 1)
function perLayer(ctxTokens: number, swa: boolean, vk: boolean): number {
  if (!swa) return ctxTokens * 2 // all global, store K and V
  const local = LOCAL_FRAC * Math.min(ctxTokens, W) * 2
  const global = GLOBAL_FRAC * ctxTokens * (vk ? 1 : 2)
  return local + global
}

const REF = perLayer(128 * 1024, false, false) // baseline at 128k = 100%

const CONFIGS = [
  { key: "base", name: "all-global · K+V", swa: false, vk: false, color: BASE },
  { key: "swa", name: "+ sliding window (5:1)", swa: true, vk: false, color: MID },
  { key: "vk", name: "+ values=keys (global)", swa: true, vk: true, color: ACCENT },
] as const

export function KvBudget() {
  const [ctxIdx, setCtxIdx] = useState(CTXS.length - 1) // default 128k
  const ctxK = CTXS[ctxIdx]
  const ctxTokens = ctxK * 1024

  const rows = CONFIGS.map((c) => {
    const val = perLayer(ctxTokens, c.swa, c.vk)
    const pct = (val / REF) * 100
    const baseVal = perLayer(ctxTokens, false, false)
    const shrink = baseVal / val // ×smaller than baseline at THIS context
    return { ...c, pct, shrink }
  })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>KV cache per layer · relative to full attention at 128k</span>
        <span className="text-muted-foreground/50">schematic</span>
      </div>

      <div className="p-4">
        {/* context selector */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">context</span>
          {CTXS.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => setCtxIdx(i)}
              aria-pressed={ctxIdx === i}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                ctxIdx === i ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={ctxIdx === i ? { background: ACCENT } : undefined}
            >
              {c}k
            </button>
          ))}
        </div>

        {/* bars */}
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-40 shrink-0 truncate text-right font-mono text-[11px]",
                  r.key === "vk" ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {r.name}
              </span>
              <div className="relative h-6 flex-1">
                {/* 100% reference tick (baseline @ 128k) */}
                <span className="absolute top-0 bottom-0 right-0 w-px bg-border" />
                <div
                  className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm transition-all duration-300"
                  style={{ width: `${Math.max(r.pct, 0.6)}%`, background: r.color }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 pl-2 font-mono text-[11px] tabular-nums text-muted-foreground"
                  style={{ left: `${Math.min(r.pct, 82)}%` }}
                >
                  {r.pct.toFixed(1)}%
                  {r.shrink > 1.05 ? (
                    <span style={{ color: r.color }}> · {r.shrink.toFixed(1)}× smaller</span>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          At <span className="font-mono text-foreground">{ctxK}k</span> tokens, the sliding window caps
          the cost of 5-in-6 layers at <span className="font-mono">W={W}</span>, so only the global layers keep growing
          with context. Reusing <span className="font-mono">K</span> as <span className="font-mono">V</span> on those
          global layers stores one tensor instead of two, halving the part that still scales. Step the context up
          and the gap widens — the sliding window matters more the longer the prompt. Schematic scaling, not the exact
          config; the paper reports a <span className="text-foreground">37.5% cut</span> to the global KV cache from
          these tricks combined.
        </p>
      </div>
    </figure>
  )
}
