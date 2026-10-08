"use client"

import { useState } from "react"

import { mexpm1, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// What a bound O(n (log n)^(1-kappa)) buys over O(n log n), ignoring constants.
// The ratio of the two is (log n)^(-kappa). Write n = 2^(2^k), so log2 n = 2^k and
//   (log2 n)^kappa = exp(kappa * k * ln 2).
// The fraction of time saved is 1 - (log2 n)^(-kappa) = -expm1(-kappa * k * ln 2),
// computed with expm1 so tiny kappa does not vanish in cancellation.
// The kappa presets are the exact witnesses: OpenAI's manuscript (2^-182), Colkitt's
// checkpoints (2^-59, 2^-30), PR #13 (7699/10^10) and PR #44 (2050314627/(5*10^13)),
// the largest claim open when I read the repository. Hidden constants are not modelled:
// the real construction only starts below n log n at sizes far beyond the slider.

const PRESETS = [
  { id: "oai", label: "2^-182", sub: "OpenAI manuscript", kappa: 2 ** -182 },
  { id: "c59", label: "2^-59", sub: "Colkitt, Oct 7", kappa: 2 ** -59 },
  { id: "c30", label: "2^-30", sub: "Colkitt, Oct 8", kappa: 2 ** -30 },
  { id: "pr13", label: "7699/10^10", sub: "PR #13", kappa: 7699e-10 },
  { id: "pr44", label: "4.10e-5", sub: "PR #44", kappa: 4.100629254e-5 },
]

const LANDMARKS = [
  { k: 5, note: "n = 2^32 bits: a 4-billion-bit integer" },
  { k: 8, note: "n = 2^256 bits: about 10^77 bits, near one per atom in the observable universe" },
  { k: 64, note: "log2 n = 2^64: a number whose bit-length needs a 64-bit counter" },
]

function sci(v: number, digits = 3) {
  if (v === 0) return "0"
  const [m, e] = v.toExponential(digits).split("e")
  return `${m} × 10^${Number(e)}`
}

export function LogFactorCalculator() {
  const [pid, setPid] = useState("pr13")
  const [k, setK] = useState(8)
  const preset = PRESETS.find((p) => p.id === pid) ?? PRESETS[0]
  const ln2 = mlog(2)
  const x = preset.kappa * k * ln2
  const saved = -mexpm1(-x) // fraction of time saved vs n log n
  const factorMinusOne = mexpm1(x) // (log n)^kappa - 1
  // log2 log2 n needed for a 1% saving and for a factor of two
  const kFor1pct = -mlog(0.99) / (preset.kappa * ln2)
  const kFor2x = 1 / preset.kappa

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-3 font-mono text-xs text-muted-foreground">
        What (log n)^κ takes off n log n, before constants
      </figcaption>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Choose kappa">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPid(p.id)}
            aria-pressed={pid === p.id}
            className={cn(
              "rounded-md border px-2 py-1 text-left font-mono text-xs",
              pid === p.id ? "border-foreground text-foreground" : "border-border text-muted-foreground",
            )}
          >
            κ = {p.label}
            <span className="block text-[10px] opacity-70">{p.sub}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-mono text-xs text-muted-foreground">n = 2^(2^{k})</span>
        <Range min={3} max={64} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-56" aria-label="log2 log2 n" />
      </label>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        log₂ n = 2^{k}. {LANDMARKS.find((l) => Math.abs(l.k - k) < 0.5)?.note ?? ""}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-3">
        <div className="rounded-md border border-border p-2">
          <dt className="text-muted-foreground">(log n)^κ − 1</dt>
          <dd className="mt-1 text-base">{sci(factorMinusOne)}</dd>
        </div>
        <div className="rounded-md border border-border p-2">
          <dt className="text-muted-foreground">time saved vs n log n</dt>
          <dd className="mt-1 text-base">{sci(saved * 100)} %</dd>
        </div>
        <div className="rounded-md border border-border p-2">
          <dt className="text-muted-foreground">log₂ n for a 2× saving</dt>
          <dd className="mt-1 text-base">2^({sci(kFor2x, 2)})</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        A 1% saving needs log₂ n = 2^({sci(kFor1pct, 2)}). The slider stops at log₂ n = 2^64. Constants are not in this model, and the real
        construction&apos;s are astronomically large.
      </p>
    </figure>
  )
}
