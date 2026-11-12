"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, mlog, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Two double-differenced carrier ambiguities, in cycles. The truth is an
// integer pair; the float filter's estimate is the truth plus the mean of k
// seeded noise draws from a long, thin, tilted covariance Q0, so after k epochs
// the float error has covariance Q0 / k. That shape is what makes GNSS
// ambiguities hard: early on the float solution is sharp across the ellipse and
// vague along it, and the integer it should snap to sits somewhere along that
// long axis.
//
// Three ways to pick an integer, as in the article:
//   rounding:         round each coordinate on its own,
//   integer least squares: minimise (a_hat - a)^T Q^-1 (a_hat - a) over the
//                     integer grid (brute force here; LAMBDA decorrelates first
//                     so its search is small, and finds the same minimiser),
//   ratio test:       accept the ILS answer only if the second-best integer's
//                     cost is at least `threshold` times the best's.
//
// The numbers are invented for the demo. The threshold default (3.0) is
// libgnss++'s ambiguity_ratio_threshold.

const TRUTH: [number, number] = [0, 0]
const SIG_MAJOR = 1.6 // cycles, one epoch, along the long axis
const SIG_MINOR = 0.11 // cycles, one epoch, across it
const TILT = (38 * Math.PI) / 180
const MAX_K = 80
const SEEDS = [11, 2026, 4242] as const

// Q0 = R diag(major^2, minor^2) R^T
const c0 = mcos(TILT)
const s0 = msin(TILT)
const Q0 = {
  a: SIG_MAJOR * SIG_MAJOR * c0 * c0 + SIG_MINOR * SIG_MINOR * s0 * s0,
  b: (SIG_MAJOR * SIG_MAJOR - SIG_MINOR * SIG_MINOR) * c0 * s0,
  c: SIG_MAJOR * SIG_MAJOR * s0 * s0 + SIG_MINOR * SIG_MINOR * c0 * c0,
}

function draws(seed: number): [number, number][] {
  let s = seed
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const gauss = () => Math.sqrt(-2 * mlog(Math.max(rand(), 1e-9))) * mcos(2 * Math.PI * rand())
  const out: [number, number][] = []
  for (let k = 0; k < MAX_K; k++) {
    const u = gauss() * SIG_MAJOR
    const v = gauss() * SIG_MINOR
    out.push([c0 * u - s0 * v, s0 * u + c0 * v])
  }
  return out
}

function floatAt(seed: number, k: number): [number, number] {
  const d = draws(seed)
  let x = 0
  let y = 0
  for (let i = 0; i < k; i++) {
    x += d[i][0]
    y += d[i][1]
  }
  return [TRUTH[0] + x / k, TRUTH[1] + y / k]
}

type Cand = { a: [number, number]; q: number }

function ils(ah: [number, number], k: number): Cand[] {
  // Q = Q0 / k, so Q^-1 = k * Q0^-1
  const det = Q0.a * Q0.c - Q0.b * Q0.b
  const ia = (k * Q0.c) / det
  const ib = (-k * Q0.b) / det
  const ic = (k * Q0.a) / det
  const cx = Math.round(ah[0])
  const cy = Math.round(ah[1])
  const out: Cand[] = []
  for (let i = cx - 6; i <= cx + 6; i++) {
    for (let j = cy - 6; j <= cy + 6; j++) {
      const dx = ah[0] - i
      const dy = ah[1] - j
      out.push({ a: [i, j], q: ia * dx * dx + 2 * ib * dx * dy + ic * dy * dy })
    }
  }
  out.sort((p, q) => p.q - q.q)
  return out.slice(0, 2)
}

const W = 360
const H = 360
const SPAN = 4 // cycles each side of the truth
const PX = W / (2 * SPAN)
const sx = (x: number) => W / 2 + (x - TRUTH[0]) * PX
const sy = (y: number) => H / 2 - (y - TRUTH[1]) * PX

const FLOAT = "oklch(0.62 0.17 250)"
const ROUND = "oklch(0.7 0.15 70)"
const FIX = "oklch(0.6 0.16 150)"
const BAD = "oklch(0.64 0.2 25)"

const same = (p: [number, number], q: [number, number]) => p[0] === q[0] && p[1] === q[1]

export function AmbiguityFix() {
  const [k, setK] = useState(4)
  const [seedIx, setSeedIx] = useState(0)
  const [thr, setThr] = useState(3)

  const ah = floatAt(SEEDS[seedIx], k)
  const rounded: [number, number] = [Math.round(ah[0]), Math.round(ah[1])]
  const [best, second] = ils(ah, k)
  const ratio = second.q / Math.max(best.q, 1e-12)
  const fixed = ratio >= thr
  const fixRight = same(best.a, TRUTH)
  const roundRight = same(rounded, TRUTH)

  // ellipse of Q0 / k at 1 and 3 sigma
  const maj = SIG_MAJOR / Math.sqrt(k)
  const min = SIG_MINOR / Math.sqrt(k)
  const ang = (-matan2(s0, c0) * 180) / Math.PI

  const grid: [number, number][] = []
  for (let i = -SPAN; i <= SPAN; i++) for (let j = -SPAN; j <= SPAN; j++) grid.push([i, j])

  const state = fixed ? (fixRight ? "FIXED, correct" : "FIXED, wrong integer") : "FLOAT (ratio too low)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>two DD ambiguities · float → integer · ratio test</span>
        <span className="tabular-nums" style={{ color: fixed ? (fixRight ? FIX : BAD) : undefined }}>
          {state}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Integer grid of two ambiguities with the float estimate after ${k} epochs. Rounding gives ${rounded.join(", ")}; integer least squares gives ${best.a.join(", ")} with ratio ${ratio.toFixed(2)}; the truth is 0, 0.`}
          className="w-full"
        >
          {grid.map(([i, j]) => (
            <circle key={`${i},${j}`} cx={sx(i)} cy={sy(j)} r="2" fill="var(--muted-foreground)" opacity="0.5" />
          ))}
          <text x={sx(0) + 8} y={sy(0) - 8} fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
            truth
          </text>
          <circle cx={sx(0)} cy={sy(0)} r="7" fill="none" stroke="var(--foreground)" strokeWidth="1" strokeDasharray="2 2" />

          {[3, 1].map((m) => (
            <ellipse
              key={m}
              cx={sx(ah[0]).toFixed(1)}
              cy={sy(ah[1]).toFixed(1)}
              rx={Math.max(m * maj * PX, 0.5).toFixed(1)}
              ry={Math.max(m * min * PX, 0.5).toFixed(1)}
              transform={`rotate(${ang.toFixed(1)} ${sx(ah[0]).toFixed(1)} ${sy(ah[1]).toFixed(1)})`}
              fill={FLOAT}
              fillOpacity={m === 1 ? 0.18 : 0.06}
              stroke={FLOAT}
              strokeOpacity="0.5"
            />
          ))}

          {/* second best */}
          <circle cx={sx(second.a[0])} cy={sy(second.a[1])} r="6" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" />
          {/* rounding */}
          <rect x={sx(rounded[0]) - 6} y={sy(rounded[1]) - 6} width="12" height="12" fill="none" stroke={ROUND} strokeWidth="2" />
          {/* ILS best */}
          <circle cx={sx(best.a[0])} cy={sy(best.a[1])} r="6" fill={fixed ? (fixRight ? FIX : BAD) : "none"} stroke={fixRight ? FIX : BAD} strokeWidth="2" />
          {/* float */}
          <circle cx={sx(ah[0]).toFixed(1)} cy={sy(ah[1]).toFixed(1)} r="3.5" fill={FLOAT} />
        </svg>

        <div className="flex flex-col gap-3 font-mono text-xs text-muted-foreground">
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 tabular-nums">
            <dt>float â</dt>
            <dd className="text-right text-foreground">
              {ah[0].toFixed(2)}, {ah[1].toFixed(2)}
            </dd>
            <dt style={{ color: ROUND }}>rounding</dt>
            <dd className="text-right text-foreground">
              {rounded[0]}, {rounded[1]} {roundRight ? "✓" : "✗"}
            </dd>
            <dt style={{ color: FIX }}>ILS best</dt>
            <dd className="text-right text-foreground">
              {best.a[0]}, {best.a[1]} {fixRight ? "✓" : "✗"}
            </dd>
            <dt>ILS second</dt>
            <dd className="text-right text-foreground">
              {second.a[0]}, {second.a[1]}
            </dd>
            <dt>cost best / second</dt>
            <dd className="text-right text-foreground">
              {best.q.toFixed(2)} / {second.q.toFixed(2)}
            </dd>
            <dt>ratio</dt>
            <dd className="text-right text-foreground">{ratio.toFixed(2)}</dd>
          </dl>
          <p className="leading-5">
            Rounding ignores the tilt of the ellipse. Integer least squares measures distance in the ellipse&apos;s own metric, so it
            often finds the truth while rounding still misses. The ratio test then asks whether the runner-up is clearly worse.
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>epochs of data</span>
            <span className="tabular-nums text-foreground">{k}</span>
          </div>
          <Range
            min={1}
            max={MAX_K}
            step={1}
            value={k}
            onChange={(e) => setK(parseInt(e.target.value, 10))}
            className="w-full cursor-pointer"
            aria-label="number of epochs averaged into the float solution"
            accent="var(--foreground)"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>ratio threshold</span>
            <span className="tabular-nums text-foreground">{thr.toFixed(1)}</span>
          </div>
          <Range
            min={1}
            max={5}
            step={0.1}
            value={thr}
            onChange={(e) => setThr(parseFloat(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="ratio test threshold"
            accent="var(--foreground)"
          />
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-xs sm:col-span-2">
          {SEEDS.map((s, i) => (
            <button
              key={s}
              type="button"
              aria-pressed={seedIx === i}
              onClick={() => setSeedIx(i)}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                seedIx === i ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              noise run {i + 1}
            </button>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        A toy with invented noise: the float estimate after k epochs is the truth plus the mean of k seeded draws from a
        covariance 1.6 cycles long and 0.11 cycles wide, tilted 38°. The blue ellipses are 1σ and 3σ, the amber square is
        rounding, the green or red disc is the integer least-squares answer, the grey ring the runner-up. The default
        threshold of 3.0 is the one libgnss++ ships.
      </figcaption>
    </figure>
  )
}
