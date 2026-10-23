"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"

// Every policy-gradient loss here has the same gradient shape,
//   grad = sum_t c_t * A_t * grad log p(x_t)   (plus, for StableReinforce, the KL term),
// and differs only in the coefficient it puts in front. This dial shows that
// coefficient for one sampled token as its log-ratio log(p/q) moves.
// Formulas follow Tinker's loss docs (importance_sampling, ppo, cispo) and the
// TIS / MIS definitions in Qi et al. 2025 (arXiv 2510.26788).

const CAP = 8 // bars are drawn to this magnitude; beyond it they show an overflow tick
const BETA = 0.01

type Row = { id: string; label: string; c: (r: number, a: number) => number; note: string }

const ROWS: Row[] = [
  { id: "rf", label: "REINFORCE", c: (_r, a) => a, note: "ignores q entirely" },
  {
    id: "sr",
    label: "StableReinforce, KL term only",
    c: (_r, a) => a + BETA,
    note: "+β on every sampled token; main term unpublished",
  },
  { id: "is", label: "IS (Tinker importance_sampling)", c: (r, a) => r * a, note: "unbounded in r" },
  {
    id: "ppo",
    label: "PPO, ε 0.2",
    c: (r, a) => ((a > 0 && r < 1.2) || (a < 0 && r > 0.8) ? r * a : 0),
    note: "zero outside the band, except A<0 with r>1",
  },
  { id: "cispo", label: "CISPO, clip [0, 4]", c: (r, a) => Math.min(Math.max(r, 0), 4) * a, note: "bounded, never zero" },
  { id: "tis", label: "Token TIS, C = 2", c: (r, a) => Math.min(r, 2) * a, note: "truncate, keep the token" },
  { id: "mis", label: "Sequence MIS, C = 2", c: (r, a) => (r <= 2 ? r * a : 0), note: "mask the whole sequence" },
]

export function CoefficientDial() {
  const [lr10, setLr10] = useState(20) // log(p/q) * 10, from -40 to 40
  const [adv, setAdv] = useState<1 | -1>(-1)
  const logr = lr10 / 10
  const r = mexp(logr)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one token, seven coefficients</span>
        <span className="text-muted-foreground/60">from the published formulas</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>log p/q for this token</span>
              <span className="text-foreground">
                {logr.toFixed(1)} → r = {r < 100 ? r.toFixed(2) : r.toFixed(0)}
              </span>
            </div>
            <Range
              min={-40}
              max={40}
              step={1}
              value={lr10}
              onChange={(e) => setLr10(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Log ratio of learner to sampler probability"
            />
          </div>
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">advantage</div>
            <div className="flex gap-1.5">
              {([1, -1] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAdv(a)}
                  aria-pressed={adv === a}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${
                    adv === a ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  A = {a > 0 ? "+1" : "−1"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          {ROWS.map((row) => {
            const c = row.c(r, adv)
            const mag = Math.abs(c)
            const w = (Math.min(mag, CAP) / CAP) * 100
            const over = mag > CAP
            const hot = mag > 4
            const color = hot ? "oklch(0.62 0.2 25)" : c === 0 ? "var(--border)" : "oklch(0.6 0.14 250)"
            return (
              <div key={row.id} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-2 font-mono text-[11px]">
                <span className="truncate text-foreground" title={row.note}>
                  {row.label}
                </span>
                <div className="relative h-3.5 rounded bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${w.toFixed(1)}%`, background: color }} />
                  {over ? <div className="absolute inset-y-0 right-0 w-1 rounded bg-foreground/70" /> : null}
                </div>
                <span className="text-right" style={{ color: hot ? color : undefined }}>
                  {mag < 1000 ? c.toFixed(2) : c.toExponential(1)}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The bar is the size of the step one token gets, in units of its advantage. Drag the ratio to 4 with a negative
          advantage: importance sampling and PPO both hand this one token a coefficient of about 55, because PPO&apos;s
          min only clips the side that helps. CISPO and TIS cap it; MIS drops it. REINFORCE never looks at the ratio,
          so it can&apos;t blow up, and it can&apos;t correct for drift either.
        </p>
      </div>
    </figure>
  )
}
