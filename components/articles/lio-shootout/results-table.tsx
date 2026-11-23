"use client"

// The shootout's results, one sequence at a time: every system x variant row the harness printed,
// failed and diverged ones included, sorted by ATE with the non-ok rows last. Numbers come from
// ./data (generated from the RESULT lines); nothing here computes a metric.

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ROWS, SEQS, type Row } from "./data"
import { label } from "./labels"

const f = (v: number | null, d = 2) => (v === null ? "–" : v.toFixed(d))
const order = (r: Row) => (r.status === "ok" ? 0 : r.status === "diverged" ? 1 : 2)
const big = (v: number | null, d: number) => (v === null ? "–" : v >= 1000 ? v.toExponential(1) : v.toFixed(d))

export function ResultsTable() {
  const [si, setSi] = useState(0)
  const [all, setAll] = useState(false)
  const seq = SEQS[si]
  const rows = ROWS.filter((r) => r.seq === seq.key && (all || (r.primary && r.sys !== "gtreplay"))).sort(
    (a, b) => order(a) - order(b) || (a.ate ?? 1e9) - (b.ate ?? 1e9),
  )
  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap gap-1 border-b px-3 py-2 font-mono text-xs">
        {SEQS.map((s, i) => (
          <button key={s.key} type="button" onClick={() => setSi(i)} aria-pressed={si === i}
            className={cn("cursor-pointer rounded px-2 py-1 transition-colors", si === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => setAll((a) => !a)} aria-pressed={all}
          className="ml-auto cursor-pointer rounded border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground">
          {all ? "one row per system" : "all variants + self-test"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left font-mono text-xs">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-normal">system</th>
              <th className="px-2 py-2 font-normal">status</th>
              <th className="px-2 py-2 text-right font-normal">ATE m</th>
              <th className="px-2 py-2 text-right font-normal">max m</th>
              <th className="px-2 py-2 text-right font-normal">RPE 1 m (m / °)</th>
              <th className="px-2 py-2 text-right font-normal">ms/scan (p95)</th>
              <th className="px-2 py-2 text-right font-normal">RSS MB</th>
              <th className="px-3 py-2 text-right font-normal">wall mm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={cn("border-b last:border-0", r.status !== "ok" && "text-muted-foreground")}>
                <td className="px-3 py-1.5">
                  {label(r.key)}
                  {r.note ? <div className="max-w-[260px] whitespace-normal text-[10.5px] leading-snug text-muted-foreground">{r.note}</div> : null}
                </td>
                <td className="px-2 py-1.5">
                  <span className={cn(r.status === "ok" ? "text-emerald-600 dark:text-emerald-400" : r.status === "diverged" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                    {r.status}
                  </span>
                  {r.status === "diverged" && r.divergeT !== null ? <span className="text-muted-foreground"> at {r.divergeT.toFixed(0)} s</span> : null}
                </td>
                <td className="px-2 py-1.5 text-right">{big(r.ate, 3)}</td>
                <td className="px-2 py-1.5 text-right">{big(r.ateMax, 2)}</td>
                <td className="px-2 py-1.5 text-right">{f(r.rpeT, 3)} / {f(r.rpeR, 2)}</td>
                <td className="px-2 py-1.5 text-right">
                  {f(r.ms, 1)} ({f(r.msP95, 1)}){r.timingSrc && r.timingSrc.startsWith("parallel") ? "*" : ""}
                </td>
                <td className="px-2 py-1.5 text-right">{r.rss === null ? "–" : r.rss.toFixed(0)}</td>
                <td className="px-3 py-1.5 text-right">{f(r.wallRms, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="px-4 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
        {seq.label}: {seq.sensor}, {seq.pathM} m in {seq.durS} s, {seq.scans.toLocaleString("en-US")} scans. ATE is
        the RMSE after an SE(3) alignment without scale; RPE over 1 m of path. ms/scan is the serial pass on 4 pinned
        threads; * marks rows timed in the parallel pass (all of the park). wall mm is the median thickness of planar
        wall patches in the 3 cm map. A diverged row&apos;s ATE is kept as measured: it says how far the run went wrong.
      </figcaption>
    </figure>
  )
}
