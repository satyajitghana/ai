"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Tone to dots, from my own port of the stipple sampler in anidoodle's stipple.ts.
// MEASURED (my Python port, 540 px square, one lit sphere plus a gradient bar, 16,073 dots, 17 s):
//   [tone band centre, mean nearest-neighbour distance in px, the file's law 1.5 / tone^0.64, ink coverage of the band]
const ROWS: [number, number, number, number][] = [
  [0.075, 7.89, 7.26, 0.06],
  [0.15, 5.45, 4.93, 0.138],
  [0.25, 3.98, 3.62, 0.265],
  [0.35, 3.19, 2.92, 0.407],
  [0.45, 2.73, 2.49, 0.555],
  [0.55, 2.39, 2.2, 0.704],
  [0.65, 2.14, 1.97, 0.805],
  [0.75, 1.96, 1.8, 0.884],
  [0.85, 1.81, 1.66, 0.941],
  [0.95, 1.64, 1.52, 0.978],
]

function interp(t: number, col: 1 | 3): number {
  if (t <= ROWS[0][0]) return ROWS[0][col]
  for (let k = 1; k < ROWS.length; k++) {
    if (t <= ROWS[k][0]) {
      const x0 = ROWS[k - 1][0]
      const x1 = ROWS[k][0]
      const f = (t - x0) / (x1 - x0)
      return ROWS[k - 1][col] + (ROWS[k][col] - ROWS[k - 1][col]) * f
    }
  }
  return ROWS[ROWS.length - 1][col]
}

// A seeded generator (the same mulberry32 shape the repo and the vendored skill both use).
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PW = 64
const PH = 36
const SC = 7

export function DotDensity() {
  const [tone, setTone] = useState(0.45)
  const law = 1.5 / mpow(tone, 0.64)
  const nn = interp(tone, 1)
  const cov = interp(tone, 3)
  const pitch = nn / 0.93 // a jittered hex lattice whose mean nearest neighbour lands near the measured one
  const rowH = pitch * 0.866
  const r = rng(11)
  const dots: [number, number][] = []
  for (let j = 0; j * rowH < PH + pitch; j++) {
    for (let i = 0; i * pitch < PW + pitch; i++) {
      const x = i * pitch + (j % 2 ? pitch / 2 : 0) + (r() - 0.5) * pitch * 0.38
      const y = j * rowH + (r() - 0.5) * pitch * 0.38
      if (x >= 0 && x < PW && y >= 0 && y < PH) dots.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100])
    }
  }
  const per100 = 10000 / (pitch * pitch * 0.866)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <svg
        viewBox={`0 0 ${PW * SC} ${PH * SC}`}
        className="w-full rounded-md bg-white"
        role="img"
        aria-label={`A patch of pen dots at tone ${tone.toFixed(2)}`}
      >
        {dots.map(([x, y], i) => (
          <circle key={i} cx={Math.round(x * SC * 10) / 10} cy={Math.round(y * SC * 10) / 10} r={1.22 * SC * 0.5 + 0.2} fill="#111" />
        ))}
      </svg>
      <label className="mt-3 block text-sm">
        Tone (0 is paper, 1 is solid black): <b>{tone.toFixed(2)}</b>
        <Range min={0.05} max={0.98} step={0.01} value={tone} onChange={(e) => setTone(Number(e.target.value))} className="mt-1 w-full" />
      </label>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Spacing law, 1.5 / t^0.64</dt>
          <dd className="font-mono">{law.toFixed(2)} px</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Measured nearest neighbour</dt>
          <dd className="font-mono">{nn.toFixed(2)} px</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dots per 100 x 100 px</dt>
          <dd className="font-mono">{Math.round(per100)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Measured ink coverage</dt>
          <dd className="font-mono">{(cov * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        The two distances and the coverage are measured from my port of the sampler (16,073 dots). The dots drawn here are a jittered hex lattice at the measured
        spacing (pitch {pitch.toFixed(2)} px), an illustration of the density, not the Bridson output.
      </figcaption>
    </figure>
  )
}
