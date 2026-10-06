"use client"

import { useState } from "react"

// One StateM success rewritten into a Terminus 2 training trajectory, stage by
// stage. The task, the runbook milestones and the quoted commands are the
// paper's OpenFOAM case (Figure 6): `statem goto implement` and
// `tb_receipt.py validate-contract` on the source side; `head -20
// reconstruct.py`, `python3 /tmp/build.py` and `python3 /app/tools/feedback`
// in the passing rewrite. The connective lines (control messages, the leaky
// draft, the critic's reason) are illustrative, written to show what each
// stage removes, and are marked as such in the widget.

type Line = {
  who: "harness" | "model" | "env" | "private" | "critic"
  text: string
  cut?: boolean // removed at this stage
  quoted?: boolean // taken from the paper's Figure 6
}

type Stage = {
  id: string
  name: string
  role: string
  left: { title: string; lines: Line[] }
  right: { title: string; lines: Line[] }
  note: string
}

const SOURCE: Line[] = [
  { who: "harness", text: "[StateM] state=ANALYZE · context reset for phase" },
  { who: "model", text: "inspect the public scenarios and their summaries" },
  { who: "harness", text: "[StateM] transition check: contract written? yes → IMPLEMENT" },
  { who: "model", text: "python3 .../tb_receipt.py validate-contract", quoted: true },
  { who: "model", text: "statem goto implement", quoted: true },
  { who: "env", text: "summary fields differ across scenarios" },
  { who: "model", text: "write reconstruct.py; rerun feedback" },
]

const STAGES: Stage[] = [
  {
    id: "source",
    name: "1 · Source",
    role: "discovery harness",
    left: { title: "StateM trajectory (38 turns, passed)", lines: SOURCE },
    right: { title: "Nothing yet", lines: [] },
    note: "A passing rollout under StateM. Half of what is in it is the harness talking: phase resets, transition checks, and commands that only exist because StateM is running.",
  },
  {
    id: "compact",
    name: "2 · Compact",
    role: "deterministic",
    left: {
      title: "Compacted source",
      lines: SOURCE.map((l) =>
        l.who === "harness" ? { ...l, cut: true } : l,
      ),
    },
    right: { title: "Nothing yet", lines: [] },
    note: "Before planning, the source is cut down to task instruction, model actions and environment observations. Harness control messages go. The StateM-only commands are still there: they are model actions.",
  },
  {
    id: "plan",
    name: "3 · Plan",
    role: "planner (same model)",
    left: {
      title: "Compacted source",
      lines: SOURCE.filter((l) => l.who !== "harness"),
    },
    right: {
      title: "Runbook draft 1 of K = 4",
      lines: [
        { who: "private", text: "Goal: summaries match for public and hidden scenarios" },
        { who: "private", text: "1. Identify varying fields", quoted: true },
        { who: "private", text: "2. Build a summary generator", quoted: true },
        { who: "private", text: "3. Check public scenarios", quoted: true },
        { who: "private", text: "Final values: <the expected summary numbers>" },
      ],
    },
    note: "The planner rewrites the solved procedure as a runbook: end state, milestones, checks, recovery steps, pitfalls. It is told not to hand over the finished deliverable. This draft does anyway.",
  },
  {
    id: "critic",
    name: "4 · Critic",
    role: "rules + model",
    left: {
      title: "Runbook draft 1",
      lines: [
        { who: "private", text: "1. Identify varying fields" },
        { who: "private", text: "2. Build a summary generator" },
        { who: "private", text: "3. Check public scenarios" },
        { who: "private", text: "Final values: <the expected summary numbers>", cut: true },
      ],
    },
    right: {
      title: "Critic verdict",
      lines: [
        { who: "critic", text: "rule checks: schema ok · no unsupported tool refs" },
        { who: "critic", text: "model check (sees task + runbook only): solution leak" },
        { who: "critic", text: "reject → planner resamples with this reason" },
        { who: "private", text: "draft 2: same milestones, no final values → accept" },
      ],
    },
    note: "Deterministic checks first, then the same model as critic, shown only the public task and the runbook. A leak sends the draft back to the planner with the reason. This loop is the 'recursive' in the name.",
  },
  {
    id: "execute",
    name: "5 · Execute",
    role: "executor, Terminus 2",
    left: {
      title: "Private guidance (never logged)",
      lines: [
        { who: "private", text: "1. Identify varying fields" },
        { who: "private", text: "2. Build a summary generator" },
        { who: "private", text: "3. Check public scenarios" },
      ],
    },
    right: {
      title: "Fresh sandbox, general harness, 1 of M = 4",
      lines: [
        { who: "model", text: "inspect the public scenarios and their summaries" },
        { who: "model", text: "head -20 .../reconstruct.py", quoted: true },
        { who: "env", text: "summary fields differ across scenarios" },
        { who: "model", text: "python3 /tmp/build.py", quoted: true },
        { who: "model", text: "python3 /app/tools/feedback", quoted: true },
      ],
    },
    note: "The executor solves the task again from scratch under plain Terminus 2, with the runbook as private guidance. No StateM, so no `statem goto`. It must react to this sandbox's real outputs rather than replay the source.",
  },
  {
    id: "keep",
    name: "6 · Keep",
    role: "verifier + leak audit",
    left: {
      title: "Discarded",
      lines: [
        { who: "private", text: "the runbook", cut: true },
        { who: "critic", text: "the critic conversation", cut: true },
        { who: "model", text: "any rewrite that failed the verifier", cut: true },
        { who: "model", text: "any rewrite using values it could not have derived", cut: true },
      ],
    },
    right: {
      title: "Training trajectory (SFT)",
      lines: [
        { who: "model", text: "task instruction" },
        { who: "model", text: "head -20 .../reconstruct.py" },
        { who: "env", text: "observation" },
        { who: "model", text: "python3 /tmp/build.py" },
        { who: "model", text: "python3 /app/tools/feedback  → pass" },
      ],
    },
    note: "Only passing rewrites survive, and the model flags any value it could not have derived from the task or the sandbox. What is kept is the public history: instruction, observations, the model's own responses.",
  },
]

const TONE: Record<Line["who"], string> = {
  harness: "oklch(0.62 0.15 55)",
  model: "oklch(0.58 0.12 250)",
  env: "oklch(0.55 0.02 260)",
  private: "oklch(0.58 0.13 300)",
  critic: "oklch(0.60 0.17 25)",
}

const TAG: Record<Line["who"], string> = {
  harness: "harness",
  model: "model",
  env: "env",
  private: "runbook",
  critic: "critic",
}

function Pane({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{title}</div>
      {lines.length === 0 ? (
        <div className="font-mono text-xs text-muted-foreground">·</div>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className="mt-0.5 w-14 shrink-0 rounded px-1 text-center font-mono text-[10px] text-white"
                style={{ background: TONE[l.who], opacity: l.cut ? 0.45 : 1 }}
              >
                {TAG[l.who]}
              </span>
              <span
                className="min-w-0 break-words font-mono"
                style={{
                  textDecoration: l.cut ? "line-through" : undefined,
                  opacity: l.cut ? 0.5 : 1,
                }}
              >
                {l.text}
                {l.quoted ? <sup className="ml-0.5 text-muted-foreground">fig 6</sup> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RewriteStepper() {
  const [i, setI] = useState(0)
  const s = STAGES[i]
  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">
          One success, rewritten for the general harness
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          OpenFOAM case · lines marked fig 6 are the paper&apos;s, the rest illustrative
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Rewrite stage">
        {STAGES.map((st, k) => {
          const on = k === i
          return (
            <button
              key={st.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setI(k)}
              className="rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors"
              style={{
                background: on ? TONE.model : "transparent",
                borderColor: on ? TONE.model : undefined,
                color: on ? "white" : undefined,
              }}
            >
              <span className="font-mono">{st.name}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-1 font-mono text-xs text-muted-foreground">{s.role}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <Pane {...s.left} />
        <Pane {...s.right} />
      </div>
      <p className="mt-3 text-sm">{s.note}</p>

      <div className="mt-3 flex justify-between">
        <button
          type="button"
          className="rounded-md border px-3 py-1 font-mono text-xs disabled:opacity-40"
          disabled={i === 0}
          onClick={() => setI(i - 1)}
        >
          ← back
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-1 font-mono text-xs disabled:opacity-40"
          disabled={i === STAGES.length - 1}
          onClick={() => setI(i + 1)}
        >
          next →
        </button>
      </div>
    </div>
  )
}
