"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// misc/benchmarks/04-cache-latency, results table, line mode (measured by the repo on
// an Apple M4 Pro P-core): a random single-cycle pointer chase over 128-byte nodes
// packed 128 bytes apart, min of 10 runs of 6,710,886 dependent loads, at 4.49 GHz.
// Page mode puts one node on each 16 KiB page, so the same line count spans 128x the
// pages; its rows are keyed by the line-mode working set with the same line count.

type Row = { label: string; kib: number; ns: number; cyc: number; level: string; page?: number }

const ROWS: Row[] = [
  { label: "4 KiB", kib: 4, ns: 0.665, cyc: 3.0, level: "L1", page: 0.665 },
  { label: "8 KiB", kib: 8, ns: 0.665, cyc: 3.0, level: "L1", page: 0.665 },
  { label: "16 KiB", kib: 16, ns: 0.665, cyc: 3.0, level: "L1", page: 0.665 },
  { label: "32 KiB", kib: 32, ns: 0.665, cyc: 3.0, level: "L1", page: 2.01 },
  { label: "64 KiB", kib: 64, ns: 0.665, cyc: 3.0, level: "L1", page: 2.019 },
  { label: "128 KiB", kib: 128, ns: 0.666, cyc: 3.0, level: "L1", page: 2.105 },
  { label: "256 KiB", kib: 256, ns: 6.167, cyc: 27.7, level: "L2", page: 6.115 },
  { label: "512 KiB", kib: 512, ns: 5.927, cyc: 26.6, level: "L2", page: 14.029 },
  { label: "1 MiB", kib: 1024, ns: 5.947, cyc: 26.7, level: "L2", page: 14.74 },
  { label: "2 MiB", kib: 2048, ns: 6.048, cyc: 27.2, level: "L2", page: 15.031 },
  { label: "4 MiB", kib: 4096, ns: 7.224, cyc: 32.4, level: "L2, TLB reach ending", page: 15.05 },
  { label: "8 MiB", kib: 8192, ns: 7.974, cyc: 35.8, level: "L2, TLB reach ending", page: 15.76 },
  { label: "16 MiB", kib: 16384, ns: 16.984, cyc: 76.3, level: "whole L2, shared" },
  { label: "32 MiB", kib: 32768, ns: 60.041, cyc: 269.6, level: "spilling to memory" },
  { label: "64 MiB", kib: 65536, ns: 112.16, cyc: 503.6, level: "memory + page walk" },
  { label: "128 MiB", kib: 131072, ns: 117.349, cyc: 526.9, level: "memory + page walk" },
  { label: "256 MiB", kib: 262144, ns: 120.041, cyc: 539.0, level: "memory + page walk" },
  { label: "512 MiB", kib: 524288, ns: 121.492, cyc: 545.5, level: "memory + page walk" },
  { label: "1 GiB", kib: 1048576, ns: 123.707, cyc: 555.4, level: "memory + page walk" },
]

const L1_NS = 0.665
const ACCENT = "oklch(0.62 0.16 250)"
const PAGE = "oklch(0.66 0.17 45)"

const W = 640
const H = 200
const PL = 40
const PR = 12
const PT = 12
const PB = 30
const YMIN = -0.5 // ~0.3 ns
const YMAX = 2.3 // ~200 ns

const sx = (i: number) => PL + (i / (ROWS.length - 1)) * (W - PL - PR)
const sy = (ns: number) => H - PB - ((mlog10(ns) - YMIN) / (YMAX - YMIN)) * (H - PT - PB)

export function LatencyLadder() {
  const [i, setI] = useState(8)
  const r = ROWS[i]
  const line = ROWS.map((row, k) => `${k === 0 ? "M" : "L"} ${sx(k).toFixed(1)} ${sy(row.ns).toFixed(1)}`).join(" ")
  const pageRows = ROWS.map((row, k) => ({ k, v: row.page })).filter((p) => p.v !== undefined) as { k: number; v: number }[]
  const pageLine = pageRows.map((p, n) => `${n === 0 ? "M" : "L"} ${sx(p.k).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one dependent load, by working set &middot; M4 Pro P-core</span>
        <span>measured by the repo &middot; log ns</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At a ${r.label} working set, one dependent load costs ${r.ns} nanoseconds, ${r.cyc} cycles, ${(r.ns / L1_NS).toFixed(1)} times an L1 hit.`}
        >
          {[1, 10, 100].map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={PL - 6} y={sy(v) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {v}
              </text>
            </g>
          ))}
          {[0, 6, 12, 18].map((k) => (
            <text key={k} x={sx(k)} y={H - PB + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {ROWS[k].label}
            </text>
          ))}
          <text x={W - PR} y={H - 4} textAnchor="end" fontSize={9.5} className="fill-muted-foreground font-mono">
            working set (line mode)
          </text>
          <line x1={sx(5.5)} x2={sx(5.5)} y1={PT} y2={H - PB} stroke="var(--muted-foreground)" strokeDasharray="2 3" />
          <text x={sx(5.5) + 4} y={PT + 10} fontSize={9.5} className="fill-muted-foreground font-mono">
            L1d 128 KiB
          </text>
          <line x1={sx(12)} x2={sx(12)} y1={PT} y2={H - PB} stroke="var(--muted-foreground)" strokeDasharray="2 3" />
          <text x={sx(12) + 4} y={PT + 10} fontSize={9.5} className="fill-muted-foreground font-mono">
            L2 16 MiB
          </text>
          <path d={pageLine} fill="none" stroke={PAGE} strokeWidth={1.5} strokeDasharray="4 3" />
          <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} />
          {ROWS.map((row, k) => (
            <circle key={k} cx={sx(k)} cy={sy(row.ns)} r={k === i ? 6 : 2.5} fill={ACCENT} />
          ))}
          {r.page !== undefined ? <circle cx={sx(i)} cy={sy(r.page)} r={5} fill={PAGE} /> : null}
        </svg>

        <div className="mt-2 flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">set</span>
          <Range
            min={0}
            max={ROWS.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="Working set size"
            accent={ACCENT}
            className="w-full"
          />
          <span className="w-16 shrink-0 text-right font-mono text-xs" style={{ color: ACCENT }}>
            {r.label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">per load</div>
            <div className="text-foreground">
              {r.ns} ns &middot; {r.cyc} cyc
            </div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">vs an L1 hit</div>
            <div className="text-foreground">{(r.ns / L1_NS).toFixed(1)}x</div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">where it lives</div>
            <div className="text-foreground">{r.level}</div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">same lines, one per page</div>
            <div style={{ color: PAGE }}>{r.page !== undefined ? `${r.page} ns` : "not run"}</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The solid line is the line-mode chase; the dashed line spreads the same number of lines one per 16 KiB page,
          so the only thing that changes is address translation. Page mode leaves L1 latency at 256 pages, not at 128
          KiB: the first-level TLB ran out before the cache did.
        </p>
      </div>
    </figure>
  )
}
