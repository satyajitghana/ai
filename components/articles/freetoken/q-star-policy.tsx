"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The one equation in the paper, made draggable.
//
// A decode step misses `m` experts. Each one can be pulled over PCIe into the
// GPU cache (at B_P) or executed where it already lives, on the CPU (at B_H).
// Both branches read the same host DRAM, so a saturated PCIe transfer leaves the
// CPU only B_H − B_P. Balancing the two concurrent branches gives
//
//   T_fill(q) = qS/B_P     T_cpu(m−q) = (m−q)S/(B_H − B_P)     q* = m·B_P/B_H
//
// Two things fall out that are worth seeing rather than reading. The expert size
// S cancels out of q* entirely — drag it and the bars scale while the optimum
// stays put. And the floor of the max-envelope is exactly mS/B_H, the pure-CPU
// time, because host memory is the single bottleneck and the split only decides
// whether it stays saturated. So the q fills are free.
//
// Bandwidths are the measured values from Table 1 of the paper. With S in MB and
// B in GB/s, S/B lands in milliseconds — no unit fudging anywhere below.
//
// Arithmetic is +, −, ×, ÷ only; nothing here needs lib/dmath.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const TEAL = "oklch(0.58 0.10 195)"

type Machine = { key: string; label: string; bp: number; bh: number; note: string }

const MACHINES: Machine[] = [
  { key: "5090s", label: "5090 server", bp: 52.7, bh: 77.3, note: "PCIe 5.0 ×16 into a dual-socket Xeon capped at 6 threads. Fast link, fast host — the split lands near two-thirds fill." },
  { key: "4090", label: "4090", bp: 25.1, bh: 63.2, note: "PCIe 4.0 halves the link while DDR4 keeps 63 GB/s of host bandwidth, so most misses are better off staying on the CPU." },
  { key: "3090", label: "3090", bp: 25.3, bh: 56.7, note: "Same link class as the 4090 with less host bandwidth behind it, which pushes a few more misses back onto PCIe." },
  { key: "5090d", label: "5090 desktop", bp: 49.0, bh: 53.8, note: "The same GPU silicon as the server row, on a Ryzen with two DDR5 channels. The link nearly matches the host, so almost everything should be filled — and a CPU-heavy engine starves here." },
  { key: "4060", label: "4060 laptop", bp: 11.8, bh: 47.5, note: "An ×8 link on an 8 GB laptop GPU with LPDDR5 behind it. The link is the scarce resource: three misses in four belong on the CPU." },
  { key: "pro6000", label: "PRO 6000", bp: 51.5, bh: 178, note: "Workstation host bandwidth — 178 GB/s across the Xeon's channels against a 51.5 GB/s link. The CPU can absorb most of the miss traffic." },
]

const fmt = (v: number, d = 2) => v.toFixed(d)

export function QStarPolicy() {
  const [sel, setSel] = useState("4060")
  const machine = MACHINES.find((x) => x.key === sel) ?? MACHINES[0]
  const [bp, setBp] = useState(machine.bp)
  const [bh, setBh] = useState(machine.bh)
  const [m, setM] = useState(4)
  const [s, setS] = useState(12)

  const pick = (mm: Machine) => {
    setSel(mm.key)
    setBp(mm.bp)
    setBh(mm.bh)
  }

  const dirty = bp !== machine.bp || bh !== machine.bh

  // Residual host bandwidth left over by a saturated link — equation (2).
  const br = Math.max(bh - bp, 0)
  const ratio = bp / bh
  // q* rounded to an integer, always keeping at least one fill so the cache
  // keeps warming even when the CPU is doing most of the work.
  const qStar = Math.min(m, Math.max(1, Math.round(m * ratio)))

  const tFill = (q: number) => (q * s) / bp
  const tCpu = (q: number) => (br > 0 ? ((m - q) * s) / br : q >= m ? 0 : Number.POSITIVE_INFINITY)
  const exposed = (q: number) => Math.max(tFill(q), tCpu(q))

  const tf = tFill(qStar)
  const tc = tCpu(qStar)
  const now = Math.max(tf, tc)
  const fillOnly = (m * s) / bp // every miss over the link
  const hostFloor = (m * s) / bh // the host-bandwidth bound, mS/B_H

  // Geometry. yMax is the fill-only time, or the CPU-only time when that is
  // larger, capped so a near-zero residual bandwidth cannot blow up the axis.
  const W = 720
  const H = 200
  const PAD = { l: 46, r: 118, t: 14, b: 28 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const yMax = Math.max(fillOnly, Math.min(br > 0 ? (m * s) / br : fillOnly, fillOnly * 2.4))
  const X = (q: number) => PAD.l + (q / m) * iw
  const Y = (t: number) => PAD.t + ih - (Math.min(t, yMax) / yMax) * ih

  // Sampled densely enough that the kink in the envelope reads as a corner. Y
  // clamps to yMax, so a near-zero residual bandwidth flattens against the top
  // of the axis instead of blowing it up.
  const N = 120
  const sampled = (f: (q: number) => number) => {
    const pts: string[] = []
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * m
      pts.push(`${i === 0 ? "M" : "L"}${fmt(X(q), 1)},${fmt(Y(f(q)), 1)}`)
    }
    return pts.join(" ")
  }

  const qOpt = m * ratio // the continuous optimum, before rounding

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          q<sup>★</sup> = m · B<sub>P</sub> / B<sub>H</sub>
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {qStar} fill · {m - qStar} in place
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MACHINES.map((mm) => (
            <button
              key={mm.key}
              type="button"
              onClick={() => pick(mm)}
              aria-pressed={sel === mm.key && !dirty}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === mm.key && !dirty
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {mm.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              Exposed layer latency against the number of missing experts filled over PCIe, with the two branch
              times crossing at q star
            </title>

            {[0, 0.5, 1].map((f) => (
              <line
                key={f}
                x1={PAD.l}
                x2={PAD.l + iw}
                y1={PAD.t + ih - f * ih}
                y2={PAD.t + ih - f * ih}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
            ))}

            {/* the host-bandwidth floor, mS/B_H */}
            <line
              x1={PAD.l}
              x2={PAD.l + iw}
              y1={Y(hostFloor)}
              y2={Y(hostFloor)}
              stroke={GOOD}
              strokeDasharray="3 3"
              strokeOpacity={0.8}
            />
            <text x={PAD.l + iw + 6} y={Y(hostFloor) + 3} fontSize={9} fill={GOOD} fontFamily="ui-monospace, monospace">
              mS/B_H floor
            </text>

            {/* T_fill rises with q; T_cpu falls with q, flattening against the
                top of the axis when the residual host bandwidth is small enough
                to put it off-chart. Both are labelled in the legend below rather
                than on the curves, which collide at several bandwidth ratios. */}
            <path d={sampled(tFill)} fill="none" stroke={WARM} strokeWidth={1.5} strokeOpacity={0.85} />
            <path d={sampled(tCpu)} fill="none" stroke={TEAL} strokeWidth={1.5} strokeOpacity={0.85} />

            {/* the exposed cost: whichever branch is slower */}
            <path d={sampled(exposed)} fill="none" stroke={ACCENT} strokeWidth={2.5} />

            {/* the crossing */}
            <line x1={X(qOpt)} y1={PAD.t} x2={X(qOpt)} y2={PAD.t + ih} stroke={GOOD} strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={X(qOpt)} cy={Y(hostFloor)} r={4} fill={GOOD} />
            <text
              x={X(qOpt)}
              y={PAD.t - 3}
              fontSize={9}
              fill={GOOD}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              q★ = {fmt(qOpt, 2)}
            </text>

            {Array.from({ length: m + 1 }, (_, i) => (
              <g key={i}>
                <line x1={X(i)} y1={PAD.t + ih} x2={X(i)} y2={PAD.t + ih + 3} stroke="currentColor" strokeOpacity={0.3} />
                <text
                  x={X(i)}
                  y={PAD.t + ih + 14}
                  fontSize={9}
                  fill="currentColor"
                  fillOpacity={i === qStar ? 0.95 : 0.45}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {i}
                </text>
              </g>
            ))}
            <text x={PAD.l + iw / 2} y={H - 1} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              q — misses filled over PCIe
            </text>
            <text x={4} y={PAD.t + 8} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              {fmt(yMax, 1)} ms
            </text>
            <text x={4} y={PAD.t + ih} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              0
            </text>
          </svg>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {(
            [
              ["T_fill = qS/B_P", WARM],
              ["T_cpu = (m−q)S/(B_H−B_P)", TEAL],
              ["exposed = max of the two", ACCENT],
              ["mS/B_H floor", GOOD],
            ] as const
          ).map(([l, c]) => (
            <span key={l} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
              <span className="inline-block h-[2px] w-3.5" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { l: "B_P link", v: bp, set: setBp, min: 5, max: 90, step: 0.1, unit: "GB/s", c: WARM },
            { l: "B_H host", v: bh, set: setBh, min: 20, max: 200, step: 0.1, unit: "GB/s", c: TEAL },
            { l: "misses m", v: m, set: setM, min: 1, max: 12, step: 1, unit: "experts", c: ACCENT },
            { l: "expert S", v: s, set: setS, min: 2, max: 48, step: 1, unit: "MB", c: ACCENT },
          ].map((sl) => (
            <div key={sl.l} className="flex items-center gap-2">
              <span className="w-16 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">{sl.l}</span>
              <Range
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={sl.v}
                onChange={(e) => sl.set(Number(e.target.value))}
                className="flex-1"
                aria-label={sl.l}
                accent={sl.c}
              />
              <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {sl.v} <span className="text-muted-foreground">{sl.unit}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">the split</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
              {qStar} / {m - qStar}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {((100 * qStar) / m).toFixed(0)}% of misses over the link
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">exposed layer time</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              {fmt(now)} ms
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              fill {fmt(tf)} · cpu {br > 0 ? fmt(tc) : "—"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">if every miss were filled</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {fmt(fillOnly)} ms
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">{fmt(fillOnly / now, 2)}× slower</div>
          </div>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6 text-muted-foreground">
          <span className="font-mono text-[11px] text-foreground">{machine.label}</span>
          {dirty ? <span className="font-mono text-[10px]" style={{ color: WARM }}>{" "}(edited)</span> : null} —{" "}
          {machine.note}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag <span className="font-mono text-[11px] text-foreground">S</span>{" "}and watch what does <em>not</em>{" "}
          move. The bars scale, the latency scales, and the optimum stays exactly where it was — because{" "}
          <span className="font-mono text-[11px] text-foreground">S</span>{" "}cancels out of{" "}
          <span className="font-mono text-[11px] text-foreground">q★ = m·B_P/B_H</span>. The policy is a property
          of the machine, not of the model loaded onto it, which is why it can be profiled once at deployment and
          then left alone.
          <br />
          <br />
          The dashed green line is the more interesting one. Its height is{" "}
          <span className="font-mono text-[11px] text-foreground">mS/B_H</span>, and the V bottoms out exactly on
          it — always, on every machine. That is not a coincidence either: both branches read the same host DRAM,
          so the total bytes and the total host bandwidth are fixed no matter how you divide them, and the split
          only decides whether one branch finishes early and idles.{" "}
          <span className="text-foreground">The balanced point is the only one that keeps host memory saturated
          end to end</span>{" "}— and it arrives at the same latency a CPU-only path would, while leaving{" "}
          {qStar} more expert{qStar === 1 ? "" : "s"} resident in the cache for the next token. The fills are
          free.
        </p>
      </div>
    </figure>
  )
}
