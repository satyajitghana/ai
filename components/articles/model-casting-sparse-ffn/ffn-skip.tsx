"use client"

import { useId, useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The gate-first skip, made adjustable. A gated FFN computes three matmuls:
// y = W2 · (A(W1·x) ⊙ (W3·x)). The gate W1 must run in full to learn where the
// zeros are; a zero in A(W1·x) then lets us skip one row of W3 and one column of
// W2. So the FLOP win is bounded by W1 always being on — the 3x ceiling of
// standard gating. LoPA makes W1 cheap (low-rank, r = D/8) and spends the saved
// parameters on W3/W2, pushing the ceiling to about 13.5x.
//
// Everything on screen is exact arithmetic from the paper's FLOP formulas
// (Eq. 2 for standard gating, Eq. 4 for LoPA), using the paper's defaults
// H = 8D/3 and rank ratio alpha = r/D = 1/8. Bars are shares of a dense FFN's
// FLOPs. The NLL readout is NOT modelled: it snaps to the nearest measured
// operating point in Table 1 (0.81B models). Deterministic initial state so the
// server render and the first client paint agree; no transcendental math, so no
// dmath wrappers are needed.

type Gate = "standard" | "lopa"

const ACCENT = "oklch(0.60 0.15 255)" // W1 gate (always on)
const UP = "oklch(0.70 0.14 150)" // W3 up
const DOWN = "oklch(0.72 0.15 60)" // W2 down
const DEAD = "oklch(0.72 0.02 20)" // zeroed unit

// Normalized FLOP shares of a dense FFN (= 1.0 total at s = 0).
// Standard:  w1 = 1/3 always; w3 = w2 = (1-s)/3.
// LoPA (H = 8D/3, alpha = 1/8):  gate share = 10/136; up = down redistributed.
const LOPA_GATE = 10 / 136 // = 0.073529...
const LOPA_UD = (1 - LOPA_GATE) / 2 // = 0.463235... per matrix at s = 0

// Measured operating points, Table 1, 0.81B models (dense NLL = 2.145).
const MEASURED: Record<Gate, { s: number; nll: number; d: number }[]> = {
  standard: [
    { s: 0, nll: 2.145, d: 0 },
    { s: 69, nll: 2.153, d: 0.36 },
    { s: 89, nll: 2.16, d: 0.68 },
  ],
  lopa: [
    { s: 0, nll: 2.15, d: 0.24 },
    { s: 51, nll: 2.148, d: 0.13 },
    { s: 89, nll: 2.165, d: 0.93 },
  ],
}

const N_UNITS = 40
const COLS = 10
// A fixed scatter so the dead units read as "spread through the layer", not a
// prefix. Deterministic => SSR-stable. These are the indices turned off FIRST.
const KILL_ORDER = [
  4, 27, 13, 38, 0, 21, 9, 34, 17, 29, 2, 24, 11, 36, 6, 19, 31, 15, 23, 7, 39,
  12, 26, 1, 33, 18, 8, 30, 20, 3, 35, 14, 25, 10, 28, 5, 37, 16, 32, 22,
]

function shares(gate: Gate, s: number) {
  if (gate === "standard") {
    return { w1: 1 / 3, w3: (1 - s) / 3, w2: (1 - s) / 3 }
  }
  return { w1: LOPA_GATE, w3: LOPA_UD * (1 - s), w2: LOPA_UD * (1 - s) }
}

function fmt(x: number, dp = 1) {
  return x.toFixed(dp)
}

export function FfnSkip() {
  const uid = useId()
  const [gate, setGate] = useState<Gate>("lopa")
  const [sparsityPct, setSparsityPct] = useState(90)

  const s = sparsityPct / 100
  const { w1, w3, w2 } = useMemo(() => shares(gate, s), [gate, s])
  const total = w1 + w3 + w2 // dense FFN = 1.0 at s = 0, for both gates
  const speedup = 1 / total
  const savedPct = (1 - total) * 100

  const dead = Math.round(s * N_UNITS)
  const alive = N_UNITS - dead
  const killSet = useMemo(() => new Set(KILL_ORDER.slice(0, dead)), [dead])

  // Nearest measured operating point for the NLL readout.
  const nearest = useMemo(() => {
    const pts = MEASURED[gate]
    let best = pts[0]
    let bestD = Infinity
    for (const p of pts) {
      const dd = Math.abs(p.s - sparsityPct)
      if (dd < bestD) {
        bestD = dd
        best = p
      }
    }
    return best
  }, [gate, sparsityPct])

  const ceilingLabel =
    gate === "standard" ? "3× ceiling (W1 always on)" : "breaks 3× — up to 13.5×"

  // Bar scale: widest possible bar is 1/3 of dense (a dense matrix). Map share
  // to a percentage of the track so a full dense matrix fills ~100%.
  const barPct = (share: number) => Math.min(100, (share / (1 / 3)) * 100)

  return (
    <div className="my-6 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium text-foreground">
          Compute the gate first, then skip the dead units
        </div>
        <div
          className="inline-flex rounded-lg border border-border p-0.5 text-xs"
          role="group"
          aria-label="Gate parameterization"
        >
          {(["standard", "lopa"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGate(g)}
              aria-pressed={gate === g}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                gate === g
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {g === "standard" ? "Standard gate" : "LoPA gate"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label
          htmlFor={`${uid}-s`}
          className="shrink-0 text-xs text-muted-foreground"
        >
          Activation sparsity
        </label>
        <Range
          id={`${uid}-s`}
          min={0}
          max={95}
          step={1}
          value={sparsityPct}
          onChange={(e) => setSparsityPct(Number(e.currentTarget.value))}
          accent={ACCENT}
          aria-label="Activation sparsity percent"
        />
        <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums text-foreground">
          {sparsityPct}%
        </span>
      </div>

      {/* Hidden-unit layer: the gate output A(W1·x). Dead = zeroed by R-S+. */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">
            Hidden units after{" "}
            <span className="font-mono">A(W1·x)</span>
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {alive}/{N_UNITS} active
          </span>
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {Array.from({ length: N_UNITS }, (_, i) => {
            const isDead = killSet.has(i)
            return (
              <div
                key={i}
                className="aspect-square rounded-[3px] transition-colors"
                style={{
                  background: isDead ? "transparent" : ACCENT,
                  border: isDead
                    ? `1px dashed ${DEAD}`
                    : "1px solid transparent",
                  opacity: isDead ? 0.55 : 1,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* FLOP bars: each matrix as a share of a dense FFN's cost. */}
      <div className="mb-4 space-y-2">
        <FlopBar
          name="W1 gate"
          sub={
            gate === "standard" ? "full, always on" : "low-rank (r = D/8)"
          }
          color={ACCENT}
          pct={barPct(w1)}
          value={w1}
        />
        <FlopBar
          name="W3 up"
          sub="skips dead units"
          color={UP}
          pct={barPct(w3)}
          value={w3}
        />
        <FlopBar
          name="W2 down"
          sub="skips dead units"
          color={DOWN}
          pct={barPct(w2)}
          value={w2}
        />
      </div>

      {/* Readouts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="FFN FLOPs"
          value={`${fmt(total * 100, 0)}%`}
          sub="of a dense FFN"
        />
        <Stat
          label="FFN speedup"
          value={`${fmt(speedup, 2)}×`}
          sub={ceilingLabel}
          strong
        />
        <Stat
          label="NLL cost"
          value={nearest.d === 0 ? "—" : `+${fmt(nearest.d, 2)}%`}
          sub={`measured @ ${nearest.s}% (Table 1)`}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        FLOP shares are exact arithmetic from the paper&rsquo;s formulas (dense =
        100%; H = 8D/3, rank ratio α = r/D = 1/8). The speedup is the reciprocal
        of the FFN&rsquo;s remaining FLOPs. The NLL cost is not modelled: it snaps
        to the nearest measured 0.81B operating point and is blank where no cast
        model was measured. Saved {fmt(savedPct, 0)}% of FFN FLOPs at this
        setting.
      </p>
    </div>
  )
}

function FlopBar({
  name,
  sub,
  color,
  pct,
  value,
}: {
  name: string
  sub: string
  color: string
  pct: number
  value: number
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-right">
        <div className="font-mono text-xs text-foreground">{name}</div>
        <div className="text-[10px] leading-tight text-muted-foreground">
          {sub}
        </div>
      </div>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted/50">
        <div
          className="h-full rounded transition-all"
          style={{ width: `${pct}%`, background: color, opacity: 0.85 }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {fmt(value * 100, 1)}%
      </span>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  strong,
}: {
  label: string
  value: string
  sub: string
  strong?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono tabular-nums text-foreground",
          strong ? "text-xl font-semibold" : "text-lg"
        )}
      >
        {value}
      </div>
      <div className="text-[10px] leading-tight text-muted-foreground">
        {sub}
      </div>
    </div>
  )
}
