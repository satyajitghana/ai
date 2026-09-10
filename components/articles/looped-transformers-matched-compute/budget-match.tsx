"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The whole methodological point of this article, made interactive.
//
// A looped model that reuses a block shares WEIGHTS across passes, so total
// parameters barely move -- that's the "free" part every parameter-matched
// paper (Huginn, Ouro, virtual logic depth) reports. But nothing else is free.
// SMELT's own accounting (Sec. 3.2, arXiv 2609.01343): looping the middle
// m = L/2 layers of a 12-layer, 200M-active-param MoE backbone r=2 times grows
// effective depth to L + (r-1)m = 18, and "FLOPs grow in proportion" to that
// effective depth when width/experts are held fixed -- so the NAIVE loop is a
// 18/12 = 1.5x tax on per-token FLOPs, paid by nobody's ledger in most looped-
// transformer papers. We extend that same stated proportionality to KV cache
// (also a function of effective depth when head geometry is untouched) to draw
// the naive bar; SMELT does not report this uncompensated configuration itself,
// so it is our own illustrative extrapolation, flagged as such below.
//
// SMELT's actual move: narrow H 1280->1056 and raise the expert pool 192->288
// per layer (recovering the parameters the narrower width lost), then retune
// head size / GQA ratio for KV parity. The result (Appendix A, 200M / S~=95%
// row, exact): FLOPs land at 1.029x baseline, total params at 1.004x, KV cache
// at 1.031x. Three budgets, all within ~3%, instead of one budget "matched" by
// construction and two left to float.

type Mode = "naive" | "smelt"

const BASELINE = { flops: 1.33e9, params: 3.87e9, label: "12-layer, 200M-active MoE Baseline" }

const MODES: Record<
  Mode,
  { label: string; sub: string; flopsRatio: number; paramsRatio: number; kvRatio: number; note: string; exact: boolean }
> = {
  naive: {
    label: "Naive loop",
    sub: "same H=1280, same 192 experts — just loop the middle 6 layers twice",
    flopsRatio: 1.5,
    paramsRatio: 1.0,
    kvRatio: 1.5,
    note: "Effective depth rises 12→18 (×1.5); SMELT states FLOPs “grow in proportion” to effective depth when width is unchanged — we apply that same stated proportionality to KV cache. The paper never runs this uncompensated configuration; this bar is our extrapolation from their Sec. 3.2 relation, not their measurement.",
    exact: false,
  },
  smelt: {
    label: "SMELT-matched",
    sub: "H 1280→1056, experts 192→288, GQA/head size retuned",
    flopsRatio: 1.029,
    paramsRatio: 1.004,
    kvRatio: 1.031,
    note: "Exact, from Appendix A (200M scale, S≈ 95% row) and Sec. 3.2's worked example: +2.9% FLOPs, +0.4% params, +3.1% KV cache — all three budgets within the paper's own <4% matching tolerance.",
    exact: true,
  },
}

const ROWS: { key: "flopsRatio" | "paramsRatio" | "kvRatio"; label: string }[] = [
  { key: "flopsRatio", label: "per-token FLOPs" },
  { key: "paramsRatio", label: "total non-embed. params" },
  { key: "kvRatio", label: "KV cache" },
]

const ACCENT = "oklch(0.62 0.17 25)"
const AXIS_MAX = 1.6

export function BudgetMatch() {
  const [mode, setMode] = useState<Mode>("naive")
  const m = MODES[mode]
  const pct = (r: number) => Math.min(100, (r / AXIS_MAX) * 100)
  const basePct = pct(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">three budgets, held against a 200M-active MoE Baseline</span>
        <div className="flex gap-1">
          {(Object.keys(MODES) as Mode[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {MODES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 font-mono text-[11px] text-muted-foreground">{m.sub}</div>

        <div className="space-y-3.5">
          {ROWS.map((row) => {
            const ratio = m[row.key]
            const over = ratio > 1
            return (
              <div key={row.key} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-right font-mono text-[10px] text-muted-foreground sm:w-44">{row.label}</span>
                <div className="relative h-4 flex-1 rounded-full bg-muted/20">
                  {/* baseline reference line at 100% */}
                  <div
                    className="absolute top-0 h-4 w-px bg-foreground/40"
                    style={{ left: `${basePct}%` }}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute top-0 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${pct(ratio)}%`, background: ACCENT, opacity: over ? 0.85 : 0.5 }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: over ? ACCENT : "var(--muted-foreground)" }}>
                  {ratio === 1 ? "1.00×" : `${ratio.toFixed(3)}×`}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 font-mono text-[9px] text-muted-foreground/70">
          <span className="inline-block h-px w-4 bg-foreground/40" /> baseline (1.00×) &nbsp;·&nbsp; {BASELINE.label}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch to <strong className="text-foreground">Naive loop</strong> and only one bar stays where a
          parameter-matched paper reports it — params, because tied weights are free by definition. FLOPs and KV
          cache both drift to <strong style={{ color: ACCENT }}>1.5×</strong>, uncounted in most of the
          looped-transformer literature. Switch to <strong className="text-foreground">SMELT-matched</strong> and all three
          bars snap back near the baseline line — not by refusing to pay for the extra depth, but by narrowing the
          model elsewhere (width down, expert count up) until the bill comes out even. {m.note}
        </p>
      </div>
    </figure>
  )
}
