"use client"

import { useMemo, useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { mtanh } from "@/lib/dmath"

// The point of this whole article in one picture: run the SAME fixed random
// recurrent network from two DIFFERENT starting states, drive both with the
// same input, and watch whether they converge. Below the "edge of chaos"
// (spectral radius comfortably under 1) the network forgets where it started
// and both runs collapse onto one trajectory — the echo state property that
// every reservoir-computing result, fly-shaped or not, actually depends on.
// Push the radius past ~1 and the two histories never merge.
//
// The network itself is NOT the fly connectome — it's a small (24-unit) fixed
// random matrix, generated once with a seeded PRNG so the server and the
// client build the exact identical matrix (no hydration mismatch). Only the
// two knobs below — spectral radius and leak — are the paper's real
// parameters (target radius 0.9, α = 0.15). Everything transcendental that
// reaches an SVG coordinate goes through `mtanh` (see lib/dmath) so the tanh
// nonlinearity itself can't drift by a ULP between server and client either.

const N = 24
const SPARSITY = 0.2
const T = 140

// deterministic PRNG (mulberry32) — integer ops only, bit-identical everywhere
function mulberry32(seed: number) {
  return function rand() {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildMatrix(seed: number): number[][] {
  const rand = mulberry32(seed)
  const W: number[][] = []
  for (let i = 0; i < N; i++) {
    const row: number[] = []
    for (let j = 0; j < N; j++) row.push(rand() < SPARSITY ? rand() * 2 - 1 : 0)
    W.push(row)
  }
  return W
}

function buildVector(seed: number, scale: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: N }, () => (rand() * 2 - 1) * scale)
}

function matVec(W: number[][], v: number[]): number[] {
  const out = new Array(N).fill(0)
  for (let i = 0; i < N; i++) {
    let s = 0
    for (let j = 0; j < N; j++) s += W[i][j] * v[j]
    out[i] = s
  }
  return out
}

function norm(v: number[]): number {
  let s = 0
  for (const x of v) s += x * x
  return Math.sqrt(s)
}

// Power iteration on a fixed matrix, once, at module load. Only +, -, *, /,
// sqrt appear — all exactly specified — so this is bit-identical on the
// server and in the browser; no dmath wrapper needed here.
function spectralRadius(W: number[][]): number {
  let v = Array.from({ length: N }, (_, i) => Math.sin(i + 1) + 0.3)
  v = v.map((x) => x / norm(v))
  let r = 1
  for (let k = 0; k < 200; k++) {
    const w = matVec(W, v)
    r = norm(w)
    v = w.map((x) => x / r)
  }
  return r
}

const W0 = buildMatrix(2026)
const W0_RADIUS = spectralRadius(W0) // ≈ 1.4708 for this fixed matrix
const W_IN = buildVector(4242, 1)
const X0_B = buildVector(777, 0.9) // the "different history" starting state
const ZERO = new Array(N).fill(0)

// two square pulses — enough drive to see a transient rise and decay
const INPUT = Array.from({ length: T }, (_, t) => {
  if (t >= 10 && t < 20) return 1
  if (t >= 75 && t < 82) return -1.4
  return 0
})

function simulate(rho: number, alpha: number, x0: number[]): number[][] {
  const scale = rho / W0_RADIUS
  let x = x0.slice()
  const states: number[][] = [x.slice()]
  for (let t = 0; t < T; t++) {
    const rec = matVec(W0, x)
    const act = rec.map((v, i) => mtanh(v * scale + W_IN[i] * INPUT[t]))
    x = x.map((xi, i) => (1 - alpha) * xi + alpha * act[i])
    states.push(x.slice())
  }
  return states
}

export function ReservoirDynamics() {
  const [rho, setRho] = useState(0.9)
  const [alpha, setAlpha] = useState(0.15)

  const { unitA, unitB, dist, finalDist } = useMemo(() => {
    const a = simulate(rho, alpha, ZERO)
    const b = simulate(rho, alpha, X0_B)
    const unitA = a.map((x) => x[0])
    const unitB = b.map((x) => x[0])
    const dist = a.map((x, t) => norm(x.map((v, i) => v - b[t][i])))
    return { unitA, unitB, dist, finalDist: dist[dist.length - 1] }
  }, [rho, alpha])

  const converges = finalDist < 0.05
  const distMax = Math.max(0.3, ...dist)

  const W = 620
  const H1 = 108
  const H2 = 70
  const pad = 10
  const sx = (t: number) => pad + (t / T) * (W - 2 * pad)
  const syA = (v: number) => H1 / 2 - v * (H1 / 2 - 6)
  const syD = (v: number) => H2 - pad - (v / distMax) * (H2 - pad - 8)

  const path = (ys: number[], sy: (v: number) => number) =>
    ys.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>leaky echo-state network · same input, two starting states</span>
        <span className="text-muted-foreground/60">24 units · toy reservoir, not the fly</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">
          unit 0 of 24 — run A starts at zero (solid), run B starts from a different history (dashed)
        </div>
        <svg viewBox={`0 0 ${W} ${H1}`} className="w-full" role="img"
          aria-label="A single reservoir unit's activity over time for two different starting states, converging or staying apart depending on the spectral radius.">
          <line x1={pad} y1={H1 / 2} x2={W - pad} y2={H1 / 2} stroke="var(--border)" strokeWidth={1} />
          <path d={path(unitA, syA)} fill="none" stroke="oklch(0.62 0.15 205)" strokeWidth="1.8" />
          <path d={path(unitB, syA)} fill="none" stroke="oklch(0.68 0.16 40)" strokeWidth="1.8" strokeDasharray="4 3" opacity="0.9" />
        </svg>

        <div className="mt-3 mb-1 font-mono text-[10px] text-muted-foreground">
          state distance ‖x<sub>A</sub> − x<sub>B</sub>‖ — does the network forget where it started?
        </div>
        <svg viewBox={`0 0 ${W} ${H2}`} className="w-full" role="img"
          aria-label="The distance between the two runs' states over time, decaying to zero when the echo state property holds and staying large otherwise.">
          <path d={path(dist, syD)} fill="none" stroke={converges ? "oklch(0.6 0.14 155)" : "oklch(0.62 0.19 25)"} strokeWidth="1.8" />
        </svg>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Slider label="target spectral radius ρ" value={rho} min={0.1} max={1.6} step={0.05} onChange={setRho} fmt={(v) => v.toFixed(2)} />
          <Slider label="leak α" value={alpha} min={0.05} max={0.6} step={0.05} onChange={setAlpha} fmt={(v) => v.toFixed(2)} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="ρ (paper: 0.9)" value={rho.toFixed(2)} />
          <Stat label="α (paper: 0.15)" value={alpha.toFixed(2)} />
          <Stat label="final ‖xA − xB‖" value={finalDist.toFixed(3)} tone={converges ? "good" : "bad"} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {converges ? (
            <>
              The two runs converge: <span className="text-foreground">any</span> starting state gets
              forgotten and the state becomes a function of recent input alone — the echo state
              property. That&rsquo;s the only thing a ridge readout can reliably learn to read.
            </>
          ) : (
            <>
              Past ρ≈1 the two runs stop merging — the network keeps a memory of its own past state
              instead of just the input, and a readout fit on one run of activity may not generalize
              to another.
            </>
          )}{" "}
          Slide ρ back down through 1 and watch it flip. That threshold — not the wiring pattern —
          is what the paper&rsquo;s scrambled-wiring control is really probing: reshuffle the connections
          but keep ρ fixed at 0.9, and you keep this same regime.
        </p>
      </div>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  fmt: (v: number) => string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">{fmt(value)}</span>
      </div>
      <Range min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full cursor-pointer " aria-label={label} accent="var(--foreground)" />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className="font-medium"
        style={{ color: tone === "good" ? "oklch(0.6 0.14 155)" : tone === "bad" ? "oklch(0.62 0.19 25)" : "var(--foreground)" }}
      >
        {value}
      </div>
    </div>
  )
}
