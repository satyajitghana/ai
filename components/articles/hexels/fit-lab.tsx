"use client"

// Optimised 2D primitives on three 48 x 48 synthetic images (public/articles/hexels/code/primitives.py):
// N primitives, Adam, 200 steps, the same hyperparameters for every kind, dense normalised blend
//   c(x) = sum_i w_i c_i(x) / (sum_i w_i + 1e-4).
// Kinds: Gaussian (const / linear colour), hexagon (paper Eq. 22-24; const / linear colour) and two controls that
// keep the hexagon's sigmoid edge (fixed beta = 10, constant colour) but use a round or a square support, so edge
// sharpness and shape can be told apart. Linear colour is c0 + u g_u + v g_v in local coordinates (paper Eq. 4).
// MEASURED; mean over the seeds present, bars are one standard deviation. A toy: not top-K, 200 steps, small images.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

import { FITS, type FitPt } from "./data"

const IMAGES = ["poster", "shaded", "texture"] as const
const KINDS = [
  { id: "g_const", label: "Gaussian, constant colour", color: "#5b8def", dash: undefined, params: 8 },
  { id: "g_lin", label: "Gaussian, linear colour", color: "#5b8def", dash: "5 3", params: 14 },
  { id: "d_const", label: "Round, sharp edge (control)", color: "#8a8f98", dash: "1.5 3", params: 8 },
  { id: "s_const", label: "Square, sharp edge (control)", color: "#43b97f", dash: "1.5 3", params: 8 },
  { id: "h_const", label: "Hexagon, constant colour", color: "#e0a02f", dash: undefined, params: 8 },
  { id: "h_lin", label: "Hexel, linear colour", color: "#e2605a", dash: "5 3", params: 15 },
] as const
const W = 380
const H = 210
const PAD = { l: 34, r: 8, t: 10, b: 28 }

export function FitLab() {
  const [image, setImage] = useState<(typeof IMAGES)[number]>("shaded")
  const [xAxis, setXAxis] = useState<"n" | "params">("n")
  const [on, setOn] = useState<Record<string, boolean>>({ g_const: true, g_lin: true, d_const: true, s_const: true, h_const: true, h_lin: true })
  const [pickN, setPickN] = useState(64)

  const series = KINDS.filter((k) => on[k.id]).map((k) => ({ k, pts: (FITS[image][k.id] ?? []) as FitPt[] })).filter((s) => s.pts.length > 0)
  const xi = xAxis === "n" ? 0 : 1
  const all = series.flatMap((s) => s.pts)
  const allAll = KINDS.flatMap((k) => (FITS[image][k.id] ?? []) as FitPt[])
  const xs = allAll.map((p) => mlog10(p[xi]))
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const ys = allAll.map((p) => p[2])
  const y0 = Math.floor(Math.min(...ys) - 0.5)
  const y1 = Math.ceil(Math.max(...ys) + 0.5)
  const X = (v: number) => PAD.l + ((mlog10(v) - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
  const Y = (v: number) => PAD.t + ((y1 - v) / (y1 - y0)) * (H - PAD.t - PAD.b)
  const ticks = xAxis === "n" ? [8, 16, 32, 64] : [64, 128, 256, 512, 1024]
  const yTicks = Array.from({ length: Math.floor((y1 - y0) / 2) + 1 }, (_, i) => y0 + i * 2)
  const seeds = all.length > 0 ? Math.min(...all.map((p) => p[4])) : 0

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4" role="group" aria-label="Measured: PSNR of optimised Gaussian, hexagon, round and square primitives against primitive count or stored scalars">
      <div className="flex flex-wrap gap-2 text-sm">
        {IMAGES.map((i) => (
          <button key={i} type="button" onClick={() => setImage(i)} aria-pressed={image === i} className={`rounded-md border px-2.5 py-1 ${image === i ? "border-primary bg-primary/10" : "border-border"}`}>
            {i}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {(["n", "params"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setXAxis(v)} aria-pressed={xAxis === v} className={`rounded-md border px-2.5 py-1 ${xAxis === v ? "border-primary bg-primary/10" : "border-border"}`}>
            x: {v === "n" ? "primitives" : "stored scalars"}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`PSNR against ${xAxis === "n" ? "primitive count" : "stored scalars"} on the ${image} image`}>
        {yTicks.map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
            <text x={PAD.l - 4} y={Y(g) + 3} textAnchor="end" className="fill-current text-[8px]">
              {g}
            </text>
          </g>
        ))}
        {ticks.map((g) => (
          <text key={g} x={X(g)} y={H - 12} textAnchor="middle" className="fill-current text-[8px]">
            {g}
          </text>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 1} textAnchor="middle" className="fill-current text-[8px]">
          {xAxis === "n" ? "primitives (log scale)" : "stored scalars (log scale)"}
        </text>
        {series.map((s) => (
          <g key={s.k.id}>
            <polyline fill="none" stroke={s.k.color} strokeWidth="1.6" strokeDasharray={s.k.dash} points={s.pts.map((p) => `${X(p[xi]).toFixed(1)},${Y(p[2]).toFixed(1)}`).join(" ")} />
            {s.pts.map((p) => (
              <g key={p[0]}>
                {p[3] > 0 ? <line x1={X(p[xi])} x2={X(p[xi])} y1={Y(p[2] - p[3])} y2={Y(p[2] + p[3])} stroke={s.k.color} strokeWidth="1" opacity="0.7" /> : null}
                <circle cx={X(p[xi])} cy={Y(p[2])} r="2" fill={s.k.color} />
              </g>
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {KINDS.map((k) => (
          <label key={k.id} className="inline-flex cursor-pointer items-center gap-1">
            <input type="checkbox" checked={on[k.id]} onChange={(e) => setOn({ ...on, [k.id]: e.target.checked })} />
            <span className="inline-block h-0.5 w-5" style={{ background: k.color }} />
            {k.label}
          </label>
        ))}
      </div>
      <div className="mt-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span>Table at</span>
          {[8, 16, 32, 64].map((n) => (
            <button key={n} type="button" onClick={() => setPickN(n)} aria-pressed={pickN === n} className={`rounded-md border px-2 py-0.5 font-mono text-xs ${pickN === n ? "border-primary bg-primary/10" : "border-border"}`}>
              {n} primitives
            </button>
          ))}
        </div>
        <table className="mt-2 w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">primitive</th>
              <th className="py-1 text-right font-normal">scalars</th>
              <th className="py-1 text-right font-normal">PSNR (dB)</th>
              <th className="py-1 text-right font-normal">seeds</th>
            </tr>
          </thead>
          <tbody>
            {KINDS.map((k) => {
              const p = ((FITS[image][k.id] ?? []) as FitPt[]).find((q) => q[0] === pickN)
              return (
                <tr key={k.id} className="border-t border-border">
                  <td className="py-1">{k.label}</td>
                  <td className="py-1 text-right font-mono">{k.params * pickN}</td>
                  <td className="py-1 text-right font-mono">{p ? `${p[2].toFixed(2)} ± ${p[3].toFixed(2)}` : "not run"}</td>
                  <td className="py-1 text-right font-mono">{p ? p[4] : "-"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Measured, 48 × 48 synthetic images, 200 Adam steps, identical hyperparameters for every kind, up to {seeds || 0} seed(s) shown per point (fewest across the visible lines). Absolute PSNR is low because 200 steps do not
        converge; read the gaps between kinds at the same budget, not the levels. The two controls keep the hexagon&apos;s sharp sigmoid edge and change only the support&apos;s shape.
      </figcaption>
    </figure>
  )
}
