"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every quantization Unsloth publishes for GLM-5.3-Flash, measured against what
// a Kaggle TPU v5e-8 can actually hold. This is the chart that explains why
// kaggle-tpu-lab picked UD-IQ3_XXS and not something better.
//
// `expertBytes` is the sum of the 126 routed-expert tensors (42 sparse layers x
// gate/up/down) in each build, taken from the GGUF tensor index of every shard
// via HTTP range read against huggingface.co/unsloth/GLM-5.3-Flash-GGUF. The MTP
// layer's experts (blk.45) are excluded because the serve kernel loops
// `for i in range(num_hidden_layers)` = 0..44 and never reads them. No weight
// bytes were downloaded: the header of each shard is a few tens of kilobytes.
//
// `bits` is derived, not quoted: expertBytes * 8 / 304,405,807,104 — the
// routed-expert parameter count, 42 x 288 x 3 x 4096 x 2048.
//
// The budget line is the honest one. A v5e chip reports 16.9 GB of usable HBM;
// the engine needs ~1.5 GB/chip for the int8 non-expert weights, the vision
// tower and its own slack, and each concurrent 262k context costs another
// 0.23 GB/chip. Toggle shows experts alone, or experts plus that floor plus
// three cache sets, which is what the README says it runs with.
//
// Arithmetic is +, -, *, / and Math.round only.

const GB = 1e9
const CHIPS = 8
const LIMIT = 16.9 // GB per chip, what the kernel's hbm() reports as bytes_limit
const FLOOR = 1.5 // GB per chip: non-expert int8 + vision + norms + slack
const SET = 0.23 // GB per chip per 262,144-token cache set
const SETS = 3
const ROUTED_PARAMS = 42 * 288 * 3 * 4096 * 2048 // 304,405,807,104

type Build = {
  name: string
  expertBytes: number
  mix: string
  served?: boolean
}

const BUILDS: Build[] = [
  { name: "UD-IQ1_S", expertBytes: 83_775_000_000, mix: "IQ1_S / IQ2_XXS / IQ3_XXS" },
  { name: "UD-IQ1_M", expertBytes: 88_275_000_000, mix: "IQ1_M / IQ2_XXS / IQ3_XXS" },
  { name: "UD-IQ2_XXS", expertBytes: 92_540_000_000, mix: "IQ2_XXS / IQ3_XXS" },
  { name: "UD-Q2_K_XL", expertBytes: 99_030_000_000, mix: "IQ2_XS / IQ3_XXS" },
  {
    name: "UD-IQ3_XXS",
    expertBytes: 109_867_696_128,
    mix: "IQ2_S / IQ3_S / IQ4_XS",
    served: true,
  },
  { name: "UD-Q3_K_XL", expertBytes: 134_400_000_000, mix: "IQ3_XXS / IQ4_XS / Q6_K" },
  { name: "UD-IQ4_XS", expertBytes: 143_690_000_000, mix: "IQ3_S / IQ4_XS / Q6_K" },
  { name: "UD-Q4_K_XL", expertBytes: 185_480_000_000, mix: "Q4_K / Q5_K / Q6_K" },
  { name: "UD-Q5_K_XL", expertBytes: 225_150_000_000, mix: "Q5_K / Q6_K / Q8_0" },
  { name: "UD-Q6_K_XL", expertBytes: 275_450_000_000, mix: "Q6_K / Q8_0" },
]

const MAX_GB = 38 // x-axis top, GB per chip

const r2 = (n: number) => Math.round(n * 100) / 100

export function QuantLadder() {
  const [withEngine, setWithEngine] = useState(true)

  const overhead = withEngine ? FLOOR + SETS * SET : 0
  const budget = LIMIT - overhead

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          ten Unsloth builds &middot; routed-expert GGUF bytes, GB per v5e chip
        </span>
        <button
          type="button"
          onClick={() => setWithEngine((v) => !v)}
          className="rounded border px-2 py-0.5 font-mono text-[10px] hover:bg-muted"
          aria-pressed={withEngine}
        >
          {withEngine
            ? "counting the rest of the engine + 3 contexts"
            : "experts only"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {BUILDS.map((b) => {
            const perChip = b.expertBytes / CHIPS / GB
            const bits = (b.expertBytes * 8) / ROUTED_PARAMS
            const total = perChip + overhead
            const fits = total <= LIMIT
            return (
              <div
                key={b.name}
                className="grid grid-cols-[5.6rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[6.6rem_minmax(0,1fr)_auto]"
              >
                <span
                  title={b.mix}
                  className={cn(
                    "truncate font-mono text-[10px] sm:text-[11px]",
                    b.served ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {b.name}
                </span>
                <div className="relative h-6 overflow-hidden rounded-sm bg-foreground/[0.04]">
                  {overhead > 0 ? (
                    <div
                      className="absolute top-0 h-6 bg-slate-500/45"
                      style={{ width: `${(overhead / MAX_GB) * 100}%` }}
                      title="engine floor + 3 cache sets"
                    />
                  ) : null}
                  <div
                    className={cn("absolute top-0 h-6", fits ? "bg-violet-600/85" : "bg-rose-600/70")}
                    style={{
                      left: `${(overhead / MAX_GB) * 100}%`,
                      width: `${(perChip / MAX_GB) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 h-6 border-l-2 border-dashed border-foreground/60"
                    style={{ left: `${(LIMIT / MAX_GB) * 100}%` }}
                  />
                </div>
                <span className="flex items-center gap-2 font-mono text-[10px] whitespace-nowrap tabular-nums">
                  <span className="hidden text-muted-foreground sm:inline">
                    {r2(bits).toFixed(2)} bits/w
                  </span>
                  <span
                    className={cn(
                      "w-[4.4rem] text-right",
                      fits ? "text-foreground" : "text-rose-700 dark:text-rose-400"
                    )}
                  >
                    {r2(perChip).toFixed(2)} GB
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-600/85" /> fits
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-600/70" /> over the chip
          </span>
          {overhead > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-500/45" /> engine +{" "}
              {SETS} contexts ({r2(overhead).toFixed(2)} GB)
            </span>
          ) : null}
          <span>dashed line: 16.9 GB usable HBM per chip</span>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The expert budget is{" "}
          <span className="font-mono">{r2(budget).toFixed(2)} GB/chip</span>. The
          served build sits{" "}
          <span className="font-mono">{r2(budget - 13.84).toFixed(2)} GB</span>{" "}
          under it once the engine&rsquo;s planar repack is counted (13.84 GB/chip,
          not the 13.73 of raw GGUF blocks). The next rung up, UD-Q3_K_XL at
          16.80 GB/chip, is over the
          whole 16.9 GB chip before a single non-expert weight is loaded. So the
          choice of a codebook format is not a preference — it is the only rung
          on Unsloth&rsquo;s ladder above 2.6 bits that fits on a free TPU.
        </p>
      </div>
    </figure>
  )
}
