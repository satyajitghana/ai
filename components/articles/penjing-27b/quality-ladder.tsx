"use client"

import { useState } from "react"

import { mlog } from "@/lib/dmath"

// Quality against size for the whole ladder, which is the one chart a
// quantisation release lives or dies by -- and the one chart the card does not
// draw. The numbers are the card's own (wikitext2, -c 2048, f16 reference PPL
// 4.1422); the sizes and the bits-per-weight are measured here from the GGUF
// headers rather than taken from the filenames, which is why IQ2_XXS and IQ2_KT
// land 0.03 bpw apart instead of at their nominal 2.0625 and 2.125.
//
// Three of six rungs carry a measurement. Two more exist as files with no
// numbers, and two exist only as rows in the card's table. Drawing the gaps is
// the point: an unmeasured rung is not a worse point on this curve, it is no
// point at all, and a reader choosing a build is choosing partly blind.

type Metric = "ppl" | "kld" | "top1"

type Rung = {
  name: string
  gb: number | null // null = listed in the card, not present in the repo
  bpw: number | null
  ppl: number | null
  kld: number | null
  top1: number | null
  runtime: "any" | "ik" | "—"
}

// Sizes and bpw: parsed from each file's tensor-info block on 2026-09-22.
// Quality columns: PollardWeights/Penjing-27B-Pollard README, same date.
const RUNGS: Rung[] = [
  { name: "IQ1_KT", gb: 6.527, bpw: 1.906, ppl: 5.7864, kld: 0.5513, top1: 75.88, runtime: "ik" },
  { name: "IQ2_XXS", gb: 7.25, bpw: 2.12, ppl: 5.4312, kld: 0.5142, top1: 76.38, runtime: "any" },
  { name: "IQ2_KT", gb: 7.361, bpw: 2.15, ppl: 5.0817, kld: 0.4217, top1: 79.1, runtime: "ik" },
  { name: "IQ3_S", gb: 12.937, bpw: 3.785, ppl: null, kld: null, top1: null, runtime: "any" },
  { name: "IQ4_XS", gb: null, bpw: null, ppl: null, kld: null, top1: null, runtime: "any" },
  { name: "Q6_K", gb: null, bpw: null, ppl: null, kld: null, top1: null, runtime: "any" },
]

// Card-listed sizes for the two rungs that have no file yet, so the x position
// is still meaningful. These are the card's numbers, not measurements.
const CLAIMED_GB: Record<string, number> = { IQ4_XS: 15.47, Q6_K: 22.43 }

const F16_GB = 54.64
const F16_PPL = 4.1422

const METRICS: Record<
  Metric,
  { label: string; unit: string; better: string; lo: number; hi: number; ref: number | null }
> = {
  ppl: {
    label: "perplexity",
    unit: "wikitext2, ctx 2048",
    better: "lower is better",
    lo: 4.0,
    hi: 6.0,
    ref: F16_PPL,
  },
  kld: {
    label: "mean KL vs f16",
    unit: "nats per token",
    better: "lower is better",
    lo: 0,
    hi: 0.6,
    ref: 0,
  },
  top1: {
    label: "top-1 agreement with f16",
    unit: "share of tokens",
    better: "higher is better",
    lo: 70,
    hi: 100,
    ref: 100,
  },
}

const MEASURED = "oklch(0.58 0.15 250)"
const UNMEASURED = "oklch(0.62 0.02 250)"

export function QualityLadder() {
  const [metric, setMetric] = useState<Metric>("ppl")
  const m = METRICS[metric]

  const W = 720
  const H = 330
  const L = 62
  const R = 22
  const T = 22
  const B = 58

  // Log x: 6 GB to 56 GB spans an order of magnitude and the interesting rungs
  // are bunched at the bottom.
  const X_LO = mlog(6)
  const X_HI = mlog(58)
  const px = (gb: number) => L + ((mlog(gb) - X_LO) / (X_HI - X_LO)) * (W - L - R)
  const py = (v: number) => T + ((m.hi - v) / (m.hi - m.lo)) * (H - T - B)

  const value = (r: Rung) => (metric === "ppl" ? r.ppl : metric === "kld" ? r.kld : r.top1)

  const measured = RUNGS.filter((r) => r.gb !== null && value(r) !== null)
  const filesNoNumbers = RUNGS.filter((r) => r.gb !== null && value(r) === null)
  const cardOnly = RUNGS.filter((r) => r.gb === null)

  const xTicks = [6, 8, 12, 16, 24, 32, 56]
  const yTicks =
    metric === "ppl"
      ? [4, 4.5, 5, 5.5, 6]
      : metric === "kld"
        ? [0, 0.15, 0.3, 0.45, 0.6]
        : [70, 80, 90, 100]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          quality against size, with the holes left in
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          3 of 6 rungs measured · 4 of 6 uploaded
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(METRICS) as Metric[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                (metric === k
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {METRICS[k].label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[600px]"
            role="img"
            aria-label={`${m.label} against file size in gigabytes, log x-axis, for six Penjing-27B builds. Three builds carry a measurement; IQ3_S is a file with no published number; IQ4_XS and Q6_K are rows in the card with no file in the repo.`}
          >
            {yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={L}
                  x2={W - R}
                  y1={py(v)}
                  y2={py(v)}
                  className="stroke-foreground/10"
                  strokeWidth={1}
                />
                <text
                  x={L - 7}
                  y={py(v) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 9 }}
                >
                  {metric === "top1" ? `${v}%` : v}
                </text>
              </g>
            ))}

            {xTicks.map((g) => (
              <text
                key={g}
                x={px(g)}
                y={H - B + 16}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {g}
              </text>
            ))}
            <text
              x={(L + W - R) / 2}
              y={H - B + 32}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              file size (GB, log scale)
            </text>
            <text
              x={12}
              y={T + 4}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {m.better}
            </text>

            {/* f16 reference */}
            {m.ref !== null && m.ref >= m.lo && m.ref <= m.hi ? (
              <>
                <line
                  x1={L}
                  x2={W - R}
                  y1={py(m.ref)}
                  y2={py(m.ref)}
                  className="stroke-foreground/35"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text
                  x={W - R}
                  y={py(m.ref) - 5}
                  textAnchor="end"
                  className="fill-foreground/70 font-mono"
                  style={{ fontSize: 9 }}
                >
                  f16 · {F16_GB} GB
                </text>
              </>
            ) : null}

            {/* the measured curve */}
            <polyline
              points={measured.map((r) => `${px(r.gb!)},${py(value(r)!)}`).join(" ")}
              fill="none"
              stroke={MEASURED}
              strokeWidth={1.6}
            />

            {measured.map((r) => (
              <g key={r.name}>
                <circle cx={px(r.gb!)} cy={py(value(r)!)} r={5} fill={MEASURED}>
                  <title>{`${r.name} · ${r.gb} GB · ${r.bpw} bpw · ${m.label} ${value(r)}`}</title>
                </circle>
                <text
                  x={px(r.gb!)}
                  y={py(value(r)!) - 11}
                  textAnchor="middle"
                  className="fill-foreground font-mono"
                  style={{ fontSize: 9 }}
                >
                  {r.name}
                </text>
                <text
                  x={px(r.gb!)}
                  y={py(value(r)!) + 17}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 8 }}
                >
                  {r.bpw} bpw
                </text>
              </g>
            ))}

            {/* files with no number: a vertical band with no point on it */}
            {filesNoNumbers.map((r) => (
              <g key={r.name}>
                <line
                  x1={px(r.gb!)}
                  x2={px(r.gb!)}
                  y1={T}
                  y2={H - B}
                  stroke={UNMEASURED}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
                <text
                  x={px(r.gb!)}
                  y={T - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 9 }}
                >
                  {r.name}
                </text>
                <text
                  x={px(r.gb!) + 4}
                  y={T + 46}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 8 }}
                >
                  file, no number
                </text>
              </g>
            ))}

            {cardOnly.map((r) => (
              <g key={r.name}>
                <line
                  x1={px(CLAIMED_GB[r.name])}
                  x2={px(CLAIMED_GB[r.name])}
                  y1={T}
                  y2={H - B}
                  stroke={UNMEASURED}
                  strokeWidth={1}
                  strokeDasharray="1 5"
                />
                <text
                  x={px(CLAIMED_GB[r.name])}
                  y={T - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 9 }}
                >
                  {r.name}
                </text>
                <text
                  x={px(CLAIMED_GB[r.name]) + 4}
                  y={T + 72}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 8 }}
                >
                  no file
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Quality figures are the card&apos;s (wikitext2, ctx 2048, single
        machine). Sizes and bits-per-weight are measured from the published GGUF
        headers on 2026-09-22. IQ4_XS and Q6_K are placed at the sizes the card
        states; no such file was in the repo at that time.
      </figcaption>
    </figure>
  )
}
