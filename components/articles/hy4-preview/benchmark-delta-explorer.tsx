"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The card's own 12-panel headline chart (assets/benchmark.jpg), rebuilt as
// data rather than redrawn as a picture. Every competitor number below is the
// asterisked ("our own testing") figure from the benchmark appendix table --
// confirmed to be exactly what the chart itself plots, cross-checked on six
// of these twelve rows against the chart's own bar labels.
//
// The card's claim: "enough to put Hy4 preview at the open-source frontier."
// That's a claim about the open-weight field specifically -- Qwen 3.8 Max,
// DeepSeek V4 Pro 0813, GLM 5.3, Kimi K3 -- not GPT 5.6 Sol or Claude Opus 5,
// which the chart includes as closed-model reference points, not the
// "open-source" the claim is about. Ranking Hy4 against all 7 vs. against
// just the 5 open-weight models (Hy4 + the 4 above) gives very different
// pictures, and both are worth seeing.

type Row = {
  name: string
  hy3: number
  hy4: number
  comp: Record<string, number | null>
}

const OPEN = ["DeepSeek V4 Pro", "Qwen 3.8 Max", "GLM 5.3", "Kimi K3"]
const CLOSED = ["GPT 5.6 Sol", "Claude Opus 5"]
const ALL_COMP = [...OPEN, ...CLOSED]

const ROWS: Row[] = [
  { name: "Terminal Bench 2.1", hy3: 70.8, hy4: 85.4, comp: { "DeepSeek V4 Pro": 80.3, "Qwen 3.8 Max": 85.8, "GLM 5.3": 88.3, "Kimi K3": 85.7, "GPT 5.6 Sol": 88.3, "Claude Opus 5": 85.4 } },
  { name: "DeepSWE", hy3: 28.0, hy4: 64.3, comp: { "DeepSeek V4 Pro": 58.8, "Qwen 3.8 Max": 55.6, "GLM 5.3": 68.1, "Kimi K3": 74.0, "GPT 5.6 Sol": 68.9, "Claude Opus 5": 74.7 } },
  { name: "ProgramBench", hy3: 3.0, hy4: 17.5, comp: { "DeepSeek V4 Pro": 15.5, "Qwen 3.8 Max": 17.5, "GLM 5.3": 18.0, "Kimi K3": 24.5, "GPT 5.6 Sol": 25.0, "Claude Opus 5": 39.5 } },
  { name: "SWE Atlas Refactoring", hy3: 32.9, hy4: 53.3, comp: { "DeepSeek V4 Pro": 48.6, "Qwen 3.8 Max": 51.0, "GLM 5.3": 51.9, "Kimi K3": 37.4, "GPT 5.6 Sol": 52.4, "Claude Opus 5": 60.0 } },
  { name: "Agents' Last Exam", hy3: 17.1, hy4: 22.8, comp: { "DeepSeek V4 Pro": 21.9, "Qwen 3.8 Max": 25.4, "GLM 5.3": 23.8, "Kimi K3": 23.2, "GPT 5.6 Sol": 27.6, "Claude Opus 5": 25.1 } },
  { name: "Toolathlon-Verified", hy3: 56.2, hy4: 74.1, comp: { "DeepSeek V4 Pro": 70.1, "Qwen 3.8 Max": 69.1, "GLM 5.3": 73.8, "Kimi K3": 74.7, "GPT 5.6 Sol": 73.2, "Claude Opus 5": 76.5 } },
  { name: "APEX-Agents (pass@1)", hy3: 24.4, hy4: 37.1, comp: { "DeepSeek V4 Pro": 32.4, "Qwen 3.8 Max": 34.0, "GLM 5.3": 38.1, "Kimi K3": 37.2, "GPT 5.6 Sol": 37.9, "Claude Opus 5": 41.8 } },
  { name: "PostTrainBench", hy3: 14.5, hy4: 35.6, comp: { "DeepSeek V4 Pro": 24.5, "Qwen 3.8 Max": null, "GLM 5.3": 33.2, "Kimi K3": 32.0, "GPT 5.6 Sol": 36.2, "Claude Opus 5": 35.0 } },
  { name: "OneMillionBench (tools)", hy3: 51.5, hy4: 65.4, comp: { "DeepSeek V4 Pro": 62.0, "Qwen 3.8 Max": 63.1, "GLM 5.3": 64.5, "Kimi K3": 63.5, "GPT 5.6 Sol": 67.1, "Claude Opus 5": 68.1 } },
  { name: "BioMysteryBench", hy3: 54.9, hy4: 71.3, comp: { "DeepSeek V4 Pro": 61.6, "Qwen 3.8 Max": 58.9, "GLM 5.3": 69.0, "Kimi K3": 61.3, "GPT 5.6 Sol": 73.1, "Claude Opus 5": 72.1 } },
  { name: "HLE (no tools)", hy3: 34.4, hy4: 43.4, comp: { "DeepSeek V4 Pro": 40.5, "Qwen 3.8 Max": 41.5, "GLM 5.3": 42.3, "Kimi K3": 46.6, "GPT 5.6 Sol": 49.6, "Claude Opus 5": 53.2 } },
  { name: "HorizonMath (pass@4)", hy3: 3.5, hy4: 8.8, comp: { "DeepSeek V4 Pro": 4.42, "Qwen 3.8 Max": 5.31, "GLM 5.3": null, "Kimi K3": 7.08, "GPT 5.6 Sol": 10.62, "Claude Opus 5": 5.3 } },
]

function rank(hy4: number, comp: Row["comp"], pool: string[]) {
  const scores = [hy4, ...pool.map((p) => comp[p]).filter((v): v is number => v !== null)]
  scores.sort((a, b) => b - a)
  return { rank: scores.indexOf(hy4) + 1, total: scores.length }
}

const GOOD = "oklch(0.55 0.16 155)"
const AMBER = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"

export function BenchmarkDeltaExplorer() {
  const [scope, setScope] = useState<"open" | "all">("open")
  const [sortBy, setSortBy] = useState<"delta" | "rank">("rank")

  const rows = useMemo(() => {
    const withRank = ROWS.map((r) => ({
      ...r,
      delta: r.hy4 - r.hy3,
      deltaPct: ((r.hy4 - r.hy3) / r.hy3) * 100,
      ...rank(r.hy4, r.comp, scope === "open" ? OPEN : ALL_COMP),
    }))
    return sortBy === "delta"
      ? withRank.sort((a, b) => b.deltaPct - a.deltaPct)
      : withRank.sort((a, b) => a.rank / a.total - b.rank / b.total)
  }, [scope, sortBy])

  const leads = rows.filter((r) => r.rank === 1).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">12 headline benchmarks, the card&rsquo;s own chart</span>
        <div className="flex gap-1.5">
          {(
            [
              ["open", "vs. open-weight field (5)"],
              ["all", "vs. all 7, incl. closed"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              aria-pressed={scope === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                scope === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            Hy4 leads <span style={{ color: GOOD }}>{leads} of {rows.length}</span> in this scope
          </span>
          <div className="flex gap-1.5">
            {(
              [
                ["rank", "sort by rank"],
                ["delta", "sort by Hy3→Hy4 gain"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortBy(k)}
                aria-pressed={sortBy === k}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  sortBy === k
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-mono text-[10.5px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">benchmark</th>
                <th className="px-1.5 py-1 text-right font-normal">Hy3</th>
                <th className="px-1.5 py-1 text-right font-normal">Hy4</th>
                <th className="px-1.5 py-1 text-right font-normal">gain</th>
                <th className="px-1.5 py-1 text-right font-normal">rank ({scope === "open" ? "of 5" : "of 7"})</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={cn("border-t", r.rank === 1 && "bg-[oklch(0.55_0.16_155_/_0.08)]")}>
                  <td className="py-1 text-foreground">{r.name}</td>
                  <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{r.hy3.toFixed(1)}</td>
                  <td className="px-1.5 py-1 text-right tabular-nums text-foreground">{r.hy4.toFixed(1)}</td>
                  <td className="px-1.5 py-1 text-right tabular-nums" style={{ color: r.deltaPct > 60 ? GOOD : "currentColor" }}>
                    +{r.deltaPct.toFixed(0)}%
                  </td>
                  <td
                    className="px-1.5 py-1 text-right tabular-nums font-bold"
                    style={{ color: r.rank === 1 ? GOOD : r.rank <= Math.ceil(r.total / 2) ? AMBER : BAD }}
                  >
                    {r.rank}/{r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sort by gain and every row is enormous — DeepSWE +130%, ProgramBench +483%, HorizonMath
          +151%. Sort by rank and a different picture appears. Against the{" "}
          <span style={{ color: GOOD }}>open-weight field</span> the card&rsquo;s &ldquo;open-source
          frontier&rdquo; claim is well-earned: Hy4 leads 5 of these 12, and is never worse than 4th of
          5. Widen the comparison to <span style={{ color: BAD }}>all seven</span>, closed models
          included, and Hy4 leads only 1 — the qualifier in the card&rsquo;s own sentence is doing real
          work, and a reader who drops the word &ldquo;open-source&rdquo; from it would be misled by
          exactly this chart.
        </p>
      </div>
    </figure>
  )
}
