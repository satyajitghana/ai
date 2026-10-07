// A toy byte-pair table, small enough to read whole, built so that the order in which merges are
// applied changes the ids. "·" stands for a space, as the article writes it.
//
// Rank 7 repeats a string that rank 5 already made ("·the"): Hugging Face's conversions of
// tiktoken vocabularies (Llama 3, o200k, GLM 5.3) list every split of a token this way, so a
// merge's result can have a lower id than a merge ranked before it. toks's docs/kernels.md §5
// counts exactly that (49.6k-72.2k such merges per file) as the reason it cannot use the merged
// id as the priority on those files.
//
// Four policies:
//   rank     Hugging Face's rule: the adjacent pair with the lowest rank, leftmost on a tie.
//   id       the merged token's id as the priority (toks's TOKS_TF_IDS_AS_RANK shortcut, which it
//            only enables when it has certified that ids rise with rank).
//   left     the leftmost pair that has any merge.
//   greedy   the longest vocabulary prefix, again and again (no merges at all).
// Only `rank` is the reference. Pure integer and string work; nothing here is timed.

export type Policy = "rank" | "id" | "left" | "greedy"

export const MERGES: ReadonlyArray<readonly [string, string]> = [
  ["t", "h"],
  ["h", "e"],
  ["th", "e"],
  ["e", "r"],
  ["·", "t"],
  ["·t", "he"],
  ["the", "r"],
  ["·", "the"],
  ["o", "t"],
  ["he", "r"],
  ["ot", "her"],
]

export const ALPHABET = ["e", "h", "o", "r", "t", "·"] as const

const VOCAB: Map<string, number> = (() => {
  const v = new Map<string, number>()
  ALPHABET.forEach((c, i) => v.set(c, i))
  for (const [a, b] of MERGES) {
    if (!v.has(a + b)) v.set(a + b, v.size)
  }
  return v
})()

const RANK: Map<string, number> = (() => {
  const r = new Map<string, number>()
  MERGES.forEach(([a, b], i) => r.set(a + "\u0000" + b, i))
  return r
})()

export const idOf = (s: string): number => VOCAB.get(s) ?? -1
export const vocabSize = VOCAB.size
export const rankOf = (a: string, b: string): number | undefined => RANK.get(a + "\u0000" + b)

export type Cand = { pos: number; a: string; b: string; rank: number; id: number; key: number }
export type Snap = {
  syms: string[]
  rest: string // greedy only: text not yet emitted
  cands: Cand[]
  pick: number // index into cands, or -1
  note: string
}

// key = prio << 5 | pos, the packing toks's c twin uses (src/core/k6_c.c: K6_SHIFT 5), so one unsigned
// min picks the lowest priority and, on a tie, the leftmost position.
const pack = (prio: number, pos: number) => prio * 32 + pos

function candidates(syms: string[], policy: Policy): Cand[] {
  const out: Cand[] = []
  for (let i = 0; i + 1 < syms.length; i++) {
    const r = rankOf(syms[i], syms[i + 1])
    if (r === undefined) continue
    const id = idOf(syms[i] + syms[i + 1])
    const prio = policy === "id" ? id : policy === "left" ? 0 : r
    out.push({ pos: i, a: syms[i], b: syms[i + 1], rank: r, id, key: pack(prio, i) })
  }
  return out
}

export function clean(text: string): string {
  return Array.from(text.toLowerCase().replace(/ /g, "·"))
    .filter((c) => (ALPHABET as readonly string[]).includes(c))
    .slice(0, 14)
    .join("")
}

export function run(text: string, policy: Policy): Snap[] {
  const snaps: Snap[] = []
  if (policy === "greedy") {
    const syms: string[] = []
    let rest = text
    snaps.push({ syms: [], rest, cands: [], pick: -1, note: "start: nothing emitted" })
    while (rest.length > 0) {
      let take = 1
      for (let j = rest.length; j > 0; j--) {
        if (VOCAB.has(rest.slice(0, j))) {
          take = j
          break
        }
      }
      const tok = rest.slice(0, take)
      syms.push(tok)
      rest = rest.slice(take)
      snaps.push({ syms: [...syms], rest, cands: [], pick: -1, note: `longest vocabulary prefix: ${tok}` })
    }
    return snaps
  }
  let syms = Array.from(text)
  for (let guard = 0; guard < 64; guard++) {
    const cands = candidates(syms, policy)
    if (cands.length === 0) {
      snaps.push({ syms, rest: "", cands, pick: -1, note: "no adjacent pair has a merge: done" })
      break
    }
    let pick = 0
    for (let i = 1; i < cands.length; i++) if (cands[i].key < cands[pick].key) pick = i
    const c = cands[pick]
    const why =
      policy === "rank"
        ? `lowest rank is ${c.rank}`
        : policy === "id"
          ? `lowest merged id is ${c.id}`
          : `leftmost mergeable pair`
    snaps.push({ syms, rest: "", cands, pick, note: `${why}: merge ${c.a} + ${c.b}` })
    syms = [...syms.slice(0, c.pos), c.a + c.b, ...syms.slice(c.pos + 2)]
  }
  return snaps
}

export function finalIds(text: string, policy: Policy): number[] {
  const s = run(text, policy)
  return s[s.length - 1].syms.map(idOf)
}
