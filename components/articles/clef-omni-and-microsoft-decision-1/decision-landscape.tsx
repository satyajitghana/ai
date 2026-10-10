"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { BOARD, JEV, MD1_PARAMS_B } from "./board"

// Every Decision Index 0.3.1 entrant with a known parameter count, plotted as size
// against score. Scores and sizes are the board's own (data/v03.json, data/index.json);
// nothing here is my measurement. Microsoft-Decision-1 has no score, so it sits under
// the axis at its base model's size.

type Metric = "full" | "pub" | "both"

const W = 640
const H = 380
const L = 48
const R = 16
const T = 14
const B = 66
const XMIN = 0.1
const XMAX = 50
const YMAX = 70

const COLOR: Record<string, string> = {
  hi: "#F38020",
  cf: "#F5B37A",
  rival: "#7C3AED",
  ms: "#2563EB",
  site: "#0F766E",
}

const LEGEND: [string, string][] = [
  ["hi", "Clef-omni"],
  ["cf", "Clef, clef-flash"],
  ["rival", "d1-omni-600M"],
  ["ms", "in Microsoft's chart"],
  ["site", "covered on this site"],
]

function x(p: number): number {
  const t = (mlog10(p) - mlog10(XMIN)) / (mlog10(XMAX) - mlog10(XMIN))
  return L + t * (W - L - R)
}
function y(s: number): number {
  return T + (1 - s / YMAX) * (H - T - B)
}
function f(n: number): string {
  return n.toFixed(1)
}

const XTICKS = [0.1, 0.3, 1, 3, 10, 30]
const YTICKS = [0, 10, 20, 30, 40, 50, 60, 70]

export function DecisionLandscape() {
  const [metric, setMetric] = useState<Metric>("full")
  const [sel, setSel] = useState<string>("Clef-omni")

  const named = BOARD.filter((r) => r[4] !== "")
  const row = BOARD.find((r) => r[0] === sel)
  const score = (r: (typeof BOARD)[number]) => (metric === "pub" ? r[3] : r[2])
  const rank = row
    ? BOARD.filter((r) => score(r) > score(row)).length + 1
    : 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Decision Index 0.3.1 · {BOARD.length} entrants with a known size · the board&apos;s numbers, 10 Oct 2026
      </div>

      <div className="flex flex-wrap gap-2 border-b p-3" role="group" aria-label="Score shown">
        {(
          [
            ["full", "full score"],
            ["pub", "public tests only"],
            ["both", "public → full"],
          ] as [Metric, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMetric(id)}
            aria-pressed={metric === id}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              metric === id ? "bg-foreground text-background" : "hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Decision Index score against parameter count">
          {YTICKS.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-muted-foreground/15" />
              <text x={L - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[12px]">
                {t}
              </text>
            </g>
          ))}
          {XTICKS.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={T} y2={H - B} className="stroke-muted-foreground/15" />
              <text x={x(t)} y={H - B + 16} textAnchor="middle" className="fill-muted-foreground font-mono text-[12px]">
                {t}B
              </text>
            </g>
          ))}
          <text x={(L + W - R) / 2} y={H - B + 32} textAnchor="middle" className="fill-muted-foreground font-mono text-[12px]">
            parameters the board served (log scale)
          </text>

          <line
            x1={L}
            x2={W - R}
            y1={y(metric === "pub" ? JEV.pub : JEV.full)}
            y2={y(metric === "pub" ? JEV.pub : JEV.full)}
            strokeDasharray="4 3"
            className="stroke-foreground/60"
          />
          <text x={L + 4} y={y(metric === "pub" ? JEV.pub : JEV.full) - 4} className="fill-foreground font-mono text-[12px]">
            Jev {f(metric === "pub" ? JEV.pub : JEV.full)} (size undisclosed)
          </text>

          {BOARD.filter((r) => r[4] === "").map((r) => (
            <circle key={r[0]} cx={x(r[1])} cy={y(score(r))} r={2.6} className="fill-muted-foreground/35" />
          ))}

          {named.map((r) => {
            const c = COLOR[r[4]]
            const on = r[0] === sel
            return (
              <g key={r[0]} onClick={() => setSel(r[0])} className="cursor-pointer">
                {metric === "both" ? (
                  <line x1={x(r[1])} x2={x(r[1])} y1={y(r[3])} y2={y(r[2])} stroke={c} strokeWidth={on ? 2.5 : 1.5} />
                ) : null}
                {metric === "both" ? <circle cx={x(r[1])} cy={y(r[3])} r={2.5} fill="none" stroke={c} /> : null}
                <circle cx={x(r[1])} cy={y(score(r))} r={on ? 6 : 4.2} fill={c} stroke={on ? "currentColor" : "none"} strokeWidth={1.5} />
                {on || r[4] === "hi" || r[4] === "rival" ? (
                  <text
                    x={x(r[1]) + (r[1] > 15 ? -8 : 8)}
                    y={y(score(r)) + 3}
                    textAnchor={r[1] > 15 ? "end" : "start"}
                    className="fill-foreground font-mono text-[13px] font-semibold"
                  >
                    {r[0]} {f(score(r))}
                  </text>
                ) : null}
              </g>
            )
          })}

          <g>
            <line x1={x(MD1_PARAMS_B)} x2={x(MD1_PARAMS_B)} y1={H - B + 38} y2={H - B + 46} className="stroke-foreground" />
            <circle cx={x(MD1_PARAMS_B)} cy={H - B + 54} r={4.5} fill="none" stroke="#65A30D" strokeWidth={2} />
            <text x={x(MD1_PARAMS_B) - 9} y={H - B + 58} textAnchor="end" className="fill-foreground font-mono text-[12px]">
              Microsoft-Decision-1, 9.65B base: no board score
            </text>
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 font-mono text-[10px]">
        {LEGEND.map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full" style={{ background: COLOR[k] }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="inline-block size-2.5 rounded-full bg-muted-foreground/35" />
          other entrants
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t p-3" role="group" aria-label="Pick a model">
        {named.map((r) => (
          <button
            key={r[0]}
            type="button"
            onClick={() => setSel(r[0])}
            aria-pressed={sel === r[0]}
            className={cn(
              "cursor-pointer rounded border px-2 py-0.5 font-mono text-[10px]",
              sel === r[0] ? "bg-foreground text-background" : "hover:bg-muted"
            )}
          >
            {r[0]}
          </button>
        ))}
      </div>

      {row ? (
        <div className="border-t px-3 py-2 font-mono text-[11px]">
          <strong>{row[0]}</strong>: {row[1] >= 1 ? `${f(row[1])}B` : `${Math.round(row[1] * 1000)}M`} parameters
          {" · "}full {f(row[2])} · public {f(row[3])} · public minus full {f(row[3] - row[2])}
          {metric !== "both" ? ` · ${rank} of ${BOARD.length} here on this score` : ""}
        </div>
      ) : null}

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        The full score is 20% public benchmarks, 50% private tests of the same skills and 30% private tasks from
        new domains. Switch to &quot;public → full&quot;: most entrants barely move (the board&apos;s median drop
        is 1.1 points), while all three Cloudflare models lose 7 to 9. Clef-omni, at 31.8B, scores 49.3; d1-omni,
        at 587M, scores 9.5.
      </figcaption>
    </figure>
  )
}
