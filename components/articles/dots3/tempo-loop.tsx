"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// TEMPO — Test-time-scaled Value Estimation with Macro-step Policy Optimization.
//
// The problem the dots team states: a single agent rollout on their tasks can
// take more than ten hours, and rewards are sparse, so value-free RL is both
// slow and bad at credit assignment. Actor-critic fixes credit assignment, but
// "a critic estimates value through a fixed-compute forward pass. Unlike an
// actor, it cannot reason, reflect, or use tools to analyze the current state."
//
// TEMPO's move: cut the task into macro-steps; at the end of each, the SAME
// agent switches from actor to critic and spends test-time compute reasoning
// about expected remaining return. The policy can then be updated before the
// task finishes.
//
// Reported on ARC-AGI-3: +31.5% average score over the base checkpoint and
// +20.6% over GRPO.

type Step = {
  id: string
  label: string
  role: "actor" | "critic" | "update"
  what: string
}

const STEPS: Step[] = [
  { id: "m1", label: "macro-step 1", role: "actor", what: "Several rounds of interaction between the model and the environment. This is ordinary agent rollout — act, observe, act again." },
  { id: "c1", label: "self-evaluate", role: "critic", what: "The same agent switches role. It reads its own trajectory and uses test-time-scaled reasoning — not a single forward pass — to estimate the expected remaining return from the current state." },
  { id: "u1", label: "policy update", role: "update", what: "Because a value estimate now exists mid-task, the policy can be updated here rather than waiting ten-plus hours for a terminal reward." },
  { id: "m2", label: "macro-step 2", role: "actor", what: "Continue from the updated policy. The loop repeats for as many macro-steps as the task takes." },
  { id: "c2", label: "self-evaluate", role: "critic", what: "The dots team's finding is that this role is easier than acting: even when the agent cannot solve a problem, it can tell two superficially identical states apart and score them differently." },
]

const ROLE_COLOR: Record<string, string> = {
  actor: "oklch(0.60 0.15 255)",
  critic: "oklch(0.68 0.13 85)",
  update: "oklch(0.55 0.16 155)",
}

const RESULTS = [
  { name: "TEMPO", rel: 31.5, c: "oklch(0.55 0.16 155)" },
  { name: "GRPO", rel: 10.9, c: "oklch(0.62 0.03 250)" },
  { name: "base checkpoint", rel: 0, c: "oklch(0.62 0.03 250)" },
]

export function TempoLoop() {
  const [sel, setSel] = useState(1)
  const s = STEPS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">TEMPO · actor and critic are the same model</span>
        <span className="font-mono text-[10px] text-muted-foreground">rollouts &gt; 10 hours</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1">
          {STEPS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-left transition-colors",
                i === sel ? "border-foreground/40 bg-muted/40" : "border-transparent bg-muted/15 hover:bg-muted/25",
              )}
              style={{ minWidth: "6.5rem" }}
            >
              <span
                className="mb-1 block h-1 w-full rounded-sm"
                style={{ background: ROLE_COLOR[x.role] }}
              />
              <span className="block truncate font-mono text-[10px] text-foreground">{x.label}</span>
              <span className="block font-mono text-[9px] text-muted-foreground">{x.role}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: ROLE_COLOR[s.role] }}>
            {s.label} · {s.role}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{s.what}</div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            ARC-AGI-3 average score, relative to the base checkpoint
          </div>
          <div className="mt-2 space-y-1.5">
            {RESULTS.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                  {r.name}
                </span>
                <div className="h-3.5 flex-1 rounded-sm bg-muted/40">
                  <div className="h-3.5 rounded-sm" style={{ width: `${(r.rel / 35) * 100}%`, background: r.c }} />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {r.rel > 0 ? `+${r.rel}%` : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 font-mono text-[9px] leading-4 text-muted-foreground">
            dots reports TEMPO +31.5% over the base checkpoint and +20.6% over GRPO; GRPO&rsquo;s own margin over the
            base is the difference those two imply, not a separately published figure.
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The insight is narrow and load-bearing. A PPO-style critic is a fixed-compute forward pass, so on a task
          hard enough to need ten hours of acting, it cannot think hard enough to say whether things are going well.
          TEMPO makes the critic the same model wearing a different hat, and lets it spend real inference on the
          question. That turns &ldquo;how am I doing?&rdquo; from a cheap regression into a reasoning task — and the
          dots team&rsquo;s claim is that this direction is the easy one:{" "}
          <span className="text-foreground">evaluation is easier than generation</span>.
        </p>
      </div>
    </figure>
  )
}
