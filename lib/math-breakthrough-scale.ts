// The breakthrough scale on its own: dimensions, anchors, weights, tiers and
// the formula, with no data. Client code imports this (the wall's badges and
// sort); lib/math-breakthrough.ts adds the 372 scored families on top.
// Integer arithmetic only, so server and client agree exactly.

export type BreakthroughEntry = {
  /** 0–4: how important and how long-standing the problem is. */
  importance: number
  /** 0–4: how far the result moves it. */
  advance: number
  /** 0–4: what follows if it holds. */
  consequences: number
  /** 0–3: against expectation, or a genuinely new idea. */
  surprise: number
  /** 0–3: how well checked the claim is. Shown separately, never scored. */
  confidence: number
  /** One plain sentence, at most 140 characters: what is claimed. */
  why: string
  /** At most 200 characters: what concretely improves, and for whom. */
  consequence: string
}

export type ScoredDimension = "importance" | "advance" | "consequences" | "surprise"
export type Dimension = ScoredDimension | "confidence"

export const RUBRIC_VERSION = "v1"

/** Maximum value of each dimension. */
export const MAX: Record<Dimension, number> = {
  importance: 4,
  advance: 4,
  consequences: 4,
  surprise: 3,
  confidence: 3,
}

/**
 * Weights, as integers: importance 0.30, advance 0.30, consequences 0.25,
 * surprise 0.15, scaled by 20. The maximum weighted sum is
 * 6·4 + 6·4 + 5·4 + 3·3 = 77.
 */
export const WEIGHTS: Record<ScoredDimension, number> = {
  importance: 6,
  advance: 6,
  consequences: 5,
  surprise: 3,
}

export const MAX_WEIGHTED =
  WEIGHTS.importance * MAX.importance +
  WEIGHTS.advance * MAX.advance +
  WEIGHTS.consequences * MAX.consequences +
  WEIGHTS.surprise * MAX.surprise

/** Written anchors, so the page can explain the scale. Index = score. */
export const ANCHORS: Record<Dimension, { label: string; question: string; levels: string[] }> = {
  importance: {
    label: "Importance",
    question: "How important and how long-standing is the problem?",
    levels: [
      "A question posed in the same paper, or a routine exercise.",
      "A niche or recent question, known to a few specialists.",
      "A named problem well known within its subfield, open for a decade or more.",
      "A major named conjecture that every specialist in the broader field knows, open for decades.",
      "A famous conjecture, open for decades, known well outside its field.",
    ],
  },
  advance: {
    label: "Advance",
    question: "How far does the result move it?",
    levels: [
      "Reproves or repackages what was known.",
      "A constant-factor or second-order gain, or one more case of many (e.g. a covering that saves about 5e-10).",
      "A substantial new bound, a large special case, finishing the last cases after others' reductions, or a resolution with material restrictions.",
      "Resolves the question, or a major case of a bigger one, where earlier work had already come close.",
      "Fully resolves or disproves the headline question, from a state of little progress.",
    ],
  },
  consequences: {
    label: "Consequences",
    question: "If it holds, what follows?",
    levels: [
      "Nothing beyond itself.",
      "Closes a gap, with little follow-on.",
      "Settles a question that a known line of work was waiting on.",
      "Unlocks a named family of downstream results, or a new technique others can reuse.",
      "Changes what is believed or doable across a field (a general algorithmic speed-up, a structural theorem many will cite).",
    ],
  },
  surprise: {
    label: "Surprise",
    question: "Is it unexpected, or a genuinely new idea?",
    levels: [
      "The expected next step, by standard technique.",
      "Some new ingredient on a known route.",
      "A clearly new method, or an unexpectedly short route.",
      "Contradicts what experts expected, or opens a route nobody was on.",
    ],
  },
  confidence: {
    label: "Confidence (not scored)",
    question: "How well checked is the claim?",
    levels: [
      "Unrefereed manuscript with serious caveats: no Lean, long, or resting on other unchecked release papers.",
      "Manuscript only, or Lean covers only a side result.",
      "Lean checks the main theorem in a weaker or bespoke form, or part of the headline.",
      "Lean checks the main theorem against a clean, faithful statement.",
    ],
  },
}

export type Tier = "Huge if true" | "Major" | "Solid" | "Incremental"

/**
 * Cut-offs chosen from the scored distribution (rubric v1, 372 families):
 * 90+ sits in the empty band between 87 and 92 and needs a famous problem,
 * full advance and field-wide consequences (13 families); 75+ starts above
 * the empty 76–78 band (38 more); 55+ starts above the empty 54–55 band
 * (152 more); the remaining 169 are incremental.
 */
export const TIER_CUTOFFS: { min: number; tier: Tier }[] = [
  { min: 90, tier: "Huge if true" },
  { min: 75, tier: "Major" },
  { min: 55, tier: "Solid" },
  { min: 0, tier: "Incremental" },
]

/** round(100 · weighted sum / 77), half up, in integers. */
export function breakthroughScore(e: Pick<BreakthroughEntry, ScoredDimension>): number {
  const sum =
    WEIGHTS.importance * e.importance +
    WEIGHTS.advance * e.advance +
    WEIGHTS.consequences * e.consequences +
    WEIGHTS.surprise * e.surprise
  return Math.floor((200 * sum + MAX_WEIGHTED) / (2 * MAX_WEIGHTED))
}

export function breakthroughTier(score: number): Tier {
  for (const c of TIER_CUTOFFS) if (score >= c.min) return c.tier
  return "Incremental"
}
