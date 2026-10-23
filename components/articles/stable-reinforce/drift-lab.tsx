"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { SIM } from "./sim-data"

// Explorer over a measured grid: eight policy-gradient losses trained in a tiny
// CPU simulation (sim2.py in the article) while the sampler lags the learner by
// `lag` optimizer steps and runs "numerics" that disagree with the learner's.
// Every number shown comes from sim-data.ts; nothing is computed here except
// means, minima and SVG coordinates (plain arithmetic, SSR-safe).

const LAGS = [0, 2, 8, 32] as const
const MISMATCH = ["none", "mild", "severe"] as const
type Mismatch = (typeof MISMATCH)[number]

const LOSSES = [
  { id: "reinforce", label: "REINFORCE, no ratio", color: "oklch(0.55 0.02 260)" },
  { id: "stable_proxy", label: "REINFORCE + sampler KL (β 0.01)", color: "oklch(0.6 0.16 150)" },
  { id: "is", label: "Importance sampling, p/q", color: "oklch(0.62 0.2 25)" },
  { id: "ppo", label: "PPO clip 0.2", color: "oklch(0.7 0.16 60)" },
  { id: "cispo", label: "CISPO clip [0, 4]", color: "oklch(0.6 0.15 250)" },
  { id: "cispo_lo", label: "CISPO clip [0.8, 4]", color: "oklch(0.62 0.12 210)" },
  { id: "tis", label: "Token TIS, C = 2", color: "oklch(0.58 0.17 300)" },
  { id: "mis", label: "Sequence MIS, C = 2", color: "oklch(0.6 0.13 340)" },
] as const

const W = 720
const H = 280
const ML = 44
const MR = 16
const MT = 14
const MB = 34
const PW = W - ML - MR
const PH = H - MT - MB
const X = (step: number) => ML + (step / 600) * PW
const Y = (r: number) => MT + (1 - r) * PH

export function DriftLab() {
  const [lagIdx, setLagIdx] = useState(2)
  const [mm, setMm] = useState<Mismatch>("severe")
  const [on, setOn] = useState<Record<string, boolean>>({
    reinforce: true,
    stable_proxy: true,
    is: true,
    ppo: true,
    cispo: true,
    cispo_lo: false,
    tis: false,
    mis: false,
  })
  const lag = LAGS[lagIdx]

  const rows = LOSSES.map((l) => {
    const cell = SIM[`${l.id}|${lag}|${mm}`]
    const mean = cell.final.reduce((a, b) => a + b, 0) / cell.final.length
    const worst = Math.min(...cell.final)
    const gmax = Math.max(...cell.gmax)
    return { ...l, cell, mean, worst, gmax, collapsed: worst < 0.9 }
  })

  const path = (curve: number[]) =>
    curve.map((r, i) => `${i === 0 ? "M" : "L"} ${X((i + 1) * 10).toFixed(1)} ${Y(r).toFixed(1)}`).join(" ")

  const nCollapsed = rows.filter((r) => r.collapsed).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>drift lab · eight losses under staleness and sampler mismatch</span>
        <span className="text-muted-foreground/60">measured · toy sim, CPU</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>staleness: sampler lags learner by</span>
              <span className="text-foreground">{lag} steps</span>
            </div>
            <Range
              min={0}
              max={3}
              step={1}
              value={lagIdx}
              onChange={(e) => setLagIdx(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Sampler staleness in optimizer steps"
            />
          </div>
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">sampler numerics vs learner</div>
            <div className="flex gap-1.5">
              {MISMATCH.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMm(m)}
                  aria-pressed={mm === m}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    mm === m ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Mean reward over 600 steps with the sampler ${lag} steps stale and ${mm} numeric mismatch; ${nCollapsed} of 8 losses have a seed ending below 0.9.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={ML} x2={W - MR} y1={Y(t)} y2={Y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={ML - 6} y={Y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          {[0, 150, 300, 450, 600].map((s) => (
            <text key={s} x={X(s)} y={H - MB + 16} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {s}
            </text>
          ))}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            optimizer step
          </text>
          <line x1={ML} x2={W - MR} y1={Y(0.9)} y2={Y(0.9)} stroke="var(--border)" strokeDasharray="4 4" strokeWidth={1} />
          <text x={W - MR} y={Y(0.9) - 4} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
            0.9 line
          </text>
          {rows
            .filter((r) => on[r.id])
            .map((r) => (
              <path key={r.id} d={path(r.cell.curve)} fill="none" stroke={r.color} strokeWidth={2} strokeLinejoin="round" opacity={0.9} />
            ))}
        </svg>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">loss (click to show)</th>
                <th className="py-1 pr-2 text-right font-normal">final, mean</th>
                <th className="py-1 pr-2 text-right font-normal">worst seed</th>
                <th className="py-1 text-right font-normal">max |grad|</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="py-1 pr-2">
                    <button
                      type="button"
                      onClick={() => setOn((o) => ({ ...o, [r.id]: !o[r.id] }))}
                      aria-pressed={on[r.id]}
                      className="flex items-center gap-2 text-left"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border"
                        style={{ background: on[r.id] ? r.color : "transparent", borderColor: r.color }}
                      />
                      <span className={on[r.id] ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                    </button>
                  </td>
                  <td className="py-1 pr-2 text-right">{r.mean.toFixed(3)}</td>
                  <td className="py-1 pr-2 text-right" style={{ color: r.collapsed ? "oklch(0.62 0.2 25)" : undefined }}>
                    {r.worst.toFixed(3)}
                  </td>
                  <td className="py-1 text-right" style={{ color: r.gmax > 10 ? "oklch(0.62 0.2 25)" : undefined }}>
                    {r.gmax.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Three seeds per setting, 600 steps each. Curves are the seed mean of the learner&apos;s expected reward; the
          table gives the mean of the last 50 steps, the worst seed, and the largest gradient norm any seed saw. A red
          worst seed ended below 0.9. The losses whose coefficient can grow with p/q (plain importance sampling and
          PPO&apos;s negative-advantage branch) are the ones that blow up; every loss with a bounded coefficient
          survives.
        </p>
      </div>
    </figure>
  )
}
