// Offline: every word in every voice line of every spec is plain English the
// voice knows (plain-words.txt) or is covered by pronounce.json.
//   node brand-crew/skills/math-reels/pronounce.test.mjs [data/math-reels/*.json]
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { words, uncovered, checkTable, loadTable } from './pronounce.mjs'

const T = loadTable()
// the splitter mirrors audio.py speakable()
assert.deepEqual(words("Kazhdan-Lusztig and p-adic — Connes' K3, Foulkes' case; Euler's.", T.say), ['Kazhdan', 'Lusztig', 'and', 'p', 'adic', 'Connes', 'K', 'three', 'Foulkes', 'case', 'Euler'])
assert.deepEqual(words('If a b is one, is b a one?', T.say), ['If', 'Ay', 'b', 'is', 'one', 'is', 'b', 'Ay', 'one'])
assert.deepEqual(uncovered({ x: ['Zorblax proved the cohomology claim.'] }, T), [{ word: 'Zorblax', ids: ['x'] }])
assert.deepEqual(checkTable(T), [])

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let files = process.argv.slice(2)
if (!files.length) { const d = join(ROOT, 'data', 'math-reels'); files = readdirSync(d).filter(f => /^\d{3}\.json$/.test(f)).map(f => join(d, f)) }
const lines = {}
for (const f of files) { const s = JSON.parse(readFileSync(f, 'utf8')); if (s.voice) lines[s.id] = s.voice.map(l => l.text) }
const miss = uncovered(lines, T)
const n = Object.values(lines).reduce((a, l) => a + l.length, 0)
if (miss.length) {
  console.log(`${miss.length} words the voice would guess (add them to pronounce.json, or, if misaki knows them, run \`python audio.py lexicon --in lines.json\`):`)
  for (const m of miss) console.log(`  ${m.word}  (${m.ids.join(', ')})`)
  process.exit(1)
}
console.log(`pronunciation: ${n} voice lines in ${Object.keys(lines).length} specs, every word covered (${Object.keys(T.raw.phonemes).length} phonemes, ${Object.keys(T.say).length} say rewrites, ${T.plain.size} plain words)`)
