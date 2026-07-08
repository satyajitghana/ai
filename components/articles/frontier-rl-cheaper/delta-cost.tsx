"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The whole cost argument, made draggable. RL keeps a rollout fleet fresh by shipping
// the trainer's new weights to it. The mega-cluster premise assumes you ship the FULL
// checkpoint every update — so cross-region transfer scales with (full size × steps ×
// regions), which only a co-located RDMA cluster can absorb. Fireworks' point: adjacent
// RL checkpoints are >98% bit-identical, so you ship a ~2% delta instead, with a full
// checkpoint only every N steps to reset the chain. Drag the delta size and the cadence
// and watch the cumulative cross-region volume collapse. Volumes are modelled from the
// post's sample setup (1024 GiB checkpoint); the shape, not any exact byte, is the point.

const FULL = "oklch(0.70 0.16 45)" // orange — full checkpoint (matches the source figures)
const DELTA = "oklch(0.58 0.16 295)" // violet — compact delta (matches the source figures)

const W_STEPS = 50 // the post's 50-step sample window

// scene geometry (viewBox units)
const W = 640
const H = 280
const PL = 54
const PB = 30
const PT = 16
const PR = 16

const GiB_PER_TiB = 1024

// full checkpoints land on step 1, 1+N, 1+2N, … inside the window
function fullsUpTo(k: number, N: number) {
  if (k < 1) return 0
  return Math.floor((k - 1) / N) + 1
}

export function DeltaCost() {
  const [delta, setDelta] = useState(2) // % of full model shipped per delta
  const [N, setN] = useState(25) // full checkpoint every N steps
  const [ckpt, setCkpt] = useState(1024) // full checkpoint size, GiB
  const [regions, setRegions] = useState(3) // rollout regions fed the same stream

  const dGiB = (delta / 100) * ckpt // one delta, GiB
  const perRegDelta = (k: number) => {
    const fulls = fullsUpTo(k, N)
    return fulls * ckpt + (k - fulls) * dGiB
  }
  const naiveCum = (k: number) => k * ckpt * regions // full every step, all regions
  const deltaCum = (k: number) => perRegDelta(k) * regions

  const totalNaive = naiveCum(W_STEPS)
  const totalDelta = deltaCum(W_STEPS)
  const reduction = totalNaive > 0 ? (1 - totalDelta / totalNaive) * 100 : 0

  const yMax = totalNaive || 1
  const chartW = W - PL - PR
  const chartH = H - PT - PB
  const x = (k: number) => PL + (k / W_STEPS) * chartW
  const y = (v: number) => PT + (1 - v / yMax) * chartH

  const line = (f: (k: number) => number) =>
    Array.from({ length: W_STEPS + 1 }, (_, k) => `${k === 0 ? "M" : "L"} ${x(k).toFixed(1)} ${y(f(k)).toFixed(1)}`).join(" ")

  const naivePath = line(naiveCum)
  const deltaPath = line(deltaCum)

  // filled gap between the two curves = what deltas save
  const gap = `${naivePath} ${Array.from({ length: W_STEPS + 1 }, (_, k) => `L ${x(W_STEPS - k).toFixed(1)} ${y(deltaCum(W_STEPS - k)).toFixed(1)}`).join(" ")} Z`

  // full-checkpoint markers on the delta curve
  const fullSteps: number[] = []
  for (let k = 1; k <= W_STEPS; k += N) fullSteps.push(k)

  const fmtTiB = (gib: number) => {
    const t = gib / GiB_PER_TiB
    if (t >= 100) return `${t.toFixed(0)} TiB`
    if (t >= 10) return `${t.toFixed(1)} TiB`
    if (t >= 1) return `${t.toFixed(2)} TiB`
    return `${gib.toFixed(0)} GiB`
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cross-region weight traffic · {W_STEPS}-step window</span>
        <span className="text-muted-foreground/60">modelled · illustrative</span>
      </div>

      <div className="p-4 sm:p-5">
        {/* headline readouts */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex gap-5">
            <div>
              <div className="font-mono text-[10px]" style={{ color: FULL }}>ship full every step</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: FULL }}>{fmtTiB(totalNaive)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: DELTA }}>full every {N} + deltas</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: DELTA }}>{fmtTiB(totalDelta)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground">you move</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {reduction.toFixed(1)}%<span className="text-xs text-muted-foreground"> less</span>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Cumulative cross-region weight traffic over ${W_STEPS} steps: shipping the full ${ckpt} GiB checkpoint every step totals ${fmtTiB(totalNaive)}, versus ${fmtTiB(totalDelta)} when only a ${delta}% delta ships between full checkpoints every ${N} steps — ${reduction.toFixed(0)}% less.`}>
          {/* gridlines + y labels (TiB) */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(t * yMax)} y2={y(t * yMax)} stroke="currentColor" className="text-border" strokeWidth={1} opacity={t === 0 ? 1 : 0.5} />
              <text x={PL - 6} y={y(t * yMax) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{Math.round((t * yMax) / GiB_PER_TiB)}</text>
            </g>
          ))}
          <text x={PL - 6} y={PT - 5} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8}>TiB</text>

          {/* saved region */}
          <path d={gap} fill={DELTA} opacity={0.07} />

          {/* naive curve */}
          <path d={naivePath} fill="none" stroke={FULL} strokeWidth={2.5} strokeLinecap="round" />
          {/* delta curve */}
          <path d={deltaPath} fill="none" stroke={DELTA} strokeWidth={2.5} strokeLinecap="round" />

          {/* full-checkpoint markers on the delta chain */}
          {fullSteps.map((k) => (
            <circle key={k} cx={x(k)} cy={y(deltaCum(k))} r={3} fill={DELTA} stroke="var(--background)" strokeWidth={1.5} />
          ))}

          {/* end labels */}
          <text x={x(W_STEPS)} y={y(totalNaive) - 6} textAnchor="end" className="font-mono" fontSize={9} fill={FULL}>full every step</text>
          <text x={x(W_STEPS)} y={y(totalDelta) - 6} textAnchor="end" className="font-mono" fontSize={9} fill={DELTA}>delta chain</text>

          <text x={PL + chartW / 2} y={H - 3} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>training step →</text>
        </svg>

        {/* controls */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>delta size</span>
              <span style={{ color: DELTA }}>{delta.toFixed(1)}% · ≈{dGiB.toFixed(0)} GiB/step</span>
            </div>
            <input type="range" min={0.5} max={100} step={0.5} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.16_295)]" />
          </label>
          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>full checkpoint cadence</span>
              <span className="text-foreground">every {N} steps</span>
            </div>
            <input type="range" min={1} max={50} step={1} value={N} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.03_260)]" />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">checkpoint</span>
            {[512, 1024, 2048].map((c) => (
              <button key={c} type="button" onClick={() => setCkpt(c)} aria-pressed={ckpt === c}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", ckpt === c ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {c} GiB
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">rollout regions</span>
            {[1, 3, 6].map((r) => (
              <button key={r} type="button" onClick={() => setRegions(r)} aria-pressed={regions === r}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", regions === r ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {r}×
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Shipping the <span style={{ color: FULL }}>full checkpoint every step</span> is the mega-cluster premise: traffic grows
          linearly and only a co-located RDMA fabric keeps up. Send a <span style={{ color: DELTA }}>~{delta.toFixed(0)}% delta</span> instead —
          with a full checkpoint every {N} steps to reset the chain — and the same {W_STEPS} steps across {regions} region{regions > 1 ? "s" : ""} move{" "}
          <span className="text-foreground">{reduction.toFixed(0)}% less</span>. Drag the delta toward 100% and the two curves
          meet: at that point you are back to shipping the whole model, and the co-located cluster is the only thing that can absorb it.
          The percentage saved is the same in one region or six — but the absolute bytes you no longer move scale with every region you add.
        </p>
      </div>
    </figure>
  )
}
