"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Zero-state share, real per-layer values read off Fermion Research's own SVG chart in
// "One-eighth the bits" (36-layer Neutrino-1 8B). q/k and v/o are averaged pairwise —
// in the source they track each other closely enough to read as one line. Scrub the
// layer slider and watch the feed-forward `down`/`gate` rows spike ~10 points above the
// rest of the network at layers 2-4, while attention (`q,k` / `v,o`) and `up` stay in a
// tight band the whole way down. The 62.63/18.68/18.69 split above is the aggregate
// across all 6.95B ternary weights, not derived from these per-layer values.

const ZERO = "oklch(0.55 0.03 260)"
const PLUS = "oklch(0.62 0.15 250)"
const MINUS = "oklch(0.6 0.17 15)"

const DOWN = [60.59, 70.59, 72.47, 65.96, 61.85, 61.02, 62.04, 62.1, 62.37, 62.58, 62.55, 62.48, 62.48, 62.7, 62.64, 62.71, 61.85, 62.63, 62.69, 62.77, 62.62, 62.52, 62.37, 62.3, 62.14, 62.08, 62.22, 61.99, 61.91, 62.14, 62.09, 62.1, 61.96, 61.99, 62.09, 62.24]
const GATE = [62.01, 69.82, 68.69, 70.48, 63.37, 62.15, 62.16, 62.08, 62.11, 62.18, 62.19, 62.21, 62.3, 62.36, 62.32, 62.4, 62.54, 62.41, 62.53, 62.62, 62.49, 62.53, 62.43, 62.3, 62.17, 62.11, 62.11, 62.01, 61.99, 61.98, 61.97, 61.97, 61.92, 61.98, 62.06, 61.92]
const UP = [61.96, 63.58, 63.97, 63.25, 62.65, 61.91, 62.25, 62.11, 62.22, 62.33, 62.33, 62.32, 62.42, 62.47, 62.44, 62.48, 62.7, 62.42, 62.52, 62.62, 62.45, 62.42, 62.35, 62.23, 62.14, 62.07, 62.11, 62.01, 62.01, 62.01, 62.03, 62.02, 61.97, 62.02, 62.15, 62.12]
const QK = [61.88, 62.43, 62.3, 62.35, 62.25, 62.19, 62.27, 62.25, 62.2, 62.44, 62.39, 62.49, 62.38, 62.41, 62.29, 62.35, 62.45, 62.32, 62.33, 62.52, 62.31, 62.37, 62.25, 62.25, 62.45, 62.19, 62.27, 62.09, 62.32, 62.45, 62.44, 62.53, 62.58, 62.57, 62.58, 62.23]
const VO = [62.7, 62.53, 62.31, 62.44, 62.33, 62.41, 62.83, 62.45, 62.21, 62.6, 62.53, 62.53, 62.73, 62.47, 62.42, 62.31, 62.7, 62.44, 62.22, 62.47, 62.35, 62.22, 62.36, 62.94, 63.26, 62.19, 62.55, 62.28, 62.28, 62.58, 62.63, 62.47, 62.51, 62.44, 62.84, 62.68]

const PROJECTIONS: { key: string; label: string; color: string; values: number[] }[] = [
  { key: "down", label: "down (ffn)", color: "oklch(0.55 0.19 15)", values: DOWN },
  { key: "gate", label: "gate (ffn)", color: "oklch(0.4 0.15 15)", values: GATE },
  { key: "up", label: "up (ffn)", color: "oklch(0.55 0.15 155)", values: UP },
  { key: "qk", label: "q, k (attn)", color: "oklch(0.62 0.17 250)", values: QK },
  { key: "vo", label: "v, o (attn)", color: "oklch(0.45 0.17 258)", values: VO },
]

const N_LAYERS = 36
const LO = 58
const HI = 74
const QUICK = [1, 3, 4, 18, 36]

export function SparsityDepth() {
  const [layer, setLayer] = useState(3) // 1-indexed
  const idx = layer - 1
  const inSpike = layer >= 2 && layer <= 4

  const pct = (v: number) => Math.min(100, Math.max(0, ((v - LO) / (HI - LO)) * 100))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>learned sparsity, by depth · Neutrino-1 8B</span>
        <span className="text-muted-foreground/50">6.95B ternary weights</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* global state split (aggregate, all layers) */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>state occupancy, whole model</span>
            <span>62.63% zero · 18.68% plus · 18.69% minus</span>
          </div>
          <div className="flex h-4 w-full overflow-hidden rounded-sm">
            <div style={{ width: "62.63%", background: ZERO }} />
            <div style={{ width: "18.68%", background: PLUS }} />
            <div style={{ width: "18.69%", background: MINUS }} />
          </div>
        </div>

        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            layer <span className="font-semibold text-foreground">{layer}</span>{" "}of {N_LAYERS}
          </span>
          {inSpike ? (
            <span className="font-mono text-[10px]" style={{ color: "oklch(0.55 0.19 15)" }}>
              feed-forward spike zone
            </span>
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground/60">baseline band</span>
          )}
        </div>

        {/* per-layer projection bars, zoomed to 58-74% */}
        <div className="space-y-1.5">
          {PROJECTIONS.map((p) => {
            const v = p.values[idx]
            return (
              <div key={p.key} className="flex items-center gap-2.5">
                <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">{p.label}</span>
                <div className="relative h-4 flex-1 rounded-sm bg-muted/30">
                  <div
                    className="absolute top-0 bottom-0 w-px"
                    style={{ left: `${pct(62)}%`, background: "var(--border)" }}
                  />
                  <div
                    className="absolute top-0 bottom-0 rounded-sm transition-[width] duration-150"
                    style={{ width: `${pct(v)}%`, background: p.color }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
                  {v.toFixed(2)}%
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>scrub depth (drag)</span>
            <div className="flex gap-1">
              {QUICK.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayer(l)}
                  aria-pressed={layer === l}
                  className={cn(
                    "cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                    layer === l ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  L{l}
                </button>
              ))}
            </div>
          </div>
          <Range
            min={1}
            max={N_LAYERS}
            step={1}
            value={layer}
            onChange={(e) => setLayer(Number(e.target.value))}
            className="w-full cursor-pointer"
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The four <span style={{ color: "oklch(0.62 0.17 250)" }}>attention</span>{" "}projections hold a flat{" "}
          61.8-63.5% band at every one of the 36 layers — barely worth scrubbing. The{" "}
          <span style={{ color: "oklch(0.55 0.19 15)" }}>feed-forward down and gate</span>{" "}rows are the exception:
          they spike to 72.47% and 70.48% at layers 3 and 4, roughly ten points above the body of the network, then
          settle back to the 62% baseline by layer 5. Nothing in the ternary format asked for that shape — the format
          only fixes how much of each tensor falls silent; the training decided <em>where</em>.
        </p>
      </div>
    </figure>
  )
}
