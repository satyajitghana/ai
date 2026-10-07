"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { TLUT, TLUT_STEP, WORDS } from "./tile-data"

// A bitshift-trellis decoder, run on a real tile.
//
// "4-bit spine" reproduces decode.py's _ne_states + _ne_full_lut
// (decode.py:207-232 in SyzygyResearch/Mach-2-Additive-Medium) exactly:
// a 16-bit window slides 8 bits per step over the tile's 1,024-bit stream,
// wrapping at the end (tail-biting); the window's value s is hashed as
// p = s*(s+1); bits 6..14 of p pick one of 512 two-value rows, and bit 15
// flips the sign of the first value. That is QTIP's "HYB" code (Tseng et al.,
// arXiv 2406.11235, Algorithm 3) with Q = 9. The 256 values are the tile
// before its scale and the two Hadamard rotations are undone.
//
// "expert" modes walk the same bits the way the routed-expert codec does
// (decode.py:114-121, K4 fresh bits per 4 weights, 16-bit window), to show
// what changes with the rate. The expert codebook is a 65,536-entry table that
// this widget does not ship, so expert mode shows positions, not values.


const bitAt = (i: number) => (WORDS[i >> 4] >> (15 - (i & 15))) & 1

type Mode = { id: string; label: string; step: number; v: number; tileBits: number }

const MODES: Mode[] = [
  { id: "spine", label: "4-bit spine", step: 8, v: 2, tileBits: 1024 },
  { id: "k4", label: "expert, 1.0 bit", step: 4, v: 4, tileBits: 256 },
  { id: "k6", label: "expert, 1.5 bits", step: 6, v: 4, tileBits: 384 },
  { id: "k8", label: "expert, 2.0 bits", step: 8, v: 4, tileBits: 512 },
]

function stateAt(t: number, m: Mode) {
  let s = 0
  for (let j = 0; j < 16; j++) s = s * 2 + bitAt((t * m.step + j) % m.tileBits)
  return s
}

function hyb(s: number) {
  const p = s * (s + 1) // < 2^32, exact in a double
  const row = Math.floor(p / 64) % 512
  const flip = Math.floor(p / 32768) % 2 === 1
  const [a, b] = TLUT[row]
  return { p, row, flip, a: flip ? -a : a, b }
}

const bin16 = (s: number) => s.toString(2).padStart(16, "0")

function cellColor(v: number) {
  const mag = Math.min(1, Math.abs(v) / 2.2)
  const hue = v >= 0 ? 250 : 35
  return `oklch(${(0.97 - 0.42 * mag).toFixed(3)} ${(0.02 + 0.13 * mag).toFixed(3)} ${hue})`
}

export function TrellisWalk() {
  const [modeId, setModeId] = useState("spine")
  const mode = MODES.find((m) => m.id === modeId)!
  const nSteps = (256 / mode.v) | 0
  const [t, setT] = useState(0)
  const step = Math.min(t, nSteps - 1)

  const spineVals = useMemo(() => {
    const out: number[] = []
    const m = MODES[0]
    for (let k = 0; k < 128; k++) {
      const h = hyb(stateAt(k, m))
      out.push(h.a * TLUT_STEP, h.b * TLUT_STEP)
    }
    return out
  }, [])

  const s = stateAt(step, mode)
  const prev = step > 0 ? stateAt(step - 1, mode) : null
  const h = hyb(s)
  const start = (step * mode.step) % mode.tileBits

  // 48 bits of context: 16 before the window, the window, 16 after
  const ctx: { i: number; b: number; inWin: boolean; fresh: boolean }[] = []
  for (let j = -16; j < 32; j++) {
    const i = (((start + j) % mode.tileBits) + mode.tileBits) % mode.tileBits
    ctx.push({ i, b: bitAt(i), inWin: j >= 0 && j < 16, fresh: j >= 16 - mode.step && j < 16 })
  }

  const lo = step * mode.v
  const hi = lo + mode.v

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">trellis walk · layer 0, shared expert gate, tile 0</span>
        <div className="flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModeId(m.id)}
              aria-pressed={modeId === m.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                modeId === m.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[1fr_auto] sm:p-4">
        <div className="min-w-0">
          <label className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span className="shrink-0">
              step {step} / {nSteps - 1}
            </span>
            <Range min={0} max={nSteps - 1} value={step} onChange={(e) => setT(Number(e.target.value))} className="w-full" />
          </label>

          <div className="mt-3 overflow-x-auto">
            <div className="flex w-max font-mono text-[11px] leading-5" aria-label="bit stream around the current window">
              {ctx.map((c, k) => (
                <span
                  key={k}
                  className={cn(
                    "inline-block w-[0.9em] text-center",
                    c.inWin ? "bg-sky-500/15 text-foreground" : "text-muted-foreground/50",
                    c.fresh && "font-bold text-sky-700 dark:text-sky-300"
                  )}
                >
                  {c.b}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            window = bits {start} to {(start + 15) % mode.tileBits} of {mode.tileBits}
            {start + 15 >= mode.tileBits ? " (wraps: tail-biting)" : ""} · bold = the {mode.step} fresh bits;{" "}
            {16 - mode.step} are shared with the previous step
          </p>

          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">state s</dt>
            <dd className="text-foreground">
              {bin16(s)} = {s}
              {prev !== null ? <span className="text-muted-foreground"> (previous {prev})</span> : null}
            </dd>
            {mode.id === "spine" ? (
              <>
                <dt className="text-muted-foreground">hash p = s(s+1)</dt>
                <dd className="text-foreground">{h.p}</dd>
                <dt className="text-muted-foreground">row = bits 6..14</dt>
                <dd className="text-foreground">
                  {h.row} → ({TLUT[h.row][0]}, {TLUT[h.row][1]}) × {TLUT_STEP.toFixed(4)}
                </dd>
                <dt className="text-muted-foreground">bit 15 flips</dt>
                <dd className="text-foreground">{h.flip ? "yes, negate the first" : "no"}</dd>
                <dt className="text-muted-foreground">weights {lo}, {lo + 1}</dt>
                <dd className="text-foreground">
                  {(h.a * TLUT_STEP).toFixed(3)}, {(h.b * TLUT_STEP).toFixed(3)}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">emits</dt>
                <dd className="text-foreground">
                  weights {lo} to {hi - 1}: row {s} of a 65,536 × 4 table
                </dd>
                <dt className="text-muted-foreground">tile cost</dt>
                <dd className="text-foreground">
                  {mode.tileBits} bits for 256 weights = {(mode.tileBits / 256).toFixed(2)} bits each
                </dd>
              </>
            )}
          </dl>
        </div>

        <div>
          <div
            className="grid grid-cols-16 gap-px rounded border bg-border p-px"
            style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))", width: 176 }}
            role="img"
            aria-label="The 16 by 16 tile of decoded values, before scaling and rotation; the current step's weights are outlined."
          >
            {spineVals.map((v, i) => {
              const on = i >= lo && i < hi
              return (
                <div
                  key={i}
                  className={cn("aspect-square", on && "outline outline-2 outline-foreground")}
                  style={{ background: mode.id === "spine" ? cellColor(v) : on ? "oklch(0.7 0.1 250)" : "oklch(0.93 0.005 250)" }}
                />
              )
            })}
          </div>
          <p className="mt-1 w-[176px] font-mono text-[10px] leading-4 text-muted-foreground">
            {mode.id === "spine" ? "decoded tile, blue +, orange −, before scale and rotation" : "which weights this step writes"}
          </p>
        </div>
      </div>
    </figure>
  )
}
