"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// FarSkip-Collective, drawn as a timeline. A standard MoE layer's all-to-all
// dispatch/combine communication sits BETWEEN compute stages and blocks the
// compute engine while it runs. FarSkip-Collective feeds the MoE and attention
// sub-blocks a deliberately outdated/partial activation, which removes the
// data dependency that forces that wait — so the same communication can be
// issued alongside compute instead of after it. Two layers shown; the dashed
// line marks where the standard timeline would still be running. Illustrative,
// not a trace of real kernel timings.

const COMPUTE = "oklch(0.60 0.14 250)"
const COMM = "oklch(0.70 0.16 45)"

type Mode = "standard" | "farskip"

type Block = {
  lane: "compute" | "network"
  layer: 0 | 1
  label: string
  x0: number
  x1: number
}

// unit widths (relative, illustrative)
const ATTN = 70
const DISPATCH = 56
const EXPERT = 70
const COMBINE = 42

const STANDARD: Block[] = [
  { lane: "compute", layer: 0, label: "attn", x0: 0, x1: ATTN },
  { lane: "network", layer: 0, label: "dispatch", x0: ATTN, x1: ATTN + DISPATCH },
  { lane: "compute", layer: 0, label: "expert FFN", x0: ATTN + DISPATCH, x1: ATTN + DISPATCH + EXPERT },
  { lane: "network", layer: 0, label: "combine", x0: ATTN + DISPATCH + EXPERT, x1: ATTN + DISPATCH + EXPERT + COMBINE },
  { lane: "compute", layer: 1, label: "attn", x0: 238, x1: 238 + ATTN },
  { lane: "network", layer: 1, label: "dispatch", x0: 238 + ATTN, x1: 238 + ATTN + DISPATCH },
  { lane: "compute", layer: 1, label: "expert FFN", x0: 238 + ATTN + DISPATCH, x1: 238 + ATTN + DISPATCH + EXPERT },
  { lane: "network", layer: 1, label: "combine", x0: 238 + ATTN + DISPATCH + EXPERT, x1: 238 + ATTN + DISPATCH + EXPERT + COMBINE },
]
const STANDARD_TOTAL = 476

// FarSkip: dispatch(L) rides the stale/outdated activation, so it no longer
// waits on attn(L) to finish — it overlaps that same layer's own compute.
// combine(L) overlaps the next layer's attn compute for the same reason: the
// engine can move on before the collective actually lands. Only the very last
// combine has nothing left to hide under, so it trails exposed — matching the
// paper's own "97.3% / 88.9% overlap", not 100%.
const FARSKIP: Block[] = [
  { lane: "compute", layer: 0, label: "attn", x0: 0, x1: ATTN },
  { lane: "network", layer: 0, label: "dispatch", x0: 0, x1: DISPATCH },
  { lane: "compute", layer: 0, label: "expert FFN", x0: ATTN, x1: ATTN + EXPERT },
  { lane: "network", layer: 0, label: "combine", x0: ATTN + EXPERT, x1: ATTN + EXPERT + COMBINE },
  { lane: "compute", layer: 1, label: "attn", x0: ATTN + EXPERT, x1: ATTN + EXPERT + ATTN },
  { lane: "network", layer: 1, label: "dispatch", x0: ATTN + EXPERT, x1: ATTN + EXPERT + DISPATCH },
  { lane: "compute", layer: 1, label: "expert FFN", x0: ATTN + EXPERT + ATTN, x1: ATTN + EXPERT + ATTN + EXPERT },
  { lane: "network", layer: 1, label: "combine", x0: ATTN + EXPERT + ATTN + EXPERT, x1: ATTN + EXPERT + ATTN + EXPERT + COMBINE },
]
const FARSKIP_TOTAL = ATTN + EXPERT + ATTN + EXPERT + COMBINE // 322

const COMPUTE_ACTIVE = 2 * (ATTN + EXPERT) // 280, same in both modes

// geometry
const W = 760
const H = 250
const MX = 40
const SCALE = (W - 2 * MX) / STANDARD_TOTAL
const ux = (u: number) => MX + u * SCALE
const COMPUTE_Y = 66
const NETWORK_Y = 156
const LANE_H = 40

export function FarskipTimeline() {
  const [mode, setMode] = useState<Mode>("standard")
  const blocks = mode === "standard" ? STANDARD : FARSKIP
  const total = mode === "standard" ? STANDARD_TOTAL : FARSKIP_TOTAL
  const util = Math.round((COMPUTE_ACTIVE / total) * 100)
  const saved = Math.round((1 - FARSKIP_TOTAL / STANDARD_TOTAL) * 100)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        farskip-collective · compute vs. network, two layers
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Timeline of two MoE layers' compute and network activity. In ${mode} mode the critical path is ${total} relative units, with the compute engine busy ${util}% of the time.`}
        >
          <defs>
            <filter id="fs-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* lane labels + background bands */}
          <rect x={MX} y={COMPUTE_Y} width={W - 2 * MX} height={LANE_H} rx={6} fill="var(--muted)" opacity={0.25} />
          <rect x={MX} y={NETWORK_Y} width={W - 2 * MX} height={LANE_H} rx={6} fill="var(--muted)" opacity={0.25} />
          <text x={MX} y={COMPUTE_Y - 10} className="fill-muted-foreground font-mono" fontSize={11}>compute engine</text>
          <text x={MX} y={NETWORK_Y - 10} className="fill-muted-foreground font-mono" fontSize={11}>network (all-to-all)</text>

          {/* reference line: where standard would still be running */}
          {mode === "farskip" && (
            <>
              <line
                x1={ux(STANDARD_TOTAL)} y1={30}
                x2={ux(STANDARD_TOTAL)} y2={NETWORK_Y + LANE_H + 4}
                stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="3 4" opacity={0.6}
              />
              <text x={ux(STANDARD_TOTAL)} y={22} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                standard finishes here
              </text>
            </>
          )}

          {/* current critical-path line */}
          <line
            x1={ux(total)} y1={30}
            x2={ux(total)} y2={NETWORK_Y + LANE_H + 4}
            stroke={mode === "farskip" ? COMPUTE : "var(--foreground)"} strokeWidth={1.5}
          />

          {/* blocks */}
          {blocks.map((b, i) => {
            const y = b.lane === "compute" ? COMPUTE_Y : NETWORK_Y
            const color = b.lane === "compute" ? COMPUTE : COMM
            const x0 = ux(b.x0)
            const x1 = ux(b.x1)
            const w = Math.max(x1 - x0, 2)
            return (
              <g key={i}>
                <rect
                  x={x0} y={y + 4} width={w} height={LANE_H - 8} rx={6}
                  fill={color} opacity={b.layer === 0 ? 0.92 : 0.72}
                  filter="url(#fs-soft)"
                />
                {w > 34 && (
                  <text
                    x={x0 + w / 2} y={y + LANE_H / 2 + 4} textAnchor="middle"
                    className="font-mono" fontSize={9.5} fill="oklch(0.99 0 0)"
                  >
                    {b.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* layer separators */}
          {mode === "standard" && (
            <line x1={ux(238)} y1={30} x2={ux(238)} y2={NETWORK_Y + LANE_H + 4} stroke="var(--border)" strokeDasharray="2 3" />
          )}
          {mode === "farskip" && (
            <line x1={ux(ATTN + EXPERT)} y1={30} x2={ux(ATTN + EXPERT)} y2={NETWORK_Y + LANE_H + 4} stroke="var(--border)" strokeDasharray="2 3" />
          )}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border p-0.5">
            <button
              type="button" onClick={() => setMode("standard")} aria-pressed={mode === "standard"}
              className={cn("cursor-pointer rounded-md px-3 py-1 font-mono text-xs transition-colors", mode === "standard" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              standard MoE
            </button>
            <button
              type="button" onClick={() => setMode("farskip")} aria-pressed={mode === "farskip"}
              className={cn("cursor-pointer rounded-md px-3 py-1 font-mono text-xs transition-colors", mode === "farskip" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              style={mode === "farskip" ? { background: COMPUTE, color: "oklch(0.99 0 0)" } : undefined}
            >
              FarSkip-Collective
            </button>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            critical path <span className="text-foreground">{total}u</span> · compute busy <span className="text-foreground">{util}%</span>
            {mode === "farskip" && <> · <span style={{ color: COMPUTE }}>{saved}% shorter</span></>}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          In <strong>standard MoE</strong>, dispatch and combine sit between compute stages and
          block the engine while tokens cross the network — the top lane goes idle every time the
          bottom lane is busy. <strong>FarSkip-Collective</strong>{" "}feeds the MoE sub-block a
          deliberately outdated, partial activation instead of waiting for the fresh one, so
          dispatch no longer has to wait on this layer&rsquo;s own compute to finish — it can start
          alongside it. Combine works the same way in reverse: the engine moves on to the next
          layer&rsquo;s attention before the collective has actually landed. Stale is the point —
          tolerating a slightly old input is what buys the overlap. (Illustrative units; AMD reports{" "}
          <strong>+12.7%</strong>{" "}pretraining throughput and <strong>&minus;39.2%</strong>{" "}TTFT from
          the real implementation.)
        </p>
      </div>
    </figure>
  )
}
