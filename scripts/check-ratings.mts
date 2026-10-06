// Article ratings: coverage and calibration.
//
// Zod (lib/content/schema.ts) already rejects an unknown topic, kind, level,
// runsOn or a score outside 0–3. This checks what a schema cannot see, because
// it is a property of the corpus rather than of one file:
//
//   - a rated article must also carry topic, kind, level and runsOn, or it
//     cannot be filtered the way its rating says it should be found;
//   - once INFLATION_MIN_RATED articles are rated, any rubric dimension whose
//     corpus mean passes INFLATION_MEAN fails: the rubric is meant to be
//     stingy (expected means ≈ 1.5), and the old interest/helpful signal died
//     of exactly this drift (73% of articles ended up "High").
//
// It prints coverage, per-dimension means, the tier cut-offs and the topic and
// kind spread so a rating pass can see where it stands.
import { getArticles } from "../lib/content/index"
import { INFLATION_MEAN, INFLATION_MIN_RATED, RUBRIC, TIERS } from "../lib/content/rating"
import { articleScores } from "../lib/content/signals"

function main() {
  const all = getArticles({ includeDrafts: true })
  const rated = all.filter((a) => a.rating)
  const errors: string[] = []

  for (const a of rated) {
    const missing = (["topic", "articleKind", "level", "runsOn"] as const).filter((k) => !a[k])
    if (missing.length) {
      errors.push(
        `content/articles/${a.slug}.mdx: rated but missing ${missing.map((k) => (k === "articleKind" ? "kind" : k)).join(", ")}`,
      )
    }
  }

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%")
  console.log(`ratings: ${rated.length}/${all.length} articles rated (${pct(rated.length, all.length)})`)

  if (rated.length) {
    const enforce = rated.length >= INFLATION_MIN_RATED
    console.log(`  per-dimension mean (fails above ${INFLATION_MEAN} once ${INFLATION_MIN_RATED}+ are rated${enforce ? "" : `; ${INFLATION_MIN_RATED - rated.length} to go`}):`)
    for (const d of RUBRIC) {
      const values = rated.map((a) => a.rating![d.key])
      const mean = values.reduce((s, v) => s + v, 0) / values.length
      const threes = values.filter((v) => v === 3).length
      const flag = mean > INFLATION_MEAN ? (enforce ? "  ✗ inflated" : "  ! high") : ""
      console.log(`    ${d.key.padEnd(13)} ${mean.toFixed(2)}   3s: ${pct(threes, values.length).padStart(4)}${flag}`)
      if (enforce && mean > INFLATION_MEAN) {
        errors.push(`rubric "${d.key}" corpus mean ${mean.toFixed(2)} > ${INFLATION_MEAN}: inflated, re-score against the anchors in lib/content/rating.ts`)
      }
    }

    const scores = articleScores()
    const byTier = new Map<string, number[]>()
    for (const a of rated) {
      const s = scores.get(a.slug)!
      if (s.tier && s.score !== null) byTier.set(s.tier.label, [...(byTier.get(s.tier.label) ?? []), s.score])
    }
    console.log("  tiers (count, score range):")
    for (const t of TIERS) {
      const v = byTier.get(t.label) ?? []
      console.log(`    ${t.label.padEnd(10)} ${String(v.length).padStart(3)}   ${v.length ? `${Math.min(...v)}–${Math.max(...v)}` : "—"}`)
    }

    const spread = (key: "topic" | "articleKind") => {
      const m = new Map<string, number>()
      for (const a of rated) if (a[key]) m.set(a[key]!, (m.get(a[key]!) ?? 0) + 1)
      return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([k, n]) => `${k} ${n}`).join(" · ")
    }
    console.log(`  topics: ${spread("topic")}`)
    console.log(`  kinds:  ${spread("articleKind")}`)
  }

  if (errors.length) {
    console.error(`\n✗ ${errors.length} rating problem(s):`)
    for (const e of errors) console.error(`  ${e}`)
    process.exit(1)
  }
  console.log("✓ ratings OK")
}

main()
