"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The inversion at the heart of MegaTrain. Mixed-precision Adam needs ~12 bytes
// per parameter (2 BF16 weight + 2 BF16 grad + 8 FP32 moments). A GPU-centric
// system keeps all of it in HBM, so it OOMs once 12·params exceeds the card. A
// memory-centric system keeps that state in host RAM and streams one layer at a
// time, so device memory stays roughly flat and the host's terabytes set the
// ceiling instead. Drag the model size. Single H200: 141 GB HBM, 1.5 TB host.

const HBM = 141 // GB
const HOST = 1536 // GB (1.5 TB)
const DEVICE_FLAT = 6 // GB MegaTrain keeps resident (≈ one layer + buffers + activations)

export function MemoryPlacement() {
  const [size, setSize] = useState(70) // B params

  const persistent = size * 12 // GB of param/grad/moment state
  const gpuCentricFits = persistent <= HBM
  const megatrainFits = persistent <= HOST // device side is flat & always fits

  const maxGpuCentric = Math.floor(HBM / 12) // ~11B
  const maxMegatrain = Math.floor(HOST / 12) // ~128B

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        where the state lives · single H200 (141 GB HBM, 1.5 TB host)
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>model size</span>
            <span className="text-foreground tabular-nums">{size}B params · {persistent} GB state</span>
          </div>
          <input
            type="range"
            min={7}
            max={120}
            step={1}
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-full cursor-pointer accent-foreground"
            aria-label="model size in billions of parameters"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* GPU-centric */}
          <div className={cn("rounded-md border p-3", gpuCentricFits ? "border-foreground/20" : "border-destructive/50")}>
            <div className="font-mono text-xs font-medium text-foreground">GPU-centric</div>
            <div className="mb-2 font-mono text-[10px] text-muted-foreground">all state in HBM (e.g. FSDP)</div>
            <Bar label="HBM" need={persistent} cap={HBM} />
            <div className={cn("mt-2 font-mono text-xs", gpuCentricFits ? "text-foreground" : "text-destructive")}>
              {gpuCentricFits ? `fits — ${persistent} / ${HBM} GB` : `OOM — needs ${persistent} GB, has ${HBM}`}
            </div>
          </div>

          {/* MegaTrain */}
          <div className="rounded-md border border-foreground/30 p-3">
            <div className="font-mono text-xs font-medium text-foreground">MegaTrain</div>
            <div className="mb-2 font-mono text-[10px] text-muted-foreground">state in host RAM, one layer streamed</div>
            <Bar label="HBM" need={DEVICE_FLAT} cap={HBM} accent />
            <Bar label="host" need={persistent} cap={HOST} accent />
            <div className={cn("mt-2 font-mono text-xs", megatrainFits ? "text-foreground" : "text-destructive")}>
              {megatrainFits ? `fits — HBM ~${DEVICE_FLAT} GB, host ${persistent} / ${HOST} GB` : `host OOM — needs ${persistent} GB`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="GPU-centric max" value={`~${maxGpuCentric}B`} />
          <Stat label="MegaTrain max" value={`~${maxMegatrain}B`} highlight />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          A single H200&rsquo;s HBM caps a GPU-centric run at roughly{" "}
          <span className="text-foreground">{maxGpuCentric}B</span> parameters. Move the
          persistent state to the 1.5 TB host and keep only a streamed layer on the device,
          and the same card trains past <span className="text-foreground">120B</span> — at
          full precision, no quantization. The catch is what you trade for it: every layer&rsquo;s
          weights now cross PCIe twice per step, which is exactly the bottleneck the
          double-buffered pipeline exists to hide.
        </p>
      </div>
    </figure>
  )
}

function Bar({ label, need, cap, accent }: { label: string; need: number; cap: number; accent?: boolean }) {
  const over = need > cap
  const frac = Math.min(need / cap, 1)
  return (
    <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px]">
      <span className="w-8 shrink-0 text-right text-muted-foreground">{label}</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
        <div
          className="h-full rounded"
          style={{
            width: `${Math.max(frac * 100, 2)}%`,
            background: over ? "oklch(0.62 0.2 25)" : accent ? "oklch(0.72 0.15 150)" : "oklch(0.72 0.15 195)",
          }}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium text-foreground", highlight && "")}>{value}</div>
    </div>
  )
}
