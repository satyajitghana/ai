"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Dream-RSI's own Figure 1 draws the loop as three stages. This redraws it as
// six nodes around a ring and asks the one question that figure elides: WHICH
// of these six things is actually different after a round, and which just ran
// again. Per Sec. 3 ("Dream-RSI: Recursive Self-Improvement through Evolving
// Worlds"): "Only the exploration-policy code changes; the underlying models,
// evaluator, and execution interfaces remain fixed." The discovery agent
// (Gemini-3.1-Pro / 3.7-Flash) never gets a gradient step -- its weights AND
// its prompt (Appendix B.1, static across the whole run) are frozen. The
// policy-development agent that rewrites the exploration policy is itself a
// separate, also-frozen LLM (Appendix B.2). The only artifact that is
// rewritten and re-versioned every outer round is ~150 lines of Python
// implementing `OptimalPolicy.solve()` -- a scheduler, not a model.

type Phase = "online" | "offline"

const ACCENT_ONLINE = "oklch(0.60 0.15 255)" // blue -- online explore edges
const ACCENT_OFFLINE = "oklch(0.65 0.16 45)" // amber -- offline dreaming edges
const ACCENT_POLICY = "oklch(0.62 0.17 25)" // red -- the one node that gets rewritten

type NodeId = "policy" | "agent" | "evaluator" | "history" | "simulator" | "devagent"

type Node = {
  id: NodeId
  x: number
  y: number
  w: number
  label: string
  sub: string
  badge: string
  badgeKind: "frozen" | "rewritten" | "grows"
}

const NODES: Node[] = [
  { id: "policy", x: 380, y: 46, w: 176, label: "Exploration policy", sub: "OptimalPolicy.solve() — Python", badge: "rewritten every round", badgeKind: "rewritten" },
  { id: "agent", x: 634, y: 168, w: 164, label: "Discovery agent", sub: "Gemini-3.1-Pro / 3.7-Flash", badge: "frozen — weights + prompt", badgeKind: "frozen" },
  { id: "evaluator", x: 634, y: 342, w: 150, label: "Evaluator", sub: "fixed scoring protocol", badge: "frozen the whole run", badgeKind: "frozen" },
  { id: "history", x: 380, y: 428, w: 168, label: "Discovery history H", sub: "trees of past attempts", badge: "append-only, grows", badgeKind: "grows" },
  { id: "simulator", x: 126, y: 342, w: 174, label: "Replay simulator pool", sub: "read-only view of H", badge: "rebuilt from H, grows", badgeKind: "grows" },
  { id: "devagent", x: 126, y: 168, w: 178, label: "Policy-dev agent", sub: "a separate, fixed LLM", badge: "frozen the whole run", badgeKind: "frozen" },
]

const NODE_H = 54

// Ring order the loop actually follows: policy -> agent -> evaluator -> history
// (online rollout) -> simulator -> devagent -> policy (offline dreaming).
const ONLINE_EDGES: [NodeId, NodeId][] = [
  ["policy", "agent"],
  ["agent", "evaluator"],
  ["evaluator", "history"],
]
const OFFLINE_EDGES: [NodeId, NodeId][] = [
  ["history", "simulator"],
  ["simulator", "devagent"],
  ["devagent", "policy"],
]

const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<NodeId, Node>

function edgePath(a: NodeId, b: NodeId): string {
  const n1 = byId[a]
  const n2 = byId[b]
  const x1 = n1.x, y1 = n1.y + NODE_H / 2
  const x2 = n2.x, y2 = n2.y - NODE_H / 2
  // route around the ring rather than through the middle
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const cx = mx + (mx - 380) * 0.35
  const cy = my
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

const BADGE_STYLE: Record<Node["badgeKind"], { fg: string; bg: string }> = {
  frozen: { fg: "var(--muted-foreground)", bg: "transparent" },
  rewritten: { fg: ACCENT_POLICY, bg: "color-mix(in oklch, currentColor 12%, transparent)" },
  grows: { fg: ACCENT_OFFLINE, bg: "transparent" },
}

export function LoopArchitecture() {
  const [phase, setPhase] = useState<Phase>("online")

  const activeEdges = phase === "online" ? ONLINE_EDGES : OFFLINE_EDGES
  const activeNodeIds: NodeId[] =
    phase === "online" ? ["policy", "agent", "evaluator", "history"] : ["history", "simulator", "devagent", "policy"]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what updates, what's frozen · one outer round</span>
        <div className="flex gap-1">
          {(["online", "offline"] as Phase[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              aria-pressed={phase === p}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                phase === p ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "online" ? "① online explore" : "② offline dreaming"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 760 480"
          className="w-full"
          role="img"
          aria-label={
            phase === "online"
              ? "Online explore: the current exploration policy drives the discovery agent, the evaluator scores each attempt, and results are appended to the discovery history. The policy-dev agent, replay simulator, and policy code itself are idle this phase."
              : "Offline dreaming: the discovery history feeds a replay simulator pool, which the policy-development agent reads to rewrite the exploration-policy code with no new discovery-agent or evaluator calls. The discovery agent and evaluator are idle this phase."
          }
        >
          <defs>
            <marker id="dr-arrow-on" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT_ONLINE} strokeWidth={1.6} />
            </marker>
            <marker id="dr-arrow-off" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT_OFFLINE} strokeWidth={1.6} />
            </marker>
            <marker id="dr-arrow-dim" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.4} />
            </marker>
            <filter id="dr-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* edges */}
          {[...ONLINE_EDGES, ...OFFLINE_EDGES].map(([a, b]) => {
            const isOnlineEdge = ONLINE_EDGES.some(([x, y]) => x === a && y === b)
            const isActive = activeEdges.some(([x, y]) => x === a && y === b)
            const stroke = isActive ? (isOnlineEdge ? ACCENT_ONLINE : ACCENT_OFFLINE) : "var(--muted-foreground)"
            const marker = isActive ? (isOnlineEdge ? "dr-arrow-on" : "dr-arrow-off") : "dr-arrow-dim"
            return (
              <path
                key={`${a}-${b}`}
                d={edgePath(a, b)}
                fill="none"
                stroke={stroke}
                strokeWidth={isActive ? 2.2 : 1.4}
                strokeDasharray={isActive ? undefined : "3 4"}
                opacity={isActive ? 0.9 : 0.28}
                markerEnd={`url(#${marker})`}
              />
            )
          })}

          {/* nodes */}
          {NODES.map((n) => {
            const active = activeNodeIds.includes(n.id)
            const isPolicy = n.id === "policy"
            const badge = BADGE_STYLE[n.badgeKind]
            return (
              <g key={n.id} opacity={active ? 1 : 0.42}>
                <rect
                  x={n.x - n.w / 2}
                  y={n.y - NODE_H / 2}
                  width={n.w}
                  height={NODE_H}
                  rx={10}
                  fill="var(--background)"
                  stroke={isPolicy ? ACCENT_POLICY : "var(--border)"}
                  strokeWidth={isPolicy ? 2 : 1.4}
                  filter="url(#dr-soft)"
                />
                <text x={n.x} y={n.y - 6} textAnchor="middle" className="fill-foreground font-mono" fontSize={11.5} fontWeight={600}>
                  {n.label}
                </text>
                <text x={n.x} y={n.y + 10} textAnchor="middle" className="font-mono fill-muted-foreground" fontSize={9}>
                  {n.sub}
                </text>
                <text
                  x={n.x}
                  y={n.y + NODE_H / 2 + 15}
                  textAnchor="middle"
                  className="font-mono uppercase"
                  fontSize={8}
                  fontWeight={600}
                  letterSpacing={0.3}
                  fill={badge.fg}
                >
                  {n.badge}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {phase === "online" ? (
            <>
              <strong className="text-foreground">Online explore.</strong> The current policy version guides the
              (frozen) discovery agent through a batch of real attempts; the (frozen) evaluator scores each one;
              results append to the history tree. Nothing about the discovery agent or evaluator changes here — they
              run the same way every round, in round 1 and round 10.
            </>
          ) : (
            <>
              <strong className="text-foreground">Offline dreaming.</strong> No new discovery-agent or evaluator
              calls happen at all. The history becomes a read-only replay simulator; a{" "}
              <em>separate</em> fixed LLM (the policy-development agent) reads replay feedback and rewrites the
              exploration-policy&apos;s Python source. That rewritten code is the entire payload that carries over
              to the next round.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
