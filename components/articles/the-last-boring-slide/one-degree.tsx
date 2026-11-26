"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mtan } from "@/lib/dmath"

// The deck's "Aim" slide: miss = tan(angle) x distance. Distances: 10 m (the deck's demo range),
// the mean Earth-Moon distance (384,400 km) and Proxima Centauri at 4.24 light years
// (1 ly = 63,241 AU). Moon diameter 3,474 km for "how many Moons".

const KM_PER_AU = 149597870.7
const AU_PER_LY = 63241.077
const MOON_KM = 3474

const DIST = [
  { id: "range", label: "10 metres", km: 0.01 },
  { id: "moon", label: "The Moon", km: 384400 },
  { id: "star", label: "Nearest star (4.24 ly)", km: 4.24 * AU_PER_LY * KM_PER_AU },
] as const
const ANGLES = [1, 0.1] as const

function fmtMiss(km: number) {
  if (km < 0.001) return `${(km * 100000).toFixed(km < 0.0001 ? 2 : 1)} cm`
  if (km < 1e7) return `${Math.round(km).toLocaleString("en-US")} km`
  return `${Math.round(km / KM_PER_AU).toLocaleString("en-US")} AU`
}

export function OneDegree() {
  const [d, setD] = useState<(typeof DIST)[number]["id"]>("moon")
  const [deg, setDeg] = useState<(typeof ANGLES)[number]>(1)
  const dist = DIST.find((x) => x.id === d)!
  const t = mtan((deg * Math.PI) / 180)
  const miss = t * dist.km
  // drawing: not to scale; the angle is exaggerated so the miss is visible
  const W = 640, H = 150, x0 = 30, y0 = 110, x1 = 600
  const shown = deg === 1 ? 7 : 2.5

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3">
        <span className="font-medium">One degree off, at three distances</span>
        <span className="block text-muted-foreground">miss = tan(angle) × distance. The drawing exaggerates the angle; the numbers do not.</span>
      </figcaption>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <div role="tablist" aria-label="Distance" className="inline-flex flex-wrap rounded-md border border-border p-0.5">
          {DIST.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={d === x.id} onClick={() => setD(x.id)} className={cn("rounded px-2.5 py-1", d === x.id ? "bg-foreground text-background" : "text-muted-foreground")}>
              {x.label}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Aim error" className="inline-flex rounded-md border border-border p-0.5">
          {ANGLES.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={deg === a} onClick={() => setDeg(a)} className={cn("rounded px-2.5 py-1", deg === a ? "bg-foreground text-background" : "text-muted-foreground")}>
              {a}°
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${dist.label}, ${deg} degree misses by ${fmtMiss(miss)}`}>
        <line x1={x0} y1={y0} x2={x1} y2={y0} className="stroke-foreground/50" strokeWidth={1.5} strokeDasharray="4 4" />
        <line x1={x0} y1={y0} x2={x1} y2={y0 - (x1 - x0) * mtan((shown * Math.PI) / 180)} className="stroke-amber-500" strokeWidth={2} />
        <circle cx={x1} cy={y0} r={6} className="fill-foreground" />
        <line x1={x1 + 14} x2={x1 + 14} y1={y0} y2={y0 - (x1 - x0) * mtan((shown * Math.PI) / 180)} className="stroke-foreground" strokeWidth={1} />
        <text x={x0} y={y0 + 24} className="fill-muted-foreground" fontSize={12}>aim</text>
        <text x={x1} y={y0 + 24} textAnchor="end" className="fill-muted-foreground" fontSize={12}>target: {dist.label}</text>
      </svg>
      <p className="mt-1">
        Miss: <span className="font-mono text-lg">{fmtMiss(miss)}</span>
        {d === "moon" && deg === 1 && <span className="text-muted-foreground"> ({(miss / MOON_KM).toFixed(2)} Moon diameters)</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {deg === 1 ? "The deck's numbers: 17 cm, 6,700 km and 4,700 times the Earth-Sun distance." : "Ten times better aim buys a tenth of the miss, at every distance. The geometry is linear; only the distance grows."}
      </p>
    </figure>
  )
}
