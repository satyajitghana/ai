"use client"

// Spherical-harmonic degree against file size and held-out quality, from my run on beast2's RTX 3090:
// gsplat 1.5.3, MCMC strategy, the same seed and iteration count for every run, trained on per-lens
// pinhole crops of FIORD MeetingRoom_In's fisheye originals, scored on whole held-out tripod positions.
// RUNS holds the printed RESULT lines verbatim (PSNR, SSIM, splat count, PLY bytes); nothing is fitted.
// Sizes: the standard float32 3DGS PLY, and the 32-byte .splat (colour only, no higher SH) for reference.
// SSR-safe: arithmetic only.

import { useState } from "react"

type Run = { tag: string; label: string; sh: number; splats: number; plyBytes: number; psnr: number; ssim: number }

export const RUNS: Run[] = []

const A = "oklch(0.62 0.15 200)"
const B = "oklch(0.66 0.16 40)"
const MUTED = "oklch(0.62 0.03 255)"

function mb(b: number) {
  return (b / 1e6).toFixed(1)
}

export function ShSweep() {
  const [sel, setSel] = useState(0)
  if (RUNS.length === 0) return null
  const r = RUNS[Math.min(sel, RUNS.length - 1)]
  const W = 640
  const H = 260
  const X0 = 64
  const X1 = 610
  const Y0 = 220
  const Y1 = 24
  const maxB = Math.max(...RUNS.map((x) => x.plyBytes)) * 1.08
  const ps = RUNS.map((x) => x.psnr)
  const lo = Math.floor(Math.min(...ps) - 0.5)
  const hi = Math.ceil(Math.max(...ps) + 0.5)
  const px = (b: number) => X0 + (b / maxB) * (X1 - X0)
  const py = (p: number) => Y0 - ((p - lo) / (hi - lo)) * (Y0 - Y1)
  const ticksY: number[] = []
  for (let v = lo; v <= hi; v += 1) ticksY.push(v)
  const ticksX: number[] = []
  for (let v = 0; v <= maxB; v += 50e6) ticksX.push(v)
  const line = RUNS.filter((x) => x.splats === RUNS[0].splats)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>SH degree vs PLY size vs held-out PSNR, one room</span>
        <span className="text-muted-foreground/60">measured, RTX 3090</span>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          {RUNS.map((x, i) => (
            <button
              key={x.tag}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              className={"rounded border px-2.5 py-0.5 " + (sel === i ? "text-background" : "bg-background/50 text-muted-foreground")}
              style={sel === i ? { background: x.splats === RUNS[0].splats ? A : B, borderColor: x.splats === RUNS[0].splats ? A : B } : undefined}
            >
              {x.label}
            </button>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Held-out PSNR against PLY size. ${RUNS.map((x) => `${x.label}: ${x.psnr.toFixed(2)} dB at ${mb(x.plyBytes)} MB`).join("; ")}.`}
        >
          {ticksY.map((v) => (
            <g key={v}>
              <line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke={MUTED} strokeOpacity={0.15} />
              <text x={X0 - 8} y={py(v) + 4} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">{v}</text>
            </g>
          ))}
          {ticksX.map((v) => (
            <text key={v} x={px(v)} y={Y0 + 16} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">{mb(v)}</text>
          ))}
          <text x={X1} y={Y0 + 32} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">PLY size, MB</text>
          <text x={X0 - 8} y={14} fontSize={10} textAnchor="start" className="fill-muted-foreground font-mono">PSNR, dB (held-out)</text>
          <polyline points={line.map((x) => `${px(x.plyBytes)},${py(x.psnr)}`).join(" ")} fill="none" stroke={A} strokeWidth={1.5} strokeOpacity={0.6} />
          {RUNS.map((x, i) => {
            const on = i === sel
            const col = x.splats === RUNS[0].splats ? A : B
            return (
              <g key={x.tag} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                <circle cx={px(x.plyBytes)} cy={py(x.psnr)} r={on ? 7 : 5} fill={col} fillOpacity={on ? 1 : 0.6} />
                <text x={px(x.plyBytes) + 9} y={py(x.psnr) - 8} fontSize={10} className="fill-foreground font-mono" fillOpacity={on ? 1 : 0.6}>
                  {x.label}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {r.label}: <span className="text-foreground">{r.splats.toLocaleString("en-US")}</span> splats,{" "}
          <span className="text-foreground">{mb(r.plyBytes)} MB</span> PLY ({(r.plyBytes / r.splats).toFixed(0)} B a splat),{" "}
          <span className="text-foreground">{r.psnr.toFixed(2)} dB</span> PSNR, SSIM <span className="text-foreground">{r.ssim.toFixed(3)}</span> on held-out
          positions. As a 32-byte .splat it would be {mb(r.splats * 32)} MB, colour only.
        </div>
      </div>
    </figure>
  )
}
