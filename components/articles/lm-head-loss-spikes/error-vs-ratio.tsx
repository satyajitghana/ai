"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { RATIO_GROUPS, RATIO_RUNS, THEORY, type RatioKey } from "./deep-data"

// My toy runs, plotted the way the paper's Figure 18 plots its own: the
// normalised logit error RMS(z_native − z_fp32) / std(z_fp32) against the
// relative mean r = |mean(z)| / std(z), one point per logged evaluation. The
// dashed curves are not runs: they round Gaussian logits with the same spread,
// shifted to the same r, once (output rounding only), in BF16 and FP16.

const W = 660
const H = 260
const PL = 44
const PR = 12
const PT = 12
const PB = 28
const XLO = -1
const XHI = 3
const YLO = -5
const YHI = 0.5
const YT: [number, number][] = [[-5, 1e-5], [-4, 1e-4], [-3, 1e-3], [-2, 1e-2], [-1, 0.1], [0, 1]]
const XT: [string, number][] = [["0.1", 0.1], ["1", 1], ["10", 10], ["100", 100], ["1000", 1000]]

export function ErrorVsRatio() {
  const [group, setGroup] = useState(RATIO_GROUPS[0].id)
  const G = RATIO_GROUPS.find((g) => g.id === group) ?? RATIO_GROUPS[0]
  const sx = (r: number) => {
    const v = Math.min(XHI, Math.max(XLO, r > 0 ? mlog10(r) : XLO))
    return PL + ((v - XLO) / (XHI - XLO)) * (W - PL - PR)
  }
  const sy = (e: number) => {
    const v = Math.min(YHI, Math.max(YLO, e > 0 ? mlog10(e) : YLO))
    return PT + ((YHI - v) / (YHI - YLO)) * (H - PT - PB)
  }
  const line = (pts: { r: number; e: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.r).toFixed(1)},${sy(p.e).toFixed(1)}`).join("")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured: error against the relative mean, toy runs</span>
        <span className="font-mono text-[10px] text-muted-foreground">after the paper&apos;s Figure 18, log–log</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {RATIO_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                group === g.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Normalised logit error against relative mean logit for ${G.label}, with BF16 and FP16 rounding curves`}>
          {YT.map(([t, v]) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} className="stroke-border" strokeWidth="0.6" />
              <text x={PL - 5} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                {`1e${t}`}
              </text>
            </g>
          ))}
          {XT.map(([label, v]) => (
            <text key={label} x={sx(v)} y={H - 12} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
              {label}
            </text>
          ))}
          <text x={W - PR} y={H - 1} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
            r = |mean logit| / std
          </text>
          <path d={line(THEORY.bf16)} fill="none" className="stroke-foreground/50" strokeWidth="1" strokeDasharray="4 3" />
          <path d={line(THEORY.fp16)} fill="none" className="stroke-foreground/30" strokeWidth="1" strokeDasharray="1.5 3" />
          {G.keys.map((k: RatioKey) => {
            const run = RATIO_RUNS[k]
            return (
              <g key={k}>
                {run.r.map((r, i) => (
                  <circle key={i} cx={sx(r)} cy={sy(run.e[i])} r={1.8} fill={run.color} fillOpacity={0.75} />
                ))}
              </g>
            )
          })}
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[9px] text-muted-foreground">
          {G.keys.map((k: RatioKey) => (
            <span key={k} style={{ color: RATIO_RUNS[k].color }}>
              ● {RATIO_RUNS[k].label}
            </span>
          ))}
          <span>- - BF16 output rounding</span>
          <span>··· FP16 output rounding</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{G.note}</p>
      </div>
    </figure>
  )
}
