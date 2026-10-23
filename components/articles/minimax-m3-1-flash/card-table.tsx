"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 15 rows of the MiniMax-M3.1-Flash model card's comparison table,
// transcribed (reported, not re-run). null is the card's "—". `post` is what
// MiniMax's 19 October post or its table image says where that differs from the
// card. `ds` is what DeepSeek's own 1017 card printed for the same rival on the
// same benchmark, where it printed one and the numbers differ.

type Rival = "d1017" | "d41" | "k3" | "glm" | "sol" | "opus"
type Row = {
  name: string
  me: number
  r: Record<Rival, number | null>
  post?: string
  ds?: string
}

const ROWS: Row[] = [
  { name: "Automation-Bench v1.0.6", me: 62.8, r: { d1017: 60.5, d41: 54.8, k3: 46.7, glm: 48.8, sol: 45.8, opus: 50.3 }, post: "table image 62.2; text \"62%\"" },
  { name: "BankerToolBench", me: 76.2, r: { d1017: null, d41: 73.7, k3: 69.1, glm: 74.5, sol: 74.6, opus: 76.2 } },
  { name: "GDP.pdf AA", me: 20.8, r: { d1017: null, d41: 12.8, k3: 22.0, glm: 11.2, sol: 27.2, opus: 21.6 } },
  { name: "Terminal Bench 4.0", me: 38.1, r: { d1017: 42.3, d41: 31.2, k3: 12.6, glm: 37.9, sol: 39.9, opus: 51.8 } },
  { name: "LOCA-Bench 256K", me: 60.3, r: { d1017: null, d41: null, k3: 49.7, glm: 50.3, sol: 60.0, opus: 53.7 } },
  { name: "Agents' Last Exam", me: 29.6, r: { d1017: null, d41: null, k3: 28.3, glm: null, sol: 30.6, opus: 32.2 }, post: "text \"30%\"", ds: "DeepSeek's card: 1017 35.4, Opus 5 28.6, GPT-5.6 Sol 26.7" },
  { name: "OSWorld 2.0", me: 61.7, r: { d1017: null, d41: 54.3, k3: 58.3, glm: null, sol: 65.7, opus: 70.6 } },
  { name: "PostTrain Bench v1.1", me: 39.3, r: { d1017: null, d41: 30.5, k3: 36.6, glm: 37.5, sol: 36.2, opus: 40.4 } },
  { name: "DeepSWE v1.1", me: 73.7, r: { d1017: 77.0, d41: 74.2, k3: 67.5, glm: 66.9, sol: 73.0, opus: 74.0 }, post: "text \"74%\"" },
  { name: "NL2Repo-Bench", me: 61.2, r: { d1017: 68.2, d41: 65.4, k3: 58.0, glm: 58.0, sol: 56.8, opus: 75.3 } },
  { name: "SWE Refactor Bench", me: 23.0, r: { d1017: null, d41: 11.8, k3: 19.5, glm: 10.4, sol: 28.5, opus: 31.0 } },
  { name: "CyberGym", me: 82.2, r: { d1017: null, d41: null, k3: 80.0, glm: 84.5, sol: 83.6, opus: null } },
  { name: "BabyVision (with tools)", me: 91.0, r: { d1017: 92.5, d41: 89.6, k3: 85.7, glm: null, sol: 88.9, opus: 94.1 } },
  { name: "HLE (without tools)", me: 43.4, r: { d1017: 42.6, d41: 39.2, k3: 43.5, glm: 42.3, sol: 49.5, opus: 55.6 }, ds: "M3.1 row is the text-only subset; DeepSeek's card: 1017 text-only 44.0, Sol 44.5, Opus 5 56.3" },
  { name: "CharXiv RQ", me: 82.5, r: { d1017: null, d41: 69.0, k3: 84.8, glm: null, sol: 85.2, opus: 83.7 } },
]

const RIVALS: { id: Rival; label: string }[] = [
  { id: "d1017", label: "DeepSeek V4.1 Flash-1017" },
  { id: "d41", label: "DeepSeek V4.1 Flash" },
  { id: "k3", label: "Kimi K3" },
  { id: "glm", label: "GLM-5.3" },
  { id: "sol", label: "GPT-5.6 Sol" },
  { id: "opus", label: "Opus 5" },
]

export function CardTable() {
  const [rival, setRival] = useState<Rival>("d1017")
  const rows = ROWS.map((row) => {
    const them = row.r[rival]
    return { row, them, d: them === null ? null : row.me - them }
  })
  const scored = rows.filter((x) => x.d !== null)
  const wins = scored.filter((x) => (x.d as number) > 0).length
  const losses = scored.filter((x) => (x.d as number) < 0).length
  const ties = scored.length - wins - losses
  const maxAbs = Math.max(...scored.map((x) => Math.abs(x.d as number)), 1)
  const label = RIVALS.find((x) => x.id === rival)?.label ?? ""

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        MiniMax-M3.1-Flash · the model card&apos;s 15 rows · reported, not re-run
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-xs">
        <span className="shrink-0 font-mono text-muted-foreground">M3.1-Flash minus</span>
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
      <div className="space-y-1.5 px-4 py-4">
        {rows.map(({ row, them, d }) => (
          <div key={row.name} className="grid grid-cols-[minmax(0,9.5rem)_1fr_3.5rem] items-center gap-2 text-xs sm:grid-cols-[13rem_1fr_4rem]">
            <div className="min-w-0">
              <div className="truncate font-mono">{row.name}</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {them === null ? `${row.me.toFixed(1)} · no score for rival` : `${row.me.toFixed(1)} vs ${them.toFixed(1)}`}
                {row.post ? ` · post: ${row.post}` : ""}
                {row.ds ? ` · ${row.ds}` : ""}
              </div>
            </div>
            <div className="relative h-3 rounded-sm bg-muted">
              <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
              {d !== null && d !== 0 && (
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
          Against {label}: M3.1-Flash is ahead on {wins} of the {scored.length} rows where both have a score,
          behind on {losses}
          {ties ? `, tied on ${ties}` : ""}. Points, not percent; every benchmark has its own scale.
        </p>
        <p>
          A blank is the card&apos;s own: on Agents&apos; Last Exam it counts only official leaderboard results,
          which is why 1017, whose card claims 35.4, shows none here.
        </p>
      </figcaption>
    </figure>
  )
}
