"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import {
  CASCADE_TOTAL_GFLOPS,
  KV_BYTES_PER_TOKEN,
  LLM,
  fmt,
  imageTokens,
  llmPrefillFlops,
  vitFlops,
} from "./data"

type Mode = "detect" | "mask"

const PROMPT_TOKENS = 60 // system and question around the image, an estimate
const DECODE_BYTES = (LLM.bodyParams + LLM.headParams) * 2 // bf16 weights read once per decoded token

const tf = (x: number) => x / 1e12

export function CostLab() {
  const [side, setSide] = useState(896)
  const [n, setN] = useState(12)
  const [mode, setMode] = useState<Mode>("mask")
  const [bw, setBw] = useState(1000)

  const tokens = imageTokens(side)
  const patches = tokens * 4
  const respTokens = mode === "mask" ? 6 * n + 4 : 5 * n + 4
  const passes = mode === "mask" ? 2 : 1
  const vit = passes * vitFlops(patches)
  const prefill = llmPrefillFlops(tokens + PROMPT_TOKENS) + (mode === "mask" ? llmPrefillFlops(tokens + PROMPT_TOKENS + respTokens) : 0)
  const decoder = mode === "mask" ? n * CASCADE_TOTAL_GFLOPS * 1e9 : 0
  const total = vit + prefill + decoder
  const kvMiB = ((tokens + PROMPT_TOKENS + respTokens) * KV_BYTES_PER_TOKEN) / 2 ** 20
  const decodeSec = (respTokens * DECODE_BYTES) / (bw * 1e9)
  const rest = vit + prefill
  const crossover = mode === "mask" ? Math.ceil(rest / (CASCADE_TOTAL_GFLOPS * 1e9)) : null

  const rows = [
    { id: "vit", label: `ViT x${passes}`, v: vit, c: "oklch(0.68 0.12 250)" },
    { id: "llm", label: `LLM prefill x${passes}`, v: prefill, c: "oklch(0.7 0.12 160)" },
    { id: "dec", label: "pixel decoder", v: decoder, c: "oklch(0.72 0.14 305)" },
  ]
  const top = Math.max(...rows.map((r) => r.v), 1)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        cost of one request · parameters from config.json and mask_decoder.pt, FLOPs by formula (reasoned, not timed)
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["detect", "mask"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                mode === m ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {m === "detect" ? "boxes only" : "masks or mattes"}
            </button>
          ))}
        </div>
        <div className="grid gap-x-6 gap-y-2 font-mono text-[11px] sm:grid-cols-3">
          <label className="flex items-center gap-2">
            side
            <input type="range" min={448} max={1440} step={32} value={side} onChange={(e) => setSide(Number(e.target.value))} />
            <span className="w-12 tabular-nums">{side}px</span>
          </label>
          <label className="flex items-center gap-2">
            instances
            <input type="range" min={1} max={100} value={n} onChange={(e) => setN(Number(e.target.value))} />
            <span className="w-8 tabular-nums">{n}</span>
          </label>
          <label className="flex items-center gap-2">
            memory
            <input type="range" min={300} max={2000} step={50} value={bw} onChange={(e) => setBw(Number(e.target.value))} />
            <span className="w-16 tabular-nums">{fmt(bw)} GB/s</span>
          </label>
        </div>

        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[8.5rem_1fr_5rem] items-center gap-2 font-mono text-[11px]">
              <span className="truncate">{r.label}</span>
              <div className="h-2.5 overflow-hidden rounded bg-muted">
                <div className="h-full" style={{ width: `${((r.v / top) * 100).toFixed(1)}%`, background: r.c }} />
              </div>
              <span className="text-right tabular-nums">{tf(r.v).toFixed(2)} TF</span>
            </div>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">image tokens</dt>
            <dd className="tabular-nums">{fmt(tokens)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">answer tokens</dt>
            <dd className="tabular-nums">{fmt(respTokens)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">KV cache</dt>
            <dd className="tabular-nums">{kvMiB.toFixed(0)} MiB</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">decode, bandwidth bound</dt>
            <dd className="tabular-nums">{decodeSec.toFixed(1)} s</dd>
          </div>
        </dl>
        <p className="font-mono text-[11px] text-muted-foreground">
          {mode === "mask" && crossover !== null
            ? `Total ${tf(total).toFixed(1)} TFLOPs. At this image size the 9.6M-parameter decoder alone out-computes the other ${tf(rest).toFixed(1)} TFLOPs from ${fmt(crossover)} instances.`
            : `Total ${tf(total).toFixed(1)} TFLOPs. With boxes only there is one pass and no pixel decoder.`}
        </p>
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Masks cost two passes because the released engine re-runs the whole model on the finished answer to read the hidden state at each{" "}
        <code>&lt;OBJ&gt;</code>. The decoder figure is {CASCADE_TOTAL_GFLOPS} GFLOPs per instance on its 1,024 x 1,024 canvas, from the
        convolution shapes. Decode time reads the bf16 weights once per token.
      </p>
    </figure>
  )
}
