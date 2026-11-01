"use client"

import { useState } from "react"

// Request size against menu size, from two points I measured on the README's triage domain with the view
// holding no logs yet: 6 options (5 logs plus stop) = 111 tokens, 20 options (the pick limit) = 216 tokens,
// switch's estimate at 3 characters per token. The line through them is 66 + 7.5 per option. It is a fit to
// two points on one domain with short option texts, NOT a law: a chess move or a page of text costs more.
const BASE = 66
const PER = 7.5

export function MenuCost() {
  const [choices, setChoices] = useState(50)
  const [limit, setLimit] = useState(20)
  const shown = Math.min(choices + 1, limit) // +1 for the stop choice
  const hidden = Math.max(0, choices + 1 - shown)
  const tokens = Math.round(BASE + PER * shown)
  const uncut = Math.round(BASE + PER * (choices + 1))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what the pick limit does to a request · two-point fit, one domain
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="font-mono text-muted-foreground">choices in the state (plus stop): {choices}</span>
            <input type="range" min={1} max={200} value={choices} onChange={(e) => setChoices(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-muted-foreground">pick limit: {limit}</span>
            <input type="range" min={5} max={60} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        </div>
        <div className="space-y-2 text-sm">
          <svg viewBox="0 0 300 40" className="w-full" role="img" aria-label={`${shown} options shown to the model, ${hidden} hidden by the limit`}>
            {Array.from({ length: Math.min(choices + 1, 60) }, (_, k) => (
              <rect key={k} x={2 + k * 4.9} y={4} width={3.6} height={20} rx={1} fill="var(--foreground)" fillOpacity={k < shown ? 0.8 : 0.15} />
            ))}
            <text x={2} y={37} fontSize={8} className="fill-muted-foreground font-mono">
              {shown} shown · {hidden} hidden{choices + 1 > 60 ? " (first 60 drawn)" : ""}
            </text>
          </svg>
          <div className="font-mono text-xs">
            request ≈ <b>{tokens}</b> tokens with the limit, {uncut} without it
          </div>
          <p className="text-xs text-muted-foreground">
            Stop has priority -1, so it survives every cut. The hidden options are not unreachable: a read changes the
            state, and the next menu is drawn from what is left.
          </p>
        </div>
      </div>
    </figure>
  )
}
