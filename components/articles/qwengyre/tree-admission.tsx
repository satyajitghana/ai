"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The trajectory processor's admission rule (paper Section 5.3 and Appendix C)
// on a tree with the shape of the paper's case study, execution f3ad38e5: two
// main task-driving leaves, one main summary, six sub-agent leaves and one
// sub-agent summary (ten leaves; the main agent and the catalog sub-agent each
// compact once). Segment sizes are scaled from the message counts in the
// paper's Figure 12, in arbitrary units; how much of each segment is policy
// output versus context is invented, and the paper says itself that message
// counts cannot give the token probabilities.
//
// The paper draws a leaf within a class with probability proportional to its
// still-unmasked trainable tokens. To keep the page deterministic this widget
// always takes the most likely draw (the leaf with the most unmasked tokens).

type Role = "main" | "main-summary" | "sub-agent" | "sub-agent-summary"
const PRIORITY: Role[] = ["main", "main-summary", "sub-agent", "sub-agent-summary"]

type Node = { id: string; parent: string | null; label: string; policy: number; ctx: number; role?: Role }

// policy = tokens the rollout policy generated (eligible targets); ctx = everything else
// (system prompt, user prompt, tool results, a summary re-inserted as a user message)
const NODES: Node[] = [
  { id: "ms", parent: null, label: "main system prompt", policy: 0, ctx: 4 },
  { id: "m1", parent: "ms", label: "main prefix (168 messages)", policy: 42, ctx: 101 },
  { id: "mA", parent: "m1", label: "main trajectory", policy: 1, ctx: 0, role: "main" },
  { id: "mS", parent: "m1", label: "main summary", policy: 3, ctx: 1, role: "main-summary" },
  { id: "mC", parent: "ms", label: "main after compaction", policy: 43, ctx: 103, role: "main" },
  { id: "ss", parent: null, label: "sub-agent system prompt", policy: 0, ctx: 4 },
  { id: "c1", parent: "ss", label: "catalog prefix (193 messages)", policy: 48, ctx: 116 },
  { id: "cA", parent: "c1", label: "catalog trajectory", policy: 1, ctx: 0, role: "sub-agent" },
  { id: "cS", parent: "c1", label: "catalog summary", policy: 3, ctx: 1, role: "sub-agent-summary" },
  { id: "cC", parent: "ss", label: "catalog after compaction", policy: 73, ctx: 175, role: "sub-agent" },
  { id: "fr", parent: "ss", label: "Frames sub-agent", policy: 35, ctx: 84, role: "sub-agent" },
  { id: "fl", parent: "ss", label: "Flight sub-agent", policy: 31, ctx: 73, role: "sub-agent" },
  { id: "f1", parent: "ss", label: "FDW attempt 1 (interrupted)", policy: 13, ctx: 31, role: "sub-agent" },
  { id: "f2", parent: "ss", label: "FDW attempt 2", policy: 50, ctx: 121, role: "sub-agent" },
]
const BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]))
const LEAVES = NODES.filter((n) => n.role)

function path(id: string): Node[] {
  const out: Node[] = []
  let n: Node | undefined = BY_ID[id]
  while (n) {
    out.unshift(n)
    n = n.parent ? BY_ID[n.parent] : undefined
  }
  return out
}

const pathPolicy = (id: string) => path(id).reduce((s, n) => s + n.policy, 0)
const pathAll = (id: string) => path(id).reduce((s, n) => s + n.policy + n.ctx, 0)
const TOTAL_TRAINABLE = NODES.reduce((s, n) => s + n.policy, 0)
const MAX_PATH = Math.max(...LEAVES.map((l) => pathAll(l.id)))

type Pick = { id: string; order: number; targets: number }

function admit(jmax: number): Pick[] {
  const masked = new Set<string>()
  const picks: Pick[] = []
  const unmasked = (id: string) => path(id).reduce((s, n) => s + (masked.has(n.id) ? 0 : n.policy), 0)
  while (picks.length < jmax) {
    let chosen: Node | null = null
    for (const role of PRIORITY) {
      const cands = LEAVES.filter((l) => l.role === role && !picks.some((p) => p.id === l.id) && unmasked(l.id) > 0)
      if (cands.length) {
        chosen = cands.reduce((a, b) => (unmasked(b.id) > unmasked(a.id) ? b : a))
        break
      }
    }
    if (!chosen) break
    picks.push({ id: chosen.id, order: picks.length + 1, targets: unmasked(chosen.id) })
    for (const n of path(chosen.id)) masked.add(n.id)
  }
  return picks
}

export function TreeAdmission() {
  const [jmax, setJmax] = useState(5)
  const [flat, setFlat] = useState(false)
  const picks = useMemo(() => admit(jmax), [jmax])
  const uncapped = useMemo(() => admit(LEAVES.length), [])

  const trained = picks.reduce((s, p) => s + p.targets, 0)
  const naive = picks.reduce((s, p) => s + pathPolicy(p.id), 0)
  const fwd = picks.reduce((s, p) => s + pathAll(p.id), 0)
  const fwdAll = uncapped.reduce((s, p) => s + pathAll(p.id), 0)
  const pickOf = (id: string) => picks.find((p) => p.id === id)

  const weight = (p: Pick) => (flat ? 1 / picks.length : p.targets / trained)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">One execution, ten leaves: which trajectories get trained</span>
        <span className="font-mono text-[11px] text-muted-foreground">shape from the paper&apos;s case study; sizes scaled from its message counts</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 grid items-end gap-x-6 gap-y-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
            <span>
              trajectory cap J<sub>max</sub>: <span className="text-foreground">{jmax}</span> (the paper trains with 5)
            </span>
            <Range min={1} max={10} step={1} value={jmax} onChange={(e) => setJmax(Number(e.target.value))} aria-label="trajectory cap" />
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <input type="checkbox" checked={flat} onChange={(e) => setFlat(e.target.checked)} />
            show loss weights under a flat mean over trajectories instead
          </label>
        </div>

        <div className="space-y-1">
          {LEAVES.map((leaf) => {
            const p = pickOf(leaf.id)
            const nodes = path(leaf.id)
            const prior = new Set<string>()
            if (p) for (const q of picks) if (q.order < p.order) for (const n of path(q.id)) prior.add(n.id)
            return (
              <div key={leaf.id} className={cn("grid grid-cols-[1.6rem_1fr] items-center gap-2 sm:grid-cols-[1.6rem_15rem_1fr_4.5rem]", !p && "opacity-55 dark:opacity-70")}>
                <span className="text-center font-mono text-[11px] text-muted-foreground">{p ? `#${p.order}` : "–"}</span>
                <span className="text-[12px] leading-tight">
                  {leaf.label}
                  <span className="block font-mono text-[10px] text-muted-foreground">{leaf.role}</span>
                </span>
                <div className="col-span-2 flex h-3.5 overflow-hidden rounded-sm sm:col-span-1" style={{ width: `${((100 * pathAll(leaf.id)) / MAX_PATH).toFixed(2)}%` }}>
                  {nodes.map((n) => {
                    const total = n.policy + n.ctx
                    const isTarget = p && !prior.has(n.id) && n.policy > 0
                    return (
                      <div key={n.id} className="flex h-full" style={{ flexGrow: total, flexBasis: 0 }} title={n.label}>
                        <div style={{ flexGrow: n.ctx, flexBasis: 0 }} className="h-full bg-muted-foreground/20" />
                        {n.policy > 0 && (
                          <div
                            style={{ flexGrow: n.policy, flexBasis: 0, background: isTarget ? "oklch(0.68 0.15 18)" : "oklch(0.68 0.15 18 / 0.18)" }}
                            className="h-full border-l border-background"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                <span className="hidden text-right font-mono text-[11px] sm:block">
                  {p ? (
                    <>
                      {p.targets} tok
                      <span className="block text-[10px] text-muted-foreground">w {(100 * weight(p)).toFixed(0)}%</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">not admitted</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-muted-foreground/20" /> context only (prompts, tool output)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "oklch(0.68 0.15 18)" }} /> trained here
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "oklch(0.68 0.15 18 / 0.18)" }} /> policy tokens already trained on an earlier path, or never admitted
          </span>
        </div>

        <div className="mt-3 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">targets trained</div>
            <div className="text-sm">
              {trained} of {TOTAL_TRAINABLE} tok
            </div>
            <div className="text-[10.5px] text-muted-foreground">each counted once</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">if every copy were trained</div>
            <div className="text-sm">{naive} tok</div>
            <div className="text-[10.5px] text-muted-foreground">{naive - trained} would be repeats of a shared prefix</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">forward tokens vs uncapped</div>
            <div className="text-sm">{((100 * fwd) / fwdAll).toFixed(0)}%</div>
            <div className="text-[10.5px] text-muted-foreground">
              {fwd} of {fwdAll}, context included
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
