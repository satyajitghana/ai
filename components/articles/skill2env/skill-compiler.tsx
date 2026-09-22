"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Skill2Env is a compiler. One SKILL.md in, several containerised RL tasks out,
// with two gates at the end that no model is involved in.
//
// Every description below is from the paper's Section 3.2. The ordering rule in
// stage three is the one I would steal: tests and rubric are frozen before the
// reference solution exists, "so that the solution has to satisfy the grading
// contract rather than the other way round; a failing reference solution is
// treated as a solution bug, not a reason to weaken the verifier."

const STAGES = [
  {
    k: "plan",
    n: "1",
    name: "Plan",
    who: "Codex as investigator, containerised, with web access",
    out: "workflows.json",
    body: "Reads the whole Skill bundle and lists the distinct, verifiable workflows it teaches, ranked by whether the final state can be checked, whether the task is well-specified, and whether it is difficult for a reason inherent to the work. Each workflow also gets a meta plan — scenario, initial world, planted defects, verifier strategy — and pointers to real public assets at pinned revisions.",
    note: "A literature-review Skill yields a screening-and-synthesis workflow and a citation-reconciliation workflow. The decomposition is per Skill, not per task.",
  },
  {
    k: "diversify",
    n: "2",
    name: "Diversify",
    who: "the host, sampling from an axis pool the planner wrote",
    out: "six sampled axes",
    body: "Archetype, primary verifier pattern, complexity, persona, instruction tone, requester expertise. The axis pool is conditioned on the workflow rather than drawn from the full product, which is what keeps it sensible: a research workflow gets evidence-traceability verification and a researcher persona.",
    note: "Sample: repair/debug × regression suite × hard × support engineer × ticket snippet × novice.",
  },
  {
    k: "create",
    n: "3",
    name: "Create",
    who: "a fresh Codex creator per workflow",
    out: "a Harbor task directory",
    body: "Builds the initial world under environment/, writes the instruction, implements tests/test.sh, writes tests/rubric.md, and only then writes solution/solve.sh. Live services become local stand-ins that preserve the observable contract — a seeded stub server, record-and-replay fixtures, a fake CLI on PATH — so the environment never touches the network at solve time.",
    note: "The order is the point. Tests and rubric are frozen before the solution exists, so the solution has to satisfy the grading contract rather than the reverse.",
  },
  {
    k: "verify",
    n: "4",
    name: "Verify",
    who: "the host, no model involved",
    out: "accept or reject",
    body: "Static checks first: layout, symlinks that must resolve inside their own subtree, Dockerfiles whose build context cannot reach privileged files, base images pinned to a content digest from an approved registry. Then two Harbor trials in fresh containers.",
    note: "The Oracle must earn full reward on every metric. A no-op agent must earn zero on every metric. Fail either and the candidate is dropped.",
  },
]

export function SkillCompiler() {
  const [sel, setSel] = useState("verify")
  const s = STAGES.find((x) => x.k === sel) ?? STAGES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          SKILL.md &rarr; Harbor tasks: 3.4k Skills compiled into 7,971 environments
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">paper &sect;3.2</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-1.5 sm:grid-cols-4">
          {STAGES.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={x.k === sel}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors",
                x.k === sel ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/20",
              )}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{x.n}</span>
                <span className="font-mono text-[11px] text-foreground">{x.name}</span>
              </div>
              <div className="mt-0.5 font-mono text-[9px] leading-4 text-muted-foreground">{x.out}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[10px] text-muted-foreground">{s.who}</div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.body}</p>
          <p className="mt-2 border-l-2 border-foreground/20 pl-3 text-[13px] leading-6 text-foreground/80">
            {s.note}
          </p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two gates in stage four are doing more work than the three model stages before them. An Oracle that
          must score full marks catches a verifier that is impossible to satisfy; a no-op agent that must score
          zero catches a verifier that passes for free &mdash; the single most common way a synthesised RL task
          is silently worthless. Neither gate involves a model, which is why they can be trusted about the models
          that wrote the task.
        </p>
      </div>
    </figure>
  )
}
