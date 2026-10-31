"use client"

// One hexel in its own (u, v) plane, drawn exactly as the paper defines it:
//   d(u,v) = max(|v|, |sqrt(3)/2 u + v/2|, |sqrt(3)/2 u - v/2|) - 1      (Eq. 2)
//   K(u,v) = sigmoid(-beta d(u,v))                                        (Eq. 3)
//   c(u,v) = c0 + u g_u + v g_v                                           (Eq. 4)
//   alpha  = min(o K, 0.99)                                               (Section 3, Splatting)
// The two dashed outlines are the rasteriser cut-offs (Appendix B, Eq. 18-19): a contribution below
// 1/255 is skipped, which happens outside d = log(254)/beta at full opacity (outer outline) and outside
// d = log(o/tau - 1)/beta at the learned opacity o (inner outline). The colour ramp here is illustrative.
// The Gaussian row compares a 2DGS-style Gaussian of sigma equal to the hexagon's inradius: that is a
// same-nominal-size comparison, not a same-quality one.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"

const SQ3 = Math.sqrt(3)
const R = 2 / SQ3 // circumradius of the canonical hexagon (inradius 1)
const TAU = 1 / 255
const LN254 = mlog(254)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const hexD = (u: number, v: number) => Math.max(Math.abs(v), Math.abs((SQ3 / 2) * u + v / 2), Math.abs((SQ3 / 2) * u - v / 2)) - 1
const sigmoid = (a: number) => 1 / (1 + mexp(-a))
const hexPoints = (k: number) =>
  [
    [R * k, 0],
    [(R / 2) * k, k],
    [(-R / 2) * k, k],
    [-R * k, 0],
    [(-R / 2) * k, -k],
    [(R / 2) * k, -k],
  ]
    .map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`)
    .join(" ")

const N = 41
const LIM = 2.6
const STEP = (2 * LIM) / N
const CELLS = Array.from({ length: N * N }, (_, i) => {
  const a = i % N
  const b = Math.floor(i / N)
  return { u: -LIM + (a + 0.5) * STEP, v: -LIM + (b + 0.5) * STEP }
})

const C0 = [0.55, 0.52, 0.5]
const GU = [0.4, -0.12, -0.3]
const GV = [-0.18, 0.34, 0.3]

export function HexelAnatomy() {
  const [beta, setBeta] = useState(10)
  const [opacity, setOpacity] = useState(0.9)
  const [ratio, setRatio] = useState(1)
  const [rot, setRot] = useState(0)
  const [ramp, setRamp] = useState(0.8)

  const su = ratio >= 1 ? 1 : ratio
  const sv = ratio >= 1 ? 1 / ratio : 1
  const sMax = Math.max(su, sv)
  const k = 62 / sMax / 1.6 // pixels per local unit, keeping the cut-off outline in view

  const raw = CELLS.map((c) => {
    const d = hexD(c.u, c.v)
    return { ...c, d, K: sigmoid(-beta * d) }
  })
  const massIn = raw.filter((c) => c.d <= 0).reduce((a, c) => a + c.K, 0)
  const massOut = raw.filter((c) => c.d > 0).reduce((a, c) => a + c.K, 0)
  const cells = raw.map((c) => {
    const alpha = Math.min(opacity * c.K, 0.99)
    const col = [0, 1, 2].map((ch) => clamp01(C0[ch] + ramp * (c.u * GU[ch] * 0.5 + c.v * GV[ch] * 0.5)))
    return { u: c.u, v: c.v, alpha, fill: `rgb(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)})` }
  })
  const outsideShare = massOut / (massIn + massOut)

  const rhoMax = 1 + LN254 / beta
  const rhoTight = opacity > TAU ? 1 + mlog(opacity / TAU - 1) / beta : 0
  const circle = R * rhoMax
  const gaussCut = Math.sqrt(2 * mlog(255 * opacity))
  const ratioArea = (gaussCut / circle) * (gaussCut / circle)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4" role="group" aria-label="Interactive hexel: sharpness, opacity, shape and colour ramp">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <svg viewBox="-150 -150 300 300" className="mx-auto w-full max-w-[26rem]" role="img" aria-label="A hexagonal patch with a soft edge and a colour ramp, with the rasteriser cut-off outlines">
          <rect x="-150" y="-150" width="300" height="300" rx="10" className="fill-muted/30" />
          <g transform={`rotate(${rot}) scale(${k * su} ${k * sv})`}>
            {cells.map((c, i) => (
              <rect key={i} x={c.u - STEP / 2} y={c.v - STEP / 2} width={STEP + 0.002} height={STEP + 0.002} fill={c.fill} fillOpacity={c.alpha} />
            ))}
            <polygon points={hexPoints(1)} fill="none" stroke="currentColor" strokeWidth={1.4 / (k * sMax)} />
            <polygon points={hexPoints(rhoMax)} fill="none" stroke="currentColor" strokeWidth={1 / (k * sMax)} strokeDasharray={`${4 / (k * sMax)} ${3 / (k * sMax)}`} opacity={0.65} />
            {rhoTight > 1 ? (
              <polygon points={hexPoints(rhoTight)} fill="none" stroke="currentColor" strokeWidth={1 / (k * sMax)} strokeDasharray={`${1.5 / (k * sMax)} ${3 / (k * sMax)}`} opacity={0.65} />
            ) : null}
          </g>
          <circle r={circle * k * sMax} fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.35" strokeDasharray="2 4" />
          <circle r="2" fill="currentColor" />
        </svg>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span>
              Edge sharpness <code>β</code> = {beta}
            </span>
            <Range min={2} max={40} step={1} value={beta} onChange={(e) => setBeta(Number(e.target.value))} aria-label="Edge sharpness beta" />
          </label>
          <label className="flex flex-col gap-1">
            <span>
              Opacity <code>o</code> = {opacity.toFixed(2)}
            </span>
            <Range min={0.05} max={1} step={0.01} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="Opacity" />
          </label>
          <label className="flex flex-col gap-1">
            <span>
              Shape <code>s_u / s_v</code> = {ratio.toFixed(2)}
            </span>
            <Range min={0.4} max={2.5} step={0.05} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} aria-label="Scale ratio" />
          </label>
          <label className="flex flex-col gap-1">
            <span>Rotation = {rot}°</span>
            <Range min={0} max={179} step={1} value={rot} onChange={(e) => setRot(Number(e.target.value))} aria-label="Rotation in degrees" />
          </label>
          <label className="flex flex-col gap-1">
            <span>Colour ramp = {ramp === 0 ? "off (constant colour)" : ramp.toFixed(2)}</span>
            <Range min={0} max={1.6} step={0.05} value={ramp} onChange={(e) => setRamp(Number(e.target.value))} aria-label="Colour ramp strength" />
          </label>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Cut-off, inradius units</dt>
          <dd className="font-mono">{rhoMax.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Bounding circle radius</dt>
          <dd className="font-mono">{circle.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Edge mass outside d = 0</dt>
          <dd className="font-mono">{(outsideShare * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Gaussian σ = inradius, same cut-off</dt>
          <dd className="font-mono">{gaussCut.toFixed(2)} ({ratioArea.toFixed(1)}× the area)</dd>
        </div>
      </dl>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Solid outline: the hexagon d = 0. Long dashes: where K falls below 1/255 at full opacity, which is what the rasteriser uses to pick tiles. Short dashes: the same test at the opacity you set. Faint circle: the
        bounding circle that goes to the tile assignment. Constants and formulas are the paper&apos;s (Eq. 2-4, 18-19); the colours are illustrative and the Gaussian row is a same-nominal-size comparison.
      </figcaption>
    </figure>
  )
}
