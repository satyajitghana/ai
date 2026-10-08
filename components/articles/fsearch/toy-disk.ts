// A toy disk and a port of fsearch's name-matching rules, shared by the
// fsearch article's widgets. Ported from noahdunnagan/fsearch at af9476d:
//   - char_bit / name_mask / start_bit            src/index.rs:485-520
//   - Token::fits (the one-AND prefilter)          src/query.rs:30-39
//   - typos only for fuzzy words of 5+ letters     src/query.rs:42-49
//   - one_edit_prefix (wrong/extra/missing/swap)   src/query.rs:533-555
//   - typo_score: only at the start of the name
//     or of a space-separated word                 src/query.rs:505-519
//   - the DFS block layout of the index            src/index.rs:202-252
// Ranking is simplified (match / prefix / typo tiers); fsearch's real
// fzf-v1 scorer, folder priors and recency nudges are not reproduced.
// A 64-bit mask is kept as two 32-bit words because JS bitwise ops are 32-bit.

export type Mask = { lo: number; hi: number }

const bit = (n: number): Mask => (n < 32 ? { lo: (1 << n) >>> 0, hi: 0 } : { lo: 0, hi: (1 << (n - 32)) >>> 0 })
const or = (a: Mask, b: Mask): Mask => ({ lo: (a.lo | b.lo) >>> 0, hi: (a.hi | b.hi) >>> 0 })
const andNot = (a: Mask, b: Mask): Mask => ({ lo: (a.lo & ~b.lo) >>> 0, hi: (a.hi & ~b.hi) >>> 0 })
const and = (a: Mask, b: Mask): Mask => ({ lo: (a.lo & b.lo) >>> 0, hi: (a.hi & b.hi) >>> 0 })
const isZero = (a: Mask) => a.lo === 0 && a.hi === 0
const ZERO: Mask = { lo: 0, hi: 0 }
const popcount = (x: number) => {
  let c = 0
  let v = x >>> 0
  while (v) {
    v &= v - 1
    c++
  }
  return c
}
export const bitsIn = (a: Mask) => popcount(a.lo) + popcount(a.hi)

function charBit(c: string): Mask {
  const b = c.charCodeAt(0)
  if (b >= 97 && b <= 122) return bit(b - 97)
  if (b >= 65 && b <= 90) return bit(b - 65)
  if (b >= 48 && b <= 57) return bit(26 + b - 48)
  if (c === ".") return bit(36)
  if (c === "-" || c === "_") return bit(37)
  if (c === " ") return bit(38)
  if (b >= 0x80) return bit(39)
  return bit(40)
}

function startBit(c: string): Mask {
  return bit(41 + (c.toLowerCase().charCodeAt(0) % 23))
}

export function charMask(s: string): Mask {
  let m = ZERO
  for (const c of s) m = or(m, charBit(c))
  return m
}

export function nameMask(s: string): Mask {
  let m = charMask(s)
  const off = s.length > 1 && s[0] === "." ? 1 : 0
  if (off < s.length) m = or(m, startBit(s[off]))
  for (let i = 0; i + 1 < s.length; i++) if (s[i] === " ") m = or(m, startBit(s[i + 1]))
  return m
}

export type Token = { text: string; mask: Mask; loose: Mask; start: Mask; typos: boolean }

export function token(q: string): Token {
  const text = q.toLowerCase()
  const mask = charMask(text)
  const typos = text.length >= 5
  return {
    text,
    mask,
    typos,
    loose: typos ? andNot(mask, charBit(text[0])) : ZERO,
    start: typos ? startBit(text[0]) : ZERO,
  }
}

// query.rs:36-39, written out: either no class is missing, or (typo case) the
// missing classes are a single `loose` one and a word starts with the token's
// first letter.
export function fits(t: Token, m: Mask): boolean {
  const miss = andNot(t.mask, m)
  if (isZero(miss)) return true
  if (!t.typos) return false
  const oneLoose = isZero(andNot(miss, t.loose)) && bitsIn(miss) === 1
  return oneLoose && !isZero(and(m, t.start))
}

const fold = (s: string) => s.toLowerCase()

function isSubseq(name: string, q: string): boolean {
  const n = fold(name)
  let j = 0
  for (let i = 0; i < n.length && j < q.length; i++) if (n[i] === q[j]) j++
  return j === q.length
}

// query.rs:533-555
function oneEditPrefix(w0: string, q: string): number | null {
  const w = fold(w0)
  const starts = (a: string, b: string) => a.length >= b.length && a.startsWith(b)
  let i = -1
  for (let k = 0; k < q.length; k++) {
    if (k >= w.length || w[k] !== q[k]) {
      i = k
      break
    }
  }
  if (i < 0) return null
  const digit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9"
  if (digit(q[i]) || digit(w[i])) return null
  if (i + 1 < q.length && i + 1 < w.length && w[i] === q[i + 1] && w[i + 1] === q[i] && starts(w.slice(i + 2), q.slice(i + 2)))
    return q.length
  if (i < w.length && starts(w.slice(i + 1), q.slice(i + 1))) return q.length
  if (starts(w.slice(i), q.slice(i + 1))) return q.length - 1
  if (i < w.length && starts(w.slice(i + 1), q.slice(i))) return q.length + 1
  return null
}

export type Verdict = { kind: "prefix" | "substring" | "fuzzy" | "typo"; score: number } | null

/** A simplified fsearch token match: clean fuzzy first, then a one-edit typo
 *  at a word start. Score tiers stand in for the real fzf-style scorer. */
export function matchName(name: string, t: Token): Verdict {
  const m = nameMask(name)
  const q = t.text
  const n = fold(name)
  const off = n.length > 1 && n[0] === "." ? 1 : 0
  if (isZero(andNot(t.mask, m)) && isSubseq(name, q)) {
    if (n.startsWith(q, off)) return { kind: "prefix", score: 3 }
    if (n.includes(q)) return { kind: "substring", score: 2 }
    return { kind: "fuzzy", score: 1 }
  }
  if (t.typos && !isZero(and(m, t.start))) {
    const starts = [off]
    for (let i = 0; i + 1 < n.length; i++) if (n[i] === " ") starts.push(i + 1)
    for (const s of starts) if (n[s] === q[0] && oneEditPrefix(n.slice(s), q) !== null) return { kind: "typo", score: 0 }
  }
  return null
}

// ---------------------------------------------------------------------------
// The toy disk. Folders end in "/". Names repeat on purpose: the real index
// stores each distinct name once (index.rs:9-11).

export type Node = { name: string; kids?: Node[] }

const f = (name: string): Node => ({ name })
const d = (name: string, kids: Node[]): Node => ({ name, kids })

export const DISK: Node = d("", [
  d("Applications", [d("Safari.app", []), d("Python 3.13", [f("IDLE.app"), f("README.md")])]),
  d("Library", [d("Caches", [f("index.db"), f("main.log")])]),
  d("Users", [
    d("noah", [
      d("Developer", [
        d("fsearch", [
          f("Cargo.toml"),
          f("README.md"),
          d("src", [f("index.rs"), f("live.rs"), f("main.rs"), f("query.rs"), f("walk.rs")]),
        ]),
        d("site", [
          f("README.md"),
          f("next.config.ts"),
          f("package.json"),
          d("src", [f("index.ts"), f("main.ts")]),
        ]),
      ]),
      d("Documents", [f("notes.md"), f("resume.pdf"), f("taxes-2025.pdf")]),
      d("Downloads", [f("IMG_5659.MOV"), f("python-3.13.pkg"), f("wallpaper.jpg")]),
    ]),
  ]),
  d("usr", [d("bin", [f("grep"), f("python3"), f("zsh")])]),
])

export type Entry = { i: number; name: string; dir: boolean; parent: number; depth: number; path: string }
export type Block = { dir: number; start: number; len: number; end: number }

/** Lay the disk out the way Index::build does: entry 0 is "/", then one
 *  block of sorted children per folder, blocks in depth-first order. */
export function layout(root: Node = DISK) {
  const entries: Entry[] = [{ i: 0, name: "/", dir: true, parent: 0, depth: 0, path: "/" }]
  const blocks: Block[] = []
  const stack: { e: number; node: Node }[] = [{ e: 0, node: root }]
  while (stack.length) {
    const { e, node } = stack.pop() as { e: number; node: Node }
    const start = entries.length
    const kids = [...(node.kids ?? [])].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    const sub: { e: number; node: Node }[] = []
    for (const k of kids) {
      const parent = entries[e]
      const i = entries.length
      entries.push({
        i,
        name: k.name,
        dir: !!k.kids,
        parent: e,
        depth: parent.depth + 1,
        path: (parent.path === "/" ? "" : parent.path) + "/" + k.name,
      })
      if (k.kids) sub.push({ e: i, node: k })
    }
    blocks.push({ dir: e, start, len: entries.length - start, end: entries.length })
    for (let k = sub.length - 1; k >= 0; k--) stack.push(sub[k])
  }
  // Subtree end: the block end, folded up from children (index.rs:301-307).
  const byDir = new Map(blocks.map((b) => [b.dir, b]))
  for (let k = entries.length - 1; k > 0; k--) {
    const b = byDir.get(k)
    if (!b) continue
    const p = byDir.get(entries[k].parent)
    if (p) p.end = Math.max(p.end, b.end)
  }
  return { entries, blocks, byDir }
}
