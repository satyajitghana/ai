"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

import {
  BASELINES,
  CANDIDATES,
  LOBEHUB,
  N_TASKS,
} from "@/components/articles/lobe-rsi-harness/data"

// Every pass rate on FrontierHarness is k out of 30. This widget draws each one
// with its 95% Wilson interval and, against whichever row you pick, asks the
// only question a ranking needs answered: is the gap bigger than chance?
// Two baselines ran on identical tasks, so they get an exact paired McNemar
// test from the per-task results. Anything involving LobeHub or a third-party
// candidate has no public per-task data, so it gets Fisher's exact test on the
// 2x2 counts. The slider shows what best-of-N selection does to an average
// harness, using each task's pass share across the twelve published baselines.
// Only + - * / and sqrt are used, so server and client render the same digits.

const ACCENT = "oklch(0.66 0.17 50)" // LobeHub orange
const REF = "oklch(0.58 0.15 255)" // the row being compared against
const SIG = "oklch(0.60 0.19 25)" // distinguishable at p < 0.05
const DIM = "oklch(0.60 0.02 260)"

const Z = 1.959963984540054

function wilson(k: number, n: number): [number, number] {
  const p = k / n
  const d = 1 + (Z * Z) / n
  const c = (p + (Z * Z) / (2 * n)) / d
  const h = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / d
  return [c - h, c + h]
}

function choose(n: number, r: number): number {
  if (r < 0 || r > n) return 0
  const m = Math.min(r, n - r)
  let v = 1
  for (let i = 1; i <= m; i++) v = (v * (n - m + i)) / i
  return v
}

// Two-sided Fisher exact test for a1/n vs a2/n.
function fisher(a1: number, a2: number, n: number): number {
  const K = a1 + a2
  const total = choose(2 * n, K)
  const prob = (x: number) => (choose(n, x) * choose(n, K - x)) / total
  const pObs = prob(a1)
  let p = 0
  for (let x = Math.max(0, K - n); x <= Math.min(K, n); x++) {
    const q = prob(x)
    if (q <= pObs * (1 + 1e-9)) p += q
  }
  return Math.min(1, p)
}

// Exact McNemar: two-sided binomial test on the discordant tasks.
function mcnemar(a: string, b: string): { p: number; aOnly: number; bOnly: number } {
  let aOnly = 0
  let bOnly = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "1" && b[i] === "0") aOnly++
    if (a[i] === "0" && b[i] === "1") bOnly++
  }
  const m = aOnly + bOnly
  if (m === 0) return { p: 1, aOnly, bOnly }
  const lo = Math.min(aOnly, bOnly)
  let tail = 0
  for (let i = 0; i <= lo; i++) tail += choose(m, i)
  let pow = 1
  for (let i = 0; i < m; i++) pow *= 2
  return { p: Math.min(1, (2 * tail) / pow), aOnly, bOnly }
}

// Expected passes for a harness that picks the best of N attempts per task,
// using each task's share of baseline passes as its per-attempt probability.
function bestOfN(n: number): number {
  let total = 0
  for (let t = 0; t < N_TASKS; t++) {
    let passed = 0
    for (const b of BASELINES) if (b.tasks[t] === "1") passed++
    const fail = 1 - passed / BASELINES.length
    let miss = 1
    for (let i = 0; i < n; i++) miss *= fail
    total += 1 - miss
  }
  return total
}

type Row = {
  id: string
  label: string
  k: number
  note: string
  tasks?: string
  kind: "baseline" | "lobehub" | "candidate"
}

const X0 = 0.25
const X1 = 1.0
const W = 640
const LEFT = 128
const RIGHT = 120
const ROW_H = 22

const fmtP = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(3))

export function PassRateIntervals() {
  const [ref, setRef] = useState("lobehub")
  const [showCand, setShowCand] = useState(true)
  const [n, setN] = useState(1)

  const rows: Row[] = useMemo(() => {
    const base: Row[] = BASELINES.map((b) => ({
      id: b.id,
      label: b.label,
      k: b.k,
      note: "published, 1 try",
      tasks: b.tasks,
      kind: "baseline",
    }))
    const lobe: Row = {
      id: LOBEHUB.id,
      label: LOBEHUB.label,
      k: LOBEHUB.k,
      note: LOBEHUB.source,
      kind: "lobehub",
    }
    const cand: Row[] = showCand
      ? CANDIDATES.map((c) => ({
          id: c.id,
          label: c.label,
          k: c.k,
          note: c.source,
          kind: "candidate",
        }))
      : []
    return [...cand, lobe, ...base].sort((a, b) => b.k - a.k)
  }, [showCand])

  const refRow = rows.find((r) => r.id === ref) ?? rows.find((r) => r.id === "lobehub")!

  const tests = rows.map((r) => {
    if (r.id === refRow.id) return { p: 1, paired: false, self: true, detail: "" }
    if (r.tasks && refRow.tasks) {
      const m = mcnemar(refRow.tasks, r.tasks)
      return {
        p: m.p,
        paired: true,
        self: false,
        detail: `${m.aOnly} vs ${m.bOnly} tasks`,
      }
    }
    return { p: fisher(refRow.k, r.k, N_TASKS), paired: false, self: false, detail: "" }
  })

  const nSig = tests.filter((t) => !t.self && t.p < 0.05).length
  const expected = bestOfN(n)

  const plotW = W - LEFT - RIGHT
  const xOf = (v: number) => LEFT + ((v - X0) / (X1 - X0)) * plotW
  const H = rows.length * ROW_H + 44
  const ticks = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">
          Thirty tasks, seventeen pass rates, 95% intervals
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          click a row to compare against it
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCand}
            onChange={(e) => {
              setShowCand(e.target.checked)
              if (!e.target.checked && CANDIDATES.some((c) => c.id === ref)) setRef("lobehub")
            }}
          />
          <span>show third-party candidates (open PRs)</span>
        </label>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label="Forest plot of FrontierHarness pass rates with 95 percent Wilson intervals"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={xOf(t)}
                x2={xOf(t)}
                y1={8}
                y2={H - 28}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              <text
                x={xOf(t)}
                y={H - 12}
                fontSize={10}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.6}
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}

          {/* best-of-N marker for an average baseline */}
          <line
            x1={xOf(expected / N_TASKS)}
            x2={xOf(expected / N_TASKS)}
            y1={4}
            y2={H - 28}
            stroke={ACCENT}
            strokeDasharray="4 3"
            strokeOpacity={0.8}
          />

          {rows.map((r, i) => {
            const y = 18 + i * ROW_H
            const [lo, hi] = wilson(r.k, N_TASKS)
            const t = tests[i]
            const isRef = r.id === refRow.id
            const color = isRef
              ? REF
              : t.p < 0.05
                ? SIG
                : r.kind === "lobehub"
                  ? ACCENT
                  : DIM
            return (
              <g
                key={r.id}
                onClick={() => setRef(r.id)}
                style={{ cursor: "pointer" }}
                opacity={isRef || t.p < 0.05 || r.kind !== "candidate" ? 1 : 0.85}
              >
                <rect x={0} y={y - ROW_H / 2} width={W} height={ROW_H} fill="transparent" />
                {isRef && (
                  <rect
                    x={xOf(lo)}
                    y={8}
                    width={xOf(hi) - xOf(lo)}
                    height={H - 36}
                    fill={REF}
                    opacity={0.08}
                  />
                )}
                <text
                  x={LEFT - 8}
                  y={y + 4}
                  fontSize={11}
                  textAnchor="end"
                  fill="currentColor"
                  fontWeight={isRef || r.kind === "lobehub" ? 700 : 400}
                >
                  {r.label}
                </text>
                <line x1={xOf(lo)} x2={xOf(hi)} y1={y} y2={y} stroke={color} strokeWidth={2} />
                <line x1={xOf(lo)} x2={xOf(lo)} y1={y - 4} y2={y + 4} stroke={color} strokeWidth={1.5} />
                <line x1={xOf(hi)} x2={xOf(hi)} y1={y - 4} y2={y + 4} stroke={color} strokeWidth={1.5} />
                {r.kind === "baseline" ? (
                  <circle cx={xOf(r.k / N_TASKS)} cy={y} r={4} fill={color} />
                ) : (
                  <rect
                    x={xOf(r.k / N_TASKS) - 4}
                    y={y - 4}
                    width={8}
                    height={8}
                    fill={color}
                    transform={`rotate(45 ${xOf(r.k / N_TASKS)} ${y})`}
                  />
                )}
                <text x={W - RIGHT + 8} y={y + 4} fontSize={10} fill="currentColor" opacity={0.8}>
                  {r.k}/30
                  {isRef ? "  ref" : `  p ${fmtP(t.p)}${t.paired ? "ᵖ" : ""}`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-dashed p-3 text-sm">
          <div className="font-mono text-xs text-muted-foreground">
            against {refRow.label} ({refRow.k}/30)
          </div>
          <div className="mt-1">
            <span style={{ color: nSig ? SIG : undefined }} className="font-semibold">
              {nSig}
            </span>{" "}
            of {rows.length - 1} other rows differ at p &lt; 0.05.
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            ᵖ paired exact McNemar on the shared per-task results; otherwise Fisher&apos;s
            exact test on the counts, because no per-task data is public for that row.
          </div>
        </div>
        <div className="rounded-md border border-dashed p-3 text-sm">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>best of N tries, average baseline</span>
            <span>N = {n}</span>
          </div>
          <Range
            min={1}
            max={5}
            step={1}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            accent={ACCENT}
            className="mt-2 w-full"
            aria-label="Number of attempts per task kept as best of N"
          />
          <div className="mt-1">
            expected{" "}
            <span className="font-semibold" style={{ color: ACCENT }}>
              {expected.toFixed(1)}/30
            </span>{" "}
            ({((expected / N_TASKS) * 100).toFixed(1)}%), the dashed line.
          </div>
        </div>
      </div>
    </div>
  )
}
