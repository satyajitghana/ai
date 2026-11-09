"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Muse Ember's two price tiers, from dev.meta.ai/docs/pricing-rate-limits
// (fetched 2026-11-09), per million tokens:
//   up to 200K input tokens: cached input $0.004, input $0.10, output $0.50
//   over 200K input tokens:  cached input $0.012, input $0.30, output $1.50
// "the input tokens in your API request set the tier, cached tokens included" and
// a request over 200K "is billed at the long-context rates in full, not only for
// the tokens past 200K."
//
// The loop model is mine, and deliberately simple. Turn 1 sends the starting
// prefix uncached. Every later turn re-sends the whole conversation; the new
// input and the previous turn's output are billed uncached and everything before
// them as a cache hit. "Compact" resets the conversation to the starting size
// whenever the next request would pass 200K, and does not charge for writing the
// summary.

const TIER = 200_000
const LOW = { cached: 0.004, input: 0.1, output: 0.5 }
const HIGH = { cached: 0.012, input: 0.3, output: 1.5 }

const COL = "oklch(0.58 0.17 255)"
const HOT = "oklch(0.62 0.17 30)"

type Turn = { ctx: number; cost: number; high: boolean }

function run(start: number, grow: number, out: number, turns: number, compact: boolean): Turn[] {
  const res: Turn[] = []
  let ctx = start
  for (let t = 0; t < turns; t++) {
    const unc = t === 0 ? ctx : Math.min(ctx, grow + out)
    const cached = ctx - unc
    const high = ctx > TIER
    const p = high ? HIGH : LOW
    res.push({ ctx, cost: (cached * p.cached + unc * p.input + out * p.output) / 1e6, high })
    ctx += grow + out
    if (compact && ctx > TIER) ctx = start
  }
  return res
}

const usd = (n: number) => `$${n.toFixed(n < 0.01 ? 5 : 3)}`

export function ContextBill() {
  const [start, setStart] = useState(20)
  const [grow, setGrow] = useState(6)
  const [out, setOut] = useState(1.5)
  const [turns, setTurns] = useState(60)
  const [compact, setCompact] = useState(false)

  const shown = run(start * 1000, grow * 1000, out * 1000, turns, compact)
  const plain = run(start * 1000, grow * 1000, out * 1000, turns, false)
  const packed = run(start * 1000, grow * 1000, out * 1000, turns, true)
  const sum = (r: Turn[]) => r.reduce((x, t) => x + t.cost, 0)
  const cross = plain.findIndex((t) => t.high)
  const jump = cross > 0 ? plain[cross].cost / plain[cross - 1].cost : 0

  const W = 640
  const H = 200
  const PAD = 30
  const maxC = Math.max(...plain.map((t) => t.cost), 1e-9)
  const bw = (W - PAD - 6) / turns

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>An agent loop on Muse Ember&apos;s price list</span>
        <span className="text-muted-foreground/60">dev.meta.ai pricing, 2026-11-09</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 grid gap-3 font-mono text-xs sm:grid-cols-2">
          {[
            { label: "starting prefix", v: start, set: setStart, min: 2, max: 150, step: 1, unit: "K tokens" },
            { label: "new input per turn", v: grow, set: setGrow, min: 0.5, max: 30, step: 0.5, unit: "K tokens" },
            { label: "output per turn", v: out, set: setOut, min: 0.5, max: 10, step: 0.5, unit: "K tokens" },
            { label: "turns", v: turns, set: setTurns, min: 5, max: 120, step: 1, unit: "" },
          ].map((c) => (
            <label key={c.label} className="block">
              <span className="flex justify-between text-muted-foreground">
                <span>{c.label}</span>
                <span className="text-foreground">{`${c.v} ${c.unit}`}</span>
              </span>
              <Range min={c.min} max={c.max} step={c.step} value={c.v} onChange={(e) => c.set(Number(e.target.value))} accent={COL} className="w-full" aria-label={c.label} />
            </label>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <button type="button" onClick={() => setCompact((v) => !v)} aria-pressed={compact} className={`rounded-md border px-2.5 py-1 ${compact ? "bg-muted" : "bg-background"}`}>
            {compact ? "compacting before 200K" : "letting the context grow"}
          </button>
          <span className="text-muted-foreground">click to switch</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">loop, growing</div>
            <div className="text-lg">{usd(sum(plain))}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">loop, compacted</div>
            <div className="text-lg">{usd(sum(packed))}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">crosses 200K</div>
            <div className="text-lg">{cross >= 0 ? `turn ${cross + 1}` : "never"}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">cost of that turn</div>
            <div className="text-lg" style={{ color: HOT }}>{cross > 0 ? `${jump.toFixed(2)}x` : "n/a"}</div>
            <div className="text-muted-foreground/70">vs the turn before</div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Cost of each of ${turns} turns. Total ${usd(sum(shown))}. ${cross >= 0 ? `The request passes 200K input tokens at turn ${cross + 1} and its cost jumps ${jump.toFixed(2)} times.` : "The context never passes 200K."}`}>
          <line x1={PAD} y1={H - 16} x2={W - 4} y2={H - 16} stroke="var(--border)" />
          {shown.map((t, i) => {
            const h = (t.cost / maxC) * (H - 40)
            return <rect key={i} x={PAD + i * bw} y={H - 16 - h} width={Math.max(1, bw - 1)} height={h} fill={t.high ? HOT : COL} opacity={0.85} />
          })}
          <text x={PAD} y={12} fontSize={12} className="fill-muted-foreground font-mono">
            {`cost per turn, tallest ${usd(maxC)}`}
          </text>
          <text x={W - 4} y={H - 2} textAnchor="end" fontSize={12} className="fill-muted-foreground font-mono">
            {`turn ${turns}`}
          </text>
          <text x={PAD} y={H - 2} fontSize={12} className="fill-muted-foreground font-mono">
            turn 1
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Orange turns are requests over 200K input tokens, billed at three times the rate on every token including the cached ones.
          The defaults (a 20K prefix, 6K of new input and 1.5K of output per turn, 60 turns) cost $0.344 growing and $0.114 compacted.
          The loop model is my simplification: earlier turns count as cache hits, and the cost of writing a summary is left out.
        </p>
      </div>
    </figure>
  )
}
