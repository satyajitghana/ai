"use client"

import { useState } from "react"

// RSI-Inference Bench leaderboard snapshot 2026-10-12T05:39Z, read from the
// window.RSI_LEADERBOARD and window.OV objects in docs/leaderboard.html at
// commit a6b10af (measured: copied from the file, not re-run).
//   day0: per Day-0 task, per agent, [full passes, attempts, share of hidden
//         fail-to-pass checks passed]
//   speed-ups: geometric means over the 20 throughput and 7 regression tasks
//   cost: mean list-price cost per attempt over both tracks, and agent hours

const AGENTS = [
  "Sonnet-5.5",
  "Opus-5.5",
  "Fable-5.1",
  "GPT-6.1-Sol",
  "GPT-6-Astra",
  "Opus-5",
  "GPT-6-Sol",
  "GLM-5.3",
  "DeepSeek-V4.1-Flash",
  "Opus-4.8",
  "Gemini-3.8-Flash",
  "Gemini-3.7-Flash",
]

type Cell = [number, number, number]
const DAY0: { t: string; e: string; r: Cell[] }[] = [
  { t: "DeepSeek-V4-Flash", e: "SGLang", r: [[1, 3, 0.97], [0, 3, 0.97], [0, 3, 0.87], [0, 3, 0.86], [0, 3, 0.89], [0, 5, 0.17], [0, 3, 0.84], [0, 1, 0.1], [0, 1, 0.07], [0, 5, 0.12], [0, 3, 0.14], [0, 3, 0.08]] },
  { t: "GLM-5.3-Flash", e: "SGLang", r: [[3, 3, 1], [2, 3, 0.98], [1, 3, 0.94], [2, 3, 0.98], [3, 3, 1], [0, 5, 0.42], [0, 3, 0.78], [0, 1, 0.06], [0, 2, 0.21], [0, 5, 0.46], [0, 2, 0], [0, 3, 0.18]] },
  { t: "gpt-oss-120b", e: "SGLang", r: [[0, 3, 0.91], [0, 3, 0.93], [0, 3, 0.87], [0, 3, 0.78], [0, 3, 0.78], [0, 5, 0.88], [0, 3, 0.76], [0, 1, 0.78], [0, 2, 0.61], [0, 5, 0.72], [0, 3, 0.48], [0, 3, 0.63]] },
  { t: "Qwen3.8-Flash-Next-FP8", e: "vLLM", r: [[0, 3, 0.78], [0, 3, 0.65], [0, 3, 0.83], [0, 3, 0.87], [0, 3, 0.86], [0, 5, 0.38], [0, 3, 0.62], [0, 1, 0.37], [0, 1, 0.09], [0, 5, 0.43], [0, 2, 0.17], [0, 3, 0.19]] },
  { t: "DeepSeek-V4.1-Flash", e: "vLLM", r: [[1, 3, 0.92], [0, 3, 0.88], [0, 3, 0.82], [0, 3, 0.76], [0, 3, 0.82], [0, 5, 0.38], [0, 3, 0.75], [0, 1, 0.47], [0, 2, 0.38], [0, 5, 0.33], [0, 2, 0.35], [0, 2, 0.21]] },
  { t: "diffusiongemma-26B-A4B", e: "vLLM", r: [[0, 3, 0.91], [0, 3, 0.91], [0, 3, 0.7], [0, 3, 0.86], [0, 3, 0.9], [0, 5, 0.63], [0, 3, 0.8], [0, 1, 0.2], [0, 2, 0.36], [0, 5, 0.22], [0, 2, 0], [0, 2, 0.29]] },
  { t: "Inkling-Small-NVFP4", e: "SGLang", r: [[2, 3, 0.98], [2, 3, 0.92], [2, 3, 0.98], [1, 3, 0.97], [0, 3, 0.97], [0, 5, 0.7], [0, 3, 0.83], [0, 1, 0.29], [0, 2, 0.26], [0, 4, 0.37], [0, 2, 0], [0, 2, 0.24]] },
  { t: "Kimi-Linear-48B-A3B", e: "vLLM", r: [[1, 3, 0.9], [0, 3, 0.86], [0, 3, 0.75], [0, 3, 0.82], [0, 3, 0.88], [0, 5, 0.78], [0, 3, 0.51], [0, 1, 0.62], [0, 2, 0.35], [0, 5, 0.61], [0, 2, 0.12], [0, 2, 0.42]] },
  { t: "MiniMax-M3-MXFP8", e: "vLLM", r: [[0, 3, 0.91], [0, 3, 0.92], [0, 3, 0.91], [0, 3, 0.87], [0, 3, 0.91], [0, 5, 0.78], [0, 3, 0.87], [0, 1, 0.23], [0, 2, 0.49], [0, 5, 0.49], [0, 2, 0.28], [0, 2, 0.27]] },
  { t: "stable-diffusion-3-medium", e: "SGLang", r: [[0, 1, 0.72], [0, 1, 0.74], [0, 1, 0.68], [0, 1, 0.77], [0, 1, 0.64], [0, 3, 0.71], [0, 1, 0.74], [0, 1, 0.81], [0, 1, 0.68], [0, 3, 0.7], [0, 1, 0.64], [0, 1, 0.09]] },
]

// [overall, throughput (20), regression (7)] speed-up geomeans, as published.
const SPEED: Record<string, [number, number, number]> = {
  "Sonnet-5.5": [1.6772, 1.5277, 2.1899],
  "Opus-5.5": [1.4839, 1.3886, 1.7941],
  "Fable-5.1": [1.4062, 1.3176, 1.6937],
  "GPT-6.1-Sol": [1.374, 1.2613, 1.7544],
  "GPT-6-Astra": [1.3488, 1.2395, 1.7172],
  "Opus-5": [1.3454, 1.2885, 1.5221],
  "GPT-6-Sol": [1.2025, 1.1257, 1.4519],
  "GLM-5.3": [1.2189, 1.1363, 1.4896],
  "DeepSeek-V4.1-Flash": [1.2375, 1.1668, 1.4638],
  "Opus-4.8": [1.1394, 1.0904, 1.2922],
  "Gemini-3.8-Flash": [1.067, 1.0177, 1.2216],
  "Gemini-3.7-Flash": [1.0419, 1.037, 1.0559],
}

// [mean $ per attempt (both tracks), median $ per Day-0 attempt, median $ per optimization attempt, total $ at list price]
const COST: Record<string, [number, number, number, number]> = {
  "Sonnet-5.5": [76.4, 89.71, 39.14, 4202],
  "Opus-5.5": [83.14, 109.95, 55.59, 4573],
  "Fable-5.1": [74.11, 83.09, 57.62, 4076],
  "GPT-6.1-Sol": [12.48, 11.28, 11.68, 686],
  "GPT-6-Astra": [81.2, 61.56, 79.14, 4466],
  "Opus-5": [113.98, 107.6, 101.33, 8548],
  "GPT-6-Sol": [41.12, 41.99, 26.65, 2261],
  "GLM-5.3": [31.78, 60.73, 20.21, 1176],
  "DeepSeek-V4.1-Flash": [1.24, 1.32, 0.89, 54],
  "Opus-4.8": [118.18, 123.23, 98.94, 8745],
  "Gemini-3.8-Flash": [59.79, 82.67, 27.86, 2870],
  "Gemini-3.7-Flash": [56.73, 82.9, 14.89, 2837],
}

type View = "day0" | "speed" | "cost"
const ACCENT = "oklch(0.58 0.17 255)"
const SECOND = "oklch(0.66 0.13 160)"
const REST = "oklch(0.68 0.02 260)"

function short(a: string) {
  return a.replace("-Flash", "-F").replace("DeepSeek", "DS")
}

export function ResultsBoard() {
  const [view, setView] = useState<View>("day0")
  const [showF2p, setShowF2p] = useState(false)
  const [fam, setFam] = useState<0 | 1 | 2>(0)

  const passAt1 = AGENTS.map((_, i) => DAY0.reduce((s, row) => s + row.r[i][0] / row.r[i][1], 0) / DAY0.length)
  const f2pMean = AGENTS.map((_, i) => DAY0.reduce((s, row) => s + row.r[i][2], 0) / DAY0.length)

  const speedRows = AGENTS.map((a) => ({ a, v: SPEED[a][fam] })).sort((x, y) => y.v - x.v)
  const costMax = 120

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">Where the 26.7% comes from, and what the other 27 tasks say</div>
        <div className="font-mono text-xs text-muted-foreground">measured · leaderboard snapshot 2026-10-12</div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ["day0", "Day-0, task by task"],
            ["speed", "Speed-ups"],
            ["cost", "Cost per attempt"],
          ] as [View, string][]
        ).map(([id, label]) => {
          const on = id === view
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setView(id)}
              className="rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors"
              style={{ background: on ? ACCENT : "transparent", borderColor: on ? ACCENT : undefined, color: on ? "white" : undefined }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {view === "day0" && (
        <div>
          <label className="mb-2 inline-flex items-center gap-1.5 font-mono text-xs">
            <input type="checkbox" checked={showF2p} onChange={(e) => setShowF2p(e.target.checked)} />
            show the share of hidden checks passed instead of full passes
          </label>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card p-1 text-left font-mono font-normal text-muted-foreground">task</th>
                  {AGENTS.map((a) => (
                    <th key={a} className="p-1 font-mono font-normal text-muted-foreground" title={a}>
                      <span className="inline-block max-w-[4.5rem] truncate align-bottom">{short(a)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY0.map((row) => (
                  <tr key={row.t} className="border-t">
                    <td className="sticky left-0 whitespace-nowrap bg-card p-1 pr-2">
                      {row.t} <span className="text-muted-foreground">· {row.e}</span>
                    </td>
                    {row.r.map(([p, n, f], i) => {
                      const v = showF2p ? f : p / n
                      return (
                        <td
                          key={AGENTS[i]}
                          className="p-1 text-center font-mono tabular-nums"
                          style={{
                            background: v > 0 ? `color-mix(in oklch, ${showF2p ? SECOND : ACCENT} ${Math.round(v * 70)}%, transparent)` : undefined,
                          }}
                          title={`${AGENTS[i]}: ${p} of ${n} attempts passed; ${(f * 100).toFixed(0)}% of hidden checks`}
                        >
                          {showF2p ? f.toFixed(2) : `${p}/${n}`}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-t-2">
                  <td className="sticky left-0 bg-card p-1 pr-2 font-semibold">{showF2p ? "mean share" : "pass@1"}</td>
                  {AGENTS.map((a, i) => (
                    <td key={a} className="p-1 text-center font-mono font-semibold tabular-nums">
                      {showF2p ? f2pMean[i].toFixed(2) : `${(passAt1[i] * 100).toFixed(1)}%`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            pass@1 is each task&apos;s passes over attempts, averaged over the ten tasks. Sonnet-5.5: 1/3, 3/3, 1/3, 2/3
            and 1/3 on five tasks and nothing on the other five, so 2.67 / 10 = 26.7%. Five tasks were never passed by any
            agent. Toggle the box: the same agents pass 80 to 97% of the hidden checks on most tasks, and a run that misses
            one check scores zero.
          </p>
        </div>
      )}

      {view === "speed" && (
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(["all 27", "throughput, 20", "regression, 7"] as const).map((l, i) => (
              <button
                key={l}
                type="button"
                aria-pressed={fam === i}
                onClick={() => setFam(i as 0 | 1 | 2)}
                className="rounded-md border px-2 py-1 font-mono text-xs"
                style={{ borderColor: fam === i ? ACCENT : undefined, color: fam === i ? ACCENT : undefined }}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            {speedRows.map((r) => (
              <div key={r.a} className="flex items-center gap-2">
                <span className="w-36 shrink-0 truncate text-xs">{r.a}</span>
                <div className="h-3 flex-1 rounded-sm bg-muted">
                  <div
                    className="h-3 rounded-sm"
                    style={{ width: `${(((r.v - 1) / 1.25) * 100).toFixed(2)}%`, background: r.a === "Sonnet-5.5" ? ACCENT : REST }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{r.v.toFixed(2)}x</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Bars start at 1.00x (no change) and run to 2.25x. Geometric mean of each task&apos;s ratio against its untouched
            baseline; a run that fails its correctness check counts as 1.00x. The regression family scores higher for every
            agent: there is a known slowdown to find.
          </p>
        </div>
      )}

      {view === "cost" && (
        <div>
          <div className="space-y-1">
            {AGENTS.map((a) => (
              <div key={a} className="flex items-center gap-2">
                <span className="w-36 shrink-0 truncate text-xs">{a}</span>
                <div className="h-3 flex-1 rounded-sm bg-muted">
                  <div
                    className="h-3 rounded-sm"
                    style={{ width: `${((COST[a][0] / costMax) * 100).toFixed(2)}%`, background: a === "Sonnet-5.5" ? ACCENT : REST }}
                  />
                </div>
                <span className="w-40 shrink-0 text-right font-mono text-xs tabular-nums">
                  ${COST[a][0].toFixed(2)} · total ${COST[a][3].toLocaleString("en-US")}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Mean cost per attempt over both tracks, at list prices as of 2026-10-09, and each agent&apos;s total for the
            snapshot. A Day-0 attempt costs more than an optimization attempt for most agents (Sonnet-5.5: median
            $89.71 against $39.14). Summed over all twelve agents and 658 attempts: about $44,500.
          </p>
        </div>
      )}
    </div>
  )
}
