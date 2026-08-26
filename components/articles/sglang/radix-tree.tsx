"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// RadixAttention, as python/sglang/srt/mem_cache/radix_cache.py implements it.
//
// The KV cache is a radix tree over token prefixes rather than a flat map of
// blocks. Requests sharing a prefix share the path through the tree, and a new
// request that diverges causes a node *split* rather than a new allocation.
//
// The part that makes it a cache rather than a nice diagram is the accounting.
// Each TreeNode carries `lock_ref`, `last_access_time` and `priority`, and:
//
//   inc_lock_ref: if node.lock_ref == 0:
//                     self.evictable_size_ -= len(node.key)
//                     self.protected_size_ += len(node.key)
//
// So a prefix that some in-flight request still needs is *protected*, not
// merely recent. Plain LRU would happily evict it. And eviction runs off a heap
// (`heapq`), so it is priority-ordered rather than strictly least-recent — and
// when a leaf is evicted and its parent is left childless and unlocked, the
// parent is pushed back onto the heap, so the eviction cascades up the trunk.

const SHARED = "oklch(0.55 0.16 155)"
const OWN = "oklch(0.60 0.15 255)"
const LOCKED = "oklch(0.68 0.13 85)"
const EVICT = "oklch(0.58 0.19 27)"

type Node = { id: string; label: string; tokens: number; x: number; y: number; parent?: string; owners: string[] }

const NODES: Node[] = [
  { id: "root", label: "root", tokens: 0, x: 60, y: 100, owners: [] },
  { id: "sys", label: '"You are a helpful…"', tokens: 96, x: 190, y: 100, parent: "root", owners: ["A", "B", "C"] },
  { id: "few", label: "few-shot block", tokens: 128, x: 380, y: 62, parent: "sys", owners: ["A", "B"] },
  { id: "a", label: "request A tail", tokens: 64, x: 560, y: 34, parent: "few", owners: ["A"] },
  { id: "b", label: "request B tail", tokens: 48, x: 560, y: 90, parent: "few", owners: ["B"] },
  { id: "c", label: "request C tail", tokens: 80, x: 380, y: 150, parent: "sys", owners: ["C"] },
]

const REQS = ["A", "B", "C"] as const

export function RadixTree() {
  const [running, setRunning] = useState<string[]>(["A"])
  const [evicting, setEvicting] = useState(false)

  const toggle = (r: string) =>
    setRunning((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))

  // a node is locked if any of its owners is a running request
  const locked = (n: Node) => n.owners.some((o) => running.includes(o))
  const protectedTokens = NODES.filter(locked).reduce((a, n) => a + n.tokens, 0)
  const evictableTokens = NODES.filter((n) => !locked(n) && n.tokens > 0).reduce((a, n) => a + n.tokens, 0)

  // eviction takes unlocked leaves first, then cascades to newly-childless parents
  const evictOrder: string[] = []
  if (evicting) {
    const alive = new Set(NODES.filter((n) => n.tokens > 0).map((n) => n.id))
    let changed = true
    while (changed) {
      changed = false
      for (const n of NODES) {
        if (!alive.has(n.id) || locked(n)) continue
        const hasChild = NODES.some((c) => c.parent === n.id && alive.has(c.id))
        if (!hasChild) {
          alive.delete(n.id)
          evictOrder.push(n.id)
          changed = true
        }
      }
    }
  }
  const evicted = new Set(evictOrder)

  const W = 700
  const H = 190

  const colourOf = (n: Node) =>
    evicted.has(n.id) ? EVICT : locked(n) ? LOCKED : n.owners.length > 1 ? SHARED : OWN

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          three requests sharing a system prompt
        </span>
        <span className="font-mono text-[10px]" style={{ color: LOCKED }}>
          {protectedTokens} tokens protected · {evictableTokens} evictable
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">in flight:</span>
          {REQS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r)}
              aria-pressed={running.includes(r)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                running.includes(r)
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              request {r}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEvicting((v) => !v)}
            aria-pressed={evicting}
            className={cn(
              "ml-2 cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              evicting
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            run eviction
          </button>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A radix tree of KV cache prefixes. A shared system prompt node branches into a few-shot node used by two requests and a third request's own tail. ${protectedTokens} tokens are protected by in-flight requests and ${evictableTokens} are evictable.${evicting ? ` Eviction removed ${evictOrder.length} nodes, cascading from leaves toward the root.` : ""}`}
            </title>

            {NODES.filter((n) => n.parent).map((n) => {
              const p = NODES.find((x) => x.id === n.parent)!
              const gone = evicted.has(n.id)
              return (
                <line
                  key={n.id}
                  x1={p.x + 42}
                  y1={p.y}
                  x2={n.x - 42}
                  y2={n.y}
                  stroke={gone ? EVICT : colourOf(n)}
                  strokeOpacity={gone ? 0.3 : 0.5}
                  strokeWidth={1.6}
                  strokeDasharray={gone ? "3 3" : undefined}
                />
              )
            })}

            {NODES.map((n) => {
              const gone = evicted.has(n.id)
              const c = colourOf(n)
              return (
                <g key={n.id} opacity={gone ? 0.35 : 1}>
                  <rect
                    x={n.x - 42}
                    y={n.y - 15}
                    width={84}
                    height={30}
                    rx={5}
                    fill={c}
                    fillOpacity={n.id === "root" ? 0.08 : 0.16}
                    stroke={c}
                    strokeOpacity={0.75}
                    strokeDasharray={gone ? "3 3" : undefined}
                  />
                  <text x={n.x} y={n.y - 2} fontSize={7.5} textAnchor="middle" fill={c} fontFamily="ui-monospace, monospace">
                    {n.label.length > 17 ? `${n.label.slice(0, 16)}…` : n.label}
                  </text>
                  <text x={n.x} y={n.y + 9} fontSize={7} textAnchor="middle" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                    {n.tokens ? `${n.tokens} tok` : "—"}
                    {locked(n) && !gone ? " · locked" : ""}
                  </text>
                </g>
              )
            })}

            {(
              [
                ["shared by several requests", SHARED, 0],
                ["single owner", OWN, 168],
                ["lock_ref > 0 — cannot be evicted", LOCKED, 262],
                ["evicted", EVICT, 452],
              ] as const
            ).map(([label, colour, dx]) => (
              <g key={label}>
                <rect x={20 + dx} y={H - 14} width={8} height={8} rx={1.5} fill={colour} fillOpacity={0.7} />
                <text x={20 + dx + 12} y={H - 7} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          vLLM hashes fixed-size blocks and looks them up in a map. SGLang keeps the prefixes in a
          radix tree, and the difference shows when a request <em>diverges</em>: the tree{" "}
          <span className="text-foreground">splits a node</span>{" "}at the divergence point, and the
          common part stays one object with one refcount rather than a run of separately-hashed
          blocks. For an agent that forks a conversation five ways, that is the natural shape.
          <br />
          <br />
          The accounting is what makes it a cache. Toggle the in-flight requests and watch the{" "}
          <span style={{ color: LOCKED }}>protected</span>{" "}total move: `inc_lock_ref` shifts a
          node&rsquo;s tokens out of `evictable_size_` and into `protected_size_`, so a prefix some
          running request still needs is not merely recent — it is{" "}
          <span className="text-foreground">structurally ineligible for eviction</span>. Plain LRU
          would evict it and then have to recompute it.
          <br />
          <br />
          Then press &ldquo;run eviction&rdquo; with nothing in flight. Eviction pops from a heap
          rather than a queue — it is priority-ordered, not strictly least-recent — and when a leaf
          goes and leaves its parent childless and unlocked, the parent is pushed back onto the heap.
          The eviction walks up the trunk, which is exactly right: an interior prefix is only worth
          keeping while something below it is.
        </p>
      </div>
    </figure>
  )
}
