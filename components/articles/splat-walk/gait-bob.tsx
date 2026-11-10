"use client"

// One stride of splat-walk's simulated walker, using the formulas in its
// src/walk.js (Walk.sample) at commit 8a140e7, re-implemented here:
//
//   cadence(v)  = 1.3 + 0.41 v                    steps per second
//   e           = clamp(v / 1.2, 0, 1) ^ 0.8      gait envelope (route speed 1.2 m/s)
//   asym        = 1 + 0.065 cos(pi phi)            one leg pushes harder
//   bob         = -e 0.019 asym (cos 2pi phi + 0.16 cos(4pi phi + 0.6))     metres
//   sway        =  e 0.017 sin(pi phi)                                         metres
//   shock       =  e u^2 exp(2 (1 - u)),  u = (time since heel strike) / 50 ms
//
// phi is the gait phase: a whole number is a heel strike. The repo also
// multiplies asym by 1 + 0.12 * noise per step; this plot leaves that out, so
// both steps here differ only by the 6.5% left/right term. At 1.2 m/s my numpy
// port of the same formulas gives 1.792 steps/s, 0.67 m steps, a 4.03 cm
// peak-to-peak bob and a 3.4 cm side sway.

import { useState } from "react"
import { mcos, mexp, mpow, msin } from "@/lib/dmath"

const W = 700
const H = 250
const L = 48
const R = 18
const T = 28
const PH = 150 // plot height
const N = 240
const PI = Math.PI

const A = "oklch(0.62 0.16 255)"
const B = "oklch(0.66 0.15 40)"
const C = "oklch(0.6 0.04 255)"

function curves(v: number) {
  const cad = 1.3 + 0.41 * Math.max(0, v)
  const e = mpow(Math.min(1, Math.max(0, v / 1.2)), 0.8)
  const bob: number[] = []
  const sway: number[] = []
  const shock: number[] = []
  for (let i = 0; i <= N; i++) {
    const phi = (2 * i) / N
    const asym = 1 + 0.065 * mcos(PI * phi)
    bob.push(-e * 0.019 * asym * (mcos(2 * PI * phi) + 0.16 * mcos(4 * PI * phi + 0.6)))
    sway.push(e * 0.017 * msin(PI * phi))
    const u = (phi - Math.floor(phi)) / cad / 0.05
    shock.push(e * u * u * mexp(2 * (1 - u)))
  }
  return { cad, e, bob, sway, shock }
}

const range = (a: number[]) => Math.max(...a) - Math.min(...a)

export function GaitBob() {
  const [v, setV] = useState(1.2)
  const { cad, e, bob, sway, shock } = curves(v)
  const x = (i: number) => L + ((W - L - R) * i) / N
  const yM = (m: number) => T + PH / 2 - (m / 0.03) * (PH / 2) // +-3 cm full scale
  const yS = (s: number) => T + PH + 34 - s * 26
  const path = (a: number[], f: (n: number) => number) =>
    a.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${f(m).toFixed(1)}`).join(" ")
  const stride = 2 / cad
  const stepLen = v > 0.02 ? v / cad : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one stride of the walker · src/walk.js</span>
        <span className="text-muted-foreground/60">formulas from the code</span>
      </div>
      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Two steps of the simulated walk at ${v.toFixed(2)} metres per second: vertical bob ${(range(bob) * 100).toFixed(1)} centimetres peak to peak, side sway ${(range(sway) * 100).toFixed(1)} centimetres, and a heel-strike shock that peaks 50 milliseconds after each footfall.`}
        >
          {[-0.02, -0.01, 0, 0.01, 0.02].map((m) => (
            <g key={m}>
              <line x1={L} x2={W - R} y1={yM(m)} y2={yM(m)} stroke="currentColor" className="text-border" strokeWidth={m === 0 ? 1 : 0.5} />
              <text x={L - 6} y={yM(m) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
                {m * 100 > 0 ? "+" : ""}
                {m * 100} cm
              </text>
            </g>
          ))}
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <line x1={x((k * N) / 2)} x2={x((k * N) / 2)} y1={T - 6} y2={T + PH + 50} stroke="currentColor" className="text-muted-foreground" strokeDasharray="2 3" strokeWidth={0.8} />
              <text x={x((k * N) / 2) + 4} y={T - 10} fontSize={9} className="fill-muted-foreground font-mono">
                heel strike {k === 1 ? "R" : "L"}
              </text>
            </g>
          ))}
          <path d={path(bob, yM)} fill="none" stroke={A} strokeWidth={2} />
          <path d={path(sway, yM)} fill="none" stroke={B} strokeWidth={1.6} strokeDasharray="5 3" />
          <path d={path(shock, yS)} fill="none" stroke={C} strokeWidth={1.4} />
          <text x={W - R} y={T + PH + 46} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
            heel-strike shock (dips camera 1.6 mm, pitch 0.16°)
          </text>
          <g fontSize={10} className="font-mono">
            <rect x={L + 6} y={T + 4} width={10} height={3} fill={A} />
            <text x={L + 20} y={T + 9} className="fill-foreground">vertical bob</text>
            <rect x={L + 110} y={T + 4} width={10} height={3} fill={B} />
            <text x={L + 124} y={T + 9} className="fill-foreground">side sway</text>
          </g>
        </svg>
        <label className="mt-2 block font-mono text-xs text-muted-foreground">
          walking speed: <span className="text-foreground">{v.toFixed(2)} m/s</span>
          <input
            type="range"
            min={0}
            max={1.4}
            step={0.05}
            value={v}
            onChange={(ev) => setV(Number(ev.target.value))}
            className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            aria-label="walking speed in metres per second"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          {[
            ["cadence", `${cad.toFixed(3)} steps/s`],
            ["step length", `${stepLen.toFixed(2)} m`],
            ["bob, peak to peak", `${(range(bob) * 100).toFixed(2)} cm`],
            ["envelope e", `${e.toFixed(2)} · stride ${stride.toFixed(2)} s`],
          ].map(([k, val]) => (
            <div key={k} className="rounded-lg border bg-background/50 px-2.5 py-1.5">
              <div className="text-muted-foreground">{k}</div>
              <div className="text-foreground">{val}</div>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
