"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { NEURON_A, RESID_MEDIAN } from "./data"
import { ACCENT, Frame, GREEN, Pill, STREAM, T } from "./viz"

// One MLP block, drawn with the numbers of layer 16 neuron 477 in Qwen3-0.6B.
// Natural activations (mean over tokens of 8 French and 8 English sentences,
// measured): +5.9 on French, -0.5 on English. unit = dose x median residual
// norm / column norm = 132.29 activation units per unit of dose (measured).

type Mode = "add" | "mul" | "ablate"
type Tok = "fr" | "en"

const NATURAL: Record<Tok, number> = { fr: 5.9, en: -0.5 }
const CELLS = 24
const HOT = 9

export function NeuronAnatomy() {
  const [mode, setMode] = useState<Mode>("add")
  const [tok, setTok] = useState<Tok>("fr")
  const [dose, setDose] = useState(0.2)
  const [factor, setFactor] = useState(3)

  const natural = NATURAL[tok]
  const after =
    mode === "add" ? natural + dose * NEURON_A.unit : mode === "mul" ? natural * factor : 0
  const delta = after - natural
  const push = Math.abs(delta) * NEURON_A.colNorm
  const resid = RESID_MEDIAN[NEURON_A.layer]
  const ratio = push / resid

  const cellH = 11.2
  const top = 62
  const heat = (v: number) => Math.min(1, Math.abs(v) / 8)

  return (
    <Frame
      label="one MLP block · layer 16 neuron 477 · Qwen3-0.6B · measured numbers"
      right={
        <div className="flex flex-wrap gap-1">
          {(["add", "mul", "ablate"] as const).map((m) => (
            <Pill key={m} active={mode === m} onClick={() => setMode(m)}>
              {m === "add" ? "add (the recipe)" : m === "mul" ? "multiply" : "ablate (x0)"}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          The hook sits on the input of <code>down_proj</code>, where the activation vector{" "}
          <code>silu(gate) * up</code> lives. Adding to one entry there is the same as adding that amount times one
          column of <code>W_down</code> to the stream (checked to 3.3e-5 in float32). A multiply or an ablation needs
          the entry itself, which the stream no longer has after <code>down_proj</code>.
        </>
      }
    >
      <svg viewBox="0 0 760 330" role="img" className="h-auto w-full">
        <title>
          Block diagram of one MLP layer. The residual stream passes a norm, then two projections whose outputs are
          combined into a 3,072-wide activation vector. One entry of that vector is edited by the hook. The down
          projection turns the edited vector into a write back into the residual stream.
        </title>
        {/* residual in */}
        <rect x={14} y={140} width={36} height={80} rx={4} fill={STREAM} fillOpacity={0.25} stroke={STREAM} />
        <T x={32} y={132} anchor="middle" size={9}>x</T>
        <T x={32} y={236} anchor="middle" size={8.5} opacity={0.6}>1,024</T>
        <line x1={50} y1={180} x2={88} y2={180} stroke={STREAM} />
        {/* rmsnorm */}
        <rect x={88} y={158} width={56} height={44} rx={4} className="fill-muted/40 stroke-border" />
        <T x={116} y={184} anchor="middle" size={9}>RMSNorm</T>
        <line x1={144} y1={180} x2={170} y2={180} stroke={STREAM} />
        <line x1={170} y1={100} x2={170} y2={260} stroke={STREAM} />
        {/* gate / up */}
        <line x1={170} y1={100} x2={198} y2={100} stroke={STREAM} />
        <line x1={170} y1={260} x2={198} y2={260} stroke={STREAM} />
        <rect x={198} y={78} width={92} height={44} rx={4} className="fill-muted/40 stroke-border" />
        <T x={244} y={97} anchor="middle" size={9}>gate_proj</T>
        <T x={244} y={111} anchor="middle" size={8} opacity={0.55}>3,072 x 1,024</T>
        <rect x={198} y={238} width={92} height={44} rx={4} className="fill-muted/40 stroke-border" />
        <T x={244} y={257} anchor="middle" size={9}>up_proj</T>
        <T x={244} y={271} anchor="middle" size={8} opacity={0.55}>3,072 x 1,024</T>
        {/* silu */}
        <line x1={290} y1={100} x2={314} y2={100} stroke={STREAM} />
        <rect x={314} y={84} width={44} height={32} rx={16} className="fill-muted/40 stroke-border" />
        <T x={336} y={104} anchor="middle" size={9}>silu</T>
        <line x1={358} y1={100} x2={398} y2={100} stroke={STREAM} />
        <line x1={398} y1={100} x2={398} y2={172} stroke={STREAM} />
        <line x1={290} y1={260} x2={398} y2={260} stroke={STREAM} />
        <line x1={398} y1={260} x2={398} y2={188} stroke={STREAM} />
        <circle cx={398} cy={180} r={16} className="fill-muted/40 stroke-border" />
        <T x={398} y={185} anchor="middle" size={14}>⊙</T>
        <line x1={414} y1={180} x2={450} y2={180} stroke={STREAM} />
        {/* h column */}
        <T x={480} y={50} anchor="middle" size={9}>h = silu(gate) ⊙ up</T>
        {Array.from({ length: CELLS }, (_, i) => {
          const hot = i === HOT
          const v = hot ? after : (((i * 7 + 3) % 11) - 5) * 0.25
          return (
            <rect
              key={i}
              x={462}
              y={top + i * cellH}
              width={36}
              height={cellH - 1.4}
              rx={1.5}
              fill={hot ? ACCENT : STREAM}
              fillOpacity={hot ? 0.25 + 0.6 * heat(v) : 0.1 + 0.25 * heat(v)}
              stroke={hot ? ACCENT : "none"}
            />
          )
        })}
        <T x={480} y={top + CELLS * cellH + 14} anchor="middle" size={8.5} opacity={0.6}>3,072 entries (24 shown)</T>
        {/* hook */}
        <line x1={498} y1={top + HOT * cellH + 4} x2={540} y2={top + HOT * cellH + 4} stroke={ACCENT} strokeDasharray="4 3" />
        <rect x={540} y={top + HOT * cellH - 14} width={90} height={36} rx={5} fill={ACCENT} fillOpacity={0.12} stroke={ACCENT} />
        <T x={585} y={top + HOT * cellH - 1} anchor="middle" size={9} fill={ACCENT} opacity={1}>
          hook on h[{NEURON_A.n}]
        </T>
        <T x={585} y={top + HOT * cellH + 12} anchor="middle" size={8.5} fill={ACCENT} opacity={0.9}>
          {mode === "add" ? `+ ${(dose * NEURON_A.unit).toFixed(1)}` : mode === "mul" ? `x ${factor.toFixed(1)}` : "x 0"}
        </T>
        {/* down_proj */}
        <line x1={498} y1={180} x2={640} y2={180} stroke={STREAM} />
        <rect x={640} y={140} width={72} height={80} rx={4} className="fill-muted/40 stroke-border" />
        <rect x={668} y={140} width={5} height={80} fill={ACCENT} fillOpacity={0.8} />
        <T x={676} y={134} anchor="middle" size={9}>down_proj</T>
        <T x={676} y={236} anchor="middle" size={8} opacity={0.55}>1,024 x 3,072</T>
        <T x={676} y={250} anchor="middle" size={8} fill={ACCENT} opacity={1}>column {NEURON_A.n}</T>
        <path d="M712 180 H742 V300 H32 V222" fill="none" stroke={GREEN} strokeWidth={1.6} />
        <T x={390} y={316} anchor="middle" size={9} fill={GREEN} opacity={1}>
          x_next = x + W_down · h  (the residual add)
        </T>
      </svg>

      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex flex-wrap gap-1">
          <Pill active={tok === "fr"} onClick={() => setTok("fr")}>French token</Pill>
          <Pill active={tok === "en"} onClick={() => setTok("en")}>English token</Pill>
        </div>
        {mode === "add" ? (
          <label className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            dose
            <Range accent={ACCENT} min={0} max={0.5} step={0.01} value={dose} onChange={(e) => setDose(Number(e.target.value))} />
            <span className="w-10 text-foreground">{dose.toFixed(2)}</span>
          </label>
        ) : mode === "mul" ? (
          <label className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            factor
            <Range accent={ACCENT} min={0} max={5} step={0.1} value={factor} onChange={(e) => setFactor(Number(e.target.value))} />
            <span className="w-10 text-foreground">x{factor.toFixed(1)}</span>
          </label>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">entry set to zero</span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
        {[
          ["natural h[477]", natural.toFixed(1)],
          ["after the hook", after.toFixed(1)],
          ["write into stream", push.toFixed(1)],
          ["vs residual (78.1)", `${ratio.toFixed(2)} x`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border bg-muted/20 px-2.5 py-1.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </Frame>
  )
}
