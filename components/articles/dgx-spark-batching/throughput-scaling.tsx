"use client"

import { useState } from "react"

// The scaling law of continuous batching, on one tok/s axis. As you pack more
// concurrent users into the batch, AGGREGATE decode throughput climbs and saturates,
// while PER-USER throughput falls — decoding is memory-bandwidth-bound, so batching
// amortizes each weight-load over more streams until KV-cache memory / compute caps
// out. The smooth curves are a saturating fit; the dots are committed spark-bench
// runs of Qwen3.6-35B (nvfp4) at concurrency 1/8/16; the 64-user point is a reported
// run beyond the committed sweep. Drag concurrency and read both numbers.

const AGG = "oklch(0.68 0.14 195)" // teal — aggregate
const PER = "oklch(0.62 0.16 25)" // warm — per-user
const AGG_MAX = 842
const KHALF = 13
const aggTps = (n: number) => (AGG_MAX * n) / (n + KHALF)
const perUser = (n: number) => aggTps(n) / n

// committed spark-bench points (Qwen3.6-35B, vLLM nvfp4; median of runs)
const AGG_PTS: [number, number][] = [[1, 72], [8, 161], [16, 217]]
const PER_PTS: [number, number][] = [[1, 85], [8, 33], [16, 22]]
const REPORTED = 64 // reported run, not in committed sweep

const W = 680
const H = 300
const PL = 46
const PR = 58
const PT = 18
const PB = 40
const NMAX = 64
const YMAX = 800

// log2 x-scale so 1,2,4,8,16,32,64 space evenly
const xOf = (n: number) => PL + (Math.log2(n) / Math.log2(NMAX)) * (W - PL - PR)
const yOf = (v: number) => PT + (1 - v / YMAX) * (H - PT - PB)

const aggPath = Array.from({ length: 129 }, (_, k) => {
  const n = 1 + (k / 128) * (NMAX - 1)
  return `${k === 0 ? "M" : "L"} ${xOf(n).toFixed(1)} ${yOf(aggTps(n)).toFixed(1)}`
}).join(" ")
const perPath = Array.from({ length: 129 }, (_, k) => {
  const n = 1 + (k / 128) * (NMAX - 1)
  return `${k === 0 ? "M" : "L"} ${xOf(n).toFixed(1)} ${yOf(perUser(n)).toFixed(1)}`
}).join(" ")

export function ThroughputScaling() {
  const [n, setN] = useState(16)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>throughput vs concurrency · Qwen3.6-35B on DGX Spark</span>
        <span className="text-muted-foreground/60">fit + committed spark-bench points</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">concurrency</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{n}<span className="text-sm font-normal text-muted-foreground"> users</span></div>
          </div>
          <div>
            <div className="font-mono text-[10px]" style={{ color: AGG }}>aggregate</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: AGG }}>{aggTps(n).toFixed(0)}<span className="text-xs text-muted-foreground"> tok/s</span></div>
          </div>
          <div>
            <div className="font-mono text-[10px]" style={{ color: PER }}>per user</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: PER }}>{perUser(n).toFixed(1)}<span className="text-xs text-muted-foreground"> tok/s</span></div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Aggregate throughput rises and saturates while per-user throughput falls as concurrency grows; at ${n} users, aggregate ${aggTps(n).toFixed(0)} and per-user ${perUser(n).toFixed(1)} tokens per second`}>
          {/* y gridlines */}
          {[0, 200, 400, 600, 800].map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={yOf(v)} y2={yOf(v)} stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.6} />
              <text x={PL - 6} y={yOf(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{v}</text>
            </g>
          ))}
          {/* x ticks */}
          {[1, 2, 4, 8, 16, 32, 64].map((c) => (
            <text key={c} x={xOf(c)} y={H - PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{c}</text>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>concurrent users (log scale) →</text>

          {/* curves */}
          <path d={aggPath} fill="none" stroke={AGG} strokeWidth={2.5} strokeLinecap="round" />
          <path d={perPath} fill="none" stroke={PER} strokeWidth={2.5} strokeLinecap="round" />

          {/* committed data points */}
          {AGG_PTS.map(([c, v]) => (
            <circle key={`a${c}`} cx={xOf(c)} cy={yOf(v)} r={3.5} fill={AGG} stroke="var(--background)" strokeWidth={1.5} />
          ))}
          {PER_PTS.map(([c, v]) => (
            <circle key={`p${c}`} cx={xOf(c)} cy={yOf(v)} r={3.5} fill={PER} stroke="var(--background)" strokeWidth={1.5} />
          ))}
          {/* reported 64-user marker */}
          <circle cx={xOf(REPORTED)} cy={yOf(aggTps(REPORTED))} r={4} fill="none" stroke={AGG} strokeWidth={1.5} strokeDasharray="2 2" />
          <text x={xOf(REPORTED)} y={yOf(aggTps(REPORTED)) - 8} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>reported</text>

          {/* draggable marker */}
          <line x1={xOf(n)} x2={xOf(n)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/25" strokeWidth={1} />
          <circle cx={xOf(n)} cy={yOf(aggTps(n))} r={4.5} fill={AGG} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={xOf(n)} cy={yOf(perUser(n))} r={4.5} fill={PER} stroke="var(--background)" strokeWidth={1.5} />

          {/* legend */}
          <g>
            <line x1={W - PR - 2} x2={W - PR + 10} y1={PT + 6} y2={PT + 6} stroke={AGG} strokeWidth={2.5} />
            <text x={W - PR + 14} y={PT + 9} className="fill-muted-foreground font-mono" fontSize={9}>agg</text>
            <line x1={W - PR - 2} x2={W - PR + 10} y1={PT + 20} y2={PT + 20} stroke={PER} strokeWidth={2.5} />
            <text x={W - PR + 14} y={PT + 23} className="fill-muted-foreground font-mono" fontSize={9}>/user</text>
          </g>
        </svg>

        <label className="mt-1 block">
          <span className="sr-only">concurrency</span>
          <input type="range" min={1} max={64} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.68_0.14_195)]" />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The two curves are the whole trade. Pack in more users and{" "}
          <span style={{ color: AGG }}>aggregate</span> throughput climbs toward a ceiling — that&apos;s the win. But each
          user&apos;s <span style={{ color: PER }}>own</span> stream slows, because they now share every forward pass. The
          dots are committed spark-bench runs (concurrency 1/8/16); the 64-user point is a{" "}
          <span className="text-foreground">reported</span> run past the committed sweep.
        </p>
      </div>
    </figure>
  )
}
