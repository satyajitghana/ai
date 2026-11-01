"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { EXTENSIONS } from "./data"
import { Chip, Panel, Src, Tag, fmt } from "./ui"

// Hooks: protocol/src/protocol.rs:1786 (14 events); the Claude-compatible wire schema in hooks/src/schema.rs:103-123 has 11.
// Extensions: codex-rs/ext/* (18 crates, 82,677 lines). Behaviour of an unsupported hook decision: hooks/src/events/pre_tool_use.rs:463.
const HOOKS: { name: string; wire: boolean; note: string }[] = [
  { name: "SessionStart", wire: true, note: "A session begins." },
  { name: "UserPromptSubmit", wire: true, note: "Before the user's prompt reaches the model." },
  { name: "PreModelRequest", wire: false, note: "Before each sampling request. In the protocol enum but not in the Claude-compatible wire schema." },
  { name: "PostModelRequest", wire: false, note: "After each sampling request. Not in the wire schema." },
  { name: "PreToolUse", wire: true, note: "Can deny a tool call or rewrite its input. A bare permissionDecision of allow without an updated input is recorded as a failed hook run: the call is not blocked and the hook's extra context is dropped." },
  { name: "PermissionRequest", wire: true, note: "Can resolve an approval: it returns Allow or Deny with a message." },
  { name: "PostToolUse", wire: true, note: "After a tool call." },
  { name: "PreCompact", wire: true, note: "Before a compaction." },
  { name: "PostCompact", wire: true, note: "After a compaction." },
  { name: "Stop", wire: true, note: "The turn is about to end; a hook may inject a continuation prompt and keep going." },
  { name: "SubagentStart", wire: true, note: "A subagent starts." },
  { name: "SubagentStop", wire: true, note: "A subagent stops." },
  { name: "Interrupt", wire: true, note: "The user interrupts." },
  { name: "SessionEnd", wire: false, note: "The session ends. In the protocol enum but not in the wire schema." },
]

const DOORS = [
  { n: "Skills", d: "Instructions, loaded on demand from SKILL.md folders." },
  { n: "MCP servers", d: "Tools and resources over the Model Context Protocol; hosts can attach scoped request metadata." },
  { n: "Plugins", d: "A manifest bundling skills, hooks, MCP servers and apps, with marketplaces and sharing." },
  { n: "Hooks", d: "Commands, MCP tools or prompts run at 14 points in the loop." },
  { n: "Extensions", d: "Eighteen ext/* crates on one contributor API: skills, Guardian, goals, memories, queue, web search, image generation…" },
]

export function ExtensionDoors() {
  const [h, setH] = useState(4)
  const [d, setD] = useState(0)
  const max = EXTENSIONS[0][1]
  return (
    <Panel title="Five ways in, and fourteen places a hook can stand" sub="the extension surface of the harness">
      <div className="grid gap-1.5 sm:grid-cols-5">
        {DOORS.map((x, i) => (<Chip key={x.n} tone="violet" active={d === i} onClick={() => setD(i)}><span className="font-medium">{x.n}</span></Chip>))}
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">{DOORS[d].d}</p>
      <div className="mt-4">
        <div className="mb-1 text-sm font-medium">Hook events in the order a turn meets them (roughly)</div>
        <div className="flex flex-wrap gap-1.5">
          {HOOKS.map((x, i) => (<Chip key={x.name} tone={x.wire ? "sky" : "amber"} active={h === i} onClick={() => setH(i)}>{x.name}</Chip>))}
        </div>
        <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
          <div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-medium">{HOOKS[h].name}</span><Tag tone={HOOKS[h].wire ? "sky" : "amber"}>{HOOKS[h].wire ? "in the Claude-compatible wire schema" : "protocol only"}</Tag></div>
          <p className="text-muted-foreground">{HOOKS[h].note}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">The engine is called <code>ClaudeHooksEngine</code> and uses Claude-Code-style JSON (<code>hookSpecificOutput</code>, <code>permissionDecision</code>, <code>updatedInput</code>). A hook can block; a hook error does not. <Src>hooks/src/events/pre_tool_use.rs:463</Src></p>
      </div>
      <div className="mt-4">
        <div className="mb-1 text-sm font-medium">The 18 extension crates, by Rust lines</div>
        <ol className="space-y-0.5">
          {EXTENSIONS.map(([n, l]) => (
            <li key={n} className="flex items-center gap-2 text-[12px]"><span className="w-36 shrink-0 font-mono">{n}</span><span className={cn("h-3 rounded-sm bg-violet-500/60")} style={{ width: `${(l / max) * 62}%`, minWidth: 3 }} /><span className="tabular-nums text-muted-foreground">{fmt(l)}</span></li>
          ))}
        </ol>
        <p className="mt-1 text-xs text-muted-foreground">Skills are 37% of the extension code. Much of what reads like core product behaviour (goals, queue, memories, web search, image generation, Guardian review) is built as an extension; that reading is inferred from the crate layout.</p>
      </div>
    </Panel>
  )
}
