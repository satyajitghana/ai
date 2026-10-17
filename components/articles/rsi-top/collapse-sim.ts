// A deliberately small model of exploration collapse, for the toy widget.
// Nothing here is RSI-top's code (none is published); it is an illustration of
// the mechanism the project page describes, with every transcendental routed
// through lib/dmath so server and client agree on every coordinate.

import { mcos, mexp, mlog, msin } from "@/lib/dmath"

export type Valley = { x: number; y: number; depth: number; width: number; name: string }

// Score is "depth found": higher is better. Valley A is where the run starts and
// is the shallowest; E is the deepest and the hardest to reach.
export const VALLEYS: Valley[] = [
  { name: "A", x: 0.24, y: 0.66, depth: 0.55, width: 0.15 },
  { name: "B", x: 0.5, y: 0.24, depth: 0.66, width: 0.1 },
  { name: "C", x: 0.7, y: 0.8, depth: 0.74, width: 0.1 },
  { name: "D", x: 0.82, y: 0.2, depth: 0.84, width: 0.09 },
  { name: "E", x: 0.92, y: 0.54, depth: 1, width: 0.07 },
]

export const START: [number, number] = [0.06, 0.9]

export function score(x: number, y: number): number {
  let best = 0
  for (const v of VALLEYS) {
    const d2 = (x - v.x) * (x - v.x) + (y - v.y) * (y - v.y)
    const s = v.depth * mexp(-d2 / (2 * v.width * v.width))
    if (s > best) best = s
  }
  return best
}

export function valleyOf(x: number, y: number): number {
  let bi = 0
  let bs = -1
  VALLEYS.forEach((v, i) => {
    const d2 = (x - v.x) * (x - v.x) + (y - v.y) * (y - v.y)
    const s = v.depth * mexp(-d2 / (2 * v.width * v.width))
    if (s > bs) {
      bs = s
      bi = i
    }
  })
  return bi
}

// mulberry32: integer-only, so identical on every engine.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sq = (v: number) => v * v
const clamp01 = (v: number) => Math.min(0.995, Math.max(0.005, v))

export type Mechanisms = { views: boolean; ideas: boolean; lineages: boolean }

export type Point = {
  x: number
  y: number
  s: number
  parent: number
  step: number
  by: "native" | "cohort"
}

export type SimResult = {
  points: Point[]
  best: number[] // best score after each evaluation
  interventions: number[] // evaluation index where each intervention starts
  stalledSteps: number // evaluations spent inside a stall (before intervening)
}

export const BUDGET = 240
const STALL = 14 // evaluations with no meaningful gain = a stall
const EPS = 0.004 // "meaningful" gain
const COHORT = 4
const PER_AGENT = 2 // every configuration spends 8 evaluations per intervention

export function simulate(mech: Mechanisms | null, seed: number): SimResult {
  const r = rng(seed * 7919 + 17)
  const gauss = () => {
    const u = Math.max(1e-9, r())
    const v = r()
    return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
  }
  const pts: Point[] = [{ x: START[0], y: START[1], s: score(START[0], START[1]), parent: -1, step: 0, by: "native" }]
  const best: number[] = [pts[0].s]
  const interventions: number[] = []
  let bestIdx = 0
  let lastGainAt = 0
  let stalledSteps = 0
  let dir: [number, number] = [0.6, -0.4] // context inertia: the last direction that helped

  const add = (x: number, y: number, parent: number, by: Point["by"]) => {
    const p: Point = { x: clamp01(x), y: clamp01(y), s: 0, parent, step: pts.length, by }
    p.s = score(p.x, p.y)
    pts.push(p)
    if (p.s > pts[bestIdx].s + EPS) lastGainAt = pts.length - 1
    if (p.s > pts[bestIdx].s) {
      const dx = p.x - pts[parent].x
      const dy = p.y - pts[parent].y
      const n = Math.sqrt(dx * dx + dy * dy) || 1
      dir = [dx / n, dy / n]
      bestIdx = pts.length - 1
    }
    best.push(pts[bestIdx].s)
  }

  while (pts.length < BUDGET) {
    const stalled = pts.length - 1 - lastGainAt >= STALL
    if (mech && stalled && pts.length + COHORT * PER_AGENT <= BUDGET) {
      interventions.push(pts.length)
      cohort(mech)
      lastGainAt = pts.length - 1 // give the resumed native search a fresh window
      continue
    }
    if (stalled) stalledSteps++
    // Native search: build on the frontier, keep going the way that last worked.
    const par = pts[bestIdx]
    const k = 0.035
    add(par.x + dir[0] * k * 0.6 + gauss() * k, par.y + dir[1] * k * 0.6 + gauss() * k, bestIdx, "native")
  }
  return { points: pts, best, interventions, stalledSteps }

  function cohort(m: Mechanisms) {
    const bx = pts[bestIdx].x
    const by = pts[bestIdx].y
    // Toy "dashboard": five per-point metrics, each scaled to 0..1.
    const n = pts.length
    const metric = (i: number, j: number) => {
      const p = pts[i]
      switch (j) {
        case 0:
          return p.s // score
        case 1:
          return Math.min(1, Math.sqrt(sq(p.x - bx) + sq(p.y - by)) / 0.6) // distance from frontier
        case 2:
          return i / n // recency
        case 3:
          return p.parent >= 0 ? Math.max(0, Math.min(1, (p.s - pts[p.parent].s) * 10 + 0.5)) : 0.5 // gain over parent
        default: {
          let near = 1
          for (let q = 0; q < n; q += 3) {
            if (q === i) continue
            const d = Math.sqrt(sq(pts[q].x - p.x) + sq(pts[q].y - p.y))
            if (d < near) near = d
          }
          return Math.min(1, near / 0.15) // isolation
        }
      }
    }
    // Lineages: four far-apart anchors among the archive (greedy farthest point).
    const anchors: number[] = [bestIdx]
    if (m.lineages) {
      while (anchors.length < COHORT) {
        let far = -1
        let fd = -1
        for (let i = 0; i < n; i++) {
          let d = 9
          for (const a of anchors) d = Math.min(d, Math.sqrt(sq(pts[i].x - pts[a].x) + sq(pts[i].y - pts[a].y)))
          if (d > fd) {
            fd = d
            far = i
          }
        }
        anchors.push(far)
      }
    }
    for (let a = 0; a < COHORT; a++) {
      // Which point does this agent build on?
      let parent = m.lineages ? anchors[a] : bestIdx
      if (m.views) {
        const order = [0, 1, 2, 3, 4]
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1))
          const t = order[i]
          order[i] = order[j]
          order[j] = t
        }
        const subset = order.slice(0, 3)
        const lo = m.lineages ? anchors[a] : 0
        let bi = parent
        let bs = -1
        for (let i = 0; i < n; i++) {
          if (m.lineages) {
            // stay inside this agent's branch: nearest anchor must be its own
            let own = true
            const da = sq(pts[i].x - pts[lo].x) + sq(pts[i].y - pts[lo].y)
            for (const o of anchors) if (sq(pts[i].x - pts[o].x) + sq(pts[i].y - pts[o].y) < da) own = false
            if (!own) continue
          }
          let v = 0
          for (const j of subset) v += metric(i, j)
          if (v > bs) {
            bs = v
            bi = i
          }
        }
        parent = bi
      }
      const p = pts[parent]
      for (let k = 0; k < PER_AGENT; k++) {
        if (m.ideas) {
          // A portfolio of eight directions spread round the compass, at a spread
          // of distances; the agent runs two of them, typical or not.
          const slot = Math.floor(r() * 8)
          const ang = (slot / 8) * 2 * Math.PI + (r() - 0.5) * 0.6
          const dist = 0.08 + 0.32 * r()
          add(p.x + mcos(ang) * dist, p.y + msin(ang) * dist, parent, "cohort")
        } else {
          // The most typical next idea: one more small tweak in the same direction.
          const k2 = 0.05
          add(p.x + dir[0] * k2 + gauss() * k2, p.y + dir[1] * k2 + gauss() * k2, parent, "cohort")
        }
      }
    }
  }
}

export function spread(res: SimResult): number {
  const seen = new Set<number>()
  for (const p of res.points) if (p.s > 0.15) seen.add(valleyOf(p.x, p.y))
  return seen.size
}
