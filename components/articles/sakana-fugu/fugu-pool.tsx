"use client"

import { useState } from "react"
import {
  CaretDownIcon,
  LightningIcon,
  TargetIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// "Multi-agent system as a model" — one OpenAI-compatible endpoint that hides a
// coordinator over a swappable pool of frontier + open agents. Toggle the tier
// (Fugu vs Fugu Ultra), and click an agent to opt it out (the compliance lever).
// Illustrative, not the real routing (which Sakana keeps proprietary).

type Agent = { name: string; kind: "closed" | "open"; hue: number }

const POOL: Agent[] = [
  { name: "GPT-5", kind: "closed", hue: 150 },
  { name: "Claude-4-Sonnet", kind: "closed", hue: 25 },
  { name: "Gemini-2.5-Pro", kind: "closed", hue: 255 },
  { name: "Qwen3-32B", kind: "open", hue: 295 },
  { name: "DeepSeek-R1-32B", kind: "open", hue: 200 },
  { name: "Gemma-3-27B", kind: "open", hue: 95 },
]

// base Fugu favours a lean, low-latency subset; Ultra coordinates the full pool.
const FUGU_SUBSET = new Set(["GPT-5", "Claude-4-Sonnet", "Qwen3-32B", "Gemma-3-27B"])

export function FuguPool() {
  const [ultra, setUltra] = useState(false)
  const [out, setOut] = useState<Set<string>>(new Set())

  const inTier = (a: Agent) => ultra || FUGU_SUBSET.has(a.name)
  const active = (a: Agent) => inTier(a) && !out.has(a.name)
  const activeCount = POOL.filter(active).length

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">one endpoint · a pool of agents</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "fugu" },
            { v: true, label: "fugu-ultra" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setUltra(o.v)}
              aria-pressed={ultra === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                ultra === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* endpoint */}
        <div className="mx-auto max-w-sm rounded-md border bg-muted/40 px-3 py-2 text-center font-mono text-xs">
          POST /v1/chat · <span className="text-foreground">model: {ultra ? "fugu-ultra" : "fugu"}</span>
        </div>
        <Down />
        {/* coordinator */}
        <div className="mx-auto max-w-xs rounded-md border border-foreground/30 bg-background px-3 py-2 text-center font-mono text-xs">
          coordinator
          <div className="text-[10px] text-muted-foreground">TRINITY · Conductor</div>
        </div>
        <Down />

        {/* pool */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {POOL.map((a) => {
            const on = active(a)
            const dimmed = !inTier(a)
            return (
              <button
                key={a.name}
                type="button"
                onClick={() =>
                  setOut((s) => {
                    const n = new Set(s)
                    if (n.has(a.name)) n.delete(a.name)
                    else n.add(a.name)
                    return n
                  })
                }
                disabled={dimmed}
                title={dimmed ? "not in this tier" : on ? "click to opt out" : "opted out — click to re-enable"}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left font-mono text-xs transition-all",
                  dimmed
                    ? "cursor-not-allowed opacity-30"
                    : "cursor-pointer hover:border-foreground/40",
                  on ? "" : "opacity-45 line-through decoration-foreground/40"
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: `oklch(0.72 0.14 ${a.hue})`, opacity: on ? 1 : 0.3 }}
                />
                <span className="truncate">{a.name}</span>
              </button>
            )
          })}
        </div>

        {/* readout */}
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="agents live" value={`${activeCount}`} />
          <Stat
            label="latency"
            value={ultra ? "higher" : "low"}
            icon={ultra ? <TargetIcon size={12} /> : <LightningIcon size={12} weight="fill" />}
          />
          <Stat label="billing" value="single rate" />
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {ultra
            ? "Fugu Ultra coordinates the deeper pool over more turns — built for hard, high-stakes problems where answer quality beats speed."
            : "Base Fugu favours a lean, low-latency subset for everyday tasks. Opt a model out for compliance and the coordinator simply routes around it."}
        </p>
      </div>
    </figure>
  )
}

function Down() {
  return (
    <div className="flex justify-center py-1.5 text-muted-foreground/50" aria-hidden>
      <CaretDownIcon size={16} weight="fill" />
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1 font-medium text-foreground">
        {icon}
        {value}
      </div>
    </div>
  )
}
