"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Which tensors are actually ternary. Numbers here are measured, not PrismML's
// prose: the three GGUF file sizes are read straight off the repo's own
// siblings listing (huggingface.co/api/models/prism-ml/Ternary-Bonsai-2-27B-gguf
// ?blobs=true), and the parameter split is the whitepaper's Table 1/Table 2
// (24.35B language blocks + 2.54B embedding/LM head + 0.47B vision tower =
// 27.36B total; 26,238,464 of the language total held above ternary).
//
// The point: by PARAMETER COUNT the model is 98%+ ternary — genuinely
// end-to-end, unlike a typical PTQ that keeps embeddings/head/attention in
// FP16. But bytes and parameters are not the same axis. Switch to "on-disk
// bytes" and the two non-ternary slices — a 0.1%-of-params exception list and
// a 1.7%-of-params vision tower — swell to a tenth of the shipped file,
// because both are billed at 8–16 bits/weight against ternary's ~1.75.

const TERNARY = "oklch(0.6 0.17 300)"
const EXCEPTION = "oklch(0.72 0.15 75)"
const VISION = "oklch(0.62 0.02 260)"

// Parameters (whitepaper Table 1 + Table 2, exact).
const EXCEPTION_PARAMS = 26_238_464
const LANGUAGE_TOTAL_PARAMS = 24_350_000_000 + 2_540_000_000 // blocks + embed/LM head
const TERNARY_PARAMS = LANGUAGE_TOTAL_PARAMS - EXCEPTION_PARAMS
const VISION_PARAMS = 460_730_096 // MLX safetensors F16 count for the vision tower

// Bytes, measured off the shipped GGUF files (PTQ1_0 language + Q8_0 mmproj).
const PTQ1_0_FILE_BYTES = 5_946_648_928
const EXCEPTION_BYTES = EXCEPTION_PARAMS * 2 // bf16, by construction
const TERNARY_BYTES = PTQ1_0_FILE_BYTES - EXCEPTION_BYTES
const VISION_BYTES = 629_246_976 // mmproj HQQ-4bit-in-Q8_0 container, the shipped default

type Seg = {
  id: string
  label: string
  color: string
  params: number
  bytes: number
  bpw: number
  note: string
}

const SEGMENTS: Seg[] = [
  {
    id: "ternary",
    label: "Ternary (embeddings, attention, MLPs, LM head)",
    color: TERNARY,
    params: TERNARY_PARAMS,
    bytes: TERNARY_BYTES,
    bpw: (TERNARY_BYTES * 8) / TERNARY_PARAMS,
    note: "the model, end to end",
  },
  {
    id: "exception",
    label: "Full-precision exceptions (recurrent state path + norms)",
    color: EXCEPTION,
    params: EXCEPTION_PARAMS,
    bytes: EXCEPTION_BYTES,
    bpw: 16,
    note: "new in gen 2 — gen 1 ternarized these too",
  },
  {
    id: "vision",
    label: "Vision tower (separate component, not “language weights”)",
    color: VISION,
    params: VISION_PARAMS,
    bytes: VISION_BYTES,
    bpw: (VISION_BYTES * 8) / VISION_PARAMS,
    note: "“4-bit HQQ”, shipped in an 8-bit container",
  },
]

const TOTAL_PARAMS = SEGMENTS.reduce((s, x) => s + x.params, 0)
const TOTAL_BYTES = SEGMENTS.reduce((s, x) => s + x.bytes, 0)

const fmtParams = (n: number) => `${(n / 1e9).toFixed(2)}B`
const fmtBytes = (n: number) => `${(n / 1e9).toFixed(2)} GB`

export function BitBudget() {
  const [mode, setMode] = useState<"params" | "bytes">("params")
  const total = mode === "params" ? TOTAL_PARAMS : TOTAL_BYTES
  const val = (s: Seg) => (mode === "params" ? s.params : s.bytes)
  const fmt = mode === "params" ? fmtParams : fmtBytes

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          bit budget · Ternary Bonsai 2 27B
        </span>
        <div className="flex gap-1">
          {(
            [
              ["params", "by parameters"],
              ["bytes", "by on-disk bytes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                mode === id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div
          className="flex h-8 w-full overflow-hidden rounded-md"
          role="img"
          aria-label={SEGMENTS.map(
            (s) => `${s.label}: ${((val(s) / total) * 100).toFixed(1)}% of ${mode === "params" ? "parameters" : "on-disk bytes"}`
          ).join(", ")}
        >
          {SEGMENTS.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-center overflow-hidden transition-all duration-300"
              style={{ width: `${(val(s) / total) * 100}%`, background: s.color }}
            >
              {(val(s) / total) * 100 > 8 ? (
                <span className="px-1 font-mono text-[10px] font-semibold text-white/95">
                  {((val(s) / total) * 100).toFixed(1)}%
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <dl className="mt-4 space-y-2.5">
          {SEGMENTS.map((s) => (
            <div key={s.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-xs">
              <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <dt className="text-foreground">{s.label}</dt>
              <dd className="text-muted-foreground">
                {fmt(val(s))} · {((val(s) / total) * 100).toFixed(1)}% · {s.bpw.toFixed(2)} bits/weight
                <span className="text-muted-foreground/60"> — {s.note}</span>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "params" ? (
            <>
              By parameter count Bonsai 2 27B is{" "}
              <span className="text-foreground">{((TERNARY_PARAMS / TOTAL_PARAMS) * 100).toFixed(1)}%</span>{" "}
              ternary — the low-bit representation really does run end to end through
              embeddings, attention, MLPs, and the LM head. The two exceptions are tiny:
              26.2M state-path/norm parameters PrismML pulled out of ternary this
              generation, and the 0.47B vision tower, which was never part of the
              &quot;5.9 GB language weights&quot; figure to begin with.
            </>
          ) : (
            <>
              Switch to bytes and those two slices stop looking tiny. The vision tower is{" "}
              <span className="text-foreground">1.7%</span>{" "}of parameters but{" "}
              <span className="text-foreground">{((VISION_BYTES / TOTAL_BYTES) * 100).toFixed(1)}%</span>{" "}
              of the on-disk file, because it costs ~11 bits/weight against ternary&apos;s
              ~1.75 — call it &quot;4-bit,&quot; but the shipped Q8_0 container makes it
              cost closer to 11. Add the vision tower to the 5.95 GB language file and the
              real download is <span className="text-foreground">~6.58 GB</span>, not 5.9.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
