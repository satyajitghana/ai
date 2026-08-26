"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Cache-aware scheduling, from python/sglang/srt/managers/schedule_policy.py.
//
// SchedulePolicy.calc_priority runs on every prefill scheduling pass over the
// whole waiting queue. Two cache-aware orders exist:
//
//   class CacheAwarePolicy(Enum):
//       LPM = "lpm"                # longest prefix match
//       DFS_WEIGHT = "dfs-weight"  # depth-first search weighting
//
// _sort_by_longest_prefix sorts by -r.num_matched_prefix_tokens, so whichever
// waiting request already has the most of its prompt sitting in the radix tree
// runs next; the tree is then still warm for its siblings.
//
// Two things the marketing does not mention.
//
// 1. server_args.py: schedule_policy defaults to "fcfs", not "lpm". The paper
//    ablates FCFS as a degradation (Fig. 8c) and it is now the default.
//
// 2. _determine_active_policy:
//
//        if self.policy == CacheAwarePolicy.LPM and len(waiting_queue) > 128:
//            # Turn off the expensive prefix matching and sorting when the
//            # #queue is large.
//            return CacheAgnosticPolicy.FCFS
//
//    LPM switches itself off above 128 queued requests -- which is the load at
//    which ordering matters most.
//
// The simulation below is the smallest honest version: nine requests drawn from
// three prefix families, one shared token budget, LRU by family. LPM is modelled
// the way the scheduler actually behaves -- re-sort, pop one, repeat -- rather
// than as a single up-front sort.

const FAMS = [
  { id: "A", label: "agent prompt + tools", prefix: 2048, colour: "oklch(0.60 0.15 255)" },
  { id: "B", label: "RAG template", prefix: 1024, colour: "oklch(0.55 0.16 155)" },
  { id: "C", label: "few-shot pack", prefix: 1536, colour: "oklch(0.68 0.13 85)" },
] as const

const MISS = "oklch(0.58 0.19 27)"
const MUTED = "oklch(0.62 0.03 250)"

const TAIL = 96
// arrival order: three interleaved conversations, the shape every chat server sees
const ARRIVALS = [0, 1, 2, 0, 1, 2, 0, 1, 2]

type Step = { fam: number; hit: boolean; cost: number }

function simulate(order: number[], budget: number): { steps: Step[]; total: number; reused: number; asked: number } {
  const cached: number[] = [] // family indices, most-recently-used last
  let used = 0
  const steps: Step[] = []
  let reused = 0
  let asked = 0

  for (const f of order) {
    const p = FAMS[f].prefix
    asked += p
    const hit = cached.includes(f)
    if (hit) {
      reused += p
      cached.splice(cached.indexOf(f), 1)
      cached.push(f)
      steps.push({ fam: f, hit: true, cost: TAIL })
    } else {
      while (used + p > budget && cached.length > 0) {
        const victim = cached.shift() as number
        used -= FAMS[victim].prefix
      }
      if (used + p <= budget) {
        cached.push(f)
        used += p
      }
      steps.push({ fam: f, hit: false, cost: p + TAIL })
    }
  }
  return { steps, total: steps.reduce((a, s) => a + s.cost, 0), reused, asked }
}

function lpmOrder(budget: number): number[] {
  // greedy stand-in for "re-run calc_priority, pop the best match, repeat"
  const remaining = ARRIVALS.map((f, i) => ({ f, i }))
  const cached: number[] = []
  let used = 0
  const out: number[] = []
  while (remaining.length > 0) {
    let best = 0
    let bestMatch = -1
    remaining.forEach((r, k) => {
      const m = cached.includes(r.f) ? FAMS[r.f].prefix : 0
      if (m > bestMatch || (m === bestMatch && remaining[best].i > r.i)) {
        bestMatch = m
        best = k
      }
    })
    const pick = remaining.splice(best, 1)[0]
    out.push(pick.f)
    const p = FAMS[pick.f].prefix
    if (cached.includes(pick.f)) {
      cached.splice(cached.indexOf(pick.f), 1)
      cached.push(pick.f)
    } else {
      while (used + p > budget && cached.length > 0) {
        const victim = cached.shift() as number
        used -= FAMS[victim].prefix
      }
      if (used + p <= budget) {
        cached.push(pick.f)
        used += p
      }
    }
  }
  return out
}

export function LpmQueue() {
  const [policy, setPolicy] = useState<"fcfs" | "lpm">("fcfs")
  const [budget, setBudget] = useState(2816)
  const [flooded, setFlooded] = useState(false)

  const downgraded = policy === "lpm" && flooded
  const effective = downgraded ? "fcfs" : policy

  const fcfs = simulate(ARRIVALS, budget)
  const lpm = simulate(lpmOrder(budget), budget)
  const shown = effective === "lpm" ? lpm : fcfs
  const hitRate = shown.asked > 0 ? (100 * shown.reused) / shown.asked : 0

  const W = 700
  const H = 178
  const BX = 118
  const BW = 500
  const scale = Math.max(fcfs.total, lpm.total)
  const bar = (v: number) => (v / scale) * BW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          nine requests, three shared prefixes, one KV budget
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: effective === "lpm" ? FAMS[1].colour : MISS }}
        >
          {shown.total.toLocaleString()} prefill tokens · {hitRate.toFixed(0)}% of prefix tokens reused
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["fcfs", "--schedule-policy fcfs (default)"],
              ["lpm", "--schedule-policy lpm"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPolicy(k)}
              aria-pressed={policy === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                policy === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFlooded((v) => !v)}
            aria-pressed={flooded}
            className={cn(
              "ml-2 cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              flooded
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            waiting queue &gt; 128
          </button>
        </div>

        <label className="mt-3 block">
          <span className="flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
            <span>KV budget for cached prefixes</span>
            <span className="text-foreground">{budget.toLocaleString()} tokens</span>
          </span>
          <Range
            min={1024}
            max={5120}
            step={256}
            value={budget}
            accent={FAMS[0].colour}
            aria-label="KV budget for cached prefixes, in tokens"
            onChange={(e) => setBudget(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>

        {downgraded ? (
          <p className="mt-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px]" style={{ color: MISS }}>
            _determine_active_policy: len(waiting_queue) &gt; 128 → CacheAgnosticPolicy.FCFS
          </p>
        ) : null}

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Execution order under ${effective.toUpperCase()} with a ${budget}-token prefix budget: ${shown.steps.filter((s) => s.hit).length} of nine requests hit the radix cache, for ${shown.total} prefill tokens against ${Math.max(fcfs.total, lpm.total)} in the worse ordering.`}
            </title>

            <text x={24} y={16} fontSize={8} fill={MUTED} fontFamily="ui-monospace, monospace">
              execution order
            </text>

            {shown.steps.map((s, i) => {
              const f = FAMS[s.fam]
              const x = 24 + i * 74
              const nth = shown.steps.slice(0, i + 1).filter((k) => k.fam === s.fam).length
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={26}
                    width={64}
                    height={24}
                    rx={4}
                    fill={f.colour}
                    fillOpacity={s.hit ? 0.28 : 0.09}
                    stroke={s.hit ? f.colour : MISS}
                    strokeOpacity={0.8}
                    strokeDasharray={s.hit ? undefined : "3 2"}
                  />
                  <text
                    x={x + 32}
                    y={41}
                    fontSize={8}
                    textAnchor="middle"
                    fill={f.colour}
                    fontFamily="ui-monospace, monospace"
                  >
                    {f.id}
                    {nth}
                  </text>
                  <text
                    x={x + 32}
                    y={62}
                    fontSize={7.5}
                    textAnchor="middle"
                    fill={s.hit ? f.colour : MISS}
                    fontFamily="ui-monospace, monospace"
                  >
                    {s.hit ? "hit" : "miss"}
                  </text>
                  <text
                    x={x + 32}
                    y={73}
                    fontSize={7}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={0.45}
                    fontFamily="ui-monospace, monospace"
                  >
                    {s.cost.toLocaleString()}
                  </text>
                </g>
              )
            })}

            <text x={24} y={100} fontSize={8} fill={MUTED} fontFamily="ui-monospace, monospace">
              total prefill tokens
            </text>

            {(
              [
                ["fcfs", fcfs.total, MISS, 112],
                ["lpm", lpm.total, FAMS[1].colour, 138],
              ] as const
            ).map(([label, v, colour, y]) => (
              <g key={label} opacity={effective === label ? 1 : 0.42}>
                <text
                  x={BX - 10}
                  y={y + 10}
                  fontSize={8.5}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.6}
                  fontFamily="ui-monospace, monospace"
                >
                  {label}
                </text>
                <rect x={BX} y={y} width={bar(v)} height={13} rx={2.5} fill={colour} fillOpacity={0.8} />
                <text
                  x={BX + bar(v) + 8}
                  y={y + 10}
                  fontSize={8.5}
                  fill={colour}
                  fontFamily="ui-monospace, monospace"
                >
                  {v.toLocaleString()}
                </text>
              </g>
            ))}

            {FAMS.map((f, i) => (
              <g key={f.id}>
                <rect x={24 + i * 216} y={H - 12} width={8} height={8} rx={1.5} fill={f.colour} fillOpacity={0.75} />
                <text
                  x={24 + i * 216 + 12}
                  y={H - 5}
                  fontSize={7.5}
                  fill="currentColor"
                  fillOpacity={0.5}
                  fontFamily="ui-monospace, monospace"
                >
                  {f.id} · {f.label} · {f.prefix.toLocaleString()} tok
                </text>
              </g>
            ))}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Three conversations arrive interleaved, which is what a chat server actually gets. Under{" "}
          <span className="font-mono text-[11px] text-foreground">fcfs</span>{" "}with a budget too
          small to hold all three prefixes, every request evicts the prefix the next one needs, and
          the tree earns nothing at all. Under{" "}
          <span className="font-mono text-[11px] text-foreground">lpm</span>{" "}the scheduler runs the
          request with the longest live match first, so a family is drained while its prefix is
          still resident.
          <br />
          <br />
          Drag the budget up and the two orders converge — which is the real result. Cache-aware
          scheduling is not a throughput trick; it is{" "}
          <span className="text-foreground">a way of making a small cache behave like a big one</span>
          , and it buys exactly nothing once the cache fits the working set.
          <br />
          <br />
          Two footnotes the benchmarks tend to skip. The default is{" "}
          <span className="font-mono text-[11px] text-foreground">fcfs</span>, not{" "}
          <span className="font-mono text-[11px] text-foreground">lpm</span>. And{" "}
          <span className="text-foreground">LPM turns itself off above 128 queued requests</span>,
          because re-matching the whole queue every scheduling pass costs more than it saves — press
          the third button to watch the policy quietly become the thing it was meant to beat.
        </p>
      </div>
    </figure>
  )
}
