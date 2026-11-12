"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { BASELINES, EXIT, loopTF, NATIVE, PAPER_TF_16 } from "./data"

// The loop dial. Accuracy is only ever a printed point: Figure 8's five re-gridded budgets (with the
// early-exit decode at the same step beside them) and the baselines' five-benchmark means from
// Tables 1 and 2. Compute at 24 views is Table 3's 75.9 TFLOPs at K = 16 minus my modelled cost of each
// loop removed; the views slider only re-runs my FLOP model of one loop.

const KS = [8, 10, 12, 14, 16] as const
type Metric = "auc3" | "auc30" | "rel"
const METRICS: { id: Metric; label: string; better: "high" | "low"; fmt: (v: number) => string }[] = [
  { id: "auc3", label: "pose AUC@3", better: "high", fmt: (v) => v.toFixed(3) },
  { id: "auc30", label: "pose AUC@30", better: "high", fmt: (v) => v.toFixed(3) },
  { id: "rel", label: "pointmap Rel. L2", better: "low", fmt: (v) => v.toFixed(4) },
]

const OURS = "oklch(0.62 0.16 35)"
const EXITC = "oklch(0.75 0.08 35)"
const BASE = "oklch(0.62 0.07 255)"

export function LoopDial() {
  const [k, setK] = useState<number>(8)
  const [metric, setMetric] = useState<Metric>("auc3")
  const [views, setViews] = useState(24)

  const per24 = loopTF(24).total
  const tf = PAPER_TF_16 - (16 - k) * per24
  const m = METRICS.find((x) => x.id === metric) ?? METRICS[0]
  const ours = NATIVE[k][metric]
  const exit = EXIT[k][metric]

  const tfRows = [
    { name: `Déjà View, K=${k}`, tf, ours: true },
    ...BASELINES.map((b) => ({ name: b.name, tf: b.tf, ours: false })),
  ]
  const tfMax = 200

  const accRows = [
    { name: `Déjà View, K=${k} grid`, v: ours, kind: "ours" as const },
    { name: `16-step pass, exit at ${k}`, v: exit, kind: "exit" as const },
    ...BASELINES.map((b) => ({ name: b.name, v: b[metric], kind: "base" as const })),
  ].sort((a, b) => (m.better === "high" ? b.v - a.v : a.v - b.v))
  const accMax = metric === "rel" ? 0.1 : 1
  const beaten = BASELINES.filter((b) => (m.better === "high" ? ours >= b[metric] : ours <= b[metric])).length

  const lp = loopTF(views)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        loop dial · accuracy from the paper (Figure 8, Tables 1–3) · FLOPs below K=16 and the per-loop split are my model
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="w-24 shrink-0 font-mono text-muted-foreground">loops K</span>
          {KS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setK(v)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono tabular-nums",
                v === k ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {v}
            </button>
          ))}
          <span className="ml-auto flex gap-1">
            {METRICS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setMetric(x.id)}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono",
                  x.id === metric ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {x.label}
              </button>
            ))}
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="text-muted-foreground">forward TFLOPs, 24 views</div>
            {tfRows.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className={cn("w-32 shrink-0 truncate", r.ours && "font-semibold")}>{r.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full" style={{ width: `${((r.tf / tfMax) * 100).toFixed(1)}%`, background: r.ours ? OURS : BASE }} />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums">{r.tf.toFixed(1)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="text-muted-foreground">
              {m.label}, five-benchmark mean ({m.better === "high" ? "higher" : "lower"} is better)
            </div>
            {accRows.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className={cn("w-32 shrink-0 truncate", r.kind === "ours" && "font-semibold")}>{r.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full"
                    style={{
                      width: `${(Math.min(1, r.v / accMax) * 100).toFixed(1)}%`,
                      background: r.kind === "ours" ? OURS : r.kind === "exit" ? EXITC : BASE,
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums">{m.fmt(r.v)}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          At K={k}, Déjà View is modelled at{" "}
          <b className="text-foreground tabular-nums">{tf.toFixed(1)}</b>{" "}
          TFLOPs and is at least as good as{" "}
          <b className="text-foreground tabular-nums">{beaten}</b>{" "}
          of the six baselines on {m.label}. Stopping a 16-step pass at step {k} instead gives {m.fmt(exit)}.
        </p>

        <div className="space-y-2 border-t pt-3">
          <label className="flex items-center gap-3 text-xs">
            <span className="w-24 shrink-0 font-mono text-muted-foreground">views</span>
            <Range min={2} max={64} step={1} value={views} onChange={(e) => setViews(Number(e.target.value))} aria-label="views" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{views}</span>
          </label>
          <div className="flex h-4 overflow-hidden rounded font-mono text-[10px]">
            <div style={{ width: `${((lp.linear / lp.total) * 100).toFixed(1)}%`, background: "oklch(0.7 0.1 150)" }} />
            <div style={{ width: `${((lp.frame / lp.total) * 100).toFixed(1)}%`, background: "oklch(0.75 0.12 90)" }} />
            <div style={{ width: `${((lp.global / lp.total) * 100).toFixed(1)}%`, background: OURS }} />
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
            <span>
              one loop:{" "}
              <b className="text-foreground tabular-nums">{lp.total.toFixed(2)}</b>{" "}
              TF
            </span>
            <span>linear {((lp.linear / lp.total) * 100).toFixed(0)}%</span>
            <span>frame attention {((lp.frame / lp.total) * 100).toFixed(0)}%</span>
            <span>global attention {((lp.global / lp.total) * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Pick a loop count and a metric. Accuracy for Déjà View is the paper&apos;s Figure 8 (values from its SVG); baselines are
        my means of Tables 1 and 2; baseline FLOPs are Table 3, measured at 24 views only. The views slider redraws one loop of my
        FLOP model (square 504 px inputs, 1,301 tokens per view): global attention grows with the square of the view count.
      </figcaption>
    </figure>
  )
}
