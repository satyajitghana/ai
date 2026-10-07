// What a rendered math reel depends on, as one hash. render.mjs writes it
// into data/.generated/math-reels.json beside the reel; `pnpm validate:reels`
// recomputes it and fails when they differ, so a spec edit, an engine change
// or a pronunciation fix can't ship with yesterday's video still attached.
// (The pattern of explainer-films/hash.mjs; nothing is imported from it.)
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { loadTable, words } from './pronounce.mjs'

export const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(SKILL_DIR, '..', '..', '..')
export const SPECS = join(ROOT, 'data', 'math-reels')
export const OUT = join(ROOT, 'public', 'films', 'math')
export const MANIFEST = join(ROOT, 'data', '.generated', 'math-reels.json')

// Everything that shapes a reel's pixels and sound: the page, the engine, the
// renderer (encode settings), the voice timing, the sound, the fonts, and the
// KaTeX that sets every formula. Not SKILL.md, check.mjs, the tests or this file.
export function engineFiles() {
  const out = ['reel.html', 'engine/reel.js', 'render.mjs', 'audio.py', 'voice.mjs']
  for (const f of readdirSync(join(SKILL_DIR, 'fonts')).sort()) if (f.endsWith('.woff2')) out.push(`fonts/${f}`)
  return out
}
function katexVersion() {
  try { return createRequire(join(ROOT, 'package.json'))('katex/package.json').version } catch { return 'none' }
}
let ENGINE = null
export function engineSha() {
  if (ENGINE) return ENGINE
  const h = createHash('sha256')
  for (const f of engineFiles()) { h.update(f + '\0'); h.update(readFileSync(join(SKILL_DIR, f))); h.update('\0') }
  h.update('katex ' + katexVersion())
  return (ENGINE = h.digest('hex'))
}

// Canonical JSON: key order and whitespace don't matter.
export function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  return JSON.stringify(v)
}

// The pronunciation table is data: a reel depends only on the entries its own
// voice lines use (the `say` rewrites that fire, the phonemes of the words then
// said), so a name added for one reel does not make the other 371 stale.
let T = null
export function lexiconFor(spec) {
  if (!spec.voice) return []
  T ||= loadTable()
  const text = spec.voice.map(l => l.text).join('\n'), used = []
  const W = '[\\p{L}\\p{N}_]', esc = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const [k, v] of Object.entries(T.say)) if (new RegExp(`(?<!${W})${esc(k)}(?!${W})`, 'u').test(text)) used.push(['say', k, v])
  const said = new Set(spec.voice.flatMap(l => words(l.text, T.say)))
  for (const w of [...said].sort()) if (w in T.phon) used.push(['ph', w, T.phon[w]])
  return used.sort((a, b) => (a.join('\0') < b.join('\0') ? -1 : 1))
}

export function reelSha(spec) {
  return createHash('sha256').update(engineSha() + '\n' + canon(spec) + '\n' + JSON.stringify(lexiconFor(spec))).digest('hex').slice(0, 16)
}

export const specIds = () => existsSync(SPECS) ? readdirSync(SPECS).filter(f => /^\d{3}\.json$/.test(f)).map(f => f.slice(0, 3)).sort() : []
export const loadSpec = id => JSON.parse(readFileSync(join(SPECS, `${id}.json`), 'utf8'))
export const readManifest = () => existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { note: '', reels: {} }
