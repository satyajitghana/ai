"use client"

import { useState } from "react"

import { mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { ML_COS, ML_CRITS, ML_LAYERS, ML_PPL, ML_SPEAR, ML_TOP16, type MlCrit } from "./moonlight-data"

// Two measurements on Moonlight-16B-A3B (prune_moonlight.py): how well each ranking agrees with
// the experts' real routing frequency on 2,048 calibration tokens, layer by layer, and what the
// whole model's next-token perplexity does when every MoE layer is pruned by it at once.

const ROWS: MlCrit[] = ["reap", "reap_sm", "wmu", "bias", "l1", "signed", "random"]

function cell(v: number) {
  // diverging: blue for agreement with frequency, orange for anti-agreement, grey near zero
  const a = Math.min(Math.abs(v), 1)
  return v >= 0 ? `oklch(0.6 0.15 250 / ${(0.08 + 0.92 * a).toFixed(3)})` : `oklch(0.7 0.15 55 / ${(0.08 + 0.92 * a).toFixed(3)})`
}

export function MoonlightScores() {
  const [keep, setKeep] = useState<16 | 32>(16)
  const [set, setSet] = useState<"wiki" | "code">("wiki")
  const btn = (active: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
      active ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
    )
  const full = ML_PPL.full[set]
  const bars = ML_CRITS.map((c) => ({ ...c, v: ML_PPL[`${c.key}:${keep}`][set] })).sort((a, b) => a.v - b.v)
  const maxV = Math.max(...bars.map((b) => b.v))
  const scale = (v: number) => mlog(v / (full * 0.9)) / mlog(maxV / (full * 0.9))
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const meta = (k: MlCrit) => ML_CRITS.find((c) => c.key === k)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>which scores see real usage, and what pruning by them costs</span>
        <span className="text-muted-foreground/60">measured on Moonlight-16B-A3B</span>
      </div>
      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Spearman correlation with routing frequency, MoE layers {ML_LAYERS[0]} to {ML_LAYERS[ML_LAYERS.length - 1]}
          </div>
          <div className="space-y-1">
            {ROWS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate font-mono text-[11px] text-foreground sm:w-40">{meta(k).short}</span>
                <div className="flex min-w-0 flex-1 gap-px">
                  {ML_SPEAR[k].map((v, i) => (
                    <div key={i} className="h-4 min-w-0 flex-1 rounded-[2px]" style={{ background: cell(v) }} title={`layer ${ML_LAYERS[i]}: ${v.toFixed(2)}`} />
                  ))}
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{mean(ML_SPEAR[k]).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <span className="w-32 shrink-0 truncate font-mono text-[11px] text-muted-foreground sm:w-40">cos(mean input, ones)</span>
              <div className="flex min-w-0 flex-1 gap-px">
                {ML_COS.map((v, i) => (
                  <div key={i} className="h-4 min-w-0 flex-1 rounded-[2px]" style={{ background: cell(v) }} title={`layer ${ML_LAYERS[i]}: ${v.toFixed(3)}`} />
                ))}
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{mean(ML_COS).toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate font-mono text-[11px] text-muted-foreground sm:w-40">top-16 share of load</span>
              <div className="flex min-w-0 flex-1 gap-px">
                {ML_TOP16.map((v, i) => (
                  <div key={i} className="h-4 min-w-0 flex-1 rounded-[2px]" style={{ background: `oklch(0.58 0.15 150 / ${((v - 0.25) / 0.5).toFixed(3)})` }} title={`layer ${ML_LAYERS[i]}: ${(v * 100).toFixed(1)}%`} />
                ))}
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{(mean(ML_TOP16) * 100).toFixed(0)}%</span>
            </div>
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
            Blue: ranks experts the way real usage does. Orange: the opposite. Right column: mean over layers. Hover a cell for its value.
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">every layer pruned, keep</span>
            {([32, 16] as const).map((k) => (
              <button key={k} type="button" className={btn(keep === k)} aria-pressed={keep === k} onClick={() => setKeep(k)}>
                {k} of 64
              </button>
            ))}
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">text</span>
            <button type="button" className={btn(set === "wiki")} aria-pressed={set === "wiki"} onClick={() => setSet("wiki")}>
              WikiText-2
            </button>
            <button type="button" className={btn(set === "code")} aria-pressed={set === "code"} onClick={() => setSet("code")}>
              Python
            </button>
          </div>
          <div className="space-y-1.5">
            {bars.map((b) => (
              <div key={b.key}>
                <div className="mb-0.5 flex justify-between font-mono text-[11px]">
                  <span className="text-foreground">{b.short}</span>
                  <span className="text-muted-foreground">
                    perplexity {b.v < 100 ? b.v.toFixed(2) : b.v.toFixed(0)} · {(b.v / full).toFixed(1)}x
                  </span>
                </div>
                <div className="h-3.5 w-full overflow-hidden rounded-md border bg-muted/30">
                  <div className="h-full transition-all duration-300" style={{ width: `${(Math.max(0.02, scale(b.v)) * 100).toFixed(2)}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
            Unpruned: {full.toFixed(2)}. Bars on a log scale. 1,022 scored tokens per text, so treat differences under about 10% as noise.
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        A 16B relative of Kimi K3, not K3.1 Pro itself. The signed row sum, the score the pruned75 checkpoint used, is the one ranking here that
        does not track real usage, and the mean router input has almost no component along the all-ones direction it measures.
      </figcaption>
    </figure>
  )
}
