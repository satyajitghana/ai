"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { RESID_MEDIAN } from "./data"
import { ACCENT, Frame, Pill, STREAM, T } from "./viz"

// The residual stream as an isometric skyline: one bar per layer, height
// proportional to the median norm of the stream leaving that layer (measured,
// Qwen3-0.6B, linear scale on purpose so the 74x spread is visible). The
// orange cap is the push under the chosen rule.

type Rule = "relative" | "fixed"
const FIXED = 20
const MAX = Math.max(...RESID_MEDIAN)
const SCALE = 100 / MAX
const W = 10
const D = 10
const STEP = 13

function P(x: number, y: number, z: number): [number, number] {
  return [40 + (x - y) * 0.866, 18 + (x + y) * 0.5 - z]
}

function pts(list: [number, number][]) {
  return list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")
}

function Bar({ i, h, cap, hot }: { i: number; h: number; cap: number; hot: boolean }) {
  const x = i * STEP
  const top = h + cap
  const base = hot ? 0.95 : 0.5
  return (
    <g>
      <polygon points={pts([P(x, D, 0), P(x + W, D, 0), P(x + W, D, h), P(x, D, h)])} fill={STREAM} fillOpacity={base * 0.55} />
      <polygon points={pts([P(x + W, 0, 0), P(x + W, D, 0), P(x + W, D, h), P(x + W, 0, h)])} fill={STREAM} fillOpacity={base * 0.8} />
      <polygon points={pts([P(x, 0, h), P(x + W, 0, h), P(x + W, D, h), P(x, D, h)])} fill={STREAM} fillOpacity={base} />
      {cap > 0.3 && (
        <>
          <polygon points={pts([P(x, D, h), P(x + W, D, h), P(x + W, D, top), P(x, D, top)])} fill={ACCENT} fillOpacity={0.6} />
          <polygon points={pts([P(x + W, 0, h), P(x + W, D, h), P(x + W, D, top), P(x + W, 0, top)])} fill={ACCENT} fillOpacity={0.85} />
          <polygon points={pts([P(x, 0, top), P(x + W, 0, top), P(x + W, D, top), P(x, D, top)])} fill={ACCENT} />
        </>
      )}
    </g>
  )
}

export function ResidualStack() {
  const [layer, setLayer] = useState(16)
  const [dose, setDose] = useState(0.3)
  const [rule, setRule] = useState<Rule>("relative")

  const push = (l: number) => (rule === "relative" ? dose * RESID_MEDIAN[l] : FIXED)
  const ratio = push(layer) / RESID_MEDIAN[layer]

  return (
    <Frame
      label="the residual stream by layer · Qwen3-0.6B · measured medians, linear scale"
      right={
        <div className="flex gap-1">
          <Pill active={rule === "relative"} onClick={() => setRule("relative")}>dose x residual norm</Pill>
          <Pill active={rule === "fixed"} onClick={() => setRule("fixed")}>fixed push of {FIXED}</Pill>
        </div>
      }
      note={
        <>
          Bar height is the median norm of the stream leaving each layer, from 8.1 at layer 0 to 598.0 at layer 27.
          The orange cap is the push. Under a fixed push of {FIXED} it is bigger than the stream at layer 0 and
          invisible at layer 27; under the recipe it is the same fraction of the stream at every layer.
        </>
      }
    >
      <svg viewBox="0 0 430 235" role="img" className="h-auto w-full">
        <title>
          Isometric skyline of 28 bars, one per layer, whose heights are the median residual norm leaving the layer.
          Each bar carries a cap showing the size of the steering push under the selected rule.
        </title>
        {RESID_MEDIAN.map((r, i) => (
          <Bar key={i} i={i} h={r * SCALE} cap={push(i) * SCALE} hot={i === layer} />
        ))}
        {[0, 7, 14, 21, 27].map((i) => {
          const [x, y] = P(i * STEP + W, D, 0)
          return (
            <T key={i} x={x} y={y + 14} anchor="middle" size={9} opacity={i === layer ? 1 : 0.5}>
              L{i}
            </T>
          )
        })}
        <T x={8} y={226} size={9} opacity={0.6}>bar height: norm of the stream leaving the layer (linear)</T>
      </svg>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          layer
          <Range accent={STREAM} min={0} max={27} step={1} value={layer} onChange={(e) => setLayer(Number(e.target.value))} />
          <span className="w-8 text-foreground">L{layer}</span>
        </label>
        <label className={"flex items-center gap-3 font-mono text-[11px] text-muted-foreground " + (rule === "fixed" ? "opacity-40" : "")}>
          dose
          <Range accent={ACCENT} min={0.05} max={1} step={0.05} value={dose} disabled={rule === "fixed"} onChange={(e) => setDose(Number(e.target.value))} />
          <span className="w-10 text-foreground">{dose.toFixed(2)}</span>
        </label>
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        at L{layer}: stream {RESID_MEDIAN[layer].toFixed(1)}, push {push(layer).toFixed(1)} ={" "}
        <span className="text-foreground">{ratio.toFixed(2)} x the stream</span>
      </p>
    </Frame>
  )
}
