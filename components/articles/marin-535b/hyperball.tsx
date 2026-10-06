"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A toy of the MuonH hyperball step and of issue #8621.
//
// MuonH moves a weight along its (orthogonalized) update, then rescales it back to the norm
// it had before the step: W' = (W - lr * U * |W| / |U|), renormalised to |W|. Which tensor
// that norm is taken over is the whole question in #8621. The hero stores every layer's
// routed experts in one [layers, experts, d_in, d_out] array, and optimizer.py:76 takes the
// norm over axes (1, 2, 3): all experts of a layer together, not each expert alone.
//
// Here six "experts" are 6-dim vectors. Each step each gets a unit-size update (Newton-Schulz
// gives every expert an update of the same scale), made of seeded noise plus a steady push:
// expert A's gradient keeps asking it to shrink, expert B's to grow, the rest are neutral.
// Per expert, the projection throws the push away. Per layer, it only holds the total, so A
// and B can trade norm while the layer's norm stays put. Only + - * / and sqrt are used, so
// server and client compute identical numbers.

const E = 6
const D = 6
const LR = 0.03
const MAX_STEPS = 100
const PUSH = [0.15, -0.15, 0, 0, 0, 0]
const NAMES = ["A", "B", "C", "D", "E", "F"]

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296 - 0.5
  }
}

const norm = (v: number[]) => Math.sqrt(v.reduce((a, x) => a + x * x, 0))

function simulate(mode: "expert" | "layer"): number[][] {
  const rnd = lcg(8621)
  // start every expert at norm 1
  let P: number[][] = Array.from({ length: E }, () => {
    const v = Array.from({ length: D }, () => rnd())
    const n = norm(v)
    return v.map((x) => x / n)
  })
  const history: number[][] = [P.map(norm)]
  const noise = lcg(8818)
  for (let t = 0; t < MAX_STEPS; t++) {
    // unit-size update per expert: noise plus a push along the expert's own direction
    const U = P.map((p, e) => {
      const n = norm(p)
      const raw = p.map((x) => noise() + PUSH[e] * (x / n))
      const rn = norm(raw)
      return raw.map((x) => x / rn)
    })
    if (mode === "expert") {
      P = P.map((p, e) => {
        const pn = norm(p)
        const moved = p.map((x, j) => x - LR * U[e][j] * pn)
        const mn = norm(moved)
        return moved.map((x) => (x / mn) * pn)
      })
    } else {
      const total = Math.sqrt(P.reduce((a, p) => a + norm(p) * norm(p), 0))
      const uTotal = Math.sqrt(U.reduce((a, u) => a + norm(u) * norm(u), 0))
      const moved = P.map((p, e) => p.map((x, j) => x - LR * U[e][j] * (total / uTotal)))
      const mTotal = Math.sqrt(moved.reduce((a, p) => a + norm(p) * norm(p), 0))
      P = moved.map((p) => p.map((x) => (x / mTotal) * total))
    }
    history.push(P.map(norm))
  }
  return history
}

export function Hyperball() {
  const [mode, setMode] = useState<"expert" | "layer">("layer")
  const [step, setStep] = useState(60)
  const hist = useMemo(() => ({ expert: simulate("expert"), layer: simulate("layer") }), [])
  const norms = hist[mode][step]
  const total = Math.sqrt(norms.reduce((a, n) => a + n * n, 0))
  const mean = norms.reduce((a, n) => a + n, 0) / E
  const cv = Math.sqrt(norms.reduce((a, n) => a + (n - mean) * (n - mean), 0) / E) / mean
  const MAXN = 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">one layer · 6 experts · MuonH step</span>
        <div className="flex gap-1">
          {[
            { v: "expert" as const, label: "norm per expert" },
            { v: "layer" as const, label: "norm per layer (#8621)" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              aria-pressed={mode === o.v}
              className={cn(
                "rounded-md border px-2 py-1 transition-colors",
                mode === o.v ? "border-foreground/60 bg-foreground/10" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 px-4 pt-4">
        {norms.map((n, e) => (
          <div key={NAMES[e]} className="flex items-center gap-3 font-mono text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">
              expert {NAMES[e]}
              {PUSH[e] > 0 ? " ↓" : PUSH[e] < 0 ? " ↑" : ""}
            </span>
            <div className="relative h-3 flex-1 rounded-sm bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{
                  width: `${Math.min(100, (n / MAXN) * 100)}%`,
                  background: e === 0 ? "oklch(0.62 0.18 30)" : e === 1 ? "oklch(0.6 0.15 250)" : "oklch(0.6 0.03 260)",
                }}
              />
              <div className="absolute inset-y-[-3px] border-l border-dashed border-foreground/50" style={{ left: `${(1 / MAXN) * 100}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{n.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 font-mono text-xs">
        <label className="flex flex-1 items-center gap-3">
          <span className="text-muted-foreground">step</span>
          <Range min={0} max={MAX_STEPS} value={step} onChange={(e) => setStep(Number(e.target.value))} className="flex-1" />
          <span className="w-8 tabular-nums">{step}</span>
        </label>
        <span>
          layer norm <b className="tabular-nums">{total.toFixed(3)}</b>
        </span>
        <span>
          CV <b className="tabular-nums">{cv.toFixed(3)}</b>
        </span>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A toy, not the hero&apos;s numbers. Every expert starts at norm 1 (dashed line) and gets a same-size update each
        step; A&apos;s gradient keeps asking it to shrink (↓), B&apos;s to grow (↑). Projected per expert, every bar stays
        at 1. Projected per layer, only the layer&apos;s total norm (√6 ≈ 2.449) is held, so A and B drift apart, the
        neutral experts wander, and the coefficient of variation (CV) of the six norms climbs.
      </figcaption>
    </figure>
  )
}
