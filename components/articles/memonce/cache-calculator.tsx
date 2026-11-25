"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Bytes held for history at a given context length, Qwen3.5-4B with and without MemOnce.
// Every constant is from a released file:
//   - Qwen/Qwen3.5-4B config.json: 32 layers, full_attention every 4th (8 attention layers),
//     4 KV heads x head_dim 256 = 1,024 per K and per V, hidden 2,560. bf16 = 2 bytes.
//   - ClareNie/MemOnce config.json: num_memory_tokens 64, short_state_tokens 1024 (16 blocks),
//     retrieve_blocks 64, target_len 4096 (a turn longer than this is split).
//   - post-training/model.py: one 64-token block of final-layer states per turn
//     (_generate_memory_blocks), _build_memory_cache decodes [retrieved | short] into K and V for
//     each full_attention layer only.
// What is approximate: the full-context line counts only the 8 attention layers' KV (the 24
// Gated DeltaNet layers add a fixed state of tens of MB); a "turn" is a uniform size here.

const ATT_LAYERS = 8
const KV_DIM = 1024 // per K or V, per token, per attention layer
const HID = 2560
const B = 2 // bf16
const BLOCK = 64
const SHORT_BLOCKS = 16
const MAX_TURN = 4096

const CTX = [32, 64, 128, 256, 512, 1024] // in K tokens
const TURNS = [128, 256, 512, 1024, 2048, 4096]

function fmt(bytes: number): string {
  const mib = bytes / 1048576
  if (mib >= 1024) return `${(mib / 1024).toFixed(2)} GiB`
  if (mib >= 10) return `${mib.toFixed(0)} MiB`
  return `${mib.toFixed(1)} MiB`
}

function ratio(a: number, b: number): string {
  const r = a / b
  return r >= 100 ? `${Math.round(r).toLocaleString("en-US")}×` : `${r.toFixed(1)}×`
}

export function CacheCalculator() {
  const [ci, setCi] = useState(5)
  const [ti, setTi] = useState(2)
  const [k, setK] = useState(64)

  const n = CTX[ci] * 1024
  const turn = Math.min(TURNS[ti], MAX_TURN)
  const blocks = Math.ceil(n / turn)
  const full = ATT_LAYERS * n * 2 * KV_DIM * B
  const pool = blocks * BLOCK * HID * B
  const shortB = Math.min(blocks, SHORT_BLOCKS)
  const retrieved = Math.min(k, Math.max(0, blocks - SHORT_BLOCKS))
  const activeTok = (retrieved + shortB) * BLOCK
  const active = activeTok * HID * B
  const decoded = ATT_LAYERS * activeTok * 2 * KV_DIM * B

  const rows = [
    { label: "Full KV cache, 8 attention layers", bytes: full, tone: "bg-slate-500/70", where: "GPU" },
    { label: "MemOnce pool: one 64-token block per turn", bytes: pool, tone: "bg-amber-500/70", where: "CPU or SSD" },
    { label: "Active states: top-K blocks + short window", bytes: active, tone: "bg-emerald-500/80", where: "GPU" },
    { label: "Those states decoded to K and V, 8 layers", bytes: decoded, tone: "bg-sky-500/80", where: "GPU, per query" },
  ]
  const max = full

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">What MemOnce keeps, against Qwen3.5-4B&apos;s full KV cache</figcaption>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-muted-foreground">
            History: <span className="font-mono text-foreground">{CTX[ci] >= 1024 ? "1M" : `${CTX[ci]}K`} tokens</span>
          </span>
          <Range min={0} max={CTX.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} className="w-full" aria-label="Context length" />
        </label>
        <label className="block">
          <span className="text-muted-foreground">
            Tokens per turn: <span className="font-mono text-foreground">{turn}</span>
          </span>
          <Range min={0} max={TURNS.length - 1} step={1} value={ti} onChange={(e) => setTi(Number(e.target.value))} className="w-full" aria-label="Tokens per turn" />
        </label>
        <label className="block">
          <span className="text-muted-foreground">
            Retrieved blocks K: <span className="font-mono text-foreground">{k}</span>
          </span>
          <Range min={0} max={128} step={16} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full" aria-label="Retrieved blocks" />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((r) => {
          const pct = Math.max(0.4, (r.bytes / max) * 100)
          return (
            <div key={r.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[15rem_1fr_6rem] sm:items-center sm:gap-2">
              <span className="text-xs">
                {r.label} <span className="text-muted-foreground">({r.where})</span>
              </span>
              <div className="relative h-4 rounded bg-muted">
                <div className={cn("h-4 rounded", r.tone)} style={{ width: `${pct.toFixed(2)}%` }} />
              </div>
              <span className="font-mono text-xs sm:text-right">{fmt(r.bytes)}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded bg-muted px-2 py-1.5">
          <div className="text-xs text-muted-foreground">full KV ÷ active states</div>
          <div className="font-mono">{ratio(full, active)}</div>
        </div>
        <div className="rounded bg-muted px-2 py-1.5">
          <div className="text-xs text-muted-foreground">full KV ÷ decoded KV</div>
          <div className="font-mono">{ratio(full, decoded)}</div>
        </div>
        <div className="rounded bg-muted px-2 py-1.5">
          <div className="text-xs text-muted-foreground">full KV ÷ whole pool</div>
          <div className="font-mono">{ratio(full, pool)}</div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {blocks.toLocaleString("en-US")} blocks written; {retrieved} retrieved + {shortB} in the short window ={" "}
        {activeTok.toLocaleString("en-US")} memory tokens in front of the question. Shapes from the two released config files;
        the full-KV line leaves out the Gated DeltaNet layers&apos; fixed state.
      </p>
    </figure>
  )
}
