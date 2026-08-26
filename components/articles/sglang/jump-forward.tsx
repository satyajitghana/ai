"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Constrained decoding in SGLang, from python/sglang/srt/constrained/.
//
// Two mechanisms, one wired up and one not.
//
// 1. The token mask. XGrammarGrammar.fill_vocab_mask calls
//    matcher.fill_next_token_bitmask(vocab_mask, idx); the buffer is allocated
//    by _allocate_token_bitmask -> torch.full(get_bitmask_shape(batch, vocab),
//    -1, dtype=bitmask_dtype, pin_memory=...). bitmask_dtype is int32 and the
//    shape is (batch, ceil(vocab/32)) -- "32 boolean bitmask values are packed
//    into 32-bit integers", per the comment in speculative/spec_utils.py:474.
//    SamplingBatchInfo.update_regex_vocab_mask fills one row per unfinished
//    grammar request, and ModelRunner._preprocess_logits applies it via
//    apply_token_bitmask_inplace_triton right before sampling.
//
// 2. Jump-forward decoding (the paper's "compressed FSM"). outlines_jump_forward.py
//    builds state_to_jump_forward by walking the FSM transitions and keeping only
//    states with exactly one outgoing edge (`if outgoings_ct[state] > 1: del ...`).
//    A run of such states is a deterministic span that can be emitted with no
//    forward pass at all. All four backends implement try_jump_forward /
//    jump_forward_str_state / jump_and_retokenize.
//
//    At e27a7fa nothing calls them. grep across python/, test/, benchmark/ and
//    rust/ returns only the definitions; OutlinesGrammarBackend._compile_regex
//    even hardcodes `jump_forward_map = None`.
//
// The token stream below is real: cl100k_base applied to
//   {"name": "Ada Lovelace", "role": "engineer", "team": "core", "years": 12, "active": true}
// with each token marked by whether it lies inside a grammar-determined span.
// 33 tokens, 12 of which the model must actually produce. Four tokens straddle
// the boundary between a free span and a determined one -- which is precisely
// why the paper's Appendix B.2 has to retokenize everything after a jump.

const DECODE = "oklch(0.60 0.15 255)"
const JUMPED = "oklch(0.55 0.16 155)"
const STRADDLE = "oklch(0.68 0.13 85)"
const MUTED = "oklch(0.62 0.03 250)"

type Tok = { t: string; free: boolean; straddle?: boolean }

const TOKENS: Tok[] = [
  { t: '{"', free: false },
  { t: "name", free: false },
  { t: '":', free: false },
  { t: ' "', free: false },
  { t: "Ada", free: true },
  { t: " Lov", free: true },
  { t: "el", free: true },
  { t: "ace", free: true },
  { t: '",', free: true, straddle: true },
  { t: ' "', free: false },
  { t: "role", free: false },
  { t: '":', free: false },
  { t: ' "', free: false },
  { t: "engine", free: true },
  { t: "er", free: true },
  { t: '",', free: true, straddle: true },
  { t: ' "', free: false },
  { t: "team", free: false },
  { t: '":', free: false },
  { t: ' "', free: false },
  { t: "core", free: true },
  { t: '",', free: true, straddle: true },
  { t: ' "', free: false },
  { t: "years", free: false },
  { t: '":', free: false },
  { t: " ", free: false },
  { t: "12", free: true },
  { t: ",", free: false },
  { t: ' "', free: false },
  { t: "active", free: false },
  { t: '":', free: false },
  { t: " true", free: true, straddle: true },
  { t: "}", free: false },
]

const TOTAL = TOKENS.length
const DECODED = TOKENS.filter((k) => k.free).length
const STRADDLES = TOKENS.filter((k) => k.straddle).length

// Llama-3 vocabulary; ceil(128256 / 32) = 4008 int32 words = 16032 bytes per row.
const VOCAB = 128256
const MASK_WORDS = Math.ceil(VOCAB / 32)
const MASK_BYTES = MASK_WORDS * 4

export function JumpForward() {
  const [jump, setJump] = useState(false)
  const [marks, setMarks] = useState(false)

  const passes = jump ? DECODED : TOTAL
  const kib = (passes * MASK_BYTES) / 1024

  const W = 700
  const H = 92
  const X0 = 138
  const px = (n: number) => (n / TOTAL) * (W - X0 - 74)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one JSON schema · cl100k_base · {TOTAL} tokens
        </span>
        <span className="font-mono text-[10px]" style={{ color: jump ? JUMPED : DECODE }}>
          {passes} forward passes
          {jump ? ` · ${TOTAL - DECODED} emitted for free` : " · one per token"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              [false, "token mask only"],
              [true, "mask + jump forward"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setJump(k)}
              aria-pressed={jump === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                jump === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMarks((v) => !v)}
            aria-pressed={marks}
            className={cn(
              "ml-2 cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              marks
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            mark tokenizer boundaries
          </button>
        </div>

        <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/25 p-3 font-mono text-[10.5px] leading-5 text-foreground">
          {
            'r\'\\{"name": "[A-Za-z ]+", "role": "[a-z]+", "team": "[a-z]+", "years": [0-9]+, "active": (true|false)\\}\''
          }
        </pre>

        <div className="mt-3 flex flex-wrap gap-[3px]">
          {TOKENS.map((k, i) => {
            const isFree = k.free
            const colour = !jump
              ? DECODE
              : marks && k.straddle
                ? STRADDLE
                : isFree
                  ? DECODE
                  : JUMPED
            return (
              <span
                key={i}
                className="rounded border px-1.5 py-[3px] font-mono text-[10.5px] whitespace-pre"
                style={{
                  color: colour,
                  borderColor: colour,
                  opacity: jump && !isFree ? 0.78 : 1,
                }}
              >
                {k.t === " " ? "␣" : k.t}
              </span>
            )
          })}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {jump
                ? `With jump-forward decoding the schema costs ${DECODED} forward passes instead of ${TOTAL}; the remaining ${TOTAL - DECODED} tokens are emitted straight from the grammar, and ${STRADDLES} tokens straddle a span boundary and force a retokenization.`
                : `With a per-step token mask only, every one of the ${TOTAL} tokens costs a forward pass and a ${MASK_BYTES}-byte bitmask row.`}
            </title>

            {(
              [
                ["mask only", TOTAL, DECODE, 14],
                ["+ jump forward", DECODED, JUMPED, 42],
              ] as const
            ).map(([label, n, colour, y]) => (
              <g key={label}>
                <text
                  x={X0 - 10}
                  y={y + 10}
                  fontSize={8.5}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.6}
                  fontFamily="ui-monospace, monospace"
                >
                  {label}
                </text>
                <rect x={X0} y={y} width={px(n)} height={14} rx={2.5} fill={colour} fillOpacity={0.82} />
                <text
                  x={X0 + px(n) + 8}
                  y={y + 10.5}
                  fontSize={8.5}
                  fill={colour}
                  fontFamily="ui-monospace, monospace"
                >
                  {n} passes
                </text>
              </g>
            ))}

            <text
              x={X0 - 10}
              y={78}
              fontSize={8.5}
              textAnchor="end"
              fill="currentColor"
              fillOpacity={0.6}
              fontFamily="ui-monospace, monospace"
            >
              bitmask traffic
            </text>
            <text x={X0} y={78} fontSize={8.5} fill={MUTED} fontFamily="ui-monospace, monospace">
              {`${passes} rows × ${MASK_WORDS} int32 = ${kib.toFixed(0)} KiB host→device for this one request`}
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every grammar backend does the same thing each decode step: fill a bitmask row with the
          tokens the FSM will accept, copy it to the GPU, and{" "}
          <span className="text-foreground">subtract infinity from every illegal logit</span>{" "}before
          sampling. One int32 holds 32 tokens, so a Llama-3 vocabulary needs{" "}
          {MASK_WORDS} words — {MASK_BYTES.toLocaleString()} bytes per request per step, moved
          across PCIe every step.
          <br />
          <br />
          Jump-forward decoding is the observation that most of a JSON schema is not a choice.{" "}
          <span style={{ color: JUMPED }}>21 of these 33 tokens</span>{" "}sit on a stretch of the FSM
          with exactly one outgoing edge, so the runtime can append them and skip the forward pass
          entirely. On this schema that is 2.75× on the decode phase — against a measured 1.6×
          end-to-end in the paper, which is the honest gap between a token count and a benchmark.
          <br />
          <br />
          Turn on{" "}
          <span style={{ color: STRADDLE }}>tokenizer boundaries</span>{" "}for the catch. Four tokens
          span both sides of the divide — <code>&quot;,</code> is the closing quote the model chose{" "}
          <em>plus</em> the comma the grammar was going to emit anyway. You cannot append the
          determined half without re-splitting the joined text, which is why a jump has to
          retokenize everything before it.
        </p>
      </div>
    </figure>
  )
}
