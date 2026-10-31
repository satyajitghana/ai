"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Chip, Ev, Panel, Src, Tag } from "./ui"

// What the model sees in code mode: two tools, exec and wait (code-mode-protocol/src/lib.rs:60-61, description.rs:23-48).
// Which mode a turn uses: core/src/tools/mod.rs:66-90 requested_tool_mode: the catalog's tool_mode wins; the feature flags are only the fallback.
type Mode = "Direct" | "CodeMode" | "CodeModeOnly"

function requested(catalog: Mode | null, codeMode: boolean, codeModeOnly: boolean): Mode {
  if (catalog) return catalog
  if (codeModeOnly) return "CodeModeOnly"
  if (codeMode) return "CodeMode"
  return "Direct"
}

const GLOBALS = ["tools.<name>(…)", "text()  image()  audio()", "store(key, value)  load(key)", "notify()", "yield_control()", "ALL_TOOLS", "setTimeout()", "exit()"]

export function CodeModeCutaway() {
  const [catalog, setCatalog] = useState<Mode | null>("CodeModeOnly")
  const [cm, setCm] = useState(false)
  const [cmo, setCmo] = useState(false)
  const mode = requested(catalog, cm, cmo)
  return (
    <Panel title="Code mode: one JavaScript cell instead of a list of tools" sub="the V8 runtime is open; whether a model uses it is decided by its catalog entry">
      <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_1fr]">
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-[12.5px]">
          <div className="mb-1 font-medium">The model sees two tools</div>
          <code className="block font-mono text-[12px]">exec(js)</code>
          <code className="block font-mono text-[12px]">wait(cell_id)</code>
          <p className="mt-2 text-muted-foreground">10,000 ms and 10,000 output tokens per call by default; a first-line pragma <code>{"// @exec: "}{"{…}"}</code> changes them.</p>
        </div>
        <div className="rounded-lg border-2 border-dashed border-violet-500/60 bg-violet-500/10 p-3 text-[12.5px]">
          <div className="mb-1 flex flex-wrap items-center gap-2 font-medium">A fresh V8 isolate, async module <Ev kind="READ" /></div>
          <p className="mb-2 text-muted-foreground">Raw JavaScript: no Node, no file system, no network, no console. When the cell ends the isolate ends and unawaited promises are discarded.</p>
          <div className="flex flex-wrap gap-1">{GLOBALS.map((g) => (<code key={g} className="rounded border border-violet-500/40 bg-background/60 px-1.5 py-0.5 font-mono text-[11px]">{g}</code>))}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-[12.5px]">
          <div className="mb-1 font-medium">The ordinary tools, as functions</div>
          <p className="text-muted-foreground"><code>await tools.exec_command(…)</code>, MCP tools as <code>tools.mcp__server__name</code>, and deferred ones found with <code>tools.tool_search({"{query}"})</code>, a BM25-ranked search that returns TypeScript declarations.</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="mb-2 text-sm font-medium">Which mode does a turn get?</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-muted-foreground">catalog tool_mode:</span>
          {([["none", null], ["code_mode_only", "CodeModeOnly"], ["code_mode", "CodeMode"], ["direct", "Direct"]] as const).map(([l, v]) => (<Chip key={l} active={catalog === v} onClick={() => setCatalog(v)}>{l}</Chip>))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={cm} onChange={(e) => setCm(e.target.checked)} /> feature <code>code_mode</code></label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={cmo} onChange={(e) => setCmo(e.target.checked)} /> feature <code>code_mode_only</code></label>
          <span>(both under development, off by default)</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]"><Tag tone={mode === "Direct" ? "slate" : "violet"}>{mode}</Tag><span className="text-muted-foreground">{catalog ? "the catalog entry decides; the flags are ignored" : "no catalog value: the flags decide"}</span></div>
        <p className={cn("mt-2 text-xs text-muted-foreground")}>In the catalog the repo ships, 11 of 12 models say <code>code_mode_only</code>. The flags <code>code_mode_host</code> and <code>code_mode_interrupt</code> are stable and on. <Src>core/src/tools/mod.rs:66-90</Src> · <Src>session/code_mode_warning.rs</Src></p>
      </div>
    </Panel>
  )
}
