"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Which key/value rows a diffusion LLM recomputes at each denoising step, and
// how stale everything else is, under three refresh policies.
//
// A toy, scaled down so it fits on a phone: 8 prompt positions, 24 generated
// positions, a decode window of 4 (the code's is one 16-token block), 4 masked
// look-ahead positions (the code's is 48), and a tracking budget you pick (the
// paper's Table 3 uses 64 tokens). The decode schedule is fixed and shared by
// all three policies, so the only thing that changes between them is which
// cache rows get recomputed. The "attention score" used to rank decoded tokens
// is a made-up salience plus a recency bonus, standing in for the real thing:
// the pre-softmax logits from the masked queries, averaged over heads and
// summed over layers (generate.py sorts by `attn_scores`; the Triton kernel
// `_flash_masked_attention_fwd` writes them into `S`).
//
// Deterministic arithmetic only (+ - * /), so server and client render the
// same SVG.

const P = 8
const G = 24
const N = P + G
const WIN = 4
const LOOK = 4
const BLOCK = 8
const COMMITS = [1, 2, 2, 1, 3, 2, 1, 2, 3, 2, 1, 2, 2]

// Fixed toy numbers from a small LCG, so nothing depends on Math.random.
function lcg(seed: number, n: number): number[] {
  const out: number[] = []
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    out.push(s / 2147483648)
  }
  return out
}

const CONF = lcg(7, N) // decode order inside the window
const PROMPT_SAL = [0.9, 0.2, 0.35, 0.85, 0.25, 0.6, 0.15, 0.45]
const GEN_SAL = lcg(11, G).map((v) => 0.1 + 0.55 * v)
const SAL = [...PROMPT_SAL, ...GEN_SAL]

type Policy = "none" | "block" | "flash"

type Cell = {
  state: "prompt" | "masked" | "decoded"
  committed: boolean
  fresh: boolean
  age: number
  maskRow: boolean // a committed token whose cached row was computed while it was still [MASK]
  role: "" | "window" | "look" | "new" | "tracked" | "all" | "block"
}

type Sim = { rows: Cell[][]; freshCounts: number[] }

// The decode schedule: which positions get committed at each step. The window
// is the first WIN undecoded positions of the current block, so the schedule is
// block-aligned (semi-autoregressive), which is what every policy below can
// run; commit counts cycle through COMMITS until everything is decoded.
function schedule(): { windowStart: number[]; commitAt: number[] } {
  const commitAt = new Array<number>(N).fill(-1)
  const windowStart: number[] = []
  const decoded = new Array<boolean>(N).fill(false)
  for (let i = 0; i < P; i++) decoded[i] = true
  for (let t = 0; t < 64; t++) {
    let first = P
    while (first < N && decoded[first]) first++
    if (first >= N) break
    const blockEnd = P + (Math.floor((first - P) / BLOCK) + 1) * BLOCK
    const win: number[] = []
    for (let i = first; i < blockEnd && win.length < WIN; i++) if (!decoded[i]) win.push(i)
    windowStart.push(first)
    const ranked = [...win].sort((a, b) => CONF[b] - CONF[a])
    for (const i of ranked.slice(0, COMMITS[t % COMMITS.length])) {
      decoded[i] = true
      commitAt[i] = t
    }
  }
  return { windowStart, commitAt }
}

const SCHED = schedule()
const STEPS = SCHED.windowStart.length

function simulate(policy: Policy, budget: number): Sim {
  const { commitAt } = SCHED
  const lastRefresh = new Array<number>(N).fill(-1)
  const refreshedAsMask = new Array<boolean>(N).fill(false)
  const rows: Cell[][] = []
  const freshCounts: number[] = []
  let prevBlock = -1

  for (let t = 0; t < STEPS; t++) {
    const isDecoded = (i: number) => i < P || (commitAt[i] >= 0 && commitAt[i] < t)
    const undecoded: number[] = []
    for (let i = P; i < N; i++) if (!isDecoded(i)) undecoded.push(i)
    const first = undecoded[0] ?? N
    const blockEnd = P + (Math.floor((first - P) / BLOCK) + 1) * BLOCK
    const win = undecoded.filter((i) => i < blockEnd).slice(0, WIN)
    const look = undecoded.filter((i) => !win.includes(i)).slice(0, LOOK)
    const newly: number[] = []
    for (let i = P; i < N; i++) if (commitAt[i] === t - 1) newly.push(i)

    const role = new Array<Cell["role"]>(N).fill("")
    if (policy === "none" || t === 0) {
      for (let i = 0; i < N; i++) role[i] = "all"
    } else if (policy === "block") {
      const b = Math.floor((win[0] - P) / BLOCK)
      if (b !== prevBlock) {
        for (let i = 0; i < N; i++) role[i] = "all"
      } else {
        const lo = P + b * BLOCK
        for (let i = lo; i < lo + BLOCK && i < N; i++) role[i] = "block"
        for (const i of win) role[i] = "block"
      }
    } else {
      for (const i of win) role[i] = "window"
      for (const i of look) role[i] = "look"
      // Newly committed tokens take the first tracking slots, as in generate.py,
      // where they sit at the end of `full_pos[:num_decoded]` and so inside the
      // tracked slice.
      const newTaken = newly.slice(0, budget)
      for (const i of newTaken) role[i] = "new"
      const left = budget - newTaken.length
      if (left > 0) {
        const start = win[0] ?? N
        const candidates: { i: number; s: number }[] = []
        for (let i = 0; i < N; i++) {
          if (!isDecoded(i) || role[i] !== "") continue
          const dist = start - i
          const recency = i >= P && dist < 8 ? 0.5 * (1 - dist / 8) : 0
          candidates.push({ i, s: SAL[i] + recency })
        }
        candidates.sort((a, b) => b.s - a.s || a.i - b.i)
        for (const c of candidates.slice(0, left)) role[c.i] = "tracked"
      }
    }
    if (policy === "block" && win.length) prevBlock = Math.floor((win[0] - P) / BLOCK)

    const row: Cell[] = []
    let fresh = 0
    for (let i = 0; i < N; i++) {
      const isFresh = role[i] !== ""
      if (isFresh) {
        fresh++
        lastRefresh[i] = t
        refreshedAsMask[i] = i >= P && !isDecoded(i)
      }
      const state: Cell["state"] = i < P ? "prompt" : isDecoded(i) ? "decoded" : "masked"
      row.push({
        state,
        committed: commitAt[i] === t,
        fresh: isFresh,
        age: isFresh ? 0 : t - lastRefresh[i],
        maskRow: state === "decoded" && !isFresh && refreshedAsMask[i],
        role: role[i],
      })
    }
    freshCounts.push(fresh)
    rows.push(row)
  }
  return { rows, freshCounts }
}

const FRESH = "oklch(0.68 0.16 50)"
const REUSED = "oklch(0.58 0.12 250)"
const MASKROW = "oklch(0.58 0.2 25)"

function reusedOpacity(age: number) {
  if (age <= 2) return 0.55
  if (age <= 6) return 0.28
  return 0.1
}

const POLICIES: { k: Policy; label: string }[] = [
  { k: "none", label: "no cache" },
  { k: "block", label: "block refresh (Fast-dLLM-style)" },
  { k: "flash", label: "window + tracked (Flash-Cache)" },
]

export function RefreshGrid() {
  const [policy, setPolicy] = useState<Policy>("flash")
  const [budget, setBudget] = useState(4)
  const [step, setStep] = useState(6)

  const sim = useMemo(() => simulate(policy, budget), [policy, budget])

  const after0 = sim.freshCounts.slice(1)
  const avg = after0.reduce((a, b) => a + b, 0) / after0.length
  const total = sim.freshCounts.reduce((a, b) => a + b, 0)
  const workPct = (total / (N * STEPS)) * 100

  const cur = sim.rows[step]
  const count = (r: Cell["role"]) => cur.filter((c) => c.role === r).length
  const oldest = cur.reduce((m, c) => (c.fresh ? m : Math.max(m, c.age)), 0)
  const maskRows = cur.filter((c) => c.maskRow).length

  const LX = 40
  const CW = 13
  const RH = 13
  const TOP = 26
  const W = LX + N * CW + 6
  const H = TOP + STEPS * RH + 6

  let breakdown: string
  if (cur.every((c) => c.role === "all")) {
    breakdown = `full pass: all ${N} rows recomputed`
  } else if (policy === "block") {
    breakdown = `${count("block")} rows recomputed: the current block; the rest is served from the last full refresh`
  } else {
    breakdown = `${count("window") + count("look") + count("new") + count("tracked")} rows recomputed: window ${count("window")}, look-ahead ${count("look")}, just committed ${count("new")}, tracked by score ${count("tracked")}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          which K/V rows are recomputed, step by step
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          toy: {P} prompt + {G} generated positions · not measured
        </span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {POLICIES.map(({ k, label }) => (
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
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            {`A grid of ${STEPS} denoising steps by ${N} positions under the ${
              POLICIES.find((p) => p.k === policy)?.label
            } policy. On average ${avg.toFixed(1)} of ${N} key/value rows are recomputed per step after the first, ${workPct.toFixed(0)} percent of the no-cache work.`}
          </title>
          <text x={LX + (P * CW) / 2} y={14} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
            prompt
          </text>
          <text x={LX + P * CW + (G * CW) / 2} y={14} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
            generated (starts as [MASK])
          </text>
          <line x1={LX + P * CW - 0.5} y1={TOP - 4} x2={LX + P * CW - 0.5} y2={H - 4} stroke="currentColor" strokeOpacity={0.35} />
          {policy === "block"
            ? [1, 2].map((b) => (
                <line
                  key={b}
                  x1={LX + (P + b * BLOCK) * CW - 0.5}
                  y1={TOP - 4}
                  x2={LX + (P + b * BLOCK) * CW - 0.5}
                  y2={H - 4}
                  stroke="currentColor"
                  strokeOpacity={0.25}
                  strokeDasharray="2 2"
                />
              ))
            : null}

          {sim.rows.map((row, t) => (
            <g key={t}>
              {t === step ? (
                <rect x={1} y={TOP + t * RH - 1} width={W - 2} height={RH} rx={2} fill="currentColor" fillOpacity={0.07} />
              ) : null}
              {t % 2 === 0 || t === step ? (
                <text x={LX - 5} y={TOP + t * RH + 8} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={t === step ? 0.9 : 0.5} fontFamily="ui-monospace, monospace">
                  {`t=${t}`}
                </text>
              ) : null}
              {row.map((c, i) => {
                const x = LX + i * CW + 1
                const y = TOP + t * RH
                const fill = c.fresh ? FRESH : REUSED
                const op = c.fresh ? 0.9 : reusedOpacity(c.age)
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={CW - 2} height={RH - 2} rx={1.5} fill={fill} fillOpacity={op} />
                    {c.maskRow ? (
                      <rect x={x + 0.75} y={y + 0.75} width={CW - 3.5} height={RH - 3.5} rx={1.2} fill="none" stroke={MASKROW} strokeWidth={1.3} />
                    ) : null}
                    {c.state === "masked" ? (
                      <circle cx={x + (CW - 2) / 2} cy={y + (RH - 2) / 2} r={1.4} fill="currentColor" fillOpacity={0.55} />
                    ) : null}
                    {c.committed ? (
                      <path d={`M ${x + 2.5} ${y + 5.5} l 2.5 2.5 l 4 -5`} fill="none" stroke="currentColor" strokeOpacity={0.85} strokeWidth={1.3} />
                    ) : null}
                  </g>
                )
              })}
            </g>
          ))}
        </svg>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FRESH }} /> recomputed this step
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REUSED, opacity: 0.55 }} /> reused, 1–2 steps old
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REUSED, opacity: 0.2 }} /> reused, older
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border-[1.5px]" style={{ borderColor: MASKROW }} /> committed, but its row was cached as [MASK]
          </span>
          <span>· = still masked · ✓ = committed this step</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>step shown</span>
              <span className="text-foreground">t = {step}</span>
            </span>
            <Range min={0} max={STEPS - 1} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Denoising step" className="mt-1.5 w-full" />
          </label>
          <label className={cn("block", policy !== "flash" && "opacity-40")}>
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>tracking budget (Flash-Cache)</span>
              <span className="text-foreground">{budget} rows</span>
            </span>
            <Range
              min={0}
              max={12}
              step={1}
              value={budget}
              disabled={policy !== "flash"}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="Tracking budget"
              className="mt-1.5 w-full"
            />
          </label>
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">rows recomputed / step</div>
            <div className="text-base text-foreground">
              {avg.toFixed(1)} <span className="text-[10px] text-muted-foreground">of {N}, after t=0</span>
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">work vs no cache</div>
            <div className="text-base text-foreground">{workPct.toFixed(0)}%</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">at t = {step}</div>
            <div className="text-foreground">
              oldest row {oldest} {oldest === 1 ? "step" : "steps"} · {maskRows} [MASK]-stale
            </div>
          </div>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          t = {step}: {breakdown}.
        </p>
      </div>
    </figure>
  )
}
