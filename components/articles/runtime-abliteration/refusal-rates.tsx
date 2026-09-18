"use client"

import { useState } from "react"

import Link from "next/link"

import { cn } from "@/lib/utils"

// Transcribed from evals.jpg in the cloned repo (OrcaRouter's own results
// graphic; not reproduced here as an image -- see the note in the article).
// Seven jailbreak/harm suites report a sample size and a before/after refusal
// rate; two "over-refusal" benign suites report only one number each, with no
// sample size and no baseline shown at all. SimpleSafetyTests carries an
// asterisk in the source graphic that is never explained anywhere in the repo
// -- no footnote, no methodology doc, nothing in the README.

type Suite = { name: string; n: number; before: number; after: number; note?: string }
const SUITES: Suite[] = [
  { name: "AdvBench", n: 100, before: 99.0, after: 6.0 },
  { name: "JailbreakBench", n: 100, before: 96.0, after: 4.0 },
  { name: "StrongREJECT", n: 150, before: 99.3, after: 3.3 },
  { name: "HarmBench", n: 150, before: 98.7, after: 7.3 },
  { name: "MaliciousInstruct", n: 100, before: 97.0, after: 0.0 },
  { name: "SimpleSafetyTests", n: 50, before: 96.0, after: 18.0, note: "asterisked in the source graphic; unexplained anywhere in the repo" },
  { name: "ForbiddenQuestions", n: 150, before: 75.3, after: 5.3 },
]
const OVERREFUSAL = [
  { name: "XSTest-safe", value: 0.4 },
  { name: "JBB-benign", value: 0.0 },
]

const BEFORE = "oklch(0.62 0.03 250)"
const AFTER = "oklch(0.58 0.19 27)"

export function RefusalRates() {
  const [sel, setSel] = useState<string>(SUITES[0].name)
  const s = SUITES.find((x) => x.name === sel)!
  const avgAfter = SUITES.reduce((sum, x) => sum + x.after, 0) / SUITES.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          refusal rates, as shown in the repo&rsquo;s evals.jpg — not independently measured here
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SUITES.map((x) => (
            <button
              key={x.name}
              type="button"
              onClick={() => setSel(x.name)}
              aria-pressed={sel === x.name}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                sel === x.name ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {x.name} <span className="opacity-60">n={x.n}</span>
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">base</span>
            <div className="h-4 flex-1 rounded bg-muted/20">
              <div className="h-4 rounded" style={{ width: `${s.before}%`, background: BEFORE, opacity: 0.6 }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{s.before.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">ablated</span>
            <div className="h-4 flex-1 rounded bg-muted/20">
              <div className="h-4 rounded" style={{ width: `${s.after}%`, background: AFTER, opacity: 0.85 }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: AFTER }}>{s.after.toFixed(1)}%{s.note ? "*" : ""}</span>
          </div>
        </div>
        {s.note ? <p className="mt-1.5 font-mono text-[9.5px] text-muted-foreground">* {s.note}</p> : null}
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">n = {s.n} prompts · Δ = {(s.after - s.before).toFixed(1)}pp</p>

        <div className="mt-4 border-t pt-3">
          <div className="font-mono text-[10px] text-muted-foreground">
            over-refusal on benign prompts — reported as a single number each, no sample size, no baseline given
          </div>
          <div className="mt-2 flex flex-wrap gap-4">
            {OVERREFUSAL.map((o) => (
              <div key={o.name} className="rounded-lg border bg-muted/20 px-3 py-1.5 font-mono text-xs">
                <span className="text-muted-foreground">{o.name}</span>{" "}
                <span className="tabular-nums text-foreground">{o.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every jailbreak/harm row has an <span className="text-foreground">n</span>, which is more than the
          Bonsai family&rsquo;s other refusal-rate tables on this site usually get. What&rsquo;s still missing:
          a harness, a judge model, decoding settings, and any independent replication — the same gaps this site
          found in <Link href="/articles/glm-5-3-flash-uncensored">the GLM-5.3-Flash weight-edit</Link>. Residual refusal
          averages <span className="text-foreground">{avgAfter.toFixed(1)}%</span> across the seven suites, not
          zero — and the two over-refusal numbers don&rsquo;t even get a baseline, so there&rsquo;s no way to tell
          from this chart alone whether the runtime hook made the model more argumentative on harmless prompts or
          less.
        </p>
      </div>
    </figure>
  )
}
