"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Multiply-adds to embed one query, two ways.
//
// Static table (Modern Web Guidance's static-embedder.ts): one row of D Int8
// values per known word, so words x D multiply-adds, plus D for the norm.
//
// all-MiniLM-L6-v2 (the Gen 2 model), from its config.json: hidden 384, 6
// layers, FFN 1536. Per token per layer, the weight matmuls are
// 4*384*384 (Q, K, V, output) + 2*384*1536 (FFN) = 1,769,472 multiply-adds;
// x 6 layers = 10,616,832 per token. Attention scores and the weighted sum add
// 2 * n^2 * 384 per layer. Biases, LayerNorm, GELU and softmax are left out,
// so this undercounts the transformer slightly.

const ACCENT = "oklch(0.6 0.15 255)"
const PER_TOKEN = 6 * (4 * 384 * 384 + 2 * 384 * 1536)
const fmt = (n: number) => n.toLocaleString("en-US")

export function EmbedCost() {
  const [words, setWords] = useState(3)
  const [pieces, setPieces] = useState(2) // extra WordPiece pieces beyond one per word
  const [dims, setDims] = useState(256)

  const staticMacs = words * dims + dims
  const staticBytes = words * dims + words * 4
  const n = words + pieces + 2 // + [CLS] and [SEP]
  const tfMacs = n * PER_TOKEN + 6 * 2 * n * n * 384
  const ratio = tfMacs / staticMacs

  const bar = (v: number) => `${Math.max(0.4, (mlog(v) / mlog(tfMacs)) * 100).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what one query embed costs, counted</span>
        <span className="font-mono text-[10px] text-muted-foreground">static table vs all-MiniLM-L6-v2</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            words in the query (known to the table) = <span className="text-foreground">{words}</span>
            <Range aria-label="words" min={1} max={20} step={1} value={words} onChange={(e) => setWords(Number(e.target.value))} className="mt-1 w-full" accent={ACCENT} />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            extra WordPiece pieces (fetchpriority alone is 3) = <span className="text-foreground">{pieces}</span>
            <Range aria-label="extra pieces" min={0} max={20} step={1} value={pieces} onChange={(e) => setPieces(Number(e.target.value))} className="mt-1 w-full" accent={ACCENT} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          table dims
          {[64, 128, 256, 512, 768].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDims(d)}
              aria-pressed={dims === d}
              className={cn(
                "cursor-pointer rounded-full border px-2 py-0.5",
                dims === d ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border hover:text-foreground",
              )}
            >
              {d}
              {d === 256 ? " (MWG)" : ""}
            </button>
          ))}
        </div>

        <div className="space-y-2 font-mono text-[11px]">
          <div>
            <div className="flex justify-between gap-2">
              <span>static table: {words} × {dims} + {dims} (norm)</span>
              <span className="text-foreground">{fmt(staticMacs)}</span>
            </div>
            <div className="mt-0.5 h-2.5 rounded-sm bg-muted/40"><div className="h-2.5 rounded-sm" style={{ width: bar(staticMacs), background: ACCENT }} /></div>
          </div>
          <div>
            <div className="flex justify-between gap-2">
              <span>MiniLM-L6: {n} tokens × {fmt(PER_TOKEN)} + attention</span>
              <span className="text-foreground">{fmt(tfMacs)}</span>
            </div>
            <div className="mt-0.5 h-2.5 rounded-sm bg-muted/40"><div className="h-2.5 rounded-sm" style={{ width: bar(tfMacs), background: "oklch(0.65 0.04 255)" }} /></div>
          </div>
          <div className="text-muted-foreground">bars on a log scale · multiply-adds per query</div>
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">transformer ÷ table</div>
            <div className="text-base text-foreground">{fmt(Math.round(ratio))}×</div>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">table bytes touched</div>
            <div className="text-base text-foreground">{fmt(staticBytes)} B</div>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">whole table at {dims} dims</div>
            <div className="text-base text-foreground">{(29165 * dims / 1e6).toFixed(1)} MB</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Counts only, no clock. The table side reads {words} rows of {dims} bytes plus {words} four-byte scales; it never touches the other
          29,165 − {words} rows. The transformer side is architecture arithmetic from MiniLM&apos;s config (biases, LayerNorm and GELU left
          out). Measured times are in the table under this widget.
        </p>
      </div>
    </figure>
  )
}
