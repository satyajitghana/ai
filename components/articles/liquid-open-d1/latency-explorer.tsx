"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { DEVICES, FILES, RTX4090_EAGER_ONE, WORKLOADS, type Device, type Workload } from "./data"

// The d1-3B card's latency tables, laid against a deadline the reader picks.
// Times are Liquid's, not mine; see data.ts for where each row comes from.

function msFor(d: Device, w: Workload, graphs: boolean): number {
  if (w === "packed") return 1000 / d.packed
  if (w === "one" && d.id === "4090" && !graphs) return RTX4090_EAGER_ONE
  return d[w]
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  if (ms < 10) return `${ms.toFixed(1)} ms`
  return `${Math.round(ms)} ms`
}

function gb(bytes: number): string {
  return `${(bytes / 1e9).toFixed(2)} GB`
}

export function LatencyExplorer() {
  const [work, setWork] = useState<Workload>("one")
  const [graphs, setGraphs] = useState(true)
  const [deadline, setDeadline] = useState(33)

  const rows = DEVICES.map((d) => ({ d, ms: msFor(d, work, graphs) }))
  const max = Math.max(...rows.map((r) => r.ms), deadline)
  const w = WORKLOADS.find((x) => x.id === work)!
  const fit = rows.filter((r) => r.ms <= deadline).length

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        reported: d1-3B latency per request, from the model card · deadline is yours
      </div>

      <div className="grid gap-3 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Workload">
          {WORKLOADS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setWork(x.id)}
              aria-pressed={work === x.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                work === x.id ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <label className="grid gap-1 font-mono text-[11px]">
          <span>
            deadline: <strong>{deadline} ms</strong>
            <span className="text-muted-foreground">
              {" "}
              ({(1000 / deadline).toFixed(1)} decisions a second, one at a time)
            </span>
          </span>
          <Range
            min={5}
            max={250}
            step={1}
            value={deadline}
            onChange={(e) => setDeadline(Number(e.target.value))}
            aria-label="Deadline in milliseconds"
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px]">
          <input type="checkbox" checked={graphs} onChange={(e) => setGraphs(e.target.checked)} />
          RTX 4090 with CUDA graphs (the card&apos;s 8 ms; off gives its 16 ms, one question only)
        </label>
        <p className="m-0 font-mono text-[10px] text-muted-foreground">{w.detail}</p>
      </div>

      <div className="grid gap-1.5 p-3">
        {rows.map(({ d, ms }) => {
          const ok = ms <= deadline
          const ratio = d.three / msFor(d, "one", graphs)
          return (
            <div
              key={d.id}
              className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2 font-mono text-[10px] sm:grid-cols-[11rem_1fr_5rem]"
            >
              <span className="truncate text-right text-muted-foreground" title={d.label}>
                {d.label}
              </span>
              <div className="relative h-4 overflow-hidden rounded-sm bg-muted">
                <div
                  className={cn("h-full", ok ? "bg-emerald-600/70" : "bg-amber-500/70")}
                  style={{ width: `${((ms / max) * 100).toFixed(2)}%` }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-foreground"
                  style={{ left: `${((deadline / max) * 100).toFixed(2)}%` }}
                  aria-hidden
                />
                {work === "three" ? (
                  <span className="absolute inset-y-0 right-1 flex items-center text-muted-foreground">
                    {ratio.toFixed(2)}x one question
                  </span>
                ) : null}
              </div>
              <span className={cn("text-right", ok ? "" : "text-amber-700 dark:text-amber-300")}>
                {fmtMs(ms)}
              </span>
            </div>
          )
        })}
        <p className="m-0 mt-1 font-mono text-[10px] text-muted-foreground">
          {fit} of {rows.length} targets meet {deadline} ms
          {work === "packed" ? " per state when 64 states share one pass" : ""}. Vertical line: your
          deadline.
        </p>
      </div>

      <div className="border-t p-3">
        <p className="m-0 mb-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          what has to fit in memory (d1-3B files on the Hub)
        </p>
        <div className="grid gap-1">
          {FILES.map((f) => (
            <div key={f.label} className="grid grid-cols-[11rem_1fr] items-center gap-2 font-mono text-[10px]">
              <span className="text-right text-muted-foreground">{f.label}</span>
              <span>
                {gb(f.model + f.mmproj)}
                {f.mmproj ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({gb(f.model)} model + {gb(f.mmproj)} vision)
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        A short question fits a 33 ms video frame on every target except the Orin Nano; a 384 px
        image fits it only on the two desktop and datacenter GPUs (the Thor takes 35 ms). Three
        questions cost 1.25x to 1.46x one question on the edge rows and 2.6x on the 4090, where only
        the single question runs as a CUDA graph.
      </figcaption>
    </figure>
  )
}
