"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What each ingredient buys, as the paper reports it. Not our measurement.
// Row "DPVO, no prior" is Table 5 row 1 (calibrated, official checkpoint).
// The three prior rows per provider are Table 6 (average ATE RMSE, m): the named
// metric prior with the original DPVO weights, then + multi-dataset training, then
// + DINOv3 adapters (the full model). MoGe-2 is the shipped default.

type Ds = "KITTI" | "Oxford Spires" | "VBR"
const DATASETS: Ds[] = ["KITTI", "Oxford Spires", "VBR"]

const NO_PRIOR: Record<Ds, number> = { KITTI: 52.69, "Oxford Spires": 2.59, VBR: 72.25 }

const PROVIDERS = ["MoGe-2", "Pi3X", "VDA", "DA3Metric", "Metric3Dv2", "UniDepthV2"] as const
type Prov = (typeof PROVIDERS)[number]

// [DPVO + prior, + multi-dataset, + DINO (full)]
const TAB6: Record<Ds, Record<Prov, [number, number, number]>> = {
  KITTI: {
    "MoGe-2": [12.77, 10.32, 9.1],
    Pi3X: [27.92, 24.9, 22.35],
    VDA: [15.16, 8.97, 8.88],
    DA3Metric: [14.05, 10.03, 7.97],
    Metric3Dv2: [11.62, 10.57, 8.21],
    UniDepthV2: [11.18, 10.8, 7.69],
  },
  "Oxford Spires": {
    "MoGe-2": [1.85, 1.76, 1.71],
    Pi3X: [5.57, 4.53, 4.78],
    VDA: [2.25, 1.87, 1.92],
    DA3Metric: [1.28, 1.32, 1.14],
    Metric3Dv2: [1.42, 1.33, 1.15],
    UniDepthV2: [3.89, 6.04, 3.81],
  },
  VBR: {
    "MoGe-2": [19.57, 22.51, 18.9],
    Pi3X: [30.29, 36.13, 30.04],
    VDA: [24.7, 26.61, 23.07],
    DA3Metric: [19.17, 25.85, 18.39],
    Metric3Dv2: [20.14, 23.58, 18.79],
    UniDepthV2: [19.11, 24.61, 19.56],
  },
}

const ROWS = ["DPVO, no prior", "+ metric depth prior", "+ multi-dataset training", "+ DINOv3 adapters"]
const COLORS = ["oklch(0.62 0.03 260)", "oklch(0.7 0.13 150)", "oklch(0.66 0.12 200)", "oklch(0.62 0.15 150)"]

export function AblationLadder() {
  const [ds, setDs] = useState<Ds>("KITTI")
  const [prov, setProv] = useState<Prov>("MoGe-2")
  const vals = [NO_PRIOR[ds], ...TAB6[ds][prov]]
  const max = Math.max(...vals)
  const best = Math.min(...vals)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        average trajectory error by ingredient · reported, paper Tables 5 and 6, calibrated intrinsics, no loop closure
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {DATASETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDs(d)}
              className={cn(
                "rounded-full border px-3 py-1 font-mono text-xs",
                d === ds ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProv(p)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-xs",
                p === prov ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p}
              {p === "MoGe-2" ? " (default)" : ""}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {ROWS.map((label, i) => {
            const v = vals[i]
            const pct = (v / max) * 100
            return (
              <div key={label} className="grid grid-cols-[11rem_1fr_4.5rem] items-center gap-3 text-sm max-sm:grid-cols-[1fr_4rem]">
                <span className="font-mono text-xs text-muted-foreground max-sm:col-span-2">{label}</span>
                <div className="h-4 rounded-sm bg-muted">
                  <div className="h-4 rounded-sm" style={{ width: `${pct.toFixed(2)}%`, background: COLORS[i] }} />
                </div>
                <span className={cn("text-right font-mono text-xs", v === best && "font-semibold")}>{v.toFixed(2)} m</span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          The first row is the same for every provider: it is DPVO with no prior at all. The jump from row one to row two is the
          paper&apos;s main claim, and it holds for every provider on KITTI and VBR. On Oxford Spires it does not: Pi3X and UniDepthV2
          priors make the original DPVO worse than no prior. Rows three and four are not monotone either: multi-dataset training
          makes VBR worse for every provider, and DINOv3 does not recover UniDepthV2 on VBR (19.11 m to 19.56 m), the one miss in
          the paper&apos;s 14 of 15.
        </p>
      </div>
    </figure>
  )
}
