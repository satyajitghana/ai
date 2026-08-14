"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The launch post's full comparison table, transcribed with its gaps intact,
// plus the head-to-head record that table implies.
//
// Two things I did to it and would want a reader to know:
//   1. ExploitGym is published as "2h / 6h" pairs. For ranking I use the 6h
//      number; both are shown in the cell.
//   2. A row only counts in a head-to-head if BOTH models are scored on it.
//      Blank cells are blank in the source — I have not guessed at them, and
//      13 of the 112 non-GLM-5.3 cells are blank.
//
// Tallies below were computed from this array, not copied from the post.

const MODELS = [
  "GLM-5.3", "GLM-5.2", "Kimi K3", "DeepSeek-V4 Pro", "Qwen3.8-Max", "Opus 4.8", "Fable 5", "GPT-5.6 Sol",
]

type Row = { group: string; name: string; s: (number | string | null)[] }

const ROWS: Row[] = [
  { group: "Coding", name: "Terminal Bench 2.1", s: [88.2, 81, 88.3, 87.9, 86.6, 85, 88, 88.8] },
  { group: "Coding", name: "Terminal Bench 3.0", s: [28.3, 4.6, 17.4, null, null, 21.1, 33.7, 34.6] },
  { group: "Coding", name: "DeepSWE (v1.1)", s: [66.9, 46.2, 67.5, 62.7, 56.6, 58, 69.7, 72.7] },
  { group: "Coding", name: "NL2Repo", s: [58, 48.9, 58, 61.1, 55.9, 69.7, null, null] },
  { group: "Coding", name: "ProgramBench (Almost Solved)", s: [19, 9.5, 17.5, null, 10.5, 15.5, 33, 23] },
  { group: "Coding", name: "FrontierSWE", s: [78.1, 67.5, null, null, null, 66.5, 88.2, null] },
  { group: "Coding", name: "SWE-Marathon (v1.1)", s: [42.5, 19.4, 48.1, null, null, 48.8, 33.1, 42.5] },
  { group: "Coding", name: "PostTrainBench", s: [39.8, 31.7, 32, null, null, 32.9, 41.8, 36.2] },
  { group: "Cyber", name: "CyberGym", s: [84.5, 77.2, 80, 83.3, 78.5, 78.1, 83.8, 83.6] },
  { group: "Cyber", name: "ExploitGym (2h / 6h)", s: ["105 / 130", "29 / 39", "36 / 70", null, "14 / 26", "80 / 120", "181 / 247", "216 / 293"] },
  { group: "Cyber", name: "ExploitBench", s: [54.4, 24.4, 32.2, null, 28.8, 40, 78, 76.5] },
  { group: "Agentic", name: "Toolathlon Verified", s: [73, 59.9, 76.5, 74.1, 72.5, 76.2, 74.7, 74.9] },
  { group: "Agentic", name: "AutomationBench (v1.0.6)", s: [48.2, 26.2, 46.7, 43.2, 39.8, 41, 46.2, 45.8] },
  { group: "Agentic", name: "Agents' Last Exam (ALE-CLI)", s: [28.5, 23.8, 27.6, 25.7, 27, 25.7, 23.8, 28.6] },
  { group: "Agentic", name: "HLE w/ Tools", s: [62.5, 54.7, 59.8, 60, 56.2, 57.9, 63.9, 64.5] },
  { group: "Agentic", name: "GDPval-AA v2", s: [1769, 1508, 1682, 1590, 1739, 1588, 1743, 1730] },
]

// "105 / 130" ranks on its 6h half
const num = (v: number | string | null): number | null =>
  v === null ? null : typeof v === "number" ? v : Number(String(v).split("/").pop()!.trim())

const HEAD_TO_HEAD = MODELS.slice(1).map((m, k) => {
  const i = k + 1
  let w = 0, l = 0
  for (const r of ROWS) {
    const a = num(r.s[0]), b = num(r.s[i])
    if (a === null || b === null) continue
    if (a > b) w++
    else if (a < b) l++
  }
  return { model: m, w, l, open: ["GLM-5.2", "Kimi K3", "DeepSeek-V4 Pro", "Qwen3.8-Max"].includes(m) }
})

const OPEN = "oklch(0.60 0.15 255)"
const CLOSED = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 25)"

type View = "table" | "record"

export function BenchLedger() {
  const [view, setView] = useState<View>("record")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">16 benchmarks · 8 models</span>
        <div className="flex gap-1">
          {(["record", "table"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "record" ? "head-to-head" : "full table"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "record" ? (
          <div className="space-y-1.5">
            {HEAD_TO_HEAD.map((h) => {
              const total = h.w + h.l
              return (
                <div key={h.model} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                    {h.model}
                  </span>
                  <div className="flex h-4 flex-1 overflow-hidden rounded-sm bg-muted/40">
                    <div
                      className="flex items-center justify-end pr-1 font-mono text-[9px] text-white"
                      style={{ width: `${(h.w / total) * 100}%`, background: h.open ? OPEN : CLOSED }}
                    >
                      {h.w}
                    </div>
                    {/* rendering a 0%-width div still shows its horizontal padding */}
                    {h.l > 0 ? (
                      <div
                        className="flex items-center pl-1 font-mono text-[9px] text-white"
                        style={{ width: `${(h.l / total) * 100}%`, background: BAD }}
                      >
                        {h.l}
                      </div>
                    ) : null}
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                    {h.w}W–{h.l}L
                  </span>
                </div>
              )
            })}
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: OPEN }} />
                open weights
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CLOSED }} />
                closed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BAD }} />
                rows GLM-5.3 loses
              </span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[10px]">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2 text-left font-normal text-muted-foreground">benchmark</th>
                  {MODELS.map((m) => (
                    <th key={m} className="px-1.5 py-1 text-right font-normal text-muted-foreground">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => {
                  const vals = r.s.map(num)
                  const best = Math.max(...(vals.filter((v) => v !== null) as number[]))
                  return (
                    <tr key={r.name} className="border-b border-border/40">
                      <td className="py-1 pr-2 whitespace-nowrap text-muted-foreground">{r.name}</td>
                      {r.s.map((v, i) => (
                        <td
                          key={i}
                          className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap"
                          style={{
                            color: v === null ? "var(--muted-foreground)" : vals[i] === best ? "var(--foreground)" : undefined,
                            fontWeight: vals[i] === best ? 600 : undefined,
                            opacity: v === null ? 0.35 : 1,
                          }}
                        >
                          {v === null ? "—" : v}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Z.ai calls GLM-5.3 &ldquo;the most capable open-weights model for coding,&rdquo; and against the open field
          the table supports it: 16–0 over its own predecessor, 12–0 over Qwen3.8-Max, 10–4 over Kimi K3, 7–2 over
          DeepSeek-V4 Pro. The closed frontier is a different story — 6–9 against Fable 5 and 4–9 against GPT-5.6
          Sol. Counted across the whole field rather than pairwise, GLM-5.3 has the top score on{" "}
          <span className="text-foreground">3 of the 16 rows</span>: CyberGym, AutomationBench and GDPval-AA v2.
          Both readings are in the same table, and the phrase &ldquo;open-weights&rdquo; is doing the work that
          makes the headline true.
        </p>
      </div>
    </figure>
  )
}
