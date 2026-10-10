"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { MD1_OPENROUTER_P50, ROWS, type LatencyRow } from "./latency"

// Microsoft's latency column, and the same rows before JevBench's self-hosted
// adjustment (raw p50 x 2 + 0.15 s). Every number is Microsoft's, JevBench's or
// OpenRouter's; see latency.ts.

type View = "plotted" | "raw"
type Md1 = "foundry" | "openrouter"

const LO = 20
const HI = 4000

function pct(ms: number): number {
  return ((mlog10(ms) - mlog10(LO)) / (mlog10(HI) - mlog10(LO))) * 100
}

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  if (ms < 100) return `${ms.toFixed(1)} ms`
  return `${Math.round(ms)} ms`
}

const HOW: Record<LatencyRow["how"], string> = {
  foundry: "Microsoft, through Foundry in the same region",
  api: "hosted API from JevBench's client, no adjustment",
  selfhosted: "self-hosted; JevBench adds x2 + 0.15 s",
  unknown: "source not given; no raw figure to compare",
}

export function LatencyLedger() {
  const [view, setView] = useState<View>("plotted")
  const [md1, setMd1] = useState<Md1>("foundry")

  const rows = ROWS.map((r) => {
    let ms: number | null = view === "plotted" ? r.plotted : r.raw
    if (r.how === "foundry" && md1 === "openrouter") ms = MD1_OPENROUTER_P50
    return { r, ms }
  })
  const known = rows.filter((x) => x.ms !== null) as { r: LatencyRow; ms: number }[]
  const sorted = [...known].sort((a, b) => a.ms - b.ms)
  const fastest = sorted[0]
  const md1Row = known.find((x) => x.r.how === "foundry")!
  const md1Rank = sorted.indexOf(md1Row) + 1

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        median latency per request · Microsoft&apos;s chart vs JevBench v1.6.1&apos;s raw timings · log scale
      </div>

      <div className="grid gap-2 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Which numbers">
          {(
            [
              ["plotted", "as Microsoft plotted them"],
              ["raw", "before JevBench's adjustment"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                view === id ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Microsoft-Decision-1 measured where">
          {(
            [
              ["foundry", "MD1: Foundry, same region (85 ms)"],
              ["openrouter", "MD1: OpenRouter p50 (260 ms)"],
            ] as [Md1, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMd1(id)}
              aria-pressed={md1 === id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                md1 === id ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5 p-3">
        {rows.map(({ r, ms }) => (
          <div
            key={r.name}
            className="grid grid-cols-[8rem_1fr_4.2rem] items-center gap-2 font-mono text-[10px] sm:grid-cols-[11rem_1fr_5rem]"
          >
            <span className="truncate text-right" title={HOW[r.how]}>
              {r.name}
            </span>
            <div className="relative h-4 overflow-hidden rounded-sm bg-muted">
              {ms !== null ? (
                <div
                  className={cn(
                    "h-full",
                    r.how === "foundry"
                      ? "bg-lime-500/80"
                      : r.how === "selfhosted"
                        ? "bg-sky-600/60"
                        : "bg-muted-foreground/40"
                  )}
                  style={{ width: `${pct(ms).toFixed(2)}%` }}
                />
              ) : (
                <span className="absolute inset-y-0 left-1 flex items-center text-muted-foreground">
                  no raw figure published
                </span>
              )}
            </div>
            <span className="text-right">{ms !== null ? fmt(ms) : "n/a"}</span>
          </div>
        ))}
        <p className="m-0 mt-1 font-mono text-[10px] text-muted-foreground">
          Blue: self-hosted rows, where JevBench&apos;s adjustment applies. Green: Microsoft&apos;s own measurement.
          Hover a name for its source.
        </p>
      </div>

      <div className="border-t px-3 py-2 font-mono text-[11px]">
        Fastest here: <strong>{fastest.r.name}</strong> at {fmt(fastest.ms)}. Microsoft-Decision-1 is{" "}
        {md1Rank === 1 ? "first" : `number ${md1Rank}`} of {known.length} rows with a number.
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        JevBench raises every self-hosted median to raw x 2 + 0.15 s so it can sit beside hosted APIs, and labels
        that &quot;an assumption, not a hardware normalization&quot;. Microsoft took those adjusted numbers for the
        open models and set its own unadjusted, same-region Foundry number next to them.
      </figcaption>
    </figure>
  )
}
