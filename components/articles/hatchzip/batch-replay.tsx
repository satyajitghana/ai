"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A port of hatchzip's batch loop (crates/core/src/engine.rs: Run::execute,
// next_batch, commit) run on the test archive's real entry sizes. Units are
// taken from the end of the archive; a batch keeps taking them while their
// output fits in the free space measured now minus --keep-free (and under
// 2 GB and 512 units); then the batch is flushed, journaled, and the archive
// is truncated to where the batch's lowest unit begins.

type Unit = { name: string; out: number; span: number }

// In archive order. Output sizes are rounded up to 4 KiB blocks, as the
// engine counts them; spans are header + data + descriptor, in MB.
const UNITS: Unit[] = [
  ...Array.from({ length: 30 }, (_, i) => ({ name: `text_${String(i).padStart(2, "0")}`, out: 13.337, span: 2.047 })),
  ...Array.from({ length: 16 }, (_, i) => ({ name: `blob_${String(i).padStart(2, "0")}`, out: 25.002, span: 25.008 })),
  { name: "big.bin", out: 200.004, span: 200.061 },
]
const TAIL = 0.003
const ARCHIVE = UNITS.reduce((a, u) => a + u.span, 0) + TAIL
const KEEP = 16
const BATCH_MAX = 2000

type Batch = { first: number; last: number; out: number; freed: number; before: number; peak: number; after: number }
type Plan = { batches: Batch[]; peak: number; failed: string | null }

function replay(free: number): Plan {
  // Highest offset first, as Job::build sorts them.
  const units = [...UNITS].reverse()
  let used = ARCHIVE + TAIL // the saved tail is written before anything is cut
  const disk = ARCHIVE + free
  let peak = used
  const batches: Batch[] = []
  let next = 0
  while (next < units.length) {
    const avail = disk - used - KEEP
    if (units[next].out > avail) {
      return { batches, peak, failed: `${units[next].name} needs ${units[next].out.toFixed(1)} MB, ${Math.max(0, avail).toFixed(1)} MB usable` }
    }
    const budget = Math.min(avail, Math.max(BATCH_MAX, units[next].out))
    let size = 0
    let end = next
    while (end < units.length && end - next < 512) {
      if (end > next && size + units[end].out > budget) break
      size += units[end].out
      end++
    }
    const before = used
    used += size
    peak = Math.max(peak, used)
    const freed = units.slice(next, end).reduce((a, u) => a + u.span, 0)
    const top = used
    used -= freed
    batches.push({ first: next, last: end - 1, out: size, freed, before, peak: top, after: used })
    next = end
  }
  return { batches, peak, failed: null }
}

const OUT = UNITS.reduce((a, u) => a + u.out, 0)
const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export function BatchReplay() {
  const [free, setFree] = useState(492)
  const plan = useMemo(() => replay(free), [free])
  const unzipFits = OUT + KEEP <= free
  const disk = ARCHIVE + free
  const scale = (v: number) => (v / disk) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        the batch loop, replayed on the test archive · drag the free space
      </div>
      <div className="p-3 sm:p-4">
        <label className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>free space before extracting</span>
          <span className="text-foreground">{free} MB</span>
        </label>
        <Range min={320} max={1600} step={4} value={free} onChange={(e) => setFree(Number(e.target.value))} aria-label="Free space before extracting, MB" />
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          disk {fmt(disk)} MB · archive {fmt(ARCHIVE)} MB · output {fmt(OUT)} MB · keep-free {KEEP} MB · unzip{" "}
          <span className={unzipFits ? "text-foreground" : "text-red-600 dark:text-red-400"}>{unzipFits ? "fits" : "runs out of space"}</span>
        </p>

        <ol className="mt-3 space-y-2">
          {plan.batches.map((b, i) => (
            <li key={i} className="font-mono text-[11px]">
              <div className="mb-0.5 flex flex-wrap justify-between gap-x-3 text-muted-foreground">
                <span className="text-foreground">batch {i + 1}</span>
                <span>
                  {b.last - b.first + 1} units, writes {fmt(b.out)} MB, then cuts {fmt(b.freed)} MB
                </span>
              </div>
              <div className="relative h-3.5 overflow-hidden rounded bg-muted/40" aria-hidden>
                <div className="absolute inset-y-0 left-0 bg-foreground/70" style={{ width: `${scale(b.before).toFixed(2)}%` }} />
                <div
                  className="absolute inset-y-0 bg-sky-500/80"
                  style={{ left: `${scale(b.before).toFixed(2)}%`, width: `${scale(b.out).toFixed(2)}%` }}
                />
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                used before {fmt(b.before)} → peak {fmt(b.peak)} → after the cut {fmt(b.after)} MB
              </div>
            </li>
          ))}
        </ol>
        {plan.failed ? (
          <p className="mt-3 font-mono text-[11px] text-red-600 dark:text-red-400">does not fit. The loop would stall here ({plan.failed}); the real tool replays this before it starts and refuses with exit code 3, archive untouched.</p>
        ) : (
          <p className="mt-3 font-mono text-[11px] text-foreground">
            {plan.batches.length} batch{plan.batches.length === 1 ? "" : "es"}, peak {fmt(plan.peak)} MB used of {fmt(disk)} MB
          </p>
        )}
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Grey is what is on disk when a batch starts (archive left plus files done), blue what the batch writes before the
        archive is cut. Sizes are the test archive&apos;s own entries; the loop is a port of <code>next_batch</code> and{" "}
        <code>commit</code>. At 492 MB free it gives the three batches the measured run shows.
      </figcaption>
    </figure>
  )
}
