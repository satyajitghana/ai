"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The five numbers from the release's own writeup, transcribed as reported --
// no independent harness, no stated judge model, no decoding settings given
// anywhere this session could reach (the README itself is gated, 401; these
// figures are quoted secondhand by the task brief that commissioned this
// article, not re-measured here).
//
// Four of the five are the same measurement in different clothes: how often
// the model still refuses a request the safety-trained base model would also
// have refused. A lower number on those four means MORE refusal was removed --
// it is a completeness-of-removal metric, not a capability metric, dressed in
// a benchmark table's visual grammar (before/after, in a list, with percent
// signs). XSTest measures something genuinely different: over-refusal on
// benign prompts that only sound risky. A lower number there is an ordinary
// quality win, the kind any lab would want regardless of what else changed.

type Row = { name: string; before: number; after: number; kind: "removal" | "overrefusal"; unit: string }

const ROWS: Row[] = [
  { name: "MaliciousInstruct", before: 96, after: 11, kind: "removal", unit: "refusal rate" },
  { name: "JailbreakBench", before: 93, after: 12, kind: "removal", unit: "refusal rate" },
  { name: "AdvBench", before: 97, after: 15, kind: "removal", unit: "refusal rate" },
  { name: "HarmBench", before: 93, after: 18, kind: "removal", unit: "refusal rate" },
  { name: "XSTest", before: 2.4, after: 0.4, kind: "overrefusal", unit: "benign over-refusal rate" },
]

const BEFORE = "oklch(0.62 0.03 250)"
const REMOVAL = "oklch(0.58 0.19 27)"
const GOOD = "oklch(0.55 0.16 155)"

type Group = "reported" | "split"

export function RefusalMetrics() {
  const [group, setGroup] = useState<Group>("split")

  const removal = ROWS.filter((r) => r.kind === "removal")
  const overrefusal = ROWS.filter((r) => r.kind === "overrefusal")
  const ordered = group === "split" ? [...removal, ...overrefusal] : ROWS

  const avgResidual = removal.reduce((s, r) => s + r.after, 0) / removal.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">five numbers, as reported by orcarouter</span>
        <div className="flex gap-1">
          {(["reported", "split"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setGroup(k)}
              aria-pressed={group === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                group === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "reported" ? "as listed" : "split by what's measured"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {ordered.map((r, i) => {
            const max = Math.max(r.before, r.after)
            const beforeW = (r.before / max) * 100
            const afterW = (r.after / max) * 100
            const afterColour = r.kind === "removal" ? REMOVAL : GOOD
            const showDivider = group === "split" && i === removal.length && overrefusal.length > 0
            return (
              <div key={r.name}>
                {showDivider ? (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-px flex-1" style={{ background: "currentColor", opacity: 0.15 }} />
                    <span className="font-mono text-[9.5px] text-muted-foreground">
                      measures something else: refusing less on prompts that were never unsafe
                    </span>
                    <div className="h-px flex-1" style={{ background: "currentColor", opacity: 0.15 }} />
                  </div>
                ) : null}
                <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
                  <span className="text-foreground">{r.name}</span>
                  <span className="text-muted-foreground">{r.unit}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">before</span>
                    <div className="h-4 flex-1 rounded bg-muted/20">
                      <div className="h-4 rounded" style={{ width: `${beforeW}%`, background: BEFORE, opacity: 0.6 }} />
                    </div>
                    <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {r.before}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">after</span>
                    <div className="h-4 flex-1 rounded bg-muted/20">
                      <div className="h-4 rounded" style={{ width: `${afterW}%`, background: afterColour, opacity: 0.85 }} />
                    </div>
                    <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: afterColour }}>
                      {r.after}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {group === "split" ? (
            <>
              Sorted this way, the two kinds of claim stop sharing a row.{" "}
              <span style={{ color: REMOVAL }}>The first four</span> all ask the same question — how much of
              the refusal behaviour survived — and none of them lands near zero: residual refusal averages{" "}
              <span className="text-foreground">{avgResidual.toFixed(1)}%</span>, not the 0–1% a clean
              single-direction ablation typically produces. <span style={{ color: GOOD }}>XSTest</span> is the
              one number here that would read as an ordinary win in any release, safety-stripped or not — a
              model that argues with fewer harmless prompts. It just happens to sit in the same list.
            </>
          ) : (
            <>
              Listed in this order it reads as one benchmark table, five rows, all improving. Four of the five
              rows are measuring the same thing from four public jailbreak/harm suites — how thoroughly the
              refusal behaviour was removed — dressed in the same before/after, percent-sign format a genuine
              capability benchmark would use.
            </>
          )}{" "}
          None of the five states a harness, a decoding setting, or a judge model, and none has been run
          independently of the party that performed the removal.
        </p>
      </div>
    </figure>
  )
}
