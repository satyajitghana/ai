"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The load-bearing decision in TencentDB Agent Memory is not the L0-L3 pyramid,
// it is that each tier is delivered differently depending on how VOLATILE it is.
// Anything that changes turn to turn is kept out of the cached system prompt and
// exposed as a tool instead. Source: MemoryProxy/src/injection/injectors/
// tdai-profile-memory-injector.ts, whose own header comment says L3 goes in
// whole, L2 goes in as a path index only ("L2 全文经常上千 chars x N 个"), and
// L0/L1 are retrieved on demand ("不再自动召回").

const PREFIX = "oklch(0.60 0.15 255)"
const INDEX = "oklch(0.68 0.13 85)"
const TOOL = "oklch(0.62 0.03 250)"

type Mode = "prefix" | "index" | "tool"

const MODE = {
  prefix: { label: "in the cached prefix", color: PREFIX },
  index: { label: "index only", color: INDEX },
  tool: { label: "tool call", color: TOOL },
} as const

const TIERS: {
  id: string
  name: string
  holds: string
  volatility: string
  mode: Mode
  detail: string
}[] = [
  {
    id: "L3",
    name: "Persona",
    holds: "long-term profile, stable patterns",
    volatility: "changes rarely",
    mode: "prefix",
    detail: "Injected in full, once, after session registration. Short and stable enough that it can sit in the part of the prompt the provider caches.",
  },
  {
    id: "L2",
    name: "Scenario",
    holds: "knowledge blocks per project or scenario",
    volatility: "changes per project",
    mode: "index",
    detail: "Only the scene-navigation index goes in — paths plus a one-line summary. The full text is often thousands of characters times N blocks, so the agent reads it through a tool when it decides a scene is relevant.",
  },
  {
    id: "L1",
    name: "Atom",
    holds: "facts, preferences, constraints, events",
    volatility: "changes per query",
    mode: "tool",
    detail: "Retrieved with tdai_memory_search: FTS5 BM25 plus vector similarity, merged with reciprocal rank fusion at k=60. Never auto-injected on the proxy path.",
  },
  {
    id: "L0",
    name: "Conversation",
    holds: "raw turns with full context",
    volatility: "grows every turn",
    mode: "tool",
    detail: "Retrieved with tdai_conversation_search, for exact wording, timestamps and provenance. The two search tools share a hard budget of three calls per turn, stated in the injected guide.",
  },
]

export function InjectionPolicy() {
  const [sel, setSel] = useState("L2")
  const tier = TIERS.find((t) => t.id === sel)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          delivery by volatility · tdai-profile-memory-injector.ts
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">click a tier</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(MODE) as Mode[]).map((m) => (
            <span key={m} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MODE[m].color }} />
              {MODE[m].label}
            </span>
          ))}
        </div>

        <div className="space-y-1.5">
          {TIERS.map((t) => {
            const on = t.id === sel
            const m = MODE[t.mode]
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSel(t.id)}
                aria-pressed={on}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-1 items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left transition-colors sm:grid-cols-[auto_minmax(0,9rem)_1fr_auto_auto]",
                  on ? "border-foreground/30 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
                )}
              >
                <span className="font-mono text-[11px] font-medium" style={{ color: m.color }}>
                  {t.id}
                </span>
                <span className="truncate font-mono text-[11px] text-foreground">{t.name}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">{t.holds}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground/80">{t.volatility}</span>
                <span
                  className="w-fit shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] text-white"
                  style={{ background: m.color }}
                >
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]">
            <span style={{ color: MODE[tier.mode].color }}>
              {tier.id} {tier.name}
            </span>
            <span className="text-muted-foreground"> — {tier.detail}</span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read top to bottom, the tiers are sorted by how often they change, and the delivery mechanism tracks that
          exactly. This is not a summarization hierarchy that happens to have four levels — it is a{" "}
          <span className="text-foreground">cache-stability hierarchy</span>. Anything injected into the system
          prompt that differs from last turn invalidates the provider&rsquo;s prompt cache and makes you re-pay for
          the whole prefix, so only the tiers that rarely change are allowed to live there. Everything volatile is
          demoted to a tool call, where it costs tokens once, in the turn that needed it.
        </p>
      </div>
    </figure>
  )
}
