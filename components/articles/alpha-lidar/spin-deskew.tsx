"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { matan2, mcos, msin } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"

// One 100 ms sweep of a LiDAR whose head is being turned by a motor, seen from above.
// Each return is measured at its own instant, so at its own head angle. Stack the sweep as if
// the head had stood still at the end pose and the room bends: a return fired t seconds before
// the end is off by omega * t radians, which is omega * t * r metres at range r.
// "deskewed" re-expresses every return in the end pose using the IMU's angle at its firing time
// (the IMU rides on the head, so it measures the motor's turn directly). A gyro bias of b rad/s
// leaves b * t * r. The ellipses are the per-point uncertainty alpha-LiDAR carries into
// matching: range noise along the beam, and r * sigma_theta across it, so far points count less.
// A planar model with made-up room geometry; the numbers in the panel are the model's.

const SWEEP = 0.1
const ROOM = { x0: -6, x1: 7, y0: -4, y1: 5 } // metres, sensor at the origin
const N = 180 // returns drawn per sweep

function rayToRoom(a: number) {
  const dx = mcos(a)
  const dy = msin(a)
  let t = Infinity
  if (dx > 1e-9) t = Math.min(t, ROOM.x1 / dx)
  if (dx < -1e-9) t = Math.min(t, ROOM.x0 / dx)
  if (dy > 1e-9) t = Math.min(t, ROOM.y1 / dy)
  if (dy < -1e-9) t = Math.min(t, ROOM.y0 / dy)
  return t
}

export function SpinDeskew() {
  const [omega, setOmega] = useState(3)
  const [bias, setBias] = useState(0)
  const [mode, setMode] = useState<"raw" | "deskew">("raw")
  const [ellipses, setEllipses] = useState(true)
  const [sigmaDeg, setSigmaDeg] = useState(0.5)

  const pts = useMemo(() => {
    const out: { x: number; y: number; r: number; a: number }[] = []
    for (let i = 0; i < N; i++) {
      const tFire = (i / N) * SWEEP // seconds after the sweep started
      const before = SWEEP - tFire // seconds before the sweep ended
      const world = (i / N) * 2 * Math.PI // the beam's true direction in the room
      const r = rayToRoom(world)
      // angle error left when stacking in the end pose
      const err = mode === "raw" ? omega * before : bias * before
      const a = world - err
      out.push({ x: r * mcos(a), y: r * msin(a), r, a })
    }
    return out
  }, [omega, bias, mode])

  const worst = useMemo(() => {
    let w = 0
    for (let i = 0; i < N; i++) {
      const before = SWEEP - (i / N) * SWEEP
      const r = rayToRoom((i / N) * 2 * Math.PI)
      w = Math.max(w, (mode === "raw" ? omega : bias) * before * r)
    }
    return w
  }, [omega, bias, mode])

  const W = 340
  const H = 260
  const sc = 17
  const sx = (x: number) => W / 2 + (x - 0.5) * sc
  const sy = (y: number) => H / 2 - (y - 0.5) * sc
  const sig = (sigmaDeg * Math.PI) / 180

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">one sweep, head turning · top view</span>
        <div className="flex gap-1">
          {([["raw", "stacked as if still"], ["deskew", "deskewed with the IMU"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", mode === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[340px_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A rectangular room seen from above with one LiDAR sweep: bent into a spiral when stacked as if the head stood still, straight when each return is moved by the IMU's angle at its firing time." className="mx-auto w-full max-w-[340px] rounded-md border bg-muted/20">
          <rect x={sx(ROOM.x0)} y={sy(ROOM.y1)} width={(ROOM.x1 - ROOM.x0) * sc} height={(ROOM.y1 - ROOM.y0) * sc}
            fill="none" stroke="var(--muted-foreground)" strokeDasharray="3 3" opacity="0.6" />
          {ellipses && pts.filter((_, i) => i % 6 === 0).map((p, i) => {
            const across = Math.max(0.03, p.r * sig) * sc
            const along = 0.04 * sc
            const deg = (matan2(p.y, p.x) * 180) / Math.PI
            return (
              <ellipse key={`e${i}`} cx={sx(p.x)} cy={sy(p.y)} rx={along} ry={across}
                transform={`rotate(${(-deg).toFixed(2)} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)})`}
                fill="oklch(0.7 0.12 230 / 0.18)" stroke="oklch(0.7 0.12 230 / 0.6)" strokeWidth="0.6" />
            )
          })}
          {pts.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="1.7"
              fill={mode === "raw" ? "oklch(0.7 0.16 30)" : "oklch(0.72 0.15 150)"}
              opacity={0.35 + (0.65 * i) / N} />
          ))}
          <circle cx={sx(0)} cy={sy(0)} r="4" fill="var(--foreground)" />
          <text x={sx(0) + 6} y={sy(0) - 6} fontSize="9" className="font-mono" fill="var(--muted-foreground)">head</text>
        </svg>
        <div className="flex flex-col justify-center gap-3">
          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>motor rate</span><span>{omega.toFixed(1)} rad/s · {((omega * 180) / Math.PI).toFixed(0)}°/s</span>
            </div>
            <Range min={0} max={6} step={0.5} value={omega} onChange={(e) => setOmega(Number(e.target.value))} aria-label="motor rate in radians per second" />
          </label>
          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>gyro bias left after deskew</span><span>{bias.toFixed(2)} rad/s</span>
            </div>
            <Range min={0} max={0.3} step={0.02} value={bias} onChange={(e) => setBias(Number(e.target.value))} disabled={mode === "raw"} aria-label="gyro bias in radians per second" />
          </label>
          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>angular noise per point (σθ)</span><span>{sigmaDeg.toFixed(1)}°</span>
            </div>
            <Range min={0.1} max={2} step={0.1} value={sigmaDeg} onChange={(e) => setSigmaDeg(Number(e.target.value))} aria-label="angular noise per point in degrees" />
          </label>
          <button type="button" onClick={() => setEllipses((v) => !v)} aria-pressed={ellipses}
            className={cn("w-fit cursor-pointer rounded border px-2 py-1 font-mono text-xs", ellipses ? "bg-foreground text-background" : "text-muted-foreground")}>
            {ellipses ? "hide" : "show"} uncertainty ellipses
          </button>
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="rounded border p-2"><dt className="text-muted-foreground">head turn in one sweep</dt><dd className="text-base">{((omega * SWEEP * 180) / Math.PI).toFixed(1)}°</dd></div>
            <div className="rounded border p-2"><dt className="text-muted-foreground">worst return off by</dt><dd className="text-base">{worst < 0.995 ? `${(worst * 100).toFixed(0)} cm` : `${worst.toFixed(2)} m`}</dd></div>
            <div className="col-span-2 rounded border p-2"><dt className="text-muted-foreground">σ across the beam at 8 m</dt><dd className="text-base">{(8 * sig * 100).toFixed(1)} cm</dd></div>
          </dl>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        A planar model. Returns fade in with firing time, the last ones brightest. At 3 rad/s the head turns 17° in a single 100 ms sweep, so the
        first returns of a sweep land metres from their wall unless each one is moved by the head&apos;s angle at its own instant. The ellipses grow with
        range because an angle error is a distance error times range, which is why alpha-LiDAR weights each return by its own covariance.
      </figcaption>
    </figure>
  )
}
