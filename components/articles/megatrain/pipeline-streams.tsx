"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// MegaTrain's core trick, drawn as a scene + timeline. Streaming a layer's weights in
// (H2D) and its gradients out (D2H) over PCIe is slow; done naively the GPU sits idle
// waiting on every transfer. Double-buffering runs three CUDA streams at once — compute
// layer i while the next layer's weights prefetch into the other buffer and the previous
// layer's gradients evacuate — so compute never stalls. The schematic shows the live PCIe
// flow; the Gantt below shows the overlap (and wall-clock win). Flip the mode. Illustrative.

const N = 4 // layers shown
const C = 2 // compute duration
const T = 1 // transfer duration
const AXIS = N * (2 * T + C) // naive total — shared time axis so DB ends visibly sooner

type Block = { lane: 0 | 1 | 2; start: number; len: number; label: string }

// double-buffered: compute contiguous, H2D one step ahead, D2H one step behind
const DB: Block[] = []
for (let i = 0; i < N; i++) {
  DB.push({ lane: 0, start: 2 * i, len: T, label: `W${i}` }) // H2D prefetch
  DB.push({ lane: 1, start: T + i * C, len: C, label: `L${i}` }) // compute
  DB.push({ lane: 2, start: T + (i + 1) * C, len: T, label: `g${i}` }) // D2H
}
const DB_TOTAL = T + N * C + T

// naive: per layer, H2D → compute → D2H, fully serial (GPU idle on transfers)
const NAIVE: Block[] = []
for (let i = 0; i < N; i++) {
  const s = i * (2 * T + C)
  NAIVE.push({ lane: 0, start: s, len: T, label: `W${i}` })
  NAIVE.push({ lane: 1, start: s + T, len: C, label: `L${i}` })
  NAIVE.push({ lane: 2, start: s + T + C, len: T, label: `g${i}` })
}
const NAIVE_TOTAL = N * (2 * T + C)

const LANES = [
  { name: "H2D weights", hue: 250 },
  { name: "compute", hue: 155 },
  { name: "D2H grads", hue: 40 },
]
const H2D = "oklch(0.62 0.15 250)"
const CMP = "oklch(0.64 0.13 155)"
const D2H = "oklch(0.72 0.13 40)"

export function PipelineStreams() {
  const [db, setDb] = useState(true)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)

  const blocks = db ? DB : NAIVE
  const total = db ? DB_TOTAL : NAIVE_TOTAL
  const busy = Math.round((((N * C) / total) * 100))

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x >= total ? 0 : +(x + 0.25).toFixed(2))), 130)
    return () => clearInterval(id)
  }, [playing, total])

  const active = (lane: 0 | 1 | 2) => blocks.find((b) => b.lane === lane && t >= b.start && t < b.start + b.len)
  const aW = active(0)
  const aC = active(1)
  const aG = active(2)

  // ---- scene geometry ----
  const W = 620
  const padL = 96
  const rowH = 28
  const gap = 10
  const SCENE_H = 118
  const GANTT_H = LANES.length * (rowH + gap) + 8
  const H = SCENE_H + GANTT_H + 22
  const sx = (time: number) => padL + (time / AXIS) * (W - padL - 16)

  // schematic nodes
  const hostX = 40, hostY = 26, hostW = 150, hostH = 66
  const gpuX = 400, gpuY = 20, gpuW = 180, gpuH = 78
  const cxMid = (hostX + hostW + gpuX) / 2
  const topY = 42 // H2D path
  const botY = 82 // D2H path

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">CUDA stream pipeline</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
            {playing ? "pause" : "play"}
          </button>
          <div className="flex gap-1">
            {[
              { v: true, label: "double-buffered" },
              { v: false, label: "naive" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  setDb(o.v)
                  setT(0)
                }}
                aria-pressed={db === o.v}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 transition-colors",
                  db === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="System schematic and Gantt timeline of three CUDA streams; double-buffering overlaps weight transfer, compute, and gradient offload over PCIe." className="w-full">
          <defs>
            <marker id="ps-arr-d" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={H2D} strokeWidth={1.5} />
            </marker>
            <marker id="ps-arr-g" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={D2H} strokeWidth={1.5} />
            </marker>
            <filter id="ps-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ================= schematic ================= */}
          {/* host node */}
          <rect x={hostX} y={hostY} width={hostW} height={hostH} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#ps-soft)" />
          <text x={hostX + hostW / 2} y={hostY + 26} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Host RAM</text>
          <text x={hostX + hostW / 2} y={hostY + 44} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>FP32 weights + moments</text>

          {/* gpu node with two buffers + core */}
          <rect x={gpuX} y={gpuY} width={gpuW} height={gpuH} rx={10} fill="var(--background)" stroke={CMP} strokeWidth={1.5} filter="url(#ps-soft)" />
          <text x={gpuX + gpuW / 2} y={gpuY + 15} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>GPU</text>
          {[0, 1].map((bi) => {
            const isPrefetch = !!aW && Number(aW.label.slice(1)) % 2 === bi
            const isCompute = !!aC && Number(aC.label.slice(1)) % 2 === bi
            const on = isPrefetch || isCompute
            return (
              <g key={bi}>
                <rect x={gpuX + 14 + bi * 82} y={gpuY + 24} width={70} height={20} rx={5} fill={isCompute ? CMP : isPrefetch ? H2D : "var(--muted)"} opacity={on ? 0.9 : 0.3} className="transition-all duration-200" />
                <text x={gpuX + 14 + bi * 82 + 35} y={gpuY + 38} textAnchor="middle" className="font-mono" fill={on ? "var(--background)" : "var(--muted-foreground)"} fontSize={9}>buf {bi === 0 ? "A" : "B"}</text>
              </g>
            )
          })}
          <rect x={gpuX + 14} y={gpuY + 50} width={152} height={20} rx={5} fill={aC ? CMP : "var(--muted)"} opacity={aC ? 0.9 : 0.3} className="transition-all duration-200" />
          <text x={gpuX + gpuW / 2} y={gpuY + 64} textAnchor="middle" className="font-mono" fill={aC ? "var(--background)" : "var(--muted-foreground)"} fontSize={9}>{aC ? `compute ${aC.label}` : "compute core"}</text>

          {/* PCIe connectors */}
          <text x={cxMid} y={22} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>PCIe</text>
          <path d={`M ${hostX + hostW + 2} ${topY} C ${cxMid} ${topY}, ${cxMid} ${topY}, ${gpuX - 2} ${topY}`} fill="none" stroke={H2D} strokeWidth={1.5} markerEnd="url(#ps-arr-d)" strokeDasharray="5 5" opacity={aW ? 0.95 : 0.2}>
            {aW ? <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.6s" repeatCount="indefinite" /> : null}
          </path>
          <text x={cxMid} y={topY - 6} textAnchor="middle" className="font-mono" fill={aW ? H2D : "var(--muted-foreground)"} fontSize={9} opacity={aW ? 1 : 0.4}>H2D {aW ? aW.label : "w"}</text>

          <path d={`M ${gpuX - 2} ${botY} C ${cxMid} ${botY}, ${cxMid} ${botY}, ${hostX + hostW + 2} ${botY}`} fill="none" stroke={D2H} strokeWidth={1.5} markerEnd="url(#ps-arr-g)" strokeDasharray="5 5" opacity={aG ? 0.95 : 0.2}>
            {aG ? <animate attributeName="stroke-dashoffset" from="0" to="10" dur="0.6s" repeatCount="indefinite" /> : null}
          </path>
          <text x={cxMid} y={botY + 14} textAnchor="middle" className="font-mono" fill={aG ? D2H : "var(--muted-foreground)"} fontSize={9} opacity={aG ? 1 : 0.4}>D2H {aG ? aG.label : "g"}</text>

          {/* ================= Gantt timeline ================= */}
          <g transform={`translate(0 ${SCENE_H})`}>
            <text x={padL - 8} y={-4} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={8}>time →</text>
            {LANES.map((lane, li) => {
              const y = li * (rowH + gap) + 6
              const laneColor = [H2D, CMP, D2H][li]
              return (
                <g key={li}>
                  <text x={padL - 8} y={y + rowH / 2 + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                    {lane.name}
                  </text>
                  <rect x={padL} y={y} width={W - padL - 16} height={rowH} rx={5} fill="var(--muted)" opacity={0.3} />
                  {blocks
                    .filter((b) => b.lane === li)
                    .map((b, k) => {
                      const isActive = t >= b.start && t < b.start + b.len
                      return (
                        <g key={k}>
                          <rect
                            x={sx(b.start) + 1}
                            y={y + 3}
                            width={(b.len / AXIS) * (W - padL - 16) - 2}
                            height={rowH - 6}
                            rx={4}
                            fill={laneColor}
                            opacity={isActive ? 1 : 0.4}
                            className="transition-all duration-200"
                          />
                          <text
                            x={sx(b.start) + ((b.len / AXIS) * (W - padL - 16)) / 2}
                            y={y + rowH / 2 + 3}
                            textAnchor="middle"
                            className="font-mono"
                            fontSize={9}
                            fill={isActive ? "var(--background)" : "var(--foreground)"}
                          >
                            {b.label}
                          </text>
                        </g>
                      )
                    })}
                </g>
              )
            })}
            {/* playhead */}
            <line x1={sx(t)} y1={-2} x2={sx(t)} y2={GANTT_H - 8} stroke="var(--foreground)" strokeWidth={1.5} />
            {/* end-of-schedule marker */}
            <line x1={sx(total)} y1={-2} x2={sx(total)} y2={GANTT_H - 8} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" />
            <text x={sx(total)} y={GANTT_H + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
              done
            </text>
          </g>
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="wall-clock" value={`${total} u`} highlight={db} />
          <Stat label="GPU busy" value={`${busy}%`} highlight={db} />
          <Stat label="vs naive" value={db ? `${(NAIVE_TOTAL / DB_TOTAL).toFixed(2)}×` : "1.00×"} />
        </div>

        {/* both captions overlaid in one grid cell so the block sizes to the taller
            text and toggling the mode never reflows the prose below */}
        <div className="mt-3 grid">
          <p
            aria-hidden={!db}
            className={cn(
              "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
              db ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            Double-buffered: while the compute stream chews through layer i, the H2D stream
            prefetches layer i+1 into the other buffer and the D2H stream drains layer
            i−1&rsquo;s gradients. The compute lane is gap-free — the GPU never waits on PCIe,
            and removing this one optimization costs MegaTrain 31% of its throughput.
          </p>
          <p
            aria-hidden={db}
            className={cn(
              "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
              !db ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            Naive: each layer runs strictly H2D → compute → D2H, so the GPU stalls during
            every transfer and sits idle roughly half the time. This is the latency
            double-buffering exists to hide.
          </p>
        </div>
      </div>
    </figure>
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
