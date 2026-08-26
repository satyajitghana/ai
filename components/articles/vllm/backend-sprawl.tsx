"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Counted from the clone at 17da485 (2026-08-27):
//
//   find vllm -name "*.py" | wc -l          → 2,265
//   ls vllm/model_executor/models/*.py      → 280
//   ls vllm/v1/attention/backends/          → 23 entries
//   ls vllm/v1/spec_decode/                 → 17 entries
//   ls .../kv_connector/v1/                 → 15 entries
//
// The interesting shape is not the totals but which of those directories grew
// and why. `gdn_attn.py`, `linear_attn.py`, `mamba1_attn.py`, `mamba2_attn.py`,
// `short_conv_attn.py` and `mla/` do not exist because someone wanted variety.
// They exist because the models shipping in 2026 stopped being stacks of
// identical full-attention layers, and a serving engine has to hold whatever
// the labs decide to build.

const A = "oklch(0.60 0.15 255)"
const B = "oklch(0.55 0.16 155)"
const C = "oklch(0.68 0.13 85)"
const D = "oklch(0.55 0.10 300)"
const MUTED = "oklch(0.62 0.03 250)"

type Group = { k: string; label: string; colour: string; items: string[]; why: string }

const GROUPS: Group[] = [
  {
    k: "attn",
    label: "attention backends · 23",
    colour: A,
    items: [
      "flash_attn", "flashinfer", "triton_attn", "flex_attention", "cpu_attn",
      "rocm_attn", "rocm_aiter_fa", "rocm_aiter_unified_attn", "hpc_attn",
      "mla/ (latent KV)", "gdn_attn", "linear_attn", "mamba1_attn", "mamba2_attn",
      "mamba_attn", "short_conv_attn", "turboquant_attn", "flash_attn_diffkv",
      "triton_attn_diffkv", "recoverssm_metadata", "fa_utils", "registry", "utils",
    ],
    why: "Six of these are not attention at all — gated delta nets, linear attention, two Mamba generations and a short-convolution path. They are here because a 2026 checkpoint is routinely three-quarters recurrent layers, and the engine has to hold a KV cache for some layers and a fixed-size state for others in the same model.",
  },
  {
    k: "spec",
    label: "speculative decoding · 17",
    colour: B,
    items: [
      "ngram_proposer", "ngram_proposer_gpu", "draft_model", "eagle", "medusa",
      "suffix_decoding", "dflash", "gemma4", "step3p5", "dynamic/",
      "custom_class_proposer", "llm_base_proposer", "extract_hidden_states",
      "vocab_mapping", "metadata", "metrics", "utils",
    ],
    why: "Three of these are named after specific models — gemma4, step3p5, dflash. Speculative decoding stopped being one technique and became a per-architecture integration surface, because MTP heads now ship with the weights and every lab draws its draft path slightly differently.",
  },
  {
    k: "kv",
    label: "KV transfer connectors · 15",
    colour: C,
    items: [
      "lmcache_connector", "lmcache_mp_connector", "lmcache_integration/",
      "mooncake/", "moriio/", "flexkv_connector", "hf3fs/", "multi_connector",
      "decode_bench_connector", "example_connector", "example_hidden_states_connector",
      "metrics", "base", "__init__", "v1/",
    ],
    why: "A pluggable interface for moving KV cache between processes and machines — the substrate for prefill/decode disaggregation. That there are third-party connectors (Mooncake, LMCache, hf3fs) rather than one blessed implementation is the tell: this became a place other systems plug into.",
  },
  {
    k: "models",
    label: "model architectures · 280",
    colour: D,
    items: ["one file per architecture in vllm/model_executor/models/"],
    why: "The number that explains the other three. Supporting 280 architectures means every attention variant, every draft-head convention and every quantization format any of them ships with has to be represented somewhere — and no single one of those files is where the complexity lives.",
  },
]

export function BackendSprawl() {
  const [sel, setSel] = useState("attn")
  const g = GROUPS.find((x) => x.k === sel)!

  const W = 700
  const COLS = 4

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          2,265 Python files · 858,189 lines · v1 engine
        </span>
        <span className="font-mono text-[10px]" style={{ color: g.colour }}>
          {g.label}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={sel === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div
          className="mt-3 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${g.items.length > 6 ? COLS : 1}, minmax(0, 1fr))` }}
        >
          {g.items.map((it) => (
            <div
              key={it}
              className="rounded-md bg-muted/25 px-2 py-1 font-mono text-[9.5px]"
              style={{ boxShadow: `inset 2px 0 0 ${g.colour}` }}
            >
              {it}
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            why there are this many
          </div>
          <div className="text-sm leading-6 text-muted-foreground">{g.why}</div>
        </div>

        <svg viewBox={`0 0 ${W} 8`} width={W} height={8} className="mt-2 w-full" aria-hidden="true">
          <rect x={0} y={2} width={W} height={4} rx={2} fill={MUTED} fillOpacity={0.12} />
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          vLLM is still described, four years on, as &ldquo;PagedAttention and continuous
          batching.&rdquo; Those are two ideas in an 858,000-line codebase, and neither is where the
          work is any more.
          <br />
          <br />
          Click through the four groups and a pattern shows up.{" "}
          <span className="text-foreground">
            Almost all of this exists because the models changed, not because the serving got
            cleverer
          </span>
          . Six of the twenty-three &ldquo;attention&rdquo; backends do not compute attention — they
          run gated delta nets, Mamba, or short convolutions, because the checkpoints shipping now
          are three-quarters recurrent layers with full attention sprinkled in. Three of the
          speculative-decoding proposers are named after individual models. And the KV connector
          directory contains other people&rsquo;s systems.
          <br />
          <br />
          That is what an inference engine becomes when it succeeds: not a good implementation of one
          idea, but the place where every lab&rsquo;s architectural opinion has to be reconciled with
          every other lab&rsquo;s. The 280 model files are the cause; the other three directories are
          the bill.
        </p>
      </div>
    </figure>
  )
}
