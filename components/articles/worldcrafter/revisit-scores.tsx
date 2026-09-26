"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The paper's two headline tables, one metric at a time, with each baseline
// coloured by the kind of memory the paper says it uses (Sec. 4.1).
//
// Memory metrics compare a frame generated on a revisit with the matched frame
// from the first visit; camera metrics compare the trajectory VGGT-Omega
// recovers from the generated video with the commanded one, after a Sim(3)
// alignment. Both are averages over the authors' own benchmark: 145 images x 5
// trajectories = 725 videos per method, resized to 640 x 384. Every number is
// Figures 4 and 5 of arXiv:2609.24984v1 (typeset there as tables). Lingbot-World
// 2's memory is the one the paper does not describe.

type Family = "ours" | "warp" | "context" | "state" | "unknown"

const FAMILY: Record<Family, { label: string; colour: string }> = {
  ours: { label: "implicit 3D-aware memory", colour: "oklch(0.60 0.15 255)" },
  warp: { label: "depth-based spatial memory", colour: "oklch(0.68 0.13 85)" },
  context: { label: "frames retrieved by camera similarity", colour: "oklch(0.58 0.10 320)" },
  state: { label: "recurrent state / sliding window", colour: "oklch(0.60 0.10 190)" },
  unknown: { label: "not described in the paper", colour: "oklch(0.62 0.02 250)" },
}

type Row = { m: string; f: Family; v: [number, number, number, number, number, number, number] }

// [MEt3R, LPIPS, PSNR, SSIM, RotErr, TransErr, CamMC]
const ROWS: Row[] = [
  { m: "DreamX-World", f: "context", v: [0.548, 0.627, 12.898, 0.243, 54.116, 2.759, 3.138] },
  { m: "Alaya-EVOKE", f: "warp", v: [0.414, 0.565, 12.332, 0.29, 26.042, 2.042, 2.199] },
  { m: "HY-WorldPlay", f: "context", v: [0.394, 0.515, 12.983, 0.252, 34.051, 2.146, 2.359] },
  { m: "Lyra 2.0", f: "warp", v: [0.334, 0.487, 14.05, 0.39, 16.145, 1.538, 1.624] },
  { m: "Echo-WM", f: "state", v: [0.449, 0.582, 12.592, 0.239, 21.455, 2.072, 2.189] },
  { m: "LingBot-World 2", f: "unknown", v: [0.492, 0.633, 10.449, 0.219, 30.615, 2.004, 2.192] },
  { m: "Matrix-Game 3.5", f: "warp", v: [0.405, 0.549, 12.976, 0.224, 19.881, 1.92, 2.028] },
  { m: "SANA-WM", f: "state", v: [0.397, 0.553, 13.142, 0.246, 23.531, 1.74, 1.887] },
  { m: "WorldCrafter", f: "ours", v: [0.166, 0.255, 18.016, 0.517, 13.536, 1.475, 1.546] },
  { m: "WorldCrafter-fast", f: "ours", v: [0.129, 0.186, 20.868, 0.616, 18.251, 1.638, 1.737] },
]

const METRICS = [
  { key: "MEt3R", lower: true, digits: 3, group: "revisit" },
  { key: "LPIPS", lower: true, digits: 3, group: "revisit" },
  { key: "PSNR", lower: false, digits: 3, group: "revisit", unit: "dB" },
  { key: "SSIM", lower: false, digits: 3, group: "revisit" },
  { key: "RotErr", lower: true, digits: 3, group: "camera" },
  { key: "TransErr", lower: true, digits: 3, group: "camera" },
  { key: "CamMC", lower: true, digits: 3, group: "camera" },
] as const

const W = 700
const LAB_W = 132
const PLOT_L = 142
const PLOT_R = 610
const TOP = 30
const ROW_H = 22

export function RevisitScores() {
  const [mi, setMi] = useState(1)
  const metric = METRICS[mi]
  const sorted = ROWS.slice().sort((a, b) => (metric.lower ? a.v[mi] - b.v[mi] : b.v[mi] - a.v[mi]))
  const max = Math.max(...ROWS.map((r) => r.v[mi]))
  const X = (v: number) => PLOT_L + (v / max) * (PLOT_R - PLOT_L)
  const H = TOP + ROWS.length * ROW_H + 18

  const baselines = ROWS.filter((r) => r.f !== "ours")
  const bestBase = baselines.reduce((b, r) => ((metric.lower ? r.v[mi] < b.v[mi] : r.v[mi] > b.v[mi]) ? r : b))
  const ours = ROWS.find((r) => r.m === "WorldCrafter")!
  const delta = metric.lower
    ? `${(((bestBase.v[mi] - ours.v[mi]) / bestBase.v[mi]) * 100).toFixed(1)}% lower than ${bestBase.m}`
    : metric.key === "PSNR"
      ? `+${(ours.v[mi] - bestBase.v[mi]).toFixed(3)} dB over ${bestBase.m}`
      : `+${(ours.v[mi] - bestBase.v[mi]).toFixed(3)} over ${bestBase.m}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>
          {metric.group === "revisit" ? "revisit consistency" : "camera-control accuracy"} · {metric.key}{" "}
          {metric.lower ? "(lower is better)" : "(higher is better)"}
        </span>
        <span className="text-muted-foreground/60">725 videos per method · reported</span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {METRICS.map((m, i) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMi(i)}
            aria-pressed={mi === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              mi === i
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
              i === 4 ? "sm:ml-3" : "",
            )}
          >
            {m.key}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[580px]"
          role="img"
          aria-label={`${metric.key} for ten camera-controllable world models on the WorldCrafter benchmark, ${metric.lower ? "lower is better" : "higher is better"}, best first: ${sorted.map((r) => `${r.m} ${r.v[mi].toFixed(metric.digits)}`).join(", ")}. WorldCrafter is ${delta}.`}
        >
          <text x={PLOT_L} y={16} className="fill-foreground font-mono" fontSize={10}>
            WorldCrafter: {delta}
          </text>
          {sorted.map((r, i) => {
            const y = TOP + i * ROW_H
            const c = FAMILY[r.f].colour
            const mine = r.f === "ours"
            return (
              <g key={r.m}>
                <text
                  x={LAB_W}
                  y={y + 10}
                  textAnchor="end"
                  className={mine ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={9.5}
                  fontWeight={mine ? 600 : 400}
                >
                  {r.m}
                </text>
                <rect x={PLOT_L} y={y + 1} width={Math.max(1, X(r.v[mi]) - PLOT_L)} height={12} rx={2} fill={c} fillOpacity={mine ? 0.9 : 0.55} />
                <text x={X(r.v[mi]) + 6} y={y + 11} className="fill-muted-foreground font-mono" fontSize={9}>
                  {r.v[mi].toFixed(metric.digits)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(FAMILY) as Family[]).map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: FAMILY[f].colour }} />
              {FAMILY[f].label}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Reported by the WorldCrafter authors on their own benchmark (arXiv:2609.24984, Figures 4 and 5). Memory
        families are as the paper describes each baseline. WorldCrafter-fast is the distilled model: it is the
        most consistent on revisits and third on every camera metric.
      </figcaption>
    </figure>
  )
}
