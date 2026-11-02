"use client"

import { useState } from "react"

import {
  CONV_STATE_BYTES,
  CONV_WIDTH,
  HEAD_DIM,
  KIND_LABEL,
  KV_BYTES_PER_TOKEN,
  KV_HEADS,
  LAYERS,
  PARAMS,
  WINDOW,
  type LayerKind,
} from "./data"

// The 24 layers of LFM3-1.7B in order, straight from config.json. Pick one to see what it holds and what it keeps
// between tokens. Parameter counts are summed from the safetensors header (measured); the cache lines are arithmetic
// on the config (reasoned).

const COLOR: Record<LayerKind, string> = {
  conv: "oklch(0.66 0.13 200)",
  full: "oklch(0.62 0.17 35)",
  slide: "oklch(0.68 0.14 85)",
}

const fmt = (n: number) => n.toLocaleString("en-US")

function keeps(kind: LayerKind): string {
  if (kind === "conv") return `the last ${CONV_WIDTH - 1} inputs of each of 2,048 channels: ${fmt(CONV_STATE_BYTES)} bytes, fixed`
  if (kind === "slide") return `keys and values for the last ${WINDOW} tokens: ${fmt(KV_BYTES_PER_TOKEN * WINDOW)} bytes, then it stops growing`
  return `keys and values for every token: ${fmt(KV_BYTES_PER_TOKEN)} bytes per token, no limit`
}

function reads(kind: LayerKind): string {
  if (kind === "conv") return `a width-${CONV_WIDTH} window along the sequence, one channel at a time`
  if (kind === "slide") return `the last ${WINDOW} tokens, 16 query heads sharing ${KV_HEADS} key-value heads`
  return `every earlier token, 16 query heads sharing ${KV_HEADS} key-value heads of ${HEAD_DIM} dimensions`
}

export function LayerStrip() {
  const [sel, setSel] = useState(2)
  const kind = LAYERS[sel]
  const p = PARAMS[kind]
  const counts = (["conv", "slide", "full"] as const).map((k) => [k, LAYERS.filter((x) => x === k).length] as const)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">LFM3-1.7B, layer by layer · config.json and the safetensors header</span>
        <span className="flex flex-wrap gap-3 font-mono text-xs">
          {counts.map(([k, n]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: COLOR[k] }} />
              {n} {KIND_LABEL[k]}
            </span>
          ))}
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-12 gap-1.5" role="group" aria-label="Layers 0 to 23">
          {LAYERS.map((k, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              aria-label={`Layer ${i}, ${KIND_LABEL[k]}`}
              className={`flex h-14 flex-col items-center justify-center rounded-md border font-mono text-[11px] leading-tight transition-transform ${sel === i ? "-translate-y-0.5 ring-2 ring-foreground" : "hover:-translate-y-0.5"}`}
              style={{ background: `color-mix(in oklch, ${COLOR[k]} ${sel === i ? 55 : 28}%, transparent)`, borderColor: COLOR[k] }}
            >
              <span>{i}</span>
              <span className="text-[10px] opacity-70">{k === "conv" ? "conv" : k === "full" ? "full" : "win"}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <div className="font-medium" style={{ color: COLOR[kind] }}>
              Layer {sel}: {KIND_LABEL[kind]}
            </div>
            <div>
              <span className="text-muted-foreground">reads: </span>
              {reads(kind)}
            </div>
            <div>
              <span className="text-muted-foreground">keeps between tokens: </span>
              {keeps(kind)}
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div className="rounded-lg border p-2">
              <dt className="text-muted-foreground">mixer</dt>
              <dd className="text-sm">{fmt(p.mixer)}</dd>
            </div>
            <div className="rounded-lg border p-2">
              <dt className="text-muted-foreground">SwiGLU MLP</dt>
              <dd className="text-sm">{fmt(p.mlp)}</dd>
            </div>
            <div className="rounded-lg border p-2">
              <dt className="text-muted-foreground">norms</dt>
              <dd className="text-sm">{fmt(p.norms)}</dd>
            </div>
          </dl>
        </div>
        <p className="text-xs text-muted-foreground">
          The mixer is whatever lets a token read its neighbours. A convolution layer has more of it than an attention layer, and every layer carries the same MLP.
        </p>
      </div>
    </figure>
  )
}
