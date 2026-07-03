"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// MegaTrain's core trick, animated. Streaming a layer's weights in (H2D) and its
// gradients out (D2H) over PCIe is slow; done naively the GPU sits idle waiting on
// every transfer. Double-buffering runs three CUDA streams at once — compute layer
// i while the next layer's weights prefetch into the other buffer and the previous
// layer's gradients evacuate — so compute never stalls. Flip the mode and watch the
// timeline (and GPU-busy %) change. Schedule is illustrative of the mechanism.

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
  { name: "H2D weights", hue: 240 },
  { name: "compute", hue: 150 },
  { name: "D2H grads", hue: 40 },
]

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

  const W = 620
  const padL = 96
  const rowH = 30
  const gap = 10
  const H = LANES.length * (rowH + gap) + 20
  const sx = (time: number) => padL + (time / AXIS) * (W - padL - 16)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">CUDA stream pipeline</span>
        <div className="flex gap-1">
          {[
            { v: true, label: "double-buffered" },
            { v: false, label: "naive (serial)" },
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
                "cursor-pointer rounded px-2 py-1 transition-colors",
                db === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gantt timeline of three CUDA streams; double-buffering overlaps weight transfer, compute, and gradient offload." className="w-full">
          {LANES.map((lane, li) => {
            const y = li * (rowH + gap) + 6
            return (
              <g key={li}>
                <text x={padL - 8} y={y + rowH / 2 + 3} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
                  {lane.name}
                </text>
                <rect x={padL} y={y} width={W - padL - 16} height={rowH} rx="4" fill="var(--muted)" fillOpacity="0.3" />
                {blocks
                  .filter((b) => b.lane === li)
                  .map((b, k) => {
                    const active = t >= b.start && t < b.start + b.len
                    return (
                      <g key={k}>
                        <rect
                          x={sx(b.start) + 1}
                          y={y + 3}
                          width={(b.len / AXIS) * (W - padL - 16) - 2}
                          height={rowH - 6}
                          rx="3"
                          fill={`oklch(0.72 0.14 ${lane.hue})`}
                          fillOpacity={active ? 1 : 0.45}
                        />
                        <text
                          x={sx(b.start) + (b.len / AXIS) * (W - padL - 16) / 2}
                          y={y + rowH / 2 + 3}
                          textAnchor="middle"
                          fontFamily="monospace"
                          fontSize="9"
                          fill={active ? "oklch(0.2 0 0)" : "var(--foreground)"}
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
          <line x1={sx(t)} y1="2" x2={sx(t)} y2={H - 14} stroke="var(--foreground)" strokeWidth="1.5" />
          {/* end-of-schedule marker */}
          <line x1={sx(total)} y1="2" x2={sx(total)} y2={H - 14} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={sx(total)} y={H - 2} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="var(--muted-foreground)">
            done
          </text>
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
