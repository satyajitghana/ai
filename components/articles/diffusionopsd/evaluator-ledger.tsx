"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The "19 of 20" headline, rebuilt from the paper's own Table 1 (tables/
// main_results.tex) rather than taken on faith. Ten evaluators score every
// held-out image; seven are public checkpoints anyone can run, three are
// described in the paper's Appendix ("Internal reward models") as trained on
// ByteDance's own data or scored against images from a sibling proprietary
// model (Seedream 5.0 Pro), and are not distributed with the code release.
//
// Rows below are exactly the reward-specific (cmark) rows the "19 of 20"
// count is drawn from: three methods on SD3.5-M at 100 updates, four on
// Z-Image-Turbo at 100 updates (FlowGRPO's SD3.5-M reward-specific run needs
// >5k updates and is reported separately, not in this comparison).

type Ev = { key: string; label: string; internal: boolean }

// dp = the decimal precision the paper's own table prints for this column
const EVALS: (Ev & { dp: number })[] = [
  { key: "pick", label: "PickScore", internal: false, dp: 2 },
  { key: "clip", label: "CLIPScore", internal: false, dp: 3 },
  { key: "hpsv2", label: "HPSv2.1", internal: false, dp: 3 },
  { key: "aes", label: "Aesthetic", internal: false, dp: 2 },
  { key: "imgr", label: "ImageReward", internal: false, dp: 2 },
  { key: "hpsv3", label: "HPSv3", internal: false, dp: 2 },
  { key: "deqa", label: "DeQA", internal: false, dp: 2 },
  { key: "altclip", label: "AltCLIP", internal: true, dp: 3 },
  { key: "point", label: "VLM-Point", internal: true, dp: 3 },
  { key: "pair", label: "VLM-Pair", internal: true, dp: 3 },
]

type Row = { backbone: "SD3.5-M" | "Z-Image-Turbo"; method: string; isOpsd: boolean; scores: number[] }

// column order matches EVALS above
const ROWS: Row[] = [
  { backbone: "SD3.5-M", method: "ReFL", isOpsd: false, scores: [23.92, 0.308, 0.358, 12.09, 1.28, 9.33, 4.85, 0.408, 0.193, 0.29] },
  { backbone: "SD3.5-M", method: "DiffusionNFT", isOpsd: false, scores: [23.43, 0.298, 0.336, 9.11, 1.46, 9.14, 4.76, 0.412, 0.199, 0.323] },
  { backbone: "SD3.5-M", method: "DiffusionOPSD", isOpsd: true, scores: [24.94, 0.34, 0.39, 12.08, 1.76, 13.34, 4.94, 0.45, 0.214, 0.465] },
  { backbone: "Z-Image-Turbo", method: "FlowGRPO", isOpsd: false, scores: [22.96, 0.275, 0.305, 5.46, 1.01, 7.11, 4.51, 0.394, 0.217, 0.42] },
  { backbone: "Z-Image-Turbo", method: "ReFL", isOpsd: false, scores: [24.54, 0.313, 0.38, 9.79, 1.37, 13.77, 4.6, 0.441, 0.227, 0.481] },
  { backbone: "Z-Image-Turbo", method: "DiffusionNFT", isOpsd: false, scores: [22.28, 0.28, 0.277, 6.07, 0.58, 1.58, 3.37, 0.363, 0.166, 0.357] },
  { backbone: "Z-Image-Turbo", method: "DiffusionOPSD", isOpsd: true, scores: [25.15, 0.32, 0.39, 10.74, 1.79, 14.44, 4.78, 0.451, 0.243, 0.551] },
]

const BACKBONES = ["SD3.5-M", "Z-Image-Turbo"] as const

const GOOD = "oklch(0.55 0.16 155)"
const AMBER = "oklch(0.68 0.13 85)"

export function EvaluatorLedger() {
  const [scope, setScope] = useState<"all" | "public">("all")

  const visible = EVALS.map((e, i) => ({ ...e, i })).filter((e) => scope === "all" || !e.internal)

  const perBackbone = useMemo(
    () =>
      BACKBONES.map((bb) => {
        const rows = ROWS.filter((r) => r.backbone === bb)
        const opsd = rows.find((r) => r.isOpsd)!
        const rivals = rows.filter((r) => !r.isOpsd)
        let wins = 0
        const cellWin: boolean[] = []
        visible.forEach((e) => {
          const best = Math.max(...rivals.map((r) => r.scores[e.i]))
          const w = opsd.scores[e.i] > best
          if (w) wins++
          cellWin.push(w)
        })
        return { bb, rows, opsd, wins, total: visible.length, cellWin }
      }),
    [visible],
  )

  const totalWins = perBackbone.reduce((a, b) => a + b.wins, 0)
  const totalCols = perBackbone.reduce((a, b) => a + b.total, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Table 1&apos;s reward-specific rows · {visible.length} of 10 evaluators shown
        </span>
        <span className="font-mono text-[10px] text-foreground">
          DiffusionOPSD wins {totalWins} / {totalCols}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "all 10 evaluators"],
              ["public", "public evaluators only (7)"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              aria-pressed={scope === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                scope === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-4">
          {perBackbone.map(({ bb, rows, cellWin, wins, total }) => (
            <div key={bb}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-foreground">{bb}</span>
                <span className="font-mono text-[10px]" style={{ color: wins === total ? GOOD : AMBER }}>
                  {wins} / {total}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse font-mono text-[10.5px]">
                  <thead>
                    <tr>
                      <th className="w-32 py-1 text-left text-muted-foreground">method</th>
                      {visible.map((e) => (
                        <th
                          key={e.key}
                          className="px-1.5 py-1 text-right font-normal"
                          style={{ color: e.internal ? AMBER : "currentColor", opacity: e.internal ? 1 : 0.6 }}
                        >
                          {e.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.method} className={cn("border-t", r.isOpsd && "bg-muted/30")}>
                        <td className={cn("py-1", r.isOpsd ? "text-foreground" : "text-muted-foreground")}>
                          {r.method}
                        </td>
                        {visible.map((e, vi) => {
                          const v = r.scores[e.i].toFixed(e.dp)
                          const win = r.isOpsd && cellWin[vi]
                          return (
                            <td key={e.key} className="px-1.5 py-1 text-right tabular-nums">
                              {win ? <strong style={{ color: GOOD }}>{v}</strong> : v}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 font-mono text-[9.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: AMBER }} /> internal
            evaluator — not distributed, not independently reproducible
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Restrict the table to the seven evaluators anyone can actually run and the count barely
          moves: <span className="text-foreground">13 of 14</span>, against{" "}
          <span className="text-foreground">19 of 20</span> with the three internal ones included. The
          internal columns are not propping up an otherwise unremarkable result — the public subset
          alone shows almost the same dominance.
          <br />
          <br />
          But look at where the single largest number in the paper&rsquo;s abstract comes from.{" "}
          <span style={{ color: AMBER }}>VLM-Pair</span> is the abstract&rsquo;s +44.0% headline on
          SD3.5-M, and it is scored by an internal preference model judging the generated image
          against a fixed reference{" "}
          <em>generated by a different proprietary model</em>, Seedream 5.0 Pro. Both things are true
          at once: the aggregate win-count claim survives being restricted to what outsiders can
          check, and the biggest single percentage in the paper is on the one axis outsiders cannot
          check at all.
        </p>
      </div>
    </figure>
  )
}
