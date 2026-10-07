"use client"

import { useState } from "react"

// Every number is copied from the LoT Diffusion paper (arXiv 2610.05816):
//   images: Table 1 (FLUX.2 klein 4B, 5,261 held-out prompts, 30 steps, H100)
//           and Table 5 (the ablations, plus "Ours" at 1.523x compression)
//   video:  Table 2 (Wan2.1 14B, 200 held-out prompts, 81 frames at 720p,
//           50 steps, six VBench dimensions)
// Rows are [compression, speed, ...metrics]. Nothing is interpolated: lines
// only join the measured budgets of one method.

type Series = { name: string; color: string; dash?: boolean; rows: number[][] }
type Domain = { metrics: { name: string; up: boolean }[]; dense: number[]; series: Series[]; ablations?: Series[] }

const IMG: Domain = {
  metrics: [
    { name: "ImageReward", up: true },
    { name: "HPSv2.1", up: true },
    { name: "HPSv3", up: true },
    { name: "FID", up: false },
    { name: "pFID", up: false },
    { name: "TOPIQ", up: true },
    { name: "MUSIQ", up: true },
  ],
  dense: [1, 1.001, 0.9518, 0.2808, 10.4299, 16.748, 20.884, 0.5852, 69.783],
  series: [
    {
      name: "LoT (ours)",
      color: "oklch(0.6 0.18 15)",
      rows: [
        [1.523, 1.323, 0.9105, 0.2764, 10.3477, 13.8, 17.019, 0.617, 70.41],
        [1.893, 1.56, 0.8833, 0.2728, 10.1211, 13.361, 16.393, 0.608, 69.691],
        [2.406, 1.818, 0.8513, 0.2672, 9.7533, 13.308, 17.046, 0.5978, 69.42],
        [2.935, 2.04, 0.8326, 0.2639, 9.5522, 13.345, 17.822, 0.5873, 68.76],
      ],
    },
    {
      name: "ToMe-SD",
      color: "oklch(0.62 0.03 260)",
      rows: [
        [1.893, 1.538, 0.1757, 0.2182, 5.3569, 25.757, 30.502, 0.4888, 58.991],
        [2.406, 1.793, -0.2547, 0.1946, 2.915, 34.321, 41.187, 0.4488, 53.558],
        [2.935, 2.003, -0.6029, 0.1781, 0.9253, 43.528, 50.116, 0.4203, 49.119],
      ],
    },
    {
      name: "DDiT",
      color: "oklch(0.65 0.13 150)",
      rows: [
        [1.893, 1.34, 0.885, 0.2613, 9.0052, 19.671, 23.739, 0.5593, 66.233],
        [2.406, 1.521, 0.7865, 0.2512, 8.0549, 24.15, 32.311, 0.5444, 64.612],
        [2.935, 1.321, 0.7156, 0.2447, 7.4075, 28.156, 38.974, 0.5341, 63.435],
      ],
    },
    {
      name: "Foveated Diffusion",
      color: "oklch(0.62 0.14 250)",
      rows: [
        [1.893, 1.04, 0.828, 0.2615, 9.0092, 14.944, 18.595, 0.5822, 67.494],
        [2.406, 1.1, 0.7737, 0.2543, 8.2674, 15.702, 21.456, 0.5433, 65.109],
        [2.935, 1.18, 0.7582, 0.2507, 7.8433, 16.124, 23.645, 0.5097, 63.105],
      ],
    },
  ],
  ablations: [
    {
      name: "no size embedding",
      color: "oklch(0.7 0.12 70)",
      dash: true,
      rows: [
        [1.523, 1.322, 0.9294, 0.2717, 10.0284, 14.584, 17.472, 0.603, 69.433],
        [1.893, 1.554, 0.9008, 0.2665, 9.7299, 13.934, 17.32, 0.5888, 68.563],
        [2.406, 1.842, 0.8337, 0.259, 9.1663, 14.378, 18.822, 0.5758, 67.968],
        [2.935, 2.071, 0.8042, 0.2543, 8.767, 14.933, 20.497, 0.5636, 67.277],
      ],
    },
    {
      name: "binary grid (1x1, 2x2)",
      color: "oklch(0.55 0.12 300)",
      dash: true,
      rows: [
        [1.518, 1.387, 0.7472, 0.252, 8.1955, 20.603, 25.073, 0.5517, 66.443],
        [1.879, 1.651, 0.7086, 0.2478, 7.8377, 21.638, 27.603, 0.518, 64.668],
        [2.336, 1.953, 0.6952, 0.2464, 7.6611, 23.111, 31.55, 0.4871, 63.34],
        [2.774, 2.194, 0.6793, 0.246, 7.5753, 24.004, 34.786, 0.4674, 62.508],
      ],
    },
    {
      name: "direct HR prediction",
      color: "oklch(0.45 0.05 40)",
      dash: true,
      rows: [
        [1.523, 1.355, 0.6301, 0.2601, 7.0595, 26.487, 36.072, 0.5134, 63.346],
        [1.893, 1.601, 0.4335, 0.2503, 5.3532, 37.414, 55.443, 0.4581, 59.576],
        [2.406, 1.882, 0.1066, 0.2351, 2.8754, 54.762, 89.686, 0.3876, 54.603],
        [2.935, 2.137, -0.0843, 0.2268, 1.3967, 68.508, 111.952, 0.3497, 51.809],
      ],
    },
  ],
}

const VID: Domain = {
  metrics: [
    { name: "Aesthetic", up: true },
    { name: "Imaging", up: true },
    { name: "Dynamic", up: true },
    { name: "Background", up: true },
    { name: "Subject", up: true },
    { name: "Motion", up: true },
  ],
  dense: [1, 1, 0.5518, 0.6465, 0.89, 0.9332, 0.9254, 0.9899],
  series: [
    {
      name: "LoT (ours)",
      color: "oklch(0.6 0.18 15)",
      rows: [
        [2, 2.262, 0.5324, 0.612, 0.965, 0.9242, 0.8775, 0.9836],
        [2.5, 2.909, 0.5204, 0.5851, 0.965, 0.9232, 0.8729, 0.9832],
        [3, 3.53, 0.5104, 0.565, 0.95, 0.9232, 0.8687, 0.9829],
      ],
    },
    {
      name: "ToMe-SD",
      color: "oklch(0.62 0.03 260)",
      rows: [
        [2, 2.223, 0.3497, 0.4925, 0.9, 0.9017, 0.8235, 0.9594],
        [2.5, 2.802, 0.293, 0.4477, 0.93, 0.9122, 0.8071, 0.9555],
        [3, 3.305, 0.2704, 0.4208, 0.98, 0.9189, 0.8031, 0.9526],
      ],
    },
    {
      name: "Foveated Diffusion",
      color: "oklch(0.62 0.14 250)",
      rows: [
        [2, 2.153, 0.5258, 0.5598, 0.965, 0.9252, 0.88, 0.9844],
        [2.5, 2.746, 0.5153, 0.5263, 0.955, 0.9236, 0.8776, 0.9839],
        [3, 3.276, 0.508, 0.4952, 0.955, 0.9234, 0.8761, 0.9839],
      ],
    },
  ],
}

const W = 300
const H = 210
const PAD = { l: 38, r: 10, t: 10, b: 30 }

function Chart({
  series,
  xi,
  yi,
  x0,
  x1,
  y0,
  y1,
  refY,
  diag,
  xLabel,
  yLabel,
}: {
  series: Series[]
  xi: number
  yi: number
  x0: number
  x1: number
  y0: number
  y1: number
  refY?: number
  diag?: boolean
  xLabel: string
  yLabel: string
}) {
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
  const sy = (y: number) => H - PAD.b - ((y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b)
  const ticks = (a: number, b: number) => {
    const out: number[] = []
    const step = (b - a) / 4
    for (let i = 0; i <= 4; i++) out.push(a + step * i)
    return out
  }
  const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${yLabel} against ${xLabel}`}>
      {ticks(y0, y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.08} />
          <text x={PAD.l - 4} y={sy(t) + 3} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.6}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {ticks(x0, x1).map((t) => (
        <text key={`x${t}`} x={sx(t)} y={H - PAD.b + 11} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.6}>
          {fmt(t)}
        </text>
      ))}
      <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" fontSize={8.5} fill="currentColor" opacity={0.75}>
        {xLabel}
      </text>
      <text
        x={10}
        y={(PAD.t + H - PAD.b) / 2}
        textAnchor="middle"
        fontSize={8.5}
        fill="currentColor"
        opacity={0.75}
        transform={`rotate(-90 10 ${(PAD.t + H - PAD.b) / 2})`}
      >
        {yLabel}
      </text>
      {diag && (
        <line
          x1={sx(Math.max(x0, y0))}
          y1={sy(Math.max(x0, y0))}
          x2={sx(Math.min(x1, y1))}
          y2={sy(Math.min(x1, y1))}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="3 3"
        />
      )}
      {refY !== undefined && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(refY)} y2={sy(refY)} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="5 3" />
          <text x={W - PAD.r - 2} y={sy(refY) - 3} textAnchor="end" fontSize={7.5} fill="currentColor" opacity={0.7}>
            dense
          </text>
        </g>
      )}
      {series.map((s) => (
        <g key={s.name}>
          <polyline
            points={s.rows.map((r) => `${sx(r[xi])},${sy(r[yi])}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={1.6}
            strokeDasharray={s.dash ? "4 2" : undefined}
          />
          {s.rows.map((r) => (
            <circle key={`${r[xi]}-${r[yi]}`} cx={sx(r[xi])} cy={sy(r[yi])} r={2.4} fill={s.color}>
              <title>{`${s.name}: ${r[xi]}x compression, ${r[yi]}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  )
}

export function TradeoffCurves() {
  const [dom, setDom] = useState<"img" | "vid">("img")
  const [mi, setMi] = useState(2)
  const [abl, setAbl] = useState(false)
  const D = dom === "img" ? IMG : VID
  const m = Math.min(mi, D.metrics.length - 1)
  const series = dom === "img" && abl && D.ablations ? [D.series[0], ...D.ablations] : D.series
  const yi = 2 + m
  let lo = D.dense[yi]
  let hi = D.dense[yi]
  for (const s of series)
    for (const r of s.rows) {
      if (r[yi] < lo) lo = r[yi]
      if (r[yi] > hi) hi = r[yi]
    }
  const pad = (hi - lo) * 0.08
  const speedHi = dom === "img" ? 2.4 : 3.8

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          speed and quality at matched token budgets · paper Tables 1, 2 and 5
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">H100, layouts from texture variance</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["img", "vid"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDom(d)
                setMi(d === "img" ? 2 : 1)
              }}
              aria-pressed={dom === d}
              className={
                "rounded-md border px-2.5 py-1 font-mono text-xs " +
                (dom === d ? "border-foreground/50 bg-muted" : "text-muted-foreground hover:bg-muted/50")
              }
            >
              {d === "img" ? "image · FLUX.2 4B" : "video · Wan2.1 14B"}
            </button>
          ))}
          {dom === "img" && (
            <label className="ml-auto flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <input type="checkbox" checked={abl} onChange={(e) => setAbl(e.target.checked)} />
              show ablations instead of baselines
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {D.metrics.map((x, i) => (
            <button
              key={x.name}
              type="button"
              onClick={() => setMi(i)}
              aria-pressed={m === i}
              className={
                "rounded border px-2 py-0.5 font-mono text-[11px] " +
                (m === i ? "border-foreground/50 bg-muted" : "text-muted-foreground hover:bg-muted/50")
              }
            >
              {x.name} {x.up ? "↑" : "↓"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Chart
            series={series}
            xi={0}
            yi={1}
            x0={1}
            x1={3.2}
            y0={0.8}
            y1={speedHi}
            diag
            xLabel="token compression (x)"
            yLabel="speedup vs dense (x)"
          />
          <Chart
            series={series}
            xi={0}
            yi={yi}
            x0={1}
            x1={3.2}
            y0={lo - pad}
            y1={hi + pad}
            refY={D.dense[yi]}
            xLabel="token compression (x)"
            yLabel={`${D.metrics[m].name} ${D.metrics[m].up ? "(higher better)" : "(lower better)"}`}
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Left: the dashed diagonal is speedup equal to compression. Image points sit below it, video points above it.
          Right: the dashed horizontal line is the dense model fine-tuned on the same data. Every method at a given
          budget gets the same layout, derived from a reference image or a reference video.
        </p>
      </div>
    </figure>
  )
}
