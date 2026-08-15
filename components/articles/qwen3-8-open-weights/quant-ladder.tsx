"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Two tables from AtomicChat's Qwen3.8-27B-GGUF card, which is the only place
// anyone published measurements rather than adjectives.
//
// "ladder" is the 16 shipped files: KL divergence of each quantized model's
// next-token distribution against the unquantized bf16 weights on a held-out set,
// plus top-1 agreement.
//
// "layout" is the more interesting one. Ten builds of the same ~17-19 GB file,
// changing only WHICH tensors got the extra bits. Half the divergence disappears
// at constant file size. The winning layout spends its budget on the two Gated
// DeltaNet projections — which is independently what Qwen's own FP8 checkpoint
// refuses to quantize.
//
// mlog10 rather than Math.log10 so the bar geometry serializes identically on
// server and client (see lib/dmath).

type File = { name: string; gb: number; kld: number; top1: number }

const LADDER: File[] = [
  { name: "Q8_0", gb: 28.9, kld: 0.00064, top1: 98.92 },
  { name: "AD-Q6_K", gb: 25.0, kld: 0.00107, top1: 98.67 },
  { name: "AD-Q6_K-Q5_K", gb: 23.1, kld: 0.00252, top1: 97.94 },
  { name: "AD-Q5_K", gb: 20.2, kld: 0.00419, top1: 97.34 },
  { name: "AD-Q5_K-Q4_K", gb: 18.6, kld: 0.00730, top1: 96.43 },
  { name: "AD-Q4_K", gb: 17.1, kld: 0.01126, top1: 95.59 },
  { name: "AD-IQ4_XS", gb: 16.5, kld: 0.01248, top1: 95.39 },
  { name: "AD-IQ4_XS-IQ3_S", gb: 14.4, kld: 0.02660, top1: 93.15 },
  { name: "AD-IQ3_S", gb: 13.8, kld: 0.03247, top1: 92.41 },
  { name: "AD-IQ3_S-IQ3_XXS", gb: 13.0, kld: 0.04337, top1: 91.33 },
  { name: "AD-IQ3_XXS", gb: 12.1, kld: 0.06972, top1: 89.13 },
  { name: "AD-IQ2_S", gb: 11.1, kld: 0.09832, top1: 87.18 },
  { name: "AD-IQ2_S-IQ2_XS", gb: 10.2, kld: 0.13807, top1: 84.77 },
  { name: "AD-IQ2_XS", gb: 9.9, kld: 0.16170, top1: 83.48 },
  { name: "AD-IQ2_XXS", gb: 9.0, kld: 0.25663, top1: 79.44 },
  { name: "AD-IQ1_M", gb: 8.5, kld: 0.34212, top1: 76.34 },
]

const LAYOUT = [
  { name: "every layer treated the same", gb: 16.8, kld: 0.01580 },
  { name: "4 layers lifted", gb: 17.1, kld: 0.01449 },
  { name: "more bits on ffn_down everywhere", gb: 17.8, kld: 0.01189 },
  { name: "more bits on attention", gb: 18.2, kld: 0.01010 },
  { name: "16 layers lifted, first and last", gb: 17.8, kld: 0.00981 },
  { name: "32 layers lifted instead", gb: 18.4, kld: 0.00826 },
  { name: "16 lifted, plus the attention gate", gb: 18.4, kld: 0.00821 },
  { name: "16 lifted, plus a richer output head", gb: 18.8, kld: 0.00800 },
  { name: "24 layers lifted", gb: 18.6, kld: 0.00743 },
  { name: "24 lifted + attention gate + state out", gb: 18.6, kld: 0.00730 },
]

// Three publishers ship a file called Q4_K_M. They are not the same file.
const COLLISION = [
  { who: "lmstudio-community", gb: 16.8, kld: 0.02094 },
  { who: "ggml-org", gb: 19.0, kld: 0.01470 },
  { who: "AtomicChat AD-Q4_K", gb: 17.1, kld: 0.01126 },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

// Log-scaled bar width across the ladder's four decades of divergence.
const LO = -3.4
const HI = -0.4
const w = (kld: number) => Math.min(100, Math.max(2, ((mlog10(kld) - LO) / (HI - LO)) * 100))

export function QuantLadder() {
  const [tab, setTab] = useState<"ladder" | "layout" | "names">("layout")
  const [vram, setVram] = useState(24)

  const fits = LADDER.filter((f) => f.gb < vram - 2)
  const best = fits.length ? fits[0] : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">KL divergence from the bf16 weights</span>
        <span className="font-mono text-[10px] text-muted-foreground">lower is better · 0 is identical</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["layout", "where the bits go"],
              ["ladder", "the 16 shipped files"],
              ["names", "three files called Q4_K_M"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tab === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "layout" ? (
          <>
            <div className="mt-3 space-y-1">
              {LAYOUT.map((x, i) => (
                <div key={x.name} className="flex items-center gap-2">
                  <span className="w-56 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.name}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div
                      className="h-4 rounded-sm"
                      style={{ width: `${(x.kld / LAYOUT[0].kld) * 100}%`, background: i === LAYOUT.length - 1 ? GOOD : ACCENT }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{x.gb} GB</span>
                  <span
                    className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums"
                    style={{ color: i === LAYOUT.length - 1 ? GOOD : "inherit" }}
                  >
                    {x.kld.toFixed(5)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Ten builds inside one gigabyte of each other, and the divergence spans{" "}
              <span className="text-foreground">2.2×</span>. Nothing here changes how many bits the file has; it
              changes which tensors get them. The winner spends its budget on the two Gated DeltaNet projections —{" "}
              <span className="font-mono text-foreground">in_proj_z</span> and{" "}
              <span className="font-mono text-foreground">out_proj</span>, 5.5% of the weights each — for 0.16 GB and
              11% of the remaining divergence. That is the same conclusion Qwen&rsquo;s own FP8 checkpoint reaches by
              refusing to quantize those tensors at all.
            </p>
          </>
        ) : tab === "ladder" ? (
          <>
            <div className="mt-3 space-y-1">
              {LADDER.map((f) => {
                const on = best?.name === f.name
                return (
                  <div key={f.name} className={cn("flex items-center gap-2 rounded-md px-1 py-0.5", on && "bg-muted/40")}>
                    <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{f.name}</span>
                    <div className="h-4 flex-1 rounded-sm bg-muted/40">
                      <div className="h-4 rounded-sm" style={{ width: `${w(f.kld)}%`, background: f.gb < vram - 2 ? GOOD : WARM }} />
                    </div>
                    <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{f.gb} GB</span>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{f.kld.toFixed(5)}</span>
                    <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
                      {f.top1.toFixed(2)}%
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-1 text-right font-mono text-[9px] text-muted-foreground">
              bar is log-scaled · last column is top-1 agreement with the original
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">your VRAM</span>
              {[12, 16, 24, 32, 48, 80].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setVram(g)}
                  aria-pressed={vram === g}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                    vram === g ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {g} GB
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              At {vram} GB the largest file with room left over is{" "}
              <span className="font-mono text-foreground">{best?.name ?? "none of these"}</span>
              {best ? (
                <>
                  {" "}
                  — {best.kld.toFixed(5)} divergence, {best.top1.toFixed(2)}% top-1. Budget for context on top: at
                  256 KB per token this model wants another 2 GB at 8K and 8 GB at 32K.
                </>
              ) : (
                <> — everything here needs more room than that once you leave space for context.</>
              )}{" "}
              Note the top of the ladder:{" "}
              <span className="text-foreground">Q8_0 is not lossless</span>. It diverges by 0.00064 and disagrees
              with the original on roughly one token in ninety-three. Anyone quoting quantization numbers against a
              Q8_0 reference is measuring from a moved goalpost.
            </p>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-1.5">
              {COLLISION.map((c) => (
                <div key={c.who} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{c.who}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${(c.kld / 0.02094) * 100}%`, background: c.kld < 0.013 ? GOOD : WARM }} />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{c.gb} GB</span>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{c.kld.toFixed(5)}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Three publishers ship a file named <span className="font-mono text-foreground">Q4_K_M</span> for this
              model. They are <span className="text-foreground">2.2 GB apart in size and 1.9× apart in divergence</span>.
              A quant name records which recipe was requested, not what came out — llama.cpp&rsquo;s mixes have
              per-tensor overrides, and everyone uses them differently. If you are comparing quants across
              publishers, the filename is not the comparison.
            </p>
          </>
        )}
      </div>
    </figure>
  )
}
