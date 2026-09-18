// A small, self-contained, illustrative activity-spread over the thresholded
// backbone subgraph -- NOT a biophysical simulation and not claiming to be
// one. It exists to answer one question visually: starting from a selected
// cell type, which somas does the *shipped* backbone connect it to, and how
// far does a pulse travel in a few steps? The backbone is ~1% of the real
// edge set (see manifest.json), so this under-represents true reach; the UI
// says so plainly next to the control.
//
// Cheap on purpose: one adjacency list built once from 231,761 backbone
// edges, a per-tick decay + spread over a Float32Array of length N. No
// requestAnimationFrame loop lives here -- the component drives ticks.

import type { EdgeSet } from "./data"

export interface ActivityAdjacency {
  /** neighbor(i) = targets[starts[i] .. starts[i+1]), weights(i) matches 1:1 */
  starts: Uint32Array
  targets: Uint32Array
  weights: Float32Array
}

export function buildAdjacency(n: number, edges: EdgeSet): ActivityAdjacency {
  const degree = new Uint32Array(n)
  for (let e = 0; e < edges.count; e++) degree[edges.src[e]]++
  const starts = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) starts[i + 1] = starts[i] + degree[i]
  const targets = new Uint32Array(starts[n])
  const weights = new Float32Array(starts[n])
  const cursor = starts.slice(0, n)
  // normalize each edge weight by the max weight so spread is comparable
  let maxW = 1
  for (let e = 0; e < edges.count; e++) if (edges.weight[e] > maxW) maxW = edges.weight[e]
  for (let e = 0; e < edges.count; e++) {
    const s = edges.src[e]
    const idx = cursor[s]++
    targets[idx] = edges.dst[e]
    weights[idx] = edges.weight[e] / maxW
  }
  return { starts, targets, weights }
}

const DECAY = 0.9
const SPREAD = 0.55

/** One tick in place: activity is mutated, scratch must be the same length (reused to avoid allocating every frame). */
export function stepActivity(activity: Float32Array, scratch: Float32Array, adj: ActivityAdjacency) {
  scratch.fill(0)
  const n = activity.length
  for (let i = 0; i < n; i++) {
    const a = activity[i]
    if (a <= 0.004) continue
    const from = adj.starts[i]
    const to = adj.starts[i + 1]
    for (let k = from; k < to; k++) {
      scratch[adj.targets[k]] += a * adj.weights[k] * SPREAD
    }
  }
  for (let i = 0; i < n; i++) {
    const next = activity[i] * DECAY + scratch[i]
    activity[i] = next > 1 ? 1 : next
  }
}

export function totalActivity(activity: Float32Array): number {
  let s = 0
  for (let i = 0; i < activity.length; i++) s += activity[i]
  return s
}
