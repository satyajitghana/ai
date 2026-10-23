"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A tiered prefix cache replaying the workload of SGLang's
// benchmark/hicache/bench_multiturn.py as the DeepSeek-V4-Flash run used it:
// 48 clients, 60 rounds, 4,096 fresh input tokens and 16 output tokens a turn,
// random token ids (so no two clients share a prefix), a barrier between rounds.
//
// What the model takes from the code (unified_radix_cache.py,
// unified_tree_core.py):
// - eviction only removes leaves, and a matched path gets timestamps that
//   decrease towards the root, so per tier a client's resident tokens are a
//   PREFIX of its history, and the least recently used chain drains first;
// - write_through backs a newly cached sequence up to host (and storage) at
//   insert time, so the lower tiers hold everything they have room for;
// - the host pool is hicache_ratio times the device pool;
// - a hit is the longest prefix resident in any tier, floored to a 64-token
//   page; the served sequence ends up on the GPU.
// Concurrency, locking and transfer time are left out: this is a hit-rate
// model, not a latency model.

const CLIENTS = 48
const ROUNDS = 60
const Q = 4096
const OUT = 16
const PAGE = 64

type Tier = "L1" | "L1+L2" | "L1+L2+L3"
const TIERS: Tier[] = ["L1", "L1+L2", "L1+L2+L3"]
const COLOURS: Record<Tier, string> = {
  L1: "oklch(0.66 0.16 55)",
  "L1+L2": "oklch(0.58 0.15 255)",
  "L1+L2+L3": "oklch(0.60 0.15 150)",
}

type Result = { byRound: number[]; runHit: number; prompt: number; computed: number }

function simulate(c1: number, ratio: number, useL2: boolean, useL3: boolean): Result {
  const caps = [c1, useL2 ? c1 * ratio : 0, useL3 ? Number.POSITIVE_INFINITY : 0]
  const res = caps.map(() => new Array<number>(CLIENTS).fill(0))
  const last = new Array<number>(CLIENTS).fill(0)
  let tick = 0
  let totPrompt = 0
  let totCached = 0
  const byRound: number[] = []
  for (let r = 0; r < ROUNDS; r++) {
    let rp = 0
    let rc = 0
    for (let c = 0; c < CLIENTS; c++) {
      const prompt = Q * (r + 1) + OUT * r
      let avail = 0
      for (let t = 0; t < 3; t++) avail = Math.max(avail, res[t][c])
      let hit = Math.min(avail, prompt - 1)
      hit -= hit % PAGE
      rp += prompt
      rc += hit
      const seq = prompt + OUT
      tick += 1
      last[c] = tick
      for (let t = 0; t < 3; t++) {
        const cap = caps[t]
        if (cap <= 0) continue
        const row = res[t]
        row[c] = seq
        let used = 0
        for (const v of row) used += v
        if (used <= cap) continue
        const order = row
          .map((_, k) => k)
          .filter((k) => k !== c)
          .sort((a, b) => last[a] - last[b])
        for (const k of order) {
          if (used <= cap) break
          let drop = Math.min(row[k], used - cap)
          if (drop < row[k]) drop = Math.min(row[k], Math.ceil(drop / PAGE) * PAGE)
          row[k] -= drop
          used -= drop
        }
        if (used > cap) row[c] = Math.max(0, row[c] - (used - cap))
      }
    }
    byRound.push(rc / rp)
    totPrompt += rp
    totCached += rc
  }
  return { byRound, runHit: totCached / totPrompt, prompt: totPrompt, computed: totPrompt - totCached }
}

function ceiling(r: number) {
  const cacheable = r * (Q + OUT)
  return (cacheable - (cacheable % PAGE)) / (Q * (r + 1) + OUT * r)
}

const fmtM = (n: number) => `${(n / 1e6).toFixed(1)}M`

export function TierSim() {
  const [rounds1, setRounds1] = useState(18)
  const [ratio, setRatio] = useState(2)

  const c1 = rounds1 * CLIENTS * (Q + OUT)
  const results = useMemo(() => {
    const out = {} as Record<Tier, Result>
    out.L1 = simulate(c1, ratio, false, false)
    out["L1+L2"] = simulate(c1, ratio, true, false)
    out["L1+L2+L3"] = simulate(c1, ratio, true, true)
    return out
  }, [c1, ratio])

  const W = 640
  const H = 220
  const PL = 40
  const PR = 12
  const PT = 12
  const PB = 28
  const x = (r: number) => PL + (r / (ROUNDS - 1)) * (W - PL - PR)
  const y = (v: number) => PT + (1 - v) * (H - PT - PB)
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const ceil = Array.from({ length: ROUNDS }, (_, r) => ceiling(r))

  const base = results["L1+L2+L3"].computed

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          48 clients · 60 rounds · 4,096 in / 16 out per turn · LRU, write-through
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">simulation, not a GPU run</span>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            GPU pool (L1): {rounds1} rounds of every client&apos;s history · {fmtM(c1)} tokens
          </span>
          <Range min={4} max={40} step={1} value={rounds1} onChange={(e) => setRounds1(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            host pool (L2) = {ratio}× GPU pool <span className="opacity-70">(--hicache-ratio)</span>
          </span>
          <Range min={1} max={4} step={0.5} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} />
        </label>
      </div>

      <div className="px-3 sm:px-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Prompt-token hit rate by round for three cache configurations">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={0.5} />
              <text x={PL - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {v * 100}%
              </text>
            </g>
          ))}
          {[0, 10, 20, 30, 40, 50, 59].map((r) => (
            <text key={r} x={x(r)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {r}
            </text>
          ))}
          <text x={W - PR} y={H - 1} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            round
          </text>
          <path d={path(ceil)} fill="none" className="stroke-foreground/40" strokeDasharray="3 3" strokeWidth={1} />
          {TIERS.map((t) => (
            <path key={t} d={path(results[t].byRound)} fill="none" stroke={COLOURS[t]} strokeWidth={t === "L1+L2+L3" ? 2.2 : 1.6} />
          ))}
        </svg>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
        {TIERS.map((t) => (
          <div key={t} className="rounded-lg border px-3 py-2">
            <div className="font-mono text-[11px]" style={{ color: COLOURS[t] }}>
              {t}
            </div>
            <div className="font-mono text-sm">{(results[t].runHit * 100).toFixed(1)}% of prompt tokens hit</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {fmtM(results[t].computed)} tokens prefilled ·{" "}
              <span className={cn(t === "L1+L2+L3" && "opacity-0")}>{(results[t].computed / base).toFixed(1)}× the L3 run</span>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Dashed line: the most any cache can hit on this workload, (round × 4,112) ÷ prompt length. Below
        capacity every tier rides it; one round past capacity, LRU over a round-robin of 48 clients
        evicts exactly the history the next client needs, and the curve falls to zero. Totals are over
        all 60 rounds ({fmtM(results.L1.prompt)} prompt tokens).
      </figcaption>
    </figure>
  )
}
