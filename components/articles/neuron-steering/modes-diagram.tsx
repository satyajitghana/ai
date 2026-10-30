"use client"

import { useState } from "react"

import { MODES, PER_TOKEN } from "./data-extra"
import { ACCENT, Frame, GREEN, Pill, STREAM, T } from "./viz"

// Our re-run on Qwen3-0.6B (float32, CPU). Left: one neuron's own activation
// on every token of one sentence, and where each kind of edit would put it.
// Right: what each edit did to the model's next-token distributions (mean
// per-token KL from the unedited run) on 8 French and 8 English sentences.
// add 0.2 = 0.2 x median residual norm / column norm; mul 3 = x3 on the
// activation; mul 0 = ablation. All measured.

type Mode = "add" | "mul3" | "mul0"
const IDS = Object.keys(PER_TOKEN)
const DOSE = 0.2

export function ModesDiagram() {
  const [id, setId] = useState(IDS[0])
  const [lang, setLang] = useState<"fr" | "en">("fr")
  const [mode, setMode] = useState<Mode>("add")

  const rec = PER_TOKEN[id]
  const toks = rec[lang]
  const meta = MODES.find((m) => m.id === id)!
  const edit = (v: number) => (mode === "add" ? v + DOSE * rec.unit : mode === "mul3" ? v * 3 : 0)
  const afters = toks.map((t) => edit(t.v))
  const maxAbs = Math.max(...toks.map((t) => Math.abs(t.v)), ...afters.map(Math.abs), 1)
  const mid = 120
  const sc = 88 / maxAbs
  const bw = Math.min(46, 490 / toks.length)

  const klMax = Math.max(...MODES.flatMap((m) => [...m.add, ...m.mul3, ...m.mul0]), 0.5)
  const kinds: [string, [number, number]][] = [
    ["add 0.2", meta.add],
    ["x 3", meta.mul3],
    ["x 0", meta.mul0],
  ]

  return (
    <Frame
      label="three ways to edit one neuron · Qwen3-0.6B · measured"
      right={
        <div className="flex flex-wrap gap-1">
          {IDS.map((k) => (
            <Pill key={k} active={id === k} onClick={() => setId(k)}>
              {k.replace("L", "L").replace("N", " N")}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          Adding a constant moves the neuron by the same amount on every token, including the ones where it is
          silent, so its effect depends on what the rest of the model was doing. Multiplying (or zeroing) can only
          change a neuron where it already fires: on the language it is near-silent on, the multiplicative KL is below 0.0001.
          That is why the recipe uses addition and the ablation studies use scaling.
        </>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1">
        <Pill active={lang === "fr"} onClick={() => setLang("fr")}>French sentence</Pill>
        <Pill active={lang === "en"} onClick={() => setLang("en")}>English sentence</Pill>
        <span className="mx-1" />
        <Pill active={mode === "add"} onClick={() => setMode("add")}>add 0.2 of the stream</Pill>
        <Pill active={mode === "mul3"} onClick={() => setMode("mul3")}>multiply x3</Pill>
        <Pill active={mode === "mul0"} onClick={() => setMode("mul0")}>ablate</Pill>
      </div>
      <svg viewBox="0 0 700 250" role="img" className="h-auto w-full">
        <title>
          Bars show the neuron&apos;s natural activation on each token of the chosen sentence; markers show where the
          chosen edit would put it. Three small bars at the right compare the effect of the three edits on French and
          English text.
        </title>
        <line x1={20} y1={mid} x2={20 + toks.length * bw} y2={mid} stroke="currentColor" strokeOpacity={0.3} />
        {toks.map((t, i) => {
          const x = 24 + i * bw
          const h = t.v * sc
          return (
            <g key={i}>
              <rect x={x} y={h >= 0 ? mid - h : mid} width={bw - 8} height={Math.max(0.8, Math.abs(h))} fill={STREAM} fillOpacity={i === 0 ? 0.3 : 0.75} />
              <line x1={x - 2} x2={x + bw - 6} y1={mid - afters[i] * sc} y2={mid - afters[i] * sc} stroke={ACCENT} strokeWidth={2.4} />
              <text
                x={x + (bw - 8) / 2}
                y={mid + 100}
                fontSize={8.5}
                fontFamily="ui-monospace, monospace"
                textAnchor="end"
                fill="currentColor"
                fillOpacity={0.6}
                transform={`rotate(-40 ${x + (bw - 8) / 2} ${mid + 100})`}
              >
                {t.t.replace(/\s/g, "·")}
              </text>
            </g>
          )
        })}
        <T x={20} y={14} size={9} opacity={0.65}>blue: natural activation · orange: after the edit · first bar faint = token 0</T>
        {/* KL bars */}
        <g transform="translate(530 20)">
          <T x={0} y={0} size={9} opacity={0.65}>mean KL per token</T>
          {kinds.map(([name, [fr, en]], k) => (
            <g key={name} transform={`translate(0 ${16 + k * 52})`}>
              <T x={0} y={8} size={9} opacity={0.8}>{name}</T>
              <rect x={0} y={14} width={Math.max(1, (fr / klMax) * 120)} height={9} fill={GREEN} fillOpacity={0.8} />
              <T x={Math.max(1, (fr / klMax) * 120) + 4} y={22} size={8.5} opacity={0.8}>fr {fr.toFixed(2)}</T>
              <rect x={0} y={28} width={Math.max(1, (en / klMax) * 120)} height={9} fill={ACCENT} fillOpacity={0.8} />
              <T x={Math.max(1, (en / klMax) * 120) + 4} y={36} size={8.5} opacity={0.8}>en {en.toFixed(2)}</T>
            </g>
          ))}
        </g>
      </svg>
    </Frame>
  )
}
