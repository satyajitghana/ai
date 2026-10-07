"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What a Clef-head LoRA run has to keep on the GPU, from the real model dims.
//
// Parameter counts are summed from the safetensors headers of
// unsloth/Qwen3.5-0.8B and unsloth/Qwen3.5-2B (read by HTTP range request).
// "linear" is every q/k/v/o, in_proj_qkv, in_proj_z, in_proj_a/b, out_proj and
// gate/up/down weight in the language layers. LoRA-per-rank is the sum of
// (in + out) over the modules decision.py's fallback regex targets
// (q,k,v,o, in_proj_qkv, in_proj_z, out_proj, gate, up, down). The head size is
// Cloudflare's JointSchemaHead at default_head_config() (width 512 for both,
// since their hidden sizes are under 3072), counted from its layer shapes; the
// same formula gives 128,056,324 for Cloudflare/clef, matching that checkpoint.
//
// This is a lower bound, not a reproduction of Unsloth's 4 GB / 8 GB figures:
// it leaves out the recompute working set of one layer, the CUDA context and
// the allocator's slack.

type Model = {
  name: string
  hidden: number
  layers: number
  vocab: number
  linear: number
  embed: number
  visual: number
  other: number
  loraPerRank: number
  head: number
}

const MODELS: Model[] = [
  {
    name: "Qwen3.5-0.8B",
    hidden: 1024,
    layers: 24,
    vocab: 248320,
    linear: 497614848,
    embed: 254279680,
    visual: 100592896,
    other: 498496,
    loraPerRank: 638976,
    head: 27324932,
  },
  {
    name: "Qwen3.5-2B",
    hidden: 2048,
    layers: 24,
    vocab: 248320,
    linear: 1372717056,
    embed: 508559360,
    visual: 331416576,
    other: 548672,
    loraPerRank: 976896,
    head: 30472708,
  },
]

// NF4 stores 4 bits a weight plus a per-64 block scale; ~0.53 bytes a weight.
const NF4 = 0.53

const COLORS = {
  weights: "oklch(0.60 0.15 255)",
  lora: "oklch(0.66 0.16 45)",
  head: "oklch(0.62 0.12 160)",
  acts: "oklch(0.62 0.14 320)",
}

const gb = (b: number) => b / 1e9

export function VramBudget() {
  const [mi, setMi] = useState(0)
  const [rank, setRank] = useState(64)
  const [seq, setSeq] = useState(1024)
  const [batch, setBatch] = useState(8)
  const [fourBit, setFourBit] = useState(true)
  const [offload, setOffload] = useState(true)
  const [adam8, setAdam8] = useState(false)
  const m = MODELS[mi]

  const sixteen = m.embed + m.visual + m.other
  const weights = fourBit ? m.linear * NF4 + sixteen * 2 : (m.linear + sixteen) * 2
  const perTrainable = adam8 ? 10 : 16 // fp32 weight + fp32 grad + two Adam moments
  const loraParams = rank * m.loraPerRank
  const lora = loraParams * perTrainable
  const head = m.head * perTrainable
  const ckptBytes = m.layers * batch * seq * m.hidden * 2
  const acts = offload ? 0 : ckptBytes
  const total = weights + lora + head + acts
  const logits = batch * seq * m.vocab * 4

  const parts = [
    { key: "weights", label: fourBit ? "frozen backbone, 4-bit linears" : "frozen backbone, 16-bit", bytes: weights, color: COLORS.weights },
    { key: "lora", label: `LoRA r=${rank}: ${(loraParams / 1e6).toFixed(1)}M params + grads + Adam`, bytes: lora, color: COLORS.lora },
    { key: "head", label: `Clef head: ${(m.head / 1e6).toFixed(1)}M params + grads + Adam`, bytes: head, color: COLORS.head },
    { key: "acts", label: offload ? "layer checkpoints: in system RAM" : "layer checkpoints on the GPU", bytes: acts, color: COLORS.acts },
  ]
  const scale = Math.max(total, 4e9) * 1.05

  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where the GPU memory goes · lower bound</span>
        <span className="font-mono text-[10px] text-muted-foreground">dims from the safetensors headers</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((x, i) => (
            <button key={x.name} type="button" aria-pressed={mi === i} onClick={() => setMi(i)} className={pill(mi === i)}>
              {x.name}
            </button>
          ))}
          <button type="button" aria-pressed={fourBit} onClick={() => setFourBit((v) => !v)} className={pill(fourBit)}>
            4-bit base
          </button>
          <button type="button" aria-pressed={offload} onClick={() => setOffload((v) => !v)} className={pill(offload)}>
            offload checkpoints
          </button>
          <button type="button" aria-pressed={adam8} onClick={() => setAdam8((v) => !v)} className={pill(adam8)}>
            8-bit Adam
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block font-mono text-[10px] text-muted-foreground">
            LoRA rank r = {rank}
            <Range min={8} max={128} step={8} value={rank} onChange={(e) => setRank(Number(e.target.value))} className="mt-1.5 w-full" aria-label="LoRA rank" />
          </label>
          <label className="block font-mono text-[10px] text-muted-foreground">
            padded length = {seq} tokens
            <Range min={256} max={4096} step={256} value={seq} onChange={(e) => setSeq(Number(e.target.value))} className="mt-1.5 w-full" aria-label="sequence length" />
          </label>
          <label className="block font-mono text-[10px] text-muted-foreground">
            micro-batch = {batch} records
            <Range min={1} max={16} step={1} value={batch} onChange={(e) => setBatch(Number(e.target.value))} className="mt-1.5 w-full" aria-label="micro-batch size" />
          </label>
        </div>

        <div>
          <div className="flex h-6 w-full overflow-hidden rounded-sm bg-muted/40" role="img" aria-label={`about ${gb(total).toFixed(2)} GB before working memory`}>
            {parts.map((p) => (
              <span key={p.key} title={`${p.label}: ${gb(p.bytes).toFixed(2)} GB`} style={{ width: `${(p.bytes / scale) * 100}%`, background: p.color, opacity: 0.85 }} />
            ))}
          </div>
          <div className="relative mt-1 h-3 font-mono text-[9px] text-muted-foreground">
            <span className="absolute -translate-x-1/2" style={{ left: `${(4e9 / scale) * 100}%` }}>
              4 GB
            </span>
          </div>
          <ul className="mt-2 space-y-0.5 font-mono text-[10px]">
            {parts.map((p) => (
              <li key={p.key} className="flex justify-between gap-2">
                <span>
                  <span style={{ color: p.color }}>■</span> {p.label}
                </span>
                <span className="tabular-nums">{gb(p.bytes).toFixed(2)} GB</span>
              </li>
            ))}
            <li className="flex justify-between gap-2 border-t pt-1">
              <span>counted total</span>
              <span className="tabular-nums">{gb(total).toFixed(2)} GB</span>
            </li>
          </ul>
        </div>

        <div className="rounded-md border border-dashed px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          never allocated: next-token logits for a language-model loss, {batch} × {seq} × {m.vocab.toLocaleString("en-US")}{" "}
          vocabulary × 4 bytes = <span className="tabular-nums text-foreground">{gb(logits).toFixed(1)} GB</span>. The
          head reads <code>last_hidden_state</code> and a handful of embedding rows for the option tokens, so this
          tensor never exists.
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Parameter counts summed from the model safetensors headers; head size from Cloudflare&apos;s{" "}
        <code>JointSchemaHead</code> at Unsloth&apos;s default width. A lower bound: it omits the activations of the
        layer being recomputed, the CUDA context and allocator slack, and assumes the vision tower loads in 16-bit.
        Unsloth does not say which of these settings produced its 4 GB figure.
      </figcaption>
    </figure>
  )
}
