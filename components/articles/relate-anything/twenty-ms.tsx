"use client"

import { useState } from "react"

import { FigureCard, GATE, MODEL, MUTED, Segmented, WARN } from "./shared"

// "It runs at 20 ms/frame" is one sentence in the abstract and nine numbers in
// the appendix. This lays all nine out so you can see which one it is.
//
// Sources, all arXiv 2609.12552v1, batch 1, median of 200 frames after 20
// warm-up, CUDA-event timed:
//   relation head alone, bf16, 19,103-string bank ......... Table 34
//   detector + head + decode, six execution paths ......... Table 35
//   end to end under the OvSGTR comparison protocol ....... Table 11
//   OvSGTR Swin-T, the baseline, same protocol ............ Table 11
//
// Two things fall out of putting them side by side. The abstract's figure is
// the compiled end-to-end path on an A40 (20.3 ms) — and docs/deployment.md
// says compilation "moves evaluation metrics by 40x the noise floor, so never
// benchmark a compiled model", which means the 20 ms configuration and the
// configuration every accuracy number was measured in are not the same
// configuration. And the A100, the newer card, is the slowest of the three at
// batch 1 in every row, because this workload is CPU-dispatch bound and the
// A100 node has the older host.

type Gpu = "A40" | "A100" | "H100"

interface Row {
  label: string
  source: string
  ms: Record<Gpu, number>
  /** true where the paper or the repo says not to measure accuracy here. */
  suspect?: boolean
  /** the row the accuracy tables were produced under */
  scored?: boolean
}

const ROWS: Row[] = [
  {
    label: "relation head alone",
    source: "Table 34",
    ms: { A40: 19.3, A100: 28.1, H100: 19.3 },
  },
  {
    label: "+ detector + decode, eager",
    source: "Table 35",
    ms: { A40: 30.5, A100: 43.1, H100: 32.1 },
    scored: true,
  },
  {
    label: "eager, backbone concurrent",
    source: "Table 35",
    ms: { A40: 27.9, A100: 41.9, H100: 59.3 },
  },
  {
    label: "torch.compile, sequential",
    source: "Table 35",
    ms: { A40: 20.3, A100: 24.4, H100: 18.1 },
    suspect: true,
  },
  {
    label: "torch.compile, concurrent",
    source: "Table 35",
    ms: { A40: 22.3, A100: 31.0, H100: 55.1 },
    suspect: true,
  },
  {
    label: "CUDA graphs, concurrent",
    source: "Table 35",
    ms: { A40: 21.5, A100: 29.9, H100: 50.8 },
    suspect: true,
  },
  {
    label: "ONNX Runtime, CUDA EP",
    source: "Table 35",
    ms: { A40: 29.7, A100: 27.6, H100: 21.2 },
  },
  {
    label: "end to end, vs. the baseline",
    source: "Table 11",
    ms: { A40: 25.0, A100: 35.0, H100: 25.6 },
  },
]

const BASELINE: Record<Gpu, number> = { A40: 194.0, A100: 179.9, H100: 128.1 }

const AXIS = 64 // ms, fixed so the three GPUs stay comparable
const TARGET = 20

export function TwentyMilliseconds() {
  const [gpu, setGpu] = useState<Gpu>("A40")

  const under = ROWS.filter((r) => r.ms[gpu] <= TARGET).length

  return (
    <FigureCard
      label="every batch-1 latency the paper reports for the released tower"
      right={
        <span className="font-mono">
          {under} of {ROWS.length} at or under {TARGET} ms
        </span>
      }
    >
      <div className="relative space-y-2">
        {ROWS.map((r) => {
          const ms = r.ms[gpu]
          const color = r.suspect ? WARN : r.scored ? GATE : ms <= TARGET ? MODEL : MUTED
          return (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-[8.5rem] shrink-0 truncate font-mono text-[10px] text-muted-foreground sm:w-52">
                {r.label}
              </span>
              <div className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/40">
                <div
                  className="h-full rounded-sm transition-[width] duration-300 ease-out"
                  style={{ width: `${(ms / AXIS) * 100}%`, background: color }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-foreground/45"
                  style={{ left: `${(TARGET / AXIS) * 100}%` }}
                />
              </div>
              <span
                className="w-14 shrink-0 text-right font-mono text-xs tabular-nums"
                style={{ color }}
              >
                {ms.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-2 pl-[8.5rem] font-mono text-[10px] text-muted-foreground sm:pl-52">
        the vertical rule is {TARGET} ms — the abstract&apos;s figure
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="GPU"
          value={gpu}
          onChange={setGpu}
          options={[
            { value: "A40", label: "A40" },
            { value: "A100", label: "A100" },
            { value: "H100", label: "H100" },
          ]}
        />
        <span className="font-mono text-[11px] text-muted-foreground">
          OvSGTR Swin-T, same protocol: {BASELINE[gpu].toFixed(1)} ms
        </span>
      </div>

      <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
        <p>
          <span style={{ color: GATE }}>Blue</span> is the eager path every
          accuracy number in the paper was produced under.{" "}
          <span style={{ color: WARN }}>Red</span> is compiled: faster, and the
          configuration the repo&apos;s own deployment notes say never to score a
          model in, because compilation moves evaluation metrics by forty times
          the noise floor.
        </p>
        <p>
          The A100 is the slowest card here at batch 1 on every row, and it is
          not close. That is not a GPU result — the head issues about 1,362
          kernels per frame, so batch 1 is bound by host dispatch, and the A100
          node runs an older host CPU than the A40 and H100 nodes. At batch 32
          the same A100 delivers roughly twice the A40&apos;s throughput.
        </p>
      </div>
    </FigureCard>
  )
}
