"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// FreeToken's four MoE backends, and why `hybrid` needs a calibration step.
//
// From docs/models.md:
//
//   fused   — experts resident on GPU (needs the VRAM); never auto-selected.
//   offload — experts live in host RAM, an LRU cache of expert slots on GPU;
//             misses stream over PCIe.
//   cpu     — misses are computed on the CPU instead of fetched.
//   hybrid  — per step, fetches some misses over PCIe and computes the rest on
//             CPU, overlapped. Run `ft bench bw` once per machine to calibrate.
//
// The insight in `hybrid` is that fetching and computing use *different*
// resources, so they run at the same time. A miss handled on the CPU costs no
// PCIe bandwidth; a miss fetched over PCIe costs no CPU. The step therefore
// takes max(fetch_time, compute_time) rather than the sum, and the best split
// is the one that makes those two equal — which depends on the machine, which
// is why it has to be measured rather than assumed.
//
// The two rates below are sliders because that is exactly the point: there is
// no universal answer. The arithmetic is bytes ÷ GB/s against experts ÷ per-second.

const FETCH = "oklch(0.60 0.15 255)"
const CPU = "oklch(0.68 0.13 85)"
const BEST = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const EXPERT_MB = 19 // one int4 expert, roughly

export function HybridSplit() {
  const [misses, setMisses] = useState(24) // expert misses this step
  const [pcie, setPcie] = useState(120) // tenths of a GB/s
  const [cpuRate, setCpuRate] = useState(90) // experts/sec the CPU executor sustains
  const [mode, setMode] = useState<"offload" | "cpu" | "hybrid">("hybrid")

  const bw = pcie / 10
  const fetchSecPer = EXPERT_MB / 1024 / bw // seconds to fetch one expert
  const cpuSecPer = 1 / cpuRate

  // for a given number fetched, the step costs max(fetch, compute)
  const cost = (nFetch: number) =>
    Math.max(nFetch * fetchSecPer, (misses - nFetch) * cpuSecPer)

  let bestN = 0
  let bestT = Infinity
  for (let n = 0; n <= misses; n++) {
    const t = cost(n)
    if (t < bestT) {
      bestT = t
      bestN = n
    }
  }

  const nFetch = mode === "offload" ? misses : mode === "cpu" ? 0 : bestN
  const t = cost(nFetch)
  const fetchT = nFetch * fetchSecPer
  const cpuT = (misses - nFetch) * cpuSecPer

  const W = 700
  const X0 = 92
  const SPAN = Math.max(cost(0), cost(misses), 1e-6) * 1.05
  const px = (v: number) => X0 + (v / SPAN) * (W - X0 - 60)

  const ms = (v: number) => `${(v * 1000).toFixed(0)} ms`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {misses} expert misses in one decode step
        </span>
        <span className="font-mono text-[10px]" style={{ color: mode === "hybrid" ? BEST : MUTED }}>
          {ms(t)} per step{mode === "hybrid" ? ` · fetch ${nFetch}, compute ${misses - nFetch}` : ""}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["offload", "offload — fetch every miss"],
              ["cpu", "cpu — compute every miss"],
              ["hybrid", "hybrid — split them"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 104`} width={W} height={104} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two overlapping bars for one decode step: ${nFetch} experts fetched over PCIe taking ${ms(fetchT)}, and ${misses - nFetch} computed on the CPU taking ${ms(cpuT)}. The step costs the longer of the two, ${ms(t)}.`}
            </title>

            {[
              { l: "PCIe fetch", v: fetchT, n: nFetch, c: FETCH, y: 10 },
              { l: "CPU compute", v: cpuT, n: misses - nFetch, c: CPU, y: 44 },
            ].map((b) => (
              <g key={b.l}>
                <text x={X0 - 10} y={b.y + 13} fontSize={8.5} textAnchor="end" fill={b.c} fontFamily="ui-monospace, monospace">
                  {b.l}
                </text>
                <text x={X0 - 10} y={b.y + 24} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {b.n} expert{b.n === 1 ? "" : "s"}
                </text>
                <rect x={X0} y={b.y} width={Math.max(1, px(b.v) - X0)} height={20} rx={3} fill={b.c} fillOpacity={0.8} />
                <text x={px(b.v) + 7} y={b.y + 14} fontSize={8.5} fill={b.c} fontFamily="ui-monospace, monospace">
                  {ms(b.v)}
                </text>
              </g>
            ))}

            <line x1={px(t)} y1={4} x2={px(t)} y2={78} stroke="currentColor" strokeOpacity={0.45} />
            <text x={px(t) + 6} y={90} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              step ends at {ms(t)} — the longer of the two, not the sum
            </text>
            {mode !== "hybrid" ? (
              <>
                <line x1={px(bestT)} y1={4} x2={px(bestT)} y2={78} stroke={BEST} strokeDasharray="3 3" strokeOpacity={0.7} />
                <text x={px(bestT) - 6} y={90} fontSize={7.5} textAnchor="end" fill={BEST} fontFamily="ui-monospace, monospace">
                  hybrid would land here
                </text>
              </>
            ) : null}
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["misses / step", misses, setMisses, 4, 64, 1, MUTED, "how many routed experts are not in the GPU cache this step", (v: number) => String(v)],
              ["PCIe GB/s", pcie, setPcie, 10, 300, 5, FETCH, "host-to-device bandwidth, in tenths of a gigabyte per second", (v: number) => (v / 10).toFixed(1)],
              ["CPU experts/s", cpuRate, setCpuRate, 10, 400, 10, CPU, "how many expert matmuls per second the CPU executor sustains", (v: number) => String(v)],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria, fmt]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={v}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {fmt(v)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          arithmetic on the two rates — {EXPERT_MB} MB per int4 expert. The real engine measures both
          with <span className="text-foreground">ft bench bw</span> and caches the profile.
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two ways of handling an expert miss use{" "}
          <span className="text-foreground">different hardware</span>. Fetching one over PCIe costs
          bandwidth and no CPU; computing it on the CPU costs cores and no bandwidth. So they overlap,
          and a step costs the <em>longer</em>{" "}of the two rather than the sum — which means the
          best split is the one that makes them finish together.
          <br />
          <br />
          Try the two pure strategies at the default rates and watch the green line sit well to the
          left of both. <span style={{ color: FETCH }}>Fetch everything</span>{" "}and the CPU idles;{" "}
          <span style={{ color: CPU }}>compute everything</span>{" "}and the bus does. Neither is wrong
          in general — which is the actual point, and why FreeToken ships{" "}
          <span className="font-mono text-[11px] text-foreground">ft bench bw</span>{" "}as a
          once-per-machine calibration rather than picking a constant. Drag the PCIe slider down to
          laptop numbers and the optimum walks toward the CPU; drag it up and it walks back.
        </p>
      </div>
    </figure>
  )
}
