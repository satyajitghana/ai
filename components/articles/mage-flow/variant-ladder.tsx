"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One backbone, three rungs. Mage-Flow ships each task as a Base foundation,
// an RL-aligned model (Diffusion-NFT), and a 4-step Turbo (Decoupled-DMD +
// adversarial perceptual guidance). The step count — and the wall-clock at
// 1024² on one A100 — collapses down the ladder. Numbers: Mage-Flow report.

const ACCENT = "oklch(0.62 0.17 300)"

const TASKS = {
  generate: {
    label: "text → image",
    rungs: [
      { name: "Base", steps: 30, sec: null, how: "4B native-resolution foundation (rectified flow matching)" },
      { name: "RL-aligned", steps: 20, sec: 4.37, how: "Diffusion-NFT: prompt following, text rendering, aesthetics" },
      { name: "Turbo", steps: 4, sec: 0.59, how: "Decoupled-DMD + adversarial perceptual guidance" },
    ],
  },
  edit: {
    label: "instruction edit",
    rungs: [
      { name: "Base", steps: 30, sec: null, how: "same VAE + backbone, conditioned on source-image latents" },
      { name: "RL-aligned", steps: 30, sec: 10.55, how: "Diffusion-NFT for editing fidelity" },
      { name: "Turbo", steps: 4, sec: 1.02, how: "4-step distillation for interactive editing" },
    ],
  },
}

export function VariantLadder() {
  const [tk, setTk] = useState<keyof typeof TASKS>("generate")
  const task = TASKS[tk]
  const maxSteps = 30

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Base → RL → Turbo · steps and latency</span>
        <div className="flex gap-1">
          {(Object.keys(TASKS) as (keyof typeof TASKS)[]).map((k) => (
            <button key={k} type="button" onClick={() => setTk(k)} className={chip(tk === k)}>{TASKS[k].label}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {task.rungs.map((r) => (
            <div key={r.name} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm font-semibold" style={{ color: ACCENT }}>{r.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {r.sec != null ? <span className="text-foreground">{r.sec}s / 1024²</span> : "foundation"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-2.5 overflow-hidden rounded bg-muted/50" style={{ width: "160px" }}>
                  <span className="block h-full rounded" style={{ width: `${(r.steps / maxSteps) * 100}%`, background: ACCENT }} />
                </span>
                <span className="font-mono text-[11px] tabular-nums text-foreground">{r.steps} steps</span>
              </div>
              <div className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{r.how}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The distillation rung is what makes 4B <em>interactive</em>: a 30-step Base becomes a{" "}
          <span style={{ color: ACCENT }}>4-step Turbo</span>, and generation drops to{" "}
          <span className="text-foreground">{TASKS.generate.rungs[2].sec}s</span> an image — with peak memory
          still around 18 GB.
        </p>
      </div>
    </figure>
  )
}
