"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The editorial spine of the whole piece: Rubin isn't one big number, it's a
// list of specific agentic-inference bottlenecks each answered by a specific
// feature. Pick a bottleneck; see Rubin's move and the figure it moves.
// All facts from the NVIDIA Rubin architecture post.

const ACCENT = "oklch(0.7 0.17 145)"

const ITEMS = [
  {
    b: "Long-context attention",
    feat: "2:4 sparse activations + faster exponentials",
    detail:
      "Intermediate attention scores are compressed to a structured 2:4 sparse form (nonzeros + metadata), so softmax and the second attention GEMM do less work — and exponential throughput rises to 4× BF16 / 2× FP32 vs Blackwell, so softmax keeps pace.",
    metric: "4× BF16 exp throughput",
  },
  {
    b: "MoE expert routing",
    feat: "Shared TMA descriptor across experts",
    detail:
      "Blackwell keeps one memory descriptor per expert. Rubin keeps a single descriptor and overrides the pointer/stride inline in the TMA instruction at runtime — less metadata and data-movement overhead as expert counts grow.",
    metric: "1 descriptor, not per-expert",
  },
  {
    b: "Tensor-parallel GEMMs",
    feat: "2× K-dimension per instruction",
    detail:
      "Doubling the reduction-dimension processed per clock means fewer loop iterations: a GEMM that took 4 iterations on Blackwell finishes in 2 on Rubin, cutting loop overhead for both context and decode kernels.",
    metric: "4 iterations → 2",
  },
  {
    b: "Decode is memory-bound",
    feat: "HBM4 at 22 TB/s",
    detail:
      "Token-by-token generation is bounded by how fast weights and KV state reach the cores. HBM4 doubles interface width over HBM3e for up to 22 TB/s — 2.8× Blackwell — keeping compute engines fed during decode.",
    metric: "2.8× bandwidth",
  },
  {
    b: "KV cache / concurrency",
    feat: "288 GB HBM4 per GPU",
    detail:
      "More on-package capacity keeps multitrillion-parameter models resident, extends context length, and holds larger KV caches at higher concurrency — without spilling KV to slower memory.",
    metric: "288 GB on-package",
  },
  {
    b: "Kernel-to-kernel bubbles",
    feat: "Tile-level producer→consumer triggering",
    detail:
      "Instead of waiting for a whole producer kernel to finish, Rubin lets consumer work start as individual tiles of activation data become available (data-driven polling) — a tighter timeline where kernel-to-kernel latency directly sets tokens/sec/user.",
    metric: "fewer idle gaps",
  },
  {
    b: "Scale-up GPU↔GPU sync",
    feat: "NVLink 6 counted writes",
    detail:
      "Device-initiated NVLink transfers replace memory barriers, acks, and atomic flags with a single counter update the receiver watches — fused into the kernel over 3,600 GB/s of scale-up bandwidth, so compute doesn't stall on synchronization.",
    metric: "3,600 GB/s scale-up",
  },
  {
    b: "Power stranding in the factory",
    feat: "Power smoothing + DSX MaxLPS",
    detail:
      "State-of-charge energy storage absorbs power swings (−10% average, −20% on 50 ms peaks), and DSX MaxLPS recovers stranded headroom across the rack — fitting up to 40% more GPUs in the same megawatt budget.",
    metric: "+40% GPUs / fixed watts",
  },
]

export function BottleneckMap() {
  const [sel, setSel] = useState(0)
  const it = ITEMS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        agentic bottleneck → Rubin&rsquo;s answer
      </div>
      <div className="grid gap-0 sm:grid-cols-[210px_1fr]">
        {/* bottleneck list */}
        <div className="flex flex-col gap-1 border-b p-2 sm:border-b-0 sm:border-r">
          {ITEMS.map((x, i) => (
            <button
              key={x.b}
              type="button"
              onClick={() => setSel(i)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors",
                i === sel ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              style={i === sel ? { background: "color-mix(in oklch, " + ACCENT + " 16%, transparent)" } : undefined}
            >
              {x.b}
            </button>
          ))}
        </div>

        {/* detail */}
        <div className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Rubin</div>
          <div className="mt-0.5 text-base font-semibold" style={{ color: ACCENT }}>{it.feat}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{it.detail}</p>
          <div className="mt-3 inline-block rounded-md border px-2.5 py-1 font-mono text-xs tabular-nums" style={{ borderColor: ACCENT, color: ACCENT }}>
            {it.metric}
          </div>
        </div>
      </div>
    </figure>
  )
}
