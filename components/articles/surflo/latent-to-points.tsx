"use client"

// One fixed-size latent, any number of output points.
//
// The whole point of Surflo is that three things people usually tie together
// come apart: the number of input views, the size of the latent, and the number
// of output points. The latent is always K=128 tokens of width D=512 — 65,536
// numbers — no matter how many views went in or how many points come out.
// Decoding is P independent, batched forward passes of a per-point velocity
// field, so the same latent yields a few thousand or a million oriented points.
//
// This widget holds the latent block fixed and lets you sweep the output count.
// The cloud densifies; the latent panel does not move. It is a generic surface
// (a sphere on a ground plane), drawn only to show density scaling from one
// state — Surflo reconstructs real scenes, not spheres. Every dot position is a
// deterministic function of its index, and every transcendental goes through
// lib/dmath, so SSR and the browser serialize the same SVG and there is no
// hydration mismatch. The slider is the house Range control.

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { macos, mcos, msin } from "@/lib/dmath"

const K = 128
const D = 512
const LATENT_NUMS = K * D // 65,536

type Stop = { p: number; label: string; dots: number }

// "a few thousand to a million", with the three counts the paper's Figure 5
// shows (8K, 32K, 128K) among them.
const STOPS: Stop[] = [
  { p: 2000, label: "2K", dots: 110 },
  { p: 8000, label: "8K", dots: 240 },
  { p: 32000, label: "32K", dots: 450 },
  { p: 128000, label: "128K", dots: 760 },
  { p: 512000, label: "512K", dots: 1120 },
  { p: 1000000, label: "1M", dots: 1500 },
]

const N_MAX = 1500

// cloud panel geometry
const VW = 360
const VH = 300
const CX = 184
const CY_TOP = 118
const R = 70
const GROUND_Y = 206
const GRX = 132
const GRY = 32

const ACCENT = "oklch(0.58 0.15 250)"
const GROUND = "oklch(0.6 0.08 60)"

const frac = (x: number) => x - Math.floor(x)

type Dot = { x: number; y: number; r: number; op: number; sphere: boolean; prio: number }

function buildPool(): Dot[] {
  const dots: Dot[] = []
  for (let i = 0; i < N_MAX; i++) {
    const prio = frac(i * 0.6180339887498949) // low-discrepancy reveal order
    const sphere = i % 5 < 3 // ~60% on the object, ~40% on the ground
    if (sphere) {
      const u = frac(i * 0.7548776662466927)
      const v = frac(i * 0.5698402909980532)
      const theta = macos(1 - 2 * u) // polar angle, 0..pi
      const phi = 2 * Math.PI * v
      const st = msin(theta)
      const X = R * st * mcos(phi)
      const Z = R * st * msin(phi) // depth, -R (back) .. +R (front)
      const Y = R * mcos(theta)
      const front = (Z + R) / (2 * R) // 0 back .. 1 front
      dots.push({
        x: CX + X,
        y: CY_TOP - Y,
        r: 0.7 + 0.7 * front,
        op: 0.32 + 0.5 * front,
        sphere: true,
        prio,
      })
    } else {
      const a = frac(i * 0.7548776662466927 + 0.37)
      const b = frac(i * 0.5698402909980532 + 0.19)
      const rr = Math.sqrt(a) // uniform over the disc; sqrt is exact per IEEE-754
      const ang = 2 * Math.PI * b
      dots.push({
        x: CX + rr * GRX * mcos(ang),
        y: GROUND_Y + rr * GRY * msin(ang),
        r: 0.8,
        op: 0.3 + 0.28 * rr,
        sphere: false,
        prio,
      })
    }
  }
  return dots
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`
  if (n >= 1000) return `${n / 1000}K`
  return `${n}`
}

export function LatentToPoints() {
  const [idx, setIdx] = useState(3) // default 128K, Surflo's default is ~100K
  const stop = STOPS[idx]
  const pool = useMemo(() => buildPool(), [])
  const revealFrac = stop.dots / N_MAX
  const shown = pool.filter((d) => d.prio < revealFrac)
  const shownCount = shown.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one global state, decoded at any resolution</span>
        <span className="text-muted-foreground/60">P = {fmt(stop.p)} points</span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[150px_1fr] sm:p-5">
        {/* fixed latent block — never changes size */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="font-mono text-[10px] text-muted-foreground">the latent z</div>
          <svg viewBox="0 0 96 120" className="w-[88px]" role="img" aria-label="A fixed grid of 128 by 512 latent tokens that does not change as the output point count changes.">
            {Array.from({ length: 8 }).map((_, r) =>
              Array.from({ length: 6 }).map((_, c) => (
                <rect
                  key={`${r}-${c}`}
                  x={6 + c * 14}
                  y={6 + r * 14}
                  width={11}
                  height={11}
                  rx={2}
                  fill={ACCENT}
                  opacity={0.22 + 0.06 * ((r + c) % 4)}
                />
              ))
            )}
          </svg>
          <div className="text-center font-mono text-[10px] leading-tight text-foreground">
            K = {K} × D = {D}
          </div>
          <div className="text-center font-mono text-[10px] leading-tight text-muted-foreground">
            {LATENT_NUMS.toLocaleString("en-US")} numbers
          </div>
          <div className="text-center font-mono text-[9px] leading-tight text-muted-foreground/70">
            fixed — independent of views in and points out
          </div>
        </div>

        {/* the decoded cloud — densifies with the slider */}
        <div className="rounded-lg border bg-background/40">
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="w-full"
            role="img"
            aria-label={`A point cloud of a generic surface — a sphere on a ground plane — decoded from the latent. At ${fmt(stop.p)} points it is drawn with about ${shownCount} sample dots; increasing the point count densifies the same surface without changing the latent.`}
          >
            <ellipse cx={CX} cy={GROUND_Y} rx={GRX} ry={GRY} fill="currentColor" className="text-muted" opacity={0.12} />
            {shown.map((d, i) => (
              <circle
                key={i}
                cx={d.x.toFixed(2)}
                cy={d.y.toFixed(2)}
                r={d.r.toFixed(2)}
                fill={d.sphere ? ACCENT : GROUND}
                opacity={d.op.toFixed(2)}
              />
            ))}
            <text x={10} y={VH - 10} className="fill-muted-foreground font-mono" fontSize={9}>
              showing ~{shownCount} of {fmt(stop.p)} oriented points · one decoder pass per point
            </text>
          </svg>
        </div>
      </div>

      <div className="px-4 pb-2 sm:px-5">
        <Range
          min={0}
          max={STOPS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.currentTarget.value))}
          accent={ACCENT}
          aria-label="Output point count"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          {STOPS.map((s, i) => (
            <span key={s.label} className={i === idx ? "text-foreground" : ""}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        The latent is {K} tokens of width {D} — {LATENT_NUMS.toLocaleString("en-US")}{" "}
        numbers — whatever you set the output to. Decoding {fmt(stop.p)} points is{" "}
        {fmt(stop.p)} independent, batched forward passes of the per-point velocity
        field. Illustrative surface; Surflo reconstructs real scenes.
      </figcaption>
    </figure>
  )
}
