"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { UNITS, WAKE } from "./data"

// Cold wake of the toy: fetch all 188 shards (47 MiB) of an offloaded database from an object store.
// Latency per GET is a lognormal around the chosen median (p99 = 4.5x median) plus 256 KiB at 60 MB/s per stream: ASSUMED.
// 689 ms is the number Rivet reports for waking and answering a first query on a 47 MiB database; what that query read is not published.

const MEDS = [15, 25, 40, 60]
const CONCS = [1, 4, 16, 64]
const REPORTED = 689

function Seg(props: { label: string; opts: number[]; value: number; onChange: (v: number) => void; unit: string }) {
  const { label, opts, value, onChange, unit } = props
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="w-40 shrink-0 font-mono text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="flex gap-1">
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={cn(
              "rounded border px-2 py-1 font-mono tabular-nums",
              o === value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {o}
            {unit}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ColdWake() {
  const [med, setMed] = useState(25)
  const [conc, setConc] = useState(16)
  const [p50, p99] = WAKE[`${med}/${conc}`]
  const scale = 1.25 * Math.max(REPORTED, p99)
  const w = (v: number) => `${Math.min(100, (v / scale) * 100).toFixed(1)}%`
  const above = p50 > REPORTED
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Seg label="GET median (assumed)" opts={MEDS} value={med} onChange={setMed} unit=" ms" />
        <Seg label="parallel GETs" opts={CONCS} value={conc} onChange={setConc} unit="" />
      </div>
      <div className="mt-4 space-y-2 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-muted-foreground">188 shard GETs</span>
          <div className="relative h-4 flex-1 rounded bg-muted" role="img" aria-label={`Simulated fetch of all shards: p50 ${p50} ms, p99 ${p99} ms`}>
            <div className="absolute inset-y-0 left-0 rounded-l" style={{ width: w(p50), background: "oklch(0.62 0.15 150)" }} />
            <div className="absolute inset-y-0 w-0.5" style={{ left: w(p99), background: "oklch(0.60 0.17 30)" }} />
            <div className="absolute -inset-y-1 w-px bg-foreground" style={{ left: w(REPORTED) }} />
          </div>
          <span className="w-32 shrink-0 text-right tabular-nums">
            p50 {p50.toLocaleString("en-US")} · p99 {p99.toLocaleString("en-US")} ms
          </span>
        </div>
        <p className="text-muted-foreground">
          Black tick: 689 ms, the reported p50 for wake plus first query on 47 MiB. Red tick: simulated p99. At this setting a full fetch is{" "}
          {above ? "slower than" : "faster than"} the reported wake.
        </p>
      </div>
      <table className="mt-4 w-full text-left font-mono text-[11px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 font-normal">unit of fetch (25 ms median)</th>
            <th className="py-1 text-right font-normal">GETs</th>
            <th className="py-1 text-right font-normal">p50 to fetch 47 MiB</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["one 4 KiB page, serial", "unit1/conc1"],
              ["one 4 KiB page, 16 parallel", "unit1/conc16"],
              ["one 256 KiB shard, serial", "unit64/conc1"],
            ] as const
          ).map(([n, k]) => (
            <tr key={k} className="border-t border-border">
              <td className="py-1">{n}</td>
              <td className="py-1 text-right tabular-nums">{UNITS[k][0].toLocaleString("en-US")}</td>
              <td className="py-1 text-right tabular-nums">{(UNITS[k][1] / 1000).toFixed(1)} s</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Simulated with assumed latencies; 200 trials per cell. It bounds a wake that reads the whole database, which a first query usually does not need.
      </figcaption>
    </figure>
  )
}
