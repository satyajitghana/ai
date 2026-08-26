"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Paged KV plus prefix caching, as vLLM's v1 BlockPool actually does it.
//
// Two requests share a system prompt. Each 16-token block of a request is
// hashed; the hash is looked up in `cached_block_hash_to_block`; a hit bumps a
// refcount instead of allocating. Blocks with refcount zero stay in
// `free_block_queue` in eviction order, so a cached block is evictable but
// still reusable until something actually takes its memory.
//
// The details worth knowing, all from vllm/v1/core/:
//
//   BlockHash = NewType("BlockHash", bytes)                — SHA-256 bytes
//   BlockHashWithGroupId = block_hash + group_id(4 bytes)  — packed key
//   self.null_block = self.free_block_queue.popleft()      — a real block,
//                     set aside so that "no block" has an address
//
// The block count and hit/miss accounting below are arithmetic on the sliders.

const HIT = "oklch(0.55 0.16 155)"
const MISS = "oklch(0.60 0.15 255)"
const FREE = "oklch(0.62 0.03 250)"
const NULLC = "oklch(0.68 0.13 85)"

const BLOCK = 16 // tokens per block, vLLM's default

export function BlockLedger() {
  const [shared, setShared] = useState(96) // shared prefix, tokens
  const [a, setA] = useState(64) // request A's own tokens
  const [b, setB] = useState(48)
  const [caching, setCaching] = useState(true)

  const blk = (t: number) => Math.floor(t / BLOCK) // only full blocks are hashable
  const sharedBlocks = blk(shared)
  const aBlocks = blk(a)
  const bBlocks = blk(b)

  // request A always allocates; B reuses the shared prefix when caching is on
  const allocA = sharedBlocks + aBlocks
  const allocB = caching ? bBlocks : sharedBlocks + bBlocks
  const reused = caching ? sharedBlocks : 0
  const total = allocA + allocB
  const naive = sharedBlocks * 2 + aBlocks + bBlocks
  const saved = naive - total

  const W = 700
  const CELL = 15
  const X0 = 96

  const row = (label: string, cells: { t: "hit" | "miss"; }[], y: number) => (
    <g key={label}>
      <text x={X0 - 10} y={y + 11} fontSize={8.5} textAnchor="end" fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
        {label}
      </text>
      {cells.slice(0, 38).map((c, i) => (
        <rect
          key={i}
          x={X0 + i * (CELL + 1.5)}
          y={y}
          width={CELL}
          height={13}
          rx={2}
          fill={c.t === "hit" ? HIT : MISS}
          fillOpacity={c.t === "hit" ? 0.45 : 0.85}
          stroke={c.t === "hit" ? HIT : "transparent"}
          strokeOpacity={0.8}
          strokeDasharray={c.t === "hit" ? "2 2" : undefined}
        />
      ))}
    </g>
  )

  const cellsA = Array.from({ length: allocA }, () => ({ t: "miss" as const }))
  const cellsB = [
    ...Array.from({ length: reused }, () => ({ t: "hit" as const })),
    ...Array.from({ length: caching ? bBlocks : sharedBlocks + bBlocks }, () => ({ t: "miss" as const })),
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          two requests, {BLOCK} tokens per block
        </span>
        <span className="font-mono text-[10px]" style={{ color: saved > 0 ? HIT : FREE }}>
          {total} blocks allocated{saved > 0 ? ` · ${saved} saved by the prefix cache` : " · no reuse"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setCaching((v) => !v)}
          aria-pressed={caching}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            caching
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          prefix caching
        </button>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 96`} width={W} height={96} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two rows of KV cache blocks. Request A allocates ${allocA} blocks. Request B ${
                caching
                  ? `reuses ${reused} cached prefix blocks and allocates ${bBlocks} new ones`
                  : `allocates all ${allocB} of its own`
              }. Total ${total} against ${naive} without reuse.`}
            </title>
            {row("request A", cellsA, 8)}
            {row("request B", cellsB, 34)}

            <rect x={X0} y={62} width={CELL} height={13} rx={2} fill={NULLC} fillOpacity={0.7} />
            <text x={X0 + CELL + 8} y={73} fontSize={8} fill={NULLC} fontFamily="ui-monospace, monospace">
              null_block — popped from the free queue at startup so &ldquo;no block&rdquo; has an address
            </text>

            {(
              [
                ["allocated", MISS, 0.85, 330],
                ["cache hit — refcount bumped, no allocation", HIT, 0.45, 410],
              ] as const
            ).map(([label, colour, op, dx]) => (
              <g key={label}>
                <rect x={X0 + dx} y={62} width={9} height={9} rx={1.5} fill={colour} fillOpacity={op} />
                <text x={X0 + dx + 13} y={70} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["shared prompt", shared, setShared, 0, 320, 16, HIT, "tokens the two requests have in common"],
              ["request A", a, setA, 16, 256, 16, MISS, "tokens unique to the first request"],
              ["request B", b, setB, 16, 256, 16, MISS, "tokens unique to the second request"],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={v}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{v}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          PagedAttention&rsquo;s original pitch was about fragmentation: allocate KV in fixed blocks
          and a request no longer needs one contiguous reservation sized for its worst case. Prefix
          caching is what that indirection turns into once the blocks are content-addressed. Each
          full block is hashed, the hash is looked up, and a hit{" "}
          <span style={{ color: HIT }}>bumps a reference count instead of allocating</span>.
          <br />
          <br />
          Two details in the implementation are worth more than the diagram. Blocks whose refcount
          drops to zero are <em>not</em>{" "}freed — they go back into an eviction-ordered queue while
          keeping their hash, so a cached prefix stays reusable right up until something else
          actually needs the memory. And there is a{" "}
          <span style={{ color: NULLC }}>null block</span>: a real block popped off the free queue at
          startup whose refcount is deliberately not maintained, so that &ldquo;this slot has no
          block&rdquo; can be an ordinary block id rather than a special case threaded through every
          kernel.
          <br />
          <br />
          The sliders make the economics obvious.{" "}
          <span className="text-foreground">
            Prefix caching pays in exact proportion to how much of your traffic shares a prefix
          </span>
          {" "}— which, for a system prompt, a few-shot preamble or an agent replaying its own
          transcript, is most of it.
        </p>
      </div>
    </figure>
  )
}
