"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// "State times scale": Neutrino-1's ternary weights are grouped into fixed-size blocks
// along a layer's input dimension, and every block shares one higher-precision scale —
// coarser than a per-weight number, finer than Ternary15M's one-scale-per-output-channel
// (absmean over the whole row). Pick a block size and this recomputes, live, on 16 fixed
// illustrative latent weights: the ternary state per weight (round(clamp(w / scale, -1,
// 1))), the scale each block shares, and the row's total reconstruction error. This is a
// worked toy, not measurements from the real 4,096-wide Neutrino-1 layers — the point is
// the mechanism, not the exact numbers.

const LATENT = [0.82, -0.15, 0.61, -0.73, 0.09, 0.44, -0.58, 0.21, 0.67, -0.32, 0.05, -0.81, 0.38, 0.16, -0.47, 0.72]
const N = LATENT.length

const PLUS = "oklch(0.62 0.17 250)"
const MINUS = "oklch(0.6 0.19 15)"
const ZERO = "oklch(0.55 0.03 260)"

const BLOCK_SIZES = [2, 4, 8, 16]

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x))
}

export function BlockScale() {
  const [blockSize, setBlockSize] = useState(4)

  const blocks: { scale: number; start: number; values: number[]; states: number[] }[] = []
  for (let i = 0; i < N; i += blockSize) {
    const values = LATENT.slice(i, i + blockSize)
    const scale = values.reduce((s, v) => s + Math.abs(v), 0) / values.length
    const states = values.map((v) => (scale > 0 ? Math.round(clamp(v / scale, -1, 1)) : 0))
    blocks.push({ scale, start: i, values, states })
  }

  let totalError = 0
  for (const b of blocks) {
    for (let k = 0; k < b.values.length; k++) {
      totalError += Math.abs(b.values[k] - b.states[k] * b.scale)
    }
  }

  const stateColor = (s: number) => (s > 0 ? PLUS : s < 0 ? MINUS : ZERO)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>state × scale · block-wise ternary quantization</span>
        <span className="text-muted-foreground/50">worked toy, 16 weights</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">block size</span>
          {BLOCK_SIZES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBlockSize(b)}
              aria-pressed={blockSize === b}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                blockSize === b ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={blockSize === b ? { background: "var(--foreground)" } : undefined}
            >
              {b === 16 ? "16 (whole row)" : b}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-2.5 gap-y-4">
          {blocks.map((b, bi) => (
            <div key={bi} className="rounded-md border border-dashed border-muted-foreground/30 p-1.5">
              <div className="flex gap-1">
                {b.values.map((v, k) => (
                  <div key={k} className="flex w-9 flex-col items-center gap-1">
                    <span className="font-mono text-[9px] text-muted-foreground tabular-nums">{v.toFixed(2)}</span>
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] font-semibold"
                      style={{
                        background: b.states[k] === 0 ? "var(--muted)" : stateColor(b.states[k]),
                        color: b.states[k] === 0 ? "var(--muted-foreground)" : "var(--background)",
                      }}
                    >
                      {b.states[k] > 0 ? "+1" : b.states[k] < 0 ? "−1" : "0"}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 text-center font-mono text-[9px] text-muted-foreground">
                scale {b.scale.toFixed(3)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t pt-3 font-mono text-[11px] text-muted-foreground">
          <span>
            scales stored: <span className="text-foreground">{blocks.length}</span>
          </span>
          <span>
            row error Σ|latent − state·scale|: <span className="text-foreground">{totalError.toFixed(3)}</span>
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every block's stored weight is a state in <code>{"{−1, 0, +1}"}</code> times that block's shared scale —
          &quot;state times scale,&quot; in Fermion&apos;s own words. Small blocks (2) buy more scales — more metadata
          bytes — and generally track the row more closely; one scale for the{" "}
          <span className="text-foreground">whole row</span> (16) is the cheapest to store and the coarsest fit.
          That whole-row case is exactly{" "}
          <a href="/articles/ternary15m" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
            Ternary15M&apos;s
          </a>{" "}
          absmean-per-output-channel scale — Neutrino-1 instead splits each row into many fixed-size blocks along the
          input dimension, trading a little more metadata for a tighter fit per group.
        </p>
      </div>
    </figure>
  )
}
