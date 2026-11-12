import { mexp } from "@/lib/dmath"

// Spaghetti Splatting's primitive, reduced to the image plane: a segment of
// length L with unit mass, convolved with an isotropic Gaussian of width sigma.
// The paper's 3D version has the same structure: along the segment the
// convolution integrates to a difference of two error functions, across it the
// kernel's Gaussian fall-off is untouched.

const SQRT2 = Math.SQRT2
const SQRT2PI = Math.sqrt(2 * Math.PI)

// Abramowitz & Stegun 7.1.26, |error| < 1.5e-7: plenty for a picture.
export function erf(x: number): number {
  const s = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      mexp(-a * a)
  return s * y
}

// Density of a unit-mass segment from (a, 0) to (b, 0) convolved with N(0, sigma^2 I).
export function segmentDensity(x: number, y: number, a: number, b: number, sigma: number): number {
  const across = mexp(-(y * y) / (2 * sigma * sigma)) / (SQRT2PI * sigma)
  const L = b - a
  if (L < 1e-9) {
    const dx = x - a
    return (mexp(-(dx * dx) / (2 * sigma * sigma)) / (SQRT2PI * sigma)) * across
  }
  const along = (erf((x - a) / (sigma * SQRT2)) - erf((x - b) / (sigma * SQRT2))) / (2 * L)
  return along * across
}

// The same mass as K equally spaced Gaussian points on [0, L]: what 3DGS
// needs to draw the line.
export function pointsDensity(x: number, y: number, L: number, K: number, sigma: number): number {
  let sum = 0
  for (let k = 0; k < K; k++) {
    const c = K === 1 ? L / 2 : (k * L) / (K - 1)
    sum += segmentDensity(x, y, c, c, sigma)
  }
  return sum / K
}

// Peak-to-trough ripple along the middle half of the centre line, as a
// percentage of the mean there. A segment has none; points have some until
// their spacing drops to about two sigma.
export function ripple(L: number, K: number, sigma: number, samples = 401): number {
  let lo = Infinity
  let hi = -Infinity
  let sum = 0
  for (let i = 0; i < samples; i++) {
    const x = L / 4 + (i / (samples - 1)) * (L / 2)
    const v = pointsDensity(x, 0, L, K, sigma)
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
    sum += v
  }
  const mean = sum / samples
  return (100 * (hi - lo)) / mean
}

// Split the segment at its midpoint into two halves of half the mass each and
// return the largest difference from the parent, relative to the parent's
// peak. Linearity makes it zero up to rounding.
export function splitError(L: number, sigma: number, samples = 401): number {
  let worst = 0
  let peak = 0
  for (let i = 0; i < samples; i++) {
    const x = -2 * sigma + (i / (samples - 1)) * (L + 4 * sigma)
    const parent = segmentDensity(x, 0, 0, L, sigma)
    const halves = 0.5 * segmentDensity(x, 0, 0, L / 2, sigma) + 0.5 * segmentDensity(x, 0, L / 2, L, sigma)
    worst = Math.max(worst, Math.abs(parent - halves))
    peak = Math.max(peak, parent)
  }
  return worst / peak
}
