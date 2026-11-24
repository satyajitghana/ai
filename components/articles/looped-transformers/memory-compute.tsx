"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Memory held vs memory read per decode step, for Inkling 2 Mini and three
// counterfactuals, all at the UD-Q4_K_M tensor sizes I read from the GGUF
// header (unsloth/Inkling-2-Mini-GGUF, Mainline_Support, 16.61 GB):
//   once-run layers (0-5, 18-23): dense 0.361 GB, experts 7.899 GB
//   loop core (6-17):             dense 0.475 GB, experts 6.880 GB
//   token embeddings 0.492 GB (one row read per token), output head 0.492 GB
// Experts touched per layer application at batch B, if routing were uniform:
//   1 - (1 - 8/128)^B. Real routers are skewed, so this overstates the growth.
// The untied twin stores the core three times (48 distinct layers) and runs
// the same 48 layer applications. "Dense, same file" reads every byte except
// the embedding table on every step.
// Ceilings are bandwidth / bytes per step x batch: what memory traffic alone
// allows, ignoring compute, attention and KV reads.

const ONCE_D = 0.361
const ONCE_E = 7.899
const CORE_D = 0.475
const CORE_E = 6.88
const EMB = 0.492
const OUT = 0.492

type Design = { key: string; label: string; sub: string; stored: number; step: (b: number) => number }

const touched = (b: number) => 1 - mpow(1 - 8 / 128, b)

const DESIGNS: Design[] = [
  {
    key: "mini",
    label: "Inkling 2 Mini",
    sub: "looped MoE, 3 passes",
    stored: ONCE_D + ONCE_E + CORE_D + CORE_E + EMB + OUT,
    step: (b) => ONCE_D + ONCE_E * touched(b) + OUT + 3 * (CORE_D + CORE_E * touched(b)),
  },
  {
    key: "untied",
    label: "Untied twin",
    sub: "same 48 applications, 48 stored layers",
    stored: ONCE_D + ONCE_E + 3 * (CORE_D + CORE_E) + EMB + OUT,
    step: (b) => ONCE_D + ONCE_E * touched(b) + OUT + 3 * (CORE_D + CORE_E * touched(b)),
  },
  {
    key: "one",
    label: "Mini at 1 pass",
    sub: "same file, 24 applications",
    stored: ONCE_D + ONCE_E + CORE_D + CORE_E + EMB + OUT,
    step: (b) => ONCE_D + ONCE_E * touched(b) + OUT + (CORE_D + CORE_E * touched(b)),
  },
  {
    key: "dense",
    label: "Dense, same file size",
    sub: "every weight on every token",
    stored: ONCE_D + ONCE_E + CORE_D + CORE_E + EMB + OUT,
    step: () => ONCE_D + ONCE_E + CORE_D + CORE_E + OUT,
  },
]

const BW = [
  { gbs: 936, label: "RTX 3090, 936 GB/s" },
  { gbs: 614, label: "614 GB/s (the lab's chart)" },
]

const STORE = "oklch(0.62 0.03 260)"
const READ = "oklch(0.66 0.16 30)"

export function MemoryCompute() {
  const [batch, setBatch] = useState(1)
  const [bw, setBw] = useState(0)
  const max = 32

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>held in memory vs read per decode step, UD-Q4_K_M sizes</span>
        <span className="text-muted-foreground/60">tensor sizes measured; routing uniform (illustrative)</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-xs">
              <span>sequences decoded together</span>
              <span className="tabular-nums">batch {batch}</span>
            </div>
            <Range min={1} max={64} step={1} value={batch} onChange={(e) => setBatch(Number(e.target.value))} aria-label="batch size" />
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
              experts touched per layer: {(touched(batch) * 100).toFixed(0)}% of 128
            </div>
          </label>
          <div className="flex flex-wrap items-start gap-1.5">
            {BW.map((b, i) => (
              <button
                key={b.gbs}
                type="button"
                onClick={() => setBw(i)}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-[11px]",
                  i === bw ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {DESIGNS.map((d) => {
            const step = d.step(batch)
            const perTok = step / batch
            const ceil = (BW[bw].gbs / step) * batch
            return (
              <div key={d.key} className="rounded-lg border bg-background/60 p-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
                  <span>
                    {d.label} <span className="text-muted-foreground">· {d.sub}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    ceiling ≈ {ceil >= 100 ? ceil.toFixed(0) : ceil.toFixed(1)} tok/s total
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">held</span>
                    <div className="h-3 flex-1 rounded-sm bg-muted/40">
                      <div className="h-3 rounded-sm" style={{ width: `${(d.stored / max) * 100}%`, background: STORE }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">{d.stored.toFixed(1)} GB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">per token</span>
                    <div className="h-3 flex-1 rounded-sm bg-muted/40">
                      <div className="h-3 rounded-sm" style={{ width: `${(perTok / max) * 100}%`, background: READ }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">{perTok.toFixed(2)} GB</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        At batch 1 the loop costs reads, not storage: Mini and its untied twin read the same 4.06 GB per token, and the twin needs 31.3 GB to
        hold it. Raise the batch and every MoE row reads more of its experts per step but less per token, which is the datacenter&apos;s side
        of the trade. KV-cache traffic is left out.
      </figcaption>
    </figure>
  )
}
