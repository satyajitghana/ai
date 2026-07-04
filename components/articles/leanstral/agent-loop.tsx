"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Leanstral proves theorems the way a developer would — not with a bespoke prover
// scaffold, but by running the ordinary Mistral Vibe code-agent loop. Each turn: the
// model thinks, calls a tool (edit a file, `lake build`, query the Lean language
// server), reads the compiler/LSP feedback, and revises. It just keeps going —
// across millions of tokens and repeated context compaction — until the proof
// compiles and SafeVerify accepts it. Drawn as the loop it is; step through one turn.

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

// scene geometry (viewBox units)
const W = 760
const H = 176
const NW = 104
const NH = 46
const ML = 22
const GAP = (W - 2 * ML - STEPS.length * NW) / (STEPS.length - 1)
const ROWY = 40 // node top
const nx = (i: number) => ML + i * (NW + GAP)
const ncx = (i: number) => nx(i) + NW / 2

export function AgentLoop() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STEPS.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  const rowBottom = ROWY + NH

  // forward connector between adjacent nodes
  const fwd = (a: number, b: number) => {
    const x1 = nx(a) + NW, x2 = nx(b)
    const y = ROWY + NH / 2
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y} C ${mx} ${y}, ${mx} ${y}, ${x2} ${y}`
  }
  // the loop-back arc: revise (4) → think (1), dipping below the row
  const dip = 132
  const loop = `M ${ncx(4)} ${rowBottom} C ${ncx(4)} ${dip}, ${ncx(1)} ${dip}, ${ncx(1)} ${rowBottom}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the code-agent loop · think → act → read feedback → revise</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Code-agent loop, step ${i + 1} of ${STEPS.length}: ${STEPS[i].tag}`}>
          <defs>
            <marker id="lsal-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="lsal-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* forward connectors */}
          {STEPS.slice(1).map((_, idx) => (
            <path key={idx} d={fwd(idx, idx + 1)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#lsal-arrow)" opacity={idx + 1 <= i ? 0.9 : 0.45} className="transition-opacity duration-300" />
          ))}

          {/* loop-back arc (revise → think) */}
          <path d={loop} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4 4" markerEnd="url(#lsal-arrow)" opacity={0.6} />
          <text x={(ncx(1) + ncx(4)) / 2} y={dip - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>doesn&apos;t compile yet → revise &amp; keep going</text>

          {/* nodes */}
          {STEPS.map((s, k) => {
            const active = k === i
            const done = k <= i
            return (
              <g key={s.key} onClick={() => { setPlaying(false); setI(k) }} className="cursor-pointer" role="button" aria-pressed={active}>
                <rect
                  x={nx(k)}
                  y={ROWY}
                  width={NW}
                  height={NH}
                  rx={9}
                  fill="var(--background)"
                  stroke={done ? ACCENT : "var(--border)"}
                  strokeWidth={active ? 2 : 1.5}
                  opacity={done ? 1 : 0.55}
                  filter={active ? "url(#lsal-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text x={ncx(k)} y={ROWY + 20} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={done ? "var(--foreground)" : "var(--muted-foreground)"}>{s.key}</text>
                <text x={ncx(k)} y={ROWY + 33} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>{k + 1}/{STEPS.length}</text>
              </g>
            )
          })}

          <text x={ML} y={22} className="fill-muted-foreground font-mono" fontSize={9}>one turn of Mistral Vibe →</text>
        </svg>

        {/* active-step detail — grid-stacked so nothing below ever shifts */}
        <div className="mt-3 grid">
          {STEPS.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md bg-muted/40 px-3 py-3 transition-opacity duration-300",
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
