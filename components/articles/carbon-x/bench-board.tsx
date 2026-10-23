"use client"

// Carbon-X against each comparison model, benchmark by benchmark, and the
// projected cost of one pass over ClinVar's 2.4M variants of uncertain
// significance. Scores are the model card's Evaluation table (each comparison
// model at the reasoning effort with its highest average; Carbon-X with
// thinking off, one sample per problem). Costs are the release blog's
// Figure 14 (single-pass projection from FrontierVEP cost per completed
// problem). Every number here is reported by Hugging Face, not re-run; I
// checked only that each row's average is the mean of its five scores.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

const BENCH = ["BioReason Coding", "BioReason Non-SNV", "GenomeQA", "NextBase", "FrontierVEP"] as const

type Row = { id: string; name: string; effort: string; open: boolean; s: number[]; avg: number }

const CARBON: Row = { id: "carbon", name: "Carbon-X", effort: "no reasoning", open: true, s: [74.9, 85.1, 63.6, 39.4, 70.4], avg: 66.7 }

const OTHERS: Row[] = [
  { id: "gpt", name: "GPT-6.1 Sol", effort: "max", open: false, s: [71.0, 91.7, 67.2, 32.9, 74.9], avg: 67.5 },
  { id: "opus", name: "Opus 5.5", effort: "max", open: false, s: [70.3, 94.8, 62.2, 1.1, 76.2], avg: 60.9 },
  { id: "gemini", name: "Gemini 4 Argon", effort: "low", open: false, s: [6.5, 90.3, 63.1, 31.2, 58.0], avg: 49.8 },
  { id: "kimi", name: "Kimi K3", effort: "low", open: true, s: [53.9, 65.3, 52.0, 30.6, 50.1], avg: 50.4 },
  { id: "ds", name: "DeepSeek V4.1 Flash", effort: "low", open: true, s: [51.4, 55.9, 49.7, 27.2, 51.3], avg: 47.1 },
  { id: "glm", name: "GLM-5.3", effort: "low", open: true, s: [52.1, 60.1, 44.6, 9.7, 32.7], avg: 39.8 },
]

const COST: { name: string; usd: number; carbon?: boolean }[] = [
  { name: "Carbon-X", usd: 271, carbon: true },
  { name: "GPT-6.1 Sol · low", usd: 32_380 },
  { name: "Opus 5.5 · low", usd: 110_724 },
  { name: "GPT-6.1 Sol · max", usd: 658_632 },
  { name: "Opus 5.5 · max", usd: 4_027_185 },
]

function usd(n: number): string {
  return "$" + n.toLocaleString("en-US")
}

function Bar({ v, tone, label }: { v: number; tone: "a" | "b"; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 rounded-sm bg-muted">
        <div
          className={"h-2.5 rounded-sm " + (tone === "a" ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-500")}
          style={{ width: `${v.toFixed(1)}%` }}
          aria-hidden
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums">{label}</span>
    </div>
  )
}

export function BenchBoard() {
  const [tab, setTab] = useState<"scores" | "cost">("scores")
  const [vs, setVs] = useState("gpt")
  const other = OTHERS.find((o) => o.id === vs) ?? OTHERS[0]
  const lo = mlog10(100)
  const hi = mlog10(10_000_000)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
        <span className="mr-2 font-mono text-xs text-muted-foreground">reported by Hugging Face ·</span>
        {(["scores", "cost"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={t === tab}
            className={
              "rounded border px-2 py-1 text-xs " +
              (t === tab ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            {t === "scores" ? "Five DNA benchmarks" : "ClinVar VUS cost"}
          </button>
        ))}
      </div>

      {tab === "scores" ? (
        <div className="px-3 py-3">
          <div className="mb-3 flex flex-wrap gap-1">
            {OTHERS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setVs(o.id)}
                aria-pressed={o.id === vs}
                className={
                  "rounded border px-2 py-0.5 text-[11px] " +
                  (o.id === vs ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {o.name}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {BENCH.map((b, i) => {
              const d = CARBON.s[i] - other.s[i]
              return (
                <div key={b}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{b}</span>
                    <span className={"font-mono tabular-nums " + (d >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                      {d >= 0 ? "+" : "−"}
                      {Math.abs(d).toFixed(1)}
                    </span>
                  </div>
                  <Bar v={CARBON.s[i]} tone="a" label={CARBON.s[i].toFixed(1)} />
                  <Bar v={other.s[i]} tone="b" label={other.s[i].toFixed(1)} />
                </div>
              )
            })}
            <div className="border-t pt-2">
              <div className="mb-1 flex justify-between text-xs font-medium">
                <span>Average of five</span>
                <span className="font-mono tabular-nums">
                  {CARBON.avg.toFixed(1)} vs {other.avg.toFixed(1)}
                </span>
              </div>
              <Bar v={CARBON.avg} tone="a" label={CARBON.avg.toFixed(1)} />
              <Bar v={other.avg} tone="b" label={other.avg.toFixed(1)} />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-600" /> Carbon-X, thinking off{" "}
            <span className="ml-2 inline-block h-2 w-2 rounded-sm bg-slate-400" /> {other.name}, {other.effort} effort,{" "}
            {other.open ? "open weights" : "closed API"}.
          </p>
        </div>
      ) : (
        <div className="space-y-2 px-3 py-3">
          {COST.map((c) => {
            const w = ((mlog10(c.usd) - lo) / (hi - lo)) * 100
            return (
              <div key={c.name}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className={c.carbon ? "font-medium" : ""}>{c.name}</span>
                  <span className="font-mono tabular-nums">{usd(c.usd)}</span>
                </div>
                <div className="h-2.5 rounded-sm bg-muted">
                  <div
                    className={"h-2.5 rounded-sm " + (c.carbon ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-500")}
                    style={{ width: `${Math.max(1, w).toFixed(1)}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            )
          })}
          <p className="pt-1 text-xs text-muted-foreground">
            Log scale, $100 to $10M. One pass over 2.4M ClinVar variants of uncertain significance, extrapolated from
            each model&apos;s cost per FrontierVEP problem. Carbon-X priced at $5 per H200-hour.
          </p>
        </div>
      )}
    </figure>
  )
}
