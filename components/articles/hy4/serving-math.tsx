"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Weights: byte totals of the safetensors files in tencent/Hy4-preview (131
// shards) and tencent/Hy4-preview-FP8 (130 shards), summed from the Hugging
// Face API on 2026-11-10. The FP4 row is an estimate: routed experts (753.767B
// params incl. the MTP layer's, from config.json shapes) at NVFP4's 4.5 bits a
// weight, the other 26.194B at one byte. Tencent's Hy4 endpoint on OpenRouter
// is tagged fp4, but Hy4's own weights are unpublished: these are the
// preview's numbers, and a vision tower would add to them.
//
// KV cache per token, from config.json: MLA latent kv_lora_rank 512 + rope 64
// = 576 values in each of 78 layers, plus a 128-dim FP8 indexer key in the 21
// "full" IndexCache layers (2,688 bytes). Scales and the MTP layer ignored.

const WEIGHTS = [
  { id: "bf16", label: "BF16 (measured)", gb: 1559.98 },
  { id: "fp8", label: "FP8 (measured)", gb: 813.77 },
  { id: "fp4", label: "FP4 experts (estimate)", gb: 450.19 },
] as const

const CTX = [32768, 131072, 262144, 524288, 1048576]
const GPUS = [80, 141, 192]

const LATENT = 576 * 78
const INDEXER = 21 * 128

function fmtTok(t: number) {
  return t >= 1048576 ? `${t / 1048576}M` : `${t / 1024}K`
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function ServingMath() {
  const [w, setW] = useState<(typeof WEIGHTS)[number]["id"]>("fp4")
  const [ctxI, setCtxI] = useState(4)
  const [kvBytes, setKvBytes] = useState<1 | 2>(2)
  const [streams, setStreams] = useState(1)
  const [gpu, setGpu] = useState(141)

  const weights = WEIGHTS.find((x) => x.id === w)!.gb
  const ctx = CTX[ctxI]
  const perTok = LATENT * kvBytes + INDEXER
  const kvGb = (perTok * ctx * streams) / 1e9
  const total = weights + kvGb
  const cards = Math.ceil(total / (gpu * 0.9))

  const [inM, setInM] = useState(2)
  const [outK, setOutK] = useState(40)
  const list = inM * 0.834 + (outK / 1000) * 2.501
  const disc = list / 2

  const bar = (gb: number) => `${Math.min(100, (gb / 1700) * 100)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="mr-auto font-mono text-xs text-muted-foreground">what a 780B checkpoint costs to hold</span>
        {WEIGHTS.map((x) => (
          <Pill key={x.id} on={w === x.id} onClick={() => setW(x.id)}>
            {x.label}
          </Pill>
        ))}
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>context</span>
          {CTX.map((c, i) => (
            <Pill key={c} on={ctxI === i} onClick={() => setCtxI(i)}>
              {fmtTok(c)}
            </Pill>
          ))}
          <span className="ml-2">KV</span>
          <Pill on={kvBytes === 2} onClick={() => setKvBytes(2)}>BF16</Pill>
          <Pill on={kvBytes === 1} onClick={() => setKvBytes(1)}>FP8</Pill>
        </div>
        <label className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="w-28">concurrent streams {streams}</span>
          <input type="range" min={1} max={16} value={streams} onChange={(e) => setStreams(+e.target.value)} className="flex-1" />
        </label>

        <div className="space-y-1.5 font-mono text-[10.5px]">
          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">weights</span>
            <div className="h-3 flex-1 rounded-sm bg-muted/40">
              <div className="h-full rounded-sm" style={{ width: bar(weights), background: "oklch(0.62 0.14 250)" }} />
            </div>
            <span className="w-20 text-right tabular-nums">{weights.toFixed(0)} GB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">KV cache</span>
            <div className="h-3 flex-1 rounded-sm bg-muted/40">
              <div className="h-full rounded-sm" style={{ width: bar(kvGb), background: "oklch(0.68 0.16 45)" }} />
            </div>
            <span className="w-20 text-right tabular-nums">{kvGb.toFixed(1)} GB</span>
          </div>
          <p className="text-muted-foreground">
            {perTok.toLocaleString("en-US")} bytes a token &times; {ctx.toLocaleString("en-US")} tokens &times; {streams}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>GPU memory</span>
          {GPUS.map((g) => (
            <Pill key={g} on={gpu === g} onClick={() => setGpu(g)}>
              {g} GB
            </Pill>
          ))}
          <span className="ml-auto text-sm text-foreground">
            {total.toFixed(0)} GB &rarr; <b>{cards}</b> GPUs at 90% usable
          </span>
        </div>

        <div className="border-t pt-3">
          <p className="mb-2 font-mono text-[10px] text-muted-foreground">one agent task on the hosted API</p>
          <label className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="w-28">input {inM}M tokens</span>
            <input type="range" min={0.5} max={20} step={0.5} value={inM} onChange={(e) => setInM(+e.target.value)} className="flex-1" />
          </label>
          <label className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="w-28">output {outK}K tokens</span>
            <input type="range" min={5} max={500} step={5} value={outK} onChange={(e) => setOutK(+e.target.value)} className="flex-1" />
          </label>
          <p className="mt-2 font-mono text-sm">
            list <span className="tabular-nums">${list.toFixed(2)}</span> &middot; at the 50% discount{" "}
            <span className="tabular-nums" style={{ color: "oklch(0.55 0.16 155)" }}>
              ${disc.toFixed(2)}
            </span>
          </p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          The two measured rows are the preview&rsquo;s published checkpoints. The FP4 row is my estimate for
          the precision Tencent&rsquo;s endpoint reports, and no input caching is assumed in the price (cached
          reads list at a twentieth of the input rate).
        </p>
      </div>
    </figure>
  )
}
