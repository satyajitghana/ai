"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Chip, Panel, Src, type Tone } from "./ui"

// features/src/lib.rs: 201 specs, parsed by script (enum Stage at :52). Stage counts: UnderDevelopment 85, Stable 61, Removed 47,
// Experimental 4, Deprecated 3, and one spec (PreventIdleSleep) whose stage is chosen by a cfg. Default-on: Stable 55, Removed 10, UnderDevelopment 1.
const STAGES: { id: string; n: number; on: number; tone: Tone; note: string; keys: string[] }[] = [
  { id: "UnderDevelopment", n: 85, on: 1, tone: "amber", note: "Not ready for external use. One of the 85 is on by default (instant_interrupt).", keys: ["code_mode", "code_mode_only", "code_mode_prewarm", "tui_multi_backend", "mcp_2026_07_28", "mcp_connection_sharing", "enable_mcp_apps", "agent_message_board", "wake_on_agent_messages", "windows_sandbox_service", "prefer_mxc", "credential_masking", "request_permissions_tool", "skill_catalog_deltas", "executor_capability_discovery", "guardian_* and guardianv* (several)"] },
  { id: "Stable", n: 61, on: 55, tone: "emerald", note: "The flag is kept for ad-hoc switching. 55 of the 61 are on by default.", keys: ["shell_tool", "view_image", "unified_exec", "shell_snapshot", "hooks", "multi_agent", "apps", "plugins", "skill_search", "guardian_approval", "goals", "image_generation", "deferred_tool_world_state", "incremental_tools", "tool_call_mcp_elicitation", "computer_use", "browser_use", "code_mode_host", "code_mode_interrupt", "daemon_auto_start"] },
  { id: "Removed", n: 47, on: 10, tone: "slate", note: "The flag does nothing and stays only for backward compatibility: features graduate into the code and the switch is deleted.", keys: ["collaboration_modes (graduated into always-on behaviour)"] },
  { id: "Experimental", n: 4, on: 0, tone: "sky", note: "Offered through the /experimental menu.", keys: ["analytics_plan_history", "login_shell_package_path", "network_proxy", "respect_system_proxy"] },
  { id: "Deprecated", n: 3, on: 0, tone: "rose", note: "Should not be used any more.", keys: ["web_search_request", "web_search_cached", "use_legacy_landlock"] },
]

export function FlagFunnel() {
  const [s, setS] = useState("Stable")
  const cur = STAGES.find((x) => x.id === s) ?? STAGES[1]
  return (
    <Panel title="201 feature flags, and where each one sits in its life" sub="parsed from features/src/lib.rs">
      <ul className="space-y-1.5">
        {STAGES.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => setS(x.id)} className={cn("flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-muted", s === x.id && "bg-muted")}>
              <span className="w-32 shrink-0 text-[12.5px] font-medium">{x.id}</span>
              <span className="relative h-5 flex-1 overflow-hidden rounded bg-muted/50">
                <span className="absolute inset-y-0 left-0 rounded bg-foreground/20" style={{ width: `${(x.n / 85) * 100}%` }} />
                <span className="absolute inset-y-0 left-0 rounded bg-emerald-500/60" style={{ width: `${(x.on / 85) * 100}%` }} />
              </span>
              <span className="w-24 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">{x.n} <span className="text-emerald-500">({x.on} on)</span></span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        <p className="mb-2 text-muted-foreground">{cur.note}</p>
        <div className="flex flex-wrap gap-1">{cur.keys.map((k) => (<Chip key={k} tone={cur.tone}><code className="font-mono text-[11px]">{k}</code></Chip>))}</div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">The shipped default for most of the interesting behaviour is therefore a catalog or a stable flag, not an experiment: a flag that matters is usually weeks from graduating (inferred from 47 removed flags). One more flag, <code>PreventIdleSleep</code>, picks its stage with a <code>cfg</code>. <Src>features/src/lib.rs:52</Src></p>
    </Panel>
  )
}
