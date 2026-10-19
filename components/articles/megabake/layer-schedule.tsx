"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

// One SmolLM-135M decode layer inside MegaBake's persistent kernel: 60 CTAs
// (one per SM of the H200 MIG slice the repo measures on) walk the same phase
// table, and a grid barrier closes each interval.
//
// MEASURED on CPU (no GPU execution): I ran MegaBake's own planner at commit
// f70b54c over a 30-layer, KV-capacity-128 StatefulSmolLM decode graph with
// SelectionPolicy(mode="decode", table_launch=True, table_gemm_swap_ab=True)
// and 60 workers, then read each phase's work items, busy workers, barrier and
// recompute flags. These are the phases of a middle layer. Tile counts are the
// plan's; WHICH CTAs run them is schematic (the plan rotates the starting CTA
// per phase), only how many is real.
//
// GEMM tiles are swapAB: 64 weight rows per tile, so q/o/down (576 outputs)
// are 9 tiles, k/v (192) are 3, gate/up (1536) are 24. A "recompute" phase is a
// small producer that every CTA runs in full at the start of its consumer's
// interval instead of costing a barrier of its own.

type Work = { label: string; ctas: number; kind: "gemm" | "recompute" | "other" }
type Interval = { name: string; work: Work[] }

const FOLDED: Interval[] = [
  {
    name: "norm → Q, K, V",
    work: [
      { label: "residual add + RMSNorm", ctas: 60, kind: "recompute" },
      { label: "Q proj · 9 tiles", ctas: 9, kind: "gemm" },
      { label: "K proj · 3 tiles", ctas: 3, kind: "gemm" },
      { label: "V proj · 3 tiles", ctas: 3, kind: "gemm" },
    ],
  },
  {
    name: "RoPE",
    work: [
      { label: "RoPE on Q · 5 items", ctas: 5, kind: "other" },
      { label: "RoPE on K · 2 items", ctas: 2, kind: "other" },
    ],
  },
  { name: "attention", work: [{ label: "KV attention · 9 head rows", ctas: 9, kind: "other" }] },
  { name: "O proj", work: [{ label: "O proj · 9 tiles", ctas: 9, kind: "gemm" }] },
  {
    name: "norm → gate, up",
    work: [
      { label: "residual add + RMSNorm", ctas: 60, kind: "recompute" },
      { label: "gate proj · 24 tiles", ctas: 24, kind: "gemm" },
      { label: "up proj · 24 tiles", ctas: 24, kind: "gemm" },
    ],
  },
  {
    name: "SiLU·mul → down",
    work: [
      { label: "SiLU × up", ctas: 60, kind: "recompute" },
      { label: "down proj · 9 tiles", ctas: 9, kind: "gemm" },
    ],
  },
]

const UNFOLDED: Interval[] = [
  { name: "residual add", work: [{ label: "residual add · 5 items", ctas: 5, kind: "other" }] },
  { name: "RMSNorm", work: [{ label: "RMSNorm · 1 row", ctas: 1, kind: "other" }] },
  {
    name: "Q, K, V",
    work: [
      { label: "Q proj · 9 tiles", ctas: 9, kind: "gemm" },
      { label: "K proj · 3 tiles", ctas: 3, kind: "gemm" },
      { label: "V proj · 3 tiles", ctas: 3, kind: "gemm" },
    ],
  },
  FOLDED[1],
  FOLDED[2],
  FOLDED[3],
  { name: "residual add", work: [{ label: "residual add · 5 items", ctas: 5, kind: "other" }] },
  { name: "RMSNorm", work: [{ label: "RMSNorm · 1 row", ctas: 1, kind: "other" }] },
  {
    name: "gate, up",
    work: [
      { label: "gate proj · 24 tiles", ctas: 24, kind: "gemm" },
      { label: "up proj · 24 tiles", ctas: 24, kind: "gemm" },
    ],
  },
  { name: "SiLU × up", work: [{ label: "SiLU × up · 12 items", ctas: 12, kind: "other" }] },
  { name: "down proj", work: [{ label: "down proj · 9 tiles", ctas: 9, kind: "gemm" }] },
]

const CTAS = 60

const KIND_CLASS: Record<Work["kind"], string> = {
  gemm: "bg-amber-500/85 dark:bg-amber-400/80",
  recompute: "bg-sky-500/70 dark:bg-sky-400/60",
  other: "bg-emerald-500/75 dark:bg-emerald-400/70",
}

// Distributed work fills CTAs left to right; recompute runs on every CTA first.
function cells(iv: Interval): (Work["kind"] | "idle" | "both")[] {
  const out: (Work["kind"] | "idle" | "both")[] = Array.from({ length: CTAS }, () => "idle")
  const recompute = iv.work.some((w) => w.kind === "recompute")
  let next = 0
  for (const w of iv.work) {
    if (w.kind === "recompute") continue
    for (let i = 0; i < w.ctas && next < CTAS; i++) out[next++] = w.kind
  }
  if (recompute) return out.map((c) => (c === "idle" ? "recompute" : "both"))
  return out
}

function busyCount(iv: Interval) {
  let n = 0
  for (const w of iv.work) if (w.kind !== "recompute") n += w.ctas
  return Math.min(n, CTAS)
}

export function LayerSchedule() {
  const [folded, setFolded] = useState(true)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const plan = folded ? FOLDED : UNFOLDED
  const at = step % plan.length
  const iv = plan[at]
  const grid = cells(iv)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setStep((s) => s + 1), 1100)
    return () => window.clearInterval(id)
  }, [playing])

  const totalBarriers = folded ? 183 : 333

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one SmolLM-135M decode layer · 60 CTAs · one persistent kernel
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">tile counts from the planner, run on CPU</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[true, false].map((f) => (
            <button
              key={String(f)}
              type="button"
              onClick={() => {
                setFolded(f)
                setStep(0)
              }}
              aria-pressed={folded === f}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                folded === f ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {f ? "folded · 6 intervals" : "unfolded · 11 intervals"}
            </button>
          ))}
          <span className="mx-1 h-4 border-l" />
          <button
            type="button"
            onClick={() => setStep((s) => (s + plan.length - 1) % plan.length)}
            className="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:bg-foreground/[0.04]"
            aria-label="Previous interval"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:bg-foreground/[0.04]"
          >
            {playing ? "pause" : "play"}
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) % plan.length)}
            className="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:bg-foreground/[0.04]"
            aria-label="Next interval"
          >
            ▶
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1" aria-hidden>
          {plan.map((p, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i === at ? "bg-foreground/70" : i < at ? "bg-foreground/30" : "bg-foreground/10"
              )}
              title={p.name}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px]">
          <span>
            interval {at + 1} of {plan.length}: <span className="font-semibold">{iv.name}</span>
          </span>
          <span className="tabular-nums text-muted-foreground">
            {busyCount(iv)} of {CTAS} CTAs on distributed work
          </span>
        </div>

        <div className="mt-2 grid grid-cols-12 gap-1 sm:grid-cols-[repeat(20,minmax(0,1fr))]">
          {grid.map((c, i) => (
            <div
              key={i}
              className={cn(
                "relative aspect-square rounded-[3px] border border-foreground/10 transition-colors duration-300",
                c === "idle" ? "bg-foreground/[0.04]" : c === "both" ? KIND_CLASS.recompute : KIND_CLASS[c]
              )}
            >
              {c === "both" && (
                <div className="absolute inset-[22%] rounded-[2px] bg-amber-500/90 dark:bg-amber-400/85" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex h-3 items-center gap-2">
          <div className="h-0 flex-1 border-t-2 border-dashed border-foreground/60" />
          <span className="font-mono text-[10px] text-muted-foreground">grid barrier</span>
        </div>

        <ul className="mt-3 space-y-1 font-mono text-[11px]">
          {iv.work.map((w, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-[2px]", KIND_CLASS[w.kind])} />
              <span>{w.label}</span>
              <span className="text-muted-foreground">
                {w.kind === "recompute" ? "· every CTA, whole thing" : `· ${w.ctas} CTA${w.ctas === 1 ? "" : "s"}`}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Amber: a GEMM tile, 64 weight rows each. Blue: a small producer that every CTA recomputes so it
          needs no barrier of its own. Green: other distributed work. Across all 30 layers plus the
          embedding and the vocabulary projection, the planner emits 633 phases and {totalBarriers} grid
          barriers {folded ? "with folding (333 without)" : "without folding (183 with)"}. Which cells
          light is schematic; how many is the plan&rsquo;s.
        </p>
      </div>
    </figure>
  )
}
