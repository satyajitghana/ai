"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Illustrates AutoCompact's central claim: a fixed-token-threshold trigger fires
// wherever the token count happens to land, regardless of task phase; a
// phase-aware trigger (what AutoCompact learns to do with its own compact()
// call) fires only at clean phase transitions. Trajectory token costs and
// threshold values are illustrative, chosen to make the mechanism legible —
// AutoCompact's blog post gives no exact trajectory to reproduce. SSR-safe:
// fixed arrays, no random, no timers, deterministic first render.

const CUT = "oklch(0.62 0.2 25)" // red — mid-phase compaction
const CLEAN = "oklch(0.68 0.14 200)" // teal — phase-boundary compaction

type Phase = { name: string; end: number }
const PHASES: Phase[] = [
  { name: "Localize", end: 30 },
  { name: "Explore", end: 55 },
  { name: "Implement", end: 75 },
  { name: "Test", end: 90 },
  { name: "Verify", end: 100 },
]
const TOTAL = 100

const FIXED_RESETS = [40, 80] // every 40k tokens, regardless of phase
const AUTO_RESETS = [55, 90] // exactly at Explore→Implement and Test→Verify

function phaseAt(pos: number): Phase {
  return PHASES.find((p) => pos <= p.end) ?? PHASES[PHASES.length - 1]
}

function held(pos: number, resets: number[]): number {
  let last = 0
  for (const r of resets) if (pos >= r) last = r
  return pos - last
}

function justCompacted(pos: number, resets: number[]): boolean {
  return resets.includes(pos)
}

export function PhaseCompactionTimeline() {
  const [pos, setPos] = useState(55)

  const phase = phaseAt(pos)
  const fixedHeld = held(pos, FIXED_RESETS)
  const autoHeld = held(pos, AUTO_RESETS)
  const fixedFired = justCompacted(pos, FIXED_RESETS)
  const autoFired = justCompacted(pos, AUTO_RESETS)

  const pct = (v: number) => `${(v / TOTAL) * 100}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        when does compact() fire — fixed threshold vs phase boundary
      </div>
      <div className="p-3 sm:p-4">
        {/* phase timeline */}
        <div className="relative h-8 overflow-hidden rounded border">
          {PHASES.map((p, i) => {
            const start = i === 0 ? 0 : PHASES[i - 1].end
            return (
              <div
                key={p.name}
                className="absolute top-0 bottom-0 flex items-center justify-center border-r font-mono text-[10px] text-muted-foreground last:border-r-0"
                style={{ left: pct(start), width: pct(p.end - start), background: i % 2 === 0 ? "var(--muted)" : "transparent" }}
              >
                {p.name}
              </div>
            )
          })}
          {/* current position marker */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-foreground" style={{ left: pct(pos) }} aria-hidden />
        </div>

        {/* reset tick rows */}
        <div className="relative mt-1 h-4">
          {FIXED_RESETS.map((r) => (
            <span key={r} className="absolute top-0 -translate-x-1/2 font-mono text-[9px]" style={{ left: pct(r), color: CUT }}>
              ▲
            </span>
          ))}
        </div>
        <div className="relative h-4">
          {AUTO_RESETS.map((r) => (
            <span key={r} className="absolute top-0 -translate-x-1/2 font-mono text-[9px]" style={{ left: pct(r), color: CLEAN }}>
              ▲
            </span>
          ))}
        </div>

        {/* scrubber */}
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">trajectory</span>
          <Range min={0} max={TOTAL} step={1} value={pos} onChange={(e) => setPos(+e.target.value)} className="w-full" aria-label="trajectory position" accent="var(--foreground)" />
          <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{phase.name}</span>
        </div>

        {/* two lanes */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:w-36">fixed threshold</span>
            <div className="relative h-6 flex-1 rounded bg-muted/40">
              <div className="absolute top-0 left-0 h-full rounded transition-all" style={{ width: `${Math.min((fixedHeld / 40) * 100, 100)}%`, background: CUT }} />
            </div>
            <span className="w-24 shrink-0 font-mono text-[11px] tabular-nums" style={{ color: fixedFired ? CUT : "var(--muted-foreground)" }}>
              {fixedFired ? "compact() · mid-phase" : `${fixedHeld}k held`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-right font-mono text-[11px] text-foreground sm:w-36">AutoCompact</span>
            <div className="relative h-6 flex-1 rounded bg-muted/40">
              <div className="absolute top-0 left-0 h-full rounded transition-all" style={{ width: `${Math.min((autoHeld / 55) * 100, 100)}%`, background: CLEAN }} />
            </div>
            <span className="w-24 shrink-0 font-mono text-[11px] tabular-nums" style={{ color: autoFired ? CLEAN : "var(--muted-foreground)" }}>
              {autoFired ? "compact() · clean" : `${autoHeld}k held`}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag the scrubber past <span style={{ color: CUT }}>40k or 80k</span>{" "}and the fixed-threshold lane fires mid-{phaseAt(40).name.toLowerCase()} or
          mid-{phaseAt(80).name.toLowerCase()} — it only ever counts tokens, never task state. Past{" "}
          <span style={{ color: CLEAN }}>55k or 90k</span>{" "}the AutoCompact lane fires too, but always exactly at a phase transition (Explore→Implement,
          Test→Verify) — the same rough token budget, timed to a boundary the model itself decided was safe to summarize across. This trajectory and
          both thresholds are illustrative, not a measured trace; AutoCompact&apos;s post gives the mechanism but no exact numbers to reproduce here.
        </p>
      </div>
    </figure>
  )
}
