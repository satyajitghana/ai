"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Figure 1, transcribed and made honest.
//
// Every number below is read directly off Z.ai's own chart — the multiplier
// labels are printed on the chart itself, not estimated from pixel positions.
// What their chart doesn't do is compute the day-over-day delta, which is
// where two things worth noticing live: T+2 to T+3 is a small *decrease*
// (1.42x to 1.41x, "Sort kernel opt." to "Hierarchical cache"), and T+7
// through T+9 is completely flat at 2.67x across three separately named
// optimizations (KV transfer overlap, mixed-precision cache quant.,
// chunked MQA). T+6 and T+12 have no plotted point at all — two days inside
// a "less than two weeks" timeline with nothing attributed to them.

const GOOD = "oklch(0.55 0.16 155)"
const FLAT = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"
const ACCENT = "oklch(0.60 0.15 255)"

type Point = { day: number; mult: number; label: string; phase: string }

const PHASES: Record<string, { name: string; color: string }> = {
  bringup: { name: "system bring-up & scheduling", color: "oklch(0.60 0.15 255)" },
  parallel: { name: "parallelism & communication", color: "oklch(0.62 0.13 200)" },
  kernel: { name: "kernel optimization", color: "oklch(0.60 0.12 300)" },
  launch: { name: "launch", color: GOOD },
}

// Day 6 and day 12 are real gaps in the source chart — no point is plotted there.
const POINTS: Point[] = [
  { day: 0, mult: 1.0, label: "W8A8 baseline", phase: "bringup" },
  { day: 1, mult: 1.21, label: "Async scheduling", phase: "bringup" },
  { day: 2, mult: 1.42, label: "Sort kernel opt.", phase: "parallel" },
  { day: 3, mult: 1.41, label: "Hierarchical cache", phase: "parallel" },
  { day: 4, mult: 1.97, label: "Layer Split", phase: "parallel" },
  { day: 5, mult: 2.49, label: "Context parallel", phase: "parallel" },
  { day: 7, mult: 2.67, label: "KV transfer overlap", phase: "kernel" },
  { day: 8, mult: 2.67, label: "Mixed-precision cache quant.", phase: "kernel" },
  { day: 9, mult: 2.67, label: "Chunked MQA", phase: "kernel" },
  { day: 10, mult: 2.85, label: "Prefill dequant kernel", phase: "kernel" },
  { day: 11, mult: 3.01, label: "Fused activation + quant", phase: "kernel" },
  { day: 13, mult: 3.22, label: "Linear attention", phase: "launch" },
]

const W = 700
const H = 300
const PL = 42
const PR = 14
const PT = 42
const PB = 30
const MAXDAY = 15.5
const MAXMULT = 4.0

const x = (d: number) => PL + (d / MAXDAY) * (W - PL - PR)
const y = (m: number) => PT + (1 - (m - 0.8) / (MAXMULT - 0.8)) * (H - PT - PB)

export function ThroughputTimeline() {
  const [i, setI] = useState(0)

  const p = POINTS[i]
  const prev = i > 0 ? POINTS[i - 1] : null
  const delta = prev ? p.mult - prev.mult : null
  const dayGap = prev ? p.day - prev.day : null
  const deltaColor = delta === null ? FLAT : delta > 0.03 ? GOOD : delta < -0.001 ? BAD : FLAT
  const deltaWord = delta === null ? "baseline" : delta > 0.03 ? "gained" : delta < -0.001 ? "lost" : "flat — no measured gain"

  const linePath = POINTS.map((pt, k) => `${k === 0 ? "M" : "L"} ${x(pt.day).toFixed(1)} ${y(pt.mult).toFixed(1)}`).join(" ")
  const last = POINTS[POINTS.length - 1]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Figure 1, re-read for the day-over-day delta</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">12 points, every number printed on the original chart</span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="min-w-[560px] w-full"
            role="img"
            aria-label={`A line chart of GLM-5.3-Flash's end-to-end throughput multiplier from T+0 (1.00x, W8A8 baseline) to T+13 (3.22x, linear attention, GLM-5.3-Flash launch), across twelve named optimizations. No point is plotted at T+6 or T+12. T+2 to T+3 decreases slightly, 1.42x to 1.41x. T+7 through T+9 is flat at 2.67x.`}
          >
            {(["bringup", "parallel", "kernel", "launch"] as const).map((ph, k) => {
              const bounds: Record<string, [number, number]> = {
                bringup: [-0.3, 1.5],
                parallel: [1.5, 6.5],
                kernel: [6.5, 12.5],
                launch: [12.5, MAXDAY],
              }
              const [a, b] = bounds[ph]
              return (
                <rect
                  key={ph}
                  x={x(Math.max(a, 0))}
                  y={PT - 24}
                  width={Math.max(0, x(b) - x(Math.max(a, 0)))}
                  height={H - PT - PB + 24}
                  fill={PHASES[ph].color}
                  opacity={k % 2 === 0 ? 0.05 : 0.09}
                />
              )
            })}

            {[1, 1.5, 2, 2.5, 3, 3.5].map((g) => (
              <g key={g}>
                <line x1={PL} x2={W - PR} y1={y(g)} y2={y(g)} stroke="currentColor" className="text-border" strokeWidth={1} />
                <text x={PL - 6} y={y(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
                  {g.toFixed(1)}×
                </text>
              </g>
            ))}

            {/* T+6 and T+12 markers: the two days with nothing attributed */}
            {[6, 12].map((d) => (
              <g key={d}>
                <line x1={x(d)} x2={x(d)} y1={PT - 20} y2={H - PB} stroke="currentColor" className="text-muted-foreground/40" strokeDasharray="2 3" strokeWidth={1} />
                <text x={x(d)} y={PT - 26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7.5}>
                  T+{d}: no point
                </text>
              </g>
            ))}

            <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2.25} strokeLinecap="round" />
            {/* "continuously evolving" — dashed, no value given */}
            <path
              d={`M ${x(last.day)} ${y(last.mult)} L ${x(MAXDAY - 0.3)} ${y(last.mult + 0.55)}`}
              fill="none"
              stroke={ACCENT}
              strokeOpacity={0.45}
              strokeDasharray="4 3"
              strokeWidth={2}
            />

            {POINTS.map((pt, k) => (
              <circle
                key={pt.day}
                cx={x(pt.day)}
                cy={y(pt.mult)}
                r={k === i ? 6 : 3.5}
                fill={k === i ? ACCENT : "var(--background)"}
                stroke={ACCENT}
                strokeWidth={1.6}
                className="cursor-pointer"
                onClick={() => setI(k)}
              />
            ))}

            <text x={(PL + W - PR) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              development time (days) — Z.ai&rsquo;s own T+0 .. T+13
            </text>
          </svg>
        </div>

        <label className="mt-1 block">
          <span className="sr-only">optimization step</span>
          <Range min={0} max={POINTS.length - 1} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">day</div>
            <div className="font-mono text-lg font-semibold tabular-nums">T+{p.day}</div>
          </div>
          <div className="col-span-2 rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-1">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">step</div>
            <div className="font-mono text-sm font-semibold" style={{ color: PHASES[p.phase].color }}>
              {p.label}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">cumulative</div>
            <div className="font-mono text-lg font-semibold tabular-nums">{p.mult.toFixed(2)}×</div>
          </div>
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: deltaColor }}>
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              vs. previous point{dayGap !== null ? ` (+${dayGap}d)` : ""}
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: deltaColor }}>
              {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}× — ${deltaWord}`}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read left to right and it looks like a clean climb. Step through it and two things the smooth line hides
          become visible:{" "}
          <span style={{ color: BAD }}>T+2 to T+3 is a small regression</span> (1.42× to 1.41×, one named optimization
          after another), and{" "}
          <span style={{ color: FLAT }}>T+7 through T+9 is flat at 2.67×</span> across three separately named kernel
          changes — KV transfer overlap, mixed-precision cache quantization, and chunked MQA all land on the same
          measured multiplier. Neither is necessarily a problem — a fix can be necessary for correctness or a later
          step without moving throughput on its own, which is exactly the distinction the post draws between
          &ldquo;performance optimizations&rdquo; and &ldquo;bug fixes that did not immediately improve
          throughput.&rdquo; But the chart doesn&rsquo;t say which is which, and two of the thirteen days (T+6, T+12)
          have no point plotted at all.
        </p>
      </div>
    </figure>
  )
}
