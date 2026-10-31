"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Chip, Ev, Panel, Src } from "./ui"

// The 18 world-state section ids (grep of `const ID` under core/src/context/world_state, MEASURED).
const SECTIONS = ["agents_md", "approved_command_prefixes", "apps_instructions", "collaboration_mode", "context_window_guidance", "environments", "environments_instructions", "managed_developer_instructions", "model", "model_catalog", "multi_agent_mode", "multi_agent_usage_hint", "permissions", "persistent_mode", "plugins_instructions", "realtime", "tools", "top_level_tools"]

// Which sections re-render for which change: INFERRED from the section names, not traced through the code.
const EVENTS = [
  { id: "cwd", label: "working directory or sandbox permissions change", sections: ["environments", "permissions"] },
  { id: "model", label: "switch to another model", sections: ["model", "model_catalog", "context_window_guidance"] },
  { id: "mode", label: "toggle plan mode", sections: ["collaboration_mode"] },
  { id: "agents", label: "AGENTS.md is edited", sections: ["agents_md"] },
  { id: "mcp", label: "an MCP server connects and adds tools", sections: ["tools", "top_level_tools"] },
  { id: "plugin", label: "a plugin or app is installed", sections: ["plugins_instructions", "apps_instructions"] },
]

// Illustrative widths of one request, in percent.
const SEG = { base: 12, tools: 14, ctx: 26, hist: 42, diff: 6 }

export function ContextDiff() {
  const [incr, setIncr] = useState(true)
  const [ev, setEv] = useState("cwd")
  const e = EVENTS.find((x) => x.id === ev) ?? EVENTS[0]
  const toolsChange = e.id === "mcp"
  // With incremental tools a tool change is only a diff at the end. Without them it rewrites the tools array.
  const invalidFrom = !incr && toolsChange ? SEG.base : SEG.base + SEG.tools + SEG.ctx + SEG.hist
  const seg = (w: number, label: string, cls: string, empty?: boolean) => (
    <div className={cn("flex h-14 items-center justify-center rounded border px-1 text-center text-[10.5px] leading-tight", cls, empty && "border-dashed bg-transparent text-muted-foreground")} style={{ width: `${w}%` }}>{label}</div>
  )
  return (
    <Panel title="Context is a structure that gets diffed, not a prompt that gets rewritten" sub="18 world-state sections; which ones a change re-renders is inferred from their names">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {EVENTS.map((x) => (
          <Chip key={x.id} tone="amber" active={ev === x.id} onClick={() => setEv(x.id)}>{x.label}</Chip>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip active={incr} onClick={() => setIncr(true)}>incremental tools on (11 of 12 catalog models)</Chip>
        <Chip active={!incr} onClick={() => setIncr(false)}>off (gpt-5.5 only)</Chip>
      </div>
      <div className="flex gap-1" aria-label="One model request, left to right">
        {seg(SEG.base, incr ? "base_instructions: empty" : "system prompt (~3,000 words)", "border-sky-500/50 bg-sky-500/15", incr)}
        {seg(SEG.tools, incr ? "tools[]: empty" : "tools[] full list", "border-sky-500/50 bg-sky-500/15", incr)}
        {seg(SEG.ctx, "initial context: 18 sections", "border-emerald-500/50 bg-emerald-500/15")}
        {seg(SEG.hist, "conversation, tool calls, outputs", "border-border bg-muted/60")}
        {seg(SEG.diff, "diff", "border-amber-500/60 bg-amber-500/25")}
      </div>
      <div className="mt-1 flex">
        <div className="h-1.5 rounded-l bg-emerald-500" style={{ width: `${invalidFrom}%` }} />
        <div className="h-1.5 rounded-r bg-rose-500/70" style={{ width: `${100 - invalidFrom}%` }} />
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {invalidFrom >= 100 - SEG.diff ? (
          <>Everything before the diff is byte-identical to the last request, so the provider&apos;s prompt cache can keep hitting. The change travels as a small message at the end.</>
        ) : (
          <>Without incremental tools the tool list is part of the request head: changing it alters the prefix, and the cache restarts from there.</>
        )}
      </p>
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">Sections re-rendered <Ev kind="INFERRED" /></div>
        <div className="flex flex-wrap gap-1">
          {SECTIONS.map((s) => (
            <code key={s} className={cn("rounded border px-1.5 py-0.5 font-mono text-[11px]", e.sections.includes(s) ? "border-amber-500/60 bg-amber-500/20 text-foreground" : "border-border text-muted-foreground")}>{s}</code>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The mechanism is read: each section has a stable <code>ID</code>, a serializable snapshot and <code>render_diff(previous)</code>; the previous state is Absent, Unknown or Known; a SHA-1 over canonical JSON fingerprints it. <Src>core/src/context/world_state/mod.rs:320-372</Src>
        </p>
      </div>
    </Panel>
  )
}
