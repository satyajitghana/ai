"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A real FinFIRST record, not a made-up illustration -- task id "34" (original_id
// "v1_49") from inclusionAI/FinFIRST's test.jsonl, the exact task the dataset's
// own README uses as its worked example (assets/rubric-example.png). Query,
// reference answer and all seven rubric lines are copied verbatim from the
// `query`, `answer` and `rubric_annotated` fields; the three capability tags --
// 信源核验 / 原始数据查询 / 计算和答案 -- are the dataset's own per-criterion
// annotations, translated here as source verification / raw-information
// acquisition / computation & answer formation, the three groups FinFIRST's
// README and paper define. Point weights sum to 100, matching every task in
// the set (rubric weights are normalized to 100 per task).
// https://huggingface.co/datasets/inclusionAI/FinFIRST (test.jsonl, id "34")
//
// The aggregate row is two independently-checkable counts over all 123 tasks:
// - "by criteria" tags and counts all 701 rows of every task's rubric_annotated
//   field directly -- 358 raw-information / 139 source-verification / 204
//   computation-and-answer, reproduced here by parsing the public JSONL.
// - "by points" is FinFIRST's own reported split of the 12,300-point benchmark
//   (paper Sec. 3.3: 7,322 / 2,085 / 2,893 -- 59.5% / 17.0% / 23.5%).
// The two views disagree on purpose: source-verification criteria are cheap
// (~15 pts each on average) next to raw-information ones (~20 pts each), so
// source verification's share of *effort* (criteria count) runs higher than
// its share of the *scoreboard* (weighted points).

type Dim = "source" | "raw" | "calc"

const DIM_LABEL: Record<Dim, string> = {
  source: "source verification",
  raw: "raw-information acquisition",
  calc: "computation & answer formation",
}
const DIM_COLOR: Record<Dim, string> = {
  source: "oklch(0.60 0.15 255)",
  raw: "oklch(0.68 0.13 85)",
  calc: "oklch(0.55 0.16 155)",
}

const CRITERIA: { dim: Dim; text: string; pts: number }[] = [
  { dim: "source", text: "Accurately identifies Meta’s official 2025 disclosure materials or filing.", pts: 10 },
  { dim: "raw", text: "Identifies Meta’s 2025 U.S. & Canada quarterly ad revenue: $18,259M, $20,045M, $21,331M, $25,643M.", pts: 30 },
  { dim: "calc", text: "Sums the four quarters: $18,259M + $20,045M + $21,331M + $25,643M = $85,278M.", pts: 10 },
  { dim: "source", text: "Correctly identifies the 2025 IAB / PwC Internet Advertising Revenue Report file or link.", pts: 10 },
  { dim: "raw", text: "Identifies 2025 U.S. social media advertising revenue as $117.70B.", pts: 20 },
  { dim: "calc", text: "Divides: $85.278B ÷ $117.70B = 72.45%.", pts: 10 },
  { dim: "calc", text: "Presents the final answer as 72.45%, with correct precision and unit.", pts: 10 },
]

const COUNT_AGG: Record<Dim, number> = { raw: 358, source: 139, calc: 204 }
const POINT_AGG: Record<Dim, number> = { raw: 7322, source: 2085, calc: 2893 }

type ViewMode = "count" | "points"

export function GradingChain() {
  const [mode, setMode] = useState<ViewMode>("count")

  const agg = mode === "count" ? COUNT_AGG : POINT_AGG
  const total = agg.raw + agg.source + agg.calc
  const order: Dim[] = ["raw", "calc", "source"]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          FinFIRST test.jsonl, task id 34 &mdash; one query, seven atomic criteria
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">701 criteria total, 123 tasks</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* the task */}
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[10px] text-muted-foreground">query</div>
          <p className="mt-1 text-[12.5px] leading-5 text-foreground">
            &ldquo;&hellip;calculate Meta&rsquo;s 2025 United States &amp; Canada advertising revenue as a
            percentage of 2025 U.S. social media advertising revenue.&rdquo;
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span>reference answer</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-foreground">72.45%</span>
          </div>
        </div>

        {/* the chain */}
        <div className="relative mt-3 pl-4">
          <div className="absolute top-1 bottom-1 left-[5px] w-px bg-border" aria-hidden />
          <div className="space-y-2">
            {CRITERIA.map((c, i) => (
              <div key={i} className="relative">
                <span
                  className="absolute top-1.5 -left-[15px] block h-[9px] w-[9px] rounded-full"
                  style={{ background: DIM_COLOR[c.dim] }}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <span
                      className="font-mono text-[9px] tracking-wide uppercase"
                      style={{ color: DIM_COLOR[c.dim] }}
                    >
                      {DIM_LABEL[c.dim]}
                    </span>
                    <p className="mt-0.5 text-[12px] leading-4 text-foreground">{c.text}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {c.pts}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* aggregate across all 701 */}
        <div className="mt-5 border-t pt-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              all 701 criteria, by {mode === "count" ? "how many" : "how many points"}
            </span>
            <div className="flex gap-1">
              {(["count", "points"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMode(v)}
                  aria-pressed={mode === v}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                    mode === v
                      ? "border-foreground/30 bg-muted/50 text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "count" ? "by criteria (701)" : "by points (12,300)"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex h-6 w-full overflow-hidden rounded-md border border-border/70">
            {order.map((d) => (
              <div
                key={d}
                style={{ width: `${(agg[d] / total) * 100}%`, background: DIM_COLOR[d] }}
                className="opacity-80"
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {order.map((d) => (
              <div key={d} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: DIM_COLOR[d] }} />
                <span>{DIM_LABEL[d]}</span>
                <span className="tabular-nums text-foreground">{((agg[d] / total) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The task above breaks a single research question into seven independently gradable steps: two ask
          only whether the agent found the right <span style={{ color: DIM_COLOR.source }}>source</span>,
          two ask whether it read the right{" "}
          <span style={{ color: DIM_COLOR.raw }}>numbers</span> out of it, and three ask whether it{" "}
          <span style={{ color: DIM_COLOR.calc }}>computed and reported</span> correctly &mdash; a wrong
          final percentage and a right one with no traceable source both fail differently, and FinFIRST&rsquo;s
          grading tells them apart. Switch the view above and the two counts disagree on purpose:
          by raw count, source verification is 19.8% of the work; by the benchmark&rsquo;s own point
          weights it is only 17.0%, because a source-identification check is worth ~15 points on average
          against ~20 for a raw-information check. Counting criteria and counting points are both real
          metrics, and they rank the three skills the same way &mdash; they just don&rsquo;t agree on the
          margins.
        </p>
      </div>
    </figure>
  )
}
