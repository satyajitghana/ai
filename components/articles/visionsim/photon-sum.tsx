"use client"

import { useMemo, useState } from "react"

import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// VisionSIM's passive single-photon camera (visionsim/emulate/spc.py) is one
// line: each pixel of each binary frame is a Bernoulli draw with
// p = 1 - exp(-flux * factor), and the inverse is -log(1 - mean) / factor.
// The strip below runs that model in the browser with a seeded generator, so
// it is the same on the server and the client. The error table is my measured
// run of the same model in NumPy: 2,000 pixels per flux level, median
// absolute error of the inverted estimate relative to the true flux.

const FLUX = [0.01, 0.1, 0.5, 1, 2, 4, 8]
const NS = [1, 8, 64, 512, 4096] as const
const ERR: Record<(typeof NS)[number], number[]> = {
  1: [1.0, 1.0, 1.0, 12.816, 5.908, 2.454, 0.727],
  8: [1.0, 1.0, 0.386, 0.386, 0.307, 2.454, 0.727],
  64: [1.0, 0.335, 0.151, 0.114, 0.106, 0.134, 0.727],
  512: [0.377, 0.093, 0.047, 0.04, 0.04, 0.062, 0.727],
  4096: [0.105, 0.034, 0.017, 0.014, 0.013, 0.019, 0.047],
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COLS = 64
const ROWS = 10
const MAXF = 6

export function PhotonSum() {
  const [ni, setNi] = useState(1)
  const n = NS[ni]

  const cells = useMemo(() => {
    const rnd = mulberry32(7)
    const out: { x: number; y: number; v: number }[] = []
    for (let c = 0; c < COLS; c++) {
      // flux rises left to right, from nearly dark to six photons per frame
      const flux = (MAXF * (c + 0.5)) / COLS
      const p = 1 - mexp(-flux)
      for (let r = 0; r < ROWS; r++) {
        let k = 0
        for (let i = 0; i < n; i++) if (rnd() < p) k++
        const mean = k / n
        const est = -mlog(Math.max(1 - mean, 1e-6))
        out.push({ x: c, y: r, v: Math.min(est / MAXF, 1) })
      }
    }
    return out
  }, [n])

  const W = 640
  const CW = 9
  const L = 24
  const STRIP_Y = 40
  const CH = 9

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>single-photon camera · sum N binary frames, invert</span>
        <span className="text-muted-foreground/60">strip: live model · table: measured</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        <span className="mr-1 font-mono text-[10px] text-muted-foreground">frames summed</span>
        {NS.map((v, i) => (
          <button
            key={v}
            type="button"
            onClick={() => setNi(i)}
            aria-pressed={ni === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              ni === i
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {v.toLocaleString("en-US")}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} 150`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={`A brightness ramp from 0 to 6 photons per frame, reconstructed from ${n} binary single-photon frames.`}
        >
          <text x={L} y={16} className="fill-muted-foreground font-mono" fontSize={10}>
            reconstructed ramp, flux 0 to 6 photons per pixel per frame
          </text>
          <text x={L} y={30} className="fill-muted-foreground font-mono" fontSize={9}>
            {n === 1 ? "one frame is one bit per pixel: each pixel is black or white" : `mean of ${n.toLocaleString("en-US")} bits, then -log(1 - mean)`}
          </text>
          {cells.map((c) => {
            const g = Math.round(c.v * 235 + 10)
            return (
              <rect
                key={`${c.x}-${c.y}`}
                x={L + c.x * CW}
                y={STRIP_Y + c.y * CH}
                width={CW}
                height={CH}
                fill={`rgb(${g},${g},${g})`}
              />
            )
          })}
          {[0, 1, 2, 3, 4, 5, 6].map((f) => (
            <text
              key={f}
              x={L + (f / MAXF) * COLS * CW}
              y={STRIP_Y + ROWS * CH + 14}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              {f}
            </text>
          ))}
          <text x={L + COLS * CW + 14} y={STRIP_Y + 30} className="fill-muted-foreground font-mono" fontSize={9}>
            p = 1 - e^-flux
          </text>
          <text x={L + COLS * CW + 14} y={STRIP_Y + 44} className="fill-muted-foreground font-mono" fontSize={9}>
            at 6: p = {(1 - mexp(-6)).toFixed(4)}
          </text>
        </svg>

        <table className="mt-3 w-full min-w-[520px] font-mono text-[11px]">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 text-left font-normal">flux</th>
              {FLUX.map((f) => (
                <th key={f} className="py-1 text-right font-normal">
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 text-muted-foreground">p(detect)</td>
              {FLUX.map((f) => (
                <td key={f} className="py-1 text-right text-muted-foreground">
                  {(1 - mexp(-f)).toFixed(3)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1">error, N = {n.toLocaleString("en-US")}</td>
              {ERR[n].map((e, i) => (
                <td key={FLUX[i]} className={cn("py-1 text-right", e <= 0.05 ? "text-foreground" : "text-muted-foreground")}>
                  {e >= 1 ? `${Math.round(e * 100)}%` : `${(e * 100).toFixed(1)}%`}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        The strip is the Bernoulli model drawn in your browser. The error row is measured: median relative error of
        the inverted flux over 2,000 pixels per level. Dark pixels need many frames to see a photon at all; bright
        ones saturate, because a pixel that fired in every frame inverts to the clamp, not to its flux.
      </figcaption>
    </figure>
  )
}
