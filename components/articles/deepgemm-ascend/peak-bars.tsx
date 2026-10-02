"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The launch tweet put two numbers next to each other — "99.8% of the hardware
// limit on GEMM and 98% on MegaMoE" — and the easy read is that they are the
// same measurement on two workloads. They are not. Both are DeepGEMM-Ascend,
// both are a share of a theoretical compute peak, but they measure different
// ops at different dtypes, and the 98% carries communication the 99.8% never
// touches. A third number floats around the same announcement: DeepEP-Ascend's
// bandwidth, a different library and a different resource entirely — GB/s, not a
// fraction of a FLOPS peak.
//
// Compute values are reported by the DeepGEMM-Ascend README (bench_msprof,
// Ascend 950DT, CANN 9.20); the MegaMoE and grouped-GEMM percentages are mine:
// achieved TFLOPS over the 865-TFLOP FP8 peak the dense table states
// (846.3/865 = 97.8, 862/865 = 99.65). The compute view is zoomed to 95-100% so
// the two-point gap is visible. Bandwidth values are the DeepEP-Ascend README's
// reported GB/s ranges; the bar sits at the range midpoint and the exact range
// is printed beneath it. Nothing here is a number the sources do not state.

type Mode = "compute" | "bandwidth"

const GEMM = "oklch(0.60 0.15 255)"
const MOE = "oklch(0.64 0.17 25)"
const COMM = "oklch(0.60 0.13 165)"

type Bar = {
  key: string
  label: string
  sub: string
  value: number
  color: string
  hl?: boolean
}

const COMPUTE: Bar[] = [
  { key: "bf16", label: "BF16 dense GEMM", sub: "431 / 432 TFLOPS", value: 99.8, color: GEMM, hl: true },
  { key: "fp8", label: "FP8 dense GEMM", sub: "861 / 865 TFLOPS", value: 99.5, color: GEMM },
  { key: "fp8fp4", label: "FP8xFP4 dense GEMM", sub: "861 / 865 TFLOPS", value: 99.5, color: GEMM },
  { key: "fp4", label: "FP4 dense GEMM", sub: "1701 / 1730 TFLOPS", value: 98.3, color: GEMM },
  { key: "grouped", label: "Grouped GEMM (experts)", sub: "862 / 865 TFLOPS, FP8xFP4", value: 99.6, color: MOE },
  { key: "mega", label: "MegaMoE fused op", sub: "846 / 865 TFLOPS, FP8 + comm", value: 97.8, color: MOE, hl: true },
]

const BANDWIDTH: Bar[] = [
  { key: "disp8", label: "Dispatch, EP8", sub: "373-375 GB/s", value: 374, color: COMM, hl: true },
  { key: "disp32", label: "Dispatch, EP32", sub: "335-340 GB/s", value: 337, color: COMM },
  { key: "disp128", label: "Dispatch, EP128", sub: "313-320 GB/s, under optimization", value: 316, color: COMM },
  { key: "comb8", label: "Combine, EP8", sub: "345-347 GB/s", value: 346, color: COMM },
  { key: "comb128", label: "Combine, EP128", sub: "272-278 GB/s, under optimization", value: 275, color: COMM },
]

export function PeakBars() {
  const [mode, setMode] = useState<Mode>("compute")

  const compute = mode === "compute"
  const bars = compute ? COMPUTE : BANDWIDTH
  const axisMin = compute ? 95 : 0
  const axisMax = compute ? 100 : 400
  const span = axisMax - axisMin
  const unit = compute ? "%" : " GB/s"

  const width = (v: number) => {
    const clamped = Math.min(axisMax, Math.max(axisMin, v))
    return ((clamped - axisMin) / span) * 100
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          which number is which op
        </span>
        <div className="flex gap-1 rounded-lg border bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => setMode("compute")}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
              compute ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={compute}
          >
            compute (DeepGEMM)
          </button>
          <button
            type="button"
            onClick={() => setMode("bandwidth")}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
              !compute ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={!compute}
          >
            bandwidth (DeepEP)
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          {compute ? (
            <>
              Share of the chip&rsquo;s{" "}
              <span className="text-foreground">peak TFLOPS</span> for that dtype,
              achieved by a DeepGEMM-Ascend kernel. The headline{" "}
              <span className="text-foreground">99.8%</span> is one dense BF16
              matmul; the headline <span className="text-foreground">98%</span> is
              the fused MegaMoE op, which also runs the expert dispatch and combine.
            </>
          ) : (
            <>
              DeepEP-Ascend&rsquo;s all-to-all throughput, in{" "}
              <span className="text-foreground">GB/s</span> &mdash; a different
              library and a different resource. The README adds that dispatch at EP
              sizes up to 32 reaches roughly{" "}
              <span className="text-foreground">90-95%</span> of the physical
              payload bandwidth limit; combine and larger groups are lower and
              still under optimization.
            </>
          )}
        </p>

        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className={cn("text-sm", b.hl && "font-medium text-foreground")}>
                  {b.label}
                </span>
                <span
                  className="font-mono text-sm tabular-nums"
                  style={{ color: b.color }}
                >
                  {compute ? b.value.toFixed(1) : b.sub.split(" ")[0]}
                  {unit}
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{
                    width: `${width(b.value).toFixed(2)}%`,
                    background: b.color,
                    opacity: b.hl ? 1 : 0.7,
                  }}
                />
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                {b.sub}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          {compute ? (
            <>
              Axis starts at 95%, so a two-point gap is readable. All six ops sit
              near the ceiling, but the fused MoE op is the lowest: it pays for the
              communication the dense matmul does not. The grouped GEMM alone &mdash;
              one stage inside MegaMoE &mdash; is within a rounding point of peak.
            </>
          ) : (
            <>
              A bandwidth number and a FLOPS number are not comparable, which is the
              whole point of the toggle. These were measured on a pre-release (PoC)
              HDK; the README says full bandwidth needs Huawei&rsquo;s Q3 commercial
              release, not public yet.
            </>
          )}
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        {compute
          ? "Reported: DeepGEMM-Ascend README (bench_msprof, Ascend 950DT, cold L2). MegaMoE and grouped-GEMM percentages are achieved/865 FP8 peak."
          : "Reported: DeepEP-Ascend README (16,384 tokens/rank, hidden 7168, top-6, 256 experts). Bars sit at each reported range's midpoint."}
      </figcaption>
    </figure>
  )
}
