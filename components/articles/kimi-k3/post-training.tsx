"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// K3's post-training is a three-stage funnel that is unusual enough to be worth
// drawing: SFT cold-start → RL trains NINE separate experts (3 domains × 3
// reasoning-effort levels) → Multi-Teacher On-Policy Distillation collapses all
// nine back into one shipped model. Click a cell to see what that expert covers.
// Structure and scope from the tech report §4.1.

const ACCENT = "oklch(0.58 0.15 265)"

const DOMAINS = [
  {
    key: "general",
    label: "general tasks",
    covers: "general experience, vision, reasoning, faithfulness, search, knowledge work",
  },
  {
    key: "agents",
    label: "general agents",
    covers: "long-horizon assistant tasks, deep research, paragraph-level writing",
  },
  {
    key: "coding",
    label: "coding agents",
    covers: "software engineering, coding experience, GPU kernel tasks, web development",
  },
] as const

const EFFORTS = ["low", "high", "max"] as const

type DomainKey = (typeof DOMAINS)[number]["key"]
type Effort = (typeof EFFORTS)[number]

export function PostTraining() {
  const [sel, setSel] = useState<{ d: DomainKey; e: Effort }>({ d: "coding", e: "max" })

  const domain = DOMAINS.find((d) => d.key === sel.d)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        post-training · sft &rarr; 9 experts &rarr; multi-teacher distillation
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          {/* stage 1 — SFT */}
          <div className="rounded-lg border bg-muted/25 px-3 py-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">stage 1</div>
            <div className="mt-1 font-mono text-xs font-medium text-foreground">SFT</div>
            <div className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">
              cold-start policy
              <br />
              MXFP4 QAT begins
            </div>
          </div>

          {/* stage 2 — the 3x3 expert grid */}
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                stage 2 · RL
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">3 domains × 3 efforts = 9 experts</span>
            </div>

            <div className="grid grid-cols-[minmax(0,6.5rem)_repeat(3,1fr)] gap-1.5">
              <div />
              {EFFORTS.map((e) => (
                <div key={e} className="text-center font-mono text-[10px] text-muted-foreground">
                  {e}
                </div>
              ))}
              {DOMAINS.map((d) => (
                <div key={d.key} className="contents">
                  <div className="flex items-center truncate font-mono text-[10px] text-muted-foreground">
                    {d.label}
                  </div>
                  {EFFORTS.map((e) => {
                    const on = sel.d === d.key && sel.e === e
                    return (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setSel({ d: d.key, e })}
                        aria-pressed={on}
                        className={cn(
                          "h-8 cursor-pointer rounded-md border font-mono text-[10px] transition-all",
                          on
                            ? "border-transparent font-medium text-white shadow-sm"
                            : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                        )}
                        style={on ? { background: ACCENT } : undefined}
                      >
                        {d.key.slice(0, 4)}·{e}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* stage 3 — MOPD */}
          <div className="rounded-lg border px-3 py-3 text-center" style={{ borderColor: ACCENT }}>
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">stage 3</div>
            <div className="mt-1 font-mono text-xs font-medium" style={{ color: ACCENT }}>
              MOPD
            </div>
            <div className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">
              9 teachers &rarr; 1
              <br />
              shipped model
            </div>
          </div>
        </div>

        {/* selected-expert readout */}
        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]">
            <span style={{ color: ACCENT }}>
              {domain.label} · {sel.e} effort
            </span>
            <span className="text-muted-foreground"> — {domain.covers}</span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Most labs train one RL policy and ship it. K3 trains <span className="text-foreground">nine</span>{" "}— one per
          (domain × reasoning-effort) cell — then uses{" "}
          <span style={{ color: ACCENT }}>Multi-Teacher On-Policy Distillation</span>{" "}to fold them back into a single
          model, with the matching expert supervising each sampled effort level. The effort axis is trained by a
          per-problem token budget: exceed <em>τ</em> × the budget and the task reward is overridden to &minus;1, then{" "}
          <em>τ</em>{" "}is annealed down to produce the high- and low-effort variants from the max-effort one. That is why
          one checkpoint can be told to think cheaply or expensively and behave coherently at both ends.
        </p>
      </div>
    </figure>
  )
}
