// Breakthrough score for the /math wall: "if this claim holds, how big a
// breakthrough is it?" — on 0–100, from four hand-scored integer dimensions.
//
// Verification is deliberately NOT in the score: the wall already shows it
// (the Lean badge, CLAIMED). `confidence` is recorded beside the score so the
// UI can say "huge if true" honestly, but it never moves the number.
//
// The data is data/math-wall/breakthrough.json; `pnpm validate:breakthrough`
// (scripts/check-math-breakthrough.mts) checks it against the catalogue.
// Everything here is integer arithmetic, so server and client agree exactly.
import data from "@/data/math-wall/breakthrough.json"

import { breakthroughScore, breakthroughTier, type BreakthroughEntry, type Tier } from "@/lib/math-breakthrough-scale"

export * from "@/lib/math-breakthrough-scale"

export const BREAKTHROUGH: Record<string, BreakthroughEntry> = data.families

/** Score and tier for a family id, or null when the id is unknown. */
export function scoreOf(id: string): { score: number; tier: Tier } | null {
  const e = BREAKTHROUGH[id]
  if (!e) return null
  const score = breakthroughScore(e)
  return { score, tier: breakthroughTier(score) }
}
