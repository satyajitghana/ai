"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Where the bytes of NVIDIA's "4GB" GGUF (Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf, 6,180,446,208 bytes)
// actually live. Tensor sizes are summed from the GGUF header, range-read from
// huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB (720 tensors, no vision or audio tensors).
// KV-cache sizes are arithmetic on config.json (text_config):
//   42 layers, every 6th full attention, the rest sliding (window 512)
//   2 KV heads; head_dim 256 on sliding layers, 512 on full layers; K and V stored separately
//   num_kv_shared_layers = 18: the last 18 layers reuse earlier layers' K/V, so only 24 own a cache
//   (of those 24: layers 5, 11, 17, 23 are full, 20 are sliding)
// F16 cache, 2 bytes per value. Compute buffers are not modelled.

const GB = 1e9

const WEIGHTS = {
  blocks: 2.402, // 42 decoder blocks: attention, MLP, per-layer gates (Q4_K, Q6_K for ffn_down / attn_v)
  embd: 0.713, // token_embd, Q8_0, also the tied LM head
  proj: 0.055, // per_layer_model_proj, BF16
  ple: 2.995, // per_layer_token_embd, Q8_0, 262,144 rows x 10,752
}

const PLE_ROW_BYTES = (10752 / 32) * 34 // one token's row at Q8_0 = 11,424 bytes
const FULL_BYTES_PER_TOKEN = 2 * 2 * 512 * 2 // K+V x 2 heads x 512 dims x 2 bytes = 4,096
const SWA_BYTES_PER_TOKEN = 2 * 2 * 256 * 2 // = 2,048
const WINDOW = 512

const CONTEXTS = [1024, 2048, 4096, 8192, 16384, 32768, 65536]
const ctxLabel = (n: number) => `${n / 1024}K`

type Mode = "gpu" | "cpu"

const MODE_TEXT: Record<Mode, string> = {
  gpu: "llama.cpp with every layer on the GPU (-ngl 999). llama.cpp tags per_layer_token_embd as an input tensor (a row lookup) and keeps input tensors on the CPU, so the 3 GB table never enters VRAM.",
  cpu: "CPU only, weights memory-mapped (llama.cpp's default). This is the working set: every block weight is read for every token, while the per-layer table is only looked up, one 11.4 KB row per distinct token at most. Measured on Unsloth's file, the working set matched this, but llama.cpp's loader still pre-reads the whole file, so RSS counts all of it, and default repacking adds a second copy of the block weights.",
}

function kvBytes(ctx: number, shared: boolean) {
  const full = shared ? 4 : 7
  const swa = shared ? 20 : 35
  return ctx * full * FULL_BYTES_PER_TOKEN + Math.min(ctx, WINDOW) * swa * SWA_BYTES_PER_TOKEN
}

const fmt = (gb: number) => (gb >= 1 ? gb.toFixed(2) : gb.toFixed(3))

type Row = { key: string; label: string; gb: number; color: string }

export function MemoryLedger() {
  const [mode, setMode] = useState<Mode>("gpu")
  const [ci, setCi] = useState(5)
  const [shared, setShared] = useState(true)

  const ctx = CONTEXTS[ci]
  const kv = kvBytes(ctx, shared) / GB
  const kvOther = kvBytes(ctx, !shared) / GB
  const pleResident = mode === "cpu" ? (Math.min(ctx, 262144) * PLE_ROW_BYTES) / GB : 0

  const hot: Row[] = [
    { key: "blocks", label: "42 decoder blocks (Q4_K / Q6_K)", gb: WEIGHTS.blocks, color: "oklch(0.62 0.15 255)" },
    { key: "embd", label: "token embedding = LM head (Q8_0)", gb: WEIGHTS.embd, color: "oklch(0.66 0.13 200)" },
    { key: "proj", label: "per-layer projection (BF16)", gb: WEIGHTS.proj, color: "oklch(0.70 0.10 170)" },
    {
      key: "kv",
      label: `KV cache at ${ctxLabel(ctx)} tokens, F16, ${shared ? "24" : "42"} layers own one`,
      gb: kv,
      color: "oklch(0.70 0.16 55)",
    },
  ]
  if (mode === "cpu") {
    hot.push({
      key: "pleR",
      label: "per-layer table rows touched (worst case: every token distinct)",
      gb: pleResident,
      color: "oklch(0.64 0.15 145)",
    })
  }
  const hotTotal = hot.reduce((s, r) => s + r.gb, 0)
  const coldGb = mode === "gpu" ? WEIGHTS.ple : WEIGHTS.ple - pleResident

  const scale = 7.2
  const pct = (gb: number) => `${((gb / scale) * 100).toFixed(3)}%`
  const marks = [
    { gb: 4, label: "4 GB" },
    { gb: 6, label: "6 GB" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf · 6.18 GB on disk</span>
        <span className="text-muted-foreground/60">sizes from the GGUF header</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {(["gpu", "cpu"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md border px-3 py-1 font-mono text-xs",
                mode === m ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "gpu" ? "GPU offload" : "CPU only, mmap"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShared((s) => !s)}
            className={cn(
              "rounded-md border px-3 py-1 font-mono text-xs",
              shared ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={shared}
          >
            KV sharing {shared ? "on (as shipped)" : "off (hypothetical)"}
          </button>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{MODE_TEXT[mode]}</p>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>{mode === "gpu" ? "VRAM" : "working set in RAM"}: weights and cache</span>
            <span className="font-semibold">{fmt(hotTotal)} GB</span>
          </div>
          <div className="relative h-9 w-full overflow-hidden rounded-md border bg-muted/30">
            <div className="flex h-full">
              {hot.map((r) => (
                <div
                  key={r.key}
                  style={{ width: pct(r.gb), background: r.color }}
                  className="h-full border-r border-background/60"
                  title={`${r.label}: ${fmt(r.gb)} GB`}
                />
              ))}
            </div>
            {marks.map((m) => (
              <div key={m.gb} className="absolute top-0 h-full border-l border-dashed border-foreground/70" style={{ left: pct(m.gb) }}>
                <span className="ml-1 font-mono text-[10px] text-foreground/80">{m.label}</span>
              </div>
            ))}
          </div>
          <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
            {hot.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                <span className="text-muted-foreground">{r.label}</span>
                <span className="ml-auto">{fmt(r.gb)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>
              {mode === "gpu" ? "system RAM (mapped, read by row)" : "mapped, pre-read at load, then rarely touched"}: per-layer table
            </span>
            <span className="font-semibold">{fmt(coldGb)} GB</span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-md border bg-muted/30">
            <div style={{ width: pct(coldGb), background: "oklch(0.64 0.15 145)", opacity: 0.45 }} className="h-full" />
          </div>
        </div>

        <div>
          <div className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>context</span>
            <span className="text-foreground">{ctxLabel(ctx)} tokens</span>
          </div>
          <Range
            min={0}
            max={CONTEXTS.length - 1}
            value={ci}
            onChange={(e) => setCi(Number(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="Context length"
          />
        </div>

        <p className="rounded-lg border p-3 text-sm leading-6">
          KV cache at {ctxLabel(ctx)}: <span className="font-mono">{fmt(kv)} GB</span> with {shared ? "sharing" : "no sharing"},{" "}
          <span className="font-mono">{fmt(kvOther)} GB</span> {shared ? "if all 42 layers kept their own" : "with sharing as shipped"}.
          Sliding layers stop growing at 512 tokens; the full-attention layers carry the length. NVIDIA reports 3.5 GB of VRAM at
          a 3K prompt and 4.3 GB at 32K cached plus 2K new tokens on an RTX 5070 (reported; compute buffers included).
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Weight sizes measured from the GGUF header; cache and residency are arithmetic on config.json and on llama.cpp&apos;s
        tensor placement, not a run. Compute buffers and the runtime itself are not counted.
      </figcaption>
    </figure>
  )
}
