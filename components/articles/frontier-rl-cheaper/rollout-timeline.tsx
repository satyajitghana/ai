"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// The second half of the argument: what small deltas buy you in wall-clock. An RL rollout
// fleet is only earning its keep while it is GENERATING trajectories. Under the mega-cluster
// premise you ship the full checkpoint on every update, and the fleet idles through each
// cross-region transfer (green = generating, red = stalled). Async RL overlaps transfer with
// generation and swaps weights in place — but that only works if the handoff is small enough
// to hide behind a generation window. Drag the payload from a ~2% delta up to the full model
// and watch the async fleet fill with stalls and fall further off-policy. Relative units,
// clearly illustrative; the real anchors (full = a few minutes, in-memory swap < 1 min) live
// in the prose.

const GEN = "oklch(0.62 0.15 150)" // green — generating rollouts (useful work)
const STALL = "oklch(0.63 0.19 28)" // red — idle, waiting on weight transfer
const SWAP = "oklch(0.58 0.16 295)" // violet — in-memory weight swap (matches the delta color)

// relative time units
const TL = 100 // fixed wall-clock window
const G = 12 // a fleet generates for this long per policy version
const SWAP_T = 1.2 // in-memory swap blip ("< 1 min")
const T_FULL = 18 // full cross-region checkpoint transfer ("a few minutes") — larger than G
const MAX_BLOCKS = 80 // SSR guard: the fill loop can never spin unbounded

// scene geometry (viewBox units)
const W = 680
const H = 238
const LX = 120 // timeline start x (lane labels sit to the left)
const PR = 18
const PLOT_W = W - LX - PR
const ux = (u: number) => LX + (u / TL) * PLOT_W // time unit → x

type Kind = "gen" | "stall" | "swap"
type Block = { x: number; w: number; kind: Kind }

// tile a repeating cycle across the window; clip the final block; count generation.
function fill(cycle: { kind: Kind; len: number }[]): { blocks: Block[]; green: number; versions: number } {
  const blocks: Block[] = []
  let u = 0
  let green = 0
  let versions = 0
  const cycleLen = cycle.reduce((s, c) => s + c.len, 0) || 1
  for (let i = 0; i < MAX_BLOCKS && u < TL; i++) {
    const seg = cycle[i % cycle.length]
    if (i % cycle.length === 0 && u < TL) versions++
    const w = Math.min(seg.len, TL - u)
    blocks.push({ x: u, w, kind: seg.kind })
    if (seg.kind === "gen") green += w
    u += cycleLen === 0 ? TL : seg.len
  }
  return { blocks, green, versions }
}

export function RolloutTimeline() {
  const [payload, setPayload] = useState(2) // % of full model shipped per update

  const T = (payload / 100) * T_FULL // this update's transfer time

  // sync baseline: always ships the full checkpoint, no overlap → generate, stall, swap
  const sync = fill([
    { kind: "gen", len: G },
    { kind: "stall", len: T_FULL },
    { kind: "swap", len: SWAP_T },
  ])

  // async + delta: transfer overlaps generation; only the overshoot (T − G) stalls, then swap
  const asyncCycle: { kind: Kind; len: number }[] = [{ kind: "gen", len: G }]
  const overshoot = Math.max(0, T - G)
  if (overshoot > 0) asyncCycle.push({ kind: "stall", len: overshoot })
  asyncCycle.push({ kind: "swap", len: SWAP_T })
  const asy = fill(asyncCycle)

  const utilSync = (sync.green / TL) * 100
  const utilAsync = (asy.green / TL) * 100
  const staleAsync = Math.max(1, Math.ceil(T / G)) // policy versions the fleet runs behind

  const colorFor = (k: Kind) => (k === "gen" ? GEN : k === "swap" ? SWAP : STALL)

  const lane = (blocks: Block[], y: number) =>
    blocks.map((b, i) => (
      <rect key={i} x={ux(b.x)} y={y} width={Math.max(0, ux(b.x + b.w) - ux(b.x) - 0.6)} height={28} rx={2}
        fill={colorFor(b.kind)} opacity={b.kind === "gen" ? 0.9 : b.kind === "swap" ? 0.85 : 0.5} className="transition-all duration-200" />
    ))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>rollout fleet · same wall-clock window</span>
        <span className="text-muted-foreground/60">relative units · illustrative</span>
      </div>

      <div className="p-4 sm:p-5">
        {/* readouts */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex gap-6">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">sync · full checkpoint</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{utilSync.toFixed(0)}%<span className="text-xs text-muted-foreground"> generating</span></div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: GEN }}>async · {payload.toFixed(1)}% delta</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: GEN }}>{utilAsync.toFixed(0)}%<span className="text-xs text-muted-foreground"> generating</span></div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground">async staleness</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{staleAsync} ver{staleAsync > 1 ? "s" : ""}<span className="text-xs text-muted-foreground"> behind</span></div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Two rollout-fleet timelines over the same window. Shipping the full checkpoint every update keeps the fleet generating ${utilSync.toFixed(0)}% of the time; shipping a ${payload}% delta asynchronously keeps it at ${utilAsync.toFixed(0)}%, running ${staleAsync} policy version behind.`}>
          {/* lane 1: sync */}
          <text x={LX} y={40} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>ship full every step</text>
          <text x={LX} y={54} className="fill-muted-foreground font-mono" fontSize={9}>co-located premise</text>
          <text x={8} y={78} className="fill-muted-foreground font-mono" fontSize={9}>rollout</text>
          <text x={8} y={90} className="fill-muted-foreground font-mono" fontSize={9}>fleet</text>
          {lane(sync.blocks, 62)}
          <text x={W - PR} y={54} textAnchor="end" className="font-mono" fontSize={9} fill={STALL}>{sync.versions} policy versions</text>

          {/* lane 2: async */}
          <text x={LX} y={140} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>async + delta</text>
          <text x={LX} y={154} className="fill-muted-foreground font-mono" fontSize={9}>overlap transfer, swap in place</text>
          {lane(asy.blocks, 162)}
          <text x={W - PR} y={154} textAnchor="end" className="font-mono" fontSize={9} fill={GEN}>{asy.versions} policy versions</text>

          <text x={LX} y={208} className="fill-muted-foreground/70 font-mono" fontSize={9}>wall clock →</text>
          <line x1={LX} x2={W - PR} y1={200} y2={200} stroke="currentColor" className="text-border" strokeWidth={1} />

          {/* legend */}
          <g transform={`translate(${LX}, 222)`}>
            <rect x={0} y={-8} width={10} height={10} rx={2} fill={GEN} opacity={0.9} />
            <text x={15} y={1} className="fill-muted-foreground font-mono" fontSize={9}>generating</text>
            <rect x={90} y={-8} width={10} height={10} rx={2} fill={STALL} opacity={0.5} />
            <text x={105} y={1} className="fill-muted-foreground font-mono" fontSize={9}>stalled on transfer</text>
            <rect x={230} y={-8} width={10} height={10} rx={2} fill={SWAP} opacity={0.85} />
            <text x={245} y={1} className="fill-muted-foreground font-mono" fontSize={9}>in-memory swap</text>
          </g>
        </svg>

        {/* control */}
        <label className="mt-2 block">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>update payload (% of full model)</span>
            <span style={{ color: T > G ? STALL : GEN }}>{payload.toFixed(1)}%{T > G ? " · handoff exceeds a generation window" : " · hides behind generation"}</span>
          </div>
          <Range min={0.5} max={100} step={0.5} value={payload} onChange={(e) => setPayload(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.62 0.15 150)" />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The fleet only earns while it is <span style={{ color: GEN }}>generating</span>. Ship the full checkpoint on every
          update and it idles through each cross-region transfer — the reason the naive answer is one co-located cluster.
          Async RL overlaps the transfer with generation and swaps weights in place, so a small{" "}
          <span style={{ color: SWAP }}>delta</span> hides behind a single generation window and the fleet stays warm at{" "}
          <span style={{ color: GEN }}>{utilAsync.toFixed(0)}%</span>, one policy version off-policy. Drag the payload up: once the
          handoff no longer fits inside a generation window it <span style={{ color: STALL }}>stalls</span> and staleness climbs —
          which is exactly why the {"<"}2% delta, not async alone, is what makes distributed rollouts practical.
        </p>
      </div>
    </figure>
  )
}
