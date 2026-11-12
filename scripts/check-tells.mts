// `pnpm check:tells [slug…] [--all] [--report]`: score articles against the
// "Sound like a person, not a pipeline" rules in brand-crew/brand/voice.md.
//
// The corpus was measured before the rules existed (14k em dashes, 3k inline
// "(reported)" tags, the same closing headings in 150 articles), so the limits
// bind only articles dated on or after CUTOFF; older ones are reported with
// --all or --report, never failed. Pass slugs to check just those.
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const CUTOFF = "2026-11-12"
const DIR = join(process.cwd(), "content/articles")

const LIMITS = { emDash: 4, crutch: 2, evidenceTags: 3, roleHeadings: 0 }
// em dashes scale with length: about one per thousand words, never fewer than LIMITS.emDash
const dashLimit = (words: number) => Math.max(LIMITS.emDash, Math.round(words / 1000))

const CRUTCHES: [string, RegExp][] = [
  ["load-bearing", /\bload-bearing\b/gi],
  ["quietly", /\bquietly\b/gi],
  ["the interesting part", /\bthe interesting (?:part|bit|thing)\b/gi],
  ["the honest answer", /\bthe honest (?:answer|version|reading|summary)\b/gi],
  ["worth noting", /\bworth (?:noting|saying|stating|being clear)\b/gi],
  ["the catch", /\bthe catch\b/gi],
  ["the short version", /\bthe short version\b/gi],
  ["receipts", /\breceipts\b/gi],
  ["here's where/what", /\bhere[’']s (?:where|what|why|how|the thing)\b/gi],
  ["it turns out", /\bit turns out\b/gi],
  ["notably", /\bnotably\b/gi],
  ["in other words", /\bin other words\b/gi],
  ["isn't just X, it's Y", /\b(?:is|was|are)n[’']?t (?:just|only|simply|merely) [^.;\n]{1,40}[,;—–] (?:it[’']?s|it is|they[’']?re)\b/gi],
  ["two/three things", /\b(?:two|three|four) things\b/gi],
  ["delve", /\bdelve\b/gi],
]

// headings named for their role in a template rather than for what they say
const ROLE_HEADINGS = [
  /^the take$/, /^how i checked$/, /^the ledger$/, /^what holds$/, /^where it sits$/,
  /^what i(?: would|'d|’d)? (?:take|make) (?:from|of) it$/, /^what to take from it$/,
  /^what i ran(?: and what i did not)?$/, /^what i did not (?:run|do)$/, /^the numbers$/,
]

type Score = { slug: string; date: string; words: number; emDash: number; crutch: number; crutchHits: string[]; evidenceTags: number; roleHeadings: string[] }

function prose(src: string): { date: string; body: string } {
  const [, fm = "", ...rest] = src.split(/^---\s*$/m)
  const date = fm.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1] ?? "0000-00-00"
  const body = rest.join("---")
    .replace(/^```[\s\S]*?^```/gm, "")
    .replace(/^import .*$/gm, "")
    .replace(/`[^`\n]*`/g, "")
  return { date, body }
}

function score(slug: string): Score {
  const { date, body } = prose(readFileSync(join(DIR, `${slug}.mdx`), "utf8"))
  const crutchHits: string[] = []
  for (const [name, re] of CRUTCHES) for (const _ of body.matchAll(re)) crutchHits.push(name)
  const heads = [...body.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim().toLowerCase().replace(/[.:]$/, ""))
  return {
    slug, date,
    words: body.split(/\s+/).length,
    emDash: (body.match(/—/g) ?? []).length,
    crutch: crutchHits.length, crutchHits,
    evidenceTags: (body.match(/\((?:measured|reported|reasoned)\b[^)]{0,40}\)/gi) ?? []).length,
    roleHeadings: heads.filter((h) => ROLE_HEADINGS.some((r) => r.test(h))),
  }
}

const args = process.argv.slice(2)
const all = args.includes("--all") || args.includes("--report")
const named = args.filter((a) => !a.startsWith("--"))
const slugs = named.length ? named : readdirSync(DIR).filter((f) => f.endsWith(".mdx")).map((f) => f.slice(0, -4))

const scores = slugs.map(score)
const bound = scores.filter((s) => s.date >= CUTOFF)
const failures = bound.filter((s) =>
  s.emDash > dashLimit(s.words) || s.crutch > LIMITS.crutch || s.evidenceTags > LIMITS.evidenceTags || s.roleHeadings.length > LIMITS.roleHeadings)

const line = (s: Score) =>
  `  ${s.slug} (${s.date}, ${s.words} words): em dashes ${s.emDash}/${dashLimit(s.words)}, crutches ${s.crutch}/${LIMITS.crutch}` +
  `${s.crutchHits.length ? ` [${[...new Set(s.crutchHits)].join(", ")}]` : ""}, evidence tags ${s.evidenceTags}/${LIMITS.evidenceTags}` +
  `${s.roleHeadings.length ? `, template headings: ${s.roleHeadings.map((h) => `"${h}"`).join(", ")}` : ""}`

if (all) {
  const sum = (k: "emDash" | "crutch" | "evidenceTags") => scores.reduce((a, s) => a + s[k], 0)
  const words = scores.reduce((a, s) => a + s.words, 0)
  console.log(`check:tells: ${scores.length} article(s), ${words} words; per 1k words: em dashes ${(sum("emDash") * 1000 / words).toFixed(2)}, crutches ${(sum("crutch") * 1000 / words).toFixed(2)}, evidence tags ${(sum("evidenceTags") * 1000 / words).toFixed(2)}`)
  for (const s of [...scores].sort((a, b) => b.emDash + b.crutch * 5 - a.emDash - a.crutch * 5).slice(0, 15)) console.log(line(s))
}
console.log(`check:tells: ${bound.length} article(s) dated ${CUTOFF} or later checked, ${failures.length} over the limits`)
for (const s of failures) console.log(line(s))
if (failures.length) {
  console.log("\nSee brand-crew/brand/voice.md, \"Sound like a person, not a pipeline\". Rewrite the prose; don't just swap a dash for a comma.")
  process.exit(1)
}
