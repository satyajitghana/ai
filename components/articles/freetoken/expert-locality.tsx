"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Why a per-miss LRU beats a placement chosen once, in a toy you can drag.
//
// This is not the paper's trace — it is a synthetic router with a tunable amount
// of step-to-step locality, replayed against the three engines' placement rules:
//
//   FreeToken   global LRU, admitting each miss and evicting the expert least
//               recently demanded by the model
//   KTransformers  pin the most frequent experts observed during a warmup, then
//               freeze the placement
//   llama.cpp   assign a fixed slice of the pool to the GPU at load time,
//               without looking at routing at all
//
// The reason it is worth having is that two of the three outcomes are predictable
// from first principles and one is not. A routing-blind static split can only hit
// at its capacity share — 37% of the pool means 63% misses, and that is a ceiling
// no workload can lift. LRU's miss rate instead tracks how fast the working set
// turns over, which is a property of the model rather than the cache. Watching
// those two curves separate as you drag locality is the whole argument for
// making residency follow the router.
//
// The two knobs — step-to-step locality and how concentrated expert popularity
// is — are set so the defaults land on the paper's measured trio at the RTX 5090
// serving capacity (16% / 41% / 62% on Qwen3.6). Two fitted parameters against
// three targets is a fit, not a prediction, and it is only here to give the
// sliders a place to start. What the toy is actually for is what happens when
// you move them.
//
// Expert popularity is Zipf-distributed over a fixed shuffle of the ids, so an
// index-based slice learns nothing about which experts are hot — which is what
// makes llama.cpp's rule routing-blind and KTransformers' frequency pin
// meaningful. Set locality to zero and the frequency pin actually beats LRU:
// with no short-range structure, global popularity is the only signal left.
//
// The PRNG is a fixed-seed LCG rather than Math.random so the server and the
// browser render byte-identical markup. Its arithmetic stays under 2^53, so it is
// exact in doubles on every engine; no lib/dmath needed. Math.pow would not be —
// hence mpow for the Zipf weights.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const E = 128 // experts in the layer
const K = 8 // routed per token
const WARMUP = 60
const STEPS = 400
const RASTER = 96

const lcg = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Sim = {
  trace: number[][]
  lru: number
  prefill: number
  static_: number
}

// Zipf popularity over a fixed shuffle of the expert ids: rank r gets weight
// r^-ZIPF, and which id holds which rank is scrambled once. Returned as a
// normalized CDF for sampling.
const ZIPF = 0.75
const popularityCdf = (() => {
  const r = lcg(0xc0ffee)
  const ids = Array.from({ length: E }, (_, i) => i)
  for (let i = E - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const t = ids[i]
    ids[i] = ids[j]
    ids[j] = t
  }
  const w = new Array<number>(E).fill(0)
  ids.forEach((id, rank) => {
    w[id] = 1 / mpow(rank + 1, ZIPF)
  })
  const cum: number[] = []
  let s = 0
  for (let i = 0; i < E; i++) {
    s += w[i]
    cum.push(s)
  }
  return cum.map((c) => c / s)
})()

const sample = (u: number) => {
  let lo = 0
  let hi = E - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (popularityCdf[mid] < u) lo = mid + 1
    else hi = mid
  }
  return lo
}

function simulate(locality: number, capacityPct: number): Sim {
  const rand = lcg(0x5eed1234)
  const C = Math.max(1, Math.round((capacityPct / 100) * E))

  const trace: number[][] = []
  let prev: number[] = []
  for (let t = 0; t < STEPS; t++) {
    const picked = new Set<number>()
    for (let i = 0; i < K; i++) {
      if (prev.length > 0 && rand() < locality) picked.add(prev[Math.floor(rand() * prev.length)])
      else picked.add(sample(rand()))
    }
    const step = Array.from(picked)
    trace.push(step)
    prev = step
  }

  // llama.cpp: a slice fixed at load time, blind to routing.
  const staticSet = new Set<number>()
  for (let i = 0; i < C; i++) staticSet.add(i)

  // KTransformers: frequencies observed during warmup, then frozen.
  const freq = new Array<number>(E).fill(0)
  for (let t = 0; t < WARMUP; t++) for (const e of trace[t]) freq[e]++
  const pinned = new Set<number>(
    Array.from({ length: E }, (_, i) => i)
      .sort((a, b) => freq[b] - freq[a] || a - b)
      .slice(0, C),
  )

  // FreeToken: a Map keeps insertion order, so re-inserting on a hit is exactly
  // an LRU touch and the first key is always the least recently demanded.
  const lru = new Map<number, true>()

  let lruMiss = 0
  let pinMiss = 0
  let staMiss = 0
  let reads = 0

  for (let t = 0; t < STEPS; t++) {
    for (const e of trace[t]) {
      if (t >= WARMUP) {
        reads++
        if (!pinned.has(e)) pinMiss++
        if (!staticSet.has(e)) staMiss++
      }
      if (lru.has(e)) {
        lru.delete(e)
        lru.set(e, true)
      } else {
        if (t >= WARMUP) lruMiss++
        if (lru.size >= C) lru.delete(lru.keys().next().value as number)
        lru.set(e, true)
      }
    }
  }

  return {
    trace,
    lru: (100 * lruMiss) / reads,
    prefill: (100 * pinMiss) / reads,
    static_: (100 * staMiss) / reads,
  }
}

const MEASURED = [
  { l: "FreeToken · global LRU", q: 16, d: 39, c: ACCENT },
  { l: "KTransformers · prefill-updated", q: 41, d: 59, c: MUTED },
  { l: "llama.cpp · static split", q: 62, d: 89, c: MUTED },
]

export function ExpertLocality() {
  const [locality, setLocality] = useState(69)
  const [capacity, setCapacity] = useState(37)
  const sim = useMemo(() => simulate(locality / 100, capacity), [locality, capacity])

  const rows = [
    { l: "FreeToken · global LRU", v: sim.lru, c: ACCENT, note: "residency follows the router" },
    { l: "KTransformers · prefill-updated", v: sim.prefill, c: WARM, note: "frozen after warmup" },
    { l: "llama.cpp · static split", v: sim.static_, c: MUTED, note: "chosen at load time" },
  ]

  const RW = 720
  const RH = 96
  const cw = RW / RASTER
  const ch = RH / E

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          synthetic router · {E} experts · top-{K} per token · cache holds {Math.round((capacity / 100) * E)}
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {sim.lru.toFixed(0)}% vs {sim.static_.toFixed(0)}% miss
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${RW} ${RH}`} width={RW} height={RH} role="img" className="min-w-[600px] max-w-full">
            <title>
              A raster of which experts the router selects at each decode step, showing horizontal streaks where the
              same experts are reused across consecutive steps
            </title>
            <rect x={0} y={0} width={RW} height={RH} fill="currentColor" fillOpacity={0.04} rx={4} />
            {sim.trace.slice(WARMUP, WARMUP + RASTER).map((step, t) =>
              step.map((e) => (
                <rect
                  key={`${t}-${e}`}
                  x={t * cw}
                  y={e * ch}
                  width={Math.max(1, cw - 0.3)}
                  height={Math.max(1, ch)}
                  fill={ACCENT}
                  fillOpacity={0.85}
                />
              )),
            )}
          </svg>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-mono text-[9px] text-muted-foreground">decode step →</span>
          <span className="font-mono text-[9px] text-muted-foreground">↑ expert id · horizontal streaks are the locality</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">locality</span>
            <Range
              min={0}
              max={98}
              step={1}
              value={locality}
              onChange={(e) => setLocality(Number(e.target.value))}
              className="flex-1"
              aria-label="probability that a routed expert repeats from the previous step"
              accent={ACCENT}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {locality}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">cache size</span>
            <Range
              min={5}
              max={95}
              step={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="flex-1"
              aria-label="GPU cache capacity as a percentage of the expert pool"
              accent={GOOD}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {capacity}%
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          {rows.map((r) => (
            <div key={r.l} className="flex items-center gap-2">
              <span className="w-52 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{r.l}</span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${r.v}%`, background: r.c }} />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: r.c }}>
                {r.v.toFixed(0)}%
              </span>
              <span className="hidden w-36 shrink-0 font-mono text-[9px] text-muted-foreground sm:inline">{r.note}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            what the paper actually measured, replaying real traces at the RTX 5090 serving capacity
          </div>
          <div className="mt-1.5 space-y-0.5">
            {MEASURED.map((m) => (
              <div key={m.l} className="flex items-baseline gap-2 font-mono text-[10px]">
                <span className="w-52 shrink-0 truncate text-right text-muted-foreground">{m.l}</span>
                <span className="w-24 shrink-0 tabular-nums" style={{ color: m.c }}>
                  {m.q}% Qwen3.6
                </span>
                <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{m.d}% DSV4-Flash</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
            37% of Qwen3.6&rsquo;s expert pool fits on the card; 11% of DeepSeek-V4-Flash&rsquo;s does.
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag <em>locality</em>{" "}down to zero and something worth seeing happens: the frozen frequency pin
          overtakes LRU. With no short-range structure left, global popularity is the only signal in the workload,
          and pinning the popular experts is the right thing to do. Drag it back up and the ordering inverts. Both
          rules are correct answers to different questions — which is exactly why{" "}
          <span className="text-foreground">choosing between them at load time is a bet</span>, and why FreeToken
          declines to make it.
          <br />
          <br />
          The bottom row never moves, though, and that is the asymmetry worth naming. A routing-blind split&rsquo;s
          hit rate is capped at its capacity share no matter how predictable the workload becomes, because it never
          looks: hold 37% of the pool and you miss roughly 63% of reads, forever. LRU has no such ceiling — its
          miss rate is set by how fast the working set turns over, which is a property of the model rather than of
          the cache. And this is what makes the <span className="font-mono text-[11px] text-foreground">q★</span>{" "}
          split cheap in the first place: fewer misses per layer means less traffic to divide.
        </p>
      </div>
    </figure>
  )
}
