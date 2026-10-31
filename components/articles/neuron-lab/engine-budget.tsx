"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Memory the in-browser engine needs, per model. Weights: the engine's own figure for the unpacked Q8_0 tensors.
// Sequence state, from the GGUF headers and the engine's float32 layout:
//   Qwen3-0.6B   28 attention layers, 8 key/value heads of 128:   28 x 2 x 8 x 128 x 4 B = 229,376 B per token
//   Qwen3.5-0.8B  6 attention layers, 2 key/value heads of 256:    6 x 2 x 2 x 256 x 4 B =  24,576 B per token
//                18 Gated DeltaNet layers, each a 16 x 128 x 128 recurrent matrix (1,048,576 B) plus a conv window
//                (6,144 x 3 x 4 = 73,728 B): 20,201,472 B per sequence, whatever the context length
// The three-column comparison decodes three sequences together, so its state is three times one.

const MB = 1e6
const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1))

const SPECS = {
  "qwen3-0.6b": { label: "Qwen3-0.6B", download: 651, weights: 680, perToken: 229376, fixed: 0, note: "Every one of its 28 layers keeps a key/value cache that grows with the text." },
  "qwen3.5-0.8b": { label: "Qwen3.5-0.8B", download: 846, weights: 960, perToken: 24576, fixed: 20201472, note: "Only its 6 attention layers keep a cache that grows with the text; its 18 Gated DeltaNet layers keep a fixed-size state." },
} as const
type Key = keyof typeof SPECS

export function EngineBudget() {
  const [model, setModel] = useState<Key>("qwen3-0.6b")
  const [tokens, setTokens] = useState(300)
  const [streams, setStreams] = useState(3)
  const S = SPECS[model]
  const state = ((S.fixed + tokens * S.perToken) * streams) / MB
  const total = S.weights + state
  const parts = [
    { label: "weights (Q8_0, unpacked)", v: S.weights, color: "oklch(0.6 0.05 255)" },
    { label: `sequence state (${streams} sequence${streams > 1 ? "s" : ""})`, v: state, color: "oklch(0.65 0.16 55)" },
  ]
  const scale = Math.max(total, 1800)
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what the engine holds in memory (arithmetic on the engine&apos;s own layout)
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Model">
          {(Object.keys(SPECS) as Key[]).map((k) => (
            <button key={k} aria-pressed={k === model} onClick={() => setModel(k)} className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", k === model ? "border-foreground bg-muted" : "text-muted-foreground hover:text-foreground")}>
              {SPECS[k].label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">context tokens</span>
          <Range className="w-full" min={50} max={2048} step={10} value={tokens} onChange={(e) => setTokens(+e.target.value)} aria-label="Context length in tokens" />
          <span className="w-16 shrink-0 text-right font-mono tabular-nums">{tokens}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">sequences</span>
          <Range className="w-full" min={1} max={4} step={1} value={streams} onChange={(e) => setStreams(+e.target.value)} aria-label="Sequences decoded together" />
          <span className="w-16 shrink-0 text-right font-mono tabular-nums">{streams}</span>
        </label>
        <div className="space-y-1.5" role="img" aria-label={`${fmt(total)} megabytes in all: ${S.weights} for weights and ${fmt(state)} for sequence state.`}>
          <div className="flex h-4 w-full overflow-hidden rounded bg-muted">
            {parts.map((p) => (
              <div key={p.label} style={{ width: `${((p.v / scale) * 100).toFixed(2)}%`, background: p.color }} title={`${p.label}: ${fmt(p.v)} MB`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {parts.map((p) => (
              <span key={p.label}>
                <i className="mr-1 inline-block h-2 w-2 rounded-sm align-baseline" style={{ background: p.color }} />
                {p.label}: <span className="font-mono tabular-nums text-foreground">{fmt(p.v)} MB</span>
              </span>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">download on first use</dt>
          <dd className="text-right font-mono tabular-nums">{S.download} MB</dd>
          <dt className="text-muted-foreground">state per token, per sequence</dt>
          <dd className="text-right font-mono tabular-nums">{S.perToken.toLocaleString("en-US")} bytes</dd>
          <dt className="text-muted-foreground">fixed state per sequence</dt>
          <dd className="text-right font-mono tabular-nums">{S.fixed ? `${S.fixed.toLocaleString("en-US")} bytes` : "none"}</dd>
          <dt className="text-muted-foreground">total held by the engine</dt>
          <dd className="text-right font-mono tabular-nums">{fmt(total)} MB</dd>
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          {S.note} Browsers do not publish how much memory a tab may use, so no device is named here. The weights are a fixed cost; the three-column comparison pays for three sequences at once.
        </p>
      </div>
    </figure>
  )
}
