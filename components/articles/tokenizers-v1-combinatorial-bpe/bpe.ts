// A small, exact character-level BPE, in two flavours, for the merge stepper.
//
// standard       GPT-2-style pre-tokens (" the", "The", …) go to BPE as they are, so the
//                leading space and the capital letters are part of what gets merged.
// combinatorial  a letter word loses its leading space and its case before BPE. The space
//                and the case come back as modifiers (one "space" row, and "Aa" / "AA"
//                rows) whose embeddings a model would add to the core's. This is the space +
//                case half of Combinatorial BPE; its learned punctuation affixes are left out.
//
// Both tables are trained here, at import, on the same built-in paragraph and the same
// number of table rows, by the textbook algorithm: count adjacent pairs, weighted by pre-token
// frequency; merge the most frequent (ties broken by the pair's string, so the result is the
// same on every engine); repeat. Integer arithmetic and string comparison only.

const PRETOKEN = new RegExp(
  "'s|'t|'re|'ve|'m|'ll|'d| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+",
  "gu",
)
const LETTER_WORD = new RegExp("^( ?)(\\p{L}+)$", "u")

export const CORPUS = [
  "The tokenizer reads the text, and the model reads the tokens.",
  "The model never sees the text. THE MODEL SEES THE IDS.",
  "Then the tokenizer hands the model the next text, and the next.",
  "The token, the Token and the TOKEN are the same word to a reader.",
  "To the table they are three rows, and the rows are trained apart.",
  "There is the theory; then there is the tokenizer.",
].join(" ")

export type Mode = "standard" | "combinatorial"
export type Case = "" | "Aa" | "AA"

export type Merge = { a: string; b: string; rank: number }

export type Table = {
  mode: Mode
  alphabet: string[]
  merges: Merge[]
  rows: number // alphabet + merges (+ 5 modifier rows in combinatorial mode)
  variantRows: number // rows that are a leading-space / case variant of another row
  entries: string[] // every row that is a string: alphabet then merges, in rank order
}

export function pretokenize(text: string): string[] {
  return text.match(PRETOKEN) ?? []
}

// Fold a character to lower case only when the fold round-trips exactly (the rule the
// Combinatorial BPE code uses too): "ß" or "İ" stay as they are.
function foldChar(c: string): [string, boolean] {
  const lo = c.toLowerCase()
  if (lo !== c && lo.length === 1 && lo.toUpperCase() === c) return [lo, true]
  return [c, false]
}

export type Unit = {
  space: boolean // combinatorial only: the leading space, now a modifier
  core: string // what BPE sees
  upper: boolean[] // combinatorial only: which characters of `core` were capitals
  letters: boolean // a letter word (modifiers apply) or anything else (goes through as is)
}

export function units(text: string, mode: Mode): Unit[] {
  return pretokenize(text).map((t) => {
    const m = mode === "combinatorial" ? LETTER_WORD.exec(t) : null
    if (!m) return { space: false, core: t, upper: [], letters: false }
    const chars = Array.from(m[2])
    const folded = chars.map(foldChar)
    return {
      space: m[1] === " ",
      core: folded.map((f) => f[0]).join(""),
      upper: folded.map((f) => f[1]),
      letters: true,
    }
  })
}

function variantRows(entries: string[]): number {
  const fam = new Map<string, number>()
  for (const e of entries) {
    const m = LETTER_WORD.exec(e)
    if (!m) continue
    const key = m[2].toLowerCase()
    fam.set(key, (fam.get(key) ?? 0) + 1)
  }
  let n = 0
  for (const c of fam.values()) n += c - 1
  return n
}

export function train(mode: Mode, rows: number): Table {
  const counts = new Map<string, number>()
  for (const u of units(CORPUS, mode)) counts.set(u.core, (counts.get(u.core) ?? 0) + 1)
  const alphaSet = new Set<string>()
  for (const w of counts.keys()) for (const c of Array.from(w)) alphaSet.add(c)
  const alphabet = [...alphaSet].sort()
  const modifiers = mode === "combinatorial" ? 5 : 0
  const nMerges = Math.max(0, rows - alphabet.length - modifiers)
  let words = [...counts.entries()].map(([w, c]) => ({ syms: Array.from(w), c }))
  const merges: Merge[] = []
  while (merges.length < nMerges) {
    const pairs = new Map<string, { a: string; b: string; n: number }>()
    for (const w of words)
      for (let i = 0; i + 1 < w.syms.length; i++) {
        const k = w.syms[i] + "\u0000" + w.syms[i + 1]
        const p = pairs.get(k)
        if (p) p.n += w.c
        else pairs.set(k, { a: w.syms[i], b: w.syms[i + 1], n: w.c })
      }
    let best: { k: string; a: string; b: string; n: number } | null = null
    for (const [k, p] of pairs)
      if (!best || p.n > best.n || (p.n === best.n && k < best.k)) best = { k, ...p }
    if (!best) break
    const { a, b } = best
    merges.push({ a, b, rank: merges.length })
    words = words.map((w) => ({ syms: applyMerge(w.syms, a, b), c: w.c }))
  }
  const entries = [...alphabet, ...merges.map((m) => m.a + m.b)]
  return {
    mode,
    alphabet,
    merges,
    rows: alphabet.length + merges.length + modifiers,
    variantRows: variantRows(entries),
    entries,
  }
}

export function applyMerge(syms: string[], a: string, b: string): string[] {
  const out: string[] = []
  for (let i = 0; i < syms.length; i++) {
    if (i + 1 < syms.length && syms[i] === a && syms[i + 1] === b) {
      out.push(a + b)
      i++
    } else out.push(syms[i])
  }
  return out
}

// One snapshot per merge that actually changes the typed text, in rank order: that is the
// order BPE applies them in, and since each pre-token is merged on its own, applying rank r to
// every pre-token at once gives each of them exactly its own merge sequence.
export type Snapshot = { pieces: string[][]; merge: Merge | null }

export function steps(table: Table, us: Unit[]): Snapshot[] {
  let pieces = us.map((u) => Array.from(u.core))
  const out: Snapshot[] = [{ pieces, merge: null }]
  for (const m of table.merges) {
    let hit = false
    const next = pieces.map((syms) => {
      for (let i = 0; i + 1 < syms.length; i++)
        if (syms[i] === m.a && syms[i + 1] === m.b) {
          hit = true
          return applyMerge(syms, m.a, m.b)
        }
      return syms
    })
    if (hit) {
      pieces = next
      out.push({ pieces, merge: m })
    }
  }
  return out
}

export type Token = {
  text: string // what the chip shows (core, as the table stores it)
  surface: string // what it decodes to
  space: boolean
  kase: Case
  known: boolean // in the table, or a UTF-8 byte fallback
  bytes: number // tokens this chip costs (1, or its UTF-8 length when unknown)
}

function utf8Len(s: string): number {
  let n = 0
  for (const ch of Array.from(s)) {
    const cp = ch.codePointAt(0) ?? 0
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
  }
  return n
}

// Turn one pre-token's current pieces into tokens. In combinatorial mode the space rides on the
// first piece, and each piece carries the case pattern of its own characters; a piece whose
// pattern is neither "Aa" nor "AA" (say "tOk") is spelled out one character per token, each with
// its own case, which is the fallback the Combinatorial BPE code uses.
export function tokens(table: Table, u: Unit, pieces: string[]): Token[] {
  const known = new Set(table.entries)
  const out: Token[] = []
  let pos = 0
  for (const p of pieces) {
    const chars = Array.from(p)
    const flags = u.upper.slice(pos, pos + chars.length)
    const first = pos === 0
    pos += chars.length
    const lead = u.space && first
    const kase = caseOf(flags)
    if (!u.letters || kase !== null) {
      const isKnown = known.has(p)
      out.push({
        text: p,
        surface: (lead ? " " : "") + chars.map((c, i) => (flags[i] ? c.toUpperCase() : c)).join(""),
        space: lead,
        kase: kase ?? "",
        known: isKnown,
        bytes: isKnown ? 1 : utf8Len(p),
      })
      continue
    }
    chars.forEach((c, i) => {
      const k = known.has(c)
      out.push({
        text: c,
        surface: (lead && i === 0 ? " " : "") + (flags[i] ? c.toUpperCase() : c),
        space: lead && i === 0,
        kase: flags[i] ? "Aa" : "",
        known: k,
        bytes: k ? 1 : utf8Len(c),
      })
    })
  }
  return out
}

// "" = as stored, "Aa" = first letter capital, "AA" = all capitals, null = anything else.
function caseOf(flags: boolean[]): Case | null {
  if (!flags.some(Boolean)) return ""
  if (flags.length > 1 && flags.every(Boolean)) return "AA"
  if (flags[0] && !flags.slice(1).some(Boolean)) return "Aa"
  return null
}

export function countTokens(table: Table, text: string): number {
  const us = units(text, table.mode)
  const s = steps(table, us)
  const last = s[s.length - 1]
  let n = 0
  us.forEach((u, i) => {
    for (const t of tokens(table, u, last.pieces[i])) n += t.bytes
  })
  return n
}

// Every row that shares its word with another row once the leading space and the case are
// ignored: " the", "The" and " The" all land in the family of "the".
export function variantEntries(table: Table): Set<string> {
  const fam = new Map<string, string[]>()
  for (const e of table.entries) {
    const m = LETTER_WORD.exec(e)
    if (!m) continue
    const key = m[2].toLowerCase()
    const list = fam.get(key)
    if (list) list.push(e)
    else fam.set(key, [e])
  }
  const out = new Set<string>()
  for (const list of fam.values()) if (list.length > 1) for (const e of list) out.add(e)
  return out
}
