// Hy4 flash's Engram addressing, as shipped. Every constant here is read from the release:
//   PRIMES      config.json `engram_layer_head_vocab_sizes` (keyed by the 1-based layer id 2, 12, 22, 32)
//   MULTIPLIERS the GGUF's `hy_v4_flash.ple.layer_multipliers` (AngelSlim/Hy4-flash-GGUF), which the
//               reference draws with NumPy: default_rng(seed + 10007 * layer_id), odd, below 2 * (2^63 - 1) // 92,620 // 2
//   TOKENS      raw ids from tokenizer.json and canonical ids from the checkpoint's `lookup_table` tensor
// The hash is `HYV4FlashEngramLayer.hash_ngrams` (transformers PR 50903): canonical ids times one odd
// multiplier per position, XORed, the bigram extended to the trigram, reduced modulo each head's prime.

export type EngramLayer = { zero: number; id: number; primes: readonly number[]; mult: readonly [string, string, string] }

export const LAYERS: readonly EngramLayer[] = [
  {
    zero: 1,
    id: 2,
    primes: [10312007, 10312021, 10312039, 10312069, 10312091, 10312121, 10312123, 10312147, 10312177, 10312187, 10312207, 10312213, 10312229, 10312241, 10312249, 10312259],
    mult: ["81853575799317", "39690085502883", "24229915018165"],
  },
  {
    zero: 11,
    id: 12,
    primes: [10312277, 10312283, 10312301, 10312343, 10312373, 10312397, 10312409, 10312453, 10312457, 10312483, 10312507, 10312513, 10312531, 10312543, 10312567, 10312571],
    mult: ["19457948045719", "44729556510419", "84779352922315"],
  },
  {
    zero: 21,
    id: 22,
    primes: [10312613, 10312619, 10312633, 10312657, 10312681, 10312699, 10312723, 10312747, 10312759, 10312789, 10312811, 10312823, 10312867, 10312873, 10312889, 10312903],
    mult: ["72974230057307", "21530602121221", "55998057243097"],
  },
  {
    zero: 31,
    id: 32,
    primes: [10312909, 10312919, 10312927, 10312957, 10312979, 10313011, 10313021, 10313057, 10313063, 10313117, 10313123, 10313129, 10313161, 10313179, 10313189, 10313201],
    mult: ["29128509562787", "16745155128523", "22474588302733"],
  },
]

export type Tok = { text: string; raw: number; canon: number }

// Raw id -> canonical id, from tokenizer.json and lookup_table. "Ġ" in the vocabulary is a leading space.
export const T = {
  Alexander: { text: " Alexander", raw: 28491, canon: 21964 },
  the: { text: " the", raw: 269, canon: 234 },
  The: { text: " The", raw: 499, canon: 234 },
  Great: { text: " Great", raw: 14130, canon: 2693 },
  great: { text: " great", raw: 3193, canon: 2693 },
  New: { text: " New", raw: 3017, canon: 871 },
  new: { text: " new", raw: 1059, canon: 871 },
  York: { text: " York", raw: 6623, canon: 5430 },
  City: { text: " City", raw: 9166, canon: 6026 },
  city: { text: " city", raw: 7370, canon: 6026 },
  By: { text: " By", raw: 4140, canon: 436 },
  by: { text: " by", raw: 533, canon: 436 },
  way: { text: " way", raw: 1967, canon: 1662 },
  Way: { text: " Way", raw: 22101, canon: 1662 },
  United: { text: " United", raw: 6357, canon: 5226 },
  united: { text: " united", raw: 51563, canon: 5226 },
  States: { text: " States", raw: 6749, canon: 4910 },
  states: { text: " states", raw: 5935, canon: 4910 },
} satisfies Record<string, Tok>

export const PHRASES: readonly { label: string; a: readonly Tok[]; b: readonly Tok[] }[] = [
  { label: "Alexander the Great", a: [T.Alexander, T.the, T.Great], b: [T.Alexander, T.The, T.great] },
  { label: "New York City", a: [T.New, T.York, T.City], b: [T.new, T.York, T.city] },
  { label: "by the way", a: [T.by, T.the, T.way], b: [T.By, T.The, T.Way] },
  { label: "the United States", a: [T.the, T.United, T.States], b: [T.The, T.united, T.states] },
]

// The per-head slice of one layer's table starts where the previous head's prime ends.
export function headOffsets(primes: readonly number[]): number[] {
  const out = [0]
  for (let i = 0; i < primes.length - 1; i++) out.push(out[i] + primes[i])
  return out
}

export type Hash = { prod: bigint[]; bi: bigint; tri: bigint; rows: number[] }

// toks = [x_{t-2}, x_{t-1}, x_t] in reading order. Returns the 16 rows (8 bigram heads, then 8 trigram)
// within each head's own slice.
export function engramHash(layer: EngramLayer, toks: readonly Tok[]): Hash {
  const c = [toks[2].canon, toks[1].canon, toks[0].canon].map(BigInt)
  const m = layer.mult.map(BigInt)
  const prod = c.map((x, i) => x * m[i])
  const bi = prod[0] ^ prod[1]
  const tri = bi ^ prod[2]
  const rows = layer.primes.map((p, h) => Number((h < 8 ? bi : tri) % BigInt(p)))
  return { prod, bi, tri, rows }
}
