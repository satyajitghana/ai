"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The hero run's own changelog, laid on its step axis. Every entry is taken from the
// W&B report's "Phases" list (535B-A23B 18T Token Hero Run + Scaling Ladder), the
// mixture log (docs/reports/hero-mixture-log.md) and the issues each entry links to.
// The run is 390,251 steps of 11,264 x 4,096 tokens. Nothing here is simulated.

const TOTAL = 390251

type Change = {
  step: number
  short: string
  what: string
  why: string
  effect: string
  kind: "model" | "systems" | "data" | "ops"
}

const CHANGES: Change[] = [
  {
    step: 0,
    short: "Start",
    what: "Launch: d6144, 48 layers, 384 routed experts (top-8), MuonH, pooled-wave expert parallelism.",
    why: "The recipe the five-width scaling ladder was trained with.",
    effect: "About 21% MFU; roughly 3% of expert assignments dropped at capacity factor 1.15.",
    kind: "model",
  },
  {
    step: 58014,
    short: "Gate + router WD",
    what: "Decoupled weight decay 0.02 on attn_gate and the router weight, annealed linearly to 0 by the last step.",
    why: "Both norms left the ladder's trend about 1% into the run (#8818). Loss was on track; this was insurance.",
    effect: "The gate norm's growth slowed. Small-scale ablations put the loss effect inside noise.",
    kind: "model",
  },
  {
    step: 81716,
    short: "Ragged EP",
    what: "Expert-parallel transport swapped from fixed pooled-wave to ragged all-to-all, fp32 weights on device.",
    why: "Pooled-wave drops tokens at fixed capacity; ragged moves only what each expert receives.",
    effect: "21 to 23 MFU and near-dropless. Train loss slightly lower from fewer dropped tokens.",
    kind: "systems",
  },
  {
    step: 108000,
    short: "New data mix",
    what: "Phase 2 of the Harrier mixture: more command-line agent transcripts, law and news; less web code, finance, history, math.",
    why: "An H100 ladder with the swap measured a 1.20x compute-equivalent gain at d1536 (#9126).",
    effect: "Train loss slightly higher: the new data is harder to predict. Held-out loss is the number that counts.",
    kind: "data",
  },
  {
    step: 108778,
    short: "PDL off",
    what: "Programmatic dependent launch disabled for the QuACK grouped GEMMs.",
    why: "Intermittent hangs. The kernel source traces them to warps reading expert group boundaries before the previous kernel's writes landed.",
    effect: "The source records the cost on the expert MLP as within noise.",
    kind: "ops",
  },
  {
    step: 121638,
    short: "Checkpoint fix",
    what: "Fix for checkpoint writes crashing the run.",
    why: "A run that cannot checkpoint cannot survive a hardware fault.",
    effect: "No model change.",
    kind: "ops",
  },
  {
    step: 146139,
    short: "FA4 SM100",
    what: "Native SM100 FA4 attention kernels and a mask-free ragged expert MLP.",
    why: "Kernels written for Blackwell, and an expert MLP that skips the padded rows of its receive buffer.",
    effect: "24 to 27 MFU.",
    kind: "systems",
  },
]

const MIX = [
  { from: 0, to: 108000, label: "Phase 1 · Harrier" },
  { from: 108000, to: 312192, label: "Phase 2 · main" },
  { from: 312192, to: TOTAL, label: "Phase 3 · cooldown (planned)" },
]

const HALF = Math.round(TOTAL / 2)

const KIND_COLOR: Record<Change["kind"], string> = {
  model: "oklch(0.62 0.17 30)",
  systems: "oklch(0.6 0.15 250)",
  data: "oklch(0.62 0.15 150)",
  ops: "oklch(0.6 0.04 260)",
}

const pct = (s: number) => (s / TOTAL) * 100
const fmt = (n: number) => n.toLocaleString("en-US")

export function RunTimeline() {
  const [i, setI] = useState(1)
  const c = CHANGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">hero run · 390,251 steps · 18T tokens</span>
        <span className="text-muted-foreground">click a mark</span>
      </div>

      <div className="px-4 pt-5 pb-2">
        {/* step axis */}
        <div className="relative h-16">
          <div className="absolute top-7 right-0 left-0 h-1.5 rounded-full bg-muted" />
          <div
            className="absolute top-7 left-0 h-1.5 rounded-full bg-foreground/25"
            style={{ width: `${pct(HALF)}%` }}
          />
          <div
            className="absolute top-3 h-10 border-l border-dashed border-foreground/40"
            style={{ left: `${pct(HALF)}%` }}
          />
          <span
            className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground"
            style={{ left: `${pct(HALF)}%` }}
          >
            halfway
          </span>
          {CHANGES.map((ch, k) => (
            <button
              key={ch.step}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Step ${fmt(ch.step)}: ${ch.short}`}
              aria-pressed={k === i}
              className={cn(
                "absolute top-[22px] size-4 -translate-x-1/2 rounded-full border-2 border-background transition-transform",
                k === i ? "scale-125 ring-2 ring-foreground/60" : "hover:scale-110",
              )}
              style={{ left: `${pct(ch.step)}%`, background: KIND_COLOR[ch.kind] }}
            />
          ))}
        </div>

        {/* mixture phases */}
        <div className="relative mt-1 h-6 font-mono text-[10px]">
          {MIX.map((m, k) => (
            <div
              key={m.label}
              className={cn(
                "absolute top-0 flex h-5 items-center overflow-hidden rounded-sm px-1 whitespace-nowrap",
                k === 0 && "bg-emerald-500/10",
                k === 1 && "bg-emerald-500/20",
                k === 2 && "border border-dashed border-emerald-500/40 bg-transparent",
              )}
              style={{ left: `${pct(m.from)}%`, width: `${pct(m.to - m.from)}%` }}
              title={m.label}
            >
              <span className="truncate text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>0</span>
          <span>100k</span>
          <span>200k</span>
          <span>300k</span>
          <span>390k</span>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-4 text-sm sm:grid-cols-[9rem_1fr]">
        <div className="font-mono text-xs">
          <div className="text-base font-semibold" style={{ color: KIND_COLOR[c.kind] }}>
            {fmt(c.step)}
          </div>
          <div className="text-muted-foreground">{pct(c.step).toFixed(1)}% of the run</div>
          <div className="mt-1 text-muted-foreground">{c.kind}</div>
        </div>
        <dl className="space-y-1.5">
          <div>
            <dt className="inline font-medium">Change:</dt> <dd className="inline">{c.what}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Why:</dt> <dd className="inline">{c.why}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Effect:</dt> <dd className="inline">{c.effect}</dd>
          </div>
        </dl>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Every mid-run change the team logged, on the run&apos;s own step axis. Entries and steps are from
        the W&amp;B report&apos;s phase list; the mixture bands are from the hero mixture log. Colour marks the
        kind of change: model, systems, data, operations.
      </figcaption>
    </figure>
  )
}
