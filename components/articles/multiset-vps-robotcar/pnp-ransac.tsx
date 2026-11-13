"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, mlog, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Localisation as the pipeline does it, one dimension down.
//
// A real VPS solves Perspective-n-Point: 2D pixels matched to 3D map points give a
// 6-DoF pose. Here the street is seen from above and the camera is a 1D camera:
// each match says "map point L_i appears at bearing a_i in the image". The unknown
// pose is (x, y, heading), three numbers, so the minimal sample is three matches,
// just as P3P needs three for six unknowns (each 2D-3D match gives two equations).
//
// Minimal solver: fix the heading t, then every match puts the camera on the line
// through L_i with world direction t + a_i; two such lines meet at the camera.
// The third match's bearing residual is a function of t alone, so the solver
// scans t for its zeros and bisects each one. Like P3P it can return several poses.
// RANSAC draws triples, keeps the pose most matches agree with (bearing error under
// a threshold), then refines on all its inliers by least squares.
//
// The map, the true pose and every simulated match are drawn from a seeded PRNG
// (mulberry32), so SSR and the browser compute the same thing. The condition
// presets are illustrative: they show what fewer, worse matches do to RANSAC,
// not any system's measured match statistics.

type V2 = [number, number]

const DEG = Math.PI / 180
const FOV = 55 // half field of view, degrees

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

function gauss(rng: () => number) {
  const u = Math.max(1e-12, rng())
  const v = rng()
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
}

const wrap = (a: number) => {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x < -Math.PI) x += 2 * Math.PI
  return x
}

// Facade points on both sides of a street, the "map" built on the overcast day.
const MAP: V2[] = (() => {
  const rng = mulberry32(11)
  const pts: V2[] = []
  for (let i = 0; i < 26; i++) {
    pts.push([1 + i * 1.75 + (rng() - 0.5) * 0.9, 7 + (rng() - 0.5) * 2.2])
    pts.push([1 + i * 1.75 + (rng() - 0.5) * 0.9, -7 + (rng() - 0.5) * 2.2])
  }
  return pts
})()

const TRUE_C: V2 = [12, -1.5]
const TRUE_T = 8 * DEG

const VISIBLE = MAP.map((p, i) => ({ p, i })).filter(({ p }) => {
  const b = wrap(matan2(p[1] - TRUE_C[1], p[0] - TRUE_C[0]) - TRUE_T)
  const d = Math.sqrt((p[0] - TRUE_C[0]) ** 2 + (p[1] - TRUE_C[1]) ** 2)
  return Math.abs(b) < FOV * DEG && d < 34
})

type Match = { li: number; a: number; inlier: boolean }

function makeMatches(n: number, outlierFrac: number, sigmaDeg: number, seed: number): Match[] {
  const rng = mulberry32(1000 + seed)
  const pool = VISIBLE.slice()
  // Fisher-Yates on the visible points, then take the first n.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const take = pool.slice(0, Math.min(n, pool.length))
  const nOut = Math.round(take.length * outlierFrac)
  return take.map(({ p, i }, k) => {
    if (k < nOut) {
      // A wrong match: this map point is paired with a pixel that shows something else.
      return { li: i, a: (rng() * 2 - 1) * FOV * DEG, inlier: false }
    }
    const b = wrap(matan2(p[1] - TRUE_C[1], p[0] - TRUE_C[0]) - TRUE_T)
    return { li: i, a: b + gauss(rng) * sigmaDeg * DEG, inlier: true }
  })
}

// Camera position for a fixed heading, from two or more bearing lines (least squares).
function centreFor(t: number, ms: Match[]): V2 | null {
  let a11 = 0
  let a12 = 0
  let a22 = 0
  let b1 = 0
  let b2 = 0
  for (const m of ms) {
    const L = MAP[m.li]
    const dx = mcos(t + m.a)
    const dy = msin(t + m.a)
    // Normal to the ray: n = (dy, -dx); constraint n . C = n . L
    const nx = dy
    const ny = -dx
    const r = nx * L[0] + ny * L[1]
    a11 += nx * nx
    a12 += nx * ny
    a22 += ny * ny
    b1 += nx * r
    b2 += ny * r
  }
  const det = a11 * a22 - a12 * a12
  if (Math.abs(det) < 1e-6) return null
  return [(a22 * b1 - a12 * b2) / det, (a11 * b2 - a12 * b1) / det]
}

function residual(C: V2, t: number, m: Match) {
  const L = MAP[m.li]
  const vx = L[0] - C[0]
  const vy = L[1] - C[1]
  const ahead = vx * mcos(t + m.a) + vy * msin(t + m.a)
  if (ahead <= 0) return Math.PI // behind the camera
  return Math.abs(wrap(matan2(vy, vx) - t - m.a))
}

function minimal(s: Match[]): { C: V2; t: number }[] {
  const out: { C: V2; t: number }[] = []
  const f = (t: number) => {
    const C = centreFor(t, [s[0], s[1]])
    if (!C) return null
    const L = MAP[s[2].li]
    return wrap(matan2(L[1] - C[1], L[0] - C[0]) - t - s[2].a)
  }
  let tPrev = -Math.PI
  let fPrev = f(tPrev)
  for (let k = 1; k <= 180; k++) {
    const t = -Math.PI + (k * 2 * Math.PI) / 180
    const fc = f(t)
    if (fPrev !== null && fc !== null && Math.abs(fPrev) < 1.2 && Math.abs(fc) < 1.2 && fPrev * fc <= 0) {
      let lo = tPrev
      let hi = t
      let flo = fPrev
      for (let it = 0; it < 28; it++) {
        const mid = (lo + hi) / 2
        const fm = f(mid)
        if (fm === null) break
        if (flo * fm <= 0) hi = mid
        else {
          lo = mid
          flo = fm
        }
      }
      const tt = (lo + hi) / 2
      const C = centreFor(tt, [s[0], s[1]])
      if (C && s.every((m) => residual(C, tt, m) < 0.01)) out.push({ C, t: tt })
    }
    tPrev = t
    fPrev = fc
  }
  return out
}

function ransac(ms: Match[], iters: number, tauDeg: number, seed: number) {
  const rng = mulberry32(5000 + seed)
  const tau = tauDeg * DEG
  let best: { C: V2; t: number; inl: number[] } | null = null
  let hypotheses = 0
  if (ms.length >= 3) {
    for (let it = 0; it < iters; it++) {
      const i = Math.floor(rng() * ms.length)
      let j = Math.floor(rng() * ms.length)
      let k = Math.floor(rng() * ms.length)
      if (j === i) j = (j + 1) % ms.length
      while (k === i || k === j) k = (k + 1) % ms.length
      for (const h of minimal([ms[i], ms[j], ms[k]])) {
        hypotheses++
        const inl: number[] = []
        ms.forEach((m, q) => {
          if (residual(h.C, h.t, m) < tau) inl.push(q)
        })
        if (!best || inl.length > best.inl.length) best = { ...h, inl }
      }
    }
  }
  if (!best || best.inl.length < 4) return { best, hypotheses }
  // Refine: golden-section on heading, least-squares centre, over the inliers.
  const sub = best.inl.map((q) => ms[q])
  const cost = (t: number) => {
    const C = centreFor(t, sub)
    if (!C) return Infinity
    return sub.reduce((a, m) => a + Math.min(residual(C, t, m), 0.2) ** 2, 0)
  }
  let lo = best.t - 1.5 * DEG
  let hi = best.t + 1.5 * DEG
  const g = (Math.sqrt(5) - 1) / 2
  for (let it = 0; it < 40; it++) {
    const m1 = hi - g * (hi - lo)
    const m2 = lo + g * (hi - lo)
    if (cost(m1) < cost(m2)) hi = m2
    else lo = m1
  }
  const t = (lo + hi) / 2
  const C = centreFor(t, sub)
  if (C) {
    const inl: number[] = []
    ms.forEach((m, q) => {
      if (residual(C, t, m) < tau) inl.push(q)
    })
    best = { C, t, inl }
  }
  return { best, hypotheses }
}

const PRESETS = [
  { id: "overcast", label: "Overcast, like the map", n: 33, out: 0.3, sigma: 0.15 },
  { id: "sun", label: "Low sun", n: 30, out: 0.5, sigma: 0.2 },
  { id: "night", label: "Night, hand-crafted features", n: 24, out: 0.7, sigma: 0.4 },
  { id: "learned", label: "Night, learned features", n: 33, out: 0.55, sigma: 0.25 },
] as const

// Screen frame: x -2..46 m, y -12..12 m.
const W = 640
const H = 320
const sx = (x: number) => ((x + 2) / 48) * W
const sy = (y: number) => H / 2 - (y / 24) * H

function frustum(C: V2, t: number, len: number) {
  const a = t + FOV * DEG
  const b = t - FOV * DEG
  return `${sx(C[0])},${sy(C[1])} ${sx(C[0] + len * mcos(a))},${sy(C[1] + len * msin(a))} ${sx(C[0] + len * mcos(b))},${sy(C[1] + len * msin(b))}`
}

const fmtM = (m: number) => (m < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`)

export function PnpRansac() {
  const [n, setN] = useState(33)
  const [out, setOut] = useState(0.3)
  const [sigma, setSigma] = useState(0.15)
  const [iters, setIters] = useState(100)
  const [seed, setSeed] = useState(1)
  const [preset, setPreset] = useState<string>("overcast")

  const matches = useMemo(() => makeMatches(n, out, sigma, seed), [n, out, sigma, seed])
  const tauDeg = Math.max(0.3, 3 * sigma)
  const { best, hypotheses } = useMemo(() => ransac(matches, iters, tauDeg, seed), [matches, iters, tauDeg, seed])

  const w = matches.length ? matches.filter((m) => m.inlier).length / matches.length : 0
  const needed = w > 0 && w < 1 ? Math.ceil(mlog(0.01) / mlog(1 - w * w * w)) : w >= 1 ? 1 : Infinity

  let posErr = Infinity
  let rotErr = Infinity
  if (best) {
    posErr = Math.sqrt((best.C[0] - TRUE_C[0]) ** 2 + (best.C[1] - TRUE_C[1]) ** 2)
    rotErr = Math.abs(wrap(best.t - TRUE_T)) / DEG
  }
  const ok = best && best.inl.length >= 6
  const bands = [
    { m: 0.25, d: 2 },
    { m: 0.5, d: 5 },
    { m: 5, d: 10 },
  ]
  const passes = bands.map((b) => Boolean(ok) && posErr <= b.m && rotErr <= b.d)
  const inSet = new Set(best?.inl ?? [])

  const applyPreset = (id: string) => {
    const p = PRESETS.find((q) => q.id === id)
    if (!p) return
    setPreset(id)
    setN(p.n)
    setOut(p.out)
    setSigma(p.sigma)
  }

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Localise one photo: matches, RANSAC, pose (top-down, a 1D camera)
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-xs">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            aria-pressed={preset === p.id}
            className={cn(
              "rounded border px-2.5 py-1 transition-colors",
              preset === p.id ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded border bg-background px-2.5 py-1 text-muted-foreground hover:text-foreground"
        >
          new photo, same condition
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>matches found</span>
            <span className="tabular-nums text-foreground">{matches.length}</span>
          </span>
          <Range className="mt-2" min={6} max={VISIBLE.length} step={1} value={n} aria-label="Number of 2D-3D matches"
            onChange={(e) => { setN(Number(e.target.value)); setPreset("") }} />
        </label>
        <label className="block">
          <span className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>wrong matches</span>
            <span className="tabular-nums text-foreground">{Math.round(out * 100)}%</span>
          </span>
          <Range className="mt-2" min={0} max={0.95} step={0.05} value={out} aria-label="Fraction of wrong matches"
            onChange={(e) => { setOut(Number(e.target.value)); setPreset("") }} />
        </label>
        <label className="block">
          <span className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>pixel noise on good matches (1σ)</span>
            <span className="tabular-nums text-foreground">{sigma.toFixed(2)}°</span>
          </span>
          <Range className="mt-2" min={0.05} max={1} step={0.05} value={sigma} aria-label="Bearing noise in degrees"
            onChange={(e) => { setSigma(Number(e.target.value)); setPreset("") }} />
        </label>
        <label className="block">
          <span className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>RANSAC iterations</span>
            <span className="tabular-nums text-foreground">{iters}</span>
          </span>
          <Range className="mt-2" min={10} max={1000} step={10} value={iters} aria-label="RANSAC iterations"
            onChange={(e) => setIters(Number(e.target.value))} />
        </label>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full rounded border bg-background"
        role="img"
        aria-label={`Top-down street with ${MAP.length} map points. ${matches.length} matches, ${Math.round(out * 100)}% wrong. ${best ? `Estimated pose ${fmtM(posErr)} and ${rotErr.toFixed(2)} degrees from the truth.` : "No pose found."}`}
      >
        <rect x={0} y={sy(12)} width={W} height={sy(8) - sy(12)} className="fill-muted" opacity={0.6} />
        <rect x={0} y={sy(-8)} width={W} height={sy(-12) - sy(-8)} className="fill-muted" opacity={0.6} />
        {matches.map((m, q) => {
          const L = MAP[m.li]
          if (inSet.has(q) && best) {
            return (
              <line key={`m-${q}`} x1={sx(best.C[0])} y1={sy(best.C[1])} x2={sx(L[0])} y2={sy(L[1])}
                stroke="#2E8B57" strokeOpacity={0.55} strokeWidth={1} />
            )
          }
          // A rejected match: draw the ray the pixel actually points along, from the true camera.
          const len = 10
          return (
            <line key={`m-${q}`} x1={sx(TRUE_C[0])} y1={sy(TRUE_C[1])}
              x2={sx(TRUE_C[0] + len * mcos(TRUE_T + m.a))} y2={sy(TRUE_C[1] + len * msin(TRUE_T + m.a))}
              stroke="#C0392B" strokeOpacity={0.45} strokeDasharray="3 3" strokeWidth={1} />
          )
        })}
        {MAP.map((p, i) => (
          <circle key={`p-${i}`} cx={sx(p[0])} cy={sy(p[1])} r={2.4} className="fill-foreground" opacity={0.55} />
        ))}
        <polygon points={frustum(TRUE_C, TRUE_T, 3)} fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 3" />
        {best && (
          <polygon points={frustum(best.C, best.t, 3)} fill="#3B7DD8" fillOpacity={0.35} stroke="#3B7DD8" strokeWidth={1.6} />
        )}
        <text x={8} y={H - 8} fontSize={10} className="fill-muted-foreground font-mono">
          dashed outline: true pose · blue: RANSAC estimate · green: inliers · red: rejected rays
        </text>
      </svg>

      <div className="mt-4 grid gap-3 font-mono text-xs sm:grid-cols-3">
        <div className="rounded border bg-background p-3">
          <div className="text-muted-foreground">estimate vs truth</div>
          <div className="mt-1 text-base tabular-nums text-foreground">
            {ok ? `${fmtM(posErr)} · ${rotErr.toFixed(2)}°` : "no pose (too few inliers)"}
          </div>
          <div className="mt-1 text-muted-foreground tabular-nums">
            {best ? best.inl.length : 0} inliers · {hypotheses} hypotheses tried
          </div>
        </div>
        <div className="rounded border bg-background p-3">
          <div className="text-muted-foreground">RobotCar thresholds</div>
          <div className="mt-1 space-y-0.5">
            {bands.map((b, i) => (
              <div key={b.m} className={cn("tabular-nums", passes[i] ? "text-[#2E8B57]" : "text-[#C0392B]")}>
                {passes[i] ? "pass" : "fail"} · {b.m} m, {b.d}°
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border bg-background p-3">
          <div className="text-muted-foreground">iterations for 99% odds of one clean triple</div>
          <div className="mt-1 text-base tabular-nums text-foreground">
            {Number.isFinite(needed) ? needed.toLocaleString("en-US") : "never"}
          </div>
          <div className="mt-1 text-muted-foreground tabular-nums">
            good-match share w = {(w * 100).toFixed(0)}%, N = log 0.01 / log(1 − w³)
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Simulated street and matches; the condition presets are illustrative, not measured match statistics.
        Inlier threshold is {tauDeg.toFixed(2)}° of bearing (three times the noise, at least 0.3°).
      </p>
    </div>
  )
}
