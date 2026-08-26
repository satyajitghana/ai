"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// EAGLE speculative decoding in SGLang, from python/sglang/srt/speculative/.
//
// The draft is a tree, not a chain. eagle_utils.organize_draft_results says it
// exactly:
//
//   # b, n, topk; n = 1 + (num_steps-1) * topk
//   score_list = torch.cat(score_list, dim=1).flatten(1)
//   top_scores = torch.topk(score_list, num_draft_token - 1, dim=-1)
//
// so the draft model runs `speculative_num_steps` times, each step expanding
// `speculative_eagle_topk` beams into topk children, and the whole candidate
// set is pruned to `speculative_num_draft_tokens - 1` by cumulative score.
// The bonus token (the target's last sampled token) is concatenated on the
// front in build_tree_kernel_efficient:
//
//   draft_tokens = torch.cat((bonus_tokens.unsqueeze(1), draft_tokens), dim=1)
//
// Cumulative scores are products of probabilities, so a child never outscores
// its parent: the kept set is automatically prefix-closed, and the pruned tree
// is a tree.
//
// build_tree_kernel_efficient then emits `tree_mask` plus first-child /
// next-sibling arrays (retrieve_next_token, retrieve_next_sibling) and
// `positions` ("where each token belongs to ... if depth of each draft token is
// [0, 1, 1, 2] and the prompt length is 7 then positions = [7, 8, 8, 9]").
// The mask makes every draft token attend only to its own ancestors, so all
// num_draft_tokens are verified in ONE target forward pass.
//
// After verify, spec_utils.move_accept_tokens_to_target_kvcache calls
// move_kv_cache(tgt_cache_loc, accept_out_cache_loc): the accepted chain's KV
// is copied into contiguous slots. It has to be. The radix tree stores a token
// run against a contiguous vector of KV indices; a tree-shaped scratch region
// is not something it can index.

const SEL = "oklch(0.60 0.15 255)"
const BONUS = "oklch(0.68 0.13 85)"
const ACCEPT = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

// Deterministic stand-in for the draft model's top-k probabilities.
const WEIGHTS = [0.62, 0.21, 0.11, 0.06]

type Cand = { id: number; parent: number; depth: number; score: number; rank: number }

function buildTree(topk: number, steps: number, keep: number) {
  // Step 1 expands the root; every later step expands each of the topk beams.
  const cands: Cand[] = []
  let next = 1
  let beams: { id: number; score: number }[] = [{ id: 0, score: 1 }]
  for (let d = 1; d <= steps; d++) {
    const born: { id: number; score: number }[] = []
    for (const b of beams) {
      for (let r = 0; r < topk; r++) {
        const score = b.score * WEIGHTS[r]
        cands.push({ id: next, parent: b.id, depth: d, score, rank: r })
        born.push({ id: next, score })
        next += 1
      }
    }
    // eagle2 keeps only topk beams alive between steps
    born.sort((a, b) => b.score - a.score || a.id - b.id)
    beams = born.slice(0, topk)
  }

  const ranked = [...cands].sort((a, b) => b.score - a.score || a.id - b.id)
  const kept = new Set(ranked.slice(0, keep).map((c) => c.id))
  // cumulative scores are monotone down a path, so the kept set is prefix-closed
  const nodes = cands.filter((c) => kept.has(c.id))
  return { total: cands.length, nodes }
}

export function DraftTree() {
  const [topk, setTopk] = useState(4)
  const [steps, setSteps] = useState(3)
  const [numDraft, setNumDraft] = useState(8)
  const [verified, setVerified] = useState(false)

  const maxDraft = Math.min(10, topk + (steps - 1) * topk * topk + 1)
  const nd = Math.min(numDraft, maxDraft)

  const { total, nodes } = useMemo(() => buildTree(topk, steps, nd - 1), [topk, steps, nd])

  // index order: root (bonus) first, then draft tokens by step then score
  const order = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => a.depth - b.depth || b.score - a.score || a.id - b.id)
    return [{ id: 0, parent: -1, depth: 0, score: 1, rank: 0 } as Cand, ...sorted]
  }, [nodes])

  const idxOf = useMemo(() => {
    const m = new Map<number, number>()
    order.forEach((n, i) => m.set(n.id, i))
    return m
  }, [order])

  const parentOf = useMemo(() => {
    const m = new Map<number, number>()
    order.forEach((n) => m.set(n.id, n.parent))
    return m
  }, [order])

  const ancestors = (id: number) => {
    const out = new Set<number>([id])
    let cur = parentOf.get(id) ?? -1
    while (cur >= 0) {
      out.add(cur)
      cur = parentOf.get(cur) ?? -1
    }
    return out
  }

  // the greedy chain: follow the highest-scoring kept child at each depth
  const chain = useMemo(() => {
    const path = [0]
    let cur = 0
    for (;;) {
      const kids = nodes.filter((n) => n.parent === cur)
      if (kids.length === 0) break
      kids.sort((a, b) => b.score - a.score || a.id - b.id)
      cur = kids[0].id
      path.push(cur)
    }
    return path
  }, [nodes])

  // one rejection: the target agrees with the draft for all but the last hop
  const accepted = verified ? chain.slice(0, Math.max(1, chain.length - 1)) : []
  const acceptedSet = new Set(accepted)

  // ---- geometry -----------------------------------------------------------
  const byDepth: number[][] = []
  order.forEach((n) => {
    if (!byDepth[n.depth]) byDepth[n.depth] = []
    byDepth[n.depth].push(n.id)
  })
  const rowsMax = Math.max(...byDepth.map((r) => r.length))
  const NODE_W = 60
  const ROW = 26
  const GX = 452
  const GY = 26
  const cell = Math.min(17, 196 / order.length)
  const H = Math.max(150, rowsMax * ROW + 46, GY + order.length * cell + 30)
  const W = 700
  const colX = (d: number) => 44 + d * 84
  const rowY = (d: number, i: number) => {
    const n = byDepth[d].length
    const mid = H / 2 - 16
    return mid - ((n - 1) * ROW) / 2 + i * ROW
  }
  const posOf = (id: number) => {
    const n = order.find((x) => x.id === id)!
    const i = byDepth[n.depth].indexOf(id)
    return { x: colX(n.depth), y: rowY(n.depth, i) }
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          EAGLE draft tree · one target forward verifies all of it
        </span>
        <span className="font-mono text-[10px]" style={{ color: SEL }}>
          {total} candidates scored → {nd} kept
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(
            [
              ["--speculative-eagle-topk", topk, 1, 4, setTopk],
              ["--speculative-num-steps", steps, 1, 4, setSteps],
              ["--speculative-num-draft-tokens", nd, 2, maxDraft, setNumDraft],
            ] as const
          ).map(([label, val, lo, hi, set]) => (
            <label key={label} className="block">
              <span className="flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
                <span className="truncate">{label}</span>
                <span className="ml-2 text-foreground">{val}</span>
              </span>
              <Range
                min={lo}
                max={hi}
                step={1}
                value={val}
                accent={SEL}
                aria-label={label}
                onChange={(e) => set(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setVerified((v) => !v)}
            aria-pressed={verified}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              verified
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            run verification
          </button>
          <span className="self-center font-mono text-[10px]" style={{ color: verified ? ACCEPT : MUTED }}>
            {verified
              ? `${accepted.length} tokens accepted, ${order.length - accepted.length} slots thrown away`
              : "draft only — nothing verified yet"}
          </span>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A draft tree of ${order.length} tokens, pruned from ${total} candidates scored over ${steps} draft steps with top-k ${topk}. The grid on the right is the tree attention mask: each draft token attends only to its own ancestors.${verified ? ` Verification accepted a chain of ${accepted.length} tokens.` : ""}`}
            </title>

            {/* edges */}
            {order
              .filter((n) => n.parent >= 0)
              .map((n) => {
                const p = posOf(n.parent)
                const c = posOf(n.id)
                const on = acceptedSet.has(n.id)
                return (
                  <path
                    key={`e${n.id}`}
                    d={`M ${p.x + NODE_W / 2} ${p.y} C ${p.x + NODE_W / 2 + 18} ${p.y}, ${c.x - NODE_W / 2 - 18} ${c.y}, ${c.x - NODE_W / 2} ${c.y}`}
                    fill="none"
                    stroke={on ? ACCEPT : SEL}
                    strokeOpacity={verified && !on ? 0.16 : 0.45}
                    strokeWidth={on ? 1.8 : 1.2}
                  />
                )
              })}

            {/* nodes */}
            {order.map((n) => {
              const { x, y } = posOf(n.id)
              const isRoot = n.id === 0
              const on = acceptedSet.has(n.id)
              const colour = isRoot ? BONUS : on ? ACCEPT : SEL
              return (
                <g key={`n${n.id}`} opacity={verified && !on ? 0.34 : 1}>
                  <rect
                    x={x - NODE_W / 2}
                    y={y - 9}
                    width={NODE_W}
                    height={18}
                    rx={4}
                    fill={colour}
                    fillOpacity={0.15}
                    stroke={colour}
                    strokeOpacity={0.8}
                  />
                  <text
                    x={x}
                    y={y + 3}
                    fontSize={7.5}
                    textAnchor="middle"
                    fill={colour}
                    fontFamily="ui-monospace, monospace"
                  >
                    {isRoot ? "bonus" : `t${idxOf.get(n.id)}`}
                  </text>
                </g>
              )
            })}

            {/* depth axis */}
            {byDepth.map((_, d) => (
              <text
                key={`d${d}`}
                x={colX(d)}
                y={H - 24}
                fontSize={7}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.42}
                fontFamily="ui-monospace, monospace"
              >
                {d === 0 ? "target" : `step ${d}`}
              </text>
            ))}

            {/* tree attention mask */}
            <text x={GX} y={GY - 8} fontSize={8} fill={MUTED} fontFamily="ui-monospace, monospace">
              tree_mask · {order.length}×{order.length}
            </text>
            {order.map((r, i) => {
              const anc = ancestors(r.id)
              return order.map((c, j) => {
                const on = anc.has(c.id)
                return (
                  <rect
                    key={`m${i}-${j}`}
                    x={GX + j * cell}
                    y={GY + i * cell}
                    width={cell - 1.4}
                    height={cell - 1.4}
                    rx={1.5}
                    fill={on ? SEL : "currentColor"}
                    fillOpacity={on ? 0.62 : 0.07}
                  />
                )
              })
            })}
            <text
              x={GX}
              y={GY + order.length * cell + 11}
              fontSize={7}
              fill="currentColor"
              fillOpacity={0.42}
              fontFamily="ui-monospace, monospace"
            >
              row i attends to column j
            </text>

            {/* legend */}
            {(
              [
                ["bonus token from the target", BONUS, 0],
                ["kept draft token", SEL, 176],
                ["accepted", ACCEPT, 300],
              ] as const
            ).map(([label, colour, dx]) => (
              <g key={label}>
                <rect x={24 + dx} y={H - 13} width={8} height={8} rx={1.5} fill={colour} fillOpacity={0.75} />
                <text
                  x={24 + dx + 12}
                  y={H - 6}
                  fontSize={7.5}
                  fill="currentColor"
                  fillOpacity={0.5}
                  fontFamily="ui-monospace, monospace"
                >
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A chain draft asks one question: are the next <em>k</em> tokens right? A tree draft asks{" "}
          <span className="text-foreground">{nd} questions at once</span>{" "}and takes the longest
          answer that survives. Raise{" "}
          <span className="font-mono text-[11px] text-foreground">topk</span>{" "}and the draft model
          scores {total} candidates; <code>torch.topk</code> keeps the best {nd - 1} by cumulative
          score and throws the rest away before the target ever sees them.
          <br />
          <br />
          The grid is the whole trick. Because each draft token is masked to{" "}
          <span style={{ color: SEL }}>its own ancestors only</span>, every branch of the tree is a
          valid independent continuation inside a single forward pass — so verification costs one
          target step no matter how wide the tree is. Widening therefore buys extra candidates for
          extra tokens in a verify step that was memory-bound anyway; deepening buys them for one
          more <span className="text-foreground">serial</span>{" "}draft forward each, on the
          critical path.
          <br />
          <br />
          Press <span className="text-foreground">run verification</span>{" "}for the part that touches
          the cache. The accepted tokens are scattered across the draft&rsquo;s scratch KV slots, so{" "}
          <span className="font-mono text-[11px] text-foreground">move_accept_tokens_to_target_kvcache</span>{" "}
          copies them into contiguous positions before the radix tree is allowed to see them. A tree
          of KV is fine for one step of attention; the prefix cache needs a line.
        </p>
      </div>
    </figure>
  )
}
