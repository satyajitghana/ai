"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Every number here was measured by me, on 2026-10-17, on a shared 4-core
// Xeon @ 2.10 GHz cloud VM (CPU only, other jobs running), in headless
// Chromium 141.0.7390.37 driven by Playwright. pele@1.6.0 and mermaid@12.1.0
// were installed from npm and served from localhost; each diagram got a fresh
// page, five warm-up renders, then 31 timed batches (several renders per batch
// for Pele, so sub-0.1 ms renders clear the timer's resolution). "Median" and
// "best" are over those batches; "first render" is the first call on a fresh
// page, which for Mermaid includes fetching its lazy chunks from localhost.
// SVG bytes are the length of the string each library returned.

type Row = {
  id: string
  label: string
  pele: { med: number; best: number; cold: number; svg: number }
  mermaid: { med: number; best: number; cold: number; svg: number }
}

const ROWS: Row[] = [
  { id: "flowchart-small", label: "flowchart, 5 nodes", pele: { med: 0.467, best: 0.217, cold: 36.4, svg: 3645 }, mermaid: { med: 46.4, best: 38.1, cold: 485, svg: 75660 } },
  { id: "flowchart-large", label: "flowchart, 100 nodes", pele: { med: 5.7, best: 3.2, cold: 53.0, svg: 70077 }, mermaid: { med: 568.6, best: 453.1, cold: 1322, svg: 212797 } },
  { id: "sequence", label: "sequence", pele: { med: 0.196, best: 0.044, cold: 18.2, svg: 5586 }, mermaid: { med: 25.6, best: 19.7, cold: 103, svg: 26683 } },
  { id: "class", label: "class", pele: { med: 0.48, best: 0.16, cold: 17.4, svg: 6989 }, mermaid: { med: 105.1, best: 93.3, cold: 648, svg: 39228 } },
  { id: "state", label: "state", pele: { med: 0.675, best: 0.325, cold: 20.4, svg: 6802 }, mermaid: { med: 96.3, best: 76.4, cold: 627, svg: 45783 } },
  { id: "gantt", label: "gantt", pele: { med: 0.108, best: 0.052, cold: 10.6, svg: 4276 }, mermaid: { med: 9.7, best: 7.9, cold: 46, svg: 12032 } },
  { id: "pie", label: "pie", pele: { med: 0.038, best: 0.024, cold: 6.9, svg: 2992 }, mermaid: { med: 6.5, best: 5.7, cold: 190, svg: 4965 } },
  { id: "er", label: "entity relationship", pele: { med: 0.22, best: 0.08, cold: 11.5, svg: 4755 }, mermaid: { med: 54.2, best: 40.8, cold: 552, svg: 30261 } },
]

type Metric = "med" | "best" | "cold" | "svg"

const METRICS: { id: Metric; label: string; unit: string; note: string }[] = [
  { id: "med", label: "median render", unit: "ms", note: "Warm renders, median of 31 batches. This is the number to quote." },
  { id: "best", label: "best render", unit: "ms", note: "Fastest batch of each. Ratios of minima are how you get to 500×: noise inflates Pele's tiny times more than Mermaid's large ones." },
  { id: "cold", label: "first render", unit: "ms", note: "First call on a fresh page: JIT warm-up for both, plus Mermaid's lazy chunk loads (from localhost, so no network time)." },
  { id: "svg", label: "SVG output", unit: "B", note: "Bytes of the returned SVG string. Mermaid's carries a ~22 KB <style> block and HTML labels in <foreignObject>." },
]

// What a page downloads before it can draw one flowchart. Bytes are the sum of
// each JavaScript file gzipped at level 9, measured from the npm tarballs and
// from the responses Chromium actually fetched.
const BUNDLES: { id: string; label: string; bytes: number; pele: boolean }[] = [
  { id: "pele-full", label: "pele (every diagram type)", bytes: 253213, pele: true },
  { id: "pele-lazy", label: "pele/lazy, one flowchart", bytes: 54020, pele: true },
  { id: "mermaid-min", label: "mermaid.min.js (every type)", bytes: 1578065, pele: false },
  { id: "mermaid-esm", label: "mermaid ESM, one flowchart", bytes: 739995, pele: false },
  { id: "mermaid-dagre", label: "mermaid ESM, flowchart, layout: dagre", bytes: 243699, pele: false },
]

// Connection speeds in megabits per second, on a log-ish ladder.
const SPEEDS = [0.4, 1.6, 5, 10, 25, 50, 100, 300]

const PELE = "oklch(0.64 0.17 40)"
const MERMAID = "oklch(0.58 0.04 260)"

function fmt(v: number, unit: string): string {
  if (unit === "B") return v >= 10000 ? `${Math.round(v / 1000)} kB` : `${(v / 1000).toFixed(1)} kB`
  if (v < 1) return `${v.toFixed(3)} ms`
  if (v < 10) return `${v.toFixed(1)} ms`
  return `${Math.round(v)} ms`
}

function fmtTime(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`
}

export function BenchExplorer() {
  const [metric, setMetric] = useState<Metric>("med")
  const [speedIdx, setSpeedIdx] = useState(2)
  const m = METRICS.find((x) => x.id === metric)!

  const all = ROWS.flatMap((r) => [r.pele[metric], r.mermaid[metric]])
  const lo = mlog10(Math.min(...all) / 1.5)
  const hi = mlog10(Math.max(...all) * 1.2)
  const pct = (v: number) => Math.max(1, Math.min(100, ((mlog10(v) - lo) / (hi - lo)) * 100))

  const mbps = SPEEDS[speedIdx]
  const maxSec = (BUNDLES[2].bytes * 8) / (mbps * 1e6)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          pele@1.6.0 vs mermaid@12.1.0 · same 8 diagrams · log scale
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm" style={{ background: PELE }} /> Pele
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm" style={{ background: MERMAID }} /> Mermaid
          </span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Metric">
          {METRICS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setMetric(x.id)}
              aria-pressed={metric === x.id}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                metric === x.id ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="mt-2 mb-3 text-xs leading-5 text-muted-foreground">{m.note}</p>

        <div className="space-y-2.5">
          {ROWS.map((r) => {
            const p = r.pele[metric]
            const q = r.mermaid[metric]
            return (
              <div key={r.id} className="grid grid-cols-[6.5rem_1fr_3.25rem] items-center gap-x-2 sm:grid-cols-[9rem_1fr_3.5rem]">
                <span className="text-right font-mono text-[10px] leading-4">{r.label}</span>
                <div className="min-w-0 space-y-0.5">
                  {[
                    { v: p, c: PELE },
                    { v: q, c: MERMAID },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="h-2.5 rounded-sm" style={{ width: `${pct(b.v).toFixed(2)}%`, background: b.c }} />
                      <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">{fmt(b.v, m.unit)}</span>
                    </div>
                  ))}
                </div>
                <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: PELE }}>
                  {q / p >= 10 ? Math.round(q / p) : (q / p).toFixed(1)}×
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-5 rounded-lg border bg-muted/20 px-3 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Bundle bytes over your connection
            </span>
            <span className="font-mono text-xs tabular-nums">{mbps} Mbit/s</span>
          </div>
          <Range
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={speedIdx}
            onChange={(e) => setSpeedIdx(Number(e.target.value))}
            aria-label="Connection speed"
            className="mt-2 w-full"
          />
          <div className="mt-3 space-y-1.5">
            {BUNDLES.map((b) => {
              const sec = (b.bytes * 8) / (mbps * 1e6)
              return (
                <div key={b.id} className="grid grid-cols-[8.5rem_1fr_4rem] items-center gap-2 sm:grid-cols-[14rem_1fr_4.5rem]">
                  <span className="text-right font-mono text-[10px] leading-4">{b.label}</span>
                  <div className="h-2.5 rounded-sm bg-muted/40">
                    <div
                      className="h-2.5 rounded-sm"
                      style={{ width: `${Math.max(0.5, (sec / maxSec) * 100).toFixed(2)}%`, background: b.pele ? PELE : MERMAID }}
                    />
                  </div>
                  <span className="text-right font-mono text-[10px] tabular-nums">{fmtTime(sec)}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 mb-0 text-xs leading-5 text-muted-foreground">
            Transfer time only: gzipped bytes × 8 ÷ bandwidth, with no latency, TLS or parse time. At
            10 Mbit/s Mermaid&rsquo;s flowchart chunks take about 590 ms to arrive, roughly as long as its
            first render then takes to run. Both are paid once per page; the warm render is paid per diagram.
          </p>
        </div>
      </div>
    </figure>
  )
}
