"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"

// Where Maple-Preview's claimed 5.31 GB checkpoint comes from, and why the file
// you actually download from Hugging Face is 40.43 GB.
//
// Census measured from the safetensors headers: 19,579,011,072 ternary params
// (attention + expert projections) and 635,019,264 full-precision ones
// (embeddings, lm_head, routers, norms). Drag the packing density to see the
// checkpoint size; the entropy floor for a 3-valued symbol is log2(3) = 1.585
// bits, and the card's 5.31 GB implies about 1.65 bits per ternary weight.

const TERN_P = 19_579_011_072
const FULL_P = 635_019_264
const CLAIMED_GB = 5.31
const ENTROPY = mlog2(3) // 1.58496

const ACC = "oklch(0.60 0.15 255)"
const MUT = "oklch(0.62 0.03 250)"

function sizeGB(bits: number): number {
  return (TERN_P * (bits / 8) + FULL_P * 2) / 1e9
}

// bits per ternary weight implied by the claimed file size
const IMPLIED = ((CLAIMED_GB * 1e9 - FULL_P * 2) / TERN_P) * 8

const MARKS = [
  { bits: ENTROPY, label: "log₂3 · entropy floor" },
  { bits: IMPLIED, label: "5.31 GB · as claimed" },
  { bits: 1.6, label: "5 trits per byte" },
  { bits: 2, label: "2-bit · naive" },
]

export function BitBudget() {
  const [bits, setBits] = useState(Number(IMPLIED.toFixed(2)))

  const gb = sizeGB(bits)
  const ternGB = (TERN_P * (bits / 8)) / 1e9
  const fullGB = (FULL_P * 2) / 1e9
  const bf16 = (TERN_P + FULL_P) * 2 / 1e9
  const below = bits < ENTROPY

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">checkpoint size · 20.21B params</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          hugging face ships {bf16.toFixed(2)} GB
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              packed at {bits.toFixed(2)} bits per ternary weight
            </span>
            <span className="font-mono text-sm tabular-nums text-foreground">{gb.toFixed(2)} GB</span>
          </div>

          {/* stacked bar: ternary vs full precision, against the bf16 baseline */}
          <div className="relative h-7 overflow-hidden rounded-sm bg-muted/40">
            <div className="absolute inset-y-0 left-0 flex" style={{ width: `${(gb / bf16) * 100}%` }}>
              <div style={{ width: `${(ternGB / gb) * 100}%`, background: ACC }} />
              <div style={{ width: `${(fullGB / gb) * 100}%`, background: MUT }} />
            </div>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
              bf16 = {bf16.toFixed(2)} GB
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACC }} /> ternary 19.58B →{" "}
              {ternGB.toFixed(2)} GB
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MUT }} /> full-precision
              0.64B → {fullGB.toFixed(2)} GB ({((fullGB / gb) * 100).toFixed(0)}% of the file)
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">bits / weight</span>
          <Range
            min={1.4}
            max={2.4}
            step={0.01}
            value={bits}
            onChange={(e) => setBits(Number(e.target.value))}
            className="min-w-[11rem] flex-1"
            aria-label="bits used to store each ternary weight"
            accent={below ? "oklch(0.58 0.19 25)" : ACC}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{bits.toFixed(2)}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {MARKS.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setBits(Number(m.bits.toFixed(2)))}
              className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {m.label} · {m.bits.toFixed(2)}
            </button>
          ))}
        </div>

        {below ? (
          <p className="mt-3 rounded-lg border px-3 py-2 font-mono text-[11px]" style={{ color: "oklch(0.58 0.19 25)" }}>
            below log₂3 — no lossless code can store a 3-valued symbol in fewer bits on average
          </p>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two things worth taking away. First, the 5.31 GB headline reconciles: it implies{" "}
          <span className="text-foreground">{IMPLIED.toFixed(2)} bits per ternary weight</span>, which sits just above
          the {ENTROPY.toFixed(3)}-bit information-theoretic floor and comfortably below naive 2-bit — roughly what
          you get packing five trits into a byte (3⁵ = 243 fits in 256) plus the per-row scales. That is independent
          corroboration that the checkpoint really is almost entirely ternary. Second, and less obvious: once
          everything else is crushed to under two bits, the{" "}
          <span className="text-foreground">un-quantized embedding tables become about a quarter of the file</span>.
          At 20B parameters the interesting compression problem stops being the weights and starts being the
          vocabulary.
        </p>
      </div>
    </figure>
  )
}
