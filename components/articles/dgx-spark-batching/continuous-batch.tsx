"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Continuous batching, drawn as a scene. Each user is a stream with its OWN prompt
// and its OWN KV cache (a paged row of blocks). Every decode step, vLLM gathers all
// ACTIVE streams into one batch and runs a SINGLE fused forward pass through the GPU,
// appending exactly one token to each stream's KV cache. Streams join (queued → in
// batch) and leave (finished → KV freed) mid-flight — the GPU never idles for a slow
// request. Drag concurrency to feel aggregate tok/s rise while per-user tok/s falls;
// drag the step to watch KV caches grow and the batch churn. Deterministic; the tok/s
// figures come from a saturating fit to committed spark-bench runs (see caption).

const ACCENT = "oklch(0.68 0.14 195)" // teal — the fused pass / streams
const KV = "oklch(0.72 0.13 75)" // amber — KV cache blocks

// saturating throughput model, fitted so it reproduces the reported figures:
// 1 user → ~60 tok/s, 32 → ~600, 64 → ~700 aggregate. per-user = aggregate / N.
const AGG_MAX = 842
const KHALF = 13
const aggTps = (n: number) => (AGG_MAX * n) / (n + KHALF)
const perUser = (n: number) => aggTps(n) / n

const LANES = 12 // stream lanes we actually draw
const STEPS = 14 // decode steps on the scrubber
const BLK = 14 // KV blocks a lane can show (each ≈ 16 real tokens)

// deterministic per-lane schedule — no Math.random (unavailable)
const joinStep = (i: number) => (i * 2) % 5 // some streams arrive a few steps in
const promptBlk = (i: number) => 2 + (i % 4) // 2–5 blocks of prompt
const runLen = (i: number) => 7 + ((i * 3) % 6) // 7–12 decode steps then finish
const endStep = (i: number) => joinStep(i) + runLen(i)

// scene geometry (viewBox units)
const W = 760
const UX = 24 // user node x
const UW = 56
const GPUX = 316 // gpu node
const GPUW = 128
const KVX = 556 // kv cache track x
const KVW = 188
const Y0 = 46
const PITCH = 26
const LH = 18
const laneY = (i: number) => Y0 + i * PITCH
const H = Y0 + LANES * PITCH + 8

type Lane = { i: number; active: boolean; queued: boolean; done: boolean; filled: number; total: number }

export function ContinuousBatch() {
  const [n, setN] = useState(16)
  const [step, setStep] = useState(6)

  const shown = Math.min(n, LANES)
  const lanes: Lane[] = Array.from({ length: shown }, (_, i) => {
    const j = joinStep(i)
    const e = endStep(i)
    const queued = step < j
    const done = step > e
    const active = !queued && !done
    const decoded = active ? step - j : done ? runLen(i) : 0
    const total = Math.min(promptBlk(i) + runLen(i), BLK)
    const filled = done ? 0 : Math.min(promptBlk(i) + decoded, BLK)
    return { i, active, queued, done, filled, total }
  })
  const activeCount = lanes.filter((l) => l.active).length

  const gpuTop = laneY(0) - 6
  const gpuBot = laneY(shown - 1) + LH + 6
  const gpuCy = (gpuTop + gpuBot) / 2
  const blkW = (KVW - (BLK - 1) * 2) / BLK

  // fan-in from a user's right edge to the GPU's left face; fan-out GPU → KV cache
  const curveIn = (yi: number, k: number) => {
    const x1 = UX + UW, y1 = yi + LH / 2
    const x2 = GPUX, y2 = gpuCy + (k - (shown - 1) / 2) * 3
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }
  const curveOut = (yi: number, k: number) => {
    const x1 = GPUX + GPUW, y1 = gpuCy + (k - (shown - 1) / 2) * 3
    const x2 = KVX, y2 = yi + LH / 2
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>continuous batching · one fused forward pass per step</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* readouts */}
        <div className="mb-2 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">concurrency</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{n}<span className="text-sm font-normal text-muted-foreground"> users</span></div>
          </div>
          <div>
            <div className="font-mono text-[10px]" style={{ color: ACCENT }}>aggregate</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: ACCENT }}>{aggTps(n).toFixed(0)}<span className="text-xs text-muted-foreground"> tok/s</span></div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">per user</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{perUser(n).toFixed(1)}<span className="text-xs text-muted-foreground"> tok/s</span></div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-mono text-[10px] text-muted-foreground">in batch this step</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{activeCount}<span className="text-xs text-muted-foreground"> / {shown} shown</span></div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${n} concurrent users, each with its own KV cache, batched into one fused forward pass; aggregate ${aggTps(n).toFixed(0)} tokens per second, ${perUser(n).toFixed(1)} per user`}>
          <defs>
            <marker id="cb-in" viewBox="0 -5 10 10" markerWidth="6.5" markerHeight="6.5" orient="auto" refX="6.5" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="cb-out" viewBox="0 -5 10 10" markerWidth="6.5" markerHeight="6.5" orient="auto" refX="6.5" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={KV} strokeWidth={1.5} />
            </marker>
            <filter id="cb-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* column captions */}
          <text x={UX} y={30} className="fill-muted-foreground font-mono" fontSize={10}>users · own prompt</text>
          <text x={GPUX + GPUW / 2} y={30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>GPU · fused pass</text>
          <text x={KVX + KVW} y={30} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>own KV cache (paged)</text>

          {/* connectors behind nodes — only for ACTIVE streams */}
          {lanes.map((l) =>
            l.active ? (
              <g key={`c${l.i}`}>
                <path d={curveIn(laneY(l.i), l.i)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#cb-in)" opacity={0.5} />
                <path d={curveOut(laneY(l.i), l.i)} fill="none" stroke={KV} strokeWidth={1.5} markerEnd="url(#cb-out)" opacity={0.45} />
              </g>
            ) : null
          )}

          {/* GPU fused-pass node */}
          <rect x={GPUX} y={gpuTop} width={GPUW} height={gpuBot - gpuTop} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#cb-soft)" />
          <text x={GPUX + GPUW / 2} y={gpuCy - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>batch of {activeCount}</text>
          <text x={GPUX + GPUW / 2} y={gpuCy + 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>one forward pass</text>
          <text x={GPUX + GPUW / 2} y={gpuCy + 22} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>+1 token each</text>

          {/* lanes: user node + KV cache blocks */}
          {lanes.map((l) => {
            const y = laneY(l.i)
            const dim = l.active ? 1 : 0.32
            return (
              <g key={`l${l.i}`}>
                {/* user node */}
                <rect x={UX} y={y} width={UW} height={LH} rx={6} fill="var(--background)" stroke={l.active ? ACCENT : "var(--border)"} strokeWidth={1.5} opacity={dim} filter={l.active ? "url(#cb-soft)" : undefined} />
                <text x={UX + UW / 2} y={y + 12.5} textAnchor="middle" className="fill-foreground font-mono" fontSize={9} opacity={dim}>u{l.i + 1}</text>

                {/* status tag between user and gpu for queued/done */}
                {l.queued ? (
                  <text x={UX + UW + 8} y={y + 12.5} className="fill-muted-foreground font-mono" fontSize={8}>queued</text>
                ) : l.done ? (
                  <text x={UX + UW + 8} y={y + 12.5} className="fill-muted-foreground font-mono" fontSize={8}>done · KV freed</text>
                ) : null}

                {/* KV cache track + paged blocks */}
                <rect x={KVX} y={y + 2} width={KVW} height={LH - 4} rx={3} fill="var(--muted)" opacity={0.35} />
                {Array.from({ length: BLK }, (_, b) => {
                  const on = b < l.filled
                  const isPrompt = b < promptBlk(l.i) && !l.done
                  return (
                    <rect
                      key={b}
                      x={KVX + b * (blkW + 2)}
                      y={y + 3.5}
                      width={blkW}
                      height={LH - 7}
                      rx={1.5}
                      fill={on ? KV : "var(--muted-foreground)"}
                      opacity={on ? (isPrompt ? 0.55 : 0.95) : 0.12}
                      className="transition-all duration-200"
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>

        {n > LANES ? (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            + {n - LANES} more streams in the same batch (only {LANES} drawn). All {n} share one fused pass per step.
          </p>
        ) : null}

        {/* controls */}
        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>concurrency (users in the batch)</span>
              <span className="tabular-nums">{n}</span>
            </div>
            <Range min={1} max={64} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.68 0.14 195)" />
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>decode step (watch KV caches grow · streams join & leave)</span>
              <span className="tabular-nums">{step}</span>
            </div>
            <Range min={0} max={STEPS} value={step} onChange={(e) => setStep(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.72 0.13 75)" />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every step, the server sweeps up all <span style={{ color: ACCENT }}>active</span> streams and runs{" "}
          <span className="text-foreground">one</span> fused forward pass — appending a single token to each stream&apos;s{" "}
          <span style={{ color: KV }}>own KV cache</span>. Because a lone decode barely uses the GPU, sharing the pass
          across many streams multiplies <span style={{ color: ACCENT }}>aggregate</span> throughput while each user&apos;s
          own rate drifts down. Streams that finish free their KV blocks; queued ones slot in — the batch churns without
          the GPU ever waiting.
        </p>
      </div>
    </figure>
  )
}
