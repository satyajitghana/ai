"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { AUDIT, DOMAINS, MASKED, PREFIX } from "./data"

// Two ways the toy detector raises a false alarm, both measured. Left: the same
// probe with all features, with the 31 whose top token is only whitespace or
// punctuation removed, and with the one newline feature removed. Right: the probe
// is read on the first k tokens of each held-out document, pooled over three domains.

const ACCENT = "oklch(0.62 0.16 35)"
const WARN = "oklch(0.60 0.15 255)"
const SETS = [
  { id: "all", label: "all 148 features" },
  { id: "only_684_off", label: "newline feature off" },
  { id: "format_off", label: "format features off" },
] as const

const W = 520
const H = 190
const PX = 38
const PY = 14
const PW = W - PX - 12
const PH = H - PY - 30
const sx = (k: number) => PX + (k / (PREFIX.length - 1)) * PW
const YMIN = -4
const YMAX = 6
const sy = (y: number) => PY + PH - ((y - YMIN) / (YMAX - YMIN)) * PH

export function FalseAlarms() {
  const [set, setSet] = useState<(typeof SETS)[number]["id"]>("all")
  const [k, setK] = useState(2)
  const m = MASKED[set]
  const p = PREFIX[k]
  const line = (key: "humanLogit" | "aiLogit") => PREFIX.map((q, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)} ${sy(q[key]).toFixed(1)}`).join(" ")
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where the false alarms come from · toy detector · measured</span>
        <span className="font-mono text-xs">threshold {AUDIT.threshold.toFixed(2)}</span>
      </div>
      <div className="grid gap-6 p-3 sm:p-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Feature set">
            {SETS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === set}
                onClick={() => setSet(s.id)}
                className={`rounded-md border px-2 py-1 font-mono text-[11px] ${s.id === set ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="space-y-3 font-mono text-[11px]">
            {DOMAINS.map((d) => {
              const c = m.test[d.id]
              return (
                <div key={d.id}>
                  <div className="text-muted-foreground">{d.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="relative h-3 flex-1 rounded bg-muted/25">
                      <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${c.fpr * 100}%`, background: WARN }} />
                    </span>
                    <span className="w-28 text-right">humans flagged {(c.fpr * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    AI caught {(c.tpr * 100).toFixed(0)}% · AUC {c.auc.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            {m.kept} features kept, {m.nonzero} with weight, AUC {m.valAuc.toFixed(3)} on training domains.
          </p>
        </div>
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
            <title>
              Mean detector logit against the number of tokens read, for human and AI documents. AI text rises from -1.8 at 8 tokens to 4.5 at 128; human text
              from -2.4 to -0.8. The decision threshold sits at -0.20.
            </title>
            {[-4, 0, 4].map((t) => (
              <g key={t}>
                <line x1={PX} x2={PX + PW} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.12} />
                <text x={PX - 6} y={sy(t) + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                  {t}
                </text>
              </g>
            ))}
            <line x1={PX} x2={PX + PW} y1={sy(AUDIT.threshold)} y2={sy(AUDIT.threshold)} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="4 3" />
            {PREFIX.map((q, i) => (
              <text key={q.tokens} x={sx(i)} y={H - 14} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {q.tokens}
              </text>
            ))}
            <text x={PX + PW / 2} y={H - 2} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
              tokens read
            </text>
            <path d={line("aiLogit")} fill="none" stroke={ACCENT} strokeWidth={2} />
            <path d={line("humanLogit")} fill="none" stroke={WARN} strokeWidth={2} />
            <line x1={sx(k)} x2={sx(k)} y1={PY} y2={PY + PH} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="3 3" />
            <circle cx={sx(k)} cy={sy(p.aiLogit)} r={4.5} fill={ACCENT} />
            <circle cx={sx(k)} cy={sy(p.humanLogit)} r={4.5} fill={WARN} />
          </svg>
          <label className="flex items-center gap-3 font-mono text-xs">
            <span className="text-muted-foreground">tokens</span>
            <Range min={0} max={PREFIX.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Tokens read" accent={ACCENT} />
          </label>
          <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
            {[
              ["AUC", p.auc.toFixed(2)],
              ["AI caught", `${(p.tpr * 100).toFixed(0)}%`],
              ["humans flagged", `${(p.fpr * 100).toFixed(1)}%`],
            ].map(([a, b]) => (
              <div key={a} className="rounded-lg border px-2.5 py-1.5">
                <dt className="text-muted-foreground">{a}</dt>
                <dd className="mt-0.5 text-sm">{b}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-[10px] text-muted-foreground">Orange: AI documents, blue: human. Pooled over the three held-out domains.</p>
        </div>
      </div>
    </figure>
  )
}
