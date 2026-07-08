"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// GGUF quant explorer for the community Hy3-1M-GGUF build.
// Sizes are the ones reported on the model card (GB, on-disk weights). Pick a RAM
// budget; rows that fit stay lit, rows that don't dim. Quality is illustrative
// (derived from bits/weight, NOT measured) — the build is experimental and not
// needle-certified, so treat the quality column as a rough ordering only.
// First render is deterministic (128 GB budget). No timers, no randomness.

const HY = "oklch(0.60 0.19 258)"
const OK = "oklch(0.62 0.16 150)" // fits
const WARN = "oklch(0.72 0.15 60)" // tight

type Row = {
  id: string
  name: string
  gb: number
  bits: number // bits/weight — drives the illustrative quality bar only
  kind: "base" | "gguf"
  note: string
}

const ROWS: Row[] = [
  { id: "bf16", name: "BF16 (reference)", gb: 590, bits: 16, kind: "base", note: "full weights; multi-GPU only" },
  { id: "fp8", name: "FP8 (vLLM online)", gb: 295, bits: 8, kind: "base", note: "quantized at serve time, no checkpoint" },
  { id: "q4", name: "Q4_K_M", gb: 183, bits: 4.5, kind: "gguf", note: "highest-quality GGUF; needs 192 GB+" },
  { id: "q3", name: "Q3_K_M", gb: 130, bits: 3.4, kind: "gguf", note: "~117–145 GB across MTP / non-MTP builds" },
  { id: "q2k", name: "Q2_K", gb: 106, bits: 2.6, kind: "gguf", note: "static quant; bootstraps the imatrix" },
  { id: "iq2mtp", name: "MTP-IQ2_M", gb: 100, bits: 2.4, kind: "gguf", note: "IQ2_M + q8_0 draft head for spec-decode" },
  { id: "iq2", name: "IQ2_M", gb: 92, bits: 2.3, kind: "gguf", note: "imatrix quant; recommended baseline" },
  { id: "iq1", name: "IQ1_M", gb: 62, bits: 1.6, kind: "gguf", note: "smallest; fits a 128 GB Mac; weak reasoning" },
]

const RAM_STOPS = [64, 96, 128, 192, 256, 512, 640]
const MAXGB = 640 // axis top

// Illustrative quality from bits/weight, mapped to [0.2, 1].
function quality(bits: number) {
  const q = (Math.log2(bits) - Math.log2(1.5)) / (Math.log2(16) - Math.log2(1.5))
  return Math.max(0.2, Math.min(1, 0.2 + 0.8 * q))
}

export function Hy3Quant() {
  const [ramIdx, setRamIdx] = useState(2) // 128 GB
  const ram = RAM_STOPS[ramIdx]

  // largest quant whose weights fit with ~10% headroom for runtime
  const fitId = ROWS.slice()
    .sort((a, b) => b.gb - a.gb)
    .find((r) => r.gb * 1.1 <= ram)?.id

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Hy3-1M-GGUF · size vs (illustrative) quality</span>
        <span className="text-muted-foreground/50">community build</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* RAM budget selector */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">RAM / VRAM budget</span>
          {RAM_STOPS.map((g, i) => (
            <button
              key={g}
              type="button"
              onClick={() => setRamIdx(i)}
              aria-pressed={i === ramIdx}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                i === ramIdx ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={i === ramIdx ? { background: HY } : undefined}
            >
              {g}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">GB</span>
        </div>

        {/* rows */}
        <div className="space-y-1.5">
          {ROWS.map((r) => {
            const fits = r.gb * 1.1 <= ram
            const best = r.id === fitId
            const q = quality(r.bits)
            return (
              <div key={r.id} className="flex items-center gap-2" style={{ opacity: fits ? 1 : 0.4 }}>
                <span
                  className={cn(
                    "w-28 shrink-0 truncate text-right font-mono text-[11px]",
                    best ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.name}
                </span>
                {/* size bar */}
                <div className="relative h-5 flex-1">
                  {/* RAM budget marker */}
                  <span
                    className="absolute top-0 bottom-0 w-px bg-foreground/40"
                    style={{ left: `${Math.min((ram / MAXGB) * 100, 100)}%` }}
                    aria-hidden
                  />
                  <div
                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm transition-all"
                    style={{
                      width: `${Math.max((r.gb / MAXGB) * 100, 1)}%`,
                      background: best ? HY : fits ? OK : WARN,
                      opacity: fits ? 0.9 : 0.7,
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[10px] tabular-nums text-muted-foreground"
                    style={{ left: `${Math.min((r.gb / MAXGB) * 100, 88)}%` }}
                  >
                    {r.gb} GB
                  </span>
                </div>
                {/* quality pip */}
                <div className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
                  <div className="h-full rounded-full" style={{ width: `${q * 100}%`, background: HY }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* readout */}
        <div className="mt-3 border-t pt-3 font-mono text-[11px] text-muted-foreground">
          at <span className="text-foreground">{ram} GB</span> the largest GGUF that fits is{" "}
          <span style={{ color: HY }}>{ROWS.find((r) => r.id === fitId)?.name ?? "none"}</span>
          {fitId ? ` (${ROWS.find((r) => r.id === fitId)?.note})` : " — pick a bigger budget or add a GPU"}.
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The bar is the exact on-disk size the card reports. The thin pip on the right is an{" "}
          <span className="text-foreground">illustrative</span> quality ordering from bits-per-weight — not a measured
          score. Below Q2_K the model still forms sentences; the card is explicit that it proves coherence, not reasoning
          or long-context retrieval. Add KV-cache memory on top (see the context section): a 1M window is another
          160–320 GB depending on cache precision.
        </p>
      </div>
    </figure>
  )
}
