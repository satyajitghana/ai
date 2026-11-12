"use client"

import { useState } from "react"

import { mlog10, mpow } from "@/lib/dmath"

// "Weights touched" three ways, on a log scale, one base model per panel.
// Sources per row (src): "paper" = arXiv 2611.10866 Table 1 (adapter MB);
// "mask" = counted from the published mask on Hugging Face; "shape" = my
// arithmetic from the model's config shapes; "blog" = embedding.in's post.
// Changed counts for LoRA are after merging: B·A is dense, so every entry of
// every adapted matrix moves.

type Row = {
  name: string
  changed: number | null
  trained: number | null
  mb: number | null
  src: string
  note: string
  hl?: boolean
}

const PANELS: { id: string; title: string; rows: Row[] }[] = [
  {
    id: "llama",
    title: "Llama-3-8B-Instruct, GRPO on GSM8K (8,030,261,248 weights)",
    rows: [
      { name: "full fine-tune", changed: 8030261248, trained: 8030261248, mb: 30633, src: "paper; shape", note: "every weight moves; 83.24% GSM8K" },
      { name: "LoRA r=1", changed: 6979321856, trained: 2621440, mb: 10.0, src: "paper; shape", note: "all 7 projections; merged delta is dense; 83.38%" },
      { name: "LoRA r=4", changed: 6979321856, trained: 10485760, mb: 40.0, src: "paper; shape", note: "82.87%" },
      { name: "MTH 99%", changed: 80302612, trained: 80302612, mb: 443.6, src: "paper; shape", note: "random 1% of weights trained; 83.31%" },
      { name: "MTH 99.95%", changed: 4015131, trained: 4015131, mb: 26.6, src: "paper; shape", note: "random 0.05% trained; 83.07%" },
      { name: "Deletion Tuning", changed: 3621710, trained: 1879048192, mb: 8.4, src: "paper; mask", note: "one logit per gate weight while training; 83.55%", hl: true },
    ],
  },
  {
    id: "qwen",
    title: "Qwen3.5-0.8B, the decision skill (873,438,784 weights)",
    rows: [
      { name: "every weight", changed: 873438784, trained: null, mb: null, src: "HF metadata", note: "for scale" },
      { name: "LoRA r=16, every MLP", changed: 263000000, trained: 5308416, mb: null, src: "blog; shape", note: "the post says 263 million; a dense merge is 264,241,152" },
      { name: "closed-form edit", changed: 262144, trained: 262144, mb: null, src: "blog; shape", note: "1,024 x 256 block of one down projection, solved not trained", hl: true },
    ],
  },
]

type Metric = "changed" | "trained" | "mb"
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "changed", label: "weights whose value changes", unit: "weights" },
  { id: "trained", label: "numbers optimised", unit: "params" },
  { id: "mb", label: "bytes to ship (MB)", unit: "MB" },
]

const ACCENT = "oklch(0.64 0.17 40)"
const MONO = "ui-monospace, monospace"
const W = 640
const LX = 150
const RX = W - 84
const ROW = 30

const fmt = (n: number, m: Metric) =>
  m === "mb" ? `${n.toLocaleString("en-US")} MB` : n >= 1e9 ? `${(n / 1e9).toFixed(2)} B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : `${(n / 1e3).toFixed(0)} k`

export function TouchedBars() {
  const [metric, setMetric] = useState<Metric>("changed")
  const lo = metric === "mb" ? -1 : 5
  const hi = metric === "mb" ? 5 : 10
  const x = (v: number) => LX + ((mlog10(v) - lo) / (hi - lo)) * (RX - LX)
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
        <span className="mr-2 font-mono text-xs text-muted-foreground">log scale ·</span>
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetric(m.id)}
            aria-pressed={metric === m.id}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${metric === m.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4 p-3 sm:p-4">
        {PANELS.map((p) => {
          const H = 26 + p.rows.length * ROW + 18
          return (
            <div key={p.id}>
              <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
                <title>
                  {`${p.title}. ${p.rows
                    .map((r) => {
                      const v = r[metric]
                      return `${r.name}: ${v == null ? "not reported" : fmt(v, metric)}`
                    })
                    .join("; ")}.`}
                </title>
                <text x={4} y={14} fontSize={11} fontFamily={MONO} fill="currentColor" fillOpacity={0.75}>
                  {p.title}
                </text>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={x(mpow(10, t))} x2={x(mpow(10, t))} y1={22} y2={H - 16} stroke="currentColor" strokeOpacity={0.1} />
                    <text x={x(mpow(10, t))} y={H - 4} fontSize={9} fontFamily={MONO} textAnchor="middle" fill="currentColor" fillOpacity={0.5}>
                      {metric === "mb" ? (t < 0 ? "0.1" : mpow(10, t).toLocaleString("en-US")) : `1e${t}`}
                    </text>
                  </g>
                ))}
                {p.rows.map((r, i) => {
                  const v = r[metric]
                  const y = 26 + i * ROW
                  return (
                    <g key={r.name}>
                      <text x={LX - 8} y={y + 15} fontSize={11} fontFamily={MONO} textAnchor="end" fill={r.hl ? ACCENT : "currentColor"}>
                        {r.name}
                      </text>
                      {v == null ? (
                        <text x={LX + 4} y={y + 15} fontSize={10} fontFamily={MONO} fill="currentColor" fillOpacity={0.45}>
                          not reported
                        </text>
                      ) : (
                        <>
                          <rect x={LX} y={y + 4} width={Math.max(2, x(v) - LX)} height={16} rx={3} fill={r.hl ? ACCENT : "currentColor"} fillOpacity={r.hl ? 0.85 : 0.28} />
                          <text x={x(v) + 5} y={y + 16} fontSize={10} fontFamily={MONO} fill="currentColor">
                            {fmt(v, metric)}
                          </text>
                        </>
                      )}
                    </g>
                  )
                })}
              </svg>
              <ul className="mt-1 grid gap-0.5 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
                {p.rows.map((r) => (
                  <li key={r.name}>
                    <span style={r.hl ? { color: ACCENT } : undefined}>
                      {r.name}
                    </span>
                    : {r.note} <span className="opacity-70">[{r.src}]</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Accuracies and adapter sizes are the paper&apos;s (Table 1). Deletion Tuning&apos;s changed count is from the
        published mask; LoRA and MTH counts are arithmetic on the model&apos;s shapes. The two panels are different
        models and tasks: compare within a panel, not across.
      </figcaption>
    </figure>
  )
}
