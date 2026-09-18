"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where a GLM-5.3-Flash decode step goes on a Kaggle TPU v5e-8, and how far it
// sits from the memory roofline.
//
// The three published points are the project's own, from the notebook's config
// cell: "one stream ~65 tok/s, two ~40 each, three ~30 each". A least-squares
// fit of step time against the number of (token, expert) pairs a step touches —
// 8 experts per token per layer, 42 sparse layers, so 336 pairs per stream —
// gives
//
//   step(N) = 6.624 ms + 8.974 ms x N      (residual under 1.5% on all three)
//
// I did NOT measure this. I have no TPU. Every millisecond below is derived from
// three numbers the project published, and the split into a fixed part and a
// per-stream part is a model, not an observation. What the model IS good for is
// the comparison underneath it, which does not depend on the fit being exact.
//
// Roofline: a v5e chip has 800 GiB/s of HBM bandwidth (Google's own figure).
// Per decode step per chip the engine must read
//   experts     336 x N pairs x 1,144,149 B  =  384.4 MB x N
//   everything else, int8                    =  1,115.1 MB
// so the bytes alone are 1.298 ms + 0.448 ms x N. The expert half of a step
// therefore runs at about 5% of what HBM could deliver. That is not sloppiness:
// at 2.89 bits a weight is a codebook index, and glm53/pallas_moe.py spends one
// in-vreg lane gather per weight turning it back into a number. 117.8 billion of
// them per second per chip is what that costs.
//
// Arithmetic is +, -, *, / and Math.round only.

const FIXED_MS = 6.624 // fitted: everything that is not a routed expert
const PER_STREAM_MS = 8.974 // fitted: 336 (token, expert) pairs
const PAIRS_PER_STREAM = 336 // 8 experts x 42 sparse layers
const BYTES_PER_PAIR = 1_144_149 // planar expert bytes per (layer, expert) per chip
const NONEXPERT_BYTES = 1_115_125_000 // int8, per chip
const HBM_BPS = 800 * 1024 * 1024 * 1024 // 800 GiB/s, TPU v5e, per chip
const WEIGHTS_PER_PAIR = (3 * 4096 * 2048) / 8 // gate + up + down, this chip's slice

const PUBLISHED: Record<number, number> = { 1: 65, 2: 40, 3: 30 }

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

const step = (n: number) => FIXED_MS + PER_STREAM_MS * n
const roofline = (n: number) =>
  ((NONEXPERT_BYTES + PAIRS_PER_STREAM * n * BYTES_PER_PAIR) / HBM_BPS) * 1000

const MAX_MS = step(4)

export function DecodeCost() {
  const [n, setN] = useState(1)

  const t = step(n)
  const rt = roofline(n)
  const perStream = 1000 / t
  const expertMs = PER_STREAM_MS * n
  const expertRoof = ((PAIRS_PER_STREAM * n * BYTES_PER_PAIR) / HBM_BPS) * 1000
  const gWeights =
    (PAIRS_PER_STREAM * n * WEIGHTS_PER_PAIR) / (expertMs / 1000) / 1e9

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one decode step, per chip &middot; fitted to the project&rsquo;s own three points
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          derived, not measured by me
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {[1, 2, 3, 4].map((k) => {
            const tk = step(k)
            const pub = PUBLISHED[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => setN(k)}
                aria-pressed={n === k}
                className={cn(
                  "grid w-full grid-cols-[3.8rem_minmax(0,1fr)_auto] items-center gap-2 rounded-sm px-1 py-0.5 text-left sm:grid-cols-[4.6rem_minmax(0,1fr)_auto]",
                  n === k ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground sm:text-[11px]">
                  {k} stream{k === 1 ? "" : "s"}
                </span>
                <span className="relative block h-6 overflow-hidden rounded-sm bg-foreground/[0.04]">
                  <span
                    className="absolute top-0 h-6 bg-sky-700/80"
                    style={{ width: `${(FIXED_MS / MAX_MS) * 100}%` }}
                  />
                  <span
                    className="absolute top-0 h-6 bg-violet-600/85"
                    style={{
                      left: `${(FIXED_MS / MAX_MS) * 100}%`,
                      width: `${((PER_STREAM_MS * k) / MAX_MS) * 100}%`,
                    }}
                  />
                </span>
                <span className="flex items-center gap-2 font-mono text-[10px] whitespace-nowrap tabular-nums">
                  <span className="hidden w-14 text-right text-muted-foreground sm:inline">
                    {r2(tk)} ms
                  </span>
                  <span className="w-[4.6rem] text-right">{r1(1000 / tk)} tok/s</span>
                  <span
                    className={cn(
                      "hidden w-[5.6rem] text-right sm:inline",
                      pub ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground/50"
                    )}
                  >
                    {pub ? `published ~${pub}` : "not published"}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-700/80" /> everything that is
            not a routed expert
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-600/85" /> the routed
            experts
          </span>
        </div>

        <div className="mt-4 rounded-md border bg-background/60 p-3">
          <p className="mb-2 font-mono text-[11px]">
            {n} stream{n === 1 ? "" : "s"} &middot; {PAIRS_PER_STREAM * n} (token, expert) pairs
            per step
          </p>
          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">step time (fitted)</dt>
              <dd className="font-mono tabular-nums">{r2(t)} ms</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">same bytes at 800 GiB/s</dt>
              <dd className="font-mono tabular-nums">{r2(rt)} ms</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">per stream / aggregate</dt>
              <dd className="font-mono tabular-nums">
                {r1(perStream)} / {r1(perStream * n)} tok/s
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">HBM utilisation, whole step</dt>
              <dd className="font-mono tabular-nums">{r1((rt / t) * 100).toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">expert bytes read</dt>
              <dd className="font-mono tabular-nums">
                {r1((PAIRS_PER_STREAM * n * BYTES_PER_PAIR) / 1e6)} MB/chip
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">HBM utilisation, expert half</dt>
              <dd className="font-mono tabular-nums">
                {r1((expertRoof / expertMs) * 100).toFixed(1)}%
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="text-muted-foreground">
                weights dequantized, per chip
              </dt>
              <dd className="font-mono tabular-nums">
                {r1(gWeights)} G/s &mdash; about one lane gather each
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The fit is the project&rsquo;s three published rates, nothing more; the
          fourth row is an extrapolation and the README says a fourth stream does
          not fit at full context anyway. The number that survives the modelling
          is the last one: the decode path is nowhere near memory-bound, because
          at 2.89 bits a weight is a codebook index and turning it back into a
          number costs a dynamic lane gather.
        </p>
      </div>
    </figure>
  )
}
