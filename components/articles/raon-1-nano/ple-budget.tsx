"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Where Raon-1 nano's bytes have to live. Parameter counts are summed from the
// safetensors headers of huggingface.co/KRAFTON/Raon-1-nano (range-read, no download):
//   per_layer_inputs.table              259,840 x 6,144  = 1,596,456,960
//   everything else in shards 1 and 2                     = 1,534,340,368
//     of which embed_tokens (tied to the LM head)         =   399,114,240
// Cache arithmetic is from config.json and modeling_raon1_nano.py:
//   6 MLA layers. A latent cache holds kv_lora_rank 512 + 64 shared key channels = 576 values
//   per layer per token; at 2 bytes that is 6,912 bytes per token (the card's "about 7 KiB").
//   The reference PyTorch cache stores expanded keys and values instead:
//   32 heads x (192 + 128) x 2 bytes x 6 layers = 122,880 bytes per token.
//   18 RDA layers keep a fixed fp32 state of 16 heads x 128 x 128 (1,048,576 bytes each)
//   plus a short-conv window of 3 x 2,048 x 3 values in BF16 (36,864 bytes each).
// Bits per weight: BF16 = 16, Q8_0 = 8.5, Q4_K = 4.5 (llama.cpp block formats, scales included).

const PLE_PARAMS = 1_596_456_960
const CORE_PARAMS = 1_534_340_368
const PLE_WIDTH = 6144 // 24 layers x 256

const MLA_LAYERS = 6
const LATENT_BYTES = MLA_LAYERS * 576 * 2 // 6,912
const EXPANDED_BYTES = MLA_LAYERS * 32 * (192 + 128) * 2 // 122,880
const STATE_BYTES = 18 * (16 * 128 * 128 * 4 + 3 * 2048 * 3 * 2) // 19,537,920

type Prec = "bf16" | "q8" | "q4"
const BITS: Record<Prec, number> = { bf16: 16, q8: 8.5, q4: 4.5 }
const PREC_LABEL: Record<Prec, string> = { bf16: "BF16", q8: "8-bit (Q8_0)", q4: "4-bit (Q4_K)" }

type Where = "accel" | "host"
type Cache = "latent" | "expanded"

const CONTEXTS = [4096, 32768, 131072, 262144]
const ctxLabel = (n: number) => (n >= 1024 ? `${n / 1024}K` : `${n}`)

const GB = 1e9
const fmtGb = (b: number) => {
  const g = b / GB
  return g >= 1 ? `${g.toFixed(2)} GB` : `${(b / 1e6).toFixed(0)} MB`
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { id: T; text: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="w-full font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:w-28">{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "rounded-md border px-2.5 py-1 font-mono text-xs",
            value === o.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  )
}

export function PleBudget() {
  const [prec, setPrec] = useState<Prec>("q4")
  const [where, setWhere] = useState<Where>("host")
  const [cache, setCache] = useState<Cache>("latent")
  const [ci, setCi] = useState(1)

  const ctx = CONTEXTS[ci]
  const bits = BITS[prec]
  const core = (CORE_PARAMS * bits) / 8
  const ple = (PLE_PARAMS * bits) / 8
  const kv = ctx * (cache === "latent" ? LATENT_BYTES : EXPANDED_BYTES)
  const state = STATE_BYTES

  const accelRows = [
    { key: "core", label: `compute weights, 1.53B params, ${PREC_LABEL[prec]}`, b: core, color: "oklch(0.60 0.14 255)" },
    ...(where === "accel"
      ? [{ key: "ple", label: `per-layer table, 1.60B params, ${PREC_LABEL[prec]}`, b: ple, color: "oklch(0.66 0.14 150)" }]
      : []),
    {
      key: "kv",
      label: `MLA cache, ${ctxLabel(ctx)} tokens, ${cache === "latent" ? "latent" : "expanded"}`,
      b: kv,
      color: "oklch(0.70 0.15 60)",
    },
    { key: "state", label: "RDA state, 18 layers, fixed", b: state, color: "oklch(0.62 0.12 20)" },
  ]
  const accel = accelRows.reduce((s, r) => s + r.b, 0)
  const host = where === "host" ? ple : 0

  const rowBytes = (PLE_WIDTH * bits) / 8
  const perSecond = rowBytes * 20

  const scale = Math.max(8 * GB, accel * 1.05)
  const pct = (b: number) => `${((b / scale) * 100).toFixed(3)}%`
  const marks = [2, 4, 6, 8].map((g) => g * GB).filter((b) => b <= scale)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Raon-1 nano · where the bytes live</span>
        <span className="text-muted-foreground/60">counts from the safetensors headers</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <Toggle
          label="weights"
          value={prec}
          onChange={setPrec}
          options={(["bf16", "q8", "q4"] as Prec[]).map((p) => ({ id: p, text: PREC_LABEL[p] }))}
        />
        <Toggle
          label="per-layer table"
          value={where}
          onChange={setWhere}
          options={[
            { id: "host", text: "host RAM or flash" },
            { id: "accel", text: "on the accelerator" },
          ]}
        />
        <Toggle
          label="MLA cache"
          value={cache}
          onChange={setCache}
          options={[
            { id: "latent", text: "latent, 576 per layer" },
            { id: "expanded", text: "expanded keys and values" },
          ]}
        />

        <div>
          <div className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>context</span>
            <span className="text-foreground">{ctxLabel(ctx)} tokens</span>
          </div>
          <Range
            min={0}
            max={CONTEXTS.length - 1}
            value={ci}
            onChange={(e) => setCi(Number(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="Context length"
          />
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>accelerator memory</span>
            <span className="font-semibold">{fmtGb(accel)}</span>
          </div>
          <div className="relative h-9 w-full overflow-hidden rounded-md border bg-muted/30">
            <div className="flex h-full">
              {accelRows.map((r) => (
                <div
                  key={r.key}
                  style={{ width: pct(r.b), background: r.color }}
                  className="h-full border-r border-background/60"
                  title={`${r.label}: ${fmtGb(r.b)}`}
                />
              ))}
            </div>
            {marks.map((m) => (
              <div key={m} className="absolute top-0 h-full border-l border-dashed border-foreground/50" style={{ left: pct(m) }}>
                <span className="ml-1 font-mono text-[10px] text-foreground/70">{m / GB} GB</span>
              </div>
            ))}
          </div>
          <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
            {accelRows.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                <span className="text-muted-foreground">{r.label}</span>
                <span className="ml-auto">{fmtGb(r.b)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>host RAM or flash, read by row</span>
            <span className="font-semibold">{host ? fmtGb(host) : "nothing"}</span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-md border bg-muted/30">
            <div style={{ width: pct(host), background: "oklch(0.66 0.14 150)", opacity: 0.5 }} className="h-full" />
          </div>
        </div>

        <p className="rounded-lg border p-3 text-sm leading-6">
          Each new token needs one row of the per-layer table: {PLE_WIDTH.toLocaleString("en-US")} numbers, or{" "}
          <span className="font-mono">{Math.round(rowBytes).toLocaleString("en-US")} bytes</span> at {PREC_LABEL[prec]}. At 20 tokens a
          second that is <span className="font-mono">{(perSecond / 1000).toFixed(0)} KB/s</span> of reads, which any phone&apos;s flash
          serves without noticing. The compute weights, by contrast, are read in full for every token.
          {cache === "expanded"
            ? " The expanded cache is what the reference PyTorch code keeps; it is about 18 times the latent one."
            : " The latent cache is what the card's “about 7 KiB per token” describes."}
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Arithmetic on measured parameter counts and config.json, not a run. Bits per weight include block scales (Q8_0 8.5, Q4_K
        4.5). Real quant files mix types: KRAFTON&apos;s Q4_K_M keeps the embedding at Q6_K and some layers at Q6_K or Q8_0.
        Runtime buffers and activations are not counted.
      </figcaption>
    </figure>
  )
}
