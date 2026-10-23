"use client"

// Why depth of field "just works" on splats in Cycles, and why an orthographic
// camera with a wide aperture reads as a miniature. Cycles' thin-lens camera
// (intern/cycles/kernel/camera/camera.h) starts every ray from a random point
// on the aperture and aims it at the pixel's point on the focal plane. A splat
// is a real primitive the ray hits or misses, so it is blurred exactly like a
// mesh would be. From the kernel:
//
//   orthographic: the ray from lens offset u reaches depth z displaced by
//                 u (1 - z / f); the blur disc is A |1 - z / f| in world units,
//                 the same everywhere in frame, and object size never shrinks.
//   perspective:  the same displacement seen through the pinhole at depth z,
//                 so on screen it is F A |1 / z - 1 / f| and objects shrink
//                 as 1 / z.
//
// The scene is five identical splat "houses" in a row receding from the
// camera; the numbers are illustrative (REASONED from the formulas above).
// Only +, -, *, / and abs here, so no hydration drift.

import { useId, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

const DEPTHS = [4, 6, 8, 10, 12]
const COLORS = ["#d9774b", "#7aa35a", "#5b84c9", "#c9a83f", "#a46bb8"]

const W = 640
const SIDE_H = 150
const SCREEN_H = 170

export function DofToy() {
  const uid = useId().replace(/:/g, "")
  const [ortho, setOrtho] = useState(true)
  const [aperture, setAperture] = useState(0.6) // aperture radius, world units
  const [focus, setFocus] = useState(8)

  // Blur radius on screen, in pixels.
  const ORTHO_PX_PER_UNIT = 22 // screen px per world unit for the orthographic view
  const PERSP_F = 150 // pinhole focal length in px, so a size-1 object at depth 8 is ~19 px
  const blur = (z: number) =>
    ortho ? aperture * Math.abs(1 - z / focus) * ORTHO_PX_PER_UNIT : PERSP_F * aperture * Math.abs(1 / z - 1 / focus)
  const size = (z: number) => (ortho ? 1.1 * ORTHO_PX_PER_UNIT : (1.1 * PERSP_F) / z)

  // Side view geometry: depth 0..14 across, lateral -2..2 up and down.
  const sx = (z: number) => 40 + (z / 14) * (W - 70)
  const sy = (y: number) => SIDE_H / 2 - y * 28
  const worldBlur = (z: number) => aperture * Math.abs(1 - z / focus)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>thin-lens camera, five splats in a row</span>
        <span className="text-muted-foreground/60">Cycles camera rays, illustrative scene</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
          <div className="flex gap-1.5">
            {(
              [
                [true, "orthographic"],
                [false, "perspective"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setOrtho(v)}
                aria-pressed={ortho === v}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  ortho === v
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            aperture {aperture.toFixed(2)}
            <Range min={0} max={1.5} step={0.05} value={aperture} onChange={(e) => setAperture(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            focus {focus.toFixed(1)}
            <Range min={3} max={13} step={0.5} value={focus} onChange={(e) => setFocus(Number(e.target.value))} />
          </label>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${SIDE_H}`} className="w-full min-w-[520px]" role="img">
            <title>
              {`Side view. Rays leave the edges of an aperture of radius ${aperture.toFixed(2)} and cross at the focal plane at depth ${focus.toFixed(1)}. The blur disc at each splat is aperture times the absolute value of one minus depth over focus.`}
            </title>
            <line x1={sx(0)} y1={sy(aperture)} x2={sx(0)} y2={sy(-aperture)} className="stroke-foreground" strokeWidth={3} />
            <text x={sx(0) - 4} y={SIDE_H - 6} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
              lens
            </text>
            <line x1={sx(focus)} y1={8} x2={sx(focus)} y2={SIDE_H - 18} className="stroke-muted-foreground" strokeDasharray="4 3" />
            <text x={sx(focus)} y={SIDE_H - 6} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
              focal plane
            </text>
            {/* Two marginal rays through the on-axis focus point, extended to depth 14. */}
            {[aperture, -aperture].map((u) => (
              <line
                key={u}
                x1={sx(0)}
                y1={sy(u)}
                x2={sx(14)}
                y2={sy(u * (1 - 14 / focus))}
                className="stroke-foreground"
                strokeOpacity={0.35}
              />
            ))}
            {DEPTHS.map((z, i) => (
              <g key={z}>
                <line x1={sx(z)} y1={sy(worldBlur(z))} x2={sx(z)} y2={sy(-worldBlur(z))} stroke={COLORS[i]} strokeWidth={4} strokeOpacity={0.8} />
                <circle cx={sx(z)} cy={sy(0)} r={3} fill={COLORS[i]} />
                <text x={sx(z)} y={14} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
                  {`z=${z}`}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${SCREEN_H}`} className="w-full min-w-[520px] rounded-lg border bg-background" role="img">
            <title>
              {`What the camera sees, ${ortho ? "orthographic" : "perspective"}. Blur radii in pixels from nearest to farthest: ${DEPTHS.map((z) => blur(z).toFixed(1)).join(", ")}.`}
            </title>
            <defs>
              {DEPTHS.map((z, i) => (
                <filter key={z} id={`${uid}-b${i}`} x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation={blur(z) / 2} />
                </filter>
              ))}
            </defs>
            {DEPTHS.map((z, i) => {
              const cx = 70 + i * 125
              const s = size(z)
              const base = SCREEN_H - 40
              return (
                <g key={z} filter={`url(#${uid}-b${i})`}>
                  <rect x={cx - s / 2} y={base - s} width={s} height={s} fill={COLORS[i]} />
                  <polygon points={`${cx - s * 0.65},${base - s} ${cx},${base - s * 1.7} ${cx + s * 0.65},${base - s}`} fill={COLORS[i]} fillOpacity={0.75} />
                </g>
              )
            })}
            {DEPTHS.map((z, i) => (
              <text key={z} x={70 + i * 125} y={SCREEN_H - 14} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
                {`blur ${blur(z).toFixed(1)} px`}
              </text>
            ))}
          </svg>
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {ortho
            ? "Orthographic: every house is the same size and the blur grows in step with distance from the focal plane, front and back alike. Nothing in the frame tells you how far away anything is, except the blur, and a blur that strong says macro lens on a small model."
            : "Perspective: far houses shrink, and the blur behind the focal plane levels off at a constant while the blur in front keeps growing. That is how a normal lens on a normal-sized scene looks."}
        </p>
      </div>
    </figure>
  )
}
