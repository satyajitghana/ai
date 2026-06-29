"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Motion compensation, made visible. A LiDAR doesn't capture a scan instantly — it
// sweeps over ~100 ms while the platform moves, so each point is measured from a
// slightly different pose. Stack the raw points into one frame and a straight wall
// comes out sheared. FAST-LIO2's backward propagation uses the IMU-estimated motion
// to transform every point to the scan-end pose, un-shearing it. Toggle deskew and
// drag the speed. Simplified planar model; the real thing is full 6-DoF SE(3).

const N = 18 // points in the sweep
const WALL = 70 // true wall x-position (arbitrary units)
const T = 1 // scan duration

export function Deskew() {
  const [deskew, setDeskew] = useState(false)
  const [v, setV] = useState(22) // platform speed during the sweep

  // point i captured at time t_i; raw stacking misplaces it by v·(T − t_i)
  const pts = Array.from({ length: N }, (_, i) => {
    const ti = (i / (N - 1)) * T
    const y = 12 + (i / (N - 1)) * 76 // spread along the wall
    const rawX = WALL + v * (T - ti) * 0.6 // un-compensated stacking error
    return { x: deskew ? WALL : rawX, y, ti }
  })

  const W = 320
  const H = 220
  const sx = (x: number) => 20 + (x / 140) * (W - 40)
  const sy = (y: number) => 20 + (y / 100) * (H - 40)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">scan deskew · motion compensation</span>
        <div className="flex gap-1">
          {[
            { val: false, label: "raw (skewed)" },
            { val: true, label: "deskewed" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setDeskew(o.val)}
              aria-pressed={deskew === o.val}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                deskew === o.val ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[320px_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="LiDAR points from a moving sensor: raw stacking shears a straight wall; deskewing recovers it." className="mx-auto w-full max-w-[320px] rounded-md border bg-muted/20">
          {/* true wall */}
          <line x1={sx(WALL)} y1={sy(8)} x2={sx(WALL)} y2={sy(92)} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <text x={sx(WALL)} y={sy(4)} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="var(--muted-foreground)">true wall</text>
          {/* sensor trajectory */}
          {Array.from({ length: 5 }, (_, k) => (
            <circle key={k} cx={sx(2 + k * 3)} cy={sy(50)} r="2" fill="oklch(0.72 0.14 40)" opacity={0.3 + k * 0.15} />
          ))}
          <text x={sx(8)} y={sy(62)} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="var(--muted-foreground)">sensor →</text>
          {/* points */}
          {pts.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.6" fill={deskew ? "oklch(0.72 0.15 150)" : "oklch(0.72 0.15 25)"} />
          ))}
        </svg>

        <div className="flex flex-col justify-center gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>platform speed during scan</span>
              <span className="text-foreground tabular-nums">{v}</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={v} onChange={(e) => setV(parseInt(e.target.value))} className="w-full cursor-pointer accent-foreground" aria-label="platform speed" />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {deskew
              ? "Each point is transformed from the pose it was actually measured at to the scan-end pose, using the IMU-propagated trajectory across the sweep. The wall is straight again — and only now is it safe to register against the map."
              : "Every point lands in the same frame even though the sensor moved between measurements, so a flat wall comes out sheared by the platform's motion. Register this against the map and you'd fight your own motion. Faster motion, worse skew — turn the speed up."}
          </p>
        </div>
      </div>
    </figure>
  )
}
