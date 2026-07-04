"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Leanstral proves theorems the way a developer would — not with a bespoke prover
// scaffold, but by running the ordinary Mistral Vibe code-agent loop. Each turn: the
// model thinks, calls a tool (edit a file, `lake build`, query the Lean language
// server), reads the compiler/LSP feedback, and revises. It just keeps going —
// across millions of tokens and repeated context compaction — until the proof
// compiles and SafeVerify accepts it. This steps through one turn of that loop.

const ACCENT = "oklch(0.70 0.19 42)" // Mistral orange

const STEPS = [
  {
    key: "prompt",
    tag: "system + user",
    title: "the task enters the loop",
    body: "A theorem statement (or a repo with a missing proof) arrives in the same harness used for ordinary software work: “You are Mistral Vibe. Tools: bash, lean-lsp-mcp.” No prover-specific interface.",
    line: "-- prove: ∀ n, 0 ≤ n → n < n + 1",
  },
  {
    key: "think",
    tag: "assistant · think",
    title: "the model plans",
    body: "Inside a <think> block it decides what to do next — check the project builds, inspect what Mathlib already knows, sketch the proof term. This is reasoning, not search over a lemma pool.",
    line: "<think> check the goal, look for `Nat.lt_succ_self` … </think>",
  },
  {
    key: "tool",
    tag: "tool call",
    title: "it acts on the environment",
    body: "It edits a file, runs a shell command, or queries the Lean language server (goals, types, errors) through lean-lsp-mcp — low-latency feedback that a raw `lake build` can’t give.",
    line: "lean-lsp: goal? · edit Main.lean · lake build",
  },
  {
    key: "feedback",
    tag: "tool result",
    title: "Lean answers, honestly",
    body: "The compiler and LSP return the ground truth: open goals, a type mismatch, an unsolved side condition. This is the reward signal at train time and the guide at inference time — the same channel either way.",
    line: "error: unsolved goals ⊢ n < n + 1",
  },
  {
    key: "revise",
    tag: "assistant · edit",
    title: "revise, and keep going",
    body: "It rewrites the proof term and loops. On long proofs the context fills up, so it compacts — summarising progress and continuing. The AVL-tree proof ran 2.7M tokens across 22 compactions this way.",
    line: "exact Nat.lt_succ_self n   -- retry",
  },
  {
    key: "verify",
    tag: "SafeVerify",
    title: "verified, not just ‘compiled’",
    body: "Success isn’t “it ran” — SafeVerify checks the proof compiles, uses only standard Lean axioms (#print axioms), and took no shortcut like native_decide. Only then is the theorem closed.",
    line: "✓ compiles · ✓ axioms clean · ✓ no shortcuts",
  },
] as const

export function AgentLoop() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STEPS.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>the code-agent loop · think → act → read feedback → revise</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        {/* cyclic step chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((st, k) => (
            <span key={st.key} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setI(k)}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all", k === i ? "border-transparent text-background" : "text-muted-foreground hover:border-foreground/40")}
                style={k === i ? { background: ACCENT } : undefined}
              >
                {st.tag}
              </button>
              <span className="text-muted-foreground/40">{k === STEPS.length - 1 ? "↻" : "→"}</span>
            </span>
          ))}
        </div>

        {/* grid-stack all steps in one cell so the box is always as tall as the
            tallest step — the active one fades in, nothing below ever shifts */}
        <div className="mt-4 grid">
          {STEPS.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md border-l-2 bg-muted/30 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ borderLeftColor: ACCENT }}
            >
              <div className="font-mono text-[11px]" style={{ color: ACCENT }}>{k + 1}/{STEPS.length} · {st.tag}</div>
              <div className="mt-1 text-sm font-medium text-foreground">{st.title}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{st.body}</p>
              <div className="mt-2 overflow-x-auto rounded bg-foreground/5 px-2 py-1.5 font-mono text-[11px] text-foreground/80">{st.line}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The point: this is the <em>same</em> loop a human uses in Mistral Vibe, and the same loop the
          model was trained in. Test-time scaling is just running it longer — no conjecture pool, no
          parallel prover orchestration, no blueprint stage.
        </p>
      </div>
    </figure>
  )
}
