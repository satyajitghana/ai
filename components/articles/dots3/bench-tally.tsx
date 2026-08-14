"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The reasoning + agentic appendix table, transcribed, with the head-to-head
// records computed from it rather than taken from the post.
//
// The asterisk is the thing to keep hold of. dots' own note says: "Results
// with * are from our own testing," and for ARC-AGI-2 specifically, "We
// evaluated models on the official public evaluation set; unmarked results are
// official leaderboard scores from the private set." So on that row,
// dots3-note's 81.4 is a self-run public-set number and Opus 4.8's 72.1 is an
// official private-set number. Those are not the same measurement, and the
// public/private gap on ARC-AGI is not small.

type Row = { n: string; s: (number | null)[]; star: boolean[] }

const MODELS = [
  { name: "dots3-note Preview", size: "280B / 16B", self: true },
  { name: "Hy3", size: "295B / 21B" },
  { name: "GLM 5.2", size: "743B / 39B" },
  { name: "DeepSeek-v4-flash", size: "284B / 13B" },
  { name: "Seed 2.1 turbo", size: "—" },
  { name: "Kimi K3", size: "2.8T / 104B" },
  { name: "Claude Opus 4.8", size: "—" },
  { name: "GPT-5.5", size: "—" },
]

const ROWS: Row[] = [
  { n: "IMOAnswerBench", s: [90.9, 90.0, 91.0, 91.5, 91.6, null, 83.5, 92.1], star: [false, false, false, true, true, false, false, false] },
  { n: "Codeforces (rating)", s: [3056, 2758, 2851, 3329, null, null, 3188, 3362], star: [false, true, true, true, false, false, true, true] },
  { n: "LiveCodeBench v6", s: [91.5, 91.0, 83.7, 94.1, null, null, 93.2, 96.2], star: [false, true, true, true, false, false, true, true] },
  { n: "ARC-AGI-2", s: [81.4, 35.8, 22.8, 61.4, null, 60.4, 72.1, 85.0], star: [true, true, false, false, false, false, false, false] },
  { n: "ARC-AGI-3 (arcagi3)", s: [6.9, null, null, null, null, null, 1.5, 0.4], star: [true, false, false, false, false, false, false, false] },
  { n: "ARC-AGI-3 (general)", s: [32.1, null, 10.7, 18.1, null, 27.5, 43.2, 21.9], star: [true, false, true, true, false, true, true, true] },
  { n: "IFBench", s: [80.4, 74.6, 78.0, 78.7, 65.6, null, 62.2, 75.9], star: [false, true, true, true, true, false, false, false] },
  { n: "ClawEval (Pass^3)", s: [73.4, 68.5, 62.4, 78.9, 64.0, null, 72.1, 67.8], star: [false, false, false, true, false, false, false, false] },
  { n: "WildClawBench", s: [61.7, 53.6, 54.2, 66.0, 62.8, null, 68.0, 65.6], star: [false, false, false, true, false, false, false, false] },
  { n: "VibeLifeBench", s: [28.1, 27.3, 25.4, 30.0, 22.8, null, 27.5, 30.1], star: [false, true, true, true, true, false, true, true] },
  { n: "Terminal-Bench 2.1", s: [75.1, 71.7, 81.0, 82.7, 67.6, 88.3, 84.6, 82.7], star: [false, false, false, false, false, false, false, false] },
  { n: "SWE-bench Verified", s: [78.4, 78.0, 84.2, null, null, null, 88.6, null], star: [false, false, false, false, false, false, false, false] },
  { n: "SWE-bench-pro", s: [61.0, 57.9, 62.1, null, 57.0, 63.4, 69.2, 58.6], star: [false, false, false, false, false, false, false, false] },
  { n: "NL2repo", s: [49.8, 45.6, 48.9, 54.2, 43.7, null, 69.7, 50.7], star: [false, false, false, false, false, false, false, false] },
  { n: "Toolathlon-Verified", s: [55.6, 56.8, 59.9, 70.7, null, 76.5, 76.2, 73.5], star: [false, false, false, false, false, false, false, false] },
  { n: "APEX-Agent", s: [30.8, 25.6, 33.7, 35.0, 29.2, 41.0, 39.4, 37.7], star: [false, false, false, false, false, false, false, false] },
  { n: "BrowseComp w/ CM", s: [83.3, 84.2, 76.6, 74.5, 84.9, 91.2, 84.3, 84.4], star: [false, false, true, true, false, false, false, false] },
  { n: "BrowseComp-zh", s: [75.8, 69.2, 71.9, 69.6, 73.7, null, 80.3, 75.1], star: [false, true, true, true, true, false, true, true] },
  { n: "HLE w/ tool", s: [52.6, 53.2, 54.7, 50.1, 54.6, 56.0, 57.9, 52.2], star: [false, false, false, true, false, false, false, false] },
  { n: "LiveBrowseComp", s: [46.9, 40.0, 40.7, 43.0, 43.6, null, 50.2, 46.0], star: [false, true, true, true, true, false, true, true] },
  { n: "WideSearch", s: [78.9, 76.4, 82.3, 80.5, 77.6, null, 72.9, 80.0], star: [false, false, true, true, true, false, false, false] },
  { n: "DeepSearchQA", s: [92.1, 91.0, 91.8, 93.1, 89.6, 95.0, 93.1, 95.5], star: [false, false, true, true, true, false, false, false] },
  { n: "VibeSearchBench", s: [25.7, 23.7, 25.3, 22.4, 28.8, null, 33.8, 26.5], star: [false, true, true, true, true, false, true, true] },
]

const RECORD = MODELS.slice(1).map((m, k) => {
  const i = k + 1
  let w = 0, l = 0
  for (const r of ROWS) {
    const a = r.s[0], b = r.s[i]
    if (a === null || b === null) continue
    if (a > b) w++
    else if (a < b) l++
  }
  return { ...m, w, l }
})

const WIN = "oklch(0.60 0.15 255)"
const LOSS = "oklch(0.58 0.19 25)"

type View = "record" | "table"

export function BenchTally() {
  const [view, setView] = useState<View>("record")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">23 reasoning + agentic benchmarks</span>
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
            {RECORD.map((r) => {
              const t = r.w + r.l
              return (
                <div key={r.name} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                    {r.name}
                  </span>
                  <div className="flex h-4 flex-1 overflow-hidden rounded-sm bg-muted/40">
                    <div
                      className="flex items-center justify-end pr-1 font-mono text-[9px] text-white"
                      style={{ width: `${(r.w / t) * 100}%`, background: WIN }}
                    >
                      {r.w || ""}
                    </div>
                    {r.l > 0 ? (
                      <div
                        className="flex items-center pl-1 font-mono text-[9px] text-white"
                        style={{ width: `${(r.l / t) * 100}%`, background: LOSS }}
                      >
                        {r.l}
                      </div>
                    ) : null}
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                    {r.w}W–{r.l}L
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-[9px] text-muted-foreground">
                    {r.size}
                  </span>
                </div>
              )
            })}
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
              rows where both models are scored · dots3-note Preview is 280B total, 16B active
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[10px]">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2 text-left font-normal text-muted-foreground">benchmark</th>
                  {MODELS.map((m) => (
                    <th key={m.name} className="px-1.5 py-1 text-right font-normal text-muted-foreground">
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => {
                  const best = Math.max(...(r.s.filter((v) => v !== null) as number[]))
                  return (
                    <tr key={r.n} className="border-b border-border/40">
                      <td className="py-1 pr-2 whitespace-nowrap text-muted-foreground">{r.n}</td>
                      {r.s.map((v, i) => (
                        <td
                          key={i}
                          className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap"
                          style={{
                            color: v === null ? "var(--muted-foreground)" : v === best ? "var(--foreground)" : undefined,
                            fontWeight: v === best ? 600 : undefined,
                            opacity: v === null ? 0.35 : 1,
                          }}
                        >
                          {v === null ? "—" : v}
                          {r.star[i] ? <span className="text-muted-foreground">*</span> : null}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              * dots&rsquo; own testing rather than an official or vendor-reported score
            </div>
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sixteen billion active parameters against 21B, 39B and 104B, and the record splits cleanly: ahead of Hy3,
          GLM 5.2 and Seed 2.1 turbo, behind Opus 4.8, GPT-5.5, DeepSeek-v4-flash and Kimi K3. The asterisks matter
          more than the totals, though. On ARC-AGI-2, dots3-note&rsquo;s{" "}
          <span className="text-foreground">81.4 is starred</span>{" "}— their own run on the official <em>public</em>{" "}
          set — while Opus 4.8&rsquo;s 72.1 is unstarred, meaning an official leaderboard score on the{" "}
          <em>private</em>{" "}set. Those are different measurements, and on ARC-AGI the gap between them is not small.
        </p>
      </div>
    </figure>
  )
}
