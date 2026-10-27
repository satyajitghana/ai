"use client"

import { useState } from "react"

import { COMBO } from "./data-extra"
import { ACCENT, Frame, GREEN, Pill, T } from "./viz"

// A small test of the "combine neurons and a new thing appears" claim, on
// Qwen3-0.6B. Neurons were found by searching our logit-lens index for tokens
// that spell a concept word (middle layers only), the three best for each
// word. Each condition steers one or two of them at the same dose on six
// neutral prompts, greedy, 40 new tokens, and counts how many of the six
// outputs contain each word. Random neurons of the same layers are the
// control. Measured, tiny, and one seed: a probe, not a result.

export function CombinationLab() {
  const [pi, setPi] = useState(0)
  const [di, setDi] = useState(0)
  const pairKeys = Array.from(new Set(COMBO.map((r) => r.words.join("+"))))
  const key = pairKeys[pi]
  const doses = Array.from(new Set(COMBO.filter((r) => r.words.join("+") === key).map((r) => r.dose)))
  const rec = COMBO.find((r) => r.words.join("+") === key && r.dose === doses[di])!
  const [w1, w2] = rec.words
  const n = rec.n

  const rows: { label: string; c1: number; c2: number; pair: boolean }[] = [
    { label: "no steering", c1: rec.base.c1, c2: rec.base.c2, pair: false },
    ...rec.single.map((s) => ({ label: s.id, c1: s.c1, c2: s.c2, pair: false })),
    ...rec.pair.map((s) => ({ label: s.id, c1: s.c1, c2: s.c2, pair: true })),
    { label: "6 random singles (max)", c1: Math.max(...rec.ctrlSingle.map((s) => s.c1)), c2: Math.max(...rec.ctrlSingle.map((s) => s.c2)), pair: false },
    { label: "6 random pairs (max)", c1: Math.max(...rec.ctrlPair.map((s) => s.c1)), c2: Math.max(...rec.ctrlPair.map((s) => s.c2)), pair: false },
  ]
  return (
    <Frame
      label={`one neuron, or two together · Qwen3-0.6B · measured · outputs containing the word, of ${n}`}
      right={
        <div className="flex flex-wrap gap-1">
          {pairKeys.map((k, i) => (
            <Pill key={k} active={pi === i} onClick={() => { setPi(i); setDi(0) }}>
              {k.replace("+", " + ")}
            </Pill>
          ))}
          <span className="mx-1" />
          {doses.map((d, i) => (
            <Pill key={d} active={di === i} onClick={() => setDi(i)}>
              dose {d}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          Green is how many of the six outputs contained &quot;{w1}&quot;, orange &quot;{w2}&quot;. Singles steer one
          neuron whose lens spells that word; pairs steer one neuron for each word at once. The controls are random
          neurons of the same layers at the same dose; their maximum is shown, so a pair only counts as an effect if it
          beats that row.
        </>
      }
    >
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[150px_1fr] items-center gap-2 sm:grid-cols-[200px_1fr]">
            <span className="truncate font-mono text-[10.5px]" style={{ color: r.pair ? ACCENT : undefined }}>
              {r.label}
            </span>
            <svg viewBox="0 0 220 16" className="h-4 w-full max-w-[300px]" role="img" aria-label={`${w1} ${r.c1} of ${n}, ${w2} ${r.c2} of ${n}`}>
              {Array.from({ length: n }, (_, k) => (
                <rect key={`a${k}`} x={k * 18} y={0} width={14} height={7} fill={k < r.c1 ? GREEN : "currentColor"} fillOpacity={k < r.c1 ? 0.85 : 0.1} />
              ))}
              {Array.from({ length: n }, (_, k) => (
                <rect key={`b${k}`} x={k * 18} y={9} width={14} height={7} fill={k < r.c2 ? ACCENT : "currentColor"} fillOpacity={k < r.c2 ? 0.85 : 0.1} />
              ))}
              <T x={n * 18 + 6} y={7} size={8} opacity={0.7}>{r.c1}</T>
              <T x={n * 18 + 6} y={15} size={8} opacity={0.7}>{r.c2}</T>
            </svg>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
        {rec.summary}
      </p>
    </Frame>
  )
}
