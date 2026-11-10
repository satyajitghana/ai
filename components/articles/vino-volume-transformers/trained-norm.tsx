"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Token norm per occupancy bin before and after a short training run, for the
// three pooling rules. Pointcept demo room (sample1), 2 cm voxels, P = 5,
// 12,092 tokens, RGB + normal features. Tokenizer = Linear(750 -> 384) at
// Volt's init (trunc normal 0.02, zero bias, seed 1), bias added after the
// division. Head = LayerNorm, Linear 384->384, GELU, Linear to the task.
// AdamW lr 1e-3, wd 0.05, 300 full-batch steps on a random half of the tokens,
// 2 CPU threads, PyTorch 2.14.1. "semantic" = majority ScanNet-20 label of the
// token (held-out accuracy); "recon" = every occupied voxel's RGB + normal
// (held-out MSE). My own script, not VINO's training.

const BINS = ["1", "2-3", "4-7", "8-15", "16-31", "32+"]

type Run = { init: number[]; trained: number[]; s0: number; s1: number; metric: string }

const DATA: Record<"semantic" | "recon", Record<"sum" | "mean" | "sqrt", Run>> = {
  semantic: {
    sum: { init: [0.553, 0.859, 1.276, 1.834, 2.502, 3.544], trained: [0.583, 0.935, 1.484, 2.699, 3.659, 4.791], s0: 0.5, s1: 0.61, metric: "62.8% held-out accuracy" },
    mean: { init: [0.553, 0.353, 0.243, 0.156, 0.118, 0.091], trained: [0.576, 0.398, 0.3, 0.249, 0.2, 0.15], s0: -0.5, s1: -0.33, metric: "63.1% held-out accuracy" },
    sqrt: { init: [0.553, 0.548, 0.554, 0.532, 0.541, 0.566], trained: [0.579, 0.605, 0.652, 0.784, 0.801, 0.771], s0: 0.0, s1: 0.11, metric: "63.0% held-out accuracy" },
  },
  recon: {
    sum: { init: [0.553, 0.859, 1.276, 1.834, 2.502, 3.544], trained: [0.842, 1.217, 1.761, 2.662, 3.495, 4.402], s0: 0.5, s1: 0.47, metric: "MSE 0.0326 held out" },
    mean: { init: [0.553, 0.353, 0.243, 0.156, 0.118, 0.091], trained: [0.874, 0.556, 0.373, 0.236, 0.177, 0.126], s0: -0.5, s1: -0.53, metric: "MSE 0.0291 held out" },
    sqrt: { init: [0.553, 0.548, 0.554, 0.532, 0.541, 0.566], trained: [0.83, 0.805, 0.782, 0.754, 0.731, 0.674], s0: 0.0, s1: -0.05, metric: "MSE 0.0344 held out" },
  },
}

const TASKS = [
  { id: "semantic", label: "train on labels" },
  { id: "recon", label: "train to reconstruct voxels" },
] as const
const RULES = [
  { id: "sum", label: "sum (Volt)" },
  { id: "mean", label: "÷ n (VINO)" },
  { id: "sqrt", label: "÷ √n (control)" },
] as const

const W = 640
const H = 200
const L = 16
const R = 16
const T = 18
const B = 26
const bw = (W - L - R) / BINS.length

const sgn = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`

function Toggle<K extends string>({
  opts,
  value,
  set,
}: {
  opts: readonly { id: K; label: string }[]
  value: K
  set: (k: K) => void
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5 font-mono text-[11px]">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => set(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "cursor-pointer rounded-md border px-2 py-0.5 transition-colors",
            value === o.id ? "border-foreground/40 bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TrainedNorm() {
  const [task, setTask] = useState<"semantic" | "recon">("semantic")
  const [rule, setRule] = useState<"sum" | "mean" | "sqrt">("mean")
  const d = DATA[task][rule]
  const top = Math.max(...d.init, ...d.trained) * 1.15
  const Y = (x: number) => T + (1 - x / top) * (H - T - B)
  const half = (bw - 18) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>token norm vs occupied slots, before and after 300 training steps · measured</span>
      </div>
      <div className="p-3 sm:p-4">
        <Toggle opts={RULES} value={rule} set={setRule} />
        <Toggle opts={TASKS} value={task} set={setTask} />
        <div className="mb-1 flex gap-4 font-mono text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-muted-foreground/40" />
            at init
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: "oklch(0.6 0.14 300)" }} />
            after training
          </span>
        </div>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[520px]"
            role="img"
            aria-label={`Mean token norm per occupancy bin, ${rule} pooling, ${task} task. Init: ${d.init.join(", ")}. Trained: ${d.trained.join(", ")}. Slope ${d.s0} to ${d.s1}.`}
          >
            <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="currentColor" className="text-border" />
            {BINS.map((b, i) => {
              const x0 = L + i * bw + 9
              return (
                <g key={b}>
                  <rect x={x0} y={Y(d.init[i])} width={half} height={H - B - Y(d.init[i])} rx={2} className="fill-muted-foreground/40" />
                  <rect
                    x={x0 + half}
                    y={Y(d.trained[i])}
                    width={half}
                    height={H - B - Y(d.trained[i])}
                    rx={2}
                    fill="oklch(0.6 0.14 300)"
                    fillOpacity={0.85}
                  />
                  <text x={x0 + half * 1.5} y={Y(d.trained[i]) - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>
                    {d.trained[i].toFixed(2)}
                  </text>
                  <text x={x0 + half} y={H - B + 15} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
                    {b} of 125
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="mt-2 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">log-log slope, init</div>
            <div className="text-foreground">{sgn(d.s0)}</div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">log-log slope, trained</div>
            <div className="text-foreground">{sgn(d.s1)}</div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">task result</div>
            <div className="text-foreground">{d.metric}</div>
          </div>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          Only the tokenizer and a small head train, for 300 steps on one room, so this tests whether learning alone
          flattens the trend, not what VINO&apos;s 200,000 steps do. The head starts with a LayerNorm, so the task
          never rewards or punishes a token&apos;s norm directly.
        </p>
      </div>
    </figure>
  )
}
