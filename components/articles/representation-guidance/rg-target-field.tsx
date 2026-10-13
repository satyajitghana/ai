"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A 2D toy of the Representation Guidance target (arXiv 2610.12978, Eqs. 1, 5, 7).
//
// Data: three Gaussian modes x ~ N(mu_k, SIG^2 I), equal weight. The paper's
// convention: z_t = t x + (1 - t) eps, t = 1 is clean, v = x - eps.
// The representation r is idealised here as "which mode": the best compact
// summary a bottleneck could carry for this data. With that, the two branches
// the paper compares have closed forms:
//   with r:     vbar_r(z, t)  = E[x - eps | z_t = z, mode r]
//   without r:  vbar_0(z, t)  = E[x - eps | z_t = z]   (posterior-weighted)
// Eq. 7 says the RG-trained network converges to
//   v_theta(z, t, r) = vbar_0 + (vbar_r - vbar_0) / (2 - s)     for t > t_min
// and to plain vbar_r outside the interval (those samples use the plain target).
// At that fixed point the teacher's offset is dv = (vbar_r - vbar_0) / (2 - s),
// so one training pair's target is v_RG = (x - eps) + (s - 1) dv  (Eq. 5).
// Samples: 64 fixed noise draws integrated from t = 0 to 1 with 50 Euler steps.
// What the toy cannot show: in the paper r is learned, and the gradient of the
// RG loss reshapes it. Here r is fixed and perfect.

const SIG = 0.35
const MU: [number, number][] = [
  [-1.6, 1.0],
  [1.6, 1.0],
  [0, -1.6],
]
const NAMES = ["A", "B", "C"]
const DOM = 3.2
const PX = 340
const STEPS = 50
const NSAMP = 64
const SCALE = 0.13 // data units of arrow per unit of velocity
const CLIP = 0.42

const ACCENT = "oklch(0.62 0.17 30)"
const MODE = "oklch(0.58 0.13 250)"
const MUTED = "oklch(0.62 0.03 250)"

type V2 = [number, number]

function vMode(z: V2, t: number, k: number): V2 {
  const vr = t * t * SIG * SIG + (1 - t) * (1 - t)
  const dx = z[0] - t * MU[k][0]
  const dy = z[1] - t * MU[k][1]
  const a = (t * SIG * SIG) / vr
  const b = (1 - t) / vr
  return [MU[k][0] + (a - b) * dx, MU[k][1] + (a - b) * dy]
}

function vNull(z: V2, t: number): V2 {
  const vr = t * t * SIG * SIG + (1 - t) * (1 - t)
  const lw = MU.map((m) => -((z[0] - t * m[0]) ** 2 + (z[1] - t * m[1]) ** 2) / (2 * vr))
  const top = Math.max(...lw)
  const w = lw.map((l) => mexp(l - top))
  const tot = w.reduce((p, q) => p + q, 0)
  let x = 0
  let y = 0
  for (let k = 0; k < MU.length; k++) {
    const v = vMode(z, t, k)
    x += (w[k] / tot) * v[0]
    y += (w[k] / tot) * v[1]
  }
  return [x, y]
}

function vRG(z: V2, t: number, k: number, s: number, tmin: number): V2 {
  const vr = vMode(z, t, k)
  if (t <= tmin) return vr
  const vn = vNull(z, t)
  const g = 1 / (2 - s)
  return [vn[0] + g * (vr[0] - vn[0]), vn[1] + g * (vr[1] - vn[1])]
}

// Deterministic normal draws: Park-Miller (exact in doubles) and Box-Muller through dmath.
function noise(n: number): V2[] {
  let st = 12345
  const u = () => {
    st = (st * 16807) % 2147483647
    return st / 2147483647
  }
  const out: V2[] = []
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(-2 * mlog(u()))
    const th = 2 * 3.141592653589793 * u()
    out.push([r * mcos(th), r * msin(th)])
  }
  return out
}
const EPS = noise(NSAMP)

const sx = (x: number) => (((x + DOM) / (2 * DOM)) * PX).toFixed(1)
const sy = (y: number) => (((DOM - y) / (2 * DOM)) * PX).toFixed(1)

function simulate(k: number, s: number, tmin: number) {
  const paths: V2[][] = []
  const ends: V2[] = []
  for (const e of EPS) {
    let z: V2 = [e[0], e[1]]
    const path: V2[] = [z]
    for (let i = 0; i < STEPS; i++) {
      const t = i / STEPS
      const v = vRG(z, t, k, s, tmin)
      z = [z[0] + v[0] / STEPS, z[1] + v[1] / STEPS]
      if (i % 5 === 4) path.push(z)
    }
    paths.push(path)
    ends.push(z)
  }
  let mx = 0
  let my = 0
  let ss = 0
  for (const p of ends) {
    mx += p[0] / ends.length
    my += p[1] / ends.length
    ss += ((p[0] - MU[k][0]) ** 2 + (p[1] - MU[k][1]) ** 2) / ends.length
  }
  const drift = Math.sqrt((mx - MU[k][0]) ** 2 + (my - MU[k][1]) ** 2)
  return { paths, ends, rms: Math.sqrt(ss), drift }
}

function Arrow({ from, d, color, width, clip }: { from: V2; d: V2; color: string; width: number; clip: boolean }) {
  let dx = d[0] * SCALE
  let dy = d[1] * SCALE
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-6) return null
  if (clip && len > CLIP) {
    dx = (dx / len) * CLIP
    dy = (dy / len) * CLIP
  }
  const L = Math.min(len, clip ? CLIP : len)
  const ux = dx / L
  const uy = dy / L
  const h = Math.min(0.12, L * 0.45)
  const tip: V2 = [from[0] + dx, from[1] + dy]
  const l: V2 = [tip[0] - h * ux + 0.5 * h * uy, tip[1] - h * uy - 0.5 * h * ux]
  const r: V2 = [tip[0] - h * ux - 0.5 * h * uy, tip[1] - h * uy + 0.5 * h * ux]
  return (
    <g stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1={sx(from[0])} y1={sy(from[1])} x2={sx(tip[0])} y2={sy(tip[1])} />
      <polyline points={`${sx(l[0])},${sy(l[1])} ${sx(tip[0])},${sy(tip[1])} ${sx(r[0])},${sy(r[1])}`} />
    </g>
  )
}

export function RgTargetField() {
  const [s, setS] = useState(1.4)
  const [t, setT] = useState(0.6)
  const [k, setK] = useState(0)
  const [interval, setUseInterval] = useState(true)
  const tmin = interval ? 0.3 : 0

  const grid = useMemo(() => {
    const pts: { z: V2; v: V2 }[] = []
    const n = 13
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const z: V2 = [-DOM + ((i + 0.5) * 2 * DOM) / n, -DOM + ((j + 0.5) * 2 * DOM) / n]
        pts.push({ z, v: vRG(z, t, k, s, tmin) })
      }
    }
    return pts
  }, [t, k, s, tmin])

  const sim = useMemo(() => simulate(k, s, tmin), [k, s, tmin])
  const base = useMemo(() => simulate(k, 1, tmin), [k, tmin])

  // One training pair: a clean point in mode k and a fixed noise draw.
  const pair = useMemo(() => {
    const x: V2 = [MU[k][0] + 0.2, MU[k][1] - 0.15]
    const e: V2 = [0.9, -0.6]
    const z: V2 = [t * x[0] + (1 - t) * e[0], t * x[1] + (1 - t) * e[1]]
    const v: V2 = [x[0] - e[0], x[1] - e[1]]
    let off: V2 = [0, 0]
    if (t > tmin) {
      const vr = vMode(z, t, k)
      const vn = vNull(z, t)
      const g = (s - 1) / (2 - s)
      off = [g * (vr[0] - vn[0]), g * (vr[1] - vn[1])]
    }
    return { x, e, z, v, off, rg: [v[0] + off[0], v[1] + off[1]] as V2 }
  }, [k, t, s, tmin])

  const wrep = 1 / (2 - s)
  const tip: V2 = [pair.z[0] + pair.v[0] * SCALE, pair.z[1] + pair.v[1] * SCALE]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">RG target · 2D toy of Eqs. 5 and 7</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          w<sub>rep</sub> = 1/(2 − s) = <span style={{ color: ACCENT }}>{wrep.toFixed(2)}</span>
        </span>
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:p-4">
        <svg viewBox={`0 0 ${PX} ${PX}`} className="h-auto w-full max-w-[26rem] justify-self-center" role="img" aria-label="Velocity field of the RG-trained toy model at the chosen time, with sample paths from noise to the chosen mode">
          <rect x="0" y="0" width={PX} height={PX} fill="transparent" />
          {MU.map((m, i) => (
            <g key={NAMES[i]}>
              <circle cx={sx(m[0])} cy={sy(m[1])} r={((2 * SIG) / (2 * DOM)) * PX} fill={i === k ? MODE : MUTED} opacity={i === k ? 0.18 : 0.1} />
              <text x={sx(m[0] + 0.55)} y={sy(m[1] + 0.55)} fontSize="11" fill={MUTED} fontFamily="monospace">
                {NAMES[i]}
              </text>
            </g>
          ))}
          {grid.map((g) => (
            <Arrow key={`${g.z[0]}-${g.z[1]}`} from={g.z} d={g.v} color={MUTED} width={0.9} clip />
          ))}
          {sim.paths.slice(0, 16).map((p, i) => (
            <polyline
              key={i}
              points={p.map((q) => `${sx(q[0])},${sy(q[1])}`).join(" ")}
              fill="none"
              stroke={MODE}
              strokeWidth={0.8}
              opacity={0.45}
            />
          ))}
          {sim.ends.map((p, i) => (
            <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={1.8} fill={MODE} />
          ))}
          {/* the training pair: v, the offset, the guided target */}
          <circle cx={sx(pair.z[0])} cy={sy(pair.z[1])} r={3} fill="currentColor" />
          <Arrow from={pair.z} d={pair.v} color="currentColor" width={1.6} clip={false} />
          <Arrow from={tip} d={pair.off} color={ACCENT} width={1.6} clip={false} />
          <Arrow from={pair.z} d={pair.rg} color={ACCENT} width={2.4} clip={false} />
        </svg>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>RG scale s</span>
              <span className="tabular-nums text-foreground">{s.toFixed(2)}</span>
            </span>
            <Range min={1} max={1.9} step={0.05} value={s} onChange={(e) => setS(Number(e.target.value))} accent={ACCENT} className="w-full" aria-label="RG scale s" />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>field shown at t</span>
              <span className="tabular-nums text-foreground">{t.toFixed(2)}</span>
            </span>
            <Range min={0.05} max={0.95} step={0.05} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full" aria-label="time t" />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">representation r =</span>
            {NAMES.map((n, i) => (
              <button
                key={n}
                type="button"
                onClick={() => setK(i)}
                aria-pressed={k === i}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
                  k === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <input type="checkbox" checked={interval} onChange={(e) => setUseInterval(e.target.checked)} />
            guidance only for t &gt; 0.3 (paper default)
          </label>

          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px]">
            <dt className="text-muted-foreground">sample spread, s = 1</dt>
            <dd className="text-right tabular-nums">{base.rms.toFixed(3)}</dd>
            <dt className="text-muted-foreground">sample spread, this s</dt>
            <dd className="text-right tabular-nums" style={{ color: ACCENT }}>
              {sim.rms.toFixed(3)}
            </dd>
            <dt className="text-muted-foreground">centre drift off mode</dt>
            <dd className="text-right tabular-nums">{sim.drift.toFixed(3)}</dd>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            Black arrow: the plain target{" "}
            <span className="font-mono">x − ε</span> for one training pair. Orange tip: the added{" "}
            <span className="font-mono">(s − 1)·sg(Δv)</span>. Thick orange: the guided target{" "}
            <span className="font-mono">v_RG</span>. Grey: the field the network converges to. Spread is the RMS
            distance of 64 samples from the mode centre; the data&apos;s own is 0.495.
          </p>
        </div>
      </div>
    </figure>
  )
}
