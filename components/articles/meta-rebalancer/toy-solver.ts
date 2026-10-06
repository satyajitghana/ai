// A toy re-implementation of Rebalancer's local search, small enough to read in
// one sitting and to run on every click. It is mine, not Meta's code: the shape
// follows CoreLocalSearchSolve.cpp (hot container -> best SINGLE move out of it
// -> apply if strictly better, else skip the container) and MovesEvaluator.cpp
// (objective is a lexicographic tuple), with the fix-it goal for an initially
// broken constraint taken from website/docs/reference/constraint-policy.md
// (100 x violation + 10000 x step(violation)).
//
// Problem: 12 tasks (4 jobs x 3 replicas) on 6 hosts in 3 racks.
//   CapacitySpec   host CPU <= 10                         (initially broken)
//   GroupCountSpec at most 1 task of a job per rack       (initially broken)
//   BalanceSpec    LINEAR: sum_h max(0, u_h - avg) / n    (u = util / capacity)
//
// Integer CPU units everywhere, so every number is exact and SSR-stable.

export const HOSTS = 6
export const CAP = 10
export const RACK_OF = [0, 0, 1, 1, 2, 2] // host -> rack
export const JOBS = ["A", "B", "C", "D"] as const
export const CPU_OF_JOB = [4, 3, 2, 1]

export type Task = { id: string; job: number; cpu: number }
export const TASKS: Task[] = JOBS.flatMap((j, ji) =>
  [0, 1, 2].map((r) => ({ id: `${j}${r}`, job: ji, cpu: CPU_OF_JOB[ji] })),
)

// The starting assignment: someone piled jobs A and B onto rack 0.
// host0: A0 A1 B0 B1 (14 CPU), host1: A2 B2 C0 (9), host2: C1 C2 D0 D1 D2 (7).
export const INITIAL: number[] = TASKS.map((t) => {
  const start: Record<string, number> = {
    A0: 0, A1: 0, B0: 0, B1: 0,
    A2: 1, B2: 1, C0: 1,
    C1: 2, C2: 2, D0: 2, D1: 2, D2: 2,
  }
  return start[t.id]
})

export type Eval = {
  capViol: number // sum over hosts of max(0, util - CAP)
  grpViol: number // sum over (job, rack) of max(0, count - 1)
  fix: number // tuple position 0: fix-it goals for both broken constraints
  balance: number // tuple position 1: LINEAR balance, x 60 so it is an integer
}

export function utils(assign: number[]): number[] {
  const u = new Array(HOSTS).fill(0)
  TASKS.forEach((t, i) => (u[assign[i]] += t.cpu))
  return u
}

export function evaluate(assign: number[]): Eval {
  const u = utils(assign)
  let capViol = 0
  for (const x of u) capViol += Math.max(0, x - CAP)
  const cnt = new Array(JOBS.length * 3).fill(0)
  TASKS.forEach((t, i) => (cnt[t.job * 3 + RACK_OF[assign[i]]] += 1))
  let grpViol = 0
  for (const c of cnt) grpViol += Math.max(0, c - 1)
  const step = (v: number) => (v > 0 ? 1 : 0)
  const fix = 100 * capViol + 10000 * step(capViol) + 100 * grpViol + 10000 * step(grpViol)
  // total CPU is 30 on 6 hosts of capacity 10, so the average relative
  // utilisation is fixed at 0.5. balance = sum max(0, u/10 - 0.5) / 6; times 60
  // that is sum max(0, u - 5), an integer.
  let balance = 0
  for (const x of u) balance += Math.max(0, x - 5)
  return { capViol, grpViol, fix, balance }
}

// Lexicographic compare on (fix, balance), like GlobalObjectiveValue.
export function better(a: Eval, b: Eval): boolean {
  if (a.fix !== b.fix) return a.fix < b.fix
  return a.balance < b.balance
}

// How much the objective would drop if the host were emptied: the quantity
// MovesEvaluator::computeContainerPotentials computes. Hot first.
export function hostOrder(assign: number[], cur: Eval, random: boolean, seed: number): number[] {
  const hosts = [...Array(HOSTS).keys()]
  if (random) {
    // tiny LCG; integer ops only
    let s = seed % 2147483647
    if (s <= 0) s += 2147483646
    const keyed = hosts.map((h) => {
      s = (s * 16807) % 2147483647
      return { h, k: s }
    })
    return keyed.sort((a, b) => a.k - b.k).map((x) => x.h)
  }
  const pot = hosts.map((h) => {
    const emptied = assign.map((b) => (b === h ? -1 : b))
    const e = evalIgnoring(emptied)
    return { h, dFix: cur.fix - e.fix, dBal: cur.balance - e.balance }
  })
  return pot
    .sort((a, b) => b.dFix - a.dFix || b.dBal - a.dBal || a.h - b.h)
    .map((x) => x.h)
}

// evaluate() with some tasks removed from the problem (bin -1).
function evalIgnoring(assign: number[]): Eval {
  const u = new Array(HOSTS).fill(0)
  const cnt = new Array(JOBS.length * 3).fill(0)
  TASKS.forEach((t, i) => {
    if (assign[i] < 0) return
    u[assign[i]] += t.cpu
    cnt[t.job * 3 + RACK_OF[assign[i]]] += 1
  })
  let capViol = 0
  for (const x of u) capViol += Math.max(0, x - CAP)
  let grpViol = 0
  for (const c of cnt) grpViol += Math.max(0, c - 1)
  const step = (v: number) => (v > 0 ? 1 : 0)
  const fix = 100 * capViol + 10000 * step(capViol) + 100 * grpViol + 10000 * step(grpViol)
  let balance = 0
  for (const x of u) balance += Math.max(0, x - 5)
  return { capViol, grpViol, fix, balance }
}

export const INITIAL_EVAL: Eval = evaluate(INITIAL)

export type Step = {
  assign: number[]
  moved?: { kind: "single" | "swap"; task: string; from: number; to: number; other?: string }
  hot: number[] // hosts tried in this step, in order; the last one gave the move
  evals: number // candidate moves evaluated in this step
  deduped: number // candidates skipped because an equivalent task was already tried
  value: Eval
}

type Best = { next: number[]; e: Eval; moved: NonNullable<Step["moved"]> }

// DEFAULT constraint policy: a broken constraint may never get worse than it
// started ("do not make it worse" stays a hard constraint).
const allowed = (e: Eval) =>
  e.capViol <= INITIAL_EVAL.capViol && e.grpViol <= INITIAL_EVAL.grpViol

// One iteration of CoreLocalSearchSolve: walk hosts hot to cold; for each host
// try the move types in order (SINGLE, then SWAP if enabled) and apply the best
// move of the first type that strictly improves the objective. Tasks of the
// same job in the same host are interchangeable, so only one is tried
// (ObjectDeduper in AsyncSingleMovesMoveType.cpp).
export function step(
  assign: number[],
  random: boolean,
  seed: number,
  useSwap: boolean,
): Step | null {
  const cur = evaluate(assign)
  const order = hostOrder(assign, cur, random, seed)
  const tried: number[] = []
  let evals = 0
  let deduped = 0
  const consider = (best: Best | null, next: number[], moved: Best["moved"]): Best | null => {
    const e = evaluate(next)
    evals++
    if (!allowed(e)) return best
    return !best || better(e, best.e) ? { next, e, moved } : best
  }
  for (const h of order) {
    tried.push(h)
    // SINGLE: every (deduped) task in h to every other host
    let best: Best | null = null
    const seen = new Set<number>()
    TASKS.forEach((t, i) => {
      if (assign[i] !== h) return
      if (seen.has(t.job)) {
        deduped += HOSTS - 1
        return
      }
      seen.add(t.job)
      for (let to = 0; to < HOSTS; to++) {
        if (to === h) continue
        const next = assign.slice()
        next[i] = to
        best = consider(best, next, { kind: "single", task: t.id, from: h, to })
      }
    })
    let b = best as Best | null
    if (b && better(b.e, cur)) {
      return { assign: b.next, moved: b.moved, hot: tried, evals, deduped, value: b.e }
    }
    if (!useSwap) continue
    // SWAP: every task in h with every task in another host
    best = null
    TASKS.forEach((t, i) => {
      if (assign[i] !== h) return
      TASKS.forEach((o, j) => {
        if (assign[j] === h || o.cpu === t.cpu) return
        const next = assign.slice()
        next[i] = assign[j]
        next[j] = h
        best = consider(best, next, { kind: "swap", task: t.id, from: h, to: assign[j], other: o.id })
      })
    })
    b = best as Best | null
    if (b && better(b.e, cur)) {
      return { assign: b.next, moved: b.moved, hot: tried, evals, deduped, value: b.e }
    }
  }
  return null
}

export function run(random: boolean, useSwap: boolean, maxSteps = 40): Step[] {
  const out: Step[] = [
    { assign: INITIAL.slice(), hot: [], evals: 0, deduped: 0, value: evaluate(INITIAL) },
  ]
  for (let k = 0; k < maxSteps; k++) {
    const s = step(out[out.length - 1].assign, random, 7 + 13 * k, useSwap)
    if (!s) break
    out.push(s)
  }
  return out
}
