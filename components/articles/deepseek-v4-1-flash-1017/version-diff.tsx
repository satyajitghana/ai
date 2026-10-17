"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 11 rows of the DeepSeek-V4.1-Flash-1017 model card's comparison table,
// transcribed verbatim (reported, not re-run). "old" is the card's own
// DS-V4.1-Flash column. HLE for GLM-5.3 is the text-only subset (marked † on
// the card), so it is compared with 1017's text-only 44.0, not 42.6.
// The cost points are read by eye off DeepSeek's DeepSWE v1.1 Pass@1 vs cost
// chart (log x-axis), so they are approximate. Arithmetic is + - only.

type Row = {
  name: string
  old: number
  now: number
  k3: number
  glm: number | null
  sol: number
  opus: number
  note?: string
}

const ROWS: Row[] = [
  { name: "HLE w/o tools", old: 36.8, now: 42.6, k3: 43.5, glm: 42.0, sol: 44.5, opus: 56.3, note: "text-only: 44.0 vs 39.1" },
  { name: "Terminal-Bench 4.0", old: 31.2, now: 42.3, k3: 12.6, glm: 37.9, sol: 39.9, opus: 51.8, note: "1017 run in Claude Code" },
  { name: "DeepSWE v1.1", old: 74.2, now: 77.0, k3: 67.5, glm: 66.9, sol: 73.0, opus: 74.0 },
  { name: "ProgramBench", old: 20.3, now: 29.1, k3: 17.5, glm: 19.0, sol: 23.0, opus: 37.0 },
  { name: "NL2Repo-Bench", old: 65.4, now: 68.2, k3: 58.0, glm: 58.0, sol: 56.8, opus: 75.3, note: "old card said 64.0" },
  { name: "Automation-Bench v1.0.6", old: 54.8, now: 60.5, k3: 46.7, glm: 48.8, sol: 45.8, opus: 50.3 },
  { name: "Agents' Last Exam", old: 31.8, now: 35.4, k3: 27.6, glm: 28.5, sol: 26.7, opus: 28.6 },
  { name: "Apex Bench v1.1", old: 64.6, now: 72.1, k3: 47.8, glm: 56.6, sol: 54.3, opus: 65.8, note: "not on the old card" },
  { name: "Chartography (w/ tools)", old: 78.9, now: 83.0, k3: 68.1, glm: null, sol: 79.9, opus: 84.0 },
  { name: "BabyVision (w/ tools)", old: 89.6, now: 92.5, k3: 85.7, glm: null, sol: 88.9, opus: 94.1 },
  { name: "ZeroBench-main (w/ tools)", old: 49.0, now: 51.0, k3: 41.0, glm: null, sol: 53.0, opus: 52.0, note: "Pass@5" },
]

const DROPPED = [
  "GPQA Diamond 90.9",
  "Codeforces 3471",
  "MathArena Apex 65.6",
  "Terminal-Bench 2.1 90.6",
  "Terminal-Bench 3.0 30.0",
  "CyberGym 88.1",
  "SEC-Bench Pro 62.8",
  "ExploitGym 15.3",
  "HLE w/ tools 63.9",
]

// approximate, read off the chart: [effort, cost per task USD, Pass@1 %]
const COST = {
  old: [
    ["low", 0.22, 67.4],
    ["high", 0.29, 70.2],
    ["max", 0.49, 74.2],
  ],
  now: [
    ["low", 0.11, 72.6],
    ["high", 0.15, 73.0],
    ["max", 0.2, 77.0],
  ],
} as const

type Rival = "old" | "opus" | "sol" | "glm" | "k3"
const RIVALS: { id: Rival; label: string }[] = [
  { id: "old", label: "V4.1-Flash (Sept)" },
  { id: "opus", label: "Opus 5" },
  { id: "sol", label: "GPT-5.6 Sol" },
  { id: "glm", label: "GLM-5.3" },
  { id: "k3", label: "K3" },
]

function rivalScore(r: Row, rival: Rival): number | null {
  if (rival === "glm" && r.name === "HLE w/o tools") return 42.0
  return r[rival]
}
function mine(r: Row, rival: Rival): number {
  // like-for-like on HLE when the rival only reports the text-only subset
  if (rival === "glm" && r.name === "HLE w/o tools") return 44.0
  return r.now
}

type Sort = "delta" | "card"

export function VersionDiff() {
  const [rival, setRival] = useState<Rival>("old")
  const [sort, setSort] = useState<Sort>("delta")
  const [view, setView] = useState<"scores" | "cost">("scores")

  const rows = ROWS.map((r, i) => {
    const them = rivalScore(r, rival)
    const me = mine(r, rival)
    return { r, i, them, me, d: them === null ? null : me - them }
  })
  if (sort === "delta") rows.sort((a, b) => (b.d ?? -999) - (a.d ?? -999))

  const scored = rows.filter((x) => x.d !== null)
  const wins = scored.filter((x) => (x.d as number) > 0).length
  const losses = scored.filter((x) => (x.d as number) < 0).length
  const maxAbs = Math.max(...scored.map((x) => Math.abs(x.d as number)), 1)
  const label = RIVALS.find((x) => x.id === rival)?.label ?? ""

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        DeepSeek-V4.1-Flash-1017 · the model card&apos;s 11 rows · reported, not re-run
      </div>

      <div className="flex flex-wrap gap-2 border-b px-4 py-3 text-xs">
        {(["scores", "cost"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px]",
              view === v ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v === "scores" ? "benchmark deltas" : "DeepSWE cost per task"}
          </button>
        ))}
      </div>

      {view === "scores" ? (
        <>
          <div className="space-y-2 border-b px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 font-mono text-muted-foreground">1017 minus</span>
              {RIVALS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setRival(x.id)}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-[11px]",
                    rival === x.id ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 font-mono text-muted-foreground">sort</span>
              {(["delta", "card"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-[11px]",
                    sort === s ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {s === "delta" ? "by delta" : "card order"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 px-4 py-4">
            {rows.map(({ r, them, me, d }) => (
              <div key={r.name} className="grid grid-cols-[minmax(0,9.5rem)_1fr_3.5rem] items-center gap-2 text-xs sm:grid-cols-[12rem_1fr_4rem]">
                <div className="min-w-0">
                  <div className="truncate font-mono">{r.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {them === null ? "no score" : `${me.toFixed(1)} vs ${them.toFixed(1)}`}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <div className="relative h-3 rounded-sm bg-muted">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
                  {d !== null && (
                    <div
                      className="absolute inset-y-0 rounded-sm"
                      style={{
                        left: d >= 0 ? "50%" : `${(50 - (Math.abs(d) / maxAbs) * 50).toFixed(2)}%`,
                        width: `${((Math.abs(d) / maxAbs) * 50).toFixed(2)}%`,
                        background: d >= 0 ? "oklch(0.6 0.15 155)" : "oklch(0.6 0.17 30)",
                      }}
                    />
                  )}
                </div>
                <div className="text-right font-mono tabular-nums">
                  {d === null ? "n/a" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                </div>
              </div>
            ))}
          </div>

          <figcaption className="space-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <p>
              Against {label}: 1017 is ahead on {wins} of {scored.length} rows with a score and behind on{" "}
              {losses}. Points, not percent; each benchmark has its own scale, so the bars compare rows
              only loosely.
            </p>
            {rival === "old" && (
              <p>
                Rows the September card reported that the 1017 card leaves out: {DROPPED.join(" · ")}. Their
                1017 scores are not published anywhere I found.
              </p>
            )}
          </figcaption>
        </>
      ) : (
        <>
          <div className="space-y-3 px-4 py-4 text-xs">
            {(["old", "now"] as const).map((v) => (
              <div key={v}>
                <div className="mb-1 font-mono text-muted-foreground">
                  {v === "old" ? "V4.1-Flash (Sept)" : "V4.1-Flash-1017"}
                </div>
                {COST[v].map(([eff, usd, pass]) => (
                  <div key={eff} className="mb-1 grid grid-cols-[3rem_1fr_7.5rem] items-center gap-2">
                    <span className="font-mono">{eff}</span>
                    <div className="h-2.5 rounded-sm bg-muted">
                      <div
                        className="h-2.5 rounded-sm"
                        style={{
                          width: `${((usd / 0.5) * 100).toFixed(2)}%`,
                          background: v === "now" ? "oklch(0.55 0.16 260)" : "oklch(0.7 0.08 260)",
                        }}
                      />
                    </div>
                    <span className="text-right font-mono tabular-nums">
                      ~${usd.toFixed(2)} · {pass.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            Average cost per DeepSWE v1.1 task at each reasoning effort, read by eye off DeepSeek&apos;s
            log-scale chart, so treat the cents as approximate; only the two max-effort scores (74.2 and
            77.0) are printed numbers. Per-token prices did not change with the update, so a cheaper task
            means fewer tokens per task. DeepSeek publishes no token counts.
          </figcaption>
        </>
      )}
    </figure>
  )
}
