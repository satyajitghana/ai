"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Soup's layer-streaming mechanism, drawn as a real pipeline. The frozen 8B base lives
// in pinned host RAM as 32 NF4 shards (112.51 MB each); only TWO of them are ever in
// VRAM at once, in a pair of pre-allocated buffers. A forward pass streams layer 0..31
// in order; the backward recomputation streams the SAME 32 layers again, 31..0, because
// dL/dx = W^T . dL/dy needs the weight a second time. Buffer slot = layer index % 2, so
// the prefetch for the next layer always lands in the buffer NOT currently being read by
// compute — that's what makes the transfer and the matmul overlap instead of serialize.
// Scrub the whole step; the sweep is 32 layers forward, then the same 32 backward.

const N = 32
const STORE_GB = 3.6 // 32 x 112.51 MB, NF4 + double-quant
const PEAK_GB = 3.32 // measured, RTX 3050 Laptop 4 GB
const CARD_GB = 4.0
const BW_NEEDED = 1.6 // GB/s average, this step
const BW_LO = 7.77 // GB/s, idle pinned-copy rate
const BW_HI = 9.38 // GB/s, under real training load

const HOST = "oklch(0.64 0.13 160)"
const GPU = "oklch(0.62 0.15 250)"

function layerAt(t: number): { idx: number; dir: "forward" | "backward" } {
  return t < N ? { idx: t, dir: "forward" } : { idx: 2 * N - 1 - t, dir: "backward" }
}

export function LayerStreamDiagram() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)
  const total = 2 * N - 1 // t=0..31 forward (layer 0..31), t=32..63 backward (layer 31..0)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x >= total ? 0 : x + 1)), 220)
    return () => clearInterval(id)
  }, [playing, total])

  const { idx, dir } = layerAt(t)
  const slot = idx % 2
  const prefetch = dir === "forward" ? idx + 1 : idx - 1
  const prefetchLabel = prefetch > N - 1 ? "head" : prefetch < 0 ? null : String(prefetch)
  const prefetchSlot = prefetch >= 0 && prefetch <= N - 1 ? prefetch % 2 : null

  // scene geometry
  const W = 720
  const H = 210
  const trackY = 20
  const hostX = 40, hostY = 46, hostW = 210, hostH = 116
  const gpuX = 470, gpuY = 46, gpuW = 210, gpuH = 116
  const midX = (hostX + hostW + gpuX) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">layer streaming · 2 VRAM buffers, 32 layers</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Streaming step: ${dir} pass at decoder layer ${idx} of ${N - 1}, resident in buffer slot ${slot === 0 ? "A" : "B"}, ${prefetchLabel ? `prefetching layer ${prefetchLabel} into slot ${prefetchSlot === 0 ? "A" : "B"}` : "no further prefetch"}.`}
        >
          <defs>
            <marker id="ls-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GPU} strokeWidth={1.5} />
            </marker>
            <filter id="ls-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- phase track: 0..31 forward, 31..0 backward ---- */}
          <text x={hostX} y={trackY - 8} className="fill-muted-foreground font-mono" fontSize={9}>
            {dir === "forward" ? "forward: layer 0 → 31" : "backward recompute: layer 31 → 0"}
          </text>
          <rect x={hostX} y={trackY} width={gpuX + gpuW - hostX} height={4} rx={2} fill="var(--muted)" opacity={0.4} />
          <rect
            x={hostX}
            y={trackY}
            width={Math.max((t / total) * (gpuX + gpuW - hostX), 3)}
            height={4}
            rx={2}
            fill={dir === "forward" ? GPU : HOST}
            className="transition-all duration-200"
          />

          {/* ---- host: pinned RAM store ---- */}
          <rect x={hostX} y={hostY} width={hostW} height={hostH} rx={12} fill="var(--background)" stroke={HOST} strokeWidth={1.5} filter="url(#ls-soft)" />
          <text x={hostX + 16} y={hostY + 24} className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Pinned host RAM</text>
          <text x={hostX + 16} y={hostY + 40} className="fill-muted-foreground font-mono" fontSize={9.5}>{STORE_GB.toFixed(2)} GB · 32 × 112.51 MB NF4</text>
          {/* 32 layer ticks */}
          {Array.from({ length: N }, (_, i) => {
            const tw = (hostW - 32) / N
            const active = i === idx
            const willLoad = i === prefetch
            return (
              <rect
                key={i}
                x={hostX + 16 + i * tw}
                y={hostY + 58}
                width={Math.max(tw - 1.5, 1)}
                height={16}
                rx={1.5}
                fill={active ? HOST : willLoad ? GPU : "var(--muted)"}
                opacity={active ? 0.95 : willLoad ? 0.55 : 0.3}
                className="transition-all duration-150"
              />
            )
          })}
          <text x={hostX + 16} y={hostY + 92} className="fill-muted-foreground font-mono" fontSize={9}>
            resident: layer {idx}
          </text>
          <text x={hostX + 16} y={hostY + 106} className="font-mono" fill={prefetchLabel ? GPU : "var(--muted-foreground)"} fontSize={9}>
            {prefetchLabel ? `→ reading layer ${prefetchLabel}` : "→ step complete"}
          </text>

          {/* ---- PCIe link ---- */}
          <text x={midX} y={hostY + 30} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>PCIe Gen4×8</text>
          <path
            d={`M ${hostX + hostW + 2} ${hostY + 44} C ${midX} ${hostY + 44}, ${midX} ${hostY + 44}, ${gpuX - 2} ${hostY + 44}`}
            fill="none" stroke={GPU} strokeWidth={1.5} markerEnd="url(#ls-arr)" strokeDasharray="5 5" opacity={prefetchLabel ? 0.95 : 0.2}
          >
            {prefetchLabel ? <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.6s" repeatCount="indefinite" /> : null}
          </path>
          <text x={midX} y={hostY + 44 - 6} textAnchor="middle" className="font-mono" fill={prefetchLabel ? GPU : "var(--muted-foreground)"} fontSize={9} opacity={prefetchLabel ? 1 : 0.4}>
            H2D {prefetchLabel ? `layer ${prefetchLabel}` : ""}
          </text>

          {/* ---- GPU: 2 buffers + compute core ---- */}
          <rect x={gpuX} y={gpuY} width={gpuW} height={gpuH} rx={12} fill="var(--background)" stroke={GPU} strokeWidth={1.5} filter="url(#ls-soft)" />
          <text x={gpuX + 16} y={gpuY + 24} className="fill-foreground font-mono" fontSize={12} fontWeight={600}>GPU</text>
          <text x={gpuX + 16} y={gpuY + 40} className="fill-muted-foreground font-mono" fontSize={9.5}>2 × 112.51 MB buffers</text>
          {[0, 1].map((s) => {
            const isCompute = s === slot
            const isLoading = s === prefetchSlot
            return (
              <g key={s}>
                <rect
                  x={gpuX + 16 + s * ((gpuW - 32 - 10) / 2 + 10)} y={gpuY + 52}
                  width={(gpuW - 32 - 10) / 2} height={26} rx={6}
                  fill={isCompute ? GPU : isLoading ? HOST : "var(--muted)"}
                  opacity={isCompute ? 0.92 : isLoading ? 0.55 : 0.28}
                  className="transition-all duration-150"
                />
                <text
                  x={gpuX + 16 + s * ((gpuW - 32 - 10) / 2 + 10) + (gpuW - 32 - 10) / 4}
                  y={gpuY + 69} textAnchor="middle" className="font-mono"
                  fill={isCompute || isLoading ? "var(--background)" : "var(--muted-foreground)"} fontSize={9.5} fontWeight={600}
                >
                  {s === 0 ? "A" : "B"} · {isCompute ? `L${idx}` : isLoading ? `L${prefetchLabel}` : "–"}
                </text>
              </g>
            )
          })}
          <rect x={gpuX + 16} y={gpuY + 86} width={gpuW - 32} height={24} rx={6} fill={GPU} opacity={0.9} />
          <text x={gpuX + gpuW / 2} y={gpuY + 102} textAnchor="middle" className="font-mono" fill="var(--background)" fontSize={9.5} fontWeight={600}>
            compute · dequant + matmul
          </text>
        </svg>

        {/* controls */}
        <Range
          min={0} max={total} step={1} value={t}
          onChange={(e) => setT(parseInt(e.target.value))}
          className="mt-1 w-full cursor-pointer"
          aria-label="streaming step, layer index"
          accent={GPU}
        />

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="peak VRAM" value={`${PEAK_GB.toFixed(2)} GB`} sub={`of ${CARD_GB.toFixed(2)} GB card`} />
          <Stat label="host store" value={`${STORE_GB.toFixed(2)} GB`} sub="pinned, 32 layers" />
          <Stat label="H2D loads" value="61" sub="of a naive 64" />
          <Stat label="bandwidth used" value={`${BW_NEEDED.toFixed(2)} GB/s`} sub={`link: ${BW_LO}–${BW_HI} GB/s`} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every layer is read <span className="text-foreground">twice</span> per step — once forward, once in the
          backward recomputation, because <code>dL/dx = W^T &middot; dL/dy</code> still needs the frozen weight.
          Two buffers are enough because the prefetch for layer i&plusmn;1 always targets the slot compute finished
          with, one step ago — that&rsquo;s the whole overlap. Moving 61 &times; 112.53 MB in a 4.281 s step needs{" "}
          {BW_NEEDED.toFixed(2)} GB/s on average; the link sustains {BW_LO}&ndash;{BW_HI} GB/s. The run is
          compute-bound, not transfer-bound — deleting every H2D byte only speeds the step up 1.4%.
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium text-foreground")}>{value}</div>
      {sub ? <div className="text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  )
}
