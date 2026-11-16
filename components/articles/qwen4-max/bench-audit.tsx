"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every panel of Qwen's launch chart (qwen.ai/blog?id=qwen4-max, read 16 Nov
// 2026), each comparator bar checked against a source that is not Qwen's:
//   card    the other lab's own table: Moonshot's Kimi-K3.1-Pro model card on
//           Hugging Face, and Anthropic's Opus 5.5 launch page
//   aa      Artificial Analysis's Qwen4 Max page (its embedded per-model data)
//   board   the benchmark's own public leaderboard (Agents' Last Exam v1.1,
//           Mercor's APEX-Agents), read 16 Nov 2026
// OpenAI's own pages refused an automated reader, so GPT columns are checked
// only where a leaderboard or another lab's card carries them.

const MODELS = ["Qwen4-Max", "Qwen3.8-Max", "Opus 5.5", "GPT-6.1 Sol", "GPT-6 Astra", "Kimi K3.1"]

type Verdict = "match" | "mismatch" | "relabel" | "unchecked"
type Row = {
  name: string
  s: (number | null)[]
  verdict: Verdict
  note: string
  elo?: boolean
}

const ROWS: Row[] = [
  { name: "DeepSWE v1.1", s: [75.7, 69.3, 74.2, 75.2, 74.1, 75.5], verdict: "match", note: "Opus 74.2, Astra 74.1 and Kimi 75.5 are exactly Moonshot's card. Sol has no card value I could read." },
  { name: "CodeArena (Elo)", s: [1750, 1676, 1816, 1742, 1763, 1686], verdict: "unchecked", elo: true, note: "Cited from Arena; the leaderboard refused an automated reader." },
  { name: "Terminal-Bench 4.0", s: [48.5, 38.9, 59.6, 56.1, 59.1, 67.2], verdict: "relabel", note: "Every comparator equals Artificial Analysis's own run to the decimal (0.596, 0.561, 0.591, 0.672 in its page data), and so does Qwen4-Max's 48.5 (0.485). Anthropic's own card says Opus 66.4 and Astra 57.9; Moonshot's says Kimi 65.7. The footnotes don't say this row is AA's." },
  { name: "ProgramBench", s: [31.5, 28.0, 65.0, 52.5, 55.0, 25.0], verdict: "mismatch", note: "Moonshot's card: Opus 65.0 (same), Astra 50.0 (Qwen shows 55.0), Kimi 31.5 (Qwen shows 25.0). Vals' public board headlines a different metric (Opus 5.5 at 18.50%)." },
  { name: "AA-Briefcase v1.1 (Elo)", s: [1686, 1605, 1801, 1555, 1569, 1674], verdict: "match", elo: true, note: "Equals AA's page today. Moonshot's card, three weeks older, had Opus 1803 and Kimi 1678: Elo drifts." },
  { name: "Agents' Last Exam v1.1", s: [46.7, 27.9, 43.4, null, 42.6, 43.4], verdict: "match", note: "Equals the ALE board. Qwen 4 ran in the Codex harness at XHigh. Gemini 4 Carbon, second on the board at 45.9, is not on the chart. No Sol bar." },
  { name: "JobBench", s: [68.5, 65.3, 75.4, 66.2, 66.1, 61.2], verdict: "unchecked", note: "Qwen re-ran it on an updated dataset and evaluation code (commit 660b33a), so no published table is comparable." },
  { name: "APEX-Agents v1.1", s: [72.1, 63.3, 73.5, 60.0, 64.7, 65.5], verdict: "match", note: "All five comparators equal Mercor's board. Qwen4-Max itself is not on that board, so 72.1 is Qwen's own run. Moonshot's card claims 69.4 for Kimi." },
  { name: "HLAB-Vals-1.1", s: [21.3, 15.4, 9.2, 6.3, 7.1, 11.7], verdict: "unchecked", note: "Cited from the Vals Index, which I could not read. AA's Harvey LAB-AA variant agrees on direction: Qwen4 9%, Astra 9%, Sol 7%, Opus 4%." },
  { name: "AutomationBench-AA", s: [72.5, 56.2, 69.5, 64.9, 68.5, 73.3], verdict: "match", note: "Equals Moonshot's card and AA. Qwen4-Max is bolded but second: Kimi has 73.3." },
  { name: "AgentArena (net)", s: [7.5, null, 18.2, 11.8, 13.9, 3.9], verdict: "unchecked", note: "Cited from Arena; not readable. No Qwen3.8-Max bar." },
  { name: "BioMysteryBench", s: [85.0, 84.1, 81.9, 84.4, 78.9, 80.6], verdict: "match", note: "Opus 81.9, Astra 78.9, Kimi 80.6 equal Moonshot's card. The harness for Qwen's own run is not stated." },
  { name: "HealthBench Professional", s: [60.0, 39.6, 59.9, 65.1, 66.0, 57.2], verdict: "relabel", note: "No footnote, but Opus 59.9, Sol 65.1 and Astra 66.0 equal Artificial Analysis's page data (0.599, 0.651, 0.660). Kimi's 57.2 is not in AA's data." },
  { name: "Humanity's Last Exam", s: [51.7, 43.9, 59.8, 54.0, 53.6, 51.1], verdict: "match", note: "No-tools numbers: Opus 59.8, Astra 53.6, Kimi 51.1 equal Moonshot's HLE-Full row. Anthropic headlines 67.7 with tools." },
  { name: "Chartography", s: [54.2, 42.0, 66.3, 67.8, 71.1, 50.0], verdict: "unchecked", note: "A no-tools setting. Anthropic and Moonshot publish only with-tools scores (Opus 89.0). Qwen's own runs used min_pixels 4096x32x32." },
  { name: "Video-Index", s: [68.1, 63.2, 74.8, 73.8, 76.7, 63.2], verdict: "unchecked", note: "No source given and none found." },
]

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  match: { label: "matches a source", cls: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" },
  relabel: { label: "matches AA, not the cards", cls: "border-amber-500/40 text-amber-700 dark:text-amber-300" },
  mismatch: { label: "differs from the card", cls: "border-rose-500/40 text-rose-700 dark:text-rose-300" },
  unchecked: { label: "could not check", cls: "border-foreground/15 text-muted-foreground" },
}

type Filter = "all" | "leads" | "checked" | "problems"

export function BenchAudit() {
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState<string | null>("Terminal-Bench 4.0")

  const leads = (r: Row) => {
    const q = r.s[0] as number
    return r.s.every((v, i) => i === 0 || v === null || q > v)
  }
  const shown = ROWS.filter((r) =>
    filter === "all"
      ? true
      : filter === "leads"
        ? leads(r)
        : filter === "checked"
          ? r.verdict !== "unchecked"
          : r.verdict === "mismatch" || r.verdict === "relabel",
  )
  const nLead = ROWS.filter(leads).length

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-dashed border-foreground/15 text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="space-y-2 border-b px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground">
          Qwen&rsquo;s 16 launch panels · each comparator bar against someone else&rsquo;s number
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "all 16"],
              ["leads", `Qwen4-Max first (${nLead})`],
              ["checked", "checkable"],
              ["problems", "provenance problems"],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={chip(filter === id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[34rem] space-y-2 overflow-y-auto p-3 sm:p-4">
        {shown.map((r) => {
          const vals = r.s.filter((v): v is number => v !== null)
          const max = Math.max(...vals)
          const min = r.elo ? Math.min(...vals) - 60 : 0
          const isOpen = open === r.name
          return (
            <div key={r.name} className="rounded-lg border bg-muted/10">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.name)}
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="font-mono text-[12px] text-foreground">{r.name}</span>
                <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", VERDICT[r.verdict].cls)}>
                  {VERDICT[r.verdict].label}
                </span>
              </button>
              {isOpen ? (
                <div className="space-y-1.5 border-t px-3 py-2">
                  {r.s.map((v, i) => (
                    <div key={MODELS[i]} className="grid grid-cols-[6.5rem_1fr_3.2rem] items-center gap-2">
                      <span className={cn("truncate font-mono text-[10px]", i === 0 ? "text-foreground" : "text-muted-foreground")}>
                        {MODELS[i]}
                      </span>
                      <div className="h-2 rounded bg-muted/40">
                        {v !== null ? (
                          <div
                            className={cn("h-2 rounded", i === 0 ? "bg-blue-600/80" : i === 1 ? "bg-blue-400/50" : "bg-foreground/30")}
                            style={{ width: `${(((v - min) / (max - min)) * 100).toFixed(1)}%` }}
                          />
                        ) : null}
                      </div>
                      <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                        {v === null ? "no bar" : r.elo ? v.toFixed(0) : v.toFixed(1)}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-[13px] leading-5 text-muted-foreground">{r.note}</p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <figcaption className="border-t px-4 py-2 text-[12px] leading-5 text-muted-foreground">
        Values are Qwen&rsquo;s chart. Checks read 16 November 2026. Elo rows are drawn from just under the lowest bar so
        the gaps show.
      </figcaption>
    </figure>
  )
}
