"use client"

import { useState } from "react"

import { LOOP, LOOP_BUDGET, LOOP_SEEDS } from "./data-loop"
import { ACCENT, Frame, GREEN, Pill, STREAM } from "./viz"

// The render-compare-refine loop with the language model taken out (a toy,
// MEASURED, code/loop.py). A local search edits three oriented boxes to match
// the silhouettes of a target from 1, 3 or 6 cameras. "Renders" is how many
// re-renders it took to reach mean silhouette IoU 0.9, median over the targets
// that got there; the budget is a hard cap. "3D IoU" scores the result against
// the true boxes in 3D, which no camera sees directly.

type Metric = "renders" | "iou3d" | "reached"

const LABEL: Record<Metric, string> = {
  renders: "renders to IoU 0.9",
  iou3d: "3D IoU of the result",
  reached: "targets that reached 0.9",
}

export function LoopToy() {
  const [metric, setMetric] = useState<Metric>("renders")
  const cams = [1, 3, 6]
  const value = (c: (typeof LOOP)[number]) =>
    metric === "renders" ? (c.evalsMedian ?? LOOP_BUDGET) : metric === "iou3d" ? c.iou3d : c.reached / c.seeds
  const max = metric === "renders" ? LOOP_BUDGET : 1
  const text = (c: (typeof LOOP)[number]) =>
    metric === "renders"
      ? c.evalsMedian === null
        ? "none"
        : Math.round(c.evalsMedian).toLocaleString("en-US")
      : metric === "iou3d"
        ? c.iou3d.toFixed(2)
        : `${c.reached}/${c.seeds}`
  return (
    <Frame
      label={`a loop with no language model in it · a toy · MEASURED, ${LOOP_SEEDS} targets per cell`}
      right={
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LABEL) as Metric[]).map((m) => (
            <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>
              {LABEL[m]}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          A stochastic local search on three oriented boxes, scoring silhouette overlap from the given cameras, stopping at
          0.9 or after {LOOP_BUDGET.toLocaleString("en-US")} renders. “Extracted” starts the main box within about 2% in
          size (the extraction toy gets 1 to 4%), and within 0.5 degrees in yaw and 0.3 m in position (my assumptions). This is the information flow of
          the author’s idea with a search in place of a model: it says nothing about how Claude behaves.
        </>
      }
    >
      <div className="space-y-4">
        {cams.map((n) => (
          <div key={n}>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              {n} camera{n > 1 ? "s" : ""}
            </div>
            <div className="space-y-1.5">
              {(["scratch", "extract"] as const).map((init) => {
                const c = LOOP.find((x) => x.cameras === n && x.init === init)
                if (!c) return null
                const v = value(c)
                return (
                  <div key={init} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">
                      {init === "scratch" ? "random start" : "extracted start"}
                    </span>
                    <div
                      className="relative h-4 flex-1 rounded-sm bg-muted/30"
                      role="img"
                      aria-label={`${init} start, ${n} cameras: ${text(c)}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{ width: `${Math.max(1, (v / max) * 100)}%`, background: init === "scratch" ? STREAM : GREEN, opacity: 0.8 }}
                      />
                    </div>
                    <span className="w-14 text-right font-mono text-xs text-foreground">{text(c)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground" style={{ color: metric === "iou3d" ? ACCENT : undefined }}>
        {metric === "iou3d"
          ? "A match in the pictures is not a match in space: with one camera the silhouettes can agree while the boxes do not."
          : metric === "reached"
            ? "Targets whose mean silhouette IoU reached 0.9 inside the budget."
            : "Median over the targets that reached 0.9; a bar at the right edge is the budget."}
      </p>
    </Frame>
  )
}
