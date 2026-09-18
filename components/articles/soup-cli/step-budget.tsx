"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What actually bounds a streamed step — the measurement that forced version 3 of
// Soup's own paper to retract "bound by host-to-device transfer."
//
// Four arms, switched by a flag inside ONE process on ONE model and interleaved
// A/B/C/D per round so monotonic clock drift cannot favour an arm. Both ablation
// arms produce garbage mathematics and are timing-only: `nocopy` leaves stale bytes
// in the buffers, `nodequant` multiplies by a cached zero weight. Llama-3.1-8B NF4,
// batch 1, 8 steps x 2 rounds, all at 960 MHz on an RTX 3050 Laptop.
//
// The S=16 arm is here because it is the honest half of the finding: the transfer
// claim is TRUE at small token counts, where the fixed 6.864 GB has no compute to
// hide behind. It is only false at the configuration it was published about.
//
// Every number: benchmarks/probe-v0.73.0-what-bounds-streaming.md — S=512 arms §4,
// S=16 arms §5c, the overlap lane §3, the GEMM ceiling §5b.

type Arm = {
  key: string
  label: string
  lo: number
  hi: number
  toks: number | null
  delta: number | null
  ceiling: number | null
  color: string
}

const BLUE = "oklch(0.62 0.15 250)"
const GREEN = "oklch(0.64 0.13 160)"
const AMBER = "oklch(0.74 0.14 70)"
const VIOLET = "oklch(0.62 0.14 300)"
const RED = "oklch(0.62 0.2 25)"

// §4 — S=512, the published shape. Point measurements.
const LONG: Arm[] = [
  { key: "A", label: "baseline", lo: 4.211, hi: 4.211, toks: 121.6, delta: 0, ceiling: 0.713, color: BLUE },
  { key: "B", label: "no H2D transfers at all", lo: 4.15, hi: 4.15, toks: 123.4, delta: -1.44, ceiling: null, color: GREEN },
  { key: "C", label: "no NF4 dequantisation", lo: 3.799, hi: 3.799, toks: 134.9, delta: -9.8, ceiling: null, color: AMBER },
  { key: "D", label: "neither", lo: 3.743, hi: 3.743, toks: 136.8, delta: -11.3, ceiling: 0.797, color: VIOLET },
]

// §5c — the same four arms at S=16, recorded as ranges. No tok/s, no ceiling and no
// single-point delta were published at this shape, so none is shown.
const SHORT: Arm[] = [
  { key: "A", label: "baseline", lo: 0.974, hi: 1.187, toks: null, delta: null, ceiling: null, color: BLUE },
  { key: "B", label: "no H2D transfers at all", lo: 0.914, hi: 0.999, toks: null, delta: null, ceiling: null, color: GREEN },
  { key: "C", label: "no NF4 dequantisation", lo: 0.814, hi: 0.868, toks: null, delta: null, ceiling: null, color: AMBER },
  { key: "D", label: "neither", lo: 0.626, hi: 0.716, toks: null, delta: null, ceiling: null, color: VIOLET },
]

const GEMM_16 = 0.09 // §5c: "At 16 tokens the GEMM work is ~0.09 s"

// §3 — CUDA-event instrumentation, S=512. The two numbers that are not the same number.
const EV_STEP = 4.19
const EV_COPY = 0.732 // copy time on the prefetch stream — overlappable
const EV_STALL = 0.0084 // compute stream actually blocked on a copy event

export function StepBudget() {
  const [long, setLong] = useState(true)
  const arms = long ? LONG : SHORT
  const axisMax = long ? 4.6 : 1.3
  const baseline = arms[0].hi

  const W = 720
  const padL = 170
  const padR = 118
  const innerW = W - padL - padR
  const rowH = 30
  const TOP = 14 // reserved strip so the S=16 GEMM-work annotation clears the first bar
  const H = arms.length * rowH + 26 + TOP
  const px = (s: number) => (s / axisMax) * innerW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">step-time ablation · Llama-3.1-8B NF4, batch 1, RTX 3050 Laptop @ 960 MHz</span>
        <div className="flex gap-1">
          {[
            { v: true, label: "S = 512" },
            { v: false, label: "S = 16" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setLong(o.v)}
              aria-pressed={long === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                long === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            long
              ? "At 512 tokens per step: baseline 4.211 s, deleting every host-to-device byte 4.150 s (1.44% faster), deleting the NF4 dequantisation 3.799 s (9.8% faster), deleting both 3.743 s (11.3% faster)."
              : "At 16 tokens per step: baseline 0.974 to 1.187 s, no transfers 0.914 to 0.999 s, no dequantisation 0.814 to 0.868 s, neither 0.626 to 0.716 s, against roughly 0.09 s of actual GEMM work."
          }
        >
          {/* baseline reference line */}
          <line
            x1={padL + px(baseline)}
            y1={TOP + 4}
            x2={padL + px(baseline)}
            y2={arms.length * rowH + TOP + 2}
            stroke="var(--foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.45}
          />

          {/* the GEMM-work marker, only meaningful at S=16 */}
          {!long ? (
            <>
              <line x1={padL + px(GEMM_16)} y1={TOP + 4} x2={padL + px(GEMM_16)} y2={arms.length * rowH + TOP + 2} stroke={RED} strokeWidth={1.25} />
              <text x={padL + px(GEMM_16) + 5} y={11} className="font-mono" fill={RED} fontSize={9}>
                ~0.09 s of real GEMM work
              </text>
            </>
          ) : null}

          {arms.map((a, i) => {
            const y = i * rowH + TOP + 12
            const x0 = padL + px(a.lo)
            const x1 = padL + px(a.hi)
            const w = Math.max(x1 - padL, 2)
            return (
              <g key={a.key}>
                <text x={0} y={y + 12} className="fill-foreground font-mono" fontSize={9.5}>
                  {a.key}
                  <tspan className="fill-muted-foreground"> · {a.label}</tspan>
                </text>
                <rect x={padL} y={y} width={w} height={16} rx={3} fill={a.color} opacity={a.hi === a.lo ? 0.9 : 0.34} />
                {a.hi !== a.lo ? (
                  <>
                    <rect x={padL} y={y} width={Math.max(x0 - padL, 2)} height={16} rx={3} fill={a.color} opacity={0.88} />
                    <line x1={x1} y1={y - 1} x2={x1} y2={y + 17} stroke={a.color} strokeWidth={1.5} />
                  </>
                ) : null}
                <text x={x1 + 7} y={y + 12} className="fill-foreground font-mono" fontSize={9.5} fontWeight={600}>
                  {a.hi === a.lo ? `${a.lo.toFixed(3)} s` : `${a.lo.toFixed(2)}–${a.hi.toFixed(2)} s`}
                </text>
                {a.delta ? (
                  <text x={W - 4} y={y + 12} textAnchor="end" className="font-mono" fill={a.color} fontSize={9.5} fontWeight={600}>
                    {a.delta.toFixed(2)}%
                  </text>
                ) : null}
              </g>
            )
          })}

          <text x={padL} y={arms.length * rowH + TOP + 18} className="fill-muted-foreground font-mono" fontSize={8.5}>
            0
          </text>
          <text x={padL + innerW} y={arms.length * rowH + TOP + 18} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
            {axisMax.toFixed(1)} s per step
          </text>
        </svg>

        {/* §3 — the overlap lane. Two numbers that are not the same number. */}
        <div className="mt-3 rounded-md border bg-background/60 p-3">
          <div className="mb-2 font-mono text-[10px] text-muted-foreground">
            same box, separately instrumented with CUDA events · S = 512, 4.190 s step
          </div>
          <svg viewBox="0 0 720 62" className="w-full" role="img" aria-label="Of a 4.190 second step, the prefetch stream spends 0.732 seconds copying (17.5%), but the compute stream is blocked on a copy for only 0.0084 seconds (0.20%).">
            {[
              { y: 2, label: "prefetch stream · copying", v: EV_COPY, color: GREEN, note: "0.732 s · 17.5% of the step" },
              { y: 32, label: "compute stream · blocked", v: EV_STALL, color: RED, note: "0.0084 s · 0.20% of the step" },
            ].map((lane) => (
              <g key={lane.label}>
                <text x={0} y={lane.y + 12} className="fill-muted-foreground font-mono" fontSize={9}>
                  {lane.label}
                </text>
                <rect x={200} y={lane.y + 2} width={340} height={14} rx={3} fill="var(--muted)" opacity={0.35} />
                <rect x={200} y={lane.y + 2} width={Math.max((lane.v / EV_STEP) * 340, 2.5)} height={14} rx={2} fill={lane.color} opacity={0.92} />
                <text x={550} y={lane.y + 13} className="font-mono" fill={lane.color} fontSize={9} fontWeight={600}>
                  {lane.note}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          {long ? (
            <>
              <Stat label="A · baseline step" value="4.211 s" sub="121.6 tok/s" />
              <Stat label="B · delete every H2D byte" value="−1.44%" sub="6.864 GB moved, gone" />
              <Stat label="C · delete NF4 dequant" value="−9.80%" sub="the only streaming-specific cost with headroom" />
              <Stat label="A, of this card's GEMM ceiling" value="71.3%" sub="same session, shape-matched" />
            </>
          ) : (
            <>
              <Stat label="A · baseline step" value="0.97–1.19 s" sub="tok/s not published here" />
              <Stat label="B · no H2D transfers" value="0.91–1.00 s" sub="same 6.864 GB, no compute to hide it" />
              <Stat label="C · no NF4 dequant" value="0.81–0.87 s" sub="ranges as recorded, n=2 rounds" />
              <Stat label="D · neither" value="0.63–0.72 s" sub="against ~0.09 s of GEMM work" />
            </>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {long ? (
            <>
              Deleting <span className="text-foreground">every</span> host-to-device byte — all 6.864 GB of it —
              makes the step 1.44% faster. That single row is what refuted three releases of
              &ldquo;bound by host-to-device transfer,&rdquo; and the lane above says why: the prefetch stream
              copies for 17.5% of the step, but the compute stream is blocked on a copy for{" "}
              <span className="text-foreground">0.20%</span>. Double buffering hides essentially all of it, so
              there is nothing left for more bandwidth to buy. The cost that does bite is the per-layer NF4
              dequantisation, at 9.8%.
            </>
          ) : (
            <>
              At 16 tokens the same four arms invert the story. The actual GEMM work is about{" "}
              <span className="text-foreground">0.09 s</span>, yet arm D — no transfers, no dequantisation —
              still costs ~0.67 s, which is roughly 10 ms of kernel-launch and Python overhead across each of 64
              layer visits. Here the fixed 6.864 GB has no compute to hide behind, and the transfer claim{" "}
              <span className="text-foreground">is</span> true. It is only false at the configuration it was
              published about, which is the distinction version 3 of the paper draws and version 2 did not.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
      {sub ? <div className="text-[10px] leading-snug text-muted-foreground">{sub}</div> : null}
    </div>
  )
}
