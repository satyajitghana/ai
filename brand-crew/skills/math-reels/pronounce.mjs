// Offline pronunciation coverage for math-reel narration: no misaki, no voice.
//
// Every word the narrator says must be one the voice already knows: either in
// pronounce.json (a `say` rewrite or misaki `phonemes`), or in plain-words.txt
// (plain English that misaki's lexicon says, written by `audio.py lexicon` on a
// machine with misaki), or a single letter. A word that is none of these would
// reach Kokoro as a guess, and `audio.py tts` refuses guesses at render time,
// so the farm would fail the reel; this check finds it on any machine first.
//
// The text is split the way audio.py speakable() prepares it: `say` rewrites
// (longest key first, whole words), dashes, the brackets stripped, a hyphen
// between letters as a word break, a possessive ('s or a bare ') looked up by
// its base. Keep words() in step with audio.py plain_text() / TOKEN.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// the symbols misaki's US lexicon uses (Kokoro's American voices)
export const MISAKI_US = new Set([...'ˈˌAIOWYᵊTbdfhijklmnpstuvwzæðŋɑɔəɛɜɡɪɹʃʊʌʒʤʧθ'])

export function loadTable(dir = HERE) {
  const P = JSON.parse(readFileSync(join(dir, 'pronounce.json'), 'utf8'))
  const say = P.say || {}, phon = { ...(P.phonemes || {}) }
  // a lowercase entry also covers the word capitalised at the start of a sentence (as audio.py)
  for (const [k, v] of Object.entries(P.phonemes || {})) { const c = k[0].toUpperCase() + k.slice(1); if (k[0] !== c[0] && !(c in phon)) phon[c] = v }
  const plain = new Set(readFileSync(join(dir, 'plain-words.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')))
  return { say, phon, plain, raw: P }
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const W = '[\\p{L}\\p{N}_]'     // Python's Unicode \w
export function words(text, say) {
  let s = String(text).replace('ai.thesatyajit.com', 'ai dot the satyajit dot com')
  s = s.replace(/—/g, ', ').replace(/–/g, ' to ').replace(/&/g, ' and ').replace(/%/g, ' percent')
  const keys = Object.keys(say).sort((a, b) => b.length - a.length)
  if (keys.length) s = s.replace(new RegExp(`(?<!${W})(${keys.map(esc).join('|')})(?!${W})`, 'gu'), m => say[m])
  s = s.replace(/[[\]{}()<>`_*|\\$^]/g, ' ').replace(/(?<=[^\P{L}])-(?=[^\P{L}])/gu, ' ')
  return s.match(/\p{L}[\p{L}'’]*/gu)?.map(w => w.replace(/(['’]s|['’])$/u, '')).filter(Boolean) || []
}

// Words in these lines the voice would have to guess: [{ word, ids: [...] }].
export function uncovered(linesById, T = loadTable()) {
  const out = new Map()
  for (const [id, lines] of Object.entries(linesById)) for (const l of lines) for (const w of words(l, T.say)) {
    if (w.length === 1 || w in T.phon || T.plain.has(w.toLowerCase())) continue
    if (!out.has(w)) out.set(w, new Set()); out.get(w).add(id)
  }
  return [...out].map(([word, ids]) => ({ word, ids: [...ids].sort() })).sort((a, b) => a.word.localeCompare(b.word))
}

// The table itself: phonemes in misaki's US symbols, single-word keys, no say
// rewrite that produces an unknown word.
export function checkTable(T = loadTable()) {
  const errs = []
  for (const [k, v] of Object.entries(T.raw.phonemes || {})) {
    if (!/^[\p{L}]+$/u.test(k)) errs.push(`phonemes key "${k}" must be one word (a hyphen is a word break: give each part)`)
    const bad = [...new Set([...v].filter(c => !MISAKI_US.has(c)))]
    if (bad.length) errs.push(`phonemes "${k}": /${v}/ uses ${bad.map(c => `"${c}"`).join(', ')}, not in misaki's US set`)
    if (!/[ˈˌ]/.test(v) && !['der', 'von'].includes(k)) errs.push(`phonemes "${k}": /${v}/ has no stress mark`)
  }
  for (const [k, v] of Object.entries(T.say)) for (const w of words(v, {})) if (w.length > 1 && !(w in T.phon) && !T.plain.has(w.toLowerCase())) errs.push(`say "${k}" -> "${v}": "${w}" is not a known word`)
  return errs
}
