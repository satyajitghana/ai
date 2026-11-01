"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { EXP_A, TRACES, TRACE_PREFIX } from "./trace-data"

// Clover's LowConfidence rule, run for real on a small masked language model (distilroberta-base) so the mechanism can
// be seen: start a block of 16 masked slots after a prefix, predict every slot at once, commit every slot whose top
// probability beats the threshold (or the single most confident slot if none does), repeat. The model is NOT Clover and
// was not trained for this, so what this shows is the rule, and how many slots clear each threshold, not Clover's quality.

const TINT = [
  "oklch(0.80 0.08 285)",
  "oklch(0.80 0.08 200)",
  "oklch(0.82 0.09 150)",
  "oklch(0.84 0.10 95)",
  "oklch(0.82 0.10 50)",
  "oklch(0.80 0.10 25)",
  "oklch(0.78 0.09 350)",
  "oklch(0.78 0.04 250)",
]

function label(tau: number): string {
  return tau > 1 ? "one slot per step" : `threshold ${tau}`
}

export function BlockDenoiser() {
  const [ti, setTi] = useState(2)
  const [step, setStep] = useState(0)
  const trace = TRACES[ti]
  const rounds = trace.rounds
  const shown = Math.min(step, rounds.length)

  // slot -> [round index, token, confidence]
  const slot: ([number, string, number] | null)[] = Array.from({ length: 16 }, () => null)
  rounds.slice(0, shown).forEach((r, ri) => r.forEach(([pos, tok, conf]) => (slot[pos] = [ri, tok, conf])))
  const last = shown > 0 ? rounds[shown - 1] : []
  const fresh = new Set(last.map((x) => x[0]))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        a block of 16 slots resolved by confidence · distilroberta-base on CPU, our stand-in, not Clover
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {TRACES.map((t, i) => (
          <button
            key={t.tau}
            type="button"
            onClick={() => {
              setTi(i)
              setStep(0)
            }}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              ti === i ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {label(t.tau)} · {t.rounds.length} steps
          </button>
        ))}
      </div>
      <div className="px-4 pt-4">
        <div className="mb-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-mono">prefix</span> …{TRACE_PREFIX}
        </div>
        <ol className="flex flex-wrap gap-1" aria-label="The 16 slots of the block">
          {slot.map((s, i) => (
            <li
              key={i}
              title={s ? `step ${s[0] + 1}, confidence ${s[2].toFixed(3)}` : "still masked"}
              className={cn(
                "min-w-[2.6rem] rounded border px-1.5 py-1 text-center font-mono text-[11px] transition-colors",
                fresh.has(i) && "ring-2 ring-foreground/50",
                !s && "border-dashed text-muted-foreground"
              )}
              style={s ? { background: TINT[s[0] % TINT.length] } : undefined}
            >
              <span className="whitespace-pre text-foreground">{s ? s[1].replace(/ /g, "·") || "␣" : "▯"}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <label className="flex items-center gap-3 text-xs">
            <span className="w-16 shrink-0 font-mono text-muted-foreground">step</span>
            <Range min={0} max={rounds.length} step={1} value={shown} onChange={(e) => setStep(Number(e.target.value))} aria-label="Denoising step" className="w-full" />
            <span className="w-20 shrink-0 text-right font-mono tabular-nums">
              {shown} of {rounds.length}
            </span>
          </label>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            {shown === 0 ? "all 16 slots masked" : `step ${shown} committed ${last.length} slot${last.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed">
          <div>
            <span className="font-mono text-muted-foreground">resolved </span>
            {shown === rounds.length ? trace.final : "…"}
          </div>
          <div className="text-muted-foreground">
            <span className="font-mono">the text </span>
            {trace.truth}
          </div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto border-t px-4 py-3">
        <table className="w-full text-left font-mono text-[11px]">
          <caption className="pb-2 text-left text-muted-foreground">24 paragraphs from this site, 48-token prefix, then a block of 16 or 32 (measured)</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th className="pr-3 font-normal">rule</th>
              <th className="pr-3 text-right font-normal">block</th>
              <th className="pr-3 text-right font-normal">steps</th>
              <th className="pr-3 text-right font-normal">tokens per step</th>
              <th className="pr-3 text-right font-normal">first step commits</th>
              <th className="text-right font-normal">adjacent repeats</th>
            </tr>
          </thead>
          <tbody>
            {EXP_A.map((r) => (
              <tr key={`${r.block}-${r.tau}`} className="tabular-nums">
                <td className="pr-3">{label(r.tau)}</td>
                <td className="pr-3 text-right">{r.block}</td>
                <td className="pr-3 text-right">{r.steps.toFixed(1)}</td>
                <td className="pr-3 text-right">{r.perStep.toFixed(2)}</td>
                <td className="pr-3 text-right">{r.first.toFixed(1)}</td>
                <td className="text-right">{(r.dup * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
