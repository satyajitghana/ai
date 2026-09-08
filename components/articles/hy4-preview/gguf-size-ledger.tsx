"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every byte figure here is summed from the repos' own file listings, not
// transcribed from either README's prose:
//   https://huggingface.co/api/models/tencent/Hy4-preview?blobs=true
//     -> 131 .safetensors shards, siblings[].size summed directly:
//        1,559,983,809,380 bytes (BF16 backbone + MTP layer)
//   https://huggingface.co/api/models/AngelSlim/Hy4-preview-GGUF?blobs=true
//     -> Hy4-preview-Q4_K_M.gguf   467,292,398,016 bytes
//     -> Hy4-preview-STQ1_0.gguf   229,412,839,872 bytes
// Fetched 2026-08-29. The GGUF repo's own README states these same two files
// as "435.20 GiB" and "213.66 GiB" respectively -- both match the raw byte
// counts above to the second decimal place, so the repo's own table is
// internally correct. The promotional post's "~200GiB" is a rounding of that
// same 213.66 GiB figure, not an independent number.
//
// The claim being checked: "compressed Hy4-preview from 1.5TB to ~200GiB
// GGUF." 1.5TB (decimal) is a reasonable rounding of the real 1,559.98GB
// baseline -- 3.8% low. "~200GiB" is a less reasonable rounding of the real
// 213.66GiB STQ1_0 file -- 6.8% low, and the gap is bigger still (14.7%) if
// "200" is read as decimal GB rather than binary GiB, since the actual file
// is 229.41GB. Both readings undershoot; neither is a wild fabrication.

const GIB = 1024 ** 3
const GB = 1e9

type Row = { name: string; bytes: number; sub?: string }

const ROWS: Row[] = [
  { name: "BF16 backbone (tencent/Hy4-preview)", bytes: 1_559_983_809_380, sub: "131 safetensors shards" },
  { name: "Q4_K_M.gguf", bytes: 467_292_398_016, sub: "conventional 4-bit, 4.86 bpw" },
  { name: "STQ1_0.gguf", bytes: 229_412_839_872, sub: "the mixed sub-2-bit build, 2.38 bpw" },
]

const CLAIM_GIB = 200 // "~200GiB", the promotional post's own stated unit

const BASE = "oklch(0.62 0.03 250)"
const MID = "oklch(0.60 0.15 255)"
const LOW = "oklch(0.68 0.13 85)"
const CLAIM = "oklch(0.58 0.19 27)"

type Unit = "gib" | "gb"

export function GgufSizeLedger() {
  const [unit, setUnit] = useState<Unit>("gib")

  const div = unit === "gib" ? GIB : GB
  const label = unit === "gib" ? "GiB" : "GB"
  const claimValue = unit === "gib" ? CLAIM_GIB : (CLAIM_GIB * GIB) / GB

  const max = ROWS[0].bytes / div
  const stq1 = ROWS[2].bytes / div
  const gapPct = ((stq1 - claimValue) / claimValue) * 100

  const colors = [BASE, MID, LOW]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">file sizes, summed from both repos&rsquo; own blob listings</span>
        <div className="flex gap-1">
          {(["gib", "gb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                unit === u
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {u === "gib" ? "GiB (binary, 1024³)" : "GB (decimal, 10⁹)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-4">
          {ROWS.map((r, i) => {
            const val = r.bytes / div
            const w = (val / max) * 100
            const isClaimRow = i === 2
            return (
              <div key={r.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2 font-mono text-[10.5px]">
                  <span className="text-foreground">{r.name}</span>
                  {r.sub ? <span className="text-muted-foreground">{r.sub}</span> : null}
                </div>
                <div className="relative h-6 rounded bg-muted/20">
                  <div
                    className="h-6 rounded"
                    style={{ width: `${w}%`, background: colors[i], opacity: 0.85 }}
                  />
                  {isClaimRow ? (
                    <div
                      className="absolute top-0 h-6 border-l-2 border-dashed"
                      style={{ left: `${(claimValue / max) * 100}%`, borderColor: CLAIM }}
                      title={`promotional claim: ~${CLAIM_GIB}GiB`}
                    />
                  ) : null}
                </div>
                <div className="mt-1 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {val.toFixed(1)}
                  {label}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 border-l-2 border-dashed" style={{ borderColor: CLAIM }} />
            promotional claim, &ldquo;~{CLAIM_GIB}GiB&rdquo; ({claimValue.toFixed(1)}
            {label})
          </span>
          <span style={{ color: gapPct > 0 ? LOW : CLAIM }}>
            actual STQ1_0 is {Math.abs(gapPct).toFixed(1)}% {gapPct > 0 ? "above" : "below"} the claim in {label}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both ends of the compression story are real: a 1,559.98GB BF16 checkpoint really does
          become a 229.41GB / 213.66GiB single GGUF file — an 85.3% reduction, roughly{" "}
          <span className="text-foreground">6.8× smaller</span>. Where the promotional shorthand
          slips is precision, not substance. &ldquo;1.5TB&rdquo; rounds the real 1,559.98GB baseline
          down by a forgivable 3.8%. &ldquo;~200GiB&rdquo; rounds the real 213.66GiB STQ1_0 file down
          by a less forgivable 6.8% — and the GGUF repo&rsquo;s own README already states 213.66GiB
          in its own file table, so the rounding happened between the model card and the tweet, not
          inside the model card itself. Read &ldquo;200&rdquo; as decimal GB instead of binary GiB
          and the gap to the actual 229.41GB widens to 14.7% — exactly the kind of unit slippage that
          makes a compression claim look better than the file actually on disk.
        </p>
      </div>
    </figure>
  )
}
