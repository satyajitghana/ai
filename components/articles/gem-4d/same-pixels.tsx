"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The paper's first insight about its Eq. 1, made concrete in one dimension.
//
// A pinhole camera looking along +z sees a gripper at pixel u = (x - c) / z,
// where c is the camera's sideways position. A generated video fixes only the
// pixels u_k. Depth z_k, camera motion c_k and the gripper's own motion are
// whatever the generator implicitly decided, and many choices draw the same
// frames. Lifting the pixels back to 3D, which is what an action extractor
// does with estimated depth, gives x_k = c_k + u_k * z_k.
//
// - depth scale: all frames at the same depth, scaled. Same pixels, a longer or
//   shorter reach (the classic scale ambiguity).
// - camera share: part of the on-screen motion is the camera panning, so the
//   gripper itself moves less. Same pixels again.
// - drift: each frame gets its own depth, as a video whose geometry is not
//   consistent across frames would imply. Same pixels; a zigzag in 3D.
//
// Toy numbers, not the paper's. Only + - * /, so SSR and the browser agree.

const U = [-0.36, -0.18, 0, 0.18, 0.36] // pixel positions, frames 0..4 (fixed)
const DRIFT = [1, 1.45, 0.75, 1.35, 0.85] // per-frame depth multipliers when drifting
const Z0 = 1.6

export function SamePixels() {
  const [scale, setScale] = useState(1)
  const [share, setShare] = useState(0)
  const [drift, setDrift] = useState(false)

  const pts = U.map((u, k) => {
    const z = Z0 * scale * (drift ? DRIFT[k] : 1)
    // the camera pans left by `share` of the per-frame step, so that much of
    // the on-screen motion is the camera's and the gripper moves less
    const c = -share * (U[1] - U[0]) * Z0 * scale * k
    return { u, z, c, x: c + u * z }
  })

  let path = 0
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k].x - pts[k - 1].x
    const dz = pts[k].z - pts[k - 1].z
    path += Math.sqrt(dx * dx + dz * dz)
  }
  const net = pts[pts.length - 1].x - pts[0].x

  // top-down view: world x in [-2.4, 2], z in [0, 4]
  const W = 360
  const H = 260
  const sx = (x: number) => ((x + 2.4) / 4.4) * W
  const sz = (z: number) => H - 14 - (z / 4) * (H - 28)

  const accent = "var(--hg-accent, oklch(0.62 0.13 165))"

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Five identical frames, three different 3D motions: why a pixel loss cannot pin down geometry"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        the video fixes five pixels · everything else is a choice the generator made · toy numbers
      </div>

      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">depth scale</span>
          <Range
            min={0.5}
            max={1.6}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="depth scale of the scene"
          />
          <span className="w-12 shrink-0 text-right tabular-nums">{scale.toFixed(2)}×</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">camera share</span>
          <Range
            min={0}
            max={1}
            step={0.05}
            value={share}
            onChange={(e) => setShare(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="share of the on-screen motion that is the camera panning"
          />
          <span className="w-12 shrink-0 text-right tabular-nums">{(share * 100).toFixed(0)}%</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="geometry across frames">
          <span className="w-28 shrink-0 text-muted-foreground">across frames</span>
          {[
            { on: !drift, label: "one consistent depth", set: false },
            { on: drift, label: "depth drifts per frame", set: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={o.on}
              onClick={() => setDrift(o.set)}
              className={cn(
                "rounded border px-2 py-1",
                o.on
                  ? "border-foreground/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">what the video shows</div>
          <svg viewBox="0 0 240 120" width="100%" role="img" aria-label="Five frames: the gripper steps left to right by the same pixel amount each frame, unchanged by every control.">
            {U.map((u, k) => (
              <g key={k}>
                <rect x={6} y={6 + k * 22} width={228} height={18} rx={2} fill="none" stroke="currentColor" strokeOpacity={0.25} />
                <circle cx={120 + u * 280} cy={15 + k * 22} r={5} fill={accent} />
                <text x={10} y={19 + k * 22} className="fill-current font-mono text-[9px] opacity-60">
                  t{k}
                </text>
              </g>
            ))}
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">
            Identical in every setting. A pixel or latent loss sees only this.
          </p>
        </div>
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">what it means in 3D (top view)</div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Top view: the lifted gripper path is ${path.toFixed(2)} units long with a net sideways move of ${net.toFixed(2)}.`}>
            {pts.map((p, k) => (
              <g key={k}>
                <line
                  x1={sx(p.c)}
                  y1={sz(0)}
                  x2={sx(p.c + p.u * 3.9)}
                  y2={sz(3.9)}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <path
                  d={`M ${sx(p.c) - 6} ${sz(0) + 8} L ${sx(p.c) + 6} ${sz(0) + 8} L ${sx(p.c)} ${sz(0) - 2} Z`}
                  className="fill-current"
                  opacity={0.15 + 0.17 * k}
                />
              </g>
            ))}
            <polyline
              points={pts.map((p) => `${sx(p.x)},${sz(p.z)}`).join(" ")}
              fill="none"
              stroke={accent}
              strokeWidth={2}
            />
            {pts.map((p, k) => (
              <g key={`p${k}`}>
                <circle cx={sx(p.x)} cy={sz(p.z)} r={5} fill={accent} />
                <text x={sx(p.x) + 7} y={sz(p.z) - 6} className="fill-current font-mono text-[9px] opacity-70">
                  t{k}
                </text>
              </g>
            ))}
            <text x={4} y={H - 2} className="fill-current font-mono text-[9px] opacity-60">
              camera (triangles), rays through each frame&rsquo;s pixel
            </text>
          </svg>
        </div>
      </div>

      <div className="grid gap-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">gripper net sideways move </span>
          <span className="tabular-nums">{net.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">3D path an extractor would follow </span>
          <span className="tabular-nums">{path.toFixed(2)}</span>
        </div>
      </div>
    </figure>
  )
}
