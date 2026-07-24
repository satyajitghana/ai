"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The benchmark, made scannable. Encoding throughput on owt_train.txt (11.9 GB),
// gigatoken GB/s with its speedup over HuggingFace tokenizers, per CPU. Bars are
// colored by tokenizer family: BPE tokenizers (blue) hit ~20+ GB/s and 3-digit
// speedups; SentencePiece-based ones (amber) are the honest slow spot — still
// faster, but ~10-20x, not 1000x. Numbers: gigatoken README benchmarks.

const ACCENT = "oklch(0.6 0.16 250)"
const SP = "oklch(0.68 0.15 40)"

type Row = { name: string; gbps: number; vs: number | null; sp?: boolean }

const CPUS: { key: string; label: string; rows: Row[] }[] = [
  {
    key: "epyc",
    label: "AMD EPYC 9565 · 144 cores",
    rows: [
      { name: "GPT-2", gbps: 24.53, vs: 989 },
      { name: "GPT-OSS", gbps: 23.96, vs: 482 },
      { name: "OLMo 2 / 3", gbps: 23.06, vs: 833 },
      { name: "Qwen 3", gbps: 22.16, vs: 648 },
      { name: "Llama 3 / 3.1 / 3.2", gbps: 22.15, vs: 457 },
      { name: "DeepSeek V3 / R1 / V4", gbps: 19.69, vs: 750 },
      { name: "Qwen 3.5 / 3.6", gbps: 15.49, vs: 558 },
      { name: "Gemma 4", gbps: 4.82, vs: 14, sp: true },
      { name: "Mistral 7B v0.3", gbps: 3.57, vs: 10, sp: true },
      { name: "Gemma 3", gbps: 3.43, vs: 9.6, sp: true },
    ],
  },
  {
    key: "m4max",
    label: "Apple M4 Max · 16 cores",
    rows: [
      { name: "GPT-2", gbps: 8.79, vs: 1268 },
      { name: "Nemotron 3", gbps: 7.82, vs: 715 },
      { name: "Phi-4", gbps: 7.76, vs: 1012 },
      { name: "OLMo 2 / 3", gbps: 7.56, vs: 1299 },
      { name: "Qwen 2 / 2.5", gbps: 6.37, vs: 1105 },
      { name: "Qwen 3.5 / 3.6", gbps: 6.31, vs: 994 },
      { name: "GPT-OSS", gbps: 6.2, vs: 306 },
      { name: "Mistral 7B v0.3", gbps: 1.99, vs: 21, sp: true },
      { name: "Gemma 4", gbps: 1.82, vs: 21, sp: true },
      { name: "Gemma 3", gbps: 1.38, vs: 17, sp: true },
    ],
  },
  {
    key: "ryzen",
    label: "AMD Ryzen 7 9800X3D · 16 cores",
    rows: [
      { name: "GPT-2", gbps: 6.27, vs: 106 },
      { name: "Phi-4", gbps: 6.09, vs: 110 },
      { name: "GPT-OSS", gbps: 5.68, vs: 71 },
      { name: "Qwen 3", gbps: 5.34, vs: 98 },
      { name: "Llama 3.3", gbps: 5.26, vs: 66 },
      { name: "DeepSeek V3 / R1 / V4", gbps: 4.21, vs: 82 },
      { name: "Gemma 4", gbps: 1.45, vs: 18, sp: true },
      { name: "CodeLlama", gbps: 1.38, vs: 16, sp: true },
      { name: "Gemma 3", gbps: 1.12, vs: 13, sp: true },
    ],
  },
]

export function ThroughputBars() {
  const [ck, setCk] = useState("epyc")
  const cpu = CPUS.find((c) => c.key === ck) ?? CPUS[0]
  const max = Math.max(...cpu.rows.map((r) => r.gbps))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">gigatoken throughput · owt_train.txt (11.9 GB)</span>
        <div className="flex flex-wrap gap-1">
          {CPUS.map((c) => (
            <button key={c.key} type="button" onClick={() => setCk(c.key)} className={chip(c.key === ck)}>{c.key}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 font-mono text-[10px] text-muted-foreground">{cpu.label}</div>
        <div className="space-y-1.5">
          {cpu.rows.map((r) => (
            <div key={r.name} className="grid grid-cols-[120px_1fr_78px] items-center gap-2 sm:grid-cols-[150px_1fr_78px]">
              <span className="truncate font-mono text-[11px] text-foreground" title={r.name}>{r.name}</span>
              <span className="h-4 overflow-hidden rounded bg-muted/40">
                <span className="block h-full rounded" style={{ width: `${(r.gbps / max) * 100}%`, background: r.sp ? SP : ACCENT }} />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums">
                <span className="text-foreground">{r.gbps.toFixed(1)}</span>
                <span className="text-muted-foreground"> GB/s</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[120px_1fr_78px] gap-2 sm:grid-cols-[150px_1fr_78px]">
          <span />
          <span className="text-right font-mono text-[9px] text-muted-foreground">speedup vs HuggingFace →</span>
          <span />
        </div>
        <div className="mt-1 space-y-1">
          {cpu.rows.map((r) => (
            <div key={r.name} className="grid grid-cols-[120px_1fr] items-center gap-2 font-mono text-[10px] sm:grid-cols-[150px_1fr]">
              <span className="truncate text-muted-foreground/70">{r.name}</span>
              <span className="tabular-nums" style={{ color: r.sp ? SP : ACCENT }}>{r.vs != null ? `${r.vs}× faster` : "—"}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} /> BPE tokenizer</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SP }} /> SentencePiece (the slow spot)</span>
        </div>
      </div>
    </figure>
  )
}
