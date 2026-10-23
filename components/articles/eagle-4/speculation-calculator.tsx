"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Speculation as arithmetic: tokens a round advances over what a round costs,
// both in units of one plain decode step of the target.
//
// Model (REASONED, the article's "acceptance length vs speedup"):
//   each drafted token is accepted with probability a, independently, along a
//   chain of k drafted tokens. Accepted tokens per round, counting the target's
//   bonus token: A = (1 - a^(k+1)) / (1 - a).
//   Round cost = v (one verify forward) + k * c (k draft steps) + o (overhead).
//   Speedup = A / round cost.
//
// Preset costs come from LightSeek's TokenSpeed timeline (REPORTED, Figure 5:
// decode graph 3,828 us incl. verifying 16 rows and draft depth 0, ~123 us per
// draft depth, 673 us of drafting for five depths, 20 us to the next round) and
// its no-speculation speed (REASONED: 985 tok/s / 3.56 = 276.7 tok/s, so one
// plain step is 3.614 ms). v = 1.059, c = 0.034, o = 0.022.
// The chain-equivalent a is solved so that A matches the reported acceptance
// length at k = 5 (4.75 greedy, 3.6 sampled). A tree reaches a given A with a
// lower per-token a than a chain; the a here is a fit, not a measurement.
// "Full LM head" multiplies c by (1 - 0.19) / (1 - 0.66) = 2.38, from
// LightSeek's Figure 4 LM-head shares for chains.

type Preset = {
  key: string
  label: string
  a: number
  k: number
  c: number
  v: number
  o: number
  reported?: string
  note: string
}

const PRESETS: Preset[] = [
  {
    key: "greedy",
    label: "SPEED-Bench, greedy",
    a: 0.906,
    k: 5,
    c: 0.034,
    v: 1.059,
    o: 0.022,
    reported: "3.56x reported, acceptance length about 4.75",
    note: "TokenSpeed, Qwen3.8-27B BF16, 4x B300 TP4, one request",
  },
  {
    key: "sampled",
    label: "SPEED-Bench, T = 1",
    a: 0.789,
    k: 5,
    c: 0.034,
    v: 1.059,
    o: 0.022,
    reported: "2.85x reported, acceptance length about 3.6",
    note: "same node; sampled tree, depth fixed before the round's draws",
  },
  {
    key: "agentic",
    label: "Agentic coding, greedy",
    a: 0.938,
    k: 8,
    c: 0.034,
    v: 1.059,
    o: 0.022,
    reported: "5.21x reported; acceptance length not published",
    note: "a fitted so that the model gives about 5.2x at depth 8, which needs about 7 tokens a round; that acceptance length is my inference",
  },
  {
    key: "busy",
    label: "Busy server (illustrative)",
    a: 0.75,
    k: 4,
    c: 0.12,
    v: 1.6,
    o: 0.02,
    note: "illustrative costs, not from either post: verify and draft are no longer nearly free",
  },
]

const acceptLen = (a: number, k: number) => (a >= 0.9999 ? k + 1 : (1 - mpow(a, k + 1)) / (1 - a))

export function SpeculationCalculator() {
  const [pi, setPi] = useState(0)
  const p = PRESETS[pi]
  const [a, setA] = useState(p.a)
  const [k, setK] = useState(p.k)
  const [c, setC] = useState(p.c)
  const [v, setV] = useState(p.v)
  const [fullHead, setFullHead] = useState(false)

  const pick = (i: number) => {
    const q = PRESETS[i]
    setPi(i)
    setA(q.a)
    setK(q.k)
    setC(q.c)
    setV(q.v)
    setFullHead(false)
  }

  const o = p.o
  const cEff = fullHead ? c * 2.38 : c
  const speedAt = (kk: number) => acceptLen(a, kk) / (v + kk * cEff + o)
  const A = acceptLen(a, k)
  const cost = v + k * cEff + o
  const s = A / cost

  let bestK = 1
  for (let kk = 1; kk <= 16; kk++) if (speedAt(kk) > speedAt(bestK)) bestK = kk
  const next = mpow(a, k + 1)
  const worth = next / cEff >= s

  const curve = Array.from({ length: 16 }, (_, i) => speedAt(i + 1))
  const maxS = Math.max(6, ...curve)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">speedup = tokens per round / cost of a round</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((q, i) => (
            <button
              key={q.key}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={pi === i}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                pi === i ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              per-token acceptance a: {a.toFixed(3)}
            </span>
            <Range min={0.3} max={0.99} step={0.001} value={a} onChange={(e) => setA(Number(e.target.value))} aria-label="per-token acceptance" />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">draft depth k: {k}</span>
            <Range min={1} max={16} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="draft depth" />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              draft step cost c: {c.toFixed(3)} of a plain step
            </span>
            <Range min={0.01} max={0.4} step={0.001} value={c} onChange={(e) => setC(Number(e.target.value))} aria-label="draft step cost" />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              verify forward cost v: {v.toFixed(3)} plain steps
            </span>
            <Range min={1} max={3} step={0.001} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="verify cost" />
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <input type="checkbox" checked={fullHead} onChange={(e) => setFullHead(e.target.checked)} />
            score the full 248K vocabulary in the draft (no Efficient LM Head, c x 2.38)
          </label>
        </div>

        <div className="space-y-3 font-mono text-[11px]">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground">tokens / round</div>
              <div className="text-lg tabular-nums">{A.toFixed(2)}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground">round cost</div>
              <div className="text-lg tabular-nums">{cost.toFixed(3)}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground">speedup</div>
              <div className="text-lg tabular-nums text-blue-600 dark:text-blue-400">{s.toFixed(2)}x</div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-muted-foreground">speedup by draft depth (best: k = {bestK})</div>
            <div className="flex h-24 items-end gap-[3px]" role="img" aria-label="speedup at each draft depth from 1 to 16">
              {curve.map((val, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t-sm",
                    i + 1 === k ? "bg-blue-500/90" : i + 1 === bestK ? "bg-emerald-500/80" : "bg-foreground/15"
                  )}
                  style={{ height: `${((Math.max(0, val) / maxS) * 100).toFixed(2)}%` }}
                  title={`k = ${i + 1}: ${val.toFixed(2)}x`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>k = 1</span>
              <span>blue: your k · green: best k</span>
              <span>k = 16</span>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed">
            One more draft step adds {next.toFixed(3)} expected tokens for {cEff.toFixed(3)} of a step: {(next / cEff).toFixed(1)}{" "}
            tokens per step against the round&apos;s current {s.toFixed(2)}.{" "}
            <span className={worth ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {worth ? "Draft deeper." : "Stop here."}
            </span>
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {p.note}.{p.reported ? ` ${p.reported}.` : ""} Costs are in plain decode steps; the model is a chain with independent
        acceptance, so it is reasoned, not measured.
      </figcaption>
    </figure>
  )
}
