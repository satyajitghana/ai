"use client"

import { useState } from "react"

// Memory for N Gaussians, from the attribute layout in idol/gaussian.py and
// idol/models/decoder.py. The compressed rate is the project page's own
// (0.4 MB, 3.2 MB and 12.2 MB at 32,768, 262,144 and 1,048,576).

const FIELDS = [
  { name: "position", n: 3, color: "oklch(0.62 0.14 255)" },
  { name: "colour (SH0)", n: 3, color: "oklch(0.64 0.15 25)" },
  { name: "scale", n: 3, color: "oklch(0.66 0.13 150)" },
  { name: "rotation", n: 4, color: "oklch(0.64 0.14 305)" },
  { name: "opacity", n: 1, color: "oklch(0.70 0.12 85)" },
]

function fmt(n: number, d = 1) {
  const f = 10 ** d
  const r = Math.round(n * f) / f
  const s = String(r)
  const [i, frac] = s.split(".")
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return frac ? `${grouped}.${frac}` : grouped
}

const MIB = 1024 * 1024

export function SplatBudget() {
  const [k, setK] = useState(262144 / 32)
  const anchors = k
  const n = anchors * 32
  const head = anchors * 480 * 4
  const act = n * 14 * 4
  const ply = n * 17 * 4
  const compressed = (n * 12.2 * 1e6) / 1048576
  const rows = [
    { label: "decoder head output (fp32)", b: head, note: "480 per anchor" },
    { label: "activated attributes (fp32)", b: act, note: "14 per splat" },
    { label: "PLY on disk", b: ply, note: "17 per splat, 68 B" },
    { label: "project page, compressed", b: compressed, note: "about 12 B per splat" },
  ]
  const max = Math.max(...rows.map((r) => r.b))
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what N Gaussians cost to hold</span>
        <span className="font-mono text-[10px] text-muted-foreground">reasoned from the code; the PLY size is measured</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <label className="block">
          <div className="flex items-baseline justify-between font-mono text-xs">
            <span>Gaussians</span>
            <span className="text-foreground">
              {fmt(n, 0)} = {fmt(anchors, 0)} anchors x 32
            </span>
          </div>
          <input
            type="range"
            min={1024}
            max={32768}
            step={1024}
            value={anchors}
            onChange={(e) => setK(Number(e.target.value))}
            className="mt-2 w-full cursor-pointer"
            aria-label="Number of Gaussians in units of 32"
          />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>32,768</span>
            <span>1,048,576</span>
          </div>
        </label>

        <div className="flex h-5 w-full overflow-hidden rounded" role="img" aria-label="14 activated values per splat">
          {FIELDS.map((f) => (
            <div key={f.name} style={{ width: `${(f.n / 14) * 100}%`, background: f.color }} title={`${f.name}: ${f.n}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {FIELDS.map((f) => (
            <span key={f.name} className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-sm" style={{ background: f.color }} />
              {f.name} x{f.n}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between font-mono text-[11px]">
                <span>{r.label}</span>
                <span>{fmt(r.b / MIB, 1)} MiB</span>
              </div>
              <div className="mt-1 h-2 rounded bg-muted/40">
                <div className="h-2 rounded bg-foreground/60" style={{ width: `${(r.b / max) * 100}%` }} />
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">{r.note}</div>
            </div>
          ))}
        </div>

        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          Largest buffer here is {fmt(Math.max(head, act, ply) / MIB, 1)} MiB, which is{" "}
          {fmt((Math.max(head, act, ply) / (7.2 * 1024 * MIB)) * 100, 2)}% of the 7.2 GB peak the model card reports.
          The splats are not what fills the card.
        </p>
      </div>
    </figure>
  )
}
