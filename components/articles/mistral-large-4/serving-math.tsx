"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What it takes to hold Mistral Large 4 in memory, from the one number Mistral
// has published about its size: 1.05T total parameters (docs model card).
// Weights = params x bits / 8. The KV-cache line is a stand-in, not a fact:
// Mistral has not published ML4's attention. It assumes ML4 keeps Mistral
// Large 3's MLA cache (kv_lora_rank 512 + rope 64 = 576 values per token per
// layer, 61 layers, 2 bytes each), read from Large 3's params.json. Only
// + - * / and toFixed here, so server and client render identical strings.

const MODELS = {
  ml4: { label: "Mistral Large 4", params: 1.05e12, note: "1.05T, docs model card" },
  l3: { label: "Mistral Large 3", params: 675.99e9, note: "675.99B, its BF16 index total_size / 2" },
} as const

const FORMATS = [
  { id: "bf16", label: "BF16", bits: 16 },
  { id: "fp8", label: "FP8", bits: 8 },
  { id: "nvfp4", label: "NVFP4 as Large 3 shipped it", bits: 4.77 },
  { id: "q4", label: "~4.85 bit GGUF", bits: 4.85 },
  { id: "q3", label: "3.5 bit", bits: 3.5 },
  { id: "q2", label: "2.5 bit", bits: 2.5 },
] as const

const HW = [
  { id: "h200", label: "8 x H200", gb: 8 * 141 },
  { id: "b200", label: "8 x B200", gb: 8 * 180 },
  { id: "b300", label: "8 x B300", gb: 8 * 288 },
  { id: "h100", label: "8 x H100", gb: 8 * 80 },
  { id: "mac", label: "512 GB Mac Studio", gb: 512 },
  { id: "spark", label: "2 x DGX Spark", gb: 2 * 128 },
] as const

const KV_BYTES_PER_TOKEN = 576 * 61 * 2 // 70,272 bytes, Large 3's MLA cache

export function ServingMath() {
  const [model, setModel] = useState<keyof typeof MODELS>("ml4")
  const [fmt, setFmt] = useState<string>("fp8")
  const [hw, setHw] = useState<string>("h200")
  const [ctxK, setCtxK] = useState(128)
  const [seqs, setSeqs] = useState(1)

  const m = MODELS[model]
  const f = FORMATS.find((x) => x.id === fmt) ?? FORMATS[1]
  const h = HW.find((x) => x.id === hw) ?? HW[0]
  const weightsGB = (m.params * f.bits) / 8 / 1e9
  const kvGB = (KV_BYTES_PER_TOKEN * ctxK * 1024 * seqs) / 1e9
  const need = weightsGB + kvGB
  const spare = h.gb - need
  const scale = Math.max(h.gb, need)
  const w = (x: number) => `${((x / scale) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Does it fit?</div>
        <div className="flex gap-1 font-mono text-xs">
          {(Object.keys(MODELS) as (keyof typeof MODELS)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setModel(k)}
              className={`rounded-md border px-2 py-0.5 ${model === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {MODELS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">weights format</div>
          <div className="flex flex-wrap gap-1 font-mono text-[11px]">
            {FORMATS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setFmt(x.id)}
                className={`rounded-md border px-2 py-0.5 ${fmt === x.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">hardware</div>
          <div className="flex flex-wrap gap-1 font-mono text-[11px]">
            {HW.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setHw(x.id)}
                className={`rounded-md border px-2 py-0.5 ${hw === x.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          context per sequence: <strong className="font-mono text-foreground">{ctxK}K tokens</strong>
          <Range min={8} max={1024} step={8} value={ctxK} onChange={(e) => setCtxK(Number(e.target.value))} aria-label="context length in thousands of tokens" className="mt-1 w-full" />
        </label>
        <label className="block text-xs text-muted-foreground">
          sequences in flight: <strong className="font-mono text-foreground">{seqs}</strong>
          <Range min={1} max={32} step={1} value={seqs} onChange={(e) => setSeqs(Number(e.target.value))} aria-label="concurrent sequences" className="mt-1 w-full" />
        </label>
      </div>

      <div className="mt-4">
        <div className="relative h-6 w-full overflow-hidden rounded bg-muted/40">
          <div className="absolute inset-y-0 left-0" style={{ width: w(weightsGB), background: "#ea580c" }} />
          <div className="absolute inset-y-0" style={{ left: w(weightsGB), width: w(kvGB), background: "#f59e0b" }} />
          <div className="absolute inset-y-0 border-r-2 border-foreground" style={{ left: 0, width: w(h.gb) }} />
        </div>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#ea580c" }} />weights</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#f59e0b" }} />KV cache, Large 3 shape</span>
          <span>| black line = {h.label} memory</span>
        </div>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground sm:grid-cols-2">
        <span>
          weights: <strong className="text-foreground">{weightsGB.toFixed(0)} GB</strong> ({f.bits} bits x {m.note})
        </span>
        <span>
          KV cache: <strong className="text-foreground">{kvGB.toFixed(1)} GB</strong> (70,272 B per token)
        </span>
        <span>
          {h.label}: <strong className="text-foreground">{h.gb} GB</strong>
        </span>
        <span>
          {spare >= 0 ? "left for activations and batching: " : "short by: "}
          <strong className={spare >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400"}>{Math.abs(spare).toFixed(0)} GB</strong>
        </span>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Weight memory is exact arithmetic on the published parameter count. The cache line is a stand-in: Mistral has not published Large 4&apos;s attention, so it assumes Large 3&apos;s MLA cache. Runtime overhead, activations and the vision encoder&apos;s working memory are not counted.
      </figcaption>
    </figure>
  )
}
