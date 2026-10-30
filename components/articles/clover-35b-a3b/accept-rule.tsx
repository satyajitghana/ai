"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { EXP_B } from "./trace-data"

// The acceptance rule in Clover's self-speculative mode, read from the SGLang pull request (python/sglang/srt/speculative/
// clover_utils.py). The model drafts a block, then a causal pass checks it. A draft token j is kept if the causal pass's own
// probability for it is at least  min(ratio, delta * exp(-H))  where H is the entropy of that causal distribution; the
// kept tokens are the longest prefix that passes. The defaults in the function signature are ratio 0.9, delta 0.6. The
// "exact" rule keeps a token only if it is the causal pass's argmax.

const W = 360
const H = 190
const PAD = { l: 34, r: 10, t: 10, b: 28 }
const HMAX = 3

function threshold(ratio: number, delta: number, ent: number): number {
  return Math.min(ratio, delta * mexp(-ent))
}

export function AcceptRule() {
  const [ratio, setRatio] = useState(0.9)
  const [delta, setDelta] = useState(0.6)
  const [ent, setEnt] = useState(1)
  const [p, setP] = useState(0.3)

  const x = (e: number) => PAD.l + (e / HMAX) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b)
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const e = (i / 60) * HMAX
    pts.push(`${x(e).toFixed(1)},${y(threshold(ratio, delta, e)).toFixed(1)}`)
  }
  const th = threshold(ratio, delta, ent)
  const ok = p >= th && p > 0
  const ratioBinds = delta > ratio

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the threshold rule · read from the SGLang pull request, stand-in models measured on CPU
      </div>
      <div className="grid gap-4 px-4 pt-4 md:grid-cols-2">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The acceptance threshold, falling as the verifier's entropy rises" className="w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PAD.l - 5} y={y(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.6}>
                {v.toFixed(2)}
              </text>
            </g>
          ))}
          {[0, 1, 2, 3].map((v) => (
            <text key={v} x={x(v)} y={H - 12} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.6}>
              {v}
            </text>
          ))}
          <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.6}>
            entropy of the verifier&apos;s distribution, nats
          </text>
          <polyline points={pts.join(" ")} fill="none" stroke="oklch(0.62 0.15 285)" strokeWidth={2} />
          <line x1={x(ent)} x2={x(ent)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
          <circle cx={x(ent)} cy={y(th)} r={4} fill="oklch(0.62 0.15 285)" />
          <circle cx={x(ent)} cy={y(p)} r={4.5} fill={ok ? "oklch(0.62 0.15 150)" : "oklch(0.60 0.2 25)"} />
        </svg>
        <div className="space-y-2.5 text-xs">
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-muted-foreground">ratio</span>
            <Range min={0} max={1} step={0.05} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} aria-label="Ratio" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{ratio.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-muted-foreground">delta</span>
            <Range min={0} max={1} step={0.05} value={delta} onChange={(e) => setDelta(Number(e.target.value))} aria-label="Delta" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{delta.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-muted-foreground">entropy</span>
            <Range min={0} max={HMAX} step={0.05} value={ent} onChange={(e) => setEnt(Number(e.target.value))} aria-label="Entropy" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{ent.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-muted-foreground">draft prob.</span>
            <Range min={0} max={1} step={0.01} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Probability the verifier gives the draft token" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{p.toFixed(2)}</span>
          </label>
          <div className={cn("rounded border px-2 py-1.5 font-mono text-[11px] leading-relaxed", ok ? "border-green-600/40" : "border-red-500/40")}>
            threshold = min({ratio.toFixed(2)}, {delta.toFixed(2)} x e^-{ent.toFixed(2)}) = {th.toFixed(3)}
            <br />
            the verifier gives the draft token {p.toFixed(2)}: <strong>{ok ? "kept" : "rejected"}</strong>
          </div>
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            {ratioBinds
              ? "With this delta the ratio sets a ceiling at low entropy."
              : "With delta at or below the ratio, the ratio never binds: delta times e^-H cannot exceed delta."}
          </div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto border-t px-4 py-3">
        <table className="w-full text-left font-mono text-[11px]">
          <caption className="pb-2 text-left text-muted-foreground">
            a 70M drafter and a 160M verifier (pythia), 8 paragraphs, drafts of 8, 32 tokens generated, ratio 0.9 (measured)
          </caption>
          <thead className="text-muted-foreground">
            <tr>
              <th className="pr-3 font-normal">rule</th>
              <th className="pr-3 text-right font-normal">tokens kept per round</th>
              <th className="text-right font-normal">same as the verifier alone</th>
            </tr>
          </thead>
          <tbody>
            {EXP_B.map((r) => (
              <tr key={r.rule} className="tabular-nums">
                <td className="pr-3">{r.rule}</td>
                <td className="pr-3 text-right">{r.perRound.toFixed(2)}</td>
                <td className="text-right">{(r.same * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
