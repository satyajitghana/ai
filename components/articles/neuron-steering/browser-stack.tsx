"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { ACCENT, Frame, GREEN, Pill, STREAM, VIOLET } from "./viz"

// What it takes to steer a neuron inside a browser tab. Parameter counts are
// the totals in each checkpoint's safetensors header (measured through the
// Hub API). The 2.91 GB for Qwen3.5-4B is the figure on the Neuron Studio
// page itself (reported); the effective bits per parameter is our division
// (reasoned).

const MODELS = [
  { id: "q3-06", name: "Qwen3-0.6B", params: 751_632_384, note: "28 layers, 3,072 neurons each. The model of this article. The file holds 751.6 M values; 596.0 M are parameters, the rest is the tied embedding stored a second time." },
  { id: "q35-08", name: "Qwen3.5-0.8B", params: 873_438_784, note: "24 layers, 3,584 neurons each; 18 of 24 attention layers are linear attention." },
  { id: "q35-4", name: "Qwen3.5-4B", params: 4_659_865_088, note: "32 layers, 9,216 neurons each. The model of the posts and of Neuron Studio." },
] as const

const BITS = [
  { b: 16, label: "bf16" },
  { b: 8, label: "int8" },
  { b: 5, label: "~5 bit" },
  { b: 4, label: "4 bit" },
]

const STAGES = [
  { t: "fetch", d: "weights stream from huggingface.co (CORS allowed), range requests, progress bar", c: STREAM },
  { t: "cache", d: "kept in the browser's Cache Storage or OPFS, so the second visit is instant", c: STREAM },
  { t: "kernels", d: "WebGPU compute shaders, or a WASM fallback on the CPU", c: GREEN },
  { t: "hook", d: "an offset added to MLP activations right before down_proj, at every token", c: ACCENT },
  { t: "decode", d: "greedy decoding, baseline and steered rows side by side", c: GREEN },
  { t: "view", d: "map, search, sliders, three columns of text", c: VIOLET },
]

export function BrowserStack() {
  const [mi, setMi] = useState(0)
  const [bi, setBi] = useState(0)
  const [mbps, setMbps] = useState(100)
  const m = MODELS[mi]
  const bits = BITS[bi].b
  const gb = (m.params * bits) / 8 / 1e9
  const minutes = (gb * 8e9) / (mbps * 1e6) / 60
  const effective = (2.91e9 * 8) / MODELS[2].params

  return (
    <Frame
      label="a neuron-steering tab: the stages and the download · sizes are arithmetic on measured parameter counts"
      note={
        <>
          Neuron Studio reports 2.91 GB for Qwen3.5-4B, which is {effective.toFixed(2)} bits per parameter if every
          parameter counts (reasoned): a mixed 4-bit scheme, not a uniform one. The sizes above are parameters times
          bits and ignore the tokenizer and the KV cache. Whether a tab can <em>run</em> a model is a separate
          question from whether it can hold it.
        </>
      }
    >
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s, i) => (
          <li key={s.t} className="rounded-md border px-2.5 py-2" style={{ borderColor: s.c }}>
            <p className="font-mono text-[10px] uppercase tracking-wide" style={{ color: s.c }}>
              {i + 1} · {s.t}
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-1">
        {MODELS.map((x, i) => (
          <Pill key={x.id} active={mi === i} onClick={() => setMi(i)}>
            {x.name}
          </Pill>
        ))}
        <span className="mx-1" />
        {BITS.map((x, i) => (
          <Pill key={x.b} active={bi === i} onClick={() => setBi(i)}>
            {x.label}
          </Pill>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{m.note}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="h-3 overflow-hidden rounded-full border bg-muted/20">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (gb / 10) * 100)}%`, background: ACCENT, opacity: 0.8 }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">0 to 10 GB scale</p>
        </div>
        <p className="font-mono text-sm text-foreground">
          {gb.toFixed(2)} GB <span className="text-muted-foreground">· {m.params.toLocaleString("en-US")} parameters</span>
        </p>
      </div>
      <label className="mt-3 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
        connection
        <Range accent={STREAM} min={10} max={500} step={10} value={mbps} onChange={(e) => setMbps(Number(e.target.value))} />
        <span className="w-24 text-foreground">{mbps} Mbit/s</span>
      </label>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        first load: about <span className="text-foreground">{minutes < 1 ? `${Math.round(minutes * 60)} s` : `${minutes.toFixed(1)} min`}</span>{" "}
        at that speed, once; after that it comes from the browser cache.
      </p>
    </Frame>
  )
}
