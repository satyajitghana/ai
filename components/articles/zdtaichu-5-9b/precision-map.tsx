"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the bytes actually go in the three ZDTaichu5.0-9B checkpoints.
//
// Every number below was recovered without downloading a single weight: an HTTP
// range read of the first 8 bytes of each .safetensors file gives the header
// length as a little-endian u64, a second range read pulls the JSON header, and
// the header carries every tensor's name, dtype and byte offsets. Blocks are
// assigned by tensor name; the MLP rows are split at layer 28 because that is
// where the NVFP4 build stops being 4-bit.
//
// Totals reconcile exactly with the CDN's Content-Length for each file
// (8 length bytes + header + tensor bytes), so this is the shipped artifact,
// not a README's description of it.

const PARAMS = 9_794_197_512

type DType = "BF16" | "F8_E4M3" | "NVFP4" | "other"

const DTYPE_COLOR: Record<DType, string> = {
  BF16: "oklch(0.62 0.02 260)",
  F8_E4M3: "oklch(0.72 0.15 75)",
  NVFP4: "oklch(0.6 0.17 300)",
  other: "oklch(0.8 0.01 260)",
}

type Block = { id: string; label: string; note: string }

const BLOCKS: Block[] = [
  { id: "embed", label: "embed_tokens", note: "248,320 × 4,096 input embedding" },
  { id: "lm_head", label: "lm_head", note: "248,320 × 4,096 output projection, untied" },
  { id: "attn", label: "attention + linear attention", note: "q/k/v/o and Gated DeltaNet projections, all 32 layers" },
  { id: "mlp_0_27", label: "MLP, layers 0-27", note: "gate/up/down, 4,096 ↔ 12,288" },
  { id: "mlp_28_31", label: "MLP, layers 28-31", note: "the last four blocks" },
  { id: "norms", label: "norms", note: "RMSNorm and q/k norms" },
  { id: "vision", label: "C-RADIOv4-H tower", note: "32-block ViT-H/16, 651.6M params" },
  { id: "projector", label: "mlp1 projector", note: "5,120 → 20,480 → 4,096" },
]

type Ck = {
  id: string
  label: string
  repo: string
  total: number
  blocks: Record<string, { bytes: number; mix: Partial<Record<DType, number>>; dom: DType }>
}

const CHECKPOINTS: Ck[] = [
  {
    id: "bf16",
    label: "ZDTaichu5.0-9B",
    repo: "5 shards, 820 tensors",
    total: 19_588_395_036,
    blocks: {
      embed: { bytes: 2_034_237_440, mix: { BF16: 2_034_237_440 }, dom: "BF16" },
      lm_head: { bytes: 2_034_237_440, mix: { BF16: 2_034_237_440 }, dom: "BF16" },
      attn: { bytes: 4_174_922_752, mix: { BF16: 4_174_922_752 }, dom: "BF16" },
      mlp_0_27: { bytes: 8_455_716_864, mix: { BF16: 8_455_716_864 }, dom: "BF16" },
      mlp_28_31: { bytes: 1_207_959_552, mix: { BF16: 1_207_959_552 }, dom: "BF16" },
      norms: { bytes: 532_480, mix: { BF16: 532_480 }, dom: "BF16" },
      vision: { bytes: 1_303_290_908, mix: { BF16: 1_303_290_892, other: 16 }, dom: "BF16" },
      projector: { bytes: 377_497_600, mix: { BF16: 377_497_600 }, dom: "BF16" },
    },
  },
  {
    id: "fp8",
    label: "ZDTaichu5.0-9B-FP8",
    repo: "1 file, 1,066 tensors",
    total: 12_672_744_464,
    blocks: {
      embed: { bytes: 2_034_237_440, mix: { BF16: 2_034_237_440 }, dom: "BF16" },
      lm_head: { bytes: 2_034_237_440, mix: { BF16: 2_034_237_440 }, dom: "BF16" },
      attn: { bytes: 2_089_275_392, mix: { F8_E4M3: 2_086_666_240, BF16: 2_609_152 }, dom: "F8_E4M3" },
      mlp_0_27: { bytes: 4_229_464_064, mix: { F8_E4M3: 4_227_858_432, BF16: 1_605_632 }, dom: "F8_E4M3" },
      mlp_28_31: { bytes: 604_209_152, mix: { F8_E4M3: 603_979_776, BF16: 229_376 }, dom: "F8_E4M3" },
      norms: { bytes: 532_480, mix: { BF16: 532_480 }, dom: "BF16" },
      vision: { bytes: 1_303_290_896, mix: { BF16: 1_303_290_880, other: 16 }, dom: "BF16" },
      projector: { bytes: 377_497_600, mix: { BF16: 377_497_600 }, dom: "BF16" },
    },
  },
  {
    id: "nvfp4",
    label: "ZDTaichu5.0-9B-NVFP4",
    repo: "1 file, 1,203 tensors",
    total: 9_811_117_776,
    blocks: {
      embed: { bytes: 2_034_237_440, mix: { BF16: 2_034_237_440 }, dom: "BF16" },
      lm_head: { bytes: 1_017_615_360, mix: { F8_E4M3: 1_017_118_720, BF16: 496_640 }, dom: "F8_E4M3" },
      attn: { bytes: 2_095_563_808, mix: { F8_E4M3: 2_080_374_784, BF16: 15_189_024 }, dom: "F8_E4M3" },
      mlp_0_27: { bytes: 2_378_171_040, mix: { NVFP4: 2_113_929_216, F8_E4M3: 264_241_152, other: 672 }, dom: "NVFP4" },
      mlp_28_31: { bytes: 604_209_152, mix: { F8_E4M3: 603_979_776, BF16: 229_376 }, dom: "F8_E4M3" },
      norms: { bytes: 532_480, mix: { BF16: 532_480 }, dom: "BF16" },
      vision: { bytes: 1_303_290_896, mix: { BF16: 1_303_290_880, other: 16 }, dom: "BF16" },
      projector: { bytes: 377_497_600, mix: { BF16: 377_497_600 }, dom: "BF16" },
    },
  },
]

const SCALE = CHECKPOINTS[0].total

function gb(bytes: number): string {
  if (bytes < 1e6) return `${bytes.toLocaleString("en-US")} B`
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e9).toFixed(2)} GB`
}

function bf16Share(ck: Ck): number {
  let b = 0
  for (const blk of BLOCKS) b += ck.blocks[blk.id].mix.BF16 ?? 0
  return (b * 100) / ck.total
}

export function PrecisionMap() {
  const [sel, setSel] = useState<string | null>("vision")
  const block = BLOCKS.find((b) => b.id === sel) ?? null

  return (
    <figure
      className="my-8 rounded-md border"
      data-precision-map={sel ?? "none"}
      aria-label="Byte composition of the three ZDTaichu5.0-9B checkpoints by block and dtype"
    >
      <div className="space-y-5 px-4 py-4">
        {CHECKPOINTS.map((ck) => (
          <div key={ck.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="font-mono text-sm font-semibold">{ck.label}</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {gb(ck.total)} · {((ck.total * 8) / PARAMS).toFixed(2)} bits/weight ·{" "}
                {bf16Share(ck).toFixed(1)}% still BF16
              </span>
            </div>
            <div
              className="mt-1.5 flex h-8 overflow-hidden rounded-sm border"
              style={{ width: `${(ck.total * 100) / SCALE}%` }}
            >
              {BLOCKS.map((b) => {
                const seg = ck.blocks[b.id]
                const active = sel === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSel(active ? null : b.id)}
                    aria-pressed={active}
                    title={`${b.label} — ${gb(seg.bytes)} (${seg.dom})`}
                    className={cn(
                      "h-full transition-opacity",
                      sel && !active ? "opacity-35" : "opacity-100"
                    )}
                    style={{
                      width: `${(seg.bytes * 100) / ck.total}%`,
                      background: DTYPE_COLOR[seg.dom],
                      borderRight: "1px solid var(--background)",
                      outline: active ? "2px solid currentColor" : undefined,
                      outlineOffset: active ? "-2px" : undefined,
                    }}
                  >
                    <span className="sr-only">
                      {b.label}: {gb(seg.bytes)}, {seg.dom}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2">
        {(Object.keys(DTYPE_COLOR) as DType[]).map((d) => (
          <span key={d} className="flex items-center gap-1.5 font-mono text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: DTYPE_COLOR[d] }}
            />
            {d === "other" ? "scales / index buffers" : d}
          </span>
        ))}
      </div>

      <div className="border-t px-4 py-3">
        {block ? (
          <>
            <p className="my-0 text-sm">
              <span className="font-mono font-semibold">{block.label}</span>
              <span className="text-muted-foreground"> — {block.note}</span>
            </p>
            <table className="mt-2 w-full border-collapse text-sm">
              <tbody>
                {CHECKPOINTS.map((ck) => {
                  const seg = ck.blocks[block.id]
                  return (
                    <tr key={ck.id} className="border-b last:border-0">
                      <td className="py-1 pr-3 font-mono text-xs">{ck.label}</td>
                      <td className="py-1 pr-3 text-right font-mono tabular-nums">
                        {seg.bytes.toLocaleString("en-US")} B
                      </td>
                      <td className="text-muted-foreground py-1 font-mono text-xs">
                        {(Object.keys(seg.mix) as DType[])
                          .map((d) => `${d} ${gb(seg.mix[d] as number)}`)
                          .join(" · ")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-muted-foreground my-0 font-mono text-xs">
            Pick a block to see what each checkpoint does with it.
          </p>
        )}
      </div>

      <figcaption className="text-muted-foreground border-t px-4 py-3 font-mono text-xs">
        Bars are to scale against the BF16 checkpoint. Byte counts read from the
        safetensors JSON headers by HTTP range request; each total matches the
        file&rsquo;s Content-Length minus its header.
      </figcaption>
    </figure>
  )
}
