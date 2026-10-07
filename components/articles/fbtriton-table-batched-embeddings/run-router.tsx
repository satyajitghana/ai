"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Which backward kernel owns a run of segment length SL, in each implementation.
//
// CUDA TBE (FBGEMM, fbgemm_gpu/codegen/training/backward):
//   embedding_backward_split_host_template.cpp:993  max_segment_length_per_warp = 32
//   embedding_backward_split_template.cu:1149-1158  max_segment_length_per_cta = 1024,
//       4096 on compute capability >= 10 when TBE_USE_TUNED_SEGMENT_LENGTHS_CTA_B200 is on
//   SL < 32 -> warp_per_row; SL >= 32 -> cta_per_row; a run longer than the per-CTA
//   cap is shared by several CTAs that atomically add into temp_grad_accum, then
//   __threadfence + a countdown picks the CTA that applies the update
//   (embedding_backward_split_kernel_cta_template.cu:333-351).
//
// Triton TBE (TorchRec, torchrec/distributed/triton_tbe):
//   triton_tbe_backward_config.py:108  long_run_threshold = 256 (Blackwell)
//   SL < 256 -> short_run (one program, plain store); SL >= 256 -> cut into
//   ceil(SL / 256) sub-programs, partials accumulated, then applied by a second
//   kernel, or in the same launch (tlx.fence + countdown) when CLC is available and
//   the batch has more than 32 * 24576 * 256 = 201,326,592 lookups
//   (triton_table_batched_embeddings.py:4196-4199).
//
// The outcome column is the PyTorch post's own result (its Figure "Where the two
// implementations switch strategy" and the "Where Triton still loses" paragraph),
// not something measured here.
//
// The slider walks SL = 2^k, so every value is an exact integer and nothing calls
// a transcendental.

const KMAX = 21 // 2^21 = 2,097,152, past the post's "two-million-lookup run"

function fmt(n: number) {
  return n.toLocaleString("en-US")
}

function cudaKernel(sl: number, ctaCap: number) {
  if (sl < 32) return { name: "warp_per_row", detail: "one warp walks the run" }
  const ctas = Math.ceil(sl / ctaCap)
  if (ctas === 1) return { name: "cta_per_row", detail: "a whole block cooperates, syncs through shared memory" }
  return {
    name: "cta_per_row",
    detail: `${fmt(ctas)} blocks share the run: atomicAdd partials, threadfence, countdown`,
  }
}

function tritonKernel(sl: number) {
  if (sl < 256) return { name: "short_run", detail: "one program streams the run, plain store" }
  const subs = Math.ceil(sl / 256)
  return {
    name: "long_run",
    detail: `${fmt(subs)} sub-programs of up to 256 lookups, partials summed, one update`,
  }
}

function outcome(sl: number) {
  if (sl < 4) return { text: "below parity when a shard is all runs this short", tone: "rose" as const }
  if (sl < 32) return { text: "near parity", tone: "muted" as const }
  if (sl < 256) return { text: "Triton 1.76x (median, this band)", tone: "emerald" as const }
  return { text: "parity", tone: "muted" as const }
}

export function RunRouter() {
  const [k, setK] = useState(6) // SL = 64, inside the contested band
  const [b200Cap, setB200Cap] = useState(false)
  const sl = 2 ** k
  const ctaCap = b200Cap ? 4096 : 1024
  const cu = cudaKernel(sl, ctaCap)
  const tr = tritonKernel(sl)
  const oc = outcome(sl)

  // Band strip: positions are k / KMAX, so the strip is a log2 axis.
  const pct = (kk: number) => `${((kk / KMAX) * 100).toFixed(3)}%`

  return (
    <div className="my-8 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-3 text-sm font-medium">Who owns a run of length SL</div>

      <label className="flex items-center gap-3 text-xs">
        <span className="w-28 shrink-0 font-mono text-muted-foreground">SL = 2^{k}</span>
        <Range
          min={0}
          max={KMAX}
          step={1}
          value={k}
          onChange={(e) => setK(Number(e.currentTarget.value))}
          className="flex-1"
          aria-label="segment length, as a power of two"
        />
        <span className="w-24 shrink-0 text-right font-mono tabular-nums">{fmt(sl)}</span>
      </label>

      <div className="relative mt-4 h-14">
        <Band label="CUDA" from={0} to={5} total={KMAX} cls="bg-slate-400/30" text="warp" top />
        <Band label="" from={5} to={KMAX} total={KMAX} cls="bg-rose-400/30" text="cta_per_row from 32" top />
        <Band label="Triton" from={0} to={8} total={KMAX} cls="bg-emerald-400/30" text="short_run" />
        <Band label="" from={8} to={KMAX} total={KMAX} cls="bg-violet-400/30" text="long_run from 256" />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: pct(k) }}
          aria-hidden
        />
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10px] text-muted-foreground">
        {[
          [0, "1"],
          [5, "32"],
          [8, "256"],
          [KMAX, "2M"],
        ].map(([kk, t]) => (
          <span
            key={t}
            className="absolute -translate-x-1/2"
            style={{ left: pct(Number(kk)) }}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Pane title="CUDA TBE (FBGEMM)" name={cu.name} detail={cu.detail} />
        <Pane title="Triton TBE (TorchRec)" name={tr.name} detail={tr.detail} />
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] text-muted-foreground">Post&apos;s result in this band</div>
          <div
            className={cn(
              "mt-1 text-sm font-medium",
              oc.tone === "emerald" && "text-emerald-700 dark:text-emerald-400",
              oc.tone === "rose" && "text-rose-700 dark:text-rose-400"
            )}
          >
            {oc.text}
          </div>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={b200Cap}
          onChange={(e) => setB200Cap(e.currentTarget.checked)}
        />
        CUDA per-block cap 4,096 (the B200 feature gate) instead of 1,024
      </label>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        The two thresholds are 32 and 256, eight times apart. Between them CUDA pays for a
        cooperating block, with shared-memory reductions and barriers, on runs too short to
        amortize it, while Triton keeps one program per run. The post puts its median
        backward gain in that band at 1.76x and calls the band on either side near parity.
      </p>
    </div>
  )
}

function Band({
  label,
  from,
  to,
  total,
  cls,
  text,
  top,
}: {
  label: string
  from: number
  to: number
  total: number
  cls: string
  text: string
  top?: boolean
}) {
  return (
    <div
      className={cn(
        "absolute flex h-6 items-center overflow-hidden rounded-sm px-1 text-[10px] whitespace-nowrap",
        cls,
        top ? "top-0" : "bottom-0"
      )}
      style={{
        left: `${((from / total) * 100).toFixed(3)}%`,
        width: `${(((to - from) / total) * 100).toFixed(3)}%`,
      }}
    >
      {label ? <span className="mr-1 font-medium">{label}</span> : null}
      <span className="text-muted-foreground">{text}</span>
    </div>
  )
}

function Pane({ title, name, detail }: { title: string; name: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{title}</div>
      <div className="mt-1 font-mono text-sm">{name}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}
