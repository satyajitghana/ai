// The records behind /math, "AI breakthroughs in mathematics": one short narrated
// video (a "reel" internally, made by brand-crew/skills/math-reels) per result
// family of openai/math (372). Composed at import time from four committed
// sources:
//
//   components/articles/openai-math/catalogue-data.ts  our grades (discipline,
//       significance, kind, Lean status, one-line claim, caveat line)
//   data/math-wall/notes.json   the review notes (explainer, caveats, Lean
//       detail, pages) and the release's manuscript map, snapshotted at a commit
//   data/math-wall/generated.ts  which families have a rendered reel, reel spec
//       titles, and the heading of /articles/openai-math that covers each family
//   data/.generated/math-reels.json  the render manifest: which reels were
//       voiced, so have a WebVTT captions track beside them
//
// Server-only in practice: notes.json is ~650 KB. Pages hand the client a slim
// projection (wallTiles) and the panel fetches one record from /api/math/<id>.
// Nothing here reads public/: whether a reel exists was decided when
// scripts/build-math-reels-data.mts ran.

import { DISCIPLINES, FAMILIES, type Family } from "@/components/articles/openai-math/catalogue-data"
import notes from "@/data/math-wall/notes.json"
import { ARTICLE_ANCHORS, REELS, SPEC_TITLES } from "@/data/math-wall/generated"
import reelManifest from "@/data/.generated/math-reels.json"
import { mediaUrl } from "@/lib/media"
import { texToText } from "@/lib/tex-text"

export const MATH_ARTICLE = "/articles/openai-math"
export const MATH_REPO = "https://github.com/openai/math"
export const MATH_COMMIT: string = notes.commit

/**
 * What the /math collection is called wherever a reader or an agent sees it.
 * "Results", not "breakthroughs": every entry is a claim from an unrefereed
 * release, from claimed landmarks down to technical lemmas, and only some are
 * checked in Lean. The URL (/math), /api/math and the math-reels skill keep
 * their names.
 */
export const MATH_COLLECTION = "AI breakthroughs in mathematics"

const VOICED = (reelManifest as { reels: Record<string, { hasVoice?: boolean }> }).reels

// The reel engine's accents (brand-crew/skills/math-reels/engine/reel.js), one
// per discipline at a similar lightness. Indexed like DISCIPLINES.
const ACCENTS: Record<string, string> = {
  "Number theory": "#F2A65A",
  "Algebraic and complex geometry": "#C792EA",
  "Real and complex analysis": "#7FD1C7",
  "Convex and metric geometry": "#E6C86E",
  "Theoretical computer science": "#6CB6FF",
  "Dynamical systems and ergodic theory": "#F08BB3",
  Combinatorics: "#8BD17C",
  Algebra: "#B4A7FF",
  "Probability and statistical mechanics": "#FF8F7A",
  "Mathematical logic": "#A8C7FA",
  "Group theory": "#E39BF0",
  "Mathematical physics": "#5FD4F4",
  "Operator algebras": "#93A3FF",
  Topology: "#D7E37A",
  "Functional analysis": "#74E0A6",
  "Differential geometry": "#F6C177",
  "Partial differential equations": "#E8A87C",
}
export const DISCIPLINE_ACCENTS: string[] = DISCIPLINES.map((d) => ACCENTS[d])

export const SIGNIFICANCE = ["landmark", "major", "notable", "technical"] as const
export const LEAN = ["main", "part", "none"] as const
export type LeanStatus = (typeof LEAN)[number]

export const LEAN_LABEL: Record<LeanStatus, string> = {
  main: "Lean: main theorem",
  part: "Lean: part only",
  none: "Manuscript only",
}
export const LEAN_EXPLAINED: Record<LeanStatus, string> = {
  main: "The release's Lean library states the main theorem against plain mathlib and proves it, with no sorry and only the standard axioms, according to its own docs. We did not re-run the build, and a checked statement is only as strong as its match to the paper's headline.",
  part: "Only part of the result is in Lean: a lemma, a special case or a weaker corollary. The headline rests on the manuscript.",
  none: "No Lean. The claim rests on the manuscript alone, unrefereed.",
}

export const KIND_LABEL: Record<string, string> = {
  proof: "Claimed proof",
  "disproof/counterexample": "Claimed disproof",
  "improved bound": "Claimed improved bound",
  partial: "Claimed partial result",
  conditional: "Claimed conditional result",
}
export const KINDS = Object.keys(KIND_LABEL)

// Titles carry bare TeX for a handful of families ("n\log n", "\mathsf{BPL}").
export const detex = (t: string): string => (/[\\^_]/.test(t) ? texToText(t) : t)

type Notes = {
  explainer: string
  caveats: string
  lean: string
  pages: number | null
  summary: string
  papers: { title: string; path: string }[]
}
const NOTES = notes.families as Record<string, Notes>

const blob = (path: string) => `${MATH_REPO}/blob/${MATH_COMMIT}/${path.split("/").map(encodeURIComponent).join("/")}`

// openai/math has no per-entry anchors in CONTENTS.md (each result is a bold
// line in a table), so the catalogue link is a text fragment on "NNN. Title":
// browsers that support it scroll to and highlight the entry, others open the
// catalogue at the top.
function catalogueUrl(id: string, title: string) {
  const words = title.replace(/[^\p{L}\p{N}\s’'-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 3).join(" ")
  const frag = encodeURIComponent(`${id}. ${words}`).replace(/-/g, "%2D")
  return `${MATH_REPO}/blob/${MATH_COMMIT}/CONTENTS.md#:~:text=${frag}`
}

export type MathReel = {
  src: string
  poster: string
  /** WebVTT captions of the narration, when the reel is voiced */
  captions: string | null
  duration: number | null
  width: number | null
  height: number | null
  date: string
}

export type MathResult = {
  id: string
  title: string
  /** the reel spec's short title, when a spec exists */
  short: string | null
  discipline: string
  disciplineIndex: number
  accent: string
  kind: string
  kindLabel: string
  significance: (typeof SIGNIFICANCE)[number]
  significanceRank: number
  lean: LeanStatus
  leanLabel: string
  /** one-line claim, as we read it */
  claim: string
  /** our verdict: the caveat line from the catalogue */
  verdict: string
  url: string
  articleUrl: string
  catalogueUrl: string
  manuscripts: { title: string; url: string }[]
  reel: MathReel | null
}

export type MathResultDetail = MathResult & {
  explainer: string
  caveats: string
  leanDetail: string
  leanExplained: string
  releaseSummary: string
  pages: number | null
}

function record(f: Family): MathResultDetail {
  const n = NOTES[f.id]
  const discipline = DISCIPLINES[f.d]
  const lean = LEAN[f.l]
  const r = REELS[f.id]
  const title = detex(f.t)
  return {
    id: f.id,
    title,
    short: SPEC_TITLES[f.id]?.short ?? null,
    discipline,
    disciplineIndex: f.d,
    accent: DISCIPLINE_ACCENTS[f.d],
    kind: f.k,
    kindLabel: KIND_LABEL[f.k] ?? f.k,
    significance: SIGNIFICANCE[f.s],
    significanceRank: f.s,
    lean,
    leanLabel: LEAN_LABEL[lean],
    claim: f.c,
    verdict: f.v,
    url: `/math#${f.id}`,
    articleUrl: `${MATH_ARTICLE}#${ARTICLE_ANCHORS[f.id] ?? ""}`.replace(/#$/, ""),
    catalogueUrl: catalogueUrl(f.id, title),
    manuscripts: n.papers.map((p) => ({ title: p.title, url: blob(p.path) })),
    reel: r
      ? {
          src: mediaUrl(`/films/math/${f.id}.mp4`),
          poster: mediaUrl(`/films/math/${f.id}-poster.webp`),
          captions: VOICED[f.id]?.hasVoice ? mediaUrl(`/films/math/${f.id}.vtt`) : null,
          duration: r.duration,
          width: r.width,
          height: r.height,
          date: r.date,
        }
      : null,
    explainer: n.explainer,
    caveats: n.caveats,
    leanDetail: n.lean,
    leanExplained: LEAN_EXPLAINED[lean],
    releaseSummary: n.summary,
    pages: n.pages,
  }
}

const ALL: MathResultDetail[] = FAMILIES.map(record)
const BY_ID = new Map(ALL.map((r) => [r.id, r]))

export const mathResults = (): MathResultDetail[] => ALL
export const mathResult = (id: string): MathResultDetail | undefined => BY_ID.get(id)

/** The summary shape: everything but the long review prose. */
export function summarize(r: MathResultDetail): MathResult & { detail: string } {
  const out: Record<string, unknown> = { ...r }
  for (const k of ["explainer", "caveats", "leanDetail", "leanExplained", "releaseSummary", "pages"]) delete out[k]
  return { ...(out as MathResult), detail: `/api/math/${r.id}` }
}

/**
 * The slim tile the client wall gets for every family. Short keys: 372 of these
 * are serialized into the page.
 */
export type WallTile = {
  id: string
  t: string
  d: number
  s: number
  k: string
  l: number
  c: string
  /** reel: [src, poster, captions, seconds] when rendered */
  r: [string, string, string | null, number | null] | null
}

export function wallTiles(): WallTile[] {
  return FAMILIES.map((f) => {
    const r = BY_ID.get(f.id)!.reel
    return { id: f.id, t: BY_ID.get(f.id)!.title, d: f.d, s: f.s, k: f.k, l: f.l, c: f.c, r: r ? [r.src, r.poster, r.captions, r.duration] : null }
  })
}

export const mathCounts = () => ({
  families: ALL.length,
  reels: ALL.filter((r) => r.reel).length,
  leanMain: ALL.filter((r) => r.lean === "main").length,
  leanPart: ALL.filter((r) => r.lean === "part").length,
  manuscripts: ALL.reduce((n, r) => n + r.manuscripts.length, 0),
})
