"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// turbovec vs FAISS IndexPQ, across the repo's benchmark configs (100K vectors, 1K
// queries, k=64). Pick a dataset and bit-width; the bars compare recall@1, and the
// tiles show single-threaded query latency (Apple M3 Max) and compression. The story
// is honest: turbovec matches or beats FAISS recall almost everywhere and is 12–19%
// faster on ARM — except GloVe at 2-bit, where FAISS edges it by a hair.

type Cfg = {
  key: string
  dataset: string
  bits: number
  tqR: number
  faissR: number
  tqMs: number | null
  faissMs: number | null
  ratio: number
}

const CFGS: Cfg[] = [
  { key: "oa1536-4", dataset: "OpenAI-1536", bits: 4, tqR: 0.974, faissR: 0.966, tqMs: 1.992, faissMs: 2.45, ratio: 8.0 },
  { key: "oa1536-2", dataset: "OpenAI-1536", bits: 2, tqR: 0.891, faissR: 0.872, tqMs: 1.083, faissMs: 1.235, ratio: 15.8 },
  { key: "oa3072-4", dataset: "OpenAI-3072", bits: 4, tqR: 0.974, faissR: 0.972, tqMs: 3.968, faissMs: 4.925, ratio: 8.0 },
  { key: "oa3072-2", dataset: "OpenAI-3072", bits: 2, tqR: 0.929, faissR: 0.912, tqMs: 2.124, faissMs: 2.439, ratio: 15.9 },
  { key: "glove-4", dataset: "GloVe-200", bits: 4, tqR: 0.8498, faissR: 0.841, tqMs: null, faissMs: null, ratio: 7.7 },
  { key: "glove-2", dataset: "GloVe-200", bits: 2, tqR: 0.5637, faissR: 0.5643, tqMs: null, faissMs: null, ratio: 14.8 },
]

const TQ = "oklch(0.72 0.15 195)"
const FAISS = "oklch(0.7 0.05 40)"

export function ConfigExplorer() {
  const [i, setI] = useState(0)
  const c = CFGS[i]
  const tqWins = c.tqR >= c.faissR
  const speedup = c.tqMs && c.faissMs ? ((c.faissMs - c.tqMs) / c.faissMs) * 100 : null
  const maxR = Math.max(c.tqR, c.faissR)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">turbovec vs FAISS IndexPQ · recall@1, latency, compression</div>
      <div className="p-4">
        {/* config chips */}
        <div className="flex flex-wrap gap-1.5">
          {CFGS.map((cf, k) => (
            <button
              key={cf.key}
              type="button"
              onClick={() => setI(k)}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all", k === i ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40")}
            >
              {cf.dataset} · {cf.bits}-bit
            </button>
          ))}
        </div>

        {/* recall bars */}
        <div className="mt-4 space-y-2">
          {[
            { label: "turbovec", r: c.tqR, color: TQ },
            { label: "FAISS PQ", r: c.faissR, color: FAISS },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{b.label}</span>
              <span className="h-3.5 flex-1 overflow-hidden rounded bg-muted">
                <span className="block h-full rounded transition-all duration-300" style={{ width: `${(b.r / maxR) * 100}%`, background: b.color }} />
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{b.r.toFixed(3)}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground">recall@1 (higher is better)</div>

        {/* tiles */}
        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">recall Δ vs FAISS</div>
            <div className="font-medium" style={{ color: tqWins ? TQ : "oklch(0.72 0.15 25)" }}>
              {(c.tqR - c.faissR >= 0 ? "+" : "")}{((c.tqR - c.faissR) * 100).toFixed(2)} pp
            </div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">latency (ARM, ms/q)</div>
            <div className="font-medium text-foreground">
              {c.tqMs ? `${c.tqMs} vs ${c.faissMs}` : "—"}
              {speedup ? <span style={{ color: speedup > 0 ? TQ : "oklch(0.72 0.15 25)" }}> ({speedup > 0 ? "+" : ""}{speedup.toFixed(0)}%)</span> : null}
            </div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">compression</div>
            <div className="font-medium" style={{ color: TQ }}>{c.ratio}×</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {c.key === "glove-2"
            ? "GloVe at 2-bit is the one place FAISS edges ahead — by 0.06 of a point. Low-dimensional (d=200) vectors leave the rotation less room to spread energy, so the data-free quantizer's advantage narrows."
            : tqWins
              ? `turbovec wins recall here (+${((c.tqR - c.faissR) * 100).toFixed(2)} pp)${speedup ? ` and is ${speedup.toFixed(0)}% faster on ARM` : ""} — with no training phase and ${c.ratio}× compression.`
              : "FAISS is marginally ahead here."}
        </p>
      </div>
    </figure>
  )
}
