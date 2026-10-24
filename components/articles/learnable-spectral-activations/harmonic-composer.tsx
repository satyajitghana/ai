"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { msin, mtanh } from "@/lib/dmath"

// One LSA activation, phi(u) = u + sum_k a_k sin(2 pi k u), with K = 6 here
// (the paper uses K = 16 for audio, 32 for images, 24 for NeRF, 8 for NAF).
//
// Left: the activation itself against the identity it starts from and against
// SIREN's single sine. Right: its spectrum. Because the periodic part is a sum
// of integer harmonics of the same pre-activation, the spectrum IS the
// coefficient vector: bar k has height |a_k|. SIREN's unit has one bar.
//
// "Fit" solves the coefficients by least squares against an edge-like target
// (the paper's own controlled target in A.6.3 is tanh(12 sin(2 pi 3 x)); this
// is its single-period cousin). That a few lines of linear algebra can do it is
// the paper's point: given fixed pre-activations, phi is affine in a, so
// tuning the spectrum is a linear least-squares problem, not a search.

const K = 6
const N = 241
const US: number[] = Array.from({ length: N }, (_, i) => -1 + (2 * i) / (N - 1))
const TWO_PI = 2 * Math.PI

// the bump the residual has to add on top of u: a soft square wave, period 1
const target = (u: number) => 0.45 * mtanh(8 * msin(TWO_PI * u))
const basis = (k: number, u: number) => msin(TWO_PI * k * u)

// tiny dense solver (K x K normal equations), Gaussian elimination with pivoting
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c || M[c][c] === 0) continue
      const f = M[r][c] / M[c][c]
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]
    }
  }
  return M.map((row, i) => (row[i] === 0 ? 0 : row[n] / row[i]))
}

function fitFirst(k: number): number[] {
  const A: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  const b: number[] = new Array(k).fill(0)
  for (const u of US) {
    const t = target(u)
    for (let i = 0; i < k; i++) {
      const bi = basis(i + 1, u)
      b[i] += bi * t
      for (let j = 0; j < k; j++) A[i][j] += bi * basis(j + 1, u)
    }
  }
  const a = solve(A, b)
  return [...a, ...new Array(K - k).fill(0)]
}

const PRESETS: Record<string, number[]> = {
  identity: [0, 0, 0, 0, 0, 0],
  "one sine": [0.3, 0, 0, 0, 0, 0],
  "odd harmonics": [0.3, 0, 0.1, 0, 0.06, 0],
  "learned-like": [0.04, -0.02, 0.015, 0.03, -0.01, 0.02],
}

const C_LSA = "#c2410c"
const C_SIREN = "#2563eb"

export function HarmonicComposer() {
  const [a, setA] = useState<number[]>(PRESETS["odd harmonics"])
  const [showTarget, setShowTarget] = useState(false)

  const phi = (u: number) => u + a.reduce((s, ak, i) => s + ak * basis(i + 1, u), 0)
  const siren = (u: number) => 0.3 * msin(TWO_PI * u)

  const rms = useMemo(() => {
    let e = 0
    for (const u of US) {
      const r = a.reduce((s, ak, i) => s + ak * basis(i + 1, u), 0) - target(u)
      e += r * r
    }
    return Math.sqrt(e / N)
  }, [a])

  // RMS of the best fit with the first k harmonics, k = 1..K (k = 1 is the best a single sine can do)
  const ladder = useMemo(
    () =>
      Array.from({ length: K }, (_, i) => {
        const c = fitFirst(i + 1)
        let e = 0
        for (const u of US) {
          const r = c.reduce((s, ak, j) => s + ak * basis(j + 1, u), 0) - target(u)
          e += r * r
        }
        return Math.sqrt(e / N)
      }),
    [],
  )

  const W = 360
  const H = 240
  const pad = 26
  const sx = (u: number) => pad + ((u + 1) / 2) * (W - 2 * pad)
  const sy = (v: number) => H / 2 - (v / 1.8) * (H / 2 - 12)
  const path = (f: (u: number) => number) =>
    US.map((u, i) => `${i === 0 ? "M" : "L"} ${sx(u).toFixed(2)} ${sy(f(u)).toFixed(2)}`).join(" ")

  const BW = 300
  const BH = 240
  const bx = (k: number) => 30 + (k - 0.5) * ((BW - 40) / K)
  const by = (v: number) => BH - 30 - (Math.min(v, 0.6) / 0.6) * (BH - 60)
  const barW = (BW - 40) / K / 3

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>preset</span>
        {Object.keys(PRESETS).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setA(PRESETS[p])}
            className="rounded border px-2 py-0.5 hover:bg-muted"
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setA(fitFirst(K))
            setShowTarget(true)
          }}
          className="rounded border px-2 py-0.5 hover:bg-muted"
          style={{ borderColor: C_LSA, color: C_LSA }}
        >
          fit edge (least squares)
        </button>
        <label className="ml-auto flex items-center gap-1">
          <input type="checkbox" checked={showTarget} onChange={(e) => setShowTarget(e.target.checked)} />
          show target
        </label>
      </div>

      <div className="grid gap-2 px-2 pt-2 sm:grid-cols-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Activation phi(u) plotted against u">
          <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke="currentColor" opacity={0.15} />
          <line x1={sx(0)} y1={8} x2={sx(0)} y2={H - 8} stroke="currentColor" opacity={0.15} />
          <path d={path((u) => u)} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.45} />
          <path d={path(siren)} fill="none" stroke={C_SIREN} strokeWidth={1.5} opacity={0.7} />
          {showTarget && (
            <path d={path((u) => u + target(u))} fill="none" stroke="currentColor" strokeWidth={4} opacity={0.18} />
          )}
          <path d={path(phi)} fill="none" stroke={C_LSA} strokeWidth={2.4} />
          <text x={W - pad} y={H - 6} textAnchor="end" className="fill-current font-mono" fontSize={10} opacity={0.6}>
            pre-activation u
          </text>
          <text x={pad} y={14} className="fill-current font-mono" fontSize={10} opacity={0.6}>
            φ(u)
          </text>
        </svg>

        <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full" role="img" aria-label="Spectrum: one bar per harmonic">
          <line x1={24} y1={by(0)} x2={BW - 6} y2={by(0)} stroke="currentColor" opacity={0.25} />
          {a.map((ak, i) => (
            <g key={i}>
              <rect
                x={bx(i + 1) - barW}
                y={by(Math.abs(ak))}
                width={barW}
                height={by(0) - by(Math.abs(ak))}
                fill={C_LSA}
                opacity={ak < 0 ? 0.55 : 1}
              />
              {i === 0 && (
                <rect x={bx(1) + 1} y={by(0.3)} width={barW} height={by(0) - by(0.3)} fill={C_SIREN} opacity={0.7} />
              )}
              <text x={bx(i + 1)} y={by(0) + 14} textAnchor="middle" className="fill-current font-mono" fontSize={10} opacity={0.6}>
                {i + 1}
              </text>
            </g>
          ))}
          <text x={BW - 6} y={BH - 4} textAnchor="end" className="fill-current font-mono" fontSize={10} opacity={0.6}>
            harmonic k (frequency 2πk)
          </text>
          <text x={24} y={16} className="fill-current font-mono" fontSize={10} opacity={0.6}>
            |a_k|
          </text>
        </svg>
      </div>

      <div className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-2">
        {a.map((ak, i) => (
          <label key={i} className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="w-8">a{i + 1}</span>
            <Range
              min={-0.6}
              max={0.6}
              step={0.005}
              value={ak}
              accent={C_LSA}
              onChange={(e) => {
                const next = [...a]
                next[i] = Number(e.target.value)
                setA(next)
              }}
              className="w-full"
            />
            <span className="w-14 text-right text-foreground">{ak.toFixed(3)}</span>
          </label>
        ))}
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span style={{ color: C_LSA }}>LSA φ(u) = u + Σ a_k sin(2πk u)</span>
        {" · "}
        <span style={{ color: C_SIREN }}>one sine, 0.3 sin(2πu)</span>
        {" · "}dashed: identity, where LSA starts.{" "}
        RMS gap to the edge target: <span className="text-foreground">{rms.toFixed(3)}</span>. Best possible with the first k
        harmonics, k = 1…6:{" "}
        <span className="text-foreground">{ladder.map((v) => v.toFixed(3)).join(" → ")}</span>. A single sine (k = 1) is
        stuck at the first number however its amplitude is set; each added harmonic is one more coefficient, and finding them
        is linear least squares.
      </figcaption>
    </figure>
  )
}
