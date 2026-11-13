"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

// One backbone, four tasks, read straight from iris_z/rgbd.py in the released
// SDK (commit 6c8925f). Every task builds the same sequence: text tokens, then
// an image grid, then a depth grid on the same (h, w) rotary positions, with the
// depth grid one step along the extra rotary "time" axis. What changes per task
// is only (1) which grids start as noise and which are given clean, (2) each
// grid's flow-matching time t, and (3) the learned modality id added to every
// token: 0 image, 1 depth, 2 given image, 3 given depth (modality_in, a 4-row
// embedding, the only new tensor in the checkpoint).
//
// The slider walks the sampler from t = 1 (pure noise) to t = 0. The SDK shifts
// its schedule towards high noise (get_schedule); it is drawn linearly here.

type Grid = { role: "noisy" | "clean" | "frozen-noise"; modality: number; tLabel: string; updated: boolean }
type Task = {
  id: string
  label: string
  fn: string
  text: string
  image: Grid
  depth: Grid
  steps: string
  note: string
}

const TASKS: Task[] = [
  {
    id: "rgbd",
    label: "prompt → image + depth",
    fn: "sample_joint",
    text: "prompt (with guidance)",
    image: { role: "noisy", modality: 0, tLabel: "t", updated: true },
    depth: { role: "noisy", modality: 1, tLabel: "t (same)", updated: true },
    steps: "50 steps with classifier-free guidance",
    note: "Both grids are denoised together at one shared t, so every attention layer lets the picture and its depth agree. The SDK's text_to_rgbd then throws the joint depth away by default and re-estimates it from the finished image (one more image → depth run), because that is sharper; joint_depth=True keeps it.",
  },
  {
    id: "depth",
    label: "image → depth",
    fn: "sample_depth",
    text: "empty prompt (both guidance branches identical, so 1 pass a step)",
    image: { role: "clean", modality: 2, tLabel: "0", updated: false },
    depth: { role: "noisy", modality: 1, tLabel: "t", updated: true },
    steps: "4 steps per seed; the benchmarks use 10 seeds = 40 passes",
    note: "The photo goes in clean with t = 0 and the 'given image' id. Only the depth tokens move. Each seed's answer is the average of its last two clean-depth estimates; seeds are aligned to the first by a least-squares scale and shift in log space and reduced by a per-pixel median.",
  },
  {
    id: "paint",
    label: "depth → image",
    fn: "sample_rgb_from_depth",
    text: "prompt (optional)",
    image: { role: "noisy", modality: 0, tLabel: "t", updated: true },
    depth: { role: "clean", modality: 3, tLabel: "0", updated: false },
    steps: "50 steps from one seed",
    note: "The mirror image of depth estimation: the depth map is given clean with the 'given depth' id and the picture is painted onto it. Holes in the given depth are filled with the nearest measured value first.",
  },
  {
    id: "rgb",
    label: "prompt → image",
    fn: "sample_rgb",
    text: "prompt (with guidance)",
    image: { role: "noisy", modality: 0, tLabel: "t", updated: true },
    depth: { role: "frozen-noise", modality: 1, tLabel: "1 (stays noise)", updated: false },
    steps: "50 steps with classifier-free guidance",
    note: "Plain text-to-image still carries the depth grid: it sits in the sequence as pure noise at t = 1 and is never updated. That is how training kept the base model's image skill, and it means every image pass attends over twice the image tokens the base model would.",
  },
]

// a 6 x 4 "scene": sky, wall, floor; and its depth (near = red, far = blue)
const GW = 6
const GH = 4
const IMG = ["#9cc3e6", "#9cc3e6", "#b9a27c", "#b9a27c", "#9cc3e6", "#9cc3e6",
  "#d8cfc0", "#d8cfc0", "#7a5c3e", "#7a5c3e", "#d8cfc0", "#d8cfc0",
  "#c9b79a", "#c9b79a", "#7a5c3e", "#7a5c3e", "#c9b79a", "#c9b79a",
  "#a88b62", "#a88b62", "#a88b62", "#a88b62", "#a88b62", "#a88b62"]
const DEP = ["#1f2a44", "#1f2a44", "#3b6fd8", "#3b6fd8", "#1f2a44", "#1f2a44",
  "#3fa8c9", "#3fa8c9", "#e8a33a", "#e8a33a", "#3fa8c9", "#3fa8c9",
  "#9bd06a", "#9bd06a", "#e8a33a", "#e8a33a", "#9bd06a", "#9bd06a",
  "#e2552f", "#e2552f", "#e2552f", "#e2552f", "#e2552f", "#e2552f"]

function noiseShade(i: number, salt: number): string {
  const v = Math.imul(i * 7 + salt * 131 + 17, 2654435761) >>> 24
  return `rgb(${v},${v},${v})`
}

function GridView({ colours, grid, tNow, salt, title }: { colours: string[]; grid: Grid; tNow: number; salt: number; title: string }) {
  const level = grid.role === "clean" ? 0 : grid.role === "frozen-noise" ? 1 : tNow
  const cell = 16
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${GW * cell} ${GH * cell}`} className="w-full max-w-[150px]" role="img" aria-label={`${title}: ${grid.role}`}>
        {colours.map((c, i) => (
          <g key={i}>
            <rect x={(i % GW) * cell} y={Math.floor(i / GW) * cell} width={cell - 1} height={cell - 1} fill={c} />
            <rect
              x={(i % GW) * cell}
              y={Math.floor(i / GW) * cell}
              width={cell - 1}
              height={cell - 1}
              fill={noiseShade(i, salt + Math.round(tNow * 8))}
              opacity={level}
            />
          </g>
        ))}
      </svg>
      <span className="font-mono text-[10px] text-muted-foreground">{title}</span>
    </div>
  )
}

export function TaskSwitcher() {
  const [taskId, setTaskId] = useState("rgbd")
  const [progress, setProgress] = useState(0)
  const task = TASKS.find((t) => t.id === taskId) ?? TASKS[0]
  const tNow = 1 - progress / 10

  const row = (name: string, g: Grid) => (
    <tr className="border-t">
      <td className="py-1 pr-3 text-foreground">{name}</td>
      <td className="py-1 pr-3">{g.role === "clean" ? "clean" : g.role === "frozen-noise" ? "pure noise" : "noisy"}</td>
      <td className="py-1 pr-3 tabular-nums">{g.modality}</td>
      <td className="py-1 pr-3">{g.tLabel}</td>
      <td className="py-1">{g.updated ? "yes" : "no"}</td>
    </tr>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one sequence, four tasks &middot; iris_z/rgbd.py</span>
        <span className="font-mono text-[10px] text-muted-foreground">{task.fn}()</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" onKeyDown={tablistKeys()} aria-label="task">
          {TASKS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === taskId}
              tabIndex={t.id === taskId ? 0 : -1}
              onClick={() => {
                setTaskId(t.id)
                setProgress(0)
              }}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                t.id === taskId
                  ? "border-foreground/30 bg-muted/60 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-stretch gap-2 font-mono text-[10px]">
          <div className="flex min-w-[120px] flex-1 items-center justify-center rounded-md border bg-muted/30 px-2 py-3 text-center text-muted-foreground">
            text tokens
            <br />
            {task.text}
          </div>
          <div className="flex flex-[2] items-center justify-center gap-3 rounded-md border px-2 py-2">
            <GridView colours={IMG} grid={task.image} tNow={tNow} salt={1} title="image grid · rope t=0" />
            <GridView colours={DEP} grid={task.depth} tNow={tNow} salt={2} title="depth grid · rope t=1" />
          </div>
        </div>

        <label className="flex items-center gap-3">
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">denoising</span>
          <Range min={0} max={10} step={1} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="grow" aria-label="denoising progress" />
          <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">t = {tNow.toFixed(1)}</span>
        </label>

        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px] text-muted-foreground">
            <thead>
              <tr className="text-left">
                <th className="pb-1 pr-3 font-normal">grid</th>
                <th className="pb-1 pr-3 font-normal">starts as</th>
                <th className="pb-1 pr-3 font-normal">modality id</th>
                <th className="pb-1 pr-3 font-normal">its time t</th>
                <th className="pb-1 font-normal">updated each step</th>
              </tr>
            </thead>
            <tbody>
              {row("image", task.image)}
              {row("depth", task.depth)}
            </tbody>
          </table>
        </div>

        <p className="text-[12px] leading-snug text-muted-foreground">
          <span className="text-foreground">{task.steps}.</span> {task.note}
        </p>
      </div>
    </figure>
  )
}
