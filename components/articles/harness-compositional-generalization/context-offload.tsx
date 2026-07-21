"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The mechanism that makes calls locally in-distribution: context offloading.
// A ReAct/CodeAct-style agent appends every raw observation (tool output, a
// retrieved document, a sub-agent's answer) to its context, which grows without
// bound and drifts out of distribution — "context rot." An RLM instead stores
// each observation in a REPL variable and passes a tiny symbolic handle; the
// root LM only ever sees a short, task-agnostic prefix. Drag the number of
// steps and watch the two root-context sizes diverge.

const OOD = "oklch(0.62 0.19 25)"
const IN = "oklch(0.64 0.15 155)"

const BASE = 1.5 // system + task prompt (k tokens)
const OBS = 12 // one raw observation appended (k tokens)
const HANDLE = 0.15 // one symbolic variable handle (k tokens)
const PROBE = 1.2 // small probe context the root peeks at
const ROT = 64 // where context rot / OOD begins (k tokens)

export function ContextOffload() {
  const [steps, setSteps] = useState(8)

  const append = BASE + steps * OBS
  const offload = BASE + PROBE + steps * HANDLE
  const ratio = append / offload
  const max = BASE + 20 * OBS // scale bars to the worst case at steps = 20

  const bar = (label: string, tokens: number, color: string, rot: boolean) => (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums" style={{ color: rot ? OOD : color }}>
          {tokens < 10 ? tokens.toFixed(1) : Math.round(tokens)}k tokens{rot ? " · rotting" : ""}
        </span>
      </div>
      <div className="relative h-8 w-full overflow-hidden rounded-md bg-muted/30">
        <div
          className="h-full rounded-md transition-[width] duration-150"
          style={{ width: `${Math.min(100, (tokens / max) * 100)}%`, background: color }}
        />
        {/* context-rot threshold marker */}
        <div
          className="absolute inset-y-0 border-l border-dashed"
          style={{ left: `${(ROT / max) * 100}%`, borderColor: OOD }}
          title={`context rot begins ~${ROT}k`}
        />
      </div>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        what the root LM sees · append everything vs. offload to variables
      </div>
      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {bar(`append (ReAct / CodeAct) — ${steps} raw observations in context`, append, OOD, append > ROT)}
          {bar(`offload (RLM) — ${steps} symbolic handles + a short probe`, offload, IN, false)}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">append context</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: OOD }}>{Math.round(append)}k</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">offload context</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: IN }}>{offload.toFixed(1)}k</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">smaller by</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{Math.round(ratio)}×</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>task steps — tool calls, retrievals, sub-agent answers</span>
            <span className="tabular-nums text-foreground">{steps}</span>
          </div>
          <Range
            min={2}
            max={20}
            step={1}
            value={steps}
            onChange={(e) => setSteps(+e.target.value)}
            className="w-full"
            aria-label="number of task steps"
            accent={IN}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Appending raw observations makes the root context grow with the task and cross into the regime
          where models degrade (<span style={{ color: OOD }}>context rot</span>, past the dashed line).
          Offloading keeps each observation in a variable and passes only a{" "}
          <span style={{ color: IN }}>tiny handle</span>, so the root LM&apos;s view stays a short,
          task-agnostic prefix no matter how big the task gets — the same short prefix it was trained on.
        </p>
      </div>
    </figure>
  )
}
