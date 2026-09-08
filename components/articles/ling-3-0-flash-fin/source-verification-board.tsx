"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Every number here is the "Source verification" column of Table 3 in the
// FinFIRST paper (inclusionAI/FinFIRST, FinFIRST_paper.pdf, Sec. 4.1), read
// directly off the table -- all 15 evaluated model configurations, under the
// paper's common ReAct + web-search/visit/python harness. The upper/lower
// split reproduces the table's own dashed rule: the paper's text says
// "LING-3.0-FLASH-FIN stands out in source verification, reaching 82.45% --
// the highest among open-weight models in the lower block of Table 3," so the
// lower block is FinFIRST's own open-weight grouping, not a cut this article
// drew. (Two names, GPT-5.6-Sol and Claude-Opus-5, carry a dagger in the
// paper for an unrelated reason -- incomplete coverage on a few questions --
// not the open/closed split.)

type Row = { model: string; score: number; open: boolean; self: boolean }

const ROWS: Row[] = [
  { model: "Claude-Opus-5", score: 89.59, open: false, self: false },
  { model: "GPT-5.6-Sol", score: 88.68, open: false, self: false },
  { model: "Qwen3.8-Flash", score: 83.36, open: false, self: false },
  { model: "Ling-3.0-Flash-Fin", score: 82.45, open: true, self: true },
  { model: "GLM-5.3-Flash", score: 80.77, open: true, self: false },
  { model: "GLM-5.3", score: 78.56, open: true, self: false },
  { model: "Qwen3.8-Max", score: 77.75, open: false, self: false },
  { model: "Qwen3.8-27B", score: 76.83, open: true, self: false },
  { model: "DeepSeek-V4-Pro", score: 73.57, open: false, self: false },
  { model: "DeepSeek-V4-Flash", score: 71.65, open: true, self: false },
  { model: "Kimi-K3", score: 70.70, open: true, self: false },
  { model: "GLM-5.2", score: 68.30, open: true, self: false },
  { model: "Hunyuan3-Thinking", score: 68.01, open: true, self: false },
  { model: "Gemini-3.7-Flash", score: 66.62, open: false, self: false },
  { model: "MiniMax-M3", score: 62.97, open: true, self: false },
]

const SELF = "oklch(0.72 0.15 195)"
const OPEN = "oklch(0.62 0.13 155)"
const CLOSED = "oklch(0.62 0.02 260)"

type Filter = "all" | "open"

export function SourceVerificationBoard() {
  const [filter, setFilter] = useState<Filter>("open")

  const rows = useMemo(() => {
    const base = filter === "open" ? ROWS.filter((r) => r.open) : ROWS;
    return [...base].sort((a, b) => b.score - a.score)
  }, [filter])

  const max = Math.max(...ROWS.map((r) => r.score))
  const leader = rows[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          FinFIRST, Table 3 &mdash; &ldquo;source verification&rdquo; column, all 15 models
        </span>
        <div className="flex gap-1">
          {(["open", "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              aria-pressed={filter === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                filter === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "open" ? "open-weight only (9)" : "all evaluated models (15)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {rows.map((r) => {
            const w = (r.score / max) * 100
            const color = r.self ? SELF : r.open ? OPEN : CLOSED
            const isLeader = r.model === leader.model
            return (
              <div key={r.model} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "w-32 shrink-0 truncate text-right font-mono text-[11px] sm:w-40",
                    r.self ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {r.model}
                </span>
                <div className="relative h-4 flex-1 rounded-sm bg-muted/20">
                  <div
                    className="h-4 rounded-sm"
                    style={{ width: `${w}%`, background: color, opacity: r.self ? 0.95 : 0.55 }}
                  />
                </div>
                <span
                  className="w-14 shrink-0 font-mono text-[10.5px] tabular-nums"
                  style={{ color: r.self ? SELF : undefined }}
                >
                  {r.score.toFixed(2)}
                  {isLeader ? " ★" : ""}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch to <strong>all 15 models</strong> and{" "}
          <span style={{ color: SELF }}>Ling-3.0-Flash-Fin</span>&rsquo;s 82.45% drops to 4th &mdash; behind
          Claude-Opus-5, GPT-5.6-Sol, and Qwen3.8-Flash, none of which ship weights. Switch back to{" "}
          <strong>open-weight only</strong> and it is first, ahead of GLM-5.3-Flash by 1.68 points, which is
          exactly the comparison the model card and the FinFIRST paper are making when they call this score
          a standout: not best overall, best{" "}
          <span style={{ color: OPEN }}>among the models anyone can self-host</span>. Both readings are the
          same nine numbers; the qualifier is doing real work.
        </p>
      </div>
    </figure>
  )
}
