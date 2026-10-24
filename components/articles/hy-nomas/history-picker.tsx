"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Which past latent frames Hy-Nomas's single-GPU preset puts in front of the
// DiT, and what the rest costs to keep.
//
// The selection functions are ports of hymm/models/dit/modules/
// uniform_history_cache.py at commit 01b7dba (temporal_context_frame_indices,
// uniform_frame_indices, recent_mix_uniform_frame_indices). numpy's rint rounds
// half to even, so the port does too. I checked the port against the upstream
// Python run on CPU for T = 18, 30, 60, 90, 150, 240 and 360 with a budget of 18.
// "recent" is the non-archived policy: the newest K frames, nothing kept on CPU.
//
// Shapes (measured from configs/experiment/*.yaml and the safetensors headers):
//   720 x 1280 -> DCAE-V f32 -> 22 x 40 = 880 tokens per latent frame
//   4 video frames per latent frame at 24 fps -> 6 latent frames per second
//   54 double-stream blocks, K and V each 16 heads x 128 = 2,048 wide
//   INT8 KV: 1 byte per value + one FP32 scale per token, head, K and V
//     -> 2 x 2,048 + 2 x 16 x 4 = 4,224 bytes per token per layer
// Text tokens (one block per represented segment) are left out of the bytes.

const TOK = 880
const LAYERS = 54
const BYTES_INT8 = 2 * 2048 + 2 * 16 * 4
const PER_FRAME = TOK * LAYERS * BYTES_INT8 // 200,724,480 bytes
const LF_PER_S = 6

type Mode = "temporal_context" | "uniform" | "recent_mix_uniform" | "recent"

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "temporal_context", label: "temporal_context (shipped)", note: "power-spaced back from the newest frame, gamma 2" },
  { id: "uniform", label: "uniform", note: "evenly spaced over the whole history" },
  { id: "recent_mix_uniform", label: "recent_mix_uniform", note: "half contiguous recent, half spread over the rest" },
  { id: "recent", label: "recent", note: "a true sliding window; no CPU archive, no undo" },
]

function rintEven(x: number) {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

function uniform(T: number, K: number): number[] {
  const n = Math.min(T, K)
  if (n === 0) return []
  if (n === 1) return [T - 1]
  return Array.from({ length: n }, (_, i) => Math.floor((i * (T - 1)) / (n - 1)))
}

function recentMix(T: number, K: number): number[] {
  if (T <= K) return Array.from({ length: T }, (_, i) => i)
  const recent = Math.floor(K / 2)
  const olderEnd = T - recent
  const hist = uniform(olderEnd, K - recent)
  return [...hist, ...Array.from({ length: recent }, (_, i) => olderEnd + i)]
}

function temporalContext(T: number, K: number, gamma = 2): number[] {
  const n = Math.min(T, K)
  if (n === 0) return []
  if (n === 1) return [T - 1]
  if (n === T) return Array.from({ length: T }, (_, i) => i)
  const slack = T - n
  const offsets: number[] = []
  for (let i = 0; i < n; i++) {
    if (i === 0) offsets.push(0)
    else if (i === n - 1) offsets.push(slack)
    else {
      const u = i / (n - 1)
      offsets.push(Math.min(slack, Math.max(0, rintEven(slack * mpow(u, gamma)))))
    }
  }
  const dist = offsets.map((o, i) => i + o)
  return dist.reverse().map((d) => T - 1 - d)
}

function pick(mode: Mode, T: number, K: number) {
  if (mode === "uniform") return uniform(T, K)
  if (mode === "recent_mix_uniform") return recentMix(T, K)
  if (mode === "recent") return Array.from({ length: Math.min(T, K) }, (_, i) => T - Math.min(T, K) + i)
  return temporalContext(T, K)
}

const gb = (b: number) => `${(b / 1e9).toFixed(b >= 1e10 ? 0 : 1)} GB`

const SEL = "oklch(0.62 0.15 160)"
const FIRST = "oklch(0.68 0.15 60)"
const OFF = "oklch(0.62 0.02 250 / 0.22)"

export function HistoryPicker() {
  const [secs, setSecs] = useState(60)
  const [budget, setBudget] = useState(18)
  const [mode, setMode] = useState<Mode>("temporal_context")

  const T = secs * LF_PER_S
  const ids = pick(mode, T, budget)
  const chosen = new Set(ids)
  const inLast5 = ids.filter((i) => i >= T - 5 * LF_PER_S).length
  const reachS = ids.length ? (T - ids[0]) / LF_PER_S : 0
  let maxGap = 0
  for (let i = 1; i < ids.length; i++) maxGap = Math.max(maxGap, ids[i] - ids[i - 1])
  const gpu = ids.length * PER_FRAME
  const cpu = mode === "recent" ? 0 : T * PER_FRAME

  const W = 720
  const H = 46
  const cw = W / T

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>which past frames the next segment attends to</span>
        <span className="text-muted-foreground/60">selection ported from the repo; bytes reasoned from the shapes</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className="cursor-pointer rounded border px-2 py-0.5 font-mono text-[11px]"
              style={mode === m.id ? { background: SEL, color: "white", borderColor: SEL } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mb-2 font-mono text-[11px] text-muted-foreground">{MODES.find((m) => m.id === mode)?.note}</div>

        <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full" role="img" aria-label={`${ids.length} of ${T} past latent frames selected`}>
          {Array.from({ length: T }, (_, i) => (
            <rect
              key={i}
              x={i * cw}
              y={chosen.has(i) ? 0 : 14}
              width={Math.max(cw - (cw > 3 ? 0.6 : 0), 0.5)}
              height={chosen.has(i) ? H : H - 28}
              fill={chosen.has(i) ? (i === 0 ? FIRST : SEL) : OFF}
            />
          ))}
          {Array.from({ length: secs / 5 + 1 }, (_, k) => (
            <text
              key={k}
              x={Math.min(W - 10, Math.max(8, k * 5 * LF_PER_S * cw))}
              y={H + 14}
              fontSize="10"
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
            >
              {k * 5}s
            </text>
          ))}
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">frames on GPU</div>
            <div className="text-lg tabular-nums">
              {ids.length}
              <span className="text-xs text-muted-foreground"> of {T}</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">from the last 5 s</div>
            <div className="text-lg tabular-nums">{inLast5}</div>
          </div>
          <div>
            <div className="text-muted-foreground">reaches back / widest gap</div>
            <div className="text-lg tabular-nums">
              {reachS.toFixed(1)}s<span className="text-xs text-muted-foreground"> / {(maxGap / LF_PER_S).toFixed(1)}s</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">INT8 KV: GPU / CPU archive</div>
            <div className="text-lg tabular-nums">
              {gb(gpu)}
              <span className="text-xs text-muted-foreground"> / {cpu ? gb(cpu) : "none"}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">world so far: {secs} s ({T} latent frames)</span>
            <Range min={5} max={60} step={5} value={secs} onChange={(e) => setSecs(Number(e.target.value))} className="w-full cursor-pointer" accent={SEL} />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">past_frames budget: {budget} (shipped: 18)</span>
            <Range min={6} max={36} step={6} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full cursor-pointer" accent={SEL} />
          </label>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Tall green bars are the latent frames whose keys and values sit on the GPU for the next segment; the orange one is frame zero,
          which every archived policy keeps. With the shipped policy the picks crowd toward the present and thin out toward the start, so a
          minute in, the model still sees the opening shot, but only through a frame every six or seven seconds. Everything else waits in the
          CPU archive, which grows by about 1.2 GB per second of video and is never dropped, because a later selection may want it back.
        </p>
      </div>
    </figure>
  )
}
