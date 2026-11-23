"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// My run on beast2 (Intel i7-6850K, 6 threads, RTX 3090), 23 November 2026. Headless Chrome for
// Testing 158, cross-origin isolated, CPU only (no hardware WebGPU adapter in headless mode there).
// wllama from the published npm packages 3.13.0 and 4.0.0; native is llama-server built from the
// llama.cpp commit wllama 4.0.0 pins (0b51bb2), same prompt (288-293 tokens), 64 tokens, greedy,
// seed 42, median of 3 (Gemma: v4 median of 2, v3 failed to load). llama.cpp's own timings.

type Row = { model: string; v3: number | null; v4: number; cpu: number; cuda: number }

const PP: Row[] = [
  { model: "LFM2 350M Q4_K_M", v3: 36.54, v4: 75.37, cpu: 579.97, cuda: 29542.25 },
  { model: "LFM2.5 1.2B Q4_K_M", v3: 9.1, v4: 20.8, cpu: 213.71, cuda: 20190.19 },
  { model: "Qwen2.5-Omni 3B Q4_K_M", v3: 3.41, v4: 6.7, cpu: 64.78, cuda: 9040.68 },
  { model: "Gemma 4 E4B Q4_0 (4.59 GB)", v3: null, v4: 8.69, cpu: 61.33, cuda: 7520.16 },
]
const TG: Row[] = [
  { model: "LFM2 350M Q4_K_M", v3: 21.23, v4: 55.03, cpu: 122.45, cuda: 918.92 },
  { model: "LFM2.5 1.2B Q4_K_M", v3: 5.46, v4: 13.6, cpu: 46.57, cuda: 608.49 },
  { model: "Qwen2.5-Omni 3B Q4_K_M", v3: 2.25, v4: 5.13, cpu: 16.17, cuda: 236.48 },
  { model: "Gemma 4 E4B Q4_0 (4.59 GB)", v3: null, v4: 2.29, cpu: 9.95, cuda: 142.42 },
]

const SERIES = [
  { key: "v3", label: "wllama 3.13.0", tone: "bg-zinc-400" },
  { key: "v4", label: "wllama 4.0.0", tone: "bg-orange-500" },
  { key: "cpu", label: "native, CPU", tone: "bg-sky-500" },
  { key: "cuda", label: "native, CUDA", tone: "bg-emerald-500" },
] as const

const LO = 1
const HI = 100000

// log scale from 1 to 100,000 tokens/s
const pos = (v: number) => ((mlog10(v) - mlog10(LO)) / (mlog10(HI) - mlog10(LO))) * 100

export function BenchBars() {
  const [metric, setMetric] = useState<"pp" | "tg">("pp")
  const [showCuda, setShowCuda] = useState(false)
  const rows = metric === "pp" ? PP : TG
  const series = SERIES.filter((s) => showCuda || s.key !== "cuda")

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">wllama in headless Chrome vs native llama.cpp, one x86 box</figcaption>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Metric">
        {(
          [
            ["pp", "Prompt processing"],
            ["tg", "Generation"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={metric === k}
            onClick={() => setMetric(k)}
            className={cn("rounded border px-2 py-1 text-xs", metric === k ? "border-foreground bg-muted" : "border-border hover:bg-muted")}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showCuda} onChange={(e) => setShowCuda(e.target.checked)} />
          show native CUDA (RTX 3090)
        </label>
      </div>

      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.model}>
            <div className="mb-1 text-xs font-medium">{r.model}</div>
            <div className="space-y-1">
              {series.map((s) => {
                const v = r[s.key]
                return (
                  <div key={s.key} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2">
                    <span className="truncate text-xs text-muted-foreground">{s.label}</span>
                    <div className="h-3 rounded bg-muted">
                      {v !== null && <div className={cn("h-3 rounded", s.tone)} style={{ width: `${pos(v).toFixed(2)}%` }} />}
                    </div>
                    <span className="text-right font-mono text-xs">{v === null ? "fails" : v < 100 ? v.toFixed(2) : v.toFixed(0)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[6.5rem_1fr_4.5rem] gap-2 text-[10px] text-muted-foreground">
        <span />
        <div className="flex justify-between font-mono">
          <span>1</span>
          <span>10</span>
          <span>100</span>
          <span>1k</span>
          <span>10k</span>
          <span>100k</span>
        </div>
        <span className="text-right">tok/s, log</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Intel i7-6850K, 6 threads, Chrome for Testing 158 headless, CPU only (headless Chrome found no hardware WebGPU adapter on this box).
        Median of 3 runs. wllama 3.13.0 and 4.0.0 alternated run by run; native ran first as a separate block, and the box had other work on it later, so the browser numbers are a floor and the native gap is approximate.
      </p>
    </figure>
  )
}
