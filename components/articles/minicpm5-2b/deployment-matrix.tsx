"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two independent primary sources, kept separate rather than blended.
//
// Throughput numbers: docs.sglang.io's day-0 SGLang cookbook for
// OpenBMB/MiniCPM5-2B, its own published benchmark entries -- random
// isl=1024/osl=1024 workload, single-GPU. The page does not label whether
// DSpark speculative decoding was active for these specific runs, so this
// component doesn't claim it either way (see the article text).
//
// Chip badges: the README's own FlagOS section -- "MiniCPM5-2B was adapted
// to 9 different AI chips" via FlagRelease, table of ModelScope/HuggingFace
// links, one row per vendor.

type Hw = "rtx5090" | "dgxspark"

const HW: Record<Hw, { label: string; sub: string; single: { ttft: number; tpot: number; tps: number }; batch: { n: number; ttft: number; tpot: number; tps: number } }> = {
  rtx5090: {
    label: "RTX 5090",
    sub: "32 GB, consumer desktop GPU",
    single: { ttft: 34, tpot: 4.0, tps: 496 },
    batch: { n: 128, ttft: 34, tpot: 11.8, tps: 19280 },
  },
  dgxspark: {
    label: "DGX Spark",
    sub: "128 GB unified memory, desktop AI computer",
    single: { ttft: 85, tpot: 27.7, tps: 72 },
    batch: { n: 64, ttft: 1373, tpot: 42.9, tps: 2892 },
  },
}

const CHIPS = ["Nvidia", "Hygon", "Metax", "Iluvatar", "Zhenwu", "Mthreads", "Kunlunxin", "Ascend", "ARM-v9"]

const ACCENT = "oklch(0.55 0.16 155)"

export function DeploymentMatrix() {
  const [hw, setHw] = useState<Hw>("rtx5090")
  const [mode, setMode] = useState<"single" | "batch">("single")
  const cfg = HW[hw]
  const stats = mode === "single" ? cfg.single : cfg.batch

  const maxTps = 20000
  const barW = Math.min(100, (stats.tps / maxTps) * 100)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">SGLang day-0 cookbook throughput + FlagOS chip breadth</span>
        <span className="font-mono text-[10px] text-muted-foreground">random isl=1024/osl=1024, 1 GPU</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(HW) as Hw[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setHw(k)}
              aria-pressed={hw === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                hw === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {HW[k].label}
            </button>
          ))}
          <span className="mx-1 self-center h-4 w-px bg-border" />
          {(["single", "batch"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "single" ? "bs=1, single user" : `concurrency=${cfg.batch.n}`}
            </button>
          ))}
        </div>

        <div className="mt-3 font-mono text-[10px] text-muted-foreground">{cfg.sub}</div>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[9.5px] text-muted-foreground">decode tok/s/GPU</span>
            <div className="h-5 flex-1 rounded bg-muted/20">
              <div className="h-5 rounded" style={{ width: `${barW}%`, background: ACCENT, opacity: 0.85 }} />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[10.5px] tabular-nums" style={{ color: ACCENT }}>
              {stats.tps.toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-lg border bg-muted/20 px-2.5 py-1.5">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">time to first token</div>
              <div className="font-mono text-xs tabular-nums text-foreground">{stats.ttft.toLocaleString()} ms</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-2.5 py-1.5">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">time per output token</div>
              <div className="font-mono text-xs tabular-nums text-foreground">{stats.tpot.toFixed(1)} ms</div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="font-mono text-[10px] text-muted-foreground">
            FlagOS: adapted to <span className="text-foreground">9</span> AI chip architectures, released on FlagRelease
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CHIPS.map((c) => (
              <span key={c} className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-foreground">
                {c}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two measured points anchor opposite ends of &ldquo;day-0 deployment&rdquo;: a{" "}
          <span className="text-foreground">RTX 5090</span> desktop card single-streams 496 tok/s
          and holds 19,280 tok/s aggregate at 128-way concurrency, while a{" "}
          <span className="text-foreground">DGX Spark</span> — built for unified-memory capacity
          over raw bandwidth — single-streams a much slower 72 tok/s but still clears nearly 2,900
          tok/s aggregate once batched. Neither table says whether DSpark speculative decoding was
          switched on for these specific runs, so treat 496 tok/s as a same-day SGLang measurement,
          not confirmation of any particular DSpark-enabled number. The <span className="text-foreground">FlagOS</span>{" "}
          row is a different kind of claim entirely — not speed, but breadth: the same weights,
          adapted and shipped across 9 unrelated chip architectures without a MiniCPM5-specific
          fork, which is what &ldquo;standard <code>LlamaForCausalLM</code>&rdquo; buys in practice.
        </p>
      </div>
    </figure>
  )
}
