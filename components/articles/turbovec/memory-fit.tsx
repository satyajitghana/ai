"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The headline, made tunable. A corpus of D-dimensional float32 embeddings costs
// dim×4 bytes each; turbovec quantizes each to 2–4 bits after a random rotation, so
// the same corpus fits in a fraction of the RAM — often the difference between
// "needs a server" and "fits on a laptop." Drag the corpus size and flip the
// bit-width; the bars and the fit-in-16GB verdict update live. Real compression
// ratios (d=768 OpenAI embeddings, measured in the repo's benchmarks).

const DIM = 768
const FP32_BYTES = DIM * 4 // 3072
// measured index sizes (incl. per-vector scale + calibration overhead)
const RATIO = { 2: 15.8, 4: 8.0 } as const
const BUDGET_GB = 16

export function MemoryFit() {
  const [millions, setMillions] = useState(10)
  const [bits, setBits] = useState<2 | 4>(4)

  const n = millions * 1_000_000
  const fp32GB = (n * FP32_BYTES) / 1e9
  const tvGB = fp32GB / RATIO[bits]
  const fits = tvGB <= BUDGET_GB
  const fp32Fits = fp32GB <= BUDGET_GB

  const maxGB = Math.max(fp32GB, 1)
  const ACCENT = "oklch(0.72 0.15 195)"
  const FP = "oklch(0.7 0.04 40)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">corpus in RAM · float32 vs turbovec ({DIM}-dim)</span>
        <div className="flex gap-1">
          {[2, 4].map((bw) => (
            <button
              key={bw}
              type="button"
              onClick={() => setBits(bw as 2 | 4)}
              aria-pressed={bits === bw}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", bits === bw ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {bw}-bit
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          {[
            { label: "float32", gb: fp32GB, color: FP, fit: fp32Fits },
            { label: `turbovec ${bits}-bit`, gb: tvGB, color: ACCENT, fit: fits },
          ].map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="tabular-nums text-foreground">{r.gb < 1 ? `${(r.gb * 1000).toFixed(0)} MB` : `${r.gb.toFixed(1)} GB`}</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded bg-muted">
                <div className="h-full rounded transition-all duration-200" style={{ width: `${(r.gb / maxGB) * 100}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>corpus size</span>
            <span className="tabular-nums text-foreground">{millions}M vectors</span>
          </div>
          <input type="range" min={1} max={50} step={1} value={millions} onChange={(e) => setMillions(+e.target.value)} className="w-full accent-foreground" aria-label="corpus size in millions" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">compression</div>
            <div className="font-medium" style={{ color: ACCENT }}>{RATIO[bits]}×</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">fits in {BUDGET_GB} GB?</div>
            <div className="font-medium" style={{ color: fits ? ACCENT : "oklch(0.72 0.15 25)" }}>
              {fits ? "turbovec: yes" : "no"}{fp32Fits ? " · fp32: yes" : " · fp32: no"}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          At {millions}M vectors, float32 needs <span className="text-foreground">{fp32GB < 1 ? `${(fp32GB * 1000).toFixed(0)} MB` : `${fp32GB.toFixed(1)} GB`}</span>{" "}
          — turbovec holds it in <span className="text-foreground">{tvGB < 1 ? `${(tvGB * 1000).toFixed(0)} MB` : `${tvGB.toFixed(1)} GB`}</span>.
          The classic 10M-document corpus drops from ~31 GB (needs a big box) to ~4 GB (fits on a
          laptop), and the search runs on the packed codes directly — no decompression.
        </p>
      </div>
    </figure>
  )
}
