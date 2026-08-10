"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What the single new exponent k actually buys. The Skaling law is
//
//   L(N, D) = (A/N^a + B/D^b)^k + E        (Eq. 3)
//
// and k = 1 is exactly the additive Chinchilla law. The cleanest way to see
// the difference is to ask "how much does one more token buy?" at several
// model sizes. Under k = 1 the answer does not depend on N at all -- that is
// what a zero cross-derivative means. Under k != 1 it does.
//
// Coefficients are the paper's Farseer fit (Table 2): A=2.9e2, B=6.0e3,
// alpha=0.32, beta=0.39, E=0.03, fitted k=0.41. Sliding k here holds the other
// coefficients fixed, so this shows what k does to the surface -- it is not a
// refit.

const A = 290
const B = 6000
const AL = 0.32
const BE = 0.39
const K_FIT = 0.41

const SIZES = [
  { label: "100M", N: 1e8 },
  { label: "1B", N: 1e9 },
  { label: "10B", N: 1e10 },
]
const COLORS = ["oklch(0.58 0.19 25)", "oklch(0.68 0.13 85)", "oklch(0.60 0.15 255)"]

const D_LO = 1e9
const D_HI = 1e13

// marginal value of data: |dL / d ln D| = k * beta * (B/D^b) * R^(k-1)
function marginal(N: number, D: number, k: number): number {
  const rN = A / Math.pow(N, AL)
  const rD = B / Math.pow(D, BE)
  return k * BE * rD * Math.pow(rN + rD, k - 1)
}

export function CouplingKnob() {
  const [k, setK] = useState(K_FIT)

  const NPTS = 64
  const at = (i: number) => Math.exp(Math.log(D_LO) + (i / NPTS) * (Math.log(D_HI) - Math.log(D_LO)))

  const all = SIZES.flatMap((s) => Array.from({ length: NPTS + 1 }, (_, i) => marginal(s.N, at(i), k)))
  const vmax = Math.max(...all)
  const vmin = Math.min(...all)
  const y = (v: number) =>
    100 - ((Math.log(v) - Math.log(vmin)) / (Math.log(vmax) - Math.log(vmin) || 1)) * 92 - 4

  const curve = (N: number) =>
    Array.from({ length: NPTS + 1 }, (_, i) => `${(i / NPTS) * 100},${y(marginal(N, at(i), k))}`).join(" ")

  // spread between the smallest and largest model at a fixed D, as a coupling readout
  const dRef = 1e11
  const lo = marginal(SIZES[0].N, dRef, k)
  const hi = marginal(SIZES[2].N, dRef, k)
  const spread = hi / lo

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          L(N,D) = (A/N<sup>α</sup> + B/D<sup>β</sup>)<sup>k</sup> + E
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">arXiv 2608.07222, Eq. 3</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
            <span>what one more token buys — |∂L/∂ln D| — at three model sizes</span>
            <span className="tabular-nums">
              {spread > 1.02 || spread < 0.98
                ? `10B benefits ${spread.toFixed(2)}× as much as 100M`
                : "identical at every model size"}
            </span>
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full" role="img" aria-label="Three curves showing the marginal loss reduction per token against training data, one per model size; they lie on top of each other when k equals one and separate when k is below one">
            {SIZES.map((s, i) => (
              <polyline key={s.label} points={curve(s.N)} fill="none" stroke={COLORS[i]} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>D = 1B tokens</span>
            <span>D = 10T tokens</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
            {SIZES.map((s, i) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />
                N = {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">k</span>
          <Range
            min={0.25}
            max={1.4}
            step={0.01}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="min-w-[11rem] flex-1"
            aria-label="coupling exponent k"
            accent={COLORS[2]}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{k.toFixed(2)}</span>
          <button type="button" onClick={() => setK(1)} className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground">
            k = 1 · Chinchilla
          </button>
          <button type="button" onClick={() => setK(K_FIT)} className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground">
            k = 0.41 · fitted
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Set k = 1 and the three curves collapse onto one. That is the additive assumption stated in its most
          concrete form: <span className="text-foreground">how much a token is worth does not depend on how big
          your model is</span>. Written as a derivative, ∂²L/∂N∂D = 0, exactly and by construction — not because
          anyone measured it, but because a sum of a function of N and a function of D cannot have a cross term.
          Slide k below 1 and the curves separate: bigger models get more out of the same token. The fitted value on
          this data is <span className="text-foreground">0.41</span>, which is a long way from 1.
        </p>
      </div>
    </figure>
  )
}
