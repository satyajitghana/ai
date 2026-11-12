"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"

// Agent Substrate: where a density multiple comes from.
//
// Baseline: one warm sandbox per agent, each holding its memory limit.
// Substrate: only running actors hold a worker slot. The scheduler books a
// running actor at its limit plus the runtime's declared overhead
// (cmd/ateapi/internal/scheduling/scheduling.go, Booking). The microVM worker
// declares 4 MiB plus 8 MiB per GiB of limit (cmd/ateworker-microvm/run.go,
// actorOverhead); the gVisor worker declares none. A suspended actor holds no
// slot, only a snapshot in object storage.
//
// How many slots you need is a tail, not a mean: if N agents are each running
// with probability a, independently, the count running is binomial(N, a). We
// size the pool at mean + z * sd (normal approximation), so small fleets need
// proportionally more headroom than large ones. Request parking lets a pool
// run nearer the mean, at the price of queueing.
//
// Everything is +, -, *, /, sqrt and ceil, which are exact in JS, so server and
// client render the same numbers. Illustrative: the independence assumption is
// the generous one, since real traffic is bursty and correlated.

const ACCENT = "oklch(0.58 0.15 250)" // blueprint cobalt
const FLEETS = [100, 250, 1_000, 10_000, 100_000, 1_000_000]
const TAILS = [
  { id: "p50", z: 0, label: "the mean (p50)" },
  { id: "p99", z: 2.326, label: "p99 of concurrency" },
  { id: "p999", z: 3.09, label: "p99.9 of concurrency" },
] as const
const MEMS = [0.5, 1, 2, 4, 8] // GiB per agent

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-US")
}

function fmtGiB(g: number) {
  if (g >= 1024 * 10) return `${fmtInt(g / 1024)} TiB`
  if (g >= 1024) return `${(g / 1024).toFixed(1)} TiB`
  if (g >= 100) return `${fmtInt(g)} GiB`
  return `${g.toFixed(1)} GiB`
}

export function DensityCalculator() {
  const [fleetIdx, setFleetIdx] = useState(2)
  const [activePct, setActivePct] = useState(10) // percent of wall time an agent is running
  const [memIdx, setMemIdx] = useState(2)
  const [tailIdx, setTailIdx] = useState(1)
  const [microvm, setMicrovm] = useState(true)

  const N = FLEETS[fleetIdx]
  const a = activePct / 100
  const memGiB = MEMS[memIdx]
  const tail = TAILS[tailIdx]

  const mean = N * a
  const sd = Math.sqrt(N * a * (1 - a))
  const slots = Math.min(N, Math.max(1, Math.ceil(mean + tail.z * sd)))
  const density = N / slots

  // booking per running actor, GiB: limit + 4 MiB + 8 MiB per GiB on microVM
  const perSlotGiB = microvm ? memGiB + 4 / 1024 + (memGiB * 8) / 1024 : memGiB
  const baselineGiB = N * memGiB
  const substrateGiB = slots * perSlotGiB
  const ideal = a > 0 ? 1 / a : 0
  const headroomShare = slots > 0 ? (slots - mean) / slots : 0

  // the bar: 40 cells, how much of the baseline's memory Substrate still holds
  const CELLS = 40
  const share = Math.min(1, substrateGiB / baselineGiB)
  const lit = Math.max(1, Math.round(share * CELLS))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one warm sandbox per agent vs actors multiplexed on worker slots</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="grid gap-5 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-4">
        <div className="space-y-3">
          <Control label="agents in the fleet" value={fmtInt(N)}>
            <Range
              min={0}
              max={FLEETS.length - 1}
              step={1}
              value={fleetIdx}
              accent={ACCENT}
              onChange={(e) => setFleetIdx(Number(e.target.value))}
              aria-label="agents in the fleet"
            />
          </Control>
          <Control label="share of time an agent is running" value={`${activePct}%`}>
            <Range
              min={1}
              max={60}
              step={1}
              value={activePct}
              accent={ACCENT}
              onChange={(e) => setActivePct(Number(e.target.value))}
              aria-label="share of time an agent is running, percent"
            />
          </Control>
          <Control label="memory limit per agent" value={`${memGiB} GiB`}>
            <Range
              min={0}
              max={MEMS.length - 1}
              step={1}
              value={memIdx}
              accent={ACCENT}
              onChange={(e) => setMemIdx(Number(e.target.value))}
              aria-label="memory limit per agent, GiB"
            />
          </Control>
          <Control label="size the pool for" value={tail.label}>
            <Range
              min={0}
              max={TAILS.length - 1}
              step={1}
              value={tailIdx}
              accent={ACCENT}
              onChange={(e) => setTailIdx(Number(e.target.value))}
              aria-label="percentile of concurrency the pool is sized for"
            />
          </Control>
          <div className="flex gap-2 font-mono text-[11px]">
            {[
              { v: true, l: "microVM (+4 MiB, +8 MiB/GiB)" },
              { v: false, l: "gVisor (no declared overhead)" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setMicrovm(o.v)}
                aria-pressed={microvm === o.v}
                className="rounded-md border px-2 py-1 transition-colors"
                style={
                  microvm === o.v
                    ? { borderColor: ACCENT, color: ACCENT }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="worker slots needed" value={fmtInt(slots)} sub={`mean ${fmtInt(mean)}, +${fmtInt(slots - mean)} headroom`} />
            <Stat label="density" value={`${density.toFixed(1)}x`} sub={`1/active would be ${ideal.toFixed(1)}x`} hot />
            <Stat label="pod per agent holds" value={fmtGiB(baselineGiB)} sub="every agent, all the time" />
            <Stat label="multiplexed holds" value={fmtGiB(substrateGiB)} sub="running actors only" />
          </div>

          <div>
            <svg viewBox="0 0 400 34" className="w-full" role="img" aria-label={`Multiplexed memory is ${(share * 100).toFixed(1)} percent of the pod-per-agent memory.`}>
              {Array.from({ length: CELLS }).map((_, i) => (
                <rect
                  key={i}
                  x={i * 10 + 0.5}
                  y={4}
                  width={8.5}
                  height={26}
                  rx={2}
                  fill={i < lit ? ACCENT : "var(--muted)"}
                  opacity={i < lit ? 0.9 : 0.5}
                />
              ))}
            </svg>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              lit = resident memory left after multiplexing, out of the pod-per-agent total
            </p>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {fmtInt(N)} agents running {activePct}% of the time average {fmtInt(mean)} at once. Sizing
            for {tail.label} needs <span className="text-foreground">{fmtInt(slots)}</span> slots, and{" "}
            <span className="text-foreground">{(headroomShare * 100).toFixed(0)}%</span> of them
            are headroom for bursts. The multiple tends to 1/active only as the fleet grows.
          </p>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Illustrative. Assumes agents run independently, which is generous: correlated bursts need
        more headroom. Leaves out what a suspend costs instead of memory: snapshot storage, the
        checkpoint write, and the restore read. Booking rule and overheads are from Agent
        Substrate&apos;s scheduler and microVM worker at commit e472ffb.
      </p>
    </figure>
  )
}

function Control({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <label className="block rounded-lg border bg-background/40 p-3">
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">{value}</span>
      </div>
      {children}
    </label>
  )
}

function Stat({ label, value, sub, hot }: { label: string; value: string; sub: string; hot?: boolean }) {
  return (
    <div className="rounded-lg border bg-background/40 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-semibold tabular-nums" style={hot ? { color: ACCENT } : undefined}>
        {value}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  )
}
