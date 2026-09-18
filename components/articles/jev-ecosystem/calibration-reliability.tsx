"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Real numbers, committed by pngwn/system-one-qwen3.5-4b-scorer-v2b in its own
// metrics.json (val_uncalibrated / val_calibrated, one global temperature
// T=2.35 fit on a held-out validation split): 5,087 validation questions
// across 7 task categories. https://huggingface.co/pngwn/system-one-qwen3.5-4b-scorer-v2b
// Nothing plotted here is interpolated or invented — every (acc, conf, n) is
// read straight from that file. "acc" never changes between the two toggle
// states because temperature scaling divides every logit by the same
// constant, which cannot move the argmax — only how sharp the winner looks.

type Task = {
  name: string
  n: number
  acc: number
  uConf: number
  cConf: number
  uEce: number
  cEce: number
}

const TASKS: Task[] = [
  { name: "choice", n: 1176, acc: 0.6344, uConf: 0.8495, cConf: 0.7051, uEce: 0.2151, cEce: 0.0731 },
  { name: "escalate", n: 341, acc: 0.915, uConf: 0.9352, cConf: 0.8605, uEce: 0.0561, cEce: 0.0663 },
  { name: "noul", n: 227, acc: 0.9427, uConf: 0.9826, cConf: 0.94, uEce: 0.0432, cEce: 0.0251 },
  { name: "review", n: 342, acc: 0.7427, uConf: 0.7977, cConf: 0.694, uEce: 0.0829, cEce: 0.0516 },
  { name: "severity", n: 345, acc: 0.7507, uConf: 0.7757, cConf: 0.6245, uEce: 0.0375, cEce: 0.1263 },
  { name: "team", n: 348, acc: 1.0, uConf: 0.9999, cConf: 0.9996, uEce: 0.0, cEce: 0.0003 },
  { name: "workflow4", n: 2308, acc: 0.8453, uConf: 0.8771, cConf: 0.7971, uEce: 0.032, cEce: 0.0483 },
]

const ALL = { n: 5087, acc: 0.8028, uConf: 0.8755, cConf: 0.7817, uEce: 0.0727, cEce: 0.0221 }

const ACCENT = "oklch(0.72 0.15 195)" // underconfident (below the diagonal, conf < acc)
const WARN = "oklch(0.68 0.16 40)" // overconfident (above the diagonal, conf > acc)

const DOM_LO = 0.58
const DOM_HI = 1.0
const W = 620
const H = 300
const PL = 40
const PR = 14
const PT = 16
const PB = 34

const sx = (v: number) => PL + ((v - DOM_LO) / (DOM_HI - DOM_LO)) * (W - PL - PR)
const sy = (v: number) => H - PB - ((v - DOM_LO) / (DOM_HI - DOM_LO)) * (H - PT - PB)
const r = (n: number) => 3.5 + Math.sqrt(n / ALL.n) * 11

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

export function CalibrationReliability() {
  const [cal, setCal] = useState(false)

  const allConf = cal ? ALL.cConf : ALL.uConf
  const allEce = cal ? ALL.cEce : ALL.uEce

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>pngwn/open-jev — 7 validation categories, 5,087 questions</span>
        <div className="flex gap-0.5 rounded-full border p-0.5" role="group" aria-label="calibration state">
          <button
            type="button"
            onClick={() => setCal(false)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] transition-colors",
              !cal ? "bg-foreground text-background" : "text-muted-foreground"
            )}
          >
            raw logits
          </button>
          <button
            type="button"
            onClick={() => setCal(true)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] transition-colors",
              cal ? "text-background" : "text-muted-foreground"
            )}
            style={cal ? { background: ACCENT } : undefined}
          >
            T = 2.35
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Reliability plot, ${cal ? "temperature-scaled" : "raw"}: aggregate confidence ${pct(allConf)} against 80.3% aggregate accuracy, expected calibration error ${pct(allEce)}.`}
        >
          <line x1={sx(DOM_LO)} y1={sy(DOM_LO)} x2={sx(DOM_HI)} y2={sy(DOM_HI)} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={sx(DOM_HI) - 4} y={sy(DOM_HI) + 12} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
            perfectly calibrated
          </text>

          <line x1={sx(DOM_LO)} y1={sy(DOM_LO)} x2={sx(DOM_LO)} y2={sy(DOM_HI)} stroke="var(--border)" />
          <line x1={sx(DOM_LO)} y1={sy(DOM_LO)} x2={sx(DOM_HI)} y2={sy(DOM_LO)} stroke="var(--border)" />
          <text x={(sx(DOM_LO) + sx(DOM_HI)) / 2} y={H - 6} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
            confidence {"→"}
          </text>
          <text x={12} y={(PT + sy(DOM_LO)) / 2} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono" transform={`rotate(-90 12 ${(PT + sy(DOM_LO)) / 2})`}>
            accuracy {"→"}
          </text>

          {TASKS.map((t) => {
            const conf = cal ? t.cConf : t.uConf
            const over = conf > t.acc
            return (
              <g key={t.name}>
                <circle cx={sx(conf)} cy={sy(t.acc)} r={r(t.n)} fill={over ? WARN : ACCENT} opacity={0.5} />
                <text x={sx(conf)} y={sy(t.acc) - r(t.n) - 4} textAnchor="middle" fontSize={8} className="fill-muted-foreground font-mono">
                  {t.name}
                </text>
              </g>
            )
          })}

          <circle cx={sx(allConf)} cy={sy(ALL.acc)} r={10} fill="none" stroke={allConf > ALL.acc ? WARN : ACCENT} strokeWidth={2.5} />
          <text x={sx(allConf)} y={sy(ALL.acc) + 3} textAnchor="middle" fontSize={8} fontWeight={700} className="fill-foreground font-mono">
            ALL
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="ECE, all" value={pct(allEce)} accent={!cal} />
          <Stat label="accuracy, all" value="80.3%" note="fixed either way" />
          <Stat label="mean confidence" value={pct(allConf)} />
          <Stat label="severity ECE" value={pct(cal ? 0.1263 : 0.0375)} note={cal ? "got worse" : "before scaling"} warn={cal} />
        </div>

        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          Toggle it. Every dot{"’"}s height (accuracy) never moves — dividing every logit by the
          same T cannot change which answer wins, only how sharp the winning probability looks.
          At T=1, six of seven categories sit right of the diagonal (amber, overconfident); at
          T=2.35 the aggregate ECE drops from 7.3% to 2.2%, but most points cross onto the{" "}
          <em>underconfident</em> side, and <code>severity</code> overshoots hardest — its own
          ECE gets worse, 3.8% to 12.6%. One global temperature is a single knob for seven
          different tasks; it helps the biggest one a lot and can hurt a smaller one on the way.
        </p>
      </div>
    </figure>
  )
}

function Stat({
  label,
  value,
  note,
  accent,
  warn,
}: {
  label: string
  value: string
  note?: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div
        className="font-mono text-sm font-semibold tabular-nums"
        style={accent ? { color: ACCENT } : warn ? { color: WARN } : undefined}
      >
        {value}
      </div>
      {note ? <div className="font-mono text-[9px] text-muted-foreground">{note}</div> : null}
    </div>
  )
}
