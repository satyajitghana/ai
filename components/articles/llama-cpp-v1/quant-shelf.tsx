"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a ggml quant type is, byte for byte, and what it costs on one real model.
//
// Block layouts are the structs in ggml/src/ggml-common.h at llama.cpp v1.0.0,
// each pinned by a static_assert on its size. Bits per weight = bytes * 8 / weights.
// The file sizes are the published bartowski/Llama-3.2-1B-Instruct-GGUF files
// (Hugging Face API), divided by the model's 1,235,814,432 weights, header included.
// That is why a "4-bit" file lands near 5 bits: its token embedding (a quarter of
// the weights, tied to the output head) is kept at a higher-precision type.

type Field = { label: string; bytes: number; tone: string }
type Q = { name: string; n: number; fields: Field[]; how: string }

const SCALE = "bg-amber-500/80"
const SUB = "bg-violet-500/80"
const LOW = "bg-sky-500/80"
const HIGH = "bg-indigo-500/80"

const TYPES: Q[] = [
  {
    name: "Q8_0",
    n: 32,
    fields: [
      { label: "d, fp16 scale", bytes: 2, tone: SCALE },
      { label: "32 × int8", bytes: 32, tone: LOW },
    ],
    how: "w = d × q. One scale per 32 weights, 8 bits each: close to lossless, used for embeddings and as the activation format for dot products.",
  },
  {
    name: "Q6_K",
    n: 256,
    fields: [
      { label: "ql, low 4 bits", bytes: 128, tone: LOW },
      { label: "qh, high 2 bits", bytes: 64, tone: HIGH },
      { label: "16 × int8 sub-scales", bytes: 16, tone: SUB },
      { label: "d, fp16", bytes: 2, tone: SCALE },
    ],
    how: "A 256-weight super-block of 16 groups of 16. Each group has an 8-bit scale, and one fp16 scales the scales.",
  },
  {
    name: "Q5_K",
    n: 256,
    fields: [
      { label: "d, dmin, fp16", bytes: 4, tone: SCALE },
      { label: "8 × 6-bit scale + min", bytes: 12, tone: SUB },
      { label: "qh, 5th bit", bytes: 32, tone: HIGH },
      { label: "qs, low 4 bits", bytes: 128, tone: LOW },
    ],
    how: "w = a × q + b: 8 groups of 32, each with its own 6-bit scale and 6-bit minimum.",
  },
  {
    name: "Q4_K",
    n: 256,
    fields: [
      { label: "d, dmin, fp16", bytes: 4, tone: SCALE },
      { label: "8 × 6-bit scale + min", bytes: 12, tone: SUB },
      { label: "qs, 4 bits", bytes: 128, tone: LOW },
    ],
    how: "Q5_K without the fifth bit. The workhorse of Q4_K_M, which is a recipe that mixes Q4_K with Q6_K, not a type of its own.",
  },
  {
    name: "Q4_0",
    n: 32,
    fields: [
      { label: "d, fp16", bytes: 2, tone: SCALE },
      { label: "32 × 4-bit", bytes: 16, tone: LOW },
    ],
    how: "The original: one scale per 32 weights, no minimum. Same 4.5 bits as Q4_K, coarser fit, simplest kernel; the CPU backend repacks it for SIMD.",
  },
  {
    name: "IQ4_XS",
    n: 256,
    fields: [
      { label: "d, fp16", bytes: 2, tone: SCALE },
      { label: "scales, high bits", bytes: 2, tone: SUB },
      { label: "scales, low bits", bytes: 4, tone: SUB },
      { label: "qs, 4-bit codes", bytes: 128, tone: LOW },
    ],
    how: "4-bit indices into a fixed non-uniform table of 16 values instead of a uniform grid, with 6-bit scales per 32.",
  },
  {
    name: "MXFP4",
    n: 32,
    fields: [
      { label: "e, E8M0 exponent", bytes: 1, tone: SCALE },
      { label: "32 × FP4 E2M1", bytes: 16, tone: LOW },
    ],
    how: "The OCP microscaling format: every weight is a tiny float, and the block shares a power-of-two scale.",
  },
  {
    name: "NVFP4",
    n: 64,
    fields: [
      { label: "4 × E4M3 scales", bytes: 4, tone: SCALE },
      { label: "64 × FP4 E2M1", bytes: 32, tone: LOW },
    ],
    how: "NVIDIA's FP4: an FP8 scale per 16 weights, which is finer than MXFP4's one per 32.",
  },
  {
    name: "Q2_K",
    n: 256,
    fields: [
      { label: "16 × 4-bit scale + min", bytes: 16, tone: SUB },
      { label: "qs, 2 bits", bytes: 64, tone: LOW },
      { label: "d, dmin, fp16", bytes: 4, tone: SCALE },
    ],
    how: "Two bits a weight, but a scale and a minimum for every 16: a third of the block is overhead.",
  },
  {
    name: "IQ2_XXS",
    n: 256,
    fields: [
      { label: "d, fp16", bytes: 2, tone: SCALE },
      { label: "32 × uint16: grid index, signs, scale", bytes: 64, tone: LOW },
    ],
    how: "Groups of eight weights are looked up in a lattice codebook; each uint16 packs indices, sign bits and a group scale.",
  },
  {
    name: "IQ1_S",
    n: 256,
    fields: [
      { label: "d, fp16", bytes: 2, tone: SCALE },
      { label: "qs, grid indices", bytes: 32, tone: LOW },
      { label: "qh, high bits + scales", bytes: 16, tone: HIGH },
    ],
    how: "The floor of the family: about one and a half bits, usable only with an importance matrix and a big model.",
  },
]

// bartowski/Llama-3.2-1B-Instruct-GGUF, bytes per the Hugging Face API
// tg: llama-bench tg128 decode, tok/s, mean of 5, RTX 3090, -ngl 99 -fa on, llama.cpp v1.0.0
// (v0.9.0 in tg0); pred: the straight line through f16 and Q8_0, t = 0.6317 ms + GB / 804 GB/s,
// with GB the tensor bytes llama-bench reports (the file minus its 7.83 MB header).
const FILES: { name: string; bytes: number; tensor: number; tg: number; tg0: number }[] = [
  { name: "f16", bytes: 2_479_595_360, tensor: 2_471_764_096, tg: 269.9, tg0: 269.56 },
  { name: "Q8_0", bytes: 1_321_083_008, tensor: 1_313_251_456, tg: 441.58, tg0: 440.09 },
  { name: "Q6_K", bytes: 1_021_800_576, tensor: 1_013_969_024, tg: 518.0, tg0: 516.03 },
  { name: "Q4_K_M", bytes: 807_694_464, tensor: 799_862_912, tg: 589.02, tg0: 584.93 },
  { name: "Q4_0", bytes: 773_025_920, tensor: 765_194_368, tg: 622.29, tg0: 611.9 },
  { name: "IQ4_XS", bytes: 743_141_504, tensor: 735_309_952, tg: 581.31, tg0: 575.14 },
  { name: "IQ3_M", bytes: 657_289_344, tensor: 649_457_792, tg: 577.26, tg0: 565.55 },
]
const FIXED_MS = 0.6317
const MS_PER_GB = 1.2434
const pred = (tensor: number) => 1000 / (FIXED_MS + (tensor / 1e9) * MS_PER_GB)
const N_WEIGHTS = 1_235_814_432

const sum = (q: Q) => q.fields.reduce((s, f) => s + f.bytes, 0)
const bpw = (q: Q) => (sum(q) * 8) / q.n
const trim = (v: number) => v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")

export function QuantShelf() {
  const [pick, setPick] = useState("Q4_K")
  const [ver, setVer] = useState("v1")
  const q = TYPES.find((t) => t.name === pick) ?? TYPES[3]
  const total = sum(q)
  const maxBpw = 8.5

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        ggml quant blocks, from the structs in ggml-common.h · one real model&apos;s files, sized and timed
      </div>

      <div className="px-4 py-3">
        <div className="space-y-1">
          {TYPES.map((t) => {
            const b = bpw(t)
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => setPick(t.name)}
                className={cn(
                  "grid w-full grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 rounded px-1 py-0.5 text-left font-mono text-[11px]",
                  pick === t.name ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                <span>{t.name}</span>
                <span className="h-2.5 overflow-hidden rounded-sm bg-muted">
                  <span
                    className={cn("block h-full", pick === t.name ? "bg-foreground/70" : "bg-foreground/30")}
                    style={{ width: `${(b / maxBpw) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{trim(b)} b</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 rounded border px-3 py-2.5 text-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono">
            <span className="font-medium">block_{q.name.toLowerCase()}</span>
            <span className="tabular-nums text-muted-foreground">
              {q.n} weights in {total} bytes = {trim(bpw(q))} bits per weight
            </span>
          </div>
          <div className="mt-2 flex h-7 w-full overflow-hidden rounded-sm" role="img" aria-label={`Layout of one ${q.name} block`}>
            {q.fields.map((f) => (
              <div
                key={f.label}
                className={cn(f.tone, "h-full border-r border-background/70")}
                style={{ width: `${(f.bytes / total) * 100}%` }}
                title={`${f.label}: ${f.bytes} bytes`}
              />
            ))}
          </div>
          <ul className="mt-2 grid gap-x-4 gap-y-0.5 font-mono text-[11px] sm:grid-cols-2">
            {q.fields.map((f) => (
              <li key={f.label} className="flex items-center gap-1.5">
                <span className={cn(f.tone, "inline-block size-2.5 shrink-0 rounded-sm")} />
                <span>{f.label}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{f.bytes} B</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">{q.how}</p>
        </div>
      </div>

      <div className="overflow-x-auto border-t px-4 py-3">
        <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
          Llama-3.2-1B-Instruct, published files: file bits per weight = bytes × 8 / {N_WEIGHTS.toLocaleString("en-US")}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {[
            { v: "v1", l: "decode, v1.0.0" },
            { v: "v0", l: "decode, v0.9.0" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setVer(o.v)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                ver === o.v ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {o.l}
            </button>
          ))}
          <span className="font-mono text-[11px] text-muted-foreground">
            RTX 3090, tg128, tok/s · tick = bandwidth-line prediction
          </span>
        </div>
        <table className="w-full font-mono text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-0.5 pr-3 font-normal">file</th>
              <th className="py-0.5 pr-3 text-right font-normal">GB</th>
              <th className="py-0.5 pr-3 text-right font-normal">bits/w</th>
              <th className="py-0.5 pr-3 text-right font-normal">tok/s</th>
              <th className="py-0.5 pr-3 text-right font-normal">line</th>
              <th className="w-2/5 py-0.5 font-normal" />
            </tr>
          </thead>
          <tbody>
            {FILES.map((f) => {
              const b = (f.bytes * 8) / N_WEIGHTS
              const tg = ver === "v1" ? f.tg : f.tg0
              const p = pred(f.tensor)
              return (
                <tr key={f.name} className="border-t border-border/50">
                  <td className="py-0.5 pr-3">{f.name}</td>
                  <td className="py-0.5 pr-3 text-right">{(f.bytes / 1e9).toFixed(3)}</td>
                  <td className="py-0.5 pr-3 text-right">{b.toFixed(2)}</td>
                  <td className="py-0.5 pr-3 text-right">{tg.toFixed(1)}</td>
                  <td className="py-0.5 pr-3 text-right text-muted-foreground">{p.toFixed(0)}</td>
                  <td className="py-0.5">
                    <span className="relative block h-2 rounded-sm bg-muted">
                      <span className="block h-full rounded-sm bg-foreground/45" style={{ width: `${(tg / 720) * 100}%` }} />
                      <span
                        className="absolute top-[-2px] h-3 w-0.5 bg-amber-500"
                        style={{ left: `${(p / 720) * 100}%` }}
                        aria-hidden
                      />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The line is fitted to f16 and Q8_0 only: a fixed {FIXED_MS.toFixed(2)} ms per token plus the weights at about
          804 GB/s. Q4_0 lands on it; the K-quants fall a little short and the IQ codebook formats a lot.
        </p>
      </div>
    </figure>
  )
}
