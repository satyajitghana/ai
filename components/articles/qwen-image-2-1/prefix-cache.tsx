"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the block-causal mask plus `causal_condition: true` actually buys, in
// tokens and multiply-accumulates.
//
// This is derived arithmetic on the shipped config, not a benchmark. Nothing
// here was timed. The shapes come from transformer/config.json (num_layers 32,
// num_attention_heads 32, attention_head_dim 128 -> d = 4096, mlp_ratio 3,
// patch_size 1) and vae/config.json (scale_factor_spatial 16), and the mask
// rule comes from diffusers' build_qwenimage21_block_causal_mask:
//
//     allowed = (q_idx >= kv_idx) | same_image_block
//
// Token count: patch_size is 1 and the VAE compresses 16x, so an H x W image is
// exactly (H/16) x (W/16) tokens. vLLM-Omni resizes each reference image to
// ~1024x1024 of area, so a reference costs 4,096 tokens.
//
// Per layer, per token, the linear layers cost 4d^2 (q/k/v/o) + 3 * d * 3d
// (SwiGLU) = 13d^2 = 218,103,808 MACs — which is also exactly the parameter
// count of one block, because the block is bias-free. Attention costs
// 2 * (query, key) pairs * d.
//
// Pair counts are exact under the block-causal mask: a token outside an image
// block sees positions 0..i, and a token inside image block [s, e) sees 0..e-1.
//
// Arithmetic is +, -, *, / and Math.round only — all exact per IEEE-754 — so no
// lib/dmath wrapper is needed.

const LAYERS = 32
const D = 4096
const LINEAR_MACS_PER_TOKEN_PER_LAYER = 13 * D * D // 218,103,808
const TEXT_TOKENS = 256 // a short instruction, stated rather than measured
const REF_TOKENS = 4096 // one ~1024x1024 reference at 16x compression
const STEPS = 40 // the checkpoint's documented default

const SIZES = [
  { label: "1024", px: 1024 },
  { label: "1536", px: 1536 },
  { label: "2048", px: 2048 },
]

/** Sum of key positions visible to every query, under (q >= kv) | same_image_block. */
function blockCausalPairs(segments: { len: number; image: boolean }[]): number {
  let pairs = 0
  let start = 0
  for (const seg of segments) {
    const end = start + seg.len
    if (seg.image) {
      // every token in the block sees the whole prefix and the whole block
      pairs += seg.len * end
    } else {
      // strictly causal: token at absolute index i sees i + 1 keys
      for (let i = start; i < end; i++) pairs += i + 1
    }
    start = end
  }
  return pairs
}

const fmtMacs = (m: number) => {
  if (m >= 1e15) return `${(m / 1e15).toFixed(2)} PMAC`
  if (m >= 1e12) return `${(m / 1e12).toFixed(1)} TMAC`
  return `${(m / 1e9).toFixed(1)} GMAC`
}

export function PrefixCache() {
  const [refs, setRefs] = useState(4)
  const [size, setSize] = useState(1024)

  const side = size / 16
  const targetTokens = side * side
  const prefix = TEXT_TOKENS + refs * REF_TOKENS
  const total = prefix + targetTokens
  const recomputed = (targetTokens * 100) / total

  const segments = [
    { len: TEXT_TOKENS, image: false },
    ...Array.from({ length: refs }, () => ({ len: REF_TOKENS, image: true })),
    { len: targetTokens, image: true },
  ]

  const prefillPairs = blockCausalPairs(segments)
  const decodePairs = targetTokens * total // target queries see everything

  const macs = (tokens: number, pairs: number) =>
    tokens * LINEAR_MACS_PER_TOKEN_PER_LAYER * LAYERS + 2 * pairs * D * LAYERS

  const prefill = macs(total, prefillPairs)
  const decode = macs(targetTokens, decodePairs)

  const cached = prefill + (STEPS - 1) * decode
  const uncached = STEPS * prefill
  const ratio = uncached / cached

  const bars = [
    { label: "prompt", tokens: TEXT_TOKENS, tone: "bg-foreground/25" },
    ...(refs > 0
      ? [
          {
            label: `${refs} reference${refs === 1 ? "" : "s"}`,
            tokens: refs * REF_TOKENS,
            tone: "bg-foreground/45",
          },
        ]
      : []),
    { label: "target image", tokens: targetTokens, tone: "bg-foreground/85" },
  ]

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-prefix-cache={refs}
      aria-label="Derived cost of the Qwen-Image-2.1 prefix KV cache as a function of reference-image count"
    >
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">
            reference images
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={refs}
            onChange={(e) => setRefs(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
            aria-label="number of reference images"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            {refs}{" "}
            <span className="text-muted-foreground">
              (the card claims 10; vLLM-Omni rejects a fifth with a 400)
            </span>
          </span>
        </label>

        <div>
          <span className="font-mono text-xs text-muted-foreground">
            target image, square
          </span>
          <div className="mt-2 flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s.px}
                type="button"
                onClick={() => setSize(s.px)}
                aria-pressed={size === s.px}
                className={cn(
                  "rounded-sm border px-3 py-1 font-mono text-xs",
                  size === s.px
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}px
              </button>
            ))}
          </div>
          <span className="mt-2 block font-mono text-sm tabular-nums">
            {side} x {side} ={" "}
            {targetTokens.toLocaleString("en-US")}{" "}
            <span className="text-muted-foreground">latent tokens</span>
          </span>
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          the joint sequence — {total.toLocaleString("en-US")} tokens
        </p>
        <div className="mt-3 flex h-7 overflow-hidden rounded-sm bg-muted/50">
          {bars.map((b) => (
            <div
              key={b.label}
              className={cn("h-full", b.tone)}
              style={{ width: `${(b.tokens * 100) / total}%` }}
              title={`${b.label}: ${b.tokens.toLocaleString("en-US")} tokens`}
            />
          ))}
        </div>
        <ul className="mt-2 mb-0 flex list-none flex-wrap gap-x-4 gap-y-1 pl-0 font-mono text-xs text-muted-foreground">
          {bars.map((b) => (
            <li key={b.label} className="my-0">
              <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-xs align-middle", b.tone)} />
              {b.label} {((b.tokens * 100) / total).toFixed(1)}%
            </li>
          ))}
        </ul>

        <p className="mt-4 mb-0 text-sm">
          Steps 2 through {STEPS} recompute{" "}
          <span className="font-mono tabular-nums">
            {recomputed.toFixed(1)}%
          </span>{" "}
          of the sequence. The other{" "}
          <span className="font-mono tabular-nums">
            {(100 - recomputed).toFixed(1)}%
          </span>{" "}
          is K and V that cannot change, because text and condition-image tokens
          modulate from{" "}
          <span className="font-mono">t = 0</span>{" "}
          rather than from the sampled timestep.
        </p>
      </div>

      <div className="grid gap-x-6 gap-y-1 border-t px-4 py-4 font-mono text-sm sm:grid-cols-2">
        <span className="text-muted-foreground">
          {STEPS} steps, prefix recomputed every step
        </span>
        <span className="tabular-nums">{fmtMacs(uncached)}</span>
        <span className="text-muted-foreground">
          {STEPS} steps, prefix cached after the first
        </span>
        <span className="tabular-nums">{fmtMacs(cached)}</span>
        <span className="font-medium text-foreground">saving</span>
        <span className="font-medium tabular-nums">
          {ratio.toFixed(2)}x fewer MACs
        </span>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Derived from the shipped config, not measured: 32 layers, d = 4,096, 13d²
        linear MACs per token per layer, exact block-causal pair counts, one MAC
        per multiply-add. It ignores normalisation, the VAE, the text encoder and
        every memory-bound effect, so treat the ratio as an upper bound on what
        the cache can pay for, not a speedup. For a sanity check, at 4 references
        and a 1024px target it puts{" "}
        <span className="font-mono">
          {((4096 * 100) / (256 + 4 * 4096 + 4096)).toFixed(1)}%
        </span>{" "}
        of the sequence in the recomputed part, against the &ldquo;about a
        fifth&rdquo; the vLLM-Omni recipe reports for the same configuration.
      </figcaption>
    </figure>
  )
}
