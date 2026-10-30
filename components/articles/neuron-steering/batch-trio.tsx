"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { TRIO } from "./data-extra"
import { ACCENT, Frame, GREEN, STREAM, T } from "./viz"

// The explorer's three-column chat decodes three conversations in one batch:
// row 0 pushed up, row 1 unsteered, row 2 pushed down, all greedy, left
// padded. The drawing is the batch's shape (prompt lengths are the real token
// counts of the three prompts we used). The numbers under it are our re-run on
// Qwen3-0.6B: does a row in the batch produce the same tokens as the same row
// alone, and does bfloat16 produce the same tokens as float32.

const ROWS = [
  { name: "pushed up", sign: "+0.1", color: ACCENT },
  { name: "unsteered", sign: "0", color: STREAM },
  { name: "pushed down", sign: "-0.1", color: GREEN },
]
const MAXLEN = Math.max(...TRIO.promptLens)
const CELL = Math.min(14, 690 / (MAXLEN + 14))

export function BatchTrio() {
  const [step, setStep] = useState(6)
  const first = TRIO.bf16First.filter((x): x is number => x !== null).sort((a, b) => a - b)
  return (
    <Frame
      label="three rows, one batch · left padding, greedy · Qwen3-0.6B · measured"
      note={
        <>
          A row of the batch matched the same prompt run alone token for token (up to the end-of-sequence token) in{" "}
          {TRIO.same} of {TRIO.total} cases at dose 0.1 of layer 16 neuron 477, float32. bfloat16 against float32 matched
          in {TRIO.bf16Same} of {TRIO.bf16Total} greedy runs; where it did not, the first difference came at generated
          token {first.join(", ")}. Precision alone is enough to change a continuation, sometimes at the first token.
        </>
      }
    >
      <svg viewBox="0 0 700 190" role="img" className="h-auto w-full">
        <title>
          Three rows of cells, one per conversation. Grey cells on the left are padding, blue cells the prompt, and
          coloured cells the tokens generated so far, advancing in lockstep as the step slider moves. The offset applied
          to each row is written beside its name.
        </title>
        {ROWS.map((r, i) => {
          const y = 28 + i * 46
          const pad = MAXLEN - TRIO.promptLens[i]
          return (
            <g key={r.name}>
              <T x={0} y={y - 6} size={9} opacity={0.7}>{r.name}</T>
              <T x={110} y={y - 6} size={9} fill={r.color} opacity={1}>h[n] {r.sign} x unit</T>
              {Array.from({ length: pad }, (_, k) => (
                <rect key={`p${k}`} x={k * CELL} y={y} width={CELL - 2} height={CELL} fill="currentColor" fillOpacity={0.12} />
              ))}
              {Array.from({ length: TRIO.promptLens[i] }, (_, k) => (
                <rect key={`t${k}`} x={(pad + k) * CELL} y={y} width={CELL - 2} height={CELL} fill={STREAM} fillOpacity={0.55} />
              ))}
              {Array.from({ length: step }, (_, k) => (
                <rect key={`g${k}`} x={(MAXLEN + k) * CELL} y={y} width={CELL - 2} height={CELL} fill={r.color} fillOpacity={0.85} />
              ))}
            </g>
          )
        })}
        <T x={0} y={178} size={9} opacity={0.55}>
          grey = padding · blue = prompt ({TRIO.promptLens.join(", ")} tokens) · colour = generated, one column per decode step
        </T>
      </svg>
      <label className="mt-2 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
        decode step
        <Range accent={ACCENT} min={0} max={14} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        <span className="w-6 text-foreground">{step}</span>
      </label>
    </Frame>
  )
}
