"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a draft model actually costs you, in weights.
//
// Table 1 of the release post, plus the thing the table implies but does not say.
// The draft is ~300M parameters in all three cases because the decoder stack is
// literally the same five layers; only the Markov head changes size with the
// target's vocabulary-side geometry. Crucially the embedding and LM head are TIED
// to the target and not carried by the draft at all, which is most of why a
// speculative path for a 1.2B model can cost less than a 1.2B model.
//
// Set the ledger against each target and a mild irony falls out: the memory
// overhead is largest exactly where the payoff is largest, and smallest where the
// payoff collapses. "A minimal memory increase for a large decoding speedup" is
// true of the 8B-A1B by the first half and false by the second.
//
// Parameter counts and throughput are the post's; the overhead column is
// draft params over target params.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const PARTS = [
  { l: "decoder stack — 5 layers", v: { a: 241.2, b: 241.2, c: 241.2 }, note: "identical across all three drafts" },
  { l: "hidden-state projection", v: { a: 21.0, b: 21.0, c: 21.0 }, note: "takes the target's context features" },
  { l: "Markov head", v: { a: 33.6, b: 65.5, c: 65.5 }, note: "the sequential bias between neighbouring draft tokens" },
  { l: "norms + confidence head", v: { a: 0.0275, b: 0.0275, c: 0.0275 }, note: "predicts each draft token's acceptance probability" },
] as const

const TARGETS = [
  { key: "a" as const, label: "LFM2.5-1.2B-Instruct", params: 1200, total: 295.7, mac: 2.54, h100: 2.1 },
  { key: "c" as const, label: "LFM2.5-2.6B", params: 2600, total: 327.7, mac: 2.27, h100: 2.67 },
  { key: "b" as const, label: "LFM2.5-8B-A1B", params: 8000, total: 327.7, mac: 1.18, h100: 2.54 },
]

export function DraftBudget() {
  const [sel, setSel] = useState<"a" | "b" | "c">("b")
  const t = TARGETS.find((x) => x.key === sel) ?? TARGETS[0]
  const overhead = (t.total / t.params) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          embedding and LM head tied to the target — not carried by the draft
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          +{overhead.toFixed(1)}% weights
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TARGETS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {PARTS.map((p) => {
            const v = p.v[sel]
            return (
              <div key={p.l} className="flex items-center gap-2">
                <span className="w-44 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{p.l}</span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{ width: `${Math.max(0.5, (v / 260) * 100)}%`, background: ACCENT, opacity: 0.85 }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
                  {v >= 1 ? `${v.toFixed(1)}M` : `${(v * 1000).toFixed(1)}k`}
                </span>
                <span className="hidden w-56 shrink-0 font-mono text-[9px] text-muted-foreground lg:inline">{p.note}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">the draft</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              {t.total}M
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">against a {(t.params / 1000).toFixed(1)}B target</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">memory overhead</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: overhead > 20 ? WARM : GOOD }}>
              +{overhead.toFixed(1)}%
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">weights only, no extra KV</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what it buys</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: t.mac > 2 ? GOOD : WARM }}>
              {t.mac.toFixed(2)}× / {t.h100.toFixed(2)}×
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">M4 Max / H100, mean over five tasks</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Click through the three targets and watch the two right-hand boxes move in opposite directions. The 1.2B
          pays the <em>most</em>{" "}for its draft — nearly a quarter of its own parameter count — and gets 2.54×
          on a laptop. The 8B-A1B pays 4.1% and gets 1.18×.{" "}
          <span className="text-foreground">The cheapest draft is the one that is not worth having</span>, at least
          on that backend.
          <br />
          <br />
          The reason the drafts are this small at all is the last line of the table&rsquo;s caption: embedding and
          LM head are tied to the target rather than duplicated. A 300M draft that had to carry its own vocabulary
          projection would be most of a billion parameters, and the whole trade would look very different on an
          8 GB device.
        </p>
      </div>
    </figure>
  )
}
