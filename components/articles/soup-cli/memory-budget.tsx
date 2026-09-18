"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the 3.32-3.6 GB peak actually goes, decomposed by Soup's own peak-VRAM formula
// (estimate_stream_peak_vram): pool + extras + adapter-optimizer + slack + activations +
// logits. Streamed, the "pool" term is 2 buffers (225 MB) and the total lands just under
// the 4 GB card. Toggle "resident" and the ONLY thing that changes is that same pool term
// swapped for all 32 layers held at once (3.60 GB) — same formula, same everything else —
// which alone pushes the total to ~6.9 GB. That one swap is the entire reason streaming,
// not just NF4 quantisation, is what makes the 4 GB card work: the logits tensor and the
// resident embed/head matrix already account for most of the budget either way.

type Seg = { key: string; label: string; mb: number; color: string }

const EXTRAS = 2100
const ADAPTER = 109
const SLACK = 13.5
const ACT = 172
const LOGITS = 922
const CARD_MB = 4000

const POOL_STREAMED = 225 // 2 x 112.5 MB buffers
const POOL_RESIDENT = 3600 // 32 x 112.5 MB, every NF4 layer resident at once

const COLOR = {
  pool: "oklch(0.62 0.15 250)",
  extras: "oklch(0.74 0.14 70)",
  adapter: "oklch(0.64 0.13 155)",
  activation: "oklch(0.62 0.14 300)",
  logits: "oklch(0.62 0.2 25)",
  slack: "var(--muted-foreground)",
}

function segments(streamed: boolean): Seg[] {
  return [
    { key: "pool", label: streamed ? "pool · 2 buffers" : "pool · 32 layers resident", mb: streamed ? POOL_STREAMED : POOL_RESIDENT, color: COLOR.pool },
    { key: "extras", label: "extras · untied embed + head (bf16)", mb: EXTRAS, color: COLOR.extras },
    { key: "adapter", label: "LoRA + optimizer state", mb: ADAPTER, color: COLOR.adapter },
    { key: "activation", label: "activations (checkpointed)", mb: ACT, color: COLOR.activation },
    { key: "logits", label: "logits (14 × vocab × seq)", mb: LOGITS, color: COLOR.logits },
    { key: "slack", label: "fixed slack", mb: SLACK, color: COLOR.slack },
  ]
}

export function MemoryBudget() {
  const [streamed, setStreamed] = useState(true)
  const segs = segments(streamed)
  const total = segs.reduce((s, x) => s + x.mb, 0)
  const scaleMax = Math.max(POOL_RESIDENT + EXTRAS + ADAPTER + ACT + LOGITS + SLACK, CARD_MB) * 1.06

  const W = 720
  const barX = 16
  const barW = W - 32
  const barY = 34
  const barH = 40
  const px = (mb: number) => (mb / scaleMax) * barW
  const cardX = barX + px(CARD_MB)

  let acc = 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">peak-VRAM budget · Llama-3.1-8B NF4, LoRA, batch 1, seq 512</span>
        <div className="flex gap-1">
          {[
            { v: true, label: "streamed" },
            { v: false, label: "resident (hypothetical)" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setStreamed(o.v)}
              aria-pressed={streamed === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                streamed === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} 118`} className="w-full" role="img" aria-label={`${streamed ? "Streamed" : "Hypothetical all-layers-resident"} peak VRAM breakdown totalling ${(total / 1000).toFixed(2)} GB against a 4.00 GB card, decomposed into pool, extras, adapter and optimizer state, activations, logits, and fixed slack.`}>
          <rect x={barX} y={barY} width={barW} height={barH} rx={8} fill="var(--muted)" opacity={0.25} />
          {segs.map((s) => {
            const x = barX + px(acc)
            const w = Math.max(px(s.mb), 1)
            acc += s.mb
            return <rect key={s.key} x={x} y={barY} width={w} height={barH} fill={s.color} opacity={0.92} className="transition-all duration-300" />
          })}
          <rect x={barX} y={barY} width={barW} height={barH} rx={8} fill="none" stroke="var(--border)" strokeWidth={1} />

          {/* 4 GB card line */}
          <line x1={cardX} y1={barY - 10} x2={cardX} y2={barY + barH + 10} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={cardX} y={barY - 14} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>4.00 GB card</text>

          {/* total readout */}
          <text x={barX} y={barY + barH + 28} className="font-mono" fill={total > CARD_MB ? COLOR.logits : "var(--foreground)"} fontSize={13} fontWeight={600}>
            {(total / 1000).toFixed(2)} GB
          </text>
          <text x={barX + 78} y={barY + barH + 28} className="fill-muted-foreground font-mono" fontSize={10}>
            {total > CARD_MB ? `overshoots the card by ${((total - CARD_MB) / 1000).toFixed(2)} GB` : `measured peak on the card: 3.32 GB`}
          </text>
        </svg>

        {/* legend */}
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10.5px] text-muted-foreground sm:grid-cols-3">
          {segs.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate">{s.label} · {s.mb >= 1000 ? `${(s.mb / 1000).toFixed(2)} GB` : `${s.mb} MB`}</span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {streamed ? (
            <>
              The pool — the two buffers layer streaming actually adds — is{" "}
              <span className="text-foreground">225 MB</span>, the smallest slice of the budget. Most of the 4 GB
              is spent on the untied embedding/head matrix sitting fully resident in bf16 and the logits tensor,
              neither of which layer streaming touches.
            </>
          ) : (
            <>
              Swap only the pool term — every NF4 layer resident at once instead of two buffers — and the same
              formula that predicts 3.54 GB streamed predicts <span className="text-foreground">6.92 GB</span>{" "}
              resident: comfortably over the card. This is arithmetic from Soup&rsquo;s own{" "}
              <code>estimate_stream_peak_vram</code>, not a benchmarked run — the project never measured a clean
              resident 8B baseline on this card (see below).
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
