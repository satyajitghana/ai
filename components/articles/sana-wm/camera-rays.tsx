"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin, mtanh } from "@/lib/dmath"

// What SANA-WM's camera branches actually receive, for a path you pick.
//
// A 60 s clip is 961 raw frames at 16 fps. The LTX-2 VAE folds 8 raw frames
// into one latent frame (the first latent frame holds frame 0 alone), so there
// are 121 latent frames, each a 22 x 40 grid of tokens at 704 x 1280.
//
//  - Coarse branch (UCPE): one camera pose per latent frame, applied inside
//    attention as a per-token ray-local transform.
//  - Fine branch (Plücker mixing): for every raw frame inside the latent frame,
//    a per-cell ray (d, o x d) -> 6 numbers; 8 raw frames x 6 = 48 channels,
//    zero-initialised patch embedder, added after each block's attention.
//
// Coordinates are OpenCV (x right, y down, z forward), as in
// diffusion/utils/cam_utils.py:compute_raymap. Speeds default to the release's
// action defaults: 0.025 per frame translation, 0.6 degrees per frame rotation.
// The grid here is a 6 x 10 subsample of the 22 x 40 token grid; the paths
// are illustrative presets, not the benchmark's trajectories.

const RAW = 961
const LATENT = 121
const V = 0.025 // translation per raw frame (release default)
const DEG = Math.PI / 180
const TAN_H = 0.5774 // tan(30 deg): 60 deg horizontal field of view (illustrative)
const TAN_V = TAN_H * (704 / 1280)
const GR = 6
const GC = 10

type Vec = [number, number, number]
type Pose = { o: Vec; yaw: number; pitch: number }

const PRESETS = {
  dolly: { label: "dolly in", note: "pure translation along the view" },
  strafe: { label: "strafe", note: "pure sideways translation" },
  pan: { label: "pan", note: "pure rotation, camera stays put" },
  orbit: { label: "orbit", note: "translate and turn to keep a point centred" },
  crane: { label: "crane", note: "rise while tilting down" },
} as const
type Preset = keyof typeof PRESETS

function pose(p: Preset, f: number): Pose {
  if (p === "dolly") return { o: [0, 0, V * f], yaw: 0, pitch: 0 }
  if (p === "strafe") return { o: [V * f, 0, 0], yaw: 0, pitch: 0 }
  if (p === "pan") return { o: [0, 0, 0], yaw: 40 * DEG * msin((2 * Math.PI * f) / 480), pitch: 0 }
  if (p === "orbit") {
    const R = 4
    const a = (2 * Math.PI * f) / (RAW - 1)
    return { o: [-R * msin(a), 0, R - R * mcos(a)], yaw: a, pitch: 0 }
  }
  // crane: rise (-y is up) and creep forward while pitching down to 25 degrees
  const k = f / (RAW - 1)
  return { o: [0, -0.5 * V * f, 0.5 * V * f], yaw: 0, pitch: -25 * DEG * k }
}

const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec): Vec => {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

// camera axes in world coordinates (columns of R_c2w)
function axes(ps: Pose) {
  const cp = mcos(ps.pitch)
  const fwd: Vec = [msin(ps.yaw) * cp, -msin(ps.pitch), mcos(ps.yaw) * cp]
  const right = norm(cross([0, 1, 0], fwd))
  const down = cross(fwd, right)
  return { fwd, right, down }
}

// Plücker ray for a normalised image-plane offset (x, y) in [-1, 1]
function ray(ps: Pose, x: number, y: number) {
  const { fwd, right, down } = axes(ps)
  const a = x * TAN_H
  const b = y * TAN_V
  const d = norm([
    a * right[0] + b * down[0] + fwd[0],
    a * right[1] + b * down[1] + fwd[1],
    a * right[2] + b * down[2] + fwd[2],
  ])
  const m = cross(ps.o, d)
  return { d, m }
}

const ch = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v)))
const rgb = (r: number, g: number, b: number) => `rgb(${ch(r)},${ch(g)},${ch(b)})`
const dCol = (d: Vec) => rgb((d[0] + 1) / 2, (d[1] + 1) / 2, (d[2] + 1) / 2)
const mCol = (m: Vec) => rgb(0.5 + 0.5 * mtanh(m[0] / 3), 0.5 + 0.5 * mtanh(m[1] / 3), 0.5 + 0.5 * mtanh(m[2] / 3))

// raw frames covered by latent frame t (the first latent frame is frame 0 alone)
const rawOf = (t: number) => (t === 0 ? [0] : Array.from({ length: 8 }, (_, i) => 8 * (t - 1) + 1 + i))

const fmt = (v: number, n = 2) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(n)

const ACC = "oklch(0.66 0.17 135)" // NVIDIA-ish green
const ACC2 = "oklch(0.62 0.14 250)"

export function CameraRays() {
  const [preset, setPreset] = useState<Preset>("pan")
  const [t, setT] = useState(20)
  const [show, setShow] = useState<"d" | "m">("d")

  const frames = rawOf(t)
  const last = frames[frames.length - 1]
  const first = frames[0]
  const ps = pose(preset, last)
  const p0 = pose(preset, first)
  const centre = ray(ps, 0, 0)

  // BEV (x right, z up the screen)
  const BW = 220
  const BH = 220
  const samples = Array.from({ length: LATENT }, (_, i) => pose(preset, i === 0 ? 0 : 8 * i))
  let xmin = Infinity
  let xmax = -Infinity
  let zmin = Infinity
  let zmax = -Infinity
  for (const s of samples) {
    xmin = Math.min(xmin, s.o[0])
    xmax = Math.max(xmax, s.o[0])
    zmin = Math.min(zmin, s.o[2])
    zmax = Math.max(zmax, s.o[2])
  }
  const span = Math.max(xmax - xmin, zmax - zmin, 2)
  const cxw = (xmin + xmax) / 2
  const czw = (zmin + zmax) / 2
  const sc = (BW - 50) / span
  const bx = (x: number) => BW / 2 + (x - cxw) * sc
  const bz = (z: number) => BH / 2 - (z - czw) * sc
  const pathD = samples.map((s, i) => `${i === 0 ? "M" : "L"}${bx(s.o[0]).toFixed(1)} ${bz(s.o[2]).toFixed(1)}`).join(" ")
  const fr = 26
  const fl = ray(ps, -1, 0).d
  const frr = ray(ps, 1, 0).d
  const px = bx(ps.o[0])
  const pz = bz(ps.o[2])

  // Plücker map for the last raw frame of this latent frame
  const CW = 26
  const CH = 22
  const cells = []
  for (let r = 0; r < GR; r++) {
    for (let c = 0; c < GC; c++) {
      const x = -1 + (2 * (c + 0.5)) / GC
      const y = -1 + (2 * (r + 0.5)) / GR
      const { d, m } = ray(ps, x, y)
      cells.push(
        <rect key={`${r}-${c}`} x={c * CW} y={r * CH} width={CW - 1} height={CH - 1} rx={2} fill={show === "d" ? dCol(d) : mCol(m)} />,
      )
    }
  }

  const yawDelta = (ps.yaw - p0.yaw) / DEG
  const pitchDelta = (ps.pitch - p0.pitch) / DEG
  const move = Math.sqrt(
    (ps.o[0] - p0.o[0]) ** 2 + (ps.o[1] - p0.o[1]) ** 2 + (ps.o[2] - p0.o[2]) ** 2,
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what the camera branches see</span>
        <span className="text-muted-foreground/60">computed in your browser · paths illustrative</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(Object.keys(PRESETS) as Preset[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              aria-pressed={preset === k}
              className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors"
              style={preset === k ? { background: ACC, color: "oklch(0.18 0 0)", borderColor: ACC } : undefined}
            >
              {PRESETS[k].label}
            </button>
          ))}
          <span className="ml-1 self-center font-mono text-[10px] text-muted-foreground">{PRESETS[preset].note}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">top-down path, 60 s</div>
            <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full max-w-[220px] rounded-md border" role="img" aria-label={`Top-down view of the ${PRESETS[preset].label} path with the camera at latent frame ${t}.`}>
              <path d={pathD} fill="none" stroke="currentColor" className="text-muted-foreground/50" strokeWidth={1.5} />
              <path
                d={`M${px.toFixed(1)} ${pz.toFixed(1)} L${(px + fl[0] * fr).toFixed(1)} ${(pz - fl[2] * fr).toFixed(1)} L${(px + frr[0] * fr).toFixed(1)} ${(pz - frr[2] * fr).toFixed(1)} Z`}
                fill={ACC}
                opacity={0.35}
                stroke={ACC}
              />
              <circle cx={px} cy={pz} r={4} fill={ACC} />
              <circle cx={bx(samples[0].o[0])} cy={bz(samples[0].o[2])} r={3} fill="none" stroke="currentColor" className="text-muted-foreground" />
              <text x={6} y={BH - 6} className="fill-muted-foreground font-mono" fontSize={9}>
                ○ start · ▲ view cone
              </text>
            </svg>
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">
                Plücker map, raw frame {last} · 6×10 of the 22×40 token grid
              </span>
              <span className="flex gap-1">
                {(["d", "m"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setShow(k)}
                    aria-pressed={show === k}
                    className="cursor-pointer rounded border px-2 py-0.5 font-mono text-[10px]"
                    style={show === k ? { background: ACC2, color: "white", borderColor: ACC2 } : undefined}
                  >
                    {k === "d" ? "direction d" : "moment o×d"}
                  </button>
                ))}
              </span>
            </div>
            <svg viewBox={`0 0 ${GC * CW} ${GR * CH}`} className="w-full rounded-md" role="img" aria-label={`Colour map of the ${show === "d" ? "ray direction" : "ray moment"} channels for each grid cell.`}>
              {cells}
            </svg>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-muted-foreground sm:grid-cols-3">
              <span>
                centre d = ({fmt(centre.d[0])}, {fmt(centre.d[1])}, {fmt(centre.d[2])})
              </span>
              <span>
                centre o×d = ({fmt(centre.m[0])}, {fmt(centre.m[1])}, {fmt(centre.m[2])})
              </span>
              <span>
                camera o = ({fmt(ps.o[0])}, {fmt(ps.o[1])}, {fmt(ps.o[2])})
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md border p-3 font-mono text-[11px] text-muted-foreground">
          <div className="mb-2 flex flex-wrap justify-between gap-2">
            <span>
              latent frame <span className="text-foreground">{t}</span> of {LATENT - 1} = raw frames{" "}
              <span className="text-foreground">
                {first}
                {frames.length > 1 ? `–${last}` : ""}
              </span>
            </span>
            <span>
              coarse UCPE branch: <span className="text-foreground">1 pose</span> · fine Plücker branch:{" "}
              <span className="text-foreground">
                {frames.length} × 6 = {frames.length * 6}
              </span>{" "}
              channels{frames.length === 1 ? " (padded to 48)" : ""}
            </span>
          </div>
          <div className="flex gap-1">
            {frames.map((f) => {
              const q = pose(preset, f)
              const dy = (q.yaw - p0.yaw) / DEG
              return (
                <div key={f} className="flex-1 rounded border px-1 py-1 text-center text-[9px] leading-tight sm:text-[10px]">
                  <div className="text-foreground">{f}</div>
                  <div>{fmt(dy, 1)}°</div>
                </div>
              )
            })}
          </div>
          <div className="mt-2">
            inside this latent frame the camera turns{" "}
            <span className="text-foreground">{fmt(yawDelta, 1)}°</span> in yaw,{" "}
            <span className="text-foreground">{fmt(pitchDelta, 1)}°</span> in pitch and moves{" "}
            <span className="text-foreground">{fmt(move)}</span> units. A branch that sees one pose per latent frame cannot tell where in that half-second it happened.
          </div>
        </div>

        <label className="mt-3 block">
          <span className="font-mono text-[10px] text-muted-foreground">latent frame (0–120 = 0–60 s)</span>
          <Range min={0} max={LATENT - 1} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer" accent={ACC} />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Try <span className="text-foreground">dolly</span>{" "}and then <span className="text-foreground">pan</span>{" "}with the direction view on: a
          translation leaves every <span className="text-foreground">d</span>{" "}alone and shows up only in the moment o×d, while a rotation repaints d
          across the whole grid. Six numbers per cell are enough to tell the two apart, which a single pose matrix per half-second is not.
        </p>
      </div>
    </figure>
  )
}
