"use client"

// One direction, three ways to store the sphere, at the sizes my FIORD run used:
// a 4096 x 2048 equirectangular panorama (ERP), 1024 px cube faces cut from it,
// and the two 3264 px fisheye originals (focal length from the dataset authors'
// COLMAP calibration, distortion terms left out here: they move it by a few percent).
//
// Pick a direction; a ring of directions 10 degrees around it is drawn in every
// layout, so the shape of the ring is the distortion. The readout is the local
// sampling density in pixels per degree, along the ring's two axes:
//   ERP:     east (W/360)/cos(lat), north H/180
//   cube:    a pinhole of focal S/2: radial f/cos^2(t), tangential f/cos(t)
//   fisheye: equidistant r = f t: radial f, tangential f t/sin(t)
// (t = angle from the face's or the lens's axis; px/deg = px/rad * pi/180.)
// The pano frame is COLMAP's: x right, y down, z forward (lens 1 looks along +z).
// Every trig call goes through lib/dmath so server and client agree to the bit.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { macos, matan2, mcos, msin } from "@/lib/dmath"

const ERP_W = 4096
const ERP_H = 2048
const FACE = 1024
const F_FISH = 935 // px, lens 1, from the authors' OPENCV_FISHEYE calibration scaled to 3264 px
const DEG = Math.PI / 180
const RING_DEG = 10

const A = "oklch(0.62 0.15 200)"
const B = "oklch(0.66 0.16 40)"
const C = "oklch(0.6 0.14 140)"
const MUTED = "oklch(0.62 0.03 255)"

type V3 = [number, number, number]

function dir(yawDeg: number, pitchDeg: number): V3 {
  const y = yawDeg * DEG
  const p = pitchDeg * DEG
  return [mcos(p) * msin(y), -msin(p), mcos(p) * mcos(y)]
}
function norm(v: V3): V3 {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return [v[0] / n, v[1] / n, v[2] / n]
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function ring(d: V3, deg: number, n = 40): V3[] {
  const helper: V3 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const e1 = norm(cross(d, helper))
  const e2 = cross(d, e1)
  const c = mcos(deg * DEG)
  const s = msin(deg * DEG)
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n
    const ca = mcos(a)
    const sa = msin(a)
    out.push([c * d[0] + s * (ca * e1[0] + sa * e2[0]), c * d[1] + s * (ca * e1[1] + sa * e2[1]), c * d[2] + s * (ca * e1[2] + sa * e2[2])])
  }
  return out
}

// ERP in [0,1]^2
function erp(v: V3): [number, number] {
  const yaw = matan2(v[0], v[2])
  const pitch = -matan2(v[1], Math.sqrt(v[0] * v[0] + v[2] * v[2]))
  return [(1 + yaw / Math.PI) / 2, (1 - (pitch * 2) / Math.PI) / 2]
}

// cube: which face, and [0,1]^2 inside it
const FACES = ["left", "front", "right", "back", "up", "down"] as const
type Face = (typeof FACES)[number]
function cube(v: V3): { face: Face; u: number; w: number; t: number } {
  const [x, y, z] = v
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  let face: Face
  let u: number
  let w: number
  let m: number
  if (az >= ax && az >= ay) {
    m = az
    if (z > 0) { face = "front"; u = x / m; w = y / m } else { face = "back"; u = -x / m; w = y / m }
  } else if (ax >= ay) {
    m = ax
    if (x > 0) { face = "right"; u = -z / m; w = y / m } else { face = "left"; u = z / m; w = y / m }
  } else {
    m = ay
    if (y < 0) { face = "up"; u = x / m; w = z / m } else { face = "down"; u = x / m; w = -z / m }
  }
  return { face, u: (u + 1) / 2, w: (w + 1) / 2, t: macos(Math.min(1, m)) }
}
const NET: Record<Face, [number, number]> = { left: [0, 1], front: [1, 1], right: [2, 1], back: [3, 1], up: [1, 0], down: [1, 2] }

// dual fisheye, equidistant; lens 2 looks along -z, mirrored in x
function fish(v: V3): { lens: 1 | 2; x: number; y: number; t: number } {
  const lens: 1 | 2 = v[2] >= 0 ? 1 : 2
  const lx = lens === 1 ? v[0] : -v[0]
  const lz = lens === 1 ? v[2] : -v[2]
  const t = matan2(Math.sqrt(lx * lx + v[1] * v[1]), lz)
  const r = Math.sqrt(lx * lx + v[1] * v[1])
  const k = r > 1e-9 ? t / r : 0
  // unit disc covers 100 degrees from the axis
  const s = 1 / (100 * DEG)
  return { lens, x: lx * k * s, y: v[1] * k * s, t }
}

export function RayGeometry() {
  const [yaw, setYaw] = useState(30)
  const [pitch, setPitch] = useState(20)
  const d = dir(yaw, pitch)
  const pts = ring(d, RING_DEG)

  const lat = pitch * DEG
  const erpEast = ERP_W / 360 / mcos(lat)
  const erpNorth = ERP_H / 180
  const cb = cube(d)
  const fCube = FACE / 2
  const cubeRad = (fCube / (mcos(cb.t) * mcos(cb.t))) * DEG
  const cubeTan = (fCube / mcos(cb.t)) * DEG
  const fs = fish(d)
  const fishRad = F_FISH * DEG
  const fishTan = fs.t > 1e-6 ? ((F_FISH * fs.t) / msin(fs.t)) * DEG : F_FISH * DEG
  const seamDeg = Math.abs(90 - fs.t / DEG)

  // layout
  const W = 640
  const ex = 20, ey = 30, ew = 600, eh = 300 // ERP
  const cs = 70, cx0 = 40, cy0 = 380 // cube net cell size
  const fr = 80, fy = 485, f1x = 430, f2x = 560 // fisheye discs

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one direction, three layouts: where a 10° ring of rays lands</span>
        <span className="text-muted-foreground/60">computed</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-xs text-muted-foreground">
            yaw: <span className="text-foreground">{yaw}°</span>
            <Range min={-180} max={180} step={1} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} accent={A} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-xs text-muted-foreground">
            pitch: <span className="text-foreground">{pitch}°</span>
            <Range min={-85} max={85} step={1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} accent={A} className="mt-1 w-full" />
          </label>
        </div>
        <svg
          viewBox={`0 0 ${W} 590`}
          className="w-full"
          role="img"
          aria-label={`A ring of rays 10 degrees around yaw ${yaw}, pitch ${pitch}, drawn on an equirectangular panorama, a cube net and two fisheye discs. Sampling: ERP ${erpEast.toFixed(1)} by ${erpNorth.toFixed(1)} pixels per degree, cube face ${cubeRad.toFixed(1)} by ${cubeTan.toFixed(1)}, fisheye ${fishRad.toFixed(1)} by ${fishTan.toFixed(1)}.`}
        >
          <text x={ex} y={ey - 10} fontSize={11} className="fill-muted-foreground font-mono">equirectangular, {ERP_W} × {ERP_H}</text>
          <rect x={ex} y={ey} width={ew} height={eh} fill="none" stroke={MUTED} strokeOpacity={0.6} />
          {[1, 2, 3].map((i) => (
            <line key={i} x1={ex + (ew * i) / 4} x2={ex + (ew * i) / 4} y1={ey} y2={ey + eh} stroke={MUTED} strokeOpacity={0.2} />
          ))}
          <line x1={ex} x2={ex + ew} y1={ey + eh / 2} y2={ey + eh / 2} stroke={MUTED} strokeOpacity={0.2} />
          {/* the stitch seam: directions 90 degrees from both lens axes (x = +-1 in yaw = +-90) */}
          {[0.25, 0.75].map((u) => (
            <line key={u} x1={ex + ew * u} x2={ex + ew * u} y1={ey} y2={ey + eh} stroke={B} strokeDasharray="5 4" strokeOpacity={0.8} />
          ))}
          <text x={ex + ew * 0.75 + 4} y={ey + 14} fontSize={10} fill={B} className="font-mono">seam</text>
          {pts.map((p, i) => {
            const [u, v] = erp(p)
            return <circle key={i} cx={ex + u * ew} cy={ey + v * eh} r={2.2} fill={A} />
          })}

          <text x={cx0} y={cy0 - 10} fontSize={11} className="fill-muted-foreground font-mono">cube faces, {FACE} px each</text>
          {FACES.map((f) => {
            const [i, j] = NET[f]
            const on = cb.face === f
            return (
              <g key={f}>
                <rect x={cx0 + i * cs} y={cy0 + j * cs} width={cs} height={cs} fill={on ? A : "none"} fillOpacity={on ? 0.08 : 0} stroke={MUTED} strokeOpacity={0.6} />
                <text x={cx0 + i * cs + 4} y={cy0 + j * cs + 12} fontSize={9} className="fill-muted-foreground font-mono">{f}</text>
              </g>
            )
          })}
          {pts.map((p, k) => {
            const c = cube(p)
            const [i, j] = NET[c.face]
            return <circle key={k} cx={cx0 + (i + c.u) * cs} cy={cy0 + (j + c.w) * cs} r={2} fill={C} />
          })}

          <text x={f1x - fr} y={fy - fr - 10} fontSize={11} className="fill-muted-foreground font-mono">dual fisheye, 3264 px each</text>
          {[f1x, f2x].map((x, k) => (
            <g key={x}>
              <circle cx={x} cy={fy} r={fr * 0.9} fill="none" stroke={B} strokeDasharray="5 4" strokeOpacity={0.7} />
              <circle cx={x} cy={fy} r={fr} fill="none" stroke={MUTED} strokeOpacity={0.6} />
              <text x={x} y={fy + fr + 14} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">lens {k + 1}</text>
            </g>
          ))}
          {pts.map((p, k) => {
            const f = fish(p)
            const x = f.lens === 1 ? f1x : f2x
            return <circle key={k} cx={x + f.x * fr} cy={fy + f.y * fr} r={2} fill={B} />
          })}
          <text x={f2x} y={fy - fr - 10} fontSize={9} textAnchor="middle" fill={B} className="font-mono">
            dashed: 90° from the axis
          </text>
        </svg>
        <div className="grid gap-2 font-mono text-xs leading-relaxed text-muted-foreground sm:grid-cols-3">
          <div className="rounded-lg border bg-background/50 px-3 py-2">
            <span style={{ color: A }}>ERP</span>: <span className="text-foreground">{erpEast.toFixed(1)}</span> px/° east ×{" "}
            <span className="text-foreground">{erpNorth.toFixed(1)}</span> north
          </div>
          <div className="rounded-lg border bg-background/50 px-3 py-2">
            <span style={{ color: C }}>cube</span> ({cb.face}, {(cb.t / DEG).toFixed(0)}° off axis): <span className="text-foreground">{cubeRad.toFixed(1)}</span> ×{" "}
            <span className="text-foreground">{cubeTan.toFixed(1)}</span>
          </div>
          <div className="rounded-lg border bg-background/50 px-3 py-2">
            <span style={{ color: B }}>fisheye</span> (lens {fs.lens}, {(fs.t / DEG).toFixed(0)}° off axis): <span className="text-foreground">{fishRad.toFixed(1)}</span> ×{" "}
            <span className="text-foreground">{fishTan.toFixed(1)}</span>; {seamDeg.toFixed(0)}° from the seam
          </div>
        </div>
      </div>
    </figure>
  )
}
