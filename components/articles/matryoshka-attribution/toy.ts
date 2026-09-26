import { mexp, mtanh } from "@/lib/dmath"

// A 12-component toy "network" whose true circuit is known by construction,
// used to compare four ways of ranking components. Pure functions only: no
// randomness, no timers, and every transcendental goes through lib/dmath, so
// the server render and the client hydrate to the same numbers.
//
// Each component H has a base value h(b) and a source value h(s) = 0. A circuit
// of size k keeps its top-k components at the base value and patches every
// other one to the source value (MIB's evaluation). Faithfulness is
//   f(k) = (y(circuit) - y(source)) / (y(base) - y(source)).
//
// Motifs (nonlinear mode):
//   L1, L2   linear paths, weights 1.2 and 0.7
//   S        a saturated unit, 2.5 * tanh(3h): big effect, near-zero gradient at base
//   R1-R3    three redundant backups feeding a soft OR, 2 * (1 - prod(1 - h)):
//            any one of them carries the path, so patching one alone does nothing
//   N        a suppressor, weight -1: it works against the behaviour
//   X1-X5    noise, small weights
// Linear mode replaces S with 2.5h and the OR with three straight lines
// (0.8, 0.7, 0.6), so every motif is additive and first-order methods are exact.

export const IDS = ["L1", "L2", "S", "R1", "R2", "R3", "N", "X1", "X2", "X3", "X4", "X5"] as const
export type Kind = "linear" | "saturating" | "backup" | "suppressor" | "noise"
export const KINDS: Kind[] = [
  "linear",
  "linear",
  "saturating",
  "backup",
  "backup",
  "backup",
  "suppressor",
  "noise",
  "noise",
  "noise",
  "noise",
  "noise",
]
export const NC = IDS.length
const BASE = [1, 1, 1, 1, 0.9, 0.8, 1, 1, 1, 1, 1, 1]
const WX = [0.15, 0.1, -0.05, 0.06, 0.03]

export type MethodId = "exact" | "linear" | "ig" | "mattr"
export type Objective = "logit" | "match"

function mix(alpha: number[]): number[] {
  // soft interchange intervention: alpha * base + (1 - alpha) * source, source = 0
  return alpha.map((a, i) => a * BASE[i])
}

export function output(h: number[], nonlin: boolean): number {
  let v = 1.2 * h[0] + 0.7 * h[1] - 1.0 * h[6]
  for (let i = 0; i < WX.length; i++) v += WX[i] * h[7 + i]
  if (nonlin) {
    v += 2.5 * mtanh(3 * h[2])
    v += 2 * (1 - (1 - h[3]) * (1 - h[4]) * (1 - h[5]))
  } else {
    v += 2.5 * h[2] + 0.8 * h[3] + 0.7 * h[4] + 0.6 * h[5]
  }
  return v
}

// dy/dh at an arbitrary (possibly soft-intervened) point
function gradient(h: number[], nonlin: boolean): number[] {
  const g = new Array<number>(NC).fill(0)
  g[0] = 1.2
  g[1] = 0.7
  g[6] = -1.0
  for (let i = 0; i < WX.length; i++) g[7 + i] = WX[i]
  if (nonlin) {
    const t = mtanh(3 * h[2])
    g[2] = 7.5 * (1 - t * t)
    g[3] = 2 * (1 - h[4]) * (1 - h[5])
    g[4] = 2 * (1 - h[3]) * (1 - h[5])
    g[5] = 2 * (1 - h[3]) * (1 - h[4])
  } else {
    g[2] = 2.5
    g[3] = 0.8
    g[4] = 0.7
    g[5] = 0.6
  }
  return g
}

const Y_SRC = 0 // every motif is zero at the source value

export function faithOfMask(keep: number[], nonlin: boolean): number {
  const yb = output(BASE, nonlin)
  return (output(mix(keep), nonlin) - Y_SRC) / (yb - Y_SRC)
}

// ---- the three one-shot scorers ------------------------------------------

// Activation patching: patch one component to its source value, measure the drop.
function exactScores(nonlin: boolean): number[] {
  const yb = output(BASE, nonlin)
  return IDS.map((_, i) => {
    const a = new Array<number>(NC).fill(1)
    a[i] = 0
    return yb - output(mix(a), nonlin)
  })
}

// Attribution patching / input x gradient: first-order Taylor term at the clean run.
function linearScores(nonlin: boolean): number[] {
  const g = gradient(BASE, nonlin)
  return g.map((gi, i) => gi * BASE[i])
}

// Integrated gradients along the straight mask path alpha = t * 1, m midpoints.
export const IG_STEPS = 16
function igScores(nonlin: boolean): number[] {
  const acc = new Array<number>(NC).fill(0)
  for (let j = 0; j < IG_STEPS; j++) {
    const t = (j + 0.5) / IG_STEPS
    const g = gradient(mix(new Array<number>(NC).fill(t)), nonlin)
    for (let i = 0; i < NC; i++) acc[i] += g[i]
  }
  return acc.map((a, i) => (a / IG_STEPS) * BASE[i])
}

// ---- Matryoshka Attribution ----------------------------------------------

export const TEMP = 0.5 // the repo's default temperature T
export const MATTR_STEPS = 200
const BISECT = 40
const sig = (x: number) => 1 / (1 + mexp(-x))

// Sigmoid top-k: alpha_i = sigmoid((s_i - tau) / T) with tau found by bisection
// so that sum(alpha) = k. The mask for a larger k dominates the mask for a
// smaller k coordinate by coordinate: the Matryoshka nesting.
export function sigmoidTopK(scores: number[], k: number): number[] {
  if (k <= 0) return scores.map(() => 0)
  if (k >= scores.length) return scores.map(() => 1)
  let lo = Math.min(...scores) - 10 * TEMP
  let hi = Math.max(...scores) + 10 * TEMP
  for (let n = 0; n < BISECT; n++) {
    const mid = (lo + hi) / 2
    let f = 0
    for (const s of scores) f += sig((s - mid) / TEMP)
    if (f > k) lo = mid
    else hi = mid
  }
  const tau = (lo + hi) / 2
  return scores.map((s) => sig((s - tau) / TEMP))
}

// Algorithm 1 on the toy, with Adam (lr 0.05) as in the paper's node-level recipe.
// k is drawn from a golden-ratio sequence over (1, N-1) instead of a random
// uniform, so the result is deterministic.
export function trainMattr(nonlin: boolean, objective: Objective): number[] {
  const S = new Array<number>(NC).fill(0)
  const m = new Array<number>(NC).fill(0)
  const v = new Array<number>(NC).fill(0)
  const lr = 0.05
  const b1 = 0.9
  const b2 = 0.999
  const eps = 1e-8
  const phi = (Math.sqrt(5) - 1) / 2
  const yb = output(BASE, nonlin)
  let p1 = 1
  let p2 = 1
  for (let t = 0; t < MATTR_STEPS; t++) {
    const k = 1 + (NC - 2) * (((t + 1) * phi) % 1)
    const alpha = sigmoidTopK(S, k)
    const h = mix(alpha)
    const g = gradient(h, nonlin)
    // d(loss)/d(alpha_i) = d(loss)/dy * dy/dh_i * (base_i - source_i)
    let dLdy = -1 // "logit": maximise the output, loss = -y
    if (objective === "match") {
      // "match": loss = |1 - f|, the integrand of MIB's CMD
      const f = (output(h, nonlin) - Y_SRC) / (yb - Y_SRC)
      const sgn = f < 1 ? 1 : f > 1 ? -1 : 0
      dLdy = -sgn / (yb - Y_SRC)
    }
    const ga = g.map((gi, i) => dLdy * gi * BASE[i])
    // backward through sigmoid top-k (implicit differentiation, as in the repo)
    const sp = alpha.map((a) => a * (1 - a))
    let spSum = 0
    let gsp = 0
    for (let i = 0; i < NC; i++) {
      spSum += sp[i]
      gsp += ga[i] * sp[i]
    }
    spSum = Math.max(spSum, 1e-8)
    p1 *= b1
    p2 *= b2
    for (let i = 0; i < NC; i++) {
      const gs = (sp[i] / TEMP) * (ga[i] - gsp / spSum)
      m[i] = b1 * m[i] + (1 - b1) * gs
      v[i] = b2 * v[i] + (1 - b2) * gs * gs
      const mh = m[i] / (1 - p1)
      const vh = v[i] / (1 - p2)
      S[i] -= (lr * mh) / (Math.sqrt(vh) + eps)
    }
  }
  return S
}

// ---- evaluation ------------------------------------------------------------

export function rankOf(scores: number[]): number[] {
  // indices sorted by score, highest first; ties keep index order
  return scores
    .map((s, i) => [s, i] as const)
    .sort((a, b) => (b[0] !== a[0] ? b[0] - a[0] : a[1] - b[1]))
    .map(([, i]) => i)
}

export function faithCurve(order: number[], nonlin: boolean): number[] {
  const out: number[] = []
  for (let k = 0; k <= NC; k++) {
    const keep = new Array<number>(NC).fill(0)
    for (let j = 0; j < k; j++) keep[order[j]] = 1
    out.push(faithOfMask(keep, nonlin))
  }
  return out
}

// Brute force: the best f(k) over all 2^12 subsets of size k.
export function oracleCurve(nonlin: boolean): number[] {
  const best = new Array<number>(NC + 1).fill(-Infinity)
  for (let mask = 0; mask < 1 << NC; mask++) {
    const keep = new Array<number>(NC).fill(0)
    let k = 0
    for (let i = 0; i < NC; i++) {
      if (mask & (1 << i)) {
        keep[i] = 1
        k++
      }
    }
    const f = faithOfMask(keep, nonlin)
    if (f > best[k]) best[k] = f
  }
  return best
}

export type MethodResult = {
  id: MethodId
  scores: number[]
  order: number[]
  curve: number[]
  area: number // mean f over k = 1..12, a CPR analogue on a linear grid
  gap: number // mean |1 - f| over k = 1..12, a CMD analogue
}

function summarise(id: MethodId, scores: number[], nonlin: boolean): MethodResult {
  const order = rankOf(scores)
  const curve = faithCurve(order, nonlin)
  let area = 0
  let gap = 0
  for (let k = 1; k <= NC; k++) {
    area += curve[k]
    gap += Math.abs(1 - curve[k])
  }
  return { id, scores, order, curve, area: area / NC, gap: gap / NC }
}

export function runAll(nonlin: boolean, objective: Objective): MethodResult[] {
  return [
    summarise("exact", exactScores(nonlin), nonlin),
    summarise("linear", linearScores(nonlin), nonlin),
    summarise("ig", igScores(nonlin), nonlin),
    summarise("mattr", trainMattr(nonlin, objective), nonlin),
  ]
}
