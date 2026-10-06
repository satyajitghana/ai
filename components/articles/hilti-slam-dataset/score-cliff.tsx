"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// How the Hilti score turns a drifting trajectory into points.
//
// The survey marks are the real ones: the 13 visits of exp01_construction_ground_level
// (10 distinct marks, the loop starts and ends on P13), x/y in metres in the survey
// frame, read from ground_truth/exp01_construction_ground_level.txt in the official
// release. The estimate is simulated: walk the straight segments between consecutive
// marks, rotate each by a heading error that grows linearly with distance walked (yaw
// drift, degrees per 100 m), then add a fixed per-visit noise pattern scaled by sigma.
// The estimate is then aligned to the marks with a least-squares rigid transform in
// the plane (the challenge uses SE(3) Umeyama in 3D; this is its 2D special case),
// and each visit is scored with the 2022 or the 2023 bands.
//
// All transcendental calls go through lib/dmath so SSR and the browser agree.

type Mark = { id: string; t: number; x: number; y: number }

const MARKS: Mark[] = [
  { id: "P13", t: 0.0, x: -1.92, y: -1.165 },
  { id: "P14", t: 13.8, x: 2.22, y: -5.026 },
  { id: "P15", t: 28.1, x: 8.042, y: -9.7 },
  { id: "P16", t: 43.8, x: 15.954, y: -2.072 },
  { id: "P30", t: 59.7, x: 13.992, y: 9.186 },
  { id: "P18", t: 75.8, x: 22.917, y: 9.906 },
  { id: "P19", t: 93.1, x: 24.336, y: 1.996 },
  { id: "P31", t: 106.5, x: 29.323, y: 2.858 },
  { id: "P32", t: 124.0, x: 37.809, y: 9.377 },
  { id: "P17", t: 147.3, x: 38.402, y: -8.897 },
  { id: "P16", t: 190.6, x: 15.954, y: -2.072 },
  { id: "P14", t: 209.5, x: 2.22, y: -5.026 },
  { id: "P13", t: 222.9, x: -1.92, y: -1.165 },
]

// A fixed draw of unit-variance Gaussian offsets (numpy default_rng(7)), one per
// visit, so the picture is stable between renders and identical on server and client.
const NOISE: [number, number][] = [
  [0.001, 0.351],
  [-0.323, -1.048],
  [-0.535, -1.167],
  [0.071, 1.577],
  [-0.579, -0.73],
  [0.576, 0.42],
  [0.124, -1.095],
  [-0.034, 0.818],
  [-1.581, -0.538],
  [-2.237, -1.517],
  [-2.167, -0.277],
  [-1.491, 0.319],
  [0.184, -0.22],
]

type Edition = "2022" | "2023"

// [upper bound in metres, points]; the last band is everything above.
const BANDS: Record<Edition, { max: number; pts: number }[]> = {
  "2022": [
    { max: 0.01, pts: 10 },
    { max: 0.03, pts: 6 },
    { max: 0.06, pts: 3 },
    { max: 0.1, pts: 1 },
    { max: Infinity, pts: 0 },
  ],
  "2023": [
    { max: 0.005, pts: 20 },
    { max: 0.01, pts: 10 },
    { max: 0.03, pts: 6 },
    { max: 0.06, pts: 5 },
    { max: 0.1, pts: 3 },
    { max: 0.4, pts: 1 },
    { max: Infinity, pts: 0 },
  ],
}

const TOP: Record<Edition, number> = { "2022": 10, "2023": 20 }

// Colour by fraction of the top score a visit earned.
function bandColor(frac: number) {
  if (frac >= 1) return "#2E8B57"
  if (frac >= 0.5) return "#7FB03A"
  if (frac >= 0.25) return "#E0A030"
  if (frac > 0) return "#E0703A"
  return "#C0392B"
}

function fmtMm(m: number) {
  const mm = m * 1000
  return mm < 10 ? mm.toFixed(1) : mm.toFixed(0)
}

function simulate(driftDegPer100m: number, sigmaMm: number) {
  // Dead-reckon the estimate along the true segments with a growing heading error.
  const est: [number, number][] = [[MARKS[0].x, MARKS[0].y]]
  let dist = 0
  for (let k = 1; k < MARKS.length; k++) {
    const vx = MARKS[k].x - MARKS[k - 1].x
    const vy = MARKS[k].y - MARKS[k - 1].y
    dist += Math.sqrt(vx * vx + vy * vy)
    const th = ((driftDegPer100m * Math.PI) / 180) * (dist / 100)
    const c = mcos(th)
    const s = msin(th)
    const [px, py] = est[k - 1]
    est.push([px + c * vx - s * vy, py + s * vx + c * vy])
  }
  const sig = sigmaMm / 1000
  const noisy = est.map(([x, y], i) => [x + NOISE[i][0] * sig, y + NOISE[i][1] * sig])

  // Least-squares rigid alignment in the plane (2D Umeyama without scale).
  const n = MARKS.length
  let mex = 0
  let mey = 0
  let mpx = 0
  let mpy = 0
  for (let i = 0; i < n; i++) {
    mex += noisy[i][0] / n
    mey += noisy[i][1] / n
    mpx += MARKS[i].x / n
    mpy += MARKS[i].y / n
  }
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    const ax = noisy[i][0] - mex
    const ay = noisy[i][1] - mey
    const bx = MARKS[i].x - mpx
    const by = MARKS[i].y - mpy
    sxx += ax * bx + ay * by
    sxy += ax * by - ay * bx
  }
  const rot = matan2(sxy, sxx)
  const c = mcos(rot)
  const s = msin(rot)
  const aligned = noisy.map(([x, y]) => {
    const ax = x - mex
    const ay = y - mey
    return [c * ax - s * ay + mpx, s * ax + c * ay + mpy] as [number, number]
  })
  const err = aligned.map(([x, y], i) => {
    const dx = x - MARKS[i].x
    const dy = y - MARKS[i].y
    return { dx, dy, e: Math.sqrt(dx * dx + dy * dy) }
  })
  return { err, walked: dist }
}

// Map frame: x -3..40, y -11..11 metres.
const X0 = -4
const X1 = 41
const Y0 = -12
const Y1 = 12
const W = 560
const H = Math.round((W * (Y1 - Y0)) / (X1 - X0))
const sx = (x: number) => ((x - X0) / (X1 - X0)) * W
const sy = (y: number) => H - ((y - Y0) / (Y1 - Y0)) * H

const NICE_MAG = [10, 20, 50, 100, 200, 500, 1000]

export function ScoreCliff() {
  const [drift, setDrift] = useState(0.1)
  const [sigma, setSigma] = useState(3)
  const [edition, setEdition] = useState<Edition>("2022")

  const { err, walked } = useMemo(() => simulate(drift, sigma), [drift, sigma])

  const bands = BANDS[edition]
  const scored = err.map((r) => {
    const band = bands.find((b) => r.e < b.max) ?? bands[bands.length - 1]
    return { ...r, pts: band.pts, frac: band.pts / TOP[edition] }
  })
  const total = scored.reduce((a, r) => a + r.pts, 0)
  const score = (100 * total) / (TOP[edition] * scored.length)
  const rmse = Math.sqrt(scored.reduce((a, r) => a + r.e * r.e, 0) / scored.length)
  const maxErr = scored.reduce((a, r) => Math.max(a, r.e), 0)

  // Pick a magnification so the largest error vector is drawn about 4 m long.
  const want = maxErr > 0 ? 4 / maxErr : NICE_MAG[NICE_MAG.length - 1]
  const mag = [...NICE_MAG].reverse().find((m) => m <= want) ?? NICE_MAG[0]

  const thresholds = bands.filter((b) => Number.isFinite(b.max)).map((b) => b.max)
  const stripMax = Math.max(0.1, maxErr * 1.1)

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            exp01 construction ground level, 13 survey visits
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-heading text-3xl font-semibold tabular-nums">
              {score.toFixed(1)}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              / 100 for this sequence
            </span>
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            RMSE {fmtMm(rmse)} mm · worst visit {fmtMm(maxErr)} mm · {walked.toFixed(0)} m
            between marks
          </div>
        </div>
        <div className="flex items-center gap-1 self-start rounded-md border bg-background p-0.5 font-mono text-xs">
          {(["2022", "2023"] as Edition[]).map((ed) => (
            <button
              key={ed}
              type="button"
              onClick={() => setEdition(ed)}
              aria-pressed={edition === ed}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                edition === ed
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {ed} bands
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>heading drift</span>
            <span className="tabular-nums text-foreground">{drift.toFixed(2)}° / 100 m</span>
          </span>
          <Range
            className="mt-2"
            min={0}
            max={1}
            step={0.05}
            value={drift}
            aria-label="Heading drift in degrees per 100 metres walked"
            onChange={(e) => setDrift(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>per-visit noise (1σ)</span>
            <span className="tabular-nums text-foreground">{sigma} mm</span>
          </span>
          <Range
            className="mt-2"
            min={0}
            max={20}
            step={1}
            value={sigma}
            aria-label="Per-visit position noise in millimetres"
            onChange={(e) => setSigma(Number(e.target.value))}
          />
        </label>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full rounded border bg-background"
        role="img"
        aria-label={`Top-down map of the 13 survey visits of exp01, coloured by score band. Sequence score ${score.toFixed(1)} of 100.`}
      >
        {MARKS.slice(1).map((m, i) => (
          <line
            key={`seg-${i}`}
            x1={sx(MARKS[i].x)}
            y1={sy(MARKS[i].y)}
            x2={sx(m.x)}
            y2={sy(m.y)}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeDasharray="3 4"
          />
        ))}
        {scored.map((r, i) => {
          const m = MARKS[i]
          const x = sx(m.x)
          const y = sy(m.y)
          const ex = sx(m.x + r.dx * mag)
          const ey = sy(m.y + r.dy * mag)
          const col = bandColor(r.frac)
          return (
            <g key={`v-${i}`}>
              <line x1={x} y1={y} x2={ex} y2={ey} stroke={col} strokeWidth={2} />
              <circle cx={ex} cy={ey} r={3} fill={col} />
              <circle cx={x} cy={y} r={4.5} fill="none" stroke="currentColor" strokeWidth={1.2} />
            </g>
          )
        })}
        {MARKS.filter((m, i) => MARKS.findIndex((o) => o.id === m.id) === i).map((m) => (
          <text
            key={`lbl-${m.id}`}
            x={sx(m.x) + 7}
            y={sy(m.y) - 7}
            fontSize={10}
            className="fill-muted-foreground font-mono"
          >
            {m.id}
          </text>
        ))}
        <text x={8} y={H - 8} fontSize={10} className="fill-muted-foreground font-mono">
          circles: surveyed marks · lines: aligned estimate error drawn x{mag}
        </text>
      </svg>

      <div className="mt-4">
        <div className="font-mono text-xs text-muted-foreground">
          error per visit, in visit order (dashed: band edges)
        </div>
        <svg viewBox="0 0 560 70" className="mt-1 w-full" role="img" aria-label="Per-visit error bars">
          {thresholds
            .filter((t) => t <= stripMax)
            .map((t) => {
              const y = 60 - (t / stripMax) * 56
              return (
                <g key={`th-${t}`}>
                  <line
                    x1={0}
                    x2={560}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.3}
                    strokeDasharray="2 3"
                  />
                  <text x={556} y={y - 2} fontSize={8} textAnchor="end" className="fill-muted-foreground font-mono">
                    {Math.round(t * 1000)} mm
                  </text>
                </g>
              )
            })}
          {scored.map((r, i) => {
            const bw = 560 / scored.length
            const h = Math.max(1, (Math.min(r.e, stripMax) / stripMax) * 56)
            return (
              <rect
                key={`b-${i}`}
                x={i * bw + 6}
                y={60 - h}
                width={bw - 18}
                height={h}
                fill={bandColor(r.frac)}
                rx={1.5}
              />
            )
          })}
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {bands.map((b, i) => {
            const lo = i === 0 ? 0 : bands[i - 1].max
            const label = Number.isFinite(b.max)
              ? `${Math.round(lo * 1000)}–${Math.round(b.max * 1000)} mm`
              : `≥ ${Math.round(lo * 1000)} mm`
            const n = scored.filter((r) => r.pts === b.pts).length
            return (
              <span key={`lg-${i}`} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: bandColor(b.pts / TOP[edition]) }}
                />
                {label}: {b.pts} pts × {n}
              </span>
            )
          })}
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        The marks are real; the trajectory is simulated. Heading drift accumulates over the
        straight-line distance between consecutive marks, which understates the path actually
        walked. Alignment is a rigid fit in the plane, the 2D case of the challenge&apos;s SE(3)
        Umeyama step.
      </p>
    </div>
  )
}
