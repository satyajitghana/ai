// A top-down port of the causal sampler's cache bookkeeping in the Astronex-World
// code release, so the window widget shows what the code does rather than what a
// diagram suggests. Sources, all in the cloned repo (commit 27584bf):
//
//   inference/pipelines/causal_diffusion_inference.py  the per-block window rule
//   utils/cache_selection.py                           select_history_frames()
//   post_train/objectives/camera_diffusion.py          _frustum_overlap()
//   inference/causal.yaml                              20-frame cache, sink 4,
//                                                      8-frame blocks, 4 recent
//                                                      pinned, overlap >= 0.3,
//                                                      at most 2 swaps a block
//
// The real overlap pushes a 5x5 grid of rays to depth 3 through the query
// frustum and counts how many land inside each candidate camera. Here the world
// is flat and seen from above, so the grid is one row of five rays; with the
// cameras level, the vertical rows of the real grid would score identically.

import { mcos, msin, mtan } from "@/lib/dmath"

export const CACHE = 20 // local_attn_size: the whole cache, sink included
export const SINK = 4
export const BLOCK = 8
export const RECENT = 4
export const MIN_OVERLAP = 0.3
export const SWAP = 2
export const DEPTH = 3
const HALF_FOV = (32 * Math.PI) / 180

// Control2V's poses quantise to 0.08 units and 3 degrees per latent frame
// (utils/action_encoding.py, from_viewmats), and the release's --trajectory
// flag takes one command per latent frame.
const STEP = 0.08
const TURN = (3 * Math.PI) / 180

export type Pose = { x: number; y: number; yaw: number }

export type PathId = "forward" | "strafe" | "pan"

export const PATHS: Record<PathId, { label: string; cmd: string; build: () => string[] }> = {
  forward: { label: "walk forward", cmd: "w*55", build: () => Array(55).fill("w") },
  strafe: {
    label: "strafe out and back",
    cmd: "a*24,d*31",
    build: () => [...Array(24).fill("a"), ...Array(31).fill("d")],
  },
  pan: {
    label: "pan right, then back",
    cmd: "right*28,left*27",
    build: () => [...Array(28).fill("right"), ...Array(27).fill("left")],
  },
}

export function poses(path: PathId): Pose[] {
  const cmds = PATHS[path].build()
  const out: Pose[] = [{ x: 0, y: 0, yaw: Math.PI / 2 }]
  for (const c of cmds) {
    const p = out[out.length - 1]
    const fx = mcos(p.yaw)
    const fy = msin(p.yaw)
    // right-hand vector of a camera looking along (fx, fy)
    const rx = fy
    const ry = -fx
    let { x, y, yaw } = p
    if (c === "w") { x += fx * STEP; y += fy * STEP }
    if (c === "d") { x += rx * STEP; y += ry * STEP }
    if (c === "a") { x -= rx * STEP; y -= ry * STEP }
    if (c === "right") yaw -= TURN
    if (c === "left") yaw += TURN
    out.push({ x, y, yaw })
  }
  return out
}

// Fraction of the query camera's sample points (five rays, depth 3) that a
// candidate camera has in front of it and inside its field of view.
export function overlap(q: Pose, c: Pose): number {
  const t = mtan(HALF_FOV)
  let hit = 0
  const n = 5
  for (let i = 0; i < n; i++) {
    const u = (-0.8 + (1.6 * i) / (n - 1)) * t
    // ray in query camera coords: forward 1, right u; normalise, push to DEPTH
    const len = Math.sqrt(1 + u * u)
    const fwd = DEPTH / len
    const rgt = (u * DEPTH) / len
    const qfx = mcos(q.yaw), qfy = msin(q.yaw)
    const px = q.x + qfx * fwd + qfy * rgt
    const py = q.y + qfy * fwd - qfx * rgt
    const cfx = mcos(c.yaw), cfy = msin(c.yaw)
    const dx = px - c.x, dy = py - c.y
    const z = dx * cfx + dy * cfy
    const xr = dx * cfy - dy * cfx
    if (z > 1e-3 && Math.abs(xr / z) < t) hit++
  }
  return hit / n
}

// utils/cache_selection.py, select_history_frames, line for line.
function selectHistory(
  body: number[], keepN: number, recentN: number, scores: Map<number, number>,
  threshold: number, previous: number[], swap: number,
): { keep: number[]; selected: number[] } {
  const recent = Math.min(Math.max(0, recentN), keepN)
  const pinned = recent ? body.slice(-recent) : []
  const candidates = body.filter((f) => !pinned.includes(f))
  const room = keepN - pinned.length
  const sc = (f: number) => scores.get(f) ?? 0
  const ranked = [...candidates].sort((a, b) => sc(b) - sc(a) || b - a)
  let selected = ranked.filter((f) => sc(f) >= threshold).slice(0, room)
  const fallback = candidates.filter((f) => !selected.includes(f)).sort((a, b) => b - a)
  selected = [...selected, ...fallback.slice(0, room - selected.length)]
  const prev = previous.filter((f) => candidates.includes(f))
  if (prev.length && swap >= 0) {
    const held = prev.filter((f) => selected.includes(f)).slice(0, room)
    const incoming = selected.filter((f) => !held.includes(f))
    const keepPrev = prev.filter((f) => !held.includes(f))
    const budget = Math.max(swap, room - prev.length)
    const take = incoming.slice(0, Math.min(budget, room - held.length))
    selected = [...held, ...take]
    selected = [...selected, ...keepPrev.slice(0, room - selected.length)]
    selected = [...selected, ...incoming.filter((f) => !selected.includes(f)).slice(0, room - selected.length)]
  }
  const keep = [...pinned, ...selected].sort((a, b) => a - b)
  return { keep, selected }
}

export type Slot = { frame: number; role: "sink" | "recent" | "kept" | "retrieved" | "new"; score?: number }

export type BlockState = {
  block: number
  newFrames: number[]
  slots: Slot[]
  evicted: number[] // frames that left the cache at this block, never to return
}

export function simulate(path: PathId, retrieval: boolean): { poses: Pose[]; blocks: BlockState[] } {
  const ps = poses(path)
  const total = ps.length // 56 latent frames: the reference plus 55
  const blocks: BlockState[] = []
  let mirror: number[] = []
  let prevRetrieved: number[] = []
  const everSeen = new Set<number>()
  for (let b = 0; b * BLOCK < total; b++) {
    const newFrames = Array.from({ length: BLOCK }, (_, i) => b * BLOCK + i)
    let combined = [...mirror, ...newFrames]
    let retrievedNow: number[] = []
    let scores = new Map<number, number>()
    let pinnedNow: number[] = []
    if (combined.length > CACHE) {
      const evict = combined.length - CACHE
      const sink = SINK
      if (retrieval) {
        const body = combined.slice(sink, combined.length - newFrames.length)
        const keepN = CACHE - sink - newFrames.length
        const recent = Math.min(keepN, RECENT)
        const candidates = recent ? body.slice(0, -recent) : body
        const q = ps[newFrames[newFrames.length - 1]]
        scores = new Map(candidates.map((f) => [f, overlap(q, ps[f])]))
        const { keep, selected } = selectHistory(body, keepN, recent, scores, MIN_OVERLAP, prevRetrieved, SWAP)
        prevRetrieved = selected
        retrievedNow = selected.filter((f) => (scores.get(f) ?? 0) >= MIN_OVERLAP)
        pinnedNow = body.slice(-recent)
        combined = [...combined.slice(0, sink), ...keep, ...newFrames]
      } else {
        combined = [...combined.slice(0, sink), ...combined.slice(sink + evict)]
        pinnedNow = combined.slice(sink, combined.length - newFrames.length)
      }
    }
    const resident = new Set(combined)
    const evicted = [...everSeen].filter((f) => !resident.has(f)).filter((f) => mirror.includes(f))
    for (const f of newFrames) everSeen.add(f)
    mirror = combined
    const slots: Slot[] = combined.map((f, i) => {
      if (i < SINK && f < SINK && b > 0) return { frame: f, role: "sink" }
      if (newFrames.includes(f)) return { frame: f, role: "new" }
      if (retrievedNow.includes(f)) return { frame: f, role: "retrieved", score: scores.get(f) }
      if (pinnedNow.includes(f)) return { frame: f, role: "recent" }
      return { frame: f, role: "kept", score: scores.get(f) }
    })
    blocks.push({ block: b, newFrames, slots, evicted })
  }
  return { poses: ps, blocks }
}
