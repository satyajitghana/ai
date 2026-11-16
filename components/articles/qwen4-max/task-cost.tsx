"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// List prices, USD per million tokens, read 16 Nov 2026:
//   qwen4-max, qwen3.8-max   QwenCloud model pages (input, output, implicit-cache input)
//   Opus 5.5                 Anthropic's launch page ($4 / $20 / $0.20 cache read)
//   GPT-6.1 Sol, GPT-6 Astra, Kimi K3.1 Pro   Artificial Analysis's pricing table
//
// cost = I * ( h * P_cache + (1 - h) * P_in ) + O * P_out
// I input tokens per task, h the share served from cache, O output tokens.
// Cache writes are ignored (an implicit cache bills a miss as ordinary input).
//
// The decoder: Qwen says Work360 cost per task fell from $4.43 to $1.67, and its
// chart puts output at about 166K (Qwen3.8-Max, Xhigh) and about 127K (Qwen4-Max,
// Xhigh) tokens per task, read off the plot. Solving the formula for I at a chosen
// h gives the input each claim implies.
//
// The AA preset is Artificial Analysis's per-task cost split for Qwen4 Max
// ($1.115 cache reads at $0.075, $1.670 cache writes, $0.011 uncached input,
// $0.472 output at $4.50): about 14.9M cached, 0.9M written, 105K out. Writes
// are billed here as plain input, so this preset lands a little under AA's $3.27.

type M = { id: string; name: string; inp: number; out: number; cache: number; qwen?: boolean }
const MODELS: M[] = [
  { id: "q4", name: "Qwen4-Max", inp: 1.5, out: 4.5, cache: 0.075, qwen: true },
  { id: "q38", name: "Qwen3.8-Max", inp: 2, out: 6, cache: 0.25, qwen: true },
  { id: "sol", name: "GPT-6.1 Sol", inp: 2, out: 10, cache: 0.1 },
  { id: "kimi", name: "Kimi K3.1 Pro", inp: 2, out: 10, cache: 0.2 },
  { id: "opus", name: "Opus 5.5", inp: 4, out: 20, cache: 0.2 },
  { id: "astra", name: "GPT-6 Astra", inp: 10, out: 50, cache: 1.0 },
]
const Q4 = MODELS[0]
const Q38 = MODELS[1]

const CLAIM = { q38: { cost: 4.43, out: 0.166 }, q4: { cost: 1.67, out: 0.127 } }

const PRESETS = [
  { id: "agent", label: "agent task: 5M in, 90% cached, 100K out", i: 5, h: 90, o: 100 },
  { id: "aa", label: "AA's measured Qwen4 mix: 15.8M in, 94% cached, 105K out", i: 15.8, h: 94, o: 105 },
  { id: "chat", label: "one long prompt: 200K in, uncached, 8K out", i: 0.2, h: 0, o: 8 },
]

const eff = (m: M, h: number) => h * m.cache + (1 - h) * m.inp
const usd = (v: number) => (v >= 10 ? `$${v.toFixed(1)}` : `$${v.toFixed(2)}`)

export function TaskCost() {
  const [h, setH] = useState(95) // decoder cache share, %
  const [inM, setInM] = useState(5)
  const [hit, setHit] = useState(90)
  const [outK, setOutK] = useState(100)

  // decoder
  const hh = h / 100
  const i38 = (CLAIM.q38.cost - CLAIM.q38.out * Q38.out) / eff(Q38, hh)
  const i4 = (CLAIM.q4.cost - CLAIM.q4.out * Q4.out) / eff(Q4, hh)
  const priceOnly = i38 * eff(Q4, hh) + CLAIM.q38.out * Q4.out
  const priceCut = 1 - priceOnly / CLAIM.q38.cost
  const totalCut = 1 - CLAIM.q4.cost / CLAIM.q38.cost

  // comparison
  const costs = MODELS.map((m) => ({ m, c: inM * eff(m, hit / 100) + (outK / 1000) * m.out }))
  const maxC = Math.max(...costs.map((x) => x.c))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-dashed border-foreground/15 text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-3 font-mono text-xs text-muted-foreground">
        cost per task · first what Qwen&rsquo;s $4.43 to $1.67 implies, then any task on six price lists
      </div>

      <div className="space-y-3 border-b p-3 sm:p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">decoding the Work360 claim</div>
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>share of input served from cache (assumed)</span>
            <span className="tabular-nums text-foreground">{h}%</span>
          </div>
          <Range min={50} max={100} step={1} value={h} onChange={(e) => setH(Number(e.target.value))} aria-label="assumed cache-hit share" />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">input per task implied</div>
            <div className="font-mono text-sm tabular-nums">
              {i38.toFixed(1)}M <span className="text-muted-foreground">Qwen3.8</span>
            </div>
            <div className="font-mono text-sm tabular-nums">
              {i4.toFixed(1)}M <span className="text-muted-foreground">Qwen4</span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Qwen3.8&rsquo;s tokens at Qwen4&rsquo;s prices</div>
            <div className="font-mono text-lg tabular-nums">{usd(priceOnly)}</div>
            <div className="font-mono text-[10px] text-muted-foreground">prices alone: {(priceCut * 100).toFixed(0)}% off</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">the claimed cut</div>
            <div className="font-mono text-lg tabular-nums">{(totalCut * 100).toFixed(0)}%</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              tokens supply the other {Math.max(0, (totalCut - priceCut) * 100).toFixed(0)} points
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">any task, six price lists</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setInM(p.i)
                setHit(p.h)
                setOutK(p.o)
              }}
              className={chip(inM === p.i && hit === p.h && outK === p.o)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>input tokens per task</span>
            <span className="tabular-nums text-foreground">{inM.toFixed(1)}M</span>
          </div>
          <Range min={0.1} max={30} step={0.1} value={inM} onChange={(e) => setInM(Number(e.target.value))} aria-label="input tokens per task, millions" />
        </label>
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>input served from cache</span>
            <span className="tabular-nums text-foreground">{hit}%</span>
          </div>
          <Range min={0} max={100} step={1} value={hit} onChange={(e) => setHit(Number(e.target.value))} aria-label="cache-hit share, percent" />
        </label>
        <label className="block">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>output tokens per task</span>
            <span className="tabular-nums text-foreground">{outK}K</span>
          </div>
          <Range min={1} max={400} step={1} value={outK} onChange={(e) => setOutK(Number(e.target.value))} aria-label="output tokens per task, thousands" />
        </label>

        <div className="space-y-1.5">
          {costs.map(({ m, c }) => (
            <div key={m.id} className="grid grid-cols-[7rem_1fr_3.6rem] items-center gap-2">
              <span className={cn("truncate font-mono text-[11px]", m.qwen ? "text-foreground" : "text-muted-foreground")}>{m.name}</span>
              <div className="h-2.5 rounded bg-muted/40">
                <div
                  className={cn("h-2.5 rounded", m.id === "q4" ? "bg-blue-600/80" : m.qwen ? "bg-blue-400/50" : "bg-foreground/30")}
                  style={{ width: `${Math.max(1, (c / maxC) * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="text-right font-mono text-[11px] tabular-nums">{usd(c)}</span>
            </div>
          ))}
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Same tokens on every list, which no two models actually use: a terser model wins back what a cheaper one saves,
          and in Artificial Analysis&rsquo;s runs GPT-6.1 Sol came out cheaper per task than Qwen4-Max ($1.27 against
          $3.27). Output tokens on the decoder are read off Qwen&rsquo;s chart, so they are approximate.
        </p>
      </div>
    </figure>
  )
}
