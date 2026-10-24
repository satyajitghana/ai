"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { roomyHz, roomyUnzip, streamHz, tightHz, tightUnzip, type Trace } from "./traces"

// Disk usage over time, as measured: the bytes allocated under a tmpfs mount
// holding the archive and its output, polled every ~100 ms while each tool
// ran. Nothing here is simulated; the three scenarios are three mounts.

type Scenario = {
  id: string
  label: string
  disk: number
  hz: Trace
  unzip: Trace | null
  unzipNote: string
  note: string
}

const SCENARIOS: Scenario[] = [
  {
    id: "roomy",
    label: "2 GiB disk",
    disk: 2147.5,
    hz: roomyHz,
    unzip: roomyUnzip,
    unzipNote: "unzip: finished, peak 1,661.7 MB",
    note: "Plenty of room, so hatchzip takes every entry in one batch and truncates once at the end. Its peak is the same as unzip's.",
  },
  {
    id: "tight",
    label: "1.1 GiB disk",
    disk: 1153.4,
    hz: tightHz,
    unzip: tightUnzip,
    unzipNote: "unzip: disk full at entry 34 of 47, exit 50",
    note: "491.8 MB free. hatchzip sizes each batch to the free space, extracts, then cuts the archive: three batches, peak 1,117.5 MB, all 47 files byte-identical.",
  },
  {
    id: "stream",
    label: "one 600 MB file",
    disk: 1048.6,
    hz: streamHz,
    unzip: null,
    unzipNote: "unzip: disk full, exit 50 (needs 1,200 MB)",
    note: "One stored 600 MB entry, 448.6 MB free. The file is bigger than the free space, so hatchzip streams it and punches holes in the archive behind each 256 MiB step: peak 840.3 MB.",
  },
]

const W = 640
const H = 260
const PAD = { l: 52, r: 14, t: 14, b: 30 }
const HZ = "oklch(0.58 0.16 250)"
const UZ = "oklch(0.62 0.17 35)"

function path(tr: Trace, x: (t: number) => number, y: (v: number) => number) {
  return tr.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
}

function peak(tr: Trace) {
  return tr.reduce((m, [, v]) => (v > m ? v : m), 0)
}

export function DiskTrace() {
  const [id, setId] = useState("tight")
  const s = SCENARIOS.find((c) => c.id === id) ?? SCENARIOS[1]
  const tMax = Math.max(s.hz[s.hz.length - 1][0], s.unzip ? s.unzip[s.unzip.length - 1][0] : 0)
  const vMax = Math.ceil(s.disk / 200) * 200 + 100
  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / vMax) * (H - PAD.t - PAD.b)
  const ticks: number[] = []
  for (let v = 0; v <= vMax; v += 400) ticks.push(v)
  const tTicks: number[] = []
  for (let t = 0; t <= tMax + 0.001; t += tMax > 3 ? 1 : 0.5) tTicks.push(t)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        disk used over time · archive + output · measured
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SCENARIOS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setId(c.id)}
              aria-pressed={id === c.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                id === c.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Disk usage over time, ${s.label}. ${s.note}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>
                {v}
              </text>
            </g>
          ))}
          {tTicks.map((t) => (
            <text key={t} x={x(t)} y={H - PAD.b + 14} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>
              {t.toFixed(1)}s
            </text>
          ))}
          <text x={8} y={PAD.t + 4} fontSize={10} fill="currentColor" opacity={0.6}>
            MB
          </text>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(s.disk)} y2={y(s.disk)} stroke="currentColor" strokeDasharray="5 4" strokeOpacity={0.55} />
          <text x={W - PAD.r} y={y(s.disk) - 5} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.75}>
            disk size {s.disk.toLocaleString("en-US")} MB
          </text>
          {s.unzip && <path d={path(s.unzip, x, y)} fill="none" stroke={UZ} strokeWidth={2} />}
          <path d={path(s.hz, x, y)} fill="none" stroke={HZ} strokeWidth={2.4} />
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px]">
          <span style={{ color: HZ }}>hatchzip: finished, peak {peak(s.hz).toLocaleString("en-US", { minimumFractionDigits: 1 })} MB</span>
          <span style={{ color: UZ }}>{s.unzipNote}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{s.note}</p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Measured on a shared 4-core Xeon VM, tmpfs, two threads. Bytes allocated under the mount, sampled about every
        100 ms, so a peak between two samples is missed. The archive is 661.6 MB and extracts to 1,000.0 MB in 47 entries;
        the third scenario is a separate one-entry archive.
      </figcaption>
    </figure>
  )
}
