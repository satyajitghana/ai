"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 2's ablation, made explorable. Same Qwen2.5-7B-Instruct policy and
// GRPO recipe throughout — only the memory wiring changes between the 8 rows
// the paper reports. These are the paper's MEASURED success rates, not toy
// numbers; only the layout/interaction is original.
//
// SSR-safe: static data table, one integer toggle, no timers/randomness.

const ACC = "oklch(0.72 0.15 195)"
const REF = "oklch(0.62 0.16 60)" // RL-only reference line

type Row = { id: string; label: string; alf: number; web: number; note: string }

const ROWS: Row[] = [
  { id: "base", label: "Base Model", alf: 14.5, web: 7.8, note: "Untrained Qwen2.5-7B-Instruct. No RL, no memory." },
  { id: "cold", label: "Cold Start Model", alf: 7.6, web: 17.6, note: "SFT-only warm-start that teaches the retrieval/reconstruction protocol format — not the task itself." },
  { id: "rl", label: "RL Only (GRPO)", alf: 76.4, web: 66.1, note: "GRPO training with no memory at all, at training or test time. The reference line below." },
  { id: "raw", label: "RL + Raw Memory", alf: 70.1, web: 72.6, note: "Retrieved memory injected verbatim (the “replay” baseline). Hurts ALFWorld, helps WebShop — memory alone is not uniformly bad." },
  { id: "full", label: "MemHarness (Full)", alf: 85.2, web: 75.6, note: "Memory retrieved, then reconstructed by the same trained policy before acting." },
  { id: "generic", label: "– generic LLM reconstruction", alf: 77.7, web: 71.8, note: "Reconstruction handed to an untrained, off-the-shelf Qwen2.5-7B-Instruct instead of the RL-tuned policy." },
  { id: "worecon", label: "– w/o reconstruction", alf: 79.6, web: 74.6, note: "Same trained policy, but the reconstruction stage is skipped at test time — retrieved memory goes straight into the action context." },
  { id: "womem", label: "– w/o memory", alf: 83.0, web: 73.6, note: "Same trained policy, but memory retrieval is withheld entirely at test time." },
]

const REL_ALF = 76.4 // RL Only, ALFWorld
const REL_WEB = 66.1 // RL Only, WebShop
const MAXV = 100

function Bar({ value, refValue, label }: { value: number; refValue: number; label: string }) {
  const pct = Math.min((value / MAXV) * 100, 100)
  const refPct = Math.min((refValue / MAXV) * 100, 100)
  const delta = value - refValue
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">{value.toFixed(1)}%</span>{" "}
          <span style={{ color: delta === 0 ? "var(--muted-foreground)" : delta > 0 ? ACC : REF }}>
            {delta === 0 ? "· reference" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} vs RL-only`}
          </span>
        </span>
      </div>
      <div className="relative mt-1 h-5 rounded bg-muted/40">
        {/* RL-only reference tick */}
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${refPct}%`, background: REF, opacity: 0.6 }} />
        <div
          className="absolute top-0 left-0 h-full rounded transition-all duration-300"
          style={{ width: `${pct}%`, background: ACC, opacity: 0.85 }}
        />
      </div>
    </div>
  )
}

export function AblationExplorer() {
  const [i, setI] = useState(2) // default: RL Only, the reference point
  const r = ROWS[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>ablation explorer · same policy, different memory wiring</span>
        <span className="text-muted-foreground/50">Table 2, measured</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {ROWS.map((row, idx) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setI(idx)}
              aria-pressed={i === idx}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-left font-mono text-[10px] transition-colors",
                i === idx ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={i === idx ? { background: ACC } : undefined}
            >
              {row.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          <Bar value={r.alf} refValue={REL_ALF} label="ALFWorld · Avg. SR" />
          <Bar value={r.web} refValue={REL_WEB} label="WebShop · Avg. SR" />
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">{r.label}.</span> {r.note}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The{" "}
          <span style={{ color: REF }}>
            reference tick
          </span>{" "}
          marks RL-only, no memory at all. Raw verbatim replay (RL + Raw Memory) sits{" "}
          <span className="text-foreground">below</span>{" "}that line on ALFWorld — memory hurt more than it helped until it was reconstructed. Withholding memory at test time after reconstruction-aware training (
          <span className="text-foreground">w/o memory</span>) still beats RL-only on both benchmarks, which is the paper&rsquo;s
          case that the reconstruction objective sharpens the policy&rsquo;s own reasoning, not just its memory use.
        </p>
      </div>
    </figure>
  )
}
