"use client"

import { useState } from "react"

import { mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The repo's own benchmark, render-bench/vs-remotion: one fixed scene of 99,000
// one-pixel rects and 1,000 changing text digits at 1000x1000, 30 frames, both
// renderers serial and with no video encoder. The timings are the repo's
// results.md, measured on Linux ARM64 Docker against Remotion 4.0.529:
//   fframes + Skia CPU   3.877 s
//   fframes + Skia GPU   skipped (no hardware GPU in that environment)
//   Remotion             120.801 s
// 120.801 / 3.877 = 31.16x, which is the README's number. This is a CPU-vs-CPU
// result; the GPU path, the framework's headline, was never exercised here.
//
// Linear makes the 31x gap obvious and the CPU bar a sliver; log makes both
// bars legible and the gap a distance. Log goes through lib/dmath so the SSR
// and browser attribute strings agree.

type Row = { label: string; value: number; kind: "cpu" | "remotion" | "gpu" }

const ROWS: Row[] = [
  { label: "fframes + Skia CPU", value: 3.877, kind: "cpu" },
  { label: "fframes + Skia GPU", value: Number.NaN, kind: "gpu" },
  { label: "Remotion 4.0.529", value: 120.801, kind: "remotion" },
]

const COLOR: Record<Row["kind"], string> = {
  cpu: "oklch(0.64 0.17 42)",
  remotion: "oklch(0.60 0.02 260)",
  gpu: "oklch(0.70 0.03 42)",
}

// Reasoned only: the README says the GPU backend is about 10x the CPU one, so
// 3.877 / 10 is roughly 0.39 s. It was not measured in this benchmark.
const GPU_REASONED = 3.877 / 10

const MAX = 120.801
const linW = (v: number) => (v / MAX) * 100
// log maps [0.3, MAX] onto 0..100 so sub-second bars stay visible.
const LO = 0.3
const logW = (v: number) => ((mlog(Math.max(v, LO)) - mlog(LO)) / (mlog(MAX) - mlog(LO))) * 100

export function RenderCostBar() {
  const [log, setLog] = useState(false)
  const width = (v: number) => (log ? logW(v) : linW(v))

  const seg = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-3 py-1 font-mono text-[10px] transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">vs-remotion: 30 frames, one scene, no encoder</span>
        <span className="font-mono text-[10px] text-muted-foreground">Linux ARM64, Remotion 4.0.529, repo results.md</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex gap-1.5">
          <button type="button" className={seg(!log)} aria-pressed={!log} onClick={() => setLog(false)}>
            linear
          </button>
          <button type="button" className={seg(log)} aria-pressed={log} onClick={() => setLog(true)}>
            log
          </button>
        </div>

        <div className="space-y-3">
          {ROWS.map((r) => {
            const measured = Number.isFinite(r.value)
            const shown = measured ? r.value : GPU_REASONED
            return (
              <div key={r.label}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
                  <span className="text-foreground">{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {measured ? `${r.value.toFixed(3)} s` : "skipped — no hardware GPU"}
                  </span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded bg-muted/30">
                  <div
                    className="flex h-full items-center rounded"
                    style={{
                      width: `${Math.max(width(shown), measured ? 0.6 : 0).toFixed(2)}%`,
                      minWidth: measured ? 2 : 0,
                      background: COLOR[r.kind],
                      opacity: measured ? 1 : 0.35,
                      border: measured ? undefined : `1px dashed ${COLOR[r.kind]}`,
                    }}
                  />
                </div>
                {!measured ? (
                  <p className="mt-1 font-mono text-[10px] italic text-muted-foreground">
                    reasoned, not measured: README says the GPU backend is about 10× the CPU one, so roughly{" "}
                    {GPU_REASONED.toFixed(2)} s — the bar is a dashed placeholder
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          fframes + Skia on the CPU is <span className="text-foreground">31.16×</span> faster than Remotion here
          (120.801 / 3.877). That is the README&rsquo;s headline, and it is real for this scene. It is also CPU versus
          CPU: the GPU, which is what &ldquo;render it on the GPU&rdquo; sells, was skipped because the benchmark box had
          no hardware device. And the Remotion side pays for 12 chained effect passes per element, a React pattern this
          workload leans into. Read the number as a floor for one synthetic scene, not as a general 31× over Remotion.
        </p>
      </div>
    </figure>
  )
}
