"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan, mcos, msin } from "@/lib/dmath"

import { STEP_M, TYRES } from "./data"

// roadrash.fun stores a track as one pair of bytes per 4.85 m step. A step turns the heading by atan(a / 256) / 2
// (race.js: `turnOf`), and the AI caps its corner speed with L = floor(floor(300 * tyre / 256) * 37 / 256) and
// vmax = 0.9 * sqrt(L * 4.03e7 / a) / 223.7 metres per second. Both formulas are the site's; we only evaluate them.
const STEPS = 40
const BOX = 300

function arc(a: number): { pts: string; w: number; h: number; ox: number; oy: number } {
  const turn = matan(a / 256) / 2
  let hd = 0
  let px = 0
  let pz = 0
  const xs = [0]
  const zs = [0]
  for (let k = 0; k < STEPS; k++) {
    hd += turn
    px += msin(hd) * STEP_M
    pz -= mcos(hd) * STEP_M
    xs.push(px)
    zs.push(pz)
  }
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const z0 = Math.min(...zs)
  const z1 = Math.max(...zs)
  const span = Math.max(x1 - x0, z1 - z0, 60)
  const k = (BOX - 40) / span
  const ox = 20 + ((BOX - 40) - (x1 - x0) * k) / 2 - x0 * k
  const oy = 20 + ((BOX - 40) - (z1 - z0) * k) / 2 - z0 * k
  const pts = xs.map((v, i) => `${(ox + v * k).toFixed(1)},${(oy + zs[i] * k).toFixed(1)}`).join(" ")
  return { pts, w: x1 - x0, h: z1 - z0, ox, oy }
}

export function BendLab() {
  const [a, setA] = useState(64)
  const [ti, setTi] = useState(4)
  const tyre = TYRES[ti]
  const turn = matan(a / 256) / 2
  const radius = STEP_M / turn
  const L = Math.floor((Math.floor((300 * tyre) / 256) * 37) / 256)
  const vms = (0.9 * Math.sqrt((L * 4.03e7) / Math.max(0.5, a))) / 223.7
  const mph = vms * 2.237
  const lat = (vms * vms) / radius
  const g = arc(a)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the site&apos;s bend formulas, evaluated · 40 steps of one constant path byte · top-down
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[300px_1fr]">
        <svg viewBox={`0 0 ${BOX} ${BOX}`} className="w-full max-w-[300px] rounded border bg-muted/30" role="img" aria-label={`A bend of path byte ${a}: ${radius.toFixed(0)} metre radius over 40 steps of 4.85 metres.`}>
          <polyline points={g.pts} fill="none" stroke="oklch(0.60 0.16 255)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={g.pts.split(" ")[0].split(",")[0]} cy={g.pts.split(" ")[0].split(",")[1]} r={5} fill="oklch(0.62 0.15 150)" />
          <text x={12} y={BOX - 10} fontSize={10} className="fill-muted-foreground font-mono">
            {(STEPS * STEP_M).toFixed(0)} m of road
          </text>
        </svg>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 font-mono text-muted-foreground">path byte a</span>
            <Range min={1} max={127} step={1} value={a} onChange={(e) => setA(Number(e.target.value))} aria-label="Path byte" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{a}</span>
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 font-mono text-muted-foreground">tyre value</span>
            <Range min={0} max={TYRES.length - 1} step={1} value={ti} onChange={(e) => setTi(Number(e.target.value))} aria-label="Tyre value, lowest to highest in the bike table" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{tyre}</span>
          </label>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
            <div>
              <dt className="text-muted-foreground">turn per step</dt>
              <dd className="tabular-nums">{((turn * 180) / Math.PI).toFixed(2)}°</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">radius</dt>
              <dd className="tabular-nums">{radius.toFixed(1)} m</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">grip limit L</dt>
              <dd className="tabular-nums">{L}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">AI corner cap</dt>
              <dd className="tabular-nums">{mph.toFixed(1)} mph</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">lateral acceleration at that cap</dt>
              <dd className="tabular-nums">
                {lat.toFixed(1)} m/s² ({(lat / 9.80665).toFixed(2)} g)
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            The cap is the AI&apos;s, not the player&apos;s. The player can take a bend faster and slide; the grip test in the
            integrator decides when.
          </p>
        </div>
      </div>
    </figure>
  )
}
