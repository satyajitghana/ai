"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// How many past positions one query reads in one attention layer, for four
// ways of building that layer. The SSA row is an inference, not a published
// mechanism: the SubQ-1.1-Small technical report's Table 1 gives SSA and dense
// attention FLOPs per layer at six lengths, and every reduction it lists is
// close to n / 16,384 (2.1x at 32K, 8.0x at 128K, 64.5x at 1M). The same
// report puts single-layer speed parity "near 16K tokens" (Figure 12) and says
// a 12M-token context attends to 0.13% of token pairs, which is about 16,000
// positions per query. A fixed budget of that size is the simplest thing that
// fits all three. The DSA row uses the 2,048 selected tokens of DeepSeek
// V3.2's released configuration (the report's Table 2), and the hybrid row a
// Qwen3.5-style stack: one full-attention layer in four (full_attention_interval
// 4 in the config of Qwen3.8-27B, the base of pplx-decider v1.1 and clef).

const BUDGET = 16384

// Report Table 1: context -> dense / SSA FLOP reduction, as printed.
const TABLE1: [number, number][] = [
  [32768, 2.1],
  [65536, 4.0],
  [131072, 8.0],
  [262144, 16],
  [524288, 31.5],
  [1048576, 64.5],
]

const MARKS: { n: number; label: string }[] = [
  { n: 1933, label: "Nimble's longest record" },
  { n: 34000, label: "Decision Index's longest request" },
  { n: 393216, label: "Snap's API limit" },
  { n: 1048576, label: "Decision RULER's longest" },
]

const LOG_MIN = 3 // 1K
const LOG_MAX = 7.1 // ~12.6M

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1048576).toFixed(n >= 1e7 ? 0 : 2)}M`
  if (n >= 1000) return `${Math.round(n / 1024)}K`
  return `${Math.round(n)}`
}

type Row = {
  name: string
  read: number
  scan: number
  note: string
  tone: string
}

export function BudgetLedger() {
  const [lg, setLg] = useState(5.1) // ~128K
  const n = Math.round(mpow(10, lg))

  const ssa = Math.min(n, BUDGET)
  const rows: Row[] = [
    {
      name: "Dense attention",
      read: n,
      scan: 0,
      note: "every past position, every layer",
      tone: "bg-rose-500/70",
    },
    {
      name: "Hybrid, 1 layer in 4 full",
      read: n / 4,
      scan: 0,
      note: "averaged over layers; the other three keep a fixed state",
      tone: "bg-amber-500/70",
    },
    {
      name: "DSA (DeepSeek V3.2)",
      read: Math.min(n, 2048),
      scan: n,
      note: "reads 2,048, but a small indexer scores all n first",
      tone: "bg-violet-500/70",
    },
    {
      name: "SSA, inferred budget",
      read: ssa,
      scan: 0,
      note: "reads about 16K whatever n is; selection cost unpublished",
      tone: "bg-sky-500/70",
    },
  ]

  const max = Math.max(n, 2048)
  const near = TABLE1.reduce((best, r) =>
    Math.abs(mlog10(r[0]) - lg) < Math.abs(mlog10(best[0]) - lg) ? r : best
  )
  const nearOn = Math.abs(mlog10(near[0]) - lg) < 0.08

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        positions one query reads in one attention layer · context {fmt(n)} tokens
      </div>

      <div className="border-b p-3">
        <label className="grid gap-1 font-mono text-[11px]">
          <span>
            context length: <strong>{n.toLocaleString("en-US")}</strong> tokens
          </span>
          <Range
            min={LOG_MIN}
            max={LOG_MAX}
            step={0.01}
            value={lg}
            onChange={(e) => setLg(Number(e.target.value))}
            aria-label="Context length, log scale"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MARKS.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setLg(mlog10(m.n))}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors",
                Math.abs(mlog10(m.n) - lg) < 0.01 ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {m.label} · {fmt(m.n)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 p-3">
        {rows.map((r) => (
          <div key={r.name} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-3">
            <span className="font-mono text-[11px] font-semibold">{r.name}</span>
            <div className="min-w-0">
              <div className="relative h-5 rounded-sm bg-muted">
                {r.scan > 0 ? (
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm border border-dashed border-violet-500/70"
                    style={{ width: `${((r.scan / max) * 100).toFixed(2)}%` }}
                  />
                ) : null}
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-sm", r.tone)}
                  style={{ width: `${Math.max(0.4, (r.read / max) * 100).toFixed(2)}%` }}
                />
                <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[10px] font-semibold">
                  {Math.round(r.read).toLocaleString("en-US")}
                  {r.scan > 0 ? ` read · ${r.scan.toLocaleString("en-US")} scored` : ""}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 border-t p-3 font-mono text-[11px] sm:grid-cols-2">
        <p className="m-0">
          dense ÷ SSA at this length, if the budget is 16,384:{" "}
          <strong>{(n / ssa).toFixed(1)}x</strong>
        </p>
        <p className="m-0 text-muted-foreground">
          {nearOn
            ? `report Table 1 at ${fmt(near[0])}: ${near[1]}x`
            : `report Table 1 has rows at 32K, 64K, 128K, 256K, 512K and 1M`}
        </p>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Bars share one linear scale per length. Below about 16K tokens SSA has nothing to skip
        and reads what dense attention reads. Snap&apos;s short-context wins (Nimble, the
        Decision Index) all sit at or below 34K, where the inferred saving is at most about 2x.
        The SSA budget is my inference from the report&apos;s own numbers; Subquadratic does
        not publish the mechanism.
      </figcaption>
    </figure>
  )
}
