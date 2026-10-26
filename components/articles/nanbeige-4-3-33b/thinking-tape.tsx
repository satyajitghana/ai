"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What preserve_thinking changes in the prompt an agent re-sends. I rendered
// the model's own chat template and found that the flag only affects assistant
// messages BEFORE the latest user message: inside one task's tool loop the
// reasoning is always kept. So the cost shows up across follow-up requests in a
// session. Fixed parts are token counts I measured with the model's tokenizer
// (system and tool block 274 tokens, the empty-think wrapper 6). The rest are
// sliders. Reasoned arithmetic: at the start of request n the prompt holds
// n-1 earlier requests; each carries its steps' reasoning when the flag is on,
// or only the 6-token empty wrapper per step when it is off.

const SYS = 274
const EMPTY_THINK = 6
const USER = 12
const ACT = 30 // a short tool call plus its tool response, schematic

export function ThinkingTape() {
  const [keep, setKeep] = useState(true)
  const [think, setThink] = useState(800)
  const [steps, setSteps] = useState(6)
  const [turns, setTurns] = useState(8)

  const perReq = (k: boolean) => USER + steps * (ACT + (k ? think : EMPTY_THINK))
  const prompt = (t: number, k: boolean) => SYS + (t - 1) * perReq(k)
  const total = (n: number, k: boolean) => {
    let s = 0
    for (let t = 1; t <= n; t++) s += prompt(t, k)
    return s
  }
  const last = prompt(turns, keep)
  const maxBar = prompt(turns, true)
  const bars = Array.from({ length: turns }, (_, i) => i + 1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">prompt tokens at the start of each request</span>
        <div className="flex gap-1">
          {[true, false].map((k) => (
            <button
              key={String(k)}
              type="button"
              onClick={() => setKeep(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                keep === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              preserve_thinking={String(k)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        <div>
          <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
            <span>reasoning per step</span>
            <span>{think} tokens</span>
          </div>
          <Range min={100} max={4000} step={100} value={think} onChange={(e) => setThink(Number(e.target.value))} aria-label="Reasoning tokens per step" />
        </div>
        <div>
          <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
            <span>tool steps per request</span>
            <span>{steps}</span>
          </div>
          <Range min={1} max={20} step={1} value={steps} onChange={(e) => setSteps(Number(e.target.value))} aria-label="Tool steps per request" />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
            <span>user requests in the session</span>
            <span>{turns}</span>
          </div>
          <Range min={2} max={30} step={1} value={turns} onChange={(e) => setTurns(Number(e.target.value))} aria-label="Number of user requests" />
        </div>
      </div>
      <div className="px-3 pb-3 sm:px-4">
        <svg viewBox="0 0 400 90" className="w-full" role="img" aria-label={`Bars show the prompt length at the start of each of ${turns} requests. Request ${turns} starts with ${last.toLocaleString("en-US")} tokens.`}>
          {bars.map((t) => {
            const w = 400 / turns
            const h = Math.max(1, (prompt(t, keep) / maxBar) * 84)
            return <rect key={t} x={(t - 1) * w + 1} y={88 - h} width={Math.max(1, w - 2)} height={h} rx="1" fill={keep ? "oklch(0.66 0.14 70)" : "oklch(0.62 0.12 190)"} fillOpacity="0.85" />
          })}
        </svg>
      </div>
      <dl className="grid grid-cols-3 gap-px border-t bg-border text-sm">
        {[
          [`request ${turns} starts at`, `${last.toLocaleString("en-US")} tok`],
          ["all requests, summed", `${total(turns, keep).toLocaleString("en-US")} tok`],
          ["keep ÷ drop", `${(total(turns, true) / total(turns, false)).toFixed(1)}×`],
        ].map(([k, v]) => (
          <div key={k} className="bg-background px-3 py-2">
            <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
            <dd className="font-mono text-base">{v}</dd>
          </div>
        ))}
      </dl>
      <figcaption className="px-4 py-2.5 text-xs text-muted-foreground">
        Reasoned. Start-of-request sizes only; inside a request the reasoning is kept either way, so real prompts end larger.
        Sums prefill tokens as if no prefix cache existed. The 30-token action per step is a schematic stand-in.
      </figcaption>
    </figure>
  )
}
