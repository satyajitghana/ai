"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One problem, three levels, the whole loop.
//
// The problem is the paper's showcase, [24, 98, 19, 3] -> 361, the one in its
// Figure 1 and in the post's video. Everything structural is computed here from
// the rules in section 3 of the paper: a state is the sorted multiset of numbers
// still available; a move combines two of them with + - x /, and the result must
// be a positive whole number (division by 1 is skipped, as the paper's move
// lister does). "Alive" is exact: the target is still reachable.
//
// The judge's scores are NOT recomputed. They are the trained set transformer's
// own outputs, recorded by the lab in results/llm/viz_slim.json for every state
// its width-12 run judged: all 19 first-level states and the 82 distinct
// children of the 12 it kept. Any width up to 12 keeps a subset of those 12, so
// its second-level pool is a subset of the 82 and every score it needs is on
// record. That is why the slider stops at 12. Ties (only among scores that round
// to 0.000 or 0.001) break by the state's numeric order, as Python's stable sort
// does in the lab's code.
//
// "Random order" replaces the judge with a shuffle: the visual shows one draw,
// and the success rate is 2,000 draws from a seeded generator, so the server and
// the browser print the same number.

const NUMS = [3, 19, 24, 98]
const TARGET = 361
const MAX_W = 12

const L1_SCORES: [string, number][] = [["3,5,98", 0.398], ["3,19,74", 0.889], ["3,19,122", 0.819], ["3,19,2352", 0.216], ["3,24,79", 0.529], ["3,24,117", 0.369], ["3,24,1862", 0.024], ["3,43,98", 0.575], ["3,98,456", 0.384], ["8,19,98", 0.873], ["16,24,98", 0.104], ["19,21,98", 0.848], ["19,24,95", 0.854], ["19,24,101", 0.798], ["19,24,294", 0.826], ["19,27,98", 0.874], ["19,72,98", 0.75], ["22,24,98", 0.124], ["24,57,98", 0.461]]
const L2_SCORES: [string, number][] = [["2,98", 0.001], ["3,55", 0.002], ["3,93", 0.001], ["3,103", 0.002], ["3,141", 0.001], ["3,1406", 0], ["3,1896", 0], ["3,2318", 0], ["3,4214", 0], ["5,24", 0.001], ["5,95", 0.002], ["5,101", 0.002], ["5,294", 0.002], ["8,79", 0.001], ["8,98", 0.001], ["8,117", 0.001], ["8,1862", 0], ["11,98", 0.001], ["16,74", 0.001], ["16,122", 0], ["19,26", 0.064], ["19,71", 0.072], ["19,77", 0.032], ["19,90", 0.035], ["19,106", 0.003], ["19,119", 0.017], ["19,125", 0.012], ["19,170", 0.001], ["19,222", 0.004], ["19,270", 0.488], ["19,318", 0.788], ["19,366", 0.509], ["19,784", 0], ["19,2058", 0], ["19,2280", 0], ["19,2424", 0], ["19,2646", 0.001], ["19,7056", 0.001], ["21,79", 0.001], ["21,117", 0.001], ["21,1862", 0], ["22,74", 0], ["22,122", 0], ["24,41", 0.001], ["24,76", 0.001], ["24,82", 0.001], ["24,114", 0], ["24,120", 0.001], ["24,155", 0.001], ["24,237", 0.001], ["24,275", 0.001], ["24,313", 0.991], ["24,1805", 0.714], ["24,1919", 0], ["24,5586", 0], ["27,79", 0.001], ["27,98", 0.001], ["27,117", 0.001], ["27,1862", 0], ["33,98", 0.001], ["40,98", 0], ["43,95", 0.001], ["43,101", 0.001], ["43,294", 0.192], ["46,98", 0], ["53,98", 0.001], ["57,74", 0.001], ["57,122", 0.001], ["57,2352", 0], ["72,79", 0], ["72,117", 0], ["72,1862", 0], ["81,98", 0.001], ["91,98", 0.001], ["95,456", 0.728], ["98,129", 0.001], ["98,152", 0], ["98,399", 0.822], ["98,513", 0.142], ["98,1368", 0], ["101,456", 0.623], ["294,456", 0.003]]
const SCORE = new Map<string, number>([...L1_SCORES, ...L2_SCORES])

type State = number[]
const key = (s: State) => s.join(",")
const show = (s: State) => s.join(" · ")

// Every state one move away, one entry per way of getting there (duplicates
// kept, because the duplicates are what merging removes).
function moves(s: State): State[] {
  const out: State[] = []
  for (let i = 0; i < s.length; i++) {
    for (let j = 0; j < s.length; j++) {
      if (i === j) continue
      const a = s[i]
      const b = s[j]
      const rest = s.filter((_, k) => k !== i && k !== j)
      const rs: number[] = []
      if (i < j) rs.push(a + b, a * b)
      if (a > b) rs.push(a - b)
      if (b > 1 && a % b === 0) rs.push(a / b)
      for (const r of rs) out.push([...rest, r].sort((x, y) => x - y))
    }
  }
  return out
}

const aliveMemo = new Map<string, boolean>()
function alive(s: State): boolean {
  const k = key(s)
  const hit = aliveMemo.get(k)
  if (hit !== undefined) return hit
  const v = s.length === 1 ? s[0] === TARGET : moves(s).some(alive)
  aliveMemo.set(k, v)
  return v
}

// The last move, written out: which operation turns this pair into the target.
function finish(s: State): string {
  const [a, b] = s
  if (a + b === TARGET) return `${a} + ${b}`
  if (a * b === TARGET) return `${a} × ${b}`
  if (b - a === TARGET) return `${b} − ${a}`
  return `${b} ÷ ${a}`
}

function byTuple(a: State, b: State) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

function distinct(raw: State[], skip: Set<string>): State[] {
  const seen = new Map<string, State>()
  for (const s of raw) {
    const k = key(s)
    if (s.length > 1 && !skip.has(k) && !seen.has(k)) seen.set(k, s)
  }
  return [...seen.values()].sort(byTuple)
}

// mulberry32: integer arithmetic only, identical on every engine.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Mode = "judge" | "random" | "oracle"

function order(pool: State[], mode: Mode, next: () => number): State[] {
  if (mode === "judge") {
    return [...pool].sort((a, b) => (SCORE.get(key(b)) ?? -1) - (SCORE.get(key(a)) ?? -1))
  }
  if (mode === "oracle") return [...pool].sort((a, b) => Number(alive(b)) - Number(alive(a)))
  const p = [...pool]
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  return p
}

const START: State = [...NUMS].sort((a, b) => a - b)
const RAW1 = moves(START)
const POOL1 = distinct(RAW1, new Set([key(START)]))

function run(width: number, mode: Mode, next: () => number) {
  const ranked1 = order(POOL1, mode, next)
  const kept1 = ranked1.slice(0, width)
  const expanded = new Set([key(START), ...kept1.map(key)])
  const raw2 = kept1.flatMap(moves)
  const pool2 = distinct(raw2, expanded)
  const ranked2 = order(pool2, mode, next)
  const kept2 = ranked2.slice(0, width)
  const goalParent = kept2.find((s) => moves(s).some((c) => c.length === 1 && c[0] === TARGET))
  const finals = kept2.flatMap(moves)
  return { ranked1, kept1, raw2, pool2, ranked2, kept2, goalParent, finals }
}

const MODES: { id: Mode; label: string }[] = [
  { id: "judge", label: "trained judge (recorded scores)" },
  { id: "random", label: "random order" },
  { id: "oracle", label: "exact solver" },
]

const ALIVE = "oklch(0.62 0.16 150)"
const KEPT = "oklch(0.60 0.15 255)"

export function FrontierExplorer() {
  const [width, setWidth] = useState(12)
  const [mode, setMode] = useState<Mode>("judge")
  const [draw, setDraw] = useState(1)

  const r = useMemo(() => run(width, mode, rng(draw)), [width, mode, draw])

  const randomRate = useMemo(() => {
    if (mode !== "random") return null
    const next = rng(2026)
    let ok = 0
    const T = 2000
    for (let t = 0; t < T; t++) if (run(width, "random", next).goalParent) ok++
    return ok / T
  }, [width, mode])

  const alive1 = POOL1.filter(alive).length
  const alive2 = r.pool2.filter(alive).length
  const judged = POOL1.length + r.pool2.length
  const merged = r.raw2.length - r.pool2.length
  const aliveRank = r.ranked2.findIndex(alive)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">rank by</span>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={m.id === mode}
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-xs transition-colors",
              m.id === mode
                ? "border-foreground/40 bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {m.label}
          </button>
        ))}
        {mode === "random" ? (
          <button
            type="button"
            onClick={() => setDraw((d) => d + 1)}
            className="rounded-sm border px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-muted"
          >
            reshuffle
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <label htmlFor="frontier-width" className="font-mono text-xs text-muted-foreground">
          width W = {width}
        </label>
        <Range
          id="frontier-width"
          min={1}
          max={MAX_W}
          step={1}
          value={width}
          onChange={(e) => setWidth(Number(e.currentTarget.value))}
          className="min-w-40 flex-1"
        />
        <span className="font-mono text-xs text-muted-foreground">
          {NUMS.join(", ")} → {TARGET}
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* level 1 */}
        <section>
          <p className="my-0 font-mono text-xs text-muted-foreground">
            <span className="text-foreground">level 1</span> · {RAW1.length} moves from the start →{" "}
            {POOL1.length} distinct states · {alive1} alive · all {POOL1.length} judged · keep {width}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {r.ranked1.map((s) => {
              const k = key(s)
              const kept = r.kept1.some((x) => key(x) === k)
              const live = alive(s)
              return (
                <span
                  key={k}
                  title={live ? "alive: 361 is still reachable" : "dead"}
                  className={cn(
                    "rounded-sm border px-1.5 py-0.5 font-mono text-[11px]",
                    kept ? "text-foreground" : "text-muted-foreground/70"
                  )}
                  style={{
                    borderColor: live ? ALIVE : undefined,
                    boxShadow: live ? `inset 0 0 0 1px ${ALIVE}` : undefined,
                    background: kept ? "color-mix(in oklab, " + KEPT + " 16%, transparent)" : undefined,
                  }}
                >
                  {show(s)}
                  {mode === "judge" ? (
                    <span className="text-muted-foreground"> {(SCORE.get(k) ?? 0).toFixed(2)}</span>
                  ) : null}
                </span>
              )
            })}
          </div>
        </section>

        {/* level 2 */}
        <section>
          <p className="my-0 font-mono text-xs text-muted-foreground">
            <span className="text-foreground">level 2</span> · {width} kept × their moves ={" "}
            {r.raw2.length} children → merge → {r.pool2.length} distinct ({merged} merged away) ·{" "}
            {alive2} alive · keep {width}
          </p>
          <div className="mt-2 flex flex-wrap gap-[3px]" aria-hidden>
            {r.ranked2.map((s, i) => {
              const live = alive(s)
              const kept = i < width
              return (
                <span
                  key={key(s)}
                  title={`${show(s)}${live ? " (alive)" : ""}`}
                  className="inline-block h-3 w-3 rounded-[2px] border"
                  style={{
                    background: kept ? KEPT : "transparent",
                    borderColor: live ? ALIVE : "var(--border)",
                    boxShadow: live ? `0 0 0 1.5px ${ALIVE}` : undefined,
                  }}
                />
              )
            })}
          </div>
          <p className="mt-2 mb-0 font-mono text-xs text-muted-foreground">
            kept: {r.kept2.map(show).join("  ")}
          </p>
          <p className="mt-1 mb-0 font-mono text-xs text-muted-foreground">
            {alive2 === 0
              ? "no second-level state can reach 361: the right first move was not kept"
              : `the alive state${alive2 > 1 ? "s rank" : " ranks"} ${r.ranked2
                  .map((s, i) => (alive(s) ? i + 1 : 0))
                  .filter(Boolean)
                  .join(", ")} of ${r.pool2.length}${aliveRank >= 0 && aliveRank < width ? " — inside the cut" : " — outside the cut"}`}
          </p>
        </section>

        {/* level 3 */}
        <section>
          <p className="my-0 font-mono text-xs text-muted-foreground">
            <span className="text-foreground">level 3</span> · {width} kept × their moves ={" "}
            {r.finals.length} final values, each checked against {TARGET} for free
          </p>
          <p
            className="mt-2 mb-0 font-mono text-sm"
            style={{ color: r.goalParent ? ALIVE : undefined }}
          >
            {r.goalParent
              ? `solved: ${show(r.goalParent)} → ${finish(r.goalParent)} = ${TARGET}, in 3 levels`
              : "not solved in this pass"}
          </p>
        </section>
      </div>

      <div className="border-t px-4 py-3 font-mono text-xs">
        <span className="text-foreground">judged: {judged} states</span>
        <span className="text-muted-foreground">
          {" "}
          · {mode === "random" && randomRate !== null
            ? `random order solves ${(randomRate * 100).toFixed(1)}% of shuffles at W = ${width}`
            : mode === "oracle"
              ? "a perfect ranking needs W = 1"
              : "the recorded judge needs W = 4 on this problem"}
        </span>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Green outline: alive (361 still reachable). Blue fill: kept. The whole problem has 126
        non-terminal states and 556 complete move sequences; 4 of them reach 361. Judge scores are the
        lab&apos;s recorded outputs for this problem; the move rules and alive labels are computed here.
      </figcaption>
    </figure>
  )
}
