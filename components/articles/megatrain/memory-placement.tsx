"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The inversion at the heart of MegaTrain, drawn as a placement diagram. Mixed-precision
// Adam needs ~12 bytes per parameter (2 BF16 weight + 2 BF16 grad + 8 FP32 moments). A
// GPU-centric system keeps all of it in HBM, so it OOMs once 12·params exceeds the card.
// A memory-centric system keeps that state in host RAM and streams one layer at a time
// over PCIe, so device memory stays roughly flat and the host's terabytes set the ceiling.
// Flip where the state lives, drag the model size. Single H200: 141 GB HBM, 1.5 TB host.

const HBM = 141 // GB
const HOST = 1536 // GB (1.5 TB)
const DEVICE_FLAT = 6 // GB MegaTrain keeps resident (≈ one layer + buffers + activations)

const DEV = "oklch(0.62 0.15 250)" // device / HBM accent (blue)
const HST = "oklch(0.64 0.13 160)" // host accent (green)
const OVER = "oklch(0.62 0.2 25)" // OOM (red)

// scene geometry (viewBox units)
const W = 760
const H = 250
const GX = 44 // GPU node
const HXR = W - 44 // host node right edge
const NW = 288 // node width
const NY = 40
const NH = 168
const HX = HXR - NW // host node left
const MY = NY + 96 // meter top
const MH = 26
const MPX = 22 // meter inset

export function MemoryPlacement() {
  const [size, setSize] = useState(70) // B params
  const [mode, setMode] = useState<"gpu" | "mega">("mega")

  const persistent = size * 12 // GB of param/grad/moment state
  const gpu = mode === "gpu"

  const gpuUse = gpu ? persistent : DEVICE_FLAT
  const hostUse = gpu ? 0 : persistent
  const gpuFrac = Math.min(gpuUse / HBM, 1)
  const hostFrac = Math.min(hostUse / HOST, 1)
  const gpuOver = gpuUse > HBM
  const streaming = !gpu

  const maxGpuCentric = Math.floor(HBM / 12) // ~11B
  const maxMegatrain = Math.floor(HOST / 12) // ~128B
  const fits = gpu ? !gpuOver : persistent <= HOST

  // meter inner width
  const mw = NW - 2 * MPX
  // PCIe channel geometry
  const cx1 = GX + NW // GPU right
  const cx2 = HX // host left
  const topY = NY + 118
  const botY = NY + 142

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">where the state lives · single H200</span>
        <div className="flex gap-1">
          {[
            { v: "gpu" as const, label: "GPU-centric" },
            { v: "mega" as const, label: "MegaTrain" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              aria-pressed={mode === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                mode === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${gpu ? "GPU-centric" : "MegaTrain"} placement of ${persistent} GB of optimizer state for a ${size}B model across 141 GB HBM and 1.5 TB host RAM`}>
          <defs>
            <marker id="mp-arr-d" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={DEV} strokeWidth={1.5} />
            </marker>
            <marker id="mp-arr-h" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={HST} strokeWidth={1.5} />
            </marker>
            <filter id="mp-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- GPU node ---- */}
          <g>
            <rect x={GX} y={NY} width={NW} height={NH} rx={12} fill="var(--background)" stroke={gpuOver ? OVER : DEV} strokeWidth={1.5} filter="url(#mp-soft)" />
            <text x={GX + 18} y={NY + 26} className="fill-foreground font-mono" fontSize={13} fontWeight={600}>GPU · H200</text>
            <text x={GX + 18} y={NY + 43} className="fill-muted-foreground font-mono" fontSize={10}>141 GB HBM · fast, scarce</text>
            <Meter x={GX + MPX} y={MY} w={mw} h={MH} frac={gpuFrac} color={gpuOver ? OVER : DEV} over={gpuOver} />
            <text x={GX + MPX} y={MY + MH + 16} className="font-mono" fill={gpuOver ? OVER : "var(--muted-foreground)"} fontSize={10}>
              {gpu
                ? gpuOver
                  ? `OOM · needs ${persistent} GB, has ${HBM}`
                  : `all state · ${persistent} / ${HBM} GB`
                : `~${DEVICE_FLAT} GB resident · one streamed layer`}
            </text>
          </g>

          {/* ---- Host node ---- */}
          <g>
            <rect x={HX} y={NY} width={NW} height={NH} rx={12} fill="var(--background)" stroke={hostUse > 0 ? HST : "var(--border)"} strokeWidth={1.5} filter="url(#mp-soft)" />
            <text x={HX + 18} y={NY + 26} className="fill-foreground font-mono" fontSize={13} fontWeight={600}>Host RAM</text>
            <text x={HX + 18} y={NY + 43} className="fill-muted-foreground font-mono" fontSize={10}>1.5 TB · slow, abundant</text>
            <Meter x={HX + MPX} y={MY} w={mw} h={MH} frac={hostFrac} color={hostUse > 0 ? HST : "var(--muted)"} idle={hostUse === 0} />
            <text x={HX + MPX} y={MY + MH + 16} className="fill-muted-foreground font-mono" fontSize={10}>
              {hostUse > 0 ? `state · ${persistent} / ${HOST} GB` : "idle in GPU-centric"}
            </text>
          </g>

          {/* ---- PCIe channel ---- */}
          <text x={(cx1 + cx2) / 2} y={NY + 96} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>PCIe</text>
          {/* H2D weights (host -> GPU) */}
          <path d={`M ${cx2 - 2} ${topY} C ${(cx1 + cx2) / 2} ${topY}, ${(cx1 + cx2) / 2} ${topY}, ${cx1 + 2} ${topY}`} fill="none" stroke={DEV} strokeWidth={1.5} markerEnd="url(#mp-arr-d)" strokeDasharray={streaming ? "5 5" : undefined} opacity={streaming ? 0.95 : 0.18}>
            {streaming ? <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.7s" repeatCount="indefinite" /> : null}
          </path>
          {/* D2H grads (GPU -> host) */}
          <path d={`M ${cx1 + 2} ${botY} C ${(cx1 + cx2) / 2} ${botY}, ${(cx1 + cx2) / 2} ${botY}, ${cx2 - 2} ${botY}`} fill="none" stroke={HST} strokeWidth={1.5} markerEnd="url(#mp-arr-h)" strokeDasharray={streaming ? "5 5" : undefined} opacity={streaming ? 0.95 : 0.18}>
            {streaming ? <animate attributeName="stroke-dashoffset" from="0" to="10" dur="0.7s" repeatCount="indefinite" /> : null}
          </path>
          <text x={(cx1 + cx2) / 2} y={topY - 6} textAnchor="middle" className="font-mono" fill={streaming ? DEV : "var(--muted-foreground)"} fontSize={8} opacity={streaming ? 0.9 : 0.4}>H2D w</text>
          <text x={(cx1 + cx2) / 2} y={botY + 13} textAnchor="middle" className="font-mono" fill={streaming ? HST : "var(--muted-foreground)"} fontSize={8} opacity={streaming ? 0.9 : 0.4}>D2H g</text>
        </svg>

        {/* controls */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>model size</span>
            <span className="text-foreground tabular-nums">{size}B params · {persistent} GB state</span>
          </div>
          <Range
            min={7}
            max={120}
            step={1}
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-full cursor-pointer "
            aria-label="model size in billions of parameters" accent="var(--foreground)" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">GPU-centric max</div>
            <div className="font-medium text-foreground">~{maxGpuCentric}B</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">MegaTrain max</div>
            <div className="font-medium" style={{ color: HST }}>~{maxMegatrain}B</div>
          </div>
        </div>

        <div className={cn("mt-2 font-mono text-xs", fits ? "text-muted-foreground" : "")} style={fits ? undefined : { color: OVER }}>
          {gpu
            ? gpuOver
              ? `GPU-centric: OOM — ${persistent} GB won't fit 141 GB HBM.`
              : `GPU-centric: fits — ${persistent} / ${HBM} GB HBM.`
            : `MegaTrain: fits — HBM flat at ~${DEVICE_FLAT} GB, host holds ${persistent} / ${HOST} GB.`}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
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

function Meter({ x, y, w, h, frac, color, over, idle }: { x: number; y: number; w: number; h: number; frac: number; color: string; over?: boolean; idle?: boolean }) {
  const fw = Math.max(frac * w, frac > 0 ? 3 : 0)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="var(--muted)" opacity={0.35} />
      {fw > 0 ? <rect x={x} y={y} width={fw} height={h} rx={6} fill={color} opacity={idle ? 0.4 : 0.9} className="transition-all duration-300" /> : null}
      <rect x={x} y={y} width={w} height={h} rx={6} fill="none" stroke="var(--border)" strokeWidth={1} />
      {over ? (
        <text x={x + w - 8} y={y + h / 2 + 4} textAnchor="end" className="font-mono" fill="var(--background)" fontSize={10} fontWeight={600}>
          overflow
        </text>
      ) : null}
    </g>
  )
}
