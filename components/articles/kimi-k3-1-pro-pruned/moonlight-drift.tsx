"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ML_CRITS, ML_DRIFT, ML_LAYERS, type MlCrit, type MlMetric } from "./moonlight-data"

// Layer-local drift of Moonlight-16B-A3B's routed-expert output when each MoE layer is pruned on
// its own, measured on 2,048 held-out tokens fed through the full model (prune_moonlight.py).
// error = |pruned routed output - full routed output|^2 / |full routed output|^2.

const METRICS: { key: MlMetric; label: string; note: string }[] = [
  { key: "all", label: "all tokens", note: "summed over every token, so the first token of each sequence dominates" },
  { key: "nobos", label: "without token 0", note: "the first position of each sequence left out" },
  { key: "median", label: "median token", note: "each token's own relative error, then the median over tokens 1 to 511" },
]

const W = 640
const H = 260
const PAD = { l: 40, r: 12, t: 12, b: 30 }
const YMAX = 1.6

export function MoonlightDrift() {
  const [metric, setMetric] = useState<MlMetric>("median")
  const [keep, setKeep] = useState<16 | 32>(16)
  const [on, setOn] = useState<Record<MlCrit, boolean>>(() =>
    Object.fromEntries(ML_CRITS.map((c) => [c.key, ["frequency", "reap", "signed", "random"].includes(c.key)])) as Record<MlCrit, boolean>
  )
  const btn = (active: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
      active ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
    )
  const n = ML_LAYERS.length
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - Math.min(v, YMAX) / YMAX) * (H - PAD.t - PAD.b)
  const data = ML_DRIFT[metric][keep]
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Moonlight-16B-A3B, keep {keep} of 64 experts, each layer on its own</span>
        <span className="text-muted-foreground/60">measured, 2,048 held-out tokens</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">error</span>
          {METRICS.map((m) => (
            <button key={m.key} type="button" className={btn(metric === m.key)} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">keep</span>
          {([32, 16] as const).map((k) => (
            <button key={k} type="button" className={btn(keep === k)} aria-pressed={keep === k} onClick={() => setKeep(k)}>
              {k} of 64 ({k === 32 ? "50%" : "75%"} pruned)
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ML_CRITS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={on[c.key]}
              onClick={() => setOn((o) => ({ ...o, [c.key]: !o[c.key] }))}
              className={cn(btn(on[c.key]), "inline-flex items-center gap-1.5")}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: on[c.key] ? c.color : "transparent", border: `1px solid ${c.color}` }} />
              {c.short} {mean(data[c.key]).toFixed(2)}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Per-layer pruning error for each expert-ranking score">
          {[0, 0.4, 0.8, 1.2, 1.6].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.3 : 0.08} strokeDasharray={v === 0 ? undefined : "2 3"} />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          <line x1={PAD.l} x2={W - PAD.r} y1={y(1)} y2={y(1)} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="5 4" />
          {ML_LAYERS.map((l, i) =>
            i % 5 === 0 || i === n - 1 ? (
              <text key={l} x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                {l}
              </text>
            ) : null
          )}
          {ML_CRITS.filter((c) => on[c.key]).map((c) => (
            <g key={c.key}>
              <polyline
                fill="none"
                stroke={c.color}
                strokeWidth={2}
                strokeLinejoin="round"
                points={data[c.key].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
              />
              {data[c.key].map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={2.2} fill={c.color}>
                  <title>{`layer ${ML_LAYERS[i]}, ${c.short}: ${v.toFixed(3)}`}</title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
        <p className="font-mono text-[10px] text-muted-foreground">
          x: MoE layer (layer 0 is dense). y: relative squared error of the routed output, {METRICS.find((m) => m.key === metric)?.note}. Dashed line: 1.0, as bad as
          deleting every routed expert. Numbers on the buttons are means over the 26 layers.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Moonlight is Moonshot&apos;s 16B model on the DeepSeek-V3 design that Kimi K3 inherits: sigmoid router, balance bias, 64 experts, top 6. Each
        layer is pruned alone and fed the unpruned model&apos;s own inputs, so these are per-layer costs before any compounding.
      </figcaption>
    </figure>
  )
}
