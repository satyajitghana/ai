"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// An illustrative model of RRSI's selection side. A proposer hands the selector
// a candidate harness edit; the selector runs it past three non-compensatory
// gates — the leakage critic (before scoring), the noise-adjusted floor, and the
// cost rule — and only an edit that clears all three replaces the incumbent. The
// numbers here are made up to show the decision, not measured from the paper;
// the real noise bands (delta = 0.017 / 0.004 / 0.020) and the cost rule
// (delta C <= beta0 + beta1 * delta S) are in the prose. The teaching point is
// the one RRSI makes: an edit that only lifts the evolve split is caught, and an
// edit that transfers is kept. Drag delta to watch the floor swallow small wins.

const ACCENT = "oklch(0.62 0.14 250)" // blue: the transferable edit
const GOOD = "oklch(0.62 0.15 150)" // green: a gate passed
const BAD = "oklch(0.60 0.19 25)" // red: a gate rejected
const MUTED = "oklch(0.55 0.02 260)"

// beta0, beta1 for the illustrative cost rule: tolerated cost for ~0 gain, and
// extra cost allowed per point of measured gain. Kept simple and round.
const BETA0 = 0.1
const BETA1 = 4.0

type Edit = {
  id: string
  label: string
  component: string
  note: string
  dEvolve: number // measured gain on the evolve split (points /100)
  dHeldout: number // the gain that actually transfers (not visible to the selector)
  dCost: number // relative policy-token change, e.g. 0.35 = +35%
  leaks: boolean // the critic reads the diff and finds benchmark-specific logic
}

const EDITS: Edit[] = [
  {
    id: "retry",
    label: "Verify before finishing",
    component: "control flow",
    note: "Re-read the file it edited and re-run the check before it stops.",
    dEvolve: 0.028,
    dHeldout: 0.022,
    dCost: 0.18,
    leaks: false,
  },
  {
    id: "memo",
    label: "Hard-code the known answers",
    component: "memory",
    note: "Writes a lookup keyed by the evolve suite's task names into a skill file.",
    dEvolve: 0.061,
    dHeldout: 0.0,
    dCost: 0.04,
    leaks: true,
  },
  {
    id: "noise",
    label: "Reword the system prompt",
    component: "prompt",
    note: "A cosmetic rephrase; the score moves inside the measurement band.",
    dEvolve: 0.003,
    dHeldout: 0.001,
    dCost: 0.0,
    leaks: false,
  },
  {
    id: "subagents",
    label: "Spawn five review sub-agents",
    component: "sub-agents",
    note: "A real but small lift bought with a large increase in tokens.",
    dEvolve: 0.031,
    dHeldout: 0.012,
    dCost: 0.9,
    leaks: false,
  },
  {
    id: "compact",
    label: "Compact context on overflow",
    component: "context mgmt",
    note: "Summarise old turns when the window fills; a generic mechanism.",
    dEvolve: 0.024,
    dHeldout: 0.02,
    dCost: -0.06,
    leaks: false,
  },
]

const pct = (x: number) => `${(x * 100).toFixed(1)}`
const signPct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`

function GateRow({
  name,
  detail,
  passed,
  active,
}: {
  name: string
  detail: string
  passed: boolean
  active: boolean
}) {
  const color = !active ? MUTED : passed ? GOOD : BAD
  return (
    <div
      className="flex items-start gap-3 rounded-md border p-3"
      style={{ borderColor: color, opacity: active ? 1 : 0.5 }}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs"
        style={{ background: color, color: "white" }}
      >
        {!active ? "·" : passed ? "✓" : "✗"}
      </span>
      <div className="min-w-0">
        <div className="font-mono text-sm font-semibold" style={{ color }}>
          {name}
        </div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  )
}

export function EvolveGate() {
  const [sel, setSel] = useState("retry")
  const [delta, setDelta] = useState(0.02)

  const edit = EDITS.find((e) => e.id === sel) ?? EDITS[0]

  // Gate 1: leakage critic — reads the diff before any scoring.
  const passLeak = !edit.leaks
  // Gate 2: noise-adjusted floor — the measured evolve gain must clear the band.
  const passFloor = passLeak && edit.dEvolve > delta
  // Gate 3: cost rule — added cost paid for by measured gain (only judged for a
  // gain above the band; within the band a candidate is admitted only for a
  // token saving, matching the paper's within-band rule).
  const costBudget = BETA0 + BETA1 * edit.dEvolve
  const passCost = passFloor && edit.dCost <= costBudget
  const accepted = passLeak && passFloor && passCost

  const rejectedBy = !passLeak
    ? "the leakage critic"
    : !passFloor
      ? "the noise floor"
      : !passCost
        ? "the cost rule"
        : null

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">
          Selection, gate by gate
        </div>
        <div className="font-mono text-xs text-muted-foreground">illustrative</div>
      </div>

      {/* candidate picker */}
      <div className="mb-4 flex flex-wrap gap-2">
        {EDITS.map((e) => {
          const on = e.id === sel
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setSel(e.id)}
              className="rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors"
              style={{
                borderColor: on ? ACCENT : undefined,
                background: on ? ACCENT : "transparent",
                color: on ? "white" : undefined,
              }}
            >
              <span className="font-mono">{e.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 rounded-md border border-dashed p-3 text-sm">
        <span className="font-mono text-xs text-muted-foreground">
          proposed edit &rarr; {edit.component}
        </span>
        <div className="mt-1">{edit.note}</div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
          <span>
            evolve gain{" "}
            <span style={{ color: ACCENT }}>{signPct(edit.dEvolve)} pts</span>
          </span>
          <span>
            cost{" "}
            <span style={{ color: edit.dCost > 0 ? BAD : GOOD }}>
              {signPct(edit.dCost)}%
            </span>
          </span>
        </div>
      </div>

      {/* delta slider */}
      <label className="mb-4 block">
        <div className="mb-1 flex items-center justify-between font-mono text-xs">
          <span>noise band &delta;</span>
          <span style={{ color: ACCENT }}>{pct(delta)} pts</span>
        </div>
        <Range
          min={0}
          max={0.05}
          step={0.001}
          value={delta}
          accent={ACCENT}
          onChange={(e) => setDelta(Number(e.target.value))}
          aria-label="noise band delta"
        />
      </label>

      {/* the three gates */}
      <div className="grid gap-2 sm:grid-cols-3">
        <GateRow
          name="1. Leakage critic"
          detail={
            passLeak
              ? "No benchmark-specific logic in the diff."
              : "Diff encodes the evolve suite's own task names."
          }
          passed={passLeak}
          active
        />
        <GateRow
          name="2. Noise floor"
          detail={
            !passLeak
              ? "Not reached; rejected earlier."
              : passFloor
                ? `Gain ${pct(edit.dEvolve)} > band ${pct(delta)}.`
                : `Gain ${pct(edit.dEvolve)} within band ${pct(delta)}.`
          }
          passed={passFloor}
          active={passLeak}
        />
        <GateRow
          name="3. Cost rule"
          detail={
            !passFloor
              ? "Not reached; rejected earlier."
              : passCost
                ? `${signPct(edit.dCost)}% cost, paid for by the gain.`
                : `${signPct(edit.dCost)}% cost exceeds the budget.`
          }
          passed={passCost}
          active={passFloor}
        />
      </div>

      {/* verdict + what transfers */}
      <div
        className="mt-4 rounded-md border p-3"
        style={{ borderColor: accepted ? GOOD : BAD }}
      >
        <div
          className="font-mono text-sm font-semibold"
          style={{ color: accepted ? GOOD : BAD }}
        >
          {accepted
            ? "Accepted → becomes the next incumbent"
            : `Rejected by ${rejectedBy}`}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {accepted ? (
            <>
              Held-out gain that actually transfers:{" "}
              <span className="font-mono" style={{ color: ACCENT }}>
                {signPct(edit.dHeldout)} pts
              </span>
              {edit.dHeldout <= 0.0005
                ? " — nothing. A pure evolve-set win would have memorised the suite."
                : "."}
            </>
          ) : (
            <>
              What score-only evolution would have kept:{" "}
              <span className="font-mono" style={{ color: MUTED }}>
                {signPct(edit.dEvolve)} pts on evolve
              </span>
              , transferring{" "}
              <span className="font-mono">{signPct(edit.dHeldout)} pts</span>.
            </>
          )}
        </div>
      </div>
    </div>
  )
}
