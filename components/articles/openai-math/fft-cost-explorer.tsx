"use client"

import { useState } from "react"

import { mexpm1, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Radix-2 FFT butterfly explorer, with the operation counts of the ordinary
// Cooley–Tukey algorithm and, beside them, the largest saving the OpenAI
// "explicit power saving" bound could ever give at that length.
//
// Counts (radix-2 decimation in time, n = 2^k):
//   butterflies          (n/2)·k
//   complex add/sub      n·k
//   twiddle multiplies   per stage of span m: (n/m)·(m/2) slots, of which j = 0 (×1)
//                        and j = m/4 (×(-i)) are trivial
//   Lean-model gates     the Comparator statement charges add, sub and every scale
//                        (×(-i) included), so gates = n·k + Σ (n/m)(m/2 − 1)
// The release's bound is O(n (log n)^θ (log log n)^(4−θ)) with
//   θ = log_m(m − Δ/2^71), m = 10^6, Δ = 6871402692000000, so 1 − θ = 2.1064e-13
// (paper (1.1); recomputed exactly). The "saving" column is the factor
// 1 − (log2 n)^−(1−θ): what the (log n)^θ term alone takes off n log n, before the
// (log log n)^3 factor and the constants (a 2^71-array batch at the top level) put
// the algorithm far behind the FFT at every length that fits in this universe.

const ACCENT = "oklch(0.62 0.16 150)"
const HOT = "oklch(0.70 0.16 60)"
const DELTA_PAPER = 2.106438430040e-13 // 1 − θ, computed from (1.1)
const DELTA_STATED = 1e-13 // Corollary 1.2's rounded exponent

const MAXDRAW = 4 // draw at most 16 lines
const W = 640
const H = 300
const PADX = 64
const PADY = 22

function sci(x: number, digits = 2): string {
  if (x === 0) return "0"
  const s = x.toExponential(digits)
  const [mant, exp] = s.split("e")
  return `${mant}×10^${Number(exp)}`
}

function counts(k: number) {
  const n = 2 ** k
  let nontrivial = 0
  let gatesScale = 0
  for (let s = 1; s <= k; s++) {
    const m = 2 ** s
    const blocks = n / m
    const slots = m / 2
    const trivial = m >= 4 ? 2 : 1 // j = 0 always; j = m/4 when m ≥ 4
    nontrivial += blocks * (slots - trivial)
    gatesScale += blocks * (slots - 1) // ×(−i) still costs one Lean gate
  }
  return {
    n,
    butterflies: (n / 2) * k,
    addsub: n * k,
    nontrivial,
    gates: n * k + gatesScale,
    direct: n * n,
  }
}

// saving factor 1 − (log2 n)^(−δ) = −expm1(−δ ln log2 n), computed without cancellation
const saving = (lnLog2n: number, delta: number) => -mexpm1(-delta * lnLog2n)

export function FftCostExplorer() {
  const [k, setK] = useState(4)
  const [stage, setStage] = useState(0) // 0 = all stages
  const [stated, setStated] = useState(false)
  const delta = stated ? DELTA_STATED : DELTA_PAPER

  const kd = Math.min(k, MAXDRAW)
  const nd = 2 ** kd
  const c = counts(k)
  const rowY = (i: number) => PADY + (i * (H - 2 * PADY)) / (nd - 1)
  const colX = (s: number) => PADX + (s * (W - 2 * PADX)) / kd

  // bit-reversed input order for decimation in time
  const rev = (i: number) => {
    let r = 0
    for (let b = 0; b < kd; b++) r |= ((i >> b) & 1) << (kd - 1 - b)
    return r
  }

  const lines: { x1: number; y1: number; x2: number; y2: number; s: number; tw: boolean }[] = []
  for (let s = 1; s <= kd; s++) {
    const m = 2 ** s
    const half = m / 2
    for (let start = 0; start < nd; start += m) {
      for (let j = 0; j < half; j++) {
        const top = start + j
        const bot = top + half
        const trivial = j === 0 || (m >= 4 && j === m / 4)
        const x1 = colX(s - 1)
        const x2 = colX(s)
        lines.push({ x1, y1: rowY(top), x2, y2: rowY(top), s, tw: false })
        lines.push({ x1, y1: rowY(bot), x2, y2: rowY(bot), s, tw: !trivial })
        lines.push({ x1, y1: rowY(bot), x2, y2: rowY(top), s, tw: false })
        lines.push({ x1, y1: rowY(top), x2, y2: rowY(bot), s, tw: false })
      }
    }
  }

  const ladder: { label: string; lnLog2n: number; note: string }[] = [
    { label: `n = 2^${k}`, lnLog2n: mlog(k), note: "the slider" },
    { label: "n = 2^20", lnLog2n: mlog(20), note: "a million-point audio FFT" },
    { label: "n = 2^40", lnLog2n: mlog(40), note: "a trillion points" },
    { label: "n = 2^266", lnLog2n: mlog(266), note: "one point per atom in the universe" },
  ]
  // length at which the factor alone reaches 1%: ln(log n) = −ln(0.99)/δ
  const lnLogFor1pct = -mlog(0.99) / delta
  const digitsOfLogN = lnLogFor1pct / mlog(10)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        Radix-2 FFT · operations vs the release&apos;s (log n)^(1−δ) bound
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Butterfly network of a ${nd}-point radix-2 FFT with ${kd} stages. At n = ${c.n} the FFT uses ${c.addsub} complex additions and subtractions and ${c.nontrivial} nontrivial twiddle multiplications, against ${c.direct} multiplications for the direct matrix product.`}
      >
        {Array.from({ length: kd + 1 }, (_, s) => (
          <text key={`h${s}`} x={colX(s)} y={12} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            {s === 0 ? "in" : `stage ${s}`}
          </text>
        ))}
        {lines.map((l, i) => {
          const on = stage === 0 || stage === l.s
          return (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={l.tw && on ? HOT : on ? ACCENT : "var(--border)"}
              strokeWidth={on ? 1.4 : 1}
              opacity={on ? 0.9 : 0.5}
            />
          )
        })}
        {Array.from({ length: nd }, (_, i) => (
          <g key={`n${i}`}>
            {Array.from({ length: kd + 1 }, (_, s) => (
              <circle key={s} cx={colX(s)} cy={rowY(i)} r={2.6} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={1} />
            ))}
            <text x={PADX - 10} y={rowY(i) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
              x{rev(i)}
            </text>
            <text x={W - PADX + 10} y={rowY(i) + 3} fontSize={9} className="fill-muted-foreground font-mono">
              X{i}
            </text>
          </g>
        ))}
      </svg>
      {k > MAXDRAW ? (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          Diagram drawn for n = 16; the counts below are for n = {c.n}.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">n = 2^{k}</span>
          <input
            type="range"
            min={1}
            max={20}
            value={k}
            onChange={(e) => {
              setK(Number(e.target.value))
              setStage(0)
            }}
            className="hg-range w-40"
            aria-label="Transform length exponent"
          />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Highlight a stage">
          {[0, ...Array.from({ length: kd }, (_, i) => i + 1)].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-xs",
                stage === s ? "border-foreground text-foreground" : "border-border text-muted-foreground",
              )}
            >
              {s === 0 ? "all" : `s${s}`}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-3">
        <div><dt className="text-muted-foreground">butterflies</dt><dd>{c.butterflies.toLocaleString("en-US")}</dd></div>
        <div><dt className="text-muted-foreground">complex add/sub</dt><dd>{c.addsub.toLocaleString("en-US")}</dd></div>
        <div><dt className="text-muted-foreground">nontrivial twiddles</dt><dd style={{ color: HOT }}>{c.nontrivial.toLocaleString("en-US")}</dd></div>
        <div><dt className="text-muted-foreground">Lean-model gates</dt><dd>{c.gates.toLocaleString("en-US")}</dd></div>
        <div><dt className="text-muted-foreground">direct n² products</dt><dd>{c.direct.toLocaleString("en-US")}</dd></div>
        <div><dt className="text-muted-foreground">gates ÷ n log₂ n</dt><dd>{(c.gates / (c.n * k)).toFixed(3)}</dd></div>
      </dl>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">best-case saving from (log n)^−δ, δ =</span>
          <button
            type="button"
            onClick={() => setStated(false)}
            className={cn("rounded-md border px-2 py-0.5 font-mono", !stated ? "border-foreground" : "border-border text-muted-foreground")}
          >
            2.1×10^−13 (from (1.1))
          </button>
          <button
            type="button"
            onClick={() => setStated(true)}
            className={cn("rounded-md border px-2 py-0.5 font-mono", stated ? "border-foreground" : "border-border text-muted-foreground")}
          >
            10^−13 (as stated)
          </button>
        </div>
        <table className="w-full font-mono text-xs">
          <tbody>
            {ladder.map((r) => (
              <tr key={r.label} className="border-b border-border/60">
                <td className="py-1 pr-3">{r.label}</td>
                <td className="py-1 pr-3" style={{ color: ACCENT }}>{sci(saving(r.lnLog2n, delta))}</td>
                <td className="py-1 text-muted-foreground">{r.note}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1 pr-3">1% saving</td>
              <td className="py-1 pr-3" style={{ color: HOT }}>log n has ~{sci(digitsOfLogN)} digits</td>
              <td className="py-1 text-muted-foreground">n itself is a tower: e^(e^{sci(lnLogFor1pct)})</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Upper bounds on the saving only: they ignore the (log log n)³ factor and the constants, both of
          which make the new algorithm slower than this FFT at every length that could be stored.
        </p>
      </div>
    </figure>
  )
}
