"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The idea the whole method rests on, computed live. A raw key/value vector has its
// energy concentrated in a few coordinates — a big dynamic range that a fixed set of
// quantization levels handles badly (the outliers clip, the rest waste precision).
// Multiply by a random orthogonal rotation (here a normalized Walsh-Hadamard transform,
// the same structured rotation QuIP/QJL use) and the energy spreads *evenly* across all
// coordinates. Now every coordinate follows the same known, well-behaved distribution,
// so a single data-free quantizer — set once, no calibration — fits every vector. Toggle
// the rotation and watch the quantization error collapse. Real numbers, computed in-browser.

const D = 16
// a deliberately spiky unit vector: energy in a few coordinates
const RAW = (() => {
  const v = [0.86, 0.42, 0.28, 0.12, 0.06, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01]
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0))
  return v.map((x) => x / n)
})()

// orthonormal fast Walsh-Hadamard transform (a structured random-ish rotation)
function fwht(a: number[]): number[] {
  const x = a.slice()
  for (let h = 1; h < D; h *= 2) {
    for (let i = 0; i < D; i += h * 2) {
      for (let j = i; j < i + h; j++) {
        const u = x[j], v = x[j + h]
        x[j] = u + v
        x[j + h] = u - v
      }
    }
  }
  const s = Math.sqrt(D)
  return x.map((v) => v / s)
}
const ROT = fwht(RAW)

function quantize(v: number[], bits: number, range: number): number[] {
  const levels = 2 ** bits - 1
  return v.map((x) => {
    const c = Math.max(-range, Math.min(range, x)) // clip
    const q = Math.round(((c + range) / (2 * range)) * levels)
    return (q / levels) * 2 * range - range
  })
}
const cos = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return d / (Math.sqrt(na) * Math.sqrt(nb))
}

export function Rotation() {
  const [rotated, setRotated] = useState(true)
  const [bits, setBits] = useState(3)

  // quantizer range tuned (data-free) for the ROTATED distribution: coords ~ N(0, 1/D)
  const range = 3 / Math.sqrt(D)

  const { vec, quant, sim } = useMemo(() => {
    const vec = rotated ? ROT : RAW
    const quant = quantize(vec, bits, range)
    return { vec, quant, sim: cos(vec, quant) }
  }, [rotated, bits, range])

  const maxAbs = Math.max(...vec.map((v) => Math.abs(v)), range)
  const H = 90
  const scaleY = (v: number) => (v / maxAbs) * (H / 2 - 4)

  const ACCENT = "oklch(0.72 0.15 195)"
  const BAD = "oklch(0.72 0.15 25)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">rotate, then quantize · one fixed quantizer for every vector</span>
        <div className="flex gap-1">
          {[
            { k: false, label: "raw" },
            { k: true, label: "rotated" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setRotated(o.k)}
              aria-pressed={rotated === o.k}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", rotated === o.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* coordinate bars with quantization band */}
        <svg viewBox={`0 0 ${D * 24} ${H}`} className="w-full" role="img" aria-label="Coordinate magnitudes of the vector; raw is spiky, rotated is even. The shaded band is the fixed quantizer range.">
          {/* quantizer range band */}
          <rect x={0} y={H / 2 - scaleY(range)} width={D * 24} height={scaleY(range) * 2} fill={ACCENT} fillOpacity="0.08" />
          <line x1={0} y1={H / 2} x2={D * 24} y2={H / 2} stroke="currentColor" strokeOpacity="0.15" />
          {vec.map((v, i) => {
            const clipped = Math.abs(v) > range
            return (
              <rect
                key={i}
                x={i * 24 + 5}
                y={v >= 0 ? H / 2 - scaleY(v) : H / 2}
                width={14}
                height={Math.max(1, Math.abs(scaleY(v)))}
                rx={1.5}
                fill={clipped ? BAD : ACCENT}
                fillOpacity={clipped ? 0.95 : 0.7}
              />
            )
          })}
        </svg>
        <div className="mt-1 text-center font-mono text-[9px] text-muted-foreground">
          {D} coordinates · shaded = the fixed quantizer range (±3/√d) · <span style={{ color: BAD }}>red = clipped outlier</span>
        </div>

        {/* stats */}
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">reconstruction cosine similarity</div>
            <div className="font-medium" style={{ color: sim > 0.99 ? ACCENT : BAD }}>{sim.toFixed(4)}</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">coordinates outside the quantizer</div>
            <div className="font-medium" style={{ color: vec.filter((v) => Math.abs(v) > range).length ? BAD : ACCENT }}>
              {vec.filter((v) => Math.abs(v) > range).length} / {D}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>quantizer bit-width</span>
            <span className="tabular-nums text-foreground">{bits}-bit ({2 ** bits} levels)</span>
          </div>
          <input type="range" min={1} max={5} step={1} value={bits} onChange={(e) => setBits(+e.target.value)} className="w-full accent-foreground" aria-label="bits" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {rotated
            ? "Rotated: the energy is spread evenly, nothing clips, and the reconstruction error drops — using a quantizer set from the known post-rotation distribution alone, with no calibration data. Notice the cosine rise and the 0 clipped coordinates versus the raw case."
            : "Raw: an outlier coordinate blows past the quantizer's range and clips (red), while the fixed levels are wasted on the empty middle. The direction survives, but the error is concentrated in exactly the coordinate that matters most — and the fix is to rotate first."}
        </p>
      </div>
    </figure>
  )
}
