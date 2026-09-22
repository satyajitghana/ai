"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a fine-tune costs in bytes, per rung of the ladder.
//
// Both curves are computed from the shipped archive's own tensor directory. One
// HTTP range request for the first 128 KiB of needle3.cact reads the 196-byte
// header, the 28-float codebook and all 581 tensor records — dtype, shape,
// offset, byte length, group size and bit width for every tensor. Blob sizes
// are recomputed from the documented CQ layout (packed indices at `bits` bits
// per weight over an input dimension padded to a multiple of 128, plus one FP16
// norm per 128-weight group), aligned to 64 bytes and summed.
//
// Reconstructing the shipped scheme that way reproduces 35,335,380 bytes with
// zero error, which is what licenses the other numbers: the same arithmetic,
// with `bits` forced to 4 and the seven confidence-head records removed, is what
// `needle build --lora` writes. cactus-needle 3.0.4 sets WEIGHT_BITS = 4 and
// `_cq_pack` raises on any other width, so the local path has no 2-bit packer at
// all — not a disabled one, an absent one.
//
// Depth rows follow the documented ladder order (0, 19, 9, 14, 4, 6, 11, 16, …)
// and drop engram sites whose host layer is not kept. Only the 20-layer platform
// row is a measured file; the rest are computed.

interface Rung {
  depth: number
  params: string
  platform: number
  local: number
}

const RUNGS: Rung[] = [
  { depth: 2, params: "25M", platform: 8_636_052, local: 13_329_108 },
  { depth: 4, params: "29M", platform: 9_789_396, local: 15_379_476 },
  { depth: 8, params: "52M", platform: 16_175_892, local: 27_393_876 },
  { depth: 16, params: "98M", platform: 28_948_884, local: 51_422_676 },
  { depth: 20, params: "121M", platform: 35_335_380, local: 63_437_076 },
]

const MAX = Math.max(...RUNGS.map((r) => r.local))

function mb(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

export function ArchiveLadder() {
  const [sel, setSel] = useState(20)
  const r = RUNGS.find((x) => x.depth === sel) ?? RUNGS[RUNGS.length - 1]
  const ratio = r.local / r.platform

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          .cact on disk: platform 2-bit vs. what needle build writes locally
        </span>
        <span className="font-mono text-[10px]" style={{ color: "oklch(0.62 0.19 27)" }}>
          local is 4-bit, always
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {RUNGS.map((x) => (
            <button
              key={x.depth}
              type="button"
              onClick={() => setSel(x.depth)}
              aria-pressed={x.depth === sel}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1.5 text-left transition-colors",
                x.depth === sel
                  ? "border-foreground/30 bg-muted/40"
                  : "border-transparent hover:bg-muted/20",
              )}
            >
              <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {x.depth}L · {x.params}
              </span>
              <div className="flex-1 space-y-0.5">
                <div className="h-3 rounded-sm bg-muted/40">
                  <div
                    className="h-3 rounded-sm"
                    style={{
                      width: `${(x.platform / MAX) * 100}%`,
                      background: "oklch(0.58 0.15 155)",
                      opacity: 0.85,
                    }}
                  />
                </div>
                <div className="h-3 rounded-sm bg-muted/40">
                  <div
                    className="h-3 rounded-sm"
                    style={{
                      width: `${(x.local / MAX) * 100}%`,
                      background: "oklch(0.62 0.19 27)",
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {(x.local / x.platform).toFixed(2)}x
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span
              className="inline-block h-2 w-5 rounded-sm"
              style={{ background: "oklch(0.58 0.15 155)", opacity: 0.85 }}
            />
            platform · 2-bit · head retrained
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span
              className="inline-block h-2 w-5 rounded-sm"
              style={{ background: "oklch(0.62 0.19 27)", opacity: 0.85 }}
            />
            local · 4-bit · head deleted
          </span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px] text-foreground">
            {r.depth} layers &middot; {r.params} parameters
          </div>
          <div className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            platform {mb(r.platform)} &middot; local {mb(r.local)} &middot;{" "}
            <span style={{ color: "oklch(0.62 0.19 27)" }}>{ratio.toFixed(2)}x</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
            {r.depth === 20
              ? "The shipped 20-layer file is 35,335,380 bytes and this arithmetic reproduces it exactly. Rebuild the same weights through the local path and you get 63.44 MB, because every CQ tensor moves from 2 bits to 4."
              : `A locally built ${r.depth}-layer archive is ${mb(r.local)} against ${mb(r.platform)} for the same depth on the platform. The slice you picked to fit a device budget is the one you get; the budget it fits is not.`}
          </p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The ladder is sold as a way to pick a size. The free fine-tuning path changes the size of every rung
          by a factor that grows with depth, from 1.54x at two layers to 1.80x at twenty &mdash; because the
          embedding table and the multi-lane gates are already at 4 bits in the shipped file, so the rungs
          carrying the most 2-bit tensors lose the most when everything moves to 4. The comparison that stings:
          a tuned 8-layer archive is 27.39 MB, within a couple of megabytes of what the platform charges for
          <em> sixteen</em> layers. Fine-tuning locally does not just cost you the confidence head. It costs you
          about half the ladder.
        </p>
      </div>
    </figure>
  )
}
