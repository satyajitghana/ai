"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Parameter and attention-memory budget for MiniMax-M3.1-Flash.
//
// Parameter counts are measured: summed from the 48 safetensors headers of the
// Hugging Face repo (NVFP4 packed weights count two values per byte; scale
// tensors are not parameters). Weight bytes per decoded token are measured the
// same way (actual stored bytes, scales included).
//
// The attention numbers are reasoned from config.json: 60 layers, 4 KV heads of
// 128 dims (so 4 GQA groups), one shared 128-dim index key per layer, MSA block
// 128 with top-16 blocks, so a fixed 2,048 tokens per group per query. KV is
// assumed cached in BF16 (2 bytes) or FP8 (1 byte); the card does not say which
// a server uses. Per layer and decoded token:
//   full attention reads    4 groups x 2 (K,V) x 128 x N            = 1024 N values
//   MSA reads               1024 x min(N, 2048) + 128 N (index keys)
// M3 keeps layers 0-2 full; M3.1-Flash makes all 60 sparse. Arithmetic is
// + - * / only.

const CTX = [4096, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
const CTX_LABEL = ["4K", "16K", "32K", "64K", "128K", "256K", "512K", "1M"]

const LAYERS = 60
const KV_PER_LAYER = 4 * 2 * 128 // values per token per layer
const IDX_PER_LAYER = 128
const BUDGET = 16 * 128

type Layout = "flash" | "m3" | "dense"
const LAYOUTS: { id: Layout; label: string; full: number }[] = [
  { id: "flash", label: "M3.1-Flash: 60 sparse", full: 0 },
  { id: "m3", label: "M3: 3 full + 57 sparse", full: 3 },
  { id: "dense", label: "Plain GQA: 60 full", full: 60 },
]

// measured from the safetensors headers, billions of parameters
const PARAMS = [
  { label: "Routed experts (57 layers x 128)", total: 413.12, active: 12.91, tone: "oklch(0.72 0.12 30)" },
  { label: "Attention projections", total: 6.42, active: 6.42, tone: "oklch(0.65 0.1 250)" },
  { label: "Shared experts", total: 3.23, active: 3.23, tone: "oklch(0.68 0.1 160)" },
  { label: "Embedding + LM head", total: 2.46, active: 1.23, tone: "oklch(0.7 0.05 80)" },
  { label: "Vision tower + projectors", total: 0.87, active: 0, tone: "oklch(0.75 0.06 300)" },
  { label: "Dense FFN (layers 0-2)", total: 0.68, active: 0.68, tone: "oklch(0.6 0.08 200)" },
  { label: "MSA index projections", total: 0.24, active: 0.24, tone: "oklch(0.55 0.15 20)" },
]
const TOTAL = 427.05
const ACTIVE_TEXT = 23.52 // text path, no embedding table, no LM head
const WEIGHT_GB = 20.79 // stored bytes read per decoded token, batch 1

function attnRead(n: number, full: number): number {
  const sparseLayer = KV_PER_LAYER * Math.min(n, BUDGET) + IDX_PER_LAYER * n
  const fullLayer = KV_PER_LAYER * n
  return full * fullLayer + (LAYERS - full) * sparseLayer
}

function gb(values: number, bytes: number): string {
  const g = (values * bytes) / 1e9
  if (g >= 100) return `${g.toFixed(0)} GB`
  if (g >= 10) return `${g.toFixed(1)} GB`
  if (g >= 1) return `${g.toFixed(2)} GB`
  return `${(g * 1000).toFixed(0)} MB`
}

export function Budget() {
  const [ci, setCi] = useState(7)
  const [layout, setLayout] = useState<Layout>("flash")
  const [bytes, setBytes] = useState<1 | 2>(2)
  const [view, setView] = useState<"attn" | "params">("attn")

  const n = CTX[ci]
  const full = LAYOUTS.find((l) => l.id === layout)?.full ?? 0
  const stored = (LAYERS * (KV_PER_LAYER + IDX_PER_LAYER) - (layout === "dense" ? LAYERS * IDX_PER_LAYER : 0)) * n
  const read = attnRead(n, full)
  const readDense = attnRead(n, 60)
  const readM3 = attnRead(n, 3)
  const readFlash = attnRead(n, 0)
  const maxRead = Math.max(readDense, 1)
  const attnGb = (read * bytes) / 1e9

  const bars = [
    { id: "dense", label: "Plain GQA", v: readDense },
    { id: "m3", label: "M3 layout", v: readM3 },
    { id: "flash", label: "M3.1-Flash", v: readFlash },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        MiniMax-M3.1-Flash · parameters measured from headers · attention memory reasoned from config.json
      </div>

      <div className="flex flex-wrap gap-2 border-b px-4 py-3 text-xs">
        {(["attn", "params"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px]",
              view === v ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v === "attn" ? "KV memory per decoded token" : "total vs active parameters"}
          </button>
        ))}
      </div>

      {view === "attn" ? (
        <div className="space-y-4 px-4 py-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-muted-foreground">context</span>
              <Range
                min={0}
                max={CTX.length - 1}
                step={1}
                value={ci}
                onChange={(e) => setCi(Number(e.target.value))}
                aria-label="Context length"
                className="flex-1"
              />
              <span className="w-12 text-right font-mono tabular-nums">{CTX_LABEL[ci]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 font-mono text-muted-foreground">layer layout</span>
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLayout(l.id)}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-[11px]",
                    layout === l.id ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 font-mono text-muted-foreground">KV cache dtype</span>
              {([2, 1] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBytes(b)}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-[11px]",
                    bytes === b ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {b === 2 ? "BF16" : "FP8"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">60 layers, left = layer 0</div>
            <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-px">
              {Array.from({ length: LAYERS }, (_, i) => (
                <div
                  key={i}
                  title={`layer ${i}: ${i < full ? "full attention" : "MSA"}${i < 3 ? ", dense FFN" : ", MoE"}`}
                  className="h-5 rounded-[1px]"
                  style={{ background: i < full ? "oklch(0.62 0.17 30)" : "oklch(0.66 0.11 200)" }}
                />
              ))}
            </div>
            <div className="mt-1 flex gap-4 font-mono text-[10px] text-muted-foreground">
              <span>
                <span className="mr-1 inline-block h-2 w-2" style={{ background: "oklch(0.62 0.17 30)" }} />
                full attention: reads every past token
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2" style={{ background: "oklch(0.66 0.11 200)" }} />
                MSA: 16 blocks of 128 per group + index keys
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">KV stored, one sequence</div>
              <div className="font-mono text-base tabular-nums">{gb(stored, bytes)}</div>
            </div>
            <div className="rounded border px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">KV read per decoded token</div>
              <div className="font-mono text-base tabular-nums">{gb(read, bytes)}</div>
            </div>
            <div className="rounded border px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">weights read per step (measured)</div>
              <div className="font-mono text-base tabular-nums">{WEIGHT_GB.toFixed(1)} GB</div>
            </div>
          </div>

          <div className="space-y-1.5">
            {bars.map((b) => (
              <div key={b.id} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2">
                <span className={cn("font-mono", b.id === layout ? "" : "text-muted-foreground")}>{b.label}</span>
                <div className="h-3 rounded-sm bg-muted">
                  <div
                    className="h-3 rounded-sm"
                    style={{
                      width: `${((b.v / maxRead) * 100).toFixed(2)}%`,
                      background: b.id === layout ? "oklch(0.6 0.13 200)" : "oklch(0.75 0.03 200)",
                    }}
                  />
                </div>
                <span className="text-right font-mono tabular-nums">{gb(b.v, bytes)}</span>
              </div>
            ))}
          </div>

          <figcaption className="space-y-1.5 border-t pt-2.5 text-muted-foreground">
            <p>
              At {CTX_LABEL[ci]}, plain GQA reads {(readDense / readFlash).toFixed(2)}x what M3.1-Flash reads per
              decoded token, and the M3 layout reads {(readM3 / readFlash).toFixed(2)}x. Storage does not shrink:
              MSA keeps every key and value and adds an index key, so sparse attention saves reads, not memory.
            </p>
            <p>
              At batch 1 the weights cost about {WEIGHT_GB.toFixed(1)} GB per step whatever the context; attention
              here costs {attnGb.toFixed(1)} GB, and attention is the part that does not amortize across a batch.
            </p>
          </figcaption>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4 text-xs">
          <div className="space-y-1">
            <div className="font-mono text-[11px] text-muted-foreground">all {TOTAL.toFixed(2)}B parameters</div>
            <div className="flex h-5 overflow-hidden rounded-sm">
              {PARAMS.map((p) => (
                <div key={p.label} title={`${p.label}: ${p.total.toFixed(2)}B`} style={{ width: `${((p.total / TOTAL) * 100).toFixed(3)}%`, background: p.tone }} />
              ))}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              used for one text token: {ACTIVE_TEXT.toFixed(2)}B, plus {(1.23).toFixed(2)}B of LM head
            </div>
            <div className="flex h-5 overflow-hidden rounded-sm bg-muted">
              {PARAMS.filter((p) => p.active > 0).map((p) => (
                <div key={p.label} title={`${p.label}: ${p.active.toFixed(2)}B`} style={{ width: `${((p.active / TOTAL) * 100).toFixed(3)}%`, background: p.tone }} />
              ))}
            </div>
          </div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">part</th>
                <th className="py-1 text-right font-normal">stored</th>
                <th className="py-1 text-right font-normal">per token</th>
              </tr>
            </thead>
            <tbody>
              {PARAMS.map((p) => (
                <tr key={p.label} className="border-t">
                  <td className="py-1">
                    <span className="mr-1.5 inline-block h-2 w-2" style={{ background: p.tone }} />
                    {p.label}
                  </td>
                  <td className="py-1 text-right tabular-nums">{p.total.toFixed(2)}B</td>
                  <td className="py-1 text-right tabular-nums">{p.active.toFixed(2)}B</td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="border-t pt-2.5 text-muted-foreground">
            Routed experts are 96.7% of the model and 4 of 128 fire per layer, which is how 427B of storage
            becomes about 23.5B of compute. The embedding table is a lookup, not a matrix multiply, so it is
            stored but not counted per token; the LM head is counted once.
          </figcaption>
        </div>
      )}
    </figure>
  )
}
