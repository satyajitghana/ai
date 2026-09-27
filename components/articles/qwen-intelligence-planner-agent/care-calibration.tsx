"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// CARE (Qwen-Planner-Agent report, Section 2.4.3), worked on one toy group.
//
// Eq. 5: R_i = s_i + lambda_prog * R_prog,i   if group success rate s < p_low
//        R_i = s_i                            if p_low <= s < p_high
//        R_i = s_i - lambda_eff * e_i         if s >= p_high
// Eq. 7: standard advantage (R_i - mean R) / (sigma_R + eps)
// Eq. 9: in the efficiency regime only, the denominator becomes
//        max(sigma_R, sigma_anchor) + eps, sigma_anchor = sqrt(p_high (1 - p_high))
//
// The report publishes none of G, p_low, p_high or lambda_prog, and gives
// lambda_eff = 0.1 only as an example. Everything numeric below that is not
// in those equations is ILLUSTRATIVE: a group of 8, thresholds 0.25 and 0.75,
// lambda_prog 0.5, and made-up per-rollout costs and progress. The point is
// the shape, not the values: once every rollout succeeds, the standard
// advantage spread snaps back to 1 whatever lambda_eff is; the calibrated one
// shrinks with it.
//
// Only + - * / and Math.sqrt are used (exact per IEEE 754), so SSR and client
// agree.

const G = 8
const P_LOW = 0.25
const P_HIGH = 0.75
const LAMBDA_PROG = 0.5
const EPS = 1e-6
const COST = [0.2, 0.35, 0.5, 0.65, 0.3, 0.8, 0.45, 0.6]
const PROG = [0.25, 0.5, 0, 0.75, 0.5, 0.25, 0, 0.5]

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function std(xs: number[]) {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))))
}

type Regime = "progress shaping" | "outcome consolidation" | "efficiency refinement"

function compute(k: number, lambdaEff: number) {
  const succ = Array.from({ length: G }, (_, i) => (i < k ? 1 : 0))
  const s = k / G
  const regime: Regime = s < P_LOW ? "progress shaping" : s < P_HIGH ? "outcome consolidation" : "efficiency refinement"
  const R = succ.map((si, i) =>
    regime === "progress shaping"
      ? si + LAMBDA_PROG * PROG[i]
      : regime === "outcome consolidation"
        ? si
        : si - lambdaEff * COST[i],
  )
  const m = mean(R)
  const sd = std(R)
  const anchor = Math.sqrt(P_HIGH * (1 - P_HIGH))
  const stdAdv = R.map((r) => (r - m) / (sd + EPS))
  const denom = regime === "efficiency refinement" ? Math.max(sd, anchor) + EPS : sd + EPS
  const careAdv = R.map((r) => (r - m) / denom)
  return { succ, s, regime, R, sd, anchor, stdAdv, careAdv, floorOn: regime === "efficiency refinement" && anchor > sd }
}

const STD = "oklch(0.62 0.04 250)"
const CARE = "oklch(0.62 0.18 30)"

function Bars({ vals, color, label }: { vals: number[]; color: string; label: string }) {
  const lim = 2.5
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">spread (std) {std(vals).toFixed(3)}</span>
      </div>
      <div className="relative grid h-24 grid-cols-8 gap-1 rounded-md border bg-muted/20 px-1">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/20" />
        {vals.map((v, i) => {
          const h = Math.min(1, Math.abs(v) / lim) * 50
          return (
            <div key={i} className="relative h-full">
              <div
                className="absolute inset-x-0 rounded-sm"
                style={{
                  background: color,
                  height: `${h.toFixed(2)}%`,
                  top: v >= 0 ? `${(50 - h).toFixed(2)}%` : "50%",
                }}
                title={v.toFixed(3)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CareCalibration() {
  const [k, setK] = useState(8)
  const [lam, setLam] = useState(0.1)
  const c = useMemo(() => compute(k, lam), [k, lam])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>CARE on one toy group of 8 rollouts</span>
        <span className="text-[10px]">equations: report; numbers: illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>rollouts that succeed</span>
              <span className="tabular-nums text-foreground">
                {k} / {G} (s = {c.s.toFixed(3)})
              </span>
            </span>
            <Range min={0} max={G} step={1} value={k} onChange={(e) => setK(+e.target.value)} className="w-full" aria-label="successful rollouts" accent={CARE} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>efficiency weight</span>
              <span className="tabular-nums text-foreground">{lam.toFixed(2)}</span>
            </span>
            <Range min={0.02} max={0.5} step={0.02} value={lam} onChange={(e) => setLam(+e.target.value)} className="w-full" aria-label="efficiency weight" accent={CARE} />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px]">
          <span className="rounded-full border px-2 py-0.5 text-foreground">regime: {c.regime}</span>
          <span className="rounded-full border px-2 py-0.5 text-muted-foreground">
            reward std {c.sd.toFixed(3)} · anchor {c.anchor.toFixed(3)}
          </span>
          <span className="rounded-full border px-2 py-0.5 text-muted-foreground">
            floor {c.floorOn ? "active" : "inactive"}
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Bars vals={c.stdAdv} color={STD} label="standard group normalisation" />
          <Bars vals={c.careAdv} color={CARE} label="CARE: success-derived floor" />
        </div>
        <div className="mt-1 grid grid-cols-8 gap-1 px-1 font-mono text-[10px] text-muted-foreground">
          {c.succ.map((si, i) => (
            <span key={i} className="text-center">
              {si ? "ok" : "fail"}
            </span>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          With all 8 rollouts successful, every reward is 1 minus a small cost penalty. Standard
          normalisation divides by that tiny spread, so the advantages come back at unit scale no
          matter how small the efficiency weight is: shaving tokens gets pushed as hard as finishing
          the task. CARE divides by at least the spread a 0.75 success rate would have, so the
          push shrinks with the weight. Drop to 4 successes and both columns match: success,
          not cost, is what separates the rollouts.
        </p>
      </div>
    </figure>
  )
}
