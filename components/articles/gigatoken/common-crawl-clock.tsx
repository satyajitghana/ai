"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Make the speedup visceral. The README notes that at EPYC rates you could
// tokenize all of Common Crawl — ~130 trillion tokens, "the entire internet" —
// in just under 6.5 hours. The same job on HuggingFace's tokenizer takes the
// better part of a year. Drag the dataset size. Rates (Mtok/s) are the README's
// measured GPT-2 numbers on each CPU.

const ACCENT = "oklch(0.6 0.16 250)"
const SLOW = "oklch(0.68 0.15 40)"

const CPUS = {
  epyc: { label: "EPYC 9565 · 144 cores", gt: 5564.94e6, hf: 5.63e6 },
  m4max: { label: "M4 Max · 16 cores", gt: 1887.23e6, hf: 1.4e6 },
}

const CC = 130e12 // Common Crawl, ~130 trillion tokens
const LO = 9 // 1e9 tokens
const HI = Math.log10(CC) // ~14.11

function human(sec: number): string {
  if (sec < 90) return `${sec.toFixed(1)} s`
  if (sec < 5400) return `${(sec / 60).toFixed(1)} min`
  if (sec < 172800) return `${(sec / 3600).toFixed(1)} hours`
  if (sec < 3.15e7) return `${(sec / 86400).toFixed(1)} days`
  return `${(sec / 3.15e7).toFixed(2)} years`
}

function toks(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(0)}B`
  return `${n}`
}

export function CommonCrawlClock() {
  const [exp, setExp] = useState(HI)
  const [ck, setCk] = useState<keyof typeof CPUS>("epyc")
  const cpu = CPUS[ck]
  const n = Math.pow(10, exp)

  const gt = n / cpu.gt
  const hf = n / cpu.hf

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">time to tokenize a dataset</span>
        <div className="flex gap-1">
          {(Object.keys(CPUS) as (keyof typeof CPUS)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setCk(k)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${ck === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 text-center font-mono">
          <div className="text-[10px] text-muted-foreground">dataset size</div>
          <div className="text-2xl tabular-nums text-foreground">{toks(n)} tokens</div>
          {Math.abs(exp - HI) < 0.02 ? (
            <div className="text-[10px]" style={{ color: ACCENT }}>≈ all of Common Crawl (“the entire internet”)</div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border px-3 py-3 text-center" style={{ borderColor: ACCENT }}>
            <div className="font-mono text-[11px]" style={{ color: ACCENT }}>gigatoken</div>
            <div className="mt-1 font-mono text-xl tabular-nums text-foreground">{human(gt)}</div>
          </div>
          <div className="rounded-lg border px-3 py-3 text-center">
            <div className="font-mono text-[11px]" style={{ color: SLOW }}>HuggingFace</div>
            <div className="mt-1 font-mono text-xl tabular-nums text-muted-foreground">{human(hf)}</div>
          </div>
        </div>
        <div className="mt-2 text-center font-mono text-[11px] text-muted-foreground">
          same job, <span className="tabular-nums text-foreground">{Math.round(hf / gt)}×</span> less wall-clock on {cpu.label}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>dataset size (log)</span>
            <span className="tabular-nums text-foreground">{toks(n)}</span>
          </div>
          <Range min={LO} max={HI} step={0.01} value={exp} onChange={(e) => setExp(+e.target.value)} className="w-full" aria-label="dataset size in tokens" accent={ACCENT} />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>1B</span>
            <span>1T</span>
            <span style={{ color: ACCENT }}>130T · Common Crawl</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
