"use client"

import { useState } from "react"

// Where Hy4 flash's 220.25B parameters live, and how many bytes each release spends on them.
// Parameter counts: my sum over the 1,964 tensors in the 148 safetensors headers of tencent/Hy4-flash.
// Bytes: the Hub's file sizes for tencent/Hy4-flash (BF16) and tencent/Hy4-flash-FP8, whose Engram
// tables stay BF16, and the two Q3_K shards of AngelSlim/Hy4-flash-GGUF, where shard 2 is the table
// alone in F8_E4M3.

type Part = { key: string; label: string; params: number; touched: string; where: string; table?: boolean }

const PARTS: Part[] = [
  { key: "experts", label: "Routed experts", params: 148.579, touched: "16 of 512 per layer: 4.64B", where: "accelerator memory" },
  { key: "dense", label: "Attention, shared experts, dense layer, embeddings, head", params: 6.904, touched: "all but the 0.37B embedding table", where: "accelerator memory" },
  { key: "table", label: "Engram tables (4 layers)", params: 63.361, touched: "64 rows of 96: 6,144 values", where: "host RAM, or an SSD", table: true },
  { key: "eproj", label: "Engram projections and norms", params: 0.095, touched: "all", where: "accelerator memory" },
  { key: "vision", label: "Vision encoder and projector", params: 0.467, touched: "only with an image", where: "accelerator memory" },
  { key: "dfly", label: "DFly2 drafter", params: 0.846, touched: "while drafting", where: "accelerator memory" },
]

type Release = { key: string; label: string; total: number; table: number; tableFmt: string }

const RELEASES: Release[] = [
  { key: "bf16", label: "Hy4-flash (BF16)", total: 440.53, table: 126.72, tableFmt: "BF16" },
  { key: "fp8", label: "Hy4-flash-FP8", total: 287.08, table: 126.72, tableFmt: "BF16, not quantized" },
  { key: "q3k", label: "GGUF Q3_K", total: 155.37, table: 63.36, tableFmt: "F8_E4M3" },
]

const TOTAL = 220.251

export function MemoryMap() {
  const [rel, setRel] = useState("bf16")
  const [hover, setHover] = useState<string | null>("table")
  const r = RELEASES.find((x) => x.key === rel)!
  const shown = PARTS.find((p) => p.key === hover)
  const share = (r.table / r.total) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        where the 220.25B parameters live
      </div>
      <div className="space-y-5 px-4 py-4">
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">parameters, by what they are</div>
          <div className="flex h-9 w-full overflow-hidden rounded border">
            {PARTS.map((p) => (
              <button
                key={p.key}
                type="button"
                onMouseEnter={() => setHover(p.key)}
                onFocus={() => setHover(p.key)}
                onClick={() => setHover(p.key)}
                aria-label={p.label}
                className={`h-full border-r border-background/60 transition-opacity ${hover === p.key ? "opacity-100" : "opacity-70"} ${
                  p.table
                    ? "bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(0,0,0,.45)_3px_6px)] dark:bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.5)_3px_6px)]"
                    : p.key === "experts"
                      ? "bg-foreground/50"
                      : "bg-foreground/25"
                }`}
                style={{ width: `${(p.params / TOTAL) * 100}%` }}
              />
            ))}
          </div>
          {shown ? (
            <div className="mt-2 grid gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-[auto_1fr]">
              <span className="text-foreground">{shown.label}</span>
              <span className="text-muted-foreground">
                {shown.params.toFixed(shown.params < 1 ? 3 : 2)}B, {((shown.params / TOTAL) * 100).toFixed(1)}% of the checkpoint
              </span>
              <span className="text-muted-foreground">read per token</span>
              <span>{shown.touched}</span>
              <span className="text-muted-foreground">can live in</span>
              <span>{shown.where}</span>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="mr-auto">bytes on disk, by release</span>
            <div role="group" aria-label="release" className="flex flex-wrap gap-1">
              {RELEASES.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setRel(x.key)}
                  aria-pressed={rel === x.key}
                  className={`rounded border px-2 py-0.5 ${rel === x.key ? "border-foreground/40 bg-foreground/10 text-foreground" : "border-transparent"}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative h-9 w-full overflow-hidden rounded border">
            <div className="absolute inset-y-0 left-0 bg-foreground/40" style={{ width: `${((r.total - r.table) / 440.53) * 100}%` }} />
            <div
              className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(0,0,0,.45)_3px_6px)] dark:bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.5)_3px_6px)]"
              style={{ left: `${((r.total - r.table) / 440.53) * 100}%`, width: `${(r.table / 440.53) * 100}%` }}
            />
          </div>
          <div className="mt-2 grid gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-[auto_1fr]">
            <span className="text-muted-foreground">files</span>
            <span>{r.total.toFixed(2)} GB</span>
            <span className="text-muted-foreground">Engram tables</span>
            <span>
              {r.table.toFixed(2)} GB in {r.tableFmt}, {share.toFixed(1)}% of the bytes
            </span>
            <span className="text-muted-foreground">everything else</span>
            <span>{(r.total - r.table).toFixed(2)} GB</span>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The hatched part is four hashed n-gram tables. Quantizing the rest of the model makes them a bigger share of
        what you download, not a smaller one. Bars on the lower chart share one scale, the BF16 release.
      </figcaption>
    </figure>
  )
}
