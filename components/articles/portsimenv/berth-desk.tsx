"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A four-ship toy quay with PortSimEnv's rules, re-implemented from
// berth_core/check.py (evaluate) and berth_core/reward.py (score_v3).
// The ships are made up; the rules, the cost and the reward are the
// environment's:
//
//   hours alongside = ceil(workload / cranes)
//   rules: dock at or after arrival, stay on the quay, no shared section-hour
//          with another ship or a closure, cranes within the ship's range,
//          cranes working in every hour <= the pool (less any outage)
//   cost  = sum(sections x hours late x weight) + 5 per ship moved off its
//           planned first section
//   reward (infeasible) = 0.2 x clean ships / ships
//   reward (feasible)   = 0.2 + 0.8 exp(-g / 0.5),
//                         g = (cost - optimum) / (optimum - floor + 100)
//
// The optimum (24) and the floor (16) were found offline by exhaustive search
// over every hour, section and crane count for these four ships. Wind windows
// and the movements-per-hour limit are left out to keep the toy small.

type Ship = {
  name: string
  sections: number
  arrival: number
  workload: number
  minC: number
  maxC: number
  stdC: number
  plannedHour: number
  plannedSection: number
  due: number
  weight: number
  note: string
}

const SHIPS: Ship[] = [
  { name: "AURORA", sections: 4, arrival: 0, workload: 12, minC: 1, maxC: 3, stdC: 2, plannedHour: 0, plannedSection: 1, due: 6, weight: 1, note: "on time" },
  { name: "BALEAR", sections: 4, arrival: 4, workload: 8, minC: 1, maxC: 2, stdC: 2, plannedHour: 0, plannedSection: 5, due: 4, weight: 1, note: "4 h late" },
  { name: "CORAL", sections: 4, arrival: 6, workload: 12, minC: 1, maxC: 3, stdC: 2, plannedHour: 6, plannedSection: 1, due: 12, weight: 3, note: "priority x3" },
  { name: "DELTA", sections: 3, arrival: 8, workload: 6, minC: 1, maxC: 2, stdC: 1, plannedHour: 8, plannedSection: 6, due: 14, weight: 1, note: "on time" },
]

const FIRST = 1
const LAST = 10
const POOL = 4
const CLOSURE = { first: 1, last: 4, start: 6, end: 14, label: "fender repair" }
const OUTAGE = { start: 10, end: 16, cranes: 1 }
const MOVE_PENALTY = 5
const OPTIMUM = 24
const FLOOR = 16
const GAP_K = 100
const HORIZON = 30

type Entry = { hour: number; section: number; cranes: number }

const PUBLISHED: Entry[] = SHIPS.map((s) => ({ hour: s.plannedHour, section: s.plannedSection, cranes: s.stdC }))
const BEST: Entry[] = [
  { hour: 0, section: 1, cranes: 2 },
  { hour: 4, section: 5, cranes: 2 },
  { hour: 8, section: 5, cranes: 3 },
  { hour: 12, section: 6, cranes: 2 },
]
const WAIT: Entry[] = [
  { hour: 0, section: 1, cranes: 2 },
  { hour: 4, section: 5, cranes: 2 },
  { hour: 14, section: 1, cranes: 3 },
  { hour: 8, section: 8, cranes: 2 },
]

const PRESETS = [
  { label: "published plan", plan: PUBLISHED },
  { label: "CORAL waits for its berth", plan: WAIT },
  { label: "the optimum", plan: BEST },
]

const poolAt = (t: number) => (OUTAGE.start <= t && t < OUTAGE.end ? POOL - OUTAGE.cranes : POOL)
const stay = (s: Ship, c: number) => Math.max(1, Math.ceil(s.workload / c))

function evaluate(plan: Entry[]) {
  const problems: string[][] = SHIPS.map(() => [])
  const rects = plan.map((e, i) => {
    const s = SHIPS[i]
    const okC = s.minC <= e.cranes && e.cranes <= s.maxC
    const dur = stay(s, okC ? e.cranes : s.stdC)
    return { t0: e.hour, t1: e.hour + dur, m0: e.section, m1: e.section + s.sections - 1, okC }
  })
  rects.forEach((r, i) => {
    const s = SHIPS[i]
    if (!r.okC) problems[i].push(`gets ${plan[i].cranes} cranes but can be worked by ${s.minC}-${s.maxC}`)
    if (r.t0 < s.arrival) problems[i].push(`berths at hour ${r.t0} but cannot arrive before hour ${s.arrival}`)
    if (r.m0 < FIRST || r.m1 > LAST) problems[i].push(`needs sections ${r.m0}-${r.m1}, quay is ${FIRST}-${LAST}`)
    if (r.m0 <= CLOSURE.last && CLOSURE.first <= r.m1 && r.t0 < CLOSURE.end && CLOSURE.start < r.t1)
      problems[i].push(`overlaps closed sections ${CLOSURE.first}-${CLOSURE.last} during hours ${CLOSURE.start}-${CLOSURE.end}`)
  })
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const A = rects[a]
      const B = rects[b]
      if (A.t0 < B.t1 && B.t0 < A.t1 && A.m0 <= B.m1 && B.m0 <= A.m1) {
        problems[a].push(`overlaps ${SHIPS[b].name}`)
        problems[b].push(`overlaps ${SHIPS[a].name}`)
      }
    }
  }
  const use: number[] = []
  for (let t = 0; t <= HORIZON + 6; t++) {
    let u = 0
    rects.forEach((r, i) => {
      if (r.t0 <= t && t < r.t1) u += plan[i].cranes
    })
    use.push(u)
  }
  rects.forEach((r, i) => {
    const over: number[] = []
    for (let t = r.t0; t < r.t1; t++) if (t >= 0 && t < use.length && use[t] > poolAt(t)) over.push(t)
    if (over.length) {
      const t = over[0]
      problems[i].push(`cranes over the pool from hour ${t} (${use[t]} in use, ${poolAt(t)} available)`)
    }
  })
  const lines = rects.map((r, i) => {
    const s = SHIPS[i]
    const late = Math.max(0, r.t1 - s.due)
    const moved = plan[i].section !== s.plannedSection
    return { late, moved, cost: s.sections * late * s.weight + (moved ? MOVE_PENALTY : 0) }
  })
  const feasible = problems.every((p) => p.length === 0)
  const clean = problems.filter((p) => p.length === 0).length / SHIPS.length
  const cost = lines.reduce((acc, l) => acc + l.cost, 0)
  let reward: number
  if (!feasible) reward = 0.2 * clean
  else {
    const g = Math.max(0, cost - OPTIMUM) / (Math.max(0, OPTIMUM - FLOOR) + GAP_K)
    reward = 0.2 + 0.8 * mexp(-g / 0.5)
  }
  return { rects, problems, lines, use, feasible, clean, cost, reward }
}

const W = 720
const H = 300
const padL = 34
const padR = 10
const padT = 12
const chartH = 196
const strip = 52
const r2 = (n: number) => Math.round(n * 100) / 100
const SHIP_FILL = ["oklch(0.72 0.11 230)", "oklch(0.74 0.12 160)", "oklch(0.76 0.13 70)", "oklch(0.72 0.11 300)"]

export function BerthDesk() {
  const [plan, setPlan] = useState<Entry[]>(PUBLISHED)
  const res = useMemo(() => evaluate(plan), [plan])

  const sx = (h: number) => r2(padL + (h / HORIZON) * (W - padL - padR))
  const sy = (sec: number) => r2(padT + ((sec - FIRST) / (LAST - FIRST + 1)) * chartH)
  const secH = chartH / (LAST - FIRST + 1)
  const stripTop = padT + chartH + 18
  const cy = (c: number) => r2(stripTop + strip - (c / 5) * strip)

  const set = (i: number, patch: Partial<Entry>) =>
    setPlan((p) => p.map((e, k) => (k === i ? { ...e, ...patch } : e)))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    )
  const same = (a: Entry[], b: Entry[]) => a.every((e, i) => e.hour === b[i].hour && e.section === b[i].section && e.cranes === b[i].cranes)
  const btn = "h-6 w-6 cursor-pointer rounded border font-mono text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">a toy quay, graded by PortSimEnv&rsquo;s rules</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          sections {FIRST}-{LAST} · {POOL} cranes, {POOL - OUTAGE.cranes} in hours {OUTAGE.start}-{OUTAGE.end}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setPlan(p.plan)} className={chip(same(plan, p.plan))}>
              {p.label}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Dock chart for four ships over ${HORIZON} hours and sections ${FIRST} to ${LAST}, with a closure of sections ${CLOSURE.first}-${CLOSURE.last} from hour ${CLOSURE.start} to ${CLOSURE.end}, and a crane-use strip below against the pool. Current plan: ${res.feasible ? `feasible, cost ${res.cost}` : "breaks a rule"}, reward ${res.reward.toFixed(3)}.`}
        >
          <defs>
            <pattern id="bd-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
            </pattern>
          </defs>
          {Array.from({ length: HORIZON / 2 + 1 }, (_, k) => k * 2).map((h) => (
            <g key={h}>
              <line x1={sx(h)} y1={padT} x2={sx(h)} y2={padT + chartH} stroke="currentColor" strokeOpacity={0.06} />
              {h % 4 === 0 && (
                <text x={sx(h)} y={padT + chartH + 11} textAnchor="middle" fontSize="9" className="fill-muted-foreground/70 font-mono">
                  {h}h
                </text>
              )}
            </g>
          ))}
          {Array.from({ length: LAST - FIRST + 1 }, (_, k) => FIRST + k).map((sec) => (
            <text key={sec} x={padL - 6} y={r2(sy(sec) + secH / 2 + 3)} textAnchor="end" fontSize="9" className="fill-muted-foreground/70 font-mono">
              §{sec}
            </text>
          ))}
          <rect
            x={sx(CLOSURE.start)}
            y={sy(CLOSURE.first)}
            width={r2(sx(CLOSURE.end) - sx(CLOSURE.start))}
            height={r2(secH * (CLOSURE.last - CLOSURE.first + 1))}
            fill="url(#bd-hatch)"
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeDasharray="4 3"
            className="text-muted-foreground"
          />
          <text x={r2(sx(CLOSURE.start) + 4)} y={r2(sy(CLOSURE.last + 1) - 5)} fontSize="9" className="fill-muted-foreground font-mono">
            closed
          </text>
          {SHIPS.map((s, i) => {
            const due = s.due
            return (
              <line
                key={`due-${s.name}`}
                x1={sx(due)}
                x2={sx(due)}
                y1={sy(plan[i].section)}
                y2={r2(sy(plan[i].section) + secH * s.sections)}
                stroke={SHIP_FILL[i]}
                strokeWidth={2}
                strokeDasharray="2 2"
              />
            )
          })}
          {res.rects.map((r, i) => {
            const bad = res.problems[i].length > 0
            return (
              <g key={SHIPS[i].name}>
                <rect
                  x={sx(r.t0)}
                  y={r2(sy(r.m0) + 1)}
                  width={Math.max(2, r2(sx(r.t1) - sx(r.t0)))}
                  height={r2(secH * SHIPS[i].sections - 2)}
                  rx={3}
                  fill={SHIP_FILL[i]}
                  fillOpacity={0.55}
                  stroke={bad ? "oklch(0.6 0.2 25)" : SHIP_FILL[i]}
                  strokeWidth={bad ? 2.5 : 1.2}
                />
                <text x={r2(sx(r.t0) + 4)} y={r2(sy(r.m0) + 13)} fontSize="9.5" className="fill-foreground font-mono">
                  {SHIPS[i].name} · {plan[i].cranes}c
                </text>
              </g>
            )
          })}
          {/* crane strip */}
          <text x={padL - 6} y={stripTop + 8} textAnchor="end" fontSize="8.5" className="fill-muted-foreground/70 font-mono">
            cranes
          </text>
          {res.use.slice(0, HORIZON).map((u, t) => (
            <rect
              key={t}
              x={r2(sx(t) + 0.5)}
              y={cy(u)}
              width={r2(sx(1) - sx(0) - 1)}
              height={r2(stripTop + strip - cy(u))}
              fill={u > poolAt(t) ? "oklch(0.6 0.2 25)" : "currentColor"}
              fillOpacity={u > poolAt(t) ? 0.75 : 0.22}
            />
          ))}
          <polyline
            points={Array.from({ length: HORIZON + 1 }, (_, t) => `${sx(t)},${cy(poolAt(Math.min(t, HORIZON - 1)))}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.6}
            strokeDasharray="3 2"
          />
        </svg>

        <div className="mt-3 grid gap-2">
          {SHIPS.map((s, i) => {
            const e = plan[i]
            const bad = res.problems[i].length > 0
            return (
              <div key={s.name} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto_auto]">
                <div className="font-mono text-[11px] leading-tight">
                  <span className={cn("font-semibold", bad && "text-red-600 dark:text-red-400")}>{s.name}</span>
                  <span className="block text-muted-foreground">
                    arr {s.arrival} · due {s.due} · {s.note}
                  </span>
                </div>
                <label className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span className="w-12 shrink-0">hour {e.hour}</span>
                  <Range min={0} max={22} step={1} value={e.hour} onChange={(ev) => set(i, { hour: Number(ev.target.value) })} aria-label={`${s.name} berth hour`} />
                </label>
                <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <button type="button" className={btn} disabled={e.section <= FIRST} onClick={() => set(i, { section: e.section - 1 })} aria-label={`${s.name} section down`}>
                    −
                  </button>
                  <span className="w-10 text-center">§{e.section}</span>
                  <button type="button" className={btn} disabled={e.section + s.sections - 1 >= LAST} onClick={() => set(i, { section: e.section + 1 })} aria-label={`${s.name} section up`}>
                    +
                  </button>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <button type="button" className={btn} disabled={e.cranes <= 1} onClick={() => set(i, { cranes: e.cranes - 1 })} aria-label={`${s.name} fewer cranes`}>
                    −
                  </button>
                  <span className="w-16 text-center">
                    {e.cranes}c · {stay(s, e.cranes)}h
                  </span>
                  <button type="button" className={btn} disabled={e.cranes >= 4} onClick={() => set(i, { cranes: e.cranes + 1 })} aria-label={`${s.name} more cranes`}>
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2 font-mono text-[11px]">
            <div className="mb-1 text-muted-foreground">check_plan</div>
            {res.feasible ? (
              <div>
                feasible · cost {res.cost} ={" "}
                {res.lines
                  .map((l, i) => (l.cost ? `${SHIPS[i].name} ${l.cost}` : null))
                  .filter(Boolean)
                  .join(" + ") || "0"}
              </div>
            ) : (
              <ul className="space-y-0.5 text-red-700 dark:text-red-400">
                {res.problems.flatMap((p, i) => p.map((msg) => <li key={`${i}-${msg}`}>{SHIPS[i].name}: {msg}</li>))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border px-3 py-2 font-mono text-[11px]">
            <div className="mb-1 text-muted-foreground">submit_plan</div>
            <div className="text-base font-semibold">reward {res.reward.toFixed(3)}</div>
            <div className="text-muted-foreground">
              {res.feasible
                ? `0.2 + 0.8·exp(−g/0.5), g = (${res.cost} − ${OPTIMUM}) / (${OPTIMUM} − ${FLOOR} + ${GAP_K})`
                : `0.2 × ${Math.round(res.clean * SHIPS.length)}/${SHIPS.length} clean ships`}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Four made-up ships on a ten-section quay; the rules, cost and reward are the environment&rsquo;s, re-implemented from{" "}
        <code>check.py</code> and <code>reward.py</code>. Dashed ticks are each ship&rsquo;s due hour. The optimum (24) and floor (16) came from an
        exhaustive search over this toy. Wind windows and the movements-per-hour limit are left out.
      </figcaption>
    </figure>
  )
}
