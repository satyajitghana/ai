"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two views of what TokenEconomizer changes in an agent's request.
//
// 1. The tool mask from the paper's Appendix I(f) and I(g) (arXiv 2610.22732): the first four
//    Django tasks on Claude Code 2.1.170 with Sonnet 5 and on Copilot CLI with Sonnet 5, with the
//    first request's prompt tokens under TokenEconomizer and under default execution. Each chip is
//    coloured by what the shipped plugin (commit 583fff7) would do with that tool: keep it (the
//    work surface), may prune it, or protects it (INTERACTIVE_PROTECTED and COPILOT_PROTECTED in
//    tokeneconomizer/plugin/adapter.py; on Copilot the plugin can only switch off whole MCP
//    servers, and none of these are). The paper reports no token count for the plugin's mask.
//
// 2. Where each mechanism writes into a request, and whether the cached prefix survives, from
//    docs/PLUGIN.md and the paper's Appendix J.

type Agent = "claude" | "copilot"
type Fate = "keep" | "prunable" | "protected"

const DATA: Record<Agent, {
  label: string
  tools: [string, Fate][]
  tasks: { id: string; te: number; base: number; note: string }[]
}> = {
  claude: {
    label: "Claude Code, Sonnet 5",
    tools: [
      ["Bash", "keep"], ["Edit", "keep"], ["Read", "keep"], ["Write", "keep"],
      ["CronCreate", "prunable"], ["CronDelete", "prunable"], ["CronList", "prunable"],
      ["EnterWorktree", "prunable"], ["ExitWorktree", "prunable"], ["NotebookEdit", "prunable"],
      ["ScheduleWakeup", "prunable"], ["Workflow", "prunable"],
      ["AskUserQuestion", "protected"], ["EnterPlanMode", "protected"], ["ExitPlanMode", "protected"],
      ["Skill", "protected"], ["Task", "protected"], ["TaskCreate", "protected"], ["TaskGet", "protected"],
      ["TaskList", "protected"], ["TaskOutput", "protected"], ["TaskStop", "protected"], ["TaskUpdate", "protected"],
    ],
    tasks: [
      { id: "django-10097", te: 42866, base: 42866, note: "23 tools loaded" },
      { id: "django-10554", te: 16295, base: 43351, note: "judge masks 19" },
      { id: "django-10880", te: 15003, base: 42059, note: "judge masks the same 19" },
      { id: "django-10914", te: 15299, base: 42355, note: "evidence masks the same 19" },
    ],
  },
  copilot: {
    label: "Copilot CLI, Sonnet 5",
    tools: [
      ["bash", "keep"], ["create", "keep"], ["edit", "keep"], ["glob", "keep"], ["grep", "keep"],
      ["list_bash", "keep"], ["read_bash", "keep"], ["stop_bash", "keep"], ["view", "keep"],
      ["factories_manage", "protected"], ["fetch_copilot_cli_documentation", "protected"],
      ["list_agents", "protected"], ["read_agent", "protected"], ["run_factory", "protected"],
      ["session_store_sql", "protected"], ["skill", "protected"], ["sql", "protected"],
      ["task", "protected"], ["write_agent", "protected"],
    ],
    tasks: [
      { id: "django-10097", te: 25765, base: 25760, note: "19 tools loaded" },
      { id: "django-10554", te: 11347, base: 26249, note: "judge masks 10" },
      { id: "django-10880", te: 10066, base: 24969, note: "judge masks the same 10" },
      { id: "django-10914", te: 10343, base: 25248, note: "evidence masks the same 10" },
    ],
  },
}

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const FATE_STYLE: Record<Fate, string> = {
  keep: "border-foreground/30 bg-muted/60 text-foreground",
  prunable: "border-[oklch(0.62_0.14_70)] bg-[oklch(0.62_0.14_70/0.14)] text-foreground",
  protected: "border-[oklch(0.58_0.17_25)] bg-[oklch(0.58_0.17_25/0.12)] text-foreground",
}

type Mech = "prune" | "facts" | "guardPaper" | "guardPlugin"
const MECHS: { id: Mech; label: string }[] = [
  { id: "prune", label: "tool pruning" },
  { id: "facts", label: "micro-skills" },
  { id: "guardPaper", label: "loop guard, paper" },
  { id: "guardPlugin", label: "loop guard, plugin" },
]

// The request, left to right in the order a prompt cache matches it.
const BLOCKS = ["tools", "system", "facts", "task", "turn 1", "turn 2", "tool result", "note"] as const
type Block = (typeof BLOCKS)[number]

const MECH_INFO: Record<Mech, { touches: Block[]; drops?: Block[]; cache: string; text: string }> = {
  prune: {
    touches: ["tools"],
    cache: "From the next session only. A running session keeps its tools; a conversation resumed after the change re-sends its history with the new list and rewrites the cache, so the plugin waits until the repository has been idle 60 minutes.",
    text: "Deny rules in .claude/settings.local.json (Claude Code), toggles in .codex/config.toml (Codex), disabledMcpServers (Copilot). The tools block is the first thing a cache matches, so this is the one change that moves every later byte.",
  },
  facts: {
    touches: ["facts"],
    cache: "The block is rendered once, when the last session was folded, and given at session start, so within a session the prefix holds. Tools and system prompt before it are untouched.",
    text: "SessionStart additionalContext: a short list of learned facts (the free layer caps it at 4 facts and about 150 tokens). In the paper it was a prefix on the task prompt.",
  },
  guardPaper: {
    touches: ["note"],
    drops: ["turn 1", "turn 2", "tool result"],
    cache: "The paper's harness stops the CLI and starts a new invocation with the redirect in its prompt. The history is gone, so every later turn re-reads less; a second stuck verdict ends the task.",
    text: "Kill and resume, then abort (Appendix J). Part of the guard's saving in the paper is this context reset and the aborts, neither of which the plugin does.",
  },
  guardPlugin: {
    touches: ["note"],
    cache: "Appended after the tool result, so the request still extends the last one byte for byte. Nothing before it changes.",
    text: "PostToolUse additionalContext: a two to four sentence redirect, at most once per turn by default, then a one-line notice to you. It never stops the turn.",
  },
}

export function RequestAnatomy() {
  const [agent, setAgent] = useState<Agent>("claude")
  const [task, setTask] = useState(1)
  const [mech, setMech] = useState<Mech>("prune")
  const d = DATA[agent]
  const t = d.tasks[task]
  const maxTok = 44000
  const masked = task > 0
  const counts = {
    keep: d.tools.filter((x) => x[1] === "keep").length,
    prunable: d.tools.filter((x) => x[1] === "prunable").length,
    protected: d.tools.filter((x) => x[1] === "protected").length,
  }
  const info = MECH_INFO[mech]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what the mask removed in the paper, and what the plugin may remove</span>
        <span className="text-muted-foreground/60">arXiv 2610.22732 App. I(f, g); plugin at 583fff7</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(DATA) as Agent[]).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={agent === a}
              onClick={() => setAgent(a)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                agent === a ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {DATA[a].label}
            </button>
          ))}
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">task</span>
          {d.tasks.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={task === i}
              onClick={() => setTask(i)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                task === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {`${i + 1}`}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2 font-mono text-[11px]">
          <div className="text-muted-foreground">{`${t.id}: ${t.note}. First request, prompt tokens:`}</div>
          {[
            { label: "default", v: t.base, cls: "bg-foreground/35" },
            { label: "TokenEconomizer", v: t.te, cls: "bg-[oklch(0.55_0.13_250)]" },
          ].map((b) => (
            <div key={b.label} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
              <span className="text-muted-foreground">{b.label}</span>
              <div className="relative h-5 rounded bg-muted/40">
                <div className={cn("h-5 rounded transition-all duration-500", b.cls)} style={{ width: `${(b.v / maxTok) * 100}%` }} />
                <span className="absolute inset-y-0 right-2 flex items-center text-foreground">{fmt(b.v)}</span>
              </div>
            </div>
          ))}
          <div className="text-muted-foreground">
            {masked
              ? `${fmt(t.base - t.te)} fewer than default on this task (paper's numbers).`
              : "Nothing is masked before the first task: the mask has to be earned."}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {d.tools.map(([name, fate]) => {
            const off = masked && fate !== "keep"
            return (
              <span
                key={name}
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-opacity",
                  FATE_STYLE[fate],
                  off && "line-through opacity-80",
                )}
              >
                {name}
              </span>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-foreground/40" />{`kept, work surface (${counts.keep})`}</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[oklch(0.62_0.14_70)]" />{`masked in the paper, the plugin may prune it (${counts.prunable})`}</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[oklch(0.58_0.17_25)]" />{`masked in the paper, the plugin will not (${counts.protected})`}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {agent === "claude"
            ? "The paper gives one token count for all 19. Captured on Claude Code 2.1.170 against a fake API, the 19 are 64,023 bytes of tool JSON and the plugin's 8 are 36,861 (Workflow alone is 20,562). On 2.1.307 most of these are deferred: only Workflow and ScheduleWakeup are still sent in full, 10,241 bytes."
            : "On Copilot the plugin can only switch off whole MCP servers through disabledMcpServers. These ten are built-in tools, so its deny list removes none of them."}
        </p>

        <div className="mt-6 border-t pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] text-muted-foreground">where it writes</span>
            {MECHS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mech === m.id}
                onClick={() => setMech(m.id)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  mech === m.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {BLOCKS.map((b) => {
              const hit = info.touches.includes(b)
              const gone = info.drops?.includes(b)
              const absent = (b === "facts" && mech !== "facts") || (b === "note" && !mech.startsWith("guard"))
              return (
                <span
                  key={b}
                  className={cn(
                    "rounded border px-2 py-1.5 font-mono text-[10px]",
                    hit ? "border-[oklch(0.55_0.13_250)] bg-[oklch(0.55_0.13_250/0.18)] text-foreground" : "border-border text-muted-foreground",
                    gone && "line-through opacity-50",
                    absent && !hit && "border-dashed opacity-40",
                  )}
                >
                  {b}
                </span>
              )
            })}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">a cache matches from the left: anything changed invalidates everything to its right</div>
          <p className="mt-3 text-sm">{info.text}</p>
          <p className="mt-1 text-sm text-muted-foreground">{info.cache}</p>
        </div>
      </div>
    </figure>
  )
}
