// What the reparameterization actually buys, on a log axis.
//
// Raw DA3 features are geometry-native and unusable as a generative state: 3,072
// channels carrying about eleven directions of real variance, with a covariance
// condition number that reaches 10^16.8 at level 3. Flow matching in that space
// is transport across sixteen orders of magnitude of scale. GAE keeps the patch
// grid, compresses only channels, and lands at kappa ~ 53 with three times the
// effective rank of the thing it was distilled from.
//
// Numbers are the paper's Table 2 (single-view columns). Server-rendered, zero
// JS; the log positions go through lib/dmath so SSR and the browser serialize
// the same coordinates.

import { mlog10 } from "@/lib/dmath"

type Row = {
  label: string
  shape: string
  kappa: number
  kappaText: string
  effrank: number
  ours?: boolean
  geo?: boolean
}

const ROWS: Row[] = [
  { label: "SD-VAE (pixel)", shape: "4×32×32", kappa: 3.7, kappaText: "3.7", effrank: 3.0 },
  { label: "WAN2.1 VAE (pixel)", shape: "16×32×32", kappa: 127, kappaText: "127", effrank: 5.3 },
  { label: "RAEv2 (semantic)", shape: "1024×16×16", kappa: 1.8e4, kappaText: "1.8e4", effrank: 289.3 },
  { label: "DA3-GIANT L0 (raw)", shape: "3072×18×18", kappa: 2.8e8, kappaText: "2.8e8", effrank: 11.3, geo: true },
  { label: "DA3-GIANT L3 (raw)", shape: "3072×18×18", kappa: 6.6e16, kappaText: "6.6e16", effrank: 11.5, geo: true },
  { label: "GLD (L0/L1 avg.)", shape: "cascade", kappa: 9.5e7, kappaText: "9.5e7", effrank: 34.8, geo: true },
  { label: "GAE-128", shape: "128×18×18", kappa: 227, kappaText: "227", effrank: 51.3, ours: true, geo: true },
  { label: "GAE-64", shape: "64×18×18", kappa: 53.1, kappaText: "53.1", effrank: 37.0, ours: true, geo: true },
]

const OURS = "oklch(0.55 0.15 250)"
const RAW = "oklch(0.58 0.17 30)"
const OTHER = "oklch(0.62 0.03 250)"

const W = 700
const ROW_H = 30
const TOP = 34
const PLOT_L = 262
const PLOT_R = 556
const LO = 0
const HI = 17.2
const UNIT = (PLOT_R - PLOT_L) / (HI - LO)
const TICKS = [0, 4, 8, 12, 16]

const x = (kappa: number) => PLOT_L + (mlog10(kappa) - LO) * UNIT

export function LatentShape() {
  const H = TOP + ROWS.length * ROW_H + 30

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>covariance condition number κ · log scale</span>
        <span className="text-muted-foreground/60">lower is better</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Condition number on a log scale for eight latent spaces. SD-VAE 3.7, WAN2.1 VAE 127, RAEv2 18,000, DA3-GIANT level 0 at 2.8 times ten to the eighth, DA3-GIANT level 3 at 6.6 times ten to the sixteenth, GLD at 9.5 times ten to the seventh, GAE-128 at 227 and GAE-64 at 53.1. Effective rank in the right column: 3.0, 5.3, 289.3, 11.3, 11.5, 34.8, 51.3 and 37.0 respectively."
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PLOT_L + t * UNIT}
                x2={PLOT_L + t * UNIT}
                y1={TOP - 8}
                y2={TOP + ROWS.length * ROW_H - 6}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={PLOT_L + t * UNIT}
                y={TOP - 14}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                10^{t}
              </text>
            </g>
          ))}

          <text x={PLOT_R + 18} y={TOP - 14} className="fill-muted-foreground font-mono" fontSize={9}>
            eff. rank
          </text>

          {ROWS.map((r, i) => {
            const y = TOP + i * ROW_H
            const cy = y + ROW_H / 2 - 5
            const color = r.ours ? OURS : r.geo ? RAW : OTHER
            const cx = x(r.kappa)
            return (
              <g key={r.label}>
                <text
                  x={150}
                  y={cy + 4}
                  textAnchor="end"
                  className={r.ours ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={11}
                >
                  {r.label}
                </text>
                <text
                  x={158}
                  y={cy + 4}
                  className="fill-muted-foreground/70 font-mono"
                  fontSize={9}
                >
                  {r.shape}
                </text>

                <line
                  x1={PLOT_L}
                  x2={cx}
                  y1={cy}
                  y2={cy}
                  stroke={color}
                  strokeWidth={r.ours ? 3 : 2}
                  opacity={0.4}
                />
                <circle cx={cx} cy={cy} r={r.ours ? 5 : 4} fill={color} />
                <text
                  x={cx + 10}
                  y={cy + 4}
                  className="font-mono"
                  fill={color}
                  fontSize={9}
                >
                  {r.kappaText}
                </text>

                <text
                  x={W - 8}
                  y={cy + 4}
                  textAnchor="end"
                  className={r.ours ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={10}
                >
                  {r.effrank.toFixed(1)}
                </text>
              </g>
            )
          })}

          <text
            x={PLOT_L}
            y={H - 8}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            κ = λ_max / λ_min of the channel covariance
          </text>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        The two raw DA3 levels are the geometry-native baselines. They carry
        3,072 channels and about eleven directions of variance. GAE-64 carries
        64 channels and 37.
      </figcaption>
    </figure>
  )
}
