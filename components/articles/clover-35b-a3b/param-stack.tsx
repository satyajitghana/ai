"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ACTIVE_PARAMS, DENSE_PARAMS, EXPERT_PARAMS, LAYERS, PARAMS, TOP_K } from "./data"

const COLORS: Record<string, string> = {
  routed: "oklch(0.62 0.15 285)",
  gdn: "oklch(0.64 0.14 200)",
  embed: "oklch(0.70 0.04 250)",
  head: "oklch(0.62 0.15 150)",
  attn: "oklch(0.66 0.15 75)",
  shared: "oklch(0.62 0.17 30)",
  router: "oklch(0.60 0.16 350)",
  bidir: "oklch(0.55 0.20 25)",
  other: "oklch(0.60 0.02 250)",
}

function fmt(n: number): string {
  return n.toLocaleString("en-US")
}

export function ParamStack() {
  const [hover, setHover] = useState<string | null>("routed")
  const parts = PARAMS.parts
  const active = parts.find((p) => p.key === hover) ?? parts[0]
  const perToken = EXPERT_PARAMS * TOP_K * LAYERS
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        where the 34.66 billion parameters are · summed from the safetensors headers
      </div>
      <div className="px-4 pt-4">
        <div className="flex h-8 w-full overflow-hidden rounded bg-muted" role="img" aria-label="A stacked bar of the checkpoint's parameters. Routed experts are 92.9 percent.">
          {parts.map((p) => (
            <button
              key={p.key}
              type="button"
              onMouseEnter={() => setHover(p.key)}
              onFocus={() => setHover(p.key)}
              onClick={() => setHover(p.key)}
              aria-label={`${p.label}: ${fmt(p.n)} parameters, ${((p.n / PARAMS.total) * 100).toFixed(2)} percent`}
              className={cn("h-full outline-offset-2 transition-opacity", hover && hover !== p.key && "opacity-50")}
              style={{ width: `${Math.max(0.3, (p.n / PARAMS.total) * 100)}%`, background: COLORS[p.key] }}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          {parts.map((p) => (
            <button
              key={p.key}
              type="button"
              onMouseEnter={() => setHover(p.key)}
              onFocus={() => setHover(p.key)}
              onClick={() => setHover(p.key)}
              className={cn(
                "flex items-center gap-2 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted",
                hover === p.key && "bg-muted"
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[p.key] }} />
              <span className="flex-1">{p.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">{((p.n / PARAMS.total) * 100).toFixed(2)}%</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 border-t px-4 py-3 text-xs leading-relaxed">
        <div className="font-medium">
          {active.label}: <span className="font-mono tabular-nums">{fmt(active.n)}</span> parameters, {((active.n * 2) / 1e9).toFixed(2)} GB in BF16
        </div>
        {active.note && <div className="text-muted-foreground">{active.note}</div>}
      </div>
      <div className="grid gap-3 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
        <div>
          one expert
          <div className="text-foreground tabular-nums">{fmt(EXPERT_PARAMS)} params, {((EXPERT_PARAMS * 2) / 1e6).toFixed(2)} MB</div>
        </div>
        <div>
          a token&apos;s active weights
          <div className="text-foreground tabular-nums">
            {fmt(DENSE_PARAMS)} + {fmt(perToken)} = {fmt(ACTIVE_PARAMS)}
          </div>
        </div>
        <div>
          read per token, BF16
          <div className="text-foreground tabular-nums">{((ACTIVE_PARAMS * 2) / 1e9).toFixed(2)} GB</div>
        </div>
      </div>
    </figure>
  )
}
