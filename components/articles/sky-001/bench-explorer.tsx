"use client"

// SKY-001's two construction benchmarks, as Skyfall published them, from both
// places it published them.
//
// Sources, read on 2026-10-23 (REPORTED: none of this was re-run):
//   blog     skyfall.ai/blog/introducing-sky-001, section 06 "Performance",
//            the bar charts' own labels (article chunk article-D6mnIEDb.js).
//   landing  skyfall.ai/sky-001, the benchmark section's data rows
//            (index-D5BqB7X_.js, the `rows` arrays under "3D Construction
//            World Model" and "BIM Construction World Model").
// The two disagree on which models were in the CAD comparison: the blog chart
// has Gemini 4 and no Claude Opus 5.5; the landing page has Opus 5.5 and
// Gemini 3.8 Flash and no Gemini 4. BIM rows agree to a tenth of a second.
// The "x vs SKY-001" column is REASONED: other model / SKY-001, computed here.
//
// SSR-safe: plain state, no effects, no browser APIs. Bar widths use * and /
// only, so server and client serialize the same strings.

import { useState } from "react"

type Row = { model: string; iou: number | null; s: number; usd: number; ours?: boolean }
type Task = "cad" | "bim"
type Source = "blog" | "landing"
type Metric = "iou" | "s" | "usd"

const DATA: Record<Task, Record<Source, Row[]>> = {
  cad: {
    blog: [
      { model: "SKY-001", iou: 79.7, s: 3.9, usd: 0.005, ours: true },
      { model: "GPT-6 Astra", iou: 79.1, s: 199, usd: 0.75 },
      { model: "Gemini 4", iou: 76.9, s: 253, usd: 0.25 },
      { model: "Qwen 3.8 Max", iou: 34.4, s: 764, usd: 0.3 },
      { model: "Kimi K3", iou: 9.5, s: 439, usd: 0.13 },
      { model: "Grok 4.7", iou: null, s: 1250, usd: 0.59 },
    ],
    landing: [
      { model: "SKY-001", iou: 79.7, s: 3.9, usd: 0.005, ours: true },
      { model: "GPT-6 Astra", iou: 79.1, s: 199, usd: 0.75 },
      { model: "Opus 5.5", iou: 69.4, s: 110, usd: 0.31 },
      { model: "Gemini 3.8 Flash", iou: 54.7, s: 112, usd: 0.08 },
      { model: "Qwen 3.8 Max", iou: 34.4, s: 764, usd: 0.3 },
      { model: "Kimi K3", iou: 9.5, s: 439, usd: 0.13 },
      { model: "Grok 4.7", iou: null, s: 1250, usd: 0.59 },
    ],
  },
  bim: {
    blog: [
      { model: "SKY-001", iou: 43.6, s: 1.22, usd: 0.0024, ours: true },
      { model: "GPT-6 Astra", iou: 40.6, s: 144.6, usd: 0.446 },
      { model: "Gemini 3.8 Flash", iou: 42.3, s: 346.2, usd: 0.218 },
      { model: "Qwen 3.8 Max", iou: 28.8, s: 255.3, usd: 0.111 },
      { model: "Kimi K3", iou: 33.7, s: 113.9, usd: 0.27 },
      { model: "Grok 4.7", iou: 28.2, s: 592.1, usd: 0.305 },
    ],
    landing: [
      { model: "SKY-001", iou: 43.6, s: 1.22, usd: 0.00237, ours: true },
      { model: "GPT-6 Astra", iou: 40.6, s: 144.4, usd: 0.4465 },
      { model: "Opus 5.5", iou: 34.4, s: 113.1, usd: 0.276 },
      { model: "Gemini 3.8 Flash", iou: 42.3, s: 345.4, usd: 0.2185 },
      { model: "Qwen 3.8 Max", iou: 28.8, s: 254.5, usd: 0.111 },
      { model: "Kimi K3", iou: 33.7, s: 114, usd: 0.27 },
      { model: "Grok 4.7", iou: 28.2, s: 592.3, usd: 0.305 },
    ],
  },
}

const METRICS: { key: Metric; label: string; note: string }[] = [
  { key: "iou", label: "IoU", note: "higher is better" },
  { key: "s", label: "Seconds per case", note: "lower is better" },
  { key: "usd", label: "Dollars per case", note: "lower is better" },
]

const OURS = "#2A6F97"
const THEM = "#9AA5B1"

function fmtVal(m: Metric, v: number | null): string {
  if (v === null) return "no output"
  if (m === "iou") return `${v.toFixed(1)}%`
  if (m === "s") return v < 10 ? `${v.toFixed(2)} s` : `${v.toFixed(1)} s`
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`
}

function Tabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={label}>
      <span className="mr-1 font-mono text-[11px] text-muted-foreground">{label}</span>
      {options.map(([k, text]) => {
        const on = value === k
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(k)}
            className={
              "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
              (on ? "text-white" : "bg-background/50 text-muted-foreground hover:text-foreground")
            }
            style={on ? { background: OURS, borderColor: OURS } : undefined}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}

export function BenchExplorer() {
  const [task, setTask] = useState<Task>("cad")
  const [source, setSource] = useState<Source>("blog")
  const [metric, setMetric] = useState<Metric>("iou")

  const rows = DATA[task][source]
  const sky = rows[0]
  const max = Math.max(...rows.map((r) => (metric === "iou" ? 100 : r[metric] ?? 0)))
  const missing = DATA[task][source === "blog" ? "landing" : "blog"]
    .map((r) => r.model)
    .filter((m) => !rows.some((r) => r.model === m))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>SKY-001 construction benchmarks, 1,000 cases each</span>
        <span className="text-muted-foreground/70">reported by Skyfall, not re-run</span>
      </div>

      <div className="space-y-2.5 p-4 sm:p-5">
        <Tabs
          label="task"
          value={task}
          onChange={setTask}
          options={[
            ["cad", "CAD parts"],
            ["bim", "BIM floor plans"],
          ] as const}
        />
        <Tabs
          label="page"
          value={source}
          onChange={setSource}
          options={[
            ["blog", "blog chart"],
            ["landing", "launch page"],
          ] as const}
        />
        <Tabs
          label="metric"
          value={metric}
          onChange={setMetric}
          options={METRICS.map((m) => [m.key, m.label] as const)}
        />

        <div className="mt-3 space-y-1.5">
          {rows.map((r) => {
            const v = metric === "iou" ? r.iou : r[metric]
            const w = v === null ? 0 : (v / max) * 100
            let ratio = ""
            if (!r.ours && metric !== "iou") {
              const x = (r[metric] as number) / (sky[metric] as number)
              ratio = `${x.toFixed(0)}x`
            } else if (!r.ours && metric === "iou" && r.iou !== null && sky.iou !== null) {
              const d = sky.iou - r.iou
              ratio = `${d >= 0 ? "+" : ""}${d.toFixed(1)} pt`
            }
            return (
              <div key={r.model} className="grid grid-cols-[7.5rem_1fr] items-center gap-2 sm:grid-cols-[9.5rem_1fr]">
                <div className={"truncate font-mono text-[11px] " + (r.ours ? "font-semibold" : "")}>{r.model}</div>
                <div className="flex items-center gap-2">
                  <div className="h-3.5 flex-1 rounded bg-muted/50">
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.max(w, v === null ? 0 : 0.6).toFixed(2)}%`, background: r.ours ? OURS : THEM }}
                    />
                  </div>
                  <span className="w-[5.2rem] shrink-0 text-right font-mono text-[11px] tabular-nums">{fmtVal(metric, v)}</span>
                  <span className="w-[3.6rem] shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {ratio}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {METRICS.find((m) => m.key === metric)?.note}. Right column: SKY-001 minus the model in IoU points, or the
          model divided by SKY-001 for time and cost (my arithmetic).
          {missing.length > 0 ? ` The other page also lists: ${missing.join(", ")}.` : ""}
        </p>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Two pages, one launch. In CAD the blog chart and the launch page agree on SKY-001 and GPT-6 Astra but not on who
        else was tested. In BIM they agree on every IoU, but SKY-001 leads the next model by 1.3 points, not 3.0. Bars on
        time and cost are linear, so SKY-001&apos;s bar is a sliver.
      </figcaption>
    </figure>
  )
}
