"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2, mpow } from "@/lib/dmath"

import { ALWAYS_READ_BYTES, BITS_PER_NVFP4, EXPERT_PARAMS, NODES, N_EXPERTS, SPARSE_LAYERS, TOPK } from "./data"

// Bytes of weights one decode step has to read, as a function of how many
// sequences are decoded together. Reasoned, not measured: it assumes each token
// picks its 4 experts independently and uniformly, which real routers do not.
// The sizes and counts are read from the headers; the bandwidth is nominal.

const ACCENT = "oklch(0.62 0.16 35)"
const W = 620
const H = 210
const PX = 50
const PY = 12
const PW = W - PX - 14
const PH = H - PY - 34
const MAXB = 9 // batch = 2^0 .. 2^9

const touched = (batch: number) => 1 - mpow(1 - TOPK / N_EXPERTS, batch)
const expertBytes = (fmt: "fp8" | "fp4") => EXPERT_PARAMS * (fmt === "fp8" ? 1 : BITS_PER_NVFP4 / 8)
const stepBytes = (batch: number, fmt: "fp8" | "fp4") =>
  ALWAYS_READ_BYTES + SPARSE_LAYERS * N_EXPERTS * touched(batch) * expertBytes(fmt)

const FULL = (fmt: "fp8" | "fp4") => stepBytes(1e9, fmt)
const sx = (e: number) => PX + (e / MAXB) * PW
const sy = (gb: number, top: number) => PY + PH - (gb / top) * PH

export function BatchReads() {
  const [e, setE] = useState(0)
  const [fp4, setFp4] = useState(false)
  const [node, setNode] = useState(1)
  const fmt = fp4 ? "fp4" : "fp8"
  const batch = Math.round(mpow(2, e))
  const gb = stepBytes(batch, fmt) / 1e9
  const top = Math.ceil(FULL(fmt) / 1e11) * 100
  const n = NODES[node]
  const stepsPerS = (n.tbs * 1e12) / (gb * 1e9)
  const pts = Array.from({ length: 91 }, (_, i) => {
    const x = (i / 90) * MAXB
    return `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(stepBytes(mpow(2, x), fmt) / 1e9, top).toFixed(1)}`
  }).join(" ")
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">weights read per decode step · sizes measured, routing assumed uniform · reasoned</span>
        <div className="flex gap-1 font-mono text-xs" role="group" aria-label="Weight format">
          {(
            [
              [false, "FP8"],
              [true, "NVFP4-style"],
            ] as const
          ).map(([v, l]) => (
            <button key={l} type="button" aria-pressed={fp4 === v} onClick={() => setFp4(v)} className={`rounded-md border px-2 py-1 ${fp4 === v ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Gigabytes of weights read in one decode step against the number of sequences decoded together, on a log axis from 1 to 512.
            One sequence reads about 53 GB in FP8; the curve climbs towards the full 1,049 GB as more experts are hit.
          </title>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PX} x2={PX + PW} y1={sy(f * top, top)} y2={sy(f * top, top)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PX - 6} y={sy(f * top, top) + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {Math.round(f * top)}
              </text>
            </g>
          ))}
          {Array.from({ length: MAXB + 1 }, (_, i) => (
            <text key={i} x={sx(i)} y={H - 18} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
              {1 << i}
            </text>
          ))}
          <text x={PX + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            sequences decoded together
          </text>
          <text x={12} y={PY + PH / 2} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55} transform={`rotate(-90 12 ${PY + PH / 2})`} textAnchor="middle">
            GB read per step
          </text>
          <path d={pts} fill="none" stroke={ACCENT} strokeWidth={2} />
          <line x1={sx(e)} x2={sx(e)} y1={PY} y2={PY + PH} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 3" />
          <circle cx={sx(e)} cy={sy(gb, top)} r={5} fill={ACCENT} stroke="var(--background)" strokeWidth={1.5} />
        </svg>
        <label className="mt-1 flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">batch</span>
          <Range min={0} max={MAXB} step={0.25} value={e} onChange={(ev) => setE(Number(ev.target.value))} aria-label="Sequences decoded together" accent={ACCENT} />
          <span className="w-10 text-right tabular-nums">{batch}</span>
        </label>
        <div className="mt-2 flex flex-wrap gap-1 font-mono text-xs" role="group" aria-label="Hardware">
          {NODES.slice(0, 4).map((x, i) => (
            <button key={x.id} type="button" aria-pressed={node === i} onClick={() => setNode(i)} className={`rounded-md border px-2 py-1 ${node === i ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {x.label}
            </button>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["experts hit per layer", `${(touched(batch) * N_EXPERTS).toFixed(1)} of 128`],
            ["read per step", `${gb.toFixed(0)} GB`],
            ["step ceiling", `${stepsPerS.toFixed(0)} /s`],
            ["token ceiling", `${(stepsPerS * batch).toFixed(0)} /s`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Ceilings divide nominal aggregate HBM bandwidth ({n.tbs.toFixed(1)} TB/s) by bytes read. They ignore attention over the KV cache, communication between GPUs and
          every kernel inefficiency, so a real server sits below them. About {Math.round(mlog2(batch))} doublings of batch from one sequence.
        </p>
      </div>
    </figure>
  )
}
