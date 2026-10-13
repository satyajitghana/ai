"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A back-of-envelope model of one decode step of MiniCPM-V 4.7 35B-A3B when
// the routed experts live on flash, built from the two timings OpenBMB prints
// in its LES diagram (tc-mb/llama.cpp-omni docs/les/lookahead-expert-scheduling.png):
//   read one expert from flash  ~ 1.00 ms
//   compute one whole layer     ~ 1.15 ms
// and the model's shape from config.json: 40 MoE layers, 8 routed experts per
// token. The attention / expert split of the 1.15 ms is mine (0.30 + 0.85 ms,
// roughly the proportions the diagram draws); the diagram does not give it.
//
// Two schedules:
//   wait-all   the router picks 8 experts, every one not already resident is read
//              serially, then the layer computes. This is the "No prefetch: 8
//              experts read serially = 8.0 ms/layer" line in the diagram.
//   LES order  resident experts compute first while the missing ones are read,
//              and only the experts that arrive late compute after the read.
// The model ignores CPU bookkeeping, I/O parallelism and DSpark, so it is an
// upper bound on what the ordering alone can buy, not a prediction. Its wait-all
// row at 0 resident gives 2.73 tok/s against OpenBMB's measured 2.97 tok/s baseline.
// Only + - * / and Math.round reach the DOM.

const LAYERS = 40
const TOPK = 8
const READ = 1.0
const ATTN = 0.3
const EXPERT = 0.85

function layerMs(resident: number, les: boolean) {
  const missing = TOPK - resident
  if (!les) return ATTN + missing * READ + EXPERT
  const residentCompute = (EXPERT * resident) / TOPK
  const lateCompute = (EXPERT * missing) / TOPK
  return ATTN + Math.max(residentCompute, missing * READ) + lateCompute
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

export function ExpertStall() {
  const [resident, setResident] = useState(7)

  const arms = [
    { id: "wait-all", les: false, color: "#94a3b8" },
    { id: "LES order", les: true, color: "#7c3aed" },
  ]
  const worst = layerMs(0, false)
  const pct = (ms: number) => `${Math.round((ms / worst) * 1000) / 10}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one MoE layer, experts on flash</span>
        <span className="font-mono text-[10px] text-muted-foreground">timings from OpenBMB&rsquo;s LES diagram; my model</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
          <span>already resident when the router fires: {resident} of 8</span>
          <Range
            className="min-w-[10rem] flex-1"
            min={0}
            max={8}
            step={1}
            value={resident}
            onChange={(e) => setResident(Number(e.target.value))}
            aria-label="experts already resident"
          />
        </label>

        <div className="space-y-3">
          {arms.map((a) => {
            const ms = layerMs(resident, a.les)
            const step = ms * LAYERS
            const missing = TOPK - resident
            return (
              <div key={a.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">{a.id}</span>
                  <span>
                    {r2(ms)} ms/layer &middot; {r1(step)} ms/token &middot;{" "}
                    <span className="text-foreground">{r1(1000 / step)} tok/s</span>
                  </span>
                </div>
                <div className="mt-1 flex h-7 w-full overflow-hidden rounded-md border bg-muted/20" aria-hidden>
                  <div style={{ width: pct(ATTN), background: "#0ea5e9", opacity: 0.55 }} />
                  {a.les ? (
                    <>
                      <div
                        className="relative"
                        style={{ width: pct(Math.max((EXPERT * resident) / TOPK, missing * READ)) }}
                      >
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{ width: `${(((EXPERT * resident) / TOPK) / Math.max((EXPERT * resident) / TOPK, missing * READ || 1e-9)) * 100}%`, background: a.color, opacity: 0.55 }}
                        />
                        <div
                          className="absolute inset-x-0 bottom-0 h-1.5"
                          style={{
                            width: `${((missing * READ) / Math.max((EXPERT * resident) / TOPK, missing * READ || 1e-9)) * 100}%`,
                            background: "repeating-linear-gradient(45deg,#ef4444,#ef4444 3px,transparent 3px,transparent 6px)",
                          }}
                        />
                      </div>
                      <div style={{ width: pct((EXPERT * missing) / TOPK), background: a.color, opacity: 0.85 }} />
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: pct(missing * READ),
                          background: "repeating-linear-gradient(45deg,#ef4444,#ef4444 3px,transparent 3px,transparent 6px)",
                          opacity: 0.7,
                        }}
                      />
                      <div style={{ width: pct(EXPERT), background: a.color, opacity: 0.7 }} />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="font-mono text-[9px] leading-4 text-muted-foreground">
          blue = attention &middot; hatched red = flash reads on the critical path &middot; solid =
          expert matmuls. One expert read (1.00 ms) costs about as much as computing the whole layer
          (1.15 ms), so ordering alone cannot hide more than one missing expert per layer. What has to
          go up is the left slider: experts that are already in memory, from the per-layer cache and
          the next-layer prediction. 40 layers, 8 experts each; CPU bookkeeping, parallel reads and
          speculative decoding are left out, so these are ceilings, not forecasts.
        </p>
      </div>
    </figure>
  )
}
