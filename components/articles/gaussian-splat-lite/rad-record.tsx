"use client"

// One splat in a RAD chunk, property by property, as Gaussian-Splat-Lite's
// converter writes it (bin/rad/rad.js, encodeChunk, v1.7.0 / commit 435be9b).
// Byte counts are the raw bytes per splat BEFORE each property is deflated:
// read from the code, not measured. Toggle the SH storage between per-splat
// s8 coefficients (--no-cluster-sh) and the codebook label (the default).
// The codebook table itself is shared by the whole file and is shown as an
// amortised sliver for a chosen splat count. Plain arithmetic, SSR-safe.

import { useState } from "react"

type Prop = { key: string; label: string; bytes: number; enc: string; note: string; sh?: boolean }

const BASE: Prop[] = [
  { key: "center", label: "center", bytes: 12, enc: "f32_lebytes",
    note: "Three float32, lossless. The converter splits them into byte planes (all low bytes of x, then the next byte, and so on) so deflate sees the slowly-varying high bytes together." },
  { key: "alpha", label: "alpha", bytes: 1, enc: "r8",
    note: "Opacity in 0 to 2 as one byte. Values above 1 are LOD splats that stand in for several children; f16 is used only if a file needs it." },
  { key: "rgb", label: "rgb", bytes: 3, enc: "r8_delta",
    note: "Base colour, one byte per channel over the file's 1st to 99th percentile range, stored as the difference from the previous splat." },
  { key: "scales", label: "scales", bytes: 3, enc: "ln_0r8",
    note: "Log scale per axis, one byte each over a percentile range; code 0 means a flat axis." },
  { key: "orientation", label: "orientation", bytes: 3, enc: "oct88r8",
    note: "The rotation axis octahedrally mapped to two bytes, the angle in a third." },
  { key: "tree", label: "child_count + child_start", bytes: 6, enc: "u16 + u32",
    note: "The LOD tree: how many children a splat has and where they start. Leaves store zeros, which deflate to almost nothing." },
]

const RAW_SH: Prop = { key: "sh", label: "sh1 + sh2 + sh3", bytes: 45, enc: "s8", sh: true,
  note: "45 coefficients (9 + 15 + 21 for degrees 1, 2 and 3), each a signed byte with a step of 1/128, clipped to plus or minus 127/128." }
const label = (u32: boolean): Prop => ({ key: "label", label: "sh_label", bytes: u32 ? 4 : 2, enc: u32 ? "u32" : "u16", sh: true,
  note: u32
    ? "An index into the shared codebook. Above 65,536 entries the converter writes u32, so a 262,144-entry codebook costs four bytes per splat before deflate, of which only 18 bits are information."
    : "An index into the shared codebook; with 65,536 entries or fewer it fits a u16." })

const COUNTS = [
  { n: 100_000, label: "100k" },
  { n: 1_074_761, label: "1.07M (train)" },
  { n: 10_000_000, label: "10M" },
  { n: 60_000_000, label: "60M" },
]
const MAX_CODES = 262_144
const ENTRY = 45 // s8 bytes per codebook entry

const W = 700
const BAR_X = 16
const BAR_W = 668
const SCALE = BAR_W / 80

const fmt = (x: number, d = 1) => x.toFixed(d)

export function RadRecord() {
  const [codebook, setCodebook] = useState(true)
  const [ci, setCi] = useState(3)
  const [sel, setSel] = useState("label")
  const n = COUNTS[ci].n
  const k = Math.min(n, MAX_CODES)
  const props = [...BASE, codebook ? label(k > 65_536) : RAW_SH]
  const table = codebook ? (k * ENTRY) / n : 0
  const perSplat = props.reduce((a, p) => a + p.bytes, 0) + table
  const rawTotal = BASE.reduce((a, p) => a + p.bytes, 0) + RAW_SH.bytes
  const saving = 1 - perSplat / rawTotal
  const active = props.find((p) => p.key === sel) ?? props[props.length - 1]

  let x = BAR_X
  const segs = props.map((p) => {
    const s = { p, x, w: p.bytes * SCALE }
    x += s.w
    return s
  })
  const tableW = table * SCALE

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one splat in a RAD chunk · bytes before deflate</span>
        <span className="text-muted-foreground/60">read from rad.js</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2 font-mono text-xs">
          <button type="button" onClick={() => { setCodebook(false); setSel("sh") }}
            className={`rounded border px-2 py-1 ${!codebook ? "bg-foreground text-background" : ""}`}>--no-cluster-sh</button>
          <button type="button" onClick={() => { setCodebook(true); setSel("label") }}
            className={`rounded border px-2 py-1 ${codebook ? "bg-foreground text-background" : ""}`}>SH codebook (default)</button>
          <span className="ml-auto self-center text-muted-foreground">splats after LOD:</span>
          {COUNTS.map((c, i) => (
            <button key={c.label} type="button" onClick={() => setCi(i)} disabled={!codebook}
              className={`rounded border px-2 py-1 disabled:opacity-40 ${ci === i && codebook ? "bg-foreground text-background" : ""}`}>{c.label}</button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} 92`} className="w-full" role="img"
          aria-label={`Bytes per splat in a RAD chunk before compression: center 12, alpha 1, rgb 3, scales 3, orientation 3, LOD tree 6, and either 45 bytes of s8 SH coefficients (73 in all) or a 2 or 4 byte codebook label plus the shared table spread over every splat.`}>
          {segs.map(({ p, x: sx, w }) => (
            <g key={p.key} onClick={() => setSel(p.key)} style={{ cursor: "pointer" }}>
              <rect x={sx} y={14} width={w} height={34} rx={2}
                className={p.sh ? "fill-sky-500" : "fill-muted-foreground"}
                fillOpacity={p.key === active.key ? 0.9 : 0.45} stroke="currentColor" strokeOpacity={0.25} />
              {w > 30 && (
                <text x={sx + w / 2} y={35} fontSize={10} textAnchor="middle" className="fill-foreground font-mono">{p.bytes}</text>
              )}
            </g>
          ))}
          {codebook && tableW > 0.5 && (
            <rect x={x} y={14} width={tableW} height={34} rx={2} className="fill-amber-500" fillOpacity={0.8} />
          )}
          <text x={BAR_X} y={68} fontSize={10} className="fill-foreground font-mono">
            {fmt(perSplat, 2)} B/splat{codebook ? ` (incl. ${fmt(table, 2)} B of shared table, ${k.toLocaleString("en-US")} entries)` : ""}
          </text>
          <text x={BAR_X} y={84} fontSize={10} className="fill-muted-foreground font-mono">
            vs {rawTotal} B with s8 SH · {saving >= 0 ? `${fmt(saving * 100)}% smaller` : `${fmt(-saving * 100)}% larger`} before deflate
          </text>
        </svg>
        <div className="mt-2 rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">{active.label}</span> · {active.bytes} B · <span className="text-foreground">{active.enc}</span>
          {" "}· {active.note}
        </div>
      </div>
    </figure>
  )
}
