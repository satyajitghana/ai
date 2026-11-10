"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Weight bytes for Kimi K3.1 Pro and the pruned75 checkpoint. "shipped" is the sum of every
// tensor's bytes in the two repos' safetensors headers (measured). The other rows re-price the
// same measured parameter counts at another precision (reasoned): routed experts 2,722,740,830,208
// -> 680,685,207,552 parameters, everything else 57,369,533,184 -> 56,926,316,928.
// GPU memory is the vendor's nominal capacity in GB. The count is the smallest power of two
// (tensor parallel has to divide 224 experts and 96 heads) whose share of the weights fits in
// 90% of one GPU; the rest is the room left for KV cache and activations.

const R_SRC = 2_722_740_830_208
const R_PR = 680_685_207_552
const O_SRC = 57_369_533_184
const O_PR = 56_926_316_928

type Fmt = { key: string; label: string; note: string; src: number; pr: number }

const FMTS: Fmt[] = [
  { key: "shipped", label: "as shipped", note: "MXFP4 experts (4.25 bits with scales), BF16 rest", src: 1561.22, pr: 475.49 },
  { key: "fp8rest", label: "rest in FP8", note: "MXFP4 experts, everything else 8-bit", src: (R_SRC * 4.25) / 8 / 1e9 + O_SRC / 1e9, pr: (R_PR * 4.25) / 8 / 1e9 + O_PR / 1e9 },
  { key: "fp8", label: "all FP8", note: "experts upcast to 8-bit", src: (R_SRC + O_SRC) / 1e9, pr: (R_PR + O_PR) / 1e9 },
  { key: "bf16", label: "all BF16", note: "experts upcast to 16-bit", src: ((R_SRC + O_SRC) * 2) / 1e9, pr: ((R_PR + O_PR) * 2) / 1e9 },
]

const GPUS = [
  { name: "H100", gb: 80 },
  { name: "H200", gb: 141 },
  { name: "B200", gb: 180 },
  { name: "B300", gb: 288 },
]

function plan(weights: number, gb: number) {
  let n = 1
  while (weights / n > gb * 0.9 && n < 128) n *= 2
  return { n, per: weights / n, free: gb - weights / n }
}

export function MemoryPlanner() {
  const [f, setF] = useState(0)
  const fmt = FMTS[f]
  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
      on ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
    )
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>weights and GPUs, source vs pruned75</span>
        <span className="text-muted-foreground/60">shipped bytes measured; other rows reasoned</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {FMTS.map((x, k) => (
            <button key={x.key} type="button" className={btn(k === f)} aria-pressed={k === f} onClick={() => setF(k)}>
              {x.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">{fmt.note}</p>
        {(["src", "pr"] as const).map((w) => {
          const gb = fmt[w]
          const max = FMTS[3].src
          return (
            <div key={w}>
              <div className="mb-1 flex justify-between font-mono text-[11px]">
                <span className="text-foreground">{w === "src" ? "Kimi K3.1 Pro (896 experts)" : "pruned75 (224 experts)"}</span>
                <span className="text-muted-foreground">{gb.toFixed(1)} GB</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-md border bg-muted/30">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${((gb / max) * 100).toFixed(2)}%`, background: w === "src" ? "oklch(0.60 0.02 260)" : "oklch(0.62 0.15 250)" }}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GPUS.map((g) => {
                  const p = plan(gb, g.gb)
                  return (
                    <div key={g.name} className="rounded-md border px-2 py-1.5 font-mono text-[10px]">
                      <div className="text-muted-foreground">
                        {g.name} {g.gb} GB
                      </div>
                      <div className="text-sm text-foreground">
                        {p.n} GPU{p.n > 1 ? "s" : ""}
                        {p.n > 8 ? <span className="text-muted-foreground"> · {p.n / 8} nodes</span> : null}
                      </div>
                      <div className="text-muted-foreground/80">
                        {p.per.toFixed(0)} GB each, {p.free.toFixed(0)} GB free
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Weights only. The vLLM team&apos;s own run of the Kimi K3 pruned75 sibling on four GB300s reported 119.06 GiB of model memory per GPU,
        7.6% more than an even quarter of its 442.50 GiB payload, so expect real shares to sit a little above these. The count is the smallest power of two that leaves
        10% of each GPU free; a long-context deployment wants far more than that for KV cache.
      </figcaption>
    </figure>
  )
}
