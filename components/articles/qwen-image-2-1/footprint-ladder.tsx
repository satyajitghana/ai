"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every shipped way to run Qwen-Image-2.1 that publishes a number, on one axis.
//
// `bytes` is the sum of the weight files each path actually downloads, taken
// from the safetensors indexes, the installers' pinned manifests (which carry
// exact byte counts and SHA-256s) and the Hugging Face file listing for the ncnn
// conversion. `vram` and `seconds` are the sources' own measurements, on the
// hardware named in `where`; a null means that path publishes no such number,
// which is itself worth seeing.
//
// Peak memory is not a minimum. Two of these figures were produced on a 24 GiB
// card told to pretend it was smaller, and the reports say so.
//
// Arithmetic is +, -, *, / and toFixed only.

type Rung = {
  label: string
  note: string
  bytes: number
  /** peak GPU memory in GiB, as measured by the source */
  vram: number | null
  vramNote?: string
  /** seconds for one image, on `where` */
  seconds: number | null
  at: string
  where: string
}

const T = 14_230_249_472 // transformer, bf16
const E = 8_767_123_696 * 2 // Qwen3-VL text encoder, bf16
const V32 = 337_740_404 * 4 // VAE, fp32 as shipped
const PE = 9_409_813_744 * 2 // Qwen-Image-2.1-PE-T2I prompt rewriter, bf16

const INT8_DIT = 7_256_783_064
const INT8_ENC = 9_350_798_360
const BF16_VAE = 675_509_688
const GGUF_DIT = 4_604_557_984
const NCNN = 31_191_738_224

const RUNGS: Rung[] = [
  {
    label: "README path",
    note: "bf16 denoiser, bf16 Qwen3-VL, fp32 VAE, plus the prompt rewriter the model card recommends",
    bytes: T + E + V32 + PE,
    vram: null,
    seconds: null,
    at: "—",
    where: "no first-party figure published",
  },
  {
    label: "diffusers bf16",
    note: "the same three components without the rewriter — what `from_pretrained` pulls",
    bytes: T + E + V32,
    vram: 34.0,
    seconds: 3.9,
    at: "1024²/40",
    where: "GB300, vLLM-Omni recipe, 3.28-4.49 s",
  },
  {
    label: "ncnn / Vulkan",
    note: "bf16 throughout, `lm_head` dropped, VAE halved from fp32 — no CUDA, no PyTorch, no Python",
    bytes: NCNN,
    vram: 2.0,
    vramNote: "claimed, plus a 16 GB host floor",
    seconds: null,
    at: "—",
    where: "no timing published",
  },
  {
    label: "ComfyUI INT8",
    note: "INT8 ConvRot denoiser and text encoder, bf16 VAE, from the official repack",
    bytes: INT8_DIT + INT8_ENC + BF16_VAE,
    vram: null,
    seconds: 37.58,
    at: "1024²/40",
    where: "RTX 3090, no memory figure in that report",
  },
  {
    label: "GGUF Q4_K_M",
    note: "4-bit denoiser, INT8 text encoder on the GPU, tiled VAE off",
    bytes: GGUF_DIT + INT8_ENC + BF16_VAE,
    vram: 15.39,
    seconds: 60.35,
    at: "1024²/40",
    where: "RTX 3090, 23 GiB available",
  },
  {
    label: "+ CPU encoder",
    note: "same weights, text encoder on the CPU, VAE decoding in 256-pixel tiles",
    bytes: GGUF_DIT + INT8_ENC + BF16_VAE,
    vram: 6.14,
    seconds: 145.9,
    at: "1024²/40",
    where: "RTX 3090 held to an 8 GiB budget",
  },
  {
    label: "+ CPU VAE",
    note: "and fp32 CPU text encoding, with less than half the denoiser resident on the GPU",
    bytes: GGUF_DIT + INT8_ENC + BF16_VAE,
    vram: 3.05,
    seconds: 195.28,
    at: "512²/40",
    where: "RTX 3090 held to a 4 GiB budget, 15.21 GiB of host RAM",
  },
]

const MODES = [
  { key: "bytes", label: "weights downloaded" },
  { key: "vram", label: "peak GPU memory" },
  { key: "seconds", label: "seconds per image" },
] as const

type Mode = (typeof MODES)[number]["key"]

const gb = (b: number) => `${(b / 1e9).toFixed(2)} GB`

function value(r: Rung, mode: Mode) {
  if (mode === "bytes") return { n: r.bytes, text: gb(r.bytes) }
  if (mode === "vram")
    return r.vram == null
      ? { n: 0, text: "not published" }
      : { n: r.vram, text: `${r.vram.toFixed(2)} GiB` }
  return r.seconds == null
    ? { n: 0, text: "not published" }
    : { n: r.seconds, text: `${r.seconds.toFixed(1)} s` }
}

export function FootprintLadder() {
  const [mode, setMode] = useState<Mode>("bytes")
  const max = Math.max(...RUNGS.map((r) => value(r, mode).n))

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-footprint-ladder={mode}
      aria-label="Every published way to run Qwen-Image-2.1, by weights downloaded, peak GPU memory and seconds per image"
    >
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
            className={cn(
              "rounded-sm border px-3 py-1 font-mono text-xs",
              mode === m.key
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 px-4 py-4">
        {RUNGS.map((r) => {
          const v = value(r, mode)
          const missing = v.n === 0
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-right font-mono text-xs sm:w-36">
                {r.label}
              </span>
              <div className="relative h-6 flex-1 rounded-sm bg-muted/50">
                {!missing ? (
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-foreground/70"
                    style={{ width: `${(v.n * 100) / max}%` }}
                  />
                ) : (
                  <div className="absolute inset-y-0 left-0 w-full rounded-sm border border-dashed border-foreground/20" />
                )}
              </div>
              <span
                className={cn(
                  "w-24 shrink-0 text-right font-mono text-xs tabular-nums sm:w-28",
                  missing && "text-muted-foreground"
                )}
              >
                {v.text}
              </span>
            </div>
          )
        })}
      </div>

      <ul className="m-0 list-none space-y-1 border-t px-4 py-3 pl-4 text-xs text-muted-foreground">
        {RUNGS.map((r) => (
          <li key={r.label} className="my-0">
            <span className="font-mono text-foreground">{r.label}</span>{" "}
            — {r.note}.{" "}
            {mode === "seconds" ? (
              <span className="font-mono">
                {r.at}, {r.where}
              </span>
            ) : mode === "vram" ? (
              <span className="font-mono">
                {r.vramNote ? `${r.vramNote}; ` : ""}
                {r.where}
              </span>
            ) : (
              <span className="font-mono">
                {r.bytes.toLocaleString("en-US")} bytes
              </span>
            )}
          </li>
        ))}
      </ul>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Byte counts are exact, from the safetensors indexes, the installers&rsquo;
        pinned manifests and the ncnn repository&rsquo;s file listing. Memory and
        time are each source&rsquo;s own measurement on its own hardware, so the
        rows are not a controlled comparison — the bottom three come from one
        RTX 3090 and the second row from a GB300. The bottom two figures were
        produced by telling a 24 GiB card to reserve most of itself, which the
        report is explicit is a placement hint and not a hard allocator cap, so
        read them as evidence for trying a small card rather than a promise about
        one.
      </figcaption>
    </figure>
  )
}
