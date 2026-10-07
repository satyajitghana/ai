// Offline checker for math-reel specs. No browser, no rendering.
//
//   node brand-crew/skills/math-reels/check.mjs [data/math-reels/*.json] [--reviews=<dir of *.jsonl>]
//
// Holds every spec to the truth rules in SKILL.md:
//   - shape: required fields, enums, scene durations, 15-20 s in total;
//   - discipline and Lean status agree with the release catalogue
//     (components/articles/openai-math/catalogue-data.ts: d, l);
//   - every multi-digit or decimal number a viewer reads appears in one of the
//     spec's `sources` quotes (single digits are structure: n = 7, log_2), and
//     so does every non-integer marker position, unless the marker names the
//     formula it was computed from in `derived` ("log2 7", "1 - 10^-13");
//   - every quote whose ref starts with "article" is verbatim in
//     content/articles/openai-math.mdx; "catalogue" quotes are verbatim in the
//     catalogue; "review" quotes are verbatim in the family's review when
//     --reviews points at the review JSONL files (otherwise reported as unchecked).
// Glyph coverage and text-length limits are enforced by the engine itself
// (REEL.load), so `node render.mjs plan <spec>` is the second half of a check.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkVoice, DUR_PROOF } from './voice.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] }))
let files = args.filter(a => !a.startsWith('--'))
if (!files.length) { const d = join(ROOT, 'data', 'math-reels'); files = existsSync(d) ? readdirSync(d).filter(f => /^\d{3}\.json$/.test(f)).map(f => join(d, f)) : [] }

const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const article = norm(readFileSync(join(ROOT, 'content', 'articles', 'openai-math.mdx'), 'utf8'))
const catSrc = readFileSync(join(ROOT, 'components', 'articles', 'openai-math', 'catalogue-data.ts'), 'utf8')
const DISC = JSON.parse(catSrc.match(/export const DISCIPLINES = (\[.*?\]) as const/s)[1])
const FAM = JSON.parse(catSrc.match(/export const FAMILIES: Family\[\] = (\[[\s\S]*?\n\])/)[1].replace(/,\s*\]$/, "]"))
const byId = Object.fromEntries(FAM.map(f => [f.id, f]))
const catalogue = norm(catSrc)
const reviews = {}
if (opt.reviews) for (const f of readdirSync(opt.reviews).filter(f => f.endsWith('.jsonl'))) for (const line of readFileSync(join(opt.reviews, f), 'utf8').split('\n')) {
  if (!line.trim()) continue
  const r = JSON.parse(line); (reviews[r.id] ||= []).push(norm(Object.values(r).join(' \n ')))
}

const KINDS = ['proof', 'disproof', 'counterexample', 'improved-bound', 'partial', 'conditional']
const LEAN = ['main', 'part', 'none']
const DUR = { title: [2, 3, 2.6], object: [6, 9, 8], proof: [5, 6, 5.5], achievement: [3, 5, 4.4], verify: [2, 3, 2.6], end: [1.2, 2, 1.6] }
const PRIMS = ['numberline', 'graph', 'grid', 'plot', 'shape', 'venn', 'sequence', 'equation', 'tree']
// fields whose text a viewer reads (paths are matched on their last key)
const SHOWN = new Set(['short', 'title', 'subtitle', 'heading', 'text', 'label', 'note', 'tex', 'context', 'detail', 'ourCheck', 'caption', 'highlight', 'done', 'inLabel', 'outLabel', 'xlabel', 'ylabel', 'axisLabel', 'gap', 'plain', 'steps', 'labels', 'role', 'boxes', 'assume', 'smaller', 'impossible', 'result', 'unit', 'step', 'base', 'thresholdLabel', 'floorLabel', 'patchLabel', 'boxLabel', 'leftTitle', 'rightTitle', 'left', 'right'])

let bad = 0
for (const f of files) {
  const errs = [], warns = []
  let s
  try { s = JSON.parse(readFileSync(f, 'utf8')) } catch (e) { console.log(`${f}: not JSON: ${e.message}`); bad++; continue }
  const id = s.id
  if (!/^\d{3}$/.test(id || '')) errs.push('id must be a 3-digit family number')
  if (basename(f) !== `${id}.json`) errs.push(`file must be named ${id}.json`)
  const fam = byId[id]
  if (!fam) errs.push(`family ${id} is not in the catalogue`)
  if (fam && DISC[fam.d] !== s.discipline) errs.push(`discipline "${s.discipline}" but the catalogue says "${DISC[fam.d]}"`)
  if (!KINDS.includes(s.kind)) errs.push(`kind must be one of ${KINDS.join(', ')}`)
  for (const k of ['title', 'object', 'achievement', 'verify']) if (!s[k]) errs.push(`missing ${k}`)
  // a proof scene or a voice allows 21 s; the scene defaults shrink with a proof
  let total = 0
  const P = !!s.proof, longer = P || !!s.voice
  for (const [k, [a, b, d]] of Object.entries(DUR)) { if (k === 'proof' && !P) continue; const v = (s[k] || {}).dur ?? (P ? DUR_PROOF[k] : d); if (v < a || v > b) errs.push(`${k}.dur ${v} outside ${a}-${b}`); total += v }
  if (total < 15 || total > (longer ? 21.001 : 20.001)) errs.push(`total ${total.toFixed(2)} s outside 15-${longer ? 21 : 20} s${s.voice ? ' (before the voice lengthens any scene; render.mjs plan reports the fitted total)' : ''}`)
  { const v = checkVoice(s); errs.push(...v.errs); warns.push(...v.warns) }
  if (s.plain && !/[a-z]/.test(s.plain)) errs.push('plain must be a sentence')
  const panels = s.object && (s.object.panels || (s.object.primitive ? [s.object] : []))
  if (!panels || !panels.length) errs.push('object needs a primitive or panels')
  else for (const p of panels) if (!PRIMS.includes(p.primitive)) errs.push(`unknown primitive ${p.primitive}`)
  const ac = s.achievement || {}
  if (ac.form === 'bound') { if (!ac.before?.tex || !ac.after?.tex) errs.push('bound needs before.tex and after.tex') }
  else if (ac.form === 'status') { if (!ac.statement?.length) errs.push('status needs statement[]') }
  else errs.push('achievement.form must be bound | status')
  if (!LEAN.includes(s.verify?.lean)) errs.push('verify.lean must be main | part | none')
  if (fam && s.verify && LEAN[fam.l] !== s.verify.lean) errs.push(`verify.lean "${s.verify.lean}" but the catalogue says "${LEAN[fam.l]}"`)
  if (s.verify?.review && !/claim/i.test(s.verify.review)) errs.push('verify.review must still say it is a claim')
  // sources
  const src = s.sources || []
  if (!src.length) errs.push('sources[] is empty: every number needs a quote behind it')
  for (const q of src) {
    const quote = norm(q.quote || ''), ref = String(q.ref || '').toLowerCase()
    if (!quote) { errs.push(`source "${q.ref}" has no quote`); continue }
    if (ref.startsWith('article')) { if (!article.includes(quote)) errs.push(`article quote not found verbatim: "${q.quote}"`) }
    else if (ref.startsWith('catalogue')) { if (!catalogue.includes(quote)) errs.push(`catalogue quote not found verbatim: "${q.quote}"`) }
    else if (ref.startsWith('review')) {
      if (!opt.reviews) warns.push(`review quote unchecked (pass --reviews): "${q.quote.slice(0, 50)}"`)
      else if (!(reviews[id] || []).some(r => r.includes(quote))) errs.push(`review quote not found in review ${id}: "${q.quote}"`)
    } else errs.push(`source ref must start with article | catalogue | review: "${q.ref}"`)
  }
  // numbers a viewer reads must be in a quote
  const quoted = norm(src.map(q => q.quote).join(' \n ')).replace(/(\d),(\d{3})/g, '$1$2')
  const shown = []
  const walk = (v, key) => {
    if (typeof v === 'string') { if (SHOWN.has(key)) shown.push(v) }
    else if (Array.isArray(v)) v.forEach(x => walk(x, key === 'statement' ? 'tex' : key))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'sources' && k !== '$schema') walk(x, k)
  }
  walk(s, '')
  for (const m of s.object?.panels || [s.object]) for (const mk of [...(m?.markers || []), ...(m?.ranges || []), ...(m?.slide ? [m.slide] : [])]) if (!mk.derived) for (const v of [mk.v, mk.from, mk.to].filter(x => x != null && !Number.isInteger(x))) shown.push(String(v))
  for (const t of shown) {
    const plain = t.replace(/\\[a-zA-Z]+/g, ' ').replace(/(\d),(\d{3})/g, '$1$2')
    for (const n of plain.match(/\d+(?:\.\d+)?/g) || []) {
      if (n.length === 1) continue
      if (!new RegExp(`(^|[^\\d.])${n.replace('.', '\\.')}`).test(quoted)) errs.push(`"${n}" (in "${t}") is in no source quote`)
    }
  }
  if (errs.length) bad++
  console.log(`${errs.length ? 'FAIL' : 'ok  '} ${basename(f)}${errs.map(e => '\n  - ' + e).join('')}${warns.length && opt.verbose ? warns.map(w => '\n  ~ ' + w).join('') : warns.length ? `\n  ~ ${warns.length} review quotes unchecked (no --reviews)` : ''}`)
}
console.log(`${files.length} specs, ${bad} failing`)
process.exit(bad ? 1 : 0)
