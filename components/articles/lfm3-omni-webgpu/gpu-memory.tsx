"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { FULL_LAYERS, HEAD_DIM, KV_HEADS, PARTS, fmtBytes } from "./data"

// The GPU buffers, laid out from the runtime's own allocator and context-cap
// code (read in the Space's bundle; the bundle is minified, constants below
// are the values it computes for this config):
//   full-attention K and V: [6, 1, maxLength, 4, 128]
//   sliding ring K and V:   [5, 1, ringLength, 4, 128], ringLength = 2^ceil(log2(256 + 512)) = 1024
//   conv state:             f32, 24 layers x roundUp(2048 x 7, 64) elements
//   maxLength = min(8192, device-limit cap), cap = min(binding/o, buffer/(6*o)), o = 4*128*dtype

const RING_LEN = (() => {
  let r = 1
  while (r < 256 + 512) r *= 2
  return r
})()
const CONV_BYTES = 24 * (Math.ceil((2048 * 7) / 64) * 64) * 4
const MIB = 1024 * 1024

const LIMITS = [
  { id: "default", label: "WebGPU defaults (256 MiB / 128 MiB)", buf: 256 * MIB, bind: 128 * MIB },
  { id: "mid", label: "2 GiB buffer / 2 GiB binding", buf: 2048 * MIB, bind: 2048 * MIB },
  { id: "big", label: "4 GiB buffer / 4 GiB binding", buf: 4096 * MIB, bind: 4096 * MIB },
] as const

const COLORS = ["#6c5ce7", "#a29bfe", "#00b894", "#fdcb6e", "#e17055", "#0984e3", "#b2bec3"]

export function GpuMemory() {
  const [want, setWant] = useState(8192)
  const [f32, setF32] = useState(false)
  const [vision, setVision] = useState(true)
  const [lim, setLim] = useState<(typeof LIMITS)[number]["id"]>("big")
  const L = LIMITS.find((l) => l.id === lim)!

  const dt = f32 ? 4 : 2
  const o = KV_HEADS * HEAD_DIM * dt
  const cap = Math.min(Math.floor(L.bind / o), Math.floor(L.buf / (FULL_LAYERS * o)))
  const maxLen = Math.min(want, cap)
  const kvFull = FULL_LAYERS * 2 * maxLen * o
  const kvRing = 5 * 2 * RING_LEN * o
  const weights = PARTS.filter((p) => vision || p.id !== "vis")
  const wBytes = weights.reduce((a, b) => a + b.bytes, 0)
  const total = wBytes + kvFull + kvRing + CONV_BYTES

  const segs = [
    ...weights.map((p, i) => ({ k: p.id, label: p.label, bytes: p.bytes, c: COLORS[i % COLORS.length] })),
    { k: "kv", label: `KV, full attention (${maxLen} pos)`, bytes: kvFull, c: "#2d3436" },
    { k: "ring", label: `KV, sliding rings (${RING_LEN} pos x 5)`, bytes: kvRing, c: "#636e72" },
    { k: "conv", label: "conv state (f32)", bytes: CONV_BYTES, c: "#dfe6e9" },
  ]
  const tooBig = PARTS.filter((p) => p.id === "embd" && p.bytes > L.bind)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        resident GPU memory: weights as downloaded, caches as the runtime allocates them
      </div>
      <div className="space-y-3 p-3 font-mono text-[11px] text-muted-foreground sm:p-4">
        <div className="flex h-8 w-full overflow-hidden rounded border" role="img" aria-label={`stacked bar, ${fmtBytes(total)} total`}>
          {segs.map((s) => (
            <div key={s.k} title={`${s.label}: ${fmtBytes(s.bytes)}`} style={{ width: `${(s.bytes / total) * 100}%`, background: s.c, minWidth: 2 }} />
          ))}
        </div>
        <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {segs.map((s) => (
            <li key={s.k} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.c }} />
              <span className="flex-1">{s.label}</span>
              <span className="tabular-nums text-foreground">{fmtBytes(s.bytes)}</span>
            </li>
          ))}
        </ul>
        <div className="text-foreground">total {fmtBytes(total)} before activations and scratch (not measured)</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="flex justify-between">
              <span>requested context</span>
              <span className="tabular-nums text-foreground">{want} (runtime cap 8,192)</span>
            </div>
            <Range min={512} max={8192} step={512} value={want} onChange={(e) => setWant(+e.target.value)} className="w-full" />
          </label>
          <div className="space-y-1">
            <select value={lim} onChange={(e) => setLim(e.target.value as typeof lim)} className="w-full rounded border bg-background px-2 py-1">
              {LIMITS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={f32} onChange={(e) => setF32(e.target.checked)} /> f32 cache
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /> vision tower resident
              </label>
            </div>
          </div>
        </div>
        <div>
          device cap from limits: {cap.toLocaleString("en-US")} positions, so maxLength = {maxLen.toLocaleString("en-US")}.
          {tooBig.length > 0 && " The 215 MB embedding table is larger than this binding limit, so it would have to be split or the limit raised."}
        </div>
      </div>
    </figure>
  )
}
