"use client"

// From a reconstruction to a Detailed splat ceiling to the size of the
// "standalone HTML" export.
//
// Ceiling (code, src-tauri/src/pipeline/splat_budget.rs at 82d4620):
//   round(0.5 x sqrt(2462476 x 0.063362106 x effective pixels / mean track length))
// Their own logged example (docs/FINE_SPLAT_BUDGET.md, REPORTED): 90 images,
// 364,993,345 effective pixels, mean track 2.8870548793 -> 2,220,679; I get
// the same integer. My synthetic run (MEASURED): 30 frames at 640x480, mean
// track 6.819 -> 229,600.
//
// PLY: 236 bytes per splat (59 float32: position, DC colour, 45 SH-rest,
// opacity, scale, rotation). Their own screenshot shows 468,093 splats as
// 105.4 MB, which is 236 x 468,093 bytes in MiB.
// HTML: the packer base64-encodes the PLY (4/3) and inlines the viewer runtime
// (also base64). Measured with my byte-for-byte re-implementation: overhead
// 2,751,504 bytes at 20,000 splats (runtime bundled with esbuild, not their Vite).
// SOG: 13.64 bytes per splat, from the site's SOG article (MEASURED there on a
// different 5M-splat scene), so a rough guide only.
//
// SSR-safe: + - * / and Math.sqrt / Math.round only.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

const TANGO = 2462476 * 0.063362106
const B_PLY = 236
const OVERHEAD = 2751504
const B_SOG = 13.64
const A = "oklch(0.62 0.15 200)"
const HTML_C = "oklch(0.66 0.17 30)"
const SOG_C = "oklch(0.7 0.14 145)"

const PRESETS = [
  { id: "their log", images: 90, mp: 4.05548161, track: 2.8870548793 },
  { id: "my 30 frames", images: 30, mp: 0.3072, track: 6.8193363 },
  { id: "4K, 480 frames, track 4 (a guess)", images: 480, mp: 8.2944, track: 4 },
]

const mb = (b: number) => (b / 1e6 >= 1000 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`)

export function BudgetToHtml() {
  const [images, setImages] = useState(90)
  const [mp, setMp] = useState(4.05548161)
  const [track, setTrack] = useState(2.8870548793)

  const pixels = images * mp * 1e6
  const ceiling = Math.round(0.5 * Math.sqrt((TANGO * pixels) / track))
  const ply = ceiling * B_PLY
  const html = Math.ceil(ply / 3) * 4 + OVERHEAD
  const sog = ceiling * B_SOG

  const W = 640
  const L = 70
  const max = html
  const rows = [
    { label: "PLY", v: ply, c: A },
    { label: "HTML", v: html, c: HTML_C },
    { label: "SOG*", v: sog, c: SOG_C },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Detailed splat ceiling → bytes on disk</span>
        <span className="text-muted-foreground/60">code · measured · reasoned</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => { setImages(p.images); setMp(p.mp); setTrack(p.track) }}
              className="rounded border bg-background/50 px-2 py-0.5 hover:bg-muted">
              {p.id}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block font-mono text-xs text-muted-foreground">
            registered images: <span className="text-foreground">{images}</span>
            <Range min={10} max={1000} step={1} value={images} onChange={(e) => setImages(Number(e.target.value))} accent={A} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-xs text-muted-foreground">
            effective megapixels each: <span className="text-foreground">{mp.toFixed(2)}</span>
            <Range min={0.3} max={12.3} step={0.01} value={mp} onChange={(e) => setMp(Number(e.target.value))} accent={A} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-xs text-muted-foreground">
            mean track length: <span className="text-foreground">{track.toFixed(2)}</span>
            <Range min={2} max={12} step={0.01} value={track} onChange={(e) => setTrack(Number(e.target.value))} accent={A} className="mt-1 w-full" />
          </label>
        </div>

        <div className="rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          ceiling = 0.5 × √(156,027.67 × {Math.round(pixels).toLocaleString("en-US")} px ÷ {track.toFixed(3)}) ={" "}
          <span className="text-foreground">{ceiling.toLocaleString("en-US")} splats</span>
          <br />
          Four times the pixels doubles it; four times the mean track length halves it.
        </div>

        <svg viewBox={`0 0 ${W} 100`} className="w-full" role="img" aria-label={`At ${ceiling} splats: PLY ${mb(ply)}, standalone HTML ${mb(html)}, SOG roughly ${mb(sog)}.`}>
          {rows.map((r, k) => {
            const y = 6 + k * 30
            const w = Math.max(2, (r.v / max) * (W - L - 110))
            return (
              <g key={r.label}>
                <text x={10} y={y + 15} fontSize={11} className="fill-foreground font-mono">{r.label}</text>
                <rect x={L} y={y + 2} width={w} height={18} rx={2} fill={r.c} fillOpacity={0.8} />
                <text x={L + w + 6} y={y + 15} fontSize={10} className="fill-muted-foreground font-mono">{mb(r.v)}</text>
              </g>
            )
          })}
        </svg>

        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          PLY at 236 B per splat. HTML = base64 of the PLY plus 2.75 MB of inlined viewer, from my re-implementation of the
          packer (20,000 splats: 4,721,476 B of PLY became 9,046,808 B of HTML; 200,000 splats: 47,201,477 B became
          65,690,265 B). *SOG at 13.64 B per splat is borrowed from a different scene; treat it as an order of magnitude.
        </p>
      </div>
    </figure>
  )
}
