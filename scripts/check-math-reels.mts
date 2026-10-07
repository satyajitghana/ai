// `pnpm validate:reels`: every math-reel spec, and every rendered reel against
// its spec.
//
//   1. check.mjs over data/math-reels/*.json: shape, scene timing, the
//      catalogue's discipline and Lean status, every shown number in a quote,
//      article and catalogue quotes verbatim. Review quotes are checked against
//      the /math wall's committed snapshot (data/math-wall/notes.json) when this
//      checkout has it; it holds only some review fields, so it confirms quotes
//      and never fails one it lacks. Without it the checks are structural.
//   2. Pronunciation (pronounce.mjs): every word of every voice line is plain
//      English the voice knows or is in pronounce.json, and the table is valid.
//      A word the voice would have to guess fails here, on any machine, rather
//      than at render time on the farm, where audio.py refuses guesses.
//   3. Freshness (hash.mjs): data/.generated/math-reels.json, written by
//      render.mjs, records each reel's hash of spec + engine + the
//      pronunciations its voice uses. A reel whose hash moved is STALE and fails;
//      a manifest entry without its files, or without a spec, fails. A spec with
//      no reel yet is MISSING: a warning, so validate stays green until the
//      farm has rendered them all.
//
// Not here (it needs a browser): `node brand-crew/skills/math-reels/render.mjs
// plan data/math-reels/*.json`, which sets every formula and fits every voice.
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { MANIFEST, OUT, ROOT, SKILL_DIR, loadSpec, readManifest, reelSha, specIds } from "../brand-crew/skills/math-reels/hash.mjs"
import { checkTable, loadTable, uncovered } from "../brand-crew/skills/math-reels/pronounce.mjs"

let failed = false
const fail = (msg: string) => { failed = true; console.log(`FAIL ${msg}`) }

// 1. the specs
const notes = join(ROOT, "data", "math-wall", "notes.json")
const ck = spawnSync(process.execPath, [join(SKILL_DIR, "check.mjs"), "--quiet", ...(existsSync(notes) ? [`--notes=${notes}`] : [])], { encoding: "utf8" })
process.stdout.write(ck.stdout)
if (ck.status !== 0) fail(`check.mjs: ${ck.stderr || "specs failing (above)"}`)

// 2. pronunciation
const ids = specIds()
const T = loadTable()
for (const e of checkTable(T)) fail(`pronounce.json: ${e}`)
const lines: Record<string, string[]> = {}
for (const id of ids) { const s = loadSpec(id); if (s.voice) lines[id] = s.voice.map((l: { text: string }) => l.text) }
const miss = uncovered(lines, T)
for (const m of miss) fail(`voice says "${m.word}" (${m.ids.join(", ")}), which is neither plain English the voice knows (plain-words.txt) nor in pronounce.json`)
if (!miss.length) console.log(`pronunciation: every word of ${Object.values(lines).reduce((a, l) => a + l.length, 0)} voice lines covered`)

// 3. freshness
const man = readManifest()
const reels: Record<string, { sha: string; hasVoice?: boolean }> = man.reels || {}
const missing: string[] = []
let fresh = 0
for (const id of ids) {
  const m = reels[id]
  if (!m) { missing.push(id); continue }
  const want = reelSha(loadSpec(id))
  if (m.sha !== want) { fail(`${id}: stale reel (manifest ${m.sha}, spec+engine+pronunciation ${want}): node brand-crew/skills/math-reels/render.mjs --stale --out=public/films/math on the farm`); continue }
  const files = [`${id}.mp4`, `${id}-poster.webp`, ...(m.hasVoice ? [`${id}.vtt`] : [])]
  const gone = files.filter(f => !existsSync(join(OUT, f)))
  if (gone.length) { fail(`${id}: the manifest lists a reel, but public/films/math has no ${gone.join(", ")}`); continue }
  fresh++
}
for (const id of Object.keys(reels)) if (!ids.includes(id)) fail(`${id}: ${MANIFEST.slice(ROOT.length + 1)} lists a reel with no spec in data/math-reels`)
if (missing.length) console.log(`WARN ${missing.length} of ${ids.length} specs have no rendered reel yet (${missing.length > 12 ? missing.slice(0, 12).join(", ") + ", ..." : missing.join(", ")}); render on the farm: node brand-crew/skills/math-reels/render.mjs --stale --out=public/films/math`)
console.log(`math reels: ${ids.length} specs, ${fresh} fresh reels, ${missing.length} not rendered${failed ? "; FAILED" : ""}`)
if (failed) process.exit(1)
// keep the manifest's own note honest about who writes it
if (existsSync(MANIFEST) && !/render\.mjs/.test(readFileSync(MANIFEST, "utf8").slice(0, 200))) { console.log(`FAIL ${MANIFEST}: not written by render.mjs`); process.exit(1) }
