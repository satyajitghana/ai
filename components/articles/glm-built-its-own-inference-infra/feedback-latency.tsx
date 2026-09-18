"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The post's actual thesis, made draggable.
//
// Z.ai's argument is not "our model is good at kernels" — it's that a fixed
// wall-clock budget buys you far more testable hypotheses if most of them are
// screened by something cheap and local before the expensive full run, rather
// than every hypothesis waiting for the same slow end-to-end deployment. Their
// own Figure 2 draws exactly this contrast: "(a) Sparse feedback" is a loop
// through "Full run" with nothing in between; "(b) Dense feedback" inserts a
// correctness/system-behavior/performance triage stage before "End-to-end
// acceptance."
//
// The 13-day budget below is real — it's Figure 1's own T+0..T+13 bring-up
// window, the one number in the whole post independently anchored to a dated
// chart. The per-hypothesis costs (a kernel/microbenchmark check vs. a full
// redeploy-and-load-test cycle) are NOT published anywhere in the post — Z.ai
// gives no durations for either. They're illustrative order-of-magnitude
// stand-ins, chosen to be directionally consistent with the three case studies
// below (a kernel comparison runs in-process in minutes; the KV-Transfer
// acceptance test needed a redeployed service and a load test). Drag the
// slider; the shape of the argument — sparse feedback runs out of the budget,
// dense feedback doesn't — is what's checkable, not these specific minutes.

const SPARSE = "oklch(0.58 0.19 27)"
const DENSE = "oklch(0.55 0.16 155)"

const BUDGET_DAYS = 13 // Figure 1's own T+0..T+13, "GLM-5.3-Flash launch"
const BUDGET_H = BUDGET_DAYS * 24 // 312h

const C_LOCAL_MIN = 8 // illustrative: a kernel/numerical correctness check + microbenchmark
const C_E2E_MIN = 180 // illustrative: a redeploy + the Prefill/Decode/KV-Transfer load test
const P_SURVIVE = 0.15 // illustrative: share of hypotheses worth a full end-to-end confirmation

const sparsePerHyp = C_E2E_MIN
const densePerHyp = C_LOCAL_MIN + P_SURVIVE * C_E2E_MIN // 35 min

const nSparseMax = Math.floor((BUDGET_H * 60) / sparsePerHyp)
const nDenseMax = Math.floor((BUDGET_H * 60) / densePerHyp)
const ratio = sparsePerHyp / densePerHyp

const MAXN = 180
const W = 680
const H = 260
const PL = 46
const PB = 26
const PT = 14
const PR = 14

export function FeedbackLatency() {
  const [n, setN] = useState(120)

  const sparseH = (n * sparsePerHyp) / 60
  const denseH = (n * densePerHyp) / 60
  const yMax = Math.max(BUDGET_H, (MAXN * sparsePerHyp) / 60) * 1.05

  const x = (k: number) => PL + (k / MAXN) * (W - PL - PR)
  const y = (h: number) => PT + (1 - h / yMax) * (H - PT - PB)

  const path = (perHyp: number) =>
    Array.from({ length: MAXN + 1 }, (_, k) => `${k === 0 ? "M" : "L"} ${x(k).toFixed(1)} ${y((k * perHyp) / 60).toFixed(1)}`).join(
      " ",
    )

  const sparseOver = sparseH > BUDGET_H
  const denseOver = denseH > BUDGET_H

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">hypotheses tested vs. wall-clock spent</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">illustrative costs, real budget</span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "hypotheses tried", v: n.toLocaleString(), c: "inherit" },
            { l: "sparse: every one full-run", v: `${sparseH.toFixed(0)}h`, c: SPARSE },
            { l: "dense: screen local first", v: `${denseH.toFixed(0)}h`, c: DENSE },
            { l: "dense fits in the budget", v: `${ratio.toFixed(1)}×`, c: DENSE },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{s.l}</div>
              <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: s.c }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="min-w-[520px] w-full"
            role="img"
            aria-label={`At ${n} hypotheses tried, always waiting for a full run costs ${sparseH.toFixed(0)} hours; screening locally first costs ${denseH.toFixed(0)} hours. The real GLM-5.3-Flash bring-up budget was ${BUDGET_H} hours (13 days). Sparse feedback would need ${nSparseMax} hypotheses to exhaust it; dense feedback would need ${nDenseMax}.`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <line
                key={g}
                x1={PL}
                x2={W - PR}
                y1={y(g * yMax)}
                y2={y(g * yMax)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
            ))}

            {/* the real 13-day / 312h bring-up budget */}
            <line x1={PL} x2={W - PR} y1={y(BUDGET_H)} y2={y(BUDGET_H)} stroke={DENSE} strokeOpacity={0.55} strokeDasharray="4 3" strokeWidth={1.3} />
            <text x={W - PR} y={y(BUDGET_H) - 5} textAnchor="end" className="fill-current font-mono" style={{ color: DENSE }} fontSize={9}>
              real bring-up budget — {BUDGET_DAYS} days ({BUDGET_H}h)
            </text>

            {/* filled gap between the two curves up to n */}
            <path
              d={`${path(sparsePerHyp).split(" L ").slice(0, n + 1).join(" L ")} L ${x(n)} ${y(denseH)} ${Array.from(
                { length: n + 1 },
                (_, k) => `L ${x(n - k)} ${y(((n - k) * densePerHyp) / 60)}`,
              ).join(" ")} Z`}
              fill={SPARSE}
              opacity={0.06}
            />

            <path d={path(sparsePerHyp)} fill="none" stroke={SPARSE} strokeWidth={2.5} strokeLinecap="round" />
            <path d={path(densePerHyp)} fill="none" stroke={DENSE} strokeWidth={2.5} strokeLinecap="round" />

            <circle cx={x(n)} cy={y(sparseH)} r={4} fill={SPARSE} stroke="var(--background)" strokeWidth={1.5} />
            <circle cx={x(n)} cy={y(denseH)} r={4} fill={DENSE} stroke="var(--background)" strokeWidth={1.5} />
            <line x1={x(n)} x2={x(n)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/15" strokeWidth={1} />

            <text x={14} y={y(sparseH) - (sparseOver ? -12 : 6)} className="font-mono" fill={SPARSE} fontSize={9}>
              {sparseOver ? "budget exhausted" : "sparse"}
            </text>
            <text x={14} y={y(denseH) - 6} className="font-mono" fill={DENSE} fontSize={9}>
              {denseOver ? "budget exhausted" : "dense — still under budget"}
            </text>

            <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              hypotheses tried →
            </text>
          </svg>
        </div>

        <label className="mt-1 block">
          <span className="sr-only">hypotheses tried</span>
          <Range min={1} max={MAXN} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer" accent={DENSE} />
        </label>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className={cn("rounded-lg border px-3 py-2")} style={{ borderColor: sparseOver ? SPARSE : undefined }}>
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">every hypothesis waits for a full run</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: SPARSE }}>
              runs out after ~{nSparseMax} hypotheses
            </div>
          </div>
          <div className={cn("rounded-lg border px-3 py-2")}>
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">local check first, full run for survivors</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: DENSE }}>
              runs out after ~{nDenseMax} hypotheses
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The red line is what the post draws as{" "}
          <span className="text-foreground">&ldquo;(a) Sparse feedback&rdquo;</span> — every hypothesis waits for{" "}
          <em>Full run &rarr; Final result</em> before anyone learns anything. At{" "}
          {C_E2E_MIN} illustrative minutes per full run, the real 13-day bring-up window empties after about{" "}
          {nSparseMax} hypotheses — drag past that point and the red line has already crossed the dashed budget line
          with hypotheses still left untested.
          <br />
          <br />
          The green line screens each hypothesis with a cheap, local check first — a kernel comparison, a
          microbenchmark — and only sends the {(P_SURVIVE * 100).toFixed(0)}% that survive on to a full end-to-end
          confirmation.{" "}
          <span className="text-foreground">
            Same budget, roughly {ratio.toFixed(1)}× more hypotheses testable
          </span>
          . That ratio is not measured — Z.ai publishes no per-step durations — but it is the mechanism their own
          three case studies below actually exercise: a numerical check, a timeline read, and a microbenchmark, each
          run before anything needed a full redeploy.
        </p>
      </div>
    </figure>
  )
}
