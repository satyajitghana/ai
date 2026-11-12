"use client"

import { useState } from "react"

// Table 1 of arXiv 2611.13410, every row, as printed. Scores are percentages:
// BFCL V4 Overall, tau2-Bench Pass@1, WebShop SR, ALFWorld SR, Search QA EM
// (mean of seven datasets), and Avg (unweighted mean of the five). The gap
// view is my subtraction from the BF16 row of the same model. I recomputed
// every Avg from its five cells; all 33 match to the hundredth.

const BENCH = ["BFCL V4", "τ²-Bench", "WebShop", "ALFWorld", "Search QA", "Avg"] as const

type Setting = { id: string; label: string; bf16: number[]; rows: [string, number[]][] }

const QWEN3_BF16 = [46.89, 32.64, 68.58, 79.92, 39.65, 53.54]

const SETTINGS: Setting[] = [
  {
    id: "q8-w4a16",
    label: "Qwen3-8B · W4A16",
    bf16: QWEN3_BF16,
    rows: [
      ["GPTQ", [40.73, 26.85, 59.24, 71.32, 33.64, 46.36]],
      ["EfficientQAT", [41.77, 28.0, 61.34, 73.18, 35.08, 47.87]],
      ["BitDistiller", [42.46, 28.31, 62.07, 73.91, 35.69, 48.49]],
      ["On-Policy QAD", [44.43, 28.77, 64.72, 76.53, 37.47, 50.38]],
      ["QeRL", [44.91, 29.84, 65.29, 77.04, 37.94, 51.0]],
      ["SteerDistill", [46.84, 31.79, 68.41, 79.75, 39.12, 53.18]],
    ],
  },
  {
    id: "q4-w4a16",
    label: "Qwen3.5-4B · W4A16",
    bf16: [50.4, 62.8, 69.8, 78.6, 46.8, 61.68],
    rows: [
      ["GPTQ", [43.91, 56.18, 60.65, 69.78, 40.58, 54.22]],
      ["EfficientQAT", [45.36, 57.68, 62.76, 71.84, 42.08, 55.94]],
      ["BitDistiller", [46.17, 58.33, 63.61, 72.54, 42.77, 56.68]],
      ["On-Policy QAD", [48.02, 59.48, 66.03, 74.92, 44.49, 58.59]],
      ["QeRL", [48.53, 60.31, 66.73, 75.63, 45.01, 59.24]],
      ["SteerDistill", [49.82, 61.91, 69.08, 77.82, 46.11, 60.95]],
    ],
  },
  {
    id: "g12-w4a16",
    label: "Gemma 4 12B-it · W4A16",
    bf16: [64.18, 61.46, 72.41, 84.63, 42.96, 65.13],
    rows: [
      ["GPTQ", [57.82, 54.36, 63.48, 75.72, 36.91, 57.66]],
      ["EfficientQAT", [59.46, 56.12, 65.72, 77.68, 38.24, 59.44]],
      ["BitDistiller", [60.08, 56.74, 66.43, 78.31, 38.79, 60.07]],
      ["On-Policy QAD", [61.87, 58.36, 68.61, 80.76, 40.52, 62.02]],
      ["QeRL", [62.41, 59.02, 69.33, 81.35, 41.07, 62.64]],
      ["SteerDistill", [63.54, 60.72, 71.38, 83.62, 42.31, 64.31]],
    ],
  },
  {
    id: "q8-w4a8",
    label: "Qwen3-8B · W4A8",
    bf16: QWEN3_BF16,
    rows: [
      ["GPTQ", [35.9, 22.9, 54.7, 66.8, 30.2, 42.1]],
      ["EfficientQAT", [40.2, 27.1, 60.0, 71.8, 34.0, 46.62]],
      ["BitDistiller", [41.2, 27.8, 60.8, 72.9, 34.8, 47.5]],
      ["On-Policy QAD", [43.15, 27.85, 63.35, 75.1, 36.25, 49.14]],
      ["QeRL", [42.85, 29.05, 64.1, 75.55, 36.9, 49.69]],
      ["SteerDistill", [45.2, 30.1, 66.7, 78.25, 37.85, 51.62]],
    ],
  },
  {
    id: "q8-w2a16",
    label: "Qwen3-8B · W2A16",
    bf16: QWEN3_BF16,
    rows: [
      ["GPTQ", [13.84, 6.72, 30.21, 24.63, 18.91, 18.86]],
      ["EfficientQAT", [30.92, 18.44, 49.13, 53.87, 31.46, 36.76]],
      ["BitDistiller", [33.71, 19.86, 51.84, 57.36, 34.22, 39.4]],
      ["On-Policy QAD", [32.88, 20.57, 53.08, 58.41, 32.96, 39.58]],
      ["QeRL", [31.64, 20.91, 50.74, 55.62, 31.58, 38.1]],
      ["SteerDistill", [38.12, 23.68, 55.71, 63.27, 34.05, 42.97]],
    ],
  },
]

const ACCENT = "oklch(0.62 0.15 150)"

// background for a gap in points: 0 transparent, 10+ full red
const shade = (gap: number, max: number) => `oklch(0.65 0.19 25 / ${Math.min(0.85, Math.max(0, gap / max) * 0.85).toFixed(3)})`

export function RecoveryTable() {
  const [sid, setSid] = useState("q8-w4a16")
  const [view, setView] = useState<"gap" | "score">("gap")
  const s = SETTINGS.find((x) => x.id === sid)!
  const maxGap = Math.max(...s.rows.flatMap(([, v]) => v.map((x, i) => s.bf16[i] - x)))
  const ours = s.rows[s.rows.length - 1][1]
  const over = ours.slice(0, 5).filter((x, i) => s.bf16[i] - x > 1).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
        {SETTINGS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setSid(x.id)}
            aria-pressed={sid === x.id}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${sid === x.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {x.label}
          </button>
        ))}
        <span className="mx-2 h-4 border-l" />
        {(["gap", "score"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${view === v ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {v === "gap" ? "points below BF16" : "raw score"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto p-3 sm:p-4">
        <table className="w-full min-w-[560px] border-collapse font-mono text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="px-2 py-1 text-left font-normal">method</th>
              {BENCH.map((b) => (
                <th key={b} className="px-2 py-1 text-right font-normal">
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-2 py-1">BF16</td>
              {s.bf16.map((v, i) => (
                <td key={i} className="px-2 py-1 text-right">
                  {view === "gap" ? "0.00" : v.toFixed(2)}
                </td>
              ))}
            </tr>
            {s.rows.map(([name, vals]) => {
              const isOurs = name === "SteerDistill"
              return (
                <tr key={name} className={isOurs ? "font-semibold" : undefined}>
                  <td className="px-2 py-1" style={isOurs ? { color: ACCENT } : undefined}>
                    {name}
                  </td>
                  {vals.map((v, i) => {
                    const gap = s.bf16[i] - v
                    const flag = isOurs && i < 5 && gap > 1
                    return (
                      <td
                        key={i}
                        className="px-2 py-1 text-right tabular-nums"
                        style={{ background: shade(gap, maxGap), outline: flag ? "1.5px solid currentColor" : undefined, outlineOffset: -2 }}
                      >
                        {view === "gap" ? (gap >= 0 ? "−" : "+") + Math.abs(gap).toFixed(2) : v.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {s.label}: SteerDistill sits {(s.bf16[5] - ours[5]).toFixed(2)} points under BF16 on the average; GPTQ sits{" "}
          {(s.bf16[5] - s.rows[0][1][5]).toFixed(2)} under. {over === 0 ? "No" : over} benchmark cell{over === 1 ? "" : "s"} of
          SteerDistill {over === 1 ? "is" : "are"} more than one point under BF16{over > 0 ? " (outlined)" : ""}.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Every number is the paper&apos;s Table 1; the gaps are my subtraction from the BF16 row. Red deepens with the gap,
        scaled per setting. The paper reports no error bars for this table, and WebShop, ALFWorld and Search QA are
        sampled at temperature 0.7.
      </figcaption>
    </figure>
  )
}
