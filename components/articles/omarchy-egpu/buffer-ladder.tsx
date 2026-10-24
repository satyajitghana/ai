"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The driver-buffer experiment from the B60 benchmark record, as a picker.
// Every number is a measured llama-bench tg128 mean on the 16-inch M1 Max with
// the B60 behind the tunnel, Llama-2-7B Q4_0, flash attention on. The rows are
// the record's own; nothing is interpolated. "Bus error" rows are the two
// buffer classes whose CPU writes are not alignment-safe on the non-posted BAR.

type Row = { key: string; label: string; where: string; tps: number | null; n: string }

const ROWS: Row[] = [
  { key: "off", label: "Nothing moved (xe 0014, setting off)", where: "every CPU-written driver buffer behind the link", tps: 18.89, n: "n=3" },
  { key: "shader", label: "Shader code", where: "ANV_SHADER_HEAP_VRAM=1", tps: 45.8, n: "n=3" },
  { key: "bt", label: "Shader code + binding tables", where: "one pool on top", tps: 47.5, n: "n=2" },
  { key: "bss", label: "Shader code + bindless surface states", where: "one pool on top", tps: 46.11, n: "n=2" },
  { key: "gs", label: "Shader code + general state", where: "one pool on top", tps: 48.91, n: "n=2" },
  { key: "ipd", label: "Shader code + indirect push descriptors", where: "one pool on top", tps: 46.16, n: "n=2" },
  { key: "ds", label: "Shader code + descriptor sets", where: "one pool on top", tps: 56.12, n: "n=2" },
  { key: "iss", label: "Shader code + internal surface states", where: "one pool on top", tps: null, n: "bus error" },
  { key: "dyn", label: "Shader code + dynamic state", where: "one pool on top", tps: null, n: "bus error" },
  { key: "all", label: "Shader code + all five safe pools", where: "ANV_NP_VRAM_POOLS", tps: 65.96, n: "n=3" },
]

const NATIVE = 70.54

export function BufferLadder() {
  const [key, setKey] = useState("all")
  const row = ROWS.find((r) => r.key === key) ?? ROWS[0]
  const max = 75
  const pct = (v: number) => `${((v / max) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Which driver buffers live in VRAM · Arc Pro B60 over Thunderbolt · Llama-2-7B Q4_0 decode · measured
      </div>

      <div className="grid gap-1 border-b px-4 py-3 sm:grid-cols-2">
        {ROWS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setKey(r.key)}
            className={cn(
              "rounded border px-2 py-1 text-left font-mono text-[11px] transition-colors",
              r.key === key
                ? "border-foreground/40 bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 py-4 text-xs">
        <div>
          <div className="mb-1 flex justify-between font-mono">
            <span className="text-muted-foreground">{row.where}</span>
            <span className="tabular-nums">
              {row.tps === null ? "bus error, no number" : `${row.tps} tok/s`} · {row.n}
            </span>
          </div>
          <div className="relative h-4 rounded-sm bg-muted">
            {row.tps !== null ? (
              <div
                className="h-4 rounded-sm"
                style={{ width: pct(row.tps), background: "oklch(0.55 0.16 250)" }}
              />
            ) : (
              <div className="flex h-4 items-center px-2 font-mono text-[10.5px] text-red-600 dark:text-red-400">
                CPU store into the non-posted BAR faults
              </div>
            )}
            <div
              className="absolute -top-1 h-6 w-0.5 bg-foreground"
              style={{ left: pct(NATIVE) }}
              title="native-PCIe B60 in the public thread"
            />
          </div>
          <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
            black tick: native-PCIe B60, {NATIVE} tok/s fa1 (reported in the llama.cpp Vulkan thread)
          </div>
        </div>
        {row.tps !== null ? (
          <div className="rounded border bg-muted/40 px-3 py-2 font-mono tabular-nums">
            {(1000 / row.tps).toFixed(1)} ms per token · {((row.tps / NATIVE) * 100).toFixed(0)}% of the
            native entry · {(row.tps / 18.89).toFixed(2)}x the stock placement
          </div>
        ) : null}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The weights never moved: they were in VRAM in every row. What moved is the driver&apos;s own
        small buffers (shader code, descriptors, state), which the GPU reads on every dispatch. Behind a
        Thunderbolt tunnel each of those reads crosses the link.
      </figcaption>
    </figure>
  )
}
