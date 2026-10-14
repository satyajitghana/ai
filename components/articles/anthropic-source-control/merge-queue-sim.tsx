"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mpow } from "@/lib/dmath"

// A merge-queue model, not Anthropic's data.
//
// Four ways to land changes on one trunk, each reduced to a textbook formula:
//
// 1. Serialized queue: one global lock. Each change is rebased onto main and
//    tested there for `s` seconds before the next may start. Capacity is
//    86,400 / s changes a day. Waiting time is M/D/1: Wq = rho * s / (2(1 - rho)).
// 2. Batched with bisection (bors-style): test B changes together. If the batch
//    fails (probability 1 - (1-p)^B) bisect to the one culprit, costing
//    log2(B) extra runs. Effective time per change is T/B.
// 3. Speculative lanes (SubmitQueue-style): k builds run at once, each assuming
//    the ones ahead pass. The first failure invalidates everything behind it, so
//    a round of `s` seconds lands (1 - (1-p)^k) / p changes on average.
// 4. Land first, test after: no lock. The ref moves in about the time of one
//    compare-and-swap. What you pay instead is concurrency: lambda * s / 86,400
//    changes land while any one change's tests run, and lambda * p broken
//    changes reach main a day.
//
// Assumptions: Poisson arrivals spread evenly over 24 hours (real traffic has
// peaks, which only makes things worse), one culprit per failed batch, failed
// changes leave the queue. Only + - * / and dmath wrappers reach the DOM.

const ACCENT = "oklch(0.55 0.16 255)" // ballpoint blue, matches the film
const HOT = "oklch(0.6 0.19 28)"
const DAY = 86400

const TEST_STEPS = [10, 30, 60, 120, 300, 600, 900, 1800, 3600] // seconds
const BATCH_EXP = [0, 1, 2, 3, 4, 5, 6] // B = 2^e

function fmtInt(n: number): string {
  const r = Math.round(n)
  return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function fmtDur(sec: number): string {
  if (!Number.isFinite(sec)) return "∞"
  if (sec < 1) return `${Math.round(sec * 1000)} ms`
  if (sec < 90) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)} s`
  if (sec < 5400) return `${Math.round(sec / 60)} min`
  if (sec < 2 * DAY) return `${(sec / 3600).toFixed(1)} h`
  return `${(sec / DAY).toFixed(1)} days`
}

type Row = {
  key: string
  name: string
  how: string
  cap: number // changes per day it can process; Infinity = not the bottleneck
  rho: number
  latency: number // seconds from "ready" to "on main", mean
}

function mdOne(rho: number, service: number): number {
  // M/D/1 mean wait in queue
  return (rho * service) / (2 * (1 - rho))
}

export function MergeQueueSim() {
  const [rate, setRate] = useState(30000)
  const [testIdx, setTestIdx] = useState(4) // 300 s
  const [pTenths, setPTenths] = useState(50) // 5.0%
  const [bIdx, setBIdx] = useState(4) // 16
  const [lanes, setLanes] = useState(16)

  const s = TEST_STEPS[testIdx]
  const p = pTenths / 1000
  const bExp = BATCH_EXP[bIdx]
  const B = 2 ** bExp
  const lambda = rate / DAY // per second
  const gap = DAY / rate

  // 1. serialized
  const cap1 = DAY / s
  const rho1 = lambda * s
  const lat1 = rho1 < 1 ? s + mdOne(rho1, s) : Infinity

  // 2. batched with bisection
  const failB = 1 - mpow(1 - p, B)
  const tBatch = s * (1 + failB * bExp)
  const svc2 = tBatch / B
  const cap2 = DAY / svc2
  const rho2 = lambda * svc2
  const lat2 = rho2 < 1 ? tBatch + mdOne(rho2, svc2) : Infinity

  // 3. speculative lanes
  const landedPerRound = p > 0 ? (1 - mpow(1 - p, lanes)) / p : lanes
  const svc3 = s / landedPerRound
  const cap3 = DAY / svc3
  const rho3 = lambda * svc3
  const lat3 = rho3 < 1 ? s + mdOne(rho3, svc3) : Infinity

  // 4. land first, test after
  const concurrent = lambda * s
  const brokenPerDay = rate * p

  // git: fetch, rebase, push to one ref. A push is refused if anyone else landed
  // inside the window, here taken as the test time. Poisson: 1 - e^(-lambda * w).
  const gitWindow = Math.min(s, 30)
  const raceGit = 1 - mexp(-lambda * gitWindow)

  const rows: Row[] = [
    {
      key: "serial",
      name: "Serialized queue",
      how: "one lock; test each change on top of main",
      cap: cap1,
      rho: rho1,
      latency: lat1,
    },
    {
      key: "batch",
      name: `Batches of ${B}`,
      how: `test ${B} at once; bisect a red batch`,
      cap: cap2,
      rho: rho2,
      latency: lat2,
    },
    {
      key: "spec",
      name: `${lanes} speculative lanes`,
      how: "build ahead assuming the ones in front pass",
      cap: cap3,
      rho: rho3,
      latency: lat3,
    },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one trunk · {fmtInt(rate)} changes a day · a queueing model</span>
        <span className="shrink-0 text-muted-foreground/50">model, not Anthropic data</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4">
        <div className="grid gap-3 rounded-lg border bg-background/40 p-3 sm:grid-cols-2">
          <Slider
            label="changes merged per day"
            value={fmtInt(rate)}
            min={2500}
            max={60000}
            step={500}
            raw={rate}
            onChange={setRate}
          />
          <Slider
            label="test time per landing"
            value={fmtDur(s)}
            min={0}
            max={TEST_STEPS.length - 1}
            step={1}
            raw={testIdx}
            onChange={setTestIdx}
          />
          <Slider
            label="chance a change fails on top of main"
            value={`${(pTenths / 10).toFixed(1)}%`}
            min={0}
            max={200}
            step={5}
            raw={pTenths}
            onChange={setPTenths}
          />
          <div className="grid grid-cols-2 gap-3">
            <Slider
              label="batch size"
              value={String(B)}
              min={0}
              max={BATCH_EXP.length - 1}
              step={1}
              raw={bIdx}
              onChange={setBIdx}
            />
            <Slider
              label="lanes"
              value={String(lanes)}
              min={1}
              max={64}
              step={1}
              raw={lanes}
              onChange={setLanes}
            />
          </div>
        </div>

        <p className="font-mono text-[11px] leading-5 text-muted-foreground">
          one change every <span className="text-foreground">{fmtDur(gap)}</span> on average, so a
          single global lock has to be released that often just to keep up
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-2 font-normal">strategy</th>
                <th className="py-1.5 pr-2 text-right font-normal">capacity / day</th>
                <th className="w-[30%] py-1.5 pr-2 font-normal">load</th>
                <th className="py-1.5 text-right font-normal">ready → main</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const over = r.rho >= 1
                const w = Math.min(100, r.rho * 100)
                return (
                  <tr key={r.key} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-2">
                      <div className="text-foreground">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.how}</div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtInt(r.cap)}</td>
                    <td className="py-2 pr-2">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{ width: `${w.toFixed(1)}%`, background: over ? HOT : ACCENT }}
                        />
                      </div>
                      <div
                        className="mt-0.5 text-[10px] tabular-nums"
                        style={over ? { color: HOT } : undefined}
                      >
                        {over ? `over by ${(r.rho * 100 - 100).toFixed(0)}%` : `${(r.rho * 100).toFixed(0)}% busy`}
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums" style={over ? { color: HOT } : undefined}>
                      {over ? `+${fmtInt(rate - r.cap)} backlog/day` : fmtDur(r.latency)}
                    </td>
                  </tr>
                )
              })}
              <tr className="align-top">
                <td className="py-2 pr-2">
                  <div className="text-foreground">Land first, test after</div>
                  <div className="text-[10px] text-muted-foreground">no lock; tests run on main</div>
                </td>
                <td className="py-2 pr-2 text-right text-muted-foreground">lock-free</td>
                <td className="py-2 pr-2 text-[10px] leading-4 text-muted-foreground">
                  <span className="text-foreground tabular-nums">{fmtInt(concurrent)}</span> changes
                  land during one test run;{" "}
                  <span className="tabular-nums" style={{ color: HOT }}>
                    {fmtInt(brokenPerDay)}
                  </span>{" "}
                  red changes reach main a day
                </td>
                <td className="py-2 text-right tabular-nums">a ref CAS</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Plain git, no queue: an agent fetches main, rebases, and pushes. If anyone else lands in a{" "}
          <span className="text-foreground">{fmtDur(gitWindow)}</span> window the push is refused as
          a non-fast-forward. At this rate that happens to{" "}
          <span className="text-foreground tabular-nums">{(raceGit * 100).toFixed(1)}%</span> of
          pushes, and every refusal is another fetch.
        </p>
      </div>

      <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        A queueing model with textbook formulas (M/D/1 waiting, one culprit per red batch, a failed
        speculative build invalidating everything behind it), arrivals spread evenly over 24 hours.
        It shows the shape of the problem, not Anthropic&apos;s system: the post does not publish its
        test times, failure rates or how its landing service orders changes.
      </p>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  raw,
  onChange,
}: {
  label: string
  value: string
  min: number
  max: number
  step: number
  raw: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{value}</span>
      </div>
      <Range
        min={min}
        max={max}
        step={step}
        value={raw}
        accent={ACCENT}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </label>
  )
}
