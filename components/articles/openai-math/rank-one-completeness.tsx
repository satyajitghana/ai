"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The completeness obstacle in the Unique Games paper (family 102, Section 1.4),
// simulated. An honest table is the evaluation f_z(M) = M z of a binary
// ℓ-by-m matrix at a fixed nonzero answer z. The rank-one test of Barak,
// Kothari and Steurer perturbs M to M + a l^T and asks for the same answer.
// Since f_z(M + a l^T) - f_z(M) = a (l^T z), the honest table passes exactly
// when l^T z = 0 or a = 0, which happens with probability (1 + 2^-ℓ)/2.
// The paper's latent gadget (Lemma 3.1) replaces the uniform a by a hidden
// noise law μ on a larger space V and reads the answer through a nonlinear map
// C with C(x + a) = C(x) except with probability at most p, so honest
// acceptance becomes at least 1 - p/2. That gadget is not simulated here: its
// construction (recursive quadratic blocks over F_{2^d}) has no small instance.
// Trials use a seeded generator, so server and client render the same numbers.

const M_COLS = 6
const TRIALS = 4000
const DOTS = 240

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

function parity(x: number): number {
  let v = x
  let p = 0
  while (v) {
    p ^= v & 1
    v >>>= 1
  }
  return p
}

function simulate(ell: number, seed: number) {
  const rnd = mulberry32(seed)
  const bits = (k: number) => Math.floor(rnd() * (1 << k))
  const outcomes: boolean[] = []
  let pass = 0
  for (let t = 0; t < TRIALS; t++) {
    let z = 0
    while (z === 0) z = bits(M_COLS) // a fixed nonzero answer
    const l = bits(M_COLS) // the update's column selector
    const a = bits(ell) // the update's left factor, uniform in F_2^ℓ
    const ok = parity(l & z) === 0 || a === 0
    if (ok) pass++
    if (t < DOTS) outcomes.push(ok)
  }
  return { rate: pass / TRIALS, outcomes }
}

function pct(x: number): string {
  return `${(Math.round(x * 1000) / 10).toFixed(1)}%`
}

export function RankOneCompleteness() {
  const [ell, setEll] = useState(4)
  const [p, setP] = useState(0.05)
  const [seed, setSeed] = useState(7)

  const { rate, outcomes } = useMemo(() => simulate(ell, seed), [ell, seed])
  const exact = (1 + 1 / (1 << ell)) / 2
  const latent = 1 - p / 2

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            answer-space dimension ℓ = <span className="font-mono text-foreground">{ell}</span>
          </span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={ell}
            onChange={(e) => setEll(Number(e.target.value))}
            aria-label="answer-space dimension"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            latent gadget error p = <span className="font-mono text-foreground">{p.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0.01}
            max={0.3}
            step={0.01}
            value={p}
            onChange={(e) => setP(Number(e.target.value))}
            aria-label="latent gadget error"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">
            ordinary rank-one test, honest table, first {DOTS} of {TRIALS} trials
          </div>
          <div className="mt-2 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5" aria-hidden="true">
            {outcomes.map((ok, i) => (
              <span
                key={i}
                className={cn(
                  "aspect-square rounded-[2px]",
                  ok ? "bg-emerald-500/70 dark:bg-emerald-400/70" : "bg-rose-500/70 dark:bg-rose-400/70",
                )}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 text-sm">
            <span>
              simulated <span className="font-mono">{pct(rate)}</span>
            </span>
            <span className="text-muted-foreground">
              formula (1 + 2<sup>−ℓ</sup>)/2 = <span className="font-mono">{pct(exact)}</span>
            </span>
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              reroll
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          {[
            { label: "ordinary test (2018 shortcode)", v: exact, cls: "bg-amber-500/70 dark:bg-amber-400/70" },
            { label: "latent-noise test, Lemma 3.1 bound", v: latent, cls: "bg-emerald-500/70 dark:bg-emerald-400/70" },
            { label: "Unique Games needs", v: 0.99, cls: "bg-sky-500/70 dark:bg-sky-400/70" },
          ].map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{b.label}</span>
                <span className="font-mono">{b.label === "Unique Games needs" ? "≈ 1 − ε" : pct(b.v)}</span>
              </div>
              <div className="mt-1 h-3 w-full rounded-sm bg-zinc-400/20">
                <div className={cn("h-3 rounded-sm transition-all", b.cls)} style={{ width: `${b.v * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="mt-4 text-xs text-muted-foreground">
        An honest prover answers M&nbsp;z; the test adds a rank-one matrix a&nbsp;l<sup>T</sup> and checks the answer
        did not move. It moves by a(l<sup>T</sup>z), and l<sup>T</sup>z is a fair coin, so honest provers fail about
        half the time however large ℓ is. The paper&apos;s fix hides the noise a inside a larger space and reads answers
        through a nonlinear map that absorbs it except with probability p; the right-hand bar is the paper&apos;s
        bound, not a simulation.
      </figcaption>
    </figure>
  )
}
