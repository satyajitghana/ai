"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// MobilePA-Bench, Table 1 of the Qwen-Planner-Agent report: four capability
// scores per system, copied digit for digit (they also ship in the project
// page's blog-data JSON). Overall is the benchmark's fixed weighting,
// 0.50 Tool Use + 0.20 Memory + 0.20 Skills + 0.10 Sub-agent (MobilePA-Bench
// paper, Eq. 12). Recomputing Overall from the four columns reproduces the
// published Overall for every row to within 0.01.
//
// The widget lets the reader move the weights. The ranking is a property of
// the weights as much as of the models: the published lead is 0.21 points.
// Only + - * / are used, so server and client render identical numbers.

type Row = { model: string; tool: number; mem: number; skill: number; sub: number; ours?: boolean }

const ROWS: Row[] = [
  { model: "Qwen-Planner-Agent 27B", tool: 77.79, mem: 74.76, skill: 86.25, sub: 59.55, ours: true },
  { model: "GPT 6 Astra", tool: 75.71, mem: 74.73, skill: 93.25, sub: 53.93 },
  { model: "Claude Opus 5", tool: 77.6, mem: 71.81, skill: 83.0, sub: 59.55 },
  { model: "Claude Fable 5", tool: 77.21, mem: 76.33, skill: 69.0, sub: 68.54 },
  { model: "GLM 5.3", tool: 76.44, mem: 72.07, skill: 77.0, sub: 58.43 },
  { model: "Qwen-Planner-Model 27B", tool: 72.79, mem: 70.74, skill: 79.25, sub: 55.06, ours: true },
  { model: "Qwen 3.8 Max", tool: 73.65, mem: 73.14, skill: 75.75, sub: 51.69 },
  { model: "Qwen-Planner-Agent 35B-A3B", tool: 71.25, mem: 67.02, skill: 78.0, sub: 52.81, ours: true },
  { model: "Kimi K3", tool: 71.54, mem: 71.01, skill: 74.75, sub: 47.19 },
  { model: "Gemini 3.6 Flash", tool: 74.71, mem: 69.68, skill: 65.75, sub: 51.69 },
  { model: "GLM 5.3 Flash", tool: 71.35, mem: 65.16, skill: 68.25, sub: 59.55 },
  { model: "Gemini 3.1 Pro", tool: 75.38, mem: 65.69, skill: 55.75, sub: 61.8 },
  { model: "Qwen Baseline 27B", tool: 68.37, mem: 67.82, skill: 73.75, sub: 47.19, ours: true },
  { model: "GLM 5.2", tool: 73.75, mem: 60.37, skill: 58.0, sub: 55.06 },
  { model: "Claude Opus 4.8", tool: 72.4, mem: 56.38, skill: 69.25, sub: 47.19 },
  { model: "Seed 2.1 Pro", tool: 70.29, mem: 57.18, skill: 64.0, sub: 55.06 },
  { model: "Qwen 3.7 Max", tool: 72.31, mem: 64.1, skill: 53.75, sub: 51.69 },
]

type W = { tool: number; mem: number; skill: number; sub: number }

const PRESETS: { label: string; w: W }[] = [
  { label: "official 50/20/20/10", w: { tool: 50, mem: 20, skill: 20, sub: 10 } },
  { label: "equal", w: { tool: 25, mem: 25, skill: 25, sub: 25 } },
  { label: "by task count", w: { tool: 61, mem: 22.1, skill: 11.7, sub: 5.2 } },
  { label: "Skills +3", w: { tool: 47, mem: 20, skill: 23, sub: 10 } },
  { label: "Sub-agent 40", w: { tool: 30, mem: 15, skill: 15, sub: 40 } },
]

const AXES: { key: keyof W; label: string }[] = [
  { key: "tool", label: "Tool Use" },
  { key: "mem", label: "Memory" },
  { key: "skill", label: "Skills" },
  { key: "sub", label: "Sub-agent" },
]

const OURS = "oklch(0.58 0.16 290)"
const OTHER = "oklch(0.62 0.04 250)"

function score(r: Row, w: W): number {
  const t = w.tool + w.mem + w.skill + w.sub
  if (t === 0) return 0
  return (r.tool * w.tool + r.mem * w.mem + r.skill * w.skill + r.sub * w.sub) / t
}

export function WeightExplorer() {
  const [w, setW] = useState<W>(PRESETS[0].w)

  const ranked = useMemo(
    () => ROWS.map((r) => ({ r, s: score(r, w) })).sort((a, b) => b.s - a.s),
    [w],
  )
  const total = w.tool + w.mem + w.skill + w.sub
  const top = ranked[0]
  const gap = ranked.length > 1 ? top.s - ranked[1].s : 0
  const lo = 50
  const hi = 90
  const pct = (s: number) => Math.max(0, Math.min(100, ((s - lo) / (hi - lo)) * 100))

  // Each slider is a relative weight (0-100); the share shown next to it is
  // that weight over the sum, which is what the score actually uses. Presets
  // sum to 100, so for them weight and share coincide.
  const share = (k: keyof W) => (total === 0 ? 0 : (w[k] / total) * 100)
  const setAxis = (k: keyof W, v: number) => setW({ ...w, [k]: v })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">MobilePA-Bench · report Table 1 · reweighted</span>
        <span className="font-mono text-[10px] text-muted-foreground">scores reported; weights yours</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const on =
              p.w.tool === w.tool && p.w.mem === w.mem && p.w.skill === w.skill && p.w.sub === w.sub
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setW(p.w)}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  on
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {AXES.map((a) => (
            <label key={a.key} className="block">
              <span className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>{a.label}</span>
                <span className="tabular-nums text-foreground">{share(a.key).toFixed(1)}%</span>
              </span>
              <Range
                min={0}
                max={100}
                step={0.1}
                value={w[a.key]}
                onChange={(e) => setAxis(a.key, +e.target.value)}
                className="w-full"
                aria-label={`${a.label} weight`}
                accent={OURS}
              />
            </label>
          ))}
        </div>

        <div className="mt-4 space-y-1">
          {ranked.slice(0, 8).map(({ r, s }, k) => (
            <div key={r.model} className="grid grid-cols-[1.5rem_minmax(0,11rem)_1fr_3.5rem] items-center gap-2 font-mono text-[11px]">
              <span className="text-right text-muted-foreground tabular-nums">{k + 1}</span>
              <span className="truncate" style={{ color: r.ours ? OURS : undefined }} title={r.model}>
                {r.model}
              </span>
              <span className="h-2.5 rounded-sm bg-muted/40">
                <span
                  className="block h-2.5 rounded-sm"
                  style={{ width: `${pct(s).toFixed(1)}%`, background: r.ours ? OURS : OTHER }}
                />
              </span>
              <span className="text-right tabular-nums text-foreground">{s.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">bars span 50 to 90 · top 8 of 17 rows</p>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Leader under these weights:{" "}
          <span className="text-foreground" style={{ color: top.r.ours ? OURS : undefined }}>
            {top.r.model}
          </span>
          , by <span className="tabular-nums text-foreground">{gap.toFixed(2)}</span> points. The official
          weighting puts Qwen-Planner-Agent 27B first by 0.21. Move a little over two points of weight from
          Tool Use to Skills and GPT 6 Astra takes first place; give Sub-agent a large share and Claude
          Fable 5 does. The purple rows are the Qwen checkpoints, with and without the Harness.
        </p>
      </div>
    </figure>
  )
}
