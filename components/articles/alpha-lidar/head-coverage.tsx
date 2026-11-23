"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { masin, matan2, mcos, msin } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"

// Where a 16-line LiDAR's beams land on the sphere around it, accumulated over a time window.
// Drawn as an equirectangular map: azimuth across, elevation up the side, brighter where more
// returns fall per unit solid angle. Four mounts:
//   upright      the usual mount: a 30-degree band all the way round, the poles blind.
//   on its side  alpha-LiDAR's head with the motor stopped: the fan is vertical, one slice of sky.
//   spinning     the motor turns the head at a constant rate: the fan sweeps the whole sphere.
//   focus        the motor swings the head back and forth over a sector: returns pile up there.
// Geometry from the repo's configs: the LiDAR's spin axis sits at 90 degrees to the motor axis
// (extrinsic_R_encoder_lidar); the motor axis is drawn vertical here. 16 rings at 2-degree
// spacing over -15..+15 degrees, 1-degree azimuth steps, 10 sweeps a second. A model, not data.

const RINGS = Array.from({ length: 16 }, (_, i) => -15 + i * 2)
const AZ_STEP = 1 // degrees between firings in the model
const SWEEP = 0.1 // seconds per LiDAR revolution
const CW = 180 // map cells across (2 degrees each)
const CH = 90 // map cells down
const D2R = Math.PI / 180

type Mode = "upright" | "side" | "spin" | "focus"
const MODES: { id: Mode; label: string }[] = [
  { id: "upright", label: "upright, no motor" },
  { id: "side", label: "on its side, motor still" },
  { id: "spin", label: "motor spinning" },
  { id: "focus", label: "focus sweep" },
]

function motorAngle(mode: Mode, t: number, omega: number, amp: number) {
  if (mode === "spin") return omega * t
  // the fan plane turned a quarter so it passes through 'ahead', then swung either side of it
  if (mode === "focus") return Math.PI / 2 + amp * D2R * msin((omega / (amp * D2R || 1)) * t)
  return 0
}

function accumulate(mode: Mode, omega: number, amp: number, win: number) {
  const grid = new Float32Array(CW * CH)
  const sweeps = Math.max(1, Math.round(win / SWEEP))
  const nAz = 360 / AZ_STEP
  let pts = 0
  for (let s = 0; s < sweeps; s++) {
    for (let a = 0; a < nAz; a++) {
      const phi = a * AZ_STEP * D2R
      const t = s * SWEEP + (a / nAz) * SWEEP
      const th = motorAngle(mode, t, omega, amp)
      const ct = mcos(th)
      const st = msin(th)
      for (const e of RINGS) {
        const ce = mcos(e * D2R)
        // direction in the LiDAR frame (z = its spin axis)
        const lx = ce * mcos(phi)
        const ly = ce * msin(phi)
        const lz = msin(e * D2R)
        let x: number, y: number, z: number
        if (mode === "upright") {
          x = lx; y = ly; z = lz
        } else {
          // on its side: LiDAR z -> world x, LiDAR x -> world -z; then the motor turns it about world z
          const sx = lz, sy = ly, sz = -lx
          x = ct * sx - st * sy
          y = st * sx + ct * sy
          z = sz
        }
        const el = masin(Math.max(-1, Math.min(1, z)))
        const az = matan2(y, x)
        const cx = Math.min(CW - 1, Math.floor(((az / D2R + 180) / 360) * CW))
        const cy = Math.min(CH - 1, Math.floor(((90 - el / D2R) / 180) * CH))
        grid[cy * CW + cx] += 1
        pts++
      }
    }
  }
  // per solid angle: a cell's area shrinks as cos(elevation)
  let covered = 0
  let area = 0
  let roi = 0
  let roiArea = 0
  for (let r = 0; r < CH; r++) {
    const el = (90 - (r + 0.5) * (180 / CH)) * D2R
    const w = mcos(el)
    for (let c = 0; c < CW; c++) {
      const i = r * CW + c
      area += w
      if (grid[i] > 0) covered += w
      const azc = -180 + (c + 0.5) * (360 / CW)
      const elc = el / D2R
      if (Math.abs(azc) <= 20 && Math.abs(elc) <= 20) {
        roi += grid[i]
        roiArea += w
      }
      grid[i] = grid[i] / Math.max(w, 0.02)
    }
  }
  return { grid, pts, coverage: covered / area, roiDensity: roiArea > 0 ? roi / roiArea : 0, sweeps }
}

export function HeadCoverage() {
  const [mode, setMode] = useState<Mode>("spin")
  const [omega, setOmega] = useState(3)
  const [amp, setAmp] = useState(30)
  const [win, setWin] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const res = useMemo(() => accumulate(mode, omega, amp, win), [mode, omega, amp, win])
  const base = useMemo(() => accumulate("upright", omega, amp, win), [omega, amp, win])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const img = ctx.createImageData(CW, CH)
    let mx = 0
    for (let i = 0; i < res.grid.length; i++) mx = Math.max(mx, res.grid[i])
    const lm = Math.log1p(mx || 1)
    for (let i = 0; i < res.grid.length; i++) {
      const v = res.grid[i] > 0 ? Math.log1p(res.grid[i]) / lm : 0
      const o = i * 4
      if (v === 0) {
        img.data[o] = 24; img.data[o + 1] = 24; img.data[o + 2] = 28
      } else {
        // dark teal -> amber -> near white
        img.data[o] = Math.round(30 + 225 * Math.min(1, v * 1.4))
        img.data[o + 1] = Math.round(90 + 150 * v)
        img.data[o + 2] = Math.round(120 + 100 * (1 - v) + 30 * v)
      }
      img.data[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [res])

  const pct = (v: number) => `${(v * 100).toFixed(0)}%`
  const gain = base.roiDensity > 0 ? res.roiDensity / base.roiDensity : 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">where 16 beams land · {win.toFixed(1)} s of scans</span>
        <div className="flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", mode === m.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className="relative mx-auto w-full max-w-[720px]">
          <canvas ref={canvasRef} width={CW} height={CH} role="img"
            aria-label="An equirectangular map of the sphere around the sensor: azimuth left to right, elevation bottom to top, bright where LiDAR returns land."
            className="block aspect-[2/1] w-full rounded border [image-rendering:pixelated]" />
          <div className="pointer-events-none absolute inset-0 font-mono text-[10px] text-white/70">
            <span className="absolute left-1 top-1">up +90°</span>
            <span className="absolute bottom-1 left-1">down −90°</span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2">ahead</span>
            <span className="absolute right-1 top-1/2 -translate-y-1/2">behind</span>
            <span className="absolute left-1/2 top-1/2 h-[22%] w-[11%] -translate-x-1/2 -translate-y-1/2 border border-dashed border-white/50" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
                <span>motor rate</span><span>{omega.toFixed(1)} rad/s</span>
              </div>
              <Range min={0.5} max={6} step={0.5} value={omega} onChange={(e) => setOmega(Number(e.target.value))} disabled={mode === "upright" || mode === "side"} aria-label="motor rate in radians per second" />
            </label>
            <label className="block">
              <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
                <span>focus sector half-width</span><span>±{amp}°</span>
              </div>
              <Range min={10} max={90} step={5} value={amp} onChange={(e) => setAmp(Number(e.target.value))} disabled={mode !== "focus"} aria-label="focus sector half-width in degrees" />
            </label>
            <label className="block">
              <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
                <span>time window</span><span>{win.toFixed(1)} s</span>
              </div>
              <Range min={0.1} max={2} step={0.1} value={win} onChange={(e) => setWin(Number(e.target.value))} aria-label="time window in seconds" />
            </label>
          </div>
          <dl className="grid grid-cols-2 gap-2 self-start font-mono text-xs">
            <div className="rounded border p-2"><dt className="text-muted-foreground">sphere covered</dt><dd className="text-lg">{pct(res.coverage)}</dd></div>
            <div className="rounded border p-2"><dt className="text-muted-foreground">upright, same window</dt><dd className="text-lg">{pct(base.coverage)}</dd></div>
            <div className="col-span-2 rounded border p-2"><dt className="text-muted-foreground">returns in the dashed box, against upright</dt><dd className="text-lg">{gain.toFixed(2)}×</dd></div>
          </dl>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        A model of a 16-line LiDAR (rings every 2° from −15° to +15°, 10 sweeps a second) with its spin axis at
        right angles to a motor axis, as alpha-LiDAR&apos;s configs set it. Upright, the sensor sees a 30° band and
        nothing above or below it. On its side with the motor running, the same 16 beams paint the whole sphere
        within a second; the focus sweep trades the far side for more returns in the dashed box ahead.
      </figcaption>
    </figure>
  )
}
