"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The Qwen3-30B-A3B training MFU, recomputed from the bundle's own numbers.
//
// MEASURED (read from files, arithmetic done by me):
//   kernels/b300/qwen30b-train/reference.json: flops_per_token 20,665,860,096,
//   peak_flops_per_gpu 2.25e15, ranks 8, batch 64, seq 2048, 48 layers.
//   scripts/qwen30b/qwen30b help text: "Measured with this package: 491.58 ms, 30.6%".
//   The formula in that help text: 6 x active parameters + 6 x layers x heads x
//   head dim x 2048.
//   Summing the 18,867 tensor shapes in reference.json: 30,532,122,624 params,
//   311,164,928 of them the input embedding, 28,991,029,248 in 128 experts.
//   Active (8 of 128 experts, no embedding, no norm weights) = 3,041,656,832,
//   which is exactly what flops_per_token implies.
// The 491.58 ms step time is REPORTED by the repo; nobody here ran it.
//
// Arithmetic only: + - * /.

const ACTIVE = 3041656832
const EMBED = 311164928
const ATTN_CAUSAL = 6 * 48 * 32 * 128 * 2048 // 2,415,919,104 per token
const TOKENS = 64 * 2048
const GPUS = 8

type Attn = "none" | "causal" | "full"

export function MfuCheck() {
  const [ms, setMs] = useState(491.58)
  const [peak, setPeak] = useState(2.25)
  const [embed, setEmbed] = useState(false)
  const [attn, setAttn] = useState<Attn>("causal")

  const attnTerm = attn === "none" ? 0 : attn === "causal" ? ATTN_CAUSAL : 2 * ATTN_CAUSAL
  const fpt = 6 * (ACTIVE + (embed ? EMBED : 0)) + attnTerm
  const stepFlops = fpt * TOKENS
  const achieved = stepFlops / (ms / 1000)
  const mfu = (achieved / (GPUS * peak * 1e15)) * 100
  const isRepo = ms === 491.58 && peak === 2.25 && !embed && attn === "causal"
  const tokPerGpu = TOKENS / (ms / 1000) / GPUS

  const relBase = mfu / 1.11
  const ptBase = mfu - 11

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3-30B-A3B · 8 × B300 · global batch 64 × 2048 · BF16
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">repo&rsquo;s numbers, my arithmetic</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-0.5 flex justify-between gap-2 font-mono text-[11px] text-muted-foreground">
              <span>step time (repo: 491.58 ms)</span>
              <span className="tabular-nums text-foreground">{ms.toFixed(2)} ms</span>
            </span>
            <Range min={300} max={800} step={0.01} value={ms} onChange={(e) => setMs(Number(e.target.value))} aria-label="step time" />
          </label>
          <label className="block">
            <span className="mb-0.5 flex justify-between gap-2 font-mono text-[11px] text-muted-foreground">
              <span>peak per GPU (repo: 2.25 PFLOP/s)</span>
              <span className="tabular-nums text-foreground">{peak.toFixed(2)} PF/s</span>
            </span>
            <Range min={1.5} max={3} step={0.05} value={peak} onChange={(e) => setPeak(Number(e.target.value))} aria-label="peak FLOP/s per GPU" />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          <span className="mr-1 text-muted-foreground">attention FLOPs:</span>
          {(["none", "causal", "full"] as Attn[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAttn(a)}
              aria-pressed={attn === a}
              className={cn("rounded-sm border px-2 py-0.5", attn === a ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]")}
            >
              {a === "none" ? "left out" : a === "causal" ? "causal half (repo)" : "full square"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEmbed((v) => !v)}
            aria-pressed={embed}
            className={cn("ml-2 rounded-sm border px-2 py-0.5", embed ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]")}
          >
            {embed ? "embedding counted" : "embedding not counted (repo)"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMs(491.58)
              setPeak(2.25)
              setEmbed(false)
              setAttn("causal")
            }}
            className="ml-auto rounded-sm border px-2 py-0.5 hover:bg-foreground/[0.04]"
          >
            reset to repo
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">MFU</div>
            <div className="font-mono text-3xl tabular-nums">{mfu.toFixed(1)}%</div>
          </div>
          <div className="relative h-4 min-w-[10rem] flex-1 rounded-sm bg-foreground/[0.04]">
            <div
              className={cn("absolute top-0 left-0 h-4 rounded-sm", isRepo ? "bg-amber-500/85 dark:bg-amber-400/80" : "bg-sky-500/80 dark:bg-sky-400/75")}
              style={{ width: `${Math.min(100, mfu).toFixed(2)}%` }}
            />
            <div className="absolute -top-1 h-6 border-l-2 border-dashed border-foreground/60" style={{ left: "30.6%" }} title="the repo's 30.6%" />
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-1 rounded-md border bg-background/60 p-3 font-mono text-[11px] tabular-nums sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">FLOPs per token</span>
            <span>{(fpt / 1e9).toFixed(2)} G</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">FLOPs per step</span>
            <span>{(stepFlops / 1e15).toFixed(3)} P</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">achieved, all 8 GPUs</span>
            <span>{(achieved / 1e15).toFixed(2)} PF/s</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">tokens/s per GPU</span>
            <span>{tokPerGpu.toFixed(0)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">baseline if &ldquo;11% higher&rdquo; is relative</span>
            <span>{relBase.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">baseline if it is 11 points</span>
            <span>{ptBase.toFixed(1)}%</span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The repo&rsquo;s setting reproduces its 30.6% to the digit. Active parameters are 3,041,656,832: every
          non-expert weight except the input embedding and the norms, plus 8 of 128 experts, plus the output head.
          The attention term is the causal half, which is the conservative choice. Counting the full square or the
          embedding table would have given a bigger number from the same run. The step time is the repo&rsquo;s
          report; the NVIDIA baseline the post compares against is not in the repo at all.
        </p>
      </div>
    </figure>
  )
}
