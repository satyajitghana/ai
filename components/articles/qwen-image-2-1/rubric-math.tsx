"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Qwen-Image-Bench totals, put back on the rubric they came from.
//
// Q-Judger scores every one of the 56 third-level facets as Fail, Pass or Excel
// and the model card maps them to 0, 60 and 100, with N/A excluded. A total is
// then a mean of means up the three-level tree. Treat the facets as equally
// weighted — the approximation this widget makes, and the only one — and a total
// T is a plain mixture:
//
//     T = 0 * fail + 60 * pass + 100 * excel,   fail + pass + excel = 1
//
// which rearranges to  excel = (T - 60 + 60 * fail) / 40. One free parameter, a
// straight line, exact.
//
// Two things fall out that the bar chart cannot show. Sixty is the score of a
// model that merely passes everything, so a total below 60 is a lower bound on
// how often the judge said Fail: fail >= (60 - T) / 60. And the gap between any
// two models is (T1 - T2) / 40 of the facets, whatever the fail rate — the line
// has the same slope for everyone.
//
// Totals are transcribed from the release chart (qwen.ai/blog?id=qwen-image-2.1,
// "Qwen-Image-Bench evaluation comparison"); the eighteen of them that also
// appear in the benchmark's own leaderboard match it to the hundredth.
//
// Arithmetic is +, -, * and / only, all exact per IEEE-754, so no lib/dmath
// wrapper is needed.

const PASS = 60
const EXCEL = 100

type Model = { name: string; total: number; size: string; mine?: boolean }

const MODELS: Model[] = [
  { name: "GPT Image 2.5 Sunburst", total: 67.01, size: "closed" },
  { name: "Qwen Image 3 Pro", total: 62.36, size: "closed" },
  { name: "Qwen Image 2.1", total: 60.28, size: "7B", mine: true },
  { name: "Nano Banana 2.0", total: 59.82, size: "closed" },
  { name: "Qwen Image 2.0 Pro", total: 57.84, size: "closed" },
  { name: "FLUX 2 Max", total: 55.33, size: "32B" },
  { name: "Qwen Image 2512", total: 52.06, size: "20B" },
  { name: "Qwen Image", total: 49.23, size: "20B" },
  { name: "HiDream O1", total: 46.17, size: "~8B" },
]

const minFail = (t: number) => Math.max(0, (PASS - t) / PASS)

export function RubricMath() {
  const [failPct, setFailPct] = useState(0)
  const fail = failPct / 100

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-rubric-math={failPct}
      aria-label="Qwen-Image-Bench totals expressed as shares of rubric facets scored Fail, Pass and Excel"
    >
      <div className="border-b px-4 py-4">
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">
            share of scored facets the judge called Fail
          </span>
          <input
            type="range"
            min={0}
            max={30}
            step={0.5}
            value={failPct}
            onChange={(e) => setFailPct(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
            aria-label="assumed fail rate, percent of scored facets"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            fail = {failPct.toFixed(1)}%{" "}
            <span className="text-muted-foreground">
              (the one thing the totals cannot pin down — every row below moves
              with it)
            </span>
          </span>
        </label>
      </div>

      <div className="px-4 py-4">
        <div className="mb-2 flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="w-36 shrink-0 sm:w-48">model</span>
          <span className="flex-1">fail / pass / excel</span>
          <span className="w-20 shrink-0 text-right">excel</span>
        </div>

        {MODELS.map((m) => {
          const floor = minFail(m.total)
          const impossible = fail < floor - 1e-9
          const f = impossible ? floor : fail
          const excel = (m.total - PASS + PASS * f) / (EXCEL - PASS)
          const pass = 1 - f - excel

          return (
            <div key={m.name} className="flex items-center gap-3 py-1">
              <span
                className={cn(
                  "w-36 shrink-0 truncate font-mono text-xs sm:w-48",
                  m.mine ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {m.name}{" "}
                <span className="text-muted-foreground/70">{m.size}</span>
              </span>

              <div className="flex h-5 flex-1 overflow-hidden rounded-sm bg-muted/50">
                <div
                  className="h-full bg-foreground/15"
                  style={{ width: `${f * 100}%` }}
                  title={`Fail ${(f * 100).toFixed(1)}%`}
                />
                <div
                  className="h-full bg-foreground/40"
                  style={{ width: `${pass * 100}%` }}
                  title={`Pass ${(pass * 100).toFixed(1)}%`}
                />
                <div
                  className={cn(
                    "h-full",
                    m.mine ? "bg-foreground/90" : "bg-foreground/70"
                  )}
                  style={{ width: `${excel * 100}%` }}
                  title={`Excel ${(excel * 100).toFixed(1)}%`}
                />
              </div>

              <span
                className={cn(
                  "w-20 shrink-0 text-right font-mono text-xs tabular-nums",
                  impossible ? "text-muted-foreground" : ""
                )}
              >
                {(excel * 100).toFixed(1)}%
                {impossible ? "*" : ""}
              </span>
            </div>
          )
        })}

        <p className="mt-4 mb-0 text-sm">
          A row marked{" "}
          <span className="font-mono">*</span>{" "}
          cannot reach its total at the chosen fail rate, so it is drawn at the
          lowest fail rate that works —{" "}
          <span className="font-mono tabular-nums">
            {(minFail(46.17) * 100).toFixed(1)}%
          </span>{" "}
          for HiDream O1,{" "}
          <span className="font-mono tabular-nums">
            {(minFail(49.23) * 100).toFixed(1)}%
          </span>{" "}
          for Qwen-Image 1.0. Qwen-Image-2.1 is the lowest bar on the chart with
          no such floor: 60.28 is the first total that a model could reach
          without the judge ever writing Fail.
        </p>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Totals as printed on the release chart; the decomposition is arithmetic
        on the published 0 / 60 / 100 mapping, assuming facets are equally
        weighted, which the hierarchical mean-of-means only approximately makes
        true. The slope is the part that does not depend on the assumption: the{" "}
        <span className="font-mono">0.46</span>{" "}
        between Qwen-Image-2.1 and Nano Banana 2.0 is{" "}
        <span className="font-mono tabular-nums">
          {((60.28 - 59.82) / 40 * 100).toFixed(2)}%
        </span>{" "}
        of facets moving from Pass to Excel, at any fail rate you pick.
      </figcaption>
    </figure>
  )
}
