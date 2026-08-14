"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The exploitation chain, stage by stage, because the launch post's two cyber
// claims are both true and point in different directions:
//
//   "GLM-5.3 is state of the art on CyberGym for vulnerability discovery"
//      -> true: 84.5 is the top score in that row.
//   "its gains are largest further up the exploitation chain, where it more
//    than doubles GLM-5.2 on exploitation benchmarks"
//      -> also true, measured against GLM-5.2.
//
// Read together they invite the conclusion that GLM-5.3 leads at exploitation.
// The same table says it does not: on ExploitGym it clears 130 problems at 6h
// against 247 for Fable 5 and 293 for GPT-5.6 Sol. The gap widens exactly as
// the task moves up the chain, which is the opposite shape to the one the
// sentence ordering suggests.

type Stage = {
  id: string
  label: string
  bench: string
  what: string
  glm53: number
  glm52: number
  fable: number
  gpt: number
  unit: string
  read: string
}

const STAGES: Stage[] = [
  {
    id: "discover",
    label: "find the flaw",
    bench: "CyberGym",
    what: "Vulnerability discovery: locate a real defect in a real codebase.",
    glm53: 84.5, glm52: 77.2, fable: 83.8, gpt: 83.6, unit: "%",
    read: "GLM-5.3 leads the whole field here, and this is the row the SOTA claim rests on. The margin is thin — 84.5 against 83.8 and 83.6 — but it is a lead, and it is over closed models.",
  },
  {
    id: "exploit",
    label: "prove it is exploitable",
    bench: "ExploitBench",
    what: "Turn a known flaw into a working exploit.",
    glm53: 54.4, glm52: 24.4, fable: 78, gpt: 76.5, unit: "%",
    read: "The 2.23x gain over GLM-5.2 is real and it is the post's headline. It also leaves GLM-5.3 more than twenty points behind both closed models. One step up the chain and the ranking has already inverted.",
  },
  {
    id: "chain",
    label: "chain it under a clock",
    bench: "ExploitGym (6h)",
    what: "Full exploitation chains, scored by problems solved inside a time budget.",
    glm53: 130, glm52: 39, fable: 247, gpt: 293, unit: " solved",
    read: "The widest gap of the three. GLM-5.3 more than triples GLM-5.2 — and still clears fewer than half as many problems as GPT-5.6 Sol. Whatever emerged during post-training scaled the model relative to itself, not relative to the frontier.",
  },
]

const GLM = "oklch(0.60 0.15 255)"
const OLD = "oklch(0.62 0.03 250)"
const CLOSED = "oklch(0.68 0.13 85)"

export function CyberChain() {
  const [sel, setSel] = useState(0)
  const s = STAGES[sel]
  const max = Math.max(s.glm53, s.glm52, s.fable, s.gpt)

  const bars = [
    { name: "GLM-5.3", v: s.glm53, c: GLM },
    { name: "GLM-5.2", v: s.glm52, c: OLD },
    { name: "Fable 5", v: s.fable, c: CLOSED },
    { name: "GPT-5.6 Sol", v: s.gpt, c: CLOSED },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">up the exploitation chain</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {sel + 1} of {STAGES.length}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-lg border px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40 text-foreground" : "text-muted-foreground hover:border-foreground/20",
              )}
            >
              <span className="mr-1.5 opacity-60">{i + 1}</span>
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-foreground">{s.bench}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{s.what}</span>
          </div>

          <div className="mt-2 space-y-1.5">
            {bars.map((b) => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                  {b.name}
                </span>
                <div className="h-3.5 flex-1 rounded-sm bg-muted/40">
                  <div className="h-3.5 rounded-sm" style={{ width: `${(b.v / max) * 100}%`, background: b.c }} />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {b.v}
                  {s.unit}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 font-mono text-[10px]" style={{ color: GLM }}>
            {(s.glm53 / s.glm52).toFixed(2)}× over GLM-5.2 · {((s.gpt / s.glm53 - 1) * 100).toFixed(0)}% behind GPT-5.6 Sol
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{s.read}</p>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both of Z.ai&rsquo;s cyber claims are accurate, and they point in different directions. GLM-5.3 really is
          top of the field at finding vulnerabilities, and its gains really are largest further up the chain when
          measured against GLM-5.2. But the gap to the closed models widens at exactly the same rate: level at
          discovery, twenty-plus points behind at exploitation, less than half the throughput at full chains. The
          capability that emerged is real; the ranking it earned is confined to the first rung.
        </p>
      </div>
    </figure>
  )
}
