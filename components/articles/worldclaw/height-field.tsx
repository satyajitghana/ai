"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, msin, mcos } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Equation 6 of the paper, drawn as a 1-D cross-section:
//
//   H(x) = SUM_r  m~_r(x) [ h_r + SUM_k w_rk N_rk(x) + SUM_j a_rj G_rj(x) ]
//
// Every region r contributes a base elevation h_r, some noise octaves N, and
// some gaussian landform terms G, all gated by a normalized region mask m~_r.
// The paper's point is that this is one field, not a stitched set of tiles:
// because the masks are normalized and sum to one, regions blend rather than
// abut, and that is what keeps the global terrain continuous while letting each
// region be authored separately.
//
// All trig/exp goes through lib/dmath so server and client serialize the same
// SVG coordinates.

type Region = { name: string; centre: number; width: number; base: number; noise: number; land: number; color: string }

const REGIONS: Region[] = [
  { name: "beach", centre: 0.14, width: 0.16, base: 6, noise: 2, land: 0, color: "oklch(0.78 0.11 85)" },
  { name: "forest", centre: 0.42, width: 0.20, base: 28, noise: 9, land: 8, color: "oklch(0.58 0.13 150)" },
  { name: "ridge", centre: 0.72, width: 0.16, base: 62, noise: 12, land: 34, color: "oklch(0.62 0.03 250)" },
  { name: "canyon", centre: 0.92, width: 0.12, base: 18, noise: 6, land: -22, color: "oklch(0.60 0.15 255)" },
]

const N = 220
const W = 720
const H = 190

// unnormalized gaussian region mask
const mask = (x: number, r: Region) => mexp(-((x - r.centre) ** 2) / (2 * r.width * r.width))

// two noise octaves, deterministic and cheap
const noise = (x: number) => msin(x * 41) * 0.5 + msin(x * 97 + 1.7) * 0.28 + mcos(x * 23 + 0.4) * 0.22

// one landform bump per region
const landform = (x: number, r: Region) => mexp(-((x - r.centre) ** 2) / (2 * (r.width * 0.55) ** 2))

export function HeightField() {
  const [noiseGain, setNoiseGain] = useState(1)
  const [landGain, setLandGain] = useState(1)
  const [normalize, setNormalize] = useState(true)
  const [show, setShow] = useState<string | null>(null)

  const pts: { x: number; y: number; per: number[] }[] = []
  for (let i = 0; i <= N; i++) {
    const x = i / N
    const raw = REGIONS.map((r) => mask(x, r))
    const sum = raw.reduce((a, b) => a + b, 0)
    const m = normalize ? raw.map((v) => v / (sum || 1)) : raw
    const per = REGIONS.map(
      (r, k) => m[k] * (r.base + noiseGain * r.noise * noise(x) + landGain * r.land * landform(x, r)),
    )
    pts.push({ x, y: per.reduce((a, b) => a + b, 0), per })
  }

  const ys = pts.map((p) => p.y)
  const lo = Math.min(...ys, 0)
  const hi = Math.max(...ys, 1)
  const sy = (v: number) => H - ((v - lo) / (hi - lo || 1)) * (H - 14) - 7
  const sx = (v: number) => v * W

  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(" ")
  const area = `${path} L${W},${H} L0,${H} Z`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the region-aware height field · eq. 6</span>
        <span className="font-mono text-[10px] text-muted-foreground">1-D cross-section</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]" role="img" aria-label="Terrain cross-section produced by summing four masked region contributions">
            <path d={area} fill="var(--muted)" opacity={0.5} />
            {show
              ? (() => {
                  const k = REGIONS.findIndex((r) => r.name === show)
                  const p = pts
                    .map((q, i) => `${i ? "L" : "M"}${sx(q.x).toFixed(2)},${sy(q.per[k]).toFixed(2)}`)
                    .join(" ")
                  return <path d={p} fill="none" stroke={REGIONS[k].color} strokeWidth={2} strokeDasharray="4 3" />
                })()
              : null}
            <path d={path} fill="none" stroke="var(--foreground)" strokeWidth={2} />
            {REGIONS.map((r) => (
              <g key={r.name}>
                <line
                  x1={sx(r.centre)}
                  x2={sx(r.centre)}
                  y1={H}
                  y2={12}
                  stroke={r.color}
                  strokeWidth={1}
                  opacity={show === r.name ? 0.7 : 0.25}
                />
                <text x={sx(r.centre)} y={10} textAnchor="middle" fontSize={9} fill={r.color} fontFamily="monospace">
                  {r.name}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => setShow(show === r.name ? null : r.name)}
              aria-pressed={show === r.name}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                show === r.name ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground",
              )}
            >
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: r.color }} />
              {r.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setNormalize(!normalize)}
            aria-pressed={normalize}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              normalize ? "border-transparent text-white" : "border-border text-muted-foreground",
            )}
            style={normalize ? { background: "oklch(0.60 0.15 255)" } : undefined}
          >
            {normalize ? "masks normalized" : "masks raw (overlap adds up)"}
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">noise w</span>
            <Range min={0} max={3} step={0.05} value={noiseGain} onChange={(e) => setNoiseGain(Number(e.target.value))} className="flex-1" aria-label="noise weight" accent="oklch(0.68 0.13 85)" />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{noiseGain.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">landform α</span>
            <Range min={0} max={2} step={0.05} value={landGain} onChange={(e) => setLandGain(Number(e.target.value))} className="flex-1" aria-label="landform weight" accent="oklch(0.60 0.15 255)" />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{landGain.toFixed(1)}</span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Four regions, each with its own base elevation, noise octaves and landform bump, summed under normalized
          masks. The mask normalization is the part that matters: because the weights sum to one everywhere,
          neighbouring regions <em>blend</em> instead of butting against each other, so a beach can become a forest
          without a seam. Turn normalization off and the overlaps add rather than average — elevations pile up
          wherever two regions meet, which is exactly the artefact a tile-stitching approach has to fix afterwards.
          This is one continuous field that happens to be authored per region, which is what lets the planning agent
          write regions independently and still get a coherent world.
        </p>
      </div>
    </figure>
  )
}
