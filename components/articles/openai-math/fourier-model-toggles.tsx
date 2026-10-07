"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Which n log n lower bound for the DFT applies under which modelling choices,
// and where the OpenAI release's claims sit. Every bound's hypotheses are taken
// from its own abstract or statement:
//   Morgenstern 1973 (JACM 20(2)): linear algorithms with bounded coefficients,
//     unnormalized transform; determinant n^(n/2) grows by a bounded factor per gate.
//   Ailon 2013 (arXiv:1305.4745): layered circuits of unitary 2×2 gates, exactly n
//     registers, normalized transform.
//   Ailon 2014 (arXiv:1403.1307): any scaling of the transform; every intermediate
//     composition R-well-conditioned; extra space allowed if it holds bounded-norm data
//     at the end. Bound Ω(n log n / R).
//   OpenAI, "Finite tensor savings…" Thm 1.1: unrestricted complex linear circuits →
//     liminf L(n)/(n log2 n) = 0 (Lean statement OAI.ExactFourier.main_theorem).
//   OpenAI, "An explicit power saving…" Thm 1.1: same freedoms plus a supplied root,
//     uniform, every n, O(n (log n)^θ (log log n)^(4−θ)); not formalized.

type Key = "coeff" | "gates" | "space" | "cond" | "scale" | "arith"

const OPTIONS: Record<Key, { label: string; off: string; on: string }> = {
  coeff: { label: "Coefficients", off: "bounded, |c| ≤ 1", on: "any complex number" },
  gates: { label: "Gates", off: "unitary 2×2 only", on: "add, subtract, scale" },
  space: { label: "Registers", off: "exactly n", on: "extra workspace" },
  cond: { label: "Intermediate conditioning", off: "bounded by R", on: "unrestricted" },
  scale: { label: "Transform", off: "normalized F/√n", on: "unnormalized F" },
  arith: { label: "Arithmetic", off: "floating point", on: "exact" },
}

type State = Record<Key, boolean> // true = the permissive choice

const PRESETS: { name: string; s: State }[] = [
  { name: "Morgenstern", s: { coeff: false, gates: true, space: true, cond: true, scale: true, arith: true } },
  { name: "Ailon 2013", s: { coeff: true, gates: false, space: false, cond: true, scale: false, arith: true } },
  { name: "Ailon 2014", s: { coeff: true, gates: true, space: true, cond: false, scale: false, arith: true } },
  { name: "OpenAI release", s: { coeff: true, gates: true, space: true, cond: true, scale: true, arith: true } },
  { name: "FFTW / cuFFT", s: { coeff: false, gates: true, space: true, cond: false, scale: true, arith: false } },
]

const GOOD = "oklch(0.62 0.16 150)"
const BAD = "oklch(0.60 0.19 25)"
const OPEN = "oklch(0.70 0.14 80)"

function bounds(s: State) {
  return [
    {
      name: "Morgenstern (1973)",
      result: "Ω(n log n) gates",
      applies: !s.coeff && s.scale,
      why: s.coeff
        ? "needs bounded coefficients; large ones can grow the determinant freely"
        : !s.scale
          ? "the normalized transform has determinant of modulus 1, so the potential starts at zero"
          : "bounded coefficients and the unnormalized F: det = n^(n/2) must be built up",
    },
    {
      name: "Ailon (2013)",
      result: "Ω(n log n) gates",
      applies: !s.gates && !s.space && !s.scale,
      why:
        s.gates || s.space || s.scale
          ? "needs unitary 2×2 gates, exactly n registers and the normalized transform"
          : "matrix entropy rises by at most a constant per unitary gate",
    },
    {
      name: "Ailon (2014)",
      result: "Ω(n log n / R)",
      applies: !s.cond,
      why: s.cond
        ? "needs every intermediate map R-well-conditioned"
        : "quasi-entropy argument; any scaling, extra bounded-norm space allowed",
    },
  ]
}

function verdict(s: State, applying: number) {
  if (applying > 0) return { text: "An n log n lower bound is proved here.", color: BAD }
  if (s.coeff && s.gates && s.cond && s.scale)
    return {
      text: "o(n log n) is claimed here: Lean-checked along a subsequence of n; the all-n δ = 10^−13 algorithm is paper-only.",
      color: GOOD,
    }
  if (s.coeff && s.gates && s.cond && !s.scale)
    return {
      text: "Also covered by the claim: with unbounded coefficients, rescaling F to F/√n costs only O(n) extra gates.",
      color: GOOD,
    }
  return { text: "Open: no proved lower bound and no sub-n log n construction for this combination.", color: OPEN }
}

export function FourierModelToggles() {
  const [s, setS] = useState<State>(PRESETS[3].s)
  const bs = bounds(s)
  const applying = bs.filter((b) => b.applies).length
  const v = verdict(s, applying)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-3 font-mono text-xs text-muted-foreground">
        Which DFT lower bound survives which modelling choice
      </figcaption>

      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Presets">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setS(p.s)}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs",
              JSON.stringify(p.s) === JSON.stringify(s) ? "border-foreground text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(OPTIONS) as Key[]).map((k) => (
          <div key={k} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">{OPTIONS[k].label}</span>
            <div className="flex overflow-hidden rounded-md border border-border font-mono text-[11px]" role="group" aria-label={OPTIONS[k].label}>
              {[false, true].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  aria-pressed={s[k] === val}
                  onClick={() => setS({ ...s, [k]: val })}
                  className={cn("px-2 py-1", s[k] === val ? "bg-foreground text-background" : "text-muted-foreground")}
                >
                  {val ? OPTIONS[k].on : OPTIONS[k].off}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {bs.map((b) => (
          <li key={b.name} className="flex items-start gap-3 text-sm">
            <span
              className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: b.applies ? BAD : "var(--border)" }}
              aria-hidden
            />
            <span>
              <span className="font-medium">{b.name}</span>{" "}
              <span className="font-mono text-xs">{b.result}</span>{" "}
              <span className={cn("text-xs", b.applies ? "text-foreground" : "text-muted-foreground")}>
                {b.applies ? "applies: " : "does not apply: "}
                {b.why}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: v.color }}>
        {v.text}
      </p>
      {!s.arith ? (
        <p className="mt-2 text-xs text-muted-foreground">
          In floating point none of these theorems speak to wall-clock FFTs, and the release makes no
          precision claim: one ingredient, the Newton factorization of F₆₄, loses every digit in float64.
        </p>
      ) : null}
    </figure>
  )
}
