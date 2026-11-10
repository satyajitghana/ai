"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What one solver call costs on a CPU, joint versus a block at a time. MEASURED: a shape-matched re-implementation
// of one Solv3R call (my code, random weights: a 768-wide pre-norm block within each view, one across all views,
// 12 heads, MLP 3072, the input injection and the RMS rescale), fp32, PyTorch 2.14.1, 2 threads on a shared 4-vCPU
// box, 869 tokens per view (a 504 x 336 photo: 36 x 24 patches + 5 camera and register tokens). Median of 3 calls.
const MEASURED: { s: number; t: number; mb: number }[] = [
  { s: 4, t: 0.79, mb: 102 },
  { s: 8, t: 1.94, mb: 244 },
  { s: 16, t: 5.92, mb: 570 },
  { s: 32, t: 19.13, mb: 1059 },
  { s: 64, t: 68.67, mb: 2118 },
]
// Fit through the 8- and 64-view points: t(S) = A*S + B*S^2. It predicts 5.78 s at 16 and 19.16 s at 32.
const A = 0.1244
const B = 0.01483
// Peak working memory above the resident baseline grows about 33 MB per view in the call (fp32, CPU).
const MB_PER_VIEW = 33
// State plus encodings kept for every view: 2 x 869 x 768 fp32 values.
const STATE_MB_PER_VIEW = (2 * 869 * 768 * 4) / 1048576

const callT = (s: number) => A * s + B * s * s
const fmtS = (v: number) => (v < 60 ? `${v.toFixed(1)} s` : `${(v / 60).toFixed(1)} min`)

export function BlockCost() {
  const [n, setN] = useState(128)
  const [b, setB] = useState(8)
  const blocks = Math.ceil(n / b)
  const joint = callT(n)
  const sweep = blocks * callT(b)
  const jointMem = n * MB_PER_VIEW
  const blockMem = b * MB_PER_VIEW
  const state = n * STATE_MB_PER_VIEW
  const max = Math.max(joint, sweep)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        one call per view, joint or in blocks · CPU times measured on a shape-matched block, larger N extrapolated
      </div>
      <div className="space-y-2.5 p-4">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">photos</span>
          <Range min={8} max={256} step={8} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="photos" className="w-full" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{n}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">views per block</span>
          <Range min={4} max={32} step={4} value={b} onChange={(e) => setB(Number(e.target.value))} aria-label="views per block" className="w-full" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{b}</span>
        </label>
        <div className="space-y-1.5 pt-1 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-40 shrink-0">all {n} in one call</span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full" style={{ width: `${((joint / max) * 100).toFixed(1)}%`, background: "oklch(0.62 0.16 35)" }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums">{fmtS(joint)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-40 shrink-0">
              {blocks} blocks of {b}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full" style={{ width: `${((sweep / max) * 100).toFixed(1)}%`, background: "oklch(0.60 0.15 255)" }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums">{fmtS(sweep)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 pt-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
          <span>
            working memory, joint ≈ <b className="text-foreground tabular-nums">{(jointMem / 1024).toFixed(2)} GB</b>
          </span>
          <span>
            working memory, one block ≈ <b className="text-foreground tabular-nums">{blockMem} MB</b>
          </span>
          <span>
            state + encodings, all {n} views = <b className="text-foreground tabular-nums">{state.toFixed(0)} MB</b>
          </span>
          <span>
            sweep is <b className="text-foreground tabular-nums">{(joint / sweep).toFixed(1)}x</b> cheaper per view-call
          </span>
        </div>
      </div>
      <div className="overflow-x-auto border-t px-4 py-2.5">
        <table className="w-full font-mono text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">views in the call (measured)</th>
              {MEASURED.map((m) => (
                <th key={m.s} className="text-right font-normal">
                  {m.s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>seconds per call</td>
              {MEASURED.map((m) => (
                <td key={m.s} className="text-right">
                  {m.t.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr>
              <td>peak MB above baseline</td>
              {MEASURED.map((m) => (
                <td key={m.s} className="text-right">
                  {m.mb}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Measured: one call of a block with Solv3R&apos;s shapes (not the released model; the permission layer refused to
        run its code) on 2 CPU threads, fp32, 869 tokens a view. The global attention is what grows as the square of the
        views in the call: t(S) ≈ 0.124·S + 0.0148·S² seconds fits the five points within 7% (the 4-view call is the worst). Above 64 views the bars are
        that fit, not a measurement. The block sweep gives every view one call; it says nothing about how many sweeps a
        scene needs or how good the answer is.
      </figcaption>
    </figure>
  )
}
