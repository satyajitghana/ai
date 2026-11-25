"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"

// What Hy4 flash's Engram gate can and cannot do. Each layer adds (g + s) * v to each of its four
// residual streams, where v is the memory's value (RMS-normed, times a learned gamma), g is the gate,
// sigmoid(sign(d) * sqrt(|d|)) of a scaled dot product d between the stream's hidden state and the
// memory's key, and s is a learned per-stream, per-channel scale that no gate multiplies.
// S below is the mean of each `unified_per_hc_scales.<stream>` tensor (3,072 values; the 5th to 95th
// percentile spread within a tensor is at most 0.04), read from the BF16 checkpoint by range request.

const LAYERS = [1, 11, 21, 31] as const
const S: Record<number, [number, number, number, number]> = {
  1: [-0.007, -0.014, 0.005, -0.026],
  11: [-0.016, -0.182, -0.096, -0.036],
  21: [-0.353, -0.157, -0.168, -0.029],
  31: [-1.103, -0.185, -0.271, -0.127],
}

const LO = -1.2
const HI = 1.1
const pos = (x: number) => ((x - LO) / (HI - LO)) * 100
const gate = (d: number) => 1 / (1 + mexp(-(d < 0 ? -1 : 1) * Math.sqrt(Math.abs(d))))

export function GateOffset() {
  const [d, setD] = useState(0)
  const g = gate(d)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="mr-auto">multiplier on the memory, (g + s), per layer and stream</span>
        <label className="flex items-center gap-2">
          d
          <input
            type="range"
            min={-16}
            max={16}
            step={0.25}
            value={d}
            onChange={(e) => setD(Number(e.target.value))}
            aria-label="gate logit before the square root"
          />
          <span className="w-28 text-foreground">
            {d.toFixed(2)} {"→"} g = {g.toFixed(3)}
          </span>
        </label>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="relative ml-24 h-4 font-mono text-[10px] text-muted-foreground">
          {[-1, -0.5, 0, 0.5, 1].map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pos(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
        {LAYERS.map((L) => (
          <div key={L} className="space-y-1">
            {S[L].map((s, c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="w-22 shrink-0 font-mono text-[10px] text-muted-foreground">
                  layer {L} · s{c}
                </span>
                <div className="relative h-3 flex-1 rounded bg-muted/40">
                  <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${pos(0)}%` }} />
                  <div
                    className="absolute inset-y-0.5 rounded bg-foreground/25"
                    style={{ left: `${pos(s)}%`, width: `${pos(1 + s) - pos(s)}%` }}
                  />
                  <div className="absolute inset-y-0 w-1 -translate-x-1/2 rounded bg-foreground" style={{ left: `${pos(g + s)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Each bar is the range the multiplier can take, from s (gate shut) to 1 + s (gate open); the dot is where the slider
        puts it. Where the bar crosses the zero line, the gate can silence the memory. At layer 31, stream 0, it cannot:
        the multiplier runs from about -1.10 to -0.10. Values: per-stream means of the checkpoint&apos;s{" "}
        <code>unified_per_hc_scales</code>.
      </figcaption>
    </figure>
  )
}
