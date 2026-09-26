"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What one streaming step costs, per latency setting.
//
// Every number in CONFIGS is transcribed from nvidia/Nemotron-3-Diarization's
// README: the recommended configurations (in 80 ms frames), the DIHARD III
// full-set DER, and the batch-size-1 RTFx (eager / torch.compile) measured by
// NVIDIA in BF16 on an RTX PRO 5000. The baseline rows are the same card's
// numbers for diar_streaming_sortformer_4spk-v2.1, which has no 0.64 s setting.
//
// What this widget adds is arithmetic, labelled as such:
//   input-buffer latency = (chunk + right context) x 80 ms        (the card's formula)
//   frames per step      = speaker cache + FIFO + chunk + right context, once both are full
//   audio per step       = chunk x 80 ms  (the right context is re-read next step)
//   ms per step          = audio per step / RTFx
// The last line assumes RTFx is steady-state throughput over whole files; the
// first chunks of a stream (empty cache and FIFO) are cheaper, so it is an
// upper-bound reading, not a measurement.

type Cfg = {
  cache: number
  fifo: number
  chunk: number
  rc: number
  eager: number
  compiled: number
  der: number
}

const KEYS = ["30.4", "1.04", "0.64", "0.32"] as const
type Key = (typeof KEYS)[number]

const LABEL: Record<Key, string> = {
  "30.4": "offline-style",
  "1.04": "low",
  "0.64": "very low",
  "0.32": "ultra-low",
}

const NEW: Record<Key, Cfg> = {
  "30.4": { cache: 264, fifo: 40, chunk: 340, rc: 40, eager: 1340, compiled: 4385, der: 12.73 },
  "1.04": { cache: 264, fifo: 264, chunk: 9, rc: 4, eager: 38, compiled: 164, der: 13.18 },
  "0.64": { cache: 264, fifo: 264, chunk: 6, rc: 2, eager: 25, compiled: 113, der: 13.28 },
  "0.32": { cache: 264, fifo: 264, chunk: 3, rc: 1, eager: 12.5, compiled: 54, der: 13.55 },
}

const BASE: Partial<Record<Key, Cfg>> = {
  "30.4": { cache: 188, fifo: 40, chunk: 340, rc: 40, eager: 874, compiled: 1468, der: 19.09 },
  "1.04": { cache: 188, fifo: 188, chunk: 6, rc: 7, eager: 16, compiled: 42, der: 19.6 },
  "0.32": { cache: 188, fifo: 188, chunk: 3, rc: 1, eager: 8, compiled: 21, der: 19.85 },
}

const FRAME_MS = 80
const MAX_FRAMES = 264 + 40 + 340 + 40 // the widest step on the card: 684

const C_CACHE = "oklch(0.60 0.13 250)"
const C_FIFO = "oklch(0.66 0.11 200)"
const C_CHUNK = "oklch(0.70 0.16 140)"
const C_RC = "oklch(0.74 0.14 85)"

function derived(c: Cfg) {
  const frames = c.cache + c.fifo + c.chunk + c.rc
  const latencyS = ((c.chunk + c.rc) * FRAME_MS) / 1000
  const stepAudioMs = c.chunk * FRAME_MS
  return {
    frames,
    latencyS,
    stepAudioMs,
    stepsPerMin: 60000 / stepAudioMs,
    eagerMs: stepAudioMs / c.eager,
    compiledMs: stepAudioMs / c.compiled,
  }
}

const W = 680
const BAR_H = 20
const LEFT = 118
const RIGHT = 8
const sx = (frames: number) => (frames / MAX_FRAMES) * (W - LEFT - RIGHT)

function StepBar({ c, y, name }: { c: Cfg; y: number; name: string }) {
  const parts: { n: number; color: string; label: string }[] = [
    { n: c.cache, color: C_CACHE, label: "speaker cache" },
    { n: c.fifo, color: C_FIFO, label: "FIFO" },
    { n: c.chunk, color: C_CHUNK, label: "chunk" },
    { n: c.rc, color: C_RC, label: "right ctx" },
  ]
  // Left edges derived up front, so nothing is reassigned during render.
  const starts = parts.map((_, i) => LEFT + sx(parts.slice(0, i).reduce((a, p) => a + p.n, 0)))
  const end = LEFT + sx(parts.reduce((a, p) => a + p.n, 0))
  return (
    <g>
      <text x={LEFT - 8} y={y + BAR_H - 6} textAnchor="end" className="fill-foreground font-mono" fontSize={10}>
        {name}
      </text>
      {parts.map((p, i) => {
        const w = sx(p.n)
        const x0 = starts[i]
        return (
          <g key={p.label}>
            <rect x={x0} y={y} width={Math.max(w, 1.5)} height={BAR_H} fill={p.color} opacity={0.85} />
            {w > 40 ? (
              <text
                x={x0 + w / 2}
                y={y + BAR_H - 6}
                textAnchor="middle"
                className="font-mono"
                fontSize={9}
                fill="white"
              >
                {p.n}
              </text>
            ) : null}
          </g>
        )
      })}
      <text x={end + 4} y={y + BAR_H - 6} className="fill-muted-foreground font-mono" fontSize={9}>
        {c.cache + c.fifo + c.chunk + c.rc}
      </text>
    </g>
  )
}

const fmt = (x: number, d = 1) => x.toFixed(d)

export function StreamBudget() {
  const [key, setKey] = useState<Key>("1.04")
  const n = NEW[key]
  const b = BASE[key]
  const dn = derived(n)
  const db = b ? derived(b) : null

  const H = 92

  const rows: { label: string; kind: "card" | "math"; nv: string; bv: string }[] = [
    { label: "input-buffer latency", kind: "math", nv: `${fmt(dn.latencyS, 2)} s`, bv: db ? `${fmt(db.latencyS, 2)} s` : "—" },
    { label: "chunk + right context (frames)", kind: "card", nv: `${n.chunk} + ${n.rc}`, bv: b ? `${b.chunk} + ${b.rc}` : "—" },
    { label: "frames through the encoder per step", kind: "math", nv: `${dn.frames}`, bv: db ? `${db.frames}` : "—" },
    { label: "new audio scored per step", kind: "math", nv: `${fmt(dn.stepAudioMs / 1000, 2)} s`, bv: db ? `${fmt(db.stepAudioMs / 1000, 2)} s` : "—" },
    { label: "steps per minute of audio", kind: "math", nv: fmt(dn.stepsPerMin, 1), bv: db ? fmt(db.stepsPerMin, 1) : "—" },
    { label: "RTFx, batch 1, eager / compiled", kind: "card", nv: `${n.eager} / ${n.compiled}`, bv: b ? `${b.eager} / ${b.compiled}` : "—" },
    { label: "ms of GPU per step, eager / compiled", kind: "math", nv: `${fmt(dn.eagerMs)} / ${fmt(dn.compiledMs)}`, bv: db ? `${fmt(db.eagerMs)} / ${fmt(db.compiledMs)}` : "—" },
    { label: "DIHARD III DER, full set", kind: "card", nv: `${n.der.toFixed(2)}%`, bv: b ? `${b.der.toFixed(2)}%` : "—" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one streaming step: what goes into the encoder, and what it costs</span>
        <span className="text-muted-foreground/60">card numbers + arithmetic</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="latency setting">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={key === k}
              onClick={() => setKey(k)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                key === k ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {k} s · {LABEL[k]}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`At ${key} seconds, each Nemotron 3 Diarization step runs ${dn.frames} frames through the encoder: speaker cache ${n.cache}, FIFO ${n.fifo}, chunk ${n.chunk}, right context ${n.rc}.`}
        >
          <StepBar c={n} y={8} name="Nemotron 3" />
          {b ? (
            <StepBar c={b} y={8 + BAR_H + 10} name="4spk-v2.1" />
          ) : (
            <text x={LEFT} y={8 + BAR_H + 10 + BAR_H - 6} className="fill-muted-foreground font-mono" fontSize={10}>
              4spk-v2.1: no {key} s configuration on the card
            </text>
          )}
          {[
            ["speaker cache", C_CACHE],
            ["FIFO", C_FIFO],
            ["chunk", C_CHUNK],
            ["right context", C_RC],
          ].map(([label, color], i) => (
            <g key={label}>
              <rect x={LEFT + i * 130} y={H - 18} width={10} height={10} fill={color} />
              <text x={LEFT + i * 130 + 14} y={H - 9} className="fill-muted-foreground font-mono" fontSize={9}>
                {label}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-3 overflow-x-auto">
          <table className="my-0 w-full min-w-[460px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-2 py-1.5 text-left font-mono text-[11px] font-medium text-muted-foreground">per step</th>
                <th className="px-2 py-1.5 text-right font-mono text-[11px] font-medium">Nemotron 3</th>
                <th className="px-2 py-1.5 text-right font-mono text-[11px] font-medium text-muted-foreground">4spk-v2.1</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b last:border-b-0">
                  <td className="px-2 py-1 text-[13px]">
                    {r.label}{" "}
                    <span className="font-mono text-[10px] text-muted-foreground">{r.kind === "card" ? "card" : "derived"}</span>
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-xs tabular-nums">{r.nv}</td>
                  <td className="px-2 py-1 text-right font-mono text-xs text-muted-foreground tabular-nums">{r.bv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The cache and the FIFO dominate every streaming step: at 0.32 s the encoder reads 532 frames to score 3 new
          ones. So the GPU time per step barely moves between 1.04 s and 0.32 s (about 19 ms eager, about 4.4 ms
          compiled, on NVIDIA&rsquo;s RTX PRO 5000), and the throughput falls with the step count. Cutting latency does
          not make a step cheaper; it makes more of them.
        </p>
      </div>
    </figure>
  )
}
