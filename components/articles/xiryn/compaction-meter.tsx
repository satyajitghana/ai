"use client"

// What one step of an Xiryn tool loop sends back to the model, with and
// without the compaction pass that runs in prepareStep.
//
// The rules are the repository's (lib/agent/runtime.ts:273-326, commit ae9ad97):
//   IMAGES_KEPT  = 2    newest screenshots stay as images; older ones become
//                       "[earlier screenshot omitted]" plus their short caption
//   OUTPUTS_KEPT = 6    newest tool outputs stay whole
//   STUB_CHARS   = 600  older text outputs are cut to 600 characters
//   XIRYN_MAX_STEPS defaults to 40 (lib/config.ts:21)
// The token costs are mine and adjustable, not Xiryn's: a screenshot at
// 1280x800 is about 1,365 tokens by Anthropic's published w*h/750 rule, a
// web_fetch result is capped at 12,000 characters (lib/web.ts:64), about
// 3,000 tokens, and the fixed prefix (system prompt plus 22 tool schemas) is my
// estimate. Plain arithmetic only.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

const IMAGES_KEPT = 2
const OUTPUTS_KEPT = 6
const STUB_TOKENS = 150 // 600 characters at about 4 characters a token
const MAX_STEPS = 40
const PER_STEP = 60 // a tool call's arguments plus a caption, my estimate

type Mode = "desktop" | "research"

function stepInput(mode: Mode, n: number, prefix: number, item: number, compact: boolean) {
  const prior = n - 1
  if (!compact) return prefix + prior * (PER_STEP + item)
  if (mode === "desktop") {
    return prefix + prior * PER_STEP + Math.min(prior, IMAGES_KEPT) * item
  }
  const whole = Math.min(prior, OUTPUTS_KEPT)
  const stubbed = Math.max(0, prior - OUTPUTS_KEPT)
  return prefix + prior * PER_STEP + whole * item + stubbed * Math.min(item, STUB_TOKENS)
}

function total(mode: Mode, n: number, prefix: number, item: number, compact: boolean) {
  let sum = 0
  for (let k = 1; k <= n; k++) sum += stepInput(mode, k, prefix, item, compact)
  return sum
}

const fmt = (v: number) => Math.round(v).toLocaleString("en-US")

export function CompactionMeter() {
  const [mode, setMode] = useState<Mode>("desktop")
  const [step, setStep] = useState(40)
  const [prefix, setPrefix] = useState(4000)
  const [desktopItem, setDesktopItem] = useState(1365)
  const [researchItem, setResearchItem] = useState(3000)
  const item = mode === "desktop" ? desktopItem : researchItem

  const withC = stepInput(mode, step, prefix, item, true)
  const without = stepInput(mode, step, prefix, item, false)
  const at4 = stepInput(mode, Math.min(4, step), prefix, item, true)
  const sumWith = total(mode, step, prefix, item, true)
  const sumWithout = total(mode, step, prefix, item, false)
  const scale = Math.max(without, 1)

  const cells = Array.from({ length: step - 1 }, (_, i) => {
    const age = step - 1 - i // 1 = newest
    if (mode === "desktop") return age <= IMAGES_KEPT ? "image" : "stub"
    return age <= OUTPUTS_KEPT ? "whole" : "stub"
  })

  const CELL = { image: "oklch(0.6 0.15 250)", whole: "oklch(0.6 0.15 250)", stub: "oklch(0.75 0 0)" }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">what step {step} resends</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          rules from lib/agent/runtime.ts · token costs are assumptions
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-3">
        {(["desktop", "research"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === mode}
            onClick={() => setMode(m)}
            className={
              m === mode
                ? "rounded-md border border-foreground/40 bg-muted px-2 py-1 text-[11px] text-foreground"
                : "rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            }
          >
            {m === "desktop" ? "desktop task: every step returns a screenshot" : "research task: every step fetches a page"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
        <label className="block text-[11px] text-muted-foreground">
          step <span className="font-mono text-foreground">{step}</span> of {MAX_STEPS}
          <Range min={1} max={MAX_STEPS} value={step} onChange={(e) => setStep(Number(e.target.value))} className="mt-1 w-full" />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          fixed prefix <span className="font-mono text-foreground">{fmt(prefix)}</span> tokens
          <Range min={1000} max={12000} step={500} value={prefix} onChange={(e) => setPrefix(Number(e.target.value))} className="mt-1 w-full" />
        </label>
        {mode === "desktop" ? (
          <label className="block text-[11px] text-muted-foreground sm:col-span-2">
            one screenshot <span className="font-mono text-foreground">{fmt(desktopItem)}</span> tokens
            <Range min={300} max={3000} step={5} value={desktopItem} onChange={(e) => setDesktopItem(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        ) : (
          <label className="block text-[11px] text-muted-foreground sm:col-span-2">
            one fetched page <span className="font-mono text-foreground">{fmt(researchItem)}</span> tokens
            <Range min={500} max={3000} step={50} value={researchItem} onChange={(e) => setResearchItem(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        )}
      </div>

      <div className="space-y-2 border-t px-4 py-3">
        {[
          { label: "with compaction", v: withC, tone: "oklch(0.6 0.15 250)" },
          { label: "without", v: without, tone: "oklch(0.7 0 0)" },
        ].map((row) => (
          <div key={row.label} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{row.label}</span>
            <div className="h-3 rounded-sm bg-muted/40">
              <div className="h-3 rounded-sm" style={{ width: `${(row.v / scale) * 100}%`, background: row.tone }} />
            </div>
            <span className="text-right font-mono text-[11px] text-foreground">{fmt(row.v)}</span>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3">
        <div className="font-mono text-[10px] text-muted-foreground">
          earlier results at step {step}, oldest left · blue kept whole · grey cut down
        </div>
        <div className="mt-2 flex flex-wrap gap-[3px]">
          {cells.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">nothing yet</span>
          ) : (
            cells.map((c, i) => (
              <span key={i} className="inline-block h-3 w-3 rounded-[2px]" style={{ background: CELL[c] }} />
            ))
          )}
        </div>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        Step {step} costs {fmt(withC)} tokens with the pass and {fmt(without)} without; step 4 costs{" "}
        {fmt(at4)}. Summed over all {step} steps the turn sends {fmt(sumWith)} input tokens against{" "}
        {fmt(sumWithout)}. The per-step figure still climbs, slowly, because every call and caption stays in
        the history: compaction turns a steep line into a shallow one, it does not make it flat.
      </p>
    </figure>
  )
}
