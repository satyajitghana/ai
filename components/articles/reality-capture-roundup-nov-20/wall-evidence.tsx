"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What a horizontal slice of a point cloud says about one exterior wall, and what it cannot.
//
// The wall is synthetic and its dimensions are mine: 6.0 m long, 250 mm thick, scanned from the
// inside. A window has a 1,600 mm rough opening (x 2.20-3.80 m, sill 0.90, head 2.10) and a
// 45 mm frame each side, so the glass between the frames is 1,510 mm wide; glass returns no
// points. A desk 0.72 m high stands against the wall at x 0.60-2.00 m. A downstand beam 400 mm
// deep (soffit at 2.35 m) runs along the wall under a 2.75 m ceiling. The 90 mm between the rough
// opening and the frame's inside matches the error akionionio reports for his window widths.
//
// Points are sampled every 20 mm along the wall at the slice height, with noise from a seeded
// PRNG (sum of three uniforms, so no transcendental functions). Every readout is computed from
// those points, not from the truth.

const L = 6.0
const T = 0.25
const RO0 = 2.2
const RO1 = 3.8
const FR = 0.045
const SILL = 0.9
const HEAD = 2.1
const DESK0 = 0.6
const DESK1 = 2.0
const DESK_H = 0.72
const BEAM_D = 0.4
const BEAM_Z = 2.35
const CEIL = 2.75

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pt = { x: number; y: number; kind: "wall" | "frame" | "beam" | "ext" | "desk" }

function sample(z: number, sigma: number, outside: boolean): Pt[] {
  const r = rng(7 + Math.round(z * 100))
  const n = () => (r() + r() + r() - 1.5) * 2 * sigma
  const pts: Pt[] = []
  const inWindowBand = z > SILL && z < HEAD
  const inBeam = z >= BEAM_Z && z < CEIL
  for (let i = 0; i <= 300; i++) {
    const x = i * 0.02
    if (inBeam) {
      // the cut passes through the beam: the nearest surface is the beam's side, 400 mm into the room
      pts.push({ x, y: -BEAM_D + n(), kind: "beam" })
      continue
    }
    if (z < DESK_H && x > DESK0 && x < DESK1) {
      // the desk hides the wall; the scanner sees the desk's front edge instead
      if (i % 2 === 0) pts.push({ x, y: -0.7 + n(), kind: "desk" })
      continue
    }
    if (inWindowBand && x > RO0 && x < RO1) {
      if (x < RO0 + FR || x > RO1 - FR) pts.push({ x, y: 0.06 + n(), kind: "frame" })
      continue // glass: no return
    }
    pts.push({ x, y: n(), kind: "wall" })
  }
  if (outside && !inBeam) {
    for (let i = 0; i <= 300; i++) {
      const x = i * 0.02
      if (inWindowBand && x > RO0 && x < RO1) continue
      pts.push({ x, y: T + n(), kind: "ext" })
    }
  }
  return pts
}

function mean(a: number[]) {
  return a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
}
function sd(a: number[]) {
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, a.length))
}

const mm = (m: number) => `${Math.round(m * 1000).toLocaleString("en-US")} mm`

export function WallEvidence() {
  const [z, setZ] = useState(1.2)
  const [sigma, setSigma] = useState(5)
  const [outside, setOutside] = useState(false)

  const pts = useMemo(() => sample(z, sigma / 1000, outside), [z, sigma, outside])

  const read = useMemo(() => {
    const wall = pts.filter((p) => p.kind === "wall")
    const ext = pts.filter((p) => p.kind === "ext")
    const beam = pts.filter((p) => p.kind === "beam")
    const frame = pts.filter((p) => p.kind === "frame")
    // the widest run along x with no wall or frame point
    const xs = pts.filter((p) => p.kind === "wall" || p.kind === "frame").map((p) => p.x).sort((a, b) => a - b)
    let gap = 0
    let g0 = 0
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > gap) {
        gap = xs[i] - xs[i - 1]
        g0 = xs[i - 1]
      }
    }
    const desk = pts.some((p) => p.kind === "desk")
    return {
      face: wall.length ? mean(wall.map((p) => p.y)) : null,
      spread: wall.length ? sd(wall.map((p) => p.y)) : null,
      thick: wall.length && ext.length ? mean(ext.map((p) => p.y)) - mean(wall.map((p) => p.y)) : null,
      opening: frame.length && gap > 0.5 ? { w: gap, x0: g0 } : null,
      beam: beam.length ? mean(beam.map((p) => p.y)) : null,
      desk,
    }
  }, [pts])

  // plan drawing: x 0..6 m over 560 px, y -0.85..0.45 m
  const PX = 560 / L
  const X = (x: number) => 20 + x * PX
  const Y = (y: number) => 150 + (y + 0.85) * 84
  // elevation, above the plan
  const EX = (x: number) => 20 + x * PX
  const EZ = (h: number) => 118 - h * 34

  const rows: [string, string, string][] = [
    [
      "interior face",
      read.face === null ? "no wall points at this height" : `${mm(read.face)} from the true face, points spread ${mm(read.spread ?? 0)}`,
      read.face === null ? "none" : "measured",
    ],
    [
      "thickness",
      read.thick === null ? "one face only: not in the cloud" : `${mm(read.thick)} between the two faces`,
      read.thick === null ? "default or drawing" : "measured, if the two scans are registered",
    ],
    [
      "window width",
      read.opening ? `${mm(read.opening.w)} of glass between the frames` : "no opening at this height",
      read.opening ? "measured; the rough opening is 1,600 mm" : "the slice misses it",
    ],
    [
      "sill and head",
      "only by moving the slice",
      "a section, not a plan",
    ],
    [
      "what is above 2.35 m",
      read.beam !== null ? `a face ${mm(-read.beam)} proud of the wall: beam or downstand?` : "slice below the beam",
      read.beam !== null ? "ask on site" : "",
    ],
    [
      "behind the desk",
      read.desk ? "1,400 mm of wall with no points" : "visible at this height",
      read.desk ? "assume it continues" : "measured",
    ],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">one wall, sliced: what the points say</span>
        <span className="text-muted-foreground/60">synthetic wall, seeded noise</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid gap-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
          <label className="block">
            <span className="flex justify-between">
              <span>slice height</span>
              <span className="text-foreground">{z.toFixed(2)} m</span>
            </span>
            <Range aria-label="Slice height in metres" min={0.3} max={2.6} step={0.05} value={z} onChange={(e) => setZ(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex justify-between">
              <span>range noise (1 sigma)</span>
              <span className="text-foreground">{sigma} mm</span>
            </span>
            <Range aria-label="Range noise in millimetres" min={1} max={20} step={1} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              aria-pressed={outside}
              onClick={() => setOutside((o) => !o)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                outside ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {outside ? "scanned outside too" : "scanned from inside only"}
            </button>
          </div>
        </div>

        <svg viewBox="0 0 600 272" className="mt-4 w-full" role="img" aria-label="Plan slice of the wall with scan points, and an elevation showing the slice height">
          {/* elevation, from inside */}
          <g>
            <text x={EX(0)} y={EZ(CEIL) - 8} fontSize={9} className="fill-muted-foreground font-mono">
              elevation, from inside
            </text>
            <rect x={EX(0)} y={EZ(CEIL)} width={EX(L) - EX(0)} height={EZ(0) - EZ(CEIL)} className="fill-muted/40 stroke-foreground/40" strokeWidth={0.8} />
            <rect x={EX(0)} y={EZ(CEIL)} width={EX(L) - EX(0)} height={EZ(BEAM_Z) - EZ(CEIL)} className="fill-foreground/15" />
            <rect x={EX(RO0)} y={EZ(HEAD)} width={EX(RO1) - EX(RO0)} height={EZ(SILL) - EZ(HEAD)} className="fill-sky-400/25 stroke-foreground/50" strokeWidth={0.8} />
            <rect x={EX(DESK0)} y={EZ(DESK_H)} width={EX(DESK1) - EX(DESK0)} height={EZ(0) - EZ(DESK_H)} className="fill-amber-500/30 stroke-foreground/40" strokeWidth={0.6} />
            <line x1={EX(0) - 6} x2={EX(L) + 6} y1={EZ(z)} y2={EZ(z)} stroke="oklch(0.65 0.2 25)" strokeWidth={1.4} strokeDasharray="4 3" />
            <text x={EX(L) - 22} y={EZ(z) - 4} fontSize={9} fill="oklch(0.65 0.2 25)" className="font-mono">
              cut
            </text>
          </g>
          {/* plan slice, below */}
          <g>
            <text x={20} y={140} fontSize={9} className="fill-muted-foreground font-mono">
              plan at the cut: true wall dashed, points in colour (the room is up)
            </text>
            <g>
              <rect x={X(0)} y={Y(0)} width={X(L) - X(0)} height={Y(T) - Y(0)} fill="none" className="stroke-foreground/40" strokeWidth={0.8} strokeDasharray="3 2" />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={X(p.x)}
                  cy={Y(p.y)}
                  r={1.3}
                  className={cn(
                    p.kind === "wall" && "fill-foreground/80",
                    p.kind === "frame" && "fill-sky-500",
                    p.kind === "beam" && "fill-rose-500",
                    p.kind === "ext" && "fill-emerald-500",
                    p.kind === "desk" && "fill-amber-500",
                  )}
                />
              ))}
            </g>
          </g>
        </svg>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-normal">what a BIM wall needs</th>
                <th className="py-1 pr-3 font-normal">what this slice gives</th>
                <th className="py-1 font-normal">source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([a, b, c]) => (
                <tr key={a} className="border-t border-border/60">
                  <td className="py-1 pr-3 text-foreground">{a}</td>
                  <td className="py-1 pr-3">{b}</td>
                  <td className="py-1 text-muted-foreground">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A synthetic exterior wall with a window, a desk against it and a downstand beam above, scanned from the inside. Move the cut: the
        face is measured to a millimetre or so even at 20 mm of noise, because hundreds of points average; the thickness is not there
        unless you scanned outside as well; the window reads as the glass between the frames, about 90 mm narrower than the rough opening (to within the 20 mm point spacing); and
        above 2.35 m the slice finds a face 400 mm into the room that the cloud alone cannot call a beam or a wall.
      </figcaption>
    </figure>
  )
}
