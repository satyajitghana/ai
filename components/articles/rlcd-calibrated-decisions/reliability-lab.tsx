"use client"

import { useMemo, useState } from "react"

import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { ROWS, type Row } from "./reliability-data"

// A reliability diagram you can miscalibrate on purpose.
//
// The data is real and committed: 252 option-logit readouts from openjev's own
// results/raw/predictions/*.jsonl, joined to its own gold labels (see
// ./reliability-data.ts for the exact join). Everything drawn here is recomputed
// from those logits at the temperature you pick — no curve is stored.
//
// Dividing every logit by one positive T cannot change which option wins, so
// accuracy is a horizontal line across the whole slider. That is the entire point
// of the control: it separates "is the answer right" from "does the number mean
// anything", which is the distinction the whole article is about.
//
// mexp/mlog rather than Math.exp/Math.log: these results reach SVG coordinates
// and text nodes, and Node and Chrome are allowed to differ by an ULP.

const ACCENT = "oklch(0.72 0.15 195)"
const WARN = "oklch(0.68 0.16 40)"
const MUTED = "oklch(0.62 0.02 260)"

const BINS = 10
const W = 620
const H = 330
const PL = 46
const PR = 96
const PT = 14
const PB = 54

const sx = (v: number) => PL + v * (W - PL - PR)
const sy = (v: number) => H - PB - v * (H - PT - PB)

type Slice = "all" | "authored" | "perturbed"

const SLICES: { id: Slice; label: string; n: number; fitted: number }[] = [
  { id: "all", label: "all 252", n: 252, fitted: 1.32 },
  { id: "authored", label: "authored 144", n: 144, fitted: 1.23 },
  { id: "perturbed", label: "perturbed 108", n: 108, fitted: 1.42 },
]

function softmax(logits: number[], t: number): number[] {
  const z = logits.map((x) => x / t)
  const m = Math.max(...z)
  const e = z.map((x) => mexp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / s)
}

type Stats = {
  n: number
  acc: number
  conf: number
  ece: number
  brier: number
  nll: number
  bins: { lo: number; n: number; acc: number; conf: number }[]
}

function compute(rows: Row[], t: number): Stats {
  const n = rows.length
  let acc = 0
  let conf = 0
  let brier = 0
  let nll = 0
  const bn = new Array<number>(BINS).fill(0)
  const ba = new Array<number>(BINS).fill(0)
  const bc = new Array<number>(BINS).fill(0)

  for (const [logits, gold] of rows) {
    const p = softmax(logits, t)
    let arg = 0
    for (let i = 1; i < p.length; i++) if (p[i] > p[arg]) arg = i
    const ok = arg === gold ? 1 : 0
    const c = p[arg]
    acc += ok
    conf += c
    nll += -mlog(Math.max(p[gold], 1e-12))
    for (let i = 0; i < p.length; i++) {
      const y = i === gold ? 1 : 0
      brier += (p[i] - y) * (p[i] - y)
    }
    const b = Math.min(BINS - 1, Math.floor(c * BINS))
    bn[b] += 1
    ba[b] += ok
    bc[b] += c
  }

  let ece = 0
  const bins = []
  for (let b = 0; b < BINS; b++) {
    if (!bn[b]) continue
    const a = ba[b] / bn[b]
    const cf = bc[b] / bn[b]
    ece += (Math.abs(a - cf) * bn[b]) / n
    bins.push({ lo: b / BINS, n: bn[b], acc: a, conf: cf })
  }
  return { n, acc: acc / n, conf: conf / n, ece, brier: brier / n, nll: nll / n, bins }
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const f3 = (v: number) => v.toFixed(3)

export function ReliabilityLab() {
  const [t, setT] = useState(1)
  const [slice, setSlice] = useState<Slice>("all")

  const rows = useMemo(
    () =>
      slice === "all"
        ? ROWS
        : ROWS.filter((r) => r[2] === (slice === "authored" ? 0 : 1)),
    [slice]
  )
  const s = useMemo(() => compute(rows, t), [rows, t])
  const fitted = SLICES.find((x) => x.id === slice)!.fitted
  const bw = (W - PL - PR) / BINS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>openjev · frozen Qwen3.5-4B · {s.n} committed predictions</span>
        <div
          className="flex gap-0.5 rounded-full border p-0.5"
          role="group"
          aria-label="which rows"
        >
          {SLICES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSlice(x.id)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
                slice === x.id
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-3 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={`Reliability diagram over ${s.n} committed predictions at temperature ${t.toFixed(2)}. Accuracy is ${pct(s.acc)}, mean confidence ${pct(s.conf)}, expected calibration error ${f3(s.ece)}, Brier ${f3(s.brier)}, negative log likelihood ${f3(s.nll)}. Bars show the observed accuracy inside each confidence bin against the diagonal of perfect calibration.`}
        >
          <defs>
            <filter id="rl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line
                x1={PL}
                y1={sy(g)}
                x2={W - PR}
                y2={sy(g)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeOpacity={0.6}
              />
              <text
                x={PL - 8}
                y={sy(g) + 3.5}
                textAnchor="end"
                className="font-mono"
                fill={MUTED}
                fontSize={9}
              >
                {g.toFixed(2)}
              </text>
              <text
                x={sx(g)}
                y={H - PB + 14}
                textAnchor="middle"
                className="font-mono"
                fill={MUTED}
                fontSize={9}
              >
                {g.toFixed(2)}
              </text>
            </g>
          ))}

          {/* perfect calibration */}
          <line
            x1={sx(0)}
            y1={sy(0)}
            x2={sx(1)}
            y2={sy(1)}
            stroke={MUTED}
            strokeWidth={1.4}
            strokeDasharray="5 4"
          />

          {s.bins.map((b) => {
            const over = b.conf > b.acc
            const x = sx(b.lo) + 1.5
            const y = sy(b.acc)
            return (
              <g key={b.lo}>
                <rect
                  x={x}
                  y={y}
                  width={bw - 3}
                  height={Math.max(1, sy(0) - y)}
                  rx={2}
                  fill={over ? WARN : ACCENT}
                  fillOpacity={0.14 + 0.5 * Math.min(1, b.n / 90)}
                  stroke={over ? WARN : ACCENT}
                  strokeWidth={1.2}
                  filter="url(#rl-soft)"
                />
                {/* the bin's mean confidence: where the bar would have to reach */}
                <line
                  x1={x}
                  y1={sy(b.conf)}
                  x2={x + bw - 3}
                  y2={sy(b.conf)}
                  stroke={over ? WARN : ACCENT}
                  strokeWidth={1.6}
                  strokeDasharray="3 2"
                />
                <text
                  x={x + (bw - 3) / 2}
                  y={sy(0) + 27}
                  textAnchor="middle"
                  className="font-mono"
                  fill={MUTED}
                  fontSize={8}
                >
                  {b.n}
                </text>
              </g>
            )
          })}

          <text
            x={PL - 34}
            y={sy(0.5)}
            transform={`rotate(-90 ${PL - 34} ${sy(0.5)})`}
            textAnchor="middle"
            className="font-mono"
            fill={MUTED}
            fontSize={9}
          >
            observed accuracy
          </text>
          <text
            x={sx(0.5)}
            y={H - 5}
            textAnchor="middle"
            className="font-mono"
            fill={MUTED}
            fontSize={9}
          >
            reported confidence (10 equal-width bins, n under each)
          </text>

          {/* readout */}
          <g transform={`translate(${W - PR + 6} ${PT + 6})`}>
            {(
              [
                ["accuracy", pct(s.acc), false],
                ["mean conf", pct(s.conf), false],
                ["ECE", f3(s.ece), true],
                ["Brier", f3(s.brier), true],
                ["NLL", f3(s.nll), true],
              ] as const
            ).map(([k, v, hot], i) => (
              <g key={k} transform={`translate(0 ${i * 40})`}>
                <text className="font-mono" fill={MUTED} fontSize={8.5} y={0}>
                  {k}
                </text>
                <text
                  className="font-mono"
                  fill={hot ? ACCENT : "var(--foreground)"}
                  fontSize={14}
                  fontWeight={600}
                  y={18}
                >
                  {v}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="whitespace-nowrap">temperature T</span>
          <input
            type="range"
            min={0.4}
            max={4}
            step={0.01}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="h-1 min-w-[180px] flex-1 accent-foreground"
            aria-label="temperature"
          />
          <span className="w-12 text-right text-foreground">{t.toFixed(2)}</span>
          <span className="flex gap-1">
            <button
              type="button"
              onClick={() => setT(1)}
              className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              T=1
            </button>
            <button
              type="button"
              onClick={() => setT(fitted)}
              className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              fitted {fitted.toFixed(2)}
            </button>
          </span>
        </label>
        <p className="mt-2.5 text-xs leading-5 text-muted-foreground">
          Accuracy does not move, ever. Dividing every logit by the same positive
          number cannot reorder them, so every bar can slide and the argmax stays
          put — which is why a model can be recalibrated without being made any
          better, and why &ldquo;we improved calibration&rdquo; and &ldquo;we
          improved the model&rdquo; are unrelated sentences.
        </p>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Bars are the observed accuracy inside each confidence bin; the dashed rule
        across each bar is that bin&apos;s mean reported confidence, so the gap
        between them is what ECE averages. Orange means the bin is overconfident.
        The 252 rows come from 36 authored cases, so the effective sample is much
        smaller than 252 and none of these numbers carries a confidence interval.
        The &ldquo;fitted&rdquo; temperature is my own single-scalar fit minimising
        NLL on the slice you have selected — in-sample for that slice, so it is the
        optimistic number, not a held-out one.
      </figcaption>
    </figure>
  )
}
