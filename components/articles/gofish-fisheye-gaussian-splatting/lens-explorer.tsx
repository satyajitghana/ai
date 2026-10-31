"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin, mtan } from "@/lib/dmath"

import { REAL_LENSES } from "./data"

// Where each ray angle lands on the image of a lens that maps a chosen rim angle to the edge of the image disc.
// The three textbook lenses are exact formulas; the two Kannala-Brandt entries use the real OPENCV_FISHEYE
// coefficients from cameras.json of FIORD Hall_In (AllenTu/GOFish-scenes). Everything shown is arithmetic on
// those formulas: no sampling, nothing fitted.

const PI = 3.141592653589793
const RAD = PI / 180
const K1 = [0.037912020477107684, -0.023545169998035916, 0.0028405144828644122, -0.00045670077724780116]
const K2 = [0.06926585896493545, -0.08409520221228549, 0.042722585150379765, -0.009421487126218186]

const kb = (k: number[]) => (t: number) => {
  const t2 = t * t
  return t * (1 + t2 * (k[0] + t2 * (k[1] + t2 * (k[2] + t2 * k[3]))))
}
const sq = (x: number) => x * x

type Lens = { id: string; label: string; g: (t: number) => number; foldDeg: number | null }
const LENSES: Lens[] = [
  { id: "eqd", label: "equidistant  r = f·θ", g: (t) => t, foldDeg: null },
  { id: "eqs", label: "equisolid  r = 2f·sin(θ/2)", g: (t) => 2 * msin(t / 2), foldDeg: null },
  { id: "ste", label: "stereographic  r = 2f·tan(θ/2)", g: (t) => 2 * mtan(t / 2), foldDeg: null },
  { id: "kb1", label: "real camera 1 (FIORD Hall_In, k1…k4)", g: kb(K1), foldDeg: REAL_LENSES["camera 1"].theta_monotone_limit_deg },
  { id: "kb2", label: "real camera 2 (same rig, other lens)", g: kb(K2), foldDeg: REAL_LENSES["camera 2"].theta_monotone_limit_deg },
]

const R = 118
const C = 140

export function LensExplorer() {
  const [lensId, setLensId] = useState("eqd")
  const [fov, setFov] = useState(200)
  const [ray, setRay] = useState(70)
  const lens = LENSES.find((l) => l.id === lensId) ?? LENSES[0]
  const tmax = (fov / 2) * RAD
  const norm = lens.g(tmax)
  const rad = (deg: number) => (R * lens.g(deg * RAD)) / norm
  const beyond = (deg: number) => (fov / 2 > deg ? 1 - sq(lens.g(deg * RAD) / norm) : 0)
  const fold = lens.foldDeg !== null && lens.foldDeg < fov / 2 ? lens.foldDeg : null
  const unique = fold === null ? 1 : sq(lens.g(fold * RAD) / norm)
  const sphere = (1 - mcos(tmax)) / 2
  const lost = fov / 2 > 80 ? (mcos(80 * RAD) - mcos(tmax)) / (1 - mcos(tmax)) : 0
  const rayShown = Math.min(ray, fov / 2)

  const stats: [string, string][] = [
    ["share of the sphere the lens sees", `${(sphere * 100).toFixed(1)}%`],
    ["image area beyond 80° (cut by a 160° crop)", `${(beyond(80) * 100).toFixed(1)}%`],
    ["image area beyond 90° (negative camera depth)", `${(beyond(90) * 100).toFixed(1)}%`],
    ["viewed solid angle a 160° crop discards", `${(lost * 100).toFixed(1)}%`],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one image disc, four ways to cut it · computed</span>
        <select
          aria-label="Lens model"
          value={lensId}
          onChange={(e) => setLensId(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 font-mono text-xs"
        >
          {LENSES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-[280px_1fr] sm:p-4">
        <svg viewBox="0 0 280 280" role="img" className="mx-auto h-auto w-full max-w-[280px]">
          <title>
            An image disc for a {fov} degree lens. The band beyond 80 degrees from the optical axis is shaded; the band
            beyond 90 degrees is darker. A circle marks where a ray {Math.round(rayShown)} degrees off the axis lands.
          </title>
          <circle cx={C} cy={C} r={R} fill="currentColor" fillOpacity={0.05} stroke="currentColor" strokeOpacity={0.4} />
          {fov / 2 > 80 && (
            <path
              d={`M${C - R} ${C} a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 ${-2 * R} 0 Z M${C - rad(80)} ${C} a${rad(80)} ${rad(80)} 0 1 1 ${2 * rad(80)} 0 a${rad(80)} ${rad(80)} 0 1 1 ${-2 * rad(80)} 0 Z`}
              fillRule="evenodd"
              fill="oklch(0.75 0.14 70)"
              fillOpacity={0.28}
            />
          )}
          {fov / 2 > 90 && (
            <path
              d={`M${C - R} ${C} a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 ${-2 * R} 0 Z M${C - rad(90)} ${C} a${rad(90)} ${rad(90)} 0 1 1 ${2 * rad(90)} 0 a${rad(90)} ${rad(90)} 0 1 1 ${-2 * rad(90)} 0 Z`}
              fillRule="evenodd"
              fill="oklch(0.6 0.2 25)"
              fillOpacity={0.28}
            />
          )}
          {fold !== null && (
            <circle cx={C} cy={C} r={rad(fold)} fill="none" stroke="oklch(0.55 0.2 25)" strokeWidth={2} strokeDasharray="5 3" />
          )}
          {fov / 2 > 80 && <circle cx={C} cy={C} r={rad(80)} fill="none" stroke="oklch(0.62 0.15 70)" strokeDasharray="4 3" />}
          {fov / 2 > 90 && <circle cx={C} cy={C} r={rad(90)} fill="none" stroke="oklch(0.55 0.2 25)" strokeDasharray="4 3" />}
          <circle cx={C} cy={C} r={rad(rayShown)} fill="none" stroke="oklch(0.6 0.15 255)" strokeWidth={2} />
          <text x={C} y={C + 3} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
            axis
          </text>
        </svg>
        <div className="min-w-0">
          <label className="flex items-center gap-3 font-mono text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">field of view</span>
            <Range min={160} max={220} step={1} value={fov} onChange={(e) => setFov(Number(e.target.value))} aria-label="Field of view in degrees" />
            <span className="w-12 text-right">{fov}°</span>
          </label>
          <label className="mt-2 flex items-center gap-3 font-mono text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">ray angle</span>
            <Range min={0} max={110} step={1} value={ray} onChange={(e) => setRay(Number(e.target.value))} aria-label="Ray angle off the optical axis in degrees" accent="oklch(0.6 0.15 255)" />
            <span className="w-12 text-right">{Math.round(rayShown)}°</span>
          </label>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            that ray lands {((rad(rayShown) / R) * 100).toFixed(1)}% of the way to the rim
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-lg border px-2.5 py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 text-sm">{v}</dd>
              </div>
            ))}
          </dl>
          {fold !== null && (
            <p className="mt-3 rounded-lg border border-[oklch(0.55_0.2_25)]/40 px-3 py-2 text-xs">
              This calibration stops being a lens at {fold.toFixed(2)}°: past it the polynomial folds back, so rays are
              not unique. Only {(unique * 100).toFixed(1)}% of the disc has a valid ray.
            </p>
          )}
        </div>
      </div>
    </figure>
  )
}
