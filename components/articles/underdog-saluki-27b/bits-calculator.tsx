"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"

// Bits per weight -> bytes -> what fits, with every quality number cited.
//
// PARAMS is the element count of all 851 tensors in Saluki's GGUF header (text
// decoder, embedding and LM head; no vision tower, no MTP head). KV cache: only
// the 16 full-attention blocks keep one, 4 KV heads x 256 dims x (K + V) x 2
// bytes at f16 = 65,536 bytes per token. The 48 Gated DeltaNet blocks keep a
// fixed recurrent state instead: 48 heads x 128 x 128 x 4 bytes each, about
// 0.15 GB in total, whatever the context.
//
// Sizes: Saluki, ISTA and Unsloth files from the Hugging Face API; BF16 from
// ISTA's table; Mia from Underdog's page; Bonsai 2 from its own repository.
// Scores: "UB" is Underdog Bench (passed of 120, Underdog's run); "ISTA avg" is
// the mean of AIME25, GPQA-Diamond and LiveCodeBench v6 in ISTA's table. A
// blank is a number nobody published, not a zero.

const PARAMS = 26_895_998_464
const KV_BYTES_PER_TOKEN = 65_536
const STATE_GB = 0.15

type Build = {
  id: string
  name: string
  fmt: string
  gb: number
  bpw: number | null
  ub?: number
  ista?: number
  runtime: string
  ours?: boolean
}

const BUILDS: Build[] = [
  { id: "bf16", name: "Qwen3.8-27B", fmt: "BF16", gb: 53.8, bpw: 16, ub: 84, ista: 91.87, runtime: "anything" },
  { id: "q4km", name: "Unsloth", fmt: "UD-Q4_K_M", gb: 16.46, bpw: 4.9, runtime: "llama.cpp" },
  { id: "iq3s", name: "ISTA GSQ-RCO", fmt: "IQ3_S", gb: 11.8, bpw: 3.5, ista: 91.7, runtime: "llama.cpp" },
  { id: "q2kxl", name: "Unsloth", fmt: "UD-Q2_K_XL", gb: 9.83, bpw: 2.88, ista: 89.72, runtime: "llama.cpp" },
  { id: "mia", name: "Mia 2-bit", fmt: "EXL3 2.0bpw", gb: 9.1, bpw: null, ub: 85, runtime: "ExLlamaV3 only" },
  { id: "ista2", name: "ISTA GSQ-RCO", fmt: "IQ2_XS", gb: 8.42, bpw: 2.5, ub: 76, ista: 86.03, runtime: "llama.cpp" },
  { id: "ud2s", name: "Unsloth", fmt: "UD-IQ2_S", gb: 8.37, bpw: 2.49, ista: 78.31, runtime: "llama.cpp" },
  { id: "saluki", name: "Saluki", fmt: "IQ2 mix", gb: 7.9, bpw: 2.35, ub: 88, runtime: "llama.cpp", ours: true },
  { id: "ud2xxs", name: "Unsloth", fmt: "UD-IQ2_XXS", gb: 7.27, bpw: 2.16, runtime: "llama.cpp" },
  { id: "bonsai", name: "Ternary Bonsai 2", fmt: "PTQ1_0", gb: 5.95, bpw: null, ub: 70, runtime: "PrismML fork" },
]

const BUDGETS = [8, 12, 16, 24] as const
const CONTEXTS = [8192, 32768, 131072, 262144] as const

const ACCENT = "oklch(0.62 0.17 30)"

// Underdog's "intelligence density": -log2(1 - score) / GB.
function density(ub: number, gb: number): number {
  return -mlog2(1 - ub / 120) / gb
}

export function BitsCalculator() {
  const [bpw10, setBpw10] = useState(235)
  const [budget, setBudget] = useState<(typeof BUDGETS)[number]>(12)
  const [ctx, setCtx] = useState<(typeof CONTEXTS)[number]>(32768)

  const bpw = bpw10 / 100
  const weightsGB = (PARAMS * bpw) / 8 / 1e9
  const kvGB = (KV_BYTES_PER_TOKEN * ctx) / 1e9
  const totalGB = weightsGB + kvGB + STATE_GB
  const fits = totalGB <= budget
  const maxGB = 56
  const x = (gb: number) => `${((gb / maxGB) * 100).toFixed(2)}%`
  const fullDensity = density(84, 53.8)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3.8-27B · bits per weight → bytes → what fits
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          26,895,998,464 weights, from Saluki&apos;s header
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label className="flex items-center justify-between font-mono text-xs">
            <span>bits per weight, whole file</span>
            <span className="text-foreground">{bpw.toFixed(2)}</span>
          </label>
          <Range
            min={150}
            max={1600}
            step={5}
            value={bpw10}
            accent={ACCENT}
            onChange={(e) => setBpw10(Number(e.target.value))}
            aria-label="Bits per weight"
            className="mt-2 w-full"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {[
              ["IQ2_XXS-ish", 216],
              ["Saluki", 235],
              ["ISTA IQ2_XS", 250],
              ["IQ3_S", 350],
              ["Q4_K_M", 490],
              ["Q8_0", 850],
              ["BF16", 1600],
            ].map(([l, v]) => (
              <button
                key={l as string}
                type="button"
                onClick={() => setBpw10(v as number)}
                className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
            <span className="mr-1 text-muted-foreground">memory</span>
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={budget === b}
                onClick={() => setBudget(b)}
                className={
                  "rounded border px-1.5 py-0.5 " +
                  (budget === b ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground")
                }
              >
                {b} GB
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
            <span className="mr-1 text-muted-foreground">context</span>
            {CONTEXTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={ctx === c}
                onClick={() => setCtx(c)}
                className={
                  "rounded border px-1.5 py-0.5 " +
                  (ctx === c ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground")
                }
              >
                {c >= 1024 ? `${c / 1024}K` : c}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-background/60 p-3 font-mono text-xs leading-relaxed">
          <div>
            weights {weightsGB.toFixed(2)} GB + KV cache {kvGB.toFixed(2)} GB + DeltaNet state{" "}
            {STATE_GB.toFixed(2)} GB ={" "}
            <span className="text-foreground">{totalGB.toFixed(2)} GB</span>
          </div>
          <div className={fits ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
            {fits ? "fits" : "does not fit"} in {budget} GB before the runtime&apos;s own buffers and the OS
          </div>
        </div>

        <div className="relative h-4 rounded bg-muted/40">
          <div
            className="absolute top-0 h-4 rounded"
            style={{ width: x(Math.min(totalGB, maxGB)), background: ACCENT, opacity: 0.35 }}
          />
          <div className="absolute top-0 h-4 border-l-2 border-foreground/60" style={{ left: x(budget) }} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">build</th>
                <th className="py-1 pr-2 font-normal">GB</th>
                <th className="py-1 pr-2 font-normal">bpw</th>
                <th className="py-1 pr-2 font-normal">UB /120</th>
                <th className="py-1 pr-2 font-normal">density</th>
                <th className="py-1 pr-2 font-normal">ISTA avg</th>
                <th className="py-1 font-normal">runs in</th>
              </tr>
            </thead>
            <tbody>
              {BUILDS.map((b) => {
                const near = b.bpw !== null && Math.abs(b.bpw - bpw) < 0.08
                const d = b.ub !== undefined ? density(b.ub, b.gb) : null
                return (
                  <tr
                    key={b.id}
                    className={
                      "border-t " + (b.ours ? "font-semibold " : "") + (near ? "bg-foreground/5" : "")
                    }
                  >
                    <td className="py-1 pr-2">
                      {b.name} <span className="text-muted-foreground">{b.fmt}</span>
                    </td>
                    <td className={"py-1 pr-2 " + (b.gb + kvGB + STATE_GB <= budget ? "" : "text-muted-foreground line-through")}>
                      {b.gb.toFixed(2)}
                    </td>
                    <td className="py-1 pr-2">{b.bpw === null ? "n/a" : b.bpw.toFixed(2)}</td>
                    <td className="py-1 pr-2">{b.ub ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {d === null ? "—" : `${d.toFixed(3)} (${(d / fullDensity).toFixed(1)}x)`}
                    </td>
                    <td className="py-1 pr-2">{b.ista ?? "—"}</td>
                    <td className="py-1 text-muted-foreground">{b.runtime}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Struck-through sizes do not fit the chosen memory with the chosen context. Density is Underdog&apos;s own
        metric, −log2(1 − score/120) ÷ GB, shown against the full model&apos;s; most of Saluki&apos;s 7.5x is the
        6.8x size ratio. UB and ISTA avg come from different harnesses and never mix. A dash is a number nobody
        published.
      </figcaption>
    </figure>
  )
}
