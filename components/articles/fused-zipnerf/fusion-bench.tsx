"use client"

import { useState } from "react"

import { mlog2, mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { FUSION } from "./data"

// Toy 2: a chain of eight elementwise operations over 16,777,216 float32 values on ONE CPU thread of a shared Xeon
// (min of seven runs; the machine was busy, so read the ratios, not the milliseconds). The chain is
//   t1 = x*a; t2 = t1+b; t3 = max(t2,0); t4 = t3*t3; t5 = t4+x; t6 = t5*c; t7 = t6-t3; out = t7*d
// Unfused = one pass over memory per operation (10 reads and 8 writes of the array: 72 B per element). Fused = one read and one
// write (8 B per element). "chunked" runs the whole chain on a slice that fits in cache; torch.compile fuses it into one loop.
// This is the memory-bound effect at CPU scale. It is not a prediction of any GPU speed.

const C_BAR = "oklch(0.62 0.16 285)"
const C_FUSED = "oklch(0.62 0.16 150)"

const BEST = FUSION.chunked.reduce((a, b) => (b.ms < a.ms ? b : a))
const BARS = [
  { k: "torch eager (8 ops)", ms: FUSION.eager, fused: false },
  { k: "numpy, new array per op", ms: FUSION.alloc, fused: false },
  { k: "numpy, in-place passes", ms: FUSION.inplace, fused: false },
  { k: "torch.compile (one loop)", ms: FUSION.compiled, fused: true },
  { k: `numpy, chunked (${BEST.chunk.toLocaleString("en-US")} values)`, ms: BEST.ms, fused: true },
]

const W = 460
const H = 190
const PL = 40
const PR = 10
const PT = 10
const PB = 28
const lgMin = mlog10(30)
const lgMax = mlog10(700)
const cx = (i: number) => PL + (i / (FUSION.chunked.length - 1)) * (W - PL - PR)
const cy = (ms: number) => PT + (1 - (mlog10(ms) - lgMin) / (lgMax - lgMin)) * (H - PT - PB)

export function FusionBench() {
  const [sel, setSel] = useState(FUSION.chunked.findIndex((c) => c.chunk === BEST.chunk))
  const c = FUSION.chunked[sel]
  const maxMs = Math.max(...BARS.map((b) => b.ms))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        toy: fusing 8 elementwise ops on one CPU thread · {FUSION.n.toLocaleString("en-US")} values · min of 7 runs · not a GPU measurement
      </div>
      <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
        <ul className="space-y-2" aria-label="Time for the eight-operation chain">
          {BARS.map((b) => (
            <li key={b.k} className="font-mono text-[11px]">
              <div className="mb-0.5 flex justify-between text-muted-foreground">
                <span>{b.k}</span>
                <span className="tabular-nums">{b.ms.toFixed(1)} ms</span>
              </div>
              <div className="h-2.5 rounded bg-muted" role="img" aria-label={`${b.k}: ${b.ms} milliseconds`}>
                <div className="h-full rounded" style={{ width: `${(b.ms / maxMs) * 100}%`, background: b.fused ? C_FUSED : C_BAR }} />
              </div>
            </li>
          ))}
          <li className="pt-1 text-xs text-muted-foreground">
            torch.compile needed {FUSION.compileFirstCallS.toFixed(0)} s to compile on first call: the cost the repo pays once per kernel shape, with NVRTC, and caches.
          </li>
        </ul>
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" className="w-full" aria-label="Time of the chunked chain against chunk size, log axes: high for tiny chunks, lowest near 262,144 values, higher again for whole-array chunks.">
            {[50, 100, 200, 400].map((v) => (
              <g key={v}>
                <line x1={PL} x2={W - PR} y1={cy(v)} y2={cy(v)} stroke="currentColor" strokeOpacity={0.12} />
                <text x={PL - 5} y={cy(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>
                  {v}
                </text>
              </g>
            ))}
            <line x1={PL} x2={W - PR} y1={cy(FUSION.inplace)} y2={cy(FUSION.inplace)} stroke={C_BAR} strokeDasharray="4 3" />
            <text x={W - PR} y={cy(FUSION.inplace) - 3} textAnchor="end" fontSize={9} fill={C_BAR}>
              in-place passes
            </text>
            <path d={FUSION.chunked.map((p, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${cy(p.ms).toFixed(1)}`).join(" ")} fill="none" stroke={C_FUSED} strokeWidth={2} />
            {FUSION.chunked.map((p, i) => (
              <g key={p.chunk}>
                <circle cx={cx(i)} cy={cy(p.ms)} r={i === sel ? 4.5 : 2.5} fill={C_FUSED} />
                <text x={cx(i)} y={H - PB + 13} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.6}>
                  2^{Math.round(mlog2(p.chunk))}
                </text>
              </g>
            ))}
            <text x={(PL + W - PR) / 2} y={H - 3} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>
              chunk size, values (milliseconds on the vertical axis, log)
            </text>
          </svg>
          <div className="flex flex-wrap gap-1">
            {FUSION.chunked.map((p, i) => (
              <button key={p.chunk} type="button" onClick={() => setSel(i)} aria-pressed={sel === i} className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors", sel === i ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}>
                {p.chunk.toLocaleString("en-US")}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] tabular-nums">
            {c.chunk.toLocaleString("en-US")} values per chunk: {c.ms.toFixed(1)} ms, {(FUSION.inplace / c.ms).toFixed(1)}× the in-place passes
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tiny chunks lose to call overhead (numpy issues 8 calls per chunk); whole-array chunks lose the cache. The gain sits in between.
            Unfused, the chain moves {FUSION.bytesUnfused} B per value; fused, {FUSION.bytesFused} B.
          </p>
        </div>
      </div>
    </figure>
  )
}
