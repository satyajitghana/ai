"use client"

import { useState } from "react"

import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { DEEP } from "./deep-data"

// MEASURED (e1.py): per-step rotation errors are AR(1) with the same marginal spread (0.05 degrees per axis) and
// a correlation rho that changes. For each rho: the adjacent-pair rotation loss, the rotation term of the paper's
// composition-aware loss (Eqs 12-14, K = 12, 128-frame clips, gamma = 0.5) and the Sim(3)-aligned ATE on a
// 4,661-frame drive. Six seeds. The alpha panel is Eq 13 evaluated in the browser (arithmetic, not a measurement).

const TABS = [
  { id: "rho", label: "Measured: correlated errors" },
  { id: "alpha", label: "Eq 13: weight per gap" },
] as const
type TabId = (typeof TABS)[number]["id"]

const K = 12

function alphaTable(N: number, gamma: number) {
  // every pair (i, j) with 0 <= i < j < N and j - i <= K - 1, weight (j - i)^gamma normalised to mean 1
  const counts: number[] = []
  let sum = 0
  let n = 0
  for (let g = 1; g < K; g++) {
    const c = N - g
    counts.push(c)
    sum += c * mpow(g, gamma)
    n += c
  }
  const mean = sum / n
  return counts.map((c, idx) => {
    const g = idx + 1
    const a = mpow(g, gamma) / mean
    return { gap: g, pairs: c, alpha: a, share: (c * a) / n }
  })
}

export function CompositionLens() {
  const [tab, setTab] = useState<TabId>("rho")
  const rows = DEEP.e1.rows
  const [sel, setSel] = useState(1)
  const [gamma, setGamma] = useState(0.5)
  const [clip, setClip] = useState(128)
  const r = rows[sel]
  const maxLoss = Math.max(...rows.map((x) => x.comp_loss_deg))
  const maxAte = Math.max(...rows.map((x) => x.ATE_m))
  const table = alphaTable(clip, gamma)
  const maxShare = Math.max(...table.map((t) => t.share))
  const pairs = table.reduce((s, t) => s + t.pairs, 0)

  const bar = (label: string, v: number, max: number, unit: string, col: string, digits: number) => (
    <div className="grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-2 text-xs sm:grid-cols-[12rem_1fr_6rem]">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-3 rounded-sm bg-muted">
        <div className="h-3 rounded-sm" style={{ width: `${Math.max(1, (v / max) * 100)}%`, background: col }} />
      </div>
      <span className="text-right font-mono tabular-nums">
        {v.toFixed(digits)} {unit}
      </span>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        {tab === "rho"
          ? "measured · e1.py · AR(1) rotation error, σ 0.05° per axis per step · 6 seeds"
          : "reasoned · Eq 13 of the paper, evaluated here · the paper does not publish γ"}
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3" role="tablist" aria-label="View">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              tab === t.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "rho" && (
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">step-to-step correlation ρ</span>
            {rows.map((x, i) => (
              <button
                key={x.rho}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={sel === i}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono tabular-nums",
                  sel === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.rho}
              </button>
            ))}
          </div>
          {bar("adjacent-pair loss", r.adj_loss_deg, maxLoss, "°", "oklch(0.62 0.15 150)", 3)}
          {bar("composed loss (gaps 1-11)", r.comp_loss_deg, maxLoss, "°", "oklch(0.6 0.13 250)", 3)}
          {bar("ATE after 4,661 steps", r.ATE_m, maxAte, "m", "oklch(0.62 0.19 28)", 1)}
          <p className="text-xs text-muted-foreground">
            Every row has the same per-step error: the adjacent loss stays at {rows[0].adj_loss_deg.toFixed(3)}° to{" "}
            {rows[rows.length - 1].adj_loss_deg.toFixed(3)}° whatever ρ is. The composed loss and the ATE move together
            until ρ = 0.9; past that the error is correlated over more frames than the 11-frame chain can see, and the ATE
            keeps climbing ({rows[3].ATE_m.toFixed(1)} m to {rows[4].ATE_m.toFixed(1)} m) while the composed loss barely
            moves ({rows[3].comp_loss_deg.toFixed(3)}° to {rows[4].comp_loss_deg.toFixed(3)}°).
          </p>
        </div>
      )}
      {tab === "alpha" && (
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">γ</span>
            {[0.25, 0.5, 0.75].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGamma(g)}
                aria-pressed={gamma === g}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono",
                  gamma === g ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {g}
              </button>
            ))}
            <span className="ml-2 text-muted-foreground">clip</span>
            {[32, 128].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setClip(c)}
                aria-pressed={clip === c}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono",
                  clip === c ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {c} frames
              </button>
            ))}
          </div>
          <div className="space-y-1">
            {table.map((t) => (
              <div key={t.gap} className="grid grid-cols-[3.5rem_1fr_7.5rem] items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">gap {t.gap}</span>
                <div className="h-2.5 rounded-sm bg-muted">
                  <div className="h-2.5 rounded-sm" style={{ width: `${(t.share / maxShare) * 100}%`, background: "oklch(0.6 0.13 250)" }} />
                </div>
                <span className="text-right font-mono tabular-nums">
                  α {t.alpha.toFixed(2)} · {(t.share * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Bars are each gap&apos;s share of the rotation term. A {clip}-frame clip has {pairs.toLocaleString("en-US")} supervised
            pairs, and none of them is longer than 11 frames: a longer clip adds pairs, not longer chains. The adjacent pairs
            carry {(table[0].share * 100).toFixed(1)}% of the rotation weight at this γ.
          </p>
        </div>
      )}
    </figure>
  )
}
