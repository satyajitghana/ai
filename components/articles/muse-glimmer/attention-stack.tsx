"use client"

import Link from "next/link"
import { useState } from "react"

import { cn } from "@/lib/utils"

// The 52-layer stack, read straight out of config.json. Two arrays in that file
// line up exactly:
//
//   layer_types      L L L G L L L G ...  (39 sliding, 13 full)
//   layer_rope_theta R R R 0 R R R 0 ...  (500000 on local, 0 on global)
//
// Every global layer has rope_theta = 0 and no local layer does — zero
// mismatches across all 52. So the card's "RoPE (theta = 500,000), local layers
// only" is not a summary, it is per-layer fact, and the global layers run NoPE.

const LOCAL = "oklch(0.62 0.03 250)"
const GLOB = "oklch(0.60 0.15 255)"

const LAYERS = Array.from({ length: 52 }, (_, i) => ({
  i,
  global: (i + 1) % 4 === 0,
}))

type View = "attention" | "rope"

export function AttentionStack() {
  const [view, setView] = useState<View>("attention")
  const [sel, setSel] = useState(3)

  const layer = LAYERS[sel]

  const chip = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">52 layers · config.json</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setView("attention")} className={chip(view === "attention")}>
            layer_types
          </button>
          <button type="button" onClick={() => setView("rope")} className={chip(view === "rope")}>
            layer_rope_theta
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1">
          {LAYERS.map((l) => {
            const on = l.i === sel
            const lit = view === "attention" ? l.global : !l.global
            return (
              <button
                key={l.i}
                type="button"
                onClick={() => setSel(l.i)}
                aria-pressed={on}
                title={`layer ${l.i} · ${l.global ? "global, NoPE" : "sliding 2048, RoPE 500k"}`}
                className={cn(
                  "h-8 w-[calc(100%/14-0.25rem)] cursor-pointer rounded-sm border font-mono text-[9px] transition-all sm:w-[calc(100%/18-0.25rem)] lg:w-[calc(100%/27-0.25rem)]",
                  on ? "ring-2 ring-foreground/40" : "",
                )}
                style={{
                  background: lit ? (view === "attention" ? GLOB : LOCAL) : "transparent",
                  borderColor: lit ? "transparent" : "var(--border)",
                  color: lit ? "white" : "var(--muted-foreground)",
                }}
              >
                {view === "attention" ? (l.global ? "G" : "L") : l.global ? "0" : "R"}
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              layer {layer.i}
            </div>
            <div className="mt-1 font-mono text-sm" style={{ color: layer.global ? GLOB : LOCAL }}>
              {layer.global ? "full_attention" : "sliding_attention"}
            </div>
            <div className="font-mono text-[10px] leading-4 text-muted-foreground">
              {layer.global
                ? "sees the entire context · rope_theta = 0 (NoPE)"
                : "sees the last 2048 tokens · rope_theta = 500,000"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">the whole stack</div>
            <div className="mt-1 font-mono text-sm text-foreground">39 sliding · 13 global</div>
            <div className="font-mono text-[10px] leading-4 text-muted-foreground">
              globals at 3, 7, 11 … 51 · rope_theta = 0 on exactly those 13
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two arrays in <span className="font-mono text-foreground">config.json</span>{" "}line up perfectly, and the
          coincidence is the design. <span className="font-mono text-foreground">layer_types</span>{" "}gives{" "}
          <em>L L L G</em>{" "}thirteen times over; <span className="font-mono text-foreground">layer_rope_theta</span>{" "}
          is 500,000 on every local layer and <span className="text-foreground">exactly 0</span>{" "}on every global one
          — I checked all 52 and there are no exceptions. So the layers that see the whole context carry no
          positional encoding at all, and order information reaches them only through what the sliding layers below
          already encoded. That is the same NoPE-on-global-attention arrangement in{" "}
          <Link href="/articles/kimi-k3" className="underline underline-offset-2">Kimi K3</Link>{" "}and{" "}
          <Link href="/articles/maple-preview" className="underline underline-offset-2">Maple-Preview</Link>, arrived at
          independently by three labs in the same year, and the usual argument for it is length extrapolation:
          a layer with no notion of absolute distance has nothing to be surprised by when the context grows.
        </p>
      </div>
    </figure>
  )
}
