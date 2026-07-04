"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// turbovec vs FAISS IndexPQ, across the repo's benchmark configs (100K vectors, 1K
// queries, k=64). Pick a dataset and bit-width; the paired bars compare recall@1 on a
// true 0..1 axis, and the readout shows single-threaded query latency (Apple M3 Max)
// and compression. The story is honest: turbovec matches or beats FAISS recall almost
// everywhere and is 12–19% faster on ARM — except GloVe at 2-bit, where FAISS edges it.

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

const DATASETS = ["OpenAI-1536", "OpenAI-3072", "GloVe-200"]
const TQ = "oklch(0.72 0.15 195)"
const FAISS = "oklch(0.68 0.05 40)"
const LOSS = "oklch(0.7 0.15 25)"

// scene geometry (viewBox units)
const W = 600
const H = 168
const BX0 = 108
const BX1 = 540
const sx = (r: number) => BX0 + Math.max(0, Math.min(1, r)) * (BX1 - BX0)

export function ConfigExplorer() {
  const [dataset, setDataset] = useState(DATASETS[0])
  const [bits, setBits] = useState(4)
  const c = CFGS.find((cf) => cf.dataset === dataset && cf.bits === bits) ?? CFGS[0]

  const tqWins = c.tqR >= c.faissR
  const speedup = c.tqMs && c.faissMs ? ((c.faissMs - c.tqMs) / c.faissMs) * 100 : null
  const dpp = (c.tqR - c.faissR) * 100

  const rows = [
    { label: "turbovec", r: c.tqR, color: TQ, win: tqWins, y: 46 },
    { label: "FAISS PQ", r: c.faissR, color: FAISS, win: !tqWins, y: 92 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>turbovec vs FAISS IndexPQ · recall@1</span>
        <span className="text-muted-foreground/50">measured</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* controls */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">dataset</span>
            {DATASETS.map((d) => (
              <button key={d} type="button" onClick={() => setDataset(d)} aria-pressed={dataset === d}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", dataset === d ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">bits</span>
            {[4, 2].map((b) => (
              <button key={b} type="button" onClick={() => setBits(b)} aria-pressed={bits === b}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", bits === b ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={bits === b ? { background: TQ } : undefined}>
                {b}-bit
              </button>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`recall@1: turbovec ${c.tqR.toFixed(3)} vs FAISS ${c.faissR.toFixed(3)} on ${c.dataset} at ${c.bits}-bit`}>
          <defs>
            <filter id="ce-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line x1={sx(g)} y1={34} x2={sx(g)} y2={122} stroke="var(--border)" strokeWidth={1} strokeOpacity={g === 0 ? 0.9 : 0.5} strokeDasharray={g === 0 ? undefined : "3 4"} />
              <text x={sx(g)} y={137} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{g.toFixed(2)}</text>
            </g>
          ))}
          <text x={BX0} y={22} className="fill-muted-foreground font-mono" fontSize={10}>recall@1 · higher is better</text>

          {/* bars */}
          {rows.map((row) => (
            <g key={row.label} className="transition-all duration-300">
              <text x={BX0 - 10} y={row.y + 18} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>{row.label}</text>
              <rect x={BX0} y={row.y} width={BX1 - BX0} height={26} rx={5} fill="var(--muted)" opacity={0.4} />
              <rect x={BX0} y={row.y} width={sx(row.r) - BX0} height={26} rx={5} fill={row.color} opacity={row.win ? 0.95 : 0.55} filter="url(#ce-soft)" className="transition-all duration-300" />
              <text x={Math.min(sx(row.r) + 7, W - 34)} y={row.y + 18} className="fill-foreground font-mono tabular-nums" fontSize={11} fontWeight={600}>{row.r.toFixed(3)}</text>
            </g>
          ))}
        </svg>

        {/* readout */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground">Δ recall <span style={{ color: dpp >= 0 ? TQ : LOSS }}>{dpp >= 0 ? "+" : ""}{dpp.toFixed(2)} pp</span></span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">latency {c.tqMs ? <>{c.tqMs} vs {c.faissMs} ms/q{speedup ? <span style={{ color: speedup > 0 ? TQ : LOSS }}> ({speedup > 0 ? "+" : ""}{speedup.toFixed(0)}%)</span> : null}</> : "not measured"}</span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">compression <span style={{ color: TQ }}>{c.ratio}×</span></span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {c.key === "glove-2"
            ? "GloVe at 2-bit is the one place FAISS edges ahead — by 0.06 of a point. Low-dimensional (d=200) vectors leave the rotation less room to spread energy, so the data-free quantizer's advantage narrows."
            : tqWins
              ? `turbovec wins recall here (+${dpp.toFixed(2)} pp)${speedup ? ` and is ${speedup.toFixed(0)}% faster on ARM` : ""} — with no training phase and ${c.ratio}× compression.`
              : "FAISS is marginally ahead here."}
        </p>
      </div>
    </figure>
  )
}
