"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The rule that decides which node of a depth-cut tree carries a ref (crates/core/src/refs/ref_alloc.rs,
// `plan_skeleton_anchors`, `is_ref_able`, `is_resolvable_skeleton_anchor`), re-implemented here for a two-level tree:
// window > parent group > the node you configure. Our Python port of the same rules reproduces the repository's golden
// skeleton fixture and its unit-test cases (public/articles/agent-desktop/test_port.py); the presets below are those cases.

type Role = "group" | "button" | "textfield" | "list"
type Actions = "none" | "ubiquitous" | "click"

type Cfg = {
  role: Role
  name: boolean
  nativeId: boolean
  bounds: boolean
  actions: Actions
  cut: boolean // the depth cut left this node with children it did not list (children_count)
  parentNativeId: boolean
}

const INTERACTIVE: Role[] = ["button", "textfield"]

function decide(c: Cfg): { lines: string[]; refs: string[]; verdict: string; tone: "ok" | "warn" } {
  const lines: string[] = []
  const able = INTERACTIVE.includes(c.role) || c.actions === "click"
  lines.push(
    able
      ? `ref-able: ${INTERACTIVE.includes(c.role) ? `role "${c.role}" is one of the 18 interactive roles` : "it advertises a primary action"}`
      : c.actions === "ubiquitous"
        ? `not ref-able: RightClick and ScrollTo are on nearly every web node, so they do not count`
        : `not ref-able: role "${c.role}" is not interactive and it advertises no primary action`
  )
  if (!c.cut) {
    return {
      lines: [...lines, "fully read: no children_count, so nothing needs a drill target"],
      refs: able ? ["the node itself (a normal ref)"] : [],
      verdict: able ? "gets its own ref" : "gets no ref, and needs none",
      tone: "ok",
    }
  }
  lines.push("cut by the depth limit: carries children_count, so it is an uncovered boundary")
  if (able) {
    return { lines: [...lines, "its own ref covers the boundary: drill with --root on it"], refs: ["the node itself (a normal ref)"], verdict: "covered by its own ref", tone: "ok" }
  }
  const resolvable = c.name || c.nativeId || c.bounds
  if (resolvable) {
    const why = [c.name && "a name", c.nativeId && "a native id", c.bounds && "a valid rectangle"].filter(Boolean).join(" and ")
    return {
      lines: [...lines, `a later resolve can re-identify it by ${why}: it becomes a skeleton anchor`, c.actions === "ubiquitous" ? "its entry stores no actions" : "its entry stores no actions (an anchor is a drill target only)"],
      refs: ["the node itself, as an anchor"],
      verdict: "gets an anchor ref",
      tone: "ok",
    }
  }
  lines.push("it has no name, native id or rectangle, so nothing could re-identify it: the boundary passes up to its parent")
  if (c.parentNativeId) {
    return { lines: [...lines, "the parent carries a native id, so the parent becomes the anchor"], refs: ["the parent, as an anchor"], verdict: "the parent gets the anchor", tone: "ok" }
  }
  return {
    lines: [...lines, "the parent has nothing to identify it by either, and the window root cannot be an anchor"],
    refs: [],
    verdict: "no drill target: children_count with no ref",
    tone: "warn",
  }
}

const BASE: Cfg = { role: "group", name: false, nativeId: false, bounds: false, actions: "none", cut: true, parentNativeId: false }

const PRESETS: { id: string; label: string; test: string; cfg: Cfg }[] = [
  { id: "native", label: "unnamed boundary, parent has a native id", test: "native_id_ancestor_covers_unnamed_boundaries", cfg: { ...BASE, parentNativeId: true } },
  { id: "web", label: "named web list with only ubiquitous actions", test: "web_boundary_with_only_ubiquitous_affordances_gets_anchor_ref", cfg: { ...BASE, name: true, actions: "ubiquitous" } },
  { id: "bounded", label: "unlabeled boundary with a rectangle", test: "unlabeled_bounded_boundary_gets_drill_ref", cfg: { ...BASE, bounds: true } },
  { id: "nothing", label: "unlabeled boundary, nothing around it", test: "(no test: the case the rule cannot cover)", cfg: BASE },
  { id: "button", label: "a button cut by the depth limit", test: "(interactive role: covered by its own ref)", cfg: { ...BASE, role: "button", name: true } },
]

function Toggle(props: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      onClick={props.onClick}
      className={cn(
        "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
        props.on ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {props.children}
    </button>
  )
}

export function RefLab() {
  const [cfg, setCfg] = useState<Cfg>(PRESETS[0].cfg)
  const [preset, setPreset] = useState<string | null>(PRESETS[0].id)
  const set = (patch: Partial<Cfg>) => {
    setCfg({ ...cfg, ...patch })
    setPreset(null)
  }
  const r = decide(cfg)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        which node gets the ref? · the allocation rule from ref_alloc.rs, on a window &gt; group &gt; your node tree
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">cases from the repo&apos;s tests</span>
        {PRESETS.map((p) => (
          <Toggle
            key={p.id}
            on={preset === p.id}
            onClick={() => {
              setCfg(p.cfg)
              setPreset(p.id)
            }}
          >
            {p.label}
          </Toggle>
        ))}
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
        <div className="space-y-2.5 font-mono text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-muted-foreground">role</span>
            {(["group", "list", "button", "textfield"] as Role[]).map((role) => (
              <Toggle key={role} on={cfg.role === role} onClick={() => set({ role })}>
                {role}
              </Toggle>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-muted-foreground">actions</span>
            {(["none", "ubiquitous", "click"] as Actions[]).map((actions) => (
              <Toggle key={actions} on={cfg.actions === actions} onClick={() => set({ actions })}>
                {actions === "ubiquitous" ? "RightClick, ScrollTo" : actions}
              </Toggle>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-muted-foreground">evidence</span>
            <Toggle on={cfg.name} onClick={() => set({ name: !cfg.name })}>
              a name
            </Toggle>
            <Toggle on={cfg.nativeId} onClick={() => set({ nativeId: !cfg.nativeId })}>
              a native id
            </Toggle>
            <Toggle on={cfg.bounds} onClick={() => set({ bounds: !cfg.bounds })}>
              a rectangle
            </Toggle>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-muted-foreground">depth cut</span>
            <Toggle on={cfg.cut} onClick={() => set({ cut: !cfg.cut })}>
              children_count: 12
            </Toggle>
            <Toggle on={cfg.parentNativeId} onClick={() => set({ parentNativeId: !cfg.parentNativeId })}>
              parent has a native id
            </Toggle>
          </div>
        </div>

        <div className="font-mono text-[11px]" aria-live="polite">
          <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
            {r.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
          <div className={cn("mt-3 rounded border px-2.5 py-2 text-xs", r.tone === "warn" ? "border-foreground/40" : "")}>
            <div className="text-muted-foreground">result</div>
            <div className="text-foreground">{r.verdict}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">refs allocated: {r.refs.length === 0 ? "none" : r.refs.join("; ")}</div>
          </div>
          {preset && <div className="mt-2 text-[10px] text-muted-foreground">{PRESETS.find((p) => p.id === preset)?.test}</div>}
        </div>
      </div>
    </figure>
  )
}
