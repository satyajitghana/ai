"use client"

import { useEffect, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// A sliding window of L = 16 frames walks along a video of T frames. Two ways
// of holding the scene are counted after every window:
//
//   frame-local     every frame adds its full grid of tokens:        N = P * T
//   de-duplicated   co-located points are merged at each boundary,
//                   so only never-seen surface adds to the memory:   M = P * (1 + rho * (T - 1))
//                   and the window in flight adds its own frames:    A = M(prev) + L * P
//
// P = 12,150 tokens per frame is the rate in TrackEverything's teaser plot
// (4.86M frame-local tokens after 400 frames). rho is the fraction of each new
// frame that shows surface the model has never seen. Everything else about the
// model (per-frame voxelization, which shrinks both terms; weights; attention
// cost) is left out on purpose: this counts tokens, it does not measure memory.

const L = 16
const P = 12150
const T_MAX = 1200
const RHO_STOPS = [0, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100] as const // percent per frame

const RED = "oklch(0.63 0.2 27)"
const GREEN = "oklch(0.62 0.15 150)"
const WINDOW = "oklch(0.7 0.14 75)"

// Chart geometry (SVG user units).
const W = 560
const H = 250
const X0 = 46
const X1 = W - 12
const Y0 = 12
const Y1 = H - 26
const LO = 3 // 1k tokens
const HI = 7.4 // ~25M tokens
const xf = (t: number) => X0 + (t / T_MAX) * (X1 - X0)
const yf = (n: number) => Y0 + ((HI - Math.min(HI, Math.max(LO, mlog10(Math.max(n, 1))))) / (HI - LO)) * (Y1 - Y0)

const Y_TICKS = [
  [1e3, "1k"],
  [1e4, "10k"],
  [1e5, "100k"],
  [1e6, "1M"],
  [1e7, "10M"],
] as const
const X_TICKS = [0, 200, 400, 600, 800, 1000, 1200] as const

// Carried memory after `frames` frames have been de-duplicated.
function carried(frames: number, rho: number) {
  if (frames <= 0) return 0
  return P * (1 + rho * (frames - 1))
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}k`
  return n.toFixed(0)
}

export function DedupTimeline() {
  const [T, setT] = useState(400)
  const [rhoIdx, setRhoIdx] = useState(3)
  const [playing, setPlaying] = useState(false)
  const rhoPct = RHO_STOPS[rhoIdx]
  const rho = rhoPct / 100

  // One window per tick while playing; stops itself at the end of the axis.
  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => {
      if (T >= T_MAX) setPlaying(false)
      else setT(Math.min(T + L, T_MAX))
    }, 70)
    return () => window.clearTimeout(id)
  }, [playing, T])

  const K = T / L // windows processed (T is a multiple of L)
  const frameLocal = P * T
  const memory = carried(T, rho)
  const peak = carried(T - L, rho) + L * P
  const ratio = frameLocal / peak

  // Series sampled at each window boundary, up to T.
  const bounds: number[] = []
  for (let t = L; t <= T; t += L) bounds.push(t)
  const redPath = bounds.map((t, i) => `${i ? "L" : "M"}${xf(t).toFixed(1)},${yf(P * t).toFixed(1)}`).join(" ")
  // Peak inside each window: what was carried in, plus the window's own frames.
  let peakPath = ""
  for (let k = 1; k <= bounds.length; k++) {
    const start = (k - 1) * L
    const act = carried(start, rho) + L * P
    peakPath += `${k === 1 ? "M" : "L"}${xf(start).toFixed(1)},${yf(act).toFixed(1)} L${xf(k * L).toFixed(1)},${yf(act).toFixed(1)} `
  }
  // Carried memory, read at each boundary once that window has been merged.
  const greenPath = bounds.map((t, i) => `${i ? "L" : "M"}${xf(t).toFixed(1)},${yf(carried(t, rho)).toFixed(1)}`).join(" ")

  const winX0 = xf(T - L)
  const winX1 = xf(T)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>tokens held (log) vs frames · windows of 16 · 12,150 tokens per frame</span>
        <span className="tabular-nums">{K} windows</span>
      </div>

      <div className="px-3 pt-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} 44`}
          role="img"
          aria-label={`Timeline of ${T} frames split into ${K} windows of 16 frames. The last window, frames ${T - L} to ${T - 1}, is the one in flight.`}
          className="w-full"
        >
          <rect x={X0} y="10" width={X1 - X0} height="16" rx="3" fill="var(--muted)" stroke="var(--border)" />
          <rect x={X0} y="10" width={Math.max(xf(T) - X0, 0)} height="16" rx="3" fill="var(--border)" />
          {bounds.map((t) => (
            <line key={t} x1={xf(t)} y1="10" x2={xf(t)} y2="26" stroke="var(--background)" strokeWidth="0.8" />
          ))}
          <rect x={winX0} y="7" width={Math.max(winX1 - winX0, 2)} height="22" rx="2" fill="none" stroke={WINDOW} strokeWidth="2" />
          <text x={X0} y="40" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
            frame 0
          </text>
          <text x={Math.min(Math.max(winX1, X0 + 215), X1)} y="40" textAnchor="end" fontFamily="monospace" fontSize="10" fill={WINDOW}>
            window in flight: frames {T - L}–{T - 1}
          </text>
        </svg>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Tokens held after ${T} frames, log scale. Frame-local: ${fmt(frameLocal)}. De-duplicated memory: ${fmt(memory)}. Peak during the last window, memory plus that window's own frames: ${fmt(peak)}. Ratio ${ratio.toFixed(1)} to 1.`}
          className="w-full"
        >
          {Y_TICKS.map(([v, label]) => (
            <g key={label}>
              <line x1={X0} y1={yf(v)} x2={X1} y2={yf(v)} stroke="var(--border)" strokeWidth="0.8" />
              <text x={X0 - 6} y={yf(v) + 3} textAnchor="end" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
                {label}
              </text>
            </g>
          ))}
          {X_TICKS.map((t) => (
            <text key={t} x={xf(t)} y={H - 8} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
              {t}
            </text>
          ))}

          <line x1={xf(96)} y1={Y0} x2={xf(96)} y2={Y1} stroke="var(--muted-foreground)" strokeWidth="0.8" strokeDasharray="3 3" />
          <text x={xf(96) + 4} y={Y0 + 9} fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
            ~96: prior all-frame dense trackers run out of memory (reported)
          </text>

          <rect x={winX0} y={Y0} width={Math.max(winX1 - winX0, 2)} height={Y1 - Y0} fill={WINDOW} opacity="0.12" />
          <path d={redPath} fill="none" stroke={RED} strokeWidth="2" />
          <path d={peakPath} fill="none" stroke={GREEN} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.8" />
          <path d={greenPath} fill="none" stroke={GREEN} strokeWidth="2" />
          <circle cx={xf(T)} cy={yf(frameLocal)} r="3.5" fill={RED} />
          <circle cx={xf(T)} cy={yf(memory)} r="3.5" fill={GREEN} />
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs tabular-nums sm:grid-cols-4">
          <div className="flex flex-col">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-full" style={{ background: RED }} />
              frame-local
            </dt>
            <dd className="text-foreground">{fmt(frameLocal)} tokens</dd>
          </div>
          <div className="flex flex-col">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-full" style={{ background: GREEN }} />
              de-duplicated memory
            </dt>
            <dd className="text-foreground">{fmt(memory)} tokens</dd>
          </div>
          <div className="flex flex-col">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: GREEN }} />
              peak, last window
            </dt>
            <dd className="text-foreground">{fmt(peak)} tokens</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">frame-local ÷ peak</dt>
            <dd className="text-foreground">{ratio.toFixed(1)}×</dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>video length T</span>
              <span className="tabular-nums text-foreground">{T} frames</span>
            </div>
            <Range
              min={L}
              max={T_MAX}
              step={L}
              value={T}
              onChange={(e) => {
                setPlaying(false)
                setT(parseInt(e.target.value, 10))
              }}
              className="w-full cursor-pointer"
              aria-label="video length in frames"
              accent={WINDOW}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>new surface per frame, ρ</span>
              <span className="tabular-nums text-foreground">{rhoPct}%</span>
            </div>
            <Range
              min={0}
              max={RHO_STOPS.length - 1}
              step={1}
              value={rhoIdx}
              onChange={(e) => setRhoIdx(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer"
              aria-label="fraction of each frame that shows never-seen surface, in percent"
              accent={GREEN}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!playing && T >= T_MAX) setT(L)
              setPlaying((p) => !p)
            }}
            className="rounded-md border px-3 py-1.5 font-mono text-xs hover:bg-muted"
          >
            {playing ? "pause" : "slide the window"}
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The red line is a frame-local tracker: every frame adds its whole grid, so it holds
          12,150 × T tokens. The solid green line is the de-duplicated memory, 12,150 × (1 + ρ(T − 1)):
          a surface seen again lands in a voxel that already exists, so only the fraction ρ of each
          frame that is genuinely new adds anything. The dashed green line is the peak inside a
          window, that memory plus the window&apos;s own 16 frames (194,400 tokens), a constant that
          does not grow with T. Both are linear in T; de-duplication cuts the slope from 12,150 to 12,150 × ρ tokens per frame. At
          ρ = 100%, every frame is new territory and the two lines meet. This is a token count
          with the paper&apos;s rate, not a memory measurement.
        </p>
      </div>
    </figure>
  )
}
