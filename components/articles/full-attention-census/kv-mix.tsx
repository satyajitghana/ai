"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"
import { cn } from "@/lib/utils"

// What a sequence costs in attention memory, by layer mix, for four real configs. Every width is
// read from the model's config.json:
//   Qwen3.8-27B    16 full layers, 4 KV heads x 256 (K and V): 2,048 values per token per layer.
//                  48 Gated DeltaNet layers, 48 value heads x 128 x 128 state: 786,432 values each.
//   Gemma 4 31B    10 global layers, 4 KV heads x 512 with K = V stored once: 2,048 values.
//                  50 sliding layers, 16 KV heads x 256 (K and V): 8,192 values, window 1,024.
//   Kimi K3        24 MLA layers, latent 512 + rope 64: 576 values.
//                  69 KDA layers, 96 heads x 128 x 128 state: 1,572,864 values each.
//   MiniMax M3.1   60 MSA layers, 4 KV heads x 128 (K and V): 1,024 values, plus one 128-value
//     Flash        index key; a decode step reads 2,048 tokens of KV plus every index key.
// "Every layer full" keeps each layer's own widths and drops the window, the state and the
// indexer. KV is BF16 or FP8; recurrent state is FP32, as Qwen's config asks (mamba_ssm_dtype),
// and assumed FP32 for KDA too. Arithmetic is + - * / and min only.

type Kind = "full" | "window" | "state" | "sparse"
type Group = { kind: Kind; layers: number; kv: number; window?: number; state?: number; index?: number; topk?: number }
type Preset = { id: string; label: string; groups: Group[] }

const PRESETS: Preset[] = [
  {
    id: "qwen",
    label: "Qwen3.8-27B",
    groups: [
      { kind: "full", layers: 16, kv: 2048 },
      { kind: "state", layers: 48, kv: 2048, state: 786432 },
    ],
  },
  {
    id: "gemma",
    label: "Gemma 4 31B",
    groups: [
      { kind: "full", layers: 10, kv: 2048 },
      { kind: "window", layers: 50, kv: 8192, window: 1024 },
    ],
  },
  {
    id: "kimi",
    label: "Kimi K3",
    groups: [
      { kind: "full", layers: 24, kv: 576 },
      { kind: "state", layers: 69, kv: 576, state: 1572864 },
    ],
  },
  {
    id: "minimax",
    label: "MiniMax M3.1 Flash",
    groups: [{ kind: "sparse", layers: 60, kv: 1024, index: 128, topk: 2048 }],
  },
]

const CTX = [4096, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
const CTX_LABEL = ["4K", "16K", "32K", "64K", "128K", "256K", "512K", "1M"]

const KIND: Record<Kind, { label: string; tone: string }> = {
  full: { label: "full attention KV", tone: "oklch(0.6 0.17 30)" },
  window: { label: "window KV", tone: "oklch(0.72 0.1 230)" },
  state: { label: "recurrent state", tone: "oklch(0.68 0.12 155)" },
  sparse: { label: "sparse layers: KV + index keys", tone: "oklch(0.55 0.16 300)" },
}

const STATE_BYTES = 4

// bytes kept for one sequence at context n, and bytes read for one decoded token
function cost(g: Group, n: number, kvBytes: number, allFull: boolean): { kept: number; read: number } {
  if (allFull || g.kind === "full") {
    const b = g.layers * g.kv * n * kvBytes
    return { kept: b, read: b }
  }
  if (g.kind === "window") {
    const b = g.layers * g.kv * Math.min(n, g.window ?? n) * kvBytes
    return { kept: b, read: b }
  }
  if (g.kind === "state") {
    const b = g.layers * (g.state ?? 0) * STATE_BYTES
    return { kept: b, read: b }
  }
  const idx = g.index ?? 0
  const kept = g.layers * (g.kv + idx) * n * kvBytes
  const read = g.layers * (g.kv * Math.min(n, g.topk ?? n) + idx * n) * kvBytes
  return { kept, read }
}

function fmt(b: number): string {
  const g = b / 1e9
  if (g >= 100) return `${g.toFixed(0)} GB`
  if (g >= 10) return `${g.toFixed(1)} GB`
  if (g >= 1) return `${g.toFixed(2)} GB`
  const m = b / 1e6
  if (m >= 10) return `${m.toFixed(0)} MB`
  return `${m.toFixed(1)} MB`
}

export function KvMix() {
  const [pi, setPi] = useState(0)
  const [ci, setCi] = useState(5)
  const [kvBytes, setKvBytes] = useState<1 | 2>(2)
  const preset = PRESETS[pi]
  const n = CTX[ci]

  const parts = preset.groups.map((g) => ({ g, ...cost(g, n, kvBytes, false) }))
  const kept = parts.reduce((s, p) => s + p.kept, 0)
  const read = parts.reduce((s, p) => s + p.read, 0)
  const fullParts = preset.groups.map((g) => cost(g, n, kvBytes, true))
  const keptFull = fullParts.reduce((s, p) => s + p.kept, 0)
  const readFull = fullParts.reduce((s, p) => s + p.read, 0)
  const max = Math.max(keptFull, readFull, kept, read, 1)

  const bar = (label: string, total: number, segs: { tone: string; v: number; key: string }[]) => (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{fmt(total)}</span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-sm bg-muted">
        {segs.map((s) => (
          <span key={s.key} style={{ width: `${(100 * s.v) / max}%`, background: s.tone }} />
        ))}
      </div>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        attention memory for one sequence · widths from each config.json · arithmetic, not a measurement
      </div>
      <div className="space-y-2 border-b px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Model" onKeyDown={tablistKeys()}>
          <span className="w-20 shrink-0 font-mono text-muted-foreground">model</span>
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pi === i}
              tabIndex={pi === i ? 0 : -1}
              onClick={() => setPi(i)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                pi === i ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 font-mono text-muted-foreground">context</span>
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
          <span className="w-20 shrink-0 font-mono text-muted-foreground">KV dtype</span>
          {([2, 1] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={kvBytes === b}
              onClick={() => setKvBytes(b)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                kvBytes === b ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {b === 2 ? "BF16" : "FP8"}
            </button>
          ))}
          <span className="font-mono text-[11px] text-muted-foreground">state stays FP32</span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 text-xs">
        {bar(
          `kept: ${preset.label} as shipped`,
          kept,
          parts.map((p) => ({ key: p.g.kind, tone: KIND[p.g.kind].tone, v: p.kept }))
        )}
        {bar("kept: same layers, every one full", keptFull, [{ key: "f", tone: KIND.full.tone, v: keptFull }])}
        {bar(
          "read per decoded token: as shipped",
          read,
          parts.map((p) => ({ key: p.g.kind, tone: KIND[p.g.kind].tone, v: p.read }))
        )}
        {bar("read per decoded token: every layer full", readFull, [{ key: "f", tone: KIND.full.tone, v: readFull }])}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          {preset.groups.map((g) => (
            <span key={g.kind} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KIND[g.kind].tone }} />
              {g.layers} layers, {KIND[g.kind].label}
            </span>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          kept is {kept > 0 ? (keptFull / kept).toFixed(1) : "0"}x smaller than all-full; read is{" "}
          {read > 0 ? (readFull / read).toFixed(1) : "0"}x smaller.
        </p>
      </div>
    </figure>
  )
}
