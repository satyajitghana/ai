"use client"

// A head turn in splat-walk, re-implemented from src/walk.js (_simulateGaze)
// at commit 8a140e7 and stepped at the same 240 Hz:
//
//   goal is eased:   g += (target - g) (1 - exp(-dt / 0.045))
//   head spring:     T = 0.28 + 0.008 |amp|  ("main sequence": bigger turns take longer)
//                    omega = 2.6 / T, zeta = the look's damping (0.64 to 0.78 in the repo)
//                    head speed clamped to 240 deg/s
//   phone spring:    omega_c = 2 pi 2.8, zeta_c = 0.55, chasing the head
//
// The phone's angular speed is what the film pass smears: at 1080 rows and a
// 50 degree vertical field of view the focal length is 540 / tan 25 deg =
// 1158 px, so a 16 ms readout shears a vertical edge by 1158 * omega * 0.016
// px and a 1/80 s exposure smears it by 1158 * omega / 80 px (omega in rad/s).
// These are the numbers my numpy port printed (and this loop reproduces):
// a 60 degree turn at zeta 0.64 peaks at 100.5 deg/s, 32.5 px of shear.

import { useMemo, useState } from "react"
import { mexp } from "@/lib/dmath"

const DT = 1 / 240
const DUR = 2.5
const NS = Math.round(DUR / DT)
const F_PX = 1158.0
const DEG = Math.PI / 180

function simulate(amp: number, zeta: number) {
  const T = 0.28 + 0.008 * Math.abs(amp)
  const om = 2.6 / T
  const wc = 2 * Math.PI * 2.8
  const zc = 0.55
  const ease = 1 - mexp(-DT / 0.045)
  let g = 0, h = 0, hv = 0, c = 0, cv = 0
  const head: number[] = []
  const phone: number[] = []
  let peak = 0, peakT = 0, max = 0, settle = 0
  for (let i = 0; i < NS; i++) {
    g += (amp - g) * ease
    hv += (om * om * (g - h) - 2 * zeta * om * hv) * DT
    if (Math.abs(hv) > 240) hv = 240 * Math.sign(hv)
    h += hv * DT
    cv += (wc * wc * (h - c) - 2 * zc * wc * cv) * DT
    c += cv * DT
    head.push(h)
    phone.push(c)
    if (Math.abs(cv) > peak) { peak = Math.abs(cv); peakT = i * DT }
    if (c > max) max = c
    if (Math.abs(c - amp) > 0.02 * amp) settle = i * DT
  }
  return { head, phone, peak, peakT, overshoot: ((max - amp) / amp) * 100, settle, T }
}

const W = 700
const H = 230
const L = 44
const R = 16
const TOP = 16
const PHT = 170

export function HeadSpring() {
  const [amp, setAmp] = useState(60)
  const [zeta, setZeta] = useState(0.64)
  const s = useMemo(() => simulate(amp, zeta), [amp, zeta])
  const x = (i: number) => L + ((W - L - R) * i) / NS
  const y = (d: number) => TOP + PHT - (d / (amp * 1.15)) * PHT
  const line = (a: number[]) => a.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d).toFixed(1)}`).join(" ")
  const skew = F_PX * s.peak * DEG * 0.016
  const blur = (F_PX * s.peak * DEG) / 80

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>a head turn: two springs · src/walk.js</span>
        <span className="text-muted-foreground/60">re-implemented, 240 Hz</span>
      </div>
      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A ${amp} degree head turn with damping ${zeta}. The phone's yaw rate peaks at ${s.peak.toFixed(1)} degrees per second, ${Math.round(s.peakT * 1000)} milliseconds in, overshoots by ${s.overshoot.toFixed(1)} percent and settles within 2 percent after ${Math.round(s.settle * 1000)} milliseconds.`}
        >
          {[0, 0.5, 1].map((k) => (
            <g key={k}>
              <line x1={L} x2={W - R} y1={y(amp * k)} y2={y(amp * k)} stroke="currentColor" className="text-border" strokeWidth={k === 1 ? 1 : 0.5} strokeDasharray={k === 1 ? "4 3" : undefined} />
              <text x={L - 6} y={y(amp * k) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
                {Math.round(amp * k)}°
              </text>
            </g>
          ))}
          {[0, 0.5, 1, 1.5, 2, 2.5].map((t) => (
            <text key={t} x={x(t / DT)} y={H - 4} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
              {t} s
            </text>
          ))}
          <line x1={x(s.peakT / DT)} x2={x(s.peakT / DT)} y1={TOP} y2={TOP + PHT} stroke="oklch(0.66 0.15 40)" strokeDasharray="2 3" />
          <text x={x(s.peakT / DT) + 4} y={TOP + 10} fontSize={9} className="font-mono" fill="oklch(0.66 0.15 40)">
            fastest: {s.peak.toFixed(1)}°/s
          </text>
          <path d={line(s.head)} fill="none" stroke="oklch(0.6 0.04 255)" strokeWidth={1.4} strokeDasharray="5 3" />
          <path d={line(s.phone)} fill="none" stroke="oklch(0.62 0.16 255)" strokeWidth={2} />
          <g fontSize={10} className="font-mono">
            <text x={W - R - 150} y={y(amp * 0.3)} className="fill-muted-foreground">-- head</text>
            <text x={W - R - 150} y={y(amp * 0.3) + 14} fill="oklch(0.62 0.16 255)">— phone (what renders)</text>
          </g>
        </svg>
        <div className="mt-2 grid gap-3 font-mono text-xs text-muted-foreground sm:grid-cols-2">
          <label className="block">
            turn size: <span className="text-foreground">{amp}°</span>
            <input type="range" min={5} max={60} step={5} value={amp} onChange={(e) => setAmp(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground" aria-label="head turn size in degrees" />
          </label>
          <label className="block">
            damping ζ: <span className="text-foreground">{zeta.toFixed(2)}</span>
            <input type="range" min={0.64} max={0.78} step={0.02} value={zeta} onChange={(e) => setZeta(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground" aria-label="spring damping ratio" />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          {[
            ["spring period T", `${(s.T * 1000).toFixed(0)} ms`],
            ["overshoot", `${s.overshoot.toFixed(1)}%`],
            ["settles (2%)", `${Math.round(s.settle * 1000)} ms`],
            ["shear · smear at peak", `${skew.toFixed(1)} · ${blur.toFixed(1)} px`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-background/50 px-2.5 py-1.5">
              <div className="text-muted-foreground">{k}</div>
              <div className="text-foreground">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
