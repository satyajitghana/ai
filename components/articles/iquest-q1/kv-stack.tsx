"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The KV-cache calculator for IQuest-Q1, built straight from config.json.
//
// The layer plan is three lists in the config, laid end to end:
//   first_layers_types        = ["full_attention"]                          -> 1
//   hybrid_layers_types_block = ["full","sliding","sliding","sliding"] x 21  -> 84
//   last_layers_types         = ["full","full","full"]                      -> 3
// That is 88 layers. The "full" entries — one at the front, one at the head of
// each of the 21 blocks, three at the back — number 1 + 21 + 3 = 25. Only those
// 25 keep an attention cache that grows with the context; the other 63 are
// sliding-window layers whose cache is capped at `sliding_window` = 4096 tokens.
// Layer 0 is also `mlp_only` (a dense FFN instead of the mixture of experts),
// but it is a full-attention layer, so it counts among the 25 that grow.
//
// KV bytes per token per layer, from the config's grouped-query shape:
//   2 (K and V) x num_key_value_heads(8) x head_dim(128) x 2 bytes (bf16)
//   = 4096 bytes = 4 KiB.
// Nothing here is Math.* — only +, -, *, /, min and round reach the DOM, so the
// server and client serialize the same digits.

const LAYERS = 88
const FULL_KEEP = 25
const SWA_KEEP = LAYERS - FULL_KEEP // 63
const WINDOW = 4096
const KIB_PER_TOK = 4 // 2 * 8 * 128 * 2 bytes = 4096 B = 4 KiB

type Kind = "dense" | "full" | "swa"

// Reproduces first(1) + [full,swa,swa,swa] x 21 + last(3).
function kindOf(i: number): Kind {
  if (i === 0) return "dense"
  if (i >= 85) return "full"
  return (i - 1) % 4 === 0 ? "full" : "swa"
}

const KINDS: Kind[] = Array.from({ length: LAYERS }, (_, i) => kindOf(i))

const STEPS = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288]
const LABELS = ["1K", "2K", "4K", "8K", "16K", "32K", "64K", "128K", "256K", "512K"]

const ACCENT = "oklch(0.58 0.17 255)" // full / dense — grows with context
const WIN = "oklch(0.70 0.04 255)" // windowed — fixed cache
const GOOD = "oklch(0.55 0.15 155)"

// KiB -> GiB string. Pure division + fixed-point formatting, no Math.*.
function gib(kib: number): string {
  const v = kib / (1024 * 1024)
  return v >= 10 ? v.toFixed(0) : v.toFixed(1)
}

export function KvStack() {
  const [idx, setIdx] = useState(9) // default 512K, the model's headline context
  const L = STEPS[idx]
  const windowed = L < WINDOW ? L : WINDOW

  // Per-token KV footprint across the whole stack (KiB).
  const fullKib = FULL_KEEP * L * KIB_PER_TOK
  const swaKib = SWA_KEEP * windowed * KIB_PER_TOK
  const hybridKib = fullKib + swaKib
  const denseKib = LAYERS * L * KIB_PER_TOK // a plain all-full stack, same heads

  const ratio = denseKib / hybridKib
  const hybridPct = (hybridKib / denseKib) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          88 layers · GQA 8 KV heads × 128 · bf16 · window 4,096
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {FULL_KEEP} of {LAYERS} layers grow a cache
        </span>
      </div>

      <div className="p-3 sm:p-4">
        {/* the 88-layer stack */}
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: "repeat(22, minmax(0, 1fr))" }}
          aria-hidden
        >
          {KINDS.map((k, i) => (
            <div
              key={i}
              title={`layer ${i}: ${k === "swa" ? "sliding window" : "full attention"}${k === "dense" ? " · dense FFN" : ""}`}
              className="aspect-square rounded-[2px]"
              style={{ background: k === "swa" ? WIN : ACCENT }}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[2px]" style={{ background: ACCENT }} />
            {FULL_KEEP} full attention — cache grows with context
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[2px]" style={{ background: WIN }} />
            {SWA_KEEP} sliding window — cache fixed at 4,096 tokens
          </span>
        </div>

        {/* context slider */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="iq-ctx" className="font-mono text-xs text-muted-foreground">
              context length
            </label>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {LABELS[idx]} tokens
            </span>
          </div>
          <Range
            id="iq-ctx"
            min={0}
            max={STEPS.length - 1}
            step={1}
            value={idx}
            accent={ACCENT}
            onChange={(e) => setIdx(Number(e.currentTarget.value))}
            className="mt-2 w-full"
            aria-label="context length"
          />
        </div>

        {/* memory bars */}
        <div className="mt-5 space-y-3">
          <Bar
            label="IQuest-Q1 hybrid"
            value={`${gib(hybridKib)} GiB`}
            pct={hybridPct}
            color={ACCENT}
          />
          <Bar
            label="all-88-full baseline"
            value={`${gib(denseKib)} GiB`}
            pct={100}
            color={WIN}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <Stat k="25 full layers" v={`${gib(fullKib)} GiB`} />
          <Stat k="63 windowed" v={`${gib(swaKib)} GiB`} />
          <Stat k="cache saving" v={`${ratio.toFixed(2)}×`} hi />
        </div>

        <p className="mt-4 font-mono text-[11px] leading-5 text-muted-foreground">
          Below the 4,096-token window every layer still holds the whole context, so there is no
          saving. Past it, the 63 windowed layers stop growing while the 25 full layers keep
          climbing — the ratio walks toward its ceiling of {LAYERS}/{FULL_KEEP} ={" "}
          {(LAYERS / FULL_KEEP).toFixed(2)}×.
        </p>
      </div>
    </figure>
  )
}

function Bar({
  label,
  value,
  pct,
  color,
}: {
  label: string
  value: string
  pct: number
  color: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct < 1.5 ? 1.5 : pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function Stat({ k, v, hi }: { k: string; v: string; hi?: boolean }) {
  return (
    <div className={cn("rounded-md border px-2.5 py-2", hi && "bg-muted/30")}>
      <div className="text-muted-foreground">{k}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", hi && "text-foreground")}>
        {v}
      </div>
    </div>
  )
}
