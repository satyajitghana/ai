// What a rendered film depends on, as one hash. The build writes it into the
// manifest; `pnpm validate:films` recomputes it and fails when they differ,
// so a storyboard edit, an article re-date or an engine change can't ship
// with yesterday's video still attached.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(SKILL_DIR, '..', '..', '..')

// Everything that shapes a film: the painter, the styles, the hosts and the
// scenes, the p5 tier (engine/p5tier.js), the vendored p5.js and both builds
// of p5.brush, the page
// they run in, the renderer's encode and GPU settings, the sound (voice,
// effects, scores, mix) and the fonts. Not SKILL.md, not this file.
function engineFiles() {
  const out = ['studio.html', 'render.mjs', 'audio.py']
  for (const d of ['engine', 'engine/vendor', 'fonts']) for (const f of readdirSync(join(SKILL_DIR, d)).sort()) if (/\.(js|woff2)$/.test(f)) out.push(`${d}/${f}`)
  return out.sort()
}

// styles.js holds all eighteen styles. A film depends on the code they share
// and on its own style, not on the other seventeen, so tuning one medium does
// not make every film stale. Each style is a block that opens with
// `  const <name> = {` or `  const <name> = media({` and closes at the next
// line that is `  }` or `  })`; the style names come from the file's own
// `return { ... }`.
export function stylesSource(style) {
  const src = readFileSync(join(SKILL_DIR, 'engine', 'styles.js'), 'utf8')
  const names = new Set((src.match(/^  return \{ ([\w, ]+) \}$/m)?.[1] || '').split(/,\s*/))
  if (!names.has(style)) return src
  const keep = []
  let inside = null
  for (const line of src.split('\n')) {
    const open = line.match(/^  const (\w+) = (?:media\()?\{$/)
    if (!inside && open && names.has(open[1])) inside = open[1]
    if (!inside || inside === style) keep.push(line)
    if (inside && /^  \}\)?$/.test(line)) inside = null
  }
  return keep.join('\n')
}

const cached = new Map()
export function engineSha(style) {
  if (cached.has(style)) return cached.get(style)
  const h = createHash('sha256')
  for (const f of engineFiles()) {
    h.update(f + '\0')
    h.update(f === 'engine/styles.js' ? stylesSource(style) : readFileSync(join(SKILL_DIR, f)))
    h.update('\0')
  }
  // the style's own p5-tier code, when it has any: one file per style, so
  // porting one medium to the p5 tier does not make the other films stale
  const own = `engine/p5/${style}.js`
  if (existsSync(join(SKILL_DIR, own))) { h.update(own + '\0'); h.update(readFileSync(join(SKILL_DIR, own))); h.update('\0') }
  const sha = h.digest('hex')
  cached.set(style, sha)
  return sha
}

// Films live in namespaces, one per content kind that gets them. An article's
// film is keyed by its bare slug, as it always was: data/films/<slug>.json,
// told against content/articles/<slug>.mdx. Every other kind is keyed
// `<kind>/<slug>`: data/films/<kind>/<slug>.json against
// content/<kind>/<slug>.mdx. The key is also the manifest key and the path
// under public/films and public/thumbs, and a storyboard's `slug` field. An
// article slug never contains a slash, so the two can't collide.
export const NAMESPACES = ['architectures']

export function splitKey(key) {
  const i = key.indexOf('/')
  if (i < 0) return { ns: '', slug: key }
  const ns = key.slice(0, i), slug = key.slice(i + 1)
  if (!NAMESPACES.includes(ns) || !slug || slug.includes('/')) throw new Error(`${key}: not a film key (a slug, or one of ${NAMESPACES.map(n => n + '/<slug>').join(', ')})`)
  return { ns, slug }
}

// the MDX a film is held to: every digit, quote and label it shows is checked against it
export function sourceOf(key) {
  const { ns, slug } = splitKey(key)
  return join(ROOT, 'content', ns || 'articles', `${slug}.mdx`)
}

// every storyboard's key, articles' and each namespace's, sorted
export function storyboardKeys() {
  const dir = join(ROOT, 'data', 'films'), json = d => readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  const keys = json(dir)
  for (const ns of NAMESPACES) if (existsSync(join(dir, ns))) keys.push(...json(join(dir, ns)).map(s => `${ns}/${s}`))
  return keys.sort()
}

// The date a film depends on. Named for articles, which were the only kind;
// it takes any key.
export function articleDate(key) {
  const src = readFileSync(sourceOf(key), 'utf8')
  const m = src.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m)
  if (!m) throw new Error(`${key}: no date in frontmatter`)
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

// The story format (a storyboard with "format": "story") renders through its
// own engine in story/: a fork of explainer.js, its new scenes, its page and
// its renderer, on top of the same painter, styles, host, fonts and sound. Its
// hash is the legacy engine's for the style plus every file in story/. A
// legacy storyboard never reaches this, so its hash is exactly what it was
// before the story format existed; and since engine/explainer.js and
// render.mjs are frozen, changing the story engine stales only story films.
export const isStory = sb => !!sb && sb.format === 'story'
export function storyFiles() {
  return readdirSync(join(SKILL_DIR, 'story')).filter(f => /\.(js|mjs|html)$/.test(f)).sort().map(f => `story/${f}`)
}
const storyCached = new Map()
export function storyEngineSha(style) {
  if (storyCached.has(style)) return storyCached.get(style)
  const h = createHash('sha256')
  h.update('story\0' + engineSha(style) + '\0')
  for (const f of storyFiles()) { h.update(f + '\0'); h.update(readFileSync(join(SKILL_DIR, f))); h.update('\0') }
  const sha = h.digest('hex')
  storyCached.set(style, sha)
  return sha
}

// Story v2 (a storyboard with "format": "story2"; SKILL.md, "Story v2") is
// the same move again: story/ is frozen for the films rendered through it, so
// the engine that adds footage scenes, staging, pacing and new motion lives in
// story2/, a fork of story/. A story2 film hashes the legacy engine for its
// style plus every file in story2/; `isStory` stays exactly "format": "story",
// so no legacy or story storyboard ever reaches this and their hashes are
// what they were.
export const isStory2 = sb => !!sb && sb.format === 'story2'
export function story2Files() {
  return readdirSync(join(SKILL_DIR, 'story2')).filter(f => /\.(js|mjs|html)$/.test(f)).sort().map(f => `story2/${f}`)
}
const story2Cached = new Map()
export function story2EngineSha(style) {
  if (story2Cached.has(style)) return story2Cached.get(style)
  const h = createHash('sha256')
  h.update('story2\0' + engineSha(style) + '\0')
  for (const f of story2Files()) { h.update(f + '\0'); h.update(readFileSync(join(SKILL_DIR, f))); h.update('\0') }
  const sha = h.digest('hex')
  story2Cached.set(style, sha)
  return sha
}
// the format a storyboard renders through: 'story2', 'story' or '' (legacy)
export const formatOf = sb => (isStory2(sb) ? 'story2' : isStory(sb) ? 'story' : '')

// A story film's bespoke scenes are drawn by its own modules,
// custom/<key>/<module>.js. They are part of that film's engine and of no
// other's: a film with none hashes exactly as before, and editing one film's
// module stales only that film.
export function customModules(sb) {
  const names = [...new Set((sb.scenes || []).filter(s => s && s.type === 'custom' && typeof s.module === 'string').map(s => s.module))].sort()
  return names.map(n => ({ name: n, file: join(SKILL_DIR, 'custom', sb.slug, `${n}.js`) }))
}
function filmEngine(sb) {
  if (!isStory(sb) && !isStory2(sb)) return engineSha(sb.style)
  const base = isStory2(sb) ? story2EngineSha(sb.style) : storyEngineSha(sb.style)
  const mods = customModules(sb)
  if (!mods.length) return base
  const h = createHash('sha256').update('bespoke\0' + base + '\0')
  for (const m of mods) { h.update(m.name + '\0'); h.update(existsSync(m.file) ? readFileSync(m.file) : 'missing'); h.update('\0') }
  return h.digest('hex')
}

export function filmSha(sb, date) {
  const engine = filmEngine(sb)
  return createHash('sha256').update(engine + '\n' + date + '\n' + canon(sb) + '\n' + JSON.stringify(lexiconFor(sb))).digest('hex').slice(0, 16)
}

// what metrics.json was measured from: the type code, the fonts, and the
// lines of styles.js that choose a style's fonts or space its letters (not
// its palettes or media, which change far more often and move no glyph).
// The checker warns when the table is older than these.
export function fontsSha() {
  const h = createHash('sha256')
  const fonts = readdirSync(join(SKILL_DIR, 'fonts')).filter(f => f.endsWith('.woff2')).sort().map(f => `fonts/${f}`)
  for (const f of ['engine/type.js', ...fonts]) { h.update(f + '\0'); h.update(readFileSync(join(SKILL_DIR, f))) }
  h.update(readFileSync(join(SKILL_DIR, 'engine/styles.js'), 'utf8').split('\n').filter(l => /\bfont:\s*\{|\bls:|\bminPx\b/.test(l)).join('\n'))
  return h.digest('hex').slice(0, 16)
}

export const rel = p => relative(ROOT, p)
