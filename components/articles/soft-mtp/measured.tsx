"use client"

import { useState } from "react"

import { COST, RANK_167M, RANK_PAPER_1P2B, TRAIN, TRAIN_META, type TrainMetric } from "./data"

// Three things this article measured, in one card. Every number is read from
// the run files in public/articles/soft-mtp/code/: the toy training runs
// (per seed, then the mean), the effective rank of the authors' released 167M
// output heads (the paper's 1.2B values are shown beside it as reported), and
// the CPU cost of one combined loss step at a 50,304-token vocabulary.

type Tab = "train" | "rank" | "cost"

const COLORS: Record<string, string> = {
  ntp: "oklch(0.60 0.02 260)",
  mtp: "oklch(0.58 0.17 30)",
  kl: "oklch(0.58 0.15 250)",
  soft: "oklch(0.60 0.15 160)",
  next: "oklch(0.60 0.02 260)",
  standard: "oklch(0.58 0.17 30)",
}

function HBar({ label, value, max, color, note, sub }: { label: string; value: number; max: number; color: string; note?: string; sub?: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-2 font-mono text-[11px]">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="relative h-4 rounded bg-muted/40">
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color, opacity: 0.85 }} />
      </div>
      <span>
        {note ?? value.toFixed(3)}
        {sub ? <span className="text-muted-foreground"> {sub}</span> : null}
      </span>
    </div>
  )
}

export function Measured() {
  const [tab, setTab] = useState<Tab>("train")
  const [metric, setMetric] = useState<TrainMetric["id"]>(TRAIN.metrics[0].id)
  const m = TRAIN.metrics.find((x) => x.id === metric) as TrainMetric

  const tabs: { id: Tab; label: string }[] = [
    { id: "train", label: "toy training" },
    { id: "rank", label: "output-head rank" },
    { id: "cost", label: "cost of the extra term" },
  ]

  const rows = TRAIN.objectives.filter((o) => o.values[m.id])
  const vals = rows.flatMap((o) => o.values[m.id] as number[])
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = Math.max(hi - lo, 1e-9)
  const pad = span * 0.35
  const x0 = lo - pad
  const x1 = hi + pad
  const px = (v: number) => 140 + ((v - x0) / (x1 - x0)) * 420

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5" role="tablist" aria-label="Measurement">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md border px-2.5 py-1 font-mono text-xs focus-visible:outline focus-visible:outline-2 ${tab === t.id ? "bg-muted/60" : "hover:bg-muted/30"}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">measured</span>
      </div>

      <div className="p-3 sm:p-4">
        {tab === "train" && (
          <div>
            <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{TRAIN_META}</p>
            <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Metric">
              {TRAIN.metrics.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={metric === x.id}
                  onClick={() => setMetric(x.id)}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] focus-visible:outline focus-visible:outline-2 ${metric === x.id ? "bg-muted/60" : "hover:bg-muted/30"}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <svg viewBox={`0 0 600 ${24 + rows.length * 34}`} role="img" className="h-auto w-full">
              <title>
                {`${m.label} for each objective, one dot per seed and a bar at the mean: ${rows.map((o) => `${o.label} ${(o.mean[m.id] as number).toFixed(m.digits)}`).join("; ")}.`}
              </title>
              {rows.map((o, i) => {
                const y = 18 + i * 34
                const mean = o.mean[m.id] as number
                const pts = o.values[m.id] as number[]
                return (
                  <g key={o.id}>
                    <text x={4} y={y + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.75}>
                      {o.label}
                    </text>
                    <line x1={px(x0)} x2={px(x1)} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.1} />
                    <line x1={px(mean)} x2={px(mean)} y1={y - 9} y2={y + 9} stroke={COLORS[o.id]} strokeWidth={3} />
                    {pts.map((v, k) => (
                      <circle key={k} cx={px(v)} cy={y} r={3.5} fill={COLORS[o.id]} fillOpacity={0.55} stroke={COLORS[o.id]} />
                    ))}
                    <text x={px(mean) + 7} y={y - 8} fontSize={9.5} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.8}>
                      {mean.toFixed(m.digits)}
                    </text>
                  </g>
                )
              })}
            </svg>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {m.note} Bar = mean over {TRAIN.seeds} seeds; dots = individual seeds. {m.better}
            </p>
            {TRAIN.snr && (
              <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
                {TRAIN.snr.map(([k, v]) => (
                  <div key={k} className="rounded-lg border px-2.5 py-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {tab === "rank" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-mono text-[11px] text-muted-foreground">authors&apos; released 167M checkpoints · our computation · maximum possible 512</p>
              <div className="space-y-1.5">
                {RANK_167M.map((r) => (
                  <HBar key={r.id} label={r.label} value={r.value} max={512} color={COLORS[r.id]} note={r.value.toFixed(1)} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-mono text-[11px] text-muted-foreground">same quantity at 1.2B parameters · reported in the paper&apos;s Figure 6</p>
              <div className="space-y-1.5">
                {RANK_PAPER_1P2B.map((r) => (
                  <HBar key={r.label} label={r.label} value={r.value} max={512} color={COLORS[r.id]} note={String(r.value)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "cost" && (
          <div>
            <p className="mb-2 font-mono text-[11px] text-muted-foreground">{COST.setup}</p>
            <div className="space-y-1.5">
              {COST.rows.map((r) => (
                <HBar key={r.id} label={r.label} value={r.cpu} max={COST.maxCpu} color={COLORS[r.id]} note={`${r.cpu.toFixed(2)} s`} sub={r.cpuDelta} />
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {COST.rows.map((r) => (
                <HBar key={r.id} label={r.label} value={r.mb} max={COST.maxMb} color={COLORS[r.id]} note={`${r.mbLabel}`} sub={r.mbDelta} />
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{COST.note}</p>
          </div>
        )}
      </div>
    </figure>
  )
}
