// `pnpm validate:breakthrough`: the /math wall's breakthrough scores
// (data/math-wall/breakthrough.json, rubric in lib/math-breakthrough.ts).
//
// Fails when:
//   - a catalogue family has no entry, or an entry names no catalogue family;
//   - a dimension is not an integer in its range, or `why` / `consequence`
//     is missing or too long (140 / 200 characters);
//   - a dimension's corpus mean passes its ceiling. The rubric is meant to be
//     stingy: real breakthroughs are rare, and a drifting mean is how a score
//     stops meaning anything.
//
// Prints the score histogram, tier counts, per-dimension means and the top 15.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { FAMILIES } from "../components/articles/openai-math/catalogue-data"
import {
  MAX,
  RUBRIC_VERSION,
  TIER_CUTOFFS,
  breakthroughScore,
  breakthroughTier,
  type Dimension,
} from "../lib/math-breakthrough"

const CEILING: Record<Exclude<Dimension, "confidence">, number> = {
  importance: 2.6,
  advance: 2.6,
  consequences: 2.4,
  surprise: 1.8,
}
const WHY_MAX = 140
const CONSEQUENCE_MAX = 200

const file = join(process.cwd(), "data", "math-wall", "breakthrough.json")
const raw = JSON.parse(readFileSync(file, "utf8")) as { rubric?: string; families?: Record<string, Record<string, unknown>> }
const errors: string[] = []
const fail = (m: string) => errors.push(m)

if (raw.rubric !== RUBRIC_VERSION) fail(`rubric is ${JSON.stringify(raw.rubric)}, lib/math-breakthrough.ts expects "${RUBRIC_VERSION}"`)
const fams = raw.families ?? {}
const ids = new Set(FAMILIES.map((f) => f.id))
for (const id of ids) if (!(id in fams)) fail(`${id}: catalogue family has no breakthrough entry`)
for (const id of Object.keys(fams)) if (!ids.has(id)) fail(`${id}: entry for a family that is not in the catalogue`)

const dims = Object.keys(MAX) as Dimension[]
const sums: Record<string, number> = {}
const scores: { id: string; score: number }[] = []
for (const [id, e] of Object.entries(fams)) {
  let ok = true
  for (const d of dims) {
    const v = e[d]
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX[d]) {
      fail(`${id}: ${d} = ${JSON.stringify(v)}, want an integer 0–${MAX[d]}`)
      ok = false
    } else sums[d] = (sums[d] ?? 0) + v
  }
  for (const [k, max] of [["why", WHY_MAX], ["consequence", CONSEQUENCE_MAX]] as const) {
    const s = e[k]
    if (typeof s !== "string" || !s.trim()) fail(`${id}: ${k} is missing`)
    else if (s.length > max) fail(`${id}: ${k} is ${s.length} characters, max ${max}`)
  }
  const extra = Object.keys(e).filter((k) => !dims.includes(k as Dimension) && k !== "why" && k !== "consequence")
  if (extra.length) fail(`${id}: unknown field(s) ${extra.join(", ")}`)
  if (ok) scores.push({ id, score: breakthroughScore(e as Record<Dimension, number>) })
}

const n = Object.keys(fams).length || 1
console.log(`breakthrough: ${Object.keys(fams).length} families, rubric ${raw.rubric}`)
console.log("means: " + dims.map((d) => `${d} ${((sums[d] ?? 0) / n).toFixed(2)}${d in CEILING ? ` (≤ ${CEILING[d as keyof typeof CEILING]})` : ""}`).join(", "))
for (const [d, c] of Object.entries(CEILING)) {
  const mean = (sums[d] ?? 0) / n
  if (mean > c) fail(`${d}: corpus mean ${mean.toFixed(2)} is above the ceiling ${c}; the rubric is being scored too generously`)
}

const bins = new Array(10).fill(0) as number[]
for (const s of scores) bins[Math.min(9, Math.floor(s.score / 10))]++
const widest = Math.max(1, ...bins)
console.log("\nscore histogram")
bins.forEach((c, i) => {
  const label = i === 9 ? "90-100" : `${i * 10}-${i * 10 + 9}`
  console.log(`  ${label.padStart(6)} ${String(c).padStart(4)} ${"#".repeat(Math.round((c / widest) * 40))}`)
})

console.log("\ntiers")
for (const t of TIER_CUTOFFS) {
  const c = scores.filter((s) => breakthroughTier(s.score) === t.tier).length
  console.log(`  ${t.tier.padEnd(13)} ≥${String(t.min).padStart(2)}  ${c}`)
}

const title = new Map(FAMILIES.map((f) => [f.id, f.t]))
console.log("\ntop 15")
for (const s of [...scores].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 15)) {
  console.log(`  ${String(s.score).padStart(3)}  ${s.id}  ${title.get(s.id)}`)
}

if (errors.length) {
  console.log(`\n${errors.length} problem(s):`)
  for (const e of errors) console.log(`FAIL ${e}`)
  process.exit(1)
}
console.log("\nok")
