"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The precise inventory behind the "fully open" claim: pick a stage and see
// exactly what shipped for it (weights, code, config, data recipe — all four,
// every stage) plus what that stage actually trained on. The gaps at the
// bottom are constant across every stage, not stage-specific, which is the
// point: they're withheld everywhere, not just somewhere.

type Stage = {
  n: number
  name: string
  ckpt: string
  data: string
  note: string
}

const STAGES: Stage[] = [
  {
    n: 1,
    name: "Pretrain",
    ckpt: "Instella-MoE-16B-A3B-Pretrain",
    data: "7.1T tokens — Nemotron-CC-v2 web, Nemotron-CC-Math/MegaMath/FineMath, RefineCode + Nemotron-Pretraining-Code-v1, TxT360 (arXiv, PubMed, S2ORC, Wikipedia, …)",
    note: "from scratch",
  },
  {
    n: 2,
    name: "Mid-train",
    ckpt: "Instella-MoE-16B-A3B-Midtrain",
    data: "3 Dolma3 Dolmino ~100B-token variants (differing STEM/reasoning weighting), merged into one checkpoint by weight-averaging",
    note: "3 runs → 1 merge",
  },
  {
    n: 3,
    name: "Long-context",
    ckpt: "Instella-MoE-16B-A3B-Base",
    data: "~100B tokens (Dolma3 Longmino) then 37.32B annealing tokens (math/code/reasoning) — 4K → 64K via YaRN + document masking",
    note: "final base checkpoint",
  },
  {
    n: 4,
    name: "SFT",
    ckpt: "Instella-MoE-16B-A3B-SFT",
    data: "~2.9M general/math/code/science records, then 512K examples curated by a judge model against the phase-1 checkpoint's own weaknesses",
    note: "2-phase curriculum",
  },
  {
    n: 5,
    name: "DPO",
    ckpt: "Instella-MoE-16B-A3B-DPO",
    data: "Dolci-Think-DPO-7B preference pairs — router-bias updates and the aux load-balancing loss disabled for MoE training stability",
    note: "preference tuning",
  },
  {
    n: 6,
    name: "Think (RL)",
    ckpt: "Instella-MoE-16B-A3B-Think",
    data: "Dolci-Think-RL-7B IF-RLVR (GRPO/DAPO, 1,400 steps) → Multi-Teacher On-Policy Distillation against the IF-RL and DPO checkpoints",
    note: "final shipped model",
  },
]

const RELEASED = ["weights", "training code", "config", "data recipe"]
const WITHHELD = ["training compute / cluster size", "wall-clock training time", "technical report"]

export function OpennessInventory() {
  const [sel, setSel] = useState(2) // default to the Base checkpoint

  const stage = STAGES[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>openness inventory · 6 checkpoints, one pipeline</span>
        <span className="text-muted-foreground/50">amd/instella-moe</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* stage selector */}
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s, i) => (
            <button
              key={s.n}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors",
                sel === i
                  ? "border-foreground/40 bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="opacity-70">{s.n}</span> {s.name}
            </button>
          ))}
        </div>

        {/* selected stage detail */}
        <div className="mt-3 rounded-lg border bg-background/60 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-foreground">{stage.ckpt}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{stage.note}</span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{stage.data}</p>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {RELEASED.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 font-mono text-[10px] text-foreground">
                <span aria-hidden className="text-emerald-600 dark:text-emerald-400">✓</span> {r}
              </span>
            ))}
          </div>
        </div>

        {/* constant gaps, every stage */}
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2.5">
          {WITHHELD.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span aria-hidden>✗</span> {w}
            </span>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Click through the six stages: every one ships its own weights, training code, YAML
          config, and named data mixture — not just the final <span className="font-mono">Think</span>{" "}
          checkpoint. That is what separates it from an &ldquo;open-weight&rdquo; release, where only
          the last set of weights comes out. The gaps at the bottom do not move between stages —
          compute, cluster size, and wall-clock time are withheld everywhere, and the technical
          report is still &ldquo;coming soon.&rdquo;
        </p>
      </div>
    </figure>
  )
}
