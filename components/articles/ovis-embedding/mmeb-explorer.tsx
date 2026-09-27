"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MMEB-v3, group by group and sub-task by sub-task. The five models in the
// paper's Table 1 use the paper's printed numbers (they match the official
// leaderboard's raw score files to ±0.01, which I recomputed). The two rows
// the paper leaves out, WeMM-Embedding-9B and AuroLA-Omni-7B, are my own
// recomputation from those same files at the leaderboard space's commit
// 8129607 (16 Sep 2026), with the leaderboard's rule that a task a model
// cannot run counts as zero.

type Group = "all" | "image" | "video" | "visdoc" | "text" | "audio" | "agent"

const GROUPS: { k: Group; label: string; tasks: number; metric: string; subs: string[] }[] = [
  { k: "all", label: "Overall", tasks: 190, metric: "mean over all 190 tasks", subs: [] },
  { k: "image", label: "Image", tasks: 37, metric: "Hit@1", subs: ["I-CLS", "I-QA", "I-RET", "I-VG"] },
  { k: "video", label: "Video", tasks: 18, metric: "Hit@1", subs: ["V-CLS", "V-QA", "V-RET", "V-MRET"] },
  { k: "visdoc", label: "VisDoc", tasks: 24, metric: "nDCG@5", subs: ["ViDoRe-V1", "ViDoRe-V2", "VisRAG", "VisDoc-OOD"] },
  {
    k: "text",
    label: "Text",
    tasks: 53,
    metric: "nDCG@5",
    subs: ["FollowIR", "R2MED", "InfoSearch", "BRIGHT", "LongEmbed", "MultiConIR", "NanoBEIR"],
  },
  { k: "audio", label: "Audio", tasks: 11, metric: "Hit@1", subs: ["A-CLS", "A-RET"] },
  { k: "agent", label: "Agent", tasks: 47, metric: "Hit@1", subs: ["Tool", "GUI", "Memory"] },
]

type Row = {
  name: string
  size: string
  source: "paper" | "recomputed"
  note?: string
  // group score, then its sub-tasks in GROUPS order
  s: Record<Group, number[]>
}

const ROWS: Row[] = [
  {
    name: "Ovis-Embedding-Omni-3B",
    size: "3B",
    source: "paper",
    s: {
      all: [58.46],
      image: [77.55, 76.83, 77.7, 72.86, 94.17],
      video: [64.99, 80.26, 67.73, 52.05, 56.57],
      visdoc: [78.26, 86.67, 56.22, 85.81, 67.94],
      text: [47.15, 53.96, 25.68, 75.08, 15.66, 64.0, 61.73, 61.59],
      audio: [50.08, 73.3, 30.73],
      agent: [45.52, 47.56, 44.59, 29.44],
    },
  },
  {
    name: "Tianmu-Emb-Uni",
    size: "8B",
    source: "paper",
    note: "self-reported to the leaderboard",
    s: {
      all: [53.27],
      image: [73.83, 65.99, 78.0, 72.35, 87.8],
      video: [59.37, 66.95, 67.51, 50.21, 48.43],
      visdoc: [72.03, 83.69, 53.19, 83.5, 44.49],
      text: [43.62, 39.03, 28.09, 51.2, 15.7, 58.49, 63.42, 62.05],
      audio: [38.94, 69.33, 13.62],
      agent: [39.42, 42.21, 35.64, 22.58],
    },
  },
  {
    name: "e5-omni-7B",
    size: "7B",
    source: "paper",
    note: "reproduced by TIGER-Lab",
    s: {
      all: [47.14],
      image: [70.5, 68.19, 70.3, 69.65, 79.55],
      video: [50.83, 53.86, 65.89, 40.5, 37.88],
      visdoc: [75.37, 87.33, 58.33, 87.6, 44.19],
      text: [26.93, 26.41, 18.95, 49.9, 7.3, 9.71, 56.93, 35.88],
      audio: [43.04, 63.0, 26.41],
      agent: [36.67, 37.45, 37.96, 27.29],
    },
  },
  {
    name: "Omni-Embed-Nemotron-3B",
    size: "3B",
    source: "paper",
    note: "reproduced by TIGER-Lab",
    s: {
      all: [43.6],
      image: [43.42, 48.31, 19.9, 56.06, 48.9],
      video: [41.36, 48.31, 47.81, 38.68, 23.5],
      visdoc: [72.27, 84.76, 51.57, 85.39, 42.04],
      text: [39.23, 31.74, 17.76, 48.37, 13.6, 50.03, 69.67, 56.92],
      audio: [36.52, 53.69, 22.21],
      agent: [36.53, 38.05, 32.04, 32.23],
    },
  },
  {
    name: "LCO-Embedding-Omni-7B",
    size: "7B",
    source: "paper",
    note: "reproduced by TIGER-Lab",
    s: {
      all: [43.14],
      image: [56.27, 57.97, 51.83, 53.88, 70.9],
      video: [53.03, 58.11, 62.36, 42.23, 46.99],
      visdoc: [69.19, 80.08, 54.14, 79.55, 41.47],
      text: [32.4, 37.39, 12.27, 59.25, 7.62, 12.57, 61.36, 52.12],
      audio: [43.17, 64.33, 25.53],
      agent: [27.84, 29.05, 24.98, 22.98],
    },
  },
  {
    name: "WeMM-Embedding-9B",
    size: "9.41B",
    source: "recomputed",
    note: "self-reported; no audio, so its 11 audio tasks count as 0",
    s: {
      all: [59.33],
      image: [80.99, 76.21, 82.22, 79.21, 95.62],
      video: [74.31, 87.36, 77.69, 67.38, 58.46],
      visdoc: [83.34, 90.65, 65.19, 90.93, 71.84],
      text: [48.76, 33.38, 38.16, 62.48, 27.6, 64.48, 58.28, 61.12],
      audio: [0, 0, 0],
      agent: [50.1, 52.95, 43.33, 38.65],
    },
  },
  {
    name: "AuroLA-Omni-7B",
    size: "7B",
    source: "recomputed",
    note: "self-reported",
    s: {
      all: [48.19],
      image: [66.32, 66.29, 62.35, 64.95, 80.75],
      video: [52.0, 54.53, 61.16, 44.41, 45.14],
      visdoc: [69.72, 80.11, 53.15, 81.6, 42.5],
      text: [36.54, 39.15, 25.17, 47.3, 14.99, 17.56, 60.0, 57.58],
      audio: [50.49, 71.07, 33.34],
      agent: [34.06, 33.56, 39.17, 28.23],
    },
  },
]

const OVIS = "oklch(0.62 0.16 255)"
const PAPER = "oklch(0.62 0.03 260)"
const EXTRA = "oklch(0.68 0.15 45)"
const SHARE = ["oklch(0.7 0.14 75)", "oklch(0.64 0.15 150)", "oklch(0.6 0.12 300)", "oklch(0.62 0.13 250)", "oklch(0.63 0.17 20)", "oklch(0.55 0.05 200)"]

function colourFor(r: Row) {
  if (r.name.startsWith("Ovis")) return OVIS
  return r.source === "paper" ? PAPER : EXTRA
}

export function MmebExplorer() {
  const [g, setG] = useState<Group>("all")
  const [extra, setExtra] = useState(false)

  const group = GROUPS.find((x) => x.k === g) ?? GROUPS[0]
  const rows = ROWS.filter((r) => extra || r.source === "paper")
  const ranked = [...rows].sort((a, b) => b.s[g][0] - a.s[g][0])
  const max = 100

  const parts = GROUPS.filter((x) => x.k !== "all")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">MMEB-v3, group by group</span>
        <button
          type="button"
          onClick={() => setExtra((v) => !v)}
          aria-pressed={extra}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            extra ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {extra ? "showing" : "show"} the two leaderboard rows the paper leaves out
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="font-mono text-[10px] text-muted-foreground">what the overall score is made of: tasks per group, out of 190</div>
        <div className="mt-1 flex h-5 overflow-hidden rounded-md border">
          {parts.map((p, i) => (
            <button
              key={p.k}
              type="button"
              onClick={() => setG(p.k)}
              title={`${p.label}: ${p.tasks} tasks`}
              className="cursor-pointer text-center font-mono text-[9px] leading-5 text-white/90"
              style={{ width: `${((p.tasks / 190) * 100).toFixed(2)}%`, background: SHARE[i], opacity: g === p.k || g === "all" ? 1 : 0.45 }}
            >
              {p.tasks}
            </button>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[9.5px] text-muted-foreground">
          {parts.map((p, i) => (
            <span key={p.k} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: SHARE[i] }} />
              {p.label} {((p.tasks / 190) * 100).toFixed(1)}%
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {GROUPS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setG(x.k)}
              aria-pressed={g === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                g === x.k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label} · {x.tasks}
            </button>
          ))}
        </div>

        <div className="mt-3 font-mono text-[10px] text-muted-foreground">
          {group.label}: {group.metric}
          {g === "all" ? "" : `, ${group.tasks} tasks`}, ×100
        </div>
        <div className="mt-1.5 space-y-1">
          {ranked.map((r) => (
            <div key={r.name} className="flex items-center gap-2">
              <span
                className={cn(
                  "w-44 shrink-0 truncate font-mono text-[10px]",
                  r.name.startsWith("Ovis") ? "text-foreground" : "text-muted-foreground",
                )}
                title={r.note}
              >
                {r.name} <span className="opacity-60">{r.size}</span>
              </span>
              <div className="relative h-3.5 flex-1 rounded-sm bg-muted/40">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${((r.s[g][0] / max) * 100).toFixed(2)}%`, background: colourFor(r) }}
                />
              </div>
              <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {r.s[g][0].toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {group.subs.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {group.subs.map((sub, si) => {
              const vals = rows.map((r) => ({ r, v: r.s[g][si + 1] }))
              const best = Math.max(...vals.map((x) => x.v))
              return (
                <div key={sub} className="rounded-lg border bg-muted/10 px-3 py-2">
                  <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>
                  <div className="mt-1 space-y-0.5">
                    {vals.map(({ r, v }) => (
                      <div key={r.name} className="flex items-center gap-1.5">
                        <div className="relative h-2 flex-1 rounded-sm bg-muted/40">
                          <div
                            className="absolute inset-y-0 left-0 rounded-sm"
                            style={{ width: `${v.toFixed(2)}%`, background: colourFor(r), opacity: v === best ? 1 : 0.6 }}
                          />
                        </div>
                        <span
                          className={cn(
                            "w-10 shrink-0 text-right font-mono text-[9.5px] tabular-nums",
                            v === best ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {v.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: OVIS }} /> Ovis, paper Table 1 (reported)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: PAPER }} /> the paper&apos;s baselines, Table 1
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: EXTRA }} /> recomputed from the leaderboard files (measured)
          </span>
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        Among the paper&apos;s own five, Ovis leads every group, by the most on audio and agent. The
        strip above the bars is why &ldquo;omni&rdquo; is a loose word for this benchmark: text and
        agent retrieval are 100 of the 190 tasks, audio is 11. Add the two rows the paper did not
        compare against and the picture changes at both ends: a 9B vision-language model with no
        audio at all tops the overall score, and a 7B omni model edges Ovis on audio.
      </p>
    </figure>
  )
}
