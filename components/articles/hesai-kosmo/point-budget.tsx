"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// Where 569,000 points a second go during a room scan.
//
// Inputs are a rectangular room (floor area, aspect ratio, ceiling height), the
// scan length, the share of shots that land on the room's surfaces, a viewing
// distance and an assumed single-shot range noise. Hesai publishes the point rate
// (569,000/s) and the lidar field of view (320 x 60 degrees); it does not publish
// range noise, angular resolution or frame rate, so noise is a slider and the
// angular spacing is computed for an accumulation window, which does not need a
// frame rate. The reference Gaussian size (9.1 x 3.3 mm, one sigma, median) is
// measured from the Kosmo scan Pixar ships with its RenderMan tutorial.
//
// The log axis goes through lib/dmath; everything else is + - * / and sqrt, which are exact.

const RATE = 569_000 // points per second (Hesai spec sheet)
const FOV_DEG2 = 320 * 60 // flat approximation of the 320 x 60 degree field of view
const SPLAT_MAJOR_MM = 9.1 // median largest sigma, measured on the Pixar Kosmo scan
const SPLAT_MID_MM = 3.3 // median middle sigma, same file

function fmt(n: number, digits = 1) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`
  if (n >= 1e6) return `${(n / 1e6).toFixed(digits)} million`
  if (n >= 1e4) return `${Math.round(n / 1000).toLocaleString("en-US")}k`
  return n.toFixed(digits)
}

export function PointBudget() {
  const [area, setArea] = useState(100)
  const [height, setHeight] = useState(2.8)
  const [minutes, setMinutes] = useState(15)
  const [hit, setHit] = useState(100)
  const [dist, setDist] = useState(3)
  const [noise, setNoise] = useState(10)
  const [windowS, setWindowS] = useState(1)

  // A square-ish room: side = sqrt(area). Surfaces = floor + ceiling + four walls.
  const side = Math.sqrt(area)
  const wallArea = 4 * side * height
  const surface = 2 * area + wallArea
  const shots = RATE * minutes * 60
  const landed = (shots * hit) / 100
  const density = landed / surface // points per m^2
  const spacingMm = 1000 / Math.sqrt(density)
  const perCm2 = density * 1e-4

  // Angular spacing of the points collected in one accumulation window, if the
  // pattern spreads evenly over the field of view.
  const angDeg = Math.sqrt(FOV_DEG2 / (RATE * windowS))
  const angRad = (angDeg * Math.PI) / 180
  const footMm = dist * 1000 * angRad

  // Points that fall inside a median Gaussian's one-sigma ellipse, and the
  // standard error of a local plane fit through them (sigma / sqrt(N)).
  const splatAreaM2 = Math.PI * SPLAT_MAJOR_MM * 1e-3 * SPLAT_MID_MM * 1e-3
  const perSplat = density * splatAreaM2
  const planeMm = noise / Math.sqrt(Math.max(perCm2, 1))

  // Bar: spacing against the Gaussian's width, on a log axis from 0.1 to 100 mm.
  const lg = (v: number) => mlog10(Math.min(100, Math.max(0.1, v)))
  const pos = (v: number) => ((lg(v) + 1) / 3) * 100

  const markers = [
    { v: spacingMm, label: "mean point spacing, whole scan", color: "var(--color-primary, #2A9D8F)" },
    { v: footMm, label: `spacing in a ${windowS} s window at ${dist} m`, color: "#C77D2E" },
    { v: SPLAT_MAJOR_MM, label: "median Gaussian, largest sigma", color: "#7A5BB5" },
    { v: planeMm, label: "plane-fit noise over 1 cm²", color: "#3B7DD8" },
  ]

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Point budget of a Kosmo One room scan (reasoned, not measured on a device)
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Floor area</span>
            <span className="font-mono tabular-nums">{area} m²</span>
          </div>
          <Range min={20} max={400} step={10} value={area} onChange={(e) => setArea(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Ceiling height</span>
            <span className="font-mono tabular-nums">{height.toFixed(1)} m</span>
          </div>
          <Range min={2.2} max={6} step={0.1} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Scan length</span>
            <span className="font-mono tabular-nums">{minutes} min</span>
          </div>
          <Range min={1} max={45} step={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Shots that land on the room</span>
            <span className="font-mono tabular-nums">{hit}%</span>
          </div>
          <Range min={20} max={100} step={5} value={hit} onChange={(e) => setHit(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Distance to the wall</span>
            <span className="font-mono tabular-nums">{dist} m</span>
          </div>
          <Range min={0.5} max={20} step={0.5} value={dist} onChange={(e) => setDist(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Accumulation window</span>
            <span className="font-mono tabular-nums">{windowS} s</span>
          </div>
          <Range min={0.1} max={10} step={0.1} value={windowS} onChange={(e) => setWindowS(Number(e.target.value))} />
        </label>
        <label className="text-sm sm:col-span-2">
          <div className="flex justify-between">
            <span>Single-shot range noise (assumed; Hesai does not publish it)</span>
            <span className="font-mono tabular-nums">{noise} mm</span>
          </div>
          <Range min={2} max={30} step={1} value={noise} onChange={(e) => setNoise(Number(e.target.value))} />
        </label>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Shots fired</dt>
          <dd className="font-mono tabular-nums">{fmt(shots)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Surface (floor, ceiling, walls)</dt>
          <dd className="font-mono tabular-nums">{surface.toFixed(0)} m²</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Points per m²</dt>
          <dd className="font-mono tabular-nums">{fmt(density, 2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Points per median Gaussian</dt>
          <dd className="font-mono tabular-nums">{perSplat.toFixed(0)}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <div className="relative h-2 rounded-full bg-border">
          {markers.map((m) => (
            <div
              key={m.label}
              className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm"
              style={{ left: `${pos(m.v).toFixed(2)}%`, background: m.color }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>0.1 mm</span>
          <span>1 mm</span>
          <span>10 mm</span>
          <span>100 mm</span>
        </div>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {markers.map((m) => (
            <li key={m.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: m.color }} />
              <span className="font-mono tabular-nums">{m.v < 10 ? m.v.toFixed(2) : m.v.toFixed(1)} mm</span>
              <span className="text-muted-foreground">{m.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Assumes the shots spread evenly over a square room&apos;s six surfaces and over the 320 × 60
        degree field of view. Real coverage is uneven: surfaces near the operator get far more, the
        far corners far less. Plane-fit noise is σ/√N over the points in one square centimetre, and
        it says nothing about drift between one end of the room and the other.
      </p>
    </div>
  )
}
