"use client"

// One 360 frame, four ways to hand it to structure from motion.
//
// Each plan is a set of pinhole views (or the panorama itself). The map is the
// whole sphere as an equirectangular image: every cell is coloured by how many
// views see its direction. The coverage and overlap figures are computed here,
// on 200,000 evenly spread directions (a Fibonacci sphere), from the same view
// geometry as Spirula Studio's src/app/Pano360.cpp at commit bef5063:
//
//   GoPro MAX (.360, not stitched): per lens, the face on its axis (S x S, 90
//   degrees) plus four half faces tilted 45 deg + atan(half / S) off the axis,
//   `half` = S tan(22.5 deg) rounded down to even, `wide` = S / cos(that) rounded
//   up to even, focal S / 2. Lens 1 is lens 0 turned 180 deg.
//   MAX 2 (stitched panorama): a cube "stood on a corner", six square faces at
//   100 degrees, centres at +-35.26 deg elevation every 60 deg of azimuth, each
//   kept upright (level x axis).
//   Cube: the six axis-aligned 90 degree faces the trainer splits a panorama into.
//
// At S = 1504 the MAX plan comes out at 0.10% of the sphere in no view and 5.9%
// in two, which is what docs/datasets.md reports for its own sweep. Numbers that
// reach the DOM go through lib/dmath.

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan, matan2, masin, mcos, msin, mtan } from "@/lib/dmath"

type PlanId = "equirect" | "cube" | "max" | "corner"

type View = {
  m: number[] // 3x3 row-major, columns are the view's x, y, z axes in the sphere frame
  hx: number // tan of the half field of view across
  hy: number // tan of the half field of view down
  lens: 0 | 1
}

type Plan = {
  id: PlanId
  name: string
  who: string
}

const PLANS: Plan[] = [
  { id: "equirect", name: "One panorama", who: "equirect mode, or a stitched export" },
  { id: "cube", name: "Cube of six", who: "the trainer's split of a panorama" },
  { id: "max", name: "Ten views, five per lens", who: "GoPro MAX .360, the default" },
  { id: "corner", name: "Six on a corner", who: "MAX 2 .360, the default" },
]

const DEG = Math.PI / 180

// Rotations in the sphere frame: x right, y down, z forward (lens 0's axis).
function rotX(a: number): number[] {
  const c = mcos(a)
  const s = msin(a)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}
function rotY(a: number): number[] {
  const c = mcos(a)
  const s = msin(a)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}
function mul(a: number[], b: number[]): number[] {
  const r = new Array<number>(9).fill(0)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]
  return r
}
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

function maxDims(S: number) {
  const half = 2 * Math.floor((S * mtan(22.5 * DEG)) / 2)
  const av = matan(half / S)
  const wide = 2 * Math.ceil(S / mcos(av) / 2)
  return { half, wide, av }
}

function views(plan: PlanId, S: number): View[] {
  if (plan === "equirect") return []
  if (plan === "cube") {
    const t = mtan(45 * DEG)
    const out: View[] = []
    for (let k = 0; k < 4; k++) out.push({ m: rotY(k * 90 * DEG), hx: t, hy: t, lens: 0 })
    out.push({ m: rotX(90 * DEG), hx: t, hy: t, lens: 0 })
    out.push({ m: rotX(-90 * DEG), hx: t, hy: t, lens: 0 })
    return out
  }
  if (plan === "max") {
    const { half, wide, av } = maxDims(S)
    const f = S / 2
    const out: View[] = []
    for (const lens of [0, 1] as const) {
      const axis = lens === 0 ? I3 : rotY(180 * DEG)
      const tilt = 45 * DEG + av
      out.push({ m: axis, hx: 1, hy: 1, lens })
      out.push({ m: mul(axis, rotX(-tilt)), hx: wide / 2 / f, hy: half / 2 / f, lens })
      out.push({ m: mul(axis, rotX(tilt)), hx: wide / 2 / f, hy: half / 2 / f, lens })
      out.push({ m: mul(axis, rotY(tilt)), hx: half / 2 / f, hy: wide / 2 / f, lens })
      out.push({ m: mul(axis, rotY(-tilt)), hx: half / 2 / f, hy: wide / 2 / f, lens })
    }
    return out
  }
  // corner: a cube stood on a corner, each face kept upright, 100 degrees
  const tilt = masin(1 / Math.sqrt(3))
  const h = mtan(50 * DEG)
  const out: View[] = []
  for (let k = 0; k < 6; k++) {
    const up = k % 2 ? -tilt : tilt
    const az = 60 * k * DEG
    const ez = [mcos(up) * msin(az), -msin(up), mcos(up) * mcos(az)]
    const n = Math.sqrt(ez[0] * ez[0] + ez[2] * ez[2])
    const ex = [ez[2] / n, 0, -ez[0] / n]
    const ey = [
      ez[1] * ex[2] - ez[2] * ex[1],
      ez[2] * ex[0] - ez[0] * ex[2],
      ez[0] * ex[1] - ez[1] * ex[0],
    ]
    out.push({ m: [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]], hx: h, hy: h, lens: 0 })
  }
  return out
}

// Which views see direction d. Returns a bit per view.
function seenBy(vs: View[], dx: number, dy: number, dz: number): number[] {
  const hit: number[] = []
  for (let i = 0; i < vs.length; i++) {
    const m = vs[i].m
    const x = dx * m[0] + dy * m[3] + dz * m[6]
    const y = dx * m[1] + dy * m[4] + dz * m[7]
    const z = dx * m[2] + dy * m[5] + dz * m[8]
    if (z > 0 && Math.abs(x) < vs[i].hx * z && Math.abs(y) < vs[i].hy * z) hit.push(i)
  }
  return hit
}

const N_SPHERE = 200_000
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

// The directions are fixed, so they are built once and reused on every plan
// change and slider tick.
let SPHERE: Float64Array | null = null
function sphereDirs(): Float64Array {
  if (SPHERE) return SPHERE
  const d = new Float64Array(N_SPHERE * 3)
  for (let i = 0; i < N_SPHERE; i++) {
    const y = 1 - (2 * (i + 0.5)) / N_SPHERE
    const r = Math.sqrt(1 - y * y)
    const a = i * GOLDEN
    d[i * 3] = r * mcos(a)
    d[i * 3 + 1] = y
    d[i * 3 + 2] = r * msin(a)
  }
  SPHERE = d
  return d
}

function sphereStats(vs: View[]) {
  if (vs.length === 0) return { none: 0, two: 0 }
  const d = sphereDirs()
  let none = 0
  let two = 0
  for (let i = 0; i < N_SPHERE; i++) {
    const n = seenBy(vs, d[i * 3], d[i * 3 + 1], d[i * 3 + 2]).length
    if (n === 0) none++
    else if (n >= 2) two++
  }
  return { none: none / N_SPHERE, two: two / N_SPHERE }
}

// The map: equirectangular, longitude across (0 = lens 0's axis), latitude down.
const W = 720
const H = 360
const COLS = 144
const ROWS = 72

type Run = { x: number; y: number; w: number; cls: number }

let CELLS: Float64Array | null = null
function cellDirs(): Float64Array {
  if (CELLS) return CELLS
  const d = new Float64Array(ROWS * COLS * 3)
  for (let r = 0; r < ROWS; r++) {
    const lat = 90 - ((r + 0.5) * 180) / ROWS
    const cl = mcos(lat * DEG)
    const sl = msin(lat * DEG)
    for (let c = 0; c < COLS; c++) {
      const lon = -180 + ((c + 0.5) * 360) / COLS
      const o = (r * COLS + c) * 3
      d[o] = cl * msin(lon * DEG)
      d[o + 1] = -sl
      d[o + 2] = cl * mcos(lon * DEG)
    }
  }
  CELLS = d
  return d
}

// cls: 0 no view, 1 one view (lens 0), 2 one view (lens 1), 3 two or more
function mapRuns(plan: PlanId, vs: View[]): Run[] {
  const runs: Run[] = []
  const d = cellDirs()
  for (let r = 0; r < ROWS; r++) {
    let start = 0
    let prev = -1
    for (let c = 0; c <= COLS; c++) {
      let cls = -1
      if (c < COLS) {
        if (plan === "equirect") cls = 1
        else {
          const o = (r * COLS + c) * 3
          const hit = seenBy(vs, d[o], d[o + 1], d[o + 2])
          cls = hit.length === 0 ? 0 : hit.length >= 2 ? 3 : vs[hit[0]].lens === 1 ? 2 : 1
        }
      }
      if (cls !== prev) {
        if (prev >= 0) runs.push({ x: start, y: r, w: c - start, cls: prev })
        start = c
        prev = cls
      }
    }
  }
  return runs
}

const FILL = [
  "fill-red-500/80",
  "fill-sky-500/30",
  "fill-amber-500/30",
  "fill-violet-600/60",
]

function centreOf(v: View): [number, number] {
  const z = [v.m[2], v.m[5], v.m[8]]
  const lon = matan2(z[0], z[2]) / DEG
  const lat = masin(-z[1]) / DEG
  return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]
}

const pct = (x: number) => (x * 100).toFixed(x < 0.01 ? 2 : 1) + "%"

export function SphereSplit() {
  const [plan, setPlan] = useState<PlanId>("max")
  const [S, setS] = useState(1504)

  const vs = useMemo(() => views(plan, S), [plan, S])
  const runs = useMemo(() => mapRuns(plan, vs), [plan, vs])
  const stats = useMemo(() => sphereStats(vs), [vs])

  const facePlan = plan !== "equirect"
  const fov = plan === "corner" ? 100 : 90
  const dims = maxDims(S)
  const mp =
    plan === "equirect"
      ? (1600 * 800) / 1e6
      : plan === "max"
        ? (2 * (S * S + 4 * dims.half * dims.wide)) / 1e6
        : (6 * S * S) / 1e6
  const pxDeg = plan === "equirect" ? 1600 / 360 : S / fov
  const acrossDeg = (2 * matan(dims.wide / S)) / DEG

  const cw = W / COLS
  const ch = H / ROWS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one 360 frame → the images SfM sees</span>
        <span className="text-muted-foreground/60">the whole sphere, unrolled</span>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pt-4">
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlan(p.id)}
            aria-pressed={plan === p.id}
            className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
              plan === p.id
                ? "border-foreground/40 bg-foreground/[0.06] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="block font-medium">{p.name}</span>
            <span className="block font-mono text-[10px] opacity-70">{p.who}</span>
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        <svg
          viewBox={`-28 -6 ${W + 36} ${H + 30}`}
          className="h-auto w-full"
          role="img"
          aria-label={`An equirectangular map of the sphere coloured by how many views see each direction, for the plan "${
            PLANS.find((p) => p.id === plan)?.name
          }": ${pct(stats.none)} of the sphere in no view and ${pct(stats.two)} in two or more.`}
        >
          <rect x={0} y={0} width={W} height={H} className="fill-muted/40" />
          {runs.map((r, i) => (
            <rect
              key={i}
              x={r.x * cw}
              y={r.y * ch}
              width={r.w * cw + 0.4}
              height={ch + 0.4}
              className={FILL[r.cls]}
            />
          ))}
          {[-90, 0, 90].map((lon) => (
            <line
              key={lon}
              x1={((lon + 180) / 360) * W}
              x2={((lon + 180) / 360) * W}
              y1={0}
              y2={H}
              className="stroke-foreground/15"
              strokeWidth={1}
            />
          ))}
          {[-45, 0, 45].map((lat) => (
            <line
              key={lat}
              x1={0}
              x2={W}
              y1={((90 - lat) / 180) * H}
              y2={((90 - lat) / 180) * H}
              className="stroke-foreground/15"
              strokeWidth={1}
            />
          ))}
          {plan === "max"
            ? [90, 270].map((x) => (
                <line
                  key={x}
                  x1={(x / 360) * W}
                  x2={(x / 360) * W}
                  y1={0}
                  y2={H}
                  className="stroke-red-500"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              ))
            : null}
          {vs.map((v, i) => {
            const [x, y] = centreOf(v)
            return <circle key={i} cx={x} cy={y} r={3.2} className="fill-foreground/70" />
          })}
          <rect x={0} y={0} width={W} height={H} className="fill-none stroke-foreground/30" />
          {[
            [-180, "−180°"],
            [-90, "−90°"],
            [0, "0° (lens axis)"],
            [90, "90°"],
            [180, "180°"],
          ].map(([lon, label]) => (
            <text
              key={String(lon)}
              x={((Number(lon) + 180) / 360) * W}
              y={H + 16}
              textAnchor={lon === -180 ? "start" : lon === 180 ? "end" : "middle"}
              className="fill-muted-foreground font-mono text-[11px]"
            >
              {label}
            </text>
          ))}
          {[
            [90, "up"],
            [0, "0°"],
            [-90, "down"],
          ].map(([lat, label]) => (
            <text
              key={String(lat)}
              x={-6}
              y={((90 - Number(lat)) / 180) * H + (lat === 90 ? 9 : lat === -90 ? -2 : 4)}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 font-mono text-[11px] text-muted-foreground">
        {plan === "max" ? (
          <>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/40 align-middle" />front lens</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/40 align-middle" />back lens</span>
            <span><span className="mr-1 inline-block h-0 w-4 border-t-2 border-dashed border-red-500 align-middle" />lens seam</span>
          </>
        ) : (
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/40 align-middle" />one view</span>
        )}
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-violet-600/60 align-middle" />two or more</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-500/80 align-middle" />no view</span>
        <span>· dots are view centres</span>
      </div>

      <div className="px-4 pt-4">
        <label className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="w-28 shrink-0">face side S</span>
          <Range
            min={640}
            max={2048}
            step={8}
            value={S}
            disabled={!facePlan}
            onChange={(e) => setS(Number(e.target.value))}
            className="flex-1"
            aria-label="Face side in pixels"
          />
          <span className="w-16 shrink-0 text-right text-foreground">
            {facePlan ? `${S} px` : "n/a"}
          </span>
        </label>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-4">
        <div>
          <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">images per frame</dt>
          <dd className="m-0 font-mono text-base text-foreground">{plan === "equirect" ? 1 : vs.length}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">sphere in no view</dt>
          <dd className={`m-0 font-mono text-base ${stats.none > 0.005 ? "text-red-500" : "text-foreground"}`}>
            {pct(stats.none)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">seen twice or more</dt>
          <dd className="m-0 font-mono text-base text-foreground">{pct(stats.two)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">px per degree</dt>
          <dd className="m-0 font-mono text-base text-foreground">
            {pxDeg.toFixed(1)}
            <span className="ml-1 text-[11px] text-muted-foreground">· {mp.toFixed(1)} MP</span>
          </dd>
        </div>
      </dl>

      <figcaption className="border-t px-4 py-3 text-[13px] leading-6 text-muted-foreground">
        {plan === "equirect" ? (
          <>
            One spherical camera per frame. Nothing is cut, but reconstruction
            downsamples it to <code>--max-image-size</code>, 1600 px for the
            learned front ends at <code>--quality high</code>: 1600 px over
            360° is 4.4 px per degree, and both lenses share one camera, seam
            and all.
          </>
        ) : plan === "cube" ? (
          <>
            What the trainer does to an equirectangular camera by default
            (<code>warp_spherical_to_pinhole</code>). Six faces tile the sphere
            exactly, so nothing is seen twice; the top and bottom faces sit on
            the panorama&apos;s poles, where a few source rows are stretched
            round the whole frame.
          </>
        ) : plan === "max" ? (
          <>
            Each lens keeps its own hemisphere: the face on its axis plus four
            half faces tilted 45° + atan(half/S) off it, {acrossDeg.toFixed(1)}° across
            the seam direction. No view crosses the seam. The views of one frame
            barely overlap, so they are tied together by the rig and by matches
            across time, not to each other.
          </>
        ) : (
          <>
            Six 100° faces, centres at ±35.26° elevation every 60°, each kept
            level. No face sits on a pole, and every face holds some horizon.
            Upright faces at 100° do not close the sphere: the red is what no
            view of this plan sees (my check of the code&apos;s geometry, not a
            number the project prints).
          </>
        )}
      </figcaption>
    </figure>
  )
}
