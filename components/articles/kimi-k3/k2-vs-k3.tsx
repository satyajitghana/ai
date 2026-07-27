"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The K2 → K3 diff, straight from Table 1 of the tech report. Two kinds of change
// are worth separating: things that were simply scaled UP (layers, experts, active
// params) and things that were RESTRUCTURED (attention mechanism, activation,
// vision). The scaled rows get a proportional bar so the ratios are visible; the
// restructured rows are qualitative and read as before → after.

const ACCENT = "oklch(0.58 0.15 265)" // K3
const MUTED = "oklch(0.62 0.03 250)" // K2

type ScaledRow = { label: string; k2: number; k3: number; fmt: (n: number) => string; delta: string }
type SwapRow = { label: string; k2: string; k3: string }

const T = (n: number) => (n >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(0)}M` : `${n.toLocaleString()}`)
const N = (n: number) => n.toLocaleString()
const CTX = (n: number) => (n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}K`)

const SCALED: ScaledRow[] = [
  { label: "Total parameters", k2: 1.04e12, k3: 2.78e12, fmt: T, delta: "+167%" },
  { label: "Activated per token", k2: 32.6e9, k3: 104.2e9, fmt: T, delta: "+220%" },
  { label: "Layers", k2: 61, k3: 93, fmt: N, delta: "+52%" },
  { label: "Routed experts", k2: 384, k3: 896, fmt: N, delta: "+133%" },
  { label: "Experts active / token", k2: 8, k3: 16, fmt: N, delta: "+100%" },
  { label: "Shared experts", k2: 1, k3: 2, fmt: N, delta: "+100%" },
  { label: "Attention heads", k2: 64, k3: 96, fmt: N, delta: "+50%" },
  { label: "MoE hidden per expert", k2: 2048, k3: 3072, fmt: N, delta: "+50%" },
  { label: "Training context", k2: 128e3, k3: 1e6, fmt: CTX, delta: "8×" },
]

const SWAPPED: SwapRow[] = [
  { label: "Attention mechanism", k2: "MLA", k3: "Hybrid KDA–MLA" },
  { label: "Attention-layer composition", k2: "61 MLA", k3: "69 KDA + 24 MLA" },
  { label: "Activation function", k2: "SwiGLU", k3: "SiTU-GLU" },
  { label: "Latent MoE dimension", k2: "— (full width)", k3: "3584 (0.5×)" },
  { label: "Vision encoder", k2: "— (text only)", k3: "MoonViT-V2 · 401M · 27L" },
]

const UNCHANGED = "Hidden dimension 7168 · dense layers 1 · vocabulary 160K · MTP layers 1"

export function K2vsK3() {
  const [tab, setTab] = useState<"scaled" | "swapped">("scaled")

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">kimi k2 → k3 · tech report, table 1</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("scaled")} className={chip(tab === "scaled")}>
            scaled up
          </button>
          <button type="button" onClick={() => setTab("swapped")} className={chip(tab === "swapped")}>
            restructured
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MUTED }} /> Kimi K2
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} /> Kimi K3
          </span>
        </div>

        {tab === "scaled" ? (
          <div className="space-y-2.5">
            {SCALED.map((r) => {
              const max = Math.max(r.k2, r.k3)
              const w2 = (r.k2 / max) * 100
              const w3 = (r.k3 / max) * 100
              return (
                <div key={r.label} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3">
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{r.label}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 rounded-sm" style={{ width: `${w2}%`, background: MUTED, minWidth: 2 }} />
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{r.fmt(r.k2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 rounded-sm" style={{ width: `${w3}%`, background: ACCENT, minWidth: 2 }} />
                      <span className="shrink-0 font-mono text-[10px] font-medium tabular-nums text-foreground">{r.fmt(r.k3)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: ACCENT }}>
                    {r.delta}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {SWAPPED.map((r) => (
              <div key={r.label} className="grid grid-cols-1 gap-1 rounded-lg border bg-muted/15 px-3 py-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
                <div className="font-mono text-[11px] text-muted-foreground">{r.label}</div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span style={{ color: MUTED }}>{r.k2}</span>
                  <span className="text-muted-foreground/50">&rarr;</span>
                  <span className="font-medium" style={{ color: ACCENT }}>{r.k3}</span>
                </div>
              </div>
            ))}
            <div className="pt-1 font-mono text-[10px] text-muted-foreground">unchanged: {UNCHANGED}</div>
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          K3 is not just a bigger K2. The <span className="text-foreground">scaled up</span> tab shows the brute-force
          half — 2.7× the parameters, 3.2× the active compute, 2.3× the expert pool, an 8× longer training context. The{" "}
          <span className="text-foreground">restructured</span> tab is where the 2.5× efficiency actually comes from:
          swapping a pure-MLA stack for a 3:1 hybrid of KDA and Gated MLA, running routed experts in a half-width latent
          space, replacing SwiGLU with a bounded SiTU-GLU, and training vision in from the start. The hidden dimension
          never moved — K3 grew in <em>depth</em>, <em>width of the expert pool</em>, and <em>sequence</em>, not in the
          size of a token&rsquo;s representation.
        </p>
      </div>
    </figure>
  )
}
