"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

import { SENS } from "./data-extra"
import { ACCENT, Frame, GREEN, Pill, STREAM, T } from "./viz"

// Our re-run on Qwen3-0.6B (float32, CPU), five short passages of about 80
// tokens each (prose, code, French, dialogue, a recipe list). Three panels
// share the layer axis: how big the first token's residual is compared with
// the median of the rest, how little the median depends on which passage is
// used as the reference, and how many neurons have their largest activation
// at token 0. All measured.

const L = SENS.sink.length
const X0 = 40
const DX = 23
const COLORS = [STREAM, ACCENT, GREEN, "oklch(0.58 0.16 305)", "oklch(0.62 0.12 85)"]

export function SinkAndPassages() {
  const [sel, setSel] = useState<number | null>(null)
  const lo = 0
  const hi = mlog10(1000)
  const yS = (v: number) => 92 - ((mlog10(Math.max(v, 1)) - lo) / (hi - lo)) * 78

  const means = SENS.medians[0].map((_, l) => SENS.medians.reduce((s, row) => s + row[l], 0) / SENS.medians.length)
  const yN = (r: number) => 190 - ((r - 0.85) / 0.3) * 70

  return (
    <Frame
      label="the first token and the reference passage · Qwen3-0.6B · measured"
      right={
        <div className="flex flex-wrap gap-1">
          {SENS.passages.map((p, i) => (
            <Pill key={p} active={sel === i} onClick={() => setSel(sel === i ? null : i)}>
              {p}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          Top: the residual stream of token 0 leaving each layer, divided by the median over tokens 1 onward (log
          scale). Middle: each passage&apos;s median norm divided by the five-passage mean at that layer. Bottom: the share
          of a layer&apos;s 3,072 neurons whose largest absolute activation on the prose passage is at token 0.
        </>
      }
    >
      <svg viewBox="0 0 700 330" role="img" className="h-auto w-full">
        <title>
          Three aligned charts over the 28 layers. The first token&apos;s residual norm jumps from about 2 times the
          median at layer 1 to about 540 times at layer 2 and falls back to 3.5 times at layer 27. The five passages
          give medians within about 20 percent of each other at every layer. Almost no neuron peaks at token 0 except
          a few percent in layers 0 to 2 and 10.6 percent in the last layer.
        </title>
        {/* top: sink ratio */}
        {[1, 10, 100, 1000].map((v) => (
          <g key={v}>
            <line x1={X0} y1={yS(v)} x2={X0 + L * DX} y2={yS(v)} stroke="currentColor" strokeOpacity={0.1} />
            <T x={X0 - 6} y={yS(v) + 3} anchor="end" size={8.5} opacity={0.5}>{v}x</T>
          </g>
        ))}
        <polyline
          points={SENS.sink.map((v, l) => `${X0 + l * DX + DX / 2},${yS(v).toFixed(1)}`).join(" ")}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
        />
        {SENS.sink.map((v, l) => (
          <circle key={l} cx={X0 + l * DX + DX / 2} cy={yS(v)} r={2.4} fill={ACCENT} />
        ))}
        <T x={X0 + 3 * DX} y={yS(SENS.sink[2]) + 40} size={9} fill={ACCENT} opacity={1}>
          layer 2: {SENS.sink[2].toFixed(0)}x the median of the rest
        </T>
        <T x={X0} y={10} size={9} opacity={0.65}>token 0 norm / median of the rest</T>

        {/* middle: passages */}
        <line x1={X0} y1={yN(1)} x2={X0 + L * DX} y2={yN(1)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
        <T x={X0 - 6} y={yN(1) + 3} anchor="end" size={8.5} opacity={0.5}>1.0</T>
        <T x={X0 - 6} y={yN(1.1) + 3} anchor="end" size={8.5} opacity={0.5}>1.1</T>
        <T x={X0 - 6} y={yN(0.9) + 3} anchor="end" size={8.5} opacity={0.5}>0.9</T>
        {SENS.medians.map((row, p) =>
          row.map((v, l) => (
            <circle
              key={`${p}-${l}`}
              cx={X0 + l * DX + DX / 2 + (p - 2) * 2.4}
              cy={yN(v / means[l])}
              r={sel === p ? 3 : 2}
              fill={COLORS[p]}
              fillOpacity={sel === null || sel === p ? 0.9 : 0.18}
            />
          )),
        )}
        <T x={X0} y={118} size={9} opacity={0.65}>median norm by passage / mean over passages</T>

        {/* bottom: peak at token 0 */}
        {SENS.peak0.map((v, l) => (
          <rect key={l} x={X0 + l * DX + 4} y={300 - v * 600} width={DX - 8} height={Math.max(0.8, v * 600)} fill={STREAM} fillOpacity={0.7} />
        ))}
        <line x1={X0} y1={300} x2={X0 + L * DX} y2={300} stroke="currentColor" strokeOpacity={0.25} />
        <T x={X0} y={226} size={9} opacity={0.65}>share of neurons peaking at token 0 (0 to 10 percent)</T>
        <T x={X0 + 27 * DX + DX / 2} y={296 - SENS.peak0[27] * 600} anchor="middle" size={8.5} opacity={0.9}>
          {(SENS.peak0[27] * 100).toFixed(1)}%
        </T>
        {[0, 4, 8, 12, 16, 20, 24, 27].map((l) => (
          <T key={l} x={X0 + l * DX + DX / 2} y={316} anchor="middle" size={8.5} opacity={0.55}>{l}</T>
        ))}
        <T x={X0 + 14 * DX} y={328} anchor="middle" size={9} opacity={0.6}>layer</T>
      </svg>
    </Frame>
  )
}
