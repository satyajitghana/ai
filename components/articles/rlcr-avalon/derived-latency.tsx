"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Derived latency, as the Avalon-M1 report computes it (Appendix C.2), replayed
// over a toy event log. The five rules and the two rates are the report's:
//
//   1. each agent has its own clock; a model call adds n_in/15,000 + n_out/50 s,
//      n_in counting only prompt tokens new to that agent's context
//   2. a tool call adds its measured execution time
//   3. waiting for messages is free
//   4. a hire starts at the CEO's clock; a received message moves the receiver's
//      clock up to the sender's clock at sending, if that is later
//   5. the task's latency is the largest clock
//
// The log itself (token counts, tool times, rounds) is illustrative. The
// co-ordination share per team size is interpolated between the two training
// figures the report gives: 9% of working time with one specialist and 32% with
// eight (Section 4.4.1).

const PREFILL = 15000
const DECODE = 50
const ROUNDS = 6
const TOOL_S = 20
const PLAN_OUT = 4000
const HIRE_OUT = 400
const FINAL_OUT = 4000
const ROLE_IN = 2500
const ROUND_IN = 1500

type Ev =
  | { k: "call"; a: number; nin: number; nout: number }
  | { k: "tool"; a: number; s: number }
  | { k: "spawn"; from: number; to: number }
  | { k: "send"; from: number; to: number }
  | { k: "recv"; a: number }

type Seg = { a: number; t0: number; t1: number; kind: "call" | "tool" }

function coordShare(h: number) {
  if (h <= 0) return 0
  return 0.09 + ((h - 1) * (0.32 - 0.09)) / 7
}

function buildLog(h: number, work: number): Ev[] {
  const log: Ev[] = [{ k: "call", a: 0, nin: 4000, nout: PLAN_OUT }]
  if (h === 0) {
    for (let r = 0; r < ROUNDS; r++) {
      log.push({ k: "call", a: 0, nin: ROUND_IN, nout: work / ROUNDS })
      log.push({ k: "tool", a: 0, s: TOOL_S })
    }
    log.push({ k: "call", a: 0, nin: ROUND_IN, nout: FINAL_OUT })
    return log
  }
  const u = coordShare(h)
  const per = work / h / (1 - u)
  for (let s = 1; s <= h; s++) {
    log.push({ k: "call", a: 0, nin: 300, nout: HIRE_OUT })
    log.push({ k: "spawn", from: 0, to: s })
  }
  for (let s = 1; s <= h; s++) {
    log.push({ k: "call", a: s, nin: ROLE_IN, nout: 0 })
    for (let r = 0; r < ROUNDS; r++) {
      log.push({ k: "call", a: s, nin: ROUND_IN, nout: per / ROUNDS })
      log.push({ k: "tool", a: s, s: TOOL_S })
    }
    log.push({ k: "send", from: s, to: 0 })
  }
  log.push({ k: "recv", a: 0 })
  log.push({ k: "call", a: 0, nin: 2000 * h, nout: FINAL_OUT })
  return log
}

function replay(log: Ev[], agents: number) {
  const clock = new Array(agents).fill(0) as number[]
  const crit = new Array(agents).fill(0) as number[]
  const inbox: { t: number; c: number }[] = []
  const segs: Seg[] = []
  let total = 0
  for (const e of log) {
    if (e.k === "call") {
      const t0 = clock[e.a]
      clock[e.a] += e.nin / PREFILL + e.nout / DECODE
      crit[e.a] += e.nout
      total += e.nout
      if (e.nout > 0) segs.push({ a: e.a, t0, t1: clock[e.a], kind: "call" })
    } else if (e.k === "tool") {
      const t0 = clock[e.a]
      clock[e.a] += e.s
      segs.push({ a: e.a, t0, t1: clock[e.a], kind: "tool" })
    } else if (e.k === "spawn") {
      clock[e.to] = clock[e.from]
      crit[e.to] = crit[e.from]
    } else if (e.k === "send") {
      inbox.push({ t: clock[e.from], c: crit[e.from] })
    } else {
      for (const m of inbox) {
        if (m.t > clock[e.a]) {
          clock[e.a] = m.t
          crit[e.a] = m.c
        }
      }
    }
  }
  let w = 0
  for (let a = 1; a < agents; a++) if (clock[a] > clock[w]) w = a
  return { latency: clock[w], critical: crit[w], total, segs, clock }
}

function mins(s: number) {
  const m = s / 60
  return m < 10 ? `${m.toFixed(1)} min` : `${Math.round(m)} min`
}

function k(n: number) {
  return `${(n / 1000).toFixed(n < 100000 ? 1 : 0)}k`
}

const HIRES = [0, 2, 4, 8] as const
const CALL = "oklch(0.62 0.14 250)"
const TOOL = "oklch(0.75 0.12 75)"

export function DerivedLatency() {
  const [h, setH] = useState<number>(8)
  const [work, setWork] = useState<number>(90000)

  const single = replay(buildLog(0, work), 1)
  const org = replay(buildLog(h, work), h + 1)
  // Extended thinking: a single agent that may not submit until it has written
  // as many output tokens as the organisation (the report's S8 baseline).
  const extraWork = Math.max(work, org.total - PLAN_OUT - FINAL_OUT)
  const ext = replay(buildLog(0, extraWork), 1)

  const rows = h + 1
  const span = Math.max(org.latency, single.latency, 1)
  const W = 600
  const rowH = 14
  const H = rows * (rowH + 4) + 18
  const x = (t: number) => (t / span) * (W - 70) + 66

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">Derived latency: replaying an event log</span>
        <span className="font-mono text-[10px] text-muted-foreground">rules and rates from the report · log illustrative</span>
      </div>

      <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">organisation budget</div>
          <div className="flex flex-wrap gap-1.5">
            {HIRES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={h === n}
                onClick={() => setH(n)}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                  h === n ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n === 0 ? "single agent" : `${n} hires`}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            divisible work: {k(work)} output tokens
          </span>
          <Range min={20000} max={240000} step={10000} value={work} onChange={(e) => setWork(Number(e.target.value))} />
        </label>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[26rem]" role="img" aria-label="Per-agent clocks: model calls and tool calls laid out on the derived-latency axis">
          {Array.from({ length: rows }, (_, a) => (
            <text key={a} x={0} y={a * (rowH + 4) + rowH - 3} className="fill-muted-foreground font-mono" fontSize={9}>
              {a === 0 ? "CEO" : `spec ${a}`}
            </text>
          ))}
          {org.segs.map((s, i) => (
            <rect
              key={i}
              x={x(s.t0)}
              y={s.a * (rowH + 4)}
              width={Math.max(0.6, x(s.t1) - x(s.t0))}
              height={rowH}
              fill={s.kind === "call" ? CALL : TOOL}
              opacity={0.85}
            />
          ))}
          <line x1={x(org.latency)} x2={x(org.latency)} y1={0} y2={rows * (rowH + 4)} stroke="currentColor" strokeDasharray="3 3" />
          <text x={Math.min(x(org.latency) + 3, W - 60)} y={H - 4} fontSize={9} className="fill-foreground font-mono">
            latency {mins(org.latency)}
          </text>
        </svg>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          <span style={{ color: CALL }}>■</span> model call (decode at 50 tok/s){"  "}
          <span style={{ color: TOOL }}>■</span> tool time · gaps are waiting, which costs nothing
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4">
        {(
          [
            ["single agent", mins(single.latency), `${k(single.total)} tokens`],
            [h === 0 ? "organisation" : `org, ${h} hires`, mins(org.latency), `${k(org.total)} tokens`],
            ["extended thinking", mins(ext.latency), `${k(ext.total)} tokens, matched`],
            ["on critical path", `${Math.round((100 * org.critical) / Math.max(1, org.total))}%`, `${k(org.critical)} of ${k(org.total)}`],
          ] as const
        ).map(([a, b, c]) => (
          <div key={a} className="bg-background px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{a}</div>
            <div className="font-mono text-base">{b}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{c}</div>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        The organisation spends more tokens than the single agent, because every specialist pays a co-ordination share
        (interpolated from the report&rsquo;s 9% at one specialist to 32% at eight). But only the CEO&rsquo;s planning,
        hires and final write-up, plus one specialist&rsquo;s chain, sit on the critical path. Extended thinking spends the
        same tokens as the organisation in one sequence, so all of them are on its path. These toy numbers are not the
        report&rsquo;s; its measured ratio of extended-thinking to organisation latency is 2.9 to 6.2.
      </figcaption>
    </figure>
  )
}
