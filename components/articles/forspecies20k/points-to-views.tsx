"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog1p, msin } from "@/lib/dmath"

// What the CNN actually receives. A synthetic tree (seeded, so server and
// client agree) is sampled the way three kinds of scanner would roughly see it,
// then rendered with the same rules as mvtree/render.py in the FOR20K repo:
// centre XY on the median, put the lowest point at z = 0, project
// orthographically with an isotropic scale and a 2% margin, and per pixel keep
//   R = depth of the front-most point   (min-max over occupied pixels)
//   G = log(1 + point count)            (min-max over occupied pixels)
//   B = height of the front-most point  (min-max over occupied pixels)
// The view axes are copied from the code, names included: "top" looks along +z,
// so its front-most point per pixel is the lowest one.
// The tree and the sensor sampling are illustrative, not real scans.

type Shape = "conifer" | "broadleaf"
type Sensor = "TLS" | "MLS" | "ULS"
type Channel = "rgb" | "depth" | "density" | "height"

const VIEWS = [
  { id: "side_000", label: "side 0°" },
  { id: "side_090", label: "side 90°" },
  { id: "side_180", label: "side 180°" },
  { id: "side_270", label: "side 270°" },
  { id: "top", label: "top" },
  { id: "bottom", label: "bottom" },
  { id: "detail", label: "trunk slice" },
] as const
type ViewId = (typeof VIEWS)[number]["id"]

// Rows of the rotation in render.py: image right, image up, viewing direction.
// Side views use exact cos/sin of multiples of 90°, so no rounding enters.
const AXES: Record<Exclude<ViewId, "detail">, [number[], number[], number[]]> = {
  side_000: [[0, -1, 0], [0, 0, 1], [1, 0, 0]],
  side_090: [[1, 0, 0], [0, 0, 1], [0, 1, 0]],
  side_180: [[0, 1, 0], [0, 0, 1], [-1, 0, 0]],
  side_270: [[-1, 0, 0], [0, 0, 1], [0, -1, 0]],
  top: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]],
  bottom: [[1, 0, 0], [0, 1, 0], [0, 0, -1]],
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const H_TREE = 20 // metres

// Probability that a scanner records a point at relative height t (0 ground, 1 top).
// TLS stands on the ground: dense stem, thinning crown top. ULS flies above:
// dense crown top, the stem mostly hidden. MLS sits in between. Illustrative.
function keep(sensor: Sensor, t: number, isStem: boolean) {
  if (sensor === "TLS") return 1 - 0.65 * t
  if (sensor === "MLS") return 0.85 - 0.35 * t
  return (0.12 + 0.88 * t) * (isStem ? 0.25 : 1)
}

function makeTree(shape: Shape, sensor: Sensor, seed: number): number[] {
  const rnd = mulberry32(seed * 7919 + (shape === "conifer" ? 1 : 2))
  const pts: number[] = []
  const push = (x: number, y: number, z: number, stem: boolean) => {
    if (rnd() < keep(sensor, z / H_TREE, stem)) pts.push(x, y, z)
  }
  const TAU = 2 * Math.PI

  if (shape === "conifer") {
    for (let i = 0; i < 1800; i++) {
      const z = rnd() * H_TREE * 0.95
      const r = 0.05 + 0.25 * (1 - z / H_TREE)
      const a = rnd() * TAU
      push(r * mcos(a), r * msin(a), z, true)
    }
    for (let i = 0; i < 7800; i++) {
      const t = 0.25 + 0.75 * rnd()
      const whorl = 0.7 + 0.3 * Math.abs(msin(t * 30))
      const rmax = ((3.2 * (1 - t)) / 0.75) * whorl
      const rho = rmax * (0.65 + 0.35 * rnd())
      const a = rnd() * TAU
      push(rho * mcos(a), rho * msin(a), t * H_TREE, false)
    }
  } else {
    for (let i = 0; i < 1500; i++) {
      const z = rnd() * H_TREE * 0.42
      const r = 0.32
      const a = rnd() * TAU
      push(r * mcos(a), r * msin(a), z, true)
    }
    // five main limbs from the top of the stem into the crown
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * TAU + 0.4
      for (let i = 0; i < 260; i++) {
        const s = rnd()
        const z = H_TREE * (0.42 + 0.3 * s)
        const r = 3.6 * s
        push(r * mcos(a) + 0.1 * (rnd() - 0.5), r * msin(a) + 0.1 * (rnd() - 0.5), z, true)
      }
    }
    const cz = 0.68 * H_TREE
    const ax = 5.2
    const az = 0.3 * H_TREE
    for (let i = 0; i < 7600; i++) {
      // a point on a lumpy ellipsoid shell
      const u = 2 * rnd() - 1
      const a = rnd() * TAU
      const ring = Math.sqrt(1 - u * u)
      const lump = 0.8 + 0.2 * Math.abs(msin(a * 3 + u * 4))
      const k = lump * (0.75 + 0.25 * rnd())
      push(ax * k * ring * mcos(a), ax * k * ring * msin(a), cz + az * k * u, false)
    }
  }
  return pts
}

function median(xs: number[]) {
  const s = [...xs].sort((p, q) => p - q)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function normalise(pts: number[]) {
  const n = pts.length / 3
  const xs: number[] = []
  const ys: number[] = []
  let zmin = Infinity
  for (let i = 0; i < n; i++) {
    xs.push(pts[3 * i])
    ys.push(pts[3 * i + 1])
    zmin = Math.min(zmin, pts[3 * i + 2])
  }
  const mx = median(xs)
  const my = median(ys)
  const out = new Array<number>(pts.length)
  for (let i = 0; i < n; i++) {
    out[3 * i] = pts[3 * i] - mx
    out[3 * i + 1] = pts[3 * i + 1] - my
    out[3 * i + 2] = pts[3 * i + 2] - zmin
  }
  return out
}

type Render = { r: Uint8Array; g: Uint8Array; b: Uint8Array; occ: Uint8Array; occupied: number; maxCount: number }

function project(pts: number[], view: Exclude<ViewId, "detail">, S: number): Render {
  const [R0, R1, R2] = AXES[view]
  const n = pts.length / 3
  const u = new Float64Array(n)
  const v = new Float64Array(n)
  const d = new Float64Array(n)
  let umin = Infinity
  let umax = -Infinity
  let vmin = Infinity
  let vmax = -Infinity
  for (let i = 0; i < n; i++) {
    const x = pts[3 * i]
    const y = pts[3 * i + 1]
    const z = pts[3 * i + 2]
    u[i] = R0[0] * x + R0[1] * y + R0[2] * z
    v[i] = R1[0] * x + R1[1] * y + R1[2] * z
    d[i] = R2[0] * x + R2[1] * y + R2[2] * z
    umin = Math.min(umin, u[i])
    umax = Math.max(umax, u[i])
    vmin = Math.min(vmin, v[i])
    vmax = Math.max(vmax, v[i])
  }
  const span = Math.max(umax - umin, vmax - vmin, 1e-6)
  const uc = 0.5 * (umin + umax)
  const vc = 0.5 * (vmin + vmax)
  const scale = (1 - 2 * 0.02) / span
  const count = new Float64Array(S * S)
  const depth = new Float64Array(S * S).fill(Infinity)
  const height = new Float64Array(S * S)
  for (let i = 0; i < n; i++) {
    const col = Math.min(S - 1, Math.max(0, Math.trunc(((u[i] - uc) * scale + 0.5) * S)))
    const row = Math.min(S - 1, Math.max(0, Math.trunc(((vc - v[i]) * scale + 0.5) * S)))
    const p = row * S + col
    count[p] += 1
    if (d[i] < depth[p]) {
      depth[p] = d[i]
      height[p] = pts[3 * i + 2]
    }
  }
  const occ = new Uint8Array(S * S)
  let occupied = 0
  let maxCount = 0
  const ranges = [
    [Infinity, -Infinity],
    [Infinity, -Infinity],
    [Infinity, -Infinity],
  ]
  const logc = new Float64Array(S * S)
  for (let p = 0; p < S * S; p++) {
    if (count[p] === 0) continue
    occ[p] = 1
    occupied++
    maxCount = Math.max(maxCount, count[p])
    logc[p] = mlog1p(count[p])
    const vals = [depth[p], logc[p], height[p]]
    for (let c = 0; c < 3; c++) {
      ranges[c][0] = Math.min(ranges[c][0], vals[c])
      ranges[c][1] = Math.max(ranges[c][1], vals[c])
    }
  }
  const to8 = (val: number, c: number) => {
    const [lo, hi] = ranges[c]
    if (hi - lo < 1e-9) return 128
    return Math.min(255, Math.max(0, Math.trunc(((val - lo) / (hi - lo)) * 255)))
  }
  const r = new Uint8Array(S * S)
  const g = new Uint8Array(S * S)
  const b = new Uint8Array(S * S)
  for (let p = 0; p < S * S; p++) {
    if (!occ[p]) continue
    r[p] = to8(depth[p], 0)
    g[p] = to8(logc[p], 1)
    b[p] = to8(height[p], 2)
  }
  return { r, g, b, occ, occupied, maxCount }
}

function renderView(pts: number[], view: ViewId, S: number): Render {
  if (view !== "detail") return project(pts, view, S)
  // Trees of 5 m or more: the 1.0-1.5 m slice; render.py falls back to
  // 0.5-2.0 m, then to the whole tree, when fewer than 20 points land in it.
  const slice = (lo: number, hi: number) => {
    const out: number[] = []
    for (let i = 0; i < pts.length; i += 3) {
      const z = pts[i + 2]
      if (z >= lo && z <= hi) out.push(pts[i], pts[i + 1], z)
    }
    return out
  }
  let crop = slice(1.0, 1.5)
  if (crop.length / 3 < 20) crop = slice(0.5, 2.0)
  if (crop.length / 3 < 20) crop = pts
  return project(crop, "side_000", S)
}

function paint(canvas: HTMLCanvasElement | null, img: Render, S: number, channel: Channel) {
  if (!canvas) return
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const data = ctx.createImageData(S, S)
  for (let p = 0; p < S * S; p++) {
    const o = 4 * p
    const r = img.r[p]
    const g = img.g[p]
    const b = img.b[p]
    if (channel === "rgb") {
      data.data[o] = r
      data.data[o + 1] = g
      data.data[o + 2] = b
    } else {
      const val = channel === "depth" ? r : channel === "density" ? g : b
      data.data[o] = val
      data.data[o + 1] = val
      data.data[o + 2] = val
    }
    data.data[o + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
}

const btn = (on: boolean) =>
  `rounded border px-2 py-0.5 font-mono text-xs ${on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`

export function PointsToViews() {
  const [shape, setShape] = useState<Shape>("conifer")
  const [sensor, setSensor] = useState<Sensor>("TLS")
  const [resIdx, setResIdx] = useState(2)
  const [view, setView] = useState<ViewId>("side_000")
  const [channel, setChannel] = useState<Channel>("rgb")
  const S = [32, 64, 128, 256][resIdx]

  const pts = useMemo(() => normalise(makeTree(shape, sensor, 7)), [shape, sensor])
  const renders = useMemo(() => VIEWS.map((vw) => renderView(pts, vw.id, S)), [pts, S])
  const sel = renders[VIEWS.findIndex((vw) => vw.id === view)]

  const big = useRef<HTMLCanvasElement | null>(null)
  const small = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    paint(big.current, sel, S, channel)
    renders.forEach((img, i) => paint(small.current[i], img, S, "rgb"))
  }, [renders, sel, S, channel])

  const nPts = pts.length / 3
  const fill = (100 * sel.occupied) / (S * S)
  const perPix = sel.occupied ? nPts / sel.occupied : 0

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Points to the seven images a ConvNeXtV2 reads (synthetic tree, illustrative sampling)
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Tree</span>
          {(["conifer", "broadleaf"] as Shape[]).map((s) => (
            <button key={s} type="button" className={btn(shape === s)} onClick={() => setShape(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Scanner</span>
          {(["TLS", "MLS", "ULS"] as Sensor[]).map((s) => (
            <button key={s} type="button" className={btn(sensor === s)} onClick={() => setSensor(s)}>
              {s}
            </button>
          ))}
        </div>
        <label className="flex min-w-[220px] flex-1 items-center gap-2">
          <span className="text-muted-foreground">Render size</span>
          <Range min={0} max={3} step={1} value={resIdx} onChange={(e) => setResIdx(Number(e.target.value))} />
          <span className="font-mono tabular-nums">
            {S}×{S}
          </span>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {VIEWS.map((vw, i) => (
          <button
            key={vw.id}
            type="button"
            onClick={() => setView(vw.id)}
            className={`rounded border p-1 text-left ${view === vw.id ? "border-primary" : "border-transparent"}`}
          >
            <canvas
              ref={(el) => {
                small.current[i] = el
              }}
              className="aspect-square w-full bg-black"
              style={{ imageRendering: "pixelated" }}
              aria-label={`${vw.label} render`}
            />
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{vw.label}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
        <canvas
          ref={big}
          className="aspect-square w-full max-w-[260px] bg-black"
          style={{ imageRendering: "pixelated" }}
          aria-label={`${view} view, ${channel} channel, ${S} pixels square`}
        />
        <div className="text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">Channel</span>
            {(
              [
                ["rgb", "all three"],
                ["depth", "R depth"],
                ["density", "G log count"],
                ["height", "B height"],
              ] as [Channel, string][]
            ).map(([c, l]) => (
              <button key={c} type="button" className={btn(channel === c)} onClick={() => setChannel(c)}>
                {l}
              </button>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted-foreground">Points in the cloud</dt>
              <dd className="font-mono tabular-nums">{nPts.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pixels with a point</dt>
              <dd className="font-mono tabular-nums">{fill.toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Points per lit pixel</dt>
              <dd className="font-mono tabular-nums">{perPix.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Busiest pixel</dt>
              <dd className="font-mono tabular-nums">{sel.maxCount} points</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Same tree, different scanner: switch TLS to ULS and the stem fades out of the side views while the
            density channel shifts toward the crown. The species did not change; the pictures did. A trunk slice
            from a drone scan holds a handful of points, so it is stretched to fill the frame.
          </p>
        </div>
      </div>
    </div>
  )
}
