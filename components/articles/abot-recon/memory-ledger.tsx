"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { RUN } from "./data"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

// Two panels.
// 1. REASONED from tensor shapes read in the released code: K and V for 725 tokens per frame
//    (20 x 36 patches + 5 register tokens at 504 x 280), 18 cross-frame decoder layers, 16 heads of 64, bf16.
//    The paged pool size (W + 16 = 28 frame pages) is read from paged_kv.py.
// 2. MEASURED: a one-head toy (64 tokens per frame, width 64) of causal attention over a stream on this
//    box's CPU, window of 12 frames versus a cache that keeps everything. Median of the 50 frames before each mark.

const LENGTHS = [12, 100, 1000, 4661, 18846, 22000] as const
const NAMES: Record<number, string> = {
  12: "one window",
  100: "100 frames",
  1000: "1,000 frames",
  4661: "KITTI-02",
  18846: "VBR Ciampino-1",
  22000: "default max_frames",
}

const BYTES = RUN.realKv.bytes_per_frame
const GIB = 2 ** 30
const gib = (frames: number) => (frames * BYTES) / GIB
const LO = 0.1
const HI = 2000
const bar = (v: number) => Math.max(1, ((mlog10(v) - mlog10(LO)) / (mlog10(HI) - mlog10(LO))) * 100)
const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2))

export function MemoryLedger() {
  const [n, setN] = useState<number>(4661)
  const rows = [
    { label: "Full history cache", sub: `${n.toLocaleString("en-US")} frames of K and V`, v: gib(n), fill: "oklch(0.62 0.19 28)" },
    { label: "ABot-Recon pool, allocated", sub: "28 frame pages, fixed", v: RUN.realKv.paged_pool_GiB, fill: "oklch(0.62 0.13 250)" },
    { label: "ABot-Recon window, filled", sub: "11 past frames", v: RUN.realKv.window_11_GiB, fill: "oklch(0.62 0.15 150)" },
  ]
  const toy = RUN.toyAttention.rows
  const maxMs = Math.max(...toy.map((r) => r.full_ms))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        reasoned · cross-frame K/V of the released model, {RUN.realKv.MiB_per_frame} MiB per frame · log scale
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3" role="tablist" onKeyDown={tablistKeys()} aria-label="Stream length">
        {LENGTHS.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={n === x}
            tabIndex={n === x ? 0 : -1}
            onClick={() => setN(x)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              n === x ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {NAMES[x]}
          </button>
        ))}
      </div>
      <div className="space-y-2 p-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2 text-xs sm:grid-cols-[14rem_1fr_5rem]">
            <span className="leading-tight">
              {r.label}
              <span className="block text-muted-foreground">{r.sub}</span>
            </span>
            <div className="h-3 rounded-sm bg-muted">
              <div className="h-3 rounded-sm" style={{ width: `${bar(r.v)}%`, background: r.fill }} />
            </div>
            <span className="text-right font-mono tabular-nums">{fmt(r.v)} GiB</span>
          </div>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          An 80 GB card holds about {Math.floor((80e9 - 4.0e9) / BYTES).toLocaleString("en-US")} frames of full history once
          4.0 GB of fp32 weights are loaded. The window never holds more than 12.
        </p>
      </div>
      <div className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        measured · toy causal attention on this CPU, 64 tokens x 64 dims per frame, ms per frame
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-[22rem] font-mono text-xs tabular-nums">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 font-normal">frame</th>
              <th className="pb-1 font-normal">window, frames held</th>
              <th className="pb-1 font-normal">window ms</th>
              <th className="pb-1 font-normal">full ms</th>
              <th className="w-1/3 pb-1 font-normal" />
            </tr>
          </thead>
          <tbody>
            {toy.map((r) => (
              <tr key={r.frame}>
                <td className="py-0.5">{r.frame.toLocaleString("en-US")}</td>
                <td>{r.window_frames_held}</td>
                <td>{r.window_ms.toFixed(3)}</td>
                <td>{r.full_ms.toFixed(3)}</td>
                <td>
                  <div className="h-2 rounded-sm bg-muted">
                    <div className="h-2 rounded-sm" style={{ width: `${Math.max(1, (r.full_ms / maxMs) * 100)}%`, background: "oklch(0.62 0.19 28)" }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        The window&apos;s cost per frame is flat from frame 12 onward; the full cache&apos;s grows with every frame it keeps.
        The toy is one head on a CPU, so only the shape carries over, not the milliseconds.
      </figcaption>
    </figure>
  )
}
