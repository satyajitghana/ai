"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { CE0, METHODS, SWEEP, type SweepRow } from "./sweep-data"

// Our CPU run on SmolLM2-135M-Instruct (measured): one made-up fact taught four ways, each at four learning rates,
// one seed. x = held-out cross-entropy on the fact's reply (lower = stronger edit); y = change on unrelated text F =
// KL(original || edited) per token over 84 items in 7 domains. Hover a point for its generations' counts.

const W = 600
const H = 340
const PL = 58
const PR = 14
const PT = 14
const PB = 44
const Y0 = -5
const Y1 = 0

export function SweepCurves() {
  const [sel, setSel] = useState<SweepRow | null>(null)
  const ces = SWEEP.map((r) => r.ce)
  const X0 = Math.floor(Math.min(...ces) * 10) / 10 - 0.05
  const X1 = Math.ceil(CE0 * 10) / 10
  const sx = (v: number) => PL + (1 - (v - X0) / (X1 - X0)) * (W - PL - PR)
  const sy = (v: number) => PT + (1 - (mlog10(Math.max(v, 1e-5)) - Y0) / (Y1 - Y0)) * (H - PT - PB)
  const ticks: number[] = []
  for (let t = Math.ceil(X0 * 2) / 2; t <= X1 + 1e-9; t += 0.5) ticks.push(Math.round(t * 10) / 10)
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured · SmolLM2-135M-Instruct · CPU · seed 0</span>
        <span className="font-mono text-[10px] text-muted-foreground">right = stronger edit · down = more local</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            {"Change on unrelated text against edit strength, four methods: " +
              METHODS.map((m) => `${m.label}: ` + SWEEP.filter((r) => r.method === m.id).map((r) => `CE ${r.ce.toFixed(2)} F ${r.F.toExponential(1)}`).join(", ")).join("; ")}
          </title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.08} />
              <text x={sx(t)} y={H - PB + 16} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                {t.toFixed(1)}
              </text>
            </g>
          ))}
          {(
            [
              [-5, 1e-5],
              [-4, 1e-4],
              [-3, 1e-3],
              [-2, 1e-2],
              [-1, 1e-1],
              [0, 1],
            ] as const
          ).map(([e, v]) => (
            <g key={e}>
              <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PL - 6} y={sy(v) + 3} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                {`1e${e}`}
              </text>
            </g>
          ))}
          <line x1={sx(CE0)} x2={sx(CE0)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
          <text x={sx(CE0) + 4} y={PT + 10} fontSize={10} fill="currentColor" fillOpacity={0.6}>
            unedited
          </text>
          <text x={(PL + W - PR) / 2} y={H - 8} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.75}>
            held-out cross-entropy on the fact (nats per token)
          </text>
          <text x={12} y={(PT + H - PB) / 2} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 12 ${(PT + H - PB) / 2})`}>
            change on unrelated text F (log)
          </text>
          {METHODS.map((m) => {
            const pts = SWEEP.filter((r) => r.method === m.id && r.ok).sort((a, b) => a.lr - b.lr)
            return (
              <g key={m.id}>
                <polyline points={pts.map((r) => `${sx(r.ce)},${sy(r.F)}`).join(" ")} fill="none" stroke={m.color} strokeWidth={1.6} strokeOpacity={0.7} />
                {pts.map((r) => (
                  <circle
                    key={r.lr}
                    cx={sx(r.ce)}
                    cy={sy(r.F)}
                    r={sel === r ? 6.5 : 4.5}
                    fill={m.color}
                    stroke={sel === r ? "currentColor" : "none"}
                    tabIndex={0}
                    onMouseEnter={() => setSel(r)}
                    onFocus={() => setSel(r)}
                  />
                ))}
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {METHODS.map((m) => (
            <span key={m.id}>
              <span style={{ color: m.color }}>●</span> {m.label} · {m.params.toLocaleString("en-US")} numbers
            </span>
          ))}
        </div>
        <div className={cn("mt-3 rounded-md border px-3 py-2 font-mono text-[11px]", sel ? "text-foreground" : "text-muted-foreground")}>
          {sel ? (
            <>
              {METHODS.find((m) => m.id === sel.method)?.label} at learning rate {sel.lr} · F {sel.F.toExponential(2)} · held-out CE {sel.ce.toFixed(2)}
              <br />
              says the name on {sel.hit} of 12 held-out questions · on {sel.near} of 16 near questions · on {sel.chat} of 16 unrelated chats
            </>
          ) : (
            "Hover or tab to a point: each is one training run. The counts are greedy replies that contain the name Bartholomew."
          )}
        </div>
      </div>
    </figure>
  )
}
