"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The harness taxonomy as a matrix: seven harnesses, seven design axes. Each cell is what that harness
// does on that axis, read from its source or docs at a stated version, or from the site's teardown that
// read it. Click an axis to see every harness's answer side by side; click a harness to open its row.
// The four measured harnesses are the ones run on beast2 for this article; the other three are here
// because the site has read their code.
//
// SSR-safe: static data, the first render is deterministic.

type Axis = "loop" | "tools" | "edit" | "context" | "sandbox" | "plan" | "retry"

const AXES: { id: Axis; label: string; blurb: string }[] = [
  { id: "loop", label: "Loop", blurb: "What ends a turn, and who decides the task is done." },
  { id: "tools", label: "Tools sent", blurb: "What the model is offered on every request, and what that costs in prompt." },
  { id: "edit", label: "Edit primitive", blurb: "How a change reaches a file, and what happens when the match fails." },
  { id: "context", label: "Context", blurb: "What stays in the prompt as the run grows, and when it is cut." },
  { id: "sandbox", label: "Sandbox", blurb: "Where model-written commands run, and what stops them." },
  { id: "plan", label: "Plan / sub-agents", blurb: "Is there a planning step or a way to fork work?" },
  { id: "retry", label: "Retries & stop", blurb: "What happens on a bad call, a failed request, or a run that will not end." },
]

type Row = {
  name: string
  version: string
  measured: boolean
  href: string
  src: string
  cells: Record<Axis, string>
}

const ROWS: Row[] = [
  {
    name: "pi",
    version: "1.5.2",
    measured: true,
    href: "/articles/harness-adapters",
    src: "npm @earendil-works/pi-coding-agent 1.5.2 docs (how-pi-works, compaction, cli)",
    cells: {
      loop: "Native tool calls. A turn is one response plus its tool results; the run ends when a response has no tool call.",
      tools: "Four by default: read, bash, edit, write. grep, find and ls exist but are off.",
      edit: "edit takes exact {oldText, newText} pairs; no fuzzy match.",
      context: "Full history until context > window minus 16,384 reserved tokens, then one summary replaces older turns.",
      sandbox: "None built in. Tools run with the permissions of the pi process.",
      plan: "Neither built in; plan mode and a todo tool ship as example extensions.",
      retry: "One compact-and-retry on a context overflow; no step limit of its own.",
    },
  },
  {
    name: "OpenCode",
    version: "1.19.6",
    measured: true,
    href: "/articles/prompt-caching-harnesses",
    src: "anomalyco/opencode v1.19.6 run.ts and config schema; caching read at v1.19.3 in the site's teardown",
    cells: {
      loop: "Native tool calls, streamed through an in-process server; `opencode run` exits when the session goes idle.",
      tools: "The widest catalogue of the four (counted from the wire below), with a long system prompt.",
      edit: "An edit tool with oldString/newString, plus write and a patch tool.",
      context: "Auto-compaction when the window fills (compaction.auto, on by default); optional pruning of old tool output.",
      sandbox: "A permission ruleset (allow / ask / deny per tool); no OS sandbox. In run mode unanswered asks are rejected.",
      plan: "A todo tool and a task tool that spawns sub-agents; a plan agent.",
      retry: "A doom_loop permission that trips on repeated identical calls.",
    },
  },
  {
    name: "mini-swe-agent",
    version: "2.4.6",
    measured: true,
    href: "/articles/multi-harness-rl",
    src: "PyPI mini-swe-agent 2.4.6 wheel: config/mini.yaml, agents/default.py, environments/",
    cells: {
      loop: "One bash tool. The run ends when the model echoes COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT.",
      tools: "One: bash. Each command runs in a fresh subshell.",
      edit: "No edit tool: sed, heredocs and python scripts through bash.",
      context: "Linear history, never compacted; outputs over 10,000 characters keep the first and last 5,000.",
      sandbox: "Swappable environment: local, docker, singularity, bubblewrap.",
      plan: "Neither.",
      retry: "A bad call gets a format-error message back; 3 in a row ends the run. Step and cost limits.",
    },
  },
  {
    name: "Aider",
    version: "0.86.2",
    measured: true,
    href: "/articles/prompt-caching-harnesses",
    src: "PyPI aider-chat 0.86.2 wheel: args.py, coders/base_coder.py, models.py",
    cells: {
      loop: "No tool calls. The model writes SEARCH/REPLACE blocks in prose; aider applies them and stops.",
      tools: "None. A tree-sitter repo map (1,024 tokens here) stands in for exploration.",
      edit: "SEARCH/REPLACE blocks; a block that does not match is sent back as an error to fix.",
      context: "Chat history summarised past 1/16 of the input window (between 1,024 and 8,192 tokens).",
      sandbox: "None. Test and lint commands run as the user.",
      plan: "An architect mode splits planning and editing across two calls; off here.",
      retry: "With --auto-test, failing tests are fed back up to 3 times (max_reflections).",
    },
  },
  {
    name: "Codex CLI",
    version: "67f0994b",
    measured: false,
    href: "/articles/codex-harness-from-the-source",
    src: "the site's teardown of openai/codex at commit 67f0994b",
    cells: {
      loop: "Two loops: one request, then follow up while the model made calls or the user typed. Tools start while the model is still streaming.",
      tools: "About twenty core tools plus eleven for multi-agent work; for most catalog models the tool list is sent once, then only diffs.",
      edit: "apply_patch with a grammar, matched in four passes of falling strictness.",
      context: "Context is a set of sections that send only diffs; compaction at nine tenths of the window keeps 20,000 tokens of user messages and a summary.",
      sandbox: "bubblewrap then seccomp on Linux, Seatbelt on macOS, from one permission lattice.",
      plan: "update_plan, a plan-mode prompt, spawn_agent and friends.",
      retry: "Five stream retries from 200 ms, doubling; 29 error kinds never retry.",
    },
  },
  {
    name: "Claude Code",
    version: "runtime 0.0.81",
    measured: false,
    href: "/articles/claude-code-sandbox-internals",
    src: "the site's teardown of @anthropic-ai/sandbox-runtime 0.0.81; the CLI itself is closed",
    cells: {
      loop: "Closed source; not checked.",
      tools: "Closed source; TokenEconomizer's paper puts its first request at 42,866 tokens on a Django task.",
      edit: "Closed source; not checked.",
      context: "Closed source; not checked.",
      sandbox: "The Bash tool runs under bwrap with two seccomp filters and a network proxy; other tools follow permission rules.",
      plan: "Not checked here.",
      retry: "A sandboxed command that fails can be retried unsandboxed, gated by the permission mode.",
    },
  },
  {
    name: "dsh",
    version: "DeepSeek",
    measured: false,
    href: "/articles/deepseek-harness",
    src: "the site's teardown of DeepSeek's dsh",
    cells: {
      loop: "The loop itself is a replaceable plugin; a step is one request plus its tools.",
      tools: "Plugins; tool schemas are assembled per step.",
      edit: "Not checked.",
      context: "The log is the source: every outgoing request must match a replay of the session log byte for byte.",
      sandbox: "Not checked.",
      plan: "Not checked.",
      retry: "A request that drifts from the log is refused rather than sent.",
    },
  },
]

export function HarnessMatrix() {
  const [axis, setAxis] = useState<Axis>("tools")
  const [open, setOpen] = useState<string | null>(null)
  const ax = AXES.find((a) => a.id === axis)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>seven harnesses, seven design choices</span>
        <span className="text-muted-foreground/60">● measured here · ○ read only</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2.5" role="tablist" aria-label="Design axis">
        {AXES.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={a.id === axis}
            onClick={() => setAxis(a.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              a.id === axis ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <p className="px-4 pt-3 text-sm text-muted-foreground">{ax.blurb}</p>

      <ul className="divide-y px-1 pb-2">
        {ROWS.map((r) => {
          const isOpen = open === r.name
          return (
            <li key={r.name} className="px-3 py-2.5">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.name)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[7.5rem_1fr] gap-3 text-left sm:grid-cols-[10rem_1fr]"
              >
                <span className="font-mono text-xs">
                  <span className={r.measured ? "text-foreground" : "text-muted-foreground"}>{r.measured ? "● " : "○ "}</span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="block text-[10px] text-muted-foreground">{r.version}</span>
                </span>
                <span className={cn("text-sm", r.cells[axis].startsWith("Not checked") || r.cells[axis].startsWith("Closed source") ? "text-muted-foreground" : "")}>
                  {r.cells[axis]}
                </span>
              </button>
              {isOpen ? (
                <div className="mt-2 ml-0 rounded-lg border bg-muted/20 p-3 text-xs sm:ml-[10.75rem]">
                  <dl className="grid gap-1.5">
                    {AXES.filter((a) => a.id !== axis).map((a) => (
                      <div key={a.id} className="grid grid-cols-[6.5rem_1fr] gap-2">
                        <dt className="font-mono text-muted-foreground">{a.label}</dt>
                        <dd>{r.cells[a.id]}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-muted-foreground">
                    Source: {r.src}.{" "}
                    <a href={r.href} className="underline underline-offset-2">
                      Read the teardown
                    </a>
                  </p>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
