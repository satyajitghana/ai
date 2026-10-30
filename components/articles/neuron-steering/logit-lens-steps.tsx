"use client"

import { useState } from "react"

import { LENS } from "./data-extra"
import { ACCENT, Frame, GREEN, Pill, STREAM, T } from "./viz"

// How a neuron's down_proj column becomes a list of tokens, step by step.
// The token lists are the real top-12 of our re-implementation on Qwen3-0.6B
// (the final RMSNorm weight applied to the column, then the tied unembedding).
// Four steps, one neuron at a time. All measured.

const STEPS = [
  {
    t: "1 · take the column",
    d: "W_down[:, n] is one vector of 1,024 numbers: the direction this neuron writes into the stream.",
  },
  {
    t: "2 · normalise like the output",
    d: "Scale it to unit root-mean-square and multiply by the final norm's weight, as if it were the stream about to be decoded. The length drops out; only the weight and the direction matter.",
  },
  {
    t: "3 · read it with the unembedding",
    d: "Multiply by the 151,936 x 1,024 unembedding. Each vocabulary entry gets a score for how much this direction promotes it.",
  },
  {
    t: "4 · keep both ends",
    d: "The 12 highest scores are the tokens the neuron promotes when it is positive. The 12 lowest are the ones it promotes when it is negative.",
  },
]

export function LogitLensSteps() {
  const [step, setStep] = useState(3)
  const [i, setI] = useState(0)
  const ex = LENS.examples[i]
  return (
    <Frame
      label="the logit lens of one neuron · Qwen3-0.6B · our re-implementation of the explorer's lens index"
      right={
        <div className="flex flex-wrap gap-1">
          {LENS.examples.map((e, k) => (
            <Pill key={e.id} active={i === k} onClick={() => setI(k)}>
              {e.id}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          The whole index, all {(LENS.layers * LENS.neurons).toLocaleString("en-US")} neurons with 12 tokens up and
          12 down, took {LENS.seconds} s on two CPU threads and is {LENS.mb.toFixed(1)} MB as compressed int32 token
          ids. It reads only weights: no forward pass, no text. It sees the direct path only, which is why the
          explorer adds a second lens built from steering.
        </>
      }
    >
      <ol className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((s, k) => (
          <li key={s.t}>
            <button
              type="button"
              onClick={() => setStep(k)}
              aria-pressed={step === k}
              className="h-full w-full cursor-pointer rounded-md border px-2.5 py-2 text-left transition-colors"
              style={{ borderColor: step === k ? ACCENT : undefined, background: step === k ? "color-mix(in oklch, oklch(0.62 0.16 35) 10%, transparent)" : undefined }}
            >
              <span className="block font-mono text-[10.5px]" style={{ color: step === k ? ACCENT : undefined }}>{s.t}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{STEPS[step].d}</p>
      <svg viewBox="0 0 700 150" role="img" className="mt-2 h-auto w-full">
        <title>
          For the chosen neuron, the twelve tokens its write promotes (left, green) and suppresses (right, violet) when
          read through the unembedding.
        </title>
        <rect x={0} y={4} width={36} height={130} rx={3} fill={STREAM} fillOpacity={step >= 0 ? 0.3 : 0.08} stroke={STREAM} />
        <T x={18} y={146} anchor="middle" size={8.5} opacity={0.6}>1,024</T>
        <path d="M40 69 H70" stroke="currentColor" strokeOpacity={step >= 1 ? 0.6 : 0.15} />
        <rect x={72} y={4} width={36} height={130} rx={3} fill={STREAM} fillOpacity={step >= 1 ? 0.55 : 0.08} stroke={STREAM} />
        <T x={90} y={146} anchor="middle" size={8.5} opacity={0.6}>normed</T>
        <path d="M112 69 H142" stroke="currentColor" strokeOpacity={step >= 2 ? 0.6 : 0.15} />
        <rect x={144} y={4} width={44} height={130} rx={3} fill="currentColor" fillOpacity={step >= 2 ? 0.14 : 0.04} stroke="currentColor" strokeOpacity={step >= 2 ? 0.4 : 0.1} />
        <T x={166} y={72} anchor="middle" size={8.5} opacity={step >= 2 ? 0.8 : 0.25}>W_U</T>
        <T x={166} y={146} anchor="middle" size={8.5} opacity={0.6}>151,936</T>
        {[0, 1].map((side) => (
          <g key={side} transform={`translate(${220 + side * 240} 0)`} opacity={step >= 3 ? 1 : 0.15}>
            <T x={0} y={14} size={9} fill={side === 0 ? GREEN : "oklch(0.58 0.16 305)"} opacity={1}>
              {side === 0 ? "promotes (neuron > 0)" : "promotes (neuron < 0)"}
            </T>
            {(side === 0 ? ex.up : ex.down).slice(0, 12).map((tk, k) => (
              <T key={k} x={(k % 2) * 112} y={34 + Math.floor(k / 2) * 18} size={10} opacity={0.95}>
                {tk.replace(/\s/g, "·").slice(0, 14) || "∅"}
              </T>
            ))}
          </g>
        ))}
      </svg>
    </Frame>
  )
}
