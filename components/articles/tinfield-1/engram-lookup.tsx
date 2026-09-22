"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The engram table, from the outside in.
//
// Everything here is read out of the checkpoint, not invented:
//
//   ngram_size                3                      (config.json)
//   heads_per_ngram           8                      (config.json)
//   split_ngram_parts         128                    (config.json)
//   layer_multipliers         [23703573157769, 20109073645365, 8052911324071]
//   ngram_heads_vocab_sizes   16 primes just above 20,000,000
//   ngram_heads_offsets       running sum of those 16 sizes
//   shard shape               (2500012, 160) × 128, BF16
//
// The three int64 metadata tensors were range-requested out of their shard and
// read directly; the primes and multipliers below are their literal contents.
// The hash is the obvious reading of a polynomial hash with one multiplier per
// n-gram position and a per-head prime modulus. Qwen's card says the table
// indexes "bigrams/trigrams", and 16 heads with heads_per_ngram=8 splits
// cleanly into 8 bigram heads and 8 trigram heads, so that is the split drawn
// here. What is *measured* is the table's shape, its 51,200,245,760 parameters,
// the 16 primes, the 3 multipliers, and the fact that exactly 16 rows of 160
// are needed to fill the 2,560-wide PLE vector. The composition is inferred.
//
// The point of the widget is the ratio at the bottom: 2,560 values read out of
// 51.2 billion stored. That is why Qwen can call embeddings "a unique axis for
// parameter scaling" and why llama.cpp can leave the table on the CPU.

// No BigInt: tsconfig targets below ES2020, where a `…n` literal is a hard
// error. It is not needed anyway. Each multiplier is under 2^45 and every
// modulus is under 2^25, so reducing the multiplier modulo the prime *first*
// keeps every product under 2^43 — exactly representable in a double. `+`, `*`
// and `%` are all exact per IEEE-754, so this agrees bit for bit between the
// server render and the browser, and needs nothing from lib/dmath.
const MULTIPLIERS = [23703573157769, 20109073645365, 8052911324071]

const VOCAB_SIZES = [
  20000003, 20000023, 20000033, 20000047, 20000059, 20000063, 20000069,
  20000077, 20000081, 20000093, 20000107, 20000147, 20000153, 20000159,
  20000161, 20000171,
]

const OFFSETS = [
  0, 20000003, 40000026, 60000059, 80000106, 100000165, 120000228, 140000297,
  160000374, 180000455, 200000548, 220000655, 240000802, 260000955, 280001114,
  300001275,
]

// Trigrams as (token id) triples. Ids are illustrative stand-ins for a real
// tokenization — the arithmetic is what the widget is showing, not the
// vocabulary. Marked as such in the caption.
const TRIGRAMS = [
  { label: "git commit -m", ids: [3129, 15789, 481] },
  { label: "def __init__(", ids: [750, 9110, 7] },
  { label: "Traceback (most", ids: [45012, 350, 3417] },
  { label: "sudo rm -rf", ids: [50021, 3399, 8812] },
]

const SHARD_ROWS = 2_500_012
const SHARDS = 128
const WIDTH = 160
const TABLE_PARAMS = 51_200_245_760

// Heads 0-7 index the bigram (t₁, t₂); heads 8-15 index the full trigram.
function bucket(ids: number[], head: number): number {
  const p = VOCAB_SIZES[head]
  const order = head < 8 ? 2 : 3
  let acc = 0
  for (let i = 3 - order; i < 3; i++) {
    acc = (acc + ((MULTIPLIERS[i] % p) * (ids[i] % p)) % p) % p
  }
  return acc
}

export function EngramLookup() {
  const [pick, setPick] = useState(0)
  const tri = TRIGRAMS[pick]
  const rows = VOCAB_SIZES.map((_, h) => bucket(tri.ids, h))
  const read = 16 * WIDTH

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">trigram</span>
        {TRIGRAMS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setPick(i)}
            aria-pressed={i === pick}
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-xs transition-colors",
              i === pick
                ? "border-foreground/40 bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="border-b px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground">
          h<sub>i</sub> = (20109073645365·t₁ + 8052911324071·t₂) mod P
          <sub>i</sub> for i &lt; 8, plus 23703573157769·t₀ for i ≥ 8
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          token ids{" "}
          <span className="text-foreground">[{tri.ids.join(", ")}]</span> · 16
          heads, 16 different primes, 16 different collision patterns
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 font-mono text-xs sm:grid-cols-2">
        {rows.map((r, h) => (
          <div key={h} className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">
              {h < 8 ? "bigram" : "trigram"} P<sub>{h}</sub>={" "}
              {VOCAB_SIZES[h].toLocaleString()}
            </span>
            <span className="tabular-nums">{r.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-2 font-mono text-xs text-muted-foreground">
          rows actually touched, across the whole table
        </div>
        <div className="flex h-8 w-full items-stretch overflow-hidden rounded-sm border">
          <div className="relative flex-1 bg-muted">
            {rows.map((r, h) => {
              const abs = OFFSETS[h] + r
              const left = (abs / (SHARD_ROWS * SHARDS)) * 100
              return (
                <span
                  key={h}
                  className="absolute top-0 h-full w-px bg-[var(--hg-accent,oklch(0.72_0.15_195))]"
                  style={{ left: `${left.toFixed(4)}%` }}
                  aria-hidden
                />
              )
            })}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>
            320,001,536 rows × {WIDTH} = {(TABLE_PARAMS / 1e9).toFixed(1)}B
            parameters · 95.4 GiB in BF16
          </span>
          <span className="text-foreground">
            read this token: 16 × {WIDTH} = {read.toLocaleString()} values
          </span>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Measured: the shard shapes, the 16 prime moduli, the three multipliers
        and the offsets, read from the checkpoint. Inferred: that those
        constants compose into this polynomial hash, and that the heads split
        8 bigram / 8 trigram. Token ids are stand-ins — the arithmetic is the
        point, not the vocabulary.
      </figcaption>
    </figure>
  )
}
