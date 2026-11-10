"use client"

import { useState } from "react"

import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// An indirect time-of-flight pixel recovers depth from the phase of the
// returning modulation: d = c * phi / (4 * pi * f). Phase lives on a circle,
// so any depth past c / 2f folds back. VisionSIM's decoder for the sinusoidal
// codes (visionsim/emulate/itof/decoding.py, decode_sinusoid) does exactly
// this: a least-squares fit of the taps onto [1, cos, sin], atan2, mod 2 pi.
//
// The noise panel is measured with my own NumPy re-implementation of the
// 3-tap deltaSin pipeline at 20 MHz, albedo 0.5, plus Poisson shot noise I
// added (VisionSIM 0.2.0's simulate_measurements has none): 4,000 pixels per
// depth, RMS depth error in cm. Ambient is in units of the active light power.

const C = 299792458

const DEPTHS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]
const RMSE: { amb: string; v: number[] }[] = [
  { amb: "0", v: [2.01, 5.19, 7.66, 8.02, 7.88, 12.25, 17.87, 20.74, 18.68, 16.38, 23.81, 29.66, 31.88, 62.08] },
  { amb: "0.05", v: [2.0, 5.2, 8.07, 8.88, 9.9, 15.17, 21.13, 25.32, 27.86, 32.0, 41.44, 54.45, 112.68, 271.68] },
  { amb: "0.2", v: [2.07, 5.64, 8.91, 11.48, 15.02, 21.55, 30.68, 39.2, 51.22, 65.59, 93.08, 133.13, 224.71, 351.13] },
  { amb: "1", v: [2.29, 6.78, 12.45, 19.9, 29.91, 46.14, 65.24, 90.76, 113.4, 140.68, 184.62, 230.85, 302.53, 377.69] },
]

export function PhaseWrap() {
  const [fMHz, setF] = useState(35)
  const [d, setD] = useState(6)
  const [ai, setAi] = useState(2)
  const f = fMHz * 1e6
  const ur = C / (2 * f)
  const decoded = d % ur
  const phase = (2 * Math.PI * decoded) / ur

  // sawtooth: decoded vs true depth, 0..10 m
  const W = 640
  const L = 46
  const R = 400
  const T = 18
  const B = 196
  const X = (m: number) => L + (m / 10) * (R - L)
  const Y = (m: number) => B - (Math.min(m, 10) / 10) * (B - T)
  const pts: string[] = []
  for (let i = 0; i <= 400; i++) {
    const m = (i / 400) * 10
    const prev = i ? ((i - 1) / 400) * 10 : 0
    const jump = i > 0 && m % ur < prev % ur
    pts.push(`${jump ? "M" : i ? "L" : "M"}${X(m).toFixed(1)},${Y(m % ur).toFixed(1)}`)
  }

  // phase dial
  const cx = 520
  const cy = 108
  const r = 62
  const px = cx + r * mcos(phase - Math.PI / 2)
  const py = cy + r * msin(phase - Math.PI / 2)

  // noise panel
  const NW = 640
  const NL = 46
  const NR = 620
  const NT = 14
  const NB = 150
  const NX = (m: number) => NL + ((m - 0.5) / 6.5) * (NR - NL)
  const NY = (cm: number) => NB - (Math.min(cm, 100) / 100) * (NB - NT)
  const row = RMSE[ai]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>indirect time-of-flight · phase wrapping and ambient light</span>
        <span className="text-muted-foreground/60">top: arithmetic · bottom: measured</span>
      </div>
      <div className="grid gap-3 px-4 pt-4 font-mono text-[11px] sm:grid-cols-2">
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">modulation {fMHz} MHz</span>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={fMHz}
            onChange={(e) => setF(Number(e.target.value))}
            className="w-full"
            aria-label="Modulation frequency in megahertz"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">true depth {d.toFixed(1)} m</span>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.1}
            value={d}
            onChange={(e) => setD(Number(e.target.value))}
            className="w-full"
            aria-label="True depth in metres"
          />
        </label>
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} 222`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={`At ${fMHz} megahertz the unambiguous range is ${ur.toFixed(2)} metres; a surface at ${d.toFixed(1)} metres decodes to ${decoded.toFixed(2)} metres.`}
        >
          <line x1={L} x2={R} y1={B} y2={B} className="stroke-border" />
          <line x1={L} x2={L} y1={T} y2={B} className="stroke-border" />
          <line x1={X(0)} y1={Y(0)} x2={X(10)} y2={Y(10)} className="stroke-muted-foreground" strokeDasharray="3 3" strokeOpacity={0.5} />
          <path d={pts.join(" ")} fill="none" stroke="oklch(0.62 0.15 255)" strokeWidth={2} />
          <circle cx={X(d)} cy={Y(decoded)} r={4.5} fill="oklch(0.65 0.18 30)" />
          {[0, 2, 4, 6, 8, 10].map((m) => (
            <g key={m}>
              <text x={X(m)} y={B + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {m}
              </text>
              <text x={L - 6} y={Y(m) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {m}
              </text>
            </g>
          ))}
          <text x={(L + R) / 2} y={B + 26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            true depth (m) · dashed: what you wanted
          </text>
          <text x={L} y={T - 6} className="fill-muted-foreground font-mono" fontSize={9}>
            decoded depth (m)
          </text>

          <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-border" strokeWidth={1.5} />
          <line x1={cx} y1={cy} x2={px} y2={py} stroke="oklch(0.65 0.18 30)" strokeWidth={2.5} />
          <circle cx={cx} cy={cy - r} r={3} className="fill-muted-foreground" />
          <text x={cx} y={cy - r - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            0 = {ur.toFixed(2)} m
          </text>
          <text x={cx} y={cy + r + 18} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
            phase {phase.toFixed(2)} rad
          </text>
          <text x={cx} y={cy + r + 32} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
            reads {decoded.toFixed(2)} m {d >= ur ? `(wrapped ${Math.floor(d / ur)}x)` : ""}
          </text>
        </svg>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">ambient / active power</span>
          {RMSE.map((x, i) => (
            <button
              key={x.amb}
              type="button"
              onClick={() => setAi(i)}
              aria-pressed={ai === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                ai === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.amb}
            </button>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${NW} 176`}
          className="mt-2 w-full min-w-[520px]"
          role="img"
          aria-label={`RMS depth error at 20 megahertz with shot noise, ambient ${row.amb}: ${DEPTHS.map((m, i) => `${m} m ${row.v[i]} cm`).join(", ")}.`}
        >
          {[0, 25, 50, 75, 100].map((cm) => (
            <g key={cm}>
              <line x1={NL} x2={NR} y1={NY(cm)} y2={NY(cm)} className="stroke-border" strokeWidth={0.6} />
              <text x={NL - 6} y={NY(cm) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {cm}
              </text>
            </g>
          ))}
          {RMSE.map((x, i) =>
            i === ai ? null : (
              <path
                key={x.amb}
                d={x.v.map((v, j) => `${j ? "L" : "M"}${NX(DEPTHS[j]).toFixed(1)},${NY(v).toFixed(1)}`).join(" ")}
                fill="none"
                className="stroke-muted-foreground"
                strokeOpacity={0.25}
              />
            ),
          )}
          <path
            d={row.v.map((v, j) => `${j ? "L" : "M"}${NX(DEPTHS[j]).toFixed(1)},${NY(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke="oklch(0.65 0.18 30)"
            strokeWidth={2}
          />
          {row.v.map((v, j) => (
            <circle key={DEPTHS[j]} cx={NX(DEPTHS[j])} cy={NY(v)} r={2.5} fill="oklch(0.65 0.18 30)" />
          ))}
          {[1, 2, 3, 4, 5, 6, 7].map((m) => (
            <text key={m} x={NX(m)} y={NB + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {m} m
            </text>
          ))}
          <text x={NL} y={NT - 4} className="fill-muted-foreground font-mono" fontSize={9}>
            RMS depth error (cm, clipped at 100) · 20 MHz, unambiguous to 7.49 m
          </text>
        </svg>
      </div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Top: the wrap is arithmetic, and matches VisionSIM&apos;s decoder. Bottom: measured with my port plus
        Poisson shot noise that I added. Without noise, ambient light is a constant offset that the decoder&apos;s
        least-squares fit removes exactly, so in VisionSIM 0.2.0 as shipped it changes no depth at all.
      </figcaption>
    </figure>
  )
}
