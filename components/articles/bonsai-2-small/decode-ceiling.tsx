"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Batch-1 decode is a memory-bandwidth problem: each generated token streams
// every weight matrix once. So tok/s x bytes-per-token is the effective
// bandwidth a run achieved, and bandwidth / bytes-per-token is the ceiling.
//
// Bytes per token are measured from the GGUF tensor tables: the file's tensor
// data minus the token-embedding table when it is untied (9B), because a
// decode step gathers one row of it, not all of it. The 2B and 4B tie the
// embedding to the LM head, which is read in full. KV cache and the
// linear-attention state are ignored (tg128 at depth 0 keeps them small).
//
// Throughput rows are reported, not re-run, except the CPU row, which is
// measured (llama-bench, 2 threads, shared 4-core cloud VM): 2B tg128, 4B tg64. The pack
// for the iPhone 18 Pro Max figures is not stated anywhere; the whitepaper's
// phone row uses PQ2_0, so that is what is assumed here.

type Pack = "PQ2_0" | "PTQ1_0"
const BYTES: Record<Pack, [number, number, number]> = {
  PQ2_0: [506_313_984, 1_135_427_584, 2_135_640_064],
  PTQ1_0: [418_184_448, 938_512_384, 1_763_952_640],
}
const SIZES = ["2B", "4B", "9B"] as const

type Row = {
  id: string
  device: string
  source: string
  pack: Pack
  tps: [number | null, number | null, number | null]
}

const ROWS: Row[] = [
  { id: "ip18", device: "iPhone 18 Pro Max", source: "launch post, pack not stated", pack: "PQ2_0", tps: [120, 51, 34] },
  { id: "ip17", device: "iPhone 17 Pro Max", source: "whitepaper Table 3", pack: "PQ2_0", tps: [89.9, 39.8, 22.3] },
  { id: "m5p", device: "MacBook Pro M5 Pro, Metal", source: "whitepaper Table 3", pack: "PQ2_0", tps: [229.6, 120.1, 76.5] },
  { id: "4090", device: "RTX 4090", source: "whitepaper Table 3", pack: "PTQ1_0", tps: [603.6, 368.6, 248.6] },
  { id: "cpu", device: "4-core cloud VM, 2 threads", source: "measured here: llama-bench tg128 (2B), tg64 (4B), machine shared with other jobs", pack: "PTQ1_0", tps: [2.2, 0.8, null] },
]

export function DecodeCeiling() {
  const [rowId, setRowId] = useState("ip18")
  const [bw, setBw] = useState(60)
  const row = ROWS.find((r) => r.id === rowId) ?? ROWS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        decode ceiling · tok/s x bytes per token = bandwidth actually used
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1" role="group" aria-label="device">
          {ROWS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRowId(r.id)}
              aria-pressed={r.id === rowId}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                r.id === rowId
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {r.device}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-normal">model ({row.pack})</th>
                <th className="py-1 pr-3 text-right font-normal">GB per token</th>
                <th className="py-1 pr-3 text-right font-normal">tok/s</th>
                <th className="py-1 text-right font-normal">implied GB/s</th>
              </tr>
            </thead>
            <tbody>
              {SIZES.map((s, i) => {
                const b = BYTES[row.pack][i]
                const t = row.tps[i]
                return (
                  <tr key={s} className="border-t">
                    <td className="py-1.5 pr-3 text-foreground">{s}</td>
                    <td className="py-1.5 pr-3 text-right">{(b / 1e9).toFixed(3)}</td>
                    <td className="py-1.5 pr-3 text-right">{t === null ? "not run" : t}</td>
                    <td className="py-1.5 text-right text-foreground">
                      {t === null ? "–" : ((t * b) / 1e9).toFixed(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">source: {row.source}</div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <label className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>if a device sustains</span>
            <span className="text-foreground">{bw} GB/s</span>
          </label>
          <Range min={10} max={1000} step={5} value={bw} onChange={(e) => setBw(Number(e.target.value))} aria-label="memory bandwidth in GB/s" />
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            {SIZES.map((s, i) => (
              <div key={s} className="rounded-md border px-2 py-1.5">
                <div className="text-muted-foreground">{s} ceiling</div>
                <div className="text-sm text-foreground">
                  {((bw * 1e9) / BYTES[row.pack][i]).toFixed(0)} tok/s
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Read down a row: if the implied bandwidth stays roughly flat from 2B to 9B, the device is
          streaming weights as fast as it can and tok/s is just bandwidth divided by model bytes. If the
          small model&apos;s figure is much lower, something other than weight traffic (kernel launch,
          sampling, the Hadamard transform on activations) is setting its pace. The CPU row is the
          extreme case: under 1 GB/s, nowhere near what the memory can do, because these kernels are
          compute-bound on x86.
        </p>
      </div>
    </figure>
  )
}
