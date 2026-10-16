"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Will Muse Spark Open fit? Weight bytes are measured: the sum of every
// safetensors or GGUF file in each repository, from the Hugging Face API on
// 2026-10-16. GGUF entries exclude the 4.10 GB BF16 vision+audio projector
// (mmproj-BF16.gguf); the safetensors checkpoints already carry their encoders.
//
// The KV cache is arithmetic on the architecture read from the GGUF header and
// the mlx-community config: 62 layers, 16 of them global (full context), 46
// sliding with a 2,048-token window, 16 KV heads of width 64, K and V each.
// Memory capacities take the vendor's "GB" as GiB (512 GB of unified memory is
// 512 x 2^30 bytes = 549.76 GB). Only + - * / and Math.round reach the DOM.

type Ckpt = { id: string; label: string; repo: string; gb: number; gguf: boolean }

const CKPTS: Ckpt[] = [
  { id: "bf16", label: "BF16", repo: "meta-models (gated)", gb: 1644.33, gguf: false },
  { id: "fp8", label: "FP8", repo: "amd Quark PTPC-FP8", gb: 832.75, gguf: false },
  { id: "nvfp4", label: "NVFP4", repo: "meta-models -NVFP4 (gated)", gb: 533.01, gguf: false },
  { id: "mlx4", label: "MLX 4-bit", repo: "mlx-community -4bit", gb: 532.78, gguf: false },
  { id: "mlx3", label: "MLX 3-bit", repo: "mlx-community -3bit", gb: 436.14, gguf: false },
  { id: "q2kxl", label: "UD-Q2_K_XL", repo: "unsloth GGUF", gb: 311.23, gguf: true },
  { id: "iq2s", label: "UD-IQ2_S", repo: "unsloth GGUF", gb: 275.5, gguf: true },
  { id: "iq2xxs", label: "UD-IQ2_XXS", repo: "unsloth GGUF", gb: 225.57, gguf: true },
  { id: "iq1s", label: "UD-IQ1_S", repo: "unsloth GGUF", gb: 175.64, gguf: true },
]

const GIB = 1.073741824 // GB per GiB
const HW = [
  { id: "mac256", label: "1 x Mac Studio M5 Ultra, 256 GB", gb: 256 * GIB },
  { id: "mac512", label: "1 x Mac Studio M5 Ultra, 512 GB", gb: 512 * GIB },
  { id: "mac2x", label: "2 x Mac Studio M5 Ultra, 512 GB", gb: 1024 * GIB },
  { id: "h100", label: "8 x H100 80 GB", gb: 640 * GIB },
  { id: "h200", label: "8 x H200 141 GB", gb: 1128 * GIB },
]

const CTX = [32_768, 131_072, 262_144, 524_288, 1_048_576]
const CTX_LABEL = ["32K", "128K", "256K", "512K", "1M"]

const GLOBAL_LAYERS = 16
const SLIDING_LAYERS = 46
const KV_WIDTH = 2 * 16 * 64 // K and V, 16 heads x 64
const WINDOW = 2048
const MMPROJ_GB = 4.1

const r1 = (n: number) => Math.round(n * 10) / 10
const fmt = (n: number) => n.toLocaleString("en-US")

export function FitCalculator() {
  const [ck, setCk] = useState("mlx4")
  const [hw, setHw] = useState("mac2x")
  const [ci, setCi] = useState(4)
  const [kvBytes, setKvBytes] = useState(2)
  const [enc, setEnc] = useState(true)
  const [reserve, setReserve] = useState(10)

  const c = CKPTS.find((x) => x.id === ck) ?? CKPTS[0]
  const h = HW.find((x) => x.id === hw) ?? HW[0]
  const tokens = CTX[ci]
  const kvGlobal = (tokens * GLOBAL_LAYERS * KV_WIDTH * kvBytes) / 1e9
  const kvSliding = (Math.min(tokens, WINDOW) * SLIDING_LAYERS * KV_WIDTH * kvBytes) / 1e9
  const kvAllGlobal = (tokens * (GLOBAL_LAYERS + SLIDING_LAYERS) * KV_WIDTH * kvBytes) / 1e9
  const encGb = c.gguf && enc ? MMPROJ_GB : 0
  const need = c.gb + encGb + kvGlobal + kvSliding
  const usable = h.gb * (1 - reserve / 100)
  const fits = need <= usable
  const scale = Math.max(need, h.gb) * 1.04
  const pct = (n: number) => `${(n / scale) * 100}%`

  const parts = [
    { id: "w", label: `weights, ${c.label}`, gb: c.gb, color: "#0866ff" },
    ...(encGb ? [{ id: "e", label: "vision + audio projector (BF16 GGUF)", gb: encGb, color: "#7c5cff" }] : []),
    { id: "g", label: "KV, 16 global layers", gb: kvGlobal, color: "#f59e0b" },
    { id: "s", label: "KV, 46 sliding layers", gb: kvSliding, color: "#fbbf24" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">will Muse Spark Open fit?</span>
        <span className="font-mono text-[10px] text-muted-foreground">file sizes measured, KV computed</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>checkpoint</span>
            <select
              value={ck}
              onChange={(e) => setCk(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-foreground"
            >
              {CKPTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label} ({x.repo}), {fmt(x.gb)} GB
                </option>
              ))}
            </select>
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>hardware</span>
            <select
              value={hw}
              onChange={(e) => setHw(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-foreground"
            >
              {HW.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>context</span>
              <span className="text-foreground">
                {CTX_LABEL[ci]} = {fmt(tokens)} tokens
              </span>
            </span>
            <Range
              min={0}
              max={CTX.length - 1}
              step={1}
              value={ci}
              onChange={(e) => setCi(Number(e.target.value))}
              className="mt-1 w-full"
              aria-label="context length"
            />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>keep free for the OS and runtime</span>
              <span className="text-foreground">{reserve}%</span>
            </span>
            <Range
              min={0}
              max={25}
              step={5}
              value={reserve}
              onChange={(e) => setReserve(Number(e.target.value))}
              className="mt-1 w-full"
              aria-label="memory to keep free"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2">
            KV cache dtype:
            {[2, 1].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setKvBytes(b)}
                className={`rounded border px-2 py-0.5 ${kvBytes === b ? "bg-foreground text-background" : ""}`}
              >
                {b === 2 ? "BF16" : "FP8"}
              </button>
            ))}
          </span>
          {c.gguf ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enc} onChange={(e) => setEnc(e.target.checked)} />
              <span>load images and audio (mmproj, +4.1 GB)</span>
            </label>
          ) : (
            <span>encoders are inside this checkpoint</span>
          )}
        </div>

        <div>
          <div className="relative h-9 w-full overflow-hidden rounded-md border bg-background/60" aria-hidden>
            <div className="flex h-full">
              {parts.map((p) => (
                <div key={p.id} style={{ width: pct(p.gb), background: p.color }} title={p.label} />
              ))}
            </div>
            <div className="absolute inset-y-0 border-l-2 border-dashed border-foreground/70" style={{ left: pct(usable) }} />
            <div className="absolute inset-y-0 border-l-2 border-foreground" style={{ left: pct(h.gb) }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>0</span>
            <span>dashed: usable {r1(usable)} GB / solid: installed {r1(h.gb)} GB</span>
          </div>
          <div className="mt-2 grid gap-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
            {parts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
                  {p.label}
                </span>
                <span className="text-foreground">{r1(p.gb)} GB</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">needed</div>
            <div className="text-lg text-foreground">{r1(need)} GB</div>
            <div className="text-[10px] text-muted-foreground">weights + encoders + KV</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">verdict</div>
            <div className={`text-lg ${fits ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {fits ? "fits" : "does not fit"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {fits ? `${r1(usable - need)} GB to spare` : `${r1(need - usable)} GB short`}
            </div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">KV if all 62 layers were global</div>
            <div className="text-lg text-foreground">{r1(kvAllGlobal)} GB</div>
            <div className="text-[10px] text-muted-foreground">vs {r1(kvGlobal + kvSliding)} GB with the 3:1 sliding pattern</div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        Weight sizes are the sum of each repository&apos;s files. A fit here means the bytes fit: it says nothing about speed, and
        llama.cpp can also stream weights from disk when they do not.
      </figcaption>
    </figure>
  )
}
