// What a rendered film depends on, as one hash. The build writes it into the
// manifest; `pnpm validate:films` recomputes it and fails when they differ,
// so a storyboard edit, an article re-date or an engine change can't ship
// with yesterday's video still attached.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(SKILL_DIR, '..', '..', '..')

// Everything that shapes a film: the painter, the styles, the hosts and the
// scenes, the vendored p5.brush that paints the watercolour style, the page
// they run in, the renderer's encode and GPU settings, the sound (voice,
// effects, scores, mix) and the fonts. Not SKILL.md, not this file.
function engineFiles() {
  const out = ['studio.html', 'render.mjs', 'audio.py']
  for (const d of ['engine', 'engine/vendor', 'fonts']) for (const f of readdirSync(join(SKILL_DIR, d)).sort()) if (/\.(js|woff2)$/.test(f)) out.push(`${d}/${f}`)
  return out.sort()
}

let cached = null
export function engineSha() {
  if (cached) return cached
  const h = createHash('sha256')
  for (const f of engineFiles()) { h.update(f + '\0'); h.update(readFileSync(join(SKILL_DIR, f))); h.update('\0') }
  return (cached = h.digest('hex'))
}

export function articleDate(slug) {
  const src = readFileSync(join(ROOT, 'content', 'articles', `${slug}.mdx`), 'utf8')
  const m = src.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m)
  if (!m) throw new Error(`${slug}: no date in frontmatter`)
  return m[1]
}

// Canonical JSON: key order doesn't matter, whitespace doesn't matter.
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  return JSON.stringify(v)
}

// The pronunciation table is data, not engine: a film depends only on the
// entries its own narration (or its host's name, said in the sign-off) uses,
// so a name added for one film does not make every other film stale.
let LEX = null
function lexiconFor(sb) {
  if (!LEX) { const all = JSON.parse(readFileSync(join(SKILL_DIR, 'pronounce.json'), 'utf8')); LEX = Object.entries(all).filter(([k]) => !k.startsWith('_')) }
  const said = JSON.stringify(sb)
  const esc = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return LEX.filter(([k]) => new RegExp(`(?<![\\w.])${esc(k)}(?![\\w])`).test(said)).sort(([a], [b]) => (a < b ? -1 : 1))
}

export function filmSha(sb, date) {
  return createHash('sha256').update(engineSha() + '\n' + date + '\n' + canon(sb) + '\n' + JSON.stringify(lexiconFor(sb))).digest('hex').slice(0, 16)
}

export const rel = p => relative(ROOT, p)
