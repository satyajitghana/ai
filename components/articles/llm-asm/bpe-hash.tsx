"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Left: how tok_encode_bpe finds a merge. key = (left_id << 32) | right_id, slot =
// (key * 0x9E3779B97F4A7C15 mod 2^64) >> 45, then linear probing in a 524,288-slot table.
// Token ids and merge ranks are from Qwen3-0.6B's tokenizer.json; the slot is computed here.
//
// Right: tok_encode_bpe runs BPE over the whole string; Hugging Face first splits it with the
// pre-tokenizer regex, then runs BPE inside each piece. The token lists are from my Python
// re-implementation of both against the same tokenizer.json (not from running the binary).

const PAIRS = [
  { a: "Ġ", b: "Ġ", ia: 220, ib: 220, rank: 0, merged: "ĠĠ" },
  { a: "i", b: "n", ia: 72, ib: 77, rank: 2, merged: "in" },
  { a: "ĠĠ", b: "Ġ", ia: 256, ib: 220, rank: 6, merged: "ĠĠĠ" },
  { a: "Ġ", b: "w", ia: 220, ib: 86, rank: 33, merged: "Ġw" },
  { a: "or", b: "ld", ia: 269, ib: 507, rank: 1129, merged: "orld" },
  { a: "Ġw", b: "orld", ia: 289, ib: 1385, rank: 1623, merged: "Ġworld" },
]

const CASES = [
  { text: "Hello world", asm: ["Hello", "Ġworld"], hf: ["Hello", "Ġworld"] },
  { text: "Hello   world", asm: ["Hello", "ĠĠĠ", "world"], hf: ["Hello", "ĠĠ", "Ġworld"] },
  {
    text: "def f(x):⏎    return x  + 1⏎",
    asm: ["def", "Ġf", "(x", "):Ċ", "ĠĠĠĠ", "return", "Ġx", "ĠĠ", "+", "Ġ", "1", "Ċ"],
    hf: ["def", "Ġf", "(x", "):Ċ", "ĠĠĠ", "Ġreturn", "Ġx", "Ġ", "Ġ+", "Ġ", "1", "Ċ"],
  },
  { text: "a⇥b⇥⇥c", asm: ["a", "ĉb", "ĉĉ", "c"], hf: ["a", "ĉb", "ĉ", "ĉc"] },
  { text: "Объясни, как работает стек.", same: 10 },
  { text: "12345678901234567890", same: 20 },
  { text: "Explain the difference between L1, L2, and L3 CPU caches…", same: 22 },
] as { text: string; asm?: string[]; hf?: string[]; same?: number }[]

const FIB = BigInt("0x9E3779B97F4A7C15")
const M64 = (BigInt(1) << BigInt(64)) - BigInt(1)

function slotOf(ia: number, ib: number) {
  const key = (BigInt(ia) << BigInt(32)) | BigInt(ib)
  return { key, slot: Number(((key * FIB) & M64) >> BigInt(45)) }
}

function Toks({ toks, other }: { toks: string[]; other: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {toks.map((t, i) => (
        <span
          key={i}
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-xs",
            other[i] === t ? "border-border" : "border-rose-500/60 bg-rose-500/10",
          )}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

export function BpeHash() {
  const [p, setP] = useState(3)
  const [c, setC] = useState(1)
  const pair = PAIRS[p]
  const { key, slot } = slotOf(pair.ia, pair.ib)
  const cs = CASES[c]

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">The merge table lookup, and where skipping the pre-tokenizer bites</figcaption>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Pick a pair of adjacent tokens</div>
          <div className="mb-3 flex flex-wrap gap-1">
            {PAIRS.map((q, i) => (
              <button
                key={i}
                onClick={() => setP(i)}
                aria-pressed={p === i}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-xs",
                  p === i ? "border-foreground bg-foreground text-background" : "border-border",
                )}
              >
                {q.a} + {q.b}
              </button>
            ))}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">ids</dt>
            <dd>
              {pair.ia}, {pair.ib}
            </dd>
            <dt className="text-muted-foreground">key</dt>
            <dd>0x{key.toString(16)}</dd>
            <dt className="text-muted-foreground">x 0x9E37…7C15 &gt;&gt; 45</dt>
            <dd>slot {slot.toLocaleString("en-US")} of 524,288</dd>
            <dt className="text-muted-foreground">entry</dt>
            <dd>
              rank {pair.rank.toLocaleString("en-US")}, merged → {pair.merged}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Each pass scans every adjacent pair, probes the table, and applies the lowest rank. Ranks are the order merges were
            learned: <code>ĠĠ+Ġ</code> at 6 beats <code>Ġ+w</code> at 33.
          </p>
        </div>
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Pick a string</div>
          <select
            className="mb-3 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={c}
            onChange={(e) => setC(Number(e.target.value))}
            aria-label="String"
          >
            {CASES.map((k, i) => (
              <option key={i} value={i}>
                {k.text}
              </option>
            ))}
          </select>
          {cs.same ? (
            <p className="text-xs">
              Same {cs.same} tokens both ways. Digits never merge in Qwen&apos;s vocabulary, and no merge joins a letter to a
              following space, so the regex split changes nothing here.
            </p>
          ) : (
            <>
              <div className="mb-1 text-xs text-muted-foreground">llm.asm (BPE over the whole string)</div>
              <Toks toks={cs.asm!} other={cs.hf!} />
              <div className="mb-1 mt-3 text-xs text-muted-foreground">Hugging Face (regex split, then BPE per piece)</div>
              <Toks toks={cs.hf!} other={cs.asm!} />
            </>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Ids and ranks from Qwen3-0.6B&apos;s <code>tokenizer.json</code>. Token lists from my Python re-implementation of both
        procedures; ⏎ is a newline and ⇥ a tab. The difference shows up only in runs of whitespace before a word.
      </p>
    </figure>
  )
}
