"use client"

import { useMemo, useState } from "react"

import { mcos, mlog, msin } from "@/lib/dmath"

// Why the smear needs good poses and per-frame depth alignment. A top-down toy, NOT the 3D run:
// one landmark at range r, seen in 30 frames. Each frame's pose has a yaw error drawn from N(0, sigma),
// each frame's depth a scale error drawn from N(0, drift) unless it is aligned per frame.
// A point is placed at  r (1 + s) (sin e, cos e)  instead of (0, r).
// The measured rows come from my numpy run (150 frames, deer at a median 9.21 m, noise on all three axes).

const N = 30
const MEASURED: { sigma: number; rms: number }[] = [
  { sigma: 0.1, rms: 0.022 },
  { sigma: 0.25, rms: 0.056 },
  { sigma: 0.5, rms: 0.117 },
  { sigma: 1, rms: 0.225 },
  { sigma: 2, rms: 0.44 },
]

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s + 0.5) / 4294967296
  }
}

// fixed standard-normal draws (Box-Muller), so server and client agree
const DRAWS = (() => {
  const r = lcg(20261109)
  const out: { e: number; s: number }[] = []
  for (let i = 0; i < N; i++) {
    const u1 = r()
    const u2 = r()
    const u3 = r()
    const u4 = r()
    out.push({ e: Math.sqrt(-2 * mlog(u1)) * mcos(2 * Math.PI * u2), s: Math.sqrt(-2 * mlog(u3)) * msin(2 * Math.PI * u4) })
  }
  return out
})()

const W = 480
const H = 300
const INSET = { x: 250, y: 20, w: 220, h: 220 } // the zoomed box around the landmark
const PX_PER_M = 110 // inside the inset

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  const { label, min, max, step, value, onChange, fmt } = props
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
        aria-label={label}
      />
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">{fmt(value)}</span>
    </label>
  )
}

export function GhostToy() {
  const [range, setRange] = useState(9.2)
  const [sigma, setSigma] = useState(1)
  const [drift, setDrift] = useState(15)
  const [aligned, setAligned] = useState(true)

  const pts = useMemo(() => {
    const sr = (sigma * Math.PI) / 180
    const sd = aligned ? 0 : drift / 100
    return DRAWS.map(({ e, s }) => {
      const ang = e * sr
      const k = 1 + s * sd
      return { dx: range * k * msin(ang), dy: range * (k * mcos(ang) - 1) }
    })
  }, [range, sigma, drift, aligned])

  const rms = (f: (p: { dx: number; dy: number }) => number) => Math.sqrt(pts.reduce((a, p) => a + f(p) * f(p), 0) / pts.length)
  const lat = rms((p) => p.dx)
  const along = rms((p) => p.dy)
  const predicted = range * ((sigma * Math.PI) / 180)
  const row = MEASURED.reduce((b, m) => (Math.abs(m.sigma - sigma) < Math.abs(b.sigma - sigma) ? m : b), MEASURED[0])

  // main panel: camera at bottom left, landmark up the ray
  const cam = { x: 120, y: 280 }
  const lmY = 280 - 30 - Math.min(range, 40) * 5.5
  const icx = INSET.x + INSET.w / 2
  const icy = INSET.y + INSET.h / 2
  const clip = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        thirty frames of one landmark, top down · a toy of pose and depth error; the measured rows are from my 3D run
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A camera at the bottom looks up a ray at a landmark ${range.toFixed(1)} metres away. A zoomed box around the landmark shows where thirty frames place it: spread ${(lat * 100).toFixed(0)} cm sideways and ${(along * 100).toFixed(0)} cm along the ray.`}
        >
          <line x1={cam.x} y1={cam.y} x2={cam.x} y2={lmY} stroke="var(--muted-foreground)" strokeDasharray="4 3" />
          <polygon points={`${cam.x - 9},${cam.y + 8} ${cam.x + 9},${cam.y + 8} ${cam.x},${cam.y - 6}`} fill="var(--foreground)" />
          <text x={cam.x + 14} y={cam.y + 4} fontSize={10} className="fill-muted-foreground font-mono">
            camera
          </text>
          <circle cx={cam.x} cy={lmY} r={5} fill="oklch(0.62 0.15 45)" />
          <text x={cam.x - 8} y={lmY - 10} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">
            {range.toFixed(1)} m
          </text>
          <line x1={cam.x + 6} y1={lmY} x2={INSET.x} y2={icy} stroke="var(--border)" />
          {/* inset */}
          <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} fill="var(--background)" stroke="var(--border)" />
          {Array.from({ length: 21 }, (_, i) => i - 10).map((i) => (
            <g key={i}>
              <line
                x1={icx + i * PX_PER_M * 0.1}
                y1={INSET.y}
                x2={icx + i * PX_PER_M * 0.1}
                y2={INSET.y + INSET.h}
                stroke="var(--border)"
                strokeWidth={i === 0 ? 1 : 0.4}
              />
              <line
                x1={INSET.x}
                y1={icy + i * PX_PER_M * 0.1}
                x2={INSET.x + INSET.w}
                y2={icy + i * PX_PER_M * 0.1}
                stroke="var(--border)"
                strokeWidth={i === 0 ? 1 : 0.4}
              />
            </g>
          ))}
          {pts.map((p, i) => {
            const x = icx + p.dx * PX_PER_M
            const y = icy - p.dy * PX_PER_M
            const out = x < INSET.x || x > INSET.x + INSET.w || y < INSET.y || y > INSET.y + INSET.h
            return (
              <circle
                key={i}
                cx={clip(x, INSET.x + 3, INSET.x + INSET.w - 3)}
                cy={clip(y, INSET.y + 3, INSET.y + INSET.h - 3)}
                r={out ? 2 : 3.2}
                fill={out ? "none" : "oklch(0.62 0.15 45)"}
                stroke="oklch(0.62 0.15 45)"
                fillOpacity={0.55}
              />
            )
          })}
          <circle cx={icx} cy={icy} r={4} fill="none" stroke="var(--foreground)" strokeWidth={1.4} />
          <text x={INSET.x + 4} y={INSET.y + INSET.h + 14} fontSize={10} className="fill-muted-foreground font-mono">
            zoom: grid every 10 cm · up is along the ray
          </text>
          <text x={INSET.x + 4} y={INSET.y + INSET.h + 28} fontSize={10} className="fill-muted-foreground font-mono">
            hollow dots on the edge are off the box
          </text>
        </svg>

        <div className="flex flex-col gap-3">
          <Slider label="range to subject" min={2} max={40} step={0.2} value={range} onChange={setRange} fmt={(v) => `${v.toFixed(1)} m`} />
          <Slider label="pose error, per axis" min={0} max={2} step={0.05} value={sigma} onChange={setSigma} fmt={(v) => `${v.toFixed(2)}°`} />
          <Slider label="depth scale drift" min={0} max={30} step={1} value={drift} onChange={setDrift} fmt={(v) => `${v}%`} />
          <label className="flex items-center gap-2 font-mono text-xs">
            <input type="checkbox" checked={aligned} onChange={(e) => setAligned(e.target.checked)} />
            align each frame&apos;s depth to the static background
          </label>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="text-muted-foreground">sideways spread</dt>
            <dd>
              {(lat * 100).toFixed(1)} cm <span className="text-muted-foreground">toy, rms of 30 draws</span>
            </dd>
            <dt className="text-muted-foreground">r x sigma</dt>
            <dd>
              {(predicted * 100).toFixed(1)} cm <span className="text-muted-foreground">reasoned, one axis</span>
            </dd>
            <dt className="text-muted-foreground">along the ray</dt>
            <dd>{(along * 100).toFixed(1)} cm</dd>
            <dt className="text-muted-foreground">3D run at 9.21 m</dt>
            <dd>
              {row.sigma}° per axis: {(row.rms * 100).toFixed(1)} cm rms <span className="text-muted-foreground">measured</span>
            </dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            In 3D two of the three rotation axes move a point sideways, so the measured spread is about 1.41 times the one-axis figure.
            Unaligned depth pushes copies along the ray, and that error scales with range just like the angular one.
          </p>
        </div>
      </div>
    </figure>
  )
}
