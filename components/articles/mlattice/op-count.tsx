"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// Three ways to count one μLattice layer against one attention layer, both at
// the paper's width: d_model 64, 2 heads, d_k = d_v = 32.
//   attention, causal:  token t scores t keys and mixes t values per head
//                       → 2 · T(T+1)/2 · (32 + 32) = 64·T(T+1) multiply-adds
//   PAPER.md's count:   attention 64·T² ("1.1 trillion" at 131,072),
//                       μLattice 9 · 128 · T ("151 million")
//   μLattice, like for like: per token, per head, 9 write cells × three
//                       32 × 32 passes (read-back W·κ, decay, rank-1 update)
//                       + 9 read cells × one 32 × 32 pass → 73,728 · T
// The paper's ratio is T / 18. The multiply-add ratio is about T / 1,152.

const r1 = (n: number) => Math.round(n * 10) / 10

function fmt(n: number): string {
  if (n >= 1e12) return `${r1(n / 1e12)}T`
  if (n >= 1e9) return `${r1(n / 1e9)}G`
  if (n >= 1e6) return `${r1(n / 1e6)}M`
  if (n >= 1e3) return `${r1(n / 1e3)}k`
  return `${Math.round(n)}`
}

function fmtT(n: number): string {
  if (n >= 1048576) return `${n / 1048576}M`
  if (n >= 1024) return `${n / 1024}K`
  return `${n}`
}

const LAT_MAC_PER_TOKEN = 9 * 2 * 3 * 32 * 32 + 9 * 2 * 32 * 32 // 73,728
const PAPER_LAT_PER_TOKEN = 9 * 128 // 1,152

export function OpCount() {
  const [e, setE] = useState(17)
  const T = 2 ** e

  const attn = 64 * T * (T + 1)
  const paperAttn = 64 * T * T
  const lat = LAT_MAC_PER_TOKEN * T
  const paperLat = PAPER_LAT_PER_TOKEN * T

  const rows = [
    { label: "attention, causal multiply-adds", v: attn, color: "oklch(0.6 0.17 25)" },
    { label: "μLattice, multiply-adds (9 write + 9 read cells)", v: lat, color: "oklch(0.58 0.15 265)" },
    { label: "μLattice, PAPER.md's count (9 × 128 per token)", v: paperLat, color: "oklch(0.62 0.03 260)" },
  ]
  const hi = mlog10(64 * 2 ** 40)
  const lo = mlog10(1e5)
  const width = (v: number) => r1(Math.max(1.5, ((mlog10(v) - lo) / (hi - lo)) * 100))

  const macRatio = attn / lat
  const paperRatio = paperAttn / paperLat

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one layer · d_model 64 · 2 heads · log scale</span>
        <span className="font-mono text-xs tabular-nums text-foreground">T = {fmtT(T)} tokens</span>
      </div>
      <div className="space-y-2.5 p-3 sm:p-4">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 font-mono text-[11px]">
              <span className="text-foreground">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">{fmt(r.v)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted/40">
              <div className="h-full rounded-full" style={{ width: `${width(r.v)}%`, background: r.color }} />
            </div>
          </div>
        ))}

        <div className="pt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>sequence length T</span>
            <span className="tabular-nums text-foreground">{fmtT(T)}</span>
          </div>
          <Range min={10} max={20} step={1} value={e} onChange={(ev) => setE(+ev.target.value)} className="w-full" aria-label="sequence length" />
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
          <dt className="text-muted-foreground">PAPER.md&rsquo;s ratio (T / 18)</dt>
          <dd className="tabular-nums">{paperRatio >= 10 ? Math.round(paperRatio).toLocaleString("en-US") : r1(paperRatio)}×</dd>
          <dt className="text-muted-foreground">multiply-add ratio</dt>
          <dd className={`tabular-nums ${macRatio < 1 ? "text-red-600 dark:text-red-400" : ""}`}>
            {macRatio >= 10 ? Math.round(macRatio).toLocaleString("en-US") : r1(macRatio)}×{" "}
            {macRatio < 1 ? "· attention does less work here" : ""}
          </dd>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-sm leading-6 text-muted-foreground">
        Both lines are straight on a log axis but with different slopes: attention&rsquo;s total grows as T², the
        lattice&rsquo;s as T. Where they cross depends on what you count. Counting every 32 × 32 matrix the lattice
        reads and writes puts the break-even near 1,152 tokens, and the gap at 131,072 tokens at about 114×, not 7,280×.
        Neither count is wall-clock: the measured table in PAPER.md has attention faster at every length it ran.
      </figcaption>
    </figure>
  )
}
