"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy, not a model. Four options and two requests, with hand-made
// four-dimensional vectors (axes: money, software, shipping, account). Two
// scorers read them:
//
//  - "position-encoded": the cosine between request and option, plus a bonus
//    that depends only on the slot the option sits in. It stands in for any
//    readout that sees the options as one ordered text (a letter readout, or a
//    pointer over a causal prompt). The slot bonuses are invented, chosen to be
//    the size of the order effects the Jeva paper's Table 2 measures for
//    other models; they are not anyone's weights.
//
//  - "set-encoded": Jeva's equations from arXiv 2610.18773, section 3, with
//    one block, one head, identity projections and no feed-forward branch
//    (the setting of the paper's Proposition 1). Each option vector is fixed
//    on its own; the request state reads all of them through a softmax-weighted
//    sum (eq. 3-4), scores are dot products with each option (s_i = z^T u_i),
//    a softmax at tau_dec gives the choice, and a separate sigmoid over the
//    top score gives coverage (eq. 6). Temperatures are the repo's defaults
//    (tau_set 0.15, tau_dec 0.10, tau_cov 0.10, alpha/tau 0.6); b_cov = 0.55 is
//    ours. Nothing in it reads a slot index, so a shuffle cannot move it.

const KEYS = ["Billing", "Technical support", "Delivery", "Account security"] as const
type Key = (typeof KEYS)[number]

function norm(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0))
  return v.map((x) => x / n)
}
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

const OPT: Record<Key, number[]> = {
  Billing: norm([1, 0.05, 0.1, 0.45]),
  "Technical support": norm([0.05, 1, 0, 0.3]),
  Delivery: norm([0.1, 0, 1, 0.05]),
  "Account security": norm([0.5, 0.15, 0, 1]),
}

const STATES = [
  { id: "charged", text: "I was charged twice for one order.", z: [1.15, 0.1, 0.15, 1.0] },
  { id: "store", text: "What time does the Pune store open?", z: [0.12, 0.1, 0.18, 0.08] },
] as const

const SLOT_BONUS = [1.0, 0.3, 0, 0.5]
const TAU_SET = 0.15
const ALPHA = TAU_SET * 0.6
const TAU_DEC = 0.1
const TAU_COV = 0.1
const B_COV = 0.55

function softmax(x: number[]): number[] {
  const m = Math.max(...x)
  const e = x.map((v) => mexp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function positionScorer(z: readonly number[], order: Key[]): number[] {
  const q = norm([...z])
  return softmax(order.map((k, slot) => dot(q, OPT[k]) / 0.1 + SLOT_BONUS[slot]))
}

function setScorer(z0: readonly number[], order: Key[]) {
  const U = order.map((k) => OPT[k])
  const q = norm([...z0])
  const a = softmax(U.map((u) => dot(q, u) / TAU_SET))
  const msg = z0.map((_, d) => U.reduce((s, u, i) => s + a[i] * u[d], 0))
  const z1 = z0.map((x, d) => x + ALPHA * msg[d])
  const s = U.map((u) => dot(z1, u))
  const cond = softmax(s.map((v) => v / TAU_DEC))
  const rho = 1 / (1 + mexp(-(Math.max(...s) - B_COV) / TAU_COV))
  return { cond, rho, joint: cond.map((p) => p * rho), pNull: 1 - rho }
}

function permutations(a: Key[]): Key[][] {
  if (a.length < 2) return [a]
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]))
}
const ALL = permutations([...KEYS])

const argmax = (p: number[]) => p.indexOf(Math.max(...p))

function tally(z: readonly number[]) {
  const pos: Record<string, number> = {}
  const set: Record<string, number> = {}
  for (const o of ALL) {
    const w = o[argmax(positionScorer(z, o))]
    pos[w] = (pos[w] ?? 0) + 1
    const r = setScorer(z, o)
    const best = argmax(r.joint)
    const ws = r.pNull >= r.joint[best] ? "none of these" : o[best]
    set[ws] = (set[ws] ?? 0) + 1
  }
  return { pos, set }
}

function Row({ label, p, win, tone }: { label: string; p: number; win: boolean; tone: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-2">
      <span className={cn("truncate font-mono text-[10px]", win ? "font-semibold" : "text-muted-foreground")}>
        {label}
      </span>
      <div className="relative h-4 rounded-sm bg-muted">
        <div className={cn("absolute inset-y-0 left-0 rounded-sm", tone)} style={{ width: `${(p * 100).toFixed(2)}%` }} />
        <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[10px] font-semibold">
          {p.toFixed(3)}
        </span>
      </div>
    </div>
  )
}

const fmtTally = (t: Record<string, number>) =>
  Object.entries(t)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}/24`)
    .join(" · ")

export function PermutationTester() {
  const [stateIx, setStateIx] = useState(0)
  const [permIx, setPermIx] = useState(0)
  const state = STATES[stateIx]
  const order = ALL[permIx]

  const pos = positionScorer(state.z, order)
  const set = setScorer(state.z, order)
  const posWin = argmax(pos)
  const setBest = argmax(set.joint)
  const setNull = set.pNull >= set.joint[setBest]
  const t = tally(state.z)

  const btn = "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        permutation tester · a toy with hand-made vectors, not Jeva&apos;s weights
      </div>

      <div className="grid gap-2 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Request">
          {STATES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={i === stateIx}
              onClick={() => setStateIx(i)}
              className={cn(btn, i === stateIx && "bg-foreground text-background hover:bg-foreground")}
            >
              {s.text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => setPermIx((permIx + 7) % ALL.length)}>
            shuffle
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              const rev = [...order].reverse()
              setPermIx(ALL.findIndex((p) => p.every((k, i) => k === rev[i])))
            }}
          >
            reverse
          </button>
          <button type="button" className={btn} onClick={() => setPermIx(0)}>
            reset
          </button>
          <span className="font-mono text-[11px] text-muted-foreground">
            order {permIx + 1} of 24: {order.map((k, i) => `${i + 1}. ${k}`).join("  ")}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-2">
        <div className="min-w-0 rounded-md border p-3">
          <p className="mb-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            position-encoded: options read as one ordered list
          </p>
          <div className="grid gap-1.5">
            {order.map((k, i) => (
              <Row key={k} label={`${i + 1}. ${k}`} p={pos[i]} win={i === posWin} tone="bg-amber-500/70" />
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px]">
            pick: <strong>{order[posWin]}</strong>
          </p>
        </div>
        <div className="min-w-0 rounded-md border p-3">
          <p className="mb-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            set-encoded: each option alone, read as a set
          </p>
          <div className="grid gap-1.5">
            {order.map((k, i) => (
              <Row key={k} label={`${i + 1}. ${k}`} p={set.joint[i]} win={!setNull && i === setBest} tone="bg-sky-500/70" />
            ))}
            <Row label="none of these" p={set.pNull} win={setNull} tone="bg-rose-500/60" />
          </div>
          <p className="mt-2 font-mono text-[11px]">
            pick: <strong>{setNull ? "none of these" : order[setBest]}</strong> · coverage {set.rho.toFixed(3)}
          </p>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        all 24 orders of this request · position-encoded: {fmtTally(t.pos)} · set-encoded: {fmtTally(t.set)}
      </figcaption>
    </figure>
  )
}
