"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { K_ARMS, MATCHED, RUNS, SETS, type Target } from "./deep-data"

// Second CPU run (measured): SmolLM2-135M-Instruct, fp32, seed 0, the repository's own reference sets. For each
// number of neurons K (the first K of ONE ranking by make_edit.py's rule), F is interpolated at a held-out
// cross-entropy fixed before the runs. Dashed lines: the LoRA baselines of the same run at the same strength.

const W = 600
const H = 300
const PL = 58
const PR = 16
const PT = 16
const PB = 46
const Y0 = -4
const Y1 = 0

const REFS = [
  { arm: "lora_small", label: "rank-2 LoRA, layer 0", color: "oklch(0.55 0.02 255)", left: false },
  { arm: "lora_small_deep", label: "rank-2 LoRA, layer 24", color: "oklch(0.62 0.12 150)", left: true },
  { arm: "lora_std", label: "rank-8 LoRA, every layer", color: "oklch(0.56 0.14 320)", left: false },
]

function fmt(v: number) {
  return v.toExponential(1).replace("e-", "e−")
}

export function NeuronCount() {
  const [t, setT] = useState<Target>("0.5")
  const [k, setK] = useState<string>("K8_ml0")
  const sx = (i: number) => PL + 30 + (i / (K_ARMS.length - 1)) * (W - PL - PR - 60)
  const sy = (v: number) => PT + (1 - (mlog10(v) - Y0) / (Y1 - Y0)) * (H - PT - PB)
  const sel = K_ARMS.find((a) => a.arm === k) ?? K_ARMS[0]
  const runs = RUNS.filter((r) => r.arm === sel.arm).sort((a, b) => a.lr - b.lr)
  const closest = runs.reduce((best, r) => (Math.abs(r.ce - Number(t)) < Math.abs(best.ce - Number(t)) ? r : best), runs[0])
  const m = MATCHED[sel.arm]?.[t]?.F ?? null
  const pts = K_ARMS.map((a, i) => ({ a, i, F: MATCHED[a.arm]?.[t]?.F ?? null }))
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured · how many neurons · SmolLM2-135M · seed 0</span>
        <div className="flex gap-1" role="tablist" aria-label="Strength target">
          {(["0.5", "0.3"] as Target[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === t}
              onClick={() => setT(v)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                v === t ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              held-out CE {v}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            {`Change on unrelated text at held-out cross-entropy ${t}, by number of neurons: ` +
              pts.map((p) => `${p.a.label}: ${p.F ? fmt(p.F) : "not covered"}`).join(", ")}
          </title>
          {(
            [
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
          {REFS.map((r) => {
            const v = MATCHED[r.arm]?.[t]?.F
            if (!v) return null
            return (
              <g key={r.arm}>
                <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke={r.color} strokeDasharray="5 4" strokeWidth={1.4} />
                <text x={r.left ? PL + 4 : W - PR - 4} y={r.left ? sy(v) + 13 : sy(v) - 5} fontSize={10} textAnchor={r.left ? "start" : "end"} fill={r.color}>
                  {`${r.label} ${fmt(v)}`}
                </text>
              </g>
            )
          })}
          <polyline
            points={pts
              .filter((p) => p.F)
              .map((p) => `${sx(p.i)},${sy(p.F as number)}`)
              .join(" ")}
            fill="none"
            stroke="oklch(0.58 0.15 255)"
            strokeWidth={1.6}
            strokeOpacity={0.7}
          />
          {pts.map((p) => (
            <g key={p.a.arm}>
              <text x={sx(p.i)} y={H - PB + 16} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
                {p.a.K}
              </text>
              {p.F ? (
                <circle
                  cx={sx(p.i)}
                  cy={sy(p.F)}
                  r={p.a.arm === k ? 7 : 5}
                  fill="oklch(0.58 0.15 255)"
                  stroke={p.a.arm === k ? "currentColor" : "none"}
                  tabIndex={0}
                  onMouseEnter={() => setK(p.a.arm)}
                  onFocus={() => setK(p.a.arm)}
                  onClick={() => setK(p.a.arm)}
                />
              ) : (
                <g tabIndex={0} onMouseEnter={() => setK(p.a.arm)} onFocus={() => setK(p.a.arm)} onClick={() => setK(p.a.arm)}>
                  <circle cx={sx(p.i)} cy={PT + 12} r={5} fill="none" stroke="oklch(0.58 0.15 255)" strokeDasharray="2 2" />
                  <text x={sx(p.i)} y={PT + 30} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
                    not covered
                  </text>
                </g>
              )}
            </g>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 8} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.75}>
            number of neurons K (the first K of one ranking)
          </text>
          <text x={12} y={(PT + H - PB) / 2} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 12 ${(PT + H - PB) / 2})`}>
            F at matched strength (log)
          </text>
        </svg>
        <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <span className="mr-1">K = {sel.K}, layers:</span>
          {(SETS[sel.arm] ?? []).map((n) => (
            <span
              key={`${n.layer}:${n.neuron}`}
              title={`layer ${n.layer}, neuron ${n.neuron}, g/c ${n.ratio.toFixed(2)}`}
              className={cn("rounded border px-1.5 py-0.5", n.layer < 10 ? "border-orange-500/50 text-orange-600 dark:text-orange-400" : "")}
            >
              {n.layer}
            </span>
          ))}
        </div>
        <div className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px] text-foreground">
          {sel.label} · {(sel.K * 577).toLocaleString("en-US")} trained numbers · F at CE {t}: {m ? fmt(m) : "not covered by its learning rates"}
          <br />
          nearest run (learning rate {closest.lr}, CE {closest.ce.toFixed(2)}): names Bartholomew on {closest.hit}/12 held-out, {closest.near}/16 near, {closest.chat}/16 unrelated
        </div>
      </div>
    </figure>
  )
}
