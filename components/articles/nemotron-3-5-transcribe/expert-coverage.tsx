"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { BYTES_PER_PARAM, EXPERT_PARAMS, N_EXPERTS, N_MOE, P, TOP_K } from "./data"

// Why a mixture-of-experts decoder gets cheaper per token as the batch grows, and where it stops.
// One decode step advances every request by one token. Each request picks 6 of 128 experts in each of
// 23 MoE layers, and the step must read every expert ANY request picked. With routing spread evenly
// (the assumption; real routers are skewed, which lowers the distinct count) a batch of B reads an
// expected 128 x (1 - (1 - 6/128)^B) distinct experts per layer. The power is a loop of multiplications,
// so every digit is exact. Sizes are measured: 9,977,856 parameters an expert, 23 MoE layers, and
// 1.851 B always-read parameters (mixers, shared experts, routers, attention, output head). Bytes per
// parameter come from the repositories' file sizes divided by 33.698 B (2.003, 1.029, 0.640).

const ALWAYS = P.mamba + P.attention + P.shared + P.router + P.lmHead
const PRECISIONS = ["BF16", "FP8", "NVFP4"] as const
const COLOR = { BF16: "oklch(0.62 0.15 150)", FP8: "oklch(0.58 0.15 255)", NVFP4: "oklch(0.70 0.15 70)" }

function distinct(b: number): number {
  let miss = 1
  const q = 1 - TOP_K / N_EXPERTS
  for (let i = 0; i < b; i++) miss *= q
  return N_EXPERTS * (1 - miss)
}

const STEPS = [1, 2, 4, 8, 16, 32, 64, 128, 256]

export function ExpertCoverage() {
  const [b, setB] = useState(16)
  const [prec, setPrec] = useState<(typeof PRECISIONS)[number]>("BF16")

  const d = distinct(b)
  const bytes = BYTES_PER_PARAM[prec]
  const routedParams = d * N_MOE * EXPERT_PARAMS
  const stepGB = ((ALWAYS + routedParams) * bytes) / 1e9
  const tokGB = stepGB / b
  const one = ((ALWAYS + distinct(1) * N_MOE * EXPERT_PARAMS) * bytes) / 1e9
  const full = ((ALWAYS + N_EXPERTS * N_MOE * EXPERT_PARAMS) * bytes) / 1e9
  const maxTok = one

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        weights read per decode step · sizes measured, even routing assumed (reasoned)
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">precision</span>
        {PRECISIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPrec(p)}
            aria-pressed={prec === p}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              prec === p ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {p} · {BYTES_PER_PARAM[p].toFixed(2)} B/param
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-36 shrink-0 font-mono text-muted-foreground">requests in the batch</span>
          <Range min={0} max={STEPS.length - 1} step={1} value={STEPS.indexOf(b) < 0 ? 4 : STEPS.indexOf(b)} accent={COLOR[prec]} onChange={(e) => setB(STEPS[Number(e.target.value)])} aria-label="Requests in the batch" className="w-full" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{b}</span>
        </label>
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
        <div className="space-y-2 font-mono text-[11px]">
          <div className="text-muted-foreground">experts read, per MoE layer, of 128</div>
          <div className="h-4 overflow-hidden rounded bg-muted" role="img" aria-label={`${d.toFixed(1)} of 128 experts are read per layer at a batch of ${b}.`}>
            <div className="h-full" style={{ width: `${((d / N_EXPERTS) * 100).toFixed(1)}%`, background: COLOR[prec] }} />
          </div>
          <div className="tabular-nums">
            {d.toFixed(1)} of 128 ({((d / N_EXPERTS) * 100).toFixed(0)}%)
          </div>

          <div className="pt-2 text-muted-foreground">bytes read per token, this batch against one request</div>
          <div className="h-4 overflow-hidden rounded bg-muted" role="img" aria-label={`${tokGB.toFixed(2)} gigabytes per token at a batch of ${b}, against ${one.toFixed(2)} for a single request.`}>
            <div className="h-full" style={{ width: `${((tokGB / maxTok) * 100).toFixed(1)}%`, background: COLOR[prec] }} />
          </div>
          <div className="tabular-nums">
            {tokGB.toFixed(2)} GB a token, against {one.toFixed(2)} GB alone
          </div>
        </div>

        <div className="grid grid-cols-2 content-start gap-x-4 gap-y-3 font-mono text-xs">
          <div>
            <div className="text-muted-foreground">one step reads</div>
            <div className="text-xl tabular-nums">{stepGB.toFixed(1)} GB</div>
            <div className="text-[10px] text-muted-foreground">of {full.toFixed(1)} GB if every expert were read</div>
          </div>
          <div>
            <div className="text-muted-foreground">per token</div>
            <div className="text-xl tabular-nums">{tokGB.toFixed(2)} GB</div>
            <div className="text-[10px] text-muted-foreground">{(one / tokGB).toFixed(1)}x less than one request alone</div>
          </div>
          <div className="col-span-2 text-[10px] leading-relaxed text-muted-foreground">
            Past 64 requests nearly every expert is read each step, so a bigger batch stops adding experts and only divides a fixed bill
            by more tokens. The paper&apos;s throughput curves bend over in the same range (Figure 3 below, reported); this model of the
            cause is mine. Skewed routing lowers every number on the left.
          </div>
        </div>
      </div>
    </figure>
  )
}
