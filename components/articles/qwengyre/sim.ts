// A toy, minute-by-minute simulator of the three GPU placement policies the
// QwenGyre paper compares (arXiv 2609.33848, Sections 2.2 and 4). It is a
// model of the scheduling rules, not of the paper's cluster:
//
// - K cells, each able to serve C concurrent rollout executions, or to train.
// - A training step consumes B rollout groups of N executions; a group is
//   ready only when its slowest execution has finished (group-relative
//   advantages need every reward).
// - Execution durations are lognormal around a median, with a per-group
//   factor (some queries are just harder) and a per-execution factor, and are
//   capped at a timeout, as the paper's harness timeout caps them.
// - Training a step costs W cell-hours and scales linearly with the number of
//   cells training it. Role switches cost one tick (the paper measures 8.52 s
//   rollout-to-training and 3.46 s back, so a minute is generous).
// - Every policy uses boundary dispatch: new groups enter only after a weight
//   publication, with the (phi, mu) pairs the paper uses to hold mean
//   scheduling staleness at 1.5 (its Equation 2): Async (1.5, 1), Colocate
//   (0, 4), QwenGyre (0.5, 3).
//
// Elastic follows Section 4.2: a cell may leave rollout only when the
// remaining rollout capacity still covers every outstanding execution
// (w <= C_R - C_e, Equation 5) and at least rho * B ready groups are waiting
// for the current batch; cells join in order and stay in training for the
// whole burst; the core keeps training across a burst boundary only if
// Equation 6 holds. Training is streamed: a group's share of the step can be
// trained as soon as that group is ready.
//
// All randomness comes from a seeded PRNG, and every transcendental goes
// through lib/dmath, so the server and the browser compute the same numbers.

import { mcos, mexp, mlog } from "@/lib/dmath"

export type Policy = "colocate" | "async" | "elastic"

export type SimParams = {
  sigma: number // spread of log duration
  trainHours: number // hours for one step when all K cells train it
  asyncStreaming: boolean // the paper's A3: Async that trains each group as it lands
  seed: number
}

export const K = 8 // cells
export const C = 8 // concurrent executions per cell in rollout
export const N = 4 // executions per group
export const B = 4 // groups per training step
export const STEPS = 12
export const MEDIAN_H = 1.5
export const TIMEOUT_H = 4.5
export const DT = 1 / 60 // one minute
const RHO = 0.25
const ASYNC_TRAIN_CELLS = 4 // the paper's A0 splits 16 T / 16 R

export const CONFIG: Record<Policy, { phi: number; mu: number }> = {
  async: { phi: 1.5, mu: 1 },
  colocate: { phi: 0, mu: 4 },
  elastic: { phi: 0.5, mu: 3 },
}

// cell state per tick: 0..4 rollout occupancy in quarters, 5 training, 6 training but starved
export const TRAIN = 5
export const STARVED = 6

export type Segment = { cell: number; t0: number; t1: number; code: number }

export type SimResult = {
  policy: Policy
  hours: number
  busyShare: number // share of cell-time doing rollout or training work
  trainShare: number // share of cell-time spent training (busy or starved)
  segments: Segment[]
  stepTimes: number[]
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussians(rand: () => number, n: number) {
  const out: number[] = []
  while (out.length < n) {
    const u = Math.max(rand(), 1e-12)
    const v = rand()
    const r = Math.sqrt(-2 * mlog(u))
    out.push(r * mcos(2 * Math.PI * v))
  }
  return out
}

const MAX_GROUPS = 80

export function drawDurations(sigma: number, seed: number) {
  const rand = mulberry32(seed * 7919 + 17)
  const zg = gaussians(rand, MAX_GROUPS)
  const ze = gaussians(rand, MAX_GROUPS * N)
  const d: number[] = []
  for (let g = 0; g < MAX_GROUPS; g++) {
    for (let i = 0; i < N; i++) {
      const z = 0.6 * zg[g] + 0.8 * ze[g * N + i]
      d.push(Math.min(TIMEOUT_H, MEDIAN_H * mexp(sigma * z)))
    }
  }
  return d
}

type Group = { ends: number[]; left: number; readyAt: number; done: number; consumed: boolean; inBatch: boolean }

export function simulate(policy: Policy, p: SimParams, durations: number[]): SimResult {
  const { phi, mu } = CONFIG[policy]
  const W = p.trainHours * K // cell-hours per step
  const perGroup = W / B

  const groups: Group[] = []
  const queue: number[] = [] // execution ids waiting to launch
  const running: { id: number; end: number }[] = []
  let nextGroup = 0
  const dispatch = (nGroups: number) => {
    for (let k = 0; k < nGroups && nextGroup < MAX_GROUPS; k++) {
      const g = nextGroup++
      groups.push({ ends: [], left: N, readyAt: -1, done: 0, consumed: false, inBatch: false })
      for (let i = 0; i < N; i++) queue.push(g * N + i)
    }
  }

  // per-cell run-length recording
  const segments: Segment[] = []
  const open: { t0: number; code: number }[] = Array.from({ length: K }, () => ({ t0: 0, code: -1 }))
  const record = (t: number, codes: number[]) => {
    for (let c = 0; c < K; c++) {
      if (codes[c] !== open[c].code) {
        if (open[c].code >= 0) segments.push({ cell: c, t0: open[c].t0, t1: t, code: open[c].code })
        open[c] = { t0: t, code: codes[c] }
      }
    }
  }

  let t = 0
  let steps = 0
  const stepTimes: number[] = []
  let busy = 0
  let trainCellTime = 0

  // policy state
  let phase: "roll" | "train" = "roll" // colocate
  let trainLeft = 0 // colocate / async: work left on the current step
  let asyncBatch: number[] = []
  let k = 0 // elastic: cells currently training (a prefix: core first)
  let batch: number[] = [] // elastic: groups assigned to the current step
  let stepInBurst = 0

  dispatch(Math.round((phi + mu) * B))

  const readyWaiting = () => groups.filter((g) => g.readyAt >= 0 && !g.consumed && !g.inBatch)

  while (steps < STEPS && t < 400) {
    // 1. executions that finished during the last tick
    for (let i = running.length - 1; i >= 0; i--) {
      if (running[i].end <= t + 1e-9) {
        const id = running[i].id
        const g = groups[Math.floor(id / N)]
        g.left -= 1
        if (g.left === 0) g.readyAt = t
        running.splice(i, 1)
      }
    }

    // 2. roles and training
    let trainCells = 0
    let trainBusy = 0
    if (policy === "colocate") {
      if (phase === "roll" && queue.length === 0 && running.length === 0) {
        phase = "train"
        trainLeft = mu * W
      }
      if (phase === "train") {
        trainCells = K
        trainBusy = K
        trainLeft -= K * DT
        if (trainLeft <= 1e-9) {
          for (const g of groups) if (g.readyAt >= 0) g.consumed = true
          for (let s = 0; s < mu; s++) stepTimes.push(t + DT)
          steps += mu
          phase = "roll"
          dispatch(mu * B)
        }
      }
    } else if (policy === "async" && p.asyncStreaming) {
      // A3: fixed split, but each ready group is trained as soon as it lands
      trainCells = ASYNC_TRAIN_CELLS
      const waiting = readyWaiting().sort((a, b) => a.readyAt - b.readyAt)
      for (const g of waiting) {
        if (batch.length >= B) break
        g.inBatch = true
        batch.push(groups.indexOf(g))
      }
      let budget = ASYNC_TRAIN_CELLS * DT
      for (const gi of batch) {
        const g = groups[gi]
        const take = Math.min(budget, perGroup - g.done)
        if (take > 0) {
          g.done += take
          budget -= take
          trainBusy += take / DT
        }
      }
      if (batch.length === B && batch.every((gi) => groups[gi].done >= perGroup - 1e-9)) {
        for (const gi of batch) groups[gi].consumed = true
        batch = []
        steps += 1
        stepTimes.push(t + DT)
        dispatch(B)
      }
    } else if (policy === "async") {
      // A0: fixed split; a step starts only when B whole groups are ready
      trainCells = ASYNC_TRAIN_CELLS
      if (trainLeft <= 1e-9) {
        const ready = readyWaiting().sort((a, b) => a.readyAt - b.readyAt)
        if (ready.length >= B) {
          asyncBatch = ready.slice(0, B).map((g) => groups.indexOf(g))
          for (const gi of asyncBatch) groups[gi].inBatch = true
          trainLeft = W
        }
      }
      if (trainLeft > 1e-9) {
        trainBusy = ASYNC_TRAIN_CELLS
        trainLeft -= ASYNC_TRAIN_CELLS * DT
        if (trainLeft <= 1e-9) {
          for (const gi of asyncBatch) groups[gi].consumed = true
          asyncBatch = []
          steps += 1
          stepTimes.push(t + DT)
          dispatch(B)
        }
      }
    } else {
      // elastic: assign ready groups to the current batch, oldest first
      const waiting = readyWaiting().sort((a, b) => a.readyAt - b.readyAt)
      for (const g of waiting) {
        if (batch.length >= B) break
        g.inBatch = true
        batch.push(groups.indexOf(g))
      }
      const supply = Math.min(
        batch.filter((gi) => groups[gi].done < perGroup - 1e-9).length + readyWaiting().length,
        B - batch.filter((gi) => groups[gi].done >= perGroup - 1e-9).length
      )
      if (k > 0) {
        // train: spread k cell-ticks of work over ready groups in the batch
        let budget = k * DT
        for (const gi of batch) {
          const g = groups[gi]
          const take = Math.min(budget, perGroup - g.done)
          if (take > 0) {
            g.done += take
            budget -= take
            trainBusy += take / DT
          }
        }
      }
      trainCells = k
      if (batch.length === B && batch.every((gi) => groups[gi].done >= perGroup - 1e-9)) {
        for (const gi of batch) groups[gi].consumed = true
        batch = []
        steps += 1
        stepTimes.push(t + DT)
        stepInBurst += 1
        if (stepInBurst === mu) {
          stepInBurst = 0
          dispatch(mu * B)
          const wNow = queue.length + running.length
          const keepCore = wNow <= (K - 1) * C && readyWaiting().length >= RHO * B
          k = keepCore ? 1 : 0
        }
      } else {
        // a cell may leave rollout only if what is left still covers every
        // outstanding execution (Equation 5) and there is data to train on
        const w = queue.length + running.length
        const capR = (K - k) * C
        if (k < K && w <= capR - C && supply >= RHO * B) k += 1
      }
    }

    // 3. launch queued executions into free rollout slots
    const rolloutCells = policy === "colocate" ? (phase === "roll" ? K : 0) : K - trainCells
    const cap = rolloutCells * C
    while (queue.length > 0 && running.length < cap) {
      const id = queue.shift() as number
      running.push({ id, end: t + durations[id] })
    }

    // 4. record: training cells are the low indices, rollout work packs into the high ones
    const codes: number[] = []
    let left = running.length
    const isTrain = (c: number) => (policy === "colocate" ? phase === "train" : c < trainCells)
    for (let c = K - 1; c >= 0; c--) {
      if (isTrain(c)) {
        codes[c] = TRAIN
      } else {
        const here = Math.min(C, left)
        left -= here
        codes[c] = Math.round((here / C) * 4)
        busy += here / C
      }
    }
    // starved training cells: the share of training cells with no data this tick
    const starved = Math.round(trainCells - Math.min(trainCells, trainBusy))
    for (let c = 0, s = 0; c < K && s < starved; c++) {
      if (codes[c] === TRAIN) {
        codes[c] = STARVED
        s++
      }
    }
    busy += Math.min(trainCells, trainBusy)
    trainCellTime += trainCells
    record(t, codes)
    t += DT
  }
  record(t, Array(K).fill(-1))
  const ticks = t / DT
  return {
    policy,
    hours: t,
    busyShare: busy / (K * ticks),
    trainShare: trainCellTime / (K * ticks),
    segments,
    stepTimes,
  }
}

export function runAll(p: SimParams) {
  const d = drawDurations(p.sigma, p.seed)
  return {
    colocate: simulate("colocate", p, d),
    async: simulate("async", p, d),
    elastic: simulate("elastic", p, d),
  }
}
