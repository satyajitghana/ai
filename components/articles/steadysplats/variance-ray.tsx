"use client"

// One pixel, four Gaussians along its ray, and a stochastic renderer that
// shows the colour of exactly one of them per sample. Sorted alpha blending
// gives Gaussian i the weight P(i) = alpha_i * prod_{k in front}(1 - alpha_k);
// a one-sample stochastic renderer picks Gaussian i with that same
// probability, so its expected colour is the blended colour C and its noise
// power is Var = sum_i P(i) * ||c_i - C||^2 (SteadySplats, Eq. 6), plus the
// background's share. Averaging N samples divides that by N.
//
// The slider walks between two made-up fits of the SAME pixel colour: one
// where the optimiser matched it by blending disparate colours (what plain
// 3DGS training is free to do) and one where every Gaussian already carries
// roughly the target colour (what the L_var term pushes towards). The fourth
// Gaussian's colour is solved so that both fits composite to the same C.
// All numbers are illustrative, not from a trained scene. Random draws come
// from a seeded integer PRNG, so server and client render the same strip.

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

type RGB = [number, number, number]

const TARGET: RGB = [0.56, 0.55, 0.33]

// Plain fit: semi-transparent layers of bright, dark and tinted colours.
const LOOSE = {
  alpha: [0.45, 0.55, 0.5, 0.97],
  rgb: [
    [0.85, 0.85, 0.45],
    [0.1, 0.2, 0.04],
    [0.9, 0.7, 0.8],
  ] as RGB[],
}
// Variance-regularised fit: a near-opaque front Gaussian, colours near the target.
const TIGHT = {
  alpha: [0.88, 0.6, 0.35, 0.97],
  rgb: [
    [0.57, 0.56, 0.33],
    [0.52, 0.53, 0.3],
    [0.6, 0.57, 0.38],
  ] as RGB[],
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

type Fit = { alpha: number[]; rgb: RGB[]; P: number[]; bg: number; C: RGB; varTotal: number }

function fitAt(t: number): Fit {
  const alpha = LOOSE.alpha.map((a, i) => lerp(a, TIGHT.alpha[i], t))
  const rgb: RGB[] = LOOSE.rgb.map((c, i) => [0, 1, 2].map((ch) => lerp(c[ch], TIGHT.rgb[i][ch], t)) as RGB)
  let T = 1
  const P = alpha.map((a) => {
    const w = a * T
    T *= 1 - a
    return w
  })
  // Solve the last colour so the blend hits TARGET (background is black).
  const last = [0, 1, 2].map((ch) => {
    const front = P.slice(0, 3).reduce((acc, w, i) => acc + w * rgb[i][ch], 0)
    return clamp01((TARGET[ch] - front) / P[3])
  }) as RGB
  rgb.push(last)
  const C = [0, 1, 2].map((ch) => P.reduce((acc, w, i) => acc + w * rgb[i][ch], 0)) as RGB
  const d2 = (c: RGB) => (c[0] - C[0]) ** 2 + (c[1] - C[1]) ** 2 + (c[2] - C[2]) ** 2
  const varTotal = P.reduce((acc, w, i) => acc + w * d2(rgb[i]), 0) + T * d2([0, 0, 0])
  return { alpha, rgb, P, bg: T, C, varTotal }
}

// mulberry32, integer-only, so it is identical on server and client.
function rng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FRAMES = 18
const SPP = [1, 2, 4, 8, 16, 32, 64]

function frames(fit: Fit, n: number, seed: number): RGB[] {
  const u = rng(seed)
  const out: RGB[] = []
  for (let f = 0; f < FRAMES; f++) {
    const acc = [0, 0, 0]
    for (let s = 0; s < n; s++) {
      const x = u()
      let cum = 0
      let pick: RGB = [0, 0, 0]
      for (let i = 0; i < fit.P.length; i++) {
        cum += fit.P[i]
        if (x < cum) {
          pick = fit.rgb[i]
          break
        }
      }
      for (let ch = 0; ch < 3; ch++) acc[ch] += pick[ch] / n
    }
    out.push(acc as RGB)
  }
  return out
}

const css = (c: number[]) => `rgb(${c.map((v) => Math.round(clamp01(v) * 255)).join(",")})`

const W = 640
const H = 120

export function VarianceRay() {
  const [t, setT] = useState(0)
  const [sppIdx, setSppIdx] = useState(0)
  const [seed, setSeed] = useState(20261019)
  const n = SPP[sppIdx]

  const fit = useMemo(() => fitAt(t / 100), [t])
  const strip = useMemo(() => frames(fit, n, seed), [fit, n, seed])
  const rmse = Math.sqrt(fit.varTotal / n)
  const psnr = -10 * mlog10(fit.varTotal / (3 * n))

  const x0 = 60
  const dx = 125

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one pixel, sampled one Gaussian at a time</span>
        <span className="text-muted-foreground/60">illustrative numbers</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img">
            <title>
              A camera ray passes four Gaussians. Each is drawn with its colour; its fill strength shows its alpha and
              the label under it shows P, the share of samples it wins.
            </title>
            <line x1={20} y1={H / 2} x2={W - 20} y2={H / 2} className="stroke-muted-foreground" strokeDasharray="3 3" />
            <polygon points={`12,${H / 2 - 9} 28,${H / 2} 12,${H / 2 + 9}`} className="fill-foreground" />
            {fit.rgb.map((c, i) => (
              <g key={i}>
                <ellipse
                  cx={x0 + dx * (i + 0.5)}
                  cy={H / 2}
                  rx={20}
                  ry={36}
                  fill={css(c)}
                  fillOpacity={0.15 + fit.alpha[i] * 0.8}
                  stroke={css(c)}
                />
                <text x={x0 + dx * (i + 0.5)} y={13} fontSize={11} textAnchor="middle" className="fill-foreground font-mono">
                  {`α ${fit.alpha[i].toFixed(2)}`}
                </text>
                <text x={x0 + dx * (i + 0.5)} y={H - 3} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
                  {`P ${(fit.P[i] * 100).toFixed(1)}%`}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-3 space-y-1 font-mono text-[11px]">
          <div className="text-muted-foreground">share of samples each Gaussian wins (P), then the background</div>
          <div className="flex h-5 overflow-hidden rounded border">
            {fit.P.map((w, i) => (
              <div key={i} style={{ width: `${w * 100}%`, background: css(fit.rgb[i]) }} />
            ))}
            <div style={{ width: `${fit.bg * 100}%`, background: "rgb(0,0,0)" }} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>fit: plain 3DGS → variance-regularised</span>
              <span className="text-foreground">{`${t}%`}</span>
            </span>
            <Range min={0} max={100} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} className="mt-1 w-full" aria-label="Fit, from plain to variance-regularised" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>samples per pixel, N</span>
              <span className="text-foreground">{n}</span>
            </span>
            <Range min={0} max={SPP.length - 1} step={1} value={sppIdx} onChange={(e) => setSppIdx(Number(e.target.value))} className="mt-1 w-full" aria-label="Samples per pixel" />
          </label>
        </div>

        <div className="mt-4 font-mono text-[11px] text-muted-foreground">
          <div className="mb-1 flex items-center justify-between">
            <span>{`${FRAMES} frames of this pixel, each the mean of ${n} sample${n > 1 ? "s" : ""}`}</span>
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 text-[10px] transition-colors hover:text-foreground"
            >
              new noise
            </button>
          </div>
          <div className="flex items-stretch gap-2">
            <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: `repeat(${FRAMES}, minmax(0, 1fr))` }}>
              {strip.map((c, i) => (
                <div key={i} className="h-10 rounded-sm" style={{ background: css(c) }} />
              ))}
            </div>
            <div className="text-center">
              <div className="h-10 w-10 rounded border" style={{ background: css(fit.C) }} />
              <div className="mt-0.5 text-[10px]">sorted</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
          {[
            ["Var[c_r]", fit.varTotal.toFixed(3)],
            ["RMS error", rmse.toFixed(3)],
            ["PSNR vs sorted", `${psnr.toFixed(1)} dB`],
          ].map(([k, v]) => (
            <div key={k} className={cn("rounded-md border px-2 py-1.5")}>
              <div className="text-muted-foreground">{k}</div>
              <div className="text-sm text-foreground">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          Both ends of the slider blend to the same colour, so a sorted renderer cannot tell them apart. A stochastic
          one can: the error is the square root of Var divided by N, and only the variance term in training moves Var.
        </p>
      </div>
    </figure>
  )
}
