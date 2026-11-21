"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { BENCH, type BenchRow } from "@/components/articles/pv-lio/bench-data"

// The shootout's numbers for PV-LIO beside FAST-LIO2, per sequence, from the harness's RESULT lines
// (harness/eval/report.py on Blackwell): ATE after an SE(3) Umeyama fit without scale, RPE over
// 1 m, ms per scan from the serial timing pass (4 threads pinned to cores 0-3), peak RSS from
// /usr/bin/time. A row whose run diverged or failed shows its status instead of a bar.

type Metric = "ate" | "rpe" | "ms" | "rss"
const METRICS: { key: Metric; label: string; unit: string; get: (r: BenchRow) => number | null; fmt: (v: number) => string }[] = [
  { key: "ate", label: "ATE", unit: "cm", get: (r) => (r.ate == null ? null : r.ate * 100), fmt: (v) => (v >= 100 ? `${(v / 100).toFixed(2)} m` : `${v.toFixed(1)} cm`) },
  { key: "rpe", label: "RPE per metre", unit: "cm", get: (r) => (r.rpe == null ? null : r.rpe * 100), fmt: (v) => `${v.toFixed(1)} cm` },
  { key: "ms", label: "ms per scan", unit: "ms", get: (r) => r.ms, fmt: (v) => `${v.toFixed(1)} ms` },
  { key: "rss", label: "peak memory", unit: "MB", get: (r) => r.rss, fmt: (v) => `${v.toFixed(0)} MB` },
]

export function PvBench() {
  const seqs = Object.keys(BENCH)
  const [seq, setSeq] = useState(seqs[0])
  const [metric, setMetric] = useState<Metric>("ate")
  const d = BENCH[seq]
  const M = METRICS.find((m) => m.key === metric) ?? METRICS[0]
  const vals = d.rows.map((r) => (r.status === "ok" || metric === "ms" || metric === "rss" ? M.get(r) : null))
  const max = Math.max(1e-9, ...vals.filter((v): v is number => v != null))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <div className="flex flex-wrap gap-1">
          {seqs.map((k) => (
            <button key={k} type="button" onClick={() => setSeq(k)} aria-pressed={seq === k}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", seq === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {BENCH[k].short}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button key={m.key} type="button" onClick={() => setMetric(m.key)} aria-pressed={metric === m.key}
              className={cn("cursor-pointer rounded border px-2 py-1 transition-colors", metric === m.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 font-mono text-xs text-muted-foreground">{d.label}</div>
        <div className="space-y-2" role="list" aria-label={`${M.label} on ${d.label}`}>
          {d.rows.map((r, i) => {
            const v = vals[i]
            return (
              <div key={r.name} role="listitem" className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 font-mono text-xs">
                <div className="truncate" title={r.name}>
                  <span className={r.pv ? "font-semibold text-foreground" : "text-muted-foreground"}>{r.name}</span>
                </div>
                {v == null ? (
                  <div className="text-muted-foreground">{r.status === "ok" ? "not measured" : r.status}{r.note ? `: ${r.note}` : ""}</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-4 rounded-sm" style={{ width: `${Math.max(1.5, (v / max) * 78)}%`, background: r.pv ? "oklch(0.62 0.17 255)" : "oklch(0.7 0.02 260)" }} />
                    <span className="tabular-nums text-foreground">{M.fmt(v)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{d.note}</p>
      </div>
    </figure>
  )
}
