"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The Apple Silicon speedups, PR figure against my run. MEASURED columns: torch 2.14.1 and 2.15.0 macOS wheels from
// PyPI on an M1 Max (macOS 26.6), same shape and dtype as the PR table, each process = warmup then 15 samples of
// 100 back-to-back calls and one torch.mps.synchronize (10 calls per sample for norm; 10 samples of 2 calls for upsample backward; QR: 5 single
// calls). 10 processes per wheel, alternating 2.14.1 / 2.15.0 (QR: 10 on 2.15.0, 3 on 2.14.1, whose calls take 21 s). Value = median of the per-process
// medians; lo/hi = fastest and slowest process median. REPORTED columns: the PR's own table (hardware not stated in
// the PR except where noted), or the blog for QR.

type Row = {
  op: string
  shape: string
  pr: string
  prOld: number
  prNew: number
  unit: "us" | "ms"
  old: number
  oldLo: number
  oldHi: number
  neu: number
  neuLo: number
  neuHi: number
}

const ROWS: Row[] = [
  { op: "softmax", shape: "1x128256 fp32, last dim", pr: "#196071", prOld: 57.37, prNew: 7.14, unit: "us", old: 101.5, oldLo: 100.8, oldHi: 129.8, neu: 29.0, neuLo: 24.3, neuHi: 36.4 },
  { op: "F.linear", shape: "1x1x896 by 128x896 + bias, bf16", pr: "#198721", prOld: 29.2, prNew: 5.8, unit: "us", old: 22.3, oldLo: 20.7, oldHi: 44.0, neu: 11.7, neuLo: 9.8, neuHi: 13.1 },
  { op: "F.linear", shape: "1x1x896 by 896x896 + bias, bf16", pr: "#198721", prOld: 33.5, prNew: 10.7, unit: "us", old: 24.7, oldLo: 22.7, oldHi: 63.1, neu: 13.0, neuLo: 11.5, neuHi: 18.0 },
  { op: "vector_norm", shape: "4096x4096 bf16, full", pr: "#198611", prOld: 17608, prNew: 104, unit: "us", old: 39542, oldLo: 39509, oldHi: 40578, neu: 92.3, neuLo: 87.8, neuHi: 97.5 },
  { op: "upsample bwd", shape: "bilinear (2,150,80,80) to 640x640, channels-last", pr: "#199687", prOld: 56.526, prNew: 2.608, unit: "ms", old: 112.4, oldLo: 109.2, oldHi: 117.7, neu: 19.25, neuLo: 18.9, neuHi: 20.7 },
  { op: "linalg.qr", shape: "512x512 fp32", pr: "blog", prOld: 7000, prNew: 1.5, unit: "ms", old: 21024, oldLo: 20859, oldHi: 21825, neu: 4.99, neuLo: 4.5, neuHi: 5.69 },
]

const ratio = (a: number, b: number) => a / b
const fmtX = (x: number) => (x >= 100 ? `${Math.round(x).toLocaleString("en-US")}x` : `${x.toFixed(x >= 10 ? 0 : 1)}x`)
const fmtT = (v: number, u: string) => `${v >= 1000 ? Math.round(v).toLocaleString("en-US") : v} ${u === "us" ? "µs" : "ms"}`

// log scale from 1x to 10,000x
const pos = (x: number) => Math.max(0, Math.min(100, (mlog10(x) / 4) * 100))

export function MpsCheck() {
  const [sel, setSel] = useState(0)
  const r = ROWS[sel]
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="space-y-3">
        {ROWS.map((x, k) => {
          const mine = ratio(x.old, x.neu)
          const theirs = ratio(x.prOld, x.prNew)
          const lo = ratio(x.oldLo, x.neuHi)
          const hi = ratio(x.oldHi, x.neuLo)
          return (
            <button key={k} type="button" onClick={() => setSel(k)} aria-pressed={sel === k} className={cn("block w-full rounded p-1.5 text-left", sel === k ? "bg-muted" : "hover:bg-muted/50")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span>
                  <b className="font-mono">{x.op}</b> <span className="text-muted-foreground">{x.shape}</span>
                </span>
                <span>
                  M1 Max <b>{fmtX(mine)}</b> · {x.pr === "blog" ? "blog" : `PR ${x.pr}`} {fmtX(theirs)}
                </span>
              </div>
              <div className="relative mt-1 h-4 rounded bg-muted/60" aria-hidden="true">
                <div className="absolute inset-y-1 rounded bg-primary/25" style={{ left: `${pos(lo)}%`, width: `${Math.max(0.6, pos(hi) - pos(lo))}%` }} />
                <div className="absolute inset-y-0 w-1 rounded bg-primary" style={{ left: `${pos(mine)}%` }} />
                <div className="absolute inset-y-0 w-1 rounded bg-foreground/60" style={{ left: `${pos(theirs)}%` }} />
              </div>
            </button>
          )
        })}
        <div className="flex justify-between text-[10px] text-muted-foreground" aria-hidden="true">
          <span>1x</span>
          <span>10x</span>
          <span>100x</span>
          <span>1,000x</span>
          <span>10,000x</span>
        </div>
      </div>
      <div className="mt-3 rounded border border-border p-3 text-xs" aria-live="polite">
        <div className="font-medium">
          {r.op}, {r.shape}
        </div>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          <span>
            2.14.1 on my M1 Max: <b>{fmtT(r.old, r.unit)}</b> (processes ranged {fmtT(r.oldLo, r.unit)} to {fmtT(r.oldHi, r.unit)})
          </span>
          <span>
            2.15.0 on my M1 Max: <b>{fmtT(r.neu, r.unit)}</b> ({fmtT(r.neuLo, r.unit)} to {fmtT(r.neuHi, r.unit)})
          </span>
          <span className="text-muted-foreground">
            {r.pr === "blog" ? "Blog" : `PR ${r.pr}`}: {fmtT(r.prOld, r.unit)} before, {fmtT(r.prNew, r.unit)} after
          </span>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Speedup of 2.15.0 over 2.14.1 on a log scale. Blue tick: my median; band: the slowest-to-fastest pairing of process medians; grey tick: the figure the PR or blog reports. Ten processes per wheel, alternated (QR: ten on 2.15.0, three on 2.14.1).
      </figcaption>
    </figure>
  )
}
