"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Why the IO worker keeps dozens of fetches in flight.
//
// The porter measured the host's Range responses (a comment in io_worker.js): one
// stream moves a few hundred KB/s whatever the link, so throughput is set by how
// many requests are in flight, not by bandwidth. Those four points are the only
// data here; nothing is interpolated between them.
//
// The jobs are this build's own sizes: the boot read set (bootset.json, 2,918 file
// entries, 582 MB) that every visit replays, the ~1.2 GB the comments say the world
// needs after the scripts start, and the whole 20.9 GB manifest that is never
// fetched in one go.

const ACCENT = "oklch(0.62 0.15 150)"

const LANES = [
  { n: 6, mbps: 3.4 },
  { n: 32, mbps: 3.6 },
  { n: 64, mbps: 7.1 },
  { n: 128, mbps: 14.1 },
] as const

const JOBS = [
  { key: "boot", label: "boot read set", mb: 582 },
  { key: "world", label: "+ world after scripts", mb: 1200 },
  { key: "all", label: "whole manifest", mb: 20944 },
] as const

const fmt = (s: number) => {
  if (s < 90) return `${s.toFixed(0)} s`
  if (s < 5400) return `${(s / 60).toFixed(1)} min`
  return `${(s / 3600).toFixed(1)} h`
}

export function StreamingLanes() {
  const [lane, setLane] = useState(3)
  const L = LANES[lane]
  const max = 20944 / LANES[0].mbps

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">fetches in flight → throughput (porter&apos;s measurement)</span>
        <div className="flex gap-1">
          {LANES.map((l, i) => (
            <button
              key={l.n}
              type="button"
              onClick={() => setLane(i)}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-xs",
                lane === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.n}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="font-mono text-sm">
          {L.n} in flight → <span style={{ color: ACCENT }}>{L.mbps} MB/s</span>
        </div>
        {JOBS.map((j) => {
          const s = j.mb / L.mbps
          // log scale so the 20.9 GB bar does not flatten the other two
          const w = (mlog10(1 + s) / mlog10(1 + max)) * 100
          return (
            <div key={j.key}>
              <div className="flex justify-between font-mono text-xs text-muted-foreground">
                <span>
                  {j.label} · {j.mb >= 1000 ? `${(j.mb / 1000).toFixed(1)} GB` : `${j.mb} MB`}
                </span>
                <span className="text-foreground">{fmt(s)}</span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-muted">
                <div className="h-2.5 rounded-full" style={{ width: `${w.toFixed(1)}%`, background: ACCENT }} />
              </div>
            </div>
          )
        })}
      </div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Bars on a log scale. Throughputs are the porter&apos;s own numbers against the original host; times are those
        numbers divided into this build&apos;s file sizes. A Cloudflare cache hit is faster than this.
      </figcaption>
    </figure>
  )
}
