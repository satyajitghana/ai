"use client"

// A toy view-dependent colour on one great circle, fitted two ways.
//
// - Spherical harmonics up to degree L. Restricted to a great circle, the real SH
//   of degree <= L span exactly the Fourier modes cos(m t), sin(m t) for m <= L,
//   so the least-squares SH fit on the circle is the truncated Fourier series
//   (computed here from 360 uniform samples).
// - k spherical-Gaussian lobes plus a constant: c + sum_j a_j exp(lambda_j (cos(t - mu_j) - 1)).
//   This is the 1D cut of an NASG lobe through its axis (anisotropy only rescales
//   lambda along one cut). One lobe is an exhaustive search over 360 directions x
//   48 sharpness values with the amplitude and offset solved in closed form; two
//   lobes fit the second to the first's residual, then re-solve all amplitudes jointly.
//
// Storage is counted the way the paper's Table 1 counts it for a full RGB Gaussian
// in fp32: SH degree L stores 3 (L+1)^2 floats (base colour included), an NASG lobe
// 8 floats on top of a 3-float base colour. The neural model's 28 B is the
// paper's deployed figure (3 fp32 base + 8 fp16 features); it is not fitted here.
//
// Transcendentals go through lib/dmath so server and client agree to the bit.

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog10, mpow, msin } from "@/lib/dmath"

const N = 360
const NL = 48
const TWO_PI = 6.283185307179586

const COS: number[] = []
const SIN: number[] = []
for (let k = 0; k < N; k++) {
  COS.push(mcos((TWO_PI * k) / N))
  SIN.push(msin((TWO_PI * k) / N))
}
// lobe sharpness grid, 0.5 .. 400, log-spaced
const LAMBDAS: number[] = []
for (let s = 0; s < NL; s++) LAMBDAS.push(0.5 * mpow(800, s / (NL - 1)))

// E[s][k] = exp(lambda_s (cos(2 pi k / N) - 1)): a lobe centred at sample 0
let E_TABLE: Float64Array[] | null = null
function lobeTable(): Float64Array[] {
  if (E_TABLE) return E_TABLE
  E_TABLE = LAMBDAS.map((l) => {
    const row = new Float64Array(N)
    for (let k = 0; k < N; k++) row[k] = mexp(l * (COS[k] - 1))
    return row
  })
  return E_TABLE
}

type Preset = "gloss" | "two" | "change"

const PRESETS: { id: Preset; label: string; note: string }[] = [
  { id: "gloss", label: "one glossy highlight", note: "a diffuse colour plus one reflection that sharpens as the slider rises" },
  { id: "two", label: "two highlights", note: "two reflections from different directions, say a window and a lamp" },
  { id: "change", label: "scene changed mid-capture", note: "half the cameras saw the grass upright, half saw it trampled; no reflection at all" },
]

function lobeAt(lambda: number, centre: number, i: number) {
  // exp(lambda (cos(t_i - centre) - 1)) with t_i = 2 pi i / N
  return mexp(lambda * (mcos((TWO_PI * i) / N - centre) - 1))
}

function target(preset: Preset, sharp: number): number[] {
  const t: number[] = []
  for (let i = 0; i < N; i++) {
    if (preset === "gloss") t.push(0.35 + 0.5 * lobeAt(sharp, 2.0, i))
    else if (preset === "two") t.push(0.3 + 0.4 * lobeAt(sharp, 1.2, i) + 0.3 * lobeAt(sharp * 0.6, 4.0, i))
    else t.push(0.3 + 0.25 / (1 + mexp(-(sharp / 4) * SIN[i])))
  }
  return t
}

function fitSH(t: number[], L: number): number[] {
  let a0 = 0
  for (let i = 0; i < N; i++) a0 += t[i]
  a0 /= N
  const out = new Array<number>(N).fill(a0)
  for (let m = 1; m <= L; m++) {
    let a = 0
    let b = 0
    for (let i = 0; i < N; i++) {
      const k = (m * i) % N
      a += t[i] * COS[k]
      b += t[i] * SIN[k]
    }
    a *= 2 / N
    b *= 2 / N
    for (let i = 0; i < N; i++) {
      const k = (m * i) % N
      out[i] += a * COS[k] + b * SIN[k]
    }
  }
  return out
}

// best single lobe + constant for signal r; returns the lobe vector
function bestLobe(r: number[]): { g: Float64Array; s: number; j: number } {
  const E = lobeTable()
  let rMean = 0
  for (let i = 0; i < N; i++) rMean += r[i]
  rMean /= N
  let best = { gain: -1, s: 0, j: 0 }
  for (let s = 0; s < NL; s++) {
    const row = E[s]
    let gs = 0
    let gg = 0
    for (let k = 0; k < N; k++) {
      gs += row[k]
      gg += row[k] * row[k]
    }
    const varG = gg - (gs * gs) / N
    if (varG <= 1e-12) continue
    for (let j = 0; j < N; j++) {
      let gr = 0
      for (let i = 0; i < N; i++) gr += row[(i - j + N) % N] * r[i]
      const cov = gr - gs * rMean
      const gain = (cov * cov) / varG
      if (gain > best.gain) best = { gain, s, j }
    }
  }
  const g = new Float64Array(N)
  const row = E[best.s]
  for (let i = 0; i < N; i++) g[i] = row[(i - best.j + N) % N]
  return { g, s: best.s, j: best.j }
}

// least squares t ~ X w for a small dense design (columns), via normal equations
function solveLS(cols: ArrayLike<number>[], t: number[]): number[] {
  const p = cols.length
  const A: number[][] = []
  const b: number[] = []
  for (let r = 0; r < p; r++) {
    A.push([])
    let s = 0
    for (let i = 0; i < N; i++) s += cols[r][i] * t[i]
    b.push(s)
    for (let c = 0; c < p; c++) {
      let v = 0
      for (let i = 0; i < N; i++) v += cols[r][i] * cols[c][i]
      A[r].push(v)
    }
  }
  // Gaussian elimination with partial pivoting
  for (let c = 0; c < p; c++) {
    let piv = c
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    ;[A[c], A[piv]] = [A[piv], A[c]]
    ;[b[c], b[piv]] = [b[piv], b[c]]
    const d = A[c][c] || 1e-12
    for (let r = c + 1; r < p; r++) {
      const f = A[r][c] / d
      for (let k = c; k < p; k++) A[r][k] -= f * A[c][k]
      b[r] -= f * b[c]
    }
  }
  const w = new Array<number>(p).fill(0)
  for (let r = p - 1; r >= 0; r--) {
    let s = b[r]
    for (let k = r + 1; k < p; k++) s -= A[r][k] * w[k]
    w[r] = s / (A[r][r] || 1e-12)
  }
  return w
}

function fitLobes(t: number[], k: number): { fit: number[]; lambdas: number[] } {
  const ones = new Float64Array(N).fill(1)
  const l1 = bestLobe(t)
  let cols: ArrayLike<number>[] = [ones, l1.g]
  let w = solveLS(cols, t)
  const lambdas = [LAMBDAS[l1.s]]
  if (k === 2) {
    const r = t.map((v, i) => v - w[0] - w[1] * l1.g[i])
    const l2 = bestLobe(r)
    cols = [ones, l1.g, l2.g]
    w = solveLS(cols, t)
    lambdas.push(LAMBDAS[l2.s])
  }
  const fit: number[] = []
  for (let i = 0; i < N; i++) {
    let v = 0
    for (let c = 0; c < cols.length; c++) v += w[c] * cols[c][i]
    fit.push(v)
  }
  return { fit, lambdas }
}

// what the renderer shows: the colour activation clamps (ReLU, then the display clips at 1)
const shown = (v: number) => Math.min(1, Math.max(0, v))

function rmse(a: number[], b: number[]) {
  let s = 0
  for (let i = 0; i < N; i++) {
    const d = shown(a[i]) - b[i]
    s += d * d
  }
  return Math.sqrt(s / N)
}

const psnr = (e: number) => (e < 1e-6 ? 99 : -20 * mlog10(e))

const C_T = "oklch(0.55 0.02 255)"
const C_SH = "oklch(0.64 0.17 30)"
const C_L = "oklch(0.6 0.14 200)"

const W = 640
const H = 200
const PX = 40
const PW = W - PX - 12
const PY = 12
const PH = 150

// plot maps value range [-0.1, 1.1] to the panel
const yOf = (v: number) => PY + PH - ((Math.min(1.15, Math.max(-0.15, v)) + 0.15) / 1.3) * PH
function line(v: number[]) {
  let d = ""
  for (let i = 0; i <= N; i += 2) {
    const x = PX + (i / N) * PW
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + yOf(v[i % N]).toFixed(1) + " "
  }
  return d
}

function strip(v: number[], y: number, h: number, hue: number, key: string) {
  const cells = []
  for (let i = 0; i < N; i += 4) {
    const l = 0.18 + 0.78 * shown(v[i])
    cells.push(
      <rect
        key={key + i}
        x={PX + (i / N) * PW}
        y={y}
        width={(4 / N) * PW + 0.6}
        height={h}
        fill={`oklch(${l.toFixed(3)} 0.09 ${hue})`}
      />,
    )
  }
  return cells
}

const shBytes = (L: number) => 3 * (L + 1) * (L + 1) * 4
const lobeBytes = (k: number) => 12 + 32 * k

export function LobeVsSH() {
  const [preset, setPreset] = useState<Preset>("gloss")
  const [sharpIdx, setSharpIdx] = useState(26)
  const [L, setL] = useState(3)
  const [k, setK] = useState(1)

  const sharp = LAMBDAS[sharpIdx]
  const t = useMemo(() => target(preset, sharp), [preset, sharp])
  const sh = useMemo(() => fitSH(t, L), [t, L])
  const lobes = useMemo(() => fitLobes(t, k), [t, k])

  const eSH = rmse(sh, t)
  const eL = rmse(lobes.fit, t)
  let shMin = 9
  let shMax = -9
  let tMin = 9
  let tMax = -9
  for (let i = 0; i < N; i++) {
    shMin = Math.min(shMin, sh[i])
    shMax = Math.max(shMax, sh[i])
    tMin = Math.min(tMin, t[i])
    tMax = Math.max(tMax, t[i])
  }

  const rows = [
    { label: `SH degree ${L}`, b: shBytes(L), c: C_SH, on: true },
    { label: `${k} NASG lobe${k > 1 ? "s" : ""}`, b: lobeBytes(k), c: C_L, on: true },
    { label: "neural (paper)", b: 28, c: "oklch(0.62 0.03 255)", on: false },
  ]
  const bMax = Math.max(...rows.map((r) => r.b), 192)

  const presetNote = PRESETS.find((p) => p.id === preset)?.note ?? ""

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one Gaussian, seen from every direction on a circle</span>
        <span className="text-muted-foreground/60">toy fit · bytes from Table 1</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              aria-pressed={preset === p.id}
              className={"rounded border px-2.5 py-1 " + (preset === p.id ? "bg-foreground text-background" : "bg-background/50 text-muted-foreground")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">Target: {presetNote}.</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block font-mono text-xs text-muted-foreground">
            sharpness λ: <span className="text-foreground">{sharp.toFixed(1)}</span>
            <Range min={0} max={NL - 1} step={1} value={sharpIdx} onChange={(e) => setSharpIdx(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-xs text-muted-foreground">
            SH degree: <span className="text-foreground">{L}</span>
            <Range min={1} max={6} step={1} value={L} onChange={(e) => setL(Number(e.target.value))} accent={C_SH} className="mt-1 w-full" />
          </label>
          <div className="font-mono text-xs text-muted-foreground">
            lobes
            <div className="mt-1 flex gap-1.5">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setK(n)}
                  aria-pressed={k === n}
                  className={"rounded border px-2.5 py-0.5 " + (k === n ? "text-background" : "bg-background/50")}
                  style={k === n ? { background: C_L, borderColor: C_L } : undefined}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H + 46}`}
          className="w-full"
          role="img"
          aria-label={`Target colour against viewing angle, with a degree ${L} spherical-harmonic fit (error ${psnr(eSH).toFixed(1)} dB PSNR) and a ${k}-lobe fit (${psnr(eL).toFixed(1)} dB).`}
        >
          {[0, 0.5, 1].map((g) => (
            <g key={g}>
              <line x1={PX} x2={PX + PW} y1={yOf(g)} y2={yOf(g)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PX - 6} y={yOf(g) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
                {g}
              </text>
            </g>
          ))}
          <line x1={PX} x2={PX + PW} y1={yOf(0)} y2={yOf(0)} stroke="currentColor" strokeOpacity={0.3} />
          {[0, 90, 180, 270, 360].map((a) => (
            <text key={a} x={PX + (a / 360) * PW} y={PY + PH + 12} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
              {a}°
            </text>
          ))}
          <path d={line(t)} fill="none" stroke={C_T} strokeWidth={4} strokeOpacity={0.45} />
          <path d={line(sh)} fill="none" stroke={C_SH} strokeWidth={1.8} />
          <path d={line(lobes.fit)} fill="none" stroke={C_L} strokeWidth={1.8} strokeDasharray="5 3" />
          <text x={PX + 4} y={H + 8} fontSize={9} className="fill-muted-foreground font-mono">
            as rendered (clamped to 0..1): target · SH · lobes
          </text>
          {strip(t, H + 14, 9, 255, "t")}
          {strip(sh, H + 24, 9, 30, "s")}
          {strip(lobes.fit, H + 34, 9, 200, "l")}
        </svg>

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
          <div className="rounded-lg border bg-background/50 px-3 py-2 leading-relaxed text-muted-foreground">
            <span style={{ color: C_SH }}>SH degree {L}</span>: PSNR <span className="text-foreground">{psnr(eSH).toFixed(1)} dB</span>
            {" "}· peak {shMax.toFixed(2)} vs {tMax.toFixed(2)}, floor {shMin.toFixed(2)} vs {tMin.toFixed(2)}
          </div>
          <div className="rounded-lg border bg-background/50 px-3 py-2 leading-relaxed text-muted-foreground">
            <span style={{ color: C_L }}>
              {k} lobe{k > 1 ? "s" : ""}
            </span>
            : PSNR <span className="text-foreground">{psnr(eL).toFixed(1)} dB</span> · λ found {lobes.lambdas.map((l) => l.toFixed(1)).join(", ")}
          </div>
        </div>

        <svg viewBox={`0 0 ${W} 86`} className="w-full" role="img" aria-label={`Appearance bytes per Gaussian: SH degree ${L} ${shBytes(L)} bytes, ${k} lobes ${lobeBytes(k)} bytes, neural model 28 bytes.`}>
          <text x={12} y={11} fontSize={10} className="fill-muted-foreground font-mono">
            appearance bytes per Gaussian, RGB, as stored (base colour included)
          </text>
          {rows.map((r, i) => {
            const y = 18 + i * 22
            const w = (r.b / bMax) * 430
            return (
              <g key={r.label}>
                <text x={12} y={y + 12} fontSize={10} className="fill-foreground font-mono" fillOpacity={r.on ? 1 : 0.6}>
                  {r.label}
                </text>
                <rect x={130} y={y + 2} width={w} height={14} rx={2} fill={r.c} fillOpacity={r.on ? 0.8 : 0.35} />
                <text x={136 + w} y={y + 13} fontSize={10} className="fill-muted-foreground font-mono">
                  {r.b} B
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </figure>
  )
}
