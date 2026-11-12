// The SUM table of Sketchpad, written out from its definition (addRule and addCode in
// src/lib/sketchpad/adder.ts of github.com/NeoVand/sketchpad): a view is three cells of
// one column, carry over top digit over bottom digit, each blank or a glyph. The answer
// is the column's digit and carry, said as one token: '0'-'9' with no carry, 'a'-'j' for
// digit 0-9 with a carry, 'H' to halt. This is the reference table T, not the model.

export const BLANK = " "
export const GLYPHS = [BLANK, "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const

export type View = readonly [carry: string, top: string, bottom: string]
export type Answer = { halt: true } | { halt: false; digit: number; carry: 0 | 1 }

export function rule(v: View): Answer {
  const [c, t, b] = v
  if (c === BLANK && t === BLANK && b === BLANK) return { halt: true }
  let s = 0
  for (const g of v) if (g !== BLANK) s += Number(g)
  return { halt: false, digit: s % 10, carry: s >= 10 ? 1 : 0 }
}

const CODES = "abcdefghij"
export function token(a: Answer): string {
  if (a.halt) return "H"
  return a.carry ? CODES[a.digit] : String(a.digit)
}

/** Index of a view in the certificate's row order: carry, then top, then bottom. */
export function viewIndex(v: View): number {
  const ci = v[0] === BLANK ? 0 : 1
  const ti = GLYPHS.indexOf(v[1] as (typeof GLYPHS)[number])
  const bi = GLYPHS.indexOf(v[2] as (typeof GLYPHS)[number])
  return ci * 121 + ti * 11 + bi
}

export const viewLabel = (v: View) => v.map((g) => (g === BLANK ? "·" : g)).join(" ")

/** The view the "break one rule" toggle corrupts: 5 + 6, no carry in (the certificate's weakest row). */
export const WEAK: View = [BLANK, "5", "6"]
export const isWeak = (v: View) => v[0] === WEAK[0] && v[1] === WEAK[1] && v[2] === WEAK[2]

export type Sheet = {
  n: number
  top: string[]
  bot: string[]
  car: string[]
  out: string[]
}

export function layout(a: string, b: string): Sheet {
  const n = Math.max(a.length, b.length) + 2
  const pad = (s: string) => [...Array(n - s.length).fill(BLANK), ...s.split("")]
  return { n, top: pad(a), bot: pad(b), car: Array(n).fill(BLANK), out: Array(n).fill(BLANK) }
}

/** One tick of the runtime: read the view at `col`, paint the answer, move left. Returns the next column or -1 on halt. */
export function tick(s: Sheet, col: number, broken: boolean): { view: View; answer: Answer; next: number } {
  const view: View = [s.car[col], s.top[col], s.bot[col]]
  let answer = rule(view)
  if (broken && isWeak(view)) answer = { halt: false, digit: 2, carry: 1 }
  if (answer.halt) return { view, answer, next: -1 }
  s.out[col] = String(answer.digit)
  if (answer.carry && col > 0) s.car[col - 1] = "1"
  return { view, answer, next: col - 1 }
}

export function readOut(s: Sheet): string {
  const t = s.out.join("").trim()
  return t === "" ? "0" : t
}

/** Run a whole sum; returns the result and the set of view indices read. */
export function runSum(a: string, b: string, broken: boolean): { result: string; views: Set<number>; ticks: number } {
  const s = layout(a, b)
  const views = new Set<number>()
  let col = s.n - 1
  let ticks = 0
  while (col >= 0) {
    const r = tick(s, col, broken)
    views.add(viewIndex(r.view))
    ticks++
    col = r.next
  }
  return { result: readOut(s), views, ticks }
}

/** Small seeded generator (mulberry32) so runs are reproducible and SSR-safe. */
export function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function randomDigits(n: number, next: () => number): string {
  let s = String(1 + Math.floor(next() * 9))
  for (let i = 1; i < n; i++) s += String(Math.floor(next() * 10))
  return s
}
