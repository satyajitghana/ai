"use client"

import { useState } from "react"

// The checks shadcn/improve's `execute` runs, in order, as written in
// skills/improve/references/closing-the-loop.md and plan-template.md (commit
// cac56e1). Pick a way the executor or the plan can go wrong and see which
// check, if any, is the one that stops it. The mapping is my reading of the
// skill's text; nothing here was run.

type Gate = { id: string; name: string; kind: "command" | "judgment"; src: string }

const GATES: Gate[] = [
  { id: "drift", name: "Drift check", kind: "command", src: "git diff --stat <planned-at>..HEAD -- <in-scope paths>" },
  { id: "stop", name: "STOP conditions", kind: "judgment", src: "the executor stops and reports instead of improvising" },
  { id: "rerun", name: "Re-run done criteria", kind: "command", src: "the reviewer re-runs every criterion in the worktree" },
  { id: "scope", name: "Scope check", kind: "command", src: "git -C <worktree> diff --stat against the in-scope list" },
  { id: "diff", name: "Read the diff", kind: "judgment", src: "judged against \"Why this matters\" and the repo's conventions" },
  { id: "tests", name: "Audit the new tests", kind: "judgment", src: "\"Executors game criteria\": read what the tests assert" },
]

type Fault = { id: string; name: string; caughtBy: string | null; why: string }

const FAULTS: Fault[] = [
  {
    id: "outside",
    name: "Executor edits a file the plan did not list",
    caughtBy: "scope",
    why: "A mechanical check. Any file outside the in-scope list fails review, \"full stop\", however plausible the change.",
  },
  {
    id: "lied",
    name: "Executor reports a test as passing when it failed",
    caughtBy: "rerun",
    why: "The reviewer does not trust the report. It re-runs every done criterion in the executor's worktree itself.",
  },
  {
    id: "drifted",
    name: "An in-scope file changed after the plan was written",
    caughtBy: "drift",
    why: "Every plan stamps the commit it was written against. The executor diffs the in-scope paths first and treats a mismatch as a STOP.",
  },
  {
    id: "emptytest",
    name: "Executor adds a test that asserts nothing",
    caughtBy: "tests",
    why: "The test suite passes, so every command-shaped gate passes. Only the reviewer reading the test catches it, and that is a judgment, not a command.",
  },
  {
    id: "caller",
    name: "A caller outside scope changed since planning",
    caughtBy: null,
    why: "The drift check only diffs in-scope paths. If the plan's assumption lived in a file it does not list, nothing mechanical notices; the repo's own tests are the last line.",
  },
  {
    id: "premise",
    name: "The plan's premise is wrong",
    caughtBy: null,
    why: "The executor follows it faithfully, the done criteria pass because the same model wrote them, and the diff is read against a \"Why this matters\" the same model wrote. Planner and reviewer share one blind spot.",
  },
]

export function ReviewGates() {
  const [f, setF] = useState<Fault>(FAULTS[0])
  const hit = f.caughtBy ? GATES.findIndex((g) => g.id === f.caughtBy) : -1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>/improve execute: which check stops it?</span>
        <span className="text-muted-foreground/60">from the skill&apos;s text</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-col gap-1.5">
          {FAULTS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setF(x)}
              className={`rounded-md border px-2.5 py-1.5 text-left text-xs ${f.id === x.id ? "border-foreground/40 bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              {x.name}
            </button>
          ))}
        </div>

        <ol className="grid gap-2 sm:grid-cols-3">
          {GATES.map((g, i) => {
            const state = hit === -1 ? "passed" : i < hit ? "passed" : i === hit ? "caught" : "skipped"
            return (
              <li
                key={g.id}
                className={`rounded-lg border p-2.5 text-xs transition-colors ${
                  state === "caught"
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : state === "skipped"
                      ? "opacity-40"
                      : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{g.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{g.kind}</span>
                </div>
                <div className="mt-1 font-mono text-[10.5px] leading-snug text-muted-foreground">{g.src}</div>
                <div className="mt-1.5 text-[11px]">
                  {state === "caught" ? "stops it here" : state === "skipped" ? "not reached" : "lets it through"}
                </div>
              </li>
            )
          })}
        </ol>

        <p className={`rounded-md border p-2.5 text-sm ${hit === -1 ? "border-amber-500/60 bg-amber-500/10" : ""}`}>
          {hit === -1 ? <strong>Nothing in the loop catches this. </strong> : null}
          {f.why}
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Gates in the order the skill runs them (closing-the-loop.md and plan-template.md at commit cac56e1). Command gates
        have an expected output; judgment gates depend on the reviewing model reading carefully.
      </figcaption>
    </figure>
  )
}
