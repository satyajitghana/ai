"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { IS_GLOBAL, MACS_OWN_15, MACS_SHARED_20, N_LAYERS, N_OWN } from "./data"

// 35 layers of gemma-4-E2B-it. Layers 0-14 write a KV cache; layers 15-34 read a donor's.
// A bar is the number of token rows the layer computes for a prompt of N tokens x B requests.
// Weight MACs per token come from the safetensors header (data.ts). Reasoned, not timed.

const OWN = "oklch(0.60 0.15 255)"
const SHARED = "oklch(0.62 0.16 35)"
const fmt = (x: number) => (x >= 1e12 ? `${(x / 1e12).toFixed(2)} T` : x >= 1e9 ? `${(x / 1e9).toFixed(1)} G` : `${(x / 1e6).toFixed(0)} M`)

export function FastPrefillStack() {
  const [n, setN] = useState(1024)
  const [b, setB] = useState(4)
  const [fast, setFast] = useState(true)
  const rows = n * b
  const sharedRows = fast ? b : rows
  const base = rows * (MACS_OWN_15 + MACS_SHARED_20)
  const now = rows * MACS_OWN_15 + sharedRows * MACS_SHARED_20
  const BH = 9
  const W = 560

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">token rows computed per layer · weight MACs from the real shapes · reasoned</span>
        <div className="flex gap-1">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setFast(v)}
              aria-pressed={fast === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                fast === v ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {v ? "fast prefill on" : "fast prefill off"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          prompt tokens per request: <span className="text-foreground">{n}</span>
          <input type="range" min={64} max={4096} step={64} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Prompt tokens per request" />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          requests in the batch: <span className="text-foreground">{b}</span>
          <input type="range" min={1} max={32} step={1} value={b} onChange={(e) => setB(Number(e.target.value))} aria-label="Requests in the batch" />
        </label>
      </div>
      <div className="px-3 pb-3 sm:px-4">
        <svg viewBox={`0 0 ${W} ${N_LAYERS * BH + 22}`} role="img" className="h-auto w-full">
          <title>
            Bar chart of 35 layers. Layers 0 to 14 always compute every prompt token. Layers 15 to 34 compute every token when fast
            prefill is off, and only one row per request when it is on.
          </title>
          {Array.from({ length: N_LAYERS }, (_, i) => {
            const shared = i >= N_OWN
            const r = shared ? sharedRows : rows
            const w = Math.max(1.5, (r / rows) * (W - 120))
            return (
              <g key={i}>
                <text x={22} y={i * BH + 7.5} textAnchor="end" fontSize={7} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                  {i}
                  {IS_GLOBAL(i) ? "g" : ""}
                </text>
                <rect x={28} y={i * BH + 1} width={w} height={BH - 2.5} rx={1.5} fill={shared ? SHARED : OWN} fillOpacity={0.75} />
                {i === N_OWN && (
                  <text x={34 + w} y={i * BH + 7.5} fontSize={7.5} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.7}>
                    shared: reads an owner layer&apos;s KV
                  </text>
                )}
                {i === 0 && (
                  <text x={34 + w - 150} y={i * BH + 7.5} fontSize={7.5} fontFamily="ui-monospace, monospace" fill="#fff" fillOpacity={0.9}>
                    own KV
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div>
            <dt className="text-muted-foreground">rows, shared layers</dt>
            <dd>{sharedRows.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">weight MACs, prefill</dt>
            <dd>{fmt(now)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">vs fast prefill off</dt>
            <dd>{(base / now).toFixed(2)}x fewer</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          The ceiling is {((MACS_OWN_15 + MACS_SHARED_20) / MACS_OWN_15).toFixed(2)}x (what is left when the 20 shared layers cost nothing), because the 15 owner layers
          still see every token. Attention-score work, the LM head and launch overhead are not counted. Measured speedups
          will be lower.
        </p>
      </div>
    </figure>
  )
}
