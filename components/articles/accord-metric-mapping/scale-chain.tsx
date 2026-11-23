"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Where Accord's metres come from, on one wall seen by six images in three keyframe windows.
//
// Each image puts the wall at (true depth) x exp(log-scale error). The error of image i in window j is
// built up the way the paper describes it (Sec. 3, 4.1, 4.2, App. A):
//
//   after DA3 + the similarity to the filter's cameras   u_j + e_i      (window scale still off)
//   + metric anchor o_j                                   f + e_i        (the window now carries the filter's scale f)
//   + agreement between views (one c_i per image)         f + mean(e)    (the spread goes; the group mean is kept)
//
// f is the filter's own scale error (a slider). The per-image e_i and per-window u_j are fixed,
// deterministic draws of a few percent and ~10 %, so the picture is illustrative, not measured.

type Stage = "raw" | "anchor" | "agree"

const N_WIN = 3
const PER_WIN = 2
const N_IMG = N_WIN * PER_WIN
const PTS = 22
const COLORS = ["#c8501e", "#2563eb", "#0f766e"] // one colour per window

// deterministic draws
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s + 0.5) / 4294967296
  }
}
const gauss = (u: () => number) => Math.sqrt(-2 * mlog(u())) * mcos(2 * Math.PI * u())

const rnd = lcg(20261236)
const U_WIN = Array.from({ length: N_WIN }, () => 0.1 * gauss(rnd)) // window scale left after the similarity
const E_RAW = Array.from({ length: N_IMG }, () => 0.02 * gauss(rnd)) // per-image error, a few percent
const NOISE = Array.from({ length: N_IMG * PTS }, () => 0.004 * gauss(rnd)) // 4 mm of depth noise

export function ScaleChain() {
  const [stage, setStage] = useState<Stage>("raw")
  const [fPct, setFPct] = useState(-0.4) // the paper measures -0.4 % on the EuRoC rooms, -1.3 % on ORI
  const [depth, setDepth] = useState(3)

  const meanE = E_RAW.reduce((a, b) => a + b, 0) / N_IMG
  const f = fPct / 100

  const logErr = useMemo(
    () =>
      Array.from({ length: N_IMG }, (_, i) => {
        const j = Math.floor(i / PER_WIN)
        if (stage === "raw") return U_WIN[j] + E_RAW[i]
        if (stage === "anchor") return f + E_RAW[i]
        return f + meanE
      }),
    [stage, f, meanE],
  )

  // geometry: wall along x in [0, 6] m at y = depth; image i sees x in [i*0.9, i*0.9 + 1.5]
  const placed = useMemo(
    () =>
      Array.from({ length: N_IMG }, (_, i) => {
        const x0 = i * 0.9
        return Array.from({ length: PTS }, (_, k) => {
          const x = x0 + (1.5 * k) / (PTS - 1)
          const y = depth * mexp(logErr[i]) + NOISE[i * PTS + k]
          return [x, y] as [number, number]
        })
      }),
    [logErr, depth],
  )

  const ys = placed.flat().map((p) => p[1])
  const spread = Math.max(...ys) - Math.min(...ys)
  const within = ys.filter((y) => Math.abs(y - depth) <= 0.05).length / ys.length
  const meanOff = ys.reduce((a, b) => a + b, 0) / ys.length - depth

  // drawing: a band of +-40 cm around the true wall, exaggerated vertically
  const W = 640
  const H = 220
  const PAD = 30
  const X = (x: number) => PAD + ((W - 2 * PAD) * x) / 5.9
  const band = 0.4
  const Y = (y: number) => H / 2 - ((y - depth) / band) * (H / 2 - 24)
  const clampY = (y: number) => Math.max(12, Math.min(H - 12, Y(y)))

  const stages: [Stage, string][] = [
    ["raw", "depth model + window fit"],
    ["anchor", "+ metric anchor"],
    ["agree", "+ agreement"],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">one wall, six images, three windows</span>
        <div className="flex flex-wrap gap-1">
          {stages.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStage(k)}
              aria-pressed={stage === k}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                stage === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Six images each draw the same wall; their copies sit at different distances until the anchor and the agreement between views bring them onto one line."
          className="w-full rounded-md border bg-muted/20"
        >
          <rect x={PAD} y={Y(depth + 0.05)} width={W - 2 * PAD} height={Y(depth - 0.05) - Y(depth + 0.05)} fill="var(--muted-foreground)" opacity="0.12" />
          <line x1={PAD} x2={W - PAD} y1={Y(depth)} y2={Y(depth)} stroke="var(--muted-foreground)" strokeDasharray="4 4" opacity="0.7" />
          <text x={W - PAD} y={Y(depth + 0.05) - 4} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
            true wall, ±5 cm band
          </text>
          {placed.map((pts, i) =>
            pts.map((p, k) => (
              <circle
                key={`${i}-${k}`}
                cx={X(p[0]).toFixed(1)}
                cy={clampY(p[1]).toFixed(1)}
                r="2.3"
                fill={COLORS[Math.floor(i / PER_WIN)]}
                opacity={Y(p[1]) < 12 || Y(p[1]) > H - 12 ? 0.35 : 0.85}
              />
            )),
          )}
          {Array.from({ length: N_WIN }, (_, j) => (
            <text key={j} x={X(j * 1.8 + 1.2)} y={H - 4} textAnchor="middle" fontSize="10" className="font-mono" fill={COLORS[j]}>
              window {j + 1}
            </text>
          ))}
          <text x={8} y={14} fontSize="10" className="fill-muted-foreground font-mono">
            ±{band * 100} cm shown · illustrative errors
          </text>
        </svg>

        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">layers span </span>
            {(spread * 100).toFixed(1)} cm
          </div>
          <div>
            <span className="text-muted-foreground">points within 5 cm </span>
            {(within * 100).toFixed(0)}%
          </div>
          <div>
            <span className="text-muted-foreground">mean offset </span>
            {meanOff >= 0 ? "+" : ""}
            {(meanOff * 100).toFixed(1)} cm
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-mono text-xs">
            <span>filter scale error f = {fPct.toFixed(1)}%</span>
            <Range min={-3} max={3} step={0.1} value={fPct} onChange={(e) => setFPct(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span>wall distance {depth.toFixed(1)} m</span>
            <Range min={1} max={8} step={0.5} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
          </label>
        </div>
        <figcaption className="mt-3 text-xs text-muted-foreground">
          Each image draws the wall at its depth times its scale error. The window fit leaves each window&apos;s scale off;
          the anchor gives every window the filter&apos;s scale but keeps a few percent per image; the agreement between views
          removes the spread and keeps the group&apos;s mean. Move f: no stage can see it, because every stage borrows its
          metres from the filter. Errors are illustrative draws, not measurements.
        </figcaption>
      </div>
    </figure>
  )
}
