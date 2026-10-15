"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How much of Jeva's latency an option cache can remove, from the paper's own
// medians (arXiv 2610.18773, section 4.4, one H200). Each request costs a part
// that never caches (encode the request, run the decision block) plus a part
// that scales with the options still to encode:
//
//   latency(r) = F + (1 - r) * C,   r = fraction of option rows already cached
//
// F and C are solved from two published points per workload; everything in
// between is our straight line, not a measurement. The paper's 50%-reuse
// MLDR speedup (1.95x) is shown as a check on that line.

type Preset = {
  id: string
  label: string
  off: number
  on: number
  onAt: number
  note: string
  check?: { r: number; speedup: number }
}

const PRESETS: Preset[] = [
  {
    id: "mldr",
    label: "MLDR: long documents as options",
    off: 2102.0,
    on: 75.1,
    onAt: 1,
    note: "p50 2,102.0 ms with no cache, 75.1 ms with every option cached (novel sets, priming excluded)",
    check: { r: 0.5, speedup: 1.95 },
  },
  {
    id: "typed",
    label: "Typed Decisions: short options",
    off: 93.1,
    on: 46.6,
    onAt: 0.992,
    note: "p50 93.1 ms with no cache, 46.6 ms with 99.2% of option rows reused (cold starts included)",
  },
]

export function ReuseCalculator() {
  const [presetIx, setPresetIx] = useState(0)
  const [reuse, setReuse] = useState(100)
  const p = PRESETS[presetIx]

  // two points: latency(0) = off, latency(onAt) = on
  const C = (p.off - p.on) / p.onAt
  const F = p.off - C
  const r = reuse / 100
  const latency = F + (1 - r) * C
  const speedup = p.off / latency
  const fixedShare = F / latency

  const checkLatency = p.check ? F + (1 - p.check.r) * C : 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        option-cache calculator · endpoints reported by the paper, the line between them is ours
      </div>

      <div className="grid gap-3 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Workload">
          {PRESETS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={i === presetIx}
              onClick={() => setPresetIx(i)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                i === presetIx ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <label className="grid gap-1 font-mono text-[11px]">
          <span>
            option rows already in the cache: <strong>{reuse}%</strong>
          </span>
          <Range
            min={0}
            max={100}
            step={1}
            value={reuse}
            onChange={(e) => setReuse(Number(e.target.value))}
            aria-label="Option reuse percentage"
          />
        </label>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">median latency</p>
          <p className="mt-1 font-mono text-xl font-semibold">{latency.toFixed(1)} ms</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">speedup over no cache</p>
          <p className="mt-1 font-mono text-xl font-semibold">{speedup.toFixed(2)}x</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">part that never caches</p>
          <p className="mt-1 font-mono text-xl font-semibold">{(fixedShare * 100).toFixed(0)}%</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex h-5 overflow-hidden rounded-sm bg-muted" aria-hidden>
          <div className="bg-sky-500/70" style={{ width: `${((F / p.off) * 100).toFixed(2)}%` }} />
          <div className="bg-amber-500/70" style={{ width: `${((((1 - r) * C) / p.off) * 100).toFixed(2)}%` }} />
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          blue: request encoding and the decision block ({F.toFixed(1)} ms) · amber: options still to encode (
          {((1 - r) * C).toFixed(1)} ms) · bar width is the no-cache latency
        </p>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        {p.note}.
        {p.check
          ? ` Check: the line predicts ${(p.off / checkLatency).toFixed(2)}x at 50% reuse; the paper measured ${p.check.speedup.toFixed(2)}x.`
          : " The two points are the paper's; with short options there is little to cache."}
      </figcaption>
    </figure>
  )
}
