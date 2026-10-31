"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import {
  IN_POS_PER_S,
  OUT_FRAMES_PER_S,
  TEXT_PER_S_INTERLEAVED,
  fmtBytes,
  kvBytesPerPos,
  part,
} from "./data"

// Token-rate budget. Rates are read from config (12.5 / 12.5 / 6.25 per second);
// the weight traffic per step is REASONED from the GGUF tensor bytes, so
// the headroom figure is an upper bound from memory bandwidth, not a benchmark.

const BLK = part("blk").bytes
const HEAD = part("embd").bytes
const DEPTH_LOW = 186_800_000 // proj_in once + 3 passes of the 3 layers + one full read of the heads
const DEPTH_HIGH = 292_000_000 // heads scored for all 12 codebooks on each of 3 passes
const CODEC = part("codec").bytes

export function TokenBudget() {
  const [inSec, setInSec] = useState(8)
  const [outSec, setOutSec] = useState(12)
  const [inter, setInter] = useState(true)
  const [bw, setBw] = useState(300)
  const [f32, setF32] = useState(false)
  const [high, setHigh] = useState(true)

  const dt = f32 ? 4 : 2
  const inPos = inSec * IN_POS_PER_S
  const frames = outSec * OUT_FRAMES_PER_S
  const text = inter ? outSec * TEXT_PER_S_INTERLEAVED : 0
  const pos = inPos + frames + text
  const kv = pos * kvBytesPerPos(dt)

  const frameBytes = BLK + (high ? DEPTH_HIGH : DEPTH_LOW) + CODEC
  const textBytes = BLK + HEAD
  const perSecOut = OUT_FRAMES_PER_S * frameBytes + (inter ? TEXT_PER_S_INTERLEAVED * textBytes : 0)
  const rtf = (bw * 1e9) / perSecOut

  // the 6-text-then-12-audio stream, first 36 slots
  const slots = Array.from({ length: 36 }, (_, i) => (inter ? (i % 18 < 6 ? "t" : "a") : "a"))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        one second of speech, counted in positions, KV bytes and weight traffic
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        <div className="space-y-3 font-mono text-[11px] text-muted-foreground">
          <label className="block">
            <div className="flex justify-between">
              <span>you speak</span>
              <span className="tabular-nums text-foreground">{inSec} s</span>
            </div>
            <Range min={0} max={30} step={1} value={inSec} onChange={(e) => setInSec(+e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <div className="flex justify-between">
              <span>it answers</span>
              <span className="tabular-nums text-foreground">{outSec} s</span>
            </div>
            <Range min={1} max={60} step={1} value={outSec} onChange={(e) => setOutSec(+e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <div className="flex justify-between">
              <span>memory bandwidth you actually get</span>
              <span className="tabular-nums text-foreground">{bw} GB/s</span>
            </div>
            <Range min={50} max={550} step={10} value={bw} onChange={(e) => setBw(+e.target.value)} className="w-full" />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={inter} onChange={(e) => setInter(e.target.checked)} /> interleaved text + speech
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={f32} onChange={(e) => setF32(e.target.checked)} /> f32 KV cache
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} /> score all 12 heads per pass
            </label>
          </div>
          <div aria-label="output stream pattern" className="flex flex-wrap gap-[3px] pt-1">
            {slots.map((k, i) => (
              <span
                key={i}
                className="inline-block h-4 w-2 rounded-sm"
                style={{ background: k === "t" ? "oklch(0.7 0 0)" : "oklch(0.55 0.2 285)" }}
              />
            ))}
          </div>
          <div>grey: text token, violet: 80 ms speech frame</div>
        </div>
        <dl className="grid grid-cols-[1fr_auto] content-start gap-x-3 gap-y-1.5 font-mono text-xs">
          <dt className="text-muted-foreground">input positions</dt>
          <dd className="tabular-nums">{inPos.toFixed(1)}</dd>
          <dt className="text-muted-foreground">output speech frames</dt>
          <dd className="tabular-nums">{frames.toFixed(1)}</dd>
          <dt className="text-muted-foreground">output text tokens</dt>
          <dd className="tabular-nums">{text.toFixed(1)}</dd>
          <dt className="text-muted-foreground">full-attention KV at {f32 ? "f32" : "f16"}</dt>
          <dd className="tabular-nums">{fmtBytes(kv)}</dd>
          <dt className="text-muted-foreground">weights read per speech frame</dt>
          <dd className="tabular-nums">{fmtBytes(frameBytes)}</dd>
          <dt className="text-muted-foreground">weights read per text token</dt>
          <dd className="tabular-nums">{fmtBytes(textBytes)}</dd>
          <dt className="text-muted-foreground">traffic per second of reply</dt>
          <dd className="tabular-nums">{fmtBytes(perSecOut)}</dd>
          <dt className="text-foreground">bandwidth ceiling on speed</dt>
          <dd className="tabular-nums text-foreground">{rtf.toFixed(1)}x real time</dd>
        </dl>
      </div>
    </figure>
  )
}
