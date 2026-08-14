"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog, mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Does "runs in 24 GB" actually add up? Every input here is measured rather
// than quoted: artifact sizes come from the Hugging Face file tree, and the KV
// cache is computed from config.json.
//
//   KV bytes / token / layer = 2 (K,V) x 2 kv_heads x 128 head_dim x 2 (bf16)
//                            = 1024
//
// 13 of the 52 layers are global and hold the whole context; the other 39 are
// capped at a 2048-token sliding window. Toggle either architectural choice off
// and watch the headline claim fail.

const W = 16.757 // muse-glimmer-30B-kquant-17gb.gguf
const DRAFT = 1.631 // dflash-kquant.gguf
const VIS = 1.4 // mmproj-kquant.gguf

const PER = 1024 // KV bytes per token per layer, as shipped
const LAYERS = 52
const GLOBAL = 13
const WINDOW = 2048
const ENVELOPE = 24

const OK = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.58 0.19 25)"
const MUT = "oklch(0.62 0.03 250)"
const WARM = "oklch(0.68 0.13 85)"

export function MemoryBudget() {
  const [logCtx, setLogCtx] = useState(mlog(131072))
  const [sliding, setSliding] = useState(true)
  const [gqa, setGqa] = useState(true)

  const ctx = Math.round(mexp(logCtx))
  const per = gqa ? PER : PER * 16 // 2 KV heads -> 32 (plain MHA)
  const kv =
    ((sliding ? GLOBAL * ctx + (LAYERS - GLOBAL) * Math.min(ctx, WINDOW) : LAYERS * ctx) * per) / 1e9

  const parts = [
    { name: "weights · 4-bit k-quant", gb: W, color: OK },
    { name: "DFlash drafter", gb: DRAFT, color: WARM },
    { name: "vision encoder", gb: VIS, color: MUT },
    { name: "KV cache", gb: kv, color: kv > 4 ? BAD : "oklch(0.55 0.16 300)" },
  ]
  const total = parts.reduce((a, p) => a + p.gb, 0)
  const fits = total <= ENVELOPE
  const scale = Math.max(total, ENVELOPE) * 1.04

  // spelled out rather than binned to "128K", so it can't be confused with the
  // decimal 131K the announcement quotes for the same number
  const fmtCtx = (n: number) => n.toLocaleString()

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">does 24 GB actually add up?</span>
        <span className="font-mono text-[10px]" style={{ color: fits ? OK : BAD }}>
          {total.toFixed(2)} GB · {fits ? `${(ENVELOPE - total).toFixed(2)} GB headroom` : `${(total - ENVELOPE).toFixed(2)} GB over`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="relative h-12 overflow-hidden rounded-lg border bg-muted/25">
          {parts.map((p, i) => {
            const before = parts.slice(0, i).reduce((a, q) => a + q.gb, 0)
            return (
              <div
                key={p.name}
                title={`${p.name}: ${p.gb.toFixed(2)} GB`}
                className="absolute inset-y-0"
                style={{
                  left: `${(before / scale) * 100}%`,
                  width: `${(p.gb / scale) * 100}%`,
                  background: p.color,
                }}
              />
            )
          })}
          {/* the 24 GB wall */}
          <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(ENVELOPE / scale) * 100}%` }} />
          <span
            className="absolute top-1 font-mono text-[9px] text-foreground"
            style={{ left: `calc(${(ENVELOPE / scale) * 100}% + 4px)` }}
          >
            24 GB
          </span>
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {parts.map((p) => (
            <div key={p.name} className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </div>
              <div className="font-mono text-sm tabular-nums text-foreground">{p.gb.toFixed(2)} GB</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">context</span>
          <Range
            min={mlog(2048)}
            max={mlog(131072)}
            step={0.01}
            value={logCtx}
            onChange={(e) => setLogCtx(Number(e.target.value))}
            className="min-w-[10rem] flex-1"
            aria-label="context length in tokens, log scale"
            accent={OK}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{fmtCtx(ctx)} tokens</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { on: sliding, set: setSliding, label: "3:1 sliding window", off: "all 52 layers global" },
            { on: gqa, set: setGqa, label: "GQA 32:2", off: "plain MHA (32 KV heads)" },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => t.set(!t.on)}
              aria-pressed={t.on}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                t.on ? "border-transparent text-white" : "border-border text-muted-foreground",
              )}
              style={t.on ? { background: OK } : undefined}
            >
              {t.on ? t.label : t.off}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          As shipped, at the full 131K context, the whole system lands at{" "}
          <span className="text-foreground">21.6 GB</span>{" "}— inside a 24 GB card with 2.4 GB to spare. Now turn off
          the sliding-window pattern. The KV cache goes from 1.83 GB to{" "}
          <span className="text-foreground">6.98 GB</span>, the total becomes 26.8 GB, and the headline claim
          fails. That is the point worth taking away: the 3-local-1-global stack is not a nicety bolted onto a
          model that already fit, it is the reason it fits. Turn off GQA as well and the KV cache alone is 112 GB,
          which is roughly the distance between designing for a datacenter and designing for a laptop.
        </p>
      </div>
    </figure>
  )
}
