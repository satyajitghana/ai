"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Task completion on a real bimanual YAM workcell, five methods, three
// conditions. Every number is the project page's own table.
//
// The condition switch is the point. In distribution, Flex-pi's full joint mode
// leads by 25 points and the action-only mode still leads by 18 — good, not
// startling. Move to the out-of-distribution setting — novel distractors filling
// the workspace, object types the policy never handled — and the baselines fall
// off a cliff while Flex-pi barely moves: -2.5% for full joint against -37.5%
// for pi-0.5 and -27.5% for ManiFlow, which has 3D inputs of its own.
//
// The half-data column is the one I would show a skeptic. Flex-pi trained on 50%
// of the demonstrations, in action-only mode, matches pi-0.5 trained on all of
// them; in joint mode it beats every baseline's full-data score.
//
// Fast-WAM was not run on Self-Repair Gripper or Soft-Bag Zipping, so its
// averages cover 3 of 5 in-distribution tasks and 2 of 3 out-of-distribution
// conditions — shown as a gap rather than a zero.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const METHODS = [
  { key: "joint", label: "Flex-π (full joint)", color: GOOD },
  { key: "action", label: "Flex-π (action-only)", color: ACCENT },
  { key: "maniflow", label: "ManiFlow 3D", color: MUTED },
  { key: "pi05", label: "π₀.₅ VLA", color: MUTED },
  { key: "fastwam", label: "Fast-WAM", color: MUTED },
] as const

type Row = { task: string; joint: number; action: number; maniflow: number; pi05: number; fastwam: number | null }

const CONDITIONS: { key: string; label: string; sub: string; rows: Row[]; avg: Row }[] = [
  {
    key: "id",
    label: "in distribution",
    sub: "the five tasks the policy was fine-tuned on",
    rows: [
      { task: "Put Plate on the Rack", joint: 95.0, action: 84.2, maniflow: 75.8, pi05: 72.5, fastwam: 12.5 },
      { task: "Sort Utensils", joint: 75.0, action: 70.0, maniflow: 55.0, pi05: 45.0, fastwam: 5.0 },
      { task: "Kitchen Organization", joint: 98.8, action: 96.2, maniflow: 93.8, pi05: 73.8, fastwam: 77.5 },
      { task: "Self-Repair Gripper", joint: 76.0, action: 66.9, maniflow: 33.3, pi05: 26.2, fastwam: null },
      { task: "Soft-Bag Zipping", joint: 70.0, action: 64.9, maniflow: 31.9, pi05: 42.8, fastwam: null },
    ],
    avg: { task: "average", joint: 83.0, action: 76.4, maniflow: 58.0, pi05: 52.1, fastwam: 31.7 },
  },
  {
    key: "ood",
    label: "out of distribution",
    sub: "novel distractors, object types the policy never handled",
    rows: [
      { task: "Put Plate on the Rack", joint: 95.0, action: 85.0, maniflow: 55.0, pi05: 72.5, fastwam: 33.8 },
      { task: "Sort Utensils", joint: 70.0, action: 70.0, maniflow: 32.5, pi05: 40.0, fastwam: 0.0 },
      { task: "Soft-Bag Zipping", joint: 63.3, action: 57.5, maniflow: 6.9, pi05: 17.2, fastwam: null },
    ],
    avg: { task: "average", joint: 76.1, action: 70.8, maniflow: 31.5, pi05: 43.2, fastwam: 16.9 },
  },
  {
    key: "half",
    label: "half the data",
    sub: "trained on 50% of the demonstrations",
    rows: [{ task: "Put Plate on the Rack", joint: 95.0, action: 80.0, maniflow: 60.0, pi05: 42.5, fastwam: 25.0 }],
    avg: { task: "Put Plate on the Rack", joint: 95.0, action: 80.0, maniflow: 60.0, pi05: 42.5, fastwam: 25.0 },
  },
]

// The relative drop each method takes moving out of distribution.
const DROPS = [
  { l: "Flex-π (full joint)", v: -2.5, c: GOOD },
  { l: "Flex-π (action-only)", v: -10.0, c: ACCENT },
  { l: "Fast-WAM", v: -12.5, c: MUTED },
  { l: "ManiFlow 3D", v: -27.5, c: MUTED },
  { l: "π₀.₅ VLA", v: -37.5, c: WARM },
]

export function TaskLadder() {
  const [sel, setSel] = useState("ood")
  const c = CONDITIONS.find((x) => x.key === sel) ?? CONDITIONS[0]
  const rows = c.rows.length > 1 ? [...c.rows, c.avg] : c.rows

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          task completion % · bimanual YAM workcell · 20 rollouts per method
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {c.avg.joint.toFixed(1)}% vs {Math.max(c.avg.maniflow, c.avg.pi05, c.avg.fastwam ?? 0).toFixed(1)}%
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{c.sub}</div>

        <div className="mt-3 space-y-2.5">
          {rows.map((r, i) => (
            <div key={r.task + i} className={cn(i === rows.length - 1 && rows.length > 1 && "rounded-md bg-muted/30 p-1.5")}>
              <div className="font-mono text-[10px] text-foreground">{r.task}</div>
              <div className="mt-1 space-y-[3px]">
                {METHODS.map((m, j) => {
                  const v = r[m.key] as number | null
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <span className="hidden w-36 shrink-0 truncate text-right font-mono text-[9px] text-muted-foreground sm:inline">
                        {m.label}
                      </span>
                      <div className="h-[9px] flex-1 rounded-sm bg-muted/30">
                        {v == null ? null : (
                          <div
                            className="h-[9px] rounded-sm"
                            style={{ width: `${v}%`, background: m.color, opacity: j < 2 ? 1 : 0.5 - j * 0.04 }}
                            title={`${m.label}: ${v}%`}
                          />
                        )}
                      </div>
                      <span className="w-12 shrink-0 text-right font-mono text-[9px] tabular-nums" style={{ color: j < 2 ? m.color : "inherit" }}>
                        {v == null ? "not run" : v.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {sel === "ood" ? (
          <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              what leaving the training distribution costs each method
            </div>
            <div className="mt-2 space-y-1">
              {DROPS.map((d) => (
                <div key={d.l} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{d.l}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${(-d.v / 40) * 100}%`, background: d.c, opacity: 0.85 }} />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: d.c }}>
                    {d.v.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          In distribution these are good numbers and not a revelation. Switch to{" "}
          <em>out of distribution</em>{" "}— clutter the workspace with objects the policy has never handled — and
          the table changes character.{" "}
          <span className="text-foreground">π₀.₅ loses 37.5% of its performance and Flex-π loses 2.5%</span>, and
          ManiFlow, which has explicit 3D inputs of its own, loses 27.5%. On the unseen soft bag the gap is
          absurd: 63.3% against 6.9%.
          <br />
          <br />
          Then look at the half-data condition, which is one task but the most economically loaded number here.
          Flex-π on <em>half</em>{" "}the demonstrations, running action-only, scores 80.0% — nearly double
          π₀.₅&rsquo;s 42.5% on the full set. Demonstration collection is the binding constraint in real robot
          learning, and a method that gets more out of each episode is worth more than one that is faster.
        </p>
      </div>
    </figure>
  )
}
