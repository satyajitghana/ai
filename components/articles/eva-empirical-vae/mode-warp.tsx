"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"

// An illustration of Section 3.3 of the EVA paper (arXiv 2610.06545), built
// from its toy's observation spacing (modes 2.4 apart, sigma_x = 0.05, from
// Appendix B.1) but with hand-built predictors rather than trained ones:
//   - AR + MSE: the squared-error optimum is the conditional mean (Eq. 24).
//   - AR + GMM, K = 3: exact when the target has <= 3 modes; otherwise each
//     component has to cover a contiguous group of modes (Eq. 25).
//   - latent Gaussian: z ~ N(0, 1) pushed through a smooth staircase decoder
//     x = o_1 + sum_k 2.4 * sigmoid(sharpness * (z - q_k)), q_k the Gaussian
//     quantile at k / M. This is the continuous mixture of Eq. 26 in its
//     simplest form: one Gaussian in latent space, many modes after decoding.
// "Between modes" is the share of probability mass farther than 0.3 from every
// true mode centre.

const SPACING = 2.4
const SIGMA_X = 0.05
const LO = -7.5
const HI = 7.5
const BINS = 120
const NZ = 3000
const GAP = 0.3

// Acklam's rational approximation to the inverse normal CDF.
function invPhi(p: number) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  if (p < pl) {
    const q = Math.sqrt(-2 * mlog(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * mlog(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

const Z = Array.from({ length: NZ }, (_, i) => invPhi((i + 0.5) / NZ))

function centres(m: number) {
  return Array.from({ length: m }, (_, k) => (k - (m - 1) / 2) * SPACING)
}

function gauss(x: number, mu: number, s: number) {
  const t = (x - mu) / s
  return mexp(-0.5 * t * t) / (s * 2.5066282746310002)
}

// Probability mass per bin from a mixture density, integrated at 8 points a bin.
function massFromMixture(comps: { w: number; mu: number; s: number }[]) {
  const bw = (HI - LO) / BINS
  const out = new Array<number>(BINS).fill(0)
  for (let i = 0; i < BINS; i++) {
    let acc = 0
    for (let j = 0; j < 8; j++) {
      const x = LO + (i + (j + 0.5) / 8) * bw
      for (const c of comps) acc += c.w * gauss(x, c.mu, c.s)
    }
    out[i] = (acc / 8) * bw
  }
  return out
}

function massFromSamples(xs: number[]) {
  const bw = (HI - LO) / BINS
  const out = new Array<number>(BINS).fill(0)
  for (const x of xs) {
    const i = Math.floor((x - LO) / bw)
    if (i >= 0 && i < BINS) out[i] += 1 / xs.length
  }
  return out
}

function betweenShare(mass: number[], cs: number[]) {
  const bw = (HI - LO) / BINS
  let s = 0
  mass.forEach((m, i) => {
    const x = LO + (i + 0.5) * bw
    if (cs.every((c) => Math.abs(x - c) > GAP)) s += m
  })
  return s
}

type Row = { name: string; note: string; mass: number[]; spike?: number; between: number }

export function ModeWarp() {
  const [modes, setModes] = useState(4)
  const [sharpI, setSharpI] = useState(30)
  const sharp = sharpI

  const rows = useMemo<Row[]>(() => {
    const cs = centres(modes)
    const target = massFromMixture(cs.map((mu) => ({ w: 1 / modes, mu, s: SIGMA_X })))

    // AR + MSE: a point at the conditional mean, which is 0 by symmetry.
    const mean = cs.reduce((a, b) => a + b, 0) / modes
    const bw = (HI - LO) / BINS
    const spikeBin = Math.floor((mean - LO) / bw)
    const ar = new Array<number>(BINS).fill(0)
    ar[spikeBin] = 1

    // GMM with K = 3: contiguous groups of modes, each covered by one Gaussian.
    const K = 3
    const groups: number[][] = []
    if (modes <= K) cs.forEach((c) => groups.push([c]))
    else {
      let start = 0
      for (let g = 0; g < K; g++) {
        const size = Math.floor(modes / K) + (g < modes % K ? 1 : 0)
        groups.push(cs.slice(start, start + size))
        start += size
      }
    }
    const gmm = massFromMixture(
      groups.map((g) => {
        const mu = g.reduce((a, b) => a + b, 0) / g.length
        const v = g.reduce((a, b) => a + (b - mu) * (b - mu), 0) / g.length
        return { w: g.length / modes, mu, s: Math.sqrt(v + SIGMA_X * SIGMA_X) }
      }),
    )

    // Latent Gaussian through a staircase decoder.
    const qs = Array.from({ length: modes - 1 }, (_, k) => invPhi((k + 1) / modes))
    const xs = Z.map((z) => {
      let x = cs[0]
      for (const q of qs) x += SPACING / (1 + mexp(-sharp * (z - q)))
      return x
    })
    const lat = massFromSamples(xs)

    return [
      { name: "target", note: `${modes} modes`, mass: target, between: betweenShare(target, cs) },
      { name: "AR + MSE", note: "predicts the mean", mass: ar, spike: spikeBin, between: betweenShare(ar, cs) },
      { name: "AR + GMM, K=3", note: modes <= 3 ? "enough components" : "too few components", mass: gmm, between: betweenShare(gmm, cs) },
      { name: "one Gaussian in z, decoded", note: `sharpness ${sharp}`, mass: lat, between: betweenShare(lat, cs) },
    ]
  }, [modes, sharp])

  const W = 600
  const RH = 54
  const ACC = "oklch(0.62 0.15 160)"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">next-token families · after the paper&apos;s Section 3.3</span>
        <span className="font-mono text-[10px] text-muted-foreground">hand-built predictors, not trained models</span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>modes in the next token</span>
              <span className="text-base font-semibold" style={{ color: ACC }}>
                {modes}
              </span>
            </span>
            <Range min={1} max={6} step={1} value={modes} accent={ACC}
              onChange={(e) => setModes(Number(e.target.value))}
              aria-label="Number of modes in the target distribution" className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>decoder sharpness</span>
              <span className="text-base font-semibold" style={{ color: ACC }}>
                {sharp}
              </span>
            </span>
            <Range min={1} max={60} step={1} value={sharpI} accent={ACC}
              onChange={(e) => setSharpI(Number(e.target.value))}
              aria-label="Sharpness of the decoder's staircase" className="mt-1 w-full" />
          </label>
        </div>

        <div className="space-y-2">
          {rows.map((r) => {
            const peak = Math.max(...r.mass, 1e-9)
            const bw = W / BINS
            return (
              <div key={r.name}>
                <div className="flex items-baseline justify-between font-mono text-[11px]">
                  <span>
                    {r.name} <span className="text-muted-foreground">· {r.note}</span>
                  </span>
                  <span className="text-muted-foreground">between modes {(r.between * 100).toFixed(1)}%</span>
                </div>
                <svg viewBox={`0 0 ${W} ${RH}`} className="mt-0.5 h-12 w-full rounded border bg-background" preserveAspectRatio="none"
                  role="img" aria-label={`${r.name}: ${(r.between * 100).toFixed(1)}% of mass between modes`}>
                  {r.mass.map((m, i) => {
                    const h = r.spike !== undefined ? (m > 0 ? RH - 4 : 0) : (m / peak) * (RH - 4)
                    return h > 0.2 ? (
                      <rect key={i} x={(i * bw).toFixed(2)} y={(RH - h).toFixed(2)} width={(bw * 0.9).toFixed(2)}
                        height={h.toFixed(2)} fill={r.name === "target" ? "oklch(0.62 0.13 250)" : ACC} fillOpacity={0.8} />
                    ) : null
                  })}
                </svg>
              </div>
            )
          })}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A squared-error regressor collapses any multimodal next token to its mean, which for an even number of
          modes lands exactly where no data is. A three-component mixture is exact up to three modes and smears
          beyond. A single Gaussian in latent space, pushed through a decoder that bends steeply between modes,
          produces any number of them; how much leaks between modes depends on how sharp that bend is. The
          finite-sharpness leak is the same kind of inter-mode scatter the paper&apos;s Figure 3 shows for both
          latent models.
        </p>
      </div>
    </figure>
  )
}
