// A toy we built to illustrate GTP's two loops on something small enough to
// enumerate exactly. It is not the paper's code and not a diffusion model.
//
// World: a 7 x 5 grid with a three-cell wall in the middle column; the agent
// starts left of the wall and the goal sits right of it. Plans are H = 6 moves
// from {right, up, down, left}; a move into the wall or the edge stays put.
// That is 4^6 = 4,096 possible action sequences, so the "prior" is an exact
// table of 4,096 probabilities instead of a network.
//
// Objective (the paper's Eq. 3 with gamma = 1 and one exact "dynamics model"):
//   J_h(a) = sum of rewards over the first h moves + V(state after h moves)
// with reward -1 for every move taken off the goal, and V(s) = -(shortest-path
// distance to the goal), a perfect value function. The shortest route is 10
// moves, so the best any 6-move plan can score is J = -10, and it can go round
// the wall either above or below: two equally good modes.
//
// Prior update (the paper's Eq. 7, the idealized version of Eq. 6):
//   p_{n+1}(a) ∝ p_n(a) * exp(J(a) / lambda),   p_0 uniform
// Planner: Algorithm 1 with the paper's budget (4 beams of width 2, branching
// factor 4, 32 candidates per depth). "Re-noise and denoise the suffix" is
// replaced by its exact limit here: resample the uncommitted moves from the
// prior conditioned on the committed prefix.

import { mexp, mlog } from "@/lib/dmath"

export const W = 7
export const HGT = 5
export const H = 6
export const N = 4 ** H
export const START: [number, number] = [0, 2]
export const GOAL: [number, number] = [6, 2]
export const WALL = new Set(["3,1", "3,2", "3,3"])
// right, up, down, left (screen coordinates: y grows downward)
export const MOVES: [number, number][] = [
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
]

const key = (x: number, y: number) => `${x},${y}`
const free = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < HGT && !WALL.has(key(x, y))

// Breadth-first distance to the goal: the perfect value function V(s) = -dist.
function distances(): number[][] {
  const d = Array.from({ length: W }, () => Array<number>(HGT).fill(Infinity))
  d[GOAL[0]][GOAL[1]] = 0
  const q: [number, number][] = [GOAL]
  while (q.length) {
    const [x, y] = q.shift() as [number, number]
    for (const [dx, dy] of MOVES) {
      const nx = x + dx
      const ny = y + dy
      if (free(nx, ny) && d[nx][ny] === Infinity) {
        d[nx][ny] = d[x][y] + 1
        q.push([nx, ny])
      }
    }
  }
  return d
}

export type World = {
  dist: number[][]
  // jPre[idx * (H + 1) + h] = J_h of sequence idx (h = 0..H); J = J_H
  jPre: Float64Array
  j: Float64Array
  // visited cells per sequence: path[idx * (H + 1) + h] = x * HGT + y
  path: Int32Array
  jBest: number
}

export function digit(idx: number, i: number): number {
  return Math.floor(idx / 4 ** (H - 1 - i)) % 4
}

export function buildWorld(): World {
  const dist = distances()
  const jPre = new Float64Array(N * (H + 1))
  const j = new Float64Array(N)
  const path = new Int32Array(N * (H + 1))
  let jBest = -Infinity
  for (let idx = 0; idx < N; idx++) {
    let x = START[0]
    let y = START[1]
    let r = 0
    jPre[idx * (H + 1)] = -dist[x][y]
    path[idx * (H + 1)] = x * HGT + y
    for (let i = 0; i < H; i++) {
      if (!(x === GOAL[0] && y === GOAL[1])) {
        r -= 1
        const [dx, dy] = MOVES[digit(idx, i)]
        if (free(x + dx, y + dy)) {
          x += dx
          y += dy
        }
      }
      jPre[idx * (H + 1) + i + 1] = r - dist[x][y]
      path[idx * (H + 1) + i + 1] = x * HGT + y
    }
    j[idx] = jPre[idx * (H + 1) + H]
    if (j[idx] > jBest) jBest = j[idx]
  }
  return { dist, jPre, j, path, jBest }
}

// p_n ∝ exp(n * J / lambda) for a uniform p_0: n idealized updates.
export function prior(world: World, n: number, lambda: number): Float64Array {
  const p = new Float64Array(N)
  let z = 0
  for (let i = 0; i < N; i++) {
    p[i] = mexp((n * (world.j[i] - world.jBest)) / lambda)
    z += p[i]
  }
  for (let i = 0; i < N; i++) p[i] /= z
  return p
}

export type Stats = {
  expJ: number
  optMass: number
  kl: number // KL(p_{n+1} || p_n)
  gain: number // E_{n+1}[J] - E_n[J]
  meanPath: [number, number][]
  visits: number[] // expected visits per cell over the H moves, index x * HGT + y
}

export function stats(world: World, n: number, lambda: number): Stats {
  const p = prior(world, n, lambda)
  const q = prior(world, n + 1, lambda)
  let expJ = 0
  let expJq = 0
  let optMass = 0
  let kl = 0
  const mv = Array.from({ length: H }, () => [0, 0])
  const visits = Array<number>(W * HGT).fill(0)
  for (let i = 0; i < N; i++) {
    expJ += p[i] * world.j[i]
    expJq += q[i] * world.j[i]
    if (world.j[i] === world.jBest) optMass += p[i]
    if (q[i] > 0 && p[i] > 0) kl += q[i] * mlog(q[i] / p[i])
    for (let s = 0; s < H; s++) {
      const [dx, dy] = MOVES[digit(i, s)]
      mv[s][0] += p[i] * dx
      mv[s][1] += p[i] * dy
      visits[world.path[i * (H + 1) + s + 1]] += p[i]
    }
  }
  // The mean action sequence, integrated from the start ignoring the wall:
  // where a single unimodal proposal centred on the prior's mean would aim.
  const meanPath: [number, number][] = [[START[0], START[1]]]
  for (let s = 0; s < H; s++) {
    const [px, py] = meanPath[s]
    meanPath.push([px + mv[s][0], py + mv[s][1]])
  }
  return { expJ, optMass, kl, gain: expJq - expJ, meanPath, visits }
}

// Small deterministic PRNG so the server and the browser draw the same samples.
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

function cumsum(p: Float64Array): Float64Array {
  const c = new Float64Array(N + 1)
  for (let i = 0; i < N; i++) c[i + 1] = c[i] + p[i]
  return c
}

// Sample a sequence index in [lo, hi) with probability ∝ p (via cumulative sums).
function sampleBlock(c: Float64Array, lo: number, hi: number, u: number): number {
  const a = c[lo]
  const b = c[hi]
  const target = a + u * (b - a)
  let l = lo
  let h = hi - 1
  while (l < h) {
    const m = (l + h) >> 1
    if (c[m + 1] < target) l = m + 1
    else h = m
  }
  return l
}

export const BEAMS = 4
export const WIDTH = 2
export const BRANCH = 4
export const BUDGET = BEAMS * WIDTH * BRANCH // 32

// Algorithm 1 on the toy. Returns the chosen sequence index.
export function beamSearch(world: World, c: Float64Array, rand: () => number): number {
  const jAt = (idx: number, h: number) => world.jPre[idx * (H + 1) + h]
  // (0) initialize: 32 samples from the prior, keep the top 8 under J_1
  const init = Array.from({ length: BUDGET }, () => sampleBlock(c, 0, N, rand()))
  init.sort((a, b) => jAt(b, 1) - jAt(a, 1))
  let beams: number[][] = Array.from({ length: BEAMS }, (_, b) => init.slice(b * WIDTH, b * WIDTH + WIDTH))
  for (let h = 1; h < H; h++) {
    const block = 4 ** (H - h)
    beams = beams.map((beam) => {
      const cands: number[] = []
      for (const idx of beam) {
        // (1) branch: D copies; (2) refine: resample the moves after the first h
        const lo = Math.floor(idx / block) * block
        for (let d = 0; d < BRANCH; d++) cands.push(sampleBlock(c, lo, lo + block, rand()))
      }
      // (3) score with J_{h+1} and prune to the beam width
      cands.sort((a, b) => jAt(b, h + 1) - jAt(a, h + 1))
      return cands.slice(0, WIDTH)
    })
  }
  let best = beams[0][0]
  for (const beam of beams) for (const idx of beam) if (world.j[idx] > world.j[best]) best = idx
  return best
}

// The paper's "No plan." ablation: best of the same 32-sample budget, no refinement.
export function bestOfN(world: World, c: Float64Array, rand: () => number): number {
  let best = -1
  for (let k = 0; k < BUDGET; k++) {
    const idx = sampleBlock(c, 0, N, rand())
    if (best < 0 || world.j[idx] > world.j[best]) best = idx
  }
  return best
}

export type PlanStats = { beamHit: number; bestHit: number; beamJ: number; bestJ: number; example: number }

// Success rate (finds a J = -10 plan) over `trials` seeded planning calls.
export function planStats(world: World, n: number, lambda: number, trials = 200): PlanStats {
  const c = cumsum(prior(world, n, lambda))
  let beamHit = 0
  let bestHit = 0
  let beamJ = 0
  let bestJ = 0
  let example = 0
  for (let t = 0; t < trials; t++) {
    const a = beamSearch(world, c, mulberry32(1000 + t))
    const b = bestOfN(world, c, mulberry32(5000 + t))
    if (t === 0) example = a
    if (world.j[a] === world.jBest) beamHit++
    if (world.j[b] === world.jBest) bestHit++
    beamJ += world.j[a]
    bestJ += world.j[b]
  }
  return { beamHit: beamHit / trials, bestHit: bestHit / trials, beamJ: beamJ / trials, bestJ: bestJ / trials, example }
}
