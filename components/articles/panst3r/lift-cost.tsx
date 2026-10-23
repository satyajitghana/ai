"use client"

// Panoptic quality against wall-clock, on the Panoptic Lifting benchmark.
//
// Every number is the PanSt3R paper's own Table 2 (arXiv 2506.21348v1): scene
// PQ on Hypersim, Replica and ScanNet, and the "Time (min)" column. Times are
// approximate ("~") in the paper and no hardware is stated. For the two
// direct-prediction PanSt3R rows the paper adds "+35" minutes, marked as the
// time to build the 3DGS that renders the benchmark's test views; it is drawn
// here as a dashed extension because the benchmark config cannot skip it.
// PNF and PCF-Lift publish no time; PCF-Lift publishes ScanNet only.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

type Row = {
  name: string
  family: "nerf" | "3dgs" | "ours"
  poses: boolean
  pq: [number | null, number | null, number | null] // hypersim, replica, scannet
  min: number | null
  extra?: number
}

const ROWS: Row[] = [
  { name: "DM-NeRF", family: "nerf", poses: true, pq: [51.6, 44.1, 41.7], min: 900 },
  { name: "PNF", family: "nerf", poses: true, pq: [44.8, 41.1, 48.3], min: null },
  { name: "PanLift", family: "nerf", poses: true, pq: [60.1, 57.9, 58.9], min: 450 },
  { name: "Contrastive Lift", family: "nerf", poses: true, pq: [62.3, 59.1, 62.3], min: 420 },
  { name: "PLGS", family: "3dgs", poses: true, pq: [62.4, 57.8, 58.7], min: 120 },
  { name: "PCF-Lift", family: "3dgs", poses: true, pq: [null, null, 63.5], min: null },
  { name: "PanSt3R w/o QUBO", family: "ours", poses: false, pq: [51.6, 57.3, 59.5], min: 4, extra: 35 },
  { name: "PanSt3R", family: "ours", poses: false, pq: [56.5, 62.0, 65.7], min: 4.5, extra: 35 },
  { name: "PanSt3R + LUDVIG", family: "ours", poses: true, pq: [66.3, 60.6, 67.5], min: 40 },
]

const DATASETS = ["Hypersim", "Replica", "ScanNet"] as const

const COLOR: Record<Row["family"], string> = {
  nerf: "oklch(0.66 0.12 30)",
  "3dgs": "oklch(0.70 0.12 85)",
  ours: "oklch(0.60 0.15 255)",
}

const W = 720
const ROW_H = 26
const TOP = 34
const NAME_W = 132
const PQ_X = NAME_W + 8
const PQ_W = 230
const PQ_MIN = 40 // axis starts at 40 PQ so differences are visible
const PQ_MAX = 70
const T_X = PQ_X + PQ_W + 70
const T_W = W - T_X - 14
const T_LO = 1 // minutes, log axis
const T_HI = 1000

function tx(min: number): number {
  return T_X + ((mlog10(min) - mlog10(T_LO)) / (mlog10(T_HI) - mlog10(T_LO))) * T_W
}

export function LiftCost() {
  const [d, setD] = useState(2)
  const H = TOP + ROWS.length * ROW_H + 30
  const best = Math.max(...ROWS.map((r) => r.pq[d] ?? 0))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>PanLift benchmark · scene PQ vs minutes per scene</span>
        <span className="text-muted-foreground/60">reported, paper Table 2</span>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Dataset">
          {DATASETS.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => setD(i)}
              aria-pressed={d === i}
              className={
                "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors " +
                (d === i
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/40")
              }
            >
              {name}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scene panoptic quality on ${DATASETS[d]} for nine methods from the PanSt3R paper's Table 2, beside each method's time per scene on a log scale from one to a thousand minutes. Best PQ on this dataset is ${best.toFixed(1)}.`}
        >
          <text x={PQ_X} y={18} className="fill-muted-foreground font-mono" fontSize={10}>
            scene PQ ({PQ_MIN} to {PQ_MAX})
          </text>
          <text x={T_X} y={18} className="fill-muted-foreground font-mono" fontSize={10}>
            minutes per scene, log scale
          </text>
          {[1, 10, 100, 1000].map((t) => (
            <g key={t}>
              <line
                x1={tx(t)}
                x2={tx(t)}
                y1={TOP - 6}
                y2={TOP + ROWS.length * ROW_H}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              <text x={tx(t)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {t}
              </text>
            </g>
          ))}

          {ROWS.map((r, i) => {
            const y = TOP + i * ROW_H
            const pq = r.pq[d]
            const w = pq == null ? 0 : ((pq - PQ_MIN) / (PQ_MAX - PQ_MIN)) * PQ_W
            return (
              <g key={r.name}>
                <text x={NAME_W} y={y + 14} textAnchor="end" className="fill-foreground font-mono" fontSize={10}>
                  {r.name}
                </text>
                {pq == null ? (
                  <text x={PQ_X + 4} y={y + 14} className="fill-muted-foreground font-mono" fontSize={9}>
                    not reported
                  </text>
                ) : (
                  <>
                    <rect
                      x={PQ_X}
                      y={y + 4}
                      width={w}
                      height={14}
                      rx={2}
                      fill={COLOR[r.family]}
                      fillOpacity={pq === best ? 0.95 : 0.6}
                    />
                    <text x={PQ_X + w + 5} y={y + 15} className="fill-foreground font-mono" fontSize={9.5}>
                      {pq.toFixed(1)}
                    </text>
                  </>
                )}
                {r.min == null ? (
                  <text x={T_X + 4} y={y + 14} className="fill-muted-foreground font-mono" fontSize={9}>
                    no time given
                  </text>
                ) : (
                  <>
                    <rect
                      x={T_X}
                      y={y + 6}
                      width={tx(r.min) - T_X}
                      height={10}
                      rx={2}
                      fill={COLOR[r.family]}
                      fillOpacity={0.7}
                    />
                    {r.extra != null && (
                      <rect
                        x={tx(r.min)}
                        y={y + 6}
                        width={tx(r.min + r.extra) - tx(r.min)}
                        height={10}
                        rx={2}
                        fill="none"
                        stroke={COLOR[r.family]}
                        strokeDasharray="3 2"
                      />
                    )}
                    <text
                      x={tx(r.min + (r.extra ?? 0)) + 5}
                      y={y + 15}
                      className="fill-muted-foreground font-mono"
                      fontSize={9}
                    >
                      ~{r.min}
                      {r.extra != null ? ` + ${r.extra}` : ""}
                      {r.poses ? " · poses" : ""}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Red: NeRF lifting. Amber: 3DGS lifting. Blue: PanSt3R. The dashed segment is the paper&apos;s &quot;+35&quot;: the
        3DGS built only to render the benchmark&apos;s test views, which PanSt3R alone could skip given real images.
        &quot;poses&quot; marks methods that need camera parameters. The paper states no hardware for these times.
      </figcaption>
    </figure>
  )
}
