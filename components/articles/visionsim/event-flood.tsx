"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Measured on CPU with my own NumPy re-implementation of VisionSIM 0.2.0's event
// emulator (visionsim/emulate/dvs/v2e/emulator.py: lin-log intensity, the
// intensity-dependent first-order low-pass, per-pixel thresholds drawn from
// N(threshold, 0.03) and clipped at 0.01, floor-divided crossings, and the
// refractory check). Leak and shot noise are off so the numbers are the model,
// not its noise. Scene: a 96 x 96 checkerboard (9,216 pixels) sampled at 1 kHz.
//
// Sweep: a bright disc of radius 10 px crossing it at 120 px/s for 0.5 s.
// Lamp: the same static board stepped from 1/4 to 4x brightness (four stops)
// at t = 100 ms; curves are cumulative events, sampled every 2 ms, over the
// 200 ms after the switch.

const SWEEP = [
  { thr: 0.05, pos: 38661, neg: 37438 },
  { thr: 0.1, pos: 13518, neg: 12859 },
  { thr: 0.15, pos: 8024, neg: 7459 },
  { thr: 0.2, pos: 5726, neg: 5190 },
  { thr: 0.3, pos: 3605, neg: 3115 },
  { thr: 0.4, pos: 2424, neg: 1955 },
  { thr: 0.5, pos: 2000, neg: 1529 },
]

const TOTAL = 131917

const LAMP: { label: string; note: string; c: number[] }[] = [
  {
    label: "no filter",
    note: "cutoff 0, refractory 0: every crossing lands in the first millisecond",
    c: Array(101).fill(TOTAL),
  },
  {
    label: "200 Hz",
    note: "the CLI's default photoreceptor cutoff: 95% of the burst in 1 ms",
    c: [124758, 131806, 131913, ...Array(98).fill(TOTAL)],
  },
  {
    label: "30 Hz",
    note: "the EventEmulator class default: the same burst smeared over about 30 ms",
    c: [
      17116, 49943, 73336, 89863, 101604, 110012, 116064, 120462, 123485, 125734, 127411, 128547, 129454, 130107,
      130595, 130934, 131196, 131379, 131521, 131632, 131704, 131754, 131797, 131826, 131845, 131869, 131879, 131886,
      131892, 131899, 131902, 131905, 131910, 131910, 131912, 131914, 131914, 131915, 131916, 131916, 131916, 131916,
      ...Array(59).fill(TOTAL),
    ],
  },
  {
    label: "0.5 ms refractory",
    note: "200 Hz plus a 0.5 ms dead period: the same events, drained over 20 ms",
    c: [9946, 29249, 47902, 66454, 84794, 100581, 112405, 121553, 127840, 131211, ...Array(91).fill(TOTAL)],
  },
  {
    label: "2 ms refractory",
    note: "a pixel fires at most once every 2 ms, so the backlog takes about 40 ms",
    c: [
      9216, 18432, 27648, 36864, 46080, 55285, 64327, 72903, 81063, 89060, 96633, 103366, 109055, 113822, 117924,
      121460, 124387, 126655, 128366, 129574, 130365, 130894, 131249, 131474, 131610, 131707, 131772, 131817, 131853,
      131880, 131892, 131900, 131906, 131909, 131911, 131913, 131915, 131916, ...Array(63).fill(TOTAL),
    ],
  },
  {
    label: "10 ms refractory",
    note: "one event per pixel per 10 ms: 1,806 events are still queued 200 ms later",
    c: [
      9216, 9216, 9216, 9216, 9216, 18432, 18432, 18432, 18432, 18432, 27648, 27648, 27648, 27648, 27648, 36864, 36864,
      36864, 36864, 36864, 46080, 46080, 46080, 46080, 46080, 55296, 55296, 55296, 55296, 55296, 64501, 64512, 64512,
      64512, 64512, 73543, 73717, 73717, 73717, 73717, 82108, 82748, 82748, 82748, 82748, 90094, 91139, 91139, 91139,
      91139, 97451, 98485, 98485, 98485, 98485, 103979, 104797, 104797, 104797, 104797, 109678, 110291, 110291, 110291,
      110291, 114549, 115172, 115172, 115172, 115172, 118703, 119430, 119430, 119430, 119430, 122182, 122961, 122961,
      122961, 122961, 124991, 125713, 125713, 125713, 125713, 127139, 127743, 127743, 127743, 127743, 128685, 129169,
      129169, 129169, 129169, 129792, 130111, 130111, 130111, 130111, 130111,
    ],
  },
]

const POS = "oklch(0.62 0.17 25)"
const NEG = "oklch(0.58 0.14 255)"
const LINE = "oklch(0.66 0.15 150)"

const fmt = (n: number) => n.toLocaleString("en-US")

function Sweep() {
  const W = 640
  const L = 70
  const R = 600
  const TOP = 24
  const ROW = 30
  const max = Math.max(...SWEEP.map((s) => s.pos + s.neg))
  const X = (v: number) => L + (v / max) * (R - L)
  const H = TOP + SWEEP.length * ROW + 10
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full min-w-[520px]"
      role="img"
      aria-label={`Events from a disc crossing a 96 by 96 board, by contrast threshold: ${SWEEP.map((s) => `${s.thr} gives ${s.pos + s.neg}`).join(", ")}.`}
    >
      <text x={L} y={14} className="fill-muted-foreground font-mono" fontSize={10}>
        events in 0.5 s · ON in red, OFF in blue
      </text>
      {SWEEP.map((s, i) => {
        const y = TOP + i * ROW
        const hi = s.thr === 0.2
        return (
          <g key={s.thr}>
            <text
              x={L - 8}
              y={y + 13}
              textAnchor="end"
              className={hi ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
              fontSize={10}
              fontWeight={hi ? 600 : 400}
            >
              {s.thr.toFixed(2)}
            </text>
            <rect x={L} y={y + 2} width={X(s.pos) - L} height={16} rx={2} fill={POS} fillOpacity={0.8} />
            <rect x={X(s.pos)} y={y + 2} width={X(s.neg) - L} height={16} rx={2} fill={NEG} fillOpacity={0.8} />
            <text x={X(s.pos + s.neg) + 6} y={y + 14} className="fill-muted-foreground font-mono" fontSize={9.5}>
              {fmt(s.pos + s.neg)}
              {hi ? "  (default)" : ""}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Lamp() {
  const [k, setK] = useState(1)
  const W = 640
  const L = 54
  const R = 620
  const T = 16
  const B = 196
  const X = (i: number) => L + (i / 100) * (R - L)
  const Y = (v: number) => B - (v / TOTAL) * (B - T)
  const path = (c: number[]) => c.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")
  const cur = LAMP[k]
  const at = (f: number) => {
    const i = cur.c.findIndex((v) => v >= f * TOTAL)
    return i < 0 ? "over 200 ms" : `${i * 2} ms`
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 pb-3">
        {LAMP.map((m, i) => (
          <button
            key={m.label}
            type="button"
            onClick={() => setK(i)}
            aria-pressed={k === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              k === i
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} 226`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label={`Cumulative events after a four-stop lamp switch, ${cur.label}: half are out by ${at(0.5)}, 90 percent by ${at(0.9)}, 99 percent by ${at(0.99)}.`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={R} y1={Y(f * TOTAL)} y2={Y(f * TOTAL)} className="stroke-border" strokeWidth={0.6} />
            <text x={L - 6} y={Y(f * TOTAL) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
              {Math.round(f * 100)}%
            </text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((i) => (
          <text key={i} x={X(i)} y={B + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            {i * 2} ms
          </text>
        ))}
        {LAMP.map((m, i) =>
          i === k ? null : (
            <path key={m.label} d={path(m.c)} fill="none" className="stroke-muted-foreground" strokeOpacity={0.25} strokeWidth={1} />
          ),
        )}
        <path d={path(cur.c)} fill="none" stroke={LINE} strokeWidth={2.2} />
      </svg>
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        {cur.note}. Half out by {at(0.5)}, 90% by {at(0.9)}, 99% by {at(0.99)}. Total {fmt(TOTAL)} events, about
        14 per pixel.
      </p>
    </div>
  )
}

export function EventFlood() {
  const [tab, setTab] = useState<"sweep" | "lamp">("lamp")
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>event emulator · 96 x 96 board at 1 kHz</span>
        <span className="text-muted-foreground/60">measured · my re-implementation</span>
      </div>
      <div className="flex gap-1.5 px-4 pt-3">
        {(
          [
            ["lamp", "lamp switches on"],
            ["sweep", "threshold sweep"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={cn(
              "cursor-pointer rounded-md border px-3 py-1 font-mono text-[11px] transition-colors",
              tab === id ? "border-foreground/30 bg-muted/60 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">{tab === "lamp" ? <Lamp /> : <Sweep />}</div>
      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Measured on CPU with my NumPy port of VisionSIM&apos;s v2e-based emulator (leak and shot noise off). The
        refractory period does not delete events here: a suppressed crossing stays in the pixel&apos;s memory and
        fires later, so the total is the same and only the timing stretches.
      </figcaption>
    </figure>
  )
}
