"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// The contest's scoring rule, in the organisers' own words:
//
//   "Per-kernel speedup — arithmetic mean of per-workload
//    FlashInfer_baseline_latency / your_kernel_latency."
//        — flashinfer-bench-starter-kit/EVALUATION.md
//
// An arithmetic mean of ratios is not the factor by which a workload got
// faster. It is the average of a set of fractions, and it is dominated by the
// largest ones. That matters here specifically, because 69 of the 128 top-k
// indexer traces have max_num_pages <= 32 — every valid token already fits
// inside K = 2048, so top-k selection collapses from a sort to a structural
// mapping and the kernel can skip the work outright. I counted those 69 from
// the contest trace set; it is the one number in this widget that is measured.
//
// Everything else here is yours to set. The point is not to estimate this
// submission's real distribution — nobody published per-workload ratios, and I
// have no B200 to produce them. The point is that for the same set of kernels,
// three defensible summaries of "how much faster" disagree, and the contest
// picks the one that reads highest.
//
// Assumption stated out loud: every trace is given the same baseline latency,
// which is what lets the three estimators be written in closed form. With that,
// for a fast-path fraction f and per-path ratios A (fast) and B (slow):
//
//   arithmetic mean of ratios = f·A + (1−f)·B
//   geometric mean of ratios  = A^f · B^(1−f)
//   ratio of total times      = 1 / (f/A + (1−f)/B)     (the harmonic mean)
//
// The last one is the only one that answers "if I ran the whole trace set,
// how much less time would it take" — and it is always the smallest of the three.

const FAST = "oklch(0.60 0.15 255)"
const MID = "oklch(0.68 0.13 85)"
const REAL = "oklch(0.55 0.16 155)"

const MEASURED_F = 69 / 128

type Est = { key: string; name: string; value: number; blurb: string; color: string }

export function MeanOfRatios() {
  // Deliberately not a reconstruction of this submission. The fast-path
  // fraction starts at the counted 69/128 because that number is real; the two
  // ratios start somewhere that does not add up to 34.93, so nobody mistakes
  // the readout for a measurement I did not make.
  const [fPct, setFPct] = useState(54)
  const [fast, setFast] = useState(80)
  const [slow, setSlow] = useState(6)

  const f = fPct / 100
  const arith = f * fast + (1 - f) * slow
  const geo = mpow(fast, f) * mpow(slow, 1 - f)
  const harm = 1 / (f / fast + (1 - f) / slow)

  const ests: Est[] = [
    {
      key: "arith",
      name: "arithmetic mean of ratios",
      value: arith,
      blurb: "what the contest scores",
      color: FAST,
    },
    {
      key: "geo",
      name: "geometric mean of ratios",
      value: geo,
      blurb: "the usual choice for normalised benchmark results",
      color: MID,
    },
    {
      key: "harm",
      name: "ratio of total times",
      value: harm,
      blurb: "how much less wall time the whole trace set takes",
      color: REAL,
    },
  ]

  const max = Math.max(arith, geo, harm, 1)
  const atMeasured = Math.abs(f - MEASURED_F) < 0.005

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          three ways to average the same set of speedups
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          only 69/128 is measured; the ratios are yours
        </span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                traces on the fast path
              </span>
              <span className="font-mono text-xs tabular-nums">{fPct}%</span>
            </span>
            <Range
              min={0}
              max={100}
              step={1}
              value={fPct}
              accent={FAST}
              onChange={(e) => setFPct(Number(e.currentTarget.value))}
              aria-label="Percentage of traces that hit the structural fast path"
              className="mt-2 w-full"
            />
            <span
              className="mt-1 block font-mono text-[10px]"
              style={{ color: atMeasured ? REAL : undefined }}
            >
              {atMeasured ? "= 69/128, the counted value" : "counted value: 54% (69/128)"}
            </span>
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                fast-path ratio
              </span>
              <span className="font-mono text-xs tabular-nums">{fast}&times;</span>
            </span>
            <Range
              min={1}
              max={200}
              step={1}
              value={fast}
              accent={FAST}
              onChange={(e) => setFast(Number(e.currentTarget.value))}
              aria-label="Speedup ratio on the structural fast path"
              className="mt-2 w-full"
            />
            <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">
              skipping the work entirely
            </span>
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                slow-path ratio
              </span>
              <span className="font-mono text-xs tabular-nums">{slow}&times;</span>
            </span>
            <Range
              min={1}
              max={40}
              step={1}
              value={slow}
              accent={MID}
              onChange={(e) => setSlow(Number(e.currentTarget.value))}
              aria-label="Speedup ratio on the traces that still do the full computation"
              className="mt-2 w-full"
            />
            <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">
              still doing the full score + top-k
            </span>
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {ests.map((e) => (
            <div key={e.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm">{e.name}</span>
                <span
                  className="font-mono text-sm tabular-nums"
                  style={{ color: e.color }}
                >
                  {e.value.toFixed(2)}&times;
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: `${((e.value / max) * 100).toFixed(2)}%`,
                    background: e.color,
                  }}
                />
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                {e.blurb}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          The gap between the top bar and the bottom one is the gap between
          &ldquo;the average of our per-trace ratios&rdquo; and &ldquo;our kernels
          take this fraction of the time.&rdquo; Both are honest arithmetic. Only
          one of them is what a reader hears in{" "}
          <span className="text-foreground">&ldquo;34.93&times; speedup.&rdquo;</span>
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Closed forms assume one baseline latency shared by every trace, which is false in
        detail and does not change the ordering: the arithmetic mean of ratios is never
        below the geometric mean, which is never below the total-time ratio.
      </figcaption>
    </figure>
  )
}
