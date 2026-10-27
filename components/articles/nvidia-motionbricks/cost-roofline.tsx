"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { CPU_MS, POSE_FLOPS, TORCH_MS, POSE_WEIGHT_BYTES, TRT_4090, type Family } from "./data"

// Why the pose pass costs the same at 6 tokens as at 16. The FLOP count is
// arithmetic on the shapes (reasoned); the CPU times are bench.py on a shared
// box with random weights of the real shapes (measured); the GPU times are
// the project's own trtexec table (reported).

const ACCENT = "oklch(0.62 0.16 35)"
const BLUE = "oklch(0.60 0.15 255)"

const POSITIONS = [6, 11, 16]

export function CostRoofline() {
  const [li, setLi] = useState(2)
  const [batch, setBatch] = useState<1 | 8>(1)
  const [fam, setFam] = useState<Family>("g1")
  const L = POSITIONS[li]
  const flops = POSE_FLOPS[L] * batch
  const intensity = flops / POSE_WEIGHT_BYTES
  const cpu = CPU_MS[`B${batch}_L${L}`]
  const cpuMid = (cpu[0] + cpu[1]) / 2
  const torch = TORCH_MS[`B${batch}_L${L}`]
  const gflops = flops / 1e9 / (cpuMid / 1000)
  const bw = POSE_WEIGHT_BYTES / 1e9 / (cpuMid / 1000)
  const trt = TRT_4090[fam]
  const cols = [1, 8, 16, 32] as const
  const maxMs = 8

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one pose-predictor pass · counted, measured and reported</span>
        <div className="flex gap-1" role="group" aria-label="Batch size">
          {([1, 8] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBatch(b)}
              aria-pressed={batch === b}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${batch === b ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              batch {b}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>token positions L</span>
            <span className="font-mono">{L}</span>
          </label>
          <Range min={0} max={2} step={1} value={li} onChange={(e) => setLi(Number(e.target.value))} aria-label="Token positions" accent={ACCENT} />
        </div>
        <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">work (counted)</dt>
            <dd className="text-sm">{(flops / 1e9).toFixed(2)} GFLOP</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">weights read</dt>
            <dd className="text-sm">{(POSE_WEIGHT_BYTES / 1e6).toFixed(0)} MB</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">FLOP per byte</dt>
            <dd className="text-sm">{intensity.toFixed(1)}</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">CPU, 2 threads (measured)</dt>
            <dd className="text-sm">
              {cpu[0].toFixed(0)} / {cpu[1].toFixed(0)} ms
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          The CPU run did {gflops.toFixed(1)} GFLOP/s and streamed weights at {bw.toFixed(1)} GB/s. Going from 6 to 16 positions nearly triples the work and
          barely moves the time at batch 1 in that numpy run, because the 16 layers&apos; weights are read once per pass whatever the length. Two runs shown; the box was shared.
        </p>
        <p className="text-sm text-muted-foreground">
          With the real weights loaded in PyTorch, the same shape took {torch[0].toFixed(0)} ms (median; {torch[1].toFixed(0)} to {torch[2].toFixed(0)} ms over 15
          calls), {(cpuMid / torch[0]).toFixed(1)} times faster than the numpy figure, and the time does grow with positions. That run did{" "}
          {(flops / 1e9 / (torch[0] / 1000)).toFixed(1)} GFLOP/s.
        </p>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-xs text-muted-foreground">whole model on an RTX 4090 (reported by the project), ms per batch</p>
            <div className="flex gap-1" role="group" aria-label="Model family">
              {(["g1", "soma"] as Family[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFam(f)}
                  aria-pressed={fam === f}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${fam === f ? "bg-foreground text-background" : "text-muted-foreground"}`}
                >
                  {f === "g1" ? "G1" : "SOMA"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            {cols.map((n) => (
              <div key={n} className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-center gap-2 font-mono text-[11px]">
                <span className="text-muted-foreground">N = {n}</span>
                <div className="space-y-0.5">
                  {(["fp32", "fp16"] as const).map((p) => {
                    const [ms, rps] = trt[p][n]
                    return (
                      <div key={p} className="flex items-center gap-2">
                        <div className="h-3 rounded-sm" style={{ width: `${(ms / maxMs) * 100}%`, background: p === "fp32" ? ACCENT : BLUE }} />
                        <span>
                          {ms.toFixed(2)} ms · {rps.toLocaleString("en-US")}/s {p}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
