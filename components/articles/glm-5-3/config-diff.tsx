"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The claim this article opened with — "same base model as GLM-5.2, nothing to
// report about parameter counts because none of them changed" — could only be
// taken on Z.ai's word when this piece was first published: the weights did not
// exist yet. Now they do, so the claim is checkable against the thing itself.
//
// Fetched and diffed field-by-field, 2026-08-28:
//   https://huggingface.co/zai-org/GLM-5.2/raw/main/config.json
//   https://huggingface.co/zai-org/GLM-5.3/raw/main/config.json
//
// Union of top-level keys: 56. Identical: 54. Different: 2 — quantization_config
// (absent on 5.2, present on 5.3) and transformers_version (a library-metadata
// bump, 5.12.0 -> 5.15.0). Every architectural field — layer count, expert
// count, hidden size, context length, routing, the indexer pattern — is
// byte-identical.

type Fact = { label: string; value: string }

const IDENTICAL: Fact[] = [
  { label: "architectures", value: "GlmMoeDsaForCausalLM" },
  { label: "model_type", value: "glm_moe_dsa" },
  { label: "num_hidden_layers", value: "78" },
  { label: "first_k_dense_replace", value: "3 (3 dense, 75 MoE)" },
  { label: "hidden_size", value: "6,144" },
  { label: "n_routed_experts", value: "256" },
  { label: "num_experts_per_tok", value: "8" },
  { label: "n_shared_experts", value: "1" },
  { label: "moe_intermediate_size", value: "2,048" },
  { label: "max_position_embeddings", value: "1,048,576 (1M)" },
  { label: "num_nextn_predict_layers", value: "1 (MTP)" },
  { label: "vocab_size", value: "154,880" },
  { label: "topk_method / scoring_func", value: "noaux_tc / sigmoid" },
  { label: "routed_scaling_factor", value: "2.5" },
  { label: "indexer_types", value: "78 entries, full/shared pattern" },
]

type Diff = { label: string; a: string; b: string }

const DIFFERENT: Diff[] = [
  {
    label: "quantization_config",
    a: "(key absent)",
    b: "fp8 · e4m3 · block 128×128, ~330 modules excluded",
  },
  {
    label: "transformers_version",
    a: "5.12.0",
    b: "5.15.0",
  },
]

const SAME = "oklch(0.55 0.16 155)"
const DIFF = "oklch(0.68 0.13 85)"

// 56 top-level keys total (union of both files' keys), 54 identical, 2
// different. IDENTICAL below lists the 15 architecturally load-bearing ones;
// the rest are smaller fields (norm epsilons, token ids, dtype flags, …) that
// are identical too but not worth a row each.
const TOTAL_IDENTICAL = 54

type View = "same" | "diff"

export function ConfigDiff() {
  const [view, setView] = useState<View>("same")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">config.json · GLM-5.2 vs GLM-5.3 · 56 keys</span>
        <div className="flex gap-1">
          {(["same", "diff"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "same" ? `identical (${TOTAL_IDENTICAL})` : `different (${DIFFERENT.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "same" ? (
          <>
          <div className="mb-2 font-mono text-[10px] text-muted-foreground">
            {IDENTICAL.length} of {TOTAL_IDENTICAL} identical keys shown — the architecturally load-bearing ones
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {IDENTICAL.map((f) => (
              <div key={f.label} className="flex items-baseline gap-2 rounded-md px-2 py-1 odd:bg-muted/20">
                <span
                  className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: SAME }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                  {f.label}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-foreground">{f.value}</span>
              </div>
            ))}
          </div>
          </>
        ) : (
          <div className="space-y-2.5">
            {DIFFERENT.map((f) => (
              <div key={f.label} className="rounded-lg border px-3 py-2.5" style={{ borderColor: `color-mix(in oklch, ${DIFF} 35%, transparent)` }}>
                <div className="font-mono text-[11px] text-foreground">{f.label}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="rounded-sm bg-muted/40 px-1.5 py-0.5">5.2: {f.a}</span>
                  <span aria-hidden>→</span>
                  <span className="rounded-sm px-1.5 py-0.5" style={{ background: `color-mix(in oklch, ${DIFF} 18%, transparent)`, color: DIFF }}>
                    5.3: {f.b}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SAME }} />
            54 of 56 keys identical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DIFF }} />2 differ
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          At launch this article could only take Z.ai&rsquo;s word for &ldquo;same base model as GLM-5.2.&rdquo; Now
          the two configs can be diffed directly: 56 top-level keys in the union of both files, 54 byte-identical,
          and exactly 2 different — <span className="text-foreground">quantization_config</span>, which 5.3 ships
          and 5.2&rsquo;s file simply does not have the key for, and{" "}
          <span className="text-foreground">transformers_version</span>, a library-metadata bump with no
          architectural meaning. Every number that describes the model itself — layer count, expert count, hidden
          size, context length, the routing scheme, the indexer pattern — did not move. The claim holds at the level
          of the file, not just the press release.
        </p>
      </div>
    </figure>
  )
}
