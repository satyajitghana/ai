"use client"

import { useState } from "react"

// Meta's Muse Wonder results table (research.meta.ai/blog/muse-wonder, the
// "muse-evaluation-table" image), with each row's source as the model card
// (research.meta.ai/static/muse-wonder-model-card, section 3) states it, and
// what I could check against the third party's own page on 2026-10-13.

type Src = "third" | "meta"

type Row = {
  name: string
  src: Src
  who: string
  v: [number, number, number, number, number] // Wonder Full, Wonder, Fable 5.1, GPT-6 Astra, Opus 5.5
  check: string
}

const COLS = ["Wonder Full", "Wonder", "Fable 5.1", "GPT-6 Astra", "Opus 5.5"]

const ROWS: Row[] = [
  { name: "Personal Superintelligence Index", src: "meta", who: "Meta, internal composite of seven evals", v: [59.1, 54.3, 49.9, 54.5, 55.2], check: "Cannot be checked: four of its seven parts are internal." },
  { name: "Harvey LAB-AA", src: "third", who: "Artificial Analysis", v: [13.1, 10.0, 6.4, 8.6, 4.2], check: "Matches AA: 13.06, 10.00, 6.39, 8.61, 4.17." },
  { name: "Vals Finance Agent V2", src: "third", who: "Vals AI", v: [59.1, 56.6, 58.9, 53.5, 58.6], check: "Matches Vals for Wonder Full: 59.06." },
  { name: "HealthBench Pro", src: "meta", who: "Meta's run; Anthropic's figures for Claude", v: [62.3, 60.5, 62.1, 65.3, 65.6], check: "Meta-run; not independently checkable." },
  { name: "AutomationBench-AA", src: "third", who: "Artificial Analysis, strict pass@1", v: [45.4, 39.1, 32.1, 41.6, 41.2], check: "AA's index uses a partial score instead: 71.33 vs Opus 69.54." },
  { name: "GDP.pdf", src: "third", who: "Surge", v: [33.2, 30.8, 27.6, 34.2, 30.6], check: "AA's own GDP.pdf run differs: 32.6, 30.6, 26.2, 31.0, 26.2." },
  { name: "JobBench", src: "meta", who: "no third party named", v: [75.3, 70.5, 73.1, 66.1, 75.4], check: "No external source given." },
  { name: "OSWorld V2.1 (partial)", src: "meta", who: "Meta's run; Anthropic's figure for Opus", v: [78.4, 72.6, 80.7, 75.8, 81.8], check: "Meta-run; not independently checkable." },
  { name: "MemoryBench", src: "meta", who: "Meta, internal", v: [85.5, 85.6, 79.0, 81.4, 81.5], check: "Internal benchmark; nothing to check against." },
  { name: "Terminal-Bench 4.0-AA", src: "third", who: "Artificial Analysis", v: [57.1, 52.0, 52.0, 59.1, 59.6], check: "Matches AA: 57.07, 52.02, 52.02, 59.09, 59.60." },
  { name: "DeepSWE 1.1", src: "third", who: "Datacurve; vendors' own for Fable and Astra", v: [79.0, 78.8, 67.4, 74.1, 74.2], check: "Mixed sources within the row." },
  { name: "SWE-Marathon", src: "third", who: "Abundant AI; not a common harness", v: [57.5, 53.1, 45.6, 42.5, 46.3], check: "Wonder Full's figure is at xhigh effort, the rest at max." },
  { name: "ProgramBench", src: "meta", who: "Meta's run, at least 95% of tests", v: [59.0, 50.0, 55.5, 52.5, 70.5], check: "Vals' strict all-tests metric: Wonder Full 0.50, Opus 18.50." },
  { name: "AA Intelligence Index", src: "third", who: "Artificial Analysis", v: [56, 52, 53, 53, 58], check: "Matches AA; rebuilt exactly from its parts." },
]

const META = "oklch(0.58 0.17 255)"

function leader(v: number[]) {
  let i = 0
  for (let k = 1; k < v.length; k++) if (v[k] > v[i]) i = k
  return i
}

export function SourceLedger() {
  const [filter, setFilter] = useState<"all" | Src>("all")
  const shown = ROWS.filter((r) => filter === "all" || r.src === filter)
  const museLeads = shown.filter((r) => leader(r.v) <= 1).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Meta&apos;s results table, row by row, with its source</span>
        <span className="text-muted-foreground/60">sources from Meta&apos;s model card</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "all 14 rows"],
              ["third", "third-party source"],
              ["meta", "Meta-run or internal"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${filter === k ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            a Muse model is best on <span style={{ color: META }}>{museLeads}</span> of {shown.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 pr-2 font-normal">benchmark</th>
                {COLS.map((c, i) => (
                  <th key={c} className="px-1.5 py-1.5 text-right font-normal" style={i <= 1 ? { color: META } : undefined}>
                    {c}
                  </th>
                ))}
                <th className="py-1.5 pl-2 font-normal">what I could check</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const best = leader(r.v)
                return (
                  <tr key={r.name} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-2">
                      <div className="text-foreground">{r.name}</div>
                      <div className="text-muted-foreground/70">{r.who}</div>
                    </td>
                    {r.v.map((x, i) => (
                      <td key={i} className={`px-1.5 py-1.5 text-right ${i === best ? "font-semibold text-foreground" : "text-muted-foreground"}`} style={i === best && i <= 1 ? { color: META } : undefined}>
                        {x.toFixed(r.name === "AA Intelligence Index" ? 0 : 1)}
                      </td>
                    ))}
                    <td className="py-1.5 pl-2 text-muted-foreground">{r.check}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The bold figure in each row is the best one. Of the eight rows with a third-party source, a Muse model is best on five. Of the six
          Meta ran or built itself, it is best only on the two that are Meta&apos;s own benchmarks, and loses the other four, all of them
          external benchmarks scored by Meta.
        </p>
      </div>
    </figure>
  )
}
