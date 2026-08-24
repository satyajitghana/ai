"use client"

import Link from "next/link"
import { useState } from "react"

import { cn } from "@/lib/utils"

// The other half of the FP8 story: A.X K2 never existed as a BF16 checkpoint
// to round down from. It was trained natively in FP8 (MXFP8, block 32,
// E4M3), so "A.X K2 FP8" IS the master model. Serving it in NVFP4 is a
// post-hoc step taken FROM that FP8-native base, not from a full-precision
// original — which is why the accuracy retention below is a ~1-point story,
// not a cliff. A.X K1's BF16 footprint is shown only as a previous-generation
// reference; it is not "A.X K2 before quantization", because that model was
// never trained.

const FP8 = "oklch(0.62 0.16 150)"
const NVFP4 = "oklch(0.60 0.15 255)"
const REF = "oklch(0.62 0.03 250)"

const MEMORY = [
  { label: "A.X K1 · BF16", gb: 1038, color: REF, note: "previous generation — not the same model" },
  { label: "A.X K2 · FP8", gb: 646, color: FP8, note: "native training format — the master checkpoint" },
  { label: "A.X K2 · NVFP4", gb: 370, color: NVFP4, note: "post-hoc, experts-only W4A4" },
]

const ACCURACY = [
  { label: "CLIcK", fp8: 84.21, nvfp4: 84.06 },
  { label: "GSM8K", fp8: 80.21, nvfp4: 77.71 },
  { label: "MMLU", fp8: 82.27, nvfp4: 82.0 },
  { label: "MMLU-Pro", fp8: 69.71, nvfp4: 68.04 },
  { label: "KMMLU", fp8: 78.41, nvfp4: 77.7 },
  { label: "KoBEST-BoolQ", fp8: 96.72, nvfp4: 96.01 },
  { label: "KoBEST-COPA", fp8: 88.3, nvfp4: 88.6 },
  { label: "MATH", fp8: 60.5, nvfp4: 58.08 },
  { label: "MBPP", fp8: 72.0, nvfp4: 70.4 },
  { label: "HumanEval", fp8: 79.88, nvfp4: 81.1 },
  { label: "KLUE-MRC", fp8: 76.2, nvfp4: 76.4 },
]

type Tab = "memory" | "accuracy"

export function PrecisionLadder() {
  const [tab, setTab] = useState<Tab>("memory")
  const maxGB = Math.max(...MEMORY.map((m) => m.gb))
  const maxAcc = Math.max(...ACCURACY.flatMap((a) => [a.fp8, a.nvfp4]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">serving A.X K2 · fp8-native, then quantized further</span>
        <div className="flex gap-1">
          {(
            [
              { id: "memory", label: "memory" },
              { id: "accuracy", label: "accuracy: fp8 → nvfp4" },
            ] as { id: Tab; label: string }[]
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setTab(o.id)}
              aria-pressed={tab === o.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tab === o.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {tab === "memory" ? (
          <div className="space-y-3">
            {MEMORY.map((m) => (
              <div key={m.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
                <span className="truncate font-mono text-[11px] text-muted-foreground">{m.label}</span>
                <div className="h-5 rounded-sm bg-muted/30">
                  <div className="h-5 rounded-sm transition-all duration-300" style={{ width: `${(m.gb / maxGB) * 100}%`, background: m.color }} />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{m.gb} GB</span>
              </div>
            ))}
            <div className="space-y-1 pt-1 font-mono text-[10px] text-muted-foreground">
              {MEMORY.map((m) => (
                <div key={m.label}>
                  <span style={{ color: m.color }}>■</span> {m.label}: {m.note}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {ACCURACY.map((a) => {
              const delta = a.nvfp4 - a.fp8
              return (
                <div key={a.label} className="grid grid-cols-[minmax(0,6.5rem)_1fr_1fr_auto] items-center gap-2">
                  <span className="truncate font-mono text-[10.5px] text-muted-foreground">{a.label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 rounded-sm bg-muted/30" style={{ width: "100%" }}>
                      <div className="h-3 rounded-sm" style={{ width: `${(a.fp8 / maxAcc) * 100}%`, background: FP8 }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 rounded-sm bg-muted/30" style={{ width: "100%" }}>
                      <div className="h-3 rounded-sm" style={{ width: `${(a.nvfp4 / maxAcc) * 100}%`, background: NVFP4 }} />
                    </div>
                  </div>
                  <span
                    className={cn("w-14 shrink-0 text-right font-mono text-[10.5px] tabular-nums", Math.abs(delta) >= 2 ? "font-semibold" : "text-muted-foreground")}
                    style={Math.abs(delta) >= 2 ? { color: delta < 0 ? "oklch(0.62 0.20 25)" : FP8 } : undefined}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(2)}
                  </span>
                </div>
              )
            })}
            <div className="flex items-center gap-4 pt-1 font-mono text-[10px] text-muted-foreground">
              <span><span style={{ color: FP8 }}>■</span>{" "}FP8 (base)</span>
              <span><span style={{ color: NVFP4 }}>■</span>{" "}NVFP4 (post-hoc, experts-only)</span>
            </div>
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {tab === "memory" ? (
            <>
              A.X K1&rsquo;s 1038 GB is a <em>different model</em>, shown only as scale context — A.X K2 has no BF16
              form to compare against, because it was never trained in BF16. Its FP8 checkpoint at 646 GB{" "}
              <em>is</em>{" "}the master weights. NVFP4 at 370 GB is one further post-hoc step, applied to experts only
              (W4A4), on top of that already-quantized base.
            </>
          ) : (
            <>
              Rounding an FP8-native model down to NVFP4 costs under a point on most of these eleven benchmarks —
              GSM8K (&minus;2.50) and MATH (&minus;2.42) are the outliers, HumanEval and KoBEST-COPA actually tick
              up. Compare that to{" "}
              <Link href="/articles/neutrino-1">Neutrino-1&rsquo;s</Link> finding for a much larger jump — full precision
              rounded straight into ternary: 5-shot MMLU fell to 24.2&ndash;24.7, against a 25.0 chance line. The
              difference is what the base format already was. NVFP4 here is one more turn of the screw on a format
              (FP8) the model was already trained natively in; ternary there was a format the rounded models never
              saw during training at all.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
