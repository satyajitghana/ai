"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the prerouter actually buys, and where.
//
// Every number is from arXiv:2609.18063v2 §5.3 and Tables 3-4, measured on a
// MacBook M2 with 16 GB of unified memory serving an 18.4 GiB checkpoint — a
// machine on which the weights do not fit, so every step faults experts back in
// from SSD. Same-session rotated A/B, both arms replaying the same sampled token
// sequence, 3-round medians.
//
// Step time here is derived from the paper's own decode rate (1000 / tok/s), not
// quoted separately. The cross-check is nice: at K=8 that gives 555.6 ms, and the
// paper independently reports the step as 559.1 ms.
//
// The bar to read is the second row of the M4 Pro panel. On the machine whose
// benchmark table the README publishes, the paper's own Table 1 caption says
// disabling the prerouter measures 19.9 tok/s against 20.4 — +2.5%. The +80 to
// +84% is real and it is what the mechanism is for; it is a swap-avoidance
// device, and it pays exactly when the machine cannot hold the model.
//
// Only +, -, *, / and Math.round reach the DOM, so no lib/dmath wrapper is
// needed: those are exact per IEEE-754 on every engine.

type Row = {
  k: number
  onDemand: { tokS: number; blockedMs: number; loads: number; mibStep: number; mibLoad: number; cold: number; msLoad: number }
  prerouter: { tokS: number; blockedMs: number; loads: number; mibStep: number; mibLoad: number; cold: number; msLoad: number }
  gain: number
}

const ROWS: Row[] = [
  {
    k: 2,
    onDemand: { tokS: 4.8, blockedMs: 154.9, loads: 99.3, mibStep: 30.4, mibLoad: 0.31, cold: 20, msLoad: 1.56 },
    prerouter: { tokS: 8.6, blockedMs: 46.5, loads: 19.3, mibStep: 29.5, mibLoad: 1.53, cold: 98, msLoad: 2.41 },
    gain: 80,
  },
  {
    k: 4,
    onDemand: { tokS: 3.5, blockedMs: 244.0, loads: 189.4, mibStep: 50.9, mibLoad: 0.27, cold: 17, msLoad: 1.29 },
    prerouter: { tokS: 6.4, blockedMs: 101.9, loads: 44.7, mibStep: 58.9, mibLoad: 1.32, cold: 84, msLoad: 2.28 },
    gain: 82,
  },
  {
    k: 8,
    onDemand: { tokS: 1.8, blockedMs: 575.0, loads: 398.6, mibStep: 126.9, mibLoad: 0.32, cold: 20, msLoad: 1.44 },
    prerouter: { tokS: 3.3, blockedMs: 211.6, loads: 89.5, mibStep: 125.1, mibLoad: 1.40, cold: 90, msLoad: 2.36 },
    gain: 84,
  },
]

const ON_DEMAND = "#94a3b8"
const PREROUTER = "#b91c1c"

const r1 = (n: number) => Math.round(n * 10) / 10
const stepMs = (tokS: number) => Math.round((1000 / tokS) * 10) / 10

export function CriticalPath() {
  const [k, setK] = useState(4)
  const row = ROWS.find((r) => r.k === k) ?? ROWS[1]

  // One shared ms axis across all K so switching K is comparable, not rescaled.
  const axisMax = Math.max(...ROWS.map((r) => stepMs(r.onDemand.tokS))) * 1.05
  const pct = (ms: number) => `${Math.round((ms / axisMax) * 1000) / 10}%`

  const arms = [
    { id: "on-demand streaming", d: row.onDemand, color: ON_DEMAND },
    { id: "prerouter (all layers)", d: row.prerouter, color: PREROUTER },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one decode step, MacBook M2 16 GB, 18.4 GiB checkpoint
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          arXiv:2609.18063v2 §5.3, Tables 3&ndash;4
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">routed width K</span>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="routed width K">
            {ROWS.map((r) => (
              <button
                key={r.k}
                type="button"
                onClick={() => setK(r.k)}
                aria-pressed={r.k === k}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                  r.k === k
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.k}
              </button>
            ))}
          </div>
          <span className="ml-1 font-mono text-[10px] text-muted-foreground">
            shipped 35B tier runs K=4
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {arms.map((arm) => {
            const step = stepMs(arm.d.tokS)
            const blocked = Math.min(arm.d.blockedMs, step)
            return (
              <div key={arm.id}>
                <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">{arm.id}</span>
                  <span>
                    {arm.d.tokS} tok/s &middot; {step} ms/step &middot; {arm.d.blockedMs} ms
                    blocked on expert loads
                  </span>
                </div>
                <div className="mt-1 h-8 w-full overflow-hidden rounded-md border bg-muted/20">
                  <div className="relative h-full" style={{ width: pct(step) }}>
                    <div className="h-full" style={{ background: arm.color, opacity: 0.22 }} />
                    <div
                      className="absolute top-0 h-full"
                      style={{
                        width: pct(blocked),
                        background: `repeating-linear-gradient(45deg, ${arm.color}, ${arm.color} 3px, transparent 3px, transparent 6px)`,
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-2 font-mono text-[9px] leading-4 text-muted-foreground">
          solid = step wall time (1000 / tok/s) &middot; hatched = time the main thread spent
          blocked on expert loads, summed over layers. At K=8 the on-demand sum (575.0 ms)
          exceeds the step it belongs to (559.1 ms) because different layers&rsquo; loads overlap
          &mdash; the bar clamps it to the step.
        </p>

        <div className="-mx-1 mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {["arm", "loads/step", "MiB/step", "MiB/load", "cold", "ms/load"].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      "px-2 py-1.5 font-mono text-[10px] font-medium tracking-wide text-muted-foreground",
                      i === 0 ? "text-left" : "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {arms.map((arm) => (
                <tr key={arm.id} className="border-t border-border/60">
                  <td className="px-2 py-1.5 font-mono text-xs">{arm.id}</td>
                  {[arm.d.loads, arm.d.mibStep, arm.d.mibLoad, `${arm.d.cold}%`, arm.d.msLoad].map(
                    (v, i) => (
                      <td key={i} className="px-2 py-1.5 text-right font-mono text-xs">
                        {v}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border bg-muted/20 px-3 py-2.5">
            <p className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              machine that cannot hold the model
            </p>
            <p className="mt-1 font-mono text-sm text-foreground">
              +{row.gain}% at K={k}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {row.onDemand.tokS} &rarr; {row.prerouter.tokS} tok/s. MacBook M2, 16 GB, no
              artificial memory limit.
            </p>
          </div>
          <div className="rounded-md border bg-muted/20 px-3 py-2.5">
            <p className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              machine in the README&rsquo;s benchmark table
            </p>
            <p className="mt-1 font-mono text-sm text-foreground">+2.5%</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              19.9 &rarr; 20.4 tok/s, Mac mini M4 Pro 24 GB, from the paper&rsquo;s own Table 1
              caption. The 8B tier&rsquo;s code docstring says ~5% on the same box.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two arms read within a few percent of the{" "}
          <span className="text-foreground">same bytes</span> at K=2 and K=8 &mdash; 29.5 against
          30.4, and 125.1 against 126.9 MiB per step. At K=4, the width that actually ships, the
          prerouter arm reads{" "}
          <span className="text-foreground">16% more</span> (58.9 against 50.9 MiB). So nothing is
          saved. What changes is{" "}
          <span className="text-foreground">when</span> the bytes are read: 44.7 loads a step of
          1.32 MiB each instead of 189.4 loads of 0.27 MiB, at 84% cold instead of 17%. Moving a
          read off the critical path can hide it; it cannot delete it. Which is exactly why the
          gain collapses to +2.5% on a box with enough RAM to keep the pages warm &mdash; there is
          no exposed cold-read time left to hide.
        </p>
      </div>
    </figure>
  )
}
