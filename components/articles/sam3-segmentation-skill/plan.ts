// A line-for-line port of the crop planner in lillyguisnet/sam3-segmentation
// (skills/sam3-segmentation/scripts/core.py `tile_starts`, `tiles`,
// `grid_points`, and scripts/segment.py `planned_jobs`, `budget_check`, at
// commit d2d5129). The skill runs this before it loads any weights, and refuses
// a run whose plan exceeds the config's budget.
//
// Checked against the real tool: for the 960x640 CC0 corn photo with the corn
// config, `segment.py plan` printed 262 jobs, 38,115 point prompts and a
// 159,745-candidate upper bound; this port gives the same three numbers.
// Only + - * / floor and ceil are used, so server and client agree exactly.

export type Pass = {
  name: string
  size: number | null // null = the whole image as one view
  overlap: number
  gridStep: number | null // null = text prompts only
}

export type Budget = { maxJobs: number; maxGridPoints: number; maxCandidates: number }

export const DEFAULT_BUDGET: Budget = { maxJobs: 256, maxGridPoints: 25000, maxCandidates: 100000 }
export const HERO_BUDGET: Budget = { maxJobs: 300, maxGridPoints: 40000, maxCandidates: 170000 }

// Upper bound per text request: the pinned detector's 200 query slots.
export const TEXT_SLOTS = 200
// Point prompts save all three returned hypotheses.
export const HYPOTHESES_PER_POINT = 3

export function tileStarts(length: number, size: number, overlap: number): number[] {
  if (size <= 0 || overlap < 0 || overlap >= size) return [0]
  if (length <= size) return [0]
  const starts: number[] = []
  for (let s = 0; s <= length - size; s += size - overlap) starts.push(s)
  if (starts[starts.length - 1] !== length - size) starts.push(length - size)
  return starts
}

export type Tile = [number, number, number, number]

export function tiles(width: number, height: number, size: number | null, overlap: number): Tile[] {
  if (size === null) return [[0, 0, width, height]]
  const out: Tile[] = []
  for (const y of tileStarts(height, size, overlap))
    for (const x of tileStarts(width, size, overlap))
      out.push([x, y, Math.min(size, width), Math.min(size, height)])
  return out
}

// len(np.arange(step/2, length, step)) per axis.
export function gridCount(width: number, height: number, step: number): number {
  const along = (n: number) => Math.max(0, Math.ceil((n - step / 2) / step))
  return along(width) * along(height)
}

export type PassPlan = {
  name: string
  tiles: Tile[]
  textJobs: number
  pointJobs: number
  pointPrompts: number
  candidates: number
}

export type Plan = {
  passes: PassPlan[]
  wholeObjectJobs: number
  jobs: number
  pointPrompts: number
  candidates: number
}

export function plan(
  width: number,
  height: number,
  passes: Pass[],
  phrases: number,
  wholeObjects: number,
): Plan {
  const out: PassPlan[] = passes.map((p) => {
    const ts = tiles(width, height, p.size, p.overlap)
    const textJobs = ts.length * phrases
    const pointJobs = p.gridStep ? ts.length : 0
    const pointPrompts = p.gridStep
      ? ts.reduce((n, t) => n + gridCount(t[2], t[3], p.gridStep as number), 0)
      : 0
    return {
      name: p.name,
      tiles: ts,
      textJobs,
      pointJobs,
      pointPrompts,
      candidates: textJobs * TEXT_SLOTS + pointPrompts * HYPOTHESES_PER_POINT,
    }
  })
  const jobs = out.reduce((n, p) => n + p.textJobs + p.pointJobs, 0) + wholeObjects
  const pointPrompts = out.reduce((n, p) => n + p.pointPrompts, 0)
  const candidates = out.reduce((n, p) => n + p.candidates, 0) + wholeObjects * TEXT_SLOTS
  return { passes: out, wholeObjectJobs: wholeObjects, jobs, pointPrompts, candidates }
}
