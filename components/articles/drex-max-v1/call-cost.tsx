"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CASES, MACHINES, MEMORY } from "./data"

// What one decision call costs. Compute: reasoned from the real config (two FLOPs per
// weight per token, 4 N^2 d per full-attention layer, vision by patch count). Memory:
// the file sizes (measured) against machines the README names (reported).

const fmt = (x: number) => (x >= 100 ? Math.round(x).toLocaleString("en-US") : x.toFixed(x >= 10 ? 1 : 2))

export function CallCost() {
  const [ci, setCi] = useState(2)
  const [mi, setMi] = useState(3)
  const c = CASES[ci]
  const total = c.matmul + c.attention + c.vision
  const maxTotal = Math.max(...CASES.map((x) => x.matmul + x.attention + x.vision))
  const machine = MACHINES[mi]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="grid gap-4 p-3 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <div className="font-mono text-[10px] text-muted-foreground">compute per decision call, TFLOP (reasoned)</div>
          {CASES.map((x, i) => {
            const t = x.matmul + x.attention + x.vision
            return (
              <button key={x.id} type="button" onClick={() => setCi(i)} className={cn("grid gap-0.5 rounded border px-2 py-1 text-left", ci === i ? "border-foreground" : "border-transparent")}>
                <span className="flex justify-between font-mono text-[11px]">
                  <span>{x.label}</span>
                  <span>{fmt(t)}</span>
                </span>
                <span className="flex h-2 rounded bg-muted">
                  <span className="h-2 rounded-l bg-sky-600" style={{ width: `${((100 * x.matmul) / maxTotal).toFixed(2)}%` }} />
                  <span className="h-2 bg-amber-500" style={{ width: `${((100 * x.attention) / maxTotal).toFixed(2)}%` }} />
                  <span className="h-2 rounded-r bg-rose-400" style={{ width: `${((100 * x.vision) / maxTotal).toFixed(2)}%` }} />
                </span>
              </button>
            )
          })}
          <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-sky-600" /> weights x tokens</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> full attention</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-rose-400" /> vision tower</span>
          </div>
          <p className="font-mono text-[11px]">
            {c.label}: {fmt(total)} TFLOP. Weights {fmt(c.matmul)}, attention {fmt(c.attention)}, vision {fmt(c.vision)}. {c.note}.
          </p>
        </div>
        <div className="grid content-start gap-2">
          <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
            <span className="text-muted-foreground">machine memory:</span>
            {MACHINES.map((m, i) => (
              <button key={m} type="button" onClick={() => setMi(i)} className={cn("rounded border px-2 py-0.5", mi === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>
                {m} GB
              </button>
            ))}
          </div>
          {MEMORY.map((x) => {
            const over = x.gib > machine
            return (
              <div key={x.id} className="grid gap-0.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>{x.label}</span>
                  <span>{x.gib.toFixed(2)} GiB {over ? "does not fit" : "fits"}</span>
                </div>
                <div className="relative h-2 rounded bg-muted">
                  <div className={cn("h-2 rounded", over ? "bg-rose-500" : "bg-emerald-600")} style={{ width: `${Math.min(100, (100 * x.gib) / 64).toFixed(2)}%` }} />
                  <div className="absolute top-[-2px] h-3 w-[2px] bg-foreground" style={{ left: `${((100 * machine) / 64).toFixed(2)}%` }} />
                </div>
                <div className="text-muted-foreground">{x.note}</div>
              </div>
            )
          })}
          <p className="font-mono text-[10px] text-muted-foreground">
            The weights are not the whole bill: the keys and values of the 16 attention layers are 64 KiB per token (1 GiB at 16,384 tokens), and the 48 DeltaNet layers hold a fixed 144 MiB (reasoned). The bar is full width at 64 GiB.
          </p>
        </div>
      </div>
    </figure>
  )
}
