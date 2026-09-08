"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Unsloth's day-zero Dynamic GGUF ladder for GLM-5.3, unsloth/GLM-5.3-GGUF.
// Sizes summed from the repo's own API (blobs=true, grouped by folder,
// siblings[].lfs.size, decimal GB), fetched 2026-08-28 — not transcribed from
// the docs page, which never lists the ladder as one table.
//
// The reason this component exists: Unsloth's docs describe "Dynamic 2-bit"
// twice, for two different files, twelve GB apart.
//   - "The 2-bit dynamic quant UD-Q2_K_XL uses 254GB ... ~81% accuracy while
//     being 83% smaller" -- 1 - 253.9/1508.0 = 0.832, so the -83%/accuracy
//     pair is genuinely UD-Q2_K_XL's.
//   - "We will be utilizing the 239GB UD-IQ2_M quant for the best balance" --
//     UD-IQ2_M is a smaller, importance-quantized file (238.6GB actual,
//     1 - 238.6/1508.0 = 0.842, i.e. -84%, not -83%).
// Both are real files Unsloth ships; the promotional shorthand "239GB, -83%
// smaller, ~81% accuracy" quietly stitches the size of one to the shrink/
// accuracy pair of the other. Not a fabrication -- the source material itself
// uses "2-bit" for both, a few paragraphs apart.

type Row = {
  name: string
  gb: number
  files: number
  bit: string
  flag?: "q2" | "iq2"
}

const BF16_GB = 1508.0

const ROWS: Row[] = [
  { name: "BF16", gb: 1508.0, files: 33, bit: "16-bit" },
  { name: "Q8_0", gb: 801.4, files: 17, bit: "8-bit" },
  { name: "UD-Q6_K_XL", gb: 684.4, files: 16, bit: "6-bit" },
  { name: "UD-Q5_K_XL", gb: 562.5, files: 13, bit: "5-bit" },
  { name: "UD-Q4_K_XL", gb: 467.3, files: 11, bit: "4-bit" },
  { name: "UD-IQ4_XS", gb: 365.3, files: 9, bit: "4-bit" },
  { name: "UD-Q3_K_XL", gb: 343.0, files: 9, bit: "3-bit" },
  { name: "UD-IQ3_XXS", gb: 281.7, files: 7, bit: "3-bit" },
  { name: "UD-Q2_K_XL", gb: 253.9, files: 7, bit: "2-bit", flag: "q2" },
  { name: "UD-IQ2_M", gb: 238.6, files: 6, bit: "2-bit", flag: "iq2" },
  { name: "UD-IQ1_M", gb: 228.5, files: 6, bit: "1-bit" },
  { name: "UD-IQ1_S", gb: 216.7, files: 6, bit: "1-bit" },
]

// Unsloth's separately published minimum-memory table (RAM+VRAM or unified
// memory), keyed by bit-width tier -- not the same measurement as file size,
// and not claimed to be: these are the docs page's own stated floors.
const HARDWARE_MIN: { bit: string; min: string }[] = [
  { bit: "1-bit", min: "223GB" },
  { bit: "2-bit", min: "245GB" },
  { bit: "3-bit", min: "290–360GB" },
  { bit: "4-bit", min: "372–475GB" },
  { bit: "6-bit", min: "570GB" },
  { bit: "8-bit", min: "810GB" },
]

const BAR = "oklch(0.62 0.03 250)"
const Q2 = "oklch(0.68 0.13 85)"
const IQ2 = "oklch(0.60 0.15 255)"

type View = "ladder" | "hardware"

export function QuantLadder() {
  const [view, setView] = useState<View>("ladder")
  const max = BF16_GB

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">unsloth/GLM-5.3-GGUF · day-zero quants</span>
        <div className="flex gap-1">
          {(["ladder", "hardware"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "ladder" ? "file sizes" : "min hardware"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "ladder" ? (
          <div className="space-y-1.5">
            {ROWS.map((r) => {
              const shrink = (1 - r.gb / max) * 100
              const color = r.flag === "q2" ? Q2 : r.flag === "iq2" ? IQ2 : BAR
              return (
                <div
                  key={r.name}
                  className={cn("rounded-md", r.flag ? "border" : "border border-transparent")}
                  style={r.flag ? { borderColor: `color-mix(in oklch, ${color} 45%, transparent)`, background: `color-mix(in oklch, ${color} 7%, transparent)` } : undefined}
                >
                  <div className="flex items-center gap-2 px-1 py-0.5">
                    <span className="w-24 shrink-0 truncate text-right font-mono text-[10px]" style={{ color: r.flag ? color : "var(--muted-foreground)" }}>
                      {r.name}
                    </span>
                    <div className="h-3.5 flex-1 rounded-sm bg-muted/40">
                      <div className="h-3.5 rounded-sm" style={{ width: `${(r.gb / max) * 100}%`, background: color }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                      {r.gb.toFixed(1)}GB
                    </span>
                    <span className="w-14 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                      −{shrink.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[11px]">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2 text-left font-normal text-muted-foreground">bit-width</th>
                  <th className="px-1.5 py-1 text-right font-normal text-muted-foreground">min RAM+VRAM / unified memory</th>
                </tr>
              </thead>
              <tbody>
                {HARDWARE_MIN.map((h) => (
                  <tr key={h.bit} className="border-b border-border/40">
                    <td className="py-1.5 pr-2 text-foreground">{h.bit}</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-foreground">{h.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Unsloth&rsquo;s own hardware-minimum table, not derived from the file sizes at left — a quantized
              checkpoint loaded with MoE offloading needs headroom beyond its on-disk size, so these floors sit
              above (6-bit, 8-bit) or in the same range as (1–4-bit) the plain file-size numbers, not below them by
              a fixed ratio.
            </p>
          </div>
        )}

        {view === "ladder" ? (
          <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: Q2 }} />
              UD-Q2_K_XL — 254GB, −83%, ~81% accuracy (Unsloth&rsquo;s own pairing)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: IQ2 }} />
              UD-IQ2_M — 239GB, −84% (the file Unsloth&rsquo;s walkthrough actually recommends)
            </span>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both highlighted rows are real files Unsloth ships, and both get called &ldquo;2-bit&rdquo; on the same
          docs page. <span className="text-foreground">UD-Q2_K_XL</span> is the one the accuracy claim belongs to —
          254GB, −83% smaller than BF16, and the &ldquo;~81% accuracy&rdquo; figure is stated right next to it.{" "}
          <span className="text-foreground">UD-IQ2_M</span> is a different, smaller, importance-quantized file —
          239GB, −84% — that the walkthrough later recommends instead, for &ldquo;the best balance of accessibility
          and accuracy.&rdquo; Neither number is wrong. The promotional shorthand that reads &ldquo;239GB, −83%
          smaller, ~81% accuracy&rdquo; as one fact is quoting the size of one file and the shrink-and-accuracy pair
          of its 15.3GB-larger neighbor.
        </p>
      </div>
    </figure>
  )
}
