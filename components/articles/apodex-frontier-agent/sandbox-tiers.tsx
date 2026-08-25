"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The filesystem contract, which is the part of an agent runtime you actually
// have to trust.
//
// FrontierAgent gives every task three roots with different policies —
// /inputs read-only, /workspace read-write, /outputs the persistent deliverable
// — and the shell tool and the file tools share them, so `rm` is governed by the
// same rule as a file write rather than escaping through a subprocess. That
// detail is the whole design: a sandbox that only covers the tools with "file"
// in the name is not a sandbox.
//
// Three run modes then decide what happens on a mutation: interactive shows a
// diff and waits, --yes proceeds, and the benchmark runner is non-interactive by
// construction. Authorization and sandbox failures are fail-closed — an unknown
// path is denied rather than allowed.

const GOOD = "oklch(0.55 0.16 155)"
const WARM = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"
const MUTED = "oklch(0.62 0.03 250)"

type Verdict = "allow" | "approve" | "deny"

type Action = {
  cmd: string
  root: "inputs" | "workspace" | "outputs" | "outside" | "net"
  mutating: boolean
  why: string
  hardDeny?: boolean
}

const ACTIONS: Action[] = [
  { cmd: "read /inputs/annual_report.pdf", root: "inputs", mutating: false, why: "/inputs is readable by every tool" },
  { cmd: "write /inputs/annual_report.pdf", root: "inputs", mutating: true, why: "/inputs is read-only — no mode overrides it", hardDeny: true },
  { cmd: "write /workspace/extracted.csv", root: "workspace", mutating: true, why: "/workspace is the agent's working state" },
  { cmd: "rm -rf /workspace/tmp", root: "workspace", mutating: true, why: "the shell tool shares the file sandbox — same rule, not a bypass" },
  { cmd: "write /outputs/summary.md", root: "outputs", mutating: true, why: "/outputs is the persistent deliverable, mapped to the host" },
  { cmd: "uv pip install pandas", root: "workspace", mutating: true, why: "package installs mutate the environment, not just files" },
  { cmd: "GET https://arxiv.org/abs/2608.23283", root: "net", mutating: false, why: "the web tool reads; it does not touch the task filesystem" },
  { cmd: "read /etc/passwd", root: "outside", mutating: false, why: "outside every task root — fail-closed, so unknown means denied", hardDeny: true },
]

const MODES = [
  { k: "interactive", label: "interactive TUI", note: "mutations show a diff and wait for you" },
  { k: "yes", label: "--yes", note: "mutations proceed without prompting" },
  { k: "bench", label: "benchmark runner", note: "non-interactive by construction; no human in the loop" },
] as const

function verdict(a: Action, mode: string): Verdict {
  if (a.hardDeny) return "deny"
  if (!a.mutating) return "allow"
  return mode === "interactive" ? "approve" : "allow"
}

const STYLE: Record<Verdict, { colour: string; label: string }> = {
  allow: { colour: GOOD, label: "allowed" },
  approve: { colour: WARM, label: "diff + approval" },
  deny: { colour: BAD, label: "denied" },
}

const ROOTS = [
  { k: "inputs", path: "/inputs", policy: "read-only", note: "supplied documents and data" },
  { k: "workspace", path: "/workspace", policy: "read-write", note: "checkouts, extractions, scratch" },
  { k: "outputs", path: "/outputs", policy: "controlled write", note: "deliverables, mapped to the host" },
] as const

export function SandboxTiers() {
  const [mode, setMode] = useState<string>("interactive")
  const [sel, setSel] = useState(0)

  const a = ACTIONS[sel]
  const v = verdict(a, mode)
  const st = STYLE[v]
  const m = MODES.find((x) => x.k === mode)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one task sandbox, three roots, shared by the shell and file tools
        </span>
        <span className="font-mono text-[10px]" style={{ color: st.colour }}>
          {st.label}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {ROOTS.map((r) => {
            const lit = a.root === r.k
            const colour = r.k === "inputs" ? MUTED : r.k === "workspace" ? GOOD : WARM
            return (
              <div
                key={r.k}
                className={cn(
                  "rounded-lg border px-3 py-2 transition-colors",
                  lit ? "border-foreground/30 bg-muted/40" : "bg-muted/15",
                )}
              >
                <div className="font-mono text-[11px]" style={{ color: colour }}>
                  {r.path}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{r.policy}</div>
                <div className="mt-0.5 font-mono text-[9.5px] text-muted-foreground">{r.note}</div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MODES.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setMode(x.k)}
              aria-pressed={mode === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/15 p-1.5">
          {ACTIONS.map((x, i) => {
            const vv = verdict(x, mode)
            const s = STYLE[vv]
            return (
              <button
                key={x.cmd}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={sel === i}
                className={cn(
                  "flex w-full cursor-pointer flex-wrap items-baseline justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
                  sel === i ? "bg-muted/60" : "hover:bg-muted/30",
                )}
              >
                <code className="font-mono text-[11px] text-foreground">{x.cmd}</code>
                <span className="font-mono text-[9.5px]" style={{ color: s.colour }}>
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: `color-mix(in oklch, ${st.colour} 40%, transparent)` }}>
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">why</div>
          <div className="font-mono text-[11px] text-foreground">{a.why}</div>
          <div className="mt-1 font-mono text-[9.5px] text-muted-foreground">
            in {m.label}: {m.note}
            {a.hardDeny ? " — but the root policy decides first, and no mode relaxes it" : ""}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two things in that table are worth more than the rest of it. The first is that{" "}
          <span className="font-mono text-[11px] text-foreground">rm -rf /workspace/tmp</span>{" "}is
          governed by the same policy as a file write, because the shell tool and the file tools
          share one sandbox. A great many agent runtimes wrap file access carefully and then hand the
          model a shell that walks straight around it.
          <br />
          <br />
          The second is the order of the checks. Switch to{" "}
          <span className="font-mono text-[11px] text-foreground">--yes</span>{" "}and try to write to{" "}
          <span className="font-mono text-[11px] text-foreground">/inputs</span>: the root policy
          decides before the approval mode gets a say, so the flag that removes the human does not
          remove the boundary.{" "}
          <span className="text-foreground">
            The failures are fail-closed — an unrecognised path is denied, not allowed
          </span>
          , which is the only default that survives an agent inventing a path you did not anticipate.
          Behind all of it, sessions are checkpointed, mutations are journalled, and{" "}
          <span className="font-mono text-[11px] text-foreground">/revert</span>{" "}exists — worth
          more in practice than any amount of care about what the agent was allowed to do.
        </p>
      </div>
    </figure>
  )
}
