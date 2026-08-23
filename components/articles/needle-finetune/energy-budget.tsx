"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The argument for 45M parameters, in the only units that matter on a battery.
//
// On device silicon, moving a byte out of flash or DRAM costs orders of magnitude
// more than a multiply-accumulate, so the budget is FLOPs per token and bytes per
// token together. Cactus's table counts 2 FLOPs per MAC over matmul-active
// parameters, with embeddings tied in every row and attention terms excluded
// because they are equal across rows at matched context.
//
// Two things in it are worth pulling out. The gap between Needle's 45M
// parameters and its 35M matmul-active ones is the engram: 8M parameters held in
// hashed n-gram tables and read by gather, costing no arithmetic at all. And a
// conventional transformer squeezed down to Needle's own parameter count still
// spends 87 MFLOPs against Needle's 70, because every parameter it owns has to be
// exercised through a matmul.
//
// FunctionGemma's 540 is mostly its head: 170M of its 270M parameters are a
// 262k-token embedding table.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Row = { l: string; params: string; active: string; mf: number; c: string; note: string }

const ROWS: Row[] = [
  {
    l: "Needle 2",
    params: "45M",
    active: "35M",
    mf: 70,
    c: GOOD,
    note: "A fifth of its parameters are gathered memory, not matmul. The Hadamard MLP replaces dense up-and-down projections with a fixed Walsh transform and learned diagonals, so channel mixing costs almost no parameters.",
  },
  {
    l: "same-shape transformer, dense MLP",
    params: "82M",
    active: "82M",
    mf: 164,
    c: MUTED,
    note: "What a conventional Transformer of Needle's width and depth would weigh. Same 27 layers, same 512 width, twice the parameters and 2.3× the arithmetic.",
  },
  {
    l: "transformer at matched params",
    params: "43M",
    active: "43M",
    mf: 87,
    c: WARM,
    note: "The control that matters. Give a conventional Transformer the same parameter count and it still spends 24% more arithmetic per token, because every parameter it owns must be exercised through a matmul.",
  },
  {
    l: "LFM2.5 230M",
    params: "230M",
    active: "230M",
    mf: 460,
    c: MUTED,
    note: "Its eight short-conv blocks hold their parameters in dense gate and projection matmuls that run every token; the depthwise kernels themselves are negligible. What short convolutions save is the context-dependent attention term, which is excluded for every row.",
  },
  {
    l: "FunctionGemma 270M",
    params: "270M",
    active: "270M",
    mf: 540,
    c: MUTED,
    note: "Dominated by the head: 170M of its 270M parameters are a 262k-token embedding table, counted once as the output projection.",
  },
  {
    l: "Apple FM",
    params: "~3B",
    active: "~3B",
    mf: 6000,
    c: MUTED,
    note: "The on-device frontier of the comparison set, and 85× Needle's per-token arithmetic.",
  },
]

export function EnergyBudget() {
  const [sel, setSel] = useState(0)
  const r = ROWS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          MFLOPs per token · 2 FLOPs per MAC over matmul-active parameters
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          7× to 85× fewer than the baselines
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {ROWS.map((x, i) => (
            <button
              key={x.l}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <span className="w-52 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.l}</span>
              <span className="w-20 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                {x.params} / {x.active}
              </span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${(x.mf / 6000) * 100}%`, background: x.c, opacity: 0.9 }} />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                {x.mf.toLocaleString()}
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                {i === 0 ? "—" : `${(x.mf / 70).toFixed(1)}×`}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-1 pl-2 font-mono text-[9px] text-muted-foreground">
          columns: total params / matmul-active params · bar and value are MFLOPs per token · last column is the
          multiple of Needle&rsquo;s
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: r.c }}>
            {r.l} · {r.params} params, {r.active} matmul-active, {r.mf.toLocaleString()} MFLOPs/token
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{r.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The row to compare against is the third one, not the last. Anyone can beat a 3B model on arithmetic by
          being sixty times smaller. Beating a{" "}
          <span className="text-foreground">conventional Transformer at the same parameter count</span>{" "}by 24%
          takes an architecture that declines to run some of its own parameters through a matmul — which is what
          the engram does: eight million parameters living in hashed n-gram tables, read a few rows at a time by
          gather, contributing capacity at zero arithmetic cost.
          <br />
          <br />
          And arithmetic is only half the bill. On device silicon, moving a byte out of flash costs orders of
          magnitude more than a multiply-accumulate, so the engine is built around never rematerializing anything:
          2-bit codes expand inside vector registers and fuse into integer dot products, so resident memory stays
          at blob size and decoding a token reads at most the 14 MB file once. On structural tokens the grammar
          matcher knows which tokens are legal before the logits exist, so up to{" "}
          <span className="text-foreground">98% of the vocabulary projection is skipped</span>{" "}— and skipped
          entirely on steps whose output is already forced.
        </p>
      </div>
    </figure>
  )
}
