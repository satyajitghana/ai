"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Accuracy against effective compression, per benchmark, for every method in
// the paper's Table 11 — not just the ones its Figure 1 plots.
//
// All numbers are the paper's (reported, not re-run): Table 11 of
// arXiv:2605.07019v1, QA accuracy judged by Qwen3.5-397B, averaged over three
// runs. I re-derived each "Avg." column from the seven per-dataset columns and
// every one matches to 0.05.
//
// x is each method's ECR at a preset as the table prints it. The paper gives
// one ECR per method per preset, not one per dataset, so a method's points sit
// at the same x on every benchmark. Retrievers are sized to read ceil(K / C)
// chunks at preset C, which is why their ECR (4.5x / 8.3x / 11.9x) runs ahead
// of LensVLM's (4.3x / 7.4x / 10.1x): at every preset they get fewer tokens.
//
// The ledger under the chart picks, per preset, the best of the six retrievers
// on the chosen benchmark and prints the gap. NQ, HotpotQA, MuSiQue and HELMET
// are in-domain for LensVLM (it trained on their train splits); RULER, Qasper
// and LongBench are not. The retrievers are zero-shot on all seven.
//
// Coordinates use + - * / only, so SSR and the browser agree to the bit.

type Group = "lens" | "text" | "visual" | "compress"

type Series = {
  name: string
  group: Group
  ecr: [number, number, number]
  // [preset][dataset], datasets in DATASETS order
  acc: [number[], number[], number[]]
}

const DATASETS = ["Avg.", "NQ", "HotpotQA", "MuSiQue", "HELMET", "RULER", "Qasper", "LongBench"]
const IN_DOMAIN = new Set(["NQ", "HotpotQA", "MuSiQue", "HELMET"])

// Text upper bound (ICR 1x): Avg first, then the seven datasets.
const TEXT = [72.4, 80.8, 86.7, 68.7, 76.2, 70.7, 61.3, 62.5]

// Table 11 rows, reordered to put Avg. first.
const SERIES: Series[] = [
  {
    name: "LensVLM",
    group: "lens",
    ecr: [4.3, 7.4, 10.1],
    acc: [
      [68.9, 76.1, 81.5, 69.6, 78.4, 65.5, 48.3, 62.6],
      [62.1, 75.1, 75.5, 62.4, 71.5, 60.8, 38.5, 50.9],
      [52.1, 71.2, 64.5, 49.0, 57.2, 52.7, 28.4, 42.0],
    ],
  },
  {
    name: "BM25",
    group: "text",
    ecr: [4.5, 8.3, 11.9],
    acc: [
      [62.5, 73.0, 80.0, 53.2, 70.3, 67.4, 42.7, 50.6],
      [55.7, 66.8, 71.5, 43.8, 65.5, 65.7, 33.9, 42.8],
      [50.8, 65.8, 65.0, 36.8, 63.5, 54.5, 30.4, 39.8],
    ],
  },
  {
    name: "BGE-M3",
    group: "text",
    ecr: [4.5, 8.3, 11.9],
    acc: [
      [65.1, 76.5, 80.0, 59.0, 73.8, 67.0, 45.8, 53.8],
      [57.1, 72.2, 67.8, 48.0, 68.3, 63.4, 34.6, 45.6],
      [51.9, 69.7, 62.0, 40.2, 67.8, 51.3, 31.1, 41.1],
    ],
  },
  {
    name: "Jina-v4",
    group: "text",
    ecr: [4.5, 8.3, 11.9],
    acc: [
      [64.9, 74.8, 80.7, 57.5, 73.7, 66.9, 50.9, 49.5],
      [57.9, 70.0, 73.0, 47.7, 69.7, 65.3, 36.1, 43.2],
      [52.1, 67.2, 63.2, 41.7, 68.8, 53.6, 31.0, 39.1],
    ],
  },
  {
    name: "Qwen3-Emb",
    group: "text",
    ecr: [4.5, 8.3, 11.9],
    acc: [
      [64.4, 73.7, 77.8, 56.5, 72.7, 66.9, 52.2, 51.3],
      [56.5, 69.3, 68.3, 48.2, 70.0, 60.3, 36.3, 42.9],
      [51.1, 66.0, 62.3, 41.3, 67.5, 49.8, 33.2, 37.9],
    ],
  },
  {
    name: "ColPali",
    group: "visual",
    ecr: [4.7, 8.3, 11.9],
    acc: [
      [56.1, 64.5, 70.0, 49.5, 71.5, 56.6, 35.8, 44.6],
      [46.6, 63.0, 56.0, 32.5, 60.0, 48.3, 31.9, 34.4],
      [41.9, 58.0, 50.0, 31.5, 57.0, 39.7, 21.4, 35.7],
    ],
  },
  {
    name: "Jina-v4-MM",
    group: "visual",
    ecr: [4.6, 8.3, 11.9],
    acc: [
      [63.7, 69.5, 79.0, 58.5, 73.0, 68.4, 47.3, 49.9],
      [54.6, 72.0, 73.5, 45.0, 63.0, 51.1, 39.0, 38.8],
      [50.3, 71.0, 56.5, 39.0, 69.0, 46.6, 33.5, 36.3],
    ],
  },
  {
    name: "Glyph",
    group: "compress",
    ecr: [4.5, 8.6, 10.8],
    acc: [
      [47.2, 57.5, 42.0, 33.0, 63.5, 64.9, 31.9, 37.9],
      [36.4, 47.5, 37.5, 26.5, 50.5, 58.6, 12.1, 21.9],
      [32.8, 50.0, 31.5, 21.0, 46.0, 54.8, 7.7, 18.4],
    ],
  },
  {
    name: "LLMLingua-2",
    group: "compress",
    ecr: [5.5, 11.3, 15.7],
    acc: [
      [47.2, 62.2, 47.5, 33.8, 58.7, 56.1, 33.5, 38.3],
      [37.6, 55.0, 39.2, 26.5, 50.8, 42.0, 24.5, 25.5],
      [33.0, 49.2, 36.8, 21.8, 47.2, 36.2, 16.8, 23.3],
    ],
  },
  {
    name: "Comp. Image",
    group: "compress",
    ecr: [5, 10, 15],
    acc: [
      [31.3, 42.5, 33.5, 19.5, 33.1, 35.6, 25.3, 29.8],
      [21.0, 33.0, 29.0, 14.0, 22.5, 21.3, 8.8, 18.7],
      [18.1, 34.0, 25.0, 12.5, 24.5, 16.1, 2.8, 11.9],
    ],
  },
]

const GROUPS: { key: Exclude<Group, "lens">; label: string }[] = [
  { key: "text", label: "text retrievers" },
  { key: "visual", label: "page-image retrievers" },
  { key: "compress", label: "compression baselines" },
]

const ACCENT = "var(--hg-accent, oklch(0.72 0.15 195))"
const PRESET_NAMES = ["5×", "10×", "15×"]

const W = 620
const H = 260
const PL = 40
const PR = 16
const PT = 14
const PB = 34
const X0 = 3
const X1 = 16.5

const sx = (e: number) => PL + ((e - X0) / (X1 - X0)) * (W - PL - PR)
const sy = (a: number) => PT + (H - PT - PB) * (1 - a / 100)

function dashFor(g: Group): string | undefined {
  if (g === "visual") return "5 3"
  if (g === "compress") return "1.5 3"
  return undefined
}

export function CompressionFrontier() {
  const [ds, setDs] = useState(0)
  const [on, setOn] = useState<Record<string, boolean>>({
    text: true,
    visual: true,
    compress: false,
  })

  const lens = SERIES[0]
  const retrievers = SERIES.filter((s) => s.group === "text" || s.group === "visual")
  const visible = SERIES.filter((s) => s.group === "lens" || on[s.group])
  const name = DATASETS[ds]

  const ledger = [0, 1, 2].map((pi) => {
    let best = retrievers[0]
    for (const r of retrievers) if (r.acc[pi][ds] > best.acc[pi][ds]) best = r
    return {
      preset: PRESET_NAMES[pi],
      lens: lens.acc[pi][ds],
      lensEcr: lens.ecr[pi],
      best: best.name,
      bestAcc: best.acc[pi][ds],
      bestEcr: best.ecr[pi],
      gap: lens.acc[pi][ds] - best.acc[pi][ds],
    }
  })

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-compression-frontier={name}
      aria-label="QA accuracy against effective compression rate for LensVLM and the paper's baselines, per benchmark"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        accuracy vs effective compression · every row of the paper&rsquo;s
        Table 11 · reported, not re-run
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-3 font-mono text-xs">
        {DATASETS.map((d, i) => (
          <button
            key={d}
            type="button"
            aria-pressed={i === ds}
            onClick={() => setDs(i)}
            className={cn(
              "rounded border px-2 py-0.5 transition-colors",
              i === ds
                ? "border-foreground/60 bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {d}
            {IN_DOMAIN.has(d) ? "†" : ""}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto px-2 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="min-w-[480px]"
          role="img"
          aria-label={`${name}: LensVLM accuracy ${ledger
            .map((l) => `${l.lens} at ${l.lensEcr}x`)
            .join(", ")}; best retriever ${ledger
            .map((l) => `${l.best} ${l.bestAcc} at ${l.bestEcr}x`)
            .join(", ")}; full text ${TEXT[ds]}.`}
        >
          {[0, 25, 50, 75, 100].map((a) => (
            <g key={a}>
              <line
                x1={PL}
                y1={sy(a)}
                x2={W - PR}
                y2={sy(a)}
                stroke="currentColor"
                strokeOpacity={a === 0 ? 0.3 : 0.08}
              />
              <text
                x={PL - 6}
                y={sy(a) + 3}
                textAnchor="end"
                className="fill-current font-mono text-[10px] opacity-60"
              >
                {a}
              </text>
            </g>
          ))}
          {[5, 7, 9, 11, 13, 15].map((e) => (
            <text
              key={e}
              x={sx(e)}
              y={H - PB + 14}
              textAnchor="middle"
              className="fill-current font-mono text-[10px] opacity-60"
            >
              {e}×
            </text>
          ))}
          <text
            x={(PL + W - PR) / 2}
            y={H - 4}
            textAnchor="middle"
            className="fill-current font-mono text-[10px] opacity-60"
          >
            effective compression rate (ECR) · accuracy %
          </text>

          <line
            x1={PL}
            y1={sy(TEXT[ds])}
            x2={W - PR}
            y2={sy(TEXT[ds])}
            stroke="currentColor"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <text
            x={W - PR - 4}
            y={sy(TEXT[ds]) - 5}
            textAnchor="end"
            className="fill-current font-mono text-[10px] opacity-70"
          >
            full text, 1× · {TEXT[ds].toFixed(1)}
          </text>

          {visible
            .filter((s) => s.group !== "lens")
            .map((s) => (
              <g key={s.name}>
                <polyline
                  points={s.ecr.map((e, i) => `${sx(e)},${sy(s.acc[i][ds])}`).join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={s.group === "compress" ? 0.45 : 0.4}
                  strokeWidth="1.25"
                  strokeDasharray={dashFor(s.group)}
                />
                {s.ecr.map((e, i) => (
                  <circle
                    key={i}
                    cx={sx(e)}
                    cy={sy(s.acc[i][ds])}
                    r="2"
                    fill="currentColor"
                    fillOpacity="0.45"
                  />
                ))}
              </g>
            ))}

          <polyline
            points={lens.ecr.map((e, i) => `${sx(e)},${sy(lens.acc[i][ds])}`).join(" ")}
            fill="none"
            stroke={ACCENT}
            strokeWidth="3"
          />
          {lens.ecr.map((e, i) => (
            <g key={i}>
              <circle cx={sx(e)} cy={sy(lens.acc[i][ds])} r="4.5" fill={ACCENT} />
              <text
                x={sx(e) + 7}
                y={sy(lens.acc[i][ds]) - 7}
                className="fill-current font-mono text-[10px]"
              >
                {lens.acc[i][ds].toFixed(1)} @ {e}×
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 font-mono text-xs">
        <span className="flex items-center gap-1.5 pr-2">
          <span className="inline-block h-[3px] w-5" style={{ backgroundColor: ACCENT }} />
          LensVLM
        </span>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-pressed={on[g.key]}
            onClick={() => setOn((o) => ({ ...o, [g.key]: !o[g.key] }))}
            className={cn(
              "flex items-center gap-1.5 rounded border px-2 py-0.5 transition-colors",
              on[g.key]
                ? "border-foreground/60 text-foreground"
                : "text-muted-foreground line-through hover:text-foreground"
            )}
          >
            <svg width="20" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray={dashFor(g.key)}
              />
            </svg>
            {g.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border-t px-4 py-3">
        <div className="grid min-w-[26rem] grid-cols-[3rem_1fr_1.4fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
          <span className="text-muted-foreground">preset</span>
          <span className="text-muted-foreground">LensVLM</span>
          <span className="text-muted-foreground">best of six retrievers</span>
          <span className="text-right text-muted-foreground">gap</span>
          {ledger.map((l) => (
            <div key={l.preset} className="contents">
              <span>{l.preset}</span>
              <span>
                {l.lens.toFixed(1)}{" "}
                <span className="text-muted-foreground">at {l.lensEcr}×</span>
              </span>
              <span>
                {l.best} {l.bestAcc.toFixed(1)}{" "}
                <span className="text-muted-foreground">at {l.bestEcr}×</span>
              </span>
              <span
                className={cn(
                  "text-right",
                  l.gap < 0 ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {l.gap > 0 ? "+" : ""}
                {l.gap.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Data: arXiv:2605.07019v1, Table 11. † marks a benchmark LensVLM was
        trained on; the retrievers are zero-shot everywhere. The paper prints
        one ECR per method per preset, so a method&rsquo;s points sit at the
        same x on every benchmark. At every preset the retrievers read fewer
        tokens than LensVLM does.
      </figcaption>
    </figure>
  )
}
