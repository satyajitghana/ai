"use client"

// Anatomy of a splat file: where the 62 float32 properties of one 3DGS PLY
// vertex go when SplatTransform writes a SOG bundle. The left column is the
// standard INRIA .ply layout, field by field, with heights in proportion to
// the 248 bytes each splat costs there. The right column is the eight files of
// a real .sog, with heights in proportion to the 13.64 bytes each splat costs
// on disk — MEASURED from opsiclear-admin/test2's bicycle scene
// (splat_30000.sog, 5,000,000 splats, 68,209,747 bytes). Click a PLY field to
// see which WebP image swallows it.
//
// The two columns are each normalised to the same pixel height so the
// composition is legible; the strip at the top is drawn to a single linear
// scale, so THAT is the honest picture of the 18x shrink. Every number here
// also appears in the prose, so the static .md reads the same. SSR-safe, no
// transcendentals — plain +,-,*,/ only, so no hydration drift.

import { useState } from "react"

type PlyField = {
  key: string
  label: string
  detail: string
  ply: number // bytes per splat in the float32 PLY
  to: string[] // SOG files it lands in
  note: string
}

type SogFile = {
  key: string
  label: string
  webp: number // MEASURED bytes/splat on disk (WebP file size / 5,000,000)
  raw: number // raw texture bytes/splat (channels x 1 byte), 0 for the palette
}

// Left: the standard 3DGS .ply property groups (3+3+3+45+1+3+4 = 62 float32).
const PLY: PlyField[] = [
  { key: "pos", label: "position", detail: "x, y, z", ply: 12, to: ["means_u", "means_l"],
    note: "Three float32. SOG keeps 16 bits per axis in a signed-log domain, split so the high byte of x,y,z lands in means_u and the low byte in means_l. Dequantised through per-axis mins/maxs in meta.json." },
  { key: "normals", label: "normals", detail: "nx, ny, nz", ply: 12, to: [],
    note: "Three float32 the original 3DGS trainer writes and never reads — they are zeros. SOG stores no normals at all. Twelve bytes a splat, gone for free." },
  { key: "dc", label: "base colour", detail: "f_dc_0..2 (SH degree 0)", ply: 12, to: ["sh0"],
    note: "The view-independent colour: the SH degree-0 (DC) term, three float32. SOG quantises each channel to an 8-bit index into a 256-float codebook, packed into the R, G, B of sh0.webp." },
  { key: "shrest", label: "SH degrees 1-3", detail: "f_rest_0..44 (45 floats)", ply: 180, to: ["shN_labels", "shN_centroids"],
    note: "The view-dependent colour: 45 float32, by far the largest field. SOG vector-quantises the whole 45-vector into a palette of up to 65,536 centroids, then stores one 16-bit index per splat in shN_labels. 180 bytes become 2." },
  { key: "opacity", label: "opacity", detail: "1 float", ply: 4, to: ["sh0"],
    note: "One float32, sigmoid-activated at render. SOG stores it as an 8-bit value in the alpha channel of sh0.webp: opacity = A / 255." },
  { key: "scale", label: "scale", detail: "scale_0..2", ply: 12, to: ["scales"],
    note: "Three float32, the anisotropic size along the splat's local axes, stored in log. SOG keeps each as an 8-bit index into a 256-float log-domain codebook, in the R, G, B of scales.webp." },
  { key: "rot", label: "rotation", detail: "rot_0..3 (quaternion)", ply: 16, to: ["quats"],
    note: "A unit quaternion, four float32. SOG drops the largest component and stores the smallest three at 8 bits each plus a 2-bit mode tag — 26 bits of information in the RGBA of quats.webp." },
]

// Right: the eight files of a real v2 .sog. webp = MEASURED bytes/splat.
const SOG: SogFile[] = [
  { key: "means_u", label: "means_u.webp", webp: 0.63, raw: 3 },
  { key: "means_l", label: "means_l.webp", webp: 2.98, raw: 3 },
  { key: "scales", label: "scales.webp", webp: 2.32, raw: 3 },
  { key: "quats", label: "quats.webp", webp: 3.12, raw: 4 },
  { key: "sh0", label: "sh0.webp", webp: 2.68, raw: 4 },
  { key: "shN_labels", label: "shN_labels.webp", webp: 1.61, raw: 2 },
  { key: "shN_centroids", label: "shN_centroids.webp", webp: 0.3, raw: 0 },
]

const PLY_TOTAL = 248 // measured: 62 float32 = 248 B/splat
const SOG_TOTAL = 13.64 // measured: 68,208,407 B of splat data / 5,000,000

const ACCENT: Record<string, string> = {
  pos: "oklch(0.62 0.17 255)",
  normals: "oklch(0.60 0.02 260)",
  dc: "oklch(0.68 0.15 55)",
  shrest: "oklch(0.64 0.16 300)",
  opacity: "oklch(0.70 0.13 150)",
  scale: "oklch(0.68 0.14 90)",
  rot: "oklch(0.64 0.14 20)",
}

const W = 720
const COL_H = 300
const TOP = 86
const GAP = 5
const LEFT_X = 20
const LEFT_W = 170
const RIGHT_X = 540
const RIGHT_W = 160

// Which PLY field feeds each SOG file (reverse of PlyField.to).
const FEEDS: Record<string, string[]> = {}
for (const f of PLY) for (const t of f.to) (FEEDS[t] ??= []).push(f.key)

function layout<T>(items: T[], size: (t: T) => number, total: number) {
  const usable = COL_H - GAP * (items.length - 1)
  const scale = usable / total
  let y = TOP
  return items.map((t) => {
    const h = size(t) * scale
    const box = { y, h }
    y += h + GAP
    return box
  })
}

export function SplatAnatomy() {
  const [sel, setSel] = useState<string | null>(null)
  const plyBoxes = layout(PLY, (f) => f.ply, PLY_TOTAL)
  const sogBoxes = layout(SOG, (f) => f.webp, SOG_TOTAL)
  const sogIndex = Object.fromEntries(SOG.map((s, i) => [s.key, i]))

  const active = sel ? PLY.find((f) => f.key === sel) ?? null : null
  const litFiles = new Set(active?.to ?? [])

  // To-scale shrink strip (linear, honest): PLY full width, SOG a sliver.
  const stripX = 20
  const stripW = W - 40
  const sogStripW = (SOG_TOTAL / PLY_TOTAL) * stripW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>anatomy of a splat · one Gaussian, PLY to SOG</span>
        <span className="text-muted-foreground/60">bicycle scene, measured</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${TOP + COL_H + 40}`}
          className="w-full"
          role="img"
          aria-label="Left: a 3D Gaussian splat PLY vertex, 248 bytes split into position 12, normals 12, base colour 12, spherical-harmonic degrees 1 to 3 180, opacity 4, scale 12, rotation 16. Right: the same splat in a SOG bundle, 13.64 bytes of WebP on disk, split across means_u, means_l, scales, quats, sh0, shN_labels and shN_centroids. Spherical harmonics dominate the PLY and collapse to a 2-byte palette index in SOG."
        >
          {/* to-scale shrink strip */}
          <text x={stripX} y={22} fontSize={10} className="fill-muted-foreground font-mono">
            to scale, per splat:
          </text>
          <rect x={stripX} y={30} width={stripW} height={14} rx={2} fill="oklch(0.60 0.02 260)" fillOpacity={0.35} />
          <text x={stripX + 6} y={41} fontSize={9.5} className="fill-foreground font-mono">
            .ply — 248 B
          </text>
          <rect x={stripX} y={52} width={Math.max(sogStripW, 2)} height={14} rx={2} fill="oklch(0.62 0.17 255)" fillOpacity={0.85} />
          <text x={stripX + Math.max(sogStripW, 2) + 6} y={63} fontSize={9.5} className="fill-foreground font-mono">
            .sog — 13.64 B (18.18x smaller)
          </text>

          {/* column captions */}
          <text x={LEFT_X} y={TOP - 8} fontSize={10} className="fill-muted-foreground font-mono">
            .ply field (248 B)
          </text>
          <text x={RIGHT_X} y={TOP - 8} fontSize={10} className="fill-muted-foreground font-mono">
            .sog file (13.64 B)
          </text>
          <text x={LEFT_X} y={TOP + COL_H + 28} fontSize={8.5} className="fill-muted-foreground/70 font-mono">
            columns scaled to equal height to show composition; true sizes are the strip up top.
          </text>

          {/* edges */}
          {PLY.map((f, i) => {
            const lb = plyBoxes[i]
            const dim = active && active.key !== f.key
            return f.to.map((t) => {
              const j = sogIndex[t]
              const rb = sogBoxes[j]
              return (
                <path
                  key={f.key + t}
                  d={`M ${LEFT_X + LEFT_W} ${lb.y + lb.h / 2} C ${LEFT_X + LEFT_W + 120} ${lb.y + lb.h / 2}, ${RIGHT_X - 120} ${rb.y + rb.h / 2}, ${RIGHT_X} ${rb.y + rb.h / 2}`}
                  fill="none"
                  stroke={ACCENT[f.key]}
                  strokeWidth={active && active.key === f.key ? 2 : 1}
                  strokeOpacity={dim ? 0.08 : active ? 0.85 : 0.3}
                />
              )
            })
          })}

          {/* left boxes: PLY fields */}
          {PLY.map((f, i) => {
            const b = plyBoxes[i]
            const dim = active && active.key !== f.key
            const dropped = f.to.length === 0
            return (
              <g key={f.key} onClick={() => setSel(sel === f.key ? null : f.key)} style={{ cursor: "pointer" }}>
                <rect
                  x={LEFT_X}
                  y={b.y}
                  width={LEFT_W}
                  height={b.h}
                  rx={3}
                  fill={ACCENT[f.key]}
                  fillOpacity={dim ? 0.12 : dropped ? 0.22 : 0.62}
                  stroke={ACCENT[f.key]}
                  strokeOpacity={dim ? 0.2 : 0.9}
                  strokeDasharray={dropped ? "3 2" : undefined}
                />
                <text x={LEFT_X + 8} y={b.y + b.h / 2 + 3.5} fontSize={b.h < 12 ? 8.5 : 10} className="fill-foreground font-mono" fillOpacity={dim ? 0.4 : 1}>
                  {f.label}
                </text>
                <text x={LEFT_X + LEFT_W - 6} y={b.y + b.h / 2 + 3.5} fontSize={9} textAnchor="end" className="fill-foreground/80 font-mono" fillOpacity={dim ? 0.4 : 1}>
                  {f.ply} B
                </text>
              </g>
            )
          })}

          {/* right boxes: SOG files */}
          {SOG.map((s, i) => {
            const b = sogBoxes[i]
            const lit = litFiles.has(s.key)
            const dim = active != null && !lit
            return (
              <g key={s.key}>
                <rect
                  x={RIGHT_X}
                  y={b.y}
                  width={RIGHT_W}
                  height={b.h}
                  rx={3}
                  fill="oklch(0.62 0.03 255)"
                  fillOpacity={dim ? 0.12 : lit ? 0.5 : 0.3}
                  stroke={lit ? (active ? ACCENT[active.key] : "currentColor") : "currentColor"}
                  strokeOpacity={dim ? 0.15 : lit ? 0.9 : 0.4}
                  className={lit ? undefined : "text-border"}
                />
                <text x={RIGHT_X + 8} y={b.y + b.h / 2 + 3.5} fontSize={b.h < 12 ? 8 : 9.5} className="fill-foreground font-mono" fillOpacity={dim ? 0.4 : 1}>
                  {s.label}
                </text>
                <text x={RIGHT_X + RIGHT_W - 6} y={b.y + b.h / 2 + 3.5} fontSize={8.5} textAnchor="end" className="fill-foreground/80 font-mono" fillOpacity={dim ? 0.4 : 1}>
                  {s.webp.toFixed(2)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-3 min-h-[3.5rem] rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {active ? (
            <span>
              <span className="text-foreground">{active.label}</span> ({active.detail}) ·{" "}
              <span className="text-foreground">{active.ply} B</span> in PLY →{" "}
              {active.to.length ? active.to.map((t) => `${t}.webp`).join(" + ") : "dropped"}. {active.note}
            </span>
          ) : (
            <span>
              Click a <span className="text-foreground">.ply</span> field to trace it into the SOG bundle. The
              45 spherical-harmonic floats (180 B) are the whole game: they collapse to a 2 B palette index.
            </span>
          )}
        </div>
      </div>
    </figure>
  )
}
