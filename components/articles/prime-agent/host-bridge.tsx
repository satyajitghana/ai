"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The tool schema didn't disappear — it moved. The provider sees one tool
// (`ipython`, one string parameter). Behind the kernel there is a second,
// private surface: typed host requests dispatched over a Jupyter comm named
// `host.request`, registered in _createKernelHostHandlers() in agent-session.ts.
// Five are always present; the rest are registered CONDITIONALLY, so a session
// with goals disabled has no goal.* handler at all — the model can write the
// Python, and it simply has nowhere to land. Names and gate conditions below
// are read off the source.

const ON = "oklch(0.60 0.15 255)"

type Gate = "always" | "goals" | "compact" | "refine" | "heartbeat" | "message" | "observe"

const GATES: { id: Gate; label: string; cond: string; toggleable: boolean }[] = [
  { id: "always", label: "always registered", cond: "—", toggleable: false },
  { id: "goals", label: "goals", cond: "_includeGoals", toggleable: true },
  { id: "compact", label: "compaction", cond: "_includeCompactSkill", toggleable: true },
  { id: "refine", label: "refinement", cond: "_autoRefineAllowedForSession()", toggleable: true },
  { id: "heartbeat", label: "heartbeats", cond: "_rlmHeartbeatController", toggleable: true },
  { id: "message", label: "messaging", cond: "_agentMessageController + skill visible", toggleable: true },
  { id: "observe", label: "observation", cond: "agent-observe skill", toggleable: true },
]

const HANDLERS: { name: string; gate: Gate; note: string }[] = [
  { name: "rlm.run", gate: "always", note: "spawn a child agent; returns at admission" },
  { name: "rlm.find_models", gate: "always", note: "resolve a model for a child" },
  { name: "rlm.list_subagents", gate: "always", note: "recover direct child handles" },
  { name: "rlm.delete_subagent", gate: "always", note: "drop a retained child" },
  { name: "model.info", gate: "always", note: "current model id, provider, modalities" },
  { name: "goal.get", gate: "goals", note: "read the persistent objective" },
  { name: "goal.create", gate: "goals", note: "open one, with optional token budget" },
  { name: "goal.complete", gate: "goals", note: "the only way a goal ends successfully" },
  { name: "compact.status", gate: "compact", note: "how close context is to the threshold" },
  { name: "compact.run", gate: "compact", note: "compact now, with optional instructions" },
  { name: "refine.status", gate: "refine", note: "current continual-harness state" },
  { name: "refine.run", gate: "refine", note: "propose evidence-backed harness edits" },
  { name: "rlm_heartbeat.list", gate: "heartbeat", note: "agent-owned recurring prompts" },
  { name: "rlm_heartbeat.create", gate: "heartbeat", note: "add one, with an interval and label" },
  { name: "rlm_heartbeat.update", gate: "heartbeat", note: "pause, resume, or edit" },
  { name: "rlm_heartbeat.delete", gate: "heartbeat", note: "remove one" },
  { name: "agent_message.list_agents", gate: "message", note: "parent, siblings, children" },
  { name: "agent_message.send", gate: "message", note: "role-addressed; validated host-side" },
  { name: "agent_observe.list", gate: "observe", note: "family sessions you may watch" },
  { name: "agent_observe.get", gate: "observe", note: "read another session's transcript" },
  { name: "agent_observe.recent", gate: "observe", note: "its latest activity" },
]

export function HostBridge() {
  const [off, setOff] = useState<Set<Gate>>(new Set())

  const toggle = (g: Gate) =>
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })

  const live = HANDLERS.filter((h) => !off.has(h.gate))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          agent-session.ts · _createKernelHostHandlers()
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {live.length} of {HANDLERS.length} reachable
        </span>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,15rem)_1fr]">
        {/* left — what the provider sees */}
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            what the provider sees
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="font-mono text-[11px] text-foreground">ipython</div>
            <div className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">
              code: string
            </div>
            <div className="mt-2 border-t pt-2 font-mono text-[10px] leading-4 text-muted-foreground">
              1 tool · 1 parameter
              <br />
              re-sent every turn
            </div>
          </div>
          <div className="rounded-lg border border-dashed px-3 py-2 font-mono text-[10px] leading-4 text-muted-foreground">
            everything on the right costs
            <br />
            zero prompt tokens per turn
          </div>
        </div>

        {/* right — the typed bridge */}
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            what the kernel can reach — click a gate to close it
          </div>

          <div className="flex flex-wrap gap-1.5">
            {GATES.map((g) => {
              const disabled = off.has(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!g.toggleable}
                  onClick={() => g.toggleable && toggle(g.id)}
                  aria-pressed={g.toggleable ? !disabled : undefined}
                  title={g.cond}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                    !g.toggleable && "cursor-default border-dashed text-muted-foreground",
                    g.toggleable && !disabled && "cursor-pointer border-transparent text-white",
                    g.toggleable && disabled && "cursor-pointer border-border text-muted-foreground line-through",
                  )}
                  style={g.toggleable && !disabled ? { background: ON } : undefined}
                >
                  {g.label}
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border bg-background/60 p-2">
            <div className="space-y-0.5">
              {HANDLERS.map((h) => {
                const disabled = off.has(h.gate)
                return (
                  <div
                    key={h.name}
                    className={cn(
                      "grid grid-cols-1 gap-x-3 rounded px-2 py-1 transition-opacity sm:grid-cols-[minmax(0,12.5rem)_1fr]",
                      disabled ? "opacity-30" : "opacity-100",
                    )}
                  >
                    <span
                      className={cn("truncate font-mono text-[11px]", disabled && "line-through")}
                      style={{ color: disabled ? undefined : ON }}
                    >
                      {h.name}
                    </span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground">{h.note}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 sm:px-4">
        <p className="text-sm leading-6 text-muted-foreground">
          The schema did not go away — it moved out of the provider payload and into a private bridge. Model-generated
          Python reaches these through a Jupyter comm target named{" "}
          <span className="font-mono text-foreground">host.request</span>; each one is a typed handler that validates
          its own arguments in TypeScript and throws on anything malformed. Two consequences worth separating. The
          cheap one: a twenty-one-entry surface that costs nothing per turn, because it is never serialized into the
          prompt. The load-bearing one: most of these are registered{" "}
          <em>conditionally</em>. Close a gate above and the handler is not merely discouraged — it is absent from the
          dispatch table, so the model can write the call and get an error back from the host. That is capability
          gating in code, not an instruction it could argue with.
        </p>
      </div>
    </figure>
  )
}
