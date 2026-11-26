"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// One Q8_0 block (32 weights) dotted with 32 activations, the way llm.asm's FAST_Q8=1
// kernel does it (shared/matmul.asm: quantize_x_q8_0, then INT8_1ROW_4BLK):
//   1. activations -> int8 with one scale per block, sx = max|x| / 127
//   2. vpabsb / vpsignb: |qx| as unsigned bytes, w carries qx's sign
//   3. vpmaddubsw: u8 x s8, adjacent pairs summed -> 16 int16 lanes
//   4. vpmaddwd with ones: adjacent int16 pairs -> 8 int32 lanes
//   5. vcvtdq2ps, then FMA by (sw * sx) into a float accumulator
// The data is a seeded toy block, not weights from the model.

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// round half to even, like vcvtps2dq under the default MXCSR
function rne(v: number) {
  const f = Math.floor(v)
  const d = v - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

const STEPS = [
  { name: "The block", op: "load", body: "32 int8 weights and one scale, as they sit in the row. The activations are still float32." },
  { name: "Quantize x once", op: "quantize_x_q8_0", body: "Before any thread starts, x becomes int8 with its own scale per 32: sx = max|x| / 127. Every row reuses it." },
  { name: "Move the sign", op: "vpabsb + vpsignb", body: "vpmaddubsw wants one unsigned operand. Take |qx| as u8 and push qx's sign onto w. The product is unchanged." },
  { name: "Multiply, add pairs", op: "vpmaddubsw", body: "32 byte products, adjacent pairs summed into 16 int16 lanes. The worst case, 2 x 127 x 127 = 32,258, fits under 32,767." },
  { name: "Widen and add pairs", op: "vpmaddwd x 1", body: "Multiply by a vector of ones to add neighbouring int16s into 8 int32 lanes. Still exact integers." },
  { name: "Scale and accumulate", op: "vcvtdq2ps + vfmadd231ps", body: "Convert to float and multiply-add by sw x sx into one of four accumulators. The 8 lanes are summed once per row." },
]

export function Q8Dot() {
  const [seed, setSeed] = useState(7)
  const [step, setStep] = useState(0)

  const d = useMemo(() => {
    const r = lcg(seed * 7919 + 13)
    const w = Array.from({ length: 32 }, () => rne((r() * 2 - 1) * 127))
    const sw = (8 + Math.floor(r() * 24)) / 4096 // exactly representable, like an fp16 scale
    const x = Array.from({ length: 32 }, () => Math.round(((r() * 2 - 1) * 3 + (r() < 0.1 ? 4 : 0)) * 1000) / 1000)
    const amax = Math.max(...x.map((v) => Math.abs(v)))
    const sx = amax / 127
    const inv = amax > 0 ? 127 / amax : 0
    const qx = x.map((v) => Math.max(-127, Math.min(127, rne(v * inv))))
    const ax = qx.map((v) => Math.abs(v))
    const sw8 = w.map((v, i) => (qx[i] === 0 ? 0 : qx[i] < 0 ? -v : v))
    const p16 = Array.from({ length: 16 }, (_, i) => ax[2 * i] * sw8[2 * i] + ax[2 * i + 1] * sw8[2 * i + 1])
    const p32 = Array.from({ length: 8 }, (_, i) => p16[2 * i] + p16[2 * i + 1])
    const isum = p32.reduce((a, b) => a + b, 0)
    const q8 = isum * sw * sx
    const exactQ8xF32 = w.reduce((a, v, i) => a + v * sw * x[i], 0)
    return { w, sw, x, amax, sx, qx, ax, sw8, p16, p32, isum, q8, exactQ8xF32 }
  }, [seed])

  const cell = "flex h-7 items-center justify-center rounded-sm border border-border font-mono text-[10px] tabular-nums"
  const s = STEPS[step]

  const row = (label: string, vals: (number | string)[], tone: string, cols = 32) => (
    <div className="mb-2">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 16)}, minmax(0, 1fr))` }}>
        {vals.map((v, i) => (
          <div key={i} className={cn(cell, tone)}>
            {v}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">One Q8_0 block through the INT8 x INT8 kernel</figcaption>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-40"
          onClick={() => setStep((v) => Math.max(0, v - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        <button
          className="rounded-md border border-foreground bg-foreground px-3 py-1 text-xs text-background disabled:opacity-40"
          onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
          disabled={step === STEPS.length - 1}
        >
          Next
        </button>
        <button className="rounded-md border border-border px-3 py-1 text-xs" onClick={() => setSeed((v) => v + 1)}>
          New block
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}: <code>{s.op}</code>
        </span>
      </div>
      <p className="mb-3 font-medium">{s.name}</p>
      <p className="mb-4 text-muted-foreground">{s.body}</p>

      {row(`w, int8 (scale sw = ${d.sw.toFixed(6)})`, d.w, "bg-sky-500/10")}
      {step === 0 && row("x, float32", d.x.map((v) => v.toFixed(2)), "bg-amber-500/10")}
      {step >= 1 && row(`qx, int8 (sx = ${d.amax.toFixed(3)} / 127 = ${d.sx.toFixed(5)})`, d.qx, "bg-amber-500/15")}
      {step >= 2 && row("|qx|, as unsigned bytes", d.ax, "bg-amber-500/25")}
      {step >= 2 && row("w with the sign of qx", d.sw8, "bg-sky-500/25")}
      {step >= 3 && row("16 int16 lanes", d.p16, "bg-emerald-500/20", 16)}
      {step >= 4 && row("8 int32 lanes", d.p32, "bg-emerald-500/35", 8)}

      {step >= 5 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded border border-border p-2">
            <div className="text-xs text-muted-foreground">Integer sum x sw x sx</div>
            <div className="font-mono">
              {d.isum} x {d.sw.toFixed(6)} x {d.sx.toFixed(5)} = {d.q8.toFixed(5)}
            </div>
          </div>
          <div className="rounded border border-border p-2">
            <div className="text-xs text-muted-foreground">Q8_0 weights x float32 x (FAST_Q8=0)</div>
            <div className="font-mono">{d.exactQ8xF32.toFixed(5)}</div>
          </div>
          <div className="rounded border border-border p-2">
            <div className="text-xs text-muted-foreground">Error from quantizing x</div>
            <div className="font-mono">{(d.q8 - d.exactQ8xF32).toExponential(2)}</div>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        A seeded toy block, not the model&apos;s weights. The integer stages are exact; the only new error is rounding x to 255
        levels per block, which is why, against the same Python Q8_0 reference, FAST_Q8=1 scores a logit cosine of 0.9996510 and FAST_Q8=0
        scores 1.000000000.
      </p>
    </figure>
  )
}
