"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcbrt, mcos, mhypot, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A 16-sample periodic signal, the cyclic group C_16 acting on it by shifts, and the exact
// selective bispectrum the library computes for CnonCn (src/bispectrum/cn_on_cn.py):
//   beta[0] = F0 F0 conj(F0),  beta[1] = F0 F1 conj(F1),  beta[k+1] = F1 Fk conj(F(k+1)), k = 1..n-2
// and its inversion (Mataigne et al. 2024, Algorithm 1, as in CnonCn.invert): F0 from the cube root
// of beta[0], |F1| from beta[1] with the phase of F1 set to 0, then F(k+1) = conj(beta[k+1] / (F1 Fk)).
// Everything below is computed in the browser from these formulas; nothing is precomputed.

const N = 16
type C = [number, number]
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const conj = (a: C): C => [a[0], -a[1]]
const abs = (a: C) => mhypot(a[0], a[1])
const arg = (a: C) => matan2(a[1], a[0])
const div = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1]
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
}

function dft(f: number[]): C[] {
  const out: C[] = []
  for (let k = 0; k < N; k++) {
    let re = 0
    let im = 0
    for (let t = 0; t < N; t++) {
      const a = (-2 * Math.PI * k * t) / N
      re += f[t] * mcos(a)
      im += f[t] * msin(a)
    }
    out.push([re, im])
  }
  return out
}

function idftReal(F: C[]): number[] {
  const out: number[] = []
  for (let t = 0; t < N; t++) {
    let re = 0
    for (let k = 0; k < N; k++) {
      const a = (2 * Math.PI * k * t) / N
      re += F[k][0] * mcos(a) - F[k][1] * msin(a)
    }
    out.push(re / N)
  }
  return out
}

function bispectrum(F: C[]): C[] {
  const b: C[] = [mul(mul(F[0], F[0]), conj(F[0])), mul(mul(F[0], F[1]), conj(F[1]))]
  for (let k = 1; k <= N - 2; k++) b.push(mul(mul(F[1], F[k]), conj(F[k + 1])))
  return b
}

function invert(b: C[]): number[] {
  const F: C[] = new Array(N).fill(0).map(() => [0, 0] as C)
  const m0 = mcbrt(abs(b[0]))
  const p0 = arg(b[0])
  F[0] = [m0 * mcos(p0), m0 * msin(p0)]
  F[1] = [Math.sqrt(abs(div(b[1], F[0]))), 0]
  for (let k = 1; k <= N - 2; k++) F[k + 1] = conj(div(b[k + 1], mul(F[1], F[k])))
  // The recursion returns F_k e^{-ik theta} over unsigned k, theta = arg F1: a phase ramp, not yet a
  // real signal unless N theta is a multiple of 2 pi. One more ramp, delta = -arg(F[N-1]) / N, makes the
  // spectrum Hermitian again; what is left is an integer cyclic shift of the original, the same one for
  // every shift of the input.
  const delta = -arg(F[N - 1]) / N
  for (let k = 0; k < N; k++) F[k] = mul(F[k], [mcos(k * delta), msin(k * delta)])
  return idftReal(F)
}

// The signal: a mean plus a few harmonics, chosen so no Fourier coefficient is near zero
// (the selective inversion divides by every F_k, k <= n-2).
const BASE: number[] = Array.from({ length: N }, (_, t) => {
  const x = (2 * Math.PI * t) / N
  return (
    1.2 +
    1.0 * mcos(x - 0.4) +
    0.7 * mcos(2 * x + 1.1) +
    0.45 * mcos(3 * x - 2.0) +
    0.35 * mcos(4 * x + 0.3) +
    0.22 * mcos(5 * x + 2.4) +
    0.16 * mcos(6 * x - 1.3) +
    0.12 * mcos(7 * x + 0.8) +
    0.08 * mcos(8 * x)
  )
})

// The twin keeps every |F_k| and moves the phases: same power spectrum, a different shape.
const TWIN_PHASE = [0, 2.1, -1.4, 0.9, 2.8, -2.2, 1.6, -0.7]
const TWIN: number[] = (() => {
  const F = dft(BASE)
  const G: C[] = F.map((c, k) => {
    const j = k <= N / 2 ? k : N - k
    if (j === 0 || j === N / 2) return c
    const d = k <= N / 2 ? TWIN_PHASE[j] : -TWIN_PHASE[j]
    const m = abs(c)
    const p = arg(c) + d
    return [m * mcos(p), m * msin(p)]
  })
  return idftReal(G)
})()

const roll = (f: number[], s: number) => f.map((_, t) => f[(t - s + N) % N])

function Dial({ c, scale, x, y, r, tone }: { c: C; scale: number; x: number; y: number; r: number; tone: string }) {
  const len = Math.min(1.1, mcbrt(abs(c)) / scale) * r * 0.85
  const p = arg(c)
  return (
    <g>
      <circle cx={x} cy={y} r={r} className="fill-none stroke-border" strokeWidth={1} />
      <line x1={x} y1={y} x2={x + len * mcos(p)} y2={y - len * msin(p)} className={tone} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={x} cy={y} r={1.6} className="fill-muted-foreground" />
    </g>
  )
}

export function ShiftLab() {
  const [shift, setShift] = useState(0)
  const [twin, setTwin] = useState(false)
  const [rebuild, setRebuild] = useState(false)

  const d = useMemo(() => {
    const src = twin ? TWIN : BASE
    const f = roll(src, shift)
    const F = dft(f)
    const F0 = dft(src)
    const Fa = dft(BASE)
    const b = bispectrum(F)
    const bA = bispectrum(Fa)
    const P = F.slice(0, N / 2 + 1).map((c) => { const m = abs(c); return m * m })
    const PA = Fa.slice(0, N / 2 + 1).map((c) => { const m = abs(c); return m * m })
    const rec = invert(b)
    const maxRel = (x: C[], y: C[]) => {
      let num = 0
      let den = 0
      for (let i = 0; i < x.length; i++) {
        num = Math.max(num, abs([x[i][0] - y[i][0], x[i][1] - y[i][1]]))
        den = Math.max(den, abs(y[i]))
      }
      return num / den
    }
    const pRel = Math.max(...P.map((v, i) => Math.abs(v - PA[i]))) / Math.max(...PA)
    const bRel = maxRel(b, bA)
    let bDeg = 0
    for (let i = 0; i < b.length; i++) {
      let dp = Math.abs(arg(b[i]) - arg(bA[i])) % (2 * Math.PI)
      if (dp > Math.PI) dp = 2 * Math.PI - dp
      bDeg = Math.max(bDeg, (dp * 180) / Math.PI)
    }
    const bSelf = maxRel(b, bispectrum(F0))
    return { f, F, b, bA, P, PA, rec, pRel, bRel, bDeg, bSelf }
  }, [shift, twin])

  const W = 640
  // signal panel
  const sx = (t: number) => 40 + (t / N) * 560
  const all = [...BASE, ...TWIN, ...d.rec]
  const lo = Math.min(...all) - 0.2
  const hi = Math.max(...all) + 0.2
  const sy = (v: number) => 20 + (1 - (v - lo) / (hi - lo)) * 110
  const path = (f: number[]) => f.map((v, t) => `${t ? "L" : "M"}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join(" ") + ` L${sx(N).toFixed(1)},${sy(f[0]).toFixed(1)}`

  const fScale = Math.max(...d.F.slice(1, 8).map((c) => mcbrt(abs(c)))) * 1.05
  const pMax = Math.max(...d.PA.slice(1))

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">Shift a periodic signal and watch what moves</figcaption>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="text-muted-foreground">
            Cyclic shift: <span className="font-mono text-foreground">{shift}</span> of {N} samples
          </span>
          <Range min={0} max={N - 1} step={1} value={shift} onChange={(e) => setShift(Number(e.target.value))} className="w-full" aria-label="Cyclic shift" />
        </label>
        <div className="flex gap-1" role="group" aria-label="Which signal">
          {[
            ["Signal", false],
            ["Twin", true],
          ].map(([label, v]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => setTwin(v as boolean)}
              aria-pressed={twin === v}
              className={cn("rounded border px-2.5 py-1", twin === v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            >
              {label as string}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-muted-foreground">
          <input type="checkbox" checked={rebuild} onChange={(e) => setRebuild(e.target.checked)} />
          Rebuild from β
        </label>
      </div>

      <svg viewBox={`0 0 ${W} 520`} className="mt-3 w-full" role="img" aria-label="The shifted signal, its Fourier coefficient phases, its power spectrum and its selective bispectrum">
        <text x={8} y={14} className="fill-muted-foreground text-[11px]">signal f, shifted by {shift}</text>
        <line x1={40} x2={600} y1={sy(0)} y2={sy(0)} className="stroke-border" strokeDasharray="2 3" />
        {twin && <path d={path(roll(BASE, shift))} className="fill-none stroke-muted-foreground/40" strokeWidth={1.5} />}
        <path d={path(d.f)} className={cn("fill-none", twin ? "stroke-amber-500" : "stroke-sky-500")} strokeWidth={2.4} />
        {d.f.map((v, t) => (
          <circle key={t} cx={sx(t)} cy={sy(v)} r={2.6} className={twin ? "fill-amber-500" : "fill-sky-500"} />
        ))}
        {rebuild && <path d={path(d.rec)} className="fill-none stroke-emerald-500" strokeWidth={2} strokeDasharray="5 4" />}

        <text x={8} y={168} className="fill-muted-foreground text-[11px]">Fourier coefficients F₁…F₇: phase turns by k·shift</text>
        {d.F.slice(1, 8).map((c, i) => (
          <g key={i}>
            <Dial c={c} scale={fScale} x={70 + i * 80} y={200} r={22} tone="stroke-foreground" />
            <text x={70 + i * 80} y={238} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">F{i + 1}</text>
          </g>
        ))}

        <text x={8} y={268} className="fill-muted-foreground text-[11px]">power spectrum |F_k|², k = 1…8 (grey: the original signal)</text>
        {d.P.slice(1).map((v, i) => {
          const h = (v / pMax) * 60
          const hA = (d.PA[i + 1] / pMax) * 60
          return (
            <g key={i}>
              <rect x={60 + i * 68} y={340 - hA} width={14} height={hA} className="fill-muted-foreground/40" />
              <rect x={76 + i * 68} y={340 - h} width={14} height={h} className={twin ? "fill-amber-500" : "fill-sky-500"} />
              <text x={76 + i * 68} y={354} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">{i + 1}</text>
            </g>
          )
        })}

        <text x={8} y={380} className="fill-muted-foreground text-[11px]">selective bispectrum β, 16 entries: needle = phase, length relative to the original&apos;s (grey)</text>
        {d.b.map((c, i) => {
          const x = 36 + (i % 8) * 80
          const y = 412 + Math.floor(i / 8) * 64
          return (
            <g key={i}>
              <Dial c={d.bA[i]} scale={mcbrt(abs(d.bA[i]))} x={x} y={y} r={24} tone="stroke-muted-foreground/35" />
              <Dial c={c} scale={mcbrt(abs(d.bA[i]))} x={x} y={y} r={24} tone={twin ? "stroke-amber-500" : "stroke-sky-500"} />
              <text x={x} y={y + 36} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
                {i === 0 ? "0,0" : i === 1 ? "0,1" : `1,${i - 1}`}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground">
        <div>
          power spectrum vs original: <span className="text-foreground">{d.pRel < 1e-9 ? "identical" : d.pRel.toExponential(1)}</span>
        </div>
        <div>
          β vs unshifted copy: <span className="text-foreground">{d.bSelf < 1e-9 ? "identical" : d.bSelf.toExponential(1)}</span>
        </div>
        <div>
          β vs original signal: <span className={cn(d.bRel < 1e-9 ? "text-foreground" : "text-amber-600 dark:text-amber-400")}>{d.bRel < 1e-9 ? "identical" : `differs, phases up to ${Math.round(d.bDeg)}° apart`}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Drag the shift: the F_k needles spin (each by k steps of 22.5°), the power spectrum and every β needle stay put. Switch to the twin: the power spectrum still matches the original bar for bar, and the β dials no longer do. Rebuild from β runs the library&apos;s inversion on the 16 numbers and draws the result dashed (green): the same waveform, in one fixed pose, whatever shift you chose.
      </p>
    </figure>
  )
}
