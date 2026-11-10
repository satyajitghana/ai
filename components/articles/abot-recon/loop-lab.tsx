"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { DEEP } from "./deep-data"

// MEASURED (loop_closure_toy.py): ABot-Recon's loop-closure back end re-implemented on CPU with the released
// defaults (NMS radius 25, frame separation 30, keyframe stride 50, loop weight 0.01 * sqrt(128 / 24), odometry
// weight 1, 30 Levenberg-Marquardt steps, slerp interpolation of the corrections). The drive is a 4,661-frame loop
// that re-drives its first 640 frames. Retrieval and re-inference are NOT the model's: candidates come from true
// positions and each loop measurement is the true relative pose plus 0.05 degree / 0.05 m noise. Four seeds.

const E2 = DEEP.e2
const VIEWS = [
  { id: "none", label: "no loop closure", col: "oklch(0.62 0.19 28)" },
  { id: "default", label: "released weight", col: "oklch(0.6 0.13 250)" },
  { id: "w1", label: "weight ×100", col: "oklch(0.62 0.15 150)" },
  { id: "w1_false", label: "×100 + one false loop", col: "oklch(0.55 0.2 330)" },
] as const
type ViewId = (typeof VIEWS)[number]["id"]

const LABELS: Record<string, string> = {
  none: "no loop closure",
  default: "released weight, 20 edges",
  "w0.1": "weight ×10, 20 edges",
  w1: "weight ×100, 20 edges",
  default_1edge: "released weight, 1 edge",
  default_5edges: "released weight, 5 edges",
  w1_1edge: "weight ×100, 1 edge",
  default_false: "released weight, 20 + 1 false",
  w1_false: "weight ×100, 20 + 1 false",
}

const W = 520
const H = 340

function frame(sets: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>>) {
  const pts = sets.flat()
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const pad = 40
  const x0 = Math.min(...xs) - pad
  const x1 = Math.max(...xs) + pad
  const y0 = Math.min(...ys) - pad
  const y1 = Math.max(...ys) + pad
  const sc = Math.min(W / (x1 - x0), H / (y1 - y0))
  const ox = (W - (x1 - x0) * sc) / 2
  const oy = (H - (y1 - y0) * sc) / 2
  return (p: ReadonlyArray<ReadonlyArray<number>>) =>
    p.map((q) => `${(ox + (q[0] - x0) * sc).toFixed(1)},${(oy + (y1 - q[1]) * sc).toFixed(1)}`).join(" ")
}

export function LoopLab() {
  const [tab, setTab] = useState<"paths" | "ate">("paths")
  const [view, setView] = useState<ViewId>("default")
  const gt = E2.paths.gt
  const est = E2.paths[view]
  const poly = frame([gt, est])
  const v = VIEWS.find((x) => x.id === view) ?? VIEWS[0]
  const row = E2.rows.find((r) => r.config === view)
  const maxAte = 70
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured · loop_closure_toy.py · {E2.frames.toLocaleString("en-US")} frames · {E2.n_raw_candidates} raw candidates → {E2.n_kept} after NMS ·
        rotation noise 0.05°, translation 2% a step
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3" role="tablist" aria-label="View">
        {(["paths", "ate"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              tab === t ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "paths" ? "One drive, top down" : "ATE by setting"}
          </button>
        ))}
      </div>
      {tab === "paths" && (
        <div className="p-3">
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            {VIEWS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setView(x.id)}
                aria-pressed={view === x.id}
                className={cn(
                  "rounded border px-2 py-0.5",
                  view === x.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Top-down drive: ground truth and the ${v.label} estimate`}>
            <polyline points={poly(gt)} fill="none" stroke="var(--foreground)" strokeWidth={2.5} opacity={0.3} />
            <polyline points={poly(est)} fill="none" stroke={v.col} strokeWidth={1.8} />
          </svg>
          <p className="mt-2 text-xs text-muted-foreground">
            Grey: ground truth. One seed, every 25th frame, Sim(3)-aligned. This seed&apos;s run is one of four; the mean ATE for
            this setting is {row ? row.ATE_m.toFixed(2) : "n/a"} m. The axes rescale to fit the estimate, so the false-loop view
            is drawn at a much smaller scale than the others.
          </p>
        </div>
      )}
      {tab === "ate" && (
        <div className="space-y-1.5 p-3">
          {E2.rows.map((r) => (
            <div key={r.config} className="grid grid-cols-[10rem_1fr_6.5rem] items-center gap-2 text-xs sm:grid-cols-[14rem_1fr_7rem]">
              <span className="text-muted-foreground">{LABELS[r.config] ?? r.config}</span>
              <div className="h-3 rounded-sm bg-muted">
                <div
                  className="h-3 rounded-sm"
                  style={{
                    width: `${Math.min(100, Math.max(1, (r.ATE_m / maxAte) * 100))}%`,
                    background: r.false_edges ? "oklch(0.55 0.2 330)" : r.edges ? "oklch(0.6 0.13 250)" : "oklch(0.62 0.19 28)",
                  }}
                />
              </div>
              <span className="text-right font-mono tabular-nums">
                {r.ATE_m.toFixed(2)} ± {r.ATE_std.toFixed(2)} m
              </span>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            Bars are capped at {maxAte} m; the last row runs off the scale. The released weight closes most of the drift with
            20 good edges and still loses to one bad edge: there is no robust kernel and no per-edge verification in the
            graph.
          </p>
        </div>
      )}
    </figure>
  )
}
