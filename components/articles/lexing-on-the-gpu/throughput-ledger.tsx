"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

// Who actually parses the JSON faster, and what you had to not count to say so.
//
// Every millisecond here is from the thesis's own Appendix C, which is the only
// place the per-stage numbers exist: Table C.6 for the GPU JSON parser (one
// RTX 3090, Futhark CUDA back end) and Table C.4 for simdjson (one thread).
// Each is the mean of 30 runs.
//
// The thing worth noticing is arithmetic, not opinion. In Table C.5 (the
// compiler) the Total column equals Upload + every stage. In Table C.6 (the
// JSON parser) it equals the stages *without* Upload -- 58.41 + 56.86 + 12.20 +
// 42.11 = 169.58, and the printed total is 169.59, while Upload is a separate
// 107.43. So the headline "the GPU parser beats simdjson on large input" is a
// comparison in which the GPU's copy of the document is already resident and
// simdjson's is too, except simdjson's got there for free and the GPU's crossed
// PCIe. Both switches below default to the honest setting.
//
// Bar geometry only; the numbers rendered are plain + - * / on the table values.

type Row = {
  name: string
  bytes: number
  sizeLabel: string
  upload: number
  stages: number
  simdjson: number
}

// Sizes as the thesis states them in Table 5.1a. It rounds (it calls the last
// file 442 MB in one table and 443 MB in another), so treat the GB/s column as
// two significant figures.
const ROWS: Row[] = [
  {
    name: "twitter_api_response",
    bytes: 15_200,
    sizeLabel: "15.2 KB",
    upload: 9.22,
    stages: 0.65,
    simdjson: 0.05,
  },
  {
    name: "spirv.core.grammar",
    bytes: 423_000,
    sizeLabel: "423 KB",
    upload: 9.24,
    stages: 1.82,
    simdjson: 1.31,
  },
  {
    name: "gsoc-2018",
    bytes: 3_330_000,
    sizeLabel: "3.33 MB",
    upload: 9.69,
    stages: 2.01,
    simdjson: 4.99,
  },
  {
    name: "refsnp-chrMT",
    bytes: 66_000_000,
    sizeLabel: "66.0 MB",
    upload: 23.8,
    stages: 25.32,
    simdjson: 76.09,
  },
  {
    name: "refsnp-other-100K",
    bytes: 442_000_000,
    sizeLabel: "442 MB",
    upload: 107.43,
    stages: 169.59,
    simdjson: 514.64,
  },
]

// Section 5.3.3: "The JSON parser ... requires an average of 2.0 seconds to be
// initialized", because Futhark hands OpenCL/CUDA kernel source to the driver
// at context creation. Paid once per process, not per document.
const JIT_MS = 2000

const GPU = "oklch(0.62 0.16 65)"
const CPU = "oklch(0.55 0.16 250)"

const LO = mlog10(0.04)
const HI = mlog10(3000)
const pct = (ms: number) => {
  const v = ((mlog10(ms) - LO) / (HI - LO)) * 100
  return Math.max(0.6, Math.min(100, v))
}

// bytes / ms -> GB/s, decimal GB.
const rate = (bytes: number, ms: number) => bytes / ms / 1e6

const fmtMs = (ms: number) => (ms < 10 ? ms.toFixed(2) : ms.toFixed(0))
const fmtRate = (r: number) => (r < 0.1 ? r.toFixed(3) : r < 1 ? r.toFixed(2) : r.toFixed(2))

function Toggle({
  on,
  set,
  children,
}: {
  on: boolean
  set: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set(!on)}
      className={
        "rounded-full border px-3 py-1 text-left font-mono text-[11px] leading-5 transition-colors " +
        (on
          ? "border-foreground/30 bg-foreground/10 text-foreground"
          : "border-border bg-transparent text-muted-foreground hover:text-foreground")
      }
    >
      <span aria-hidden="true">{on ? "■" : "□"}</span> {children}
    </button>
  )
}

export function ThroughputLedger() {
  const [upload, setUpload] = useState(true)
  const [jit, setJit] = useState(false)

  const gpuMs = (r: Row) => r.stages + (upload ? r.upload : 0) + (jit ? JIT_MS : 0)
  const wins = ROWS.filter((r) => gpuMs(r) < r.simdjson).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          JSON, whole document to parse tree &mdash; RTX 3090 vs simdjson, 1 thread
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          thesis Appendix C, mean of 30 runs
        </span>
      </div>

      <div className="flex flex-wrap gap-2 border-b bg-muted/20 px-4 py-3">
        <Toggle on={upload} set={setUpload}>
          count the host&rarr;device upload
        </Toggle>
        <Toggle on={jit} set={setJit}>
          count Futhark&rsquo;s 2.0 s kernel compile
        </Toggle>
        <span className="ml-auto self-center font-mono text-[11px] text-muted-foreground">
          GPU wins {wins} of 5
        </span>
      </div>

      <div className="space-y-4 p-3 sm:p-5">
        {ROWS.map((r) => {
          const g = gpuMs(r)
          const gpuWins = g < r.simdjson
          return (
            <div key={r.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-mono text-[13px]">{r.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {r.sizeLabel} &middot;{" "}
                  <span className={gpuWins ? "text-foreground/80" : "text-foreground/50"}>
                    {gpuWins
                      ? `GPU ${(r.simdjson / g).toFixed(2)}×`
                      : `simdjson ${(g / r.simdjson).toFixed(2)}×`}
                  </span>
                </span>
              </div>

              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    GPU
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct(g).toFixed(3)}%`, background: GPU }}
                    />
                  </span>
                  <span className="w-36 shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {fmtMs(g)} ms &middot; {fmtRate(rate(r.bytes, g))} GB/s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    simdjson
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct(r.simdjson).toFixed(3)}%`, background: CPU }}
                    />
                  </span>
                  <span className="w-36 shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {fmtMs(r.simdjson)} ms &middot; {fmtRate(rate(r.bytes, r.simdjson))} GB/s
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        GPU = lexical analysis + parsing + parse-tree construction + restructuring, the
        four stages Table C.6 sums into its Total. The upload row is a separate column in
        that table and is excluded from it; it carries the document <em>and</em> the 34.9 MB
        merge table. simdjson parses from memory on the other benchmark machine
        (2&times; EPYC 7601), so this is a cross-machine comparison in both directions.
      </figcaption>
    </figure>
  )
}
