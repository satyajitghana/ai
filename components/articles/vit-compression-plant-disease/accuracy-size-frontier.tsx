"use client"

import { useMemo, useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Every point is a number this paper (arXiv 2609.05334) actually reports on the
// 760-image OOD split, pulled from Tables 1, 6, 7, 9 and 13. Two axes the reader
// can switch between: model size (MB, log) and measured CPU latency (Apple M4
// Pro, Core ML; ms, log) -- "accuracy vs. size/latency" as one chart rather than
// two, since the paper's own Table 13 reports both for most rows.
//
// H-BAC's size stays 327.42 MB (mask-based pruning zeroes weights without
// shrinking the file -- Section 4.1); its accuracy gain is real but its "size"
// column is identical to the baseline's by construction, which is itself worth
// seeing on this chart rather than hiding.
//
// The 1.89M-parameter capacity-tier student (Table 9/10, from the constrained-
// search mode) has no CPU latency measurement in the paper -- it is included in
// size view and simply omitted when the metric is switched to latency, rather
// than inventing a number for it.

type Family = "standalone" | "final" | "search"

type Point = {
  key: string
  label: string
  size: number // MB
  cpu: number | null // ms, Apple M4 Pro / Core ML
  acc: number // %
  std?: number // +/- pp, when the paper reports one
  family: Family
  note: string
}

const POINTS: Point[] = [
  { key: "fp32", label: "FP32 baseline", size: 327.42, cpu: 7.18, acc: 95.13, family: "standalone", note: "ViT-B/16, 85.80M params. The reference point everything else is measured against." },
  { key: "hbac", label: "H-BAC alone (50%)", size: 327.42, cpu: 4.27, acc: 95.53, family: "standalone", note: "Same file size as baseline by construction -- mask-based pruning zeroes weights without shrinking the checkpoint. Its real win is 49% fewer FLOPs (not shown on this axis) and, once structurally compacted, faster CPU/GPU inference." },
  { key: "ptqd", label: "PTQ-Dynamic alone", size: 84.42, cpu: 7.21, acc: 94.34, family: "standalone", note: "74% smaller, small accuracy cost, and on this Core ML/M4 Pro setup essentially zero latency change -- weight-only INT8 dequantizes back to float for the matmul." },
  { key: "ptqs", label: "PTQ-Static alone", size: 85.78, cpu: 7.21, acc: 94.61, family: "standalone", note: "The calibrated variant: 0.27pp better than PTQ-Dynamic, within run-to-run noise. The paper uses PTQ-Dynamic throughout for simplicity." },
  { key: "kd", label: "Attention KD alone", size: 21.15, cpu: 1.02, acc: 96.71, std: 1.03, family: "standalone", note: "TinyViT distilled from the FULL (unpruned) teacher. The single strongest standalone result in the paper, on both axes." },
  { key: "pipe-mean", label: "full pipeline (mean, n=4)", size: 6.01, cpu: 1.02, acc: 95.13, std: 2.32, family: "final", note: "H-BAC then Attention KD (from the pruned teacher) then PTQ-Dynamic, averaged over 4 independent runs." },
  { key: "pipe-traced", label: "full pipeline (traced run)", size: 6.01, cpu: 1.02, acc: 91.97, family: "final", note: "The one specific run Table 4 walks stage by stage -- the reproducible number, not the average." },
  { key: "direct", label: "direct-trained, same size", size: 6.01, cpu: 1.02, acc: 94.87, family: "final", note: "TinyViT trained on ground-truth labels only, then PTQ-Dynamic. No H-BAC, no distillation -- same 6.01 MB endpoint." },
  { key: "search", label: "1.89M-param student", size: 7.27, cpu: null, acc: 94.08, family: "search", note: "From the constrained-search mode (Table 9/10): a smaller from-scratch architecture the fixed H-BAC+KD pipeline never considers. No CPU latency reported." },
]

const ACCENT = "oklch(0.6 0.15 255)"
const MUTED = "oklch(0.68 0.02 260)"
const FAMILY = "oklch(0.68 0.14 70)"

const W = 720
const H = 400
const ML = 46
const PR_ = 20
const PT = 34
const PB = 34
const PLOT_W = W - ML - PR_
const PLOT_H = H - PT - PB

const Y_MIN = 90
const Y_MAX = 98

type Metric = "size" | "cpu"

const TICKS: Record<Metric, number[]> = {
  size: [6, 10, 20, 50, 100, 300],
  cpu: [1, 2, 4, 7],
}

function xValue(p: Point, metric: Metric): number | null {
  return metric === "size" ? p.size : p.cpu
}

function computeFrontier(pts: { key: string; x: number; acc: number }[]): Set<string> {
  const sorted = [...pts].sort((a, b) => a.x - b.x || b.acc - a.acc)
  let runningMax = -Infinity
  const onFrontier = new Set<string>()
  for (const p of sorted) {
    if (p.acc > runningMax) {
      onFrontier.add(p.key)
      runningMax = p.acc
    }
  }
  return onFrontier
}

function findDominator(target: { key: string; x: number; acc: number }, pts: { key: string; x: number; acc: number; label: string }[]) {
  let best: (typeof pts)[number] | null = null
  for (const p of pts) {
    if (p.key === target.key) continue
    const dominates = p.x <= target.x && p.acc >= target.acc && (p.x < target.x || p.acc > target.acc)
    if (dominates && (!best || p.acc > best.acc)) best = p
  }
  return best
}

export function AccuracySizeFrontier() {
  const [metric, setMetric] = useState<Metric>("size")
  const [selected, setSelected] = useState("pipe-mean")

  const visible = useMemo(
    () => POINTS.map((p) => ({ p, x: xValue(p, metric) })).filter((v): v is { p: Point; x: number } => v.x !== null),
    [metric]
  )

  const xs = visible.map((v) => v.x)
  const logMin = Math.min(...xs) * 0.82
  const logMax = Math.max(...xs) * 1.25
  const lo = mlog10(logMin)
  const hi = mlog10(logMax)
  const xPos = (v: number) => ML + ((mlog10(v) - lo) / (hi - lo)) * PLOT_W
  const yPos = (acc: number) => PT + (1 - (acc - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H

  const frontierSet = useMemo(() => computeFrontier(visible.map((v) => ({ key: v.p.key, x: v.x, acc: v.p.acc }))), [visible])

  const clusterX = metric === "size" ? 6.01 : 1.02
  const clusterVisible = visible.some((v) => Math.abs(v.x - clusterX) < 1e-6)

  const selPoint = visible.find((v) => v.p.key === selected) ?? visible.find((v) => v.p.key === "pipe-mean") ?? visible[0]
  const isFrontier = selPoint ? frontierSet.has(selPoint.p.key) : false
  const dominator = selPoint && !isFrontier ? findDominator({ key: selPoint.p.key, x: selPoint.x, acc: selPoint.p.acc }, visible.map((v) => ({ key: v.p.key, x: v.x, acc: v.p.acc, label: v.p.label }))) : null
  const dominatorLabel = dominator ? POINTS.find((p) => p.key === dominator.key)?.label : null

  const frontierPath = useMemo(() => {
    const pts = visible.filter((v) => frontierSet.has(v.p.key)).sort((a, b) => a.x - b.x)
    if (pts.length < 2) return ""
    return pts.map((v, i) => `${i === 0 ? "M" : "L"} ${xPos(v.x).toFixed(1)} ${yPos(v.p.acc).toFixed(1)}`).join(" ")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, frontierSet, metric])

  const metricLabel = metric === "size" ? "model size (MB)" : "CPU latency (ms, Apple M4 Pro)"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">accuracy vs. {metricLabel} &middot; OOD split, Tables 1/6/7/9/13</span>
        <div className="flex items-center gap-1.5">
          {(["size", "cpu"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === m ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "size" ? "size (MB)" : "CPU latency (ms)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Accuracy plotted against ${metricLabel}, log scale, for every configuration this paper reports; ${selPoint?.p.label ?? ""} is currently selected`}
        >
          {[90, 92, 94, 96, 98].map((g) => (
            <g key={g}>
              <line x1={ML} x2={W - PR_} y1={yPos(g)} y2={yPos(g)} stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.5} />
              <text x={ML - 8} y={yPos(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
                {g}
              </text>
            </g>
          ))}
          {TICKS[metric].map((t) => (
            <text key={t} x={xPos(t)} y={H - PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
              {t}
            </text>
          ))}
          <text x={ML} y={14} className="fill-muted-foreground font-mono" fontSize={9}>
            accuracy (%) ↑
          </text>
          <text x={W - PR_} y={H - 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            {metric === "size" ? "smaller ←  → larger" : "faster ←  → slower"}
          </text>

          {clusterVisible && (
            <g>
              <rect x={xPos(clusterX) - 14} y={PT} width={28} height={PLOT_H} fill={FAMILY} opacity={0.07} />
              <text x={xPos(clusterX) + 20} y={PT + 12} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={8}>
                ← same final {metric === "size" ? "size" : "latency"}
              </text>
            </g>
          )}

          {frontierPath && <path d={frontierPath} fill="none" stroke={ACCENT} strokeWidth={1.25} strokeDasharray="4 3" opacity={0.5} />}

          {visible.map((v) => {
            const { p, x } = v
            const cx = xPos(x)
            const cy = yPos(p.acc)
            const isSel = selected === p.key
            const onFrontier = frontierSet.has(p.key)
            const fill = onFrontier ? ACCENT : MUTED
            const stroke = p.family !== "standalone" ? FAMILY : "var(--border)"
            const r = isSel ? 7 : onFrontier ? 6 : 4.5
            return (
              <g
                key={p.key}
                onClick={() => setSelected(p.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelected(p.key)
                }}
                className="cursor-pointer outline-none"
              >
                {p.std !== undefined && (
                  <line x1={cx} x2={cx} y1={yPos(p.acc - p.std)} y2={yPos(p.acc + p.std)} stroke={fill} strokeWidth={1.25} opacity={0.4} />
                )}
                <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
                <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={onFrontier ? 0.92 : 0.55} stroke={stroke} strokeWidth={isSel ? 2.25 : 1.5} />
                {isSel && (
                  <text x={cx} y={cy - r - 6} textAnchor="middle" className="fill-foreground font-mono" fontSize={9} fontWeight={600}>
                    {p.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: ACCENT }} /> on the Pareto frontier
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: MUTED }} /> dominated
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full border align-middle" style={{ borderColor: FAMILY }} /> same 6.01&nbsp;MB / 1.02&nbsp;ms family
          </span>
        </div>

        {selPoint && (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            <span className="text-foreground">{selPoint.p.label}</span>: {selPoint.p.acc.toFixed(2)}
            {selPoint.p.std !== undefined ? ` ± ${selPoint.p.std.toFixed(2)}` : ""}% accuracy at{" "}
            {selPoint.p.size.toFixed(2)} MB{selPoint.p.cpu !== null ? `, ${selPoint.p.cpu.toFixed(2)} ms CPU` : ", no CPU latency reported"}.{" "}
            {selPoint.p.note}{" "}
            {isFrontier ? (
              <>On the {metricLabel} frontier: nothing at this {metric === "size" ? "size" : "latency"} or better reaches its accuracy.</>
            ) : dominatorLabel ? (
              <>
                Dominated here by <span className="text-foreground">{dominatorLabel}</span>: equal-or-better {metric === "size" ? "size" : "latency"} and
                strictly higher accuracy.
              </>
            ) : null}
          </p>
        )}
      </div>
    </figure>
  )
}
