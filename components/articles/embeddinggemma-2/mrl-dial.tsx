"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The model card's truncation table: seven benchmark averages at the four
// Matryoshka widths. Scores are Google's; the "% kept" column is each score
// over its own 768d value, and the storage cells are d x bytes x one million
// vectors, vectors only.

const DIMS = [768, 512, 256, 128] as const

const ROWS: { name: string; kind: string; v: number[] }[] = [
  { name: "MTEB multilingual", kind: "text", v: [61.36, 61.17, 60.41, 57.89] },
  { name: "MTEB English", kind: "text", v: [68.46, 68.41, 67.78, 65.68] },
  { name: "MTEB code", kind: "code", v: [78.68, 77.24, 76.18, 71.41] },
  { name: "MIEB lite", kind: "image", v: [64.64, 64.32, 63.13, 59.06] },
  { name: "MMEB v2 overall", kind: "multimodal", v: [59.01, 58.38, 56.24, 45.65] },
  { name: "MSEB retrieval", kind: "audio", v: [69.54, 69.18, 66.76, 56.71] },
  { name: "MAEB", kind: "audio", v: [49.39, 49.21, 48.91, 46.92] },
]

const BAR = "oklch(0.62 0.15 255)"
const WARN = "oklch(0.63 0.19 25)"

export function MrlDial() {
  const [di, setDi] = useState(2)
  const d = DIMS[di]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">cut the vector to its first d numbers, renormalise</span>
        <span className="font-mono text-[10px] text-muted-foreground">scores: model card truncation table</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {DIMS.map((w, i) => (
            <button
              key={w}
              type="button"
              onClick={() => setDi(i)}
              aria-pressed={di === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] tabular-nums transition-colors",
                di === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              d = {w}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] sm:grid-cols-3">
          <Cell label="1M vectors, float32" value={fmtBytes(d * 4)} sub={`${d} x 4 bytes each`} />
          <Cell label="1M vectors, bfloat16" value={fmtBytes(d * 2)} sub={`${d} x 2 bytes each`} />
          <Cell label="smaller than 768" value={d === 768 ? "1x" : `${(768 / d).toFixed(1)}x`} sub="same ratio in any dtype" />
        </div>

        <div className="mt-4 space-y-1">
          {ROWS.map((r) => {
            const kept = (r.v[di] / r.v[0]) * 100
            return (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-32 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {r.name} <span className="opacity-60">{r.kind}</span>
                </span>
                <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${r.v[di].toFixed(2)}%`, background: BAR, opacity: 0.8 }} />
                </div>
                <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{r.v[di].toFixed(2)}</span>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: kept < 90 ? WARN : undefined }}>
                  {kept.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        At 256 dimensions every row keeps at least 95% of its 768d score. At 128 the text rows
        still keep 94% to 96% and code keeps about 91%, but the multimodal average falls from
        59.01 to 45.65, about 77%, and spoken-query retrieval to about 82%. A text-only index can
        go to 128; a mixed one should stop at 256.
      </p>
    </figure>
  )
}

function fmtBytes(perVector: number) {
  // one million vectors: bytes per vector x 1e6, shown in MB or GB
  const mb = perVector // perVector bytes x 1e6 vectors / 1e6 = MB
  return mb >= 1000 ? `${(mb / 1000).toFixed(2)} GB` : `${mb} MB`
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-foreground">{value}</div>
      <div className="text-[9.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}
