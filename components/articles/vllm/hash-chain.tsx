"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why a prefix-cache block hash has to chain its parent.
//
// vllm/v1/core/kv_cache_utils.py:620
//   def hash_block_tokens(hash_function, parent_block_hash, curr_block_token_ids,
//                         extra_keys):
//       if not parent_block_hash:
//           parent_block_hash = NONE_HASH
//       return BlockHash(hash_function(
//           (parent_block_hash, curr_block_token_ids_tuple, extra_keys)))
//
// vllm/v1/core/kv_cache_utils.py:757 (get_request_block_hasher) walks the
// request one hash_block_size window at a time and carries the result forward:
//   prev_block_hash_value = block_hash
//
// The payoff is the lookup loop in
// vllm/v1/core/single_type_kv_cache_manager.py:733:
//   # Phase 1: longest run of cached full blocks from the start. A missing
//   # block implies every later block misses too (chained hashes).
//
// The hashes drawn below are a 24-bit FNV-1a over the same tuple shape, purely
// so the chips are short and readable. vLLM's real default is SHA-256 over a
// pickled tuple (vllm/config/cache.py:140, prefix_caching_hash_algo="sha256").

const HIT = "oklch(0.55 0.16 155)"
const MISS = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.58 0.19 27)"
const MUTED = "oklch(0.62 0.03 250)"

const BASE = ["<s>you are", "a helpful", "assistant.", "translate", "to french:", "hello"]
const ALT = ["<s>ignore", "a pirate.", "assistant!", "summarise", "to german:", "hola"]

// FNV-1a. Math.imul is an exact integer operation, so this is identical on
// server and client — no dmath needed.
function fnv(s: string): string {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0").slice(2)
}

export function HashChain() {
  const [d, setD] = useState(2) // block index where request B diverges
  const [chained, setChained] = useState(true)

  const a = BASE
  const b = BASE.map((t, i) => (i === d ? ALT[i] : t))

  const hashes = (toks: string[]) => {
    const out: string[] = []
    let parent = "none"
    for (const t of toks) {
      const key = chained ? `${parent}|${t}` : t
      const h = fnv(key)
      out.push(h)
      parent = h
    }
    return out
  }

  const ha = hashes(a)
  const hb = hashes(b)

  // The real lookup walks from block 0 and breaks at the first miss.
  let hit = 0
  while (hit < ha.length && ha[hit] === hb[hit]) hit++

  // Keys that collide *after* the divergence point — identical contents, a
  // prefix that is not identical.
  const collisions = chained ? 0 : ha.filter((h, i) => i > d && h === hb[i]).length

  const W = 700
  const X0 = 92
  const BW = 92
  const GAP = 6
  const H = 168

  const lineX = X0 + hit * (BW + GAP) - GAP / 2
  const lineRight = lineX > W / 2

  const cellColour = (i: number, mine: string[], theirs: string[]) => {
    if (mine[i] !== theirs[i]) return MISS
    if (i > d) return chained ? HIT : BAD
    return HIT
  }

  const row = (toks: string[], hs: string[], other: string[], y: number, label: string, isB: boolean) => (
    <g>
      <text
        x={X0 - 10}
        y={y + 17}
        fontSize={9.5}
        textAnchor="end"
        fill="currentColor"
        fillOpacity={0.75}
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
      {toks.map((t, i) => {
        const x = X0 + i * (BW + GAP)
        const c = isB ? cellColour(i, hs, other) : HIT
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={BW}
              height={26}
              rx={3}
              fill={c}
              fillOpacity={isB ? 0.22 : 0.14}
              stroke={c}
              strokeOpacity={0.55}
            />
            <text
              x={x + BW / 2}
              y={y + 17}
              fontSize={8.5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.85}
              fontFamily="ui-monospace, monospace"
            >
              {t}
            </text>
            <text
              x={x + BW / 2}
              y={y + 38}
              fontSize={8.5}
              textAnchor="middle"
              fill={isB ? c : MUTED}
              fontFamily="ui-monospace, monospace"
            >
              {hs[i]}
            </text>
          </g>
        )
      })}
    </g>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          hash_block_tokens(parent, tokens, extra_keys)
        </span>
        <span className="font-mono text-[10px]" style={{ color: collisions > 0 ? BAD : HIT }}>
          {collisions > 0
            ? `${collisions} block${collisions > 1 ? "s" : ""} keyed to the wrong prefix`
            : `prefix hit: ${hit} block${hit === 1 ? "" : "s"} · ${hit * 16} tokens`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setChained((v) => !v)}
          aria-pressed={chained}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            chained
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          chain the parent hash
        </button>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two requests whose prompts diverge at block ${d}. With parent hashes ${
                chained ? "chained" : "not chained"
              }, request B matches ${hit} of request A's cached blocks${
                collisions > 0
                  ? ` and ${collisions} later blocks produce the same key despite following a different prefix`
                  : ""
              }.`}
            </title>
            {BASE.map((_, i) => (
              <text
                key={i}
                x={X0 + i * (BW + GAP) + BW / 2}
                y={13}
                fontSize={8.5}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.45}
                fontFamily="ui-monospace, monospace"
              >
                {`block ${i}`}
              </text>
            ))}
            {row(a, ha, hb, 22, "request A", false)}
            {row(b, hb, ha, 90, "request B", true)}

            <line
              x1={lineX}
              y1={18}
              x2={lineX}
              y2={134}
              stroke={HIT}
              strokeOpacity={0.6}
              strokeDasharray="3 3"
            />
            <text
              x={lineX + (lineRight ? -6 : 6)}
              y={148}
              fontSize={8.5}
              textAnchor={lineRight ? "end" : "start"}
              fill={HIT}
              fontFamily="ui-monospace, monospace"
            >
              {`scan stops here — ${hit} block${hit === 1 ? "" : "s"} reused`}
            </text>
            {collisions > 0 ? (
              <text
                x={X0 + BW * 6 + GAP * 5}
                y={160}
                fontSize={8.5}
                textAnchor="end"
                fill={BAD}
                fontFamily="ui-monospace, monospace"
              >
                {`${collisions} identical key${collisions > 1 ? "s" : ""}, different prefix — wrong KV`}
              </text>
            ) : null}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ["same key — prefix reused", HIT],
              ["different key — recomputed", MISS],
              ["same key, different prefix — wrong KV", BAD],
            ] as const
          ).map(([label, colour]) => (
            <span key={label} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: colour, opacity: 0.75 }} />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            diverge at block
          </span>
          <Range
            min={1}
            max={5}
            step={1}
            value={d}
            onChange={(e) => setD(Number(e.target.value))}
            className="flex-1"
            aria-label="the block index at which request B stops matching request A"
            accent={MISS}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{d}</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A block hash in vLLM is not a hash of the block. It is a hash of{" "}
          <code>(parent_hash, block_tokens, extra_keys)</code>, and the walk in{" "}
          <code>get_request_block_hasher</code> feeds each result into the next block as the parent.
          So a hash does not identify sixteen tokens — it identifies{" "}
          <span className="text-foreground">a prefix ending at that boundary</span>.
          <br />
          <br />
          Turn the chaining off and the difference is not academic. Both requests end in{" "}
          <code>translate / to french: / hello</code>, so those blocks hash to the{" "}
          <span style={{ color: BAD }}>same key</span> even though one of them was computed after
          &ldquo;a helpful assistant&rdquo; and the other after &ldquo;a pirate&rdquo;. A hit there
          hands the second request KV that encodes the wrong context and the wrong absolute
          positions, and nothing downstream can tell.
          <br />
          <br />
          Chaining also buys the optimisation that makes the lookup cheap. Because a differing
          prefix guarantees a differing hash at every later boundary, the matcher can stop dead at
          the first miss —{" "}
          <em>&ldquo;A missing block implies every later block misses too (chained hashes)&rdquo;</em>{" "}
          in <code>single_type_kv_cache_manager.py</code>. A content-only hash would make that early
          exit unsound, and checking every block instead would still give you the wrong answer.
          <br />
          <br />
          Same reason <code>extra_keys</code> exists: a LoRA id, a multimodal input hash, and a
          per-tenant <code>cache_salt</code> all go into the first block&rsquo;s key, so two tenants
          sending the same prompt cannot read each other&rsquo;s cache — or measure each other&rsquo;s
          latency.
        </p>
      </div>
    </figure>
  )
}
