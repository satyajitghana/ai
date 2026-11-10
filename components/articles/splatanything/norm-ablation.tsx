"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ABLATION, DATASETS, TABLE1, VIEWS } from "./data"

// The paper's numbers, two ways. "By views" plots Table 12 (Table 3 for the
// scale-calibration row): one architecture, one training recipe, four
// normalization spaces, six input-view counts. "By dataset" plots Table 1's
// RGB-only rows for SplatAnything against Mirror2-GS, the same WorldMirror 2.0
// base with its own Gaussian head. Lower is better everywhere. All values are
// reported by the paper; nothing here is my measurement.

const W = 640
const H = 280
const L = 48
const R = 150
const T = 18
const B = 34

const COLORS: Record<string, string> = {
  RD: "text-orange-500",
  RDcal: "text-amber-400",
  CD: "text-sky-500",
  D: "text-violet-500",
  GS: "text-emerald-500",
}

type Metric = "dists" | "lpips"

const legendRow = (id: string) => ABLATION.findIndex((r) => r.id === id)

export function NormAblation() {
  const [tab, setTab] = useState<"views" | "data">("views")
  const [metric, setMetric] = useState<Metric>("lpips")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>{tab === "views" ? "normalization ablation (Tables 3, 12)" : "SplatAnything vs Mirror2-GS (Table 1)"}</span>
        <span className="text-muted-foreground/60">reported · lower is better</span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {(
          [
            ["views", "by input views"],
            ["data", "by dataset"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              tab === id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {(["lpips", "dists"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase transition-colors",
              metric === m ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">{tab === "views" ? <ByViews metric={metric} /> : <ByData metric={metric} />}</div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        {tab === "views" ? (
          <>
            Same architecture and training, only the normalization space changes. GSNorm is lowest at every view count, by
            3-13%. Rescaling RDNorm&apos;s predicted scales after the fact (scale calibration) is worse than not
            calibrating at all. CDNorm at one view is off the chart (DISTS 0.793, LPIPS 1.027): with a single camera there
            is no camera distance to normalize by.
          </>
        ) : (
          <>
            RGB-only rows, averaged over 4-64 input views. Mirror2-GS is the closest baseline: the same frozen WorldMirror
            2.0 geometry, its own Gaussian head, its own normalization. The ETH3D LPIPS column (0.049 vs 0.070) sits an
            order of magnitude below every other LPIPS value in the table; I report it as printed.
          </>
        )}
      </figcaption>
    </figure>
  )
}

function ByViews({ metric }: { metric: Metric }) {
  const lo = metric === "dists" ? 0.18 : 0.22
  const hi = metric === "dists" ? 0.33 : 0.42
  const x = (i: number) => L + (i / (VIEWS.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (Math.min(v, hi) - lo) / (hi - lo)) * (H - T - B)
  const ticks = metric === "dists" ? [0.2, 0.25, 0.3] : [0.25, 0.3, 0.35, 0.4]
  const desc = `Table 12 ${metric.toUpperCase()} for five normalization variants over 1 to 64 input views; GSNorm is lowest throughout.`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label={desc}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.1} className="text-muted-foreground" />
          <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {VIEWS.map((v, i) => (
        <text key={v} x={x(i)} y={H - 12} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
          {v} {v === 1 ? "view" : "views"}
        </text>
      ))}
      {ABLATION.map((row) => {
        const vals = row[metric]
        const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")
        return (
          <g key={row.id} className={COLORS[row.id]}>
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={row.id === "GS" ? 2.5 : 1.5} strokeDasharray={row.id === "RDcal" ? "4 3" : undefined} />
            {vals.map((v, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(v)} r={row.id === "GS" ? 3.5 : 2.5} fill="currentColor" />
                {v > hi && (
                  <text x={x(i) + 6} y={y(v) + 10} fontSize={9} className="fill-current font-mono">
                    {v.toFixed(3)} ↑
                  </text>
                )}
              </g>
            ))}
            <line x1={W - R + 10} x2={W - R + 26} y1={T + 10 + legendRow(row.id) * 18} y2={T + 10 + legendRow(row.id) * 18} stroke="currentColor" strokeWidth={2.5} strokeDasharray={row.id === "RDcal" ? "4 3" : undefined} />
            <text x={W - R + 32} y={T + 13 + legendRow(row.id) * 18} fontSize={10} className="fill-current font-mono">
              {row.label.replace(" + scale calibration", " + calib.")}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ByData({ metric }: { metric: Metric }) {
  const ours = TABLE1.ours[metric]
  const base = TABLE1.mirror2[metric]
  const max = Math.max(...ours, ...base)
  const rowH = 34
  const h = 14 + rowH * DATASETS.length
  const L2 = 120
  const R2 = 70
  const bx = (v: number) => (v / max) * (W - L2 - R2)
  const desc = `Table 1 ${metric.toUpperCase()} per dataset, SplatAnything against Mirror2-GS, RGB-only.`
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full min-w-[520px]" role="img" aria-label={desc}>
      {DATASETS.map((d, i) => {
        const y0 = 8 + i * rowH
        const gain = ((base[i] - ours[i]) / base[i]) * 100
        return (
          <g key={d}>
            <text x={L2 - 10} y={y0 + 14} textAnchor="end" fontSize={11} className="fill-foreground">
              {d}
            </text>
            <rect x={L2} y={y0 + 2} width={bx(base[i])} height={10} rx={2} className="fill-muted-foreground/40" />
            <rect x={L2} y={y0 + 14} width={bx(ours[i])} height={10} rx={2} className="fill-emerald-500" />
            <text x={L2 + bx(base[i]) + 5} y={y0 + 11} fontSize={9} className="fill-muted-foreground font-mono">
              {base[i].toFixed(3)}
            </text>
            <text x={L2 + bx(ours[i]) + 5} y={y0 + 23} fontSize={9} className="fill-foreground font-mono">
              {ours[i].toFixed(3)} (−{gain.toFixed(1)}%)
            </text>
          </g>
        )
      })}
    </svg>
  )
}
