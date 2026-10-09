"use client"

// A top-down camera-path editor over the real igloo scene, running a port of
// the path maths Atlas Camera Studio ships in src/trajectory/camera-trajectory.ts:
//
//   - positions: a centripetal Catmull-Rom curve through the keyframes
//     (cameraPathCurve, which is THREE.CatmullRomCurve3(..., "centripetal")),
//     sampled with getPoint(), so every keyframe-to-keyframe section gets the
//     same share of the clip;
//   - each interior frame is then a 7-tap binomial average of the curve,
//     weights [1, 6, 15, 20, 15, 6, 1] / 64, taps 1/96 of the path apart
//     (smoothCurvePoint); the first and last frames sit exactly on the ends;
//   - frame -> path progress: keyframe k lands on frame round(k * 47 / S), with
//     a monotone cubic Hermite between them (cameraPathProgressAtFrame);
//   - 48 frames, 12 fps (server/contracts.ts FRAMES, FPS).
//
// "Straight lerp" is src/camera.ts interpolateCameras(): the first editor's
// linear interpolation, which only a test still calls.
//
// Directions are simplified to yaw (the toy is a top view): "look at point"
// aims every camera at the target with a level horizon, as the app's look_at
// mode does; "forward" aims along the path's tangent, a simplification of the
// app's preset orientation frames. The vertical field of view is the app's
// default 33 degrees at 16:9.

import { useEffect, useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan, matan2, mcos, mhypot, mpow, msin, mtan } from "@/lib/dmath"

import { IGLOO_TOP } from "./igloo-top"

type P = [number, number] // [x, z] in scene units; the camera starts at the origin looking down -z

const FRAMES = 48
const FPS = 12
const CAM_Y = 1.067 // igloo.json camera height
const CENTROID: P = [-0.037, -5.617] // igloo.json centroidWorld (x, z)
const VFOV_DEG = 33
const HFOV = 2 * matan(mtan(((VFOV_DEG / 2) * Math.PI) / 180) * (16 / 9))

const X0 = -4
const X1 = 4
const Z0 = 1
const Z1 = -9.2
const S = 50
const W = (X1 - X0) * S
const H = (Z0 - Z1) * S
const sx = (x: number) => (x - X0) * S
const sy = (z: number) => (Z0 - z) * S

const PRESETS: Record<string, { label: string; keys: P[] }> = {
  app: {
    label: "App's igloo default",
    keys: [
      [0, 0],
      [0.35, -0.2],
      [0.75, -0.45],
    ],
  },
  arc: {
    label: "Arc in front",
    keys: [
      [-2.2, -1.4],
      [-0.9, 0.1],
      [0.9, 0.1],
      [2.2, -1.4],
    ],
  },
  uneven: {
    label: "Uneven spacing",
    keys: [
      [-2.6, -0.4],
      [-2.2, -0.5],
      [2.6, -0.9],
    ],
  },
}

// ---- THREE.CatmullRomCurve3 getPoint(t), centripetal, open curve ----
function cubicCoef(x0: number, x1: number, x2: number, x3: number, dt0: number, dt1: number, dt2: number) {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2
  t1 *= dt1
  t2 *= dt1
  return [x1, t1, -3 * x1 + 3 * x2 - 2 * t1 - t2, 2 * x1 - 2 * x2 + t1 + t2]
}
function catmull(pts: P[], t: number): P {
  const n = pts.length
  const p = (n - 1) * t
  let i = Math.floor(p)
  let w = p - i
  if (w === 0 && i === n - 1) {
    i = n - 2
    w = 1
  }
  const p1 = pts[i]!
  const p2 = pts[i + 1]!
  const p0: P = i > 0 ? pts[i - 1]! : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]]
  const p3: P = i + 2 < n ? pts[i + 2]! : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]]
  const d = (a: P, b: P) => mpow((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]), 0.25)
  let dt0 = d(p0, p1)
  let dt1 = d(p1, p2)
  let dt2 = d(p2, p3)
  if (dt1 < 1e-4) dt1 = 1
  if (dt0 < 1e-4) dt0 = dt1
  if (dt2 < 1e-4) dt2 = dt1
  const cx = cubicCoef(p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2)
  const cz = cubicCoef(p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2)
  const ev = (c: number[]) => c[0]! + c[1]! * w + c[2]! * w * w + c[3]! * w * w * w
  return [ev(cx), ev(cz)]
}

// ---- smoothCurvePoint / extendedCurvePoint ----
const TAPS = [1, 6, 15, 20, 15, 6, 1]
const STEP = 1 / 96
function extended(pts: P[], u: number): P {
  if (u < 0) {
    const a = catmull(pts, 0)
    const b = catmull(pts, -u)
    return [2 * a[0] - b[0], 2 * a[1] - b[1]]
  }
  if (u > 1) {
    const a = catmull(pts, 1)
    const b = catmull(pts, 2 - u)
    return [2 * a[0] - b[0], 2 * a[1] - b[1]]
  }
  return catmull(pts, u)
}
function smoothPoint(pts: P[], u: number): P {
  let x = 0
  let z = 0
  TAPS.forEach((wt, k) => {
    const q = extended(pts, u + (k - 3) * STEP)
    x += (q[0] * wt) / 64
    z += (q[1] * wt) / 64
  })
  return [x, z]
}

// ---- cameraPathProgressAtFrame (monotone cubic Hermite) ----
function monotoneSlopes(xs: number[], ys: number[]) {
  const wd = ys.slice(1).map((_, i) => xs[i + 1]! - xs[i]!)
  const sl = wd.map((w, i) => (ys[i + 1]! - ys[i]!) / w)
  const out = ys.map(() => 0)
  out[0] = sl[0]!
  for (let i = 1; i < ys.length - 1; i++) {
    const a = sl[i - 1]!
    const b = sl[i]!
    if (a === 0 || b === 0 || a * b < 0) continue
    const w0 = 2 * wd[i]! + wd[i - 1]!
    const w1 = wd[i]! + 2 * wd[i - 1]!
    out[i] = (w0 + w1) / (w0 / a + w1 / b)
  }
  out[ys.length - 1] = sl[sl.length - 1]!
  return out
}
function progressAtFrame(i: number, segs: number) {
  const last = FRAMES - 1
  const fp = Array.from({ length: segs + 1 }, (_, k) => Math.round((k * last) / segs) / last)
  const pp = fp.map((_, k) => k / segs)
  const f = i / last
  const e = fp.findIndex((v) => v >= f)
  if (e <= 0) return 0
  if (Math.abs(fp[e]! - f) < 1e-10) return pp[e]!
  const m = monotoneSlopes(fp, pp)
  const s = e - 1
  const w = fp[e]! - fp[s]!
  const a = (f - fp[s]!) / w
  const a2 = a * a
  const a3 = a2 * a
  return (
    (2 * a3 - 3 * a2 + 1) * pp[s]! +
    (a3 - 2 * a2 + a) * w * m[s]! +
    (-2 * a3 + 3 * a2) * pp[e]! +
    (a3 - a2) * w * m[e]!
  )
}

function samplePath(keys: P[], mode: "ships" | "lerp"): P[] {
  if (mode === "lerp") {
    return Array.from({ length: FRAMES }, (_, i) => {
      const t = i / (FRAMES - 1)
      const scaled = t * (keys.length - 1)
      const seg = Math.min(keys.length - 2, Math.floor(scaled))
      const l = scaled - seg
      const a = keys[seg]!
      const b = keys[seg + 1]!
      return [a[0] + (b[0] - a[0]) * l, a[1] + (b[1] - a[1]) * l] as P
    })
  }
  const segs = keys.length - 1
  return Array.from({ length: FRAMES }, (_, i) => {
    if (i === 0) return keys[0]!
    if (i === FRAMES - 1) return keys[keys.length - 1]!
    return smoothPoint(keys, progressAtFrame(i, segs))
  })
}

const r2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
const r3 = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3)

export function CameraPathToy() {
  const [keys, setKeys] = useState<P[]>(PRESETS.arc!.keys)
  const [target, setTarget] = useState<P>(CENTROID)
  const [mode, setMode] = useState<"ships" | "lerp">("ships")
  const [aim, setAim] = useState<"look" | "forward">("look")
  const [frame, setFrame] = useState(20)
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<number | "target" | null>(null)

  const path = useMemo(() => samplePath(keys, mode), [keys, mode])
  const curve = useMemo(() => {
    const n = 120
    return Array.from({ length: n + 1 }, (_, i) => (mode === "lerp" ? null : catmull(keys, i / n))).filter(
      (p): p is P => p !== null,
    )
  }, [keys, mode])

  const yaws = useMemo(
    () =>
      path.map((p, i) => {
        let dx: number
        let dz: number
        if (aim === "look") {
          dx = target[0] - p[0]
          dz = target[1] - p[1]
        } else {
          const a = path[Math.max(0, i - 1)]!
          const b = path[Math.min(FRAMES - 1, i + 1)]!
          dx = b[0] - a[0]
          dz = b[1] - a[1]
        }
        // RUB camera looks down -z; yaw about +y so that forward = (-sin, 0, -cos)
        return matan2(-dx, -dz)
      }),
    [path, aim, target],
  )

  const speeds = useMemo(
    () => path.slice(1).map((p, i) => mhypot(p[0] - path[i]![0], p[1] - path[i]![1]) * FPS),
    [path],
  )
  const fastest = Math.max(...speeds)
  const slowest = Math.min(...speeds)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES)
    }, 1000 / FPS)
    return () => window.clearInterval(id)
  }, [playing])

  function toScene(e: React.PointerEvent): P | null {
    const svg = svgRef.current
    if (!svg) return null
    const m = svg.getScreenCTM()
    if (!m) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [Math.min(X1, Math.max(X0, pt.x / S + X0)), Math.min(Z0, Math.max(Z1, Z0 - pt.y / S))]
  }
  function onMove(e: React.PointerEvent) {
    if (drag.current === null) return
    const p = toScene(e)
    if (!p) return
    if (drag.current === "target") setTarget(p)
    else {
      const k = drag.current
      setKeys((ks) => ks.map((q, i) => (i === k ? p : q)))
    }
  }
  function onBackground(e: React.PointerEvent) {
    if (drag.current !== null || keys.length >= 6) return
    const p = toScene(e)
    if (p) setKeys((ks) => [...ks, p])
  }

  const cur = path[frame]!
  const yaw = yaws[frame]!
  const reach = 2.2
  const fx = (a: number) => cur[0] - msin(a) * reach
  const fz = (a: number) => cur[1] - mcos(a) * reach
  const qy = msin(yaw / 2)
  const qw = mcos(yaw / 2)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>igloo example, top view · {keys.length} keyframes → {FRAMES} target cameras</span>
        <span className="text-muted-foreground/70">
          frame {frame + 1}/{FRAMES} · {(frame / FPS).toFixed(2)} s @ {FPS} fps
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:p-5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none rounded-lg bg-black/[0.85]"
          role="img"
          aria-label="Top view of the igloo scene as coloured dots, with draggable numbered keyframes, the interpolated camera path as forty-eight dots, and a wedge showing where the camera at the current frame is looking."
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerDown={onBackground} />
          {IGLOO_TOP.map(([x, z, c], i) => (
            <rect key={i} x={sx(x) - 3.4} y={sy(z) - 4.3} width={6.8} height={8.6} fill={c} opacity={0.85} pointerEvents="none" />
          ))}
          <text x={8} y={H - 10} fontSize={11} className="fill-white/60 font-mono" pointerEvents="none">
            1 grid unit = {S} px · reference camera at the origin
          </text>

          {/* frustum wedge at the current frame */}
          <polygon
            points={`${sx(cur[0])},${sy(cur[1])} ${sx(fx(yaw - HFOV / 2))},${sy(fz(yaw - HFOV / 2))} ${sx(fx(yaw + HFOV / 2))},${sy(fz(yaw + HFOV / 2))}`}
            fill="oklch(0.85 0.15 90 / 0.18)"
            stroke="oklch(0.85 0.15 90)"
            strokeWidth={1.2}
            pointerEvents="none"
          />

          {curve.length > 0 && (
            <polyline
              points={curve.map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")}
              fill="none"
              stroke="oklch(0.75 0.12 255 / 0.5)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}
          {path.map((p, i) => (
            <circle
              key={i}
              cx={sx(p[0])}
              cy={sy(p[1])}
              r={i === frame ? 4.5 : 2.4}
              fill={i === frame ? "oklch(0.88 0.16 90)" : "oklch(0.78 0.13 255)"}
              pointerEvents="none"
            />
          ))}

          {aim === "look" && (
            <g
              onPointerDown={(e) => {
                e.stopPropagation()
                drag.current = "target"
              }}
              className="cursor-grab"
            >
              <circle cx={sx(target[0])} cy={sy(target[1])} r={11} fill="transparent" />
              <path
                d={`M${sx(target[0]) - 7},${sy(target[1])}h14M${sx(target[0])},${sy(target[1]) - 7}v14`}
                stroke="oklch(0.85 0.15 90)"
                strokeWidth={2}
              />
              <text x={sx(target[0]) + 9} y={sy(target[1]) - 8} fontSize={11} className="fill-white/80 font-mono">
                look target
              </text>
            </g>
          )}

          {keys.map((k, i) => (
            <g
              key={i}
              onPointerDown={(e) => {
                e.stopPropagation()
                drag.current = i
              }}
              className="cursor-grab"
            >
              <circle cx={sx(k[0])} cy={sy(k[1])} r={12} fill="transparent" />
              <circle cx={sx(k[0])} cy={sy(k[1])} r={8} fill="oklch(0.35 0.08 255)" stroke="white" strokeWidth={1.5} />
              <text
                x={sx(k[0])}
                y={sy(k[1]) + 3.6}
                textAnchor="middle"
                fontSize={10}
                className="fill-white font-mono"
                pointerEvents="none"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESETS).map(([id, p]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setKeys(p.keys)
                  setTarget(CENTROID)
                }}
                className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                {p.label}
              </button>
            ))}
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-mono text-xs text-muted-foreground">interpolation</legend>
            {(
              [
                ["ships", "Catmull-Rom + 7-tap smoothing (ships)"],
                ["lerp", "Straight lerp (first draft, unused)"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-xs">
                <input type="radio" name="interp" checked={mode === v} onChange={() => setMode(v)} />
                {l}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-mono text-xs text-muted-foreground">camera direction</legend>
            {(
              [
                ["look", "Look at point (level horizon)"],
                ["forward", "Forward along the path"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-xs">
                <input type="radio" name="aim" checked={aim === v} onChange={() => setAim(v)} />
                {l}
              </label>
            ))}
          </fieldset>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted"
            >
              {playing ? "pause" : "play"}
            </button>
            <Range
              min={0}
              max={FRAMES - 1}
              step={1}
              value={frame}
              onChange={(e) => {
                setPlaying(false)
                setFrame(Number(e.target.value))
              }}
              aria-label="Frame"
              className="flex-1"
            />
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={keys.length <= 2}
              onClick={() => setKeys((ks) => ks.slice(0, -1))}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
            >
              remove last keyframe
            </button>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">speed now</dt>
            <dd>{r2(speeds[Math.min(frame, speeds.length - 1)]!)} units/s</dd>
            <dt className="text-muted-foreground">fastest/slowest</dt>
            <dd>{slowest > 1e-6 ? `${(fastest / slowest).toFixed(1)}x` : "stalls"}</dd>
          </dl>

          <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-[11px] leading-snug">
            {`targetCameras[${frame}].extrinsics
position:   [${r3(cur[0])}, ${r3(CAM_Y)}, ${r3(cur[1])}]
quaternion: [0, ${r3(qy)}, 0, ${r3(qw)}]
coordinateSystem: "rub"`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Drag keyframes and the target. Click empty space to add a keyframe (up to 6).
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The scene is the app&apos;s bundled igloo, unprojected from its own depth EXR and seen from above. Path maths
        ported from <code>camera-trajectory.ts</code>; directions reduced to yaw, and &quot;forward&quot; simplified.
        Height is held at the reference camera&apos;s 1.067.
      </figcaption>
    </figure>
  )
}
