"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What one new token costs in one Qwen4 layer group (three Gated DeltaNet
// layers and one QSA layer) against four ordinary full-attention layers, at
// context length L. Qwen has not published Qwen4-Max's widths, so the shapes
// are Qwen3.8-Flash-Next's config.json, the only released Qwen4-architecture
// checkpoint (Qwen4ExpForConditionalGeneration):
//
//   attention   24 query heads, head_dim 256, 2 KV heads
//   QSA indexer 4 heads, head_dim 128, 1 KV head, compress ratio 4, budget 2048
//   GDN         48 value heads x 128, 16 key heads x 128, fp32 state
//
// Multiply-adds per token, attention core only (projections and the MoE are
// the same in both stacks, so they are left out):
//   full attention  QK + AV                  = 2 * 24 * 256 * L     = 12,288 L
//   QSA             indexer over L/4 blocks  = 4 * 128 * L / 4      =    128 L
//                   + attention over min(L, 2048) selected tokens
//   GDN             about three passes over a 48 x 128 x 128 state = 2,359,296
// Cache per layer: full or QSA keeps K and V for every token
//   2 KV heads * 256 * 2 (K, V) * 2 bytes = 2,048 B per token, plus QSA's
//   indexer keys, 128 * 2 bytes per block of 4 tokens = 64 B per token.
//   A GDN layer keeps one state: 48 * 128 * 128 * 4 bytes = 3,145,728 B, flat.

const STEPS = [4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
const ATTN = 2 * 24 * 256
const IDX = (4 * 128) / 4
const BUDGET = 2048
const GDN_MACS = 3 * 48 * 128 * 128
const KV_B = 2 * 256 * 2 * 2
const IDX_B = (128 * 2) / 4
const GDN_STATE_B = 48 * 128 * 128 * 4

const fmtCount = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}G`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return `${v.toFixed(0)}`
}
const fmtBytes = (v: number) => {
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} GiB`
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MiB`
  return `${(v / 1024).toFixed(0)} KiB`
}
const fmtL = (l: number) => (l >= 1048576 ? "1M" : `${l / 1024}K`)

export function LayerCost() {
  const [i, setI] = useState(5)
  const [view, setView] = useState<"compute" | "memory">("compute")
  const L = STEPS[i]

  const fullMacs = 4 * ATTN * L
  const qsaIdx = IDX * L
  const qsaAttn = ATTN * Math.min(L, BUDGET)
  const gdn = 3 * GDN_MACS
  const hybMacs = qsaIdx + qsaAttn + gdn

  const fullMem = 4 * KV_B * L
  const qsaMem = (KV_B + IDX_B) * L
  const gdnMem = 3 * GDN_STATE_B
  const hybMem = qsaMem + gdnMem

  const isCompute = view === "compute"
  const a = isCompute ? fullMacs : fullMem
  const parts = isCompute
    ? [
        { label: "QSA attention over the budget", v: qsaAttn, cls: "bg-sky-500/70" },
        { label: "QSA indexer scan", v: qsaIdx, cls: "bg-amber-500/70" },
        { label: "3 x GDN state update", v: gdn, cls: "bg-emerald-500/70" },
      ]
    : [
        { label: "QSA KV cache", v: KV_B * L, cls: "bg-sky-500/70" },
        { label: "QSA indexer keys", v: IDX_B * L, cls: "bg-amber-500/70" },
        { label: "3 x GDN state", v: gdnMem, cls: "bg-emerald-500/70" },
      ]
  const b = isCompute ? hybMacs : hybMem
  const fmt = isCompute ? fmtCount : fmtBytes

  // bars on a log scale so 4K and 1M both read; 1 unit floor keeps log finite
  const lo = isCompute ? 6 : 6.5
  const hi = isCompute ? 11 : 10.2
  const w = (v: number) => `${Math.max(2, Math.min(100, ((mlog10(Math.max(v, 1)) - lo) / (hi - lo)) * 100)).toFixed(1)}%`

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-dashed border-foreground/15 text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="space-y-2 border-b px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground">
          one layer group, one new token · 3 GDN + 1 QSA against 4 full-attention layers
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={isCompute} onClick={() => setView("compute")} className={chip(isCompute)}>
            attention compute per token
          </button>
          <button type="button" aria-pressed={!isCompute} onClick={() => setView("memory")} className={chip(!isCompute)}>
            cache held for the sequence
          </button>
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length L</span>
            <span className="tabular-nums text-foreground">{fmtL(L)} tokens</span>
          </div>
          <Range
            min={0}
            max={STEPS.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="context length"
          />
        </label>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">4 x full attention</span>
              <span className="tabular-nums">{fmt(a)}{isCompute ? " MACs" : ""}</span>
            </div>
            <div className="mt-1 h-3 rounded bg-muted/40">
              <div className="h-3 rounded bg-rose-500/70" style={{ width: w(a) }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">3 x GDN + 1 x QSA</span>
              <span className="tabular-nums">{fmt(b)}{isCompute ? " MACs" : ""}</span>
            </div>
            <div className="mt-1 h-3 rounded bg-muted/40">
              <div className="h-3 rounded bg-sky-500/70" style={{ width: w(b) }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {parts.map((p) => (
            <div key={p.label} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className={cn("inline-block h-2 w-2 rounded-sm", p.cls)} />
                {p.label}
              </div>
              <div className="font-mono text-sm tabular-nums">{fmt(p.v)}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px]">
          <span className="text-muted-foreground">ratio, full over hybrid: </span>
          <span className="tabular-nums text-foreground">{(a / b).toFixed(1)}x</span>
          <span className="text-muted-foreground">
            {isCompute
              ? L > BUDGET
                ? " · past the 2,048-token budget, only the indexer term still grows with L"
                : " · below the budget QSA attends every token, so it is full attention plus a scan"
              : " · QSA selects what it reads, not what it keeps: its cache still grows with L"}
          </span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Shapes are Qwen3.8-Flash-Next&rsquo;s published config, the one open checkpoint of this architecture; Qwen has not
          published Qwen4-Max&rsquo;s widths. Projections and the MoE are identical in both stacks and are left out, so this
          is the attention core only. At 1M tokens the group does about 310x less attention arithmetic per token and
          holds about 3.9x less cache.
        </p>
      </div>
    </figure>
  )
}
